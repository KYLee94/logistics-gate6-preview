const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');

const {
  PRODUCTION_PROJECT_REF,
  attachManifestSha,
  assertPreflightApplyGate,
  assertStagingTarget,
  buildRollbackDrillContract,
  canonicalStringify,
  compareManifests,
  deriveExpectedRelationsFromSqlFiles,
  sha256File,
  sha256Text,
  validateApprovedDelta,
  validatePreflightDiagnostics,
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
      local_migration_versions_sha256: '5'.repeat(64),
      database_migration_versions_sha256: '5'.repeat(64),
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
      migration_head_mismatch: false,
      migration_catalog_mismatch: false,
      missing_expected_objects: [],
      unexpected_objects: [],
      type_mismatches: [],
      relkind_mismatches: [],
      expected_dropped_present: [],
      missing_primary_keys: [],
      missing_pk_indexes: [],
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
  object_owner: 'postgres',
  security_invoker: true,
  grants: [{ grantee: 'authenticated', privilege_type: 'SELECT', is_grantable: 'NO' }],
  dependencies: [{ dependency_type: 'view_dependency', dependent_object: 'public.ll_legacy_view', referenced_object: 'public.ll_assets', dependency_name: null }],
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
        view_metadata: {
          security_invoker: removableView.security_invoker,
          owner: removableView.object_owner,
          grants: removableView.grants,
          dependencies: removableView.dependencies,
        },
      },
    }],
  };
}

function writeRehearsalEvidence(tempDir, pre, delta) {
  const schemaBackupPath = path.join(tempDir, 'll_legacy_view-schema.sql');
  const restoredManifestPath = path.join(tempDir, 'post-restore.json');
  fs.writeFileSync(schemaBackupPath, `create view public.ll_legacy_view as${removableView.definition_sql}\n`, 'utf8');
  fs.writeFileSync(restoredManifestPath, JSON.stringify(pre), 'utf8');
  const bytes = fs.statSync(schemaBackupPath).size;
  const evidence = {
    schema_version: 'gate6-db-cleanup-rehearsal-evidence/v1',
    environment: 'staging',
    project_ref: pre.provenance.project_ref,
    pre_manifest_sha256: pre.manifest_sha256,
    approved_delta_sha256: sha256Text(canonicalStringify(delta)),
    backup: {
      captured_at: '2026-07-10T00:01:00.000Z',
      artifacts: [{
        qualified_name: removableView.qualified_name,
        kind: 'schema',
        path: schemaBackupPath,
        byte_count: bytes,
        sha256: sha256File(schemaBackupPath),
      }],
    },
    restore: {
      completed_at: '2026-07-10T00:02:00.000Z',
      post_restore_manifest_path: restoredManifestPath,
      post_restore_manifest_sha256: pre.manifest_sha256,
      restored_object_names: [removableView.qualified_name],
    },
  };
  const evidencePath = path.join(tempDir, 'rehearsal-evidence.json');
  fs.writeFileSync(evidencePath, JSON.stringify(evidence), 'utf8');
  return { evidence, evidencePath };
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
  assert.match(sql, /security_invoker/iu);
  assert.match(sql, /missing_pk_indexes/iu);
  assert.equal(assertReadOnlySql(sql), true);
});

test('preflight LIKE clauses use a one-character PostgreSQL escape literal', () => {
  const sql = buildPreflightSql();
  const escapeLiterals = [...sql.matchAll(/\blike\s+'ll\\_%'\s+escape\s+'([^']*)'/giu)].map((match) => match[1]);
  assert.ok(escapeLiterals.length > 0);
  assert.deepEqual([...new Set(escapeLiterals)], ['\\']);
});

test('preflight diagnostics are fail-closed for migration, relkind, PK, and FK failures', () => {
  const cases = [
    ['migration_mismatch', true, /migration/i],
    ['relkind_mismatches', [{ object_name: 'll_assets' }], /relkind/i],
    ['missing_pk_indexes', [{ object_name: 'll_assets' }], /primary key index/i],
    ['missing_fk_indexes', [{ object_name: 'll_leases' }], /foreign key index/i],
  ];
  for (const [key, value, expectedError] of cases) {
    const manifest = fixtureManifest([protectedObject, removableView]);
    manifest.diagnostics[key] = value;
    const blocked = attachManifestSha(manifest);
    const result = validatePreflightDiagnostics(blocked);
    assert.equal(result.ok, false, key);
    assert.match(result.blockers.join('\n'), expectedError);
    assert.throws(() => assertPreflightApplyGate(blocked), expectedError);
  }

  const missingDiagnostics = fixtureManifest([protectedObject, removableView]);
  delete missingDiagnostics.diagnostics.missing_fk_indexes;
  const missingResult = validatePreflightDiagnostics(attachManifestSha(missingDiagnostics));
  assert.equal(missingResult.ok, false);
  assert.match(missingResult.blockers.join('\n'), /missing_fk_indexes/i);
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

test('view rollback contracts preserve security, ownership, grants, and dependencies', () => {
  const pre = fixtureManifest([protectedObject, removableView]);
  const incomplete = fixtureDelta(pre);
  delete incomplete.operations[0].rollback.view_metadata;
  const validation = validateApprovedDelta(incomplete, pre);
  assert.equal(validation.ok, false);
  assert.match(validation.errors.join('\n'), /view metadata/i);
});

test('rollback rehearsal rejects production and cannot pass without verified backup and restore evidence', () => {
  assert.throws(() => assertStagingTarget(PRODUCTION_PROJECT_REF, PRODUCTION_PROJECT_REF), /production/iu);
  assert.doesNotThrow(() => assertStagingTarget('staging-project-ref', PRODUCTION_PROJECT_REF));
  const pre = fixtureManifest([protectedObject, removableView]);
  const delta = fixtureDelta(pre);
  const contract = buildRollbackDrillContract(pre, fixtureDelta(pre), {
    environment: 'staging',
    projectRef: 'staging-project-ref',
    productionProjectRef: PRODUCTION_PROJECT_REF,
  });
  assert.equal(contract.ok, false);
  assert.match(contract.blockers.join('\n'), /evidence/i);
  assert.equal(contract.rollback_steps.length, 1);

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gate6-db-cleanup-evidence-'));
  try {
    const { evidence } = writeRehearsalEvidence(tempDir, pre, delta);
    const verified = buildRollbackDrillContract(pre, delta, {
      environment: 'staging',
      projectRef: 'staging-project-ref',
      productionProjectRef: PRODUCTION_PROJECT_REF,
      evidence,
    });
    assert.equal(verified.ok, true);
    assert.equal(verified.actual_backup_restore_verified, true);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
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
    const { evidencePath } = writeRehearsalEvidence(tempDir, pre, delta);

    const rehearsal = spawnSync(process.execPath, [
      path.join(__dirname, 'logistics-db-cleanup-rehearsal.cjs'),
      '--manifest', prePath,
      '--approved-delta', deltaPath,
      '--project-ref', 'staging-project-ref',
      '--environment', 'staging',
      '--evidence', evidencePath,
      '--out', path.join(tempDir, 'rehearsal.json'),
    ], { encoding: 'utf8' });
    assert.equal(rehearsal.status, 0, rehearsal.stderr || rehearsal.stdout);
    assert.match(rehearsal.stdout, /"production_forbidden": true/u);
    assert.match(rehearsal.stdout, /"actual_backup_restore_verified": true/u);

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

    const rejectedMigrationReplay = spawnSync(process.execPath, [
      path.resolve(__dirname, '..', 'ops', 'logistics-db-cleanup-apply.cjs'),
      '--pre-manifest', prePath,
      '--approved-delta', deltaPath,
      '--replay-migration', '20260611061529',
    ], { encoding: 'utf8' });
    assert.notEqual(rejectedMigrationReplay.status, 0);
    assert.match(rejectedMigrationReplay.stderr, /unsupported apply option|migration replay/i);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
