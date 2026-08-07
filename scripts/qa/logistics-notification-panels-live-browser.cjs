#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..', '..');
const DEFAULT_BASE_URL = 'https://kylee94.github.io/logistics-gate6-preview/';
const DEFAULT_ASSET_NAME = '안성 홈플러스 중부허브 물류센터';
const INTERNAL_IDENTIFIER = /\b(?:[0-9a-f]{8}-[0-9a-f-]{27,}|(?:asset|tenant|lease|contract|maturity|loan|fund|beneficiary)_[a-z0-9_-]+)\b/iu;
const INTERNAL_FIELD_KEY = /(?:tenant_master_name|data_management_view_field_update|public\.ll_[a-z0-9_]+)/iu;
const WRITE_ACTION = /(?:batch-save|mark-read|dismiss|delete|archive|subscribe|unsubscribe|save|write)/iu;

function argValue(name, fallback = '') {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? fallback : (process.argv[index + 1] || fallback);
}

function hasArg(name) {
  return process.argv.includes(`--${name}`);
}

function readEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  return Object.fromEntries(fs.readFileSync(filePath, 'utf8')
    .split(/\r?\n/gu)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#') && line.includes('='))
    .map((line) => {
      const separator = line.indexOf('=');
      return [
        line.slice(0, separator).trim(),
        line.slice(separator + 1).trim().replace(/^['"]|['"]$/gu, ''),
      ];
    }));
}

function chromeExecutablePath() {
  return [
    process.env.CHROME_PATH,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  ].filter(Boolean).find((candidate) => fs.existsSync(candidate)) || undefined;
}

function joinUrl(baseUrl, route) {
  const normalized = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  return new URL(route.replace(/^\/+/u, ''), normalized).toString();
}

function createRuntime() {
  const envRoot = path.resolve(argValue('env-root', ROOT));
  const fileEnv = {
    ...readEnvFile(path.join(envRoot, '.env')),
    ...readEnvFile(path.join(envRoot, '.env.local')),
  };
  const envValue = (...names) => names
    .map((name) => process.env[name] || fileEnv[name] || '')
    .find(Boolean) || '';
  const supabaseUrl = envValue('LOGISTICS_SUPABASE_URL', 'VITE_SUPABASE_URL').replace(/\/$/u, '');
  const anonKey = envValue('LOGISTICS_SUPABASE_ANON_KEY', 'VITE_SUPABASE_ANON_KEY');
  const accessToken = envValue('LOGISTICS_SUPABASE_ACCESS_TOKEN');
  const email = envValue('LOGISTICS_SUPABASE_EMAIL', 'LOGISTICS_SUPABASE_AUTH_EMAIL');
  const password = envValue('LOGISTICS_SUPABASE_PASSWORD', 'LOGISTICS_SUPABASE_AUTH_PASSWORD');
  assert.ok(supabaseUrl && anonKey, 'Supabase URL/anon key is missing');

  async function signIn() {
    if (accessToken) {
      const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
        headers: { apikey: anonKey, authorization: `Bearer ${accessToken}` },
      });
      const user = await response.json().catch(() => ({}));
      assert.equal(response.status, 200, 'Supabase access token validation failed');
      return {
        source: 'access_token',
        session: {
          access_token: accessToken,
          refresh_token: '',
          token_type: 'bearer',
          expires_in: 3600,
          expires_at: Math.round(Date.now() / 1000) + 3600,
          user,
        },
      };
    }
    assert.ok(email && password, 'Supabase QA login credentials are missing');
    const response = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { apikey: anonKey, 'content-type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const session = await response.json().catch(() => ({}));
    assert.equal(response.status, 200, `Supabase Auth login failed: ${session.message || response.status}`);
    assert.ok(session.access_token && session.user?.id, 'Supabase Auth session is incomplete');
    if (!session.expires_at && session.expires_in) {
      session.expires_at = Math.round(Date.now() / 1000) + Number(session.expires_in);
    }
    return { source: 'password_grant', session };
  }
  return { signIn };
}

function safePostData(request) {
  try {
    return request.postDataJSON() || {};
  } catch {
    return {};
  }
}

async function main() {
  const baseUrl = argValue('base-url', DEFAULT_BASE_URL);
  const expectedBasePath = '/logistics-gate6-preview/';
  assert.equal(new URL(baseUrl).pathname, expectedBasePath, `Live base path must be ${expectedBasePath}`);
  const targetUrl = joinUrl(baseUrl, 'data-platform/home');
  const assetName = argValue('asset-name', DEFAULT_ASSET_NAME);
  const timeoutMs = Number(argValue('timeout-ms', '45000'));
  assert.ok(Number.isFinite(timeoutMs) && timeoutMs >= 1000, '--timeout-ms must be at least 1000');

  const runtime = createRuntime();
  const auth = await runtime.signIn();
  const browser = await chromium.launch({
    headless: !hasArg('headed'),
    executablePath: chromeExecutablePath(),
  });
  const context = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1600, height: 1000 } });
  await context.addInitScript(({ session }) => {
    sessionStorage.setItem('sb-iota-auth-token', JSON.stringify(session));
    sessionStorage.setItem('logistics_preview_auth', JSON.stringify({ email: session.user?.email || '' }));
  }, { session: auth.session });
  const page = await context.newPage();
  const errors = [];
  const actions = [];
  const apiEvidencePromises = [];
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  page.on('requestfailed', (request) => {
    const failure = request.failure()?.errorText || 'unknown';
    if (failure !== 'net::ERR_ABORTED' && /supabase\.co\/(?:auth|functions)\/v1\//u.test(request.url())) {
      errors.push(`requestfailed ${failure} ${request.url().replace(/[?#].*$/u, '')}`);
    }
  });
  page.on('request', (request) => {
    if (!request.url().includes('/functions/v1/ll-dashboard-api')) return;
    const body = safePostData(request);
    if (body.action) actions.push({ action: String(body.action), payload: body.payload || {} });
  });
  page.on('response', (response) => {
    if (!response.url().includes('/functions/v1/ll-dashboard-api')) return;
    const requestBody = safePostData(response.request());
    apiEvidencePromises.push(response.json().catch(() => null).then((body) => ({
      action: String(requestBody.action || ''),
      payload: requestBody.payload || {},
      status: response.status(),
      body,
    })));
  });

  let report;
  try {
    const documentResponse = await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: timeoutMs });
    assert.equal(documentResponse?.status(), 200, 'Live home document did not return HTTP 200');
    await page.locator('[data-testid="logistics-left-nav"]').waitFor({ state: 'visible', timeout: timeoutMs });
    const platform = page.locator('[data-testid="logistics-data-platform"]');
    await platform.waitFor({ state: 'visible', timeout: timeoutMs });
    const assetSelect = platform.locator('[data-testid="data-platform-asset-select"]');
    const maturityButton = platform.locator('[data-testid="data-platform-maturity-button"]');
    await assetSelect.waitFor({ state: 'visible', timeout: timeoutMs });
    await page.waitForFunction(
      ({ targetAssetName }) => Array.from(document.querySelectorAll('[data-testid="data-platform-asset-select"] option'))
        .some((option) => option.textContent?.trim() === targetAssetName && option.value),
      { targetAssetName: assetName },
      { timeout: timeoutMs },
    );
    const selection = await assetSelect.evaluate((select, targetAssetName) => ({
      target: Array.from(select.options).find((option) => option.textContent?.trim() === targetAssetName)?.value || '',
      alternative: Array.from(select.options).find((option) => option.value && option.textContent?.trim() !== targetAssetName)?.value || '',
      current: select.value,
    }), assetName);
    assert.ok(selection.target, `Readable asset option not found: ${assetName}`);
    if (selection.current === selection.target) {
      assert.ok(selection.alternative, 'A second asset is required for the transition probe');
      await assetSelect.selectOption(selection.alternative);
      await page.waitForFunction(
        ({ value }) => document.querySelector('[data-testid="data-platform-asset-select"]')?.value === value
          && /^만기 알림 \d+$/u.test(document.querySelector('[data-testid="data-platform-maturity-button"]')?.textContent?.trim() || ''),
        { value: selection.alternative },
        { timeout: timeoutMs },
      );
    }
    await page.evaluate(() => {
      window.__gate6MaturityTransitionProbe = { texts: [], zeroExposed: false };
      const inspect = () => {
        const text = document.querySelector('[data-testid="data-platform-maturity-button"]')?.textContent?.trim() || '';
        const probe = window.__gate6MaturityTransitionProbe;
        if (text && probe.texts.at(-1) !== text) probe.texts.push(text);
        if (text === '만기 알림 0') probe.zeroExposed = true;
      };
      window.__gate6MaturityTransitionObserver = new MutationObserver(inspect);
      window.__gate6MaturityTransitionObserver.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
      inspect();
    });
    await assetSelect.selectOption(selection.target);
    await page.waitForFunction(
      ({ value }) => document.querySelector('[data-testid="data-platform-asset-select"]')?.value === value
        && /^만기 알림 \d+$/u.test(document.querySelector('[data-testid="data-platform-maturity-button"]')?.textContent?.trim() || ''),
      { value: selection.target },
      { timeout: timeoutMs },
    );
    const maturityHeader = (await maturityButton.textContent() || '').trim();
    const headerCount = Number(maturityHeader.match(/(\d+)$/u)?.[1] || 0);
    await maturityButton.click();
    const maturityPanel = maturityButton.locator('xpath=following-sibling::section[1]');
    await maturityPanel.waitFor({ state: 'visible', timeout: timeoutMs });
    const maturityRows = maturityPanel.locator('[data-testid="maturity-row"]');
    const maturityRowCount = await maturityRows.count();
    assert.equal(maturityRowCount, headerCount, 'Maturity header count and row count differ');
    const maturityRowTexts = await maturityRows.allInnerTexts();
    const maturityDetails = [];
    for (let index = 0; index < maturityRowCount; index += 1) {
      await maturityRows.nth(index).click();
      const dialog = page.locator('[data-testid="maturity-detail-dialog"]');
      await dialog.waitFor({ state: 'visible', timeout: timeoutMs });
      maturityDetails.push((await dialog.innerText()).trim());
      await dialog.getByRole('button', { name: '닫기' }).click();
      await dialog.waitFor({ state: 'hidden', timeout: timeoutMs });
    }
    const transitionProbe = await page.evaluate(() => {
      window.__gate6MaturityTransitionObserver?.disconnect();
      return window.__gate6MaturityTransitionProbe;
    });
    await maturityButton.click();
    await maturityPanel.waitFor({ state: 'hidden', timeout: timeoutMs });

    const occupancyProgress = platform.locator('[role="progressbar"][aria-label="임대율"]');
    await occupancyProgress.waitFor({ state: 'visible', timeout: timeoutMs });
    const occupancyAriaValue = await occupancyProgress.getAttribute('aria-valuenow');
    const assetOverviewText = (await platform.locator('[data-testid="home-asset-overview"]').innerText()).trim();
    const stackingTenants = platform.locator('[data-testid="home-stacking-plan"] [data-testid="stacking-plan-tenant"]');
    const stackingTenantCount = await stackingTenants.count();
    let stackingTooltipVisible = false;
    let stackingTooltipText = '';
    if (!stackingTenantCount) {
      if (!hasArg('allow-empty-stacking')) errors.push('HOME_STACKING_TENANT_NOT_VISIBLE');
    } else {
      await stackingTenants.first().hover();
      const stackingTooltip = platform.locator('[data-testid="stacking-plan-tooltip"]').first();
      await stackingTooltip.waitFor({ state: 'visible', timeout: timeoutMs });
      stackingTooltipVisible = await stackingTooltip.isVisible();
      stackingTooltipText = (await stackingTooltip.innerText()).trim();
      for (const label of ['임차인', '층·구역', '임대면적', '월 임대료', '월 관리비', '월 합계']) {
        if (!stackingTooltipText.includes(label)) errors.push(`HOME_STACKING_TOOLTIP_LABEL_MISSING:${label}`);
      }
      await stackingTenants.first().focus();
      if (!await stackingTooltip.isVisible()) errors.push('HOME_STACKING_KEYBOARD_TOOLTIP_NOT_VISIBLE');
    }

    const notificationButton = page.locator('[data-testid="logistics-notification-button"]');
    const notificationPanel = page.locator('[data-testid="logistics-notification-panel"]');
    const notificationButtonCount = await notificationButton.count();
    const notificationButtonVisible = notificationButtonCount > 0
      && await notificationButton.isVisible().catch(() => false);
    let notificationPanelVisible = false;
    let notificationText = '';
    if (!notificationButtonVisible) {
      errors.push('RIGHT_NOTIFICATION_BUTTON_NOT_VISIBLE');
    } else {
      await notificationButton.click();
      await notificationPanel.waitFor({ state: 'visible', timeout: timeoutMs });
      await page.waitForFunction(() => {
        const panelText = document.querySelector('[data-testid="logistics-notification-panel"]')?.textContent || '';
        return !panelText.includes('알림을 확인하고 있습니다.');
      }, null, { timeout: timeoutMs });
      notificationPanelVisible = true;
      notificationText = (await notificationPanel.innerText()).trim();
    }

    const apiEvidence = await Promise.all(apiEvidencePromises);
    const targetMaturityEvidence = [...apiEvidence].reverse().find((entry) => (
      entry.action === 'v2/maturities/read' && entry.payload?.asset_key === selection.target
    ));
    const targetHomeEvidence = [...apiEvidence].reverse().find((entry) => (
      entry.action === 'v2/home/read' && entry.payload?.asset_key === selection.target
    ));
    const notificationEvidence = [...apiEvidence].reverse().find((entry) => entry.action === 'notifications/list');
    assert.ok(targetMaturityEvidence, 'Target asset v2/maturities/read evidence is missing');
    assert.equal(targetMaturityEvidence.status, 200, 'v2/maturities/read did not return HTTP 200');
    assert.equal(targetMaturityEvidence.body?.ok, true, 'v2/maturities/read did not return ok:true');
    assert.equal(targetMaturityEvidence.body?.status, 'primary', 'v2/maturities/read was not primary');
    assert.ok(targetHomeEvidence, 'Target asset v2/home/read evidence is missing');
    assert.equal(targetHomeEvidence.status, 200, 'v2/home/read did not return HTTP 200');
    assert.equal(targetHomeEvidence.body?.ok, true, 'v2/home/read did not return ok:true');
    assert.equal(targetHomeEvidence.body?.status, 'primary', 'v2/home/read was not primary');
    const homeSummary = targetHomeEvidence.body?.data?.tenant_summary
      || targetHomeEvidence.body?.data?.occupancy_summary
      || {};
    const serverOccupancyRate = homeSummary.occupancy_rate == null || homeSummary.occupancy_rate === ''
      ? null
      : Number(homeSummary.occupancy_rate);
    const uiOccupancyRate = occupancyAriaValue == null || occupancyAriaValue === ''
      ? null
      : Number(occupancyAriaValue);
    if (serverOccupancyRate != null && (!Number.isFinite(uiOccupancyRate) || Math.abs(serverOccupancyRate - uiOccupancyRate) > 0.1)) {
      errors.push('HOME_OCCUPANCY_UI_READBACK_MISMATCH');
    }
    if (!targetHomeEvidence.body?.data?.asset_source_provenance) {
      errors.push('HOME_ASSET_PROVENANCE_MISSING');
    }
    let notificationListVerified = false;
    let notificationFallbackOrStale = false;
    if (notificationButtonVisible) {
      assert.ok(notificationEvidence, 'notifications/list evidence is missing');
      assert.equal(notificationEvidence.status, 200, 'notifications/list did not return HTTP 200');
      assert.notEqual(notificationEvidence.body?.ok, false, 'notifications/list returned ok:false');
      notificationFallbackOrStale = /fallback|stale/iu.test(JSON.stringify(notificationEvidence.body))
        || /기존 알림|조회가 늦|새로고침을 눌러/iu.test(notificationText);
      assert.equal(notificationFallbackOrStale, false, 'Notification panel exposed fallback/stale data or guidance');
      notificationListVerified = true;
    }

    const visibleBusinessText = [...maturityRowTexts, ...maturityDetails, stackingTooltipText, notificationText].join('\n');
    const internalIdentifierExposed = INTERNAL_IDENTIFIER.test(visibleBusinessText) || INTERNAL_FIELD_KEY.test(visibleBusinessText);
    if (internalIdentifierExposed) errors.push('INTERNAL_IDENTIFIER_OR_FIELD_KEY_VISIBLE');
    const writeActions = actions.filter((entry) => WRITE_ACTION.test(entry.action));
    if (writeActions.length) errors.push('ALERT_VALIDATION_INVOKED_WRITE_ACTION');
    if (transitionProbe.zeroExposed && headerCount > 0) errors.push('MATURITY_TRANSITION_EXPOSED_ZERO');

    report = {
      ok: errors.length === 0,
      generated_at: new Date().toISOString(),
      base_url: baseUrl,
      auth_source: auth.source,
      maturity_alert: {
        selected_asset: assetName,
        header_text: maturityHeader,
        header_count: headerCount,
        row_count: maturityRowCount,
        row_texts: maturityRowTexts,
        detail_count: maturityDetails.length,
        detail_texts: maturityDetails,
        transition_texts: transitionProbe.texts,
        loading_zero_exposed: transitionProbe.zeroExposed,
        primary_read_verified: true,
      },
      home_projection: {
        occupancy_ui_value: uiOccupancyRate,
        occupancy_server_value: serverOccupancyRate,
        occupancy_matches_server: serverOccupancyRate == null || Math.abs(serverOccupancyRate - uiOccupancyRate) <= 0.1,
        asset_provenance_present: Boolean(targetHomeEvidence.body?.data?.asset_source_provenance),
        asset_overview_text: assetOverviewText,
        stacking_tenant_count: stackingTenantCount,
        stacking_tooltip_visible: stackingTooltipVisible,
        stacking_tooltip_text: stackingTooltipText,
      },
      right_notification_panel: {
        button_count: notificationButtonCount,
        button_visible: notificationButtonVisible,
        visible: notificationPanelVisible,
        notifications_list_verified: notificationListVerified,
        empty_state: notificationText.includes('새 알림이 없습니다.'),
        fallback_or_stale_exposed: notificationFallbackOrStale,
        text: notificationText,
      },
      internal_identifier_exposed: internalIdentifierExposed,
      read_actions: actions.map((entry) => entry.action),
      write_action_count: writeActions.length,
      errors,
    };
    if (errors.length) process.exitCode = 1;
  } finally {
    await browser.close();
  }
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${JSON.stringify({ ok: false, error: error.message }, null, 2)}\n`);
  process.exit(1);
});
