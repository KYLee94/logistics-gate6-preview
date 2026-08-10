#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const ROOT = path.resolve(__dirname, '..', '..');
const V2_DIR = path.join(ROOT, 'supabase', 'functions', 'll-dashboard-api', 'v2');
const EDGE_INDEX = path.join(ROOT, 'supabase', 'functions', 'll-dashboard-api', 'index.ts');
const MIGRATION = path.join(
  ROOT,
  'supabase',
  'migrations',
  '20260807180000_simplify_logistics_core_to_four_ui_tables.sql',
);
const EXPECTED_ACTIONS = Object.freeze([
  'v2/home/read',
  'v2/home/batch-save',
  'v2/rent-roll/read',
  'v2/rent-roll/batch-save',
  'v2/finance/read',
  'v2/finance/batch-save',
  'v2/maturities/read',
  'v2/calculations/explain',
]);
const EXPECTED_RPCS = Object.freeze([
  'home_read', 'home_batch_save', 'rent_roll_read', 'rent_roll_batch_save',
  'finance_read', 'finance_batch_save', 'maturities_read', 'calculations_explain',
]);
const UUIDS = Object.freeze({
  home: '11111111-1111-4111-8111-111111111111',
  rent: '22222222-2222-4222-8222-222222222222',
  finance: '33333333-3333-4333-8333-333333333333',
});

const checks = [];
async function check(id, assertion, evidence) {
  try {
    const value = await assertion();
    checks.push({ id, ok: true, evidence: value ?? evidence });
  } catch (error) {
    checks.push({ id, ok: false, error: error.message });
  }
}

async function importFresh(name) {
  const target = path.join(V2_DIR, name);
  assert.ok(fs.existsSync(target), `missing module ${name}`);
  return import(`${pathToFileURL(target).href}?contract=${Date.now()}-${Math.random()}`);
}

async function main() {
  const contracts = await importFresh('contracts.ts');
  const router = await importFresh('router.ts');
  const migration = fs.readFileSync(MIGRATION, 'utf8');
  const edgeIndex = fs.readFileSync(EDGE_INDEX, 'utf8');

  await check('v2-contract-modules-load', () => {
    assert.equal(typeof contracts.primaryResponse, 'function');
    assert.equal(typeof router.buildRpcArguments, 'function');
  }, ['contracts.ts', 'router.ts']);

  await check('exactly-eight-public-actions', () => {
    assert.deepEqual([...contracts.V2_PUBLIC_ACTIONS], EXPECTED_ACTIONS);
    assert.deepEqual(EXPECTED_ACTIONS.map(router.rpcNameForAction), EXPECTED_RPCS);
    assert.throws(() => router.rpcNameForAction('v2/legacy/write'), /UNSUPPORTED_ACTION/u);
    return EXPECTED_ACTIONS;
  });

  await check('primary-response-has-exact-top-level-keys', () => {
    const response = contracts.primaryResponse({
      requestId: UUIDS.home,
      revision: 17,
      data: { asset_code: 'A120085001' },
    });
    assert.deepEqual(Object.keys(response), ['ok', 'status', 'request_id', 'revision', 'data']);
    assert.equal(response.status, 'primary');
    assert.equal(JSON.stringify(response).includes('fallback'), false);
    assert.equal(JSON.stringify(response).includes('stale'), false);
    return Object.keys(response);
  });

  await check('write-actions-require-client-request-id', () => {
    const canonical = { statement: { periods: [], potential_income: [], income_loss: [], operating_expense: [], below_noi: [], debt_service: [] }, expected_xmin: '7' };
    assert.throws(
      () => router.buildRpcArguments('v2/finance/batch-save', { asset_code: 'A1', payload: canonical }),
      /CLIENT_REQUEST_ID_REQUIRED/u,
    );
    assert.throws(
      () => router.buildRpcArguments('v2/finance/batch-save', { client_request_id: 'not-a-uuid', asset_code: 'A1', payload: canonical }),
      /CLIENT_REQUEST_ID_REQUIRED/u,
    );
  }, 'all writes require a UUID request id');

  await check('home-full-document-and-xmin-map', () => {
    const payload = {
      asset: { asset_code: 'A120085001', fund_code: '120085', name: '경산' },
      funds: [{ fund_code: '120085', name: '펀드', investments: [], loans: [] }],
    };
    const expectedRevisions = { asset: '41', fund: '42' };
    const args = router.buildRpcArguments('v2/home/batch-save', {
      client_request_id: UUIDS.home,
      asset_code: 'A120085001',
      payload,
      expected_revisions: expectedRevisions,
    });
    assert.deepEqual(args.p_payload, payload);
    assert.deepEqual(args.p_expected_revisions, expectedRevisions);
    assert.equal(Object.hasOwn(args.p_payload, 'operations'), false);
  }, 'asset plus fund documents and their xmin values pass unchanged');

  await check('rent-full-document-and-expected-xmin', () => {
    const args = router.buildRpcArguments('v2/rent-roll/batch-save', {
      client_request_id: UUIDS.rent,
      asset_code: 'A120085001',
      payload: {
        expected_xmin: '51',
        rows: [{
          tenant_name: '쿠팡',
          leased_area_sqm: 100,
          rent_escalation_rate: 0.03,
          row_key: 'legacy-row',
          source_kind: 'legacy-source',
          effective_rent: 999,
        }],
      },
    });
    assert.equal(args.p_payload.expected_xmin, '51');
    assert.equal(args.p_payload.rows[0].rent_escalation_rate, '3%');
    for (const forbidden of ['row_key', 'source_kind', 'effective_rent', 'operation']) {
      assert.equal(Object.hasOwn(args.p_payload.rows[0], forbidden), false);
    }
  }, 'complete rent rows are normalized to editable visible fields only');

  await check('finance-full-document-and-expected-xmin', () => {
    const statement = {
      periods: ['2026-08'],
      potential_income: [{ name: '임대료', selected: true, amounts: { '2026-08': 1 } }],
      income_loss: [], operating_expense: [], below_noi: [], debt_service: [],
    };
    const args = router.buildRpcArguments('v2/finance/batch-save', {
      client_request_id: UUIDS.finance,
      asset_code: 'A120085001',
      payload: { statement, expected_xmin: '61' },
    });
    assert.deepEqual(args.p_payload, { statement, expected_xmin: '61' });
    for (const forbidden of ['entries', 'operations', 'entry_key', 'account_code', 'source_kind']) {
      assert.equal(JSON.stringify(args.p_payload).includes(forbidden), false);
    }
  }, 'visible finance statement passes without ledger identifiers or provenance');

  await check('all-legacy-mutations-fail-closed', () => {
    const cases = [
      ['v2/home/batch-save', { operations: [] }, /HOME_DOCUMENT_REQUIRED/u],
      ['v2/rent-roll/batch-save', { rows: [{ operation: 'update', row_key: 'old' }] }, /RENT_ROLL_DOCUMENT_REQUIRED/u],
      ['v2/finance/batch-save', { entries: [] }, /FINANCE_DOCUMENT_REQUIRED/u],
      ['v2/finance/batch-save', { operations: [] }, /FINANCE_DOCUMENT_REQUIRED/u],
      ['v2/finance/batch-save', { entries: [{ operation: 'create', entry_key: 'old', account_code: 'x', month: '2026-08', amount: 1 }] }, /FINANCE_DOCUMENT_REQUIRED/u],
    ];
    for (const [action, payload, error] of cases) {
      assert.throws(() => router.buildRpcArguments(action, {
        client_request_id: UUIDS.finance,
        asset_code: 'A120085001',
        payload,
      }), error);
    }
  }, 'home deltas, rent row operations, and every finance ledger shape are rejected');

  await check('trace-compatible-asset-routing', () => {
    const canonical = router.buildRpcArguments('v2/home/read', { asset_code: 'A120085001' });
    const legacyTrace = router.buildRpcArguments('v2/home/read', { asset_key: 'asset_a120085001' });
    assert.equal(canonical.p_asset_key, 'A120085001');
    assert.equal(legacyTrace.p_asset_key, 'asset_a120085001');
    assert.equal(typeof canonical.p_request_id, 'string');
  }, 'asset_code is canonical while the existing read trace asset_key remains routable');

  await check('rpc-error-mapping', () => {
    assert.deepEqual(router.mapV2RpcError({ code: 'PT409', message: 'REVISION_CONFLICT' }), {
      httpStatus: 409, code: 'REVISION_CONFLICT', retryable: false,
    });
    assert.deepEqual(router.mapV2RpcError({ code: 'PT422', message: 'EXPECTED_XMIN_REQUIRED' }), {
      httpStatus: 422, code: 'BUSINESS_RULE_VIOLATION', retryable: false,
    });
    assert.deepEqual(router.mapV2RpcError({ code: 'PT503', message: 'MAINTENANCE_MODE' }), {
      httpStatus: 503, code: 'MAINTENANCE_MODE', retryable: false,
    });
  }, 'xmin, validation, and maintenance failures map deterministically');

  await check('rpc-dispatch-requires-user-jwt', async () => {
    await assert.rejects(
      router.dispatchV2Action({ authMode: 'service-role', accessToken: 'token', client: {} }, 'v2/home/read', {}),
      /USER_JWT_RPC_CONTEXT_REQUIRED/u,
    );
    const calls = [];
    const client = {
      schema(schema) {
        return {
          async rpc(name, args) {
            calls.push({ schema, name, args });
            return { data: { ok: true, status: 'primary', request_id: UUIDS.home, revision: 9, data: {} }, error: null };
          },
        };
      },
    };
    await router.dispatchV2Action({ authMode: 'anon-key-user-jwt', accessToken: 'token', client }, 'v2/home/read', { asset_code: 'A1' });
    assert.equal(calls[0].schema, 'logistics_api');
    assert.equal(calls[0].name, 'home_read');
  }, 'only anon-key plus user JWT context can dispatch logistics_api RPCs');

  await check('database-exposes-eight-document-rpcs', () => {
    const wrappers = [...migration.matchAll(/create\s+or\s+replace\s+function\s+logistics_api\.([a-z0-9_]+)\s*\(/giu)]
      .map((match) => match[1]);
    assert.deepEqual([...new Set(wrappers)].sort(), [...EXPECTED_RPCS].sort());
    assert.match(migration, /p_payload->>'expected_xmin'/iu);
    assert.match(migration, /EXPECTED_XMIN_REQUIRED/iu);
    assert.match(migration, /REVISION_CONFLICT/iu);
  }, EXPECTED_RPCS);

  await check('edge-index-preserves-user-jwt-dispatch', () => {
    assert.match(edgeIndex, /authMode:\s*'anon-key-user-jwt'/u);
    assert.match(edgeIndex, /dispatchV2Action/iu);
    assert.doesNotMatch(edgeIndex, /authMode:\s*'service-role'/u);
  }, 'Edge forwards the authenticated user context to the document router');

  const failed = checks.filter((item) => !item.ok);
  process.stdout.write(`${JSON.stringify({
    ok: failed.length === 0,
    mode: 'four-document-api-contract',
    network_used: false,
    database_write_used: false,
    checks,
  }, null, 2)}\n`);
  process.exit(failed.length === 0 ? 0 : 1);
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exitCode = 1;
});
