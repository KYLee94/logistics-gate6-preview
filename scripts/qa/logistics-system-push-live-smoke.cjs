const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..', '..');
const OUT_DIR = path.join(ROOT, 'qa-artifacts', 'logistics-gate6');
const BASE_URL = 'https://kylee94.github.io/logistics-gate6-preview/';
const ROUTE = '?p=platform/iotaseoul/workspace/logistics';

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
function chromeExecutablePath() {
  return [
    process.env.CHROME_PATH,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  ].filter(Boolean).find((candidate) => fs.existsSync(candidate));
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
}
function captureDesktop(filePath) {
  const escapedPath = filePath.replace(/'/gu, "''");
  const command = [
    'Add-Type -AssemblyName System.Drawing',
    'Add-Type -AssemblyName System.Windows.Forms',
    '$bounds = [System.Windows.Forms.SystemInformation]::VirtualScreen',
    '$bitmap = New-Object System.Drawing.Bitmap $bounds.Width, $bounds.Height',
    '$graphics = [System.Drawing.Graphics]::FromImage($bitmap)',
    '$graphics.CopyFromScreen($bounds.Location, [System.Drawing.Point]::Empty, $bounds.Size)',
    `$bitmap.Save('${escapedPath}', [System.Drawing.Imaging.ImageFormat]::Png)`,
    '$graphics.Dispose()',
    '$bitmap.Dispose()',
  ].join('; ');
  const result = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', command], { encoding: 'utf8' });
  if (result.status !== 0 || !fs.existsSync(filePath)) throw new Error((result.stderr || 'desktop screenshot failed').trim());
}

async function signInSession() {
  const supabaseUrl = envValue('LOGISTICS_SUPABASE_URL', 'VITE_SUPABASE_URL');
  const anonKey = envValue('LOGISTICS_SUPABASE_ANON_KEY', 'VITE_SUPABASE_ANON_KEY');
  const email = envValue('LOGISTICS_SUPABASE_EMAIL', 'LOGISTICS_SUPABASE_AUTH_EMAIL');
  const password = envValue('LOGISTICS_SUPABASE_PASSWORD', 'LOGISTICS_SUPABASE_AUTH_PASSWORD');
  if (!supabaseUrl || !anonKey || !email || !password) throw new Error('실제 로그인 계정 정보가 없습니다.');
  const response = await fetch(`${supabaseUrl.replace(/\/$/u, '')}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: anonKey, 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const session = await response.json().catch(() => null);
  if (!response.ok || !session?.access_token || !session?.user?.id) throw new Error(`Supabase 로그인 실패 (${response.status})`);
  if (!session.expires_at && session.expires_in) session.expires_at = Math.round(Date.now() / 1000) + Number(session.expires_in);
  return session;
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const runStamp = stamp();
  const reportPath = path.join(OUT_DIR, `system-push-live-smoke-${runStamp}.json`);
  const pageScreenshot = path.join(OUT_DIR, `system-push-live-smoke-${runStamp}-page.png`);
  const desktopScreenshots = [0, 1, 2, 3].map((index) => path.join(OUT_DIR, `system-push-live-smoke-${runStamp}-desktop-${index}.png`));
  const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gate6-system-push-'));
  const session = await signInSession();
  const origin = new URL(BASE_URL).origin;
  const targetUrl = `${BASE_URL}${ROUTE}&cb=${encodeURIComponent(runStamp)}`;
  const qaPrefix = `qa-system-push:${runStamp}`;
  const report = {
    ok: false,
    generated_at: new Date().toISOString(),
    live_url: targetUrl,
    auth_user_id: session.user.id,
    auth_email: String(session.user.email || '').replace(/^(.{2}).*(@.*)$/u, '$1***$2'),
    checks: {},
    notification_counts: [],
    screenshots: [pageScreenshot, ...desktopScreenshots].map((filePath) => path.relative(ROOT, filePath).replace(/\\/gu, '/')),
    errors: [],
  };
  let context;
  try {
    context = await chromium.launchPersistentContext(profileDir, {
      headless: false,
      executablePath: chromeExecutablePath(),
      viewport: { width: 1440, height: 900 },
      serviceWorkers: 'allow',
      args: ['--start-maximized'],
    });
    await context.grantPermissions(['notifications'], { origin });
    await context.addInitScript((authSession) => {
      sessionStorage.setItem('sb-iota-auth-token', JSON.stringify(authSession));
      sessionStorage.setItem('logistics_preview_auth', JSON.stringify({ email: authSession.user.email }));
      localStorage.setItem('logisticsDashboardReadMode', 'primary-safe');
    }, session);
    const pages = context.pages();
    const page = pages[0] || await context.newPage();
    page.on('pageerror', (error) => report.errors.push(`page: ${error.message}`));
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.getByTestId('logistics-task-board').waitFor({ state: 'visible', timeout: 45000 });
    await page.getByTestId('logistics-notification-button').click();
    const toggle = page.getByTestId('logistics-windows-push-toggle');
    await toggle.waitFor({ state: 'visible', timeout: 15000 });
    await page.waitForFunction(() => {
      const button = document.querySelector('[data-testid="logistics-windows-push-toggle"]');
      return button && !button.disabled && !/준비 중|처리 중/u.test(button.textContent || '');
    }, null, { timeout: 30000 });
    if ((await toggle.innerText()).trim() === '끄기') await toggle.click();
    await page.waitForFunction(() => document.querySelector('[data-testid="logistics-windows-push-toggle"]')?.textContent?.trim() === '켜기', null, { timeout: 15000 });
    await toggle.click();
    await page.waitForFunction(() => document.querySelector('[data-testid="logistics-windows-push-message"]')?.textContent?.includes('시스템 알림을 켰습니다.'), null, { timeout: 30000 });
    report.checks.permission_granted = await page.evaluate(() => Notification.permission === 'granted');
    report.checks.subscription_saved = await page.evaluate(async () => Boolean((await navigator.serviceWorker.ready).pushManager && await (await navigator.serviceWorker.ready).pushManager.getSubscription()));
    await page.waitForTimeout(900);
    report.notification_counts.push(await page.evaluate(async () => (await (await navigator.serviceWorker.ready).getNotifications()).length));
    captureDesktop(desktopScreenshots[0]);

    for (let index = 1; index <= 3; index += 1) {
      runLinkedSql(`
        insert into public.ll_notifications (
          notification_type, dedupe_key, title, body, payload,
          recipient_user_id, recipient_email, recipient_name,
          delivery_status, notified_at, created_by
        ) values (
          'system', ${sqlString(`${qaPrefix}:${index}`)},
          ${sqlString(`QA 시스템 알림 ${index}`)},
          ${sqlString(`시스템 알림 실제 전송 확인 ${index}`)},
          '{"route":"work-platform"}'::jsonb,
          ${sqlString(session.user.id)}::uuid,
          ${sqlString(session.user.email)},
          'QA', 'unread', now(), ${sqlString(session.user.id)}::uuid
        );
      `, `push-insert-${index}`);
      await page.waitForTimeout(2500);
      report.notification_counts.push(await page.evaluate(async () => (await (await navigator.serviceWorker.ready).getNotifications()).length));
      captureDesktop(desktopScreenshots[index]);
    }
    await page.screenshot({ path: pageScreenshot, fullPage: false });
    report.checks.setup_notification_visible_to_browser = report.notification_counts[0] >= 1;
    report.checks.three_pushes_visible_to_browser = report.notification_counts.slice(1).every((count, index) => count >= index + 2);
    report.checks.desktop_screenshots_written = desktopScreenshots.every((filePath) => fs.existsSync(filePath) && fs.statSync(filePath).size > 10_000);

    if ((await toggle.innerText()).trim() === '끄기') {
      await toggle.click();
      await page.waitForFunction(() => document.querySelector('[data-testid="logistics-windows-push-message"]')?.textContent?.includes('시스템 알림을 껐습니다.'), null, { timeout: 15000 });
    }
    report.checks.qa_subscription_removed = (await toggle.innerText()).trim() === '켜기';
    report.ok = Object.values(report.checks).every(Boolean) && report.errors.length === 0;
  } catch (error) {
    report.errors.push(error?.message || String(error));
  } finally {
    try {
      runLinkedSql(`delete from public.ll_notifications where dedupe_key like ${sqlString(`${qaPrefix}:%`)};`, 'push-cleanup');
    } catch (error) {
      report.errors.push(`cleanup: ${error?.message || String(error)}`);
      report.ok = false;
    }
    if (context) await context.close();
    try { fs.rmSync(profileDir, { recursive: true, force: true }); } catch { /* isolated temp profile */ }
    fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  }
  console.log(`system push live smoke ${report.ok ? 'PASS' : 'FAIL'}: ${path.relative(ROOT, reportPath)}`);
  if (!report.ok) process.exit(1);
}

main().catch((error) => { console.error(error); process.exit(1); });
