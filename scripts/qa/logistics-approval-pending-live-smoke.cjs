const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const {
  ROOT,
  OUT_DIR,
  argsValue,
  chromeExecutablePath,
  envValue,
  invoke,
  joinUrl,
  runLinkedDbQuery,
  signIn,
  timestampForFile,
} = require('./logistics-data-management-qa-utils.cjs');

const stamp = timestampForFile();
const outJson = path.join(OUT_DIR, `approval-pending-live-smoke-${stamp}.json`);
const latestJson = path.join(OUT_DIR, 'approval-pending-live-smoke-latest.json');
const beforeScreenshot = path.join(OUT_DIR, `approval-pending-live-smoke-${stamp}-detail.png`);
const afterScreenshot = path.join(OUT_DIR, `approval-pending-live-smoke-${stamp}-after.png`);
const DEFAULT_BASE_URL = 'https://kylee94.github.io/logistics-gate6-preview/';

function sqlLiteral(value) {
  return `'${String(value ?? '').replace(/'/gu, "''")}'`;
}

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function text(value) {
  return value === undefined || value === null ? '' : String(value).trim();
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function createApprovalProbe({ supabaseUrl, anonKey, auth, stamp, selfApprove = false }) {
  const assetRead = await invoke(supabaseUrl, anonKey, auth.token, 'dashboard/asset/read', {});
  const asset = assetRead.data?.asset;
  assert(asset?.asset_id && asset?.asset_name, 'dashboard/asset/read did not return an editable asset.');

  const beforeValue = String(asset.asset_name);
  const targetName = `${asset.asset_name} QA-${stamp}`;
  const submitPayload = {
    source_table: 'public.ll_assets',
    target_type: 'asset',
    target_name: targetName,
    target_row_id: asset.asset_id,
    field_name: 'asset_name',
    before_value: beforeValue,
    requested_value: beforeValue,
    reason_code: 'qa_noop_approval_live_smoke',
    request_payload: {
      qa_noop: true,
      qa_stamp: stamp,
      reason: 'QA no-op approval live smoke',
      cell_edits: [{
        target_table: 'public.ll_assets',
        primary_key_field: 'asset_id',
        target_row_id: asset.asset_id,
        field_name: 'asset_name',
        source_header: 'asset_name',
        before_value: beforeValue,
        after_value: beforeValue,
        asset_id: asset.asset_id,
        asset_name: targetName,
      }],
    },
  };

  const submitted = await invoke(supabaseUrl, anonKey, auth.token, 'edits/submit', submitPayload);
  const editId = submitted.data?.id;
  assert(editId, 'edits/submit did not return an edit request id.');

  if (selfApprove) {
    runLinkedDbQuery(`
update public.ll_edit_requests
set request_payload = jsonb_set(coalesce(request_payload, '{}'::jsonb), '{qa_requester_self_approval}', 'true'::jsonb, true),
    updated_at = now()
where id = ${sqlLiteral(editId)}
  and status = 'submitted'
returning id::text, requested_by::text, status, write_status;
`, 'approval-pending-live-smoke-self');
    return { editId, asset, targetName, beforeValue };
  }

  const swapped = runLinkedDbQuery(`
with other_user as (
  select id as user_id
  from auth.users
  where id::text <> ${sqlLiteral(auth.user?.id)}
  order by email nulls last, created_at
  limit 1
)
update public.ll_edit_requests
set requested_by = (select user_id from other_user),
    request_payload = jsonb_set(coalesce(request_payload, '{}'::jsonb), '{qa_requester_swapped}', 'true'::jsonb, true),
    updated_at = now()
where id = ${sqlLiteral(editId)}
  and status = 'submitted'
  and exists (select 1 from other_user)
returning id::text, requested_by::text, status, write_status;
`, 'approval-pending-live-smoke');
  assert(swapped.length === 1, 'Failed to swap QA requester for non-self approval.');

  return { editId, asset, targetName, beforeValue };
}

async function main() {
  const baseUrl = argsValue('base-url', DEFAULT_BASE_URL);
  const selfApprove = process.argv.includes('--self-approve');
  const supabaseUrl = envValue('LOGISTICS_SUPABASE_URL', 'VITE_SUPABASE_URL');
  const anonKey = envValue('LOGISTICS_SUPABASE_ANON_KEY', 'VITE_SUPABASE_ANON_KEY');
  if (!supabaseUrl || !anonKey) throw new Error('Missing Supabase URL or anon key.');
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const auth = await signIn(supabaseUrl, anonKey);
  const probe = await createApprovalProbe({ supabaseUrl, anonKey, auth, stamp, selfApprove });
  const statusBefore = await invoke(supabaseUrl, anonKey, auth.token, 'data-management/status', { limit: 120, row_limit: 20 });
  const pendingBefore = safeArray(statusBefore.data?.edit_requests).find((row) => text(row.request_id || row.id) === probe.editId);
  assert(pendingBefore, 'Created approval request was not returned by data-management/status.');
  const changeItems = safeArray(pendingBefore.change_items);
  assert(changeItems.length === 1, 'Approval status did not include exact change_items.');
  assert(!/undefined|null|multiple_fields|current values|requested values/iu.test(JSON.stringify(changeItems)), 'Approval change_items contain internal or summary-only values.');

  const report = {
    ok: false,
    generated_at: new Date().toISOString(),
    base_url: baseUrl,
    mode: selfApprove ? 'self_approval_allowed_approver' : 'non_self_approval',
    edit_request_id: probe.editId,
    target_name: probe.targetName,
    checks: {},
    metrics: {},
    screenshots: {
      detail: path.relative(ROOT, beforeScreenshot).replace(/\\/gu, '/'),
      after: path.relative(ROOT, afterScreenshot).replace(/\\/gu, '/'),
    },
    errors: [],
  };

  let browser;
  try {
    browser = await chromium.launch({ headless: true, executablePath: chromeExecutablePath() });
    const context = await browser.newContext({ viewport: { width: 1440, height: 960 }, serviceWorkers: 'block' });
    await context.addInitScript(({ session }) => {
      sessionStorage.setItem('sb-iota-auth-token', JSON.stringify(session));
      sessionStorage.setItem('logistics_preview_auth', JSON.stringify({ email: session?.user?.email || '' }));
      localStorage.setItem('logisticsDashboardReadMode', 'primary-safe');
    }, { session: auth.session });
    const page = await context.newPage();
    page.on('pageerror', (error) => report.errors.push(error.message));

    const approvalUrl = `${joinUrl(baseUrl, 'data-management/approval')}?qa=${stamp}`;
    await page.goto(approvalUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForSelector('[data-data-management-approval-dashboard="true"]', { timeout: 60000 });
    const row = page.locator('[data-testid="data-management-approval-row"]').filter({ hasText: `QA-${stamp}` }).first();
    await row.waitFor({ state: 'visible', timeout: 60000 });
    await row.dblclick();
    await page.waitForSelector('[data-data-management-approval-detail="true"]', { timeout: 10000 });
    const detailText = await page.locator('[data-data-management-approval-detail="true"]').innerText({ timeout: 10000 });
    report.checks.detail_modal_opens_from_row = detailText.includes(probe.beforeValue) && detailText.includes('QA no-op approval live smoke');
    await page.screenshot({ path: beforeScreenshot, fullPage: false });

    const approveStarted = Date.now();
    const approveResponsePromise = page.waitForResponse((response) => {
      const request = response.request();
      return response.url().includes('/functions/v1/ll-dashboard-api')
        && (request.postData() || '').includes('edits/approve');
    }, { timeout: 15000 });
    const approveButton = page.locator('[data-data-management-approval-detail="true"] button').last();
    report.checks.detail_approve_button_enabled = await approveButton.isEnabled().catch(() => false);
    assert(report.checks.detail_approve_button_enabled, 'Detail approve button is disabled for the signed-in approver.');
    await approveButton.click();
    const approveResponse = await approveResponsePromise;
    report.metrics.approve_response_ms = Date.now() - approveStarted;
    const approveBody = await approveResponse.json().catch(() => ({}));
    report.checks.approve_http_ok = approveResponse.ok() && approveBody?.ok !== false;
    report.checks.approve_under_3s = report.metrics.approve_response_ms <= 3000;

    await page.screenshot({ path: afterScreenshot, fullPage: false });
  } finally {
    if (browser) await browser.close();
  }

  const statusAfter = await invoke(supabaseUrl, anonKey, auth.token, 'data-management/status', { limit: 120, row_limit: 20 });
  const afterRow = safeArray(statusAfter.data?.edit_requests).find((row) => text(row.request_id || row.id) === probe.editId);
  report.checks.status_written_after_approve = afterRow?.status === 'written' || afterRow?.write_status === 'readback_confirmed';
  report.checks.no_internal_summary_values = !/multiple_fields|current values|requested values|undefined|null/iu.test(JSON.stringify(afterRow?.change_items || []));
  report.ok = Object.values(report.checks).every(Boolean) && report.errors.length === 0;

  fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(latestJson, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`approval pending live smoke ${report.ok ? 'PASS' : 'FAIL'}: ${path.relative(ROOT, outJson)}`);
  if (!report.ok) process.exit(1);
}

main().catch((error) => {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const failed = {
    ok: false,
    generated_at: new Date().toISOString(),
    error: error?.message || String(error),
  };
  fs.writeFileSync(outJson, `${JSON.stringify(failed, null, 2)}\n`);
  fs.writeFileSync(latestJson, `${JSON.stringify(failed, null, 2)}\n`);
  console.error(error);
  process.exit(1);
});
