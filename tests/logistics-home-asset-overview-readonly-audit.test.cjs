const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const SCRIPT_PATH = path.resolve(
  __dirname,
  '../scripts/qa/logistics-home-asset-overview-readonly-audit.cjs',
);
const source = fs.readFileSync(SCRIPT_PATH, 'utf8');
const {
  OVERVIEW_FIELDS,
  auditAssetOverview,
  isMissing,
} = require(SCRIPT_PATH);

test('overview audit reports each missing field with its source without inventing values', () => {
  const audit = auditAssetOverview({
    asset: {
      asset_code: 'A1',
      name: '테스트 물류센터',
      address: '서울특별시',
      land_area_sqm: 0,
      gross_area_sqm: 100,
    },
    asset_source_provenance: {
      land_area_sqm: 'building_register_cache',
    },
  });

  assert.deepEqual(OVERVIEW_FIELDS.slice(0, 3), ['name', 'address', 'zoning_text']);
  assert.equal(audit.fields.land_area_sqm.missing, false);
  assert.equal(audit.fields.land_area_sqm.value, 0);
  assert.equal(audit.fields.land_area_sqm.source, 'building_register_cache');
  assert.equal(audit.fields.zoning_text.missing, true);
  assert.equal(audit.fields.zoning_text.value, null);
  assert.equal(audit.missing_fields.includes('zoning_text'), true);
  assert.equal(isMissing('  '), true);
  assert.equal(isMissing(0), false);
});

test('live overview audit is read-only and excludes only the two retired asset codes', () => {
  assert.match(source, /const ALLOWED_ACTION = 'v2\/home\/read'/u);
  assert.match(source, /'A112127001', 'AP00014001'/u);
  assert.match(source, /database_write_used: false/u);
  assert.match(source, /argValue\('output'\)/u);
  assert.doesNotMatch(source, /batch-save|force_refresh|insert\(|update\(|delete\(/iu);
});
