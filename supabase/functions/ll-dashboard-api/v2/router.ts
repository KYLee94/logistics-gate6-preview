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
const RENT_ROLL_DOCUMENT_FIELDS = new Set([
  'occupancy_status',
  'tenant_name',
  'business_registration_number',
  'temperature_type',
  'goods_type',
  'floor_label',
  'zone_label',
  'subtenant_name',
  'free_area_type',
  'exclusive_area_sqm',
  'common_area_sqm',
  'leased_area_sqm',
  'signed_date',
  'commencement_date',
  'expiry_date',
  'operation_start_date',
  'deposit_total_krw',
  'security_type',
  'security_ratio',
  'monthly_rent_total_krw',
  'monthly_cam_total_krw',
  'pallet_rack_fee',
  'rent_free_periods',
  'fit_out_start_date',
  'fit_out_end_date',
  'fit_out_months',
  'fit_out_amount',
  'tenant_improvement_amount',
  'deposit_escalation_first_date',
  'deposit_escalation_interval_months',
  'deposit_escalation_rate',
  'rent_escalation_first_date',
  'rent_escalation_interval_months',
  'rent_escalation_rate',
  'cam_escalation_first_date',
  'cam_escalation_interval_months',
  'cam_escalation_rate',
  'tenant_cost_terms',
  'landlord_cost_terms',
  'renewal_terms',
  'termination_terms',
  'restoration_terms',
  'notes',
]);
const RENT_ROLL_NUMBER_FIELDS = Object.freeze([
  'exclusive_area_sqm', 'common_area_sqm', 'leased_area_sqm',
  'deposit_total_krw', 'monthly_rent_total_krw', 'monthly_cam_total_krw',
  'pallet_rack_fee', 'fit_out_months', 'fit_out_amount', 'tenant_improvement_amount',
  'deposit_escalation_interval_months', 'rent_escalation_interval_months',
  'cam_escalation_interval_months',
]);
const RENT_ROLL_DATE_FIELDS = Object.freeze([
  'signed_date', 'commencement_date', 'expiry_date', 'operation_start_date',
  'fit_out_start_date', 'fit_out_end_date', 'deposit_escalation_first_date',
  'rent_escalation_first_date', 'cam_escalation_first_date',
]);
const RENT_ROLL_RATE_FIELDS = Object.freeze([
  'security_ratio', 'deposit_escalation_rate', 'rent_escalation_rate', 'cam_escalation_rate',
]);

export type V2ActionRequest = {
  client_request_id?: string;
  asset_code?: string;
  asset_key?: string;
  payload?: Record<string, unknown>;
  expected_revisions?: Record<string, number | string>;
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

function normalizeRentRollNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value !== 'string' && typeof value !== 'number') {
    throw new Error('RENT_ROLL_NUMBER_INVALID');
  }
  const raw = String(value).trim().replaceAll(',', '');
  if (!UNSIGNED_DECIMAL_PATTERN.test(raw)) throw new Error('RENT_ROLL_NUMBER_INVALID');
  const numeric = Number(raw);
  if (!Number.isFinite(numeric) || numeric < 0) throw new Error('RENT_ROLL_NUMBER_INVALID');
  return numeric;
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
    if (Boolean(startDate) !== Boolean(endDate)) throw new Error('INVALID_RENT_FREE_PERIOD');
    if (startDate && endDate && endDate < startDate) throw new Error('INVALID_RENT_FREE_PERIOD');

    let months: number | null = null;
    if (source.months !== null && source.months !== undefined && source.months !== '') {
      months = Number(source.months);
      if (!Number.isFinite(months) || months <= 0) throw new Error('INVALID_RENT_FREE_PERIOD');
    }
    const reason = typeof source.reason === 'string' ? source.reason.trim() : source.reason;
    const notes = typeof source.notes === 'string' ? source.notes.trim() : source.notes;
    if (!startDate && !endDate && months === null && !reason && !notes) {
      throw new Error('INVALID_RENT_FREE_PERIOD');
    }
    return {
      ...(startDate && endDate ? { start_date: startDate, end_date: endDate } : {}),
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
    const source = value as Record<string, unknown>;
    const row = Object.fromEntries(
      Object.entries(source).filter(([field]) => RENT_ROLL_DOCUMENT_FIELDS.has(field)),
    );
    for (const field of RENT_ROLL_NUMBER_FIELDS) {
      if (Object.hasOwn(row, field)) row[field] = normalizeRentRollNumber(row[field]);
    }
    for (const field of RENT_ROLL_DATE_FIELDS) {
      if (Object.hasOwn(row, field)) row[field] = normalizeIsoDate(row[field], 'RENT_ROLL_DATE_INVALID');
    }
    for (const field of RENT_ROLL_RATE_FIELDS) {
      if (Object.hasOwn(row, field)) row[field] = normalizeEscalationRate(row[field]);
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
    if (Object.hasOwn(row, 'fit_out_months')) {
      if (row.fit_out_months === null || row.fit_out_months === '') {
        row.fit_out_months = null;
      } else {
        const fitOutMonths = Number(row.fit_out_months);
        if (!Number.isFinite(fitOutMonths) || fitOutMonths < 0) throw new Error('FIT_OUT_MONTHS_INVALID');
        row.fit_out_months = fitOutMonths;
      }
    }
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
    const rawExpectedXmin = request.payload?.expected_xmin;
    const expectedXmin = typeof rawExpectedXmin === 'string' && /^\d+$/u.test(rawExpectedXmin)
      ? rawExpectedXmin
      : typeof rawExpectedXmin === 'number'
        && Number.isSafeInteger(rawExpectedXmin)
        && rawExpectedXmin >= 0
        ? String(rawExpectedXmin)
        : null;
    const isDocument = Array.isArray(rows)
      && expectedXmin !== null
      && !Array.isArray(request.payload?.operations)
      && rows.every((row) => !(
        row
        && typeof row === 'object'
        && !Array.isArray(row)
        && Object.hasOwn(row, 'operation')
      ));
    if (!isDocument) throw new Error('RENT_ROLL_DOCUMENT_REQUIRED');
    if (rows.length > 2000) {
      throw new Error('BATCH_LIMIT_EXCEEDED');
    }
    request.payload = { ...request.payload, expected_xmin: expectedXmin };
  }
  if (action === 'v2/home/batch-save') {
    const asset = request.payload?.asset;
    const funds = request.payload?.funds;
    const isDocument = Boolean(asset && typeof asset === 'object' && !Array.isArray(asset) && Array.isArray(funds));
    if (!isDocument || Array.isArray(request.payload?.operations)) throw new Error('HOME_DOCUMENT_REQUIRED');
    if (Array.isArray(funds) && funds.length > 50) {
      throw new Error('BATCH_LIMIT_EXCEEDED');
    }
  }
  const financeStatement = request.payload?.statement;
  const isFinanceDocument = Boolean(
    financeStatement && typeof financeStatement === 'object' && !Array.isArray(financeStatement),
  );
  if (action === 'v2/finance/batch-save' && !isFinanceDocument) {
    throw new Error('FINANCE_DOCUMENT_REQUIRED');
  }
  const rpcPayload = action === 'v2/rent-roll/batch-save'
    ? normalizeRentRollPayload(request.payload ?? {})
    : request.payload ?? {};
  return {
    p_request_id: request.client_request_id ?? crypto.randomUUID(),
    p_asset_key: request.asset_code ?? request.asset_key ?? null,
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
