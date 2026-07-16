const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..');
const edgeSource = fs.readFileSync(path.join(ROOT, 'supabase', 'functions', 'll-dashboard-api', 'index.ts'), 'utf8');
const workspaceSource = fs.readFileSync(path.join(ROOT, 'src', 'components', 'system', 'workspace', 'WorkspaceLogistics.jsx'), 'utf8');
const authSetupSource = fs.readFileSync(path.join(ROOT, 'src', 'components', 'system', 'AuthSetup.jsx'), 'utf8');
const authQaSource = fs.readFileSync(path.join(ROOT, 'scripts', 'qa', 'logistics-auth-permission-matrix.cjs'), 'utf8');
const reconciliationMigration = fs.readFileSync(path.join(ROOT, 'supabase', 'migrations', '20260715013257_logistics_permission_reconciliation_20260715.sql'), 'utf8');

test('lease event handlers authorize every canonical asset connected to their actual lease rows', () => {
  const connectionReader = sourceBlock(edgeSource, 'async function leaseEventAuthorizationRows(', 'async function resolveLeaseEventAssetAuthorization(');
  const resolver = sourceBlock(edgeSource, 'async function resolveLeaseEventAssetAuthorization(', 'function requiredLeaseEventAction(');
  const preview = sourceBlock(edgeSource, 'async function previewLeaseEvent(', 'async function submitLeaseEvent(');
  const submit = sourceBlock(edgeSource, 'async function submitLeaseEvent(', 'function fundOverviewComparable(');

  assert.match(connectionReader, /\.from\(table\)/u);
  assert.match(resolver, /'ll_lease_spaces'/u);
  assert.match(resolver, /'ll_leases'/u);
  assert.match(resolver, /'ll_tenants'/u);
  assert.match(resolver, /\.in\('tenant_id', tenantIds\)/u);
  assert.match(resolver, /resolveCanonicalAssets\(ctx, connectedAssetReferences\)/u);
  assert.match(resolver, /asset_scope_mismatch/u);
  assert.match(resolver, /asset_connection_missing/u);
  assert.match(resolver, /lease_space_lease_mismatch/u);
  assert.match(resolver, /eventPayload\.asset_id = claimedAsset\.asset_id/u);
  assert.match(resolver, /evaluateCanonicalAssetPermission\(ctx, action, canonicalAssets\.map\(\(asset\) => asset\.asset_id\)\)/u);

  for (const handler of [preview, submit]) {
    assert.match(handler, /resolveLeaseEventAssetAuthorization\(ctx, eventPayload, requiredAction\)/u);
    assert.doesNotMatch(handler, /canReadRelatedAsset|canMutateRelatedAsset/u);
  }
  assert.match(preview, /const requiredAction = requiredLeaseEventAction\(eventPayload\);/u);
  assert.match(submit, /const requiredAction = requiredLeaseEventAction\(eventPayload\);/u);
});

test('public logistics auth status returns only allowed-user identity fields and is email-rate-limited', () => {
  const status = sourceBlock(edgeSource, 'async function callLogisticsAuthStatus(', 'Deno.serve(');

  assert.match(status, /checkRateLimit\(`public:auth-status:\$\{email \|\| 'invalid'\}`, 'auth\/logistics-status', 12, 60_000\)/u);
  assert.match(status, /const staffName = allowed[\s\S]*?const imageUrl = allowed/u);
  assert.match(status, /\.\.\.\(allowed \? \{[\s\S]*staff_name: staffName[\s\S]*image_url: imageUrl[\s\S]*\} : \{\}\)/u);
  assert.doesNotMatch(status, /(?:organization|role|permissions?|managed_asset_permissions|other_asset_permissions|feature_permissions)\s*:/u);
  assert.doesNotMatch(status, /registered|first_login_completed|email_confirmed|has_permission_row|bootstrap_permission|auth_read_ok|auth_read_error|profileResult\.error\.message/u);
});

test('password step exposes the approved staff name and image through stable test ids', () => {
  assert.match(authSetupSource, /data-testid="logistics-password-profile-name"/u);
  assert.match(authSetupSource, /data-testid="logistics-password-profile-photo"/u);
  assert.match(authSetupSource, /selectedAvatarInfo/u);
  assert.match(authSetupSource, /staffName/u);
});

test('board post comments require create permission and listing requires current canonical asset read permission', () => {
  const list = sourceBlock(edgeSource, 'async function listWorkPlatformBoardPosts(', 'async function saveWorkPlatformBoardPost(');
  const filter = sourceBlock(edgeSource, 'async function filterWorkPlatformBoardRows(', 'function hasPermissionRow(');
  const comment = sourceBlock(edgeSource, 'async function commentWorkPlatformBoardPost(', 'async function deleteWorkPlatformBoardComment(');

  assert.match(list, /await filterWorkPlatformBoardRows\(ctx, data \|\| \[\]\)/u);
  assert.doesNotMatch(list, /created_by\.eq\.\$\{ctx\.user\.id\}/u);
  assert.match(filter, /evaluateCanonicalAssetPermission\(ctx, 'read', relatedAssetId\)/u);
  assert.match(filter, /explicitBoardLegacyScope\(row\)/u);
  assert.doesNotMatch(filter, /row\.created_by === ctx\.user\.id \|\| canReadRelatedAsset/u);
  assert.match(comment, /evaluateCanonicalAssetPermission\(ctx, 'create', currentRow\.related_asset_id\)/u);
  assert.doesNotMatch(comment, /evaluateCanonicalAssetPermission\(ctx, 'read', currentRow\.related_asset_id\)/u);
});

test('all dispatcher actions have one explicit public self global asset or multi_asset contract before handler dispatch', () => {
  const scopeAuthorization = sourceBlock(edgeSource, 'async function authorizeActionScope(', 'async function canUseMarketResearch(');
  const dispatcherStart = edgeSource.indexOf('Deno.serve(async (request)');
  const firstHandler = edgeSource.indexOf("if (action === 'health')", dispatcherStart);
  assert.ok(dispatcherStart >= 0 && firstHandler > dispatcherStart);
  const dispatcher = edgeSource.slice(dispatcherStart, firstHandler + 80);

  assert.match(edgeSource, /type ActionScopeContract = 'public' \| 'self' \| 'global' \| 'asset' \| 'multi_asset';/u);
  assert.match(edgeSource, /const ACTION_SCOPE_MANIFEST = new Map<string, ActionScopeContract>\(\[/u);
  assert.match(edgeSource, /const ACTION_SCOPE_HANDLER_CONTRACTS = new Map<string, Extract<ActionScopeContract, 'asset' \| 'multi_asset'>>\(\[/u);
  assert.match(edgeSource, /assertActionScopeManifest\(\)[\s\S]*ACTION_SCOPE_MANIFEST\.size === ACTION_MANIFEST\.size/u);
  assert.match(edgeSource, /ACTION_SCOPE_MANIFEST\.get\(action\) === scope/u);
  assert.match(edgeSource, /ACTION_SCOPE_HANDLER_CONTRACTS\.get\(action\) === scope/u);
  assert.match(scopeAuthorization, /scope === 'asset' \|\| scope === 'multi_asset'/u);
  assert.match(scopeAuthorization, /asset_scope_handler_unregistered/u);
  assert.match(dispatcher, /if \(!assertActionScopeManifest\(\)\) return fail\(500, 'Action scope manifest is invalid', origin\);/u);
  assert.match(dispatcher, /const scopeAuthorization = await authorizeActionScope\(ctx, action, payload\);/u);
  assert.ok(dispatcher.indexOf('const scopeAuthorization = await authorizeActionScope(ctx, action, payload);') < dispatcher.indexOf("if (action === 'health')"));
});

test('JWT user_id is the canonical permission principal and email aliases cannot adopt another profile', () => {
  const context = sourceBlock(edgeSource, 'async function getContext(', 'async function audit(');

  assert.match(context, /\.eq\('user_id', userData\.user\.id\)/u);
  assert.match(context, /permissionMatchesJwtUser\(profile, userData\.user\.id\)/u);
  assert.doesNotMatch(context, /activeEmailProfiles|emailProfiles|canonicalProfileEmail\(userData\.user\.email\)/u);
  assert.doesNotMatch(context, /logisticsAuthEmailCandidates\(userData\.user\.email\)/u);
});

test('permission upserts use one exact auth.users ID and never generate a permission principal', () => {
  const update = sourceBlock(edgeSource, 'async function callAuthUserPermissionsUpdate(', 'async function recordLogisticsLoginHistory(');
  const resolver = sourceBlock(edgeSource, 'async function resolveExactPermissionPrincipal(', 'async function listAuthUsers(');

  assert.match(edgeSource, /async function resolveExactPermissionPrincipal\(/u);
  assert.match(update, /await resolveExactPermissionPrincipal\(ctx\.serviceClient, email\)/u);
  assert.match(update, /user_id: principal\.userId/u);
  assert.doesNotMatch(update, /crypto\.randomUUID\(\)/u);
  assert.doesNotMatch(edgeSource, /user_id:\s*crypto\.randomUUID\(\)/u);
  assert.match(resolver, /\.eq\('email', normalizedEmail\)/u);
  assert.match(resolver, /await listAuthUsers\(serviceClient\)/u);
  assert.match(resolver, /authUsers\.length !== 1/u);
  assert.match(resolver, /storedUserId && storedUserId !== userId/u);
  assert.doesNotMatch(resolver, /logisticsAuthEmailCandidates|canonicalProfileEmail/u);
});

function sourceBlock(source, marker, nextMarker) {
  const start = source.indexOf(marker);
  const end = source.indexOf(nextMarker, start);
  assert.ok(start >= 0, `missing ${marker}`);
  assert.ok(end > start, `missing end marker ${nextMarker}`);
  return source.slice(start, end);
}

function directDispatcherActions(source) {
  return [...new Set([...source.matchAll(/action\s*===\s*'([^']+)'/gu)].map((match) => match[1]))].sort();
}

function actionManifestActions(source) {
  const start = source.indexOf('const ACTION_MANIFEST =');
  const end = source.indexOf('\n]);', start);
  assert.ok(start >= 0, 'missing ACTION_MANIFEST');
  assert.ok(end > start, 'missing ACTION_MANIFEST end');
  return [...new Set([...source.slice(start, end).matchAll(/'([^']+)'/gu)]
    .map((match) => match[1])
    .filter((value) => !['public', 'authenticated', 'permission_admin', 'approval_management'].includes(value)))].sort();
}

function sourceFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(target);
    return /\.(?:js|jsx|ts|tsx)$/u.test(entry.name) ? [target] : [];
  });
}

function logisticsFeatureKeys(source) {
  const block = sourceBlock(source, 'const LOGISTICS_FEATURE_KEYS =', ']);');
  return [...new Set([...block.matchAll(/'([^']+)'/gu)].map((match) => match[1]))].sort();
}

test('auth/me은 permission_revision과 asset_capabilities를 동시에 제공한다', () => {
  const authMe = sourceBlock(edgeSource, 'async function callAuthMe(', 'async function listPermissionUsers(');
  assert.match(authMe, /permission_revision/u);
  assert.match(authMe, /asset_capabilities/u);
});

test('auth/users/list는 permission profile만 반환하며 auth 사용자 전체를 나열하지 않는다', () => {
  const usersList = sourceBlock(edgeSource, 'async function callAuthUsersList(', 'async function callAuthUserPermissionsUpdate(');
  assert.match(usersList, /listPermissionUsers\(ctx\)/u);
  assert.doesNotMatch(usersList, /auth\.admin\.listUsers|listAuthUsersWithTimeout/u);
});

test('권한 체크는 role bypass 없이 exact asset capability를 사용한다', () => {
  const mutate = sourceBlock(edgeSource, 'function canMutateRelatedAsset(', 'function canMutateWorklog(');
  const read = sourceBlock(edgeSource, 'function canReadRelatedAsset(', 'function canReadRelatedAssetRecord(');
  assert.doesNotMatch(mutate, /hasRole\(ctx\.role/u);
  assert.doesNotMatch(read, /hasRole\(ctx\.role/u);
  assert.match(read, /hasManagedAssetRef\(ctx\.permission, reference\)[\s\S]*'managed_asset_permissions'[\s\S]*'other_asset_permissions'/u);
  assert.match(read, /permissionFlag\(ctx\.permission, key, 'read'\)/u);
});

test('dashboard visibility는 capability missing/loading을 deny로 축소하지 않고 permission revision을 사용한다', () => {
  const shell = sourceBlock(workspaceSource, 'function DashboardShell(', 'function LegacyWorkspaceLogistics(');
  assert.match(workspaceSource, /permission_revision/u);
  assert.match(workspaceSource, /asset_capabilities/u);
  assert.match(shell, /assetCapabilitiesLoading/u);
  assert.match(shell, /preserveAuthorizedModuleVisibility/u);
  assert.doesNotMatch(shell, /assetCapabilitiesLoading\s*\?\s*\[\]/u);
});

test('qa matrix는 runtime static fallback과 mock/fake session을 live 증거로 통과시키지 않는다', () => {
  assert.match(authQaSource, /runtime_permission_json_fallback/u);
  assert.match(authQaSource, /evidence_mode/u);
  assert.match(authQaSource, /mock_or_fake_session/u);
  assert.doesNotMatch(authQaSource, /qa-artifacts/u);
});

test('dispatcher action은 최신 source에서 재계산되며 permissions/evaluate를 포함해 완전 분류된다', () => {
  const directActions = directDispatcherActions(edgeSource);
  const manifestActions = actionManifestActions(edgeSource);

  assert.ok(directActions.length >= 94);
  assert.ok(directActions.includes('permissions/evaluate'));
  assert.equal(directActions.includes('weekly-assets/latest-preview'), false);
  assert.deepEqual(directActions.filter((action) => !manifestActions.includes(action)), []);
  assert.deepEqual(manifestActions.filter((action) => !directActions.includes(action)), []);
});

test('ACTION_MANIFEST의 public endpoint는 maps config와 logistics status만 허용한다', () => {
  const actionManifest = sourceBlock(edgeSource, 'const ACTION_MANIFEST =', ']);');
  assert.match(
    actionManifest,
    /\.\.\.\['naver\/maps-config', 'auth\/logistics-status'\]\.map\(\(action\) => \[action, 'public'\]/u,
  );
  assert.doesNotMatch(actionManifest, /auth\/first-login\/setup|auth\/password-reset\/access-code|weekly-assets\/latest-preview/u);
});

test('weekly-assets/latest-preview는 backend dispatcher와 frontend source에서 완전히 제거된다', () => {
  const backendOccurrences = (edgeSource.match(/weekly-assets\/latest-preview/gu) || []).length;
  const frontendReferences = sourceFiles(path.join(ROOT, 'src'))
    .filter((filePath) => fs.readFileSync(filePath, 'utf8').includes('weekly-assets/latest-preview'));
  assert.equal(backendOccurrences, 0);
  assert.deepEqual(frontendReferences, []);
});

test('permissions/evaluate는 role bypass 없이 canonical asset evaluator의 4개 CRUD 결과를 반환한다', () => {
  const evaluator = sourceBlock(edgeSource, 'async function callPermissionsEvaluate(', 'async function callAuthUserPermissionsUpdate(');
  const canonicalEvaluator = sourceBlock(edgeSource, 'async function evaluateCanonicalAssetPermission(', 'function canWriteRelatedAsset(');

  assert.doesNotMatch(evaluator, /hasRole\(ctx\.role/u);
  assert.match(evaluator, /for \(const action of \['read', 'create', 'update', 'delete'\]/u);
  assert.match(evaluator, /evaluateCanonicalAssetPermission\(evaluatedContext, action, references\)/u);
  assert.match(canonicalEvaluator, /resolved\.assets\.every\(\(asset\) => canonicalAssetCapability\(ctx\.permission, asset\)\[action\] === true\)/u);
});

test('세 최종 관리자는 server feature key 전체를 true로 받으며 permission_admin과 approval_management를 포함한다', () => {
  const featureKeys = logisticsFeatureKeys(edgeSource);
  const finalAdminGrant = reconciliationMigration.match(
    /feature_permissions = case\s+when s\.email in \('kylee@igisam\.com', 'sjlee@igisam\.com', 'jk\.jeon@igisam\.com'\) then[\s\S]*?jsonb_build_object\(([\s\S]*?)\)\s+else\b/u,
  )?.[1];
  assert.ok(finalAdminGrant, 'missing administrator feature_permissions CASE branch');

  assert.deepEqual(featureKeys, [
    'ai_chat',
    'analysis_tools',
    'approval_management',
    'building_register_refresh',
    'data_playground',
    'data_quality',
    'login_history',
    'market_research',
    'opendart_refresh',
    'permission_admin',
  ]);
  for (const key of featureKeys) assert.match(finalAdminGrant, new RegExp(`'${key}', true`, 'u'));
});
