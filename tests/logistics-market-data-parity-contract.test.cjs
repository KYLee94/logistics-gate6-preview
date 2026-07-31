const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..');
const paritySource = fs.readFileSync(
  path.join(ROOT, 'scripts', 'qa', 'logistics-market-data-parity-audit.cjs'),
  'utf8',
);
const readbackSource = fs.readFileSync(
  path.join(ROOT, 'scripts', 'qa', 'logistics-market-data-readback-smoke.cjs'),
  'utf8',
);

test('market parity reads the real workbook without requiring a generated QA copy', () => {
  assert.match(paritySource, /parseSourceWorkbook/);
  assert.match(paritySource, /LOGISTICS_MARKET_WORKBOOK/);
  assert.match(paritySource, /물류 시장 데이터_20261Q\.xlsx/);
  assert.doesNotMatch(paritySource, /Extracted workbook artifact not found/);
});

test('market readback identifies the active source by stable business fields', () => {
  const activeSourceCheck = readbackSource.match(/active_source_only:[\s\S]*?\),\s*\n/);
  assert.ok(activeSourceCheck);
  assert.match(activeSourceCheck[0], /source_domain/);
  assert.match(activeSourceCheck[0], /source_version/);
  assert.match(activeSourceCheck[0], /file_name/);
  assert.doesNotMatch(activeSourceCheck[0], /source_file_id/);
});
