const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', error => console.log('PAGE ERROR:', error.message));
  await page.goto('http://localhost:4173/IGIS-Fund-Production-DP/');
  await page.screenshot({ path: 'screenshot.png' });
  await browser.close();
})();
