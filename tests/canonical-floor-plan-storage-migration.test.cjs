const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const migration = fs.readFileSync(
  path.resolve(__dirname, '..', 'supabase', 'migrations', '20260710143000_enable_canonical_floor_plan_storage.sql'),
  'utf8',
);

test('floor plans reuse the canonical private bucket without removing existing upload types', () => {
  assert.match(migration, /target_bucket_id constant text := 'logistics-sector-market-workbooks'/u);
  assert.match(migration, /public = false/u);
  assert.match(migration, /array\['image\/png'\]/u);
  assert.match(migration, /coalesce\(allowed_mime_types, array\[\]::text\[\]\)/u);
  assert.match(migration, /array_agg\(distinct mime_type order by mime_type\)/u);
});

test('floor plan storage migration neither creates nor removes buckets or objects', () => {
  assert.doesNotMatch(migration, /create\s+(?:or\s+replace\s+)?(?:table|bucket)/iu);
  assert.doesNotMatch(migration, /drop\s+/iu);
  assert.doesNotMatch(migration, /delete\s+from/iu);
});
