const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');
const { pathToFileURL } = require('node:url');

const ROOT = path.resolve(__dirname, '..');

async function routerModule() {
  const target = path.join(ROOT, 'supabase', 'functions', 'll-dashboard-api', 'v2', 'router.ts');
  return import(`${pathToFileURL(target).href}?test=${Date.now()}-${Math.random()}`);
}

test('home document save accepts the exact asset and fund documents without legacy operations', async () => {
  const router = await routerModule();
  const payload = {
    asset: { asset_code: 'A120085001', fund_code: '120085', name: '경산 쿠팡물류센터' },
    funds: [{ fund_code: '120085', name: '펀드', investments: [], loans: [] }],
    expected_xmin: '31415',
  };
  const args = router.buildRpcArguments('v2/home/batch-save', {
    client_request_id: '11111111-1111-4111-8111-111111111111',
    asset_code: 'A120085001',
    payload,
    expected_revisions: { asset: '31415', fund: '27182' },
  });

  assert.equal(args.p_asset_key, 'A120085001');
  assert.deepEqual(args.p_payload, payload);
  assert.deepEqual(args.p_expected_revisions, { asset: '31415', fund: '27182' });
  assert.equal(Object.hasOwn(args.p_payload, 'operations'), false);
});

test('home document save rejects an asset/fund envelope that the four-table writer would only partially apply', async () => {
  const router = await routerModule();
  const baseRequest = {
    client_request_id: '11111111-1111-4111-8111-111111111112',
    asset_code: 'ASSET-01',
  };

  assert.throws(() => router.buildRpcArguments('v2/home/batch-save', {
    ...baseRequest,
    payload: {
      asset: { asset_code: 'ASSET-02', fund_code: 'FUND-01' },
      funds: [{ fund_code: 'FUND-01', investments: [], loans: [] }],
    },
  }), /HOME_ASSET_CODE_MISMATCH/);

  assert.throws(() => router.buildRpcArguments('v2/home/batch-save', {
    ...baseRequest,
    payload: {
      asset: { asset_code: 'ASSET-01', fund_code: 'FUND-01' },
      funds: [
        { fund_code: 'FUND-01', investments: [], loans: [] },
        { fund_code: 'FUND-02', investments: [], loans: [] },
      ],
    },
  }), /HOME_SINGLE_LINKED_FUND_REQUIRED/);

  assert.throws(() => router.buildRpcArguments('v2/home/batch-save', {
    ...baseRequest,
    payload: {
      asset: { asset_code: 'ASSET-01', fund_code: 'FUND-01' },
      funds: [{ fund_code: 'FUND-02', investments: [], loans: [] }],
    },
  }), /HOME_FUND_CODE_MISMATCH/);
});

test('finance document save passes the visible statement without creating entry or account identifiers', async () => {
  const router = await routerModule();
  const statement = {
    periods: ['2026-08'],
    potential_income: [{ name: '임대료', selected: true, amounts: { '2026-08': 0 } }],
    income_loss: [],
    operating_expense: [],
    below_noi: [],
    debt_service: [],
  };
  const args = router.buildRpcArguments('v2/finance/batch-save', {
    client_request_id: '22222222-2222-4222-8222-222222222222',
    asset_code: 'A120085001',
    payload: { statement, expected_xmin: '7' },
  });

  assert.deepEqual(args.p_payload, { statement, expected_xmin: '7' });
  assert.equal(JSON.stringify(args.p_payload).includes('account_code'), false);
  assert.equal(JSON.stringify(args.p_payload).includes('entry_key'), false);
});

test('rent-roll document normalization stores only editable source values and canonical rent-free periods', async () => {
  const router = await routerModule();
  const args = router.buildRpcArguments('v2/rent-roll/batch-save', {
    client_request_id: '33333333-3333-4333-8333-333333333333',
    asset_code: 'A120085001',
    payload: {
      expected_xmin: '9',
      rows: [{
        tenant_name: '쿠팡(주)',
        leased_area_sqm: '1234.5',
        deposit_escalation_enabled: false,
        deposit_total_krw: '',
        signed_date: '',
        commencement_date: '2026-01-01',
        security_ratio: 0.03,
        rent_escalation_rate: 0.03,
        rent_free_periods: [{
          start_date: '2026-01-01',
          end_date: '2026-01-31',
          months: 1,
          reason: '재계약',
          notes: '확정',
          period_key: 'legacy-period',
        }],
        fit_out_months: 2,
        effective_rent: 100,
        row_key: 'legacy-row',
      }],
    },
  });

  assert.equal(args.p_payload.rows[0].rent_escalation_rate, '3%');
  assert.equal(args.p_payload.rows[0].security_ratio, '3%');
  assert.equal(args.p_payload.rows[0].leased_area_sqm, 1234.5);
  assert.equal(args.p_payload.rows[0].deposit_total_krw, null);
  assert.equal(args.p_payload.rows[0].signed_date, null);
  assert.equal(args.p_payload.rows[0].commencement_date, '2026-01-01');
  assert.deepEqual(args.p_payload.rows[0].rent_free_periods, [{
    start_date: '2026-01-01',
    end_date: '2026-01-31',
    months: 1,
    reason: '재계약',
    notes: '확정',
  }]);
  assert.equal(Object.hasOwn(args.p_payload.rows[0], 'row_key'), false);
  assert.equal(Object.hasOwn(args.p_payload.rows[0], 'effective_rent'), false);
  assert.equal(args.p_payload.rows[0].fit_out_months, 2);
});

test('rent-roll document keeps the required deposit escalation toggle through the Edge normalizer', async () => {
  const router = await routerModule();
  const args = router.buildRpcArguments('v2/rent-roll/batch-save', {
    client_request_id: '33333333-3333-4333-8333-333333333336',
    asset_code: 'A120085001',
    payload: {
      expected_xmin: '11',
      rows: [{
        tenant_name: 'Tenant',
        leased_area_sqm: 100,
        deposit_escalation_enabled: false,
      }],
    },
  });

  assert.equal(
    Object.hasOwn(args.p_payload.rows[0], 'deposit_escalation_enabled'),
    true,
    'the database requires an explicit boolean on every stored rent-roll row',
  );
  assert.equal(args.p_payload.rows[0].deposit_escalation_enabled, false);
});

test('rent-roll document preserves a positive month-only legacy rent-free period', async () => {
  const router = await routerModule();
  const args = router.buildRpcArguments('v2/rent-roll/batch-save', {
    client_request_id: '33333333-3333-4333-8333-333333333334',
    asset_code: 'A120085001',
    payload: {
      expected_xmin: '10',
      rows: [{
        tenant_name: '쿠팡(주)',
        deposit_escalation_enabled: false,
        rent_free_periods: [{ months: 2 }],
      }],
    },
  });
  assert.deepEqual(args.p_payload.rows[0].rent_free_periods, [{
    months: 2,
    reason: null,
    notes: null,
  }]);
});

test('rent-roll document accepts the numeric primary revision returned by the API and canonicalizes xmin to text', async () => {
  const router = await routerModule();
  const args = router.buildRpcArguments('v2/rent-roll/batch-save', {
    client_request_id: '33333333-3333-4333-8333-333333333335',
    asset_code: 'A112527001',
    payload: {
      expected_xmin: 158381,
      rows: [{ tenant_name: 'Tenant', leased_area_sqm: 100, deposit_escalation_enabled: false }],
    },
  });
  assert.equal(args.p_payload.expected_xmin, '158381');
});

test('legacy home operations are rejected instead of reaching the four-table document writer', async () => {
  const router = await routerModule();
  assert.throws(
    () => router.buildRpcArguments('v2/home/batch-save', {
      client_request_id: '44444444-4444-4444-8444-444444444444',
      asset_code: 'A120085001',
      payload: {
        operations: [{ entity: 'asset', entity_key: 'legacy-key', field: 'name', value: '변경' }],
      },
    }),
    /HOME_DOCUMENT_REQUIRED/,
  );
});

test('legacy rent-roll delta rows are rejected before they can replace the full document', async () => {
  const router = await routerModule();
  assert.throws(
    () => router.buildRpcArguments('v2/rent-roll/batch-save', {
      client_request_id: '55555555-5555-4555-8555-555555555555',
      asset_code: 'A120085001',
      payload: {
        rows: [{ operation: 'update', row_key: 'legacy-row', tenant_name: '수정된 한 행' }],
      },
    }),
    /RENT_ROLL_DOCUMENT_REQUIRED/,
  );
});

test('all legacy finance mutation shapes are rejected instead of being normalized downstream', async () => {
  const router = await routerModule();
  const legacyPayloads = [
    { entries: [] },
    { operations: [] },
    {
      entries: [{
        operation: 'create',
        entry_key: 'legacy-entry',
        month: '2026-08',
        account_code: 'legacy-account',
        amount: 1,
      }],
    },
  ];

  for (const payload of legacyPayloads) {
    assert.throws(
      () => router.buildRpcArguments('v2/finance/batch-save', {
        client_request_id: '66666666-6666-4666-8666-666666666666',
        asset_code: 'A120085001',
        payload,
      }),
      /FINANCE_DOCUMENT_REQUIRED/,
    );
  }
});
