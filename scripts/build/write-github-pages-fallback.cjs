const fs = require('fs');
const path = require('path');

const distDir = path.resolve(__dirname, '..', '..', 'dist');
const indexPath = path.join(distDir, 'index.html');
const fallbackPath = path.join(distDir, '404.html');
const routeFallbacks = [
  'auth-setup',
  'work-platform',
  'home',
  'data-platform',
  'data-platform/home',
  'data-platform/rent-roll',
  'data-platform/income-expense',
  'asset',
  'company',
  'investment-index',
  'asset-spec',
  'analysis-tools',
  'pivot-table',
  'data-quality',
  'market-data',
  'market-data/overview',
  'market-data/lease-market',
  'market-data/supply-pipeline',
  'market-data/transactions',
  'market-data/source-update',
  'data-management',
  'data-management/asset-data',
  'data-management/investment-data',
  'data-management/lease-contracts',
  'data-management/managers',
  'data-management/data-quality',
  'contract-data',
  'pdf-report',
];

if (!fs.existsSync(indexPath)) {
  throw new Error(`Cannot create GitHub Pages SPA fallback because ${indexPath} does not exist.`);
}

fs.copyFileSync(indexPath, fallbackPath);
console.log(`Created GitHub Pages SPA fallback: ${fallbackPath}`);

for (const route of routeFallbacks) {
  const routeDir = path.join(distDir, route);
  const routeIndexPath = path.join(routeDir, 'index.html');
  fs.mkdirSync(routeDir, { recursive: true });
  fs.copyFileSync(indexPath, routeIndexPath);
  console.log(`Created GitHub Pages route fallback: ${routeIndexPath}`);
}
