const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { pathToFileURL } = require('node:url');

const ROOT = path.resolve(__dirname, '..');

async function importFresh(relativePath) {
  const target = path.join(ROOT, relativePath);
  return import(`${pathToFileURL(target).href}?test=${Date.now()}-${Math.random()}`);
}

function migrationBySuffix(suffix) {
  const migrationDir = path.join(ROOT, 'supabase', 'migrations');
  const candidates = fs.readdirSync(migrationDir).filter((name) => name.endsWith(suffix)).sort();
  assert.equal(candidates.length, 1, `${suffix} migration must be unique`);
  return fs.readFileSync(path.join(migrationDir, candidates[0]), 'utf8');
}

function migrationHash(suffix) {
  return crypto.createHash('sha256').update(migrationBySuffix(suffix)).digest('hex');
}

test('finance router accepts only a canonical full statement and forwards xmin inside the document payload', async () => {
  const router = await importFresh('supabase/functions/ll-dashboard-api/v2/router.ts');
  const request = router.buildRpcArguments('v2/finance/batch-save', {
    client_request_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    asset_code: 'A112527001',
    payload: {
      expected_xmin: '17',
      statement: { periods: ['2026-08'], accounts: [], selected_account_codes: [] },
    },
  });

  assert.equal(request.p_asset_key, 'A112527001');
  assert.equal(request.p_payload.expected_xmin, '17');
  assert.deepEqual(request.p_payload.statement, {
    periods: ['2026-08'], accounts: [], selected_account_codes: [],
  });

  assert.throws(() => router.buildRpcArguments('v2/finance/batch-save', {
    client_request_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    asset_code: 'A112527001',
    payload: { account_operations: [{ operation: 'restore' }] },
  }), /FINANCE_DOCUMENT_REQUIRED/u);
});

test('v10 keeps custom accounts asset-scoped and provides archive and restore readback', () => {
  const sql = migrationBySuffix('_logistics_finance_account_asset_scope_v10.sql');

  assert.match(sql, /FINANCE_ACCOUNT_ASSET_SCOPE_V10/iu);
  assert.match(sql, /account\.is_custom\s+and\s+account\.asset_id\s*=\s*v_asset_id/iu);
  assert.match(sql, /\{data,archived_accounts\}/iu);
  assert.match(sql, /account_mutations_readback/iu);
  assert.match(sql, /'asset_id',\s*v_asset_id/iu);
  assert.match(sql, /v_operation_name\s*=\s*'restore'/iu);
  assert.match(sql, /set\s+deleted_at\s*=\s*null,\s*deleted_by\s*=\s*null/iu);
  assert.match(sql, /FINANCE_ACCOUNT_HAS_LEDGER_ENTRIES/iu);
  assert.match(sql, /REVISION_CONFLICT/iu);
  assert.match(sql, /claim_idempotency/iu);
  assert.match(sql, /complete_idempotency/iu);
  assert.match(sql, /insert into logistics_core\.audit_events/iu);
  assert.match(sql, /revoke all on function logistics_core\.finance_read_entry/iu);
  assert.match(sql, /revoke all on function logistics_core\.finance_batch_save_entry/iu);
});

test('applied v6 through v9 migration bytes stay immutable', () => {
  assert.equal(
    migrationHash('_logistics_editable_contracts_v6.sql'),
    'c66db543f8d6d5e40d5064aa342d91a93ea636a4cbe8325a9702abcca64c0d9a',
  );
  assert.equal(
    migrationHash('_logistics_rent_term_key_fallback_v7.sql'),
    '9214913b5a78cf09419c7f7d3a80d0cc8a38a6f2cb5913682c3c3e9dd5bbbada',
  );
  assert.equal(
    migrationHash('_logistics_home_shared_lender_revision_v8.sql'),
    '8761ec3ff66f7dd8d417b7698d6e2323a18a23df652c8bf271794fe3c08302b5',
  );
  assert.equal(
    migrationHash('_logistics_home_shared_lender_revision_compat_v9.sql'),
    '8b780e3f29e905d447e3248e6948b79a79e7d5a6ce3a42dd2f886efb2e92347a',
  );
});
