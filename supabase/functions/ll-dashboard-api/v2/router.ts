import {
  isPrimaryResponse,
  primaryResponse,
  V2_PUBLIC_ACTIONS,
  type PrimaryResponse,
  type V2PublicAction,
} from './contracts.ts';

const ACTION_TO_RPC: Readonly<Record<V2PublicAction, string>> = Object.freeze({
  'v2/home/read': 'home_read',
  'v2/home/batch-save': 'home_batch_save',
  'v2/rent-roll/read': 'rent_roll_read',
  'v2/rent-roll/batch-save': 'rent_roll_batch_save',
  'v2/finance/read': 'finance_read',
  'v2/finance/batch-save': 'finance_batch_save',
  'v2/maturities/read': 'maturities_read',
  'v2/calculations/explain': 'calculations_explain',
});

const WRITE_ACTIONS: ReadonlySet<V2PublicAction> = new Set([
  'v2/home/batch-save',
  'v2/rent-roll/batch-save',
  'v2/finance/batch-save',
]);

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export type V2ActionRequest = {
  client_request_id?: string;
  asset_key?: string;
  payload?: Record<string, unknown>;
  expected_revisions?: Record<string, number>;
};

export type V2RpcError = {
  httpStatus: number;
  code: string;
  retryable: boolean;
};

export type SupabaseRpcClient = {
  schema: (schema: string) => {
    rpc: (name: string, args: Record<string, unknown>) => Promise<{
      data: unknown;
      error: null | { code?: string; message?: string; details?: string };
    }>;
  };
};

export type V2UserRpcContext = {
  authMode: 'anon-key-user-jwt';
  accessToken: string;
  client: SupabaseRpcClient;
};

export function isV2PublicAction(action: string): action is V2PublicAction {
  return (V2_PUBLIC_ACTIONS as readonly string[]).includes(action);
}

export function rpcNameForAction(action: string): string {
  if (!isV2PublicAction(action)) throw new Error('UNSUPPORTED_ACTION');
  return ACTION_TO_RPC[action];
}

function normalizeFinancePayload(
  payload: Record<string, unknown>,
  clientRequestId: string,
): Record<string, unknown> {
  const entries = payload.entries;
  const existingOperations = payload.operations;
  if (entries !== undefined && !Array.isArray(entries)) throw new Error('FINANCE_ENTRIES_ARRAY_REQUIRED');
  if (entries === undefined) {
    if (!Array.isArray(existingOperations)) throw new Error('FINANCE_ENTRIES_OR_OPERATIONS_ARRAY_REQUIRED');
    if (existingOperations.length > 1000) throw new Error('BATCH_LIMIT_EXCEEDED');
    return payload;
  }
  if (entries.length > 1000) throw new Error('BATCH_LIMIT_EXCEEDED');

  const operations = entries.map((value, index) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new Error('INVALID_FINANCE_ENTRY');
    }
    const entry = value as Record<string, unknown>;
    const operation = String(entry.operation || '');
    if (!['create', 'update', 'delete'].includes(operation)) throw new Error('INVALID_FINANCE_OPERATION');
    const existingEntryKey = typeof entry.entry_key === 'string' ? entry.entry_key.trim() : '';
    if (operation !== 'create' && !existingEntryKey) throw new Error('FINANCE_ENTRY_KEY_REQUIRED');
    const entryKey = operation === 'create'
      ? `manual:${clientRequestId}:${index}`
      : existingEntryKey;
    const {
      operation: _operation,
      entry_key: _entryKey,
      reason,
      ...record
    } = entry;
    void _operation;
    void _entryKey;
    return {
      operation,
      entry_key: entryKey,
      reason,
      record,
    };
  });
  const { entries: _entries, ...rest } = payload;
  void _entries;
  return { ...rest, operations };
}

export function buildRpcArguments(
  action: string,
  request: V2ActionRequest = {},
): Record<string, unknown> {
  if (!isV2PublicAction(action)) throw new Error('UNSUPPORTED_ACTION');
  if (WRITE_ACTIONS.has(action)) {
    if (!request.client_request_id || !UUID_PATTERN.test(request.client_request_id)) {
      throw new Error('CLIENT_REQUEST_ID_REQUIRED');
    }
  }
  if (action === 'v2/rent-roll/batch-save') {
    const rows = request.payload?.rows;
    const operations = request.payload?.operations;
    if (!Array.isArray(rows) && !Array.isArray(operations)) {
      throw new Error('ROWS_OR_OPERATIONS_ARRAY_REQUIRED');
    }
    if ((Array.isArray(rows) && rows.length > 500) || (Array.isArray(operations) && operations.length > 500)) {
      throw new Error('BATCH_LIMIT_EXCEEDED');
    }
  }
  if (action === 'v2/home/batch-save') {
    const operations = request.payload?.operations;
    if (!Array.isArray(operations)) throw new Error('HOME_OPERATIONS_ARRAY_REQUIRED');
    if (operations.length > 200) throw new Error('BATCH_LIMIT_EXCEEDED');
  }
  const rpcPayload = action === 'v2/finance/batch-save'
    ? normalizeFinancePayload(request.payload ?? {}, request.client_request_id as string)
    : request.payload ?? {};
  return {
    p_request_id: request.client_request_id ?? crypto.randomUUID(),
    p_asset_key: request.asset_key ?? null,
    p_payload: rpcPayload,
    p_expected_revisions: request.expected_revisions ?? {},
  };
}

export function mapV2RpcError(error: { code?: string; message?: string } | null): V2RpcError {
  const code = String(error?.code || '');
  const message = String(error?.message || '');
  if (code === 'PT401') return { httpStatus: 401, code: 'AUTH_REQUIRED', retryable: false };
  if (code === 'PT403') return { httpStatus: 403, code: 'PERMISSION_DENIED', retryable: false };
  if (code === 'PT404') return { httpStatus: 404, code: 'NOT_FOUND', retryable: false };
  if (code === 'PT503' && message.includes('MAINTENANCE_MODE')) {
    return { httpStatus: 503, code: 'MAINTENANCE_MODE', retryable: false };
  }
  if (code === 'PT409' && message.includes('REVISION_CONFLICT')) {
    return { httpStatus: 409, code: 'REVISION_CONFLICT', retryable: false };
  }
  if ((code === 'PT409' || code === '23505') && message.includes('IDEMPOTENCY_CONFLICT')) {
    return { httpStatus: 409, code: 'IDEMPOTENCY_CONFLICT', retryable: false };
  }
  if (code === 'PT422' || code === '23514' || code === '23P01') {
    return { httpStatus: 422, code: 'BUSINESS_RULE_VIOLATION', retryable: false };
  }
  if (message.includes('READBACK_MISMATCH')) {
    return { httpStatus: 500, code: 'READBACK_MISMATCH', retryable: false };
  }
  if (/timeout|connection|unavailable/iu.test(message)) {
    return { httpStatus: 503, code: 'PRIMARY_UNAVAILABLE', retryable: true };
  }
  return { httpStatus: 500, code: 'INTERNAL_ERROR', retryable: false };
}

export function normalizeV2RpcResult<T>(value: unknown): PrimaryResponse<T> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('READBACK_MISMATCH');
  }
  const row = value as Record<string, unknown>;
  const normalized = primaryResponse({
    requestId: String(row.request_id || ''),
    revision: row.revision === null || row.revision === undefined ? null : Number(row.revision),
    data: row.data as T,
  });
  if (!isPrimaryResponse(normalized) || row.ok !== true || row.status !== 'primary') {
    throw new Error('READBACK_MISMATCH');
  }
  return normalized;
}

export async function dispatchV2Action<T>(
  context: V2UserRpcContext,
  action: string,
  request: V2ActionRequest = {},
): Promise<PrimaryResponse<T>> {
  if (context?.authMode !== 'anon-key-user-jwt' || !context.accessToken) {
    throw new Error('USER_JWT_RPC_CONTEXT_REQUIRED');
  }
  const rpcName = rpcNameForAction(action);
  const args = buildRpcArguments(action, request);
  const { data, error } = await context.client.schema('logistics_api').rpc(rpcName, args);
  if (error) {
    const mapped = mapV2RpcError(error);
    const failure = new Error(mapped.code) as Error & { httpStatus?: number; retryable?: boolean };
    failure.httpStatus = mapped.httpStatus;
    failure.retryable = mapped.retryable;
    throw failure;
  }
  return normalizeV2RpcResult<T>(data);
}
