const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const {
  buildPermissionManifest,
  extractDirectActions,
  selectExcelInput,
  validateWorkbookParity,
  validateWorkbookSourceRanges,
  visibleDashboardModules,
} = require('../scripts/qa/logistics-permission-manifest-core.cjs');

const ROOT = path.resolve(__dirname, '..');
const permissionData = JSON.parse(fs.readFileSync(
  path.join(ROOT, 'src', 'components', 'system', 'workspace', 'logisticsPermissionData.json'),
  'utf8',
));
const edgeSource = fs.readFileSync(
  path.join(ROOT, 'supabase', 'functions', 'll-dashboard-api', 'index.ts'),
  'utf8',
);

test('권한 source manifest는 38 x 8 원천 플래그와 38 x 19 x 4 결정 전체를 만든다', () => {
  const manifest = buildPermissionManifest(permissionData, extractDirectActions(edgeSource));

  assert.equal(manifest.ok, true, manifest.failures.join('\n'));
  assert.deepEqual(manifest.counts, {
    source_users: 38,
    source_assets: 19,
    source_flags: 304,
    effective_decisions: 2888,
    action_classifications: 94,
  });
  assert.equal(manifest.source_flags.length, 304);
  assert.equal(manifest.effective_decisions.length, 2888);
  assert.equal(manifest.action_classifications.length, 94);
  assert.equal(manifest.identity_issues.length, 0);
  assert.equal(manifest.action_issues.length, 0);
});

test('이관용, 이시정, 전기영은 정확한 19개 자산 ID의 CRUD 결정이 모두 true다', () => {
  const manifest = buildPermissionManifest(permissionData, extractDirectActions(edgeSource));
  const expectedAssetIds = permissionData.assetMaster.map((asset) => asset.assetId).sort();
  const expectedProfiles = [
    ['kylee@igisam.com', '이관용'],
    ['sjlee@igisam.com', '이시정'],
    ['jk.jeon@igisam.com', '전기영'],
  ];

  for (const [email, name] of expectedProfiles) {
    const sourceProfile = permissionData.users.find((user) => user.email === email);
    const decisions = manifest.effective_decisions.filter((row) => row.email === email);
    assert.equal(sourceProfile?.name, name);
    assert.equal(decisions.length, 19 * 4);
    assert.deepEqual([...new Set(decisions.map((row) => row.asset_id))].sort(), expectedAssetIds);
    assert.ok(decisions.every((row) => row.scope === 'managed' && row.allowed === true && row.reason === 'exact_scope_flag'));
  }
});

test('System Admin 역할은 우회 권한이 아니며 Ethan의 delete 결정은 모든 자산에서 false다', () => {
  const roleOnlyFixture = {
    schemaVersion: 'fixture',
    userCount: 1,
    assetCount: 1,
    users: [{
      email: 'system-admin@example.com',
      logistics_role: 'System Admin',
      managedAssetCodes: [],
      managedAssets: [],
      permissions: {
        managedAsset: { read: false, create: false, update: false, delete: false },
        otherAsset: { read: false, create: false, update: false, delete: false },
      },
    }],
    assetMaster: [{ assetId: 'asset-1', assetCode: 'A-1', assetName: 'one' }],
  };
  const roleOnlyManifest = buildPermissionManifest(roleOnlyFixture, ['health']);
  assert.ok(roleOnlyManifest.effective_decisions.every((row) => row.allowed === false && row.reason !== 'role_bypass'));

  const manifest = buildPermissionManifest(permissionData, extractDirectActions(edgeSource));
  const ethanDelete = manifest.effective_decisions.filter((row) => row.email === 'ethan.lee@igisam.com' && row.action === 'delete');
  assert.equal(ethanDelete.length, 19);
  assert.ok(ethanDelete.every((row) => row.allowed === false && row.reason === 'scope_flag_denied'));
});

test('빈 값 또는 모호한 자산 식별자는 fail closed하며 role 이름으로 우회하지 않는다', () => {
  const fixture = {
    schemaVersion: 'fixture',
    userCount: 1,
    assetCount: 2,
    users: [{
      email: 'admin@example.com',
      logistics_role: 'Admin',
      managedAssetCodes: ['A-1', ''],
      managedAssets: [
        { assetId: 'asset-1', assetCode: 'A-1', assetName: 'same-name' },
        { assetId: '', assetCode: 'A-1', assetName: 'same-name' },
      ],
      permissions: {
        managedAsset: { read: true, create: true, update: true, delete: true },
        otherAsset: { read: false, create: false, update: false, delete: false },
      },
    }],
    assetMaster: [
      { assetId: 'asset-1', assetCode: 'A-1', assetName: 'same-name' },
      { assetId: 'asset-2', assetCode: 'A-2', assetName: 'same-name' },
    ],
  };

  const manifest = buildPermissionManifest(fixture, ['health']);
  const decisions = manifest.effective_decisions.filter((row) => row.asset_id === 'asset-2');

  assert.equal(manifest.ok, false);
  assert.ok(manifest.identity_issues.some((issue) => issue.reason === 'blank_or_ambiguous_managed_asset_identity'));
  assert.equal(decisions.length, 4);
  assert.ok(decisions.every((row) => row.allowed === false));
  assert.ok(decisions.every((row) => row.reason !== 'role_bypass'));
});

test('다중 자산 요청은 하나라도 deny면 atomic하게 전체 거부한다', () => {
  const fixture = {
    schemaVersion: 'fixture',
    userCount: 1,
    assetCount: 2,
    users: [{
      email: 'reader@example.com',
      managedAssetCodes: ['A-1'],
      managedAssets: [{ assetId: 'asset-1', assetCode: 'A-1', assetName: 'one' }],
      permissions: {
        managedAsset: { read: true, create: true, update: true, delete: true },
        otherAsset: { read: false, create: false, update: false, delete: false },
      },
    }],
    assetMaster: [
      { assetId: 'asset-1', assetCode: 'A-1', assetName: 'one' },
      { assetId: 'asset-2', assetCode: 'A-2', assetName: 'two' },
    ],
  };
  const manifest = buildPermissionManifest(fixture, ['health']);
  const request = manifest.evaluate_atomic_request('reader@example.com', ['asset-1', 'asset-2'], 'update');

  assert.equal(request.allowed, false);
  assert.equal(request.atomic, true);
  assert.equal(request.denied_asset_ids[0], 'asset-2');
});

test('Excel parity는 정확한 asset identity를 요구하고 blank 또는 중복 identity를 거부한다', () => {
  const workbook = {
    users: permissionData.users,
    assetMaster: permissionData.assetMaster.map((asset) => ({ ...asset })),
  };
  const matched = validateWorkbookParity(permissionData, workbook);
  assert.equal(matched.ok, true, matched.failures.join('\n'));

  const drifted = validateWorkbookParity(permissionData, {
    ...workbook,
    assetMaster: [...workbook.assetMaster, { assetId: '', assetCode: 'A112127001', assetName: '' }],
  });
  assert.equal(drifted.ok, false);
  assert.ok(drifted.failures.some((failure) => /identity/u.test(failure)));

  const ranged = validateWorkbookSourceRanges(permissionData, {
    users: [['name', 'email'], ...permissionData.users.map((user) => [user.email])],
    assetMaster: [['asset code', 'asset name', 'fund code'], ...permissionData.assetMaster.map((asset) => [asset.assetCode, asset.assetName, asset.fundCode])],
  });
  assert.equal(ranged.ok, true, ranged.failures.join('\n'));
});

test('Excel 입력은 인자, 환경 변수, Desktop fallback 순서이며 CI에서는 not_verified로 분리된다', () => {
  const exists = (filePath) => filePath === 'C:\\fallback.xlsx';
  assert.deepEqual(
    selectExcelInput({ cli_excel: 'C:\\cli.xlsx', env_excel: 'C:\\env.xlsx', fallback_excel: 'C:\\fallback.xlsx' }, exists),
    { evidence_status: 'not_verified', source: 'argument', path: 'C:\\cli.xlsx', reason: 'excel_workbook_not_found' },
  );
  assert.deepEqual(
    selectExcelInput({ env_excel: 'C:\\env.xlsx', fallback_excel: 'C:\\fallback.xlsx' }, exists),
    { evidence_status: 'not_verified', source: 'environment', path: 'C:\\env.xlsx', reason: 'excel_workbook_not_found' },
  );
  assert.deepEqual(
    selectExcelInput({ fallback_excel: 'C:\\fallback.xlsx' }, exists),
    { evidence_status: 'selected', source: 'desktop_fallback', path: 'C:\\fallback.xlsx', reason: null },
  );
  assert.deepEqual(
    selectExcelInput({}, exists),
    { evidence_status: 'not_verified', source: 'none', path: '', reason: 'excel_workbook_not_provided' },
  );
});

test('kylee 전체 권한과 19 관리 자산은 8개 dashboard module을 모두 표시한다', () => {
  const modules = visibleDashboardModules({
    email: 'kylee@igisam.com',
    managed_asset_ids: permissionData.assetMaster.map((asset) => asset.assetId),
    asset_capabilities: { status: 'ready', assets: permissionData.assetMaster.map((asset) => ({ asset_id: asset.assetId })) },
    feature_permissions: { analysis_tools: true, data_playground: true, data_quality: true },
  });

  assert.deepEqual(modules, ['home', 'asset', 'company', 'investment-index', 'asset-spec', 'tools', 'playground', 'quality']);
});

test('asset_capabilities 누락 또는 로딩 중은 권한 거부가 아니므로 dashboard tab 전체를 숨기지 않는다', () => {
  const base = {
    email: 'kylee@igisam.com',
    managed_asset_ids: permissionData.assetMaster.map((asset) => asset.assetId),
    feature_permissions: { analysis_tools: true, data_playground: true, data_quality: true },
  };

  assert.equal(visibleDashboardModules({ ...base, asset_capabilities: undefined }).length, 8);
  assert.equal(visibleDashboardModules({ ...base, asset_capabilities: { status: 'loading' } }).length, 8);
});
