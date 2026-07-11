const assert = require('assert/strict');
const path = require('path');
const test = require('node:test');
const {
  buildRegistrationPlan,
  readManifest,
  validateManifest,
} = require('../scripts/lib/logistics-floor-plan-manifest-core.cjs');

const manifest = readManifest(path.join(__dirname, '..', 'ops', 'manifests', 'logistics-floor-plan-manifest.json'));

test('floor-plan manifest has the expected ready and blocked scope', () => {
  const validation = validateManifest(manifest);
  assert.equal(validation.ok, true, validation.errors.join('\n'));
  assert.deepEqual(validation.summary, { asset_count: 2, plan_count: 23, ready_count: 23, blocked_count: 0 });
});

test('registration plan only emits verified, unambiguous records', () => {
  const plan = buildRegistrationPlan(manifest, 'qa-floor-plan-bucket');
  assert.equal(plan.ready.length, 23);
  assert.equal(plan.blocked.length, 0);
  assert.ok(plan.ready.some((row) => row.asset_id === 'asset_a112721001'));
  assert.ok(plan.ready.some((row) => row.asset_id === 'asset_a120085001'));
  assert.match(plan.sql, /on conflict \(asset_id, file_type, storage_bucket, storage_path\) do update/u);
  assert.match(plan.sql, /asset-spec\/floor-plans\/asset_a112721001\/b1\.png/u);
  assert.match(plan.sql, /asset-spec\/floor-plans\/asset_a120085001\/b2\.png/u);
});
