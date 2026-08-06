export const V2_PUBLIC_ACTIONS = Object.freeze([
  'v2/home/read',
  'v2/home/batch-save',
  'v2/rent-roll/read',
  'v2/rent-roll/batch-save',
  'v2/finance/read',
  'v2/finance/batch-save',
  'v2/maturities/read',
  'v2/calculations/explain',
] as const);

export type V2PublicAction = (typeof V2_PUBLIC_ACTIONS)[number];

export type PrimaryResponse<T> = {
  ok: true;
  status: 'primary';
  request_id: string;
  revision: number | null;
  data: T;
};

export type PrimaryResponseInput<T> = {
  requestId: string;
  revision: number | null;
  data: T;
};

export function primaryResponse<T>({
  requestId,
  revision,
  data,
}: PrimaryResponseInput<T>): PrimaryResponse<T> {
  if (!requestId || typeof requestId !== 'string') {
    throw new Error('REQUEST_ID_REQUIRED');
  }
  if (revision !== null && (!Number.isSafeInteger(revision) || revision < 0)) {
    throw new Error('INVALID_REVISION');
  }
  return {
    ok: true,
    status: 'primary',
    request_id: requestId,
    revision,
    data,
  };
}

export function isPrimaryResponse(value: unknown): value is PrimaryResponse<unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const row = value as Record<string, unknown>;
  return Object.keys(row).join('|') === 'ok|status|request_id|revision|data'
    && row.ok === true
    && row.status === 'primary'
    && typeof row.request_id === 'string'
    && (row.revision === null || (Number.isSafeInteger(row.revision) && Number(row.revision) >= 0));
}
