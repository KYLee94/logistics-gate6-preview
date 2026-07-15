const fs = require('node:fs');
const path = require('node:path');

const {
  CRUD_ACTIONS,
  buildPermissionManifest,
  extractDirectActions,
} = require('./logistics-permission-manifest-core.cjs');

const ROOT = path.resolve(__dirname, '..', '..');
const SOURCE_JSON = path.join(ROOT, 'src', 'components', 'system', 'workspace', 'logisticsPermissionData.json');
const EDGE_SOURCE = path.join(ROOT, 'supabase', 'functions', 'll-dashboard-api', 'index.ts');
const ARTIFACT_DIR = path.join(ROOT, 'qa-artifacts', 'logistics-gate6');
const EDGE_FUNCTION = 'll-dashboard-api';
const DEFAULT_ORIGIN = 'https://kylee94.github.io';
const REQUIRED_ADMIN_FEATURES = [
  'ai_chat',
  'data_quality',
  'analysis_tools',
  'data_playground',
  'login_history',
  'market_research',
  'opendart_refresh',
  'building_register_refresh',
  'permission_admin',
  'approval_management',
];
const REQUIRED_ADMIN_LABELS = [
  { email: 'kylee@igisam.com', label: '\uC774\uAD00\uC6A9' },
  { email: 'sjlee@igisam.com', label: '\uC774\uC2DC\uC815' },
  { email: 'jk.jeon@igisam.com', label: '\uC804\uAE30\uC601' },
];
const ETHAN_EMAIL = 'ethan.lee@igisam.com';
const HAYUN_EMAIL = 'hayun.jeong@igisam.com';
const SENSITIVE_KEY = /(authorization|password|secret|service[_-]?role|token|api[_-]?key|apikey|client[_-]?secret)/iu;

class QaFailure extends Error {
  constructor(code, details = {}) {
    super(code);
    this.code = code;
    this.details = details;
  }
}

function readEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  return Object.fromEntries(fs.readFileSync(filePath, 'utf8')
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#') && line.includes('='))
    .map((line) => {
      const index = line.indexOf('=');
      return [line.slice(0, index).trim(), line.slice(index + 1).trim().replace(/^['"]|['"]$/gu, '')];
    }));
}

const fileEnv = {
  ...readEnvFile(path.join(ROOT, '.env')),
  ...readEnvFile(path.join(ROOT, '.env.local')),
};

function envValue(...keys) {
  return keys.map((key) => process.env[key] || fileEnv[key]).find(Boolean) || '';
}

function text(value) {
  return String(value || '').trim();
}

function stamp() {
  return new Date().toISOString().replace(/[-:]/gu, '').replace(/\..+$/u, 'Z');
}

function help() {
  return [
    'Usage: node scripts/qa/logistics-permission-live-readback.cjs [--source] [--concurrency N]',
    '',
    'Default mode signs in with LOGISTICS_SUPABASE_EMAIL/LOGISTICS_SUPABASE_PASSWORD',
    '(or LOGISTICS_SUPABASE_AUTH_EMAIL/LOGISTICS_SUPABASE_AUTH_PASSWORD), calls the live',
    'll-dashboard-api auth/me and permissions/evaluate endpoints, and writes a redacted artifact.',
    '--source validates the 38 x 19 x CRUD source manifest only. It makes no network calls and writes no artifact.',
  ].join('\n');
}

function argumentValue(name, fallback = '') {
  const index = process.argv.indexOf(name);
  return index === -1 ? fallback : text(process.argv[index + 1] || fallback);
}

function requireLiveSupabaseUrl(value) {
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new QaFailure('invalid_live_supabase_url');
  }
  if (parsed.protocol !== 'https:' || !/^[a-z0-9-]+\.supabase\.co$/iu.test(parsed.hostname)) {
    throw new QaFailure('non_live_or_local_supabase_url_rejected');
  }
  return parsed.toString().replace(/\/$/u, '');
}

function requireLiveOrigin(value) {
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new QaFailure('invalid_live_origin');
  }
  if (parsed.protocol !== 'https:' || parsed.hostname === 'localhost' || parsed.hostname.endsWith('.local')) {
    throw new QaFailure('non_live_or_local_origin_rejected');
  }
  return parsed.origin;
}

function hasRevision(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function readSourceManifest() {
  const source = JSON.parse(fs.readFileSync(SOURCE_JSON, 'utf8'));
  const edgeSource = fs.readFileSync(EDGE_SOURCE, 'utf8');
  const manifest = buildPermissionManifest(source, extractDirectActions(edgeSource));
  const failures = [...manifest.failures];
  if (manifest.counts.source_users !== 38) failures.push('source_user_count_mismatch');
  if (manifest.counts.source_assets !== 19) failures.push('source_asset_count_mismatch');
  if (manifest.counts.effective_decisions !== 2888) failures.push('source_decision_count_mismatch');
  if (failures.length) throw new QaFailure('source_manifest_invalid', { failures });
  return { source, manifest };
}

function sourceSpecialChecks(source, manifest) {
  const failures = [];
  const byEmail = new Map(source.users.map((user) => [text(user.email).toLowerCase(), user]));
  const decisions = manifest.effective_decisions;
  for (const admin of REQUIRED_ADMIN_LABELS) {
    const rows = decisions.filter((row) => row.email === admin.email);
    if (rows.length !== 76 || rows.some((row) => row.allowed !== true)) failures.push(`source_admin_crud_mismatch:${admin.label}`);
  }
  const ethanDelete = decisions.filter((row) => row.email === ETHAN_EMAIL && row.action === 'delete');
  if (ethanDelete.length !== 19 || ethanDelete.some((row) => row.allowed !== false)) failures.push('source_ethan_delete_mismatch');
  if (!byEmail.has(ETHAN_EMAIL) || REQUIRED_ADMIN_LABELS.some((admin) => !byEmail.has(admin.email))) failures.push('source_required_profile_missing');
  return {
    ok: failures.length === 0,
    failures,
    expected_decisions: decisions.length,
    source_users: manifest.counts.source_users,
    source_assets: manifest.counts.source_assets,
  };
}

async function signInWithPassword(supabaseUrl, anonKey, email, password) {
  const response = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: anonKey, 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const body = await response.json().catch(() => null);
  if (!response.ok || !isRecord(body) || !text(body.access_token)) {
    throw new QaFailure('administrator_password_login_failed', { http_status: response.status });
  }
  return text(body.access_token);
}

async function callEdge(endpoint, anonKey, origin, token, action, payload) {
  let response;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        apikey: anonKey,
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
        origin,
      },
      body: JSON.stringify({ action, payload }),
    });
  } catch {
    throw new QaFailure('live_edge_network_failure', { action });
  }
  const raw = await response.text();
  let body = null;
  try {
    body = raw ? JSON.parse(raw) : null;
  } catch {
    throw new QaFailure('live_edge_contract_non_json', { action, http_status: response.status });
  }
  return { http_status: response.status, body };
}

function requireSuccessfulContract(response, action) {
  if (response.http_status === 404) throw new QaFailure('live_edge_404_or_undeployed_contract', { action, http_status: 404 });
  if (response.http_status !== 200 || !isRecord(response.body) || response.body.ok !== true || !isRecord(response.body.data)) {
    throw new QaFailure('live_edge_contract_mismatch', { action, http_status: response.http_status });
  }
  return response.body.data;
}

function validateAuthMe(data) {
  const features = data.feature_permissions;
  if (!hasRevision(data.permission_revision) || !Object.prototype.hasOwnProperty.call(data, 'asset_capabilities') || !isRecord(features)) {
    throw new QaFailure('auth_me_contract_mismatch');
  }
  if (features.permission_admin !== true) throw new QaFailure('authenticated_user_is_not_permission_admin');
}

function evaluationResult(data, expected, userIndex, assetIndex) {
  const profileEmailMatches = text(data.profile?.email).toLowerCase() === expected.email;
  if (!hasRevision(data.permission_revision) || !Object.prototype.hasOwnProperty.call(data, 'asset_capabilities') || !isRecord(data.profile) || !isRecord(data.evaluations) || !profileEmailMatches) {
    return CRUD_ACTIONS.map((action) => ({ user_index: userIndex, asset_index: assetIndex, action, expected: expected[action], actual: null, code: 'evaluate_contract_mismatch' }));
  }
  return CRUD_ACTIONS.map((action) => {
    const evaluation = data.evaluations[action];
    const assetIds = Array.isArray(evaluation?.asset_ids) ? evaluation.asset_ids.map(text) : [];
    const allowed = evaluation?.allowed === true;
    const expectedAllowed = expected[action] === true;
    const canonicalAssetReturned = assetIds.includes(expected.asset_id);
    return {
      user_index: userIndex,
      asset_index: assetIndex,
      action,
      expected: expectedAllowed,
      actual: allowed,
      code: canonicalAssetReturned && allowed === expectedAllowed ? null : (canonicalAssetReturned ? 'decision_mismatch' : 'canonical_asset_contract_mismatch'),
    };
  });
}

async function mapWithConcurrency(values, concurrency, callback) {
  const results = new Array(values.length);
  let next = 0;
  const worker = async () => {
    while (true) {
      const index = next;
      next += 1;
      if (index >= values.length) return;
      results[index] = await callback(values[index], index);
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, values.length) }, worker));
  return results;
}

function summarizeMismatches(rows) {
  return rows.filter((row) => row.code).slice(0, 50);
}

function redacted(value) {
  if (Array.isArray(value)) return value.map(redacted);
  if (!isRecord(value)) return value;
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, SENSITIVE_KEY.test(key) ? '[redacted]' : redacted(item)]));
}

function writeArtifact(report) {
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
  const artifactPath = path.join(ARTIFACT_DIR, `logistics-permission-live-readback-${stamp()}.json`);
  fs.writeFileSync(artifactPath, `${JSON.stringify(redacted(report), null, 2)}\n`, 'utf8');
  return path.relative(ROOT, artifactPath);
}

async function runLive(source, manifest, sourceChecks, concurrency) {
  const report = {
    schema_version: 'logistics_permission_live_readback.v1',
    mode: 'live_read_only',
    status: 'fail',
    started_at: new Date().toISOString(),
    source_manifest: sourceChecks,
    live_evidence: {
      qualifies_as_live: false,
      mock_or_fake_session: false,
      local_only: false,
      credential_flow: 'password_grant',
      operations: ['auth/me', 'permissions/evaluate'],
    },
    write_safety: {
      application_data_mutation_requested: false,
      application_data_mutation_used: false,
      note: 'permissions/evaluate is read-only for application data; the deployed API may record server-side audit events.',
    },
    checks: {},
    failures: [],
  };

  try {
    const supabaseUrl = requireLiveSupabaseUrl(envValue('LOGISTICS_SUPABASE_URL', 'VITE_SUPABASE_URL'));
    const anonKey = envValue('LOGISTICS_SUPABASE_ANON_KEY', 'VITE_SUPABASE_ANON_KEY');
    const adminEmail = envValue('LOGISTICS_SUPABASE_EMAIL', 'LOGISTICS_SUPABASE_AUTH_EMAIL');
    const adminPassword = envValue('LOGISTICS_SUPABASE_PASSWORD', 'LOGISTICS_SUPABASE_AUTH_PASSWORD');
    const origin = requireLiveOrigin(envValue('LOGISTICS_DASHBOARD_ORIGIN') || DEFAULT_ORIGIN);
    if (!anonKey || !adminEmail || !adminPassword) throw new QaFailure('missing_live_administrator_login_environment');
    const endpoint = `${supabaseUrl}/functions/v1/${EDGE_FUNCTION}`;
    const token = await signInWithPassword(supabaseUrl, anonKey, adminEmail, adminPassword);
    const authMe = requireSuccessfulContract(await callEdge(endpoint, anonKey, origin, token, 'auth/me', {}), 'auth/me');
    validateAuthMe(authMe);
    report.live_evidence.qualifies_as_live = true;
    report.checks.auth_me = {
      ok: true,
      permission_revision_present: true,
      asset_capabilities_present: true,
      authenticated_permission_admin: true,
    };

    const expectedByKey = new Map();
    for (const row of manifest.effective_decisions) {
      const key = `${row.email}|${row.asset_id}`;
      const expected = expectedByKey.get(key) || { email: row.email, asset_id: row.asset_id };
      expected[row.action] = row.allowed;
      expectedByKey.set(key, expected);
    }
    const requests = source.users.flatMap((user, userIndex) => source.assetMaster.map((asset, assetIndex) => ({
      user,
      asset,
      userIndex,
      assetIndex,
      expected: expectedByKey.get(`${text(user.email).toLowerCase()}|${text(asset.assetId)}`),
    })));
    if (requests.length !== 722 || requests.some((request) => !request.expected)) throw new QaFailure('source_request_matrix_incomplete');

    const requestResults = await mapWithConcurrency(requests, concurrency, async (request) => {
      try {
        const data = requireSuccessfulContract(
          await callEdge(endpoint, anonKey, origin, token, 'permissions/evaluate', { email: request.user.email, asset_id: request.asset.assetId }),
          'permissions/evaluate',
        );
        return {
          rows: evaluationResult(data, request.expected, request.userIndex, request.assetIndex),
          profile_features: request.assetIndex === 0 ? data.profile.feature_permissions : null,
        };
      } catch (error) {
        const code = error instanceof QaFailure ? error.code : 'permissions_evaluate_unexpected_failure';
        return {
          rows: CRUD_ACTIONS.map((action) => ({
            user_index: request.userIndex,
            asset_index: request.assetIndex,
            action,
            expected: request.expected[action] === true,
            actual: null,
            code,
          })),
          profile_features: null,
        };
      }
    });
    const decisions = requestResults.flatMap((result) => result.rows);
    const mismatches = decisions.filter((row) => row.code);
    report.checks.permission_matrix = {
      expected_decisions: 2888,
      compared_decisions: decisions.length,
      matched_decisions: decisions.length - mismatches.length,
      mismatched_decisions: mismatches.length,
      mismatch_samples: summarizeMismatches(decisions),
    };

    const profileFeaturesByEmail = new Map();
    for (let index = 0; index < requests.length; index += 1) {
      if (requests[index].assetIndex === 0) profileFeaturesByEmail.set(requests[index].user.email, requestResults[index].profile_features);
    }
    const featureChecks = [];
    for (const admin of REQUIRED_ADMIN_LABELS) {
      const featurePermissions = profileFeaturesByEmail.get(admin.email);
      const missing = REQUIRED_ADMIN_FEATURES.filter((feature) => featurePermissions?.[feature] !== true);
      featureChecks.push({ label: admin.label, required_features: REQUIRED_ADMIN_FEATURES.length, all_true: missing.length === 0, missing_features: missing });
    }
    report.checks.required_admin_features = featureChecks;

    const adminCrudChecks = REQUIRED_ADMIN_LABELS.map((admin) => {
      const userIndex = source.users.findIndex((user) => text(user.email).toLowerCase() === admin.email);
      const rows = decisions.filter((row) => row.user_index === userIndex);
      return { label: admin.label, expected_decisions: 76, all_crud_allowed: rows.length === 76 && rows.every((row) => row.expected === true && row.actual === true && !row.code) };
    });
    report.checks.required_admin_crud = adminCrudChecks;

    const ethanIndex = source.users.findIndex((user) => text(user.email).toLowerCase() === ETHAN_EMAIL);
    const ethanDeleteRows = decisions.filter((row) => row.user_index === ethanIndex && row.action === 'delete');
    report.checks.ethan_delete_denied = {
      expected_decisions: 19,
      all_delete_denied: ethanDeleteRows.length === 19 && ethanDeleteRows.every((row) => row.expected === false && row.actual === false && !row.code),
    };

    const hayun = await callEdge(endpoint, anonKey, origin, token, 'permissions/evaluate', { email: HAYUN_EMAIL, asset_id: source.assetMaster[0].assetId });
    report.checks.inactive_hayun = { expected_http_status: 404, actual_http_status: hayun.http_status, no_permission: hayun.http_status === 404 };

    const failures = [
      ...sourceChecks.failures,
      ...(mismatches.length ? ['permission_matrix_mismatch'] : []),
      ...adminCrudChecks.filter((check) => !check.all_crud_allowed).map((check) => `required_admin_crud_mismatch:${check.label}`),
      ...featureChecks.filter((check) => !check.all_true).map((check) => `required_admin_feature_mismatch:${check.label}`),
      ...(report.checks.ethan_delete_denied.all_delete_denied ? [] : ['ethan_delete_was_not_denied']),
      ...(hayun.http_status === 404 ? [] : ['inactive_hayun_was_not_denied']),
    ];
    report.failures = failures;
    report.status = failures.length ? 'fail' : 'pass';
  } catch (error) {
    const code = error instanceof QaFailure ? error.code : 'unexpected_live_readback_failure';
    report.failures.push(code);
  }

  report.finished_at = new Date().toISOString();
  report.artifact = writeArtifact(report);
  const summary = {
    mode: report.mode,
    status: report.status,
    artifact: report.artifact,
    failures: report.failures,
    permission_matrix: report.checks.permission_matrix || null,
  };
  process.stdout.write(`${JSON.stringify(summary)}\n`);
  if (report.status !== 'pass') process.exitCode = 1;
}

async function main() {
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    process.stdout.write(`${help()}\n`);
    return;
  }
  const { source, manifest } = readSourceManifest();
  const sourceChecks = sourceSpecialChecks(source, manifest);
  if (!sourceChecks.ok) throw new QaFailure('source_special_expectations_invalid', { failures: sourceChecks.failures });
  if (process.argv.includes('--source')) {
    process.stdout.write(`${JSON.stringify({ mode: 'source_only', status: 'pass', ...sourceChecks })}\n`);
    return;
  }
  const requestedConcurrency = Number(argumentValue('--concurrency', '4'));
  const concurrency = Number.isInteger(requestedConcurrency) && requestedConcurrency >= 1 && requestedConcurrency <= 8 ? requestedConcurrency : 4;
  await runLive(source, manifest, sourceChecks, concurrency);
}

main().catch((error) => {
  const code = error instanceof QaFailure ? error.code : 'unexpected_source_validation_failure';
  process.stderr.write(`${code}\n`);
  process.exitCode = 1;
});
