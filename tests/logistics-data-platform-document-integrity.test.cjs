const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..');
const source = fs.readFileSync(
  path.join(ROOT, 'src/features/logistics-data-platform/LogisticsDataPlatform.jsx'),
  'utf8',
);
const apiSource = fs.readFileSync(
  path.join(ROOT, 'src/features/logistics-data-platform/api.js'),
  'utf8',
);

function region(start, end) {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex + start.length);
  assert.ok(startIndex >= 0 && endIndex > startIndex, `${start} region missing`);
  return source.slice(startIndex, endIndex);
}

test('home occupancy renders only the selected primary home occupancy summary', () => {
  const home = region('function HomePanel', 'function RentRollPanel');
  assert.match(apiSource, /response\.ok !== true \|\| response\.status !== 'primary'/u);
  assert.match(home, /primaryHomeDataForAsset\(resource\.data, assetCode\)/u);
  assert.match(home, /const\s+occupancySummary\s*=\s*sourceData\.occupancy_summary\s*\|\|\s*\{\}/u);
  assert.match(home, /homeFiniteNumber\(occupancySummary\.occupancy_rate\)/u);
  assert.match(home, /rows\.filter\(\(row\)\s*=>\s*isCurrentOccupiedRentRollRow\(row,\s*homeAsOfDate\)\)/u);
  assert.doesNotMatch(home, /tenant_summary|leasable_area_sqm[\s\S]{0,160}occupancyRate/u);
});

test('rent-roll full document save preserves expired rows and verifies primary readback', () => {
  const rent = region('function RentRollPanel', 'function periodFor');
  assert.match(rent, /buildRentRollDocumentPayload\(rows,\s*\{\s*asOfDate:\s*todayKst\(\)\s*\}\)/u);
  assert.match(rent, /expected_xmin:\s*rentRevision/u);
  assert.match(rent, /documentsEqual\(intendedDocument,\s*readbackDocument\)/u);
  assert.match(rent, /setRentRevision\(readbackResponse\.revision\)/u);
  assert.match(rent, /isExpiredRentRollRow\(row,\s*todayKst\(\)\)/u);
});

test('asset, fund, rent-roll, and income-expense documents require full readback equality', () => {
  const home = region('function HomePanel', 'function RentRollPanel');
  const rent = region('function RentRollPanel', 'function periodFor');
  const finance = region('function FinancePanel', 'export default function LogisticsDataPlatform');

  assert.match(home, /buildHomeDocumentPayload\(homeDraft\)/u);
  assert.match(home, /expected_revisions:\s*\{[\s\S]{0,180}asset:[\s\S]{0,180}fund:/u);
  assert.match(home, /documentsEqual\(homeDocument,\s*readbackDocument\)/u);
  assert.match(home, /setHomeSnapshot\(snapshot\)/u);

  assert.match(rent, /buildRentRollDocumentPayload\([\s\S]{0,120}readbackRows,[\s\S]{0,120}asOfDate:\s*todayKst\(\)/u);
  assert.match(rent, /RENT_ROLL_DOCUMENT_READBACK_MISMATCH/u);

  assert.match(finance, /buildIncomeExpenseDocumentPayload\(statement\)/u);
  assert.match(finance, /expected_xmin:\s*financeRevision/u);
  assert.match(finance, /documentsEqual\(documentPayload,\s*readbackPayload\)/u);
  assert.match(finance, /setFinanceRevision\(readback\.revision\)/u);
});
