const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..', '..');
const OUT_DIR = path.join(ROOT, 'qa-artifacts', 'logistics-gate6');
const DEFAULT_BASE_URL = 'http://127.0.0.1:8081/logistics-gate6-preview/';

function readEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  return Object.fromEntries(fs.readFileSync(filePath, 'utf8')
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#') && line.includes('='))
    .map((line) => {
      const index = line.indexOf('=');
      return [line.slice(0, index).trim(), line.slice(index + 1).trim().replace(/^['"]|['"]$/gu, '')];
    }));
}

const fileEnv = { ...readEnvFile(path.join(ROOT, '.env')), ...readEnvFile(path.join(ROOT, '.env.local')) };
const envValue = (...keys) => keys.map((key) => process.env[key] || fileEnv[key]).find(Boolean) || '';
const argValue = (name, fallback = '') => {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? fallback : (process.argv[index + 1] || fallback);
};
const sqlString = (value) => `'${String(value || '').replace(/'/gu, "''")}'`;
const stamp = () => new Date().toISOString().replace(/[-:]/gu, '').replace(/\..+$/u, '').replace('T', '-');
const joinUrl = (baseUrl, route) => new URL(route.replace(/^\/+/u, ''), baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`).toString();
const pwHash = (value) => crypto.createHash('sha256').update(String(value)).digest('hex').slice(0, 12);

function runSupabaseQuery(sql) {
  const tmpPath = path.join(os.tmpdir(), `gate6-auth-password-flow-${process.pid}-${Date.now()}.sql`);
  fs.writeFileSync(tmpPath, sql, 'utf8');
  const result = spawnSync('npx', ['supabase', 'db', 'query', '--linked', '--file', tmpPath, '-o', 'json'], {
    cwd: ROOT,
    encoding: 'utf8',
    shell: process.platform === 'win32',
  });
  try { fs.unlinkSync(tmpPath); } catch {}
  if (result.status !== 0) throw new Error((result.stderr || result.stdout || 'supabase db query failed').trim());
  return result.stdout || '';
}

function chromeExecutablePath() {
  return [
    process.env.CHROME_PATH,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  ].filter(Boolean).find((candidate) => fs.existsSync(candidate));
}

function insertPermissionSql(email, userId) {
  const now = new Date().toISOString();
  return `
insert into public.ll_user_permissions (
  user_id, email, staff_name, organization, logistics_role, account_status,
  feature_permissions, managed_asset_permissions, other_asset_permissions, profile_payload, created_at, updated_at
) values (
  ${sqlString(userId)}::uuid, ${sqlString(email)}, 'QA Login Test', 'QA', 'Reader', 'active',
  '{}'::jsonb,
  '{"asset_ids":[],"read":true,"edit":false,"add":false,"delete":false}'::jsonb,
  '{"read":false,"edit":false,"add":false,"delete":false}'::jsonb,
  '{"source":"logistics_auth_password_flow_smoke","temporary":true}'::jsonb,
  ${sqlString(now)}::timestamptz, ${sqlString(now)}::timestamptz
) on conflict (email) do update set
  user_id = excluded.user_id,
  staff_name = excluded.staff_name,
  organization = excluded.organization,
  logistics_role = excluded.logistics_role,
  account_status = excluded.account_status,
  feature_permissions = excluded.feature_permissions,
  managed_asset_permissions = excluded.managed_asset_permissions,
  other_asset_permissions = excluded.other_asset_permissions,
  profile_payload = excluded.profile_payload,
  updated_at = excluded.updated_at;
`;
}

function cleanupSql(email) {
  return `
with qa_users as (
  select id, lower(email) as email from auth.users where lower(email) = lower(${sqlString(email)})
),
deleted_work_items as (
  delete from public.ll_work_items where created_by in (select id from qa_users) returning 1
),
deleted_audit as (
  delete from public.ll_audit_events
  where requested_by in (select id from qa_users)
     or coalesce(request_payload::text, '') ilike '%' || ${sqlString(email)} || '%'
     or coalesce(event_payload::text, '') ilike '%' || ${sqlString(email)} || '%'
  returning 1
),
deleted_permissions as (
  delete from public.ll_user_permissions
  where lower(email) = lower(${sqlString(email)}) or coalesce(profile_payload::text, '') ilike '%logistics_auth_password_flow_smoke%'
  returning 1
),
deleted_auth as (
  delete from auth.users where id in (select id from qa_users) returning 1
)
select jsonb_build_object(
  'work_items', (select count(*) from deleted_work_items),
  'audit_events', (select count(*) from deleted_audit),
  'permissions', (select count(*) from deleted_permissions),
  'auth_users', (select count(*) from deleted_auth)
) as cleanup_result;
`;
}

async function submitVisibleForm(page) {
  await page.locator('form').first().locator('button[type="submit"]').click();
}

async function waitForWorkspace(page) {
  try {
    await page.waitForFunction(() => !window.location.href.includes('auth-setup'), null, { timeout: 45000 });
  } catch (error) {
    const bodyText = await page.locator('body').innerText({ timeout: 10000 }).catch(() => '');
    throw new Error(`workspace navigation timed out; url=${page.url()}; body=${bodyText.slice(0, 500)}`);
  }
  await page.waitForLoadState('networkidle', { timeout: 45000 }).catch(() => {});
  const bodyText = await page.locator('body').innerText({ timeout: 10000 });
  if (!bodyText || bodyText.trim().length < 20) throw new Error('workspace body is empty after login');
  return bodyText.slice(0, 160);
}

async function openAuthPage(context, baseUrl, report) {
  const page = await context.newPage();
  page.on('pageerror', (error) => report.errors.push(`pageerror: ${error.message}`));
  page.on('response', (response) => {
    const url = response.url();
    if (url.includes('/auth/v1/') || url.includes('/functions/v1/ll-dashboard-api')) {
      report.network.push({
        status: response.status(),
        method: response.request().method(),
        kind: url.includes('/auth/v1/token') ? 'auth-token'
          : url.includes('/auth/v1/user') ? 'auth-user'
            : url.includes('/functions/v1/ll-dashboard-api') ? 'edge'
              : 'auth-other',
      });
    }
  });
  await page.goto(joinUrl(baseUrl, 'auth-setup'), { waitUntil: 'networkidle', timeout: 45000 });
  await page.locator('#logistics-login-email').waitFor({ state: 'visible', timeout: 20000 });
  return page;
}

async function enterEmail(page, email) {
  await page.locator('#logistics-login-email').fill(email);
  await submitVisibleForm(page);
  await page.locator('#logistics-login-password').waitFor({ state: 'visible', timeout: 30000 });
}

async function completeFirstLogin(page, email, password, accessCode) {
  await enterEmail(page, email);
  await page.locator('#logistics-login-confirm-password').waitFor({ state: 'visible', timeout: 15000 });
  await page.locator('#logistics-login-password').fill(password);
  await page.locator('#logistics-login-confirm-password').fill(password);
  await page.locator('input[name="logistics-access-code"]').fill(accessCode);
  await submitVisibleForm(page);
  await page.locator('div.fixed.inset-0 button').last().click();
  return waitForWorkspace(page);
}

async function loginWithPassword(page, email, password, expectSuccess) {
  await enterEmail(page, email);
  await page.locator('#logistics-login-password').fill(password);
  await submitVisibleForm(page);
  if (expectSuccess) return waitForWorkspace(page);
  await page.waitForTimeout(2500);
  if (!page.url().includes('auth-setup')) throw new Error('old password unexpectedly logged in');
  return page.locator('body').innerText({ timeout: 10000 });
}

async function changePassword(page, email, oldPassword, newPassword) {
  await enterEmail(page, email);
  await page.locator('form button[type="button"]').nth(0).click();
  await page.locator('#logistics-current-password').waitFor({ state: 'visible', timeout: 15000 });
  await page.locator('#logistics-current-password').fill(oldPassword);
  await page.locator('#logistics-new-password').fill(newPassword);
  await page.locator('#logistics-confirm-new-password').fill(newPassword);
  const valueLengths = await page.evaluate(() => ({
    current: document.querySelector('#logistics-current-password')?.value?.length || 0,
    next: document.querySelector('#logistics-new-password')?.value?.length || 0,
    confirm: document.querySelector('#logistics-confirm-new-password')?.value?.length || 0,
  }));
  if (!valueLengths.current || !valueLengths.next || !valueLengths.confirm) {
    throw new Error(`password change inputs were not filled: ${JSON.stringify(valueLengths)}`);
  }
  await submitVisibleForm(page);
  return waitForWorkspace(page);
}

async function requestResetEmail(page, email) {
  await enterEmail(page, email);
  await page.locator('form button[type="button"]').nth(1).click();
  await page.locator('#logistics-reset-email').waitFor({ state: 'visible', timeout: 15000 });
  await page.locator('#logistics-reset-email').fill(email);
  const dialogPromise = page.waitForEvent('dialog', { timeout: 20000 }).catch(() => null);
  await submitVisibleForm(page);
  const dialog = await dialogPromise;
  if (dialog) {
    const message = dialog.message();
    await dialog.accept();
    return { dialog: true, message: message.slice(0, 200) };
  }
  return { dialog: false, message: (await page.locator('body').innerText({ timeout: 10000 })).slice(0, 300) };
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const baseUrl = argValue('base-url', DEFAULT_BASE_URL);
  const email = argValue('email', `gate6-auth-qa-${Date.now()}@igisam.com`).trim().toLowerCase();
  const accessCode = argValue('access-code', envValue('VITE_IOTA_PILOT_ACCESS_CODE', 'LOGISTICS_FIRST_ACCESS_CODE') || 'logistics1!');
  const initialPassword = `Gate6Qa!${Date.now().toString().slice(-8)}a`;
  const changedPassword = `Gate6Qa!${Date.now().toString().slice(-8)}b`;
  const outPath = path.join(OUT_DIR, `auth-password-flow-smoke-${stamp()}.json`);
  const latestPath = path.join(OUT_DIR, 'auth-password-flow-smoke-latest.json');
  const screenshotPath = outPath.replace(/\.json$/u, '.png');
  const report = {
    ok: false,
    generated_at: new Date().toISOString(),
    base_url: baseUrl,
    email,
    password_hashes: { initial: pwHash(initialPassword), changed: pwHash(changedPassword) },
    checks: {},
    network: [],
    cleanup: null,
    screenshot: path.relative(ROOT, screenshotPath).replace(/\\/gu, '/'),
    errors: [],
  };

  let browser;
  try {
    runSupabaseQuery(insertPermissionSql(email, crypto.randomUUID()));
    report.checks.permission_seeded = true;
    browser = await chromium.launch({ headless: true, executablePath: chromeExecutablePath() });
    const contextOptions = { viewport: { width: 1365, height: 900 }, serviceWorkers: 'block' };

    let context = await browser.newContext(contextOptions);
    let page = await openAuthPage(context, baseUrl, report);
    report.checks.first_login_workspace_text = await completeFirstLogin(page, email, initialPassword, accessCode);
    await page.screenshot({ path: screenshotPath, fullPage: false }).catch(() => {});
    await context.close();

    context = await browser.newContext(contextOptions);
    page = await openAuthPage(context, baseUrl, report);
    report.checks.regular_login_workspace_text = await loginWithPassword(page, email, initialPassword, true);
    await context.close();

    context = await browser.newContext(contextOptions);
    page = await openAuthPage(context, baseUrl, report);
    report.checks.password_change_workspace_text = await changePassword(page, email, initialPassword, changedPassword);
    await context.close();

    context = await browser.newContext(contextOptions);
    page = await openAuthPage(context, baseUrl, report);
    const oldPasswordText = await loginWithPassword(page, email, initialPassword, false);
    report.checks.old_password_rejected = /비밀번호|password|incorrect|invalid|오류|틀/iu.test(oldPasswordText);
    await context.close();

    context = await browser.newContext(contextOptions);
    page = await openAuthPage(context, baseUrl, report);
    report.checks.new_password_workspace_text = await loginWithPassword(page, email, changedPassword, true);
    await context.close();

    context = await browser.newContext(contextOptions);
    page = await openAuthPage(context, baseUrl, report);
    report.checks.reset_email_request = await requestResetEmail(page, email);
    await context.close();

    const failures = [];
    if (!report.checks.first_login_workspace_text) failures.push('first login failed');
    if (!report.checks.regular_login_workspace_text) failures.push('regular login failed');
    if (!report.checks.password_change_workspace_text) failures.push('password change failed');
    if (!report.checks.old_password_rejected) failures.push('old password was not rejected');
    if (!report.checks.new_password_workspace_text) failures.push('new password failed');
    if (!report.checks.reset_email_request?.dialog && !/메일|email|reset|링크|sent/iu.test(report.checks.reset_email_request?.message || '')) failures.push('reset request feedback missing');
    report.failures = failures;
    report.ok = failures.length === 0;
  } catch (error) {
    report.errors.push(error?.message || String(error));
    report.failures = ['auth password flow smoke threw'];
  } finally {
    if (browser) await browser.close().catch(() => {});
    try { report.cleanup = runSupabaseQuery(cleanupSql(email)); } catch (error) { report.errors.push(`cleanup failed: ${error?.message || error}`); }
    fs.writeFileSync(outPath, JSON.stringify(report, null, 2), 'utf8');
    fs.writeFileSync(latestPath, JSON.stringify(report, null, 2), 'utf8');
    console.log(JSON.stringify(report, null, 2));
  }
  if (!report.ok) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
