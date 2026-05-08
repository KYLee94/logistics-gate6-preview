const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message));
  await page.goto('http://localhost:8081');
  await new Promise(r => setTimeout(r, 2000));
  
  // Click on the marketing tab
  try {
    await page.evaluate(() => {
      const marketingLink = Array.from(document.querySelectorAll('*')).find(el => el.textContent === '기업마케팅');
      if (marketingLink) {
          marketingLink.click();
          console.log('Clicked marketing link');
      } else {
          console.log('Could not find marketing link');
      }
    });
  } catch (e) {
    console.log('Error clicking:', e);
  }
  
  await new Promise(r => setTimeout(r, 2000));
  await page.screenshot({ path: 'test_puppeteer/screenshot.png' });
  await browser.close();
})();
