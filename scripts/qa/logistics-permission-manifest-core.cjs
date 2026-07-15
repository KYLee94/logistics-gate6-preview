const CRUD_ACTIONS = ['read', 'create', 'update', 'delete'];
const DASHBOARD_MODULES = ['home', 'asset', 'company', 'investment-index', 'asset-spec', 'tools', 'playground', 'quality'];

// The classifier is deliberately prefix and verb based so every dispatch action is reviewed.
const ACTION_CLASSIFICATIONS = Object.freeze({
  profile_read: 'profile-only authenticated read',
  read: 'authenticated read',
  write_or_side_effect: 'permissioned mutation or external side effect',
  controlled_special: 'explicitly reviewed non-standard action',
});

function text(value) {
  return String(value || '').trim();
}

function normalized(value) {
  return text(value).toLowerCase();
}

function distinct(values) {
  return [...new Set(values.filter(Boolean))];
}

function classifyAction(action) {
  const value = text(action);
  if (!value) return null;
  if (['health', 'snapshot-refresh', 'cache-clear', 'worklogs'].includes(value)) return 'controlled_special';
  if (!value.includes('/')) return null;
  if (['auth/me', 'auth/users/list', 'auth/login-history/list', 'auth/login-capability/list', 'permissions/evaluate'].includes(value)) return 'profile_read';
  if (/\/(list|read|get|status|preview|preview-edit|search|catalog|coverage|rows|view-rows|views|findings|latest|latest-preview|readback|maps-config|read-by-asset)$/u.test(value)) return 'read';
  if (/\/(setup|reset|access-code|upsert|upsert-current|update|record|apply|submit|submit-edit|approve|reject|dismiss|mark-read|backfill|address-backfill|cleanup-empty-loans|save|save-by-asset|save-asset-detail|replace-latest|restore-20260617|delete|complete|comment|comment-delete|register|upload|ingest|embed|refresh|cache-upsert|collect-run|archive-seed)$/u.test(value)) return 'write_or_side_effect';
  if (['ai/search-chat-demo', 'ai/provider-diagnostics', 'ai/gemini-diagnostics', 'auth/logistics-status', 'work-platform/tasks', 'work-platform/board-posts', 'opendart/company', 'building-register/summary', 'naver/geocode', 'naver/geocode-batch', 'naver/reverse-geocode', 'dashboard/read', 'ai/search-chat', 'asset-admin/gyeongsan-coupang-floor-count-preview', 'weekly-projects/get-asset-detail'].includes(value)) return 'controlled_special';
  return null;
}

function extractDirectActions(source) {
  return distinct([...String(source || '').matchAll(/action\s*===\s*'([^']+)'/gu)].map((match) => match[1])).sort();
}

function assetIndex(assetMaster) {
  const index = new Map();
  for (const asset of assetMaster || []) {
    for (const value of [asset?.assetId, asset?.asset_id, asset?.assetCode, asset?.asset_code, asset?.assetName, asset?.asset_name]) {
      const key = normalized(value);
      if (!key) continue;
      const rows = index.get(key) || [];
      rows.push(asset);
      index.set(key, rows);
    }
  }
  return index;
}

function canonicalAssetId(asset) {
  return text(asset?.assetId || asset?.asset_id);
}

function resolveManagedAsset(asset, index) {
  const identifiers = distinct([
    normalized(asset?.assetId || asset?.asset_id),
    normalized(asset?.assetCode || asset?.asset_code),
    normalized(asset?.assetName || asset?.asset_name),
  ]);
  if (!identifiers.length) return { ok: false, reason: 'blank_or_ambiguous_managed_asset_identity' };
  const candidates = distinct(identifiers.flatMap((key) => (index.get(key) || []).map(canonicalAssetId)));
  if (candidates.length !== 1) return { ok: false, reason: 'blank_or_ambiguous_managed_asset_identity' };
  return { ok: true, asset_id: candidates[0] };
}

function permissionsFor(user, scope) {
  const value = user?.permissions?.[scope] || {};
  return Object.fromEntries(CRUD_ACTIONS.map((action) => [action, value[action] === true]));
}

function normalizedUserEmail(user) {
  return normalized(user?.email);
}

function buildPermissionManifest(data, actions) {
  const users = Array.isArray(data?.users) ? data.users : [];
  const assets = Array.isArray(data?.assetMaster) ? data.assetMaster : [];
  const index = assetIndex(assets);
  const sourceFlags = [];
  const decisions = [];
  const identityIssues = [];
  const userAssetIds = new Map();

  users.forEach((user, userIndex) => {
    const email = normalizedUserEmail(user);
    const managedIds = new Set();
    if (!email) identityIssues.push({ user_index: userIndex, reason: 'blank_user_email' });
    const sourceAssets = Array.isArray(user?.managedAssets) ? user.managedAssets : [];
    sourceAssets.forEach((asset, assetIndexValue) => {
      const resolved = resolveManagedAsset(asset, index);
      if (!resolved.ok) identityIssues.push({ email, asset_index: assetIndexValue, reason: resolved.reason });
      else managedIds.add(resolved.asset_id);
    });
    const sourceCodes = Array.isArray(user?.managedAssetCodes) ? user.managedAssetCodes : [];
    sourceCodes.forEach((code, codeIndex) => {
      const value = normalized(code);
      const matches = distinct((index.get(value) || []).map(canonicalAssetId));
      if (matches.length !== 1) identityIssues.push({ email, asset_code_index: codeIndex, reason: 'blank_or_ambiguous_managed_asset_identity' });
      else managedIds.add(matches[0]);
    });
    userAssetIds.set(email, managedIds);

    for (const scope of ['managedAsset', 'otherAsset']) {
      const flags = permissionsFor(user, scope);
      for (const action of CRUD_ACTIONS) {
        sourceFlags.push({ email, scope, action, allowed: flags[action] });
      }
    }
    assets.forEach((asset) => {
      const assetId = canonicalAssetId(asset);
      const managed = managedIds.has(assetId);
      const flags = permissionsFor(user, managed ? 'managedAsset' : 'otherAsset');
      CRUD_ACTIONS.forEach((action) => {
        decisions.push({
          email,
          asset_id: assetId,
          action,
          allowed: Boolean(email && assetId && flags[action]),
          scope: managed ? 'managed' : 'other',
          reason: email && assetId ? (flags[action] ? 'exact_scope_flag' : 'scope_flag_denied') : 'blank_or_ambiguous_identity',
        });
      });
    });
  });

  const actionRows = distinct(actions || []).sort().map((action) => ({ action, classification: classifyAction(action) }));
  const actionIssues = actionRows.filter((row) => !row.classification).map((row) => ({ action: row.action, reason: 'unclassified_direct_action' }));
  const failures = [];
  if (Number(data?.userCount) !== users.length) failures.push('source userCount does not match users');
  if (Number(data?.assetCount) !== assets.length) failures.push('source assetCount does not match assetMaster');
  if (data?.schemaVersion === 'logistics_permission_v1' && users.length !== 38) failures.push('expected 38 source users');
  if (data?.schemaVersion === 'logistics_permission_v1' && assets.length !== 19) failures.push('expected 19 source assets');
  if (data?.schemaVersion === 'logistics_permission_v1' && actionRows.length === 0) failures.push('no direct dispatcher actions found');
  if (identityIssues.length) failures.push('asset identity contains blank or ambiguous values');
  if (actionIssues.length) failures.push('one or more direct actions are unclassified');

  function evaluateAtomicRequest(email, assetIds, action) {
    const normalizedEmail = normalized(email);
    const requested = distinct((assetIds || []).map(text));
    const applicable = decisions.filter((row) => row.email === normalizedEmail && row.action === action && requested.includes(row.asset_id));
    const denied = requested.filter((assetId) => !applicable.some((row) => row.asset_id === assetId && row.allowed));
    return { allowed: requested.length > 0 && denied.length === 0, atomic: true, denied_asset_ids: denied };
  }

  return {
    ok: failures.length === 0,
    counts: {
      source_users: users.length,
      source_assets: assets.length,
      source_flags: sourceFlags.length,
      effective_decisions: decisions.length,
      action_classifications: actionRows.length,
    },
    source_flags: sourceFlags,
    effective_decisions: decisions,
    action_classifications: actionRows,
    identity_issues: identityIssues,
    action_issues: actionIssues,
    failures,
    evaluate_atomic_request: evaluateAtomicRequest,
  };
}

function identities(rows) {
  const seen = new Set();
  const issues = [];
  (rows || []).forEach((row, index) => {
    const assetId = canonicalAssetId(row);
    const assetCode = text(row?.assetCode || row?.asset_code);
    if (!assetId || !assetCode || seen.has(assetId) || seen.has(assetCode)) issues.push({ index, reason: 'blank_or_duplicate_asset_identity' });
    seen.add(assetId);
    seen.add(assetCode);
  });
  return issues;
}

function validateWorkbookParity(permissionData, workbook) {
  const failures = [];
  const sourceAssets = permissionData?.assetMaster || [];
  const workbookAssets = workbook?.assetMaster || [];
  const sourceUsers = permissionData?.users || [];
  const workbookUsers = workbook?.users || [];
  if (identities(sourceAssets).length || identities(workbookAssets).length) failures.push('asset identity is blank or duplicate');
  const sourceAssetIds = sourceAssets.map(canonicalAssetId).sort();
  const workbookAssetIds = workbookAssets.map(canonicalAssetId).sort();
  const sourceEmails = sourceUsers.map(normalizedUserEmail).sort();
  const workbookEmails = workbookUsers.map(normalizedUserEmail).sort();
  if (JSON.stringify(sourceAssetIds) !== JSON.stringify(workbookAssetIds)) failures.push('asset identity parity mismatch');
  if (JSON.stringify(sourceEmails) !== JSON.stringify(workbookEmails)) failures.push('user identity parity mismatch');
  return { ok: failures.length === 0, failures, counts: { source_assets: sourceAssetIds.length, workbook_assets: workbookAssetIds.length, source_users: sourceEmails.length, workbook_users: workbookEmails.length } };
}

function validateWorkbookSourceRanges(permissionData, workbookRows) {
  const failures = [];
  const sourceUsers = permissionData?.users || [];
  const sourceAssets = permissionData?.assetMaster || [];
  const userRows = (workbookRows?.users || []).filter((row) => row.some((value) => normalized(value).includes('@')));
  const assetRows = (workbookRows?.assetMaster || []).filter((row) => row.some((value) => /^[a-z]+\d+$/iu.test(text(value))));
  const userCells = userRows.map((row) => row.map(normalized));
  const assetCells = assetRows.map((row) => row.map(normalized));
  const expectedEmails = sourceUsers.map(normalizedUserEmail);
  const missingEmails = expectedEmails.filter((email) => userCells.filter((row) => row.includes(email)).length !== 1);
  const expectedAssets = sourceAssets.map((asset) => [normalized(asset.assetCode), normalized(asset.assetName), normalized(asset.fundCode)]);
  const missingAssets = expectedAssets.filter((identity) => assetCells.filter((row) => identity.every((value) => value && row.includes(value))).length !== 1);
  if (userRows.length !== sourceUsers.length) failures.push('workbook user range count mismatch');
  if (assetRows.length !== sourceAssets.length) failures.push('workbook asset range count mismatch');
  if (missingEmails.length) failures.push('workbook user identity parity mismatch');
  if (missingAssets.length) failures.push('workbook asset identity parity mismatch');
  return { ok: failures.length === 0, failures, missing_emails: missingEmails, missing_asset_identities: missingAssets, counts: { source_users: sourceUsers.length, workbook_users: userRows.length, source_assets: sourceAssets.length, workbook_assets: assetRows.length } };
}

function selectExcelInput({ cli_excel: cliExcel = '', env_excel: envExcel = '', fallback_excel: fallbackExcel = '' }, exists = () => false) {
  const candidates = [
    ['argument', text(cliExcel)],
    ['environment', text(envExcel)],
    ['desktop_fallback', text(fallbackExcel)],
  ];
  const requested = candidates.find(([, value]) => value);
  if (!requested) return { evidence_status: 'not_verified', source: 'none', path: '', reason: 'excel_workbook_not_provided' };
  const [source, filePath] = requested;
  if (!exists(filePath)) return { evidence_status: 'not_verified', source, path: filePath, reason: 'excel_workbook_not_found' };
  return { evidence_status: 'selected', source, path: filePath, reason: null };
}

function visibleDashboardModules(profile = {}) {
  const features = profile.feature_permissions || {};
  return DASHBOARD_MODULES.filter((moduleId) => {
    if (moduleId === 'tools') return features.analysis_tools === true;
    if (moduleId === 'playground') return features.data_playground === true;
    if (moduleId === 'quality') return features.data_quality === true;
    return true;
  });
}

module.exports = {
  ACTION_CLASSIFICATIONS,
  CRUD_ACTIONS,
  buildPermissionManifest,
  classifyAction,
  extractDirectActions,
  selectExcelInput,
  validateWorkbookParity,
  validateWorkbookSourceRanges,
  visibleDashboardModules,
};
