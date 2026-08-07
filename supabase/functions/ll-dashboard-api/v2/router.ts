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
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/u;
const UNSIGNED_DECIMAL_PATTERN = /^(?:\d+(?:\.\d*)?|\.\d+)$/u;
const CUSTOM_ACCOUNT_CODE_PATTERN = /^CUSTOM:[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const FINANCE_STATEMENT_SECTIONS = new Set([
  'potential_income',
  'income_loss',
  'operating_expense',
  'below_noi',
  'debt_service',
]);

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
  const accountOperations = payload.account_operations;
  const selectionOperations = payload.selection_operations;
  if (entries !== undefined && !Array.isArray(entries)) throw new Error('FINANCE_ENTRIES_ARRAY_REQUIRED');
  if (existingOperations !== undefined && !Array.isArray(existingOperations)) {
    throw new Error('FINANCE_OPERATIONS_ARRAY_REQUIRED');
  }
  if (accountOperations !== undefined && !Array.isArray(accountOperations)) {
    throw new Error('FINANCE_ACCOUNT_OPERATIONS_ARRAY_REQUIRED');
  }
  if (selectionOperations !== undefined && !Array.isArray(selectionOperations)) {
    throw new Error('FINANCE_SELECTION_OPERATIONS_ARRAY_REQUIRED');
  }
  if (
    entries === undefined
    && existingOperations === undefined
    && accountOperations === undefined
    && selectionOperations === undefined
  ) throw new Error('FINANCE_MUTATION_ARRAY_REQUIRED');

  const totalOperationCount = (Array.isArray(entries) ? entries.length : 0)
    + (Array.isArray(existingOperations) ? existingOperations.length : 0)
    + (Array.isArray(accountOperations) ? accountOperations.length : 0)
    + (Array.isArray(selectionOperations) ? selectionOperations.length : 0);
  if (totalOperationCount > 1000) throw new Error('BATCH_LIMIT_EXCEEDED');

  const operations = entries === undefined
    ? [...(Array.isArray(existingOperations) ? existingOperations : [])]
    : entries.map((value, index) => {
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

  const normalizedAccountOperations = (Array.isArray(accountOperations) ? accountOperations : [])
    .map((value) => {
      if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new Error('INVALID_FINANCE_ACCOUNT_OPERATION');
      }
      const operation = { ...(value as Record<string, unknown>) };
      const operationName = String(operation.operation || '');
      if (!['create', 'update', 'delete', 'restore'].includes(operationName)) {
        throw new Error('INVALID_FINANCE_ACCOUNT_OPERATION');
      }
      const clientAccountKey = typeof operation.client_account_key === 'string'
        ? operation.client_account_key.trim()
        : '';
      if (clientAccountKey && !UUID_PATTERN.test(clientAccountKey)) {
        throw new Error('FINANCE_CLIENT_ACCOUNT_KEY_INVALID');
      }
      const suppliedAccountCode = typeof operation.account_code === 'string'
        ? operation.account_code.trim()
        : '';
      const accountCode = suppliedAccountCode || (clientAccountKey ? `CUSTOM:${clientAccountKey}` : '');
      if (!accountCode || !CUSTOM_ACCOUNT_CODE_PATTERN.test(accountCode)) {
        throw new Error('FINANCE_CUSTOM_ACCOUNT_CODE_INVALID');
      }
      const sourceRecord = operation.record && typeof operation.record === 'object' && !Array.isArray(operation.record)
        ? operation.record as Record<string, unknown>
        : {};
      const record: Record<string, unknown> = {};
      if (operationName === 'create' || operationName === 'update') {
        const name = String(sourceRecord.name_ko ?? operation.name_ko ?? '').trim();
        if (!name || name.length > 60) throw new Error('FINANCE_ACCOUNT_NAME_INVALID');
        const section = String(sourceRecord.statement_section ?? operation.statement_section ?? '').trim();
        if (!FINANCE_STATEMENT_SECTIONS.has(section)) throw new Error('FINANCE_ACCOUNT_SECTION_INVALID');
        record.name_ko = name;
        record.statement_section = section;
        for (const key of ['parent_account_code', 'display_order', 'normal_sign']) {
          if (sourceRecord[key] !== undefined) record[key] = sourceRecord[key];
        }
      }
      return {
        operation: operationName,
        account_code: accountCode,
        client_account_key: clientAccountKey || accountCode.slice('CUSTOM:'.length),
        ...(operation.expected_revision === undefined ? {} : { expected_revision: operation.expected_revision }),
        ...(operation.reason === undefined ? {} : { reason: operation.reason }),
        record,
      };
    });

  const normalizedSelectionOperations = (Array.isArray(selectionOperations) ? selectionOperations : [])
    .map((value) => {
      if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new Error('INVALID_FINANCE_SELECTION_OPERATION');
      }
      const operation = { ...(value as Record<string, unknown>) };
      if (operation.operation !== 'upsert') throw new Error('INVALID_FINANCE_SELECTION_OPERATION');
      const clientAccountKey = typeof operation.client_account_key === 'string'
        ? operation.client_account_key.trim()
        : '';
      if (clientAccountKey && !UUID_PATTERN.test(clientAccountKey)) {
        throw new Error('FINANCE_CLIENT_ACCOUNT_KEY_INVALID');
      }
      const accountCode = String(operation.account_code || (clientAccountKey ? `CUSTOM:${clientAccountKey}` : '')).trim();
      if (!accountCode) throw new Error('FINANCE_SELECTION_ACCOUNT_REQUIRED');
      if (accountCode.startsWith('CUSTOM:') && !CUSTOM_ACCOUNT_CODE_PATTERN.test(accountCode)) {
        throw new Error('FINANCE_CUSTOM_ACCOUNT_CODE_INVALID');
      }
      if (typeof operation.selected !== 'boolean') throw new Error('FINANCE_SELECTION_BOOLEAN_REQUIRED');
      return {
        operation: 'upsert',
        account_code: accountCode,
        client_account_key: clientAccountKey || (accountCode.startsWith('CUSTOM:')
          ? accountCode.slice('CUSTOM:'.length)
          : ''),
        selected: operation.selected,
        ...(operation.expected_revision === undefined ? {} : { expected_revision: operation.expected_revision }),
        ...(operation.reason === undefined ? {} : { reason: operation.reason }),
      };
    });

  const { entries: _entries, operations: _existingOperations, ...rest } = payload;
  void _entries;
  void _existingOperations;
  return {
    ...rest,
    operations,
    account_operations: normalizedAccountOperations,
    selection_operations: normalizedSelectionOperations,
  };
}

function normalizeIsoDate(value: unknown, errorCode: string): string | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value !== 'string') throw new Error(errorCode);
  const normalized = value.trim();
  if (!ISO_DATE_PATTERN.test(normalized)) throw new Error(errorCode);
  const [year, month, day] = normalized.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (
    parsed.getUTCFullYear() !== year
    || parsed.getUTCMonth() + 1 !== month
    || parsed.getUTCDate() !== day
  ) {
    throw new Error(errorCode);
  }
  return normalized;
}

function canonicalPercent(value: number): string {
  const rounded = Number(value.toPrecision(12));
  return `${rounded}%`;
}

function normalizeEscalationRate(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value !== 'string' && typeof value !== 'number') {
    throw new Error('INVALID_ESCALATION_RATE');
  }
  const raw = String(value).trim();
  if (!raw) return null;
  const hasPercent = raw.endsWith('%');
  const numericText = hasPercent ? raw.slice(0, -1).trim() : raw;
  if (!UNSIGNED_DECIMAL_PATTERN.test(numericText)) throw new Error('INVALID_ESCALATION_RATE');
  let numeric = Number(numericText);
  if (!Number.isFinite(numeric) || numeric < 0) throw new Error('INVALID_ESCALATION_RATE');
  if (!hasPercent && numeric > 0 && numeric < 1) numeric *= 100;
  if (numeric > 100) throw new Error('INVALID_ESCALATION_RATE');
  return canonicalPercent(numeric);
}

function normalizeOptionTerm(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  const normalized = value.trim();
  if (!normalized) return null;
  const compact = normalized.replace(/\s+/gu, '').toLowerCase();
  if (
    ['n', 'no', '없음', '중도해지불가', '기타(없음)', '기타(n)', '기타(no)'].includes(compact)
  ) return '없음';
  if (['y', 'yes', '있음'].includes(compact)) return '있음';
  return normalized;
}

function normalizeRentFreePeriods(value: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(value)) throw new Error('RENT_FREE_PERIODS_ARRAY_REQUIRED');
  if (value.length > 120) throw new Error('RENT_FREE_PERIOD_LIMIT_EXCEEDED');
  return value.map((period) => {
    if (!period || typeof period !== 'object' || Array.isArray(period)) {
      throw new Error('INVALID_RENT_FREE_PERIOD');
    }
    const source = period as Record<string, unknown>;
    const startDate = normalizeIsoDate(source.start_date, 'INVALID_RENT_FREE_PERIOD');
    const endDate = normalizeIsoDate(source.end_date, 'INVALID_RENT_FREE_PERIOD');
    if (startDate && endDate && endDate < startDate) throw new Error('INVALID_RENT_FREE_PERIOD');

    let months: number | null = null;
    if (source.months !== null && source.months !== undefined && source.months !== '') {
      months = Number(source.months);
      if (!Number.isFinite(months) || months < 0) throw new Error('INVALID_RENT_FREE_PERIOD');
    }
    const reason = typeof source.reason === 'string' ? source.reason.trim() : source.reason;
    const notes = typeof source.notes === 'string' ? source.notes.trim() : source.notes;
    if (!startDate && !endDate && months === null && !reason && !notes) {
      throw new Error('INVALID_RENT_FREE_PERIOD');
    }
    return {
      ...source,
      start_date: startDate,
      end_date: endDate,
      months,
      reason: reason || null,
      notes: notes || null,
    };
  });
}

function normalizeRentRollPayload(payload: Record<string, unknown>): Record<string, unknown> {
  if (!Array.isArray(payload.rows)) return payload;
  const rows = payload.rows.map((value) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new Error('INVALID_RENT_ROLL_ROW');
    }
    const row = { ...(value as Record<string, unknown>) };
    if (Object.hasOwn(row, 'deposit_escalation_rate')) {
      row.deposit_escalation_rate = normalizeEscalationRate(row.deposit_escalation_rate);
    }
    if (Object.hasOwn(row, 'rent_escalation_rate')) {
      row.rent_escalation_rate = normalizeEscalationRate(row.rent_escalation_rate);
    }
    if (Object.hasOwn(row, 'cam_escalation_rate')) {
      row.cam_escalation_rate = normalizeEscalationRate(row.cam_escalation_rate);
    }
    if (Object.hasOwn(row, 'renewal_terms')) row.renewal_terms = normalizeOptionTerm(row.renewal_terms);
    if (Object.hasOwn(row, 'termination_terms')) row.termination_terms = normalizeOptionTerm(row.termination_terms);

    const fitOutStartDate = normalizeIsoDate(row.fit_out_start_date, 'FIT_OUT_DATE_INVALID');
    const fitOutEndDate = normalizeIsoDate(row.fit_out_end_date, 'FIT_OUT_DATE_INVALID');
    if (fitOutStartDate && fitOutEndDate && fitOutEndDate < fitOutStartDate) {
      throw new Error('FIT_OUT_DATE_RANGE_INVALID');
    }
    if (Object.hasOwn(row, 'fit_out_start_date')) row.fit_out_start_date = fitOutStartDate;
    if (Object.hasOwn(row, 'fit_out_end_date')) row.fit_out_end_date = fitOutEndDate;
    if (Object.hasOwn(row, 'rent_free_periods')) {
      row.rent_free_periods = normalizeRentFreePeriods(row.rent_free_periods);
    }
    return row;
  });
  return { ...payload, rows };
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
    : action === 'v2/rent-roll/batch-save'
      ? normalizeRentRollPayload(request.payload ?? {})
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
  if (code === '23505') {
    return { httpStatus: 409, code: 'RESOURCE_CONFLICT', retryable: false };
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
