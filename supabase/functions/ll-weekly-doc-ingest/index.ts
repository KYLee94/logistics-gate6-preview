import { createClient } from 'npm:@supabase/supabase-js@2';
import mammoth from 'npm:mammoth@1.8.0';
import { Buffer } from 'node:buffer';

type SupabaseClient = ReturnType<typeof createClient<any>>;
type RateBucket = { resetAt: number; count: number };
type AssetWriteAction = 'create' | 'update';
type AssetScope = 'managed' | 'other';
type AssetResolution = {
  asset: Record<string, unknown> | null;
  status: 'matched' | 'unmatched' | 'ambiguous';
};

const WRITE_TABLE_ALLOWLIST = new Set([
  'public.ll_work_items',
]);

const MAX_WEEKLY_DOC_BYTES = 20 * 1024 * 1024;
const rateBuckets = new Map<string, RateBucket>();
const PERMISSION_PROFILE_FIELDS = 'email, account_status, can_ingest_weekly, organization, managed_asset_codes, managed_asset_permissions, other_asset_permissions';

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

function getAllowedOrigins() {
  return (Deno.env.get('LL_ALLOWED_ORIGINS') || DEFAULT_ALLOWED_ORIGINS.join(','))
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function isAllowedOrigin(origin: string) {
  return !origin || getAllowedOrigins().includes(origin);
}

function readEdgeSecret(name: string) {
  const direct = Deno.env.get(name);
  if (direct) return direct;
  if (name === 'SUPABASE_SERVICE_ROLE_KEY') {
    const serviceRoleFallback = Deno.env.get('LL_SERVICE_ROLE_KEY')
      || Deno.env.get('SERVICE_ROLE_KEY')
      || Deno.env.get('supabase_service_role_key');
    if (serviceRoleFallback) return serviceRoleFallback;
  }
  const secretKeys = Deno.env.get('SUPABASE_SECRET_KEYS');
  if (name === 'SUPABASE_SERVICE_ROLE_KEY' && secretKeys) {
    try {
      const parsed = JSON.parse(secretKeys) as Record<string, string>;
      const firstKey = Object.keys(parsed)[0];
      return parsed.default || parsed.service_role || (firstKey ? parsed[firstKey] : '');
    } catch {
      return '';
    }
  }
  const publishableKeys = Deno.env.get('SUPABASE_PUBLISHABLE_KEYS');
  if (name === 'SUPABASE_ANON_KEY' && publishableKeys) {
    try {
      const parsed = JSON.parse(publishableKeys) as Record<string, string>;
      const firstKey = Object.keys(parsed)[0];
      return parsed.default || parsed.anon || (firstKey ? parsed[firstKey] : '');
    } catch {
      return '';
    }
  }
  return '';
}

function jsonResponse(body: unknown, status = 200, origin = '') {
  const headers = new Headers({
    'content-type': 'application/json; charset=utf-8',
    'access-control-allow-methods': 'POST, OPTIONS',
    'access-control-allow-headers': 'authorization, content-type, x-client-info',
    vary: 'origin',
  });
  if (origin && isAllowedOrigin(origin)) {
    headers.set('access-control-allow-origin', origin);
  }
  return new Response(JSON.stringify(body), {
    status,
    headers,
  });
}

function fail(status: number, message: string, origin: string) {
  return jsonResponse({ ok: false, message }, status, origin);
}

async function sha256Hex(buffer: ArrayBuffer) {
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function safeText(value: FormDataEntryValue | null) {
  return String(value || '').trim();
}

function toIsoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function startOfMondayWeek(date: Date) {
  const next = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = next.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  next.setUTCDate(next.getUTCDate() + diff);
  return next;
}

function buildMonthlyWeekRanges(year: number, month: number) {
  const firstDay = new Date(Date.UTC(year, month - 1, 1));
  const ranges: Array<{ week: number; start: string; end: string; key: string; label: string }> = [];
  let start = startOfMondayWeek(firstDay);
  while (start <= new Date(Date.UTC(year, month, 6))) {
    const end = new Date(start);
    end.setUTCDate(start.getUTCDate() + 6);
    const ownershipDate = new Date(start);
    ownershipDate.setUTCDate(start.getUTCDate() + 3);
    if (ownershipDate.getUTCFullYear() === year && ownershipDate.getUTCMonth() === month - 1) {
      const week = ranges.length + 1;
      const startText = toIsoDate(start);
      const endText = toIsoDate(end);
      ranges.push({
        week,
        start: startText,
        end: endText,
        key: `${year}-${String(month).padStart(2, '0')}-w${week}`,
        label: `${startText} ~ ${endText}`,
      });
    }
    start = new Date(start);
    start.setUTCDate(start.getUTCDate() + 7);
  }
  return ranges;
}

function hasActiveWeeklyIngestPermission(permission: Record<string, unknown> | null): permission is Record<string, unknown> {
  if (!permission) return false;
  return String(permission.account_status || '').trim().toLowerCase() === 'active'
    && permission.can_ingest_weekly === true;
}

function normalizePermissionEmail(value: unknown) {
  return String(value || '').trim().toLowerCase();
}

function canonicalPermissionProfile(rows: Record<string, unknown>[]) {
  const profiles = rows.filter((row) => Boolean(normalizePermissionEmail(row.email)));
  if (profiles.length > 1) {
    return { permission: null, error: 'Multiple canonical permission profiles were found' };
  }
  return { permission: profiles[0] || null, error: '' };
}

async function findCanonicalPermission(
  serviceClient: SupabaseClient,
  userId: string,
) {
  const { data: userRows, error: userError } = await serviceClient
    .from('ll_user_permissions')
    .select(PERMISSION_PROFILE_FIELDS)
    .eq('user_id', userId)
    .not('email', 'is', null)
    .limit(3);
  if (userError) return { permission: null, error: 'Failed to read weekly ingest permission' };

  return canonicalPermissionProfile((userRows || []) as Record<string, unknown>[]);
}

function assetRefVariants(value: unknown) {
  const raw = String(value || '').trim();
  if (!raw) return [];
  const compact = raw.replace(/\s+/gu, '');
  const variants = new Set([raw, compact, raw.toLowerCase(), compact.toLowerCase(), raw.toUpperCase(), compact.toUpperCase()]);
  const assetIdMatch = compact.match(/^asset[_-](.+)$/iu);
  if (assetIdMatch?.[1]) variants.add(assetIdMatch[1].toUpperCase());
  if (/^[A-Z]{1,2}P?\d{5,}$/iu.test(compact) || /^[AS]\d{5,}$/iu.test(compact)) {
    variants.add(`asset_${compact.toLowerCase()}`);
  }
  return [...variants].filter(Boolean);
}

function permissionAllowsAssetAction(
  permission: Record<string, unknown>,
  permissionKey: 'managed_asset_permissions' | 'other_asset_permissions',
  action: AssetWriteAction,
) {
  const permissions = permission[permissionKey];
  return Boolean(permissions && typeof permissions === 'object' && !Array.isArray(permissions)
    && (permissions as Record<string, unknown>)[action] === true);
}

function assetScopeFor(permission: Record<string, unknown>, asset: Record<string, unknown>): AssetScope {
  const managedRefs = new Set(
    (Array.isArray(permission.managed_asset_codes) ? permission.managed_asset_codes : [])
      .flatMap(assetRefVariants),
  );
  const assetRefs = [asset.asset_id, asset.asset_code, asset.asset_name].flatMap(assetRefVariants);
  return assetRefs.some((reference) => managedRefs.has(reference)) ? 'managed' : 'other';
}

function canWriteAsset(
  permission: Record<string, unknown>,
  action: AssetWriteAction,
  asset: Record<string, unknown>,
) {
  const scope = assetScopeFor(permission, asset);
  return permissionAllowsAssetAction(
    permission,
    scope === 'managed' ? 'managed_asset_permissions' : 'other_asset_permissions',
    action,
  );
}

function checkRateLimit(userId: string, action: string, limit = 10, windowMs = 10 * 60 * 1000) {
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

function hasWordFileSignature(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer.slice(0, 8));
  const isDocxZip = bytes[0] === 0x50 && bytes[1] === 0x4b;
  const isLegacyDoc = bytes[0] === 0xd0 && bytes[1] === 0xcf && bytes[2] === 0x11 && bytes[3] === 0xe0;
  return isDocxZip || isLegacyDoc;
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<T>((_, reject) => {
    timeout = setTimeout(() => reject(new Error(message)), timeoutMs);
  });
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

function parseWeeklyText(text: string) {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  const rows = lines.map((line, index) => ({
    lineNumber: index + 1,
    text: line,
  }));
  const assetRows = rows
    .filter((row) => /물류|센터|자산|Lease|EOD|Refi|공실|만기|임대|관리|PFV|펀드/i.test(row.text))
    .slice(0, 80)
    .map((row) => ({
      asset_name: row.text.slice(0, 120),
      issue: row.text,
      plan: '',
      row_json: row,
    }));
  const projectRows = rows
    .filter((row) => /Task|Next|Action|작업|검토|일정|업무|미팅|계획|후속|F\/U/i.test(row.text))
    .slice(0, 80)
    .map((row) => ({
      project_type: 'weekly',
      project_name: row.text.slice(0, 120),
      issue: row.text,
      plan: '',
      row_json: row,
    }));
  return {
    lines,
    assetRows,
    projectRows,
    reportJson: {
      parser: 'mammoth_text_v1',
      lineCount: lines.length,
      previewLines: lines.slice(0, 30),
    },
  };
}

function normalizeKey(value: unknown) {
  return String(value || '').replace(/\s+/gu, '').toLowerCase();
}

function stripUndefined<T extends Record<string, unknown>>(value: T) {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined)) as T;
}

function shortActorName(email: string, fallback: string) {
  const localPart = String(email || '').split('@')[0];
  return localPart || fallback;
}

function logisticsWeekMeta(year: number, month: number, week: number, weekKey: string, weekRange: string) {
  return {
    workspace: 'logistics',
    weekKey,
    weekLabel: `${String(year).slice(2)}년 ${month}월 ${week}주차`,
    weekRange,
    groupLabel: `${year}년 ${month}월`,
    basisDate: weekKey.slice(0, 10),
  };
}

function resolveAssetsForLine(text: string, assets: Record<string, unknown>[]): AssetResolution {
  const normalized = normalizeKey(text);
  if (!normalized) return { asset: null, status: 'unmatched' };
  const matches = new Map<string, Record<string, unknown>>();
  for (const asset of assets) {
    const references = [asset.asset_id, asset.asset_code, asset.asset_name]
      .map(normalizeKey)
      .filter((value) => value.length > 1);
    if (references.some((reference) => normalized.includes(reference))) {
      const identity = String(asset.asset_id || asset.asset_code || asset.asset_name || '').trim();
      if (identity) matches.set(identity, asset);
    }
  }
  if (matches.size === 1) return { asset: [...matches.values()][0], status: 'matched' };
  return { asset: null, status: matches.size ? 'ambiguous' : 'unmatched' };
}

function buildSnapshotTask(
  row: Record<string, unknown>,
  sourceKind: 'weekly_asset' | 'weekly_project',
  actor: { email: string; name: string },
  matchedAsset: Record<string, unknown> | null,
  nowIso: string,
) {
  const rawText = String(row.issue || row.project_name || row.asset_name || '').trim();
  const rowJson = row.row_json && typeof row.row_json === 'object' && !Array.isArray(row.row_json)
    ? row.row_json as Record<string, unknown>
    : {};
  const relatedAssetId = String(matchedAsset?.asset_id || '').trim();
  const relatedAssetName = String(matchedAsset?.asset_name || row.asset_name || '').trim();
  const seedLabel = String(row.project_name || row.asset_name || rawText).trim().slice(0, 120) || 'Task';
  return stripUndefined({
    id: crypto.randomUUID(),
    seed_id: `${sourceKind}:${rowJson.lineNumber || '0'}:${seedLabel}`,
    source: 'weekly_report_seed',
    seed_source: sourceKind,
    related_asset: relatedAssetName || undefined,
    related_asset_id: relatedAssetId || undefined,
    task_name: seedLabel,
    company_name: '',
    status: 'new',
    due_date: '',
    priority: sourceKind === 'weekly_asset' ? '중간' : '낮음',
    next_action: sourceKind === 'weekly_project' ? rawText : '',
    issue: rawText,
    notes: '',
    created_by_name: actor.name,
    created_by_email: actor.email,
    created_by_display: `${actor.name}(${actor.email})`,
    created_at: nowIso,
    updated_at: nowIso,
    payload: {
      source: 'll-weekly-doc-ingest',
      source_kind: sourceKind,
      line_number: rowJson.lineNumber || null,
      line_text: rawText,
    },
  });
}

async function listRegisteredAssets(serviceClient: SupabaseClient) {
  const { data, error } = await serviceClient
    .from('ll_assets')
    .select('asset_id,asset_code,asset_name')
    .limit(1000);
  if (error) throw error;
  return (data || []) as Record<string, unknown>[];
}

Deno.serve(async (request) => {
  const origin = request.headers.get('origin') || '';
  if (!isAllowedOrigin(origin)) return fail(403, 'Origin not allowed', origin);
  if (request.method === 'OPTIONS') return jsonResponse({ ok: true }, 200, origin);
  if (request.method !== 'POST') return fail(405, 'Method not allowed', origin);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = readEdgeSecret('SUPABASE_ANON_KEY');
  const serviceRoleKey = readEdgeSecret('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !anonKey || !serviceRoleKey) return fail(500, 'Server is not configured', origin);

  const authHeader = request.headers.get('authorization') || '';
  const jwt = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!jwt) return fail(401, 'Missing Authorization token', origin);

  const authClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  });
  const { data: userData, error: userError } = await authClient.auth.getUser(jwt);
  if (userError || !userData.user) return fail(401, 'Invalid Authorization token', origin);

  const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const permissionLookup = await findCanonicalPermission(serviceClient, userData.user.id);
  if (permissionLookup.error) return fail(500, permissionLookup.error, origin);
  const permission = permissionLookup.permission;

  if (!hasActiveWeeklyIngestPermission(permission)) return fail(403, 'Active weekly ingest permission is required', origin);
  if (!checkRateLimit(userData.user.id, 'weekly/ingest', 8, 10 * 60 * 1000)) return fail(429, 'Rate limit exceeded', origin);

  if (![...WRITE_TABLE_ALLOWLIST].every((table) => table.startsWith('public.ll_'))) {
    return fail(500, 'Write allowlist is invalid', origin);
  }

  const formData = await request.formData();
  const file = formData.get('file');
  if (!(file instanceof File)) return fail(400, 'Word file is required', origin);
  const fileName = file.name || '';
  const lowerName = fileName.toLowerCase();
  if (!lowerName.endsWith('.docx') && !lowerName.endsWith('.doc')) return fail(400, 'Only Word .docx/.doc files are allowed', origin);
  if (file.type && !/word|msword|officedocument|octet-stream/i.test(file.type)) return fail(400, 'Word file MIME type is invalid', origin);
  if (file.size <= 0 || file.size > MAX_WEEKLY_DOC_BYTES) return fail(400, 'Word file size is invalid', origin);

  const year = Number(safeText(formData.get('year')));
  const month = Number(safeText(formData.get('month')));
  const week = Number(safeText(formData.get('week')));
  const range = buildMonthlyWeekRanges(year, month).find((item) => item.week === week);
  const weekKey = range?.key || '';
  const weekRange = range?.label || '';
  const organization = String(permission?.organization || '').trim();
  if (!organization) return fail(403, 'Weekly ingest requires server-side organization permission', origin);
  const clientWeekKey = safeText(formData.get('week_key'));
  const clientWeekRange = safeText(formData.get('week_range'));
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(week) || !range) {
    return fail(400, 'Valid year, month and Monday-Sunday week are required', origin);
  }
  if ((clientWeekKey && clientWeekKey !== weekKey) || (clientWeekRange && clientWeekRange !== weekRange)) {
    return fail(409, 'Client week selection does not match server Monday-Sunday week calculation', origin);
  }

  const buffer = await file.arrayBuffer();
  if (!hasWordFileSignature(buffer)) return fail(400, 'Word file signature is invalid', origin);
  const sourceSha = await sha256Hex(buffer);
  const weekMeta = logisticsWeekMeta(year, month, week, weekKey, weekRange);
  const { data: previousSnapshot, error: previousSnapshotError } = await serviceClient
    .from('ll_work_items')
    .select('id,payload')
    .eq('item_type', 'task_snapshot')
    .eq('workspace', weekMeta.workspace)
    .eq('week_key', weekMeta.weekKey)
    .eq('created_by', userData.user.id)
    .maybeSingle();
  if (previousSnapshotError) return fail(500, 'Failed to read previous weekly snapshot', origin);
  const previousPayload = previousSnapshot?.payload && typeof previousSnapshot.payload === 'object' && !Array.isArray(previousSnapshot.payload)
    ? previousSnapshot.payload as Record<string, unknown>
    : {};
  if (String(previousPayload.source_sha256 || '') === sourceSha) {
    return fail(409, 'Duplicate weekly document for this user and week', origin);
  }

  let parsed;
  try {
    parsed = await withTimeout(
      mammoth.extractRawText({ buffer: Buffer.from(buffer) }),
      15_000,
      'Word parsing timeout',
    );
  } catch {
    return fail(422, 'Word parsing failed before any write', origin);
  }

  const weekly = parseWeeklyText(parsed.value || '');
  if (!weekly.lines.length) return fail(422, 'Word parsing produced no readable text', origin);

  const assets = await listRegisteredAssets(serviceClient);
  const assetResolutions = weekly.assetRows.map((row) => resolveAssetsForLine(String(row.issue || row.asset_name || ''), assets));
  const projectResolutions = weekly.projectRows.map((row) => resolveAssetsForLine(String(row.issue || row.project_name || ''), assets));
  const allResolutions = [...assetResolutions, ...projectResolutions];
  if (allResolutions.some((resolution) => resolution.status !== 'matched')) {
    return fail(422, 'Every parsed row must identify exactly one registered asset before any write', origin);
  }

  const writeAction: AssetWriteAction = previousSnapshot ? 'update' : 'create';
  const relevantAssets = allResolutions.map((resolution) => resolution.asset as Record<string, unknown>);
  if (relevantAssets.some((asset) => !canWriteAsset(permission, writeAction, asset))) {
    return fail(403, 'Create or update permission is required for every parsed asset', origin);
  }

  const actorEmail = String(userData.user.email || '').trim().toLowerCase();
  const actorName = shortActorName(actorEmail, userData.user.id);
  const nowIso = new Date().toISOString();
  const snapshotTasks = [
    ...weekly.assetRows.map((row, index) => buildSnapshotTask(row, 'weekly_asset', { email: actorEmail, name: actorName }, assetResolutions[index].asset, nowIso)),
    ...weekly.projectRows.map((row, index) => buildSnapshotTask(row, 'weekly_project', { email: actorEmail, name: actorName }, projectResolutions[index].asset, nowIso)),
  ];

  const snapshotRow = stripUndefined({
    item_type: 'task_snapshot',
    workspace: weekMeta.workspace,
    week_key: weekMeta.weekKey,
    week_label: weekMeta.weekLabel,
    week_range: weekMeta.weekRange,
    group_label: weekMeta.groupLabel,
    basis_date: weekMeta.basisDate,
    title: `${weekMeta.weekLabel} 주간 보고`,
    description: `${file.name} 파싱 결과 ${snapshotTasks.length}건`,
    snapshot_data: snapshotTasks,
    task_count: snapshotTasks.length,
    created_by: userData.user.id,
    created_by_email: actorEmail,
    created_by_name: actorName,
    organization,
    payload: {
      source: 'll-weekly-doc-ingest',
      source_file_name: file.name,
      source_sha256: sourceSha,
      parser: weekly.reportJson.parser,
      line_count: weekly.lines.length,
      asset_count: weekly.assetRows.length,
      project_count: weekly.projectRows.length,
      preview_lines: weekly.reportJson.previewLines,
      report_year: year,
      report_month: month,
      report_week: week,
    },
    updated_at: nowIso,
    ...(previousSnapshot ? {} : { created_at: nowIso }),
  });

  const { error: snapshotError } = previousSnapshot
    ? await serviceClient
      .from('ll_work_items')
      .update(snapshotRow)
      .eq('id', previousSnapshot.id)
    : await serviceClient
      .from('ll_work_items')
      .insert(snapshotRow);
  if (snapshotError) return fail(500, 'Failed to save weekly snapshot into work platform', origin);

  return jsonResponse({
    ok: true,
    message: 'Weekly Word document parsed and saved into work platform snapshot',
    week_key: weekKey,
    counts: {
      lines: weekly.lines.length,
      assets: weekly.assetRows.length,
      projects: weekly.projectRows.length,
      snapshot_tasks: snapshotTasks.length,
    },
  }, 200, origin);
});
