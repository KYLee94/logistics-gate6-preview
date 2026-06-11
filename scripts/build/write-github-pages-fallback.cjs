const fs = require('fs');
const path = require('path');

const distDir = path.resolve(__dirname, '..', '..', 'dist');
const indexPath = path.join(distDir, 'index.html');
const fallbackPath = path.join(distDir, '404.html');
const routeFallbacks = [
  'auth-setup',
  'work-platform',
  'work-platform/archive',
  'home',
  'asset',
  'company',
  'analysis-tools',
  'pivot-table',
  'data-quality',
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
