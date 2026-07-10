const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');

const {
  PRODUCTION_PROJECT_REF,
  attachManifestSha,
  assertStagingTarget,
  buildRollbackDrillContract,
  canonicalStringify,
  compareManifests,
  deriveExpectedRelationsFromSqlFiles,
  validateApprovedDelta,
  verifyManifest,
} = require('../lib/logistics-db-cleanup-core.cjs');
const {
  assertReadOnlySql,
  buildApplySql,
  buildPreflightSql,
} = require('../lib/logistics-db-cleanup-sql.cjs');

function fixtureManifest(objects) {
  return attachManifestSha({
    schema_version: 'gate6-db-cleanup-manifest/v1',
    kind: 'preflight',
    generated_at: '2026-07-10T00:00:00.000Z',
    provenance: {
      project_ref: 'staging-project-ref',
      git_sha: 'a'.repeat(40),
      local_migration_head: '20260616090000',
      database_migration_head: '20260616090000',
    },
    snapshot: {
      transaction_isolation: 'repeatable read',
      transaction_read_only: 'on',
      database_stats_reset: '2026-07-01T00:00:00.000Z',
    },
    objects,
    storage: {
      buckets: [{ id: 'bucket-a', object_count: 1, object_manifest_sha256: 'f'.repeat(64) }],
      policies: [],
    },
    diagnostics: {
      migration_mismatch: false,
      missing_expected_objects: [],
      unexpected_objects: [],
      type_mismatches: [],
      expected_dropped_present: [],
      missing_primary_keys: [],
      missing_fk_indexes: [],
    },
  });
}

const protectedObject = {
  qualified_name: 'public.ll_assets',
  object_kind: 'table',
  exact_count: 2,
  canonical_json_sha256: '1'.repeat(64),
  structure_sha256: '2'.repeat(64),
};
const removableView = {
  qualified_name: 'public.ll_legacy_view',
  object_kind: 'view',
  exact_count: 0,
  canonical_json_sha256: '3'.repeat(64),
  structure_sha256: '4'.repeat(64),
  definition_sql: ' SELECT 1 AS id;',
};

function fixtureDelta(preManifest) {
  return {
    schema_version: 'gate6-db-cleanup-approved-delta/v1',
    project_ref: preManifest.provenance.project_ref,
    pre_manifest_sha256: preManifest.manifest_sha256,
    operations: [{
      operation: 'drop_relation',
      qualified_name: removableView.qualified_name,
      object_kind: removableView.object_kind,
      expected_exact_count: removableView.exact_count,
      expected_canonical_json_sha256: removableView.canonical_json_sha256,
      expected_structure_sha256: removableView.structure_sha256,
      rollback: {
        strategy: 'recreate_view',
        definition_sql: removableView.definition_sql,
      },
    }],
  };
}

test('canonical JSON and manifest SHA are stable across key order', () => {
  assert.equal(canonicalStringify({ b: 2, a: { d: 4, c: 3 } }), canonicalStringify({ a: { c: 3, d: 4 }, b: 2 }));
  const manifest = fixtureManifest([protectedObject, removableView]);
  assert.equal(verifyManifest(manifest).ok, true);
  assert.equal(manifest.manifest_sha256.length, 64);
});

test('preflight SQL is one repeatable-read read-only transaction', () => {
  const sql = buildPreflightSql();
  assert.match(sql, /begin\s+isolation\s+level\s+repeatable\s+read\s+read\s+only/iu);
  assert.match(sql, /current_setting\('transaction_read_only'\)/u);
  assert.match(sql, /xpath\('\/table\/row\/exact_count\/text\(\)'/u);
  assert.match(sql, /xpath\('\/table\/row\/canonical_json_sha256\/text\(\)'/u);
  assert.equal(assertReadOnlySql(sql), true);
});

test('local migration parser ignores disabled cleanup comments', () => {
  const relations = deriveExpectedRelationsFromSqlFiles([
    { name: '001.sql', sql: 'create table public.ll_live(id int); /* drop table public.ll_live; create view public.ll_live as select 1; */' },
    { name: '002.sql', sql: '-- drop table public.ll_other\ncreate view public.ll_view as select 1;' },
  ]);
  assert.equal(relations.active.get('ll_live').kind, 'table');
  assert.equal(relations.active.get('ll_view').kind, 'view');
  assert.equal(relations.dropped.has('ll_live'), false);
});

test('postcheck permits only the approved drop and protects checksums', () => {
  const pre = fixtureManifest([protectedObject, removableView]);
  const post = fixtureManifest([protectedObject]);
  const delta = fixtureDelta(pre);
  assert.equal(validateApprovedDelta(delta, pre).ok, true);
  const report = compareManifests(pre, post, delta);
  assert.equal(report.ok, true);
  assert.deepEqual(report.approved_drops, [removableView.qualified_name]);

  const changed = fixtureManifest([{ ...protectedObject, canonical_json_sha256: '9'.repeat(64) }]);
  const failed = compareManifests(pre, changed, delta);
  assert.equal(failed.ok, false);
  assert.match(failed.violations.join('\n'), /protected checksum changed/iu);
});

test('apply SQL validates snapshot guards and uses RESTRICT without CASCADE', () => {
  const pre = fixtureManifest([protectedObject, removableView]);
  const delta = fixtureDelta(pre);
  const sql = buildApplySql(pre, delta);
  assert.match(sql, /drop\s+view\s+public\.ll_legacy_view\s+restrict/iu);
  assert.doesNotMatch(sql, /\bcascade\b/iu);
  assert.match(sql, /expected canonical checksum mismatch/iu);
});

test('rollback rehearsal rejects production and requires rollback contracts', () => {
  assert.throws(() => assertStagingTarget(PRODUCTION_PROJECT_REF, PRODUCTION_PROJECT_REF), /production/iu);
  assert.doesNotThrow(() => assertStagingTarget('staging-project-ref', PRODUCTION_PROJECT_REF));
  const pre = fixtureManifest([protectedObject, removableView]);
  const contract = buildRollbackDrillContract(pre, fixtureDelta(pre), {
    environment: 'staging',
    projectRef: 'staging-project-ref',
    productionProjectRef: PRODUCTION_PROJECT_REF,
  });
  assert.equal(contract.ok, true);
  assert.equal(contract.rollback_steps.length, 1);
});

test('CLI rehearsal, postcheck, and apply dry-run stay offline and honor contracts', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gate6-db-cleanup-self-test-'));
  try {
    const pre = fixtureManifest([protectedObject, removableView]);
    const post = fixtureManifest([protectedObject]);
    const delta = fixtureDelta(pre);
    const prePath = path.join(tempDir, 'pre.json');
    const postPath = path.join(tempDir, 'post.json');
    const deltaPath = path.join(tempDir, 'delta.json');
    fs.writeFileSync(prePath, JSON.stringify(pre), 'utf8');
    fs.writeFileSync(postPath, JSON.stringify(post), 'utf8');
    fs.writeFileSync(deltaPath, JSON.stringify(delta), 'utf8');

    const rehearsal = spawnSync(process.execPath, [
      path.join(__dirname, 'logistics-db-cleanup-rehearsal.cjs'),
      '--manifest', prePath,
      '--approved-delta', deltaPath,
      '--project-ref', 'staging-project-ref',
      '--environment', 'staging',
      '--out', path.join(tempDir, 'rehearsal.json'),
    ], { encoding: 'utf8' });
    assert.equal(rehearsal.status, 0, rehearsal.stderr || rehearsal.stdout);
    assert.match(rehearsal.stdout, /"production_forbidden": true/u);

    const postcheck = spawnSync(process.execPath, [
      path.join(__dirname, 'logistics-db-cleanup-postcheck.cjs'),
      '--pre-manifest', prePath,
      '--post-manifest', postPath,
      '--approved-delta', deltaPath,
      '--out', path.join(tempDir, 'postcheck.json'),
    ], { encoding: 'utf8' });
    assert.equal(postcheck.status, 0, postcheck.stderr || postcheck.stdout);
    assert.match(postcheck.stdout, /"ok": true/u);

    const applyDryRun = spawnSync(process.execPath, [
      path.resolve(__dirname, '..', 'ops', 'logistics-db-cleanup-apply.cjs'),
      '--pre-manifest', prePath,
      '--approved-delta', deltaPath,
    ], { encoding: 'utf8' });
    assert.equal(applyDryRun.status, 0, applyDryRun.stderr || applyDryRun.stdout);
    assert.match(applyDryRun.stdout, /"apply_executed": false/u);
    assert.match(applyDryRun.stdout, /drop view public\.ll_legacy_view restrict/iu);
    assert.doesNotMatch(applyDryRun.stdout, /\bdrop\b[^;]+\bcascade\b/iu);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
