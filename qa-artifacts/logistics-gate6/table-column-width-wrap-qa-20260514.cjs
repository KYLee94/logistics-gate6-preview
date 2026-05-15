let chromium;
try {
  ({ chromium } = require('playwright'));
} catch {
  ({ chromium } = require('C:/Users/10524/Desktop/codex_realasset/Project/03_Logi_Leasing_Dashboard/node_modules/playwright'));
}
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const outDir = path.join(__dirname, 'table-column-width-wrap-qa-20260514');
const baseUrl = 'http://127.0.0.1:4179';
const routeBase = `${baseUrl}/platform/iotaseoul/workspace/logistics`;

fs.mkdirSync(outDir, { recursive: true });

function run(command, args) {
  const child = spawn(command, args, {
    cwd: root,
    shell: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.on('data', (chunk) => process.stdout.write(chunk));
  child.stderr.on('data', (chunk) => process.stderr.write(chunk));
  return child;
}

async function waitForServer(url, timeoutMs = 45000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // keep polling
    }
    await new Promise((resolve) => setTimeout(resolve, 700));
  }
  throw new Error(`Preview server not ready: ${url}`);
}

async function scanTables(page, routeName) {
  return page.$$eval('table', (tables, routeNameArg) => tables.map((table, index) => {
    const headers = Array.from(table.querySelectorAll('thead th')).map((cell) => cell.textContent.trim());
    const rowCount = table.querySelectorAll('tbody tr').length;
    const colCount = headers.length || table.querySelectorAll('tr:first-child > *').length;
    const tableRect = table.getBoundingClientRect();
    const parent = table.parentElement;
    const parentRect = parent ? parent.getBoundingClientRect() : tableRect;
    const firstHeader = table.querySelector('thead th:first-child');
    const firstWidth = firstHeader ? firstHeader.getBoundingClientRect().width : 0;
    const firstRatio = tableRect.width ? firstWidth / tableRect.width : 0;
    const shortFirst = /^(No\.?|ID|코드|구분|상태|날짜|만기|단계|등급)$/u.test(headers[0] || '');
    const itemFirst = /^(항목)$/u.test(headers[0] || '');
    const nameFirst = /자산|임차인|기업|회사|프로젝트/u.test(headers[0] || '');
    const denseTable = colCount >= 9;
    const unnecessaryScroll = parent && parent.scrollWidth > parent.clientWidth + 4 && !denseTable;
    const badFirstColumn = firstRatio > (shortFirst ? 0.22 : itemFirst ? 0.38 : nameFirst ? 0.4 : 0.32);
    const overflowingCells = Array.from(table.querySelectorAll('td, th')).filter((cell) => {
      const style = window.getComputedStyle(cell);
      const text = cell.textContent.trim();
      if (!text || text.length < 12) return false;
      if (style.whiteSpace !== 'nowrap') return false;
      return cell.scrollWidth > cell.clientWidth + 4 && !cell.querySelector('[title]');
    }).length;
    const numericMisaligned = Array.from(table.querySelectorAll('thead th')).reduce((count, headerCell, headerIndex) => {
      const label = headerCell.textContent.trim();
      if (!/(수$|건$|개$|율|비율|면적|평|금액|임대료|관리비|임관리비|NOC|원가|합계|개월|비중)/u.test(label)) return count;
      const bodyCell = table.querySelector(`tbody tr td:nth-child(${headerIndex + 1})`);
      if (!bodyCell) return count;
      return window.getComputedStyle(bodyCell).textAlign === 'right' ? count : count + 1;
    }, 0);
    return {
      route: routeNameArg,
      index,
      headers,
      rowCount,
      colCount,
      tableWidth: Math.round(tableRect.width),
      containerWidth: Math.round(parentRect.width),
      firstColumnWidth: Math.round(firstWidth),
      firstRatio: Number(firstRatio.toFixed(3)),
      denseTable,
      unnecessaryScroll,
      badFirstColumn,
      overflowingCells,
      numericMisaligned,
      status: !unnecessaryScroll && !badFirstColumn && overflowingCells === 0 && numericMisaligned === 0 ? 'pass' : 'fail',
    };
  }), routeName);
}

(async () => {
  const routes = [
    ['main', routeBase],
    ['weekly', `${routeBase}/dashboard/weekly`],
    ['home', `${routeBase}/dashboard/home`],
    ['asset', `${routeBase}/dashboard/asset`],
    ['company', `${routeBase}/dashboard/company`],
    ['tools', `${routeBase}/dashboard/tools`],
    ['playground', `${routeBase}/dashboard/playground`],
    ['quality', `${routeBase}/dashboard/quality`],
  ];
  const result = {
    baseUrl,
    screenshots: {},
    tableRows: [],
    checks: {},
    pageErrors: [],
    consoleErrors: [],
  };

  const preview = run('npm', ['run', 'preview', '--', '--host', '127.0.0.1', '--port', '4179']);
  let browser;
  try {
    await waitForServer(baseUrl);
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1440, height: 1200 } });
    await page.addInitScript(() => {
      const expiresAt = Math.floor(Date.now() / 1000) + 3600;
      localStorage.setItem('iota_last_activity', Date.now().toString());
      localStorage.setItem('sb-iota-auth-token', JSON.stringify({
        access_token: 'qa-token',
        refresh_token: 'qa-refresh-token',
        token_type: 'bearer',
        expires_in: 3600,
        expires_at: expiresAt,
        user: {
          id: 'qa-user',
          aud: 'authenticated',
          role: 'authenticated',
          email: 'qa@example.com',
          app_metadata: { role: 'Admin' },
          user_metadata: { name: 'QA Admin', organization: 'IOTA 공통' },
        },
      }));
    });
    page.on('pageerror', (error) => result.pageErrors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error' && !message.text().includes('ERR_NETWORK_ACCESS_DENIED')) {
        result.consoleErrors.push(message.text());
      }
    });

    for (const [name, url] of routes) {
      await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
      await page.waitForTimeout(6500);
      await page.waitForFunction(() => !document.body.innerText.includes('데이터를 불러오고 있습니다'), { timeout: 12000 }).catch(() => {});
      await page.waitForTimeout(700);
      const shot = path.join(outDir, `${name}.png`);
      await page.screenshot({ path: shot, fullPage: true });
      result.screenshots[name] = shot;
      result.tableRows.push(...await scanTables(page, name));
    }

    result.checks.tablesFound = result.tableRows.length > 0;
    result.checks.noUnnecessaryScroll = !result.tableRows.some((row) => row.unnecessaryScroll);
    result.checks.noBadFirstColumn = !result.tableRows.some((row) => row.badFirstColumn);
    result.checks.noUnexpectedNoWrapOverflow = !result.tableRows.some((row) => row.overflowingCells > 0);
    result.checks.numericColumnsRightAligned = !result.tableRows.some((row) => row.numericMisaligned > 0);
    result.checks.noPageErrors = result.pageErrors.length === 0;
    result.checks.noConsoleErrors = result.consoleErrors.length === 0;
    result.allPass = Object.values(result.checks).every(Boolean);

    fs.writeFileSync(path.join(outDir, 'result.json'), JSON.stringify(result, null, 2));
    console.log(JSON.stringify(result, null, 2));
    if (!result.allPass) process.exitCode = 1;
  } finally {
    if (browser) await browser.close();
    preview.kill();
    setTimeout(() => process.exit(process.exitCode || 0), 250);
  }
})();
