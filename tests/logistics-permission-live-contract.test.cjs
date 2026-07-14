const fs = require('fs');
const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  assessAnonymousActions,
  assessScope,
  isLiveHttpsUrl,
  normalizeAssetIds,
} = require('../scripts/qa/logistics-permission-live-contract.cjs');

const BACKEND_SOURCE_PATH = path.resolve(__dirname, '..', 'supabase', 'functions', 'll-dashboard-api', 'index.ts');
const BACKEND_SOURCE = fs.readFileSync(BACKEND_SOURCE_PATH, 'utf8');

function backendFunction(name) {
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
  const declaration = new RegExp(`(?:async\\s+)?function\\s+${escapedName}\\(`, 'u').exec(BACKEND_SOURCE);
  const start = declaration?.index ?? -1;
  assert.notEqual(start, -1, `Missing backend handler: ${name}`);
  const openBrace = BACKEND_SOURCE.indexOf('{', start);
  assert.notEqual(openBrace, -1, `Missing function body: ${name}`);

  let depth = 0;
  let quote = '';
  let escaped = false;
  let lineComment = false;
  let blockComment = false;
  for (let index = openBrace; index < BACKEND_SOURCE.length; index += 1) {
    const character = BACKEND_SOURCE[index];
    const next = BACKEND_SOURCE[index + 1];
    if (lineComment) {
      if (character === '\n') lineComment = false;
      continue;
    }
    if (blockComment) {
      if (character === '*' && next === '/') {
        blockComment = false;
        index += 1;
      }
      continue;
    }
    if (quote) {
      if (!escaped && character === quote) quote = '';
      escaped = !escaped && character === '\\';
      if (character !== '\\') escaped = false;
      continue;
    }
    if (character === '/' && next === '/') {
      lineComment = true;
      index += 1;
      continue;
    }
    if (character === '/' && next === '*') {
      blockComment = true;
      index += 1;
      continue;
    }
    if (character === '\'' || character === '"' || character === '`') {
      quote = character;
      continue;
    }
    if (character === '{') depth += 1;
    if (character === '}') {
      depth -= 1;
      if (depth === 0) return BACKEND_SOURCE.slice(start, index + 1);
    }
  }
  throw new Error(`Unclosed backend handler: ${name}`);
}

function assertReaderScopeMutationContract({ action, handler, scopeHandler = handler, scopePattern }) {
  const handlerSource = backendFunction(handler);
  const readerMatch = /if\s*\(\s*!hasRole\(ctx\.role,\s*'Reader'\)\s*\)\s*return fail\(403/u.exec(handlerSource);
  const forbiddenRoleGate = /if\s*\(\s*!hasRole\(ctx\.role,\s*'(?:Editor|Manager)'\)\s*\)\s*return fail\(403/u.exec(handlerSource);
  const scopeSource = backendFunction(scopeHandler);
  const scopeMatch = scopePattern.exec(scopeSource);
  const violations = [];
  if (!readerMatch) violations.push(`${handler} must retain Reader as the minimum authenticated role`);
  if (forbiddenRoleGate) violations.push(`${handler} incorrectly rejects Reader with an Editor/Manager precondition`);
  if (!scopeMatch) violations.push(`${scopeHandler} lacks canMutateRelatedAsset, canMutateWorklog, or assertTargetRowPermission`);
  if (readerMatch && scopeMatch && handler === scopeHandler && readerMatch.index >= scopeMatch.index) {
    violations.push(`${handler} checks asset scope before authenticating Reader`);
  }
  if (handler !== scopeHandler && !handlerSource.includes(`${scopeHandler}(`)) {
    violations.push(`${handler} does not delegate to ${scopeHandler}`);
  }
  assert.deepEqual(violations, [], `${action}: ${violations.join('; ')}`);
}

test('only HTTPS non-local URLs are eligible for the live permission probe', () => {
  assert.equal(isLiveHttpsUrl('https://kylee94.github.io/logistics-gate6-preview/'), true);
  assert.equal(isLiveHttpsUrl('http://localhost:5173/'), false);
  assert.equal(isLiveHttpsUrl('https://127.0.0.1/'), false);
  assert.equal(isLiveHttpsUrl('http://example.test/'), false);
});

test('managed asset IDs are normalized without inventing assets', () => {
  assert.deepEqual(normalizeAssetIds([
    'asset-c',
    { asset_id: 'asset-b', asset_code: 'B' },
    { assetId: 'asset-a', assetCode: 'A' },
    ' asset-a ',
    { asset_code: 'ignored-without-id' },
  ]), ['asset-a', 'asset-b', 'asset-c']);
});

test('scope assessment distinguishes exact managed scope from broad-read scope', () => {
  const exact = assessScope({ managedAssetRead: true, otherAssetRead: false, role: 'Reader' }, ['a'], ['a'], ['a']);
  assert.equal(exact.status, 'verified');
  assert.equal(exact.exact_match, true);

  const broad = assessScope({ managedAssetRead: true, otherAssetRead: true, role: 'Reader' }, ['a'], ['a', 'b'], ['a', 'b']);
  assert.equal(broad.status, 'unverified');
  assert.equal(broad.reason, 'broad_read_permission_prevents_exact_managed_asset_comparison');
  assert.equal(broad.managed_assets_are_subset, true);

  const managerWithoutOtherAssets = assessScope({ managedAssetRead: true, otherAssetRead: false, role: 'Manager' }, ['a'], ['a'], ['a']);
  assert.equal(managerWithoutOtherAssets.status, 'verified');
});

test('anonymous protection requires every requested action, including weekly preview, to deny access', () => {
  const protectedResult = assessAnonymousActions([
    { action: 'auth/me', status: 401 },
    { action: 'weekly-assets/latest-preview', status: 403 },
  ]);
  assert.equal(protectedResult.ok, true);

  const exposedResult = assessAnonymousActions([
    { action: 'auth/me', status: 401 },
    { action: 'weekly-assets/latest-preview', status: 200 },
  ]);
  assert.equal(exposedResult.ok, false);
  assert.equal(exposedResult.exposed_actions[0], 'weekly-assets/latest-preview');
});

const DATA_MANAGEMENT_SCOPE_GUARD = /assertTargetRowPermission\(ctx,\s*row,\s*cell\)/u;
const ASSET_SCOPE_GUARD = /(?:canMutateRelatedAsset|canWriteRelatedAsset)\(ctx,\s*[^,]+/u;
const WORKLOG_SCOPE_GUARD = /canMutateWorklog\(ctx,\s*[^,]+,\s*[^)]+\)/u;

const ASSET_SCOPED_MUTATION_CONTRACTS = [
  { action: 'asset-floor-plans/register', handler: 'callAssetFloorPlanRegister', scopePattern: ASSET_SCOPE_GUARD },
  { action: 'edits/submit', handler: 'submitEdit', scopePattern: DATA_MANAGEMENT_SCOPE_GUARD },
  { action: 'data-management/preview-edit', handler: 'callDataManagementPreviewEdit', scopeHandler: 'callDataManagementPreviewTableCell', scopePattern: DATA_MANAGEMENT_SCOPE_GUARD },
  { action: 'data-management/submit-edit', handler: 'callDataManagementSubmitEdit', scopeHandler: 'callDataManagementSubmitTableCell', scopePattern: DATA_MANAGEMENT_SCOPE_GUARD },
  { action: 'weekly-projects/save-asset-detail', handler: 'saveWeeklyProjectAssetDetail', scopePattern: ASSET_SCOPE_GUARD },
  { action: 'asset-spec/save', handler: 'callAssetSpecSave', scopePattern: ASSET_SCOPE_GUARD },
  { action: 'lease-events/submit', handler: 'submitLeaseEvent', scopePattern: ASSET_SCOPE_GUARD },
  { action: 'funds/save-by-asset', handler: 'saveFundOverviewByAsset', scopePattern: ASSET_SCOPE_GUARD },
  { action: 'work-platform/tasks', handler: 'saveWorkPlatformTask', scopePattern: WORKLOG_SCOPE_GUARD },
  { action: 'work-platform/tasks/update', handler: 'updateWorkPlatformTask', scopePattern: WORKLOG_SCOPE_GUARD },
  { action: 'work-platform/tasks/delete', handler: 'deleteWorkPlatformTask', scopePattern: WORKLOG_SCOPE_GUARD },
];

for (const contract of ASSET_SCOPED_MUTATION_CONTRACTS) {
  test(`${contract.action} allows Reader only after its exact asset scope mutation guard`, () => {
    assertReaderScopeMutationContract(contract);
  });
}

test('worklog scope wrapper consults canonical normalized scope before legacy permission fields', () => {
  const source = backendFunction('canMutateWorklog');
  const canonicalScopeIndex = source.indexOf("normalizedScopePermission(ctx, action, relatedAssetId)");
  const legacyPermissionIndex = source.indexOf('permissionFlag(ctx.permission');
  assert.ok(canonicalScopeIndex >= 0, 'canMutateWorklog must consult normalized permission scopes');
  assert.ok(legacyPermissionIndex < 0 || canonicalScopeIndex < legacyPermissionIndex, 'canonical scope must be consulted before legacy permission fields');
});
