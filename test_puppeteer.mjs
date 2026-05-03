import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  page.on('console', msg => {
    if (msg.type() === 'error') {
        console.log('PAGE ERROR LOG:', msg.text());
    }
  });
  page.on('pageerror', error => console.log('PAGE EXCEPTION:', error.message));
  page.on('requestfailed', request => {
    console.log('REQUEST FAILED:', request.url(), request.failure().errorText);
  });

  console.log("Navigating to local production build...");
  await page.goto('http://localhost:49279', { waitUntil: 'networkidle2' });
  await page.screenshot({ path: 'local_screenshot.png' });
  
  console.log("Navigating to GitHub Pages...");
  await page.goto('https://this8369.github.io/IGIS-Fund-Production-DP/', { waitUntil: 'networkidle2' });
  await page.screenshot({ path: 'github_screenshot.png' });

  await browser.close();
  console.log("Done");
})();
