const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const ARTIFACT_DIR = path.join(ROOT, 'qa-artifacts', 'logistics-gate6', 'db-cleanup');
const PRODUCTION_PROJECT_REF = 'qvegpozwrcmspdvjokiz';
const MANIFEST_SCHEMA_VERSION = 'gate6-db-cleanup-manifest/v1';
const DELTA_SCHEMA_VERSION = 'gate6-db-cleanup-approved-delta/v1';
const REHEARSAL_EVIDENCE_SCHEMA_VERSION = 'gate6-db-cleanup-rehearsal-evidence/v1';
const PROTECTED_HOLD_RELATIONS = new Set([
  'public.ll_source_rows',
  'public.ll_source_review_logs',
]);
const REMOTE_BASELINE_RELATIONS = new Map([
  ['ll_assets', { kind: 'table', source: 'remote_baseline' }],
  ['ll_tenants', { kind: 'table', source: 'remote_baseline' }],
  ['ll_leases', { kind: 'table', source: 'remote_baseline' }],
  ['ll_lease_spaces', { kind: 'table', source: 'remote_baseline' }],
  ['ll_rent_history', { kind: 'table', source: 'remote_baseline' }],
]);

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
}

function canonicalStringify(value) {
  return JSON.stringify(canonicalize(value));
}

function sha256Text(value) {
  return crypto.createHash('sha256').update(String(value), 'utf8').digest('hex');
}

function sha256File(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function attachManifestSha(manifest) {
  const next = cloneJson(manifest);
  delete next.manifest_sha256;
  next.manifest_sha256 = sha256Text(canonicalStringify(next));
  return next;
}

function isExplicitApprovedManifest(manifest) {
  return manifest?.safety_gate?.explicit_approved_manifest === true;
}

function verifyManifest(manifest) {
  const errors = [];
  if (!manifest || typeof manifest !== 'object') return { ok: false, errors: ['manifest must be an object'] };
  if (manifest.schema_version !== MANIFEST_SCHEMA_VERSION) errors.push(`unsupported manifest schema: ${manifest.schema_version}`);
  if (manifest.kind !== 'preflight') errors.push(`manifest kind must be preflight: ${manifest.kind}`);
  if (!manifest.provenance?.project_ref) errors.push('manifest project_ref is required');
  if (manifest.snapshot?.transaction_isolation !== 'repeatable read') errors.push('manifest was not captured with repeatable read');
  if (!['on', 'true'].includes(String(manifest.snapshot?.transaction_read_only || '').toLowerCase())) errors.push('manifest was not captured read-only');
  if (manifest?.safety_gate?.decision !== 'hold') errors.push('manifest safety gate must remain hold');
  if (manifest?.safety_gate?.explicit_approved_manifest_required !== true) errors.push('manifest must require an explicit approved manifest for DROP');
  const expected = attachManifestSha(manifest).manifest_sha256;
  if (!/^[a-f0-9]{64}$/u.test(String(manifest.manifest_sha256 || ''))) errors.push('manifest SHA-256 is missing or invalid');
  else if (manifest.manifest_sha256 !== expected) errors.push('manifest SHA-256 does not match canonical content');
  return { ok: errors.length === 0, errors, expected_manifest_sha256: expected };
}

function stripSqlComments(sql) {
  return String(sql || '')
    .replace(/\/\*[\s\S]*?\*\//gu, ' ')
    .replace(/--[^\r\n]*/gu, ' ');
}

function deriveExpectedRelationsFromSqlFiles(files) {
  const events = new Map();
  for (const file of [...files].sort((a, b) => a.name.localeCompare(b.name))) {
    const sql = stripSqlComments(file.sql);
    const pattern = /\b(create(?:\s+or\s+replace)?|drop)\s+(table|materialized\s+view|view)\s+(?:if\s+(?:not\s+)?exists\s+)?(?:public\.)?(ll_[a-z0-9_]+)/giu;
    for (const match of sql.matchAll(pattern)) {
      const operation = match[1].toLowerCase().startsWith('drop') ? 'drop' : 'create';
      const rawKind = match[2].toLowerCase().replace(/\s+/gu, '_');
      const kind = rawKind === 'materialized_view' ? 'materialized_view' : rawKind;
      events.set(match[3].toLowerCase(), { operation, kind, migration: file.name });
    }
  }
  const active = new Map();
  const dropped = new Map();
  for (const [name, event] of events) {
    if (event.operation === 'drop') dropped.set(name, event);
    else active.set(name, event);
  }
  for (const [name, value] of REMOTE_BASELINE_RELATIONS) {
    if (!active.has(name) && !dropped.has(name)) active.set(name, value);
  }
  return { active, dropped, events };
}

function readMigrationFiles(root = ROOT) {
  const migrationDir = path.join(root, 'supabase', 'migrations');
  if (!fs.existsSync(migrationDir)) return [];
  return fs.readdirSync(migrationDir)
    .filter((name) => /^\d+.*\.sql$/u.test(name))
    .sort()
    .map((name) => ({ name, sql: fs.readFileSync(path.join(migrationDir, name), 'utf8') }));
}

function localMigrationHead(files = readMigrationFiles()) {
  const versions = files.map((file) => file.name.match(/^(\d+)/u)?.[1]).filter(Boolean).sort();
  return versions.at(-1) || '';
}

function migrationVersionsFromFiles(files) {
  return files
    .map((file) => file.name.match(/^(\d+)/u)?.[1])
    .filter(Boolean)
    .sort();
}

function migrationVersionsFromRows(rows) {
  return asArray(rows)
    .map((row) => stringValue(row?.version))
    .filter(Boolean)
    .sort();
}

function localGitSha(root = ROOT) {
  return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
}

function readLinkedProjectRef(root = ROOT) {
  const candidates = [
    path.join(root, 'supabase', '.temp', 'project-ref'),
    path.join(root, '.supabase', 'project-ref'),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return fs.readFileSync(candidate, 'utf8').trim();
  }
  return '';
}

function parseJsonFromOutput(raw) {
  const text = String(raw || '').trim();
  if (!text) throw new Error('Supabase CLI returned no JSON output.');
  try {
    return JSON.parse(text);
  } catch {
    // Supabase CLI can print notices before the JSON payload.
  }
  const starts = [];
  for (let index = 0; index < text.length; index += 1) {
    if (text[index] === '{' || text[index] === '[') starts.push(index);
  }
  for (const start of starts) {
    for (let end = text.length - 1; end > start; end -= 1) {
      if (text[end] !== '}' && text[end] !== ']') continue;
      try {
        return JSON.parse(text.slice(start, end + 1));
      } catch {
        // Continue to the next possible boundary.
      }
    }
  }
  throw new Error('Supabase CLI JSON output could not be parsed.');
}

function extractRows(parsed) {
  if (Array.isArray(parsed)) {
    const nestedRows = parsed.flatMap((item) => Array.isArray(item?.rows) ? item.rows : []);
    return nestedRows.length ? nestedRows : parsed;
  }
  if (Array.isArray(parsed?.rows)) return parsed.rows;
  if (Array.isArray(parsed?.result?.rows)) return parsed.result.rows;
  return [];
}

function sanitizeCommandError(value) {
  const message = String(value || '');
  if (/unexpected status 524|error code 524|\b524:\s*a timeout occurred/iu.test(message)) {
    return 'Supabase Management API returned HTTP 524 while initialising the linked database login role.';
  }
  return message
    .replace(/postgres(?:ql)?:\/\/[^\s@]+@/giu, 'postgresql://[redacted]@')
    .replace(/(password|service_role_key|access_token)=([^\s&]+)/giu, '$1=[redacted]')
    .trim();
}

function sleepSync(milliseconds) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, milliseconds);
}

function runSupabaseDbQuery(sql, options = {}) {
  const root = options.root || ROOT;
  const prefix = options.prefix || 'gate6-db-cleanup';
  const sqlFile = path.join(os.tmpdir(), `${prefix}-${process.pid}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}.sql`);
  fs.writeFileSync(sqlFile, sql, 'utf8');
  try {
    const retries = Math.max(0, Number(options.retries || 0));
    for (let attempt = 0; attempt <= retries; attempt += 1) {
      const result = spawnSync('npx', ['--yes', 'supabase', 'db', 'query', '--linked', '--file', sqlFile, '-o', 'json'], {
        cwd: root,
        encoding: 'utf8',
        maxBuffer: 1024 * 1024 * 256,
        shell: process.platform === 'win32',
        timeout: options.timeoutMs || 15 * 60 * 1000,
        windowsHide: true,
        env: process.env,
      });
      if (result.error) throw result.error;
      if (result.status === 0) return extractRows(parseJsonFromOutput(result.stdout || ''));
      const errorMessage = sanitizeCommandError(result.stderr || result.stdout || `supabase db query exited ${result.status}`);
      const transient = /HTTP 524|timeout|temporarily unavailable|connection reset/iu.test(errorMessage);
      if (attempt < retries && transient) {
        sleepSync(Number(options.retryDelayMs || 5000));
        continue;
      }
      throw new Error(errorMessage);
    }
    throw new Error('Supabase DB query exhausted retries.');
  } finally {
    fs.rmSync(sqlFile, { force: true });
  }
}

function asArray(value) {
  if (Array.isArray(value)) return value;
  if (value === null || value === undefined) return [];
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function stringValue(value) {
  if (value === null || value === undefined) return null;
  return String(value);
}

function protectedHoldReason(qualifiedName) {
  return PROTECTED_HOLD_RELATIONS.has(qualifiedName) ? 'archive_review_hold' : 'operational_hold';
}

function sortRows(rows, fields) {
  return [...rows].sort((left, right) => {
    for (const field of fields) {
      const compared = String(left?.[field] ?? '').localeCompare(String(right?.[field] ?? ''));
      if (compared) return compared;
    }
    return canonicalStringify(left).localeCompare(canonicalStringify(right));
  });
}

function rowsForObject(rows, relation, options = {}) {
  const qualifiedName = `${relation.schema_name}.${relation.object_name}`;
  return rows.filter((row) => {
    if (row.schema_name === relation.schema_name && row.object_name === relation.object_name) return true;
    if (options.dependencies) return row.dependent_object === qualifiedName || row.referenced_object === qualifiedName;
    return false;
  });
}

function buildObjectInventory(snapshot) {
  const relations = asArray(snapshot.relations);
  const stats = new Map(asArray(snapshot.relation_stats).map((row) => [`${row.schema_name}.${row.object_name}`, row]));
  const columns = asArray(snapshot.columns);
  const constraints = asArray(snapshot.constraints);
  const indexes = asArray(snapshot.indexes);
  const policies = asArray(snapshot.policies);
  const grants = asArray(snapshot.grants);
  const dependencies = asArray(snapshot.dependencies);
  const tableUsage = asArray(snapshot.table_usage);
  const indexUsage = asArray(snapshot.index_usage);

  return relations.map((relation) => {
    const qualifiedName = `${relation.schema_name}.${relation.object_name}`;
    const objectColumns = sortRows(rowsForObject(columns, relation), ['ordinal_position', 'column_name']);
    const objectConstraints = sortRows(rowsForObject(constraints, relation), ['constraint_name']);
    const objectIndexes = sortRows(rowsForObject(indexes, relation), ['index_name']);
    const objectPolicies = sortRows(rowsForObject(policies, relation), ['policyname']);
    const objectGrants = sortRows(rowsForObject(grants, relation), ['grantee', 'privilege_type']);
    const objectDependencies = sortRows(rowsForObject(dependencies, relation, { dependencies: true }), ['dependency_type', 'dependent_object', 'referenced_object']);
    const usage = rowsForObject(tableUsage, relation)[0] || null;
    const objectIndexUsage = sortRows(rowsForObject(indexUsage, relation), ['index_name']);
    const structure = {
      object_kind: relation.object_kind,
      relkind: relation.relkind || null,
      object_owner: relation.object_owner,
      security_invoker: Boolean(relation.security_invoker),
      rls_enabled: relation.rls_enabled,
      rls_forced: relation.rls_forced,
      definition_sql: relation.definition_sql || null,
      columns: objectColumns,
      constraints: objectConstraints,
      indexes: objectIndexes,
      policies: objectPolicies,
      grants: objectGrants,
      dependencies: objectDependencies,
    };
    const relationStat = stats.get(qualifiedName) || {};
    const holdReason = protectedHoldReason(qualifiedName);
    return {
      schema_name: relation.schema_name,
      object_name: relation.object_name,
      qualified_name: qualifiedName,
      object_kind: relation.object_kind,
      relkind: relation.relkind || null,
      object_owner: relation.object_owner,
      security_invoker: Boolean(relation.security_invoker),
      rls_enabled: Boolean(relation.rls_enabled),
      rls_forced: Boolean(relation.rls_forced),
      relation_size_bytes: stringValue(relation.relation_size_bytes),
      total_size_bytes: stringValue(relation.total_size_bytes),
      estimated_row_count: stringValue(relationStat.estimated_row_count),
      exact_count: stringValue(relationStat.exact_count),
      canonical_json_sha256: relationStat.canonical_json_sha256 || null,
      structure_sha256: sha256Text(canonicalStringify(structure)),
      definition_sql: relation.definition_sql || null,
      columns: objectColumns,
      primary_keys: objectConstraints.filter((row) => row.constraint_type === 'p'),
      foreign_keys: objectConstraints.filter((row) => row.constraint_type === 'f'),
      constraints: objectConstraints,
      indexes: objectIndexes,
      policies: objectPolicies,
      grants: objectGrants,
      dependencies: objectDependencies,
      usage,
      index_usage: objectIndexUsage,
      object_comment: relation.object_comment || null,
      decision: 'hold',
      hold_reason: holdReason,
      explicit_approved_manifest_required: true,
      preflight_drop_eligible: false,
    };
  }).sort((left, right) => left.qualified_name.localeCompare(right.qualified_name));
}

function compareExpectedObjects(objects, expectedRelations) {
  const actual = new Map(objects.map((object) => [object.object_name, object]));
  const missingExpectedObjects = [];
  const typeMismatches = [];
  const relkindMismatches = [];
  const expectedDroppedPresent = [];
  const unexpectedObjects = [];
  for (const [name, expected] of expectedRelations.active) {
    const found = actual.get(name);
    if (!found) {
      missingExpectedObjects.push({ object_name: name, expected_kind: expected.kind, source: expected.migration || expected.source || 'migration' });
      continue;
    }
    const compatibleTable = expected.kind === 'table' && ['table', 'partitioned_table'].includes(found.object_kind);
    if (!compatibleTable && found.object_kind !== expected.kind) {
      const mismatch = {
        object_name: name,
        expected_kind: expected.kind,
        actual_kind: found.object_kind,
        expected_relkind: expectedRelkindForObjectKind(expected.kind),
        actual_relkind: found.relkind || null,
      };
      typeMismatches.push(mismatch);
      relkindMismatches.push(mismatch);
    }
  }
  for (const [name, expected] of expectedRelations.dropped) {
    if (actual.has(name)) expectedDroppedPresent.push({ object_name: name, expected_drop_migration: expected.migration, actual_kind: actual.get(name).object_kind });
  }
  for (const object of objects) {
    if (!expectedRelations.active.has(object.object_name) && !expectedRelations.dropped.has(object.object_name)) {
      unexpectedObjects.push({ object_name: object.object_name, object_kind: object.object_kind });
    }
  }
  return {
    missing_expected_objects: missingExpectedObjects,
    unexpected_objects: unexpectedObjects,
    type_mismatches: typeMismatches,
    relkind_mismatches: relkindMismatches,
    expected_dropped_present: expectedDroppedPresent,
  };
}

function expectedRelkindForObjectKind(objectKind) {
  return {
    table: 'r',
    partitioned_table: 'p',
    view: 'v',
    materialized_view: 'm',
    foreign_table: 'f',
  }[objectKind] || null;
}

function buildStorageInventory(snapshot) {
  const buckets = sortRows(asArray(snapshot.storage_buckets), ['id']);
  const policies = sortRows(asArray(snapshot.storage_policies), ['tablename', 'policyname']);
  const inventory = { buckets, objects: [], policies };
  return { ...inventory, storage_manifest_sha256: sha256Text(canonicalStringify(inventory)) };
}

function buildPreflightManifest(snapshot, options = {}) {
  if (!snapshot || typeof snapshot !== 'object') throw new Error('Database snapshot is missing.');
  if (snapshot.transaction_isolation !== 'repeatable read') throw new Error(`Unexpected transaction isolation: ${snapshot.transaction_isolation}`);
  if (!['on', 'true'].includes(String(snapshot.transaction_read_only || '').toLowerCase())) throw new Error('Database snapshot was not read-only.');
  const projectRef = options.projectRef || readLinkedProjectRef(options.root || ROOT);
  if (!projectRef) throw new Error('Linked Supabase project ref was not found.');
  const migrationFiles = options.migrationFiles || readMigrationFiles(options.root || ROOT);
  const expectedRelations = deriveExpectedRelationsFromSqlFiles(migrationFiles);
  const objects = buildObjectInventory(snapshot);
  const expectedDiagnostics = compareExpectedObjects(objects, expectedRelations);
  const localHead = options.localMigrationHead || localMigrationHead(migrationFiles);
  const databaseHead = stringValue(snapshot.database_migration_head) || '';
  const localMigrationVersions = migrationVersionsFromFiles(migrationFiles);
  const databaseMigrationVersions = migrationVersionsFromRows(snapshot.database_migrations);
  const migrationHeadMismatch = localHead !== databaseHead;
  const migrationCatalogMismatch = canonicalStringify(localMigrationVersions) !== canonicalStringify(databaseMigrationVersions);
  const protectedHoldObjects = objects
    .filter((object) => PROTECTED_HOLD_RELATIONS.has(object.qualified_name))
    .map((object) => object.qualified_name);
  const diagnostics = {
    migration_mismatch: migrationHeadMismatch || migrationCatalogMismatch,
    migration_head_mismatch: migrationHeadMismatch,
    migration_catalog_mismatch: migrationCatalogMismatch,
    ...expectedDiagnostics,
    missing_primary_keys: asArray(snapshot.missing_primary_keys),
    missing_pk_indexes: asArray(snapshot.missing_pk_indexes),
    missing_fk_indexes: asArray(snapshot.missing_fk_indexes),
    pg_stat_statements_available: Boolean(snapshot.pg_stat_statements_available),
    pgcrypto_digest_available: Boolean(snapshot.pgcrypto_digest_available),
  };
  return attachManifestSha({
    schema_version: MANIFEST_SCHEMA_VERSION,
    kind: 'preflight',
    generated_at: new Date().toISOString(),
    provenance: {
      project_ref: projectRef,
      environment: options.environment || 'unknown',
      git_sha: options.gitSha || localGitSha(options.root || ROOT),
      local_migration_head: localHead,
      database_migration_head: databaseHead,
      local_migration_versions_sha256: sha256Text(canonicalStringify(localMigrationVersions)),
      database_migration_versions_sha256: sha256Text(canonicalStringify(databaseMigrationVersions)),
      collection_command: 'npx --yes supabase db query --linked --file <temporary-read-only-sql> -o json',
      collector: 'scripts/qa/logistics-db-cleanup-preflight.cjs',
      collector_version: 2,
    },
    snapshot: {
      captured_at: snapshot.captured_at,
      database_name: snapshot.database_name,
      database_user: snapshot.database_user,
      server_version: snapshot.server_version,
      transaction_isolation: snapshot.transaction_isolation,
      transaction_read_only: snapshot.transaction_read_only,
      transaction_end: snapshot.transaction_end,
      database_stats_reset: snapshot.database_stats_reset,
    },
    objects,
    storage: buildStorageInventory(snapshot),
    catalog: {
      database_migrations: asArray(snapshot.database_migrations),
      publications: asArray(snapshot.publications),
    },
    diagnostics,
    safety_gate: {
      decision: 'hold',
      explicit_approved_manifest_required: true,
      explicit_approved_manifest: Boolean(options.explicitApprovedManifest),
      automatic_drop_allowed: false,
      protected_hold_objects: protectedHoldObjects,
      blockers: [
        'Preflight is catalog-only and never authorizes DROP by itself.',
        'DROP remains forbidden unless a separate explicit approved manifest is supplied.',
        'Archive-review protected objects remain hold: public.ll_source_rows, public.ll_source_review_logs.',
      ],
    },
  });
}

function collectPreflight(options = {}) {
  const { assertReadOnlySql, buildPreflightSql } = require('./logistics-db-cleanup-sql.cjs');
  const linkedProjectRef = readLinkedProjectRef(options.root || ROOT);
  if (options.projectRef && linkedProjectRef && options.projectRef !== linkedProjectRef) {
    throw new Error(`Linked project ref ${linkedProjectRef} does not match requested project ref ${options.projectRef}.`);
  }
  const sql = buildPreflightSql();
  assertReadOnlySql(sql);
  const rows = runSupabaseDbQuery(sql, {
    root: options.root || ROOT,
    prefix: 'gate6-db-cleanup-preflight',
    timeoutMs: options.timeoutMs,
    retries: 1,
    retryDelayMs: 5000,
  });
  const row = rows.find((candidate) => candidate && Object.prototype.hasOwnProperty.call(candidate, 'snapshot'));
  if (!row) throw new Error('Preflight query did not return a snapshot row.');
  const snapshot = typeof row.snapshot === 'string' ? JSON.parse(row.snapshot) : row.snapshot;
  return buildPreflightManifest(snapshot, {
    ...options,
    projectRef: options.projectRef || linkedProjectRef,
  });
}

function objectMap(manifest) {
  return new Map((manifest.objects || []).map((object) => [object.qualified_name, object]));
}

function viewRollbackMetadata(object) {
  return {
    security_invoker: Boolean(object?.security_invoker),
    owner: object?.object_owner || null,
    grants: object?.grants || [],
    dependencies: object?.dependencies || [],
  };
}

function validatePreflightDiagnostics(manifest) {
  const blockers = [];
  const diagnostics = manifest?.diagnostics;
  if (!diagnostics || typeof diagnostics !== 'object' || Array.isArray(diagnostics)) {
    return { ok: false, blockers: ['preflight diagnostics are missing or invalid'] };
  }
  if (manifest?.safety_gate?.decision !== 'hold') blockers.push('preflight safety gate must remain hold');
  if (manifest?.safety_gate?.explicit_approved_manifest_required !== true) blockers.push('preflight must require an explicit approved manifest for DROP');
  if (!isExplicitApprovedManifest(manifest)) blockers.push('explicit approved manifest is required before any DROP can run');
  for (const key of ['migration_mismatch', 'migration_head_mismatch', 'migration_catalog_mismatch']) {
    if (typeof diagnostics[key] !== 'boolean') blockers.push(`preflight diagnostic ${key} is missing or invalid`);
    else if (diagnostics[key]) blockers.push(`preflight diagnostic ${key} blocks apply`);
  }
  const arrayDiagnostics = [
    ['missing_expected_objects', 'expected relation is missing'],
    ['type_mismatches', 'relation type mismatch'],
    ['relkind_mismatches', 'relation relkind mismatch'],
    ['expected_dropped_present', 'migration-dropped relation is still present'],
    ['missing_primary_keys', 'primary key is missing'],
    ['missing_pk_indexes', 'primary key index is missing or invalid'],
    ['missing_fk_indexes', 'foreign key index is missing or invalid'],
  ];
  for (const [key, label] of arrayDiagnostics) {
    if (!Array.isArray(diagnostics[key])) blockers.push(`preflight diagnostic ${key} is missing or invalid`);
    else if (diagnostics[key].length > 0) blockers.push(`preflight diagnostic ${label} blocks apply (${diagnostics[key].length})`);
  }
  return { ok: blockers.length === 0, blockers };
}

function assertPreflightApplyGate(manifest) {
  const result = validatePreflightDiagnostics(manifest);
  if (!result.ok) throw new Error(`Preflight diagnostics gate failed: ${result.blockers.join('; ')}`);
  return result;
}

function validateApprovedDelta(delta, preManifest) {
  const errors = [];
  const manifestValidation = verifyManifest(preManifest);
  if (!manifestValidation.ok) errors.push(...manifestValidation.errors.map((error) => `pre-manifest: ${error}`));
  if (!isExplicitApprovedManifest(preManifest)) errors.push('pre-manifest must be an explicit approved manifest before DROP is allowed');
  if (!delta || typeof delta !== 'object') return { ok: false, errors: ['approved delta must be an object'] };
  if (delta.schema_version !== DELTA_SCHEMA_VERSION) errors.push(`unsupported approved delta schema: ${delta.schema_version}`);
  if (delta.project_ref !== preManifest?.provenance?.project_ref) errors.push('approved delta project_ref does not match pre-manifest');
  if (delta.pre_manifest_sha256 !== preManifest?.manifest_sha256) errors.push('approved delta pre_manifest_sha256 does not match pre-manifest');
  const operations = Array.isArray(delta.operations) ? delta.operations : [];
  if (!Array.isArray(delta.operations)) errors.push('approved delta operations must be an array');
  const seen = new Set();
  const objects = objectMap(preManifest || {});
  for (const operation of operations) {
    if (operation.operation !== 'drop_relation') errors.push(`unsupported approved operation: ${operation.operation}`);
    if (!/^public\.ll_[a-z0-9_]+$/u.test(String(operation.qualified_name || ''))) errors.push(`unsafe qualified_name: ${operation.qualified_name}`);
    if (seen.has(operation.qualified_name)) errors.push(`duplicate approved operation: ${operation.qualified_name}`);
    seen.add(operation.qualified_name);
    const current = objects.get(operation.qualified_name);
    if (!current) {
      errors.push(`approved object is missing from pre-manifest: ${operation.qualified_name}`);
      continue;
    }
    if (operation.object_kind !== current.object_kind) errors.push(`object kind mismatch for ${operation.qualified_name}`);
    if (current.decision !== 'hold') errors.push(`pre-manifest object decision must remain hold for ${operation.qualified_name}`);
    if (current.explicit_approved_manifest_required !== true) errors.push(`pre-manifest object must require explicit approved manifest for ${operation.qualified_name}`);
    if (current.hold_reason === 'archive_review_hold') errors.push(`archive-review protected object cannot be dropped: ${operation.qualified_name}`);
    if (current.exact_count === null || current.canonical_json_sha256 === null) errors.push(`explicit approved manifest must include exact count and canonical checksum for ${operation.qualified_name}`);
    if (String(operation.expected_exact_count) !== String(current.exact_count)) errors.push(`exact count mismatch for ${operation.qualified_name}`);
    if (operation.expected_canonical_json_sha256 !== current.canonical_json_sha256) errors.push(`canonical checksum mismatch for ${operation.qualified_name}`);
    if (operation.expected_structure_sha256 !== current.structure_sha256) errors.push(`structure checksum mismatch for ${operation.qualified_name}`);
    if (!operation.rollback || typeof operation.rollback !== 'object') errors.push(`rollback contract is required for ${operation.qualified_name}`);
    if (['migration_name', 'migration_path', 'migration_sql', 'legacy_migration', 'replay_migration'].some((key) => Object.hasOwn(operation, key))) {
      errors.push(`manual migration replay is forbidden for ${operation.qualified_name}`);
    }
    if (current.object_kind === 'view') {
      const rollback = operation.rollback || {};
      if (rollback.strategy !== 'recreate_view') errors.push(`recreate_view rollback strategy is required for ${operation.qualified_name}`);
      if (!rollback.definition_sql || rollback.definition_sql !== current.definition_sql) errors.push(`view definition rollback does not match manifest for ${operation.qualified_name}`);
      if (canonicalStringify(rollback.view_metadata) !== canonicalStringify(viewRollbackMetadata(current))) {
        errors.push(`view metadata rollback does not match manifest for ${operation.qualified_name}`);
      }
    }
  }
  return { ok: errors.length === 0, errors, operation_count: operations.length };
}

function compareManifests(preManifest, postManifest, approvedDelta) {
  const violations = [];
  const preValidation = verifyManifest(preManifest);
  const postValidation = verifyManifest(postManifest);
  if (!preValidation.ok) violations.push(...preValidation.errors.map((error) => `pre-manifest: ${error}`));
  if (!postValidation.ok) violations.push(...postValidation.errors.map((error) => `post-manifest: ${error}`));
  const deltaValidation = validateApprovedDelta(approvedDelta, preManifest);
  if (!deltaValidation.ok) violations.push(...deltaValidation.errors.map((error) => `approved-delta: ${error}`));
  if (preManifest?.provenance?.project_ref !== postManifest?.provenance?.project_ref) violations.push('project ref changed between manifests');
  if (preManifest?.provenance?.database_migration_head !== postManifest?.provenance?.database_migration_head) violations.push('database migration head changed between manifests');

  const approvedDrops = new Set((approvedDelta?.operations || []).map((operation) => operation.qualified_name));
  const preObjects = objectMap(preManifest || {});
  const postObjects = objectMap(postManifest || {});
  for (const [qualifiedName, preObject] of preObjects) {
    const postObject = postObjects.get(qualifiedName);
    if (approvedDrops.has(qualifiedName)) {
      if (postObject) violations.push(`approved drop is still present: ${qualifiedName}`);
      continue;
    }
    if (!postObject) {
      violations.push(`protected object is missing: ${qualifiedName}`);
      continue;
    }
    if (postObject.object_kind !== preObject.object_kind) violations.push(`protected object kind changed: ${qualifiedName}`);
    if (String(postObject.exact_count) !== String(preObject.exact_count)) violations.push(`protected exact count changed: ${qualifiedName}`);
    if (postObject.canonical_json_sha256 !== preObject.canonical_json_sha256) violations.push(`protected checksum changed: ${qualifiedName}`);
    if (postObject.structure_sha256 !== preObject.structure_sha256) violations.push(`protected structure changed: ${qualifiedName}`);
  }
  for (const qualifiedName of postObjects.keys()) {
    if (!preObjects.has(qualifiedName)) violations.push(`unapproved new object appeared: ${qualifiedName}`);
  }
  if (canonicalStringify(preManifest?.storage || {}) !== canonicalStringify(postManifest?.storage || {})) {
    violations.push('storage buckets, objects, or policies changed');
  }
  return {
    schema_version: 'gate6-db-cleanup-postcheck/v1',
    ok: violations.length === 0,
    generated_at: new Date().toISOString(),
    project_ref: preManifest?.provenance?.project_ref || null,
    pre_manifest_sha256: preManifest?.manifest_sha256 || null,
    post_manifest_sha256: postManifest?.manifest_sha256 || null,
    approved_drops: [...approvedDrops].sort(),
    protected_object_count: [...preObjects.keys()].filter((name) => !approvedDrops.has(name)).length,
    violations,
  };
}

function assertStagingTarget(projectRef, productionProjectRef = PRODUCTION_PROJECT_REF) {
  if (!projectRef) throw new Error('Staging project ref is required.');
  if (projectRef === productionProjectRef) throw new Error(`Staging rehearsal cannot target production project ${productionProjectRef}.`);
  return true;
}

function validTimestamp(value) {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}

function validateRehearsalEvidence(evidence, preManifest, approvedDelta, options = {}) {
  const blockers = [];
  if (!evidence || typeof evidence !== 'object' || Array.isArray(evidence)) {
    return { ok: false, blockers: ['backup and restore evidence is required'] };
  }
  const projectRef = options.projectRef || approvedDelta?.project_ref;
  if (evidence.schema_version !== REHEARSAL_EVIDENCE_SCHEMA_VERSION) blockers.push('rehearsal evidence schema version is missing or unsupported');
  if (evidence.environment !== 'staging') blockers.push('rehearsal evidence must be captured in staging');
  if (evidence.project_ref !== projectRef) blockers.push('rehearsal evidence project_ref does not match staging target');
  if (evidence.pre_manifest_sha256 !== preManifest?.manifest_sha256) blockers.push('rehearsal evidence pre-manifest SHA does not match');
  if (evidence.approved_delta_sha256 !== sha256Text(canonicalStringify(approvedDelta))) blockers.push('rehearsal evidence approved delta SHA does not match');
  if (!validTimestamp(evidence.backup?.captured_at)) blockers.push('backup evidence captured_at is required');
  if (!validTimestamp(evidence.restore?.completed_at)) blockers.push('restore evidence completed_at is required');
  if (validTimestamp(evidence.backup?.captured_at) && validTimestamp(evidence.restore?.completed_at)
    && Date.parse(evidence.backup.captured_at) > Date.parse(evidence.restore.completed_at)) {
    blockers.push('backup evidence must precede restore evidence');
  }

  const artifacts = Array.isArray(evidence.backup?.artifacts) ? evidence.backup.artifacts : [];
  if (!artifacts.length) blockers.push('backup evidence must include at least one artifact');
  let verifiedBackupArtifactCount = 0;
  for (const artifact of artifacts) {
    if (!['schema', 'data'].includes(artifact?.kind)) {
      blockers.push('backup artifact kind must be schema or data');
      continue;
    }
    if (typeof artifact?.qualified_name !== 'string' || !/^public\.ll_[a-z0-9_]+$/u.test(artifact.qualified_name)) {
      blockers.push('backup artifact qualified_name is invalid');
      continue;
    }
    if (typeof artifact?.path !== 'string' || !artifact.path) {
      blockers.push(`backup artifact path is required for ${artifact.qualified_name}`);
      continue;
    }
    const artifactPath = path.resolve(options.evidenceBaseDir || ROOT, artifact.path);
    if (!fs.existsSync(artifactPath) || !fs.statSync(artifactPath).isFile()) {
      blockers.push(`backup artifact is missing: ${artifact.qualified_name}`);
      continue;
    }
    const actualBytes = fs.statSync(artifactPath).size;
    if (!Number.isInteger(artifact.byte_count) || artifact.byte_count <= 0 || artifact.byte_count !== actualBytes) {
      blockers.push(`backup artifact byte count does not match: ${artifact.qualified_name}`);
      continue;
    }
    if (!/^[a-f0-9]{64}$/u.test(String(artifact.sha256 || '')) || artifact.sha256 !== sha256File(artifactPath)) {
      blockers.push(`backup artifact SHA-256 does not match: ${artifact.qualified_name}`);
      continue;
    }
    verifiedBackupArtifactCount += 1;
  }

  const expectedObjects = objectMap(preManifest || {});
  for (const operation of approvedDelta?.operations || []) {
    const requiredKinds = operation.object_kind === 'view' ? ['schema'] : ['schema', 'data'];
    for (const kind of requiredKinds) {
      if (!artifacts.some((artifact) => artifact?.qualified_name === operation.qualified_name && artifact?.kind === kind)) {
        blockers.push(`${kind} backup evidence is required for ${operation.qualified_name}`);
      }
    }
  }

  const restore = evidence.restore || {};
  if (typeof restore.post_restore_manifest_path !== 'string' || !restore.post_restore_manifest_path) {
    blockers.push('post-restore manifest path is required');
  }
  let postRestoreManifest = null;
  if (restore.post_restore_manifest_path) {
    const manifestPath = path.resolve(options.evidenceBaseDir || ROOT, restore.post_restore_manifest_path);
    if (!fs.existsSync(manifestPath)) blockers.push('post-restore manifest file is missing');
    else {
      try {
        postRestoreManifest = readJson(manifestPath);
      } catch {
        blockers.push('post-restore manifest cannot be parsed');
      }
    }
  }
  if (postRestoreManifest) {
    const validation = verifyManifest(postRestoreManifest);
    if (!validation.ok) blockers.push(`post-restore manifest validation failed: ${validation.errors.join('; ')}`);
    if (postRestoreManifest.manifest_sha256 !== restore.post_restore_manifest_sha256) blockers.push('post-restore manifest SHA does not match evidence');
    if (postRestoreManifest.provenance?.project_ref !== projectRef) blockers.push('post-restore manifest project_ref does not match staging target');
    const restoredObjects = objectMap(postRestoreManifest);
    const restoredNames = Array.isArray(restore.restored_object_names) ? restore.restored_object_names : [];
    for (const operation of approvedDelta?.operations || []) {
      const before = expectedObjects.get(operation.qualified_name);
      const after = restoredObjects.get(operation.qualified_name);
      if (!restoredNames.includes(operation.qualified_name)) blockers.push(`restore evidence omits ${operation.qualified_name}`);
      if (!after) {
        blockers.push(`post-restore manifest is missing ${operation.qualified_name}`);
        continue;
      }
      if (!before || after.object_kind !== before.object_kind || String(after.exact_count) !== String(before.exact_count)
        || after.canonical_json_sha256 !== before.canonical_json_sha256 || after.structure_sha256 !== before.structure_sha256) {
        blockers.push(`post-restore manifest does not match preflight object ${operation.qualified_name}`);
      }
      if (before?.object_kind === 'view' && canonicalStringify(viewRollbackMetadata(after)) !== canonicalStringify(viewRollbackMetadata(before))) {
        blockers.push(`post-restore view metadata does not match preflight object ${operation.qualified_name}`);
      }
    }
  }
  return {
    ok: blockers.length === 0,
    blockers,
    verified_backup_artifact_count: verifiedBackupArtifactCount,
    post_restore_manifest_sha256: postRestoreManifest?.manifest_sha256 || null,
  };
}

function buildRollbackDrillContract(preManifest, approvedDelta, options = {}) {
  const projectRef = options.projectRef || approvedDelta?.project_ref;
  const productionProjectRef = options.productionProjectRef || PRODUCTION_PROJECT_REF;
  if (options.environment !== 'staging') throw new Error('Rollback rehearsal environment must be staging.');
  assertStagingTarget(projectRef, productionProjectRef);
  const validation = validateApprovedDelta(approvedDelta, preManifest);
  const blockers = [...validation.errors];
  const evidenceValidation = validateRehearsalEvidence(options.evidence, preManifest, approvedDelta, {
    projectRef,
    evidenceBaseDir: options.evidenceBaseDir,
  });
  blockers.push(...evidenceValidation.blockers);
  const objects = objectMap(preManifest || {});
  const rollbackSteps = [];
  for (const operation of approvedDelta?.operations || []) {
    const object = objects.get(operation.qualified_name);
    const rollback = operation.rollback || {};
    if (operation.object_kind === 'view') {
      if (rollback.strategy !== 'recreate_view') blockers.push(`recreate_view rollback strategy is required for ${operation.qualified_name}`);
      if (!rollback.definition_sql || rollback.definition_sql !== object?.definition_sql) blockers.push(`view definition rollback does not match manifest for ${operation.qualified_name}`);
      rollbackSteps.push({
        qualified_name: operation.qualified_name,
        strategy: 'recreate_view',
        definition_sql: rollback.definition_sql || null,
        view_metadata: viewRollbackMetadata(object),
        verify_exact_count: object?.exact_count ?? null,
        verify_canonical_json_sha256: object?.canonical_json_sha256 || null,
      });
      continue;
    }
    const required = ['schema_backup_path', 'schema_backup_sha256', 'data_backup_path', 'data_backup_sha256'];
    if (rollback.strategy !== 'pg_restore') blockers.push(`pg_restore rollback strategy is required for ${operation.qualified_name}`);
    for (const field of required) if (!rollback[field]) blockers.push(`${field} is required for ${operation.qualified_name}`);
    rollbackSteps.push({
      qualified_name: operation.qualified_name,
      strategy: 'pg_restore',
      schema_backup_path: rollback.schema_backup_path || null,
      schema_backup_sha256: rollback.schema_backup_sha256 || null,
      data_backup_path: rollback.data_backup_path || null,
      data_backup_sha256: rollback.data_backup_sha256 || null,
      verify_exact_count: object?.exact_count ?? null,
      verify_canonical_json_sha256: object?.canonical_json_sha256 || null,
    });
  }
  return {
    schema_version: 'gate6-db-cleanup-rollback-drill/v1',
    ok: blockers.length === 0,
    generated_at: new Date().toISOString(),
    environment: 'staging',
    project_ref: projectRef,
    production_project_ref: productionProjectRef,
    production_forbidden: true,
    mode: 'staging_backup_restore_evidence',
    dry_run_only: false,
    evidence_validated: evidenceValidation.ok,
    actual_backup_restore_verified: evidenceValidation.ok,
    rehearsal_evidence_sha256: options.evidence ? sha256Text(canonicalStringify(options.evidence)) : null,
    verified_backup_artifact_count: evidenceValidation.verified_backup_artifact_count,
    pre_manifest_sha256: preManifest?.manifest_sha256 || null,
    approved_operation_count: approvedDelta?.operations?.length || 0,
    rollback_steps: rollbackSteps,
    blockers,
  };
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(path.resolve(filePath), 'utf8'));
}

function writeJson(filePath, value) {
  const resolved = path.resolve(filePath);
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  fs.writeFileSync(resolved, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  return resolved;
}

function timestampSlug(date = new Date()) {
  return date.toISOString().replace(/[-:]/gu, '').replace(/\.\d{3}Z$/u, 'Z');
}

function defaultArtifactPath(kind, date = new Date()) {
  return path.join(ARTIFACT_DIR, `${kind}-${timestampSlug(date)}.json`);
}

function parseArgs(argv = process.argv.slice(2)) {
  const args = { _: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) {
      args._.push(token);
      continue;
    }
    const key = token.slice(2).replace(/-([a-z])/gu, (_, letter) => letter.toUpperCase());
    const next = argv[index + 1];
    if (next !== undefined && !next.startsWith('--')) {
      args[key] = next;
      index += 1;
    } else {
      args[key] = true;
    }
  }
  return args;
}

module.exports = {
  ARTIFACT_DIR,
  DELTA_SCHEMA_VERSION,
  MANIFEST_SCHEMA_VERSION,
  PRODUCTION_PROJECT_REF,
  REHEARSAL_EVIDENCE_SCHEMA_VERSION,
  ROOT,
  attachManifestSha,
  assertPreflightApplyGate,
  assertStagingTarget,
  buildPreflightManifest,
  buildRollbackDrillContract,
  canonicalStringify,
  collectPreflight,
  compareManifests,
  defaultArtifactPath,
  deriveExpectedRelationsFromSqlFiles,
  extractRows,
  localGitSha,
  localMigrationHead,
  parseArgs,
  parseJsonFromOutput,
  readJson,
  readLinkedProjectRef,
  readMigrationFiles,
  runSupabaseDbQuery,
  sha256File,
  sha256Text,
  protectedHoldReason,
  validateApprovedDelta,
  validatePreflightDiagnostics,
  validateRehearsalEvidence,
  verifyManifest,
  writeJson,
};
