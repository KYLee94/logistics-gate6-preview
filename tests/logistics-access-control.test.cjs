const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const sourcePath = path.join(__dirname, '..', 'src', 'utils', 'logisticsAccessControl.js');
const source = fs.readFileSync(sourcePath, 'utf8');
const accessControl = new Function(`${source.replaceAll('export ', '')}\nreturn {
  hasActualFeatureGrant,
  isFeatureAccessManager,
  safeLogisticsRoute,
  filterQuickTabKeys,
  canReadAsset,
  canTaskAction,
};`)();

const memberWith = (featurePermissions = {}, email = 'reader@igisam.com') => ({
  email,
  permission_email: email,
  logistics_permission: { feature_permissions: featurePermissions },
});

const managedPermission = (overrides = {}) => ({
  email: 'reader@igisam.com',
  name: '담당자',
  role: 'Manager',
  managedAssets: [{ assetId: 'asset-a', assetName: '담당 자산' }],
  permissions: {
    managedAsset: { read: true, create: true, update: true, delete: true },
    otherAsset: { read: false, create: false, update: false, delete: false },
  },
  ...overrides,
});

test('기능 권한은 auth/me의 실제 feature_permissions만 독립적으로 사용한다', () => {
  const member = {
    ...memberWith({ ai_chat: true }),
    feature_permissions: { data_quality: true, login_history: true },
    role: 'System Admin',
    logistics_permission: { feature_permissions: { ai_chat: true } },
  };

  assert.equal(accessControl.hasActualFeatureGrant(member, 'ai_chat'), true);
  assert.equal(accessControl.hasActualFeatureGrant(member, 'data_quality'), false);
  assert.equal(accessControl.hasActualFeatureGrant(member, 'login_history'), false);
  assert.equal(accessControl.hasActualFeatureGrant(member, 'analysis_tools'), false);
});

test('기능 권한 관리자는 기존 핵심 3명으로만 판정한다', () => {
  assert.equal(accessControl.isFeatureAccessManager(memberWith({}, 'kylee@igisam.com')), true);
  assert.equal(accessControl.isFeatureAccessManager(memberWith({}, 'seunghoon.lee@igisam.com')), false);
  assert.equal(accessControl.isFeatureAccessManager(memberWith({}, 'reader@igisam.com')), false);
});

test('미부여 기능의 직접 URL과 빠른 탭은 안전한 기본 화면으로 대체한다', () => {
  const member = memberWith({ analysis_tools: false, data_playground: false, data_quality: false });
  assert.equal(accessControl.safeLogisticsRoute('/platform/logistics/dashboard/tools', member), '/platform/logistics/dashboard/home');
  assert.equal(accessControl.safeLogisticsRoute('/platform/logistics/dashboard/playground', member), '/platform/logistics/dashboard/home');
  assert.equal(accessControl.safeLogisticsRoute('/platform/logistics/data-management/data-quality', member), '/platform/logistics/data-management/lease-contracts');
  assert.equal(accessControl.safeLogisticsRoute('/platform/logistics/data-management/approval', member), '/platform/logistics/data-management/lease-contracts');
  assert.equal(accessControl.safeLogisticsRoute('/platform/logistics/market-data/source-update', member), '/platform/logistics/market-data/overview');
  assert.deepEqual(
    accessControl.filterQuickTabKeys(['home', 'tools', 'playground', 'dm-quality', 'dm-approval', 'source-update'], member),
    ['home'],
  );
});

test('업데이트와 승인 대기는 data_quality 부여와 분리해 핵심 3명만 통과한다', () => {
  const qualityOnlyMember = memberWith({ data_quality: true }, 'quality@igisam.com');
  const coreMember = memberWith({}, 'kylee@igisam.com');

  assert.equal(accessControl.safeLogisticsRoute('/platform/logistics/data-management/data-quality', qualityOnlyMember), '/platform/logistics/data-management/data-quality');
  assert.equal(accessControl.safeLogisticsRoute('/platform/logistics/data-management/approval', qualityOnlyMember), '/platform/logistics/data-management/lease-contracts');
  assert.equal(accessControl.safeLogisticsRoute('/platform/logistics/market-data/source-update', qualityOnlyMember), '/platform/logistics/market-data/overview');
  assert.deepEqual(accessControl.filterQuickTabKeys(['dm-quality', 'dm-approval', 'source-update'], qualityOnlyMember), ['dm-quality']);

  assert.equal(accessControl.safeLogisticsRoute('/platform/logistics/data-management/approval', coreMember), '/platform/logistics/data-management/approval');
  assert.equal(accessControl.safeLogisticsRoute('/platform/logistics/market-data/source-update', coreMember), '/platform/logistics/market-data/source-update');
  assert.deepEqual(accessControl.filterQuickTabKeys(['dm-quality', 'dm-approval', 'source-update'], coreMember), ['dm-approval', 'source-update']);
});

test('자산 read는 권한 flag와 자산 scope를 모두 요구한다', () => {
  const noManagedRead = managedPermission({
    permissions: {
      managedAsset: { read: false, create: true, update: true, delete: true },
      otherAsset: { read: false, create: false, update: false, delete: false },
    },
  });
  assert.equal(accessControl.canReadAsset(noManagedRead, 'asset-a', '담당 자산'), false);

  const scopedRead = managedPermission();
  assert.equal(accessControl.canReadAsset(scopedRead, 'asset-a', '담당 자산'), true);
  assert.equal(accessControl.canReadAsset(scopedRead, 'asset-b', '다른 자산'), false);

  const globalRead = managedPermission({
    permissions: {
      managedAsset: { read: false, create: false, update: false, delete: false },
      otherAsset: { read: true, create: false, update: false, delete: false },
    },
  });
  assert.equal(accessControl.canReadAsset(globalRead, 'asset-b', '다른 자산'), true);
});

test('자산별 permissions와 asset_permissions가 전역 managedAsset fallback보다 우선한다', () => {
  const permission = managedPermission({
    managedAssets: [
      {
        assetId: 'asset-a',
        assetName: '담당 자산',
        permissions: { read: false, create: false, update: false, delete: false },
      },
      {
        assetId: 'asset-b',
        assetName: '다른 담당 자산',
        asset_permissions: { read: true, create: false, update: true, delete: false },
      },
    ],
    permissions: {
      managedAsset: { read: true, create: true, update: true, delete: true },
      otherAsset: { read: false, create: false, update: false, delete: false },
    },
  });

  assert.equal(accessControl.canReadAsset(permission, 'asset-a', '담당 자산'), false);
  assert.equal(accessControl.canReadAsset(permission, 'asset-b', '다른 담당 자산'), true);
  assert.equal(accessControl.canTaskAction(permission, { assetId: 'asset-a', createdByEmail: 'reader@igisam.com' }, 'update'), false);
  assert.equal(accessControl.canTaskAction(permission, { assetId: 'asset-b', createdByEmail: 'reader@igisam.com' }, 'create'), false);
  assert.equal(accessControl.canTaskAction(permission, { assetId: 'asset-b', createdByEmail: 'reader@igisam.com' }, 'update'), true);
});

test('canonical scope rows가 있으면 asset UUID와 other_assets 행만 사용하고 legacy JSON과 OR하지 않는다', () => {
  const permission = managedPermission({
    managedAssets: [{ assetId: 'legacy-asset', assetName: '레거시 자산' }],
    asset_permissions: {
      'legacy-asset': { read: true, create: true, update: true, delete: true },
    },
    scope_permissions: [
      { scope_type: 'asset', scope_id: 'asset-a', can_read: true, can_write: false, can_delete: false },
      { scope_type: 'other_assets', scope_id: null, can_read: false, can_write: true, can_delete: false },
    ],
  });

  assert.equal(accessControl.canReadAsset(permission, 'asset-a', '정규 자산'), true);
  assert.equal(accessControl.canTaskAction(permission, { assetId: 'asset-a', createdByEmail: 'reader@igisam.com' }, 'update'), false);
  assert.equal(accessControl.canReadAsset(permission, 'asset-b', '기타 자산'), false);
  assert.equal(accessControl.canTaskAction(permission, { assetId: 'asset-b', createdByEmail: 'reader@igisam.com' }, 'create'), true);
  assert.equal(accessControl.canReadAsset(permission, 'legacy-asset', '레거시 자산'), false);
});

test('auth/me managedAssets의 canonical can_read/can_write/can_delete도 자산별 우선 권한으로 해석한다', () => {
  const permission = managedPermission({
    managedAssets: [{
      assetId: 'asset-a',
      assetName: '담당 자산',
      permissions: { can_read: true, can_write: false, can_delete: true },
    }],
    permissions: {
      managedAsset: { read: true, create: true, update: true, delete: false },
      otherAsset: { read: false, create: false, update: false, delete: false },
    },
  });

  assert.equal(accessControl.canReadAsset(permission, 'asset-a', '담당 자산'), true);
  assert.equal(accessControl.canTaskAction(permission, { assetId: 'asset-a', createdByEmail: 'reader@igisam.com' }, 'create'), false);
  assert.equal(accessControl.canTaskAction(permission, { assetId: 'asset-a', createdByEmail: 'reader@igisam.com' }, 'delete'), true);
});

test('Task C/U/D와 순서변경은 자산 scope, action flag, 소유자 또는 관리자 조건을 모두 요구한다', () => {
  const task = { assetId: 'asset-a', assetName: '담당 자산', createdByEmail: 'other@igisam.com' };
  const manager = managedPermission();
  assert.equal(accessControl.canTaskAction(manager, task, 'create'), true);
  assert.equal(accessControl.canTaskAction(manager, task, 'update'), true);
  assert.equal(accessControl.canTaskAction(manager, task, 'delete'), true);

  const managerWithoutDelete = managedPermission({
    permissions: {
      managedAsset: { read: true, create: true, update: true, delete: false },
      otherAsset: { read: false, create: false, update: false, delete: false },
    },
  });
  assert.equal(accessControl.canTaskAction(managerWithoutDelete, task, 'delete'), false);

  const owner = managedPermission({ role: 'Reader', email: 'owner@igisam.com', name: '소유자' });
  const ownedTask = { ...task, createdByEmail: 'owner@igisam.com' };
  assert.equal(accessControl.canTaskAction(owner, ownedTask, 'update'), true);
  assert.equal(accessControl.canTaskAction(owner, task, 'update'), false);
  assert.equal(accessControl.canTaskAction(owner, ownedTask, 'reorder'), true);
});

test('주요 자산 UI는 역할명 또는 전역 권한을 직접 우회하지 않고 canonical resolver를 사용한다', () => {
  const workspaceSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'components', 'system', 'workspace', 'WorkspaceLogistics.jsx'), 'utf8');
  const leftNavSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'components', 'system', 'IotaLeftNav.jsx'), 'utf8');

  assert.match(workspaceSource, /canAssetAction,/);
  assert.match(workspaceSource, /safeLogisticsRoute\(normalizedCurrentPath, memberInfo\)/);
  assert.match(workspaceSource, /filterQuickTabKeys\(quickTabKeys, memberInfo\)/);
  assert.doesNotMatch(workspaceSource, /permission\.role === 'Admin'/);
  assert.doesNotMatch(workspaceSource, /permission\.permissions\?\.(managedAsset|otherAsset)\?\.(read|create|update|delete)/);
  assert.match(leftNavSource, /const canViewSourceUpdate = canManageFeatureAccess;/);
  assert.match(leftNavSource, /\|\| canViewSourceUpdate/);
  assert.match(leftNavSource, /return canManageFeatureAccess;/);
});
