export const EXCLUDED_LOGISTICS_ASSET_CODES = Object.freeze([
  'A112127001',
  'AP00014001',
]);

const EXCLUDED_ASSET_CODE_SET = new Set(EXCLUDED_LOGISTICS_ASSET_CODES);

function normalizedLogisticsAssetCode(asset = {}) {
  const rawCode = asset.asset_code
    || asset.assetCode
    || asset.asset_id
    || asset.assetId
    || '';
  return String(rawCode).trim().replace(/^asset_/iu, '').toUpperCase();
}

export function isExcludedLogisticsAsset(asset) {
  return EXCLUDED_ASSET_CODE_SET.has(normalizedLogisticsAssetCode(asset));
}

export function filterIncludedLogisticsAssets(assets = []) {
  return (Array.isArray(assets) ? assets : []).filter(
    (asset) => !isExcludedLogisticsAsset(asset),
  );
}
