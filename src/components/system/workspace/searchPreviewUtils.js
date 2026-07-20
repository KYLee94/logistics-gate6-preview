function firstValue(...values) {
  return values.find((value) => value !== undefined && value !== null && value !== '');
}

function finiteNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function sumRows(rows, key) {
  return (rows || []).reduce((sum, row) => sum + Number(row?.[key] || 0), 0);
}

function assetIdentity(row) {
  return String(firstValue(row?.assetId, row?.assetCode, row?.assetName, '') || '').trim();
}

function zoneLabel(row) {
  const floors = Array.isArray(row?.floorLabels) ? row.floorLabels.join(', ') : row?.floorLabel;
  const details = Array.isArray(row?.detailAreaLabels) ? row.detailAreaLabels.join(', ') : row?.detailAreaLabel;
  return [floors, details].filter(Boolean).join(' / ') || '-';
}

export function deriveCompanySearchPreviewMetrics({ summary = {}, profile = {}, rows = [], financials = {} } = {}) {
  const uniqueAssets = new Set((rows || []).map(assetIdentity).filter(Boolean)).size;
  const openDart = financials?.openDart || {};
  return {
    assetCount: finiteNumber(firstValue(summary.asset_count, profile.assetCount, uniqueAssets)) ?? 0,
    leasedAreaSqm: finiteNumber(firstValue(summary.leased_area_sqm, profile.leasedAreaSqm, sumRows(rows, 'leasedAreaSqm'))) ?? 0,
    monthlyRentTotal: finiteNumber(firstValue(summary.current_monthly_rent_total, profile.monthlyRentTotal, sumRows(rows, 'monthlyRentTotal'))) ?? 0,
    monthlyMfTotal: finiteNumber(firstValue(summary.current_monthly_mf_total, profile.monthlyMfTotal, sumRows(rows, 'monthlyMfTotal'))) ?? 0,
    monthlyCostTotal: finiteNumber(firstValue(summary.current_monthly_cost_total, profile.monthlyCostTotal, sumRows(rows, 'monthlyCostTotal'))) ?? 0,
    dartLinked: financials.dartLinked === true || Boolean(firstValue(openDart.corp_code, openDart.corpCode, openDart.corp_name, openDart.corpName)),
  };
}

export function sortCompanySearchPreviewRows(rows = []) {
  return [...rows].sort((left, right) => {
    const assetOrder = String(left?.assetName || '').localeCompare(String(right?.assetName || ''), 'ko-KR', {
      numeric: true,
      sensitivity: 'base',
    });
    if (assetOrder !== 0) return assetOrder;
    return zoneLabel(right).localeCompare(zoneLabel(left), 'ko-KR', {
      numeric: true,
      sensitivity: 'base',
    });
  });
}
