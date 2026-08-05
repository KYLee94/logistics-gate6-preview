const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

async function main() {
  const modulePath = path.resolve(__dirname, '..', '..', 'src', 'features', 'logistics-data-platform', 'rentRollSchema.js');
  const schema = await import(`${pathToFileURL(modulePath).href}?contract=${Date.now()}`);

  assert.equal(Array.isArray(schema.RENT_ROLL_COLUMNS), true, 'compact rent-roll columns are required');
  assert.equal(Array.isArray(schema.RENT_ROLL_DETAIL_FIELDS), true, 'same-page rent-roll details are required');
  const visibleFields = new Set([
    ...schema.RENT_ROLL_COLUMNS.map((column) => column.key),
    ...schema.RENT_ROLL_DETAIL_FIELDS.map((column) => column.key),
  ]);
  const allFields = new Set([
    ...schema.RENT_ROLL_COLUMNS.map((column) => column.key),
    ...schema.RENT_ROLL_DETAIL_FIELDS.map((column) => column.key),
    ...Object.keys(schema.emptyRentRollRow('contract-fields')),
  ]);
  for (const field of [
    'occupancy_status', 'tenant_name', 'business_registration_number', 'use_category',
    'floor_label', 'zone_label', 'exclusive_area_sqm', 'common_area_sqm', 'leased_area_sqm',
    'efficiency_ratio', 'commencement_date', 'expiry_date',
    'deposit_total_krw', 'monthly_rent_total_krw', 'monthly_cam_total_krw',
    'rent_free_months', 'rent_free_schedule', 'deposit_escalation_rule',
    'rent_escalation_rule', 'cam_escalation_rule', 'fit_out_months', 'fit_out_amount',
    'effective_rent', 'tenant_cost_terms', 'landlord_cost_terms',
    'renewal_terms', 'termination_terms', 'restoration_terms', 'bond_terms',
    'operation_start_date', 'pallet_rack_fee', 'notes',
  ]) {
    assert.equal(allFields.has(field), true, `missing workbook-derived field: ${field}`);
  }
  for (const internalField of ['tenant_key', 'row_key', 'space_key', 'contract_key', 'rent_term_key']) {
    assert.equal(visibleFields.has(internalField), false, `internal identifier must not be a visible column: ${internalField}`);
  }
  assert.equal(schema.RENT_ROLL_COLUMNS.find((column) => column.key === 'tenant_name')?.kind, 'tenant');
  assert.equal(schema.RENT_ROLL_COLUMNS.every((column) => column.label && column.kind && column.width), true);

  const vacant = schema.emptyRentRollRow('vacant-1');
  vacant.occupancy_status = 'vacant';
  vacant.floor_label = '3F';
  assert.deepEqual(schema.validateUniversalRentRoll([vacant]), [], 'vacancy must not require tenant or lease dates');

  const occupied = schema.emptyRentRollRow('occupied-1');
  occupied.floor_label = '2F';
  occupied.commencement_date = '2026-01-01';
  occupied.expiry_date = '2027-01-01';
  assert.match(schema.validateUniversalRentRoll([occupied]).join('\n'), /임차인/u);

  occupied.tenant_key = 'tenant-verified';
  occupied.expiry_date = '2025-12-31';
  assert.match(schema.validateUniversalRentRoll([occupied]).join('\n'), /계약만기일/u);

  occupied.expiry_date = '2027-01-01';
  occupied.monthly_rent_total_krw = '-1';
  assert.match(schema.validateUniversalRentRoll([occupied]).join('\n'), /0 이상의 숫자/u);

  console.log('PASS logistics universal rent-roll template contract');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
