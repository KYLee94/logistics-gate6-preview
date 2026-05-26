export const LOGISTICS_INTERNAL_BASE = 'platform/iotaseoul/workspace/logistics';

export const LOGISTICS_ROUTE_BY_KEY = {
  'work-platform': LOGISTICS_INTERNAL_BASE,
  home: `${LOGISTICS_INTERNAL_BASE}/dashboard/home`,
  asset: `${LOGISTICS_INTERNAL_BASE}/dashboard/asset`,
  company: `${LOGISTICS_INTERNAL_BASE}/dashboard/company`,
  'analysis-tools': `${LOGISTICS_INTERNAL_BASE}/dashboard/tools`,
  'data-playground': `${LOGISTICS_INTERNAL_BASE}/dashboard/playground`,
  'pivot-table': `${LOGISTICS_INTERNAL_BASE}/dashboard/playground`,
  'data-quality': `${LOGISTICS_INTERNAL_BASE}/dashboard/quality`,
  'contract-data': `${LOGISTICS_INTERNAL_BASE}/dashboard/contracts`,
  'pdf-report': `${LOGISTICS_INTERNAL_BASE}/pdf-report`,
};

export const LOGISTICS_ROUTE_KEY_BY_INTERNAL = Object.fromEntries(
  Object.entries(LOGISTICS_ROUTE_BY_KEY).map(([key, value]) => [value, key]),
);

export function normalizeLogisticsPath(path = '') {
  const clean = String(path || '').replace(/^\/+|\/+$/g, '');
  if (!clean) return LOGISTICS_INTERNAL_BASE;
  if (LOGISTICS_ROUTE_BY_KEY[clean]) return LOGISTICS_ROUTE_BY_KEY[clean];
  if (clean === 'logistics-gate6-preview') return LOGISTICS_INTERNAL_BASE;
  if (clean.startsWith(`${LOGISTICS_INTERNAL_BASE}/dashboard/weekly`)) return LOGISTICS_ROUTE_BY_KEY.home;
  if (clean.startsWith(`${LOGISTICS_INTERNAL_BASE}/dashboard/data-playground`)) return LOGISTICS_ROUTE_BY_KEY['data-playground'];
  if (clean.startsWith(`${LOGISTICS_INTERNAL_BASE}/dashboard/pivot-table`)) return LOGISTICS_ROUTE_BY_KEY['pivot-table'];
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
        contracts: 'contract-data',
        weekly: 'home',
        sector: 'home',
    }[moduleName] || moduleName;
    return alias || 'home';
  }
  if (normalized === LOGISTICS_INTERNAL_BASE) return 'work-platform';
  return normalized;
}

export function pathForLogisticsUrl(baseUrl, path = '') {
  const base = String(baseUrl || '/').endsWith('/') ? String(baseUrl || '/') : `${baseUrl}/`;
  return `${base}${publicLogisticsPath(path)}`;
}
