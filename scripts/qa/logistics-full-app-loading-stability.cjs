const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..', '..');
const OUT_DIR = path.join(ROOT, 'qa-artifacts', 'logistics-gate6');
const DEFAULT_BASE_URL = 'https://kylee94.github.io/logistics-gate6-preview/';
const DEFAULT_IDLE_MS = 120_000;
const INTERNAL_TOKEN_PATTERN = /\bll_|source_row_id|source_file_id|source_sheet_id|natural_key|row_hash|payload|\bPNU\b|\bpnu\b|asset_[a-z0-9_]+|tenant_brn_/iu;
const BROKEN_TEXT_PATTERN = /\?{4,}/u;
const AUTH_SETUP_PATTERN = /auth-setup/iu;

const ROUTES = [
  { key: 'integrated-task-board', route: 'work-platform', selector: '[data-testid="logistics-task-board"]', minText: 300 },
  { key: 'home', route: 'home', minText: 600 },
  { key: 'asset', route: 'asset', minText: 600 },
  { key: 'company', route: 'company', minText: 600 },
  { key: 'investment-index', route: 'investment-index', minText: 500 },
  { key: 'asset-spec', route: 'asset-spec', minText: 500 },
  { key: 'analysis-tools', route: 'analysis-tools', minText: 300 },
  { key: 'pivot-table', route: 'pivot-table', minText: 300 },
  { key: 'data-quality', route: 'data-quality', minText: 300 },
  { key: 'market-overview', route: 'market-data/overview', selector: '[data-testid="market-data-dashboard"]', minText: 600 },
  { key: 'market-lease', route: 'market-data/lease-market', selector: '[data-testid="market-data-dashboard"]', minText: 600 },
  { key: 'market-supply', route: 'market-data/supply-pipeline', selector: '[data-testid="market-data-dashboard"]', minText: 600 },
  { key: 'market-transactions', route: 'market-data/transactions', selector: '[data-testid="market-data-dashboard"]', minText: 600 },
  { key: 'market-source', route: 'market-data/source-update', selector: '[data-testid="market-data-dashboard"]', minText: 500 },
  { key: 'data-management-asset', route: 'data-management/asset-data', selector: '[data-data-management-redesign="true"]', minText: 500 },
  { key: 'data-management-investment', route: 'data-management/investment-data', selector: '[data-data-management-redesign="true"]', minText: 500 },
  { key: 'data-management-lease', route: 'data-management/lease-contracts', selector: '[data-data-management-redesign="true"]', minText: 500 },
  { key: 'data-management-managers', route: 'data-management/managers', selector: '[data-data-management-redesign="true"]', minText: 500 },
  { key: 'data-management-quality', route: 'data-management/data-quality', selector: '[data-data-management-redesign="true"]', minText: 300 },
  { key: 'data-management-approval', route: 'data-management/approval', selector: '[data-data-management-approval-dashboard="true"]', minText: 300 },
  { key: 'contract-data', route: 'contract-data', minText: 300 },
  { key: 'pdf-report', route: 'pdf-report', minText: 300 },
];

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

function numberArg(name, fallback) {
  const value = Number(argValue(name, String(fallback)));
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
}

function timestampForFile() {
  return new Date().toISOString().replace(/[-:]/gu, '').replace(/\./u, '-').replace('T', '-');
}

function chromeExecutablePath() {
  return [
    process.env.CHROME_PATH,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  ].filter(Boolean).find((candidate) => fs.existsSync(candidate)) || undefined;
}

function joinUrl(baseUrl, route, stamp) {
  const normalizedBase = String(baseUrl || DEFAULT_BASE_URL).endsWith('/') ? String(baseUrl || DEFAULT_BASE_URL) : `${baseUrl}/`;
  const url = new URL(String(route || '').replace(/^\/+/u, ''), normalizedBase);
  url.searchParams.set('qa_cache_bust', stamp);
  return url.toString();
}

async function navigateInApp(page, baseUrl, route, stamp) {
  const url = joinUrl(baseUrl, route, stamp);
  await page.evaluate((nextUrl) => {
    window.history.pushState(null, '', nextUrl);
    window.dispatchEvent(new PopStateEvent('popstate'));
    window.dispatchEvent(new CustomEvent('logistics-data-refresh', { detail: { path: window.location.pathname } }));
  }, url);
  await page.evaluate(() => new Promise((resolve) => {
    window.requestAnimationFrame(() => window.requestAnimationFrame(resolve));
  }));
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
      email: user.email || envValue('LOGISTICS_BROWSER_UI_EMAIL') || 'kylee@igisam.com',
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
  return { session, email, source: 'password_grant' };
}

function visibleLoadingState() {
  const loadingText = /(\ubd88\ub7ec\uc624\ub294 \uc911|\ub85c\ub529|Loading)/iu;
  const nodes = [...document.body.querySelectorAll('div, span, p, td, th, button')].slice(0, 2500);
  return nodes.some((node) => {
    const text = (node.textContent || '').trim();
    if (!text || text.length > 120 || !loadingText.test(text)) return false;
    if (node.children.length > 2) return false;
    const style = window.getComputedStyle(node);
    if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return false;
    const rect = node.getBoundingClientRect();
    return rect.width > 1 && rect.height > 1;
  });
}

function assessLoadingSamples(samples, options = {}) {
  const regressions = [];
  const lifecycleViolations = [];
  const previousProgress = new Map();
  for (const sample of Array.isArray(samples) ? samples : []) {
    const badges = Array.isArray(sample?.badges) ? sample.badges : [];
    for (const badge of badges) {
      if (Number(sample?.pending || 0) <= 0 || !Number.isFinite(Number(badge.progress))) continue;
      const key = `${Number(sample?.wave || 0)}:${badge.id}`;
      const current = Number(badge.progress);
      const completedUnits = Number(badge.completed_units);
      const totalUnits = Number(badge.total_units);
      const lifecycle = {
        id: badge.id,
        wave: Number(sample?.wave || 0),
        stage: String(badge.stage || ''),
        progress: current,
        completed_units: badge.completed_units,
        total_units: badge.total_units,
      };
      if (!lifecycle.stage || !Number.isInteger(completedUnits) || !Number.isInteger(totalUnits)
        || completedUnits < 0 || totalUnits < 1 || completedUnits > totalUnits) {
        lifecycleViolations.push({ ...lifecycle, reason: 'missing-or-invalid-lifecycle-units' });
      } else if (current !== Math.round((completedUnits / totalUnits) * 100)) {
        lifecycleViolations.push({ ...lifecycle, reason: 'progress-does-not-match-completed-units' });
      }
      if (current >= 100) lifecycleViolations.push({ ...lifecycle, reason: 'pending-at-100' });
      const previous = previousProgress.get(key);
      if (Number.isFinite(previous) && current < previous) {
        regressions.push({ id: badge.id, wave: Number(sample?.wave || 0), from: previous, to: current });
      }
      previousProgress.set(key, current);
    }
  }
  const finalPending = Number(options.finalPending || 0);
  const finalBadges = finalPending === 0 && Array.isArray(options.finalBadges)
    ? options.finalBadges.map((badge) => ({ id: badge.id, progress: badge.progress, reason: 'completion' }))
    : [];
  const retainedBadges = finalBadges.map(({ id, progress }) => ({ id, progress }));
  const unique = (items) => [...new Map(items.map((item) => [JSON.stringify(item), item])).values()];
  const result = {
    sample_count: Array.isArray(samples) ? samples.length : 0,
    regressions: unique(regressions),
    lifecycle_violations: unique(lifecycleViolations),
    badges_without_requests: unique(finalBadges),
    retained_badges: unique(retainedBadges),
    pending_requests_at_timeout: options.settled === false ? finalPending : 0,
  };
  result.ok = result.regressions.length === 0
    && result.lifecycle_violations.length === 0
    && result.badges_without_requests.length === 0
    && result.retained_badges.length === 0
    && result.pending_requests_at_timeout === 0;
  return result;
}

async function installLoadingRequestProbe(context) {
  await context.addInitScript(() => {
    const state = {
      operation_id: '',
      pending: 0,
      started: 0,
      finished: 0,
      failed: 0,
      wave: 0,
      samples: [],
      last_fingerprint: '',
    };
    const trackedUrl = (value) => String(value?.url || value || '').includes('/functions/v1/ll-dashboard-api');
    const visibleBadges = () => [...document.querySelectorAll('[data-loading-progress="true"]')]
      .filter((node) => {
        const style = window.getComputedStyle(node);
        const rect = node.getBoundingClientRect();
        return !node.closest('[aria-hidden="true"]')
          && style.display !== 'none'
          && style.visibility !== 'hidden'
          && Number(style.opacity) !== 0
          && rect.width > 1
          && rect.height > 1;
      })
      .map((node, index) => {
        const match = String(node.textContent || '').match(/(\d{1,3})\s*%/u);
        const numberAttribute = (name) => {
          const value = node.getAttribute(name);
          return value === null || value === '' ? null : Number(value);
        };
        return {
          id: node.getAttribute('data-testid')
            || (node.hasAttribute('data-dashboard-loading-progress') ? 'dashboard-loading-progress' : `loading-progress-${index + 1}`),
          progress: match ? Number(match[1]) : null,
          stage: node.getAttribute('data-loading-stage') || '',
          completed_units: numberAttribute('data-loading-completed-units'),
          total_units: numberAttribute('data-loading-total-units'),
        };
      });
    const capture = (reason) => {
      const badges = visibleBadges();
      const fingerprint = JSON.stringify([state.operation_id, state.pending, state.started, state.finished, state.failed, state.wave, badges]);
      if (fingerprint === state.last_fingerprint) return;
      state.last_fingerprint = fingerprint;
      state.samples.push({
        reason,
        pending: state.pending,
        started: state.started,
        finished: state.finished,
        failed: state.failed,
        wave: state.wave,
        badges,
      });
      if (state.samples.length > 2000) state.samples.shift();
    };
    const requestStarted = () => {
      if (state.pending === 0) state.wave += 1;
      state.pending += 1;
      state.started += 1;
      capture('request-start');
    };
    const requestEnded = (failed = false) => {
      state.pending = Math.max(0, state.pending - 1);
      state.finished += 1;
      if (failed) state.failed += 1;
      capture('request-end');
    };
    const beginOperation = (operationId) => {
      state.operation_id = String(operationId || '');
      state.started = 0;
      state.finished = 0;
      state.failed = 0;
      state.wave = state.pending > 0 ? 1 : 0;
      state.samples = [];
      state.last_fingerprint = '';
      capture('operation-start');
    };
    const snapshot = (reason = 'snapshot') => {
      capture(reason);
      return {
        operation_id: state.operation_id,
        pending: state.pending,
        started: state.started,
        finished: state.finished,
        failed: state.failed,
        wave: state.wave,
        badges: visibleBadges(),
        samples: state.samples.slice(),
      };
    };
    window.__LOGISTICS_LOADING_QA__ = { state, beginOperation, capture, snapshot };

    const nativeFetch = window.fetch.bind(window);
    window.fetch = (...args) => {
      if (!trackedUrl(args[0])) return nativeFetch(...args);
      requestStarted();
      return nativeFetch(...args).then(
        (response) => {
          requestEnded(false);
          return response;
        },
        (error) => {
          requestEnded(true);
          throw error;
        },
      );
    };

    const nativeOpen = window.XMLHttpRequest.prototype.open;
    const nativeSend = window.XMLHttpRequest.prototype.send;
    window.XMLHttpRequest.prototype.open = function open(method, url, ...rest) {
      this.__logisticsLoadingQaTracked = trackedUrl(url);
      return nativeOpen.call(this, method, url, ...rest);
    };
    window.XMLHttpRequest.prototype.send = function send(...args) {
      if (!this.__logisticsLoadingQaTracked) return nativeSend.apply(this, args);
      requestStarted();
      this.addEventListener('loadend', () => requestEnded(this.status === 0), { once: true });
      return nativeSend.apply(this, args);
    };

    const observe = () => {
      if (!document.documentElement) return;
      new MutationObserver(() => capture('dom-mutation')).observe(document.documentElement, {
        attributes: true,
        childList: true,
        characterData: true,
        subtree: true,
      });
      capture('observer-ready');
    };
    if (document.documentElement) observe();
    else window.addEventListener('DOMContentLoaded', observe, { once: true });
  });
}

async function beginLoadingOperation(page, operationId) {
  await page.evaluate((id) => {
    if (!window.__LOGISTICS_LOADING_QA__) throw new Error('Loading request probe is unavailable.');
    window.__LOGISTICS_LOADING_QA__.beginOperation(id);
  }, operationId);
}

async function loadingOperationSnapshot(page, reason) {
  return page.evaluate((captureReason) => {
    if (!window.__LOGISTICS_LOADING_QA__) throw new Error('Loading request probe is unavailable.');
    return window.__LOGISTICS_LOADING_QA__.snapshot(captureReason);
  }, reason);
}

async function waitForRouteReady(page, probe) {
  await page.waitForFunction(({ selector, minText }) => {
    const body = document.body?.innerText || '';
    if (!body || body.length < minText) return false;
    if (/auth-setup/iu.test(window.location.href)) return false;
    if (selector && !document.querySelector(selector)) return false;
    return true;
  }, { selector: probe.selector || '', minText: probe.minText || 300 }, { timeout: 45000 });
  await page.waitForFunction(() => {
    const loadingText = /(\ubd88\ub7ec\uc624\ub294 \uc911|\ub85c\ub529|Loading)/iu;
    const nodes = [...document.body.querySelectorAll('div, span, p, td, th, button')].slice(0, 2500);
    return !nodes.some((node) => {
      const text = (node.textContent || '').trim();
      if (!text || text.length > 120 || !loadingText.test(text)) return false;
      if (node.children.length > 2) return false;
      const style = window.getComputedStyle(node);
      if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return false;
      const rect = node.getBoundingClientRect();
      return rect.width > 1 && rect.height > 1;
    });
  }, undefined, { timeout: 15000 });
  await page.waitForFunction(() => {
    const probeState = window.__LOGISTICS_LOADING_QA__?.snapshot('settle-check');
    return Boolean(probeState && probeState.pending === 0 && probeState.badges.length === 0);
  }, undefined, { timeout: 15000 });
}

async function collectRouteState(page, probe, elapsedMs) {
  const state = await page.evaluate(({ selector, minText }) => {
    const matchContexts = (body, pattern, limit = 8) => {
      const contexts = [];
      const flags = pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`;
      const re = new RegExp(pattern.source, flags);
      for (const match of body.matchAll(re)) {
        const index = match.index || 0;
        contexts.push({
          match: match[0],
          context: body
            .slice(Math.max(0, index - 90), Math.min(body.length, index + 140))
            .replace(/\s+/gu, ' ')
            .trim(),
        });
        if (contexts.length >= limit) break;
      }
      return contexts;
    };
    const internalTokenPattern = /\bll_|source_row_id|source_file_id|source_sheet_id|natural_key|row_hash|payload|\bPNU\b|\bpnu\b|asset_[a-z0-9_]+|tenant_brn_/iu;
    const brokenTextPattern = /\?{4,}/u;
    const hasVisibleLoadingState = () => {
      const loadingText = /(\ubd88\ub7ec\uc624\ub294 \uc911|\ub85c\ub529|Loading)/iu;
      const nodes = [...document.body.querySelectorAll('div, span, p, td, th, button')].slice(0, 2500);
      return nodes.some((node) => {
        const text = (node.textContent || '').trim();
        if (!text || text.length > 120 || !loadingText.test(text)) return false;
        if (node.children.length > 2) return false;
        const style = window.getComputedStyle(node);
        if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return false;
        const rect = node.getBoundingClientRect();
        return rect.width > 1 && rect.height > 1;
      });
    };
    const body = document.body?.innerText || '';
    const tableRows = [...document.querySelectorAll('tbody tr, [role="row"]')].length;
    const charts = [...document.querySelectorAll('svg, canvas, [data-chart-ready="true"], [data-testid*="chart"]')].length;
    const modals = [...document.querySelectorAll('[role="dialog"], [data-testid$="modal"]')].filter((node) => {
      const style = window.getComputedStyle(node);
      const rect = node.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 2 && rect.height > 2;
    }).length;
    return {
      url: window.location.href,
      body_length: body.length,
      selector_present: selector ? Boolean(document.querySelector(selector)) : true,
      loading_visible: hasVisibleLoadingState(),
      auth_setup_visible: /auth-setup/iu.test(window.location.href) || /\uc778\uc99d|login|sign in/iu.test(body.slice(0, 1200)),
      broken_question_marks_visible: brokenTextPattern.test(body),
      broken_question_contexts: matchContexts(body, brokenTextPattern),
      internal_tokens_visible: internalTokenPattern.test(body),
      internal_token_contexts: matchContexts(body, internalTokenPattern),
      min_text_ok: body.length >= minText,
      table_rows: tableRows,
      charts,
      modals,
      excerpt: body.slice(0, 800),
    };
  }, { selector: probe.selector || '', minText: probe.minText || 300 });
  return {
    key: probe.key,
    route: probe.route,
    elapsed_ms: elapsedMs,
    ...state,
    ok: elapsedMs <= 15000
      && state.selector_present
      && !state.loading_visible
      && !state.auth_setup_visible
      && !state.broken_question_marks_visible
      && !state.internal_tokens_visible
      && state.min_text_ok,
  };
}

async function waitForAction(page, action, trigger, timeout = 30000) {
  const responsePromise = page.waitForResponse((response) => (
    response.url().includes('/functions/v1/ll-dashboard-api')
    && response.request().postData()?.includes(`"action":"${action}"`)
  ), { timeout }).catch(() => null);
  await trigger();
  const response = await responsePromise;
  const body = response ? await response.json().catch(() => null) : null;
  const status = response?.status() || null;
  const failureType = !response
    ? 'response-not-observed'
    : ([401, 403].includes(status) ? 'auth' : (status >= 500 ? 'server' : (status >= 400 ? 'client' : (body?.ok === false ? 'application' : ''))));
  return {
    matched: Boolean(response),
    status,
    failure_type: failureType || null,
    ok: Boolean(response) && status < 400 && body?.ok !== false,
  };
}

async function inspectResidualOverlays(page) {
  const overlaySelector = 'div.fixed.inset-0.z-40';
  return page.locator(overlaySelector).evaluateAll((nodes) => nodes
    .filter((node) => {
      const style = window.getComputedStyle(node);
      const rect = node.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity) !== 0 && rect.width > 1 && rect.height > 1;
    })
    .map((node, index) => {
      const panel = node.nextElementSibling;
      const panelTestId = panel?.getAttribute('data-testid') || panel?.querySelector('[data-testid]')?.getAttribute('data-testid') || '';
      const panelRole = panel?.getAttribute('role') || '';
      const panelText = String(panel?.textContent || '').replace(/\s+/gu, ' ').trim();
      const kind = panelTestId === 'logistics-notification-panel'
        ? 'notification-panel-backdrop'
        : (/로그아웃/u.test(panelText) ? 'profile-menu-backdrop' : (panelTestId ? `${panelTestId}-backdrop` : 'fullscreen-click-away-backdrop'));
      return {
        kind: kind,
        index,
        selector: overlaySelector,
        class_name: String(node.className || ''),
        panel_testid: panelTestId,
        panel_role: panelRole,
      };
    }));
}

async function waitForLateOverlayOrQuiet(page, quietMs = 500) {
  const overlaySelector = 'div.fixed.inset-0.z-40';
  const state = await page.evaluate(({ selector, quietWindowMs }) => new Promise((resolve) => {
    let observer;
    let quietTimer;
    const visibleOverlayExists = () => [...document.querySelectorAll(selector)].some((node) => {
      const style = window.getComputedStyle(node);
      const rect = node.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity) !== 0 && rect.width > 1 && rect.height > 1;
    });
    const finish = (nextState) => {
      if (observer) observer.disconnect();
      if (quietTimer) clearTimeout(quietTimer);
      resolve(nextState);
    };
    const inspect = () => {
      if (visibleOverlayExists()) finish('overlay-visible');
    };
    observer = new MutationObserver(inspect);
    observer.observe(document.documentElement, { attributes: true, childList: true, subtree: true });
    quietTimer = setTimeout(() => finish('quiet'), quietWindowMs);
    inspect();
  }), { selector: overlaySelector, quietWindowMs: quietMs });
  return {
    state,
    quiet_ms: quietMs,
    overlays: await inspectResidualOverlays(page),
  };
}

async function dismissResidualOverlays(page) {
  const overlaySelector = 'div.fixed.inset-0.z-40';
  const waitForOverlaysToClose = () => page.waitForFunction((selector) => {
    return ![...document.querySelectorAll(selector)].some((node) => {
      const style = window.getComputedStyle(node);
      const rect = node.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity) !== 0 && rect.width > 1 && rect.height > 1;
    });
  }, overlaySelector, { timeout: 3000 }).then(() => true).catch(() => false);
  const overlaysBefore = await inspectResidualOverlays(page);
  const overlayTypes = [...new Set(overlaysBefore.map((overlay) => overlay.kind))];
  if (overlaysBefore.length === 0) {
    return {
      ok: true,
      visible_before: false,
      escaped: false,
      outside_clicked: false,
      overlay_types: [],
      overlays_before: [],
      remaining_overlays: [],
    };
  }

  await page.keyboard.press('Escape');
  if (await waitForOverlaysToClose()) {
    return {
      ok: true,
      visible_before: true,
      escaped: true,
      outside_clicked: false,
      overlay_types: overlayTypes,
      overlays_before: overlaysBefore,
      remaining_overlays: [],
    };
  }

  await page.mouse.click(12, 12);
  await waitForOverlaysToClose();
  const remainingOverlays = await inspectResidualOverlays(page);
  return {
    ok: remainingOverlays.length === 0,
    visible_before: true,
    escaped: true,
    outside_clicked: true,
    overlay_types: overlayTypes,
    overlays_before: overlaysBefore,
    remaining_overlays: remainingOverlays,
  };
}

async function stabilizeResidualOverlays(page, options = {}) {
  const quietMs = Number(options.quietMs || 500);
  const maxCleanupAttempts = Number(options.maxCleanupAttempts || 4);
  const cleanupAttempts = [];
  const observedOverlayTypes = new Set();
  for (let round = 0; round <= maxCleanupAttempts; round += 1) {
    const observation = await waitForLateOverlayOrQuiet(page, quietMs);
    for (const overlay of observation.overlays) observedOverlayTypes.add(overlay.kind);
    if (observation.state === 'quiet') {
      const remainingOverlays = await inspectResidualOverlays(page);
      for (const overlay of remainingOverlays) observedOverlayTypes.add(overlay.kind);
      return {
        ok: remainingOverlays.length === 0,
        stable: remainingOverlays.length === 0,
        quiet_ms: quietMs,
        cleanup_attempts: cleanupAttempts,
        observed_overlay_types: [...observedOverlayTypes],
        remaining_overlays: remainingOverlays,
      };
    }
    if (round === maxCleanupAttempts) {
      const remainingOverlays = await inspectResidualOverlays(page);
      return {
        ok: false,
        stable: false,
        quiet_ms: quietMs,
        problem: 'overlay stability was not reached',
        cleanup_attempts: cleanupAttempts,
        observed_overlay_types: [...observedOverlayTypes],
        remaining_overlays: remainingOverlays,
      };
    }
    const cleanup = await dismissResidualOverlays(page);
    for (const overlayType of cleanup.overlay_types || []) observedOverlayTypes.add(overlayType);
    cleanupAttempts.push({
      attempt: round + 1,
      detected_overlays: observation.overlays,
      ...cleanup,
    });
    if (!cleanup.ok) {
      return {
        ok: false,
        stable: false,
        quiet_ms: quietMs,
        problem: 'residual overlay could not be closed',
        cleanup_attempts: cleanupAttempts,
        observed_overlay_types: [...observedOverlayTypes],
        remaining_overlays: cleanup.remaining_overlays || [],
      };
    }
  }
  throw new Error('Overlay stabilization ended unexpectedly.');
}

async function clickAfterOverlayRecovery(button, stabilizeOverlays, maxAttempts = 3) {
  const attempts = [];
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const beforeTrial = await stabilizeOverlays();
    if (!beforeTrial.ok) {
      return { ok: false, attempts, problem: 'overlay cleanup failed before actionability check', before_trial: beforeTrial };
    }
    try {
      await button.click({ trial: true, timeout: 3000 });
    } catch (error) {
      const overlays = await inspectResidualOverlays(button.page());
      attempts.push({ attempt, phase: 'trial', overlays, problem: error?.message || String(error) });
      if (!overlays.length) throw error;
      continue;
    }

    const afterTrial = await stabilizeOverlays();
    if (!afterTrial.ok) {
      attempts.push({ attempt, phase: 'after-trial', overlays: afterTrial.remaining_overlays || [], problem: afterTrial.problem || 'overlay cleanup failed' });
      continue;
    }
    try {
      await button.click({ timeout: 5000 });
      return { ok: true, attempts, before_trial: beforeTrial, after_trial: afterTrial };
    } catch (error) {
      const overlays = await inspectResidualOverlays(button.page());
      attempts.push({ attempt, phase: 'click', overlays, problem: error?.message || String(error) });
      if (!overlays.length) throw error;
    }
  }
  return { ok: false, attempts, problem: 'popup trigger remained covered after overlay recovery' };
}

async function checkPopupLifecycle({ button, popup, action, close, stabilizeOverlays }) {
  const overlayCleanup = { open: null, reopen: null, ok: false, observed_overlay_types: [] };
  const cleanupSummary = () => {
    overlayCleanup.ok = Boolean(overlayCleanup.open?.ok && overlayCleanup.reopen?.ok);
    overlayCleanup.observed_overlay_types = [...new Set([
      ...(overlayCleanup.open?.observed_overlay_types || []),
      ...(overlayCleanup.reopen?.observed_overlay_types || []),
    ])];
    return overlayCleanup;
  };
  if (!await button.isVisible().catch(() => false)) {
    return { ok: false, opened: false, closed: false, reopened: false, reclosed: false, problem: 'popup trigger not visible', overlay_cleanup: cleanupSummary() };
  }
  try {
    let firstTrigger = null;
    overlayCleanup.open = await stabilizeOverlays();
    if (!overlayCleanup.open.ok) {
      return { ok: false, opened: false, closed: false, reopened: false, reclosed: false, problem: 'overlay cleanup failed before open', overlay_cleanup: cleanupSummary() };
    }
    const firstAction = await waitForAction(button.page(), action, async () => {
      firstTrigger = await clickAfterOverlayRecovery(button, stabilizeOverlays);
      if (!firstTrigger.ok) throw new Error(firstTrigger.problem);
    });
    overlayCleanup.open.trigger = firstTrigger;
    await popup.waitFor({ state: 'visible', timeout: 15000 });
    const opened = true;
    await close();
    await popup.waitFor({ state: 'hidden', timeout: 15000 });
    const closed = true;
    let secondTrigger = null;
    overlayCleanup.reopen = await stabilizeOverlays();
    if (!overlayCleanup.reopen.ok) {
      return {
        ...firstAction,
        ok: false,
        visible: opened,
        opened,
        closed,
        reopened: false,
        reclosed: false,
        first_action: firstAction,
        problem: 'overlay cleanup failed before reopen',
        overlay_cleanup: cleanupSummary(),
      };
    }
    const secondAction = await waitForAction(button.page(), action, async () => {
      secondTrigger = await clickAfterOverlayRecovery(button, stabilizeOverlays);
      if (!secondTrigger.ok) throw new Error(secondTrigger.problem);
    });
    overlayCleanup.reopen.trigger = secondTrigger;
    await popup.waitFor({ state: 'visible', timeout: 15000 });
    const reopened = true;
    await close();
    await popup.waitFor({ state: 'hidden', timeout: 15000 });
    const reclosed = true;
    return {
      ...firstAction,
      visible: opened,
      opened,
      closed,
      reopened,
      reclosed,
      first_action: firstAction,
      second_action: secondAction,
      overlay_cleanup: cleanupSummary(),
      ok: firstAction.ok && secondAction.ok && opened && closed && reopened && reclosed && overlayCleanup.open.ok && overlayCleanup.reopen.ok,
    };
  } catch (error) {
    return {
      ok: false,
      opened: false,
      closed: false,
      reopened: false,
      reclosed: false,
      problem: error?.message || String(error),
      overlay_cleanup: cleanupSummary(),
    };
  }
}

async function checkSystemModals(page, report) {
  const featureButton = page.getByTestId('logistics-feature-access-button');
  const featurePopup = page.getByTestId('logistics-feature-access-modal');
  const loginButton = page.getByTestId('logistics-login-history-button');
  const loginPopup = page.getByTestId('logistics-login-history-modal');
  const notificationButton = page.getByTestId('logistics-notification-button');
  const notificationPopup = page.getByTestId('logistics-notification-panel');
  const overlayCleanup = {};
  const modalChecks = {};

  modalChecks.feature_access = await checkPopupLifecycle({
    button: featureButton,
    popup: featurePopup,
    action: 'feature-access/get',
    close: () => page.getByTestId('logistics-feature-access-close').click(),
    stabilizeOverlays: () => stabilizeResidualOverlays(page),
  });
  overlayCleanup.feature_access = modalChecks.feature_access.overlay_cleanup;

  modalChecks.login_history = await checkPopupLifecycle({
    button: loginButton,
    popup: loginPopup,
    action: 'auth/login-history/list',
    close: () => page.getByTestId('logistics-login-history-close').click(),
    stabilizeOverlays: () => stabilizeResidualOverlays(page),
  });
  overlayCleanup.login_history = modalChecks.login_history.overlay_cleanup;

  modalChecks.notifications = await checkPopupLifecycle({
    button: notificationButton,
    popup: notificationPopup,
    action: 'notifications/list',
    close: () => notificationPopup
      .locator('xpath=preceding-sibling::div[contains(@class,"fixed") and contains(@class,"inset-0")]')
      .click({ position: { x: 12, y: 12 } }),
    stabilizeOverlays: () => stabilizeResidualOverlays(page),
  });
  overlayCleanup.notifications = modalChecks.notifications.overlay_cleanup;

  report.overlay_cleanup = overlayCleanup;
  report.modal_checks = modalChecks;
}

async function waitForDuration(page, durationMs) {
  const deadline = Date.now() + durationMs;
  await page.waitForFunction((target) => Date.now() >= target, deadline, {
    timeout: durationMs + 10000,
    polling: Math.min(1000, Math.max(50, durationMs)),
  });
}

async function checkIdleReturnAndTabSwitch(page, context, baseUrl, stamp, idleMs) {
  const overview = ROUTES.find((probe) => probe.key === 'market-overview');
  const lease = ROUTES.find((probe) => probe.key === 'market-lease');
  if (!overview || !lease) throw new Error('Market tab probes are not configured.');

  await beginLoadingOperation(page, `${stamp}-idle-prime`);
  await navigateInApp(page, baseUrl, overview.route, `${stamp}-idle-before`);
  await waitForRouteReady(page, overview);
  const primeSnapshot = await loadingOperationSnapshot(page, 'idle-prime-complete');
  const primeProgressAudit = assessLoadingSamples(primeSnapshot.samples, {
    settled: true,
    finalBadges: primeSnapshot.badges,
    finalPending: primeSnapshot.pending,
  });
  const background = await context.newPage();
  try {
    await background.goto('about:blank');
    await background.bringToFront();
    await waitForDuration(background, idleMs);

    await beginLoadingOperation(page, `${stamp}-idle-return`);
    const idleReturnStartedAt = Date.now();
    await page.bringToFront();
    await waitForRouteReady(page, overview);
    const idleReturn = await collectRouteState(page, overview, Date.now() - idleReturnStartedAt);
    const idleSnapshot = await loadingOperationSnapshot(page, 'idle-return-complete');
    idleReturn.progress_audit = assessLoadingSamples(idleSnapshot.samples, {
      settled: true,
      finalBadges: idleSnapshot.badges,
      finalPending: idleSnapshot.pending,
    });
    idleReturn.ok = idleReturn.ok && idleReturn.progress_audit.ok;

    await beginLoadingOperation(page, `${stamp}-tab-reswitch`);
    const tabSwitchStartedAt = Date.now();
    await navigateInApp(page, baseUrl, lease.route, `${stamp}-tab-return`);
    await waitForRouteReady(page, lease);
    const tabSwitch = await collectRouteState(page, lease, Date.now() - tabSwitchStartedAt);
    const tabSnapshot = await loadingOperationSnapshot(page, 'tab-reswitch-complete');
    tabSwitch.progress_audit = assessLoadingSamples(tabSnapshot.samples, {
      settled: true,
      finalBadges: tabSnapshot.badges,
      finalPending: tabSnapshot.pending,
    });
    tabSwitch.ok = tabSwitch.ok && tabSwitch.progress_audit.ok;

    return {
      idle_ms: idleMs,
      prime_progress_audit: primeProgressAudit,
      idle_return: idleReturn,
      tab_reswitch: tabSwitch,
      ok: primeProgressAudit.ok && idleReturn.ok && tabSwitch.ok,
    };
  } finally {
    await background.close().catch(() => {});
  }
}

function edgeAction(response) {
  try {
    return JSON.parse(response.request().postData() || '{}')?.action || 'unknown-action';
  } catch {
    return 'unknown-action';
  }
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const stamp = timestampForFile();
  const outJson = path.join(OUT_DIR, `full-app-loading-stability-${stamp}.json`);
  const latestJson = path.join(OUT_DIR, 'full-app-loading-stability-latest.json');
  const screenshotPath = path.join(OUT_DIR, `full-app-loading-stability-${stamp}.png`);
  const baseUrl = argValue('base-url', DEFAULT_BASE_URL);
  const cycles = numberArg('cycles', 50);
  const idleMs = numberArg('idle-ms', DEFAULT_IDLE_MS);
  const auth = await signInSession();
  const uiEmail = argValue('ui-email', envValue('LOGISTICS_BROWSER_UI_EMAIL') || auth.email || 'kylee@igisam.com');
  const browserSession = { ...auth.session, user: { ...(auth.session.user || {}), email: uiEmail } };
  const report = {
    ok: false,
    generated_at: new Date().toISOString(),
    script: 'qa:full-app-loading-stability',
    base_url: baseUrl,
    auth_source: auth.source,
    ui_email: uiEmail,
    cycles,
    idle_ms: idleMs,
    route_count: ROUTES.length,
    routes: [],
    idle_return: null,
    modal_checks: {},
    overlay_cleanup: {},
    progress_audit: null,
    auth_errors: [],
    server_errors: [],
    errors: [],
    warnings: [],
    screenshot: path.relative(ROOT, screenshotPath).replace(/\\/gu, '/'),
  };
  let browser;
  try {
    browser = await chromium.launch({ headless: true, executablePath: chromeExecutablePath() });
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    await installLoadingRequestProbe(context);
    await context.addInitScript(({ email, session }) => {
      sessionStorage.setItem('sb-iota-auth-token', JSON.stringify(session));
      sessionStorage.setItem('logistics_preview_auth', JSON.stringify({ email }));
      localStorage.setItem('logisticsDashboardReadMode', 'primary-safe');
    }, { email: uiEmail, session: browserSession });
    const page = await context.newPage();
    page.on('pageerror', (error) => report.errors.push(`pageerror: ${error.message}`));
    page.on('console', (message) => {
      if (message.type() === 'error') {
        const text = message.text();
        if (/Error fetching logs: FunctionsFetchError/iu.test(text)) {
          report.warnings.push(`console: ${text.slice(0, 500)}`);
        } else if (/Failed to load resource/iu.test(text)) {
          // The paired response event records the actual URL/status. The console text alone is not actionable.
        } else {
          report.errors.push(`console: ${text.slice(0, 500)}`);
        }
      }
    });
    page.on('response', (response) => {
      if (response.status() === 404) {
        report.warnings.push(`resource 404 while_at=${page.url()} resource=${response.url()}`.slice(0, 1200));
      }
      if (response.url().includes('/functions/v1/ll-dashboard-api') && [401, 403].includes(response.status())) {
        report.auth_errors.push(`edge ${response.status()} action=${edgeAction(response)}`);
      }
      if (response.url().includes('/functions/v1/ll-dashboard-api') && response.status() >= 500) {
        report.server_errors.push(`edge ${response.status()} action=${edgeAction(response)}`);
      }
    });

    // The root route now opens the dedicated three-tab data platform for pilot
    // users. Bootstrap the preserved work-platform URL explicitly when this
    // legacy-surface regression suite begins with the task-board probe.
    await page.goto(joinUrl(baseUrl, ROUTES[0].route, `${stamp}-bootstrap`), { waitUntil: 'domcontentloaded', timeout: 60000 });
    await waitForRouteReady(page, ROUTES[0]);

    for (let cycle = 0; cycle < cycles; cycle += 1) {
      const probe = ROUTES[cycle % ROUTES.length];
      const startedAt = Date.now();
      try {
        await beginLoadingOperation(page, `route-${cycle + 1}-${probe.key}`);
        await navigateInApp(page, baseUrl, probe.route, `${stamp}-${cycle + 1}`);
        await waitForRouteReady(page, probe);
        const row = await collectRouteState(page, probe, Date.now() - startedAt);
        const loadingSnapshot = await loadingOperationSnapshot(page, 'route-complete');
        row.progress_audit = assessLoadingSamples(loadingSnapshot.samples, {
          settled: true,
          finalBadges: loadingSnapshot.badges,
          finalPending: loadingSnapshot.pending,
        });
        row.cycle = cycle + 1;
        row.ok = row.ok && row.progress_audit.ok;
        report.routes.push(row);
      } catch (error) {
        const row = await collectRouteState(page, probe, Date.now() - startedAt).catch(() => ({
          key: probe.key,
          route: probe.route,
          elapsed_ms: Date.now() - startedAt,
          ok: false,
          url: page.url(),
          problem: error?.message || String(error),
        }));
        const loadingSnapshot = await loadingOperationSnapshot(page, 'route-failed').catch(() => ({ samples: [], badges: [] }));
        row.progress_audit = assessLoadingSamples(loadingSnapshot.samples, {
          settled: false,
          finalBadges: loadingSnapshot.badges,
          finalPending: loadingSnapshot.pending,
        });
        row.cycle = cycle + 1;
        row.ok = false;
        row.problem = row.problem || error?.message || String(error);
        report.routes.push(row);
      }
    }

    report.idle_return = await checkIdleReturnAndTabSwitch(page, context, baseUrl, stamp, idleMs);

    await navigateInApp(page, baseUrl, 'home', `${stamp}-modals`);
    await waitForRouteReady(page, { key: 'home', minText: 600 });
    await checkSystemModals(page, report);
    await page.screenshot({ path: screenshotPath, fullPage: false });
  } catch (error) {
    report.errors.push(error?.message || String(error));
  } finally {
    if (browser) await browser.close();
  }

  const elapsedValues = report.routes.map((row) => row.elapsed_ms).filter((value) => Number.isFinite(value));
  const progressRecords = [
    ...report.routes.map((row) => ({ cycle: row.cycle, route: row.route, audit: row.progress_audit })),
    { route: 'idle-prime', audit: report.idle_return?.prime_progress_audit },
    { route: 'idle-return', audit: report.idle_return?.idle_return?.progress_audit },
    { route: 'tab-reswitch', audit: report.idle_return?.tab_reswitch?.progress_audit },
  ].filter((row) => row.audit);
  const progressRows = progressRecords.map((row) => row.audit);
  report.progress_audit = {
    ok: progressRecords.length === report.routes.length + 3 && progressRows.every((audit) => audit.ok),
    regressions: progressRecords.flatMap((row) => (row.audit.regressions || []).map((item) => ({ cycle: row.cycle, route: row.route, ...item }))),
    lifecycle_violations: progressRecords.flatMap((row) => (row.audit.lifecycle_violations || []).map((item) => ({ cycle: row.cycle, route: row.route, ...item }))),
    badges_without_requests: progressRecords.flatMap((row) => (row.audit.badges_without_requests || []).map((item) => ({ cycle: row.cycle, route: row.route, ...item }))),
    retained_badges: progressRecords.flatMap((row) => (row.audit.retained_badges || []).map((item) => ({ cycle: row.cycle, route: row.route, ...item }))),
    pending_requests_at_timeout: progressRecords.reduce((sum, row) => sum + Number(row.audit.pending_requests_at_timeout || 0), 0),
  };
  report.summary = {
    failed_routes: report.routes.filter((row) => !row.ok).length,
    idle_return_ok: report.idle_return?.ok === true,
    failed_modals: Object.values(report.modal_checks || {}).filter((row) => !row.ok).length,
    failed_overlay_cleanups: Object.values(report.overlay_cleanup || {}).filter((row) => !row.ok).length,
    failed_progress_operations: progressRows.filter((row) => !row.ok).length,
    max_elapsed_ms: elapsedValues.length ? Math.max(...elapsedValues) : null,
    avg_elapsed_ms: elapsedValues.length ? Math.round(elapsedValues.reduce((sum, value) => sum + value, 0) / elapsedValues.length) : null,
  };
  report.warnings = Array.from(new Set(report.warnings));
  const popupChecks = Object.values(report.modal_checks || {});
  const overlayCleanupChecks = Object.values(report.overlay_cleanup || {});
  report.ok = ROUTES.length > 0
    && cycles >= 50
    && idleMs >= DEFAULT_IDLE_MS
    && report.routes.length >= cycles
    && report.routes.every((row) => row.ok)
    && report.idle_return?.ok === true
    && popupChecks.length === 3
    && popupChecks.every((row) => row.ok)
    && overlayCleanupChecks.length === 3
    && overlayCleanupChecks.every((row) => row.ok)
    && report.progress_audit.ok
    && report.auth_errors.length === 0
    && report.server_errors.length === 0
    && report.errors.length === 0
    && /^https:\/\/kylee94\.github\.io\/logistics-gate6-preview\/?/iu.test(baseUrl);

  fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  fs.writeFileSync(latestJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(`full app loading stability ${report.ok ? 'PASS' : 'FAIL'}: ${path.relative(ROOT, outJson).replace(/\\/gu, '/')}`);
  if (!report.ok) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error?.stack || error?.message || error);
  process.exit(1);
});
