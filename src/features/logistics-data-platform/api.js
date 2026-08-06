import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { invokeDashboardApi } from '../../utils/supabaseSession';

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
  constructor(message, { status = null, requestId = null, cause = null } = {}) {
    super(message, { cause });
    this.name = 'DataPlatformResponseError';
    this.status = status;
    this.requestId = requestId;
  }
}

export function friendlyDataPlatformError(error) {
  const status = Number(error?.status || error?.cause?.status || 0);
  if (status === 401) return '로그인이 만료되었습니다. 다시 로그인한 뒤 시도해 주세요.';
  if (status === 403) return '이 작업을 수행할 권한이 없습니다. 담당 권한을 확인해 주세요.';
  if (status === 409) return '다른 담당자가 먼저 수정했습니다. 최신 내용을 다시 불러온 뒤 저장해 주세요.';
  if (status === 429) return '요청이 잠시 몰렸습니다. 잠시 후 다시 시도해 주세요.';
  if (status >= 500) return '서버에서 요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.';
  if (error?.name === 'AbortError') return '요청이 취소되었습니다. 다시 시도해 주세요.';
  return '데이터를 처리하지 못했습니다. 입력값과 연결 상태를 확인한 뒤 다시 시도해 주세요.';
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
    throw new DataPlatformResponseError(
      friendlyDataPlatformError(cause),
      { status: cause.status || null, cause },
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
    if (!enabled) return undefined;
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
