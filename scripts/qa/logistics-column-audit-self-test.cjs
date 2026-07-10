const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');

const {
  assertReadOnlySql,
  buildAuditManifest,
  buildColumnStatsSql,
  buildMetadataSql,
  verifyManifest,
} = require('../lib/logistics-column-audit-core.cjs');

test('column audit remains read-only and holds every column', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gate6-column-audit-'));
  try {
    fs.mkdirSync(path.join(root, 'src'), { recursive: true });
    fs.writeFileSync(path.join(root, 'src', 'demo.js'), "const table = 'll_demo';\nclient.from(table).select('used_value');\n", 'utf8');
    const snapshot = {
      status: 'available',
      project_ref: 'staging-project-ref',
      metadata: {
        transaction_isolation: 'repeatable read',
        transaction_read_only: 'on',
        columns: [
          { schema_name: 'public', table_name: 'll_clean', relation_kind: 'r', column_name: 'unused_value', ordinal_position: 1, data_type: 'text', nullable: true, default_expression: null, identity: false, generated: false, rls_enabled: false, rls_forced: false },
          { schema_name: 'public', table_name: 'll_demo', relation_kind: 'r', column_name: 'used_value', ordinal_position: 2, data_type: 'text', nullable: true, default_expression: null, identity: false, generated: false, rls_enabled: true, rls_forced: false },
        ],
        indexes: [{ schema_name: 'public', table_name: 'll_demo', column_name: 'used_value', index_name: 'idx_demo_used' }],
        foreign_keys: [{ source_schema: 'public', source_table: 'll_demo', source_column: 'used_value', target_schema: 'public', target_table: 'll_parent', target_column: 'id', constraint_name: 'demo_used_fkey' }],
        rls_policies: [{ schema_name: 'public', table_name: 'll_demo', policy_name: 'demo_policy', command: 'ALL' }],
        column_dependencies: [],
      },
      statistics: [
        { schema_name: 'public', table_name: 'll_clean', column_name: 'unused_value', row_count: 3, null_count: 3, distinct_count: 0, payload_size_bytes: 12, non_null_payload_size_bytes: 0 },
        { schema_name: 'public', table_name: 'll_demo', column_name: 'used_value', row_count: 3, null_count: 1, distinct_count: 2, payload_size_bytes: 18, non_null_payload_size_bytes: 10 },
      ],
      queries: [],
      error: null,
    };
    const manifest = buildAuditManifest(snapshot, { root });
    assert.equal(verifyManifest(manifest).ok, true);
    assert.equal(manifest.safety_gate.decision, 'hold');
    const unused = manifest.columns.find((column) => column.column_name === 'unused_value');
    const used = manifest.columns.find((column) => column.column_name === 'used_value');
    assert.equal(unused.criteria.eligible_for_manual_review, true);
    assert.equal(unused.decision, 'hold');
    assert.equal(used.criteria.eligible_for_manual_review, false);
    assert.ok(used.blockers.includes('index_dependency_present'));
    assert.equal(used.code_references.by_kind.read, 1);

    const metadataSql = buildMetadataSql(1000);
    const statsSql = buildColumnStatsSql(snapshot.metadata.columns, 1000);
    assert.equal(assertReadOnlySql(metadataSql), true);
    assert.equal(assertReadOnlySql(statsSql), true);
    assert.doesNotMatch(`${metadataSql}\n${statsSql}`, /\b(drop|delete|alter|insert|update)\b/iu);

    const dryRunPath = path.join(root, 'dry-run.json');
    const cli = spawnSync(process.execPath, [
      path.join(__dirname, 'logistics-column-audit-preflight.cjs'),
      '--dry-run',
      '--out', dryRunPath,
    ], { encoding: 'utf8' });
    assert.equal(cli.status, 0, cli.stderr || cli.stdout);
    const dryRun = JSON.parse(fs.readFileSync(dryRunPath, 'utf8'));
    assert.equal(dryRun.execution.database_query_executed, false);
    assert.equal(dryRun.safety_gate.decision, 'hold');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
