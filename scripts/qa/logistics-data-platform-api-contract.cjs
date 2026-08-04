const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const ROOT = path.resolve(__dirname, '..', '..');
const V2_DIR = path.join(ROOT, 'supabase', 'functions', 'll-dashboard-api', 'v2');
const EDGE_INDEX = path.join(ROOT, 'supabase', 'functions', 'll-dashboard-api', 'index.ts');
const MIGRATIONS_DIR = path.join(ROOT, 'supabase', 'migrations');
const EXPECTED_ACTIONS = Object.freeze([
  'v2/home/read',
  'v2/rent-roll/read',
  'v2/rent-roll/batch-save',
  'v2/finance/read',
  'v2/finance/batch-save',
  'v2/maturities/read',
  'v2/calculations/explain',
]);
const EXPECTED_RPCS = Object.freeze([
  'home_read',
  'rent_roll_read',
  'rent_roll_batch_save',
  'finance_read',
  'finance_batch_save',
  'maturities_read',
  'calculations_explain',
]);
const READ_RPCS = Object.freeze([
  'home_read',
  'rent_roll_read',
  'finance_read',
  'maturities_read',
  'calculations_explain',
]);
const MUTATION_RPCS = Object.freeze([
  'rent_roll_batch_save',
  'finance_batch_save',
]);

function sourceFiles(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    return entry.isDirectory() ? sourceFiles(entryPath) : [entryPath];
  }).filter((file) => /\.(?:ts|js|mjs)$/u.test(file));
}

function migrationSource() {
  const files = fs.readdirSync(MIGRATIONS_DIR)
    .filter((name) => /^20260804\d{6}_logistics_data_platform.*\.sql$/u.test(name))
    .sort();
  assert.ok(files.length > 0, 'data-platform migration is missing');
  return files.map((name) => fs.readFileSync(path.join(MIGRATIONS_DIR, name), 'utf8')).join('\n');
}

function apiMigrationSource() {
  return fs.readFileSync(
    path.join(MIGRATIONS_DIR, '20260804091000_logistics_data_platform_api.sql'),
    'utf8',
  );
}

async function importModule(name) {
  const filePath = path.join(V2_DIR, name);
  assert.ok(fs.existsSync(filePath), `missing v2 module: ${name}`);
  return import(`${pathToFileURL(filePath).href}?contract=${Date.now()}`);
}

async function main() {
  const checks = [];
  const check = async (id, fn) => {
    try {
      checks.push({ id, ok: true, evidence: await fn() });
    } catch (error) {
      checks.push({ id, ok: false, error: error.message });
    }
  };

  let contracts;
  let router;
  await check('v2-contract-modules-load', async () => {
    contracts = await importModule('contracts.ts');
    router = await importModule('router.ts');
    return ['contracts.ts', 'router.ts'];
  });

  if (contracts && router) {
    await check('exactly-seven-public-actions', () => {
      assert.deepEqual([...contracts.V2_PUBLIC_ACTIONS], EXPECTED_ACTIONS);
      const actionStrings = [...new Set(sourceFiles(V2_DIR).flatMap((file) => {
        const source = fs.readFileSync(file, 'utf8');
        return [...source.matchAll(/['"](v2\/[a-z0-9/-]+)['"]/gu)].map((match) => match[1]);
      }))].sort();
      assert.deepEqual(actionStrings, [...EXPECTED_ACTIONS].sort());
      return EXPECTED_ACTIONS;
    });

    await check('primary-response-has-exact-top-level-keys', () => {
      const response = contracts.primaryResponse({
        requestId: '00000000-0000-4000-8000-000000000001',
        revision: 7,
        data: { asset: 'A001' },
      });
      assert.deepEqual(Object.keys(response), ['ok', 'status', 'request_id', 'revision', 'data']);
      assert.deepEqual(response, {
        ok: true,
        status: 'primary',
        request_id: '00000000-0000-4000-8000-000000000001',
        revision: 7,
        data: { asset: 'A001' },
      });
      assert.equal(JSON.stringify(response).includes('fallback'), false);
      assert.equal(JSON.stringify(response).includes('stale'), false);
      return Object.keys(response);
    });

    await check('router-is-closed-to-unknown-actions', () => {
      assert.equal(router.isV2PublicAction('v2/home/read'), true);
      assert.equal(router.isV2PublicAction('v2/news/read'), false);
      assert.throws(() => router.rpcNameForAction('v2/news/read'), /UNSUPPORTED_ACTION/u);
      return 'unknown actions are rejected';
    });

    await check('revision-and-idempotency-errors-map-to-409', () => {
      assert.deepEqual(router.mapV2RpcError({ code: 'PT409', message: 'REVISION_CONFLICT' }), {
        httpStatus: 409,
        code: 'REVISION_CONFLICT',
        retryable: false,
      });
      assert.deepEqual(router.mapV2RpcError({ code: '23505', message: 'IDEMPOTENCY_CONFLICT' }), {
        httpStatus: 409,
        code: 'IDEMPOTENCY_CONFLICT',
        retryable: false,
      });
      return '409 mappings';
    });

    await check('writer-transition-maps-to-maintenance-mode', () => {
      assert.deepEqual(router.mapV2RpcError({ code: 'PT503', message: 'MAINTENANCE_MODE' }), {
        httpStatus: 503,
        code: 'MAINTENANCE_MODE',
        retryable: false,
      });
      return '503 MAINTENANCE_MODE without automatic retry';
    });

    await check('write-actions-require-client-request-id', () => {
      assert.throws(
        () => router.buildRpcArguments('v2/rent-roll/batch-save', { payload: {} }),
        /CLIENT_REQUEST_ID_REQUIRED/u,
      );
      const args = router.buildRpcArguments('v2/finance/batch-save', {
        client_request_id: '00000000-0000-4000-8000-000000000002',
        payload: { operations: [] },
      });
      assert.equal(args.p_request_id, '00000000-0000-4000-8000-000000000002');
      return 'write request id enforced';
    });

    await check('finance-flat-entries-normalize-to-deterministic-operations', () => {
      const requestId = '00000000-0000-4000-8000-000000000002';
      const entries = [
        {
          operation: 'create',
          month: '2026-08',
          account_code: 'MANUAL_REVENUE',
          amount: '1000',
          scenario: 'actual',
          accounting_basis: 'accrual',
          reason: 'new revenue evidence',
        },
        {
          operation: 'update',
          entry_key: 'manual:existing-entry',
          month: '2026-08',
          account_code: 'MANUAL_COST',
          amount: '-300',
          scenario: 'actual',
          accounting_basis: 'accrual',
          reason: 'correct source amount',
        },
        {
          operation: 'delete',
          entry_key: 'manual:archive-entry',
          reason: 'archive duplicate',
        },
      ];
      const request = {
        client_request_id: requestId,
        asset_key: 'asset_a112127001',
        payload: { entries },
      };
      const first = router.buildRpcArguments('v2/finance/batch-save', request);
      const second = router.buildRpcArguments('v2/finance/batch-save', request);

      assert.deepEqual(first.p_payload, second.p_payload, 'normalization must be retry-stable');
      assert.equal(Object.hasOwn(first.p_payload, 'entries'), false);
      assert.deepEqual(first.p_payload.operations, [
        {
          operation: 'create',
          entry_key: `manual:${requestId}:0`,
          reason: 'new revenue evidence',
          record: {
            month: '2026-08',
            account_code: 'MANUAL_REVENUE',
            amount: '1000',
            scenario: 'actual',
            accounting_basis: 'accrual',
          },
        },
        {
          operation: 'update',
          entry_key: 'manual:existing-entry',
          reason: 'correct source amount',
          record: {
            month: '2026-08',
            account_code: 'MANUAL_COST',
            amount: '-300',
            scenario: 'actual',
            accounting_basis: 'accrual',
          },
        },
        {
          operation: 'delete',
          entry_key: 'manual:archive-entry',
          reason: 'archive duplicate',
          record: {},
        },
      ]);
      assert.deepEqual(request.payload.entries, entries, 'normalization must not mutate the caller payload');
      assert.throws(
        () => router.buildRpcArguments('v2/finance/batch-save', {
          client_request_id: requestId,
          payload: { entries: [{ operation: 'update', reason: 'missing key' }] },
        }),
        /FINANCE_ENTRY_KEY_REQUIRED/u,
      );
      return 'flat entries become deterministic nested operations';
    });

    await check('public-envelope-uses-asset-key-without-uuid', () => {
      const args = router.buildRpcArguments('v2/home/read', {
        asset_key: 'asset_a112127001',
        payload: {},
      });
      assert.equal(args.p_asset_key, 'asset_a112127001');
      assert.equal(Object.hasOwn(args, 'p_asset_id'), false);
      const routerSource = fs.readFileSync(path.join(V2_DIR, 'router.ts'), 'utf8');
      const contractsSource = fs.readFileSync(path.join(V2_DIR, 'contracts.ts'), 'utf8');
      assert.doesNotMatch(`${routerSource}\n${contractsSource}`, /\basset_id\b/u);
      return 'asset_key only';
    });

    await check('rpc-dispatch-requires-anon-key-user-jwt-context', async () => {
      const calls = [];
      const client = {
        schema(schema) {
          return {
            async rpc(name, args) {
              calls.push({ schema, name, args });
              return {
                data: {
                  ok: true,
                  status: 'primary',
                  request_id: args.p_request_id,
                  revision: 1,
                  data: {},
                },
                error: null,
              };
            },
          };
        },
      };
      await assert.rejects(
        router.dispatchV2Action({ authMode: 'service-role', accessToken: 'token', client }, 'v2/home/read', { asset_key: 'ASSET-001' }),
        /USER_JWT_RPC_CONTEXT_REQUIRED/u,
      );
      await router.dispatchV2Action(
        { authMode: 'anon-key-user-jwt', accessToken: 'raw-user-jwt', client },
        'v2/home/read',
        { asset_key: 'asset_a112127001' },
      );
      assert.equal(calls.length, 1);
      assert.equal(calls[0].schema, 'logistics_api');
      return 'user JWT context only';
    });
  }

  await check('rpc-only-sql-surface', () => {
    const source = migrationSource();
    const rpcNames = [...source.matchAll(/create or replace function logistics_api\.([a-z0-9_]+)\s*\(/giu)]
      .map((match) => match[1]);
    assert.deepEqual([...new Set(rpcNames)].sort(), [...EXPECTED_RPCS].sort());
    assert.doesNotMatch(source, /create\s+(?:table|view|materialized\s+view)\s+(?:if not exists\s+)?logistics_api\./iu);
    for (const rpc of READ_RPCS) {
      assert.match(source, new RegExp(`grant execute on function logistics_api\\.${rpc}\\(`, 'iu'));
    }
    for (const rpc of MUTATION_RPCS) {
      assert.doesNotMatch(
        source,
        new RegExp(`grant execute on function logistics_api\\.${rpc}\\([\\s\\S]{0,180}to authenticated`, 'iu'),
        `${rpc} must remain ungranted in the production-shadow base migration`,
      );
    }
    assert.doesNotMatch(
      source,
      /grant\s+execute\s+on\s+function\s+logistics_core\.[\s\S]{0,160}\s+to\s+authenticated/iu,
    );
    assert.match(source, /revoke all on schema logistics_api from public, anon/iu);
    assert.match(source, /grant usage on schema logistics_api to authenticated/iu);
    const apiFunctionBlocks = source.match(/create or replace function logistics_api\.[\s\S]*?\$function\$;/giu) || [];
    assert.equal(apiFunctionBlocks.length, 7);
    apiFunctionBlocks.forEach((block) => {
      assert.match(block, /security definer/iu);
      assert.match(block, /set search_path = ''/iu);
    });
    return EXPECTED_RPCS;
  });

  await check('canonical-loan-and-rent-roll-projections', () => {
    const source = migrationSource();
    const apiSource = apiMigrationSource();
    assert.match(source, /public\.ll_fund_capital_tranches/iu);
    assert.match(source, /tranche_type[\s\S]{0,80}'loan'/iu);
    assert.match(apiSource, /tranche\.is_active\s*=\s*true[\s\S]{0,100}tranche\.deleted_at\s+is\s+null/iu);
    assert.match(source, /repayment_schedule_status[\s\S]{0,80}'not_provided'/iu);
    for (const field of [
      'lender_name', 'committed_amount_krw', 'drawdown_date', 'maturity_date',
      'loan_period', 'loan_type', 'interest_type', 'base_rate', 'spread_rate',
      'loan_rate', 'interest_rate', 'fee_rate', 'all_in_rate',
    ]) {
      assert.match(apiSource, new RegExp(`'${field}'`, 'iu'), `missing canonical loan field ${field}`);
    }
    assert.match(apiSource, /'repayment_schedule'[\s\S]{0,180}'status',\s*'not_provided'[\s\S]{0,100}'rows',\s*'\[\]'::jsonb/iu);
    assert.doesNotMatch(apiSource, /(?:insert\s+into|update|delete\s+from)\s+(?:public\.ll_fund_capital_tranches|logistics_core\.loans)\b/iu);
    assert.match(source, /jsonb_build_object\([\s\S]{0,120}'rows'/iu, 'rent-roll read must return data.rows');
    for (const field of [
      'occupancy_status', 'use_category', 'floor_label', 'zone_label',
      'exclusive_area_sqm', 'common_area_sqm', 'leased_area_sqm', 'efficiency_ratio',
      'commencement_date', 'expiry_date', 'deposit_total_krw', 'deposit_per_py_krw',
      'monthly_rent_total_krw', 'rent_per_py_krw', 'monthly_cam_total_krw', 'cam_per_py_krw',
      'rent_free_schedule', 'deposit_escalation_rule', 'rent_escalation_rule', 'cam_escalation_rule',
      'fit_out_months', 'fit_out_amount', 'effective_rent', 'tenant_cost_terms',
      'landlord_cost_terms', 'renewal_terms', 'termination_terms', 'restoration_terms',
      'bond_terms', 'operation_start_date', 'pallet_rack_fee', 'notes',
    ]) {
      assert.match(source, new RegExp(`'${field}'`, 'iu'), `missing rent-roll row field ${field}`);
    }
    assert.match(source, /p_payload\s*->\s*'rows'/iu, 'batch-save must accept payload.rows');
    assert.doesNotMatch(source, /create table(?: if not exists)? logistics_core\.loan_repayment/iu);
    return 'legacy loan projection and row-first rent-roll contract';
  });

  await check('home-bootstrap-and-month-editor-contract', () => {
    const source = migrationSource();
    assert.match(source, /nullif\(btrim\(p_asset_key\),\s*''\)\s+is\s+null[\s\S]{0,700}'assets'/iu);
    assert.match(source, /'selected_asset',\s*null/iu);
    assert.match(source, /'asset_key',\s*asset\.asset_key/iu);
    assert.doesNotMatch(source, /jsonb_build_object\([\s\S]{0,100}'asset_id'/iu, 'home must not expose internal UUID');
    assert.match(source, /create or replace function logistics_core\.normalize_month/iu);
    assert.match(source, /\^\[0-9\]\{4\}-\(0\[1-9\]\|1\[0-2\]\)\$/u);
    assert.match(source, /return \(p_value \|\| '-01'\)::date/iu);
    assert.match(source, /to_char\(entry\.month,\s*'YYYY-MM'\)/iu);
    return 'blank asset bootstrap and YYYY-MM editor normalization';
  });

  await check('finance-manual-input-and-in-app-alerts-only', () => {
    const source = migrationSource();
    const apiSource = apiMigrationSource();
    assert.match(source, /source_kind[\s\S]{0,240}'manual_input'/iu);
    assert.match(source, /public\.ll_notifications/iu);
    for (const field of [
      'accounts', 'loans', 'finance_write_enabled', 'data_status',
      'formula_status', 'formula_version', 'waterfall',
    ]) {
      assert.match(apiSource, new RegExp(`'${field}'`, 'iu'), `missing finance response field ${field}`);
    }
    assert.match(apiSource, /p_payload->>'from_month',\s*p_payload->>'start_month'/iu);
    assert.match(apiSource, /p_payload->>'to_month',\s*p_payload->>'end_month'/iu);
    assert.match(apiSource, /entry_count\s*=\s*0\s+then\s+'not_entered'/iu);
    assert.doesNotMatch(source, /delivery_outbox|delivery_attempts|\bresend\b|ll-maturity-email/iu);
    assert.doesNotMatch(source, /insert\s+into\s+logistics_core\.monthly_ledger_entries[\s\S]{0,600}(?:loan_schedule|repayment)/iu);
    return 'manual finance CRUD and login-visible in-app maturity alerts';
  });

  await check('finance-mutation-enforces-server-side-manual-ledger-policy', () => {
    const apiSource = apiMigrationSource();
    const financeMutation = apiSource.match(
      /create or replace function logistics_core\.finance_batch_save_entry[\s\S]*?\$body\$;/iu,
    )?.[0] || '';
    assert.ok(financeMutation, 'finance mutation function is missing');
    assert.match(financeMutation, /v_scenario\s+is\s+distinct\s+from\s+'actual'/iu);
    for (const accountCode of ['MANUAL_REVENUE', 'MANUAL_COST', 'MANUAL_RECEIPT']) {
      assert.match(financeMutation, new RegExp(`'${accountCode}'`, 'iu'));
    }
    assert.match(financeMutation, /v_account_code\s*=\s*'MANUAL_RECEIPT'[\s\S]{0,160}v_accounting_basis\s+is\s+distinct\s+from\s+'cash'/iu);
    assert.match(financeMutation, /v_amount_text\s*!~/iu);
    assert.match(financeMutation, /\[0-9\]\+/u);
    assert.match(financeMutation, /v_reason\s+is\s+null/iu);
    assert.match(financeMutation, /errcode\s*=\s*'PT422'/iu);
    assert.doesNotMatch(financeMutation, /'budget'|'forecast'|'debt_service'/iu);
    assert.match(financeMutation, /account\.account_code\s*=\s*v_account_code/iu);
    assert.match(financeMutation, /entry\.entry_key\s*=\s*v_entry_key/iu);
    assert.doesNotMatch(financeMutation, /account\.account_code\s*=\s*account_code\b/iu);
    assert.doesNotMatch(financeMutation, /entry\.entry_key\s*=\s*entry_key\b/iu);
    return 'actual-only manual account policy with finite amount and mandatory reason';
  });

  await check('edge-index-dispatches-v2-with-user-jwt-client', () => {
    const source = fs.readFileSync(EDGE_INDEX, 'utf8');
    assert.match(source, /import\s*\{\s*dispatchV2Action,\s*isV2PublicAction\s*\}\s*from\s*['"]\.\/v2\/router\.ts['"]/iu);
    assert.match(source, /if\s*\(isV2PublicAction\(action\)\)[\s\S]{0,500}dispatchV2Action/iu);
    assert.match(source, /authMode:\s*'anon-key-user-jwt'/iu);
    assert.match(source, /client:\s*ctx\.userRpcClient/iu);
    assert.doesNotMatch(
      source,
      /if\s*\(isV2PublicAction\(action\)\)[\s\S]{0,700}client:\s*ctx\.serviceClient/iu,
      'v2 RPCs must never use the service-role client',
    );
    return 'Edge v2 dispatch uses the original user JWT client';
  });

  await check('database-dispatch-enforces-auth-permission-and-primary-readback', () => {
    const source = migrationSource();
    assert.match(source, /auth\.uid\(\)\s+is\s+null/iu);
    assert.match(source, /assert_asset_permission/iu);
    assert.match(source, /IDEMPOTENCY_CONFLICT/iu);
    assert.match(source, /REVISION_CONFLICT/iu);
    assert.match(source, /READBACK_MISMATCH/iu);
    assert.match(source, /p_asset_key/iu);
    assert.match(source, /assert_v2_writer_route/iu);
    assert.match(source, /v2_write_enabled/iu);
    assert.match(source, /platform_feature_flags/iu);
    assert.match(source, /MAINTENANCE_MODE/iu);
    assert.doesNotMatch(source, /WRITER_ROUTE_LOCKED|WRITER_LOCKED/iu);
    assert.match(source, /jsonb_build_object\(\s*'ok',\s*true,\s*'status',\s*'primary',\s*'request_id',[\s\S]{0,200}'revision',[\s\S]{0,200}'data'/iu);
    return 'auth.uid permission idempotency revision readback';
  });

  const report = {
    ok: checks.every((row) => row.ok),
    mode: 'static-and-module-api-contract',
    network_used: false,
    database_write_used: false,
    checks,
  };
  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) process.exitCode = 1;
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, fatal: error.message }, null, 2));
  process.exitCode = 1;
});
