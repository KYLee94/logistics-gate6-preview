export const LOGISTICS_INTERNAL_BASE = 'platform/iotaseoul/workspace/logistics';
export const LOGISTICS_DEPLOY_BASE = 'logistics-gate6-preview';

export const LOGISTICS_ROUTE_BY_KEY = {
  'work-platform': LOGISTICS_INTERNAL_BASE,
  'work-platform/archive': `${LOGISTICS_INTERNAL_BASE}/archive`,
  home: `${LOGISTICS_INTERNAL_BASE}/dashboard/home`,
  asset: `${LOGISTICS_INTERNAL_BASE}/dashboard/asset`,
  company: `${LOGISTICS_INTERNAL_BASE}/dashboard/company`,
  'investment-index': `${LOGISTICS_INTERNAL_BASE}/dashboard/investment-index`,
  'asset-spec': `${LOGISTICS_INTERNAL_BASE}/dashboard/asset-spec`,
  'analysis-tools': `${LOGISTICS_INTERNAL_BASE}/dashboard/tools`,
  'data-playground': `${LOGISTICS_INTERNAL_BASE}/dashboard/playground`,
  'pivot-table': `${LOGISTICS_INTERNAL_BASE}/dashboard/playground`,
  'data-quality': `${LOGISTICS_INTERNAL_BASE}/data-management/data-quality`,
  'market-data': `${LOGISTICS_INTERNAL_BASE}/market-data/overview`,
  'market-data/overview': `${LOGISTICS_INTERNAL_BASE}/market-data/overview`,
  'market-data/lease-market': `${LOGISTICS_INTERNAL_BASE}/market-data/lease-market`,
  'market-data/supply-pipeline': `${LOGISTICS_INTERNAL_BASE}/market-data/supply-pipeline`,
  'market-data/transactions': `${LOGISTICS_INTERNAL_BASE}/market-data/transactions`,
  'market-data/source-update': `${LOGISTICS_INTERNAL_BASE}/market-data/source-update`,
  'data-management': `${LOGISTICS_INTERNAL_BASE}/data-management/lease-contracts`,
  'data-management/asset-data': `${LOGISTICS_INTERNAL_BASE}/data-management/asset-data`,
  'data-management/investment-data': `${LOGISTICS_INTERNAL_BASE}/data-management/investment-data`,
  'data-management/lease-contracts': `${LOGISTICS_INTERNAL_BASE}/data-management/lease-contracts`,
  'data-management/managers': `${LOGISTICS_INTERNAL_BASE}/data-management/managers`,
  'data-management/data-quality': `${LOGISTICS_INTERNAL_BASE}/data-management/data-quality`,
  'data-management/approval': `${LOGISTICS_INTERNAL_BASE}/data-management/approval`,
  'data-management/market-data': `${LOGISTICS_INTERNAL_BASE}/market-data/source-update`,
  'contract-data': `${LOGISTICS_INTERNAL_BASE}/contract-data`,
  'pdf-report': `${LOGISTICS_INTERNAL_BASE}/pdf-report`,
};

export const LOGISTICS_ROUTE_KEY_BY_INTERNAL = Object.fromEntries(
  Object.entries(LOGISTICS_ROUTE_BY_KEY).map(([key, value]) => [value, key]),
);
LOGISTICS_ROUTE_KEY_BY_INTERNAL[LOGISTICS_ROUTE_BY_KEY['market-data/source-update']] = 'market-data/source-update';

export function normalizeLogisticsPath(path = '') {
  let clean = String(path || '').replace(/^\/+|\/+$/g, '');
  if (clean === LOGISTICS_DEPLOY_BASE) return LOGISTICS_INTERNAL_BASE;
  if (clean.startsWith(`${LOGISTICS_DEPLOY_BASE}/`)) {
    clean = clean.slice(LOGISTICS_DEPLOY_BASE.length + 1);
  }
  if (!clean) return LOGISTICS_INTERNAL_BASE;
  if (LOGISTICS_ROUTE_BY_KEY[clean]) return LOGISTICS_ROUTE_BY_KEY[clean];
  if (clean === 'logistics-gate6-preview') return LOGISTICS_INTERNAL_BASE;
  if (clean.startsWith(`${LOGISTICS_INTERNAL_BASE}/dashboard/weekly`)) return LOGISTICS_ROUTE_BY_KEY.home;
  if (clean.startsWith(`${LOGISTICS_INTERNAL_BASE}/dashboard/contracts`)) return LOGISTICS_ROUTE_BY_KEY['contract-data'];
  if (clean.startsWith(`${LOGISTICS_INTERNAL_BASE}/dashboard/data-playground`)) return LOGISTICS_ROUTE_BY_KEY['data-playground'];
  if (clean.startsWith(`${LOGISTICS_INTERNAL_BASE}/dashboard/pivot-table`)) return LOGISTICS_ROUTE_BY_KEY['pivot-table'];
  if (clean.startsWith(`${LOGISTICS_INTERNAL_BASE}/dashboard/quality`)) return LOGISTICS_ROUTE_BY_KEY['data-quality'];
  if (clean.startsWith(`${LOGISTICS_INTERNAL_BASE}/contract-data`)) return LOGISTICS_ROUTE_BY_KEY['contract-data'];
  if (clean === `${LOGISTICS_INTERNAL_BASE}/market-data`) return LOGISTICS_ROUTE_BY_KEY['market-data'];
  if (clean === `${LOGISTICS_INTERNAL_BASE}/data-management`) return LOGISTICS_ROUTE_BY_KEY['data-management'];
  if (clean.startsWith(LOGISTICS_INTERNAL_BASE)) return clean;
  return clean;
}

export function publicLogisticsPath(path = '') {
  const normalized = normalizeLogisticsPath(path);
  if (LOGISTICS_ROUTE_KEY_BY_INTERNAL[normalized]) return LOGISTICS_ROUTE_KEY_BY_INTERNAL[normalized];
  if (normalized.startsWith(`${LOGISTICS_INTERNAL_BASE}/dashboard/`)) {
    const moduleName = normalized.split('/').at(-1);
      const alias = {
        tools: 'analysis-tools',
        playground: 'pivot-table',
        quality: 'data-quality',
        'investment-index': 'investment-index',
        'asset-spec': 'asset-spec',
        contracts: 'contract-data',
        weekly: 'home',
        sector: 'home',
    }[moduleName] || moduleName;
    return alias || 'home';
  }
  if (normalized.startsWith(`${LOGISTICS_INTERNAL_BASE}/market-data/`)) {
    const moduleName = normalized.split('/').at(-1);
    return `market-data/${moduleName || 'overview'}`;
  }
  if (normalized.startsWith(`${LOGISTICS_INTERNAL_BASE}/data-management/`)) {
    const moduleName = normalized.split('/').at(-1);
    return `data-management/${moduleName || 'lease-contracts'}`;
  }
  if (normalized === LOGISTICS_INTERNAL_BASE) return 'work-platform';
  if (normalized === `${LOGISTICS_INTERNAL_BASE}/archive`) return 'work-platform/archive';
  return normalized;
}

export function pathForLogisticsUrl(baseUrl, path = '') {
  const base = String(baseUrl || '/').endsWith('/') ? String(baseUrl || '/') : `${baseUrl}/`;
  return `${base}${publicLogisticsPath(path)}`;
}
