import { createClient } from 'npm:@supabase/supabase-js@2';

type LogisticsRole = 'Reader' | 'Editor' | 'Manager' | 'Admin' | 'System Admin';
type SupabaseClient = ReturnType<typeof createClient>;
type Context = {
  serviceClient: SupabaseClient;
  user: { id: string };
  permission: Record<string, unknown> | null;
  role: string;
  origin: string;
};
type RateBucket = { resetAt: number; count: number };

const DEFAULT_ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:4173',
  'http://127.0.0.1:4173',
  'http://localhost:8081',
  'http://127.0.0.1:8081',
  'https://this8369.github.io',
  'https://kylee94.github.io',
];

const WRITE_TABLE_ALLOWLIST = new Set([
  'public.ll_edit_requests',
  'public.ll_worklogs',
  'public.ll_api_audit_logs',
  'public.ll_data_change_audit_logs',
]);

const EDIT_TARGET_TABLE_ALLOWLIST = new Set([
  'public.ll_assets',
  'public.ll_companies',
  'public.ll_data_quality_findings',
  'public.ll_leases',
  'public.ll_leasing_contracts',
  'public.ll_rent_history',
  'public.ll_sheet_rows',
  'public.ll_source_cells',
  'public.ll_tenants',
  'public.ll_weekly_assets',
  'public.ll_weekly_projects',
  'public.ll_weekly_reports',
]);

const IMMUTABLE_FIELDS = new Set([
  'id',
  'created_at',
  'created_by',
  'updated_at',
  'updated_by',
  'approved_by',
  'requested_by',
  'service_role_key',
  'api_key',
  'secret',
]);

const PRIMARY_KEY_FIELDS = new Set([
  'id',
  'row_id',
  'source_row_id',
  'source_cell_id',
  'cell_id',
  'asset_id',
  'tenant_id',
  'lease_id',
]);

const rateBuckets = new Map<string, RateBucket>();

function allowedOrigins() {
  return (Deno.env.get('LL_ALLOWED_ORIGINS') || DEFAULT_ALLOWED_ORIGINS.join(','))
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function isAllowedOrigin(origin: string) {
  return !origin || allowedOrigins().includes(origin);
}

function jsonResponse(body: unknown, status = 200, origin = '') {
  const headers = new Headers({
    'content-type': 'application/json; charset=utf-8',
    'access-control-allow-methods': 'POST, OPTIONS',
    'access-control-allow-headers': 'authorization, content-type, x-client-info',
    vary: 'origin',
  });
  if (origin && isAllowedOrigin(origin)) headers.set('access-control-allow-origin', origin);
  return new Response(JSON.stringify(body), { status, headers });
}

function fail(status: number, message: string, origin: string, detail?: unknown) {
  return jsonResponse({ ok: false, message, detail }, status, origin);
}

function roleRank(role: string | undefined) {
  const order: LogisticsRole[] = ['Reader', 'Editor', 'Manager', 'Admin', 'System Admin'];
  const index = order.indexOf((role || 'Reader') as LogisticsRole);
  return index < 0 ? 0 : index;
}

function hasRole(role: string | undefined, minimum: LogisticsRole) {
  return roleRank(role) >= roleRank(minimum);
}

function assertLlAllowlist() {
  return [...WRITE_TABLE_ALLOWLIST, ...EDIT_TARGET_TABLE_ALLOWLIST].every((table) => table.startsWith('public.ll_'));
}

function safeAction(value: unknown) {
  return String(value || '').replace(/^\/+/u, '').trim();
}

function firstDefined(...values: unknown[]) {
  return values.find((value) => value !== undefined && value !== null && value !== '');
}

function normalizePublicLlTable(value: unknown) {
  const raw = String(value || '').trim();
  const table = raw.startsWith('public.') ? raw : `public.${raw}`;
  if (!/^public\.ll_[a-zA-Z0-9_]+$/u.test(table)) return '';
  return table;
}

function clientTableName(publicTable: string) {
  return publicTable.replace(/^public\./u, '');
}

function isSafeIdentifier(value: unknown) {
  return /^[a-zA-Z_][a-zA-Z0-9_]*$/u.test(String(value || ''));
}

function normalizeText(value: unknown) {
  if (value === undefined || value === null) return '';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function valuesEqual(a: unknown, b: unknown) {
  const left = normalizeText(a).trim();
  const right = normalizeText(b).trim();
  if (left === right) return true;
  const leftNumber = Number(left.replace(/,/gu, ''));
  const rightNumber = Number(right.replace(/,/gu, ''));
  return Number.isFinite(leftNumber) && Number.isFinite(rightNumber) && Math.abs(leftNumber - rightNumber) < 0.000001;
}

function coerceValue(nextValue: unknown, currentValue: unknown) {
  if (currentValue === null || currentValue === undefined) return nextValue;
  if (typeof currentValue === 'number') {
    const numeric = Number(String(nextValue).replace(/,/gu, ''));
    return Number.isFinite(numeric) ? numeric : nextValue;
  }
  if (typeof currentValue === 'boolean') {
    return ['true', '1', 'y', 'yes'].includes(String(nextValue).toLowerCase());
  }
  if (typeof currentValue === 'object') {
    try {
      return typeof nextValue === 'string' ? JSON.parse(nextValue) : nextValue;
    } catch {
      return nextValue;
    }
  }
  return nextValue;
}

function checkRateLimit(userId: string, action: string, limit = 30, windowMs = 60_000) {
  const key = `${userId}:${action}`;
  const now = Date.now();
  const bucket = rateBuckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    rateBuckets.set(key, { resetAt: now + windowMs, count: 1 });
    return true;
  }
  bucket.count += 1;
  return bucket.count <= limit;
}

async function getContext(request: Request, origin: string): Promise<Context> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !anonKey || !serviceRoleKey) throw new Response('Server is not configured', { status: 500 });

  const authHeader = request.headers.get('authorization') || '';
  const jwt = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!jwt) throw new Response('Missing Authorization token', { status: 401 });

  const authClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  });
  const { data: userData, error: userError } = await authClient.auth.getUser(jwt);
  if (userError || !userData.user) throw new Response('Invalid Authorization token', { status: 401 });

  const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: permission } = await serviceClient
    .from('ll_user_permissions')
    .select('*')
    .eq('user_id', userData.user.id)
    .maybeSingle();

  const role = permission?.logistics_role || 'Reader';
  return { serviceClient, user: { id: userData.user.id }, permission: permission || null, role, origin };
}

async function audit(serviceClient: SupabaseClient, userId: string, action: string, status: number, payload: unknown) {
  await serviceClient.from('ll_api_audit_logs').insert({
    action,
    status_code: status,
    requested_by: userId,
    request_payload: payload,
  });
}

function managedAssetCodes(permission: Record<string, unknown> | null) {
  return Array.isArray(permission?.managed_asset_codes) ? permission.managed_asset_codes.map((item) => String(item)) : [];
}

function canReadRelatedAsset(ctx: Context, relatedAssetId: unknown) {
  if (hasRole(ctx.role, 'Manager')) return true;
  const assetId = String(relatedAssetId || '').trim();
  if (!assetId) return true;
  const otherPermissions = ctx.permission?.other_asset_permissions as Record<string, unknown> | undefined;
  return managedAssetCodes(ctx.permission).includes(assetId) || otherPermissions?.read === true;
}

function filterWorklogRows(ctx: Context, rows: Record<string, unknown>[]) {
  const organization = String(ctx.permission?.organization || '');
  return rows.filter((row) => {
    const payload = (row.payload || {}) as Record<string, unknown>;
    const scope = String(row.scope || '').toLowerCase();
    if (scope === 'personal') return row.created_by === ctx.user.id;
    if (scope === 'team') {
      return row.created_by === ctx.user.id
        || String(payload.organization || payload.ownerOrganization || '') === organization;
    }
    return canReadRelatedAsset(ctx, row.related_asset_id || payload.assetId || payload.assetName);
  });
}

function normalizeEditCells(record: Record<string, unknown>) {
  const requestPayload = (record.request_payload || {}) as Record<string, unknown>;
  const rawCells = Array.isArray(requestPayload.cell_edits) && requestPayload.cell_edits.length
    ? requestPayload.cell_edits as Record<string, unknown>[]
    : [{
      target_table: record.source_table,
      target_row_id: record.target_row_id,
      target_cell_id: record.target_cell_id,
      field_name: record.field_name,
      before_value: record.before_value,
      after_value: record.requested_value,
    }];

  return rawCells.map((cell) => {
    const targetTable = normalizePublicLlTable(firstDefined(cell.target_table, cell.source_table, record.source_table));
    const primaryKeyField = String(firstDefined(cell.primary_key_field, cell.pk_field, 'id'));
    const targetRowId = String(firstDefined(cell.target_row_id, cell.row_id, record.target_row_id, cell.target_cell_id, record.target_cell_id, ''));
    const fieldName = String(firstDefined(cell.field_name, record.field_name, ''));
    return {
      targetTable,
      primaryKeyField,
      targetRowId,
      targetCellId: String(firstDefined(cell.target_cell_id, record.target_cell_id, '')),
      sourceRowId: String(firstDefined(cell.source_row_id, cell.target_row_id, record.target_row_id, '')),
      sourceCellId: String(firstDefined(cell.source_cell_id, cell.target_cell_id, record.target_cell_id, '')),
      fieldName,
      operation: String(firstDefined(cell.action, cell.operation, '수정')),
      beforeValue: firstDefined(cell.before_value, record.before_value),
      afterValue: firstDefined(cell.after_value, cell.requested_value, record.requested_value),
    };
  });
}

function validateEditCell(cell: ReturnType<typeof normalizeEditCells>[number]) {
  if (!['수정', 'update'].includes(cell.operation)) return 'Only cell update is enabled for automatic write; add/delete must be submitted as a separate schema-specific request';
  if (!EDIT_TARGET_TABLE_ALLOWLIST.has(cell.targetTable)) return 'Target table is not allowed';
  if (!cell.targetRowId) return 'target_row_id is required';
  if (!isSafeIdentifier(cell.primaryKeyField) || !PRIMARY_KEY_FIELDS.has(cell.primaryKeyField)) return 'Primary key field is not allowed';
  if (!isSafeIdentifier(cell.fieldName) || IMMUTABLE_FIELDS.has(cell.fieldName)) return 'Field is not editable';
  return '';
}

async function readTargetCell(client: SupabaseClient, cell: ReturnType<typeof normalizeEditCells>[number]) {
  const tableName = clientTableName(cell.targetTable);
  const selectList = `${cell.primaryKeyField},${cell.fieldName}`;
  const { data, error } = await client
    .from(tableName)
    .select(selectList)
    .eq(cell.primaryKeyField, cell.targetRowId)
    .maybeSingle();
  if (error) throw new Error(`Readback failed: ${error.message}`);
  if (!data) throw new Error('Target row was not found');
  return (data as Record<string, unknown>)[cell.fieldName];
}

async function writeTargetCell(client: SupabaseClient, cell: ReturnType<typeof normalizeEditCells>[number], nextValue: unknown) {
  const tableName = clientTableName(cell.targetTable);
  const { error } = await client
    .from(tableName)
    .update({
      [cell.fieldName]: nextValue,
    })
    .eq(cell.primaryKeyField, cell.targetRowId);
  if (error) throw new Error(`Write failed: ${error.message}`);
}

async function rollbackAppliedEdits(client: SupabaseClient, applied: Array<{ cell: ReturnType<typeof normalizeEditCells>[number]; previousValue: unknown }>) {
  for (const item of [...applied].reverse()) {
    await writeTargetCell(client, item.cell, item.previousValue);
  }
}

async function writeDataChangeAudit(ctx: Context, editRequestId: string, cell: ReturnType<typeof normalizeEditCells>[number], beforeValue: unknown, afterValue: unknown, readbackValue: unknown, status: string) {
  await ctx.serviceClient.from('ll_data_change_audit_logs').insert({
    edit_request_id: editRequestId,
    action: 'data_quality_write',
    target_table: cell.targetTable,
    target_row_id: cell.targetRowId,
    target_cell_id: cell.targetCellId || null,
    field_name: cell.fieldName,
    before_value: normalizeText(beforeValue),
    after_value: normalizeText(afterValue),
    readback_value: normalizeText(readbackValue),
    actor_id: ctx.user.id,
    approver_id: ctx.user.id,
    source_row_id: cell.sourceRowId || null,
    source_cell_id: cell.sourceCellId || null,
    approval_status: status,
    metadata: { primary_key_field: cell.primaryKeyField },
  });
}

async function submitEdit(ctx: Context, payload: Record<string, unknown>) {
  if (!hasRole(ctx.role, 'Editor')) return fail(403, 'Insufficient logistics permission', ctx.origin);
  if (!checkRateLimit(ctx.user.id, 'edits/submit', 60)) return fail(429, 'Rate limit exceeded', ctx.origin);
  const sourceTable = normalizePublicLlTable(payload.source_table || 'public.ll_data_quality_findings');
  if (!EDIT_TARGET_TABLE_ALLOWLIST.has(sourceTable)) return fail(403, 'Source table is not allowed', ctx.origin);

  const { data, error } = await ctx.serviceClient
    .from('ll_edit_requests')
    .insert({
      source_table: sourceTable,
      finding_id: payload.finding_id || null,
      target_type: payload.target_type || null,
      target_name: payload.target_name || null,
      target_row_id: payload.target_row_id || null,
      target_cell_id: payload.target_cell_id || null,
      field_name: payload.field_name || null,
      reason_code: payload.reason_code || null,
      before_value: payload.before_value || null,
      requested_value: payload.requested_value || null,
      request_payload: payload.request_payload || {},
      requested_by: ctx.user.id,
      status: 'submitted',
    })
    .select('id, status')
    .single();
  if (error) return fail(500, 'Failed to submit edit request', ctx.origin);
  await audit(ctx.serviceClient, ctx.user.id, 'edits/submit', 200, { id: data.id });
  return jsonResponse({ ok: true, message: 'Edit request submitted', data }, 200, ctx.origin);
}

async function approveEdit(ctx: Context, payload: Record<string, unknown>) {
  if (!hasRole(ctx.role, 'Manager')) return fail(403, 'Insufficient logistics permission', ctx.origin);
  if (!checkRateLimit(ctx.user.id, 'edits/approve', 30)) return fail(429, 'Rate limit exceeded', ctx.origin);
  const id = String(payload.id || '');
  if (!id) return fail(400, 'id is required', ctx.origin);

  const { data, error } = await ctx.serviceClient
    .from('ll_edit_requests')
    .select('*')
    .eq('id', id)
    .single();
  if (error || !data) return fail(404, 'Edit request not found', ctx.origin);
  if (data.requested_by === ctx.user.id) return fail(403, 'Self approval is not allowed', ctx.origin);
  if (data.status !== 'submitted') return fail(409, 'Edit request is not in submitted status', ctx.origin);

  const cells = normalizeEditCells(data as Record<string, unknown>);
  const validationError = cells.map(validateEditCell).find(Boolean);
  if (validationError) return fail(400, validationError, ctx.origin);

  const startedAt = new Date().toISOString();
  await ctx.serviceClient
    .from('ll_edit_requests')
    .update({
      status: 'approved_write_running',
      approved_by: ctx.user.id,
      approved_at: startedAt,
      approval_note: payload.approval_note || null,
      write_started_at: startedAt,
      updated_at: startedAt,
    })
    .eq('id', id);

  const applied: Array<{ cell: ReturnType<typeof normalizeEditCells>[number]; previousValue: unknown }> = [];
  const readbacks: Record<string, unknown>[] = [];
  try {
    for (const cell of cells) {
      const beforeReadback = await readTargetCell(ctx.serviceClient, cell);
      if (!valuesEqual(beforeReadback, cell.beforeValue)) {
        await rollbackAppliedEdits(ctx.serviceClient, applied);
        await ctx.serviceClient.from('ll_edit_requests').update({
          status: 'stale_blocked',
          readback_value: normalizeText(beforeReadback),
          write_error: 'stale value',
          write_result: { stale_cell: cell, before_readback: beforeReadback },
          updated_at: new Date().toISOString(),
        }).eq('id', id);
        await writeDataChangeAudit(ctx, id, cell, beforeReadback, cell.afterValue, beforeReadback, 'stale_blocked');
        await audit(ctx.serviceClient, ctx.user.id, 'edits/approve/stale_blocked', 409, { id, cell });
        return fail(409, 'Stale value blocked before write', ctx.origin, { cell, readback: beforeReadback });
      }

      const coerced = coerceValue(cell.afterValue, beforeReadback);
      await writeTargetCell(ctx.serviceClient, cell, coerced);
      applied.push({ cell, previousValue: beforeReadback });
      const afterReadback = await readTargetCell(ctx.serviceClient, cell);
      if (!valuesEqual(afterReadback, cell.afterValue) && !valuesEqual(afterReadback, coerced)) {
        await rollbackAppliedEdits(ctx.serviceClient, applied);
        await ctx.serviceClient.from('ll_edit_requests').update({
          status: 'readback_failed',
          readback_value: normalizeText(afterReadback),
          write_error: 'readback mismatch after write',
          write_result: { failed_cell: cell, after_readback: afterReadback },
          updated_at: new Date().toISOString(),
        }).eq('id', id);
        await writeDataChangeAudit(ctx, id, cell, beforeReadback, cell.afterValue, afterReadback, 'readback_failed');
        return fail(500, 'Write readback failed and rollback was attempted', ctx.origin, { cell, readback: afterReadback });
      }
      await writeDataChangeAudit(ctx, id, cell, beforeReadback, cell.afterValue, afterReadback, 'written');
      readbacks.push({
        target_table: cell.targetTable,
        target_row_id: cell.targetRowId,
        field_name: cell.fieldName,
        readback_value: afterReadback,
      });
    }
  } catch (writeError) {
    await rollbackAppliedEdits(ctx.serviceClient, applied);
    await ctx.serviceClient.from('ll_edit_requests').update({
      status: 'write_failed_rolled_back',
      write_error: writeError instanceof Error ? writeError.message : 'unknown write error',
      write_result: { applied_count_before_rollback: applied.length },
      updated_at: new Date().toISOString(),
    }).eq('id', id);
    await audit(ctx.serviceClient, ctx.user.id, 'edits/approve/write_failed_rolled_back', 500, { id });
    return fail(500, 'Write failed and rollback was attempted', ctx.origin);
  }

  const writtenAt = new Date().toISOString();
  const { data: written, error: updateError } = await ctx.serviceClient
    .from('ll_edit_requests')
    .update({
      status: 'written',
      readback_value: JSON.stringify(readbacks),
      write_status: 'readback_confirmed',
      write_result: { readbacks },
      written_at: writtenAt,
      updated_at: writtenAt,
    })
    .eq('id', id)
    .select('id, status, readback_value, write_result')
    .single();
  if (updateError) return fail(500, 'Failed to finalize edit request', ctx.origin);
  await audit(ctx.serviceClient, ctx.user.id, 'edits/approve/write', 200, { id, readbacks });
  return jsonResponse({ ok: true, message: 'Edit request approved, written, read back, and audited', data: written }, 200, ctx.origin);
}

async function rejectEdit(ctx: Context, payload: Record<string, unknown>) {
  if (!hasRole(ctx.role, 'Manager')) return fail(403, 'Insufficient logistics permission', ctx.origin);
  const id = String(payload.id || '');
  if (!id) return fail(400, 'id is required', ctx.origin);
  const { data, error } = await ctx.serviceClient
    .from('ll_edit_requests')
    .update({
      status: 'rejected',
      rejected_by: ctx.user.id,
      rejected_at: new Date().toISOString(),
      rejection_note: payload.rejection_note || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select('id, status')
    .single();
  if (error) return fail(500, 'Failed to reject edit request', ctx.origin);
  await audit(ctx.serviceClient, ctx.user.id, 'edits/reject', 200, { id });
  return jsonResponse({ ok: true, message: 'Edit request rejected', data }, 200, ctx.origin);
}

async function saveWorklog(ctx: Context, payload: Record<string, unknown>) {
  if (!hasRole(ctx.role, 'Reader')) return fail(403, 'Insufficient logistics permission', ctx.origin);
  const { data, error } = await ctx.serviceClient
    .from('ll_worklogs')
    .insert({
      scope: payload.scope || 'personal',
      title: payload.title || '',
      body: payload.body || '',
      related_asset_id: payload.related_asset_id || null,
      related_tenant_id: payload.related_tenant_id || null,
      priority: payload.priority || null,
      status: payload.status || 'new',
      created_by: ctx.user.id,
      payload: { ...(payload.payload as Record<string, unknown> || {}), organization: ctx.permission?.organization || null },
    })
    .select('id, status')
    .single();
  if (error) return fail(500, 'Failed to save worklog', ctx.origin);
  await audit(ctx.serviceClient, ctx.user.id, 'worklogs/create', 200, { id: data.id });
  return jsonResponse({ ok: true, message: 'Worklog saved', data }, 200, ctx.origin);
}

async function listWorklogs(ctx: Context, payload: Record<string, unknown>) {
  if (!hasRole(ctx.role, 'Reader')) return fail(403, 'Insufficient logistics permission', ctx.origin);
  const limit = Math.min(Number(payload.limit || 120), 300);
  const { data, error } = await ctx.serviceClient
    .from('ll_worklogs')
    .select('id, scope, title, body, related_asset_id, related_tenant_id, priority, status, created_by, created_at, updated_at, payload')
    .neq('status', 'deleted')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) return fail(500, 'Failed to list worklogs', ctx.origin);
  return jsonResponse({ ok: true, data: filterWorklogRows(ctx, data || []) }, 200, ctx.origin);
}

async function readWorklogForWrite(ctx: Context, id: string) {
  const { data, error } = await ctx.serviceClient
    .from('ll_worklogs')
    .select('id, created_by, status')
    .eq('id', id)
    .single();
  if (error || !data) return { data: null, response: fail(404, 'Worklog not found', ctx.origin) };
  if (data.created_by !== ctx.user.id && !hasRole(ctx.role, 'Manager')) {
    return { data: null, response: fail(403, 'Only author or manager can modify this task', ctx.origin) };
  }
  return { data, response: null };
}

async function updateWorklog(ctx: Context, payload: Record<string, unknown>) {
  if (!hasRole(ctx.role, 'Reader')) return fail(403, 'Insufficient logistics permission', ctx.origin);
  const id = String(payload.id || '');
  if (!id) return fail(400, 'id is required', ctx.origin);
  const current = await readWorklogForWrite(ctx, id);
  if (current.response) return current.response;
  const { data, error } = await ctx.serviceClient
    .from('ll_worklogs')
    .update({
      scope: payload.scope || undefined,
      title: payload.title || undefined,
      body: payload.body || undefined,
      priority: payload.priority || undefined,
      status: payload.status || undefined,
      related_asset_id: payload.related_asset_id || undefined,
      related_tenant_id: payload.related_tenant_id || undefined,
      payload: payload.payload || {},
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select('id, status')
    .single();
  if (error) return fail(500, 'Failed to update worklog', ctx.origin);
  await audit(ctx.serviceClient, ctx.user.id, 'worklogs/update', 200, { id });
  return jsonResponse({ ok: true, message: 'Worklog updated', data }, 200, ctx.origin);
}

async function completeWorklog(ctx: Context, payload: Record<string, unknown>) {
  return updateWorklog(ctx, { ...payload, status: 'completed', payload: { ...(payload.payload as Record<string, unknown> || {}), completed_at: new Date().toISOString() } });
}

async function deleteWorklog(ctx: Context, payload: Record<string, unknown>) {
  if (!hasRole(ctx.role, 'Reader')) return fail(403, 'Insufficient logistics permission', ctx.origin);
  const id = String(payload.id || '');
  if (!id) return fail(400, 'id is required', ctx.origin);
  const current = await readWorklogForWrite(ctx, id);
  if (current.response) return current.response;
  const { data, error } = await ctx.serviceClient
    .from('ll_worklogs')
    .update({
      status: 'deleted',
      payload: { ...(payload.payload as Record<string, unknown> || {}), deleted_at: new Date().toISOString() },
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select('id, status')
    .single();
  if (error) return fail(500, 'Failed to delete worklog', ctx.origin);
  await audit(ctx.serviceClient, ctx.user.id, 'worklogs/delete', 200, { id });
  return jsonResponse({ ok: true, message: 'Worklog deleted', data }, 200, ctx.origin);
}

async function fetchJsonWithTimeout(url: string, init: RequestInit = {}, timeoutMs = 10_000, retries = 1) {
  let lastError: unknown = null;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort('timeout'), timeoutMs);
    try {
      const response = await fetch(url, { ...init, signal: controller.signal });
      clearTimeout(timeout);
      const body = await response.json().catch(() => ({}));
      return { response, body };
    } catch (error) {
      clearTimeout(timeout);
      lastError = error;
      if (attempt >= retries) break;
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Provider request failed');
}

async function callOpenDart(ctx: Context, payload: Record<string, unknown>) {
  if (!hasRole(ctx.role, 'Admin')) return fail(403, 'Insufficient logistics permission', ctx.origin);
  if (!checkRateLimit(ctx.user.id, 'opendart/company', 20)) return fail(429, 'Rate limit exceeded', ctx.origin);
  const apiKey = Deno.env.get('OPENDART_API_KEY');
  if (!apiKey) return fail(503, 'OpenDART API key is not configured', ctx.origin);
  const corpCode = String(payload.corp_code || '').trim();
  if (!corpCode) return fail(400, 'corp_code is required', ctx.origin);
  const query = new URLSearchParams({ crtfc_key: apiKey, corp_code: corpCode });
  const { response, body } = await fetchJsonWithTimeout(`https://opendart.fss.or.kr/api/company.json?${query.toString()}`, {}, 10_000, 1);
  const company = {
    status: body.status,
    message: body.message,
    corp_code: body.corp_code,
    corp_name: body.corp_name,
    corp_name_eng: body.corp_name_eng,
    stock_name: body.stock_name,
    stock_code: body.stock_code,
    ceo_nm: body.ceo_nm,
    corp_cls: body.corp_cls,
    jurir_no: body.jurir_no,
    bizr_no: body.bizr_no,
    adres: body.adres,
    hm_url: body.hm_url,
    ir_url: body.ir_url,
    phn_no: body.phn_no,
    est_dt: body.est_dt,
    acc_mt: body.acc_mt,
  };
  await audit(ctx.serviceClient, ctx.user.id, 'opendart/company', response.status, { corp_code: corpCode });
  return jsonResponse({ ok: response.ok, provider_status: response.status, data: company }, response.ok ? 200 : 502, ctx.origin);
}

async function callBuildingRegister(ctx: Context, payload: Record<string, unknown>) {
  if (!hasRole(ctx.role, 'Admin')) return fail(403, 'Insufficient logistics permission', ctx.origin);
  if (!checkRateLimit(ctx.user.id, 'building-register/summary', 20)) return fail(429, 'Rate limit exceeded', ctx.origin);
  const apiKey = Deno.env.get('BUILDING_REGISTER_API_KEY');
  if (!apiKey) return fail(503, 'Building-register API key is not configured', ctx.origin);
  const query = new URLSearchParams({
    serviceKey: apiKey,
    sigunguCd: String(payload.sigungu_cd || ''),
    bjdongCd: String(payload.bjdong_cd || ''),
    platGbCd: String(payload.plat_gb_cd || '0'),
    bun: String(payload.bun || ''),
    ji: String(payload.ji || ''),
    _type: 'json',
  });
  const { response, body } = await fetchJsonWithTimeout(`https://apis.data.go.kr/1613000/BldRgstService_v2/getBrTitleInfo?${query.toString()}`, {}, 12_000, 1);
  const item = body?.response?.body?.items?.item;
  const first = Array.isArray(item) ? item[0] : item;
  const summary = first ? {
    plat_plc: first.platPlc,
    new_plat_plc: first.newPlatPlc,
    bld_nm: first.bldNm,
    main_purps_cd_nm: first.mainPurpsCdNm,
    grnd_flr_cnt: first.grndFlrCnt,
    ugrnd_flr_cnt: first.ugrndFlrCnt,
    arch_area: first.archArea,
    tot_area: first.totArea,
    use_apr_day: first.useAprDay,
  } : null;
  await audit(ctx.serviceClient, ctx.user.id, 'building-register/summary', response.status, { sigungu_cd: payload.sigungu_cd, bjdong_cd: payload.bjdong_cd });
  return jsonResponse({ ok: response.ok, provider_status: response.status, data: summary }, response.ok ? 200 : 502, ctx.origin);
}

async function callNaverGeocode(ctx: Context, payload: Record<string, unknown>) {
  if (!hasRole(ctx.role, 'Admin')) return fail(403, 'Insufficient logistics permission', ctx.origin);
  if (!checkRateLimit(ctx.user.id, 'naver/geocode', 30)) return fail(429, 'Rate limit exceeded', ctx.origin);
  const clientId = Deno.env.get('NAVER_CLOUD_CLIENT_ID') || Deno.env.get('NAVER_MAPS_CLIENT_ID');
  const clientSecret = Deno.env.get('NAVER_CLOUD_CLIENT_SECRET') || Deno.env.get('NAVER_MAPS_CLIENT_SECRET');
  if (!clientId || !clientSecret) return fail(503, 'Naver geocoding key is not configured', ctx.origin);
  const queryText = String(payload.query || payload.address || '').trim();
  if (!queryText) return fail(400, 'query is required', ctx.origin);
  const query = new URLSearchParams({ query: queryText });
  const { response, body } = await fetchJsonWithTimeout(`https://maps.apigw.ntruss.com/map-geocode/v2/geocode?${query.toString()}`, {
    headers: {
      'x-ncp-apigw-api-key-id': clientId,
      'x-ncp-apigw-api-key': clientSecret,
    },
  }, 10_000, 1);
  const addresses = Array.isArray(body.addresses) ? body.addresses.slice(0, 5).map((item: Record<string, unknown>) => ({
    road_address: item.roadAddress,
    jibun_address: item.jibunAddress,
    x: item.x,
    y: item.y,
    distance: item.distance,
  })) : [];
  await audit(ctx.serviceClient, ctx.user.id, 'naver/geocode', response.status, { query: queryText });
  return jsonResponse({ ok: response.ok, provider_status: response.status, data: addresses }, response.ok ? 200 : 502, ctx.origin);
}

Deno.serve(async (request) => {
  const origin = request.headers.get('origin') || '';
  if (!isAllowedOrigin(origin)) return fail(403, 'Origin not allowed', origin);
  if (request.method === 'OPTIONS') return jsonResponse({ ok: true }, 200, origin);
  if (request.method !== 'POST') return fail(405, 'Method not allowed', origin);
  if (!assertLlAllowlist()) return fail(500, 'Write allowlist is invalid', origin);

  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    return fail(400, 'JSON body is required', origin);
  }
  const action = safeAction(body.action);
  const payload = (body.payload || {}) as Record<string, unknown>;

  let ctx: Context;
  try {
    ctx = await getContext(request, origin);
  } catch (error) {
    if (error instanceof Response) return fail(error.status, await error.text(), origin);
    return fail(500, 'Authorization failed closed', origin);
  }

  if (action === 'health') return jsonResponse({ ok: true, role: ctx.role }, 200, origin);
  if (action === 'edits/submit') return submitEdit(ctx, payload);
  if (action === 'edits/approve') return approveEdit(ctx, payload);
  if (action === 'edits/reject') return rejectEdit(ctx, payload);
  if (action === 'worklogs/list') return listWorklogs(ctx, payload);
  if (action === 'worklogs') return saveWorklog(ctx, payload);
  if (action === 'worklogs/update') return updateWorklog(ctx, payload);
  if (action === 'worklogs/complete') return completeWorklog(ctx, payload);
  if (action === 'worklogs/delete') return deleteWorklog(ctx, payload);
  if (action === 'opendart/company') return callOpenDart(ctx, payload);
  if (action === 'building-register/summary') return callBuildingRegister(ctx, payload);
  if (action === 'naver/geocode') return callNaverGeocode(ctx, payload);
  if (action === 'snapshot-refresh' || action === 'cache-clear') {
    if (!hasRole(ctx.role, 'Admin')) return fail(403, 'Insufficient logistics permission', origin);
    await audit(ctx.serviceClient, ctx.user.id, action, 202, payload);
    return jsonResponse({ ok: true, message: `${action} accepted for server-side worker` }, 202, origin);
  }
  return fail(404, 'Unknown action', origin);
});
