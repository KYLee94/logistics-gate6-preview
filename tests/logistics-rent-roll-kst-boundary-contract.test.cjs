const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const migrationsDirectory = path.resolve(__dirname, '..', 'supabase', 'migrations');
const migrationPath = fs.readdirSync(migrationsDirectory)
  .filter((name) => name.endsWith('.sql'))
  .sort()
  .map((name) => path.join(migrationsDirectory, name))
  .find((candidate) => fs.readFileSync(candidate, 'utf8')
    .includes('LOGISTICS_RENT_ROLL_KST_BOUNDARY_V1'));
const migration = migrationPath ? fs.readFileSync(migrationPath, 'utf8') : '';

function functionBody(name) {
  return migration.match(new RegExp(
    `create\\s+or\\s+replace\\s+function\\s+logistics_core\\.${name}[\\s\\S]*?\\$body\\$;`,
    'iu',
  ))?.[0] || '';
}

test('KST boundary migration exists and keeps the four-table schema unchanged', () => {
  assert.ok(migrationPath, 'KST boundary migration marker is required');
  assert.doesNotMatch(migration, /create\s+table|alter\s+table[^;]*add\s+column/iu);
});

test('rent projection, read metadata, and expired-row guard use one explicit KST business date', {
  skip: !migrationPath,
}, () => {
  assert.match(migration, /statement_timestamp\(\)\s+at\s+time\s+zone\s+'Asia\/Seoul'/iu);
  for (const name of ['project_rent_rows', 'rent_roll_read_entry', 'rent_roll_batch_save_entry']) {
    const body = functionBody(name);
    assert.ok(body, `${name} override is required`);
    assert.match(body, /v_as_of\s+date\s*:=\s*\(statement_timestamp\(\)\s+at\s+time\s+zone\s+'Asia\/Seoul'\)::date/iu);
    assert.doesNotMatch(body, /\bcurrent_date\b/iu);
  }
  assert.match(
    functionBody('rent_roll_batch_save_entry'),
    /assert_expired_rent_rows_preserved\s*\(\s*v_old_rows\s*,\s*v_rows\s*,\s*v_as_of\s*\)/iu,
  );
});

test('KST writer preserves permission, xmin CAS, full-document sanitization, and verified readback', {
  skip: !migrationPath,
}, () => {
  const body = functionBody('rent_roll_batch_save_entry');
  assert.match(body, /assert_rent_rows_document_valid\s*\(\s*p_payload->'rows'\s*\)/iu);
  assert.match(body, /for\s+update/iu);
  assert.match(body, /assert_expected_xmin/iu);
  assert.match(body, /sanitize_rent_rows/iu);
  assert.match(body, /assert_document_array_permissions/iu);
  assert.match(body, /RENT_ROLL_READBACK_MISMATCH/u);
  assert.match(body, /rent_roll_read_entry/iu);
});

test('KST RPC overrides remain internal and only authenticated users retain wrapper access', {
  skip: !migrationPath,
}, () => {
  assert.match(migration, /revoke\s+all\s+on\s+function\s+logistics_core\.project_rent_rows\(jsonb\)[^;]*from\s+public\s*,\s*anon\s*,\s*authenticated/isu);
  assert.match(migration, /revoke\s+all\s+on\s+function\s+logistics_core\.rent_roll_read_entry\(uuid\s*,\s*text\s*,\s*jsonb\s*,\s*jsonb\)[^;]*from\s+public\s*,\s*anon\s*,\s*authenticated/isu);
  assert.match(migration, /revoke\s+all\s+on\s+function\s+logistics_core\.rent_roll_batch_save_entry\(uuid\s*,\s*text\s*,\s*jsonb\s*,\s*jsonb\)[^;]*from\s+public\s*,\s*anon\s*,\s*authenticated/isu);
  assert.match(migration, /grant\s+execute\s+on\s+function\s+logistics_core\.rent_roll_(?:read|batch_save)_entry[^;]*to\s+authenticated/isu);
});
