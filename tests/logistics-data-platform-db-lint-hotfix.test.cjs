const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..');
const migrationPath = path.join(
  ROOT,
  'supabase',
  'migrations',
  '20260806073000_logistics_data_platform_db_lint_variable_fix.sql',
);

function functionBlock(source, functionName, nextMarker) {
  const marker = `create or replace function logistics_core.${functionName}(`;
  const start = source.indexOf(marker);
  const end = source.indexOf(nextMarker, start);
  assert.ok(start >= 0, `missing ${functionName}`);
  assert.ok(end > start, `missing end marker for ${functionName}`);
  return source.slice(start, end);
}

test('database lint hotfix replaces both deployed functions without ambiguous variable names', () => {
  assert.ok(fs.existsSync(migrationPath), 'missing follow-up lint migration');
  const source = fs.readFileSync(migrationPath, 'utf8');
  const finance = functionBlock(
    source,
    'finance_batch_save_entry',
    'create or replace function logistics_core.rent_roll_batch_save_entry_v4(',
  );
  const rentRoll = functionBlock(
    source,
    'rent_roll_batch_save_entry_v4',
    'revoke all on function logistics_core.finance_batch_save_entry',
  );

  assert.match(finance, /v_account_code text;/u);
  assert.match(finance, /where account\.account_code = v_account_code/u);
  assert.match(finance, /where entry\.entry_key = v_entry_key/u);
  assert.match(finance, /account_id = v_account_id/u);
  assert.doesNotMatch(finance, /\baccount_code text;|account\.account_code = account_code|entry\.entry_key = entry_key|account_id = account_id/u);

  assert.match(rentRoll, /v_tenant_key text;/u);
  assert.match(rentRoll, /tenant\.tenant_key = v_tenant_key/u);
  assert.match(rentRoll, /into v_tenant_id, v_tenant_key/u);
  assert.doesNotMatch(rentRoll, /\btenant_key text;|tenant\.tenant_key = tenant_key|into tenant_id, tenant_key/u);
});
