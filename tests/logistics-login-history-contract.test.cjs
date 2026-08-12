const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { pathToFileURL } = require('node:url');

const ROOT = path.resolve(__dirname, '..');
const migrationPath = path.join(
  ROOT,
  'supabase',
  'migrations',
  '20260729090000_gate6_login_event_history.sql',
);
const backfillMigrationPath = path.join(
  ROOT,
  'supabase',
  'migrations',
  '20260729094500_backfill_login_events_from_last_login.sql',
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
const loginHistoryHelperPath = path.join(ROOT, 'src', 'components', 'system', 'loginHistory.js');

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

test('existing per-user last login values are preserved as initial event history', () => {
  assert.ok(fs.existsSync(backfillMigrationPath), 'missing login event backfill migration');
  const migration = fs.readFileSync(backfillMigrationPath, 'utf8');
  assert.match(migration, /insert into public\.ll_login_events/u);
  assert.match(migration, /from public\.ll_user_permissions/u);
  assert.match(migration, /where last_login_at is not null/u);
  assert.match(migration, /on conflict \(event_id\) do nothing/u);
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

test('successful login history keeps distinct requests but collapses accidental rapid duplicates before returning rows', () => {
  const record = sourceBlock(edgeSource, 'async function recordLogisticsLoginHistory(', 'async function listLogisticsLoginHistory(');
  const list = sourceBlock(edgeSource, 'async function listLogisticsLoginHistory(', 'async function listLogisticsLoginCapability(');
  assert.match(record, /\.from\('ll_login_events'\)/u);
  assert.match(record, /ctx\.user\.id/u);
  assert.match(record, /outcome:\s*'success'/u);
  assert.match(record, /LOGIN_HISTORY_TEST_PATTERN\.test\(source\)/u);
  assert.match(list, /\.from\('ll_login_events'\)/u);
  assert.match(list, /\.eq\('outcome', 'success'\)/u);
  assert.match(list, /\.order\('updated_at', \{ ascending: false \}\)/u);
  assert.match(list, /deduplicateLoginHistoryEvents/u);
  assert.match(list, /\.eq\('event_type', 'first_login'\)/u);
  assert.match(list, /'최초 접속 실패'/u);
  assert.match(list, /'최초 접속 시도'/u);
});

test('the login client blocks concurrent submissions and records success with one event id', () => {
  const login = sourceBlock(authSource, 'const proceedLogin', 'return (');
  assert.match(authSource, /recordLogisticsFirstLoginAttempt/u);
  assert.match(authSource, /classifyLogisticsAuthFailure/u);
  assert.match(login, /crypto\.randomUUID\(\)/u);
  assert.match(login, /loginSubmissionRef\.current/u);
  assert.match(login, /setIsLoginSubmitting\(true\)/u);
  assert.match(login, /recordLogisticsFirstLoginAttempt/u);
  assert.match(login, /recordLogisticsLoginHistory\([^)]*loginEventId/su);
  assert.doesNotMatch(login, /user_agent|navigator\.userAgent/iu);
});

test('the recent login UI requests and renders the latest five distinct login attempts', () => {
  assert.match(navSource, /auth\/login-history\/list', \{ limit: 5 \}/u);
  assert.match(navSource, /recentLoginHistoryRows\.map/u);
  assert.match(sourceBlock(navSource, 'const normalizeLoginHistoryData', 'const readLoginHistoryCache'), /deduplicateLoginHistoryRows/u);
});

test('rapid duplicate rows collapse while genuine later logins and other users remain', async () => {
  assert.ok(fs.existsSync(loginHistoryHelperPath), 'missing login history deduplication helper');
  const { deduplicateLoginHistoryRows } = await import(`${pathToFileURL(loginHistoryHelperPath).href}?t=${Date.now()}`);
  const rows = [
    { event_id: 'newer', email: 'jhlee@igisam.com', logged_at: '2026-08-12T05:57:42.615Z', status: 'success', source_label: '웹 로그인' },
    { event_id: 'duplicate', email: 'jhlee@igisam.com', logged_at: '2026-08-12T05:57:42.220Z', status: 'success', source_label: '웹 로그인' },
    { event_id: 'later-real-login', email: 'jhlee@igisam.com', logged_at: '2026-08-12T05:52:00.000Z', status: 'success', source_label: '웹 로그인' },
    { event_id: 'other-user', email: 'oce@igisam.com', logged_at: '2026-08-12T05:57:42.300Z', status: 'success', source_label: '웹 로그인' },
  ];
  assert.deepEqual(deduplicateLoginHistoryRows(rows).map((row) => row.event_id), [
    'newer',
    'later-real-login',
    'other-user',
  ]);
});
