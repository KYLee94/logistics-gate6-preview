const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

async function main() {
  const modulePath = path.resolve(__dirname, '..', '..', 'src', 'features', 'logistics-data-platform', 'rentRollSchema.js');
  const schema = await import(`${pathToFileURL(modulePath).href}?contract=${Date.now()}`);

  assert.deepEqual(schema.RENT_ROLL_COLUMN_GROUPS.map((group) => group.label), [
    '핵심 열',
    '계약 조건',
    '비용·권리',
    '부가 정보',
  ]);

  const allFields = new Set(schema.RENT_ROLL_COLUMN_GROUPS.flatMap((group) => group.columns.map((column) => column.key)));
  for (const field of [
    'tenant_name', 'floor_label', 'leased_area_sqm', 'commencement_date', 'expiry_date',
    'deposit_total_krw', 'monthly_rent_total_krw', 'monthly_cam_total_krw',
    'rent_free_schedule', 'rent_escalation_rule', 'tenant_cost_terms', 'landlord_cost_terms',
    'renewal_terms', 'termination_terms', 'restoration_terms', 'bond_terms',
    'operation_start_date', 'pallet_rack_fee',
  ]) {
    assert.equal(allFields.has(field), true, `missing workbook-derived field: ${field}`);
  }

  const vacant = schema.emptyRentRollRow('vacant-1');
  vacant.occupancy_status = 'vacant';
  vacant.floor_label = '3F';
  assert.deepEqual(schema.validateUniversalRentRoll([vacant]), [], 'vacancy must not require tenant or lease dates');

  const occupied = schema.emptyRentRollRow('occupied-1');
  occupied.floor_label = '2F';
  occupied.commencement_date = '2026-01-01';
  occupied.expiry_date = '2027-01-01';
  assert.match(schema.validateUniversalRentRoll([occupied]).join('\n'), /임차인/u);

  occupied.tenant_name = '검증용 임차인';
  occupied.exclusive_area_sqm = '10';
  occupied.common_area_sqm = '2';
  occupied.leased_area_sqm = '20';
  assert.match(schema.validateUniversalRentRoll([occupied]).join('\n'), /임대면적/u);

  occupied.leased_area_sqm = '12';
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
