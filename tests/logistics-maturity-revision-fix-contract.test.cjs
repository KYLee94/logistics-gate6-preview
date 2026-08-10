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
    .includes('LOGISTICS_SIMPLE_MATURITY_REVISION_FIX_V1'));
const migration = migrationPath ? fs.readFileSync(migrationPath, 'utf8') : '';

test('maturity revision fix migration exists', () => {
  assert.ok(migrationPath, 'revision fix migration marker is required');
});

test('maturity response revision is a single numeric xmin token', { skip: !migrationPath }, () => {
  assert.match(migration, /greatest\s*\(\s*rent\.xmin::text::bigint\s*,\s*fund\.xmin::text::bigint\s*\)::text/iu);
  assert.match(migration, /MATURITY_REVISION_FIX_NOT_APPLIED/u);
  assert.match(migration, /replace\s*\(\s*v_definition\s*,\s*v_old_revision_sql\s*,\s*v_new_revision_sql\s*\)/iu);
  assert.match(migration, /position\s*\(\s*v_new_revision_sql\s+in\s+v_definition\s*\)\s*=\s*0/iu);
});

test('the fix preserves the security-definer function and public execute revocation', { skip: !migrationPath }, () => {
  assert.match(migration, /pg_get_functiondef/iu);
  assert.match(migration, /function\.prosecdef/iu);
  assert.match(migration, /or\s+not\s+v_security_definer/iu);
  assert.match(
    migration,
    /revoke\s+all\s+on\s+function\s+logistics_core\.maturities_read_entry[\s\S]*?from\s+public\s*,\s*anon\s*,\s*authenticated/iu,
  );
});
