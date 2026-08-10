const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const scriptPath = path.resolve(__dirname, '../scripts/qa/logistics-rent-roll-floor-audit.cjs');

test('Excel local-midnight dates keep the displayed calendar date', () => {
  const { canonicalDate } = require(scriptPath);
  assert.equal(canonicalDate(new Date(2024, 7, 1)), '2024-08-01');
});

test('reference workbook dates stay as Excel serials until timezone-free SSF parsing', () => {
  const { canonicalDate } = require(scriptPath);
  const XLSX = require('xlsx');
  const source = fs.readFileSync(scriptPath, 'utf8');
  assert.match(source, /XLSX\.readFile\(filePath, \{ cellDates: false \}\)/u);
  assert.equal(canonicalDate(45505, XLSX), '2024-08-01');
});

test('floor audit identifies blank and underground rows without changing source rows', () => {
  const { auditFloorRows } = require(scriptPath);
  const source = [
    { tenant_name: 'A', floor_label: 'B2~B1', leased_area_sqm: 100 },
    { tenant_name: 'B', floor_label: '', leased_area_sqm: 200 },
    { tenant_name: 'C', floor_label: null, leased_area_sqm: 300 },
    { tenant_name: 'D', floor_label: '3', leased_area_sqm: 400 },
  ];
  const before = structuredClone(source);
  const result = auditFloorRows({ asset_code: 'A1', asset_name: 'Asset' }, source);

  assert.equal(result.row_count, 4);
  assert.equal(result.floor_blank_count, 2);
  assert.deepEqual(result.floor_blank_rows.map((row) => row.row_index), [2, 3]);
  assert.deepEqual(result.underground_rows.map((row) => row.row_index), [1]);
  assert.deepEqual(source, before);
});

test('reference matching is exact on asset, tenant, area, commencement, and expiry', () => {
  const { exactMatchReferenceRows } = require(scriptPath);
  const apiRows = [
    {
      asset_code: 'A1', tenant_name: 'Tenant A', leased_area_sqm: 100,
      commencement_date: '2025-01-01', expiry_date: '2027-12-31', floor_label: '',
    },
    {
      asset_code: 'A1', tenant_name: 'Tenant B', leased_area_sqm: 200,
      commencement_date: '2025-01-01', expiry_date: '2027-12-31', floor_label: '',
    },
  ];
  const references = [
    {
      source_row: 11, asset_code: 'A1', tenant_name: 'Tenant A', leased_area_sqm: 100,
      commencement_date: '2025-01-01', expiry_date: '2027-12-31', floor_label: 'B1',
    },
    {
      source_row: 12, asset_code: 'A1', tenant_name: 'Tenant B ', leased_area_sqm: 200,
      commencement_date: '2025-01-01', expiry_date: '2027-12-31', floor_label: '2',
    },
  ];

  const result = exactMatchReferenceRows(apiRows, references);
  assert.equal(result[0].status, 'exact');
  assert.equal(result[0].reference.floor_label, 'B1');
  assert.equal(result[0].underground_evidence, true);
  assert.equal(result[1].status, 'unmatched');
});

test('reference matching compares leased area at the operating two-decimal precision', () => {
  const { exactMatchReferenceRows } = require(scriptPath);
  const apiRows = [{
    asset_code: 'A1', tenant_name: 'Tenant A', leased_area_sqm: 100.004,
    commencement_date: '2025-01-01', expiry_date: '2027-12-31', floor_label: '',
  }];
  const references = [{
    source_row: 11, asset_code: 'A1', tenant_name: 'Tenant A', leased_area_sqm: 100,
    commencement_date: '2025-01-01', expiry_date: '2027-12-31', floor_label: 'B1',
  }];

  const result = exactMatchReferenceRows(apiRows, references);
  assert.equal(result[0].status, 'exact');
  assert.equal(result[0].reference.source_row, 11);
});

test('duplicate exact reference tuples remain ambiguous and are never auto-selected', () => {
  const { exactMatchReferenceRows } = require(scriptPath);
  const api = [{
    asset_code: 'A1', tenant_name: 'A', leased_area_sqm: 1,
    commencement_date: null, expiry_date: null, floor_label: '',
  }];
  const duplicate = {
    asset_code: 'A1', tenant_name: 'A', leased_area_sqm: 1,
    commencement_date: null, expiry_date: null, floor_label: 'B1',
  };
  const result = exactMatchReferenceRows(api, [
    { ...duplicate, source_row: 10 },
    { ...duplicate, source_row: 11 },
  ]);
  assert.equal(result[0].status, 'ambiguous');
  assert.equal(result[0].candidates.length, 2);
  assert.equal(result[0].reference, null);
});

test('source classification separates strict, approved unique normalization, and source dash', () => {
  const { classifyFloorSourceRows } = require(scriptPath);
  const base = {
    asset_code: 'A1', tenant_name: 'Tenant', business_registration_number: '123-45-67890',
    commencement_date: '2025-01-01', floor_label: '',
  };
  const apiRows = [
    { ...base, row_index: 1, leased_area_sqm: 100, expiry_date: '2027-12-31' },
    { ...base, row_index: 2, leased_area_sqm: 201, expiry_date: '2028-12-31' },
    { ...base, row_index: 3, leased_area_sqm: 300, expiry_date: null },
    {
      asset_code: 'A2', tenant_name: '-', business_registration_number: null,
      row_index: 1, leased_area_sqm: 400, commencement_date: null, expiry_date: null, floor_label: '',
    },
  ];
  const references = [
    { ...base, source_row: 10, leased_area_sqm: 100.004, expiry_date: '2027-12-31', floor_label: 'B1' },
    { ...base, source_row: 11, leased_area_sqm: 200.6, expiry_date: '2028-12-31', floor_label: 'B2' },
    {
      ...base, source_row: 12, leased_area_sqm: 300,
      expiry_date: '2028-06-30/2029-12-31', floor_label: 'B2~3',
    },
    {
      asset_code: 'A2', tenant_name: '-', business_registration_number: null,
      source_row: 13, leased_area_sqm: 400, commencement_date: '-', expiry_date: '-', floor_label: '-',
    },
  ];

  const result = classifyFloorSourceRows(apiRows, references);
  assert.deepEqual(result.map((row) => row.status), [
    'strict_exact', 'approved_unique_normalized', 'approved_unique_normalized', 'excluded_source_dash',
  ]);
  assert.equal(result[1].normalization_rule, 'source_area_integer_rounding');
  assert.equal(result[2].normalization_rule, 'source_composite_expiry_to_operating_null');
  assert.deepEqual(result.slice(0, 3).map((row) => row.reference.source_row), [10, 11, 12]);
});

test('approved normalization remains fail-closed on business number mismatch or duplicates', () => {
  const { classifyFloorSourceRows } = require(scriptPath);
  const api = [{
    asset_code: 'A1', tenant_name: 'Tenant', business_registration_number: 'API-NO',
    row_index: 1, leased_area_sqm: 201, commencement_date: '2025-01-01',
    expiry_date: '2028-12-31', floor_label: '',
  }];
  const reference = {
    asset_code: 'A1', tenant_name: 'Tenant', business_registration_number: 'SOURCE-NO',
    leased_area_sqm: 200.6, commencement_date: '2025-01-01',
    expiry_date: '2028-12-31', floor_label: 'B1',
  };
  assert.equal(classifyFloorSourceRows(api, [{ ...reference, source_row: 10 }])[0].status, 'unmatched');
  const duplicates = [
    { ...reference, business_registration_number: 'API-NO', source_row: 10 },
    { ...reference, business_registration_number: 'API-NO', source_row: 11 },
  ];
  assert.equal(classifyFloorSourceRows(api, duplicates)[0].status, 'ambiguous');
});

test('floor-only transformation preserves row count, order, and every non-floor value', () => {
  const { verifyFloorOnlyTransformation } = require(scriptPath);
  const before = [
    { tenant_name: 'A', floor_label: '', leased_area_sqm: 100, notes: 'keep' },
    { tenant_name: 'B', floor_label: '2', leased_area_sqm: 200, notes: null },
  ];
  const after = [
    { tenant_name: 'A', floor_label: 'B1', leased_area_sqm: 100, notes: 'keep' },
    { tenant_name: 'B', floor_label: '2', leased_area_sqm: 200, notes: null },
  ];
  assert.deepEqual(verifyFloorOnlyTransformation(before, after), {
    before_total: 2,
    after_total: 2,
    before_blank: 1,
    after_blank: 0,
    changed_floor_rows: [1],
    non_floor_immutable: true,
  });
  assert.throws(() => verifyFloorOnlyTransformation(before, [
    { ...after[0], leased_area_sqm: 101 },
    after[1],
  ]), /NON_FLOOR_FIELD_CHANGED/u);
});

test('operating floor audit is fail-closed read-only for exactly 19 assets and 81 rows', () => {
  const source = fs.readFileSync(scriptPath, 'utf8');
  assert.match(source, /v2\/home\/read/u);
  assert.match(source, /v2\/rent-roll\/read/u);
  assert.match(source, /expectedAssetCount\s*=\s*19/u);
  assert.match(source, /expectedRowCount\s*=\s*81/u);
  assert.match(source, /production_mutation_used:\s*false/u);
  assert.doesNotMatch(source, /batch-save|batch_save|exercise-browser-writes/u);
});
