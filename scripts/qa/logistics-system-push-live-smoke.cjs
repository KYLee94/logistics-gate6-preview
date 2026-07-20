const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, spawnSync } = require('child_process');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..', '..');
const OUT_DIR = path.join(ROOT, 'qa-artifacts', 'logistics-gate6');
const BASE_URL = 'https://kylee94.github.io/logistics-gate6-preview/';
const ROUTE = '?p=platform/iotaseoul/workspace/logistics';
const STAGE_TIMEOUT_MS = 45_000;

function readEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  return Object.fromEntries(fs.readFileSync(filePath, 'utf8').split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#') && line.includes('='))
    .map((line) => {
      const index = line.indexOf('=');
      return [line.slice(0, index).trim(), line.slice(index + 1).trim().replace(/^["']|["']$/gu, '')];
    }));
}

const fileEnv = { ...readEnvFile(path.join(ROOT, '.env')), ...readEnvFile(path.join(ROOT, '.env.local')) };
function envValue(...keys) {
  for (const key of keys) {
    if (process.env[key]) return process.env[key];
    if (fileEnv[key]) return fileEnv[key];
  }
  return '';
}
function sqlString(value) {
  return `'${String(value || '').replace(/'/gu, "''")}'`;
}
function stamp() {
  return new Date().toISOString().replace(/[-:]/gu, '').replace(/\..+$/u, '').replace('T', '-');
}
function parseArgs(argv) {
  const options = { browser: 'chrome', executable: '', permissionMode: 'cdp_override' };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    const next = argv[index + 1];
    const readValue = (name) => {
      if (argument === name) {
        index += 1;
        return next;
      }
      return argument.startsWith(`${name}=`) ? argument.slice(name.length + 1) : null;
    };
    const browser = readValue('--browser');
    const executable = readValue('--executable');
    const permissionMode = readValue('--permission-mode');
    if (browser !== null) options.browser = String(browser || '').toLowerCase();
    if (executable !== null) options.executable = String(executable || '');
    if (permissionMode !== null) options.permissionMode = String(permissionMode || '').toLowerCase();
  }
  if (!['chrome', 'whale'].includes(options.browser)) throw new Error('--browser must be chrome or whale.');
  if (options.permissionMode !== 'cdp_override') {
    throw new Error('--permission-mode currently supports only cdp_override; this mode never proves an OS notification.');
  }
  return options;
}
function findWhaleEngineExecutable(applicationDir) {
  if (!fs.existsSync(applicationDir)) return '';
  const versions = fs.readdirSync(applicationDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && /^\d+(?:\.\d+)+$/u.test(entry.name))
    .map((entry) => entry.name)
    .sort((left, right) => right.localeCompare(left, undefined, { numeric: true }));
  for (const version of versions) {
    const executable = path.join(applicationDir, version, 'naver_work.exe');
    if (fs.existsSync(executable)) return executable;
  }
  return '';
}
function browserExecutablePath({ browser, executable }) {
  if (executable) {
    if (!fs.existsSync(executable)) throw new Error(`--executable does not exist: ${executable}`);
    return path.resolve(executable);
  }
  const candidates = browser === 'whale'
    ? [
      process.env.WHALE_PATH,
      findWhaleEngineExecutable('C:\\Program Files\\Naver\\Naver Whale\\Application'),
      findWhaleEngineExecutable('C:\\Program Files (x86)\\Naver\\Naver Whale\\Application'),
      'C:\\Program Files\\Naver\\Naver Whale\\Application\\whale.exe',
      'C:\\Program Files (x86)\\Naver\\Naver Whale\\Application\\whale.exe',
    ]
    : [
      process.env.CHROME_PATH,
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    ];
  const found = candidates.filter(Boolean).find((candidate) => fs.existsSync(candidate));
  if (!found) throw new Error(`Could not find ${browser}. Pass --executable=PATH to select it explicitly.`);
  return path.resolve(found);
}
function runLinkedSql(sql, label) {
  const sqlPath = path.join(os.tmpdir(), `gate6-${label}-${process.pid}-${Date.now()}.sql`);
  fs.writeFileSync(sqlPath, sql, 'utf8');
  const result = spawnSync('npx', ['supabase', 'db', 'query', '--linked', '--file', sqlPath], {
    cwd: ROOT,
    encoding: 'utf8',
    shell: process.platform === 'win32',
  });
  try { fs.unlinkSync(sqlPath); } catch { /* QA temp cleanup */ }
  if (result.status !== 0) throw new Error((result.stderr || result.stdout || `${label} query failed`).trim());
  return `${result.stdout || ''}\n${result.stderr || ''}`;
}
function readReturnedNotificationId(output, label) {
  const ids = String(output).match(/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/giu) || [];
  const notificationId = ids.at(-1);
  if (!notificationId) throw new Error(`${label} did not return notification_id.`);
  return notificationId;
}
function readBooleanMarker(output, marker) {
  return new RegExp(`${marker}\\s*(?:[|:=]|\\s)+\\s*(true|t|1)`, 'iu').test(String(output));
}
function readTextMarker(output, marker) {
  const match = String(output).match(new RegExp(`${marker}\\s*(?:[|:=]|\\s)+\\s*["']?([^\\s|"',}\\]]+)`, 'iu'));
  return match?.[1] || '';
}
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
function errorDetails(error) {
  if (!error) return null;
  return {
    name: String(error.name || 'Error'),
    message: String(error.message || error),
    code: error.code == null ? null : String(error.code),
  };
}
function vapidKeyShape(publicKey) {
  const result = {
    present: typeof publicKey === 'string' && Boolean(publicKey),
    base64url: false,
    decoded_bytes: 0,
    uncompressed_p256_point: false,
    valid_for_push_subscribe: false,
    decode_error: null,
  };
  if (!result.present) return result;
  result.base64url = /^[A-Za-z0-9_-]+$/u.test(publicKey);
  if (!result.base64url) return result;
  try {
    const padding = '='.repeat((4 - (publicKey.length % 4)) % 4);
    const decoded = Buffer.from(`${publicKey}${padding}`.replace(/-/gu, '+').replace(/_/gu, '/'), 'base64');
    result.decoded_bytes = decoded.length;
    result.uncompressed_p256_point = decoded.length === 65 && decoded[0] === 4;
    result.valid_for_push_subscribe = result.uncompressed_p256_point;
  } catch (error) {
    result.decode_error = errorDetails(error);
  }
  return result;
}
async function fetchPushRuntimeConfig(session) {
  const supabaseUrl = envValue('LOGISTICS_SUPABASE_URL', 'VITE_SUPABASE_URL').replace(/\/$/u, '');
  const anonKey = envValue('LOGISTICS_SUPABASE_ANON_KEY', 'VITE_SUPABASE_ANON_KEY');
  const response = await fetch(`${supabaseUrl}/functions/v1/ll-dashboard-api`, {
    method: 'POST',
    headers: {
      apikey: anonKey,
      authorization: `Bearer ${session.access_token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ action: 'notifications/push/config', payload: {} }),
  });
  const body = await response.json().catch(() => null);
  const publicKey = typeof body?.data?.public_key === 'string' ? body.data.public_key : '';
  return {
    http_status: response.status,
    ok: response.ok && body?.ok !== false,
    response_code: String(body?.code || body?.error?.code || ''),
    public_key: publicKey,
    public_key_shape: vapidKeyShape(publicKey),
  };
}
async function collectBrowserPushDiagnostics(page, publicKey, stage) {
  const result = await page.evaluate(async ({ key, label }) => {
    const errorDetailsInPage = (error) => error ? {
      name: String(error.name || 'Error'),
      message: String(error.message || error),
      code: error.code == null ? null : String(error.code),
    } : null;
    const registrationSummary = (registration) => ({
      scope: registration.scope || '',
      active: registration.active ? { state: registration.active.state, script_url: registration.active.scriptURL } : null,
      waiting: registration.waiting ? { state: registration.waiting.state, script_url: registration.waiting.scriptURL } : null,
      installing: registration.installing ? { state: registration.installing.state, script_url: registration.installing.scriptURL } : null,
    });
    const result = {
      stage: label,
      secure_context: Boolean(window.isSecureContext),
      notification_permission: typeof Notification === 'undefined' ? 'unsupported' : Notification.permission,
      push_manager_supported: 'PushManager' in window,
      service_worker_supported: 'serviceWorker' in navigator,
      service_worker_controller: navigator.serviceWorker?.controller ? {
        state: navigator.serviceWorker.controller.state,
        script_url: navigator.serviceWorker.controller.scriptURL,
      } : null,
      browser_permissions_notification: null,
      registrations: [],
      ready_registration: null,
      existing_subscription: { present: false, endpoint_present: false, application_server_key_bytes: 0 },
      vapid_key_shape: { present: Boolean(key), base64url: false, decoded_bytes: 0, uncompressed_p256_point: false },
      diagnostic_error: null,
    };
    try {
      if (navigator.permissions?.query) {
        result.browser_permissions_notification = (await navigator.permissions.query({ name: 'notifications' })).state;
      }
    } catch (error) {
      result.browser_permissions_notification = `query_failed:${error?.name || 'Error'}`;
    }
    try {
      result.registrations = (await navigator.serviceWorker.getRegistrations()).map(registrationSummary);
      const ready = await navigator.serviceWorker.ready;
      result.ready_registration = registrationSummary(ready);
      const subscription = await ready.pushManager.getSubscription();
      if (subscription) {
        result.existing_subscription = {
          present: true,
          endpoint_present: Boolean(subscription.endpoint),
          application_server_key_bytes: subscription.options?.applicationServerKey?.byteLength || 0,
        };
      }
    } catch (error) {
      result.diagnostic_error = errorDetailsInPage(error);
    }
    try {
      result.vapid_key_shape.base64url = /^[A-Za-z0-9_-]+$/u.test(key || '');
      if (result.vapid_key_shape.base64url) {
        const padding = '='.repeat((4 - (key.length % 4)) % 4);
        const binary = atob(`${key}${padding}`.replace(/-/gu, '+').replace(/_/gu, '/'));
        result.vapid_key_shape.decoded_bytes = binary.length;
        result.vapid_key_shape.uncompressed_p256_point = binary.length === 65 && binary.charCodeAt(0) === 4;
      }
    } catch (error) {
      result.vapid_key_shape.decode_error = errorDetailsInPage(error);
    }
    return result;
  }, { key: publicKey, label: stage });
  return result;
}
async function directSubscribeProbe(page, publicKey) {
  return page.evaluate(async (key) => {
    const errorDetailsInPage = (error) => ({
      name: String(error?.name || 'Error'),
      message: String(error?.message || error),
      code: error?.code == null ? null : String(error.code),
    });
    try {
      const padding = '='.repeat((4 - (key.length % 4)) % 4);
      const binary = atob(`${key}${padding}`.replace(/-/gu, '+').replace(/_/gu, '/'));
      const applicationServerKey = Uint8Array.from(binary, (character) => character.charCodeAt(0));
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey });
      return {
        attempted: true,
        outcome: 'subscribed',
        endpoint_present: Boolean(subscription?.endpoint),
        application_server_key_bytes: subscription?.options?.applicationServerKey?.byteLength || 0,
      };
    } catch (error) {
      return { attempted: true, outcome: 'exception', exception: errorDetailsInPage(error) };
    }
  }, publicKey);
}
async function waitForServerAcceptance(notificationId) {
  const deadline = Date.now() + STAGE_TIMEOUT_MS;
  let latestOutput = '';
  while (Date.now() < deadline) {
    latestOutput = runLinkedSql(`
      select
        'qa_server_response_found=true' as found,
        'qa_server_accepted=' || (coalesce((content::jsonb ->> 'provider_accepted')::integer, 0) > 0)::text as accepted,
        'qa_provider_accepted=' || coalesce(content::jsonb ->> 'provider_accepted', '0') as provider_count,
        'qa_outcome=' || coalesce(content::jsonb ->> 'outcome', 'unknown') as outcome
      from net._http_response
      where created >= now() - interval '5 minutes'
        and status_code = 200
        and content is not null
        and content::jsonb ->> 'notification_id' = ${sqlString(notificationId)}
      order by created desc
      limit 1;
    `, `push-server-readback-${notificationId}`);
    if (readBooleanMarker(latestOutput, 'qa_server_accepted')) {
      return {
        accepted: true,
        provider_accepted: Number(readTextMarker(latestOutput, 'qa_provider_accepted')) || 0,
        outcome: readTextMarker(latestOutput, 'qa_outcome') || 'unknown',
        server_readback: latestOutput.trim(),
      };
    }
    if (readBooleanMarker(latestOutput, 'qa_server_response_found')) {
      throw new Error(`Push provider did not accept notification_id ${notificationId}: ${readTextMarker(latestOutput, 'qa_outcome') || 'unknown'}.`);
    }
    await delay(750);
  }
  throw new Error(`Timed out waiting for the Edge response for notification_id ${notificationId}.`);
}
function serverSubscriptionReadback(session, endpoint) {
  const output = runLinkedSql(`
    select 'qa_subscription_saved=' || exists (
      select 1
      from public.ll_notification_subscriptions
      where user_id = ${sqlString(session.user.id)}::uuid
        and endpoint = ${sqlString(endpoint)}
        and enabled = true
    )::text as server_readback;
  `, 'push-subscription-readback');
  return { subscription_saved: readBooleanMarker(output, 'qa_subscription_saved'), server_readback: output.trim() };
}
async function launchBrowserForCdp(executablePath, profileDir) {
  const port = 9300 + Math.floor(Math.random() * 500);
  const processHandle = spawn(executablePath, [
    `--remote-debugging-port=${port}`,
    '--remote-debugging-address=127.0.0.1',
    `--user-data-dir=${profileDir}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--start-maximized',
    'about:blank',
  ], { stdio: 'ignore', windowsHide: false });
  const endpoint = `http://127.0.0.1:${port}`;
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(`${endpoint}/json/version`);
      if (response.ok) {
        const cdpVersion = await response.json();
        return { browser: await chromium.connectOverCDP(endpoint), processHandle, cdpVersion, endpoint };
      }
    } catch { /* Browser is still starting. */ }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  processHandle.kill();
  throw new Error('The requested browser did not open a CDP endpoint in time.');
}
function browserMatchesTarget(target, cdpProduct, userAgent) {
  const evidence = `${cdpProduct || ''}\n${userAgent || ''}`;
  return target === 'whale' ? /whale/iu.test(evidence) : /(?:chrome|chromium)/iu.test(evidence) && !/whale/iu.test(evidence);
}
async function signInSession() {
  const supabaseUrl = envValue('LOGISTICS_SUPABASE_URL', 'VITE_SUPABASE_URL');
  const anonKey = envValue('LOGISTICS_SUPABASE_ANON_KEY', 'VITE_SUPABASE_ANON_KEY');
  const email = envValue('LOGISTICS_SUPABASE_EMAIL', 'LOGISTICS_SUPABASE_AUTH_EMAIL');
  const password = envValue('LOGISTICS_SUPABASE_PASSWORD', 'LOGISTICS_SUPABASE_AUTH_PASSWORD');
  if (!supabaseUrl || !anonKey || !email || !password) throw new Error('Live login credentials are unavailable.');
  const response = await fetch(`${supabaseUrl.replace(/\/$/u, '')}/auth/v1/token?grant_type=password`, {
    method: 'POST', headers: { apikey: anonKey, 'content-type': 'application/json' }, body: JSON.stringify({ email, password }),
  });
  const session = await response.json().catch(() => null);
  if (!response.ok || !session?.access_token || !session?.user?.id) throw new Error(`Supabase login failed (${response.status}).`);
  if (!session.expires_at && session.expires_in) session.expires_at = Math.round(Date.now() / 1000) + Number(session.expires_in);
  return session;
}
async function installServiceWorkerStageListener(page, probeId) {
  await page.evaluate((id) => {
    window.__gate6SystemPushStages = [];
    navigator.serviceWorker.addEventListener('message', (event) => {
      const data = event.data;
      if (data?.type === 'logistics-push-stage' && typeof data.notification_id === 'string') {
        window.__gate6SystemPushStages.push({ ...data, gate6_system_push_probe: id });
      }
    });
  }, probeId);
}
async function waitForWorkerStage(page, probeId, notificationId, expectedStage) {
  const result = await page.waitForFunction(({ id, expectedNotificationId, expectedStageName }) => (
    Array.isArray(window.__gate6SystemPushStages)
      && window.__gate6SystemPushStages.find((event) => event.gate6_system_push_probe === id
        && event.notification_id === expectedNotificationId
        && (event.stage === expectedStageName || event.stage === 'failed'))
  ), { id: probeId, expectedNotificationId: notificationId, expectedStageName: expectedStage }, { timeout: STAGE_TIMEOUT_MS });
  return result.jsonValue();
}
function osDisplayVerdict() {
  if (process.platform === 'darwin') return 'not_verified';
  return 'not_verified';
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const executablePath = browserExecutablePath(options);
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const runStamp = stamp();
  const reportPath = path.join(OUT_DIR, `system-push-live-smoke-${runStamp}.json`);
  const pageScreenshot = path.join(OUT_DIR, `system-push-live-smoke-${runStamp}-page.png`);
  const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gate6-system-push-cleanup-'));
  const session = await signInSession();
  const origin = new URL(BASE_URL).origin;
  const targetUrl = `${BASE_URL}${ROUTE}&cb=${encodeURIComponent(runStamp)}`;
  const qaPrefix = `qa-system-push:${runStamp}`;
  const probeId = `gate6-system-push:${runStamp}`;
  const report = {
    ok: false,
    pipeline_ok: false,
    actual_system_notification_success: false,
    generated_at: new Date().toISOString(),
    live_url: targetUrl,
    auth_user_id: session.user.id,
    auth_email: String(session.user.email || '').replace(/^(.{2}).*(@.*)$/u, '$1***$2'),
    browser: { target: options.browser, executable_path: executablePath, permission_mode: options.permissionMode },
    checks: {},
    notifications: [],
    screenshots: [path.relative(ROOT, pageScreenshot).replace(/\\/gu, '/')],
    errors: [],
  };
  let context;
  let browser;
  let browserProcess;
  let page;
  let qaEndpoint = '';
  try {
    report.push_runtime_config = await fetchPushRuntimeConfig(session);
    if (!report.push_runtime_config.ok) throw new Error(`Push runtime config request failed (${report.push_runtime_config.http_status}).`);
    if (!report.push_runtime_config.public_key_shape.valid_for_push_subscribe) {
      throw new Error('Push runtime config returned a public key that is not an uncompressed P-256 VAPID key.');
    }
    const launched = await launchBrowserForCdp(executablePath, profileDir);
    browser = launched.browser;
    browserProcess = launched.processHandle;
    context = browser.contexts()[0];
    if (!context) throw new Error('The browser did not provide a default context.');
    await context.grantPermissions(['notifications'], { origin });
    const pages = context.pages();
    page = pages[0] || await context.newPage();
    await context.addInitScript((authSession) => {
      sessionStorage.setItem('sb-iota-auth-token', JSON.stringify(authSession));
      sessionStorage.setItem('logistics_preview_auth', JSON.stringify({ email: authSession.user.email }));
      localStorage.setItem('logisticsDashboardReadMode', 'primary-safe');
    }, session);
    page.on('pageerror', (error) => report.errors.push(`page: ${error.message}`));
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    const userAgent = await page.evaluate(() => navigator.userAgent);
    report.browser.cdp_product = String(launched.cdpVersion.Browser || '');
    report.browser.cdp_user_agent = String(launched.cdpVersion['User-Agent'] || '');
    report.browser.page_user_agent = userAgent;
    report.browser.cdp_endpoint = launched.endpoint;
    report.checks.target_browser_verified = browserMatchesTarget(options.browser, report.browser.cdp_product, userAgent);
    if (!report.checks.target_browser_verified) throw new Error(`CDP product/UA does not match --browser=${options.browser}.`);
    await page.getByTestId('logistics-task-board').waitFor({ state: 'visible', timeout: 45_000 });
    await page.getByTestId('logistics-notification-button').click();
    const toggle = page.getByTestId('logistics-windows-push-toggle');
    await toggle.waitFor({ state: 'visible', timeout: 15_000 });
    await page.waitForFunction(() => {
      const button = document.querySelector('[data-testid="logistics-windows-push-toggle"]');
      return button && !button.disabled && !/preparing|processing|준비 중|처리 중/iu.test(button.textContent || '');
    }, null, { timeout: 30_000 });
    await installServiceWorkerStageListener(page, probeId);
    report.browser_push_diagnostics = [
      await collectBrowserPushDiagnostics(page, report.push_runtime_config.public_key, 'panel_prepared'),
    ];
    if ((await toggle.innerText()).trim() === '끄기') await toggle.click();
    await page.waitForFunction(() => document.querySelector('[data-testid="logistics-windows-push-toggle"]')?.textContent?.trim() === '켜기', null, { timeout: 15_000 });
    report.browser_push_diagnostics.push(await collectBrowserPushDiagnostics(page, report.push_runtime_config.public_key, 'before_subscribe'));
    await toggle.click();
    await page.waitForFunction(() => Notification.permission === 'granted', null, { timeout: 30_000 });
    report.checks.permission_granted = await page.evaluate(() => Notification.permission === 'granted');
    await page.waitForFunction(() => {
      const button = document.querySelector('[data-testid="logistics-windows-push-toggle"]');
      return button && !button.disabled && !/processing|처리 중/iu.test(button.textContent || '');
    }, null, { timeout: STAGE_TIMEOUT_MS });
    report.ui_push_state = await page.evaluate(() => ({
      toggle_text: document.querySelector('[data-testid="logistics-windows-push-toggle"]')?.textContent?.trim() || '',
      message: document.querySelector('[data-testid="logistics-windows-push-message"]')?.textContent?.trim() || '',
      notification_permission: Notification.permission,
    }));
    report.browser_push_diagnostics.push(await collectBrowserPushDiagnostics(page, report.push_runtime_config.public_key, 'after_ui_subscribe'));
    const hasEndpoint = report.browser_push_diagnostics.at(-1)?.existing_subscription?.endpoint_present === true;
    if (!hasEndpoint) {
      report.direct_subscribe_probe = await directSubscribeProbe(page, report.push_runtime_config.public_key);
      report.browser_push_diagnostics.push(await collectBrowserPushDiagnostics(page, report.push_runtime_config.public_key, 'after_direct_subscribe_probe'));
      const directError = report.direct_subscribe_probe?.exception;
      const uiMessage = report.ui_push_state.message || 'no UI error message';
      const directSummary = directError ? `${directError.name}: ${directError.message}` : report.direct_subscribe_probe?.outcome || 'not attempted';
      throw new Error(`The browser did not create a push subscription endpoint. UI: ${uiMessage}. Direct subscribe: ${directSummary}.`);
    }
    qaEndpoint = await page.evaluate(async () => (await (await navigator.serviceWorker.ready).pushManager.getSubscription())?.endpoint || '');
    if (!qaEndpoint) throw new Error('The browser did not create a push subscription endpoint.');
    const subscriptionReadback = serverSubscriptionReadback(session, qaEndpoint);
    report.checks.subscription_saved = subscriptionReadback.subscription_saved;
    report.subscription_server_readback = subscriptionReadback.server_readback;
    if (!report.checks.subscription_saved) throw new Error('Subscription was not found in server readback.');

    for (let index = 1; index <= 3; index += 1) {
      const insertOutput = runLinkedSql(`
        insert into public.ll_notifications (
          notification_type, dedupe_key, title, body, payload,
          recipient_user_id, recipient_email, recipient_name,
          delivery_status, notified_at, created_by
        ) values (
          'system', ${sqlString(`${qaPrefix}:${index}`)},
          ${sqlString(`QA system notification ${index}`)},
          ${sqlString(`Live system notification delivery check ${index}`)},
          '{"route":"work-platform"}'::jsonb,
          ${sqlString(session.user.id)}::uuid,
          ${sqlString(session.user.email)},
          'QA', 'unread', now(), ${sqlString(session.user.id)}::uuid
        ) returning notification_id;
      `, `push-insert-${index}`);
      const notificationId = readReturnedNotificationId(insertOutput, `push-insert-${index}`);
      const checks = {
        notification_id: notificationId,
        server_accepted: false,
        sw_push_received: false,
        show_notification_called: false,
        sw_push_failed: false,
        os_display_confirmed: osDisplayVerdict(),
      };
      const serverResult = await waitForServerAcceptance(notificationId);
      checks.server_accepted = serverResult.accepted;
      checks.provider_accepted = serverResult.provider_accepted;
      checks.provider_outcome = serverResult.outcome;
      checks.server_readback = serverResult.server_readback;
      const received = await waitForWorkerStage(page, probeId, notificationId, 'received');
      if (received.stage === 'failed') {
        checks.sw_push_failed = true;
        report.notifications.push(checks);
        throw new Error(`Service worker reported failed before received for notification_id ${notificationId}.`);
      }
      checks.sw_push_received = true;
      const shown = await waitForWorkerStage(page, probeId, notificationId, 'shown');
      if (shown.stage === 'failed') {
        checks.sw_push_failed = true;
        report.notifications.push(checks);
        throw new Error(`Service worker reported failed for notification_id ${notificationId}.`);
      }
      checks.show_notification_called = true;
      report.notifications.push(checks);
    }
    report.checks.server_accepted = report.notifications.every((item) => item.server_accepted);
    report.checks.sw_push_received = report.notifications.every((item) => item.sw_push_received);
    report.checks.show_notification_called = report.notifications.every((item) => item.show_notification_called);
    report.checks.os_display_confirmed = 'not_verified';
    report.checks.cdp_override = options.permissionMode === 'cdp_override';
    report.actual_system_notification_success = !report.checks.cdp_override
      && report.notifications.every((item) => item.os_display_confirmed === true);
    report.pipeline_ok = report.checks.target_browser_verified
      && report.checks.permission_granted
      && report.checks.subscription_saved
      && report.checks.server_accepted
      && report.checks.sw_push_received
      && report.checks.show_notification_called
      && report.errors.length === 0;
    report.ok = report.actual_system_notification_success;

    if ((await toggle.innerText()).trim() === '끄기') await toggle.click();
    await page.waitForFunction(() => document.querySelector('[data-testid="logistics-windows-push-toggle"]')?.textContent?.trim() === '켜기', null, { timeout: 15_000 });
    report.checks.qa_subscription_removed = true;
  } catch (error) {
    report.errors.push(error?.message || String(error));
  } finally {
    try {
      runLinkedSql(`delete from public.ll_notifications where dedupe_key like ${sqlString(`${qaPrefix}:%`)};`, 'push-cleanup');
      if (qaEndpoint) {
        runLinkedSql(`delete from public.ll_notification_subscriptions where user_id = ${sqlString(session.user.id)}::uuid and endpoint = ${sqlString(qaEndpoint)};`, 'push-subscription-cleanup');
      }
    } catch (error) {
      report.errors.push(`cleanup: ${error?.message || String(error)}`);
      report.ok = false;
    }
    if (page) {
      try { await page.screenshot({ path: pageScreenshot, fullPage: false }); } catch (error) {
        report.errors.push(`screenshot: ${error?.message || String(error)}`);
      }
      try {
        await page.evaluate(async () => {
          const registration = await navigator.serviceWorker.ready;
          const subscription = await registration.pushManager.getSubscription();
          if (subscription) await subscription.unsubscribe();
        });
      } catch { /* Browser profile is disposable; best-effort local cleanup only. */ }
    }
    if (browser) await browser.close().catch(() => null);
    if (browserProcess && !browserProcess.killed) browserProcess.kill();
    try { fs.rmSync(profileDir, { recursive: true, force: true }); } catch { /* QA temp cleanup */ }
    fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  }
  const executableSuccess = report.actual_system_notification_success || (
    options.permissionMode === 'cdp_override' && report.pipeline_ok
  );
  const verdict = report.actual_system_notification_success
    ? 'PASS'
    : (report.pipeline_ok && options.permissionMode === 'cdp_override'
      ? 'PIPELINE PASS (OS NOT VERIFIED)'
      : 'FAIL');
  console.log(`system push live smoke ${verdict}: ${path.relative(ROOT, reportPath)}`);
  if (!executableSuccess) process.exit(1);
}

main().catch((error) => { console.error(error); process.exit(1); });
