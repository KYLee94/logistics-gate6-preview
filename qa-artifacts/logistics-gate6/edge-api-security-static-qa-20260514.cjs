const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '../..');
const outDir = path.join(__dirname, 'edge-api-security-static-qa-20260514');
fs.mkdirSync(outDir, { recursive: true });

function read(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

function walk(dir, files = []) {
  if (!fs.existsSync(dir)) return files;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.git') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, files);
    else files.push(full);
  }
  return files;
}

function rel(file) {
  return path.relative(repoRoot, file).replace(/\\/g, '/');
}

function check(id, status, detail, evidence = {}) {
  return { id, status, detail, evidence };
}

const srcFiles = walk(path.join(repoRoot, 'src')).filter((file) => /\.(jsx?|tsx?)$/u.test(file));
const srcText = srcFiles.map((file) => ({ file: rel(file), text: fs.readFileSync(file, 'utf8') }));
const logisticsSecurityFiles = srcText.filter((item) => (
  item.file.endsWith('src/components/system/workspace/WorkspaceLogistics.jsx')
  || item.file.endsWith('src/components/system/AuthSetup.jsx')
));
const clientMutations = [];
const iotaLegacyMutationInventory = [];
for (const item of srcText) {
  const re = /\.from\(([^)]*)\)\s*\.\s*(insert|update|delete|upsert)\s*\(/gmu;
  let match;
  while ((match = re.exec(item.text))) {
    const entry = { file: item.file, tableExpression: match[1], method: match[2] };
    if (logisticsSecurityFiles.some((target) => target.file === item.file)) clientMutations.push(entry);
    else iotaLegacyMutationInventory.push(entry);
  }
}

const literalAccessCodeHits = logisticsSecurityFiles.flatMap((item) => (
  item.text.includes('IOTA2026') ? [{ file: item.file }] : []
));
const clientSecretEnvHits = logisticsSecurityFiles.flatMap((item) => {
  const hits = [];
  for (const token of ['SUPABASE_SERVICE_ROLE_KEY', 'OPENDART_API_KEY', 'BUILDING_REGISTER_API_KEY']) {
    if (item.text.includes(token)) hits.push({ file: item.file, token });
  }
  return hits;
});

const dashboardApi = read('supabase/functions/ll-dashboard-api/index.ts');
const authSync = read('supabase/functions/iota-auth-member-sync/index.ts');
const weeklyIngest = read('supabase/functions/ll-weekly-doc-ingest/index.ts');
const migrationTexts = walk(path.join(repoRoot, 'supabase', 'migrations')).map((file) => ({ file: rel(file), text: fs.readFileSync(file, 'utf8') }));
const nonLlMigrationTargets = migrationTexts.flatMap((item) => {
  const hits = [];
  const re = /\b(create|alter|drop|insert\s+into|update|delete\s+from)\s+(?:table\s+)?(?:if\s+(?:not\s+)?exists\s+)?(public\.[a-zA-Z0-9_]+)/gimu;
  let match;
  while ((match = re.exec(item.text))) {
    if (!match[2].startsWith('public.ll_')) hits.push({ file: item.file, statement: match[0], table: match[2] });
  }
  return hits;
});

const checks = [
  check(
    'frontend_no_direct_mutation',
    clientMutations.length === 0 ? 'pass' : 'fail',
    '물류 모듈과 인증 진입부 브라우저 소스에서 Supabase insert/update/delete/upsert 직접 호출이 없어야 합니다.',
    { clientMutations, scopedFiles: logisticsSecurityFiles.map((item) => item.file) },
  ),
  check(
    'iota_legacy_direct_mutation_inventory',
    iotaLegacyMutationInventory.length ? 'blocked' : 'pass',
    '기존 IOTA core 모듈에는 직접 mutation이 남아 있으나, 이번 물류 gate 범위 밖의 별도 보안 부채로 분리합니다.',
    { count: iotaLegacyMutationInventory.length, sample: iotaLegacyMutationInventory.slice(0, 12) },
  ),
  check(
    'frontend_no_hardcoded_iota_access_code',
    literalAccessCodeHits.length === 0 ? 'pass' : 'fail',
    '최초 접속 코드가 브라우저 소스에 고정 문자열로 남아 있으면 안 됩니다.',
    { literalAccessCodeHits },
  ),
  check(
    'frontend_no_server_secret_env_names',
    clientSecretEnvHits.length === 0 ? 'pass' : 'fail',
    '서버 전용 secret env 이름이 브라우저 소스에 없어야 합니다.',
    { clientSecretEnvHits },
  ),
  check(
    'll_dashboard_api_jwt_and_permission',
    dashboardApi.includes('auth.getUser(jwt)')
      && dashboardApi.includes('ll_user_permissions')
      && dashboardApi.includes('EDIT_TARGET_TABLE_ALLOWLIST')
      && dashboardApi.includes('WRITE_TABLE_ALLOWLIST') ? 'pass' : 'fail',
    'll-dashboard-api는 JWT 검증, 서버 권한 조회, ll_* allowlist를 가져야 합니다.',
  ),
  check(
    'll_dashboard_api_edit_write_readback_audit',
    dashboardApi.includes('approved_write_running')
      && dashboardApi.includes('stale_blocked')
      && dashboardApi.includes('writeDataChangeAudit')
      && dashboardApi.includes('readTargetCell')
      && dashboardApi.includes('rollbackAppliedEdits') ? 'pass' : 'fail',
    'Data Quality approve는 승인 후 readback, stale 차단, write, post-write readback, audit, rollback을 포함해야 합니다.',
  ),
  check(
    'll_dashboard_api_external_api_controls',
    dashboardApi.includes('fetchJsonWithTimeout')
      && dashboardApi.includes('checkRateLimit')
      && dashboardApi.includes('OPENDART_API_KEY')
      && dashboardApi.includes('BUILDING_REGISTER_API_KEY')
      && dashboardApi.includes('NAVER_CLOUD_CLIENT_ID')
      && dashboardApi.includes('naver/geocode') ? 'pass' : 'fail',
    'OpenDART/건축물대장/Naver API는 server-only secret, timeout, rate limit, redacted response를 가져야 합니다.',
  ),
  check(
    'll_weekly_ingest_monday_sunday_and_rollback',
    weeklyIngest.includes('buildMonthlyWeekRanges')
      && weeklyIngest.includes('Client week selection does not match server Monday-Sunday week calculation')
      && weeklyIngest.includes('restoreWeeklySnapshot') ? 'pass' : 'fail',
    'Weekly ingest는 월요일~일요일 주차를 서버에서 재계산하고 실패 시 기존 report/assets/projects를 복원해야 합니다.',
  ),
  check(
    'iota_auth_sync_jwt_email_scope',
    authSync.includes('auth.getUser(jwt)')
      && authSync.includes('email_scope_denied')
      && authSync.includes('auth_id_scope_denied') ? 'pass' : 'fail',
    'IOTA 회원정보 동기화 초안은 JWT와 이메일/auth_id 범위를 검증해야 합니다.',
  ),
  check(
    'iota_auth_sync_no_non_ll_write',
    !/\.from\(['"]iota_seoul_pilot_members['"]\)\s*\.\s*(insert|update|delete|upsert)\s*\(/u.test(authSync) ? 'pass' : 'fail',
    '물류 Gate 초안에서는 iota-auth-member-sync가 non-ll_* 테이블에 직접 write하면 안 됩니다.',
  ),
  check(
    'iota_auth_sync_origin_fail_closed',
    authSync.includes('origin_not_allowed') && authSync.includes('isAllowedOrigin(origin)') ? 'pass' : 'fail',
    'iota-auth-member-sync는 허용되지 않은 Origin 요청을 서버에서 fail-closed로 차단해야 합니다.',
  ),
  check(
    'edge_permissions_no_app_metadata_fallback',
    !dashboardApi.includes('app_metadata?.logistics_role') && !weeklyIngest.includes('app_metadata?.logistics_role') ? 'pass' : 'fail',
    '권한 판단은 ll_user_permissions 기준이어야 하며 app_metadata fallback으로 임시 승격하면 안 됩니다.',
  ),
  check(
    'll_migrations_only_public_ll_targets',
    nonLlMigrationTargets.length === 0 ? 'pass' : 'fail',
    '물류 migration preview는 public.ll_* 대상만 가져야 합니다.',
    { nonLlMigrationTargets },
  ),
];

const statusCounts = checks.reduce((acc, item) => {
  acc[item.status] = (acc[item.status] || 0) + 1;
  return acc;
}, {});

const result = {
  generatedAt: new Date().toISOString(),
  checks,
  statusCounts,
  allPass: checks.every((item) => item.status === 'pass'),
  logisticsGatePass: checks.filter((item) => item.id !== 'iota_legacy_direct_mutation_inventory').every((item) => item.status === 'pass'),
};

fs.writeFileSync(path.join(outDir, 'result.json'), JSON.stringify(result, null, 2), 'utf8');
fs.writeFileSync(path.join(outDir, 'summary.md'), [
  '# Edge/API security static QA - 2026-05-14',
  '',
  `- pass: ${statusCounts.pass || 0}`,
  `- fail: ${statusCounts.fail || 0}`,
  `- allPass: ${result.allPass}`,
  `- logisticsGatePass: ${result.logisticsGatePass}`,
  '',
  '| check | status | detail | evidence |',
  '|---|---|---|---|',
  ...checks.map((item) => `| ${item.id} | ${item.status} | ${item.detail} | ${JSON.stringify(item.evidence || {}).replace(/\|/g, '/')} |`),
  '',
].join('\n'), 'utf8');

console.log(JSON.stringify(result, null, 2));
