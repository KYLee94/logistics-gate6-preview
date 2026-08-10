const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const source = fs.readFileSync(
  path.resolve(__dirname, '../src/features/logistics-data-platform/LogisticsDataPlatform.jsx'),
  'utf8',
);

test('asset directory request stays separate from selected asset detail on every tab', () => {
  const rootStart = source.indexOf('export default function LogisticsDataPlatform');
  const root = source.slice(rootStart);

  assert.match(root, /const\s+assetDirectory\s*=\s*usePrimaryResource\(DATA_PLATFORM_ACTIONS\.homeRead/u);
  assert.match(root, /const\s+home\s*=\s*usePrimaryResource\(\s*DATA_PLATFORM_ACTIONS\.homeRead/u);
  assert.match(root, /normalizeAssetDirectory\(assetDirectory\.data\)/u);
  assert.match(root, /asset_code:\s*assetCode/u);
  assert.match(root, /\{\s*enabled:\s*Boolean\(assetCode\)\s*\}/u);
  assert.match(root, /<FinancePanel[\s\S]{0,180}assets=\{assets\}/u);
  assert.doesNotMatch(root, /home\.data\?\.assets/u);
});

test('asset selection persists across refresh and is reconciled after directory load', () => {
  const rootStart = source.indexOf('export default function LogisticsDataPlatform');
  const root = source.slice(rootStart);

  assert.match(root, /sessionStorage\.getItem\("gate6-data-platform-asset-code"\)/u);
  assert.match(root, /if \(!assets\.length\) return/u);
  assert.match(root, /reconcileAssetCode\(assets, assetCode\)/u);
  assert.match(root, /sessionStorage\.setItem\("gate6-data-platform-asset-code", assetCode\)/u);
  assert.match(root, /onChange=\{\(event\) => changeAsset\(event\.target\.value\)\}/u);
});
