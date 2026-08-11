const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { pathToFileURL } = require('node:url');

const ROOT = path.resolve(__dirname, '..');
const SCOPE_PATH = path.join(ROOT, 'src/utils/logisticsAssetScope.js');
const DOCUMENT_PATH = path.join(
  ROOT,
  'src/features/logistics-data-platform/documentContract.js',
);
const WORKSPACE_PATH = path.join(
  ROOT,
  'src/components/system/workspace/WorkspaceLogistics.jsx',
);

async function scopeContract() {
  return import(
    `${pathToFileURL(SCOPE_PATH).href}?asset-scope=${Date.now()}-${Math.random()}`
  );
}

async function documentContract() {
  return import(
    `${pathToFileURL(DOCUMENT_PATH).href}?asset-directory=${Date.now()}-${Math.random()}`
  );
}

test('Arenas Yangji and Anseong Seongeun are excluded by exact asset code only', async () => {
  const {
    EXCLUDED_LOGISTICS_ASSET_CODES,
    filterIncludedLogisticsAssets,
    isExcludedLogisticsAsset,
  } = await scopeContract();

  assert.deepEqual(EXCLUDED_LOGISTICS_ASSET_CODES, [
    'A112127001',
    'AP00014001',
  ]);
  assert.equal(isExcludedLogisticsAsset({ asset_code: 'A112127001' }), true);
  assert.equal(isExcludedLogisticsAsset({ assetId: 'asset_ap00014001' }), true);
  assert.equal(isExcludedLogisticsAsset({ asset_code: 'A112127001-X' }), false);
  assert.deepEqual(
    filterIncludedLogisticsAssets([
      { asset_code: 'A112127001', name: '아레나스양지물류센터' },
      { asset_code: 'A120085001', name: '경산 쿠팡물류센터' },
      { assetId: 'asset_ap00014001', assetName: '안성 성은지구 물류센터' },
    ]),
    [{ asset_code: 'A120085001', name: '경산 쿠팡물류센터' }],
  );
});

test('the data-platform directory removes both assets before selection reconciliation and comparison reuse', async () => {
  const { normalizeAssetDirectory } = await documentContract();
  const directory = normalizeAssetDirectory({
    assets: [
      { asset_code: 'A112127001', name: '아레나스양지물류센터' },
      { asset_code: 'AP00014001', name: '안성 성은지구 물류센터' },
      { asset_code: 'A120085001', name: '경산 쿠팡물류센터' },
    ],
  });

  assert.deepEqual(directory, [
    { asset_code: 'A120085001', name: '경산 쿠팡물류센터' },
  ]);
});

test('the broader logistics workspace filters both bundled and API-derived asset lists', () => {
  const source = fs.readFileSync(WORKSPACE_PATH, 'utf8');

  assert.match(
    source,
    /const assetOptionsData = filterIncludedLogisticsAssets\(rawAssetOptionsData\)/u,
  );
  assert.match(
    source,
    /return filterIncludedLogisticsAssets\(\(readData\.assets \|\| \[\]\)\.map/u,
  );
});
