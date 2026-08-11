export const DEVELOPMENT_ASSET_CODES = Object.freeze(['A190013001']);

const DEVELOPMENT_REGISTER_FIELDS = new Set([
  'building_area_sqm',
  'primary_use',
  'building_coverage_ratio',
  'floor_area_ratio',
  'structure_text',
  'parking_count',
  'completion_date',
]);

function present(value) {
  return value !== '' && value !== null && value !== undefined;
}

function positiveFinite(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
}

export function resolveHomeAssetOverviewValue(fieldKey, asset = {}, occupancySummary = {}) {
  if (fieldKey === 'leasable_area_sqm') {
    const currentRentRollArea = positiveFinite(occupancySummary.denominator_area_sqm);
    if (currentRentRollArea != null) return { kind: 'value', value: currentRentRollArea };
    if (DEVELOPMENT_ASSET_CODES.includes(asset.asset_code)) return { kind: 'status', text: '개발 중' };
    return { kind: 'status', text: '임대차 미등록' };
  }

  const value = asset[fieldKey];
  if (present(value)) return { kind: 'value', value };
  if (fieldKey === 'zoning_text') return { kind: 'status', text: '토지이용계획 별도 확인' };
  if (DEVELOPMENT_ASSET_CODES.includes(asset.asset_code) && DEVELOPMENT_REGISTER_FIELDS.has(fieldKey)) {
    return { kind: 'status', text: '개발 중' };
  }
  if (DEVELOPMENT_REGISTER_FIELDS.has(fieldKey)) return { kind: 'status', text: '건축물대장 미기재' };
  return { kind: 'status', text: '자료 확인 필요' };
}
