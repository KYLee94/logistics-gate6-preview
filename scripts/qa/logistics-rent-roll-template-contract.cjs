const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

async function main() {
  const modulePath = path.resolve(
    __dirname,
    '..',
    '..',
    'src',
    'features',
    'logistics-data-platform',
    'rentRollSchema.js',
  );
  const schema = await import(`${pathToFileURL(modulePath).href}?contract=${Date.now()}`);

  assert.equal(Array.isArray(schema.RENT_ROLL_COLUMNS), true);
  assert.equal(schema.RENT_ROLL_COLUMNS.length >= 55, true, 'the workbook-derived flat schema must be complete');
  assert.deepEqual(schema.RENT_ROLL_DETAIL_FIELDS, [], 'all rent-roll fields must stay in one grid');

  const visibleFields = new Set(schema.RENT_ROLL_COLUMNS.map(({ key }) => key));
  const allFields = new Set([...visibleFields, ...Object.keys(schema.emptyRentRollRow('contract-fields'))]);
  for (const field of [
    'occupancy_status',
    'tenant_name',
    'business_registration_number',
    'temperature_type',
    'use_category',
    'goods_type',
    'floor_label',
    'zone_label',
    'subtenant_name',
    'free_area_type',
    'exclusive_area_sqm',
    'common_area_sqm',
    'leased_area_sqm',
    'commencement_date',
    'expiry_date',
    'deposit_total_krw',
    'monthly_rent_total_krw',
    'monthly_cam_total_krw',
    'rent_free_months',
    'rent_free_start_date',
    'rent_free_end_date',
    'deposit_escalation_first_date',
    'deposit_escalation_interval_months',
    'deposit_escalation_rate',
    'rent_escalation_first_date',
    'rent_escalation_interval_months',
    'rent_escalation_rate',
    'cam_escalation_first_date',
    'cam_escalation_interval_months',
    'cam_escalation_rate',
    'tenant_cost_terms',
    'landlord_cost_terms',
    'renewal_terms',
    'termination_terms',
    'restoration_terms',
    'current_total_cost_per_py_krw',
    'notes',
  ]) {
    assert.equal(allFields.has(field), true, `missing workbook-derived scalar field: ${field}`);
  }

  for (const internalField of ['tenant_key', 'row_key', 'space_key', 'contract_key', 'rent_term_key']) {
    assert.equal(visibleFields.has(internalField), false, `internal ID must not be visible: ${internalField}`);
  }
  assert.equal(schema.RENT_ROLL_COLUMNS.find(({ key }) => key === 'tenant_name')?.kind, 'text');
  assert.equal(schema.RENT_ROLL_COLUMNS.every(({ label, kind, width }) => label && kind && width), true);

  const vacant = schema.emptyRentRollRow('vacant-1');
  vacant.occupancy_status = 'vacant';
  vacant.floor_label = '3F';
  assert.deepEqual(schema.validateUniversalRentRoll([vacant]), [], 'vacancy needs no tenant or lease dates');

  const occupied = schema.emptyRentRollRow('occupied-1');
  occupied.floor_label = '2F';
  occupied.tenant_name = '테스트 임차인';
  occupied.commencement_date = '2026-01-01';
  occupied.expiry_date = '2027-01-01';
  occupied.leased_area_sqm = 1_000;
  occupied.monthly_rent_total_krw = 10_000_000;
  occupied.monthly_cam_total_krw = 1_000_000;
  assert.deepEqual(schema.validateUniversalRentRoll([occupied]), []);
  assert.equal(schema.calculateRentRollENoc(occupied), 36_363.64, 'E.NOC must follow the legacy Supabase formula');

  occupied.expiry_date = '2025-12-31';
  assert.equal(schema.validateUniversalRentRoll([occupied]).length, 1, 'expiry must follow commencement');
  occupied.expiry_date = '2027-01-01';
  occupied.monthly_rent_total_krw = '-1';
  assert.equal(schema.validateUniversalRentRoll([occupied]).length, 1, 'negative inputs must be rejected');

  console.log('PASS logistics flat rent-roll workbook contract');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
