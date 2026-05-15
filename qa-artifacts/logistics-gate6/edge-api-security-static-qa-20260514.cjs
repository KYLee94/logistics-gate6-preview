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

const logisticsDirectSupabaseFrom = logisticsSecurityFiles.flatMap((item) => {
  const hits = [];
  const re = /supabase\.from\s*\(/gmu;
  let match;
  while ((match = re.exec(item.text))) hits.push({ file: item.file, index: match.index });
  return hits;
});

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
const rowRelatedAssetStart = dashboardApi.indexOf('function rowRelatedAsset');
const rowRelatedAssetBlock = rowRelatedAssetStart >= 0 ? dashboardApi.slice(rowRelatedAssetStart, rowRelatedAssetStart + 600) : '';
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
    'logistics_frontend_no_direct_supabase_from',
    logisticsDirectSupabaseFrom.length === 0 ? 'pass' : 'fail',
    '물류 프론트는 조회도 ll-dashboard-api Edge Function 또는 정적 payload 경유로 처리하고 supabase.from 직접 호출을 남기지 않습니다.',
    { logisticsDirectSupabaseFrom },
  ),
  check(
    'iota_legacy_direct_mutation_inventory',
    iotaLegacyMutationInventory.length ? 'inventory' : 'pass',
    '기존 IOTA core 모듈의 직접 mutation은 이번 물류 Gate 범위 밖의 보안 부채 인벤토리로만 기록합니다.',
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
    'll_dashboard_api_data_quality_server_read_and_approval_queue',
    dashboardApi.includes("action === 'quality/findings'")
      && dashboardApi.includes("action === 'edits/list'")
      && dashboardApi.includes("action === 'edits/readback'")
      && dashboardApi.includes('listQualityFindings')
      && dashboardApi.includes('listEditRequests')
      && dashboardApi.includes('readbackEdit') ? 'pass' : 'fail',
    'Data Quality findings/list/readback/approve/reject 흐름은 Edge Function에서 처리해야 합니다.',
  ),
  check(
    'll_dashboard_api_data_quality_center_only',
    dashboardApi.includes('DATA_QUALITY_ALLOWED_NAMES')
      && dashboardApi.includes('LL_DATA_QUALITY_ALLOWED_EMAILS')
      && dashboardApi.includes('canUseDataQuality(ctx)')
      && dashboardApi.includes('Data Quality permission is limited to Planning Center users') ? 'pass' : 'fail',
    'Data Quality는 프론트 탭 숨김이 아니라 Edge Function에서도 기획추진센터/허용 사용자만 접근 가능해야 합니다.',
  ),
  check(
    'll_dashboard_api_source_preservation_tables_not_auto_write_targets',
    !/EDIT_TARGET_TABLE_ALLOWLIST[\s\S]*public\.ll_source_cells/u.test(dashboardApi)
      && !/EDIT_TARGET_TABLE_ALLOWLIST[\s\S]*public\.ll_sheet_rows/u.test(dashboardApi)
      && dashboardApi.includes('EDIT_FIELD_ALLOWLIST')
      && dashboardApi.includes('assertTargetRowPermission') ? 'pass' : 'fail',
    '원본 보존 테이블은 자동 write 대상에서 제외하고, 대상 row/field 권한을 서버에서 재확인해야 합니다.',
  ),
  check(
    'll_dashboard_api_submit_validates_target_before_queue',
    dashboardApi.includes('MAX_EDIT_CELLS_PER_REQUEST')
      && dashboardApi.includes('const draftRecord =')
      && dashboardApi.includes('validateEditCell(ctx, cell)')
      && dashboardApi.includes('readTargetRow(ctx.serviceClient, cell)')
      && dashboardApi.includes('Insufficient asset write permission for target row') ? 'pass' : 'fail',
    'Data Quality submit은 승인 대기열에 넣기 전부터 대상 테이블/컬럼/행 권한을 서버에서 검증해야 합니다.',
  ),
  check(
    'll_dashboard_api_asset_scope_fail_closed',
    dashboardApi.includes('if (!assetId && !assetName) return false')
      && dashboardApi.includes('assertTargetRowPermission(ctx, row, cell)')
      && dashboardApi.includes('readTargetCell')
      && !rowRelatedAssetBlock.includes('cell.asset') ? 'pass' : 'fail',
    '자산 식별자가 없는 자동 write는 관리자 외에는 fail-closed로 막고, 클라이언트가 보낸 asset 값이 아니라 대상 row readback 기준으로 권한을 다시 확인해야 합니다.',
  ),
  check(
    'll_dashboard_api_tenant_company_scope_join',
    dashboardApi.includes('canWriteAnyLeaseAsset')
      && dashboardApi.includes("cell.targetTable === 'public.ll_tenants'")
      && dashboardApi.includes("cell.targetTable === 'public.ll_companies'")
      && dashboardApi.includes(".from('ll_leases')")
      && dashboardApi.includes(".from('ll_tenants')") ? 'pass' : 'fail',
    '임차인/회사 row처럼 자산 컬럼이 없는 대상은 lease/tenant join으로 읽기·수정 가능한 자산 scope를 확인해야 합니다.',
  ),
  check(
    'll_dashboard_api_submit_readback_snapshot',
    dashboardApi.includes('submissionReadbacks')
      && dashboardApi.includes('submit_readback_value')
      && dashboardApi.includes('stale_at_submit')
      && dashboardApi.includes('requestPayloadWithReadback') ? 'pass' : 'fail',
    'Data Quality submit 시점에도 현재 DB값 readback snapshot을 요청 payload에 남겨 감사성과 stale 추적성을 높여야 합니다.',
  ),
  check(
    'll_dashboard_api_audit_redaction',
    dashboardApi.includes('SENSITIVE_KEY_PATTERN')
      && dashboardApi.includes('redactSensitivePayload')
      && (dashboardApi.includes('request_payload: redactSensitivePayload(payload)')
        || dashboardApi.includes('request_payload: stripUndefined(redactSensitivePayload(payload))'))
      && dashboardApi.includes('write_result: redactSensitivePayload') ? 'pass' : 'fail',
    'API audit/write_result에는 service role, provider key, token 같은 민감값이 저장되지 않도록 redaction을 적용해야 합니다.',
  ),
  check(
    'll_dashboard_api_reject_status_guard',
    dashboardApi.includes("select('id, status, requested_by')")
      && dashboardApi.includes('Self rejection is not allowed')
      && dashboardApi.includes('Only submitted edit requests can be rejected')
      && dashboardApi.includes(".eq('status', 'submitted')") ? 'pass' : 'fail',
    'Data Quality reject는 submitted 상태만 처리하고 자기 반려 및 상태 경합을 차단해야 합니다.',
  ),
  check(
    'll_dashboard_api_worklog_existing_row_permission',
    dashboardApi.includes("select('id, created_by, status, related_asset_id, related_tenant_id, scope, payload')")
      && dashboardApi.includes('currentAssetId = currentRow.related_asset_id')
      && dashboardApi.includes("canMutateWorklog(ctx, 'update', currentAssetId)")
      && dashboardApi.includes("canMutateWorklog(ctx, 'delete', currentRow.related_asset_id)")
      && dashboardApi.includes('serverWorklogPayload') ? 'pass' : 'fail',
    'Worklog update/delete는 클라이언트 payload가 아니라 기존 저장 row의 자산/작성자 기준으로 권한을 확인하고 권한성 payload를 서버 기준으로 덮어써야 합니다.',
  ),
  check(
    'll_dashboard_api_external_api_controls',
    dashboardApi.includes('fetchJsonWithTimeout')
      && dashboardApi.includes('checkRateLimit')
      && dashboardApi.includes('readExternalApiCache')
      && dashboardApi.includes('writeExternalApiCache')
      && dashboardApi.includes('externalApiCacheResponse')
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
    'll_weekly_ingest_server_org_and_file_safety',
    weeklyIngest.includes('Weekly ingest requires server-side organization permission')
      && !weeklyIngest.includes("permission?.organization || safeText(formData.get('organization'))")
      && weeklyIngest.includes('hasWordFileSignature')
      && weeklyIngest.includes('Word parsing timeout') ? 'pass' : 'fail',
    'Weekly ingest는 클라이언트 조직 fallback 없이 서버 권한 조직만 쓰고 파일 signature/timeout을 검증해야 합니다.',
  ),
  check(
    'll_weekly_ingest_rate_limit',
    weeklyIngest.includes('type RateBucket')
      && weeklyIngest.includes('const rateBuckets = new Map')
      && weeklyIngest.includes("checkRateLimit(userData.user.id, 'weekly/ingest'") ? 'pass' : 'fail',
    'Weekly upload는 서버에서 사용자별 rate limit을 적용해 중복/과다 업로드를 막아야 합니다.',
  ),
  check(
    'll_external_api_cache_migration_ll_only',
    migrationTexts.some((item) => item.text.includes('create table if not exists public.ll_external_api_cache'))
      && migrationTexts.some((item) => item.text.includes('alter table public.ll_external_api_cache enable row level security')) ? 'pass' : 'fail',
    '외부 API cache 테이블은 public.ll_* 범위 안에서 생성되고 RLS가 켜져야 합니다.',
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
    'edge_uses_supabase_default_secret_fallback',
    dashboardApi.includes('SUPABASE_SECRET_KEYS')
      && dashboardApi.includes('SUPABASE_PUBLISHABLE_KEYS')
      && weeklyIngest.includes('SUPABASE_SECRET_KEYS')
      && weeklyIngest.includes('SUPABASE_PUBLISHABLE_KEYS')
      && dashboardApi.includes("readEdgeSecret('SUPABASE_SERVICE_ROLE_KEY')")
      && weeklyIngest.includes("readEdgeSecret('SUPABASE_SERVICE_ROLE_KEY')") ? 'pass' : 'fail',
    'Supabase가 SUPABASE_ 접두어 사용자 secret을 막아도 Edge 기본 secret bundle을 통해 service/publishable key를 읽어야 합니다.',
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
  allPass: checks.every((item) => item.status !== 'fail'),
  logisticsGatePass: checks.filter((item) => item.id !== 'iota_legacy_direct_mutation_inventory').every((item) => item.status === 'pass'),
};

fs.writeFileSync(path.join(outDir, 'result.json'), JSON.stringify(result, null, 2), 'utf8');
fs.writeFileSync(path.join(outDir, 'summary.md'), [
  '# Edge/API security static QA - 2026-05-14',
  '',
  `- pass: ${statusCounts.pass || 0}`,
  `- fail: ${statusCounts.fail || 0}`,
  `- inventory: ${statusCounts.inventory || 0}`,
  `- allPass: ${result.allPass}`,
  `- logisticsGatePass: ${result.logisticsGatePass}`,
  '',
  '| check | status | detail | evidence |',
  '|---|---|---|---|',
  ...checks.map((item) => `| ${item.id} | ${item.status} | ${item.detail} | ${JSON.stringify(item.evidence || {}).replace(/\|/g, '/')} |`),
  '',
].join('\n'), 'utf8');

console.log(JSON.stringify(result, null, 2));
