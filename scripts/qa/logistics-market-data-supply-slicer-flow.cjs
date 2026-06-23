const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..', '..');
const OUT_DIR = path.join(ROOT, 'qa-artifacts', 'logistics-gate6');
const DEFAULT_BASE_URL = 'https://kylee94.github.io/logistics-gate6-preview/';

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

const fileEnv = {
  ...readEnvFile(path.join(ROOT, '.env')),
  ...readEnvFile(path.join(ROOT, '.env.local')),
};

function envValue(...keys) {
  for (const key of keys) {
    if (process.env[key]) return process.env[key];
    if (fileEnv[key]) return fileEnv[key];
  }
  return '';
}

function argValue(name, fallback = '') {
  const eqPrefix = `--${name}=`;
  const eqArg = process.argv.find((item) => item.startsWith(eqPrefix));
  if (eqArg) return eqArg.slice(eqPrefix.length);
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? fallback : (process.argv[index + 1] || fallback);
}

function hasFlag(name) {
  return process.argv.includes(`--${name}`);
}

function timestampForFile() {
  return new Date().toISOString().replace(/[-:]/gu, '').replace(/\./u, '-').replace('T', '-');
}

function joinUrl(baseUrl, route) {
  const normalizedBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  const url = new URL(route.replace(/^\/+/u, ''), normalizedBase);
  if (hasFlag('cache-bust')) url.searchParams.set('qa_cache_bust', timestampForFile());
  return url.toString();
}

function chromeExecutablePath() {
  return [
    process.env.CHROME_PATH,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  ].filter(Boolean).find((candidate) => fs.existsSync(candidate)) || undefined;
}

async function signInSession() {
  const supabaseUrl = envValue('LOGISTICS_SUPABASE_URL', 'VITE_SUPABASE_URL');
  const anonKey = envValue('LOGISTICS_SUPABASE_ANON_KEY', 'VITE_SUPABASE_ANON_KEY');
  const accessToken = envValue('LOGISTICS_SUPABASE_ACCESS_TOKEN');
  if (supabaseUrl && anonKey && accessToken) {
    const response = await fetch(`${supabaseUrl.replace(/\/$/u, '')}/auth/v1/user`, {
      headers: { apikey: anonKey, authorization: `Bearer ${accessToken}` },
    });
    const user = await response.json().catch(() => null);
    if (!response.ok || !user?.id) throw new Error(`Supabase access token validation failed (${response.status}).`);
    return {
      session: {
        access_token: accessToken,
        token_type: 'bearer',
        expires_in: 3600,
        expires_at: Math.round(Date.now() / 1000) + 3600,
        refresh_token: '',
        user,
      },
      source: 'LOGISTICS_SUPABASE_ACCESS_TOKEN',
    };
  }
  const email = envValue('LOGISTICS_SUPABASE_EMAIL', 'LOGISTICS_SUPABASE_AUTH_EMAIL');
  const password = envValue('LOGISTICS_SUPABASE_PASSWORD', 'LOGISTICS_SUPABASE_AUTH_PASSWORD');
  if (!supabaseUrl || !anonKey || !email || !password) {
    throw new Error('Set LOGISTICS_SUPABASE_ACCESS_TOKEN, or set LOGISTICS_SUPABASE_EMAIL and LOGISTICS_SUPABASE_PASSWORD.');
  }
  const response = await fetch(`${supabaseUrl.replace(/\/$/u, '')}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: anonKey, 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const session = await response.json().catch(() => null);
  if (!response.ok || !session?.access_token) throw new Error(`Supabase Auth login failed (${response.status}).`);
  if (!session.expires_at && session.expires_in) session.expires_at = Math.round(Date.now() / 1000) + Number(session.expires_in);
  return { session, source: 'password_grant' };
}

async function collectSupplyState(page) {
  return page.evaluate(() => {
    const hashText = (value) => {
      let hash = 0;
      for (let index = 0; index < value.length; index += 1) hash = ((hash << 5) - hash + value.charCodeAt(index)) | 0;
      return String(hash);
    };
    const isVisible = (el) => {
      const style = window.getComputedStyle(el);
      return style.display !== 'none'
        && style.visibility !== 'hidden'
        && Number(style.opacity || 1) !== 0
        && el.getClientRects().length > 0;
    };
    const chartSignature = Array.from(document.querySelectorAll('[data-chart-role]'))
      .map((node) => {
        const text = (node.textContent || '').replace(/\s+/gu, ' ').trim();
        const shapes = Array.from(node.querySelectorAll('rect,circle,line,path,polyline,polygon,text,div,button'))
          .slice(0, 1600)
          .map((el) => {
            const style = el.getAttribute('style') || '';
            return [
              el.tagName.toLowerCase(),
              el.getAttribute('x') || '',
              el.getAttribute('y') || '',
              el.getAttribute('width') || '',
              el.getAttribute('height') || '',
              el.getAttribute('cx') || '',
              el.getAttribute('cy') || '',
              el.getAttribute('r') || '',
              el.getAttribute('d') || '',
              el.getAttribute('points') || '',
              el.getAttribute('fill') || '',
              el.getAttribute('stroke') || '',
              el.getAttribute('opacity') || '',
              style,
              (el.textContent || '').replace(/\s+/gu, ' ').trim(),
            ].join(':');
          })
          .join('|');
        return `${text}::${shapes}`;
      })
      .join('||');
    const visibleErrorSamples = Array.from(document.querySelectorAll('[role="alert"],[data-error],[data-qa-error],.logistics-error,.error'))
      .filter(isVisible)
      .map((el) => (el.textContent || '').replace(/\s+/gu, ' ').trim())
      .filter((text) => /failed|error|blocked|오류|실패/iu.test(text))
      .slice(0, 10);
    const tableRows = Array.from(document.querySelectorAll('table tbody tr'))
      .map((row) => (row.textContent || '').replace(/\s+/gu, ' ').trim())
      .filter(Boolean);
    const maps = Array.from(document.querySelectorAll('[data-map-provider]')).map((el, index) => ({
      index,
      provider: el.getAttribute('data-map-provider') || '',
      mode: el.getAttribute('data-map-mode') || '',
      selected_region: el.getAttribute('data-map-selected-region') || '',
      region_cluster_count: Number(el.getAttribute('data-map-region-cluster-count') || 0),
      point_count: Number(el.getAttribute('data-map-point-count') || 0),
      native_marker_count: Number(el.getAttribute('data-map-native-marker-count') || 0),
      coordinate_count: Number(el.getAttribute('data-map-coordinate-count') || 0),
      fallback_count: Number(el.getAttribute('data-map-fallback-count') || 0),
      naver_ready: el.getAttribute('data-naver-map-ready') === 'true',
      osm_ready: el.getAttribute('data-osm-map-ready') === 'true',
      label_text: (el.textContent || '').replace(/\s+/gu, ' ').trim().slice(0, 500),
    }));
    const buttons = Array.from(document.querySelectorAll('[data-supply-range-slicer="true"] button'))
      .map((button, index) => ({
        index,
        text: (button.textContent || '').replace(/\s+/gu, ' ').trim(),
        title: button.getAttribute('title') || '',
        disabled: button.disabled,
      }));
    const signature = [
      tableRows.join('|'),
      chartSignature,
      maps.map((item) => `${item.provider}:${item.mode}:${item.region_cluster_count}:${item.point_count}:${item.native_marker_count}:${item.selected_region}:${item.label_text}`).join('|'),
    ].join('::');
    return {
      button_count: buttons.length,
      buttons,
      table_row_count: tableRows.length,
      table_hash: hashText(tableRows.join('|')),
      chart_count: document.querySelectorAll('[data-chart-role]').length,
      chart_visual_count: document.querySelectorAll('[data-chart-role] rect, [data-chart-role] circle, [data-chart-role] polyline, [data-chart-role] [style*="width:"]').length,
      chart_hash: hashText(chartSignature),
      maps,
      signature_hash: hashText(signature),
      body_has_loading: /loading|불러오는|loading/iu.test(document.body?.innerText || ''),
      body_has_error: visibleErrorSamples.length > 0,
      visible_error_samples: visibleErrorSamples,
    };
  });
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const stamp = timestampForFile();
  const baseUrl = argValue('base-url', DEFAULT_BASE_URL);
  const targetIndexArg = Number(argValue('target-index', '0'));
  const auth = await signInSession();
  const email = auth.session.user?.email || envValue('LOGISTICS_BROWSER_UI_EMAIL') || 'kylee@igisam.com';
  const report = {
    ok: false,
    generated_at: new Date().toISOString(),
    script: 'qa:market-data:supply-slicer-flow',
    base_url: baseUrl,
    auth_source: auth.source,
    route: 'market-data/supply-pipeline',
    checks: {},
    screenshots: [],
    errors: [],
    warnings: [],
  };
  let browser;
  try {
    browser = await chromium.launch({ headless: !hasFlag('headed'), executablePath: chromeExecutablePath() });
    const context = await browser.newContext({ viewport: { width: 1440, height: 1100 }, serviceWorkers: 'block' });
    await context.addInitScript(({ session, email: injectedEmail }) => {
      sessionStorage.setItem('sb-iota-auth-token', JSON.stringify(session));
      sessionStorage.setItem('logistics_preview_auth', JSON.stringify({ email: injectedEmail }));
      localStorage.setItem('logisticsDashboardReadMode', 'primary-safe');
    }, { session: auth.session, email });
    const page = await context.newPage();
    page.on('pageerror', (error) => report.errors.push(error?.message || String(error)));
    page.on('console', (message) => {
      if (message.type() === 'error' && !/favicon/iu.test(message.text())) report.warnings.push(message.text().slice(0, 400));
    });
    await page.goto(joinUrl(baseUrl, report.route), { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForFunction(() => /Market\s*Data/iu.test(document.body?.innerText || ''), undefined, { timeout: 60000 });
    await page.waitForFunction(() => document.querySelectorAll('[data-supply-range-slicer="true"] button').length >= 2, undefined, { timeout: 90000 });
    await page.waitForFunction(() => document.querySelectorAll('table tbody tr').length > 0, undefined, { timeout: 90000 });
    const before = await collectSupplyState(page);
    const beforeShot = path.join(OUT_DIR, `supply-period-slicer-before-${stamp}.png`);
    await page.screenshot({ path: beforeShot, fullPage: false });
    report.screenshots.push(beforeShot);
    const targetIndex = Number.isFinite(targetIndexArg) && targetIndexArg >= 0
      ? Math.min(Math.floor(targetIndexArg), before.button_count - 1)
      : 0;
    const targetButton = page.locator('[data-supply-range-slicer="true"] button').nth(targetIndex);
    report.clicked_button = before.buttons[targetIndex] || { index: targetIndex };
    await targetButton.click({ timeout: 20000 });
    await page.waitForFunction((previousHash) => {
      const hashText = (value) => {
        let hash = 0;
        for (let index = 0; index < value.length; index += 1) hash = ((hash << 5) - hash + value.charCodeAt(index)) | 0;
        return String(hash);
      };
      const chartSignature = Array.from(document.querySelectorAll('[data-chart-role]'))
        .map((node) => {
          const text = node.textContent || '';
          const shapes = Array.from(node.querySelectorAll('rect,circle,line,path,polyline,polygon,text,div,button'))
            .slice(0, 1600)
            .map((el) => [
              el.tagName.toLowerCase(),
              el.getAttribute('x') || '',
              el.getAttribute('y') || '',
              el.getAttribute('width') || '',
              el.getAttribute('height') || '',
              el.getAttribute('cx') || '',
              el.getAttribute('cy') || '',
              el.getAttribute('r') || '',
              el.getAttribute('d') || '',
              el.getAttribute('points') || '',
              el.getAttribute('fill') || '',
              el.getAttribute('stroke') || '',
              el.getAttribute('opacity') || '',
              el.getAttribute('style') || '',
              el.textContent || '',
            ].join(':'))
            .join('|');
          return `${text}::${shapes}`;
        })
        .join('||');
      const tableRows = Array.from(document.querySelectorAll('table tbody tr')).map((row) => row.textContent || '').join('|');
      const maps = Array.from(document.querySelectorAll('[data-map-provider]'))
        .map((el) => `${el.getAttribute('data-map-provider')}:${el.getAttribute('data-map-mode')}:${el.getAttribute('data-map-region-cluster-count')}:${el.getAttribute('data-map-point-count')}:${el.getAttribute('data-map-native-marker-count')}:${el.getAttribute('data-map-selected-region')}:${(el.textContent || '').replace(/\s+/gu, ' ').trim().slice(0, 500)}`)
        .join('|');
      return hashText(`${tableRows}::${chartSignature}::${maps}`) !== previousHash;
    }, before.signature_hash, { timeout: 30000 }).catch(() => null);
    await page.waitForFunction(() => {
      const visualCount = document.querySelectorAll('[data-chart-role="supply-area"] rect, [data-chart-role="supply-area"] path, [data-chart-role="supply-area"] polyline, [data-chart-role="supply-area"] circle').length;
      return visualCount > 0;
    }, undefined, { timeout: 60000 }).catch(() => null);
    await page.waitForFunction(() => {
      const maps = Array.from(document.querySelectorAll('[data-map-provider]'));
      return maps.length > 0 && maps.every((el) => {
        const provider = el.getAttribute('data-map-provider') || '';
        const regionClusters = Number(el.getAttribute('data-map-region-cluster-count') || 0);
        const pointCount = Number(el.getAttribute('data-map-point-count') || 0);
        return ['naver', 'osm', 'fallback'].includes(provider) && (regionClusters > 0 || pointCount > 0);
      });
    }, undefined, { timeout: 60000 }).catch(() => null);
    const after = await collectSupplyState(page);
    const afterShot = path.join(OUT_DIR, `supply-period-slicer-after-${stamp}.png`);
    await page.screenshot({ path: afterShot, fullPage: false });
    report.screenshots.push(afterShot);
    report.before = before;
    report.after = after;
    report.checks.slicer_present = before.button_count >= 2;
    report.checks.button_clicked = Boolean(report.clicked_button);
    report.checks.table_changed = before.table_hash !== after.table_hash || before.table_row_count !== after.table_row_count;
    report.checks.chart_changed = before.chart_hash !== after.chart_hash || before.chart_visual_count !== after.chart_visual_count;
    report.checks.map_changed = JSON.stringify(before.maps) !== JSON.stringify(after.maps);
    report.checks.post_filter_has_rows = after.table_row_count > 0;
    report.checks.post_filter_has_chart = after.chart_count > 0 && after.chart_visual_count > 0;
    report.checks.post_filter_has_map = after.maps.length > 0 && after.maps.every((item) => (
      ['naver', 'osm', 'fallback'].includes(item.provider)
      && ['regions', 'points'].includes(item.mode)
      && item.coordinate_count >= Math.max(item.point_count, item.region_cluster_count)
      && item.fallback_count === 0
    ));
    report.checks.no_error_after_filter = !after.body_has_error;
    report.ok = report.checks.slicer_present
      && report.checks.button_clicked
      && (report.checks.table_changed || report.checks.chart_changed || report.checks.map_changed)
      && report.checks.post_filter_has_rows
      && report.checks.post_filter_has_chart
      && report.checks.post_filter_has_map
      && report.checks.no_error_after_filter
      && report.errors.length === 0;
    await context.close();
  } catch (error) {
    report.errors.push(error?.stack || error?.message || String(error));
  } finally {
    if (browser) await browser.close().catch(() => null);
  }
  const outJson = path.join(OUT_DIR, `supply-period-slicer-flow-${stamp}.json`);
  const latestJson = path.join(OUT_DIR, 'supply-period-slicer-flow-latest.json');
  fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  fs.writeFileSync(latestJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(`supply period slicer flow ${report.ok ? 'PASS' : 'FAIL'}: ${path.relative(ROOT, outJson).replace(/\\/gu, '/')}`);
  if (!report.ok) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error?.stack || error?.message || error);
  process.exit(1);
});
