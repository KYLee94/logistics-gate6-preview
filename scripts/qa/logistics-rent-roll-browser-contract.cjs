#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '..', '..');
const port = Number(process.env.RENT_ROLL_QA_PORT || 4187);
const baseUrl = `http://127.0.0.1:${port}`;
const viteBin = path.join(root, 'node_modules', 'vite', 'bin', 'vite.js');
let serverError = '';

function chromeExecutablePath() {
  return [
    process.env.CHROME_PATH,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    path.join(process.env.LOCALAPPDATA || '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
  ].filter(Boolean).find((candidate) => fs.existsSync(candidate)) || undefined;
}

async function waitForServer() {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${baseUrl}/src/features/logistics-data-platform/rentRollSchema.js`);
      if (response.ok) return;
    } catch {
      // Keep polling until Vite is ready.
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error('VITE_BROWSER_CONTRACT_TIMEOUT');
}

async function main() {
  const server = spawn(process.execPath, [
    viteBin,
    '--host', '127.0.0.1',
    '--port', String(port),
    '--strictPort',
  ], {
    cwd: root,
    env: { ...process.env, NO_UPDATE_NOTIFIER: '1' },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
  server.stderr.on('data', (chunk) => { serverError += String(chunk); });
  try {
    await waitForServer();
    const executablePath = chromeExecutablePath();
    assert.ok(executablePath, 'System Chrome executable is required for the browser contract test.');
    const browser = await chromium.launch({ headless: true, executablePath });
    try {
      const page = await browser.newPage();
      await page.goto(`${baseUrl}/src/features/logistics-data-platform/rentRollSchema.js`);
      await page.evaluate(async () => {
        const contract = await import(`/src/features/logistics-data-platform/rentRollSchema.js?browser=${Date.now()}`);
        const state = {
          row: {
            row_key: 'space-browser-existing',
            space_key: 'space-browser-existing',
            contract_key: 'contract-browser-existing',
            contract_space_key: 'allocation-browser-existing',
            rent_term_key: 'term-browser-existing',
            space_revision: 10,
            contract_revision: 4,
            allocation_revision: 5,
            rent_term_revision: 6,
            tenant_name: '브라우저 임차인',
            floor_label: '1F',
            leased_area_sqm: 1000,
            commencement_date: '2026-01-01',
            expiry_date: '2026-12-31',
            monthly_rent_total_krw: 1000000,
            monthly_cam_total_krw: 200000,
            rent_free_months: 0,
            renewal_terms: '기타(N)',
            termination_terms: '중도해지불가',
          },
          dirty: new Set(),
          requests: [],
          readback: null,
          readbackMismatches: [],
          periods: [],
        };
        document.body.innerHTML = `
          <label>월 임대료 <input id="rent" inputmode="numeric"></label>
          <button id="rent-free" type="button">렌트프리 세부</button>
          <button id="save" type="button">변경사항 저장</button>
        `;
        const rent = document.querySelector('#rent');
        rent.value = contract.formatRentRollNumber(state.row.monthly_rent_total_krw, 2);
        rent.addEventListener('input', (event) => {
          state.row = contract.deriveRentRollRow({
            ...state.row,
            monthly_rent_total_krw: contract.parseRentRollMoneyInput(event.target.value),
          });
          state.dirty.add('monthly_rent_total_krw');
        });
        document.querySelector('#rent-free').addEventListener('click', () => {
          const dialog = document.createElement('section');
          dialog.id = 'rent-free-dialog';
          dialog.setAttribute('role', 'dialog');
          dialog.setAttribute('aria-modal', 'true');
          dialog.innerHTML = '<button id="add-period">기간 추가</button><div id="periods"></div><button id="apply-periods">적용</button>';
          document.body.append(dialog);
          const render = () => {
            dialog.querySelector('#periods').innerHTML = state.periods.map((period, index) => `
              <div data-period="${index}">
                <input aria-label="${index + 1}차 시작일" type="date" value="${period.start_date}">
                <input aria-label="${index + 1}차 종료일" type="date" value="${period.end_date}">
                <input aria-label="${index + 1}차 사유" type="text" value="${period.reason}">
                <input aria-label="${index + 1}차 비고" type="text" value="${period.notes}">
              </div>
            `).join('');
            dialog.querySelectorAll('[data-period]').forEach((node) => {
              const index = Number(node.dataset.period);
              const [start, end, reason, notes] = node.querySelectorAll('input');
              start.addEventListener('input', (event) => { state.periods[index].start_date = event.target.value; });
              end.addEventListener('input', (event) => { state.periods[index].end_date = event.target.value; });
              reason.addEventListener('input', (event) => { state.periods[index].reason = event.target.value; });
              notes.addEventListener('input', (event) => { state.periods[index].notes = event.target.value; });
            });
          };
          dialog.querySelector('#add-period').addEventListener('click', () => {
            state.periods.push({ start_date: '', end_date: '', reason: '', notes: '' });
            render();
          });
          dialog.querySelector('#apply-periods').addEventListener('click', () => {
            state.row = contract.deriveRentRollRow({
              ...state.row,
              rent_free_periods: state.periods.map((period) => ({ ...period, months: 1 })),
              rent_free_start_date: state.periods[0]?.start_date || '',
              rent_free_end_date: state.periods.at(-1)?.end_date || '',
              rent_free_months: state.periods.length,
            });
            state.dirty.add('rent_free_periods');
            dialog.remove();
          });
        });
        document.querySelector('#save').addEventListener('click', () => {
          const payload = contract.buildRentRollSaveRow(state.row, [...state.dirty]);
          state.requests.push(payload);
          state.readback = contract.deriveRentRollRow({ ...state.row });
          state.readbackMismatches = contract.rentRollReadbackMismatches([payload], [state.readback]);
        });
        globalThis.__rentRollBrowserState = state;
      });

      await page.locator('#rent').fill('1,234,567');
      assert.equal(await page.evaluate(() => globalThis.__rentRollBrowserState.requests.length), 0);
      assert.equal(await page.locator('[role="dialog"]').count(), 0);

      await page.locator('#rent-free').click();
      await page.locator('#add-period').click();
      await page.locator('#add-period').click();
      await page.getByLabel('1차 시작일').fill('2026-01-01');
      await page.getByLabel('1차 종료일').fill('2026-01-31');
      await page.getByLabel('1차 사유').fill('오픈 지원');
      await page.getByLabel('1차 비고').fill('1차 협의');
      await page.getByLabel('2차 시작일').fill('2026-07-01');
      await page.getByLabel('2차 종료일').fill('2026-07-31');
      await page.getByLabel('2차 사유').fill('성수기 지원');
      await page.getByLabel('2차 비고').fill('2차 협의');
      await page.locator('#apply-periods').click();
      assert.equal(await page.locator('[role="dialog"]').count(), 0);
      assert.equal(await page.evaluate(() => globalThis.__rentRollBrowserState.requests.length), 0);

      await page.locator('#save').click();
      const evidence = await page.evaluate(() => {
        const state = globalThis.__rentRollBrowserState;
        const payload = state.requests[0];
        return {
          request_count: state.requests.length,
          operation: payload.operation,
          payload_fields: Object.keys(payload),
          monthly_rent_total_krw: payload.monthly_rent_total_krw,
          rent_free_period_count: payload.rent_free_periods.length,
          readback_rent_free_period_count: state.readback.rent_free_periods.length,
          readback_mismatch_count: state.readbackMismatches.length,
          renewal_terms: state.readback.renewal_terms,
          termination_terms: state.readback.termination_terms,
          readback_effective_rent: state.readback.effective_rent,
        };
      });
      assert.equal(evidence.request_count, 1);
      assert.equal(evidence.operation, 'update');
      assert.equal(evidence.monthly_rent_total_krw, 1234567);
      assert.equal(evidence.rent_free_period_count, 2);
      assert.equal(evidence.readback_rent_free_period_count, 2);
      assert.equal(evidence.readback_mismatch_count, 0);
      assert.equal(evidence.renewal_terms, '없음');
      assert.equal(evidence.termination_terms, '없음');
      assert.equal(evidence.payload_fields.includes('effective_rent'), false);
      assert.equal(Number.isInteger(evidence.readback_effective_rent), true);
      process.stdout.write(`${JSON.stringify({
        ok: true,
        mode: 'mock-browser-contract',
        operating_network_used: false,
        database_write_used: false,
        evidence,
      }, null, 2)}\n`);
    } finally {
      await browser.close();
    }
  } finally {
    server.kill();
  }
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n${serverError}\n`);
  process.exit(1);
});
