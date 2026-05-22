import { createClient } from 'npm:@supabase/supabase-js@2';
import mammoth from 'npm:mammoth@1.8.0';
import { Buffer } from 'node:buffer';

type Role = 'Reader' | 'Editor' | 'Manager' | 'Admin' | 'System Admin';
type SupabaseClient = ReturnType<typeof createClient>;
type RateBucket = { resetAt: number; count: number };

const WRITE_TABLE_ALLOWLIST = new Set([
  'public.ll_weekly_records',
]);

const MAX_WEEKLY_DOC_BYTES = 20 * 1024 * 1024;
const rateBuckets = new Map<string, RateBucket>();

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
  const lastDay = new Date(Date.UTC(year, month, 0));
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

function roleCanIngest(role: string | undefined, dbFlag: boolean | undefined) {
  const normalized = String(role || '') as Role;
  return Boolean(dbFlag) || normalized === 'Manager' || normalized === 'Admin' || normalized === 'System Admin';
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
  let timeout: number | undefined;
  const timeoutPromise = new Promise<T>((_, reject) => {
    timeout = setTimeout(() => reject(new Error(message)), timeoutMs);
  });
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

async function restoreWeeklySnapshot(
  serviceClient: SupabaseClient,
  reportId: string,
  previousReport: Record<string, unknown> | null,
  previousAssets: Record<string, unknown>[],
  previousProjects: Record<string, unknown>[],
) {
  await serviceClient.from('ll_weekly_records').delete().eq('record_type', 'asset').eq('report_id', reportId);
  await serviceClient.from('ll_weekly_records').delete().eq('record_type', 'project').eq('report_id', reportId);
  if (previousReport) {
    await serviceClient.from('ll_weekly_records').upsert(previousReport, { onConflict: 'id' });
    if (previousAssets.length) await serviceClient.from('ll_weekly_records').insert(previousAssets);
    if (previousProjects.length) await serviceClient.from('ll_weekly_records').insert(previousProjects);
  } else {
    await serviceClient.from('ll_weekly_records').delete().eq('id', reportId).eq('record_type', 'report');
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
    .filter((row) => /Task|Next|Action|협의|검토|일정|업무|이슈|계획|후속|F\/U/i.test(row.text))
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
  const { data: permission } = await serviceClient
    .from('ll_user_permissions')
    .select('logistics_role, can_ingest_weekly, organization')
    .eq('user_id', userData.user.id)
    .maybeSingle();

  const role = permission?.logistics_role;
  if (!roleCanIngest(role, permission?.can_ingest_weekly)) return fail(403, 'Insufficient logistics permission', origin);
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
  const { data: duplicate } = await serviceClient
    .from('ll_weekly_records')
    .select('id, source_file_name')
    .eq('record_type', 'report')
    .eq('week_key', weekKey)
    .eq('organization', organization)
    .eq('source_sha256', sourceSha)
    .maybeSingle();
  if (duplicate) return fail(409, 'Duplicate weekly document for this organization and week', origin);

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

  const { data: previousReport } = await serviceClient
    .from('ll_weekly_records')
    .select('*')
    .eq('record_type', 'report')
    .eq('week_key', weekKey)
    .eq('organization', organization)
    .maybeSingle();
  const previousReportId = previousReport?.id || null;
  const [{ data: previousAssets }, { data: previousProjects }] = previousReportId ? await Promise.all([
    serviceClient.from('ll_weekly_records').select('*').eq('record_type', 'asset').eq('report_id', previousReportId),
    serviceClient.from('ll_weekly_records').select('*').eq('record_type', 'project').eq('report_id', previousReportId),
  ]) : [{ data: [] }, { data: [] }];

  const reportPayload = {
    record_type: 'report',
    week_key: weekKey,
    organization,
    report_year: year,
    report_month: month,
    report_week: week,
    source_file_name: file.name,
    source_sha256: sourceSha,
    source_text: parsed.value || '',
    report_json: { ...weekly.reportJson, weekRange },
    created_by: userData.user.id,
    updated_at: new Date().toISOString(),
  };
  const { data: report, error: reportError } = previousReportId
    ? await serviceClient
      .from('ll_weekly_records')
      .update(reportPayload)
      .eq('id', previousReportId)
      .eq('record_type', 'report')
      .select('id')
      .single()
    : await serviceClient
      .from('ll_weekly_records')
      .insert(reportPayload)
      .select('id')
      .single();
  if (reportError || !report) return fail(500, 'Failed to save weekly report', origin);

  try {
    await serviceClient.from('ll_weekly_records').delete().eq('record_type', 'asset').eq('report_id', report.id);
    await serviceClient.from('ll_weekly_records').delete().eq('record_type', 'project').eq('report_id', report.id);

    if (weekly.assetRows.length) {
      const { error } = await serviceClient.from('ll_weekly_records').insert(
        weekly.assetRows.map((row) => ({ ...row, record_type: 'asset', report_id: report.id })),
      );
      if (error) throw error;
    }
    if (weekly.projectRows.length) {
      const { error } = await serviceClient.from('ll_weekly_records').insert(
        weekly.projectRows.map((row) => ({ ...row, record_type: 'project', report_id: report.id })),
      );
      if (error) throw error;
    }
  } catch {
    await restoreWeeklySnapshot(
      serviceClient,
      report.id,
      previousReport || null,
      previousAssets || [],
      previousProjects || [],
    );
    return fail(500, 'Weekly ingest failed without leaving partial writes', origin);
  }

  await serviceClient.from('ll_weekly_records').insert({
    record_type: 'doc_ingest',
    report_id: report.id,
    week_key: weekKey,
    organization,
    source_file_name: file.name,
    source_sha256: sourceSha,
    requested_by: userData.user.id,
    status: 'parsed',
    message: 'Weekly Word document parsed and saved',
    parsed_counts: {
      lines: weekly.lines.length,
      assets: weekly.assetRows.length,
      projects: weekly.projectRows.length,
    },
  });

  return jsonResponse({
    ok: true,
    message: 'Weekly Word document parsed and saved',
    week_key: weekKey,
    counts: {
      lines: weekly.lines.length,
      assets: weekly.assetRows.length,
      projects: weekly.projectRows.length,
    },
  }, 200, origin);
});
