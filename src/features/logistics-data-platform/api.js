import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { invokeDashboardApi } from '../../utils/supabaseSession.js';

export const DATA_PLATFORM_ACTIONS = Object.freeze({
  homeRead: 'v2/home/read',
  homeBatchSave: 'v2/home/batch-save',
  rentRollRead: 'v2/rent-roll/read',
  rentRollBatchSave: 'v2/rent-roll/batch-save',
  financeRead: 'v2/finance/read',
  financeBatchSave: 'v2/finance/batch-save',
  maturitiesRead: 'v2/maturities/read',
  calculationsExplain: 'v2/calculations/explain',
});

export class DataPlatformResponseError extends Error {
  constructor(message, {
    status = null,
    requestId = null,
    code = null,
    details = null,
    cause = null,
  } = {}) {
    super(message, { cause });
    this.name = 'DataPlatformResponseError';
    this.status = status;
    this.requestId = requestId;
    this.code = code;
    this.details = details;
  }
}

function dataPlatformErrorChain(error) {
  const queue = [error];
  const seen = new Set();
  const chain = [];
  while (queue.length && chain.length < 8) {
    const candidate = queue.shift();
    if (!candidate || (typeof candidate !== 'object' && typeof candidate !== 'function') || seen.has(candidate)) {
      continue;
    }
    seen.add(candidate);
    chain.push(candidate);
    for (const nested of [candidate.cause, candidate.reason]) {
      if (nested && !seen.has(nested)) queue.push(nested);
    }
  }
  return chain;
}

function dataPlatformErrorStatus(candidate) {
  const value = Number(
    candidate?.status
      || candidate?.statusCode
      || candidate?.httpStatus
      || candidate?.context?.status
      || 0,
  );
  return Number.isFinite(value) ? value : 0;
}

async function dataPlatformErrorPayload(error) {
  for (const candidate of dataPlatformErrorChain(error)) {
    const context = candidate?.context;
    if (context && typeof context.clone === 'function') {
      try {
        return await context.clone().json();
      } catch {
        // Continue through wrapped causes when the response has no JSON body.
      }
    }
    if (candidate?.body && typeof candidate.body === 'object') return candidate.body;
  }
  return null;
}

export function isDataPlatformRevisionConflict(error) {
  const chain = dataPlatformErrorChain(error);
  const status = chain.map(dataPlatformErrorStatus).find(Boolean) || 0;
  if (status !== 409) return false;
  return chain.some((candidate) => [
    candidate?.code,
    candidate?.message,
    candidate?.details?.code,
    candidate?.details?.message,
  ].some((value) => String(value || '').trim() === 'REVISION_CONFLICT'));
}

/**
 * A resource read may be cancelled because React unmounted it, the resource
 * became inactive, or a newer asset/filter request superseded it. Those are
 * lifecycle events, not user-visible failures. HTTP failures and timeouts are
 * deliberately excluded even if a transport wrapper also mentions aborting.
 */
export function isDataPlatformRequestCancellation(error, signal = null) {
  const chain = dataPlatformErrorChain(error);
  const statuses = chain.map(dataPlatformErrorStatus).filter(Boolean);
  if (statuses.some((status) => status >= 400 && status !== 499)) return false;
  if (signal?.aborted) return true;

  return chain.some((candidate) => {
    const name = String(candidate?.name || '').toLowerCase();
    const code = String(candidate?.code || '').toLowerCase();
    const message = String(candidate?.message || '').toLowerCase();
    return dataPlatformErrorStatus(candidate) === 499
      || name === 'aborterror'
      || name === 'cancelederror'
      || name === 'cancellationerror'
      || code === 'abort_err'
      || code === 'err_canceled'
      || code === 'err_cancelled'
      || Number(candidate?.code) === 20
      || /\b(?:aborted|cancelled|canceled)\b/u.test(message);
  });
}

export function friendlyDataPlatformError(error) {
  const chain = dataPlatformErrorChain(error);
  const status = chain.map(dataPlatformErrorStatus).find(Boolean) || 0;
  if (status === 401) return '로그인이 만료되었습니다. 다시 로그인한 뒤 시도해 주세요.';
  if (status === 403) return '이 작업을 수행할 권한이 없습니다. 담당 권한을 확인해 주세요.';
  if (status === 409) return '다른 담당자가 먼저 수정했습니다. 최신 내용을 다시 불러온 뒤 저장해 주세요.';
  if (status === 422) return '입력한 값 중 저장할 수 없는 항목이 있습니다. 표시된 값을 확인해 주세요.';
  if (status === 429) return '요청이 잠시 몰렸습니다. 잠시 후 다시 시도해 주세요.';
  if (status >= 500) return '서버에서 요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.';
  if (chain.some((candidate) => candidate?.name === 'AbortError')) {
    return '요청이 취소되었습니다. 다시 시도해 주세요.';
  }
  return '데이터를 처리하지 못했습니다. 입력값과 연결 상태를 확인한 뒤 다시 시도해 주세요.';
}

export function inactivePrimaryResourceState(current) {
  if (!current.loading && current.error === null) return current;
  return { ...current, loading: false, error: null };
}

export async function invokeDataPlatform(action, payload = {}, { signal = null } = {}) {
  const result = await invokeDashboardApi(action, payload, {
    signal,
    retryAuth: true,
    retryNetwork: true,
    retryTimeout: true,
  });

  if (result?.error) {
    const cause = result.error;
    const status = dataPlatformErrorStatus(cause) || null;
    const payloadError = await dataPlatformErrorPayload(cause);
    const code = String(payloadError?.message || payloadError?.code || cause?.code || '') || null;
    throw new DataPlatformResponseError(
      friendlyDataPlatformError(cause),
      {
        status,
        requestId: payloadError?.request_id || null,
        code,
        details: payloadError?.detail || null,
        cause,
      },
    );
  }

  const response = result?.data;
  if (!response || response.ok !== true || response.status !== 'primary') {
    const responseError = { status: response?.status || null };
    throw new DataPlatformResponseError(
      friendlyDataPlatformError(responseError),
      { status: response?.status || null, requestId: response?.request_id || null },
    );
  }
  if (!response.request_id || response.revision === undefined || !('data' in response)) {
    throw new DataPlatformResponseError('응답 식별자 또는 버전 정보가 누락되었습니다.', {
      requestId: response?.request_id || null,
    });
  }
  return response;
}

export function usePrimaryResource(action, payload, { enabled = true } = {}) {
  const [reloadToken, setReloadToken] = useState(0);
  const [state, setState] = useState({
    data: null,
    revision: null,
    requestId: null,
    loading: false,
    error: null,
  });
  const generation = useRef(0);
  const payloadKey = useMemo(() => JSON.stringify(payload || {}), [payload]);

  useEffect(() => {
    if (!enabled) {
      generation.current += 1;
      setState(inactivePrimaryResourceState);
      return undefined;
    }
    const controller = new AbortController();
    const requestGeneration = ++generation.current;
    setState((current) => ({ ...current, loading: true, error: null }));

    invokeDataPlatform(action, JSON.parse(payloadKey), { signal: controller.signal })
      .then((response) => {
        if (controller.signal.aborted || requestGeneration !== generation.current) return;
        setState({
          data: response.data,
          revision: response.revision,
          requestId: response.request_id,
          loading: false,
          error: null,
        });
      })
      .catch((error) => {
        if (controller.signal.aborted || requestGeneration !== generation.current) return;
        if (isDataPlatformRequestCancellation(error, controller.signal)) {
          setState((current) => ({ ...current, loading: false, error: null }));
          return;
        }
        setState((current) => ({ ...current, loading: false, error }));
      });

    return () => {
      controller.abort();
    };
  }, [action, enabled, payloadKey, reloadToken]);

  const reload = useCallback(() => setReloadToken((value) => value + 1), []);
  return { ...state, reload };
}

export function createClientRequestId(prefix) {
  void prefix;
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  throw new DataPlatformResponseError('이 브라우저에서는 안전한 저장 요청 ID를 만들 수 없습니다.');
}
