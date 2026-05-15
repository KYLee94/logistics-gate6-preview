import { createClient } from 'npm:@supabase/supabase-js@2';
import mammoth from 'npm:mammoth@1.8.0';
import { Buffer } from 'node:buffer';

type Role = 'Reader' | 'Editor' | 'Manager' | 'Admin' | 'System Admin';
type SupabaseClient = ReturnType<typeof createClient>;

const WRITE_TABLE_ALLOWLIST = new Set([
  'public.ll_weekly_reports',
  'public.ll_weekly_assets',
  'public.ll_weekly_projects',
  'public.ll_weekly_doc_ingest_runs',
]);

const MAX_WEEKLY_DOC_BYTES = 20 * 1024 * 1024;

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
  let week = 1;
  while (start <= lastDay) {
    const end = new Date(start);
    end.setUTCDate(start.getUTCDate() + 6);
    if (end >= firstDay) {
      const startText = toIsoDate(start);
      const endText = toIsoDate(end);
      ranges.push({
        week,
        start: startText,
        end: endText,
        key: `${year}-${String(month).padStart(2, '0')}-w${week}`,
        label: `${startText} ~ ${endText}`,
      });
      week += 1;
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

async function restoreWeeklySnapshot(
  serviceClient: SupabaseClient,
  reportId: string,
  previousReport: Record<string, unknown> | null,
  previousAssets: Record<string, unknown>[],
  previousProjects: Record<string, unknown>[],
) {
  await serviceClient.from('ll_weekly_assets').delete().eq('report_id', reportId);
  await serviceClient.from('ll_weekly_projects').delete().eq('report_id', reportId);
  if (previousReport) {
    await serviceClient.from('ll_weekly_reports').upsert(previousReport, { onConflict: 'id' });
    if (previousAssets.length) await serviceClient.from('ll_weekly_assets').insert(previousAssets);
    if (previousProjects.length) await serviceClient.from('ll_weekly_projects').insert(previousProjects);
  } else {
    await serviceClient.from('ll_weekly_reports').delete().eq('id', reportId);
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
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
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

  if (![...WRITE_TABLE_ALLOWLIST].every((table) => table.startsWith('public.ll_'))) {
    return fail(500, 'Write allowlist is invalid', origin);
  }

  const formData = await request.formData();
  const file = formData.get('file');
  if (!(file instanceof File)) return fail(400, 'Word file is required', origin);
  const fileName = file.name || '';
  const lowerName = fileName.toLowerCase();
  if (!lowerName.endsWith('.docx') && !lowerName.endsWith('.doc')) return fail(400, 'Only Word .docx/.doc files are allowed', origin);
  if (file.size <= 0 || file.size > MAX_WEEKLY_DOC_BYTES) return fail(400, 'Word file size is invalid', origin);

  const year = Number(safeText(formData.get('year')));
  const month = Number(safeText(formData.get('month')));
  const week = Number(safeText(formData.get('week')));
  const range = buildMonthlyWeekRanges(year, month).find((item) => item.week === week);
  const weekKey = range?.key || '';
  const weekRange = range?.label || '';
  const organization = permission?.organization || safeText(formData.get('organization')) || 'organization_unknown';
  const clientWeekKey = safeText(formData.get('week_key'));
  const clientWeekRange = safeText(formData.get('week_range'));
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(week) || !range) {
    return fail(400, 'Valid year, month and Monday-Sunday week are required', origin);
  }
  if ((clientWeekKey && clientWeekKey !== weekKey) || (clientWeekRange && clientWeekRange !== weekRange)) {
    return fail(409, 'Client week selection does not match server Monday-Sunday week calculation', origin);
  }

  const buffer = await file.arrayBuffer();
  const sourceSha = await sha256Hex(buffer);
  const { data: duplicate } = await serviceClient
    .from('ll_weekly_reports')
    .select('id, source_file_name')
    .eq('week_key', weekKey)
    .eq('organization', organization)
    .eq('source_sha256', sourceSha)
    .maybeSingle();
  if (duplicate) return fail(409, 'Duplicate weekly document for this organization and week', origin);

  const parsed = await mammoth.extractRawText({ buffer: Buffer.from(buffer) });
  const weekly = parseWeeklyText(parsed.value || '');
  if (!weekly.lines.length) return fail(422, 'Word parsing produced no readable text', origin);

  const { data: previousReport } = await serviceClient
    .from('ll_weekly_reports')
    .select('*')
    .eq('week_key', weekKey)
    .eq('organization', organization)
    .maybeSingle();
  const previousReportId = previousReport?.id || null;
  const [{ data: previousAssets }, { data: previousProjects }] = previousReportId ? await Promise.all([
    serviceClient.from('ll_weekly_assets').select('*').eq('report_id', previousReportId),
    serviceClient.from('ll_weekly_projects').select('*').eq('report_id', previousReportId),
  ]) : [{ data: [] }, { data: [] }];

  const { data: report, error: reportError } = await serviceClient
    .from('ll_weekly_reports')
    .upsert({
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
    }, { onConflict: 'week_key,organization' })
    .select('id')
    .single();
  if (reportError || !report) return fail(500, 'Failed to save weekly report', origin);

  try {
    await serviceClient.from('ll_weekly_assets').delete().eq('report_id', report.id);
    await serviceClient.from('ll_weekly_projects').delete().eq('report_id', report.id);

    if (weekly.assetRows.length) {
      const { error } = await serviceClient.from('ll_weekly_assets').insert(
        weekly.assetRows.map((row) => ({ ...row, report_id: report.id })),
      );
      if (error) throw error;
    }
    if (weekly.projectRows.length) {
      const { error } = await serviceClient.from('ll_weekly_projects').insert(
        weekly.projectRows.map((row) => ({ ...row, report_id: report.id })),
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

  await serviceClient.from('ll_weekly_doc_ingest_runs').insert({
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
