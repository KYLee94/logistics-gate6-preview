const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const migrationsDir = path.join(root, 'supabase', 'migrations');

test('only the three audited all-null and unreferenced columns are retired', () => {
  const migrationNames = fs.readdirSync(migrationsDir)
    .filter((fileName) => /^20260714\d+_remove_unused_null_columns\.sql$/u.test(fileName));
  assert.equal(migrationNames.length, 1);
  const migration = fs.readFileSync(path.join(migrationsDir, migrationNames[0]), 'utf8');

  for (const [tableName, columnName] of [
    ['ll_assets', 'last_etl_run_id'],
    ['ll_funds', 'last_etl_run_id'],
    ['ll_leases', 'source_doc_ref'],
  ]) {
    assert.match(
      migration,
      new RegExp(`alter table public\\.${tableName}\\s+drop column if exists ${columnName} restrict`, 'iu'),
    );
  }

  const drops = [...migration.matchAll(/drop column if exists\s+([a-z0-9_]+)\s+restrict/giu)]
    .map((match) => match[1]);
  assert.deepEqual(drops.sort(), ['last_etl_run_id', 'last_etl_run_id', 'source_doc_ref'].sort());
  assert.doesNotMatch(migration, /\bcascade\b/iu);
});
