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
  const documentPath = path.resolve(
    __dirname,
    '..',
    '..',
    'src',
    'features',
    'logistics-data-platform',
    'documentContract.js',
  );
  const documents = await import(`${pathToFileURL(documentPath).href}?contract=${Date.now()}`);

  assert.equal(Array.isArray(schema.RENT_ROLL_COLUMNS), true);
  assert.equal(schema.RENT_ROLL_COLUMNS.length >= 50, true, 'the approved workbook-derived flat schema must be complete');
  assert.deepEqual(schema.RENT_ROLL_DETAIL_FIELDS, [], 'all rent-roll fields must stay in one grid');

  const visibleFields = new Set(schema.RENT_ROLL_COLUMNS.map(({ key }) => key));
  const allFields = new Set([...visibleFields, ...Object.keys(schema.emptyRentRollRow('contract-fields'))]);
  for (const field of [
    'occupancy_status',
    'tenant_name',
    'business_registration_number',
    'temperature_type',
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
  assert.equal(schema.RENT_ROLL_COLUMNS.find(({ key }) => key === 'temperature_type')?.label, '용도');
  for (const removed of ['use_category', 'construction_start_date', 'completion_date', 'rent_calculation_method']) {
    assert.equal(visibleFields.has(removed), false, `removed rent-roll field must stay absent: ${removed}`);
  }
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

  const payload = documents.buildRentRollDocumentPayload([
    {
      ...occupied,
      row_key: 'legacy-row',
      tenant_key: 'legacy-tenant',
      source_kind: 'projection',
      revision: 7,
      meta: { imported: true },
      current_total_cost_per_py_krw: 36_363.64,
      rent_free_months: 1,
      rent_free_start_date: '2026-02-01',
      rent_free_end_date: '2026-02-28',
      rent_free_periods: [{
        start_date: '2026-02-01',
        end_date: '2026-02-28',
        reason: '계약',
        notes: '확정',
        period_key: 'legacy-period',
        source_id: 'legacy-source',
      }],
    },
  ]);
  assert.equal(payload.rows.length, 1, 'the complete ordered grid must become one rows document');
  assert.deepEqual(payload.rows[0].rent_free_periods, [{
    start_date: '2026-02-01',
    end_date: '2026-02-28',
    months: 0.89,
    reason: '계약',
    notes: '확정',
  }]);
  for (const forbidden of [
    'row_key', 'tenant_key', 'source_kind', 'source_id', 'revision', 'meta',
    'current_total_cost_per_py_krw', 'rent_free_months', 'rent_free_start_date',
    'rent_free_end_date', 'period_key',
  ]) {
    assert.equal(JSON.stringify(payload).includes(forbidden), false, `${forbidden} leaked into rows document`);
  }

  occupied.expiry_date = '2025-12-31';
  assert.equal(schema.validateUniversalRentRoll([occupied]).length, 1, 'expiry must follow commencement');
  occupied.expiry_date = '2027-01-01';
  occupied.monthly_rent_total_krw = '-1';
  assert.equal(schema.validateUniversalRentRoll([occupied]).length, 1, 'negative inputs must be rejected');

  console.log('PASS logistics flat rent-roll UI and full-document contract');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
