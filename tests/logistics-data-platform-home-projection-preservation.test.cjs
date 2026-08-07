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
  assert.match(source, /sourceData\.tenant_summary\s*\|\|\s*sourceData\.occupancy_summary/u);
  assert.match(source, /tenantSummary\.denominator_area_sqm/u);
  assert.match(source, /tenantSummary\.occupancy_rate/u);
  assert.match(source, /function\s+homeFiniteNumber\s*\(value\)/u);
  assert.match(source, /if\s*\(value\s*===\s*["']{2}\s*\|\|\s*value\s*==\s*null\)\s*return\s+null/u);
  assert.match(source, /homeFiniteNumber\(tenantSummary\.occupied_area_sqm\)/u);
  assert.match(source, /homeFiniteNumber\(tenantSummary\.occupancy_rate\)/u);
});

test('정규화가 필요한 홈 엔티티도 복제본에서 만들고 서버 원본 참조를 공유하지 않는다', () => {
  assert.match(cloneRegion, /asset:\s*cloned\?\.asset\s*\?\s*\{\s*\.\.\.cloned\.asset\s*\}\s*:\s*null/u);
  assert.match(cloneRegion, /cloned\?\.funds/u);
  assert.match(cloneRegion, /cloned\?\.investments/u);
  assert.match(cloneRegion, /cloned\?\.loans/u);
  assert.doesNotMatch(cloneRegion, /data\?\.(?:asset|funds|investments|loans)/u);
});

test('홈 저장 payload는 보존한 서버 메타데이터를 포함하지 않고 허용 엔티티 필드만 전송한다', () => {
  const operationsRegion = source.slice(
    source.indexOf('export function buildHomeOperations'),
    source.indexOf('function MaturityList'),
  );
  assert.match(operationsRegion, /HOME_ENTITY_CONFIG\.forEach/u);
  assert.match(operationsRegion, /config\.fields/u);
  assert.doesNotMatch(operationsRegion, /tenant_summary|occupancy_summary|asset_source_provenance/u);
});
