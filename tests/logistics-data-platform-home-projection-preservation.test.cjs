const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const source = fs.readFileSync(
  path.resolve(__dirname, '../src/features/logistics-data-platform/LogisticsDataPlatform.jsx'),
  'utf8',
);

const cloneRegion = source.slice(
  source.indexOf('function cloneHomeProjection'),
  source.indexOf('function HomePanel'),
);

test('홈 복제는 서버 응답 전체를 재귀 복사해 점유 요약과 건축물 출처를 보존한다', () => {
  assert.ok(cloneRegion.startsWith('function cloneHomeProjection'), 'cloneHomeProjection helper가 필요합니다.');
  assert.match(cloneRegion, /Array\.isArray\(value\)[\s\S]*value\.map\(cloneHomeProjection\)/u);
  assert.match(cloneRegion, /Object\.fromEntries\([\s\S]*Object\.entries\(value\)/u);
  assert.match(cloneRegion, /const\s+cloned\s*=\s*cloneHomeProjection\(data\s*\|\|\s*\{\}\)/u);
  assert.match(cloneRegion, /return\s*\{\s*\.\.\.cloned,/u);
  assert.match(source, /const\s+occupancySummary\s*=\s*sourceData\.occupancy_summary\s*\|\|\s*\{\}/u);
  assert.match(source, /homeFiniteNumber\(occupancySummary\.occupancy_rate\)/u);
  assert.doesNotMatch(source, /sourceData\.tenant_summary|occupancyDenominator/u);
  assert.match(source, /function\s+homeFiniteNumber\s*\(value\)/u);
  assert.match(source, /if\s*\(value\s*===\s*["']{2}\s*\|\|\s*value\s*==\s*null\)\s*return\s+null/u);
  assert.match(source, /homeFiniteNumber\(occupancySummary\.occupied_area_sqm\)/u);
});

test('정규화가 필요한 홈 엔티티도 복제본에서 만들고 서버 원본 참조를 공유하지 않는다', () => {
  assert.match(cloneRegion, /asset:\s*cloned\?\.asset\s*\?\s*\{\s*\.\.\.cloned\.asset\s*\}\s*:\s*null/u);
  assert.match(cloneRegion, /cloned\?\.funds/u);
  assert.match(cloneRegion, /cloned\?\.investments/u);
  assert.match(cloneRegion, /cloned\?\.loans/u);
  assert.doesNotMatch(cloneRegion, /data\?\.(?:asset|funds|investments|loans)/u);
});

test('홈 저장은 행별 key mutation 대신 허용 필드만 담은 전체 문서 builder를 사용한다', () => {
  const homePanelRegion = source.slice(
    source.indexOf('function HomePanel'),
    source.indexOf('function RentRollPanel'),
  );
  assert.match(homePanelRegion, /buildHomeDocumentPayload\(homeDraft\)/u);
  assert.match(homePanelRegion, /asset_code:\s*assetCode/u);
  assert.match(homePanelRegion, /documentsEqual\(homeDocument,\s*readbackDocument\)/u);
  assert.doesNotMatch(homePanelRegion, /entity_key|asset_key|fund_key|beneficiary_key|loan_key/u);
});
