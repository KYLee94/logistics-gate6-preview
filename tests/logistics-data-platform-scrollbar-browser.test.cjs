const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const { chromium, firefox } = require('playwright');

const requestedCssPath = process.env.DATA_PLATFORM_SCROLLBAR_BUILT_CSS;
const cssPath = requestedCssPath && fs.existsSync(requestedCssPath)
  ? requestedCssPath
  : 'src/index.css';
const sourceCss = fs.readFileSync(cssPath, 'utf8');
const themeVariable = sourceCss.indexOf('--data-platform-scrollbar-track');
const themeStart = sourceCss.lastIndexOf('.logistics-data-platform-scroll-host', themeVariable);
const themeEnd = sourceCss.indexOf('.logistics-data-platform .bg-white', themeStart);
const formTheme = sourceCss.match(
  /\.logistics-data-platform input,\s*\.logistics-data-platform select,\s*\.logistics-data-platform textarea\s*\{[\s\S]*?\}/u,
)?.[0] || '';

assert.ok(themeStart >= 0 && themeEnd > themeStart, '데이터 플랫폼 스크롤바 CSS 범위가 필요합니다');
const scopedTheme = `${sourceCss.slice(themeStart, themeEnd)}\n${formTheme}`;

const surfaces = [
  'rent-roll-table',
  'asset-comparison-dropdown',
  'modal',
  'multiselect',
  'horizontal-table',
  'vertical-panel',
  'nested-scroll',
  'native-select',
];

function testDocument() {
  const scrollSurface = (name, overflow = 'auto') => `
    <div data-scroll-surface="${name}" style="width:160px;height:64px;overflow:${overflow}">
      <div style="width:420px;height:220px"></div>
    </div>`;
  return `<!doctype html>
    <meta charset="utf-8">
    <style>
      body { margin: 0; background: #111; }
      ${scopedTheme}
    </style>
    <div id="outside" style="width:120px;height:40px;overflow:auto"><div style="width:320px;height:120px"></div></div>
    <div class="logistics-data-platform-scroll-host" data-scroll-surface="tab-scroll-host" style="width:240px;height:180px;overflow-y:scroll">
    <main class="logistics-data-platform" style="width:220px;height:360px;overflow:auto">
      ${scrollSurface('rent-roll-table')}
      ${scrollSurface('asset-comparison-dropdown', 'auto')}
      ${scrollSurface('modal', 'auto')}
      ${scrollSurface('multiselect', 'auto')}
      ${scrollSurface('horizontal-table', 'auto')}
      ${scrollSurface('vertical-panel', 'auto')}
      <section data-scroll-surface="nested-scroll" style="width:180px;height:70px;overflow:auto">
        ${scrollSurface('nested-child')}
      </section>
      <select data-scroll-surface="native-select" size="3" style="width:150px;height:54px;overflow:auto">
        <option>하나</option><option>둘</option><option>셋</option><option>넷</option><option>다섯</option>
      </select>
      <div style="width:500px;height:500px"></div>
    </main></div>`;
}

for (const [browserName, browserType] of [['chromium', chromium], ['firefox', firefox]]) {
  const executableCandidates = [
    browserType.executablePath(),
    ...(browserName === 'chromium' ? [
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    ] : [
      'C:\\Program Files\\Mozilla Firefox\\firefox.exe',
      'C:\\Program Files (x86)\\Mozilla Firefox\\firefox.exe',
    ]),
  ];
  const executablePath = executableCandidates.find((candidate) => fs.existsSync(candidate));
  test(`${browserName}은 모든 데이터 플랫폼 스크롤 표면에 다크 thin 계약을 계산한다`, {
    skip: !executablePath,
  }, async () => {
    const browser = await browserType.launch({ headless: true, executablePath });
    try {
      const page = await browser.newPage();
      await page.setContent(testDocument(), { waitUntil: 'domcontentloaded' });
      const result = await page.evaluate((surfaceNames) => {
        const styles = Object.fromEntries(surfaceNames.map((name) => {
          const node = document.querySelector(`[data-scroll-surface="${name}"]`);
          const style = getComputedStyle(node);
          return [name, {
            scrollbarWidth: style.scrollbarWidth,
            scrollbarColor: style.scrollbarColor,
            colorScheme: style.colorScheme,
          }];
        }));
        const outside = getComputedStyle(document.querySelector('#outside'));
        const root = document.querySelector('.logistics-data-platform');
        const pseudo = {
          scrollbarWidth: getComputedStyle(root, '::-webkit-scrollbar').width,
          scrollbarHeight: getComputedStyle(root, '::-webkit-scrollbar').height,
          thumbBackground: getComputedStyle(root, '::-webkit-scrollbar-thumb').backgroundColor,
          buttonDisplay: getComputedStyle(root, '::-webkit-scrollbar-button').display,
          cornerBackground: getComputedStyle(root, '::-webkit-scrollbar-corner').backgroundColor,
        };
        return {
          styles,
          outside: {
            scrollbarWidth: outside.scrollbarWidth,
            scrollbarColor: outside.scrollbarColor,
          },
          pseudo,
        };
      }, surfaces);

      for (const name of surfaces) {
        assert.equal(result.styles[name].scrollbarWidth, 'thin', `${browserName}: ${name}`);
        assert.match(result.styles[name].scrollbarColor, /rgb\(72, 72, 74\).*rgb\(31, 31, 30\)/u);
      }
      assert.match(result.styles['native-select'].colorScheme, /dark/u);
      const hostStyle = await page.locator('[data-scroll-surface="tab-scroll-host"]').evaluate((node) => {
        const style = getComputedStyle(node);
        return { scrollbarWidth: style.scrollbarWidth, scrollbarColor: style.scrollbarColor };
      });
      assert.equal(hostStyle.scrollbarWidth, 'thin');
      assert.match(hostStyle.scrollbarColor, /rgb\(72, 72, 74\).*rgb\(31, 31, 30\)/u);
      assert.notEqual(result.outside.scrollbarWidth, 'thin');
      if (browserName === 'chromium') {
        assert.equal(result.pseudo.scrollbarWidth, '8px');
        assert.equal(result.pseudo.scrollbarHeight, '8px');
        assert.equal(result.pseudo.thumbBackground, 'rgb(72, 72, 74)');
        assert.equal(result.pseudo.buttonDisplay, 'none');
        assert.equal(result.pseudo.cornerBackground, 'rgb(31, 31, 30)');
      }
    } finally {
      await browser.close();
    }
  });
}
