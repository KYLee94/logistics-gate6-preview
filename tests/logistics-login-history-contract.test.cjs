const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..');
const migrationPath = path.join(
  ROOT,
  'supabase',
  'migrations',
  '20260729090000_gate6_login_event_history.sql',
);
const edgeSource = fs.readFileSync(
  path.join(ROOT, 'supabase', 'functions', 'll-dashboard-api', 'index.ts'),
  'utf8',
);
const authSource = fs.readFileSync(
  path.join(ROOT, 'src', 'components', 'system', 'AuthSetup.jsx'),
  'utf8',
);
const navSource = fs.readFileSync(
  path.join(ROOT, 'src', 'components', 'system', 'IotaLeftNav.jsx'),
  'utf8',
);

function sourceBlock(source, marker, nextMarker) {
  const start = source.indexOf(marker);
  const end = source.indexOf(nextMarker, start);
  assert.ok(start >= 0, `missing ${marker}`);
  assert.ok(end > start, `missing ${nextMarker}`);
  return source.slice(start, end);
}

test('login events use one minimal private persistence table', () => {
  assert.ok(fs.existsSync(migrationPath), 'missing login event migration');
  const migration = fs.readFileSync(migrationPath, 'utf8');
  assert.match(migration, /create table public\.ll_login_events/u);
  assert.match(migration, /enable row level security/u);
  assert.match(migration, /revoke all on table public\.ll_login_events from public, anon, authenticated/u);
  assert.doesNotMatch(migration, /\n\s+(?:password|ip_address|user_agent)\s+[a-z]/iu);
  assert.match(migration, /outcome in \('attempted', 'failed', 'success'\)/u);
});

test('public first-login attempts are rate-limited and limited to active permission profiles', () => {
  const handler = sourceBlock(edgeSource, 'async function recordPublicFirstLoginAttempt(', 'async function callLogisticsAuthStatus(');
  assert.match(edgeSource, /'auth\/login-attempt\/record'/u);
  assert.match(handler, /checkRateLimit/u);
  assert.match(handler, /readActiveCanonicalProfile/u);
  assert.match(handler, /isActivePermission/u);
  assert.match(handler, /event_type:\s*'first_login'/u);
  assert.doesNotMatch(handler, /payload\.password|user_agent|ip_address/iu);
});

test('successful login recording appends one event per request without grouping by user', () => {
  const record = sourceBlock(edgeSource, 'async function recordLogisticsLoginHistory(', 'async function listLogisticsLoginHistory(');
  const list = sourceBlock(edgeSource, 'async function listLogisticsLoginHistory(', 'async function listLogisticsLoginCapability(');
  assert.match(record, /\.from\('ll_login_events'\)/u);
  assert.match(record, /ctx\.user\.id/u);
  assert.match(record, /outcome:\s*'success'/u);
  assert.match(record, /LOGIN_HISTORY_TEST_PATTERN\.test\(source\)/u);
  assert.match(list, /\.from\('ll_login_events'\)/u);
  assert.match(list, /\.eq\('outcome', 'success'\)/u);
  assert.match(list, /\.order\('updated_at', \{ ascending: false \}\)/u);
  assert.match(list, /\.eq\('event_type', 'first_login'\)/u);
  assert.match(list, /'최초 접속 실패'/u);
  assert.match(list, /'최초 접속 시도'/u);
  assert.doesNotMatch(list, /distinct|groupBy|new Map\([^)]*email/iu);
});

test('the login client records first-access attempt and safe failure codes, then records success with the same event id', () => {
  const login = sourceBlock(authSource, 'const proceedLogin', 'return (');
  assert.match(authSource, /recordLogisticsFirstLoginAttempt/u);
  assert.match(authSource, /classifyLogisticsAuthFailure/u);
  assert.match(login, /crypto\.randomUUID\(\)/u);
  assert.match(login, /recordLogisticsFirstLoginAttempt/u);
  assert.match(login, /recordLogisticsLoginHistory\([^)]*loginEventId/su);
  assert.doesNotMatch(login, /user_agent|navigator\.userAgent/iu);
});

test('the recent login UI requests and renders the latest five event rows without deduplicating email', () => {
  assert.match(navSource, /auth\/login-history\/list', \{ limit: 5 \}/u);
  assert.match(navSource, /recentLoginHistoryRows\.map/u);
  assert.doesNotMatch(
    sourceBlock(navSource, 'const normalizeLoginHistoryData', 'const readLoginHistoryCache'),
    /new Map\(|new Set\(|findIndex|filter\([^)]*email/iu,
  );
});
