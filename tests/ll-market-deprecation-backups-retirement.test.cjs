const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const migrationsDir = path.join(root, 'supabase', 'migrations');
const migrationNames = fs.readdirSync(migrationsDir)
  .filter((fileName) => /^20260714\d+_remove_market_deprecation_backups\.sql$/u.test(fileName));
const edgeSource = fs.readFileSync(
  path.join(root, 'supabase', 'functions', 'll-dashboard-api', 'index.ts'),
  'utf8',
);

test('market deprecation backup retirement has one scoped migration', () => {
  assert.equal(migrationNames.length, 1);
  const migration = fs.readFileSync(path.join(migrationsDir, migrationNames[0]), 'utf8');

  assert.match(migration, /drop table if exists public\.ll_market_deprecation_backups restrict;/iu);
  assert.doesNotMatch(migration, /\bcascade\b/iu);

  const droppedTables = [...migration.matchAll(/drop table(?: if exists)? public\.([a-z0-9_]+)/giu)]
    .map((match) => match[1]);
  assert.deepEqual(droppedTables, ['ll_market_deprecation_backups']);

  for (const protectedTable of [
    'll_source_files',
    'll_source_rows',
    'll_leases',
    'll_lease_spaces',
    'll_lease_attributes',
  ]) {
    assert.doesNotMatch(migration, new RegExp(`drop table(?: if exists)? public\\.${protectedTable}\\b`, 'iu'));
  }
});

test('Edge catalog no longer exposes the retired market backup table', () => {
  assert.doesNotMatch(edgeSource, /\bll_market_deprecation_backups\b/u);
});
