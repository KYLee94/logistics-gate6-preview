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
  'data-quality': `${LOGISTICS_INTERNAL_BASE}/dashboard/quality`,
  'market-data': `${LOGISTICS_INTERNAL_BASE}/market-data/overview`,
  'market-data/overview': `${LOGISTICS_INTERNAL_BASE}/market-data/overview`,
  'market-data/lease-market': `${LOGISTICS_INTERNAL_BASE}/market-data/lease-market`,
  'market-data/supply-pipeline': `${LOGISTICS_INTERNAL_BASE}/market-data/supply-pipeline`,
  'market-data/transactions': `${LOGISTICS_INTERNAL_BASE}/market-data/transactions`,
  'market-data/source-update': `${LOGISTICS_INTERNAL_BASE}/market-data/source-update`,
  'data-management': `${LOGISTICS_INTERNAL_BASE}/data-management`,
  'contract-data': `${LOGISTICS_INTERNAL_BASE}/contract-data`,
  'pdf-report': `${LOGISTICS_INTERNAL_BASE}/pdf-report`,
};

export const LOGISTICS_ROUTE_KEY_BY_INTERNAL = Object.fromEntries(
  Object.entries(LOGISTICS_ROUTE_BY_KEY).map(([key, value]) => [value, key]),
);

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
  if (clean.startsWith(`${LOGISTICS_INTERNAL_BASE}/contract-data`)) return LOGISTICS_ROUTE_BY_KEY['contract-data'];
  if (clean === `${LOGISTICS_INTERNAL_BASE}/market-data`) return LOGISTICS_ROUTE_BY_KEY['market-data'];
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
  if (normalized === LOGISTICS_INTERNAL_BASE) return 'work-platform';
  if (normalized === `${LOGISTICS_INTERNAL_BASE}/archive`) return 'work-platform/archive';
  return normalized;
}

export function pathForLogisticsUrl(baseUrl, path = '') {
  const base = String(baseUrl || '/').endsWith('/') ? String(baseUrl || '/') : `${baseUrl}/`;
  return `${base}${publicLogisticsPath(path)}`;
}
