const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

async function main() {
  const outDir = __dirname;
  const messages = [];
  const errors = [];
  const failedRequests = [];
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 900, height: 700 } });
  page.on('console', (message) => messages.push({ type: message.type(), text: message.text() }));
  page.on('pageerror', (error) => errors.push(error.stack || error.message));
  page.on('requestfailed', (request) => {
    failedRequests.push({ url: request.url(), failure: request.failure()?.errorText || 'unknown' });
  });
  await page.setContent(`
    <!doctype html>
    <html lang="ko">
      <head>
        <meta charset="utf-8" />
        <style>
          html, body, #map { width: 100%; height: 100%; margin: 0; }
        </style>
        <script src="https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=xmxdr3l9ij"></script>
      </head>
      <body>
        <div id="map"></div>
        <script>
          window.__result = { hasNaver: false, created: false, error: null };
          try {
            window.__result.hasNaver = Boolean(window.naver && window.naver.maps && window.naver.maps.Map);
            var center = new naver.maps.LatLng(37.3595704, 127.105399);
            var map = new naver.maps.Map('map', { center: center, zoom: 10 });
            new naver.maps.Marker({ position: center, map: map, title: 'QA marker' });
            window.__result.created = true;
            window.__result.mapMethods = Object.getOwnPropertyNames(Object.getPrototypeOf(map)).filter(function (name) {
              return /destroy|remove|detach|setMap|listener|event/i.test(name);
            });
          } catch (error) {
            window.__result.error = error && (error.stack || error.message || String(error));
            console.error(window.__result.error);
          }
        </script>
      </body>
    </html>
  `, { waitUntil: 'networkidle', timeout: 90000 });
  await page.waitForTimeout(5000);
  await page.screenshot({ path: path.join(outDir, 'naver-minimal-check.png'), fullPage: true });
  const result = await page.evaluate(() => window.__result);
  const output = { result, messages, errors, failedRequests };
  fs.writeFileSync(path.join(outDir, 'naver-minimal-check.json'), JSON.stringify(output, null, 2), 'utf8');
  console.log(JSON.stringify(output, null, 2));
  await browser.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
