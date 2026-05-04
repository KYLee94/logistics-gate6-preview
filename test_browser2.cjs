const puppeteer = require('puppeteer');
(async () => {
  try {
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    page.on('pageerror', error => console.log('PAGE ERROR:', error.message));
    await page.goto('http://localhost:8081/IGIS-Fund-Production-DP/platform/iotaseoul/dashboard', { waitUntil: 'networkidle0', timeout: 10000 });
    await new Promise(r => setTimeout(r, 6000));
    await browser.close();
  } catch (e) {
    console.error("Puppeteer Error:", e);
  }
})();
