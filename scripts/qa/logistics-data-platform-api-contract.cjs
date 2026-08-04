const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const ROOT = path.resolve(__dirname, '..', '..');
const V2_DIR = path.join(ROOT, 'supabase', 'functions', 'll-dashboard-api', 'v2');
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
    apiFunctionBlocks.forEach((block) => assert.match(block, /security invoker/iu));
    return EXPECTED_RPCS;
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
