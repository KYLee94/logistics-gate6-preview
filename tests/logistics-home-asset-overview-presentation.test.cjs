const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { pathToFileURL } = require('node:url');

const ROOT = path.resolve(__dirname, '..');
const HELPER_PATH = path.join(ROOT, 'src', 'features', 'logistics-data-platform', 'homeAssetOverview.js');
const JSX_PATH = path.join(ROOT, 'src', 'features', 'logistics-data-platform', 'LogisticsDataPlatform.jsx');

async function helper() {
  return import(`${pathToFileURL(HELPER_PATH).href}?overview=${Date.now()}-${Math.random()}`);
}

test('포천 정교리는 대장 누락이 아니라 개발 중 상태로 표시한다', async () => {
  const { resolveHomeAssetOverviewValue } = await helper();
  const asset = { asset_code: 'A190013001', completion_date: null, building_area_sqm: null };

  assert.deepEqual(resolveHomeAssetOverviewValue('building_area_sqm', asset, {}), {
    kind: 'status',
    text: '개발 중',
  });
  assert.deepEqual(resolveHomeAssetOverviewValue('completion_date', asset, {}), {
    kind: 'status',
    text: '개발 중',
  });
});

test('임대가능면적 대신 현재 렌트롤 면적을 사용하고 0행은 임대차 미등록으로 구분한다', async () => {
  const { resolveHomeAssetOverviewValue } = await helper();
  const asset = { asset_code: 'A112527001', leasable_area_sqm: null };

  assert.deepEqual(resolveHomeAssetOverviewValue('leasable_area_sqm', asset, {
    denominator_area_sqm: 53709.85,
  }), { kind: 'value', value: 53709.85 });
  assert.deepEqual(resolveHomeAssetOverviewValue('leasable_area_sqm', asset, {
    denominator_area_sqm: 0,
  }), { kind: 'status', text: '임대차 미등록' });
});

test('건축물대장 비대상 필드와 대장 미기재 필드를 미입력으로 오인하지 않는다', async () => {
  const { resolveHomeAssetOverviewValue } = await helper();
  const asset = { asset_code: 'A112527001', zoning_text: null, parking_count: null };

  assert.deepEqual(resolveHomeAssetOverviewValue('zoning_text', asset, {}), {
    kind: 'status', text: '토지이용계획 별도 확인',
  });
  assert.deepEqual(resolveHomeAssetOverviewValue('parking_count', asset, {}), {
    kind: 'status', text: '건축물대장 미기재',
  });
});

test('홈 자산 개요는 현재 렌트롤 면적 라벨과 occupancy summary를 실제 렌더에 연결한다', () => {
  const jsx = fs.readFileSync(JSX_PATH, 'utf8');
  assert.match(jsx, /key:\s*"leasable_area_sqm",\s*label:\s*"현재 렌트롤 면적"/u);
  assert.match(jsx, /resolveHomeAssetOverviewValue\(field\.key,\s*asset,\s*occupancySummary\)/u);
  assert.match(jsx, /occupancySummary=\{occupancySummary\}/u);
});
