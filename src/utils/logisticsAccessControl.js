const FEATURE_ACCESS_ADMIN_EMAILS = new Set([
  'kylee@igisam.com',
  'jk.jeon@igisam.com',
  'sjlee@igisam.com',
]);

const RESTRICTED_QUICK_TAB_ACCESS = {
  tools: { feature: 'analysis_tools' },
  playground: { feature: 'data_playground' },
  'dm-quality': { feature: 'data_quality' },
  'dm-approval': { featureAccessManager: true },
  'source-update': { featureAccessManager: true },
};

const RESTRICTED_ROUTE_ACCESS = [
  { suffix: '/dashboard/tools', feature: 'analysis_tools', fallback: '/dashboard/home' },
  { suffix: '/dashboard/playground', feature: 'data_playground', fallback: '/dashboard/home' },
  { suffix: '/data-management/data-quality', feature: 'data_quality', fallback: '/data-management/lease-contracts' },
  { suffix: '/data-management/approval', featureAccessManager: true, fallback: '/data-management/lease-contracts' },
  { suffix: '/market-data/source-update', featureAccessManager: true, fallback: '/market-data/overview' },
];

const normalize = (value) => String(value || '').trim().toLowerCase();
const normalizeAssetRef = (value) => normalize(value).replace(/\s+/gu, '');

export function actualFeaturePermissions(memberInfo) {
  const permissions = memberInfo?.logistics_permission?.feature_permissions;
  return permissions && typeof permissions === 'object' && !Array.isArray(permissions) ? permissions : {};
}

export function hasActualFeatureGrant(memberInfo, featureKey) {
  return actualFeaturePermissions(memberInfo)[featureKey] === true;
}

export function isFeatureAccessManager(memberInfo) {
  const email = normalize(memberInfo?.permission_email || memberInfo?.logistics_permission?.email || memberInfo?.email);
  return FEATURE_ACCESS_ADMIN_EMAILS.has(email);
}

function hasRestrictedAccess(memberInfo, rule) {
  return rule?.featureAccessManager === true
    ? isFeatureAccessManager(memberInfo)
    : hasActualFeatureGrant(memberInfo, rule?.feature);
}

export function safeLogisticsRoute(path, memberInfo) {
  const normalizedPath = String(path || '');
  const rule = RESTRICTED_ROUTE_ACCESS.find((item) => (
    normalizedPath === item.suffix || normalizedPath.endsWith(item.suffix)
  ));
  if (!rule || hasRestrictedAccess(memberInfo, rule)) return normalizedPath;
  return `${normalizedPath.slice(0, normalizedPath.length - rule.suffix.length)}${rule.fallback}`;
}

export function filterQuickTabKeys(keys, memberInfo) {
  return (Array.isArray(keys) ? keys : []).filter((key) => {
    const rule = RESTRICTED_QUICK_TAB_ACCESS[String(key || '').trim()];
    return !rule || hasRestrictedAccess(memberInfo, rule);
  });
}

function permissionGroups(permission) {
  return {
    managed: permission?.permissions?.managedAsset || {},
    other: permission?.permissions?.otherAsset || {},
  };
}

function assetMatches(scope, assetId, assetName) {
  const id = normalizeAssetRef(assetId);
  const name = normalizeAssetRef(assetName);
  const candidates = [scope?.assetId, scope?.assetCode, scope?.assetName, scope?.asset_id, scope?.asset_code, scope?.asset_name]
    .map(normalizeAssetRef)
    .filter(Boolean);
  return Boolean((id && candidates.includes(id)) || (name && candidates.includes(name)));
}

function scopedAsset(permission, assetId, assetName) {
  return (permission?.managedAssets || []).find((asset) => assetMatches(asset, assetId, assetName)) || null;
}

function explicitAssetPermissions(permission, asset) {
  if (!asset) return null;
  const rowPermissions = asset.permissions || asset.asset_permissions || asset.assetPermissions;
  if (rowPermissions && typeof rowPermissions === 'object' && !Array.isArray(rowPermissions)) return rowPermissions;

  const maps = [
    permission?.asset_permissions,
    permission?.assetPermissions,
    permission?.permissions?.asset_permissions,
    permission?.permissions?.assetPermissions,
  ];
  const keys = [asset.assetId, asset.assetCode, asset.assetName, asset.asset_id, asset.asset_code, asset.asset_name]
    .map(normalizeAssetRef)
    .filter(Boolean);
  for (const map of maps) {
    if (!map || typeof map !== 'object' || Array.isArray(map)) continue;
    const matchingKey = Object.keys(map).find((key) => keys.includes(normalizeAssetRef(key)));
    const value = matchingKey ? map[matchingKey] : null;
    if (value && typeof value === 'object' && !Array.isArray(value)) return value;
  }
  return null;
}

function canonicalScopeRows(permission) {
  const candidates = [
    permission?.scope_permissions,
    permission?.scopePermissions,
    permission?.permission_scopes,
    permission?.permissionScopes,
    permission?.scopes,
    permission?.asset_scopes,
    permission?.assetScopes,
  ];
  return candidates.find((rows) => Array.isArray(rows) && rows.length) || [];
}

function scopeAllowsAction(scope, action) {
  if (!scope) return false;
  if (action === 'read') return scope.can_read === true;
  if (action === 'delete') return scope.can_delete === true;
  return scope.can_write === true;
}

export function canAssetAction(permission, action, assetId, assetName) {
  const scopes = canonicalScopeRows(permission);
  if (scopes.length) {
    const normalizedAssetId = normalize(String(assetId || ''));
    const assetScope = scopes.find((scope) => (
      scope?.scope_type === 'asset'
      && normalizedAssetId
      && normalize(scope.scope_id) === normalizedAssetId
    ));
    if (assetScope) return scopeAllowsAction(assetScope, action);
    const otherScope = scopes.find((scope) => scope?.scope_type === 'other_assets');
    return scopeAllowsAction(otherScope, action);
  }

  const asset = scopedAsset(permission, assetId, assetName);
  const explicit = explicitAssetPermissions(permission, asset);
  if (explicit) {
    if (Object.prototype.hasOwnProperty.call(explicit, 'can_read')
      || Object.prototype.hasOwnProperty.call(explicit, 'can_write')
      || Object.prototype.hasOwnProperty.call(explicit, 'can_delete')) {
      return scopeAllowsAction(explicit, action);
    }
    return explicit[action] === true;
  }

  const groups = permissionGroups(permission);
  if (asset) return groups.managed[action] === true;
  return groups.other[action] === true;
}

export function canReadAsset(permission, assetId, assetName) {
  return canAssetAction(permission, 'read', assetId, assetName);
}

function taskAsset(task) {
  return {
    id: task?.assetId || task?.relatedAssetId || task?.related_asset_id || '',
    name: task?.assetName || task?.relatedAsset || task?.related_asset || '',
  };
}

function isTaskOwnerOrManager(permission, task) {
  const role = String(permission?.role || permission?.logisticsRole || '');
  if (['Manager', 'Admin', 'System Admin'].includes(role)) return true;
  const email = normalize(permission?.email);
  const name = String(permission?.name || '').trim();
  return Boolean((email && email === normalize(task?.createdByEmail)) || (name && name === String(task?.createdByName || '').trim()));
}

export function canTaskAction(permission, task, action) {
  const requiredAction = action === 'reorder' ? 'update' : action;
  const asset = taskAsset(task);
  if (!canAssetAction(permission, requiredAction, asset.id, asset.name)) return false;
  return requiredAction === 'create' || isTaskOwnerOrManager(permission, task);
}
