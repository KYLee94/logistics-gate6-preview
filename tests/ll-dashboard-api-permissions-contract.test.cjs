const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const test = require('node:test');

const edgePath = path.join(__dirname, '..', 'supabase', 'functions', 'll-dashboard-api', 'index.ts');
const weeklyPath = path.join(__dirname, '..', 'supabase', 'functions', 'll-weekly-doc-ingest', 'index.ts');
const edgeSource = fs.readFileSync(edgePath, 'utf8');
const weeklySource = fs.readFileSync(weeklyPath, 'utf8');

function functionSource(source, name, nextName) {
  const start = source.indexOf(`function ${name}(`);
  const end = source.indexOf(nextName, start);
  assert.ok(start >= 0, `${name} must exist`);
  assert.ok(end > start, `${name} must end before ${nextName}`);
  return source.slice(start, end);
}

test('authenticated dashboard requests fail closed without an active permission row', () => {
  const context = edgeSource.slice(edgeSource.indexOf('async function getContext('), edgeSource.indexOf('async function audit(', edgeSource.indexOf('async function getContext(')));

  assert.match(context, /if \(!isActivePermission\(permission \|\| null\)\) throw new Response\('No active logistics permission found', \{ status: 403 \}\);/u);
  assert.doesNotMatch(context, /mergeBootstrapPermission/u);
  assert.doesNotMatch(context, /safeText\(permissionFallback\?\.logistics_role, 'Reader'\)/u);
});

test('normalized user-email scopes are canonical and never OR-merged with legacy JSON', () => {
  const context = edgeSource.slice(edgeSource.indexOf('async function getContext('), edgeSource.indexOf('async function audit(', edgeSource.indexOf('async function getContext(')));
  const helpers = edgeSource.slice(edgeSource.indexOf('function normalizedScopePermission('), edgeSource.indexOf('function serverWorklogPayload(', edgeSource.indexOf('function normalizedScopePermission(')));

  assert.match(context, /\.eq\('principal_type', 'user_email'\)/u);
  assert.match(context, /\.eq\('principal_id', canonicalEmail\)/u);
  assert.match(context, /permissionScopes/u);
  assert.match(helpers, /if \(ctx\.permissionScopes\.length\)/u);
  assert.match(helpers, /scope\.canWrite === true/u);
  assert.match(helpers, /if \(scoped !== null\) return scoped;/u);
});

test('feature access comes only from active DB feature grants', () => {
  const features = functionSource(edgeSource, 'userFeaturePermissions', 'function hasUserFeaturePermission');
  const serverFeature = edgeSource.slice(edgeSource.indexOf('async function canUseServerFeature('), edgeSource.indexOf('async function canUseMarketResearch(', edgeSource.indexOf('async function canUseServerFeature(')));

  assert.match(features, /if \(!isActivePermission\(permission\)\) return \{\};/u);
  assert.doesNotMatch(features, /isDefaultFeatureAccessPermission/u);
  assert.match(serverFeature, /return hasUserFeaturePermission\(ctx\.permission, featureKey\);/u);
  assert.doesNotMatch(serverFeature, /canManageFeatureAccess/u);
  assert.doesNotMatch(serverFeature, /readFeatureAccessConfig/u);
});

test('asset permissions require the matching read or CRUD flag without role bypasses', () => {
  const helpers = edgeSource.slice(edgeSource.indexOf('function normalizedScopePermission('), edgeSource.indexOf('function serverWorklogPayload(', edgeSource.indexOf('function normalizedScopePermission(')));
  const readHelper = functionSource(edgeSource, 'canReadRelatedAsset', 'function canReadRelatedAssetRecord');

  assert.doesNotMatch(helpers, /hasRole\(ctx\.role, 'Admin'\)/u);
  assert.match(readHelper, /permissionFlag\(ctx\.permission, 'managed_asset_permissions', 'read'\)/u);
  assert.match(readHelper, /permissionFlag\(ctx\.permission, 'other_asset_permissions', 'read'\)/u);
  assert.match(helpers, /function canMutateRelatedAsset\(ctx: Context, action/u);
});

test('direct contract writes and board comments require asset mutation permissions', () => {
  const contract = edgeSource.slice(edgeSource.indexOf('async function applyContractData('), edgeSource.indexOf('const LEASE_EVENT_TYPES', edgeSource.indexOf('async function applyContractData(')));
  const comment = edgeSource.slice(edgeSource.indexOf('async function commentWorkPlatformBoardPost('), edgeSource.indexOf('async function deleteWorkPlatformBoardComment(', edgeSource.indexOf('async function commentWorkPlatformBoardPost(')));

  assert.match(contract, /assertTargetRowPermission\(ctx, targetRow, cell\)/u);
  assert.match(contract, /canMutateRelatedAsset\(ctx, 'update', cell\.assetId, cell\.assetName\)/u);
  assert.match(comment, /canMutateWorklog\(ctx, 'create', currentRow\.related_asset_id\)/u);
  assert.doesNotMatch(comment, /canReadRelatedAsset\(ctx, currentRow\.related_asset_id\)/u);
});

test('weekly data is authenticated, filtered by readable assets, and no public reset fallback remains', () => {
  const weeklyLatest = edgeSource.slice(edgeSource.indexOf('async function listLatestWeeklyAssets('), edgeSource.indexOf('function normalizeProjectRows(', edgeSource.indexOf('async function listLatestWeeklyAssets(')));
  const previewRoute = edgeSource.lastIndexOf("'weekly-assets/latest-preview'");
  const contextRoute = edgeSource.indexOf('ctx = await getContext(request, origin);');
  const accessCode = functionSource(edgeSource, 'logisticsFirstAccessCode', 'function matchesLogisticsFirstAccessCode');

  assert.ok(previewRoute > contextRoute);
  assert.match(weeklyLatest, /filter\(\(row\) => canReadRelatedAsset\(ctx, row\.asset_id \|\| row\.asset_name\)\)/u);
  assert.doesNotMatch(accessCode, /\|\|\s*'[^']+'/u);
});

test('feature access responses limit non-managers to the caller grant and weekly ingest requires active scoped permission', () => {
  const featureGet = edgeSource.slice(edgeSource.indexOf('async function callFeatureAccessGet('), edgeSource.indexOf('async function callFeatureAccessUpdate(', edgeSource.indexOf('async function callFeatureAccessGet(')));

  assert.match(featureGet, /if \(canManageFeatureAccess\(ctx\)\) \{/u);
  assert.match(featureGet, /self: compactFeatureAccessUser\(ctx\.permission \|\| \{\}\)/u);
  assert.match(weeklySource, /select\('email, logistics_role, can_ingest_weekly, organization, account_status, managed_asset_codes, managed_asset_permissions, other_asset_permissions'\)/u);
  assert.match(weeklySource, /if \(!isActivePermission\(permission \|\| null\)\) return fail\(403, 'No active logistics permission found', origin\);/u);
  assert.match(weeklySource, /filterAssetsForPermission\(await listRegisteredAssets\(serviceClient\), permissionWithScopes\)/u);
});

test('auth me exposes exact asset rights without database scope keys', () => {
  const authMe = edgeSource.slice(edgeSource.indexOf('async function callAuthMe('), edgeSource.indexOf('async function listPermissionUsers(', edgeSource.indexOf('async function callAuthMe(')));
  const assetRows = edgeSource.slice(edgeSource.indexOf('async function permissionAssetRows('), edgeSource.indexOf('async function permissionFundRows(', edgeSource.indexOf('async function permissionAssetRows(')));

  assert.match(assetRows, /permissions: assetPermissionResponse\(ctx, asset\)/u);
  assert.match(authMe, /asset_permissions:/u);
  assert.match(authMe, /other_asset_permissions_exact:/u);
  assert.match(authMe, /scope_permissions: scopePermissions/u);
  assert.doesNotMatch(authMe, /principal_id|principal_type/u);
});

test('asset-scoped writes accept Reader users only through exact create update delete grants', () => {
  const functions = [
    ['submitEdit', 'async function approveEdit('],
    ['callDataManagementPreviewEdit', 'async function callDataManagementSubmitEdit('],
    ['callDataManagementSubmitEdit', 'async function callDataManagementSubmitTableCell('],
    ['saveWeeklyProjectAssetDetail', 'async function readFundOverviewByAsset('],
    ['callAssetFloorPlanRegister', 'async function callMarketDocsUpload('],
  ];

  for (const [name, nextName] of functions) {
    const source = edgeSource.slice(edgeSource.indexOf(`async function ${name}(`), edgeSource.indexOf(nextName, edgeSource.indexOf(`async function ${name}(`)));
    assert.doesNotMatch(source, /hasRole\(ctx\.role, 'Editor'\)/u, `${name} must not require Editor before scope flags`);
  }
  const tableWrite = edgeSource.slice(edgeSource.indexOf('async function callDataManagementSubmitTableCell('), edgeSource.indexOf('async function callDataManagementSubmitViewFieldBatch(', edgeSource.indexOf('async function callDataManagementSubmitTableCell(')));
  assert.match(tableWrite, /assertTargetRowPermission\(ctx, row, cell\)/u);
});
