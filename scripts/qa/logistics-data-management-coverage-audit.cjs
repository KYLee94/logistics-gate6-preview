const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const OUT_DIR = path.join(ROOT, 'qa-artifacts', 'logistics-gate6');

function readEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  return Object.fromEntries(fs.readFileSync(filePath, 'utf8')
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#') && line.includes('='))
    .map((line) => {
      const index = line.indexOf('=');
      return [line.slice(0, index).trim(), line.slice(index + 1).trim().replace(/^['"]|['"]$/gu, '')];
    }));
}

const fileEnv = {
  ...readEnvFile(path.join(ROOT, '.env')),
  ...readEnvFile(path.join(ROOT, '.env.local')),
};

function envValue(...keys) {
  for (const key of keys) {
    if (process.env[key]) return process.env[key];
    if (fileEnv[key]) return fileEnv[key];
  }
  return '';
}

function timestampForFile() {
  return new Date().toISOString().replace(/[-:]/gu, '').replace(/\..+$/u, '').replace('T', '-');
}

async function signIn(supabaseUrl, anonKey) {
  const accessToken = envValue('LOGISTICS_SUPABASE_ACCESS_TOKEN');
  if (accessToken) return { token: accessToken, source: 'LOGISTICS_SUPABASE_ACCESS_TOKEN' };
  const email = envValue('LOGISTICS_SUPABASE_EMAIL', 'LOGISTICS_SUPABASE_AUTH_EMAIL');
  const password = envValue('LOGISTICS_SUPABASE_PASSWORD', 'LOGISTICS_SUPABASE_AUTH_PASSWORD');
  if (!email || !password) {
    throw new Error('Set LOGISTICS_SUPABASE_ACCESS_TOKEN, or set LOGISTICS_SUPABASE_EMAIL and LOGISTICS_SUPABASE_PASSWORD.');
  }
  const response = await fetch(`${supabaseUrl.replace(/\/$/u, '')}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: anonKey, 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body.access_token) {
    const message = body.msg || body.message || body.error_description || body.error || 'unknown auth error';
    throw new Error(`Supabase Auth login failed (${response.status}): ${message}`);
  }
  return { token: body.access_token, source: 'password_grant' };
}

async function invoke(supabaseUrl, anonKey, token, action, payload = {}) {
  const response = await fetch(`${supabaseUrl.replace(/\/$/u, '')}/functions/v1/ll-dashboard-api`, {
    method: 'POST',
    headers: {
      apikey: anonKey,
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      origin: 'https://kylee94.github.io',
    },
    body: JSON.stringify({ action, payload }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body?.ok === false) {
    throw new Error(`${action} failed (${response.status}): ${body.message || body.error || 'unknown error'}`);
  }
  return body.data || {};
}

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const stamp = timestampForFile();
  const outJson = path.join(OUT_DIR, `data-management-coverage-audit-${stamp}.json`);
  const latestJson = path.join(OUT_DIR, 'data-management-coverage-audit-latest.json');
  const supabaseUrl = envValue('LOGISTICS_SUPABASE_URL', 'VITE_SUPABASE_URL');
  const anonKey = envValue('LOGISTICS_SUPABASE_ANON_KEY', 'VITE_SUPABASE_ANON_KEY');
  if (!supabaseUrl || !anonKey) {
    throw new Error('Set LOGISTICS_SUPABASE_URL/VITE_SUPABASE_URL and LOGISTICS_SUPABASE_ANON_KEY/VITE_SUPABASE_ANON_KEY.');
  }
  const auth = await signIn(supabaseUrl, anonKey);
  const data = await invoke(supabaseUrl, anonKey, auth.token, 'data-management/coverage', { mode: 'full' });
  const catalogData = await invoke(supabaseUrl, anonKey, auth.token, 'data-management/catalog', { include_counts: true });
  const catalogTables = safeArray(catalogData.tables);
  const catalogDomains = safeArray(catalogData.domains);
  const catalogSpaces = safeArray(catalogData.spaces);
  const catalogBundles = safeArray(catalogData.fund_asset_bundles);
  const catalogRowCounts = safeArray(catalogData.row_counts);
  const sampleTable = catalogTables.find((row) => row.table_key === 'assets') || catalogTables.find((row) => row.space_key === 'igis') || catalogTables[0] || {};
  const sampleRows = sampleTable.table_key
    ? await invoke(supabaseUrl, anonKey, auth.token, 'data-management/rows', { table_key: sampleTable.table_key, page_size: 20 })
    : { rows: [], columns: [] };
  const tableCoverage = safeArray(data.table_coverage);
  const domainCoverage = safeArray(data.domain_coverage);
  const sourceDomainStats = safeArray(data.source_domain_stats);
  const findings = data.findings || {};
  const managementScope = data.management_scope || {};
  const checks = {
    edge_coverage_ok: data.ok === true,
    scope_asset_count_19: managementScope.asset_count === 19,
    scope_fund_count_17: managementScope.fund_count === 17,
    has_table_coverage: tableCoverage.length >= 25,
    has_domain_coverage: domainCoverage.length >= 8,
    no_missing_relations: safeArray(findings.missing_relations).length === 0,
    no_unconnected_tables: safeArray(findings.unconnected_tables).length === 0,
    source_domains_known: safeArray(findings.unknown_source_domains).length === 0,
    core_tables_present: ['ll_assets', 'll_funds', 'll_source_rows'].every((tableName) => (
      tableCoverage.some((row) => row.table_name === tableName && row.exists === true)
    )),
    core_counts_nonzero: ['ll_assets', 'll_funds', 'll_source_rows'].every((tableName) => {
      const row = tableCoverage.find((item) => item.table_name === tableName);
      return Number(row?.row_count || 0) > 0;
    }),
    all_tables_have_user_domain: tableCoverage.every((row) => Boolean(row.ui_domain_label)),
    all_tables_have_write_or_review_mode: tableCoverage.every((row) => Boolean(row.write_mode)),
    source_registry_read: sourceDomainStats.length >= 6,
    catalog_api_ok: catalogTables.length >= tableCoverage.length,
    catalog_has_three_workspaces: ['이지스 Data', '시장 Data', '시스템·운영 Data'].every((label) => catalogSpaces.some((space) => space.label === label)),
    catalog_has_domains: catalogDomains.length >= 8,
    catalog_has_all_ll_tables: catalogTables.length >= 50 && catalogTables.every((row) => row.label && row.table_key),
    catalog_no_internal_labels: catalogTables.every((row) => !/^ll_/u.test(String(row.label || ''))),
    catalog_row_counts_match_coverage: ['ll_assets', 'll_funds', 'll_source_rows'].every((tableName) => {
      const coverageRow = tableCoverage.find((row) => row.table_name === tableName);
      const catalogCount = catalogRowCounts.find((row) => row.table_name === tableName);
      return Number(coverageRow?.row_count || 0) === Number(catalogCount?.row_count || 0);
    }),
    fund_asset_bundle_scope_present: catalogBundles.length >= 19,
    rows_api_ok: Array.isArray(sampleRows.rows) && Array.isArray(sampleRows.columns),
    rows_have_visible_columns: safeArray(sampleRows.columns).length > 0,
    rows_hide_internal_payload_fields: safeArray(sampleRows.columns).every((column) => !/payload|source_row_id|pnu|법정동/iu.test(`${column.field_key || column.field || ''} ${column.label || ''}`)),
  };
  const report = {
    ok: Object.values(checks).every(Boolean),
    generated_at: new Date().toISOString(),
    auth_source: auth.source,
    checks,
    summary: {
      management_scope: managementScope,
      totals: data.totals,
      catalog_coverage: catalogData.coverage,
      catalog_scope: catalogData.management_scope,
      missing_relations: findings.missing_relations || [],
      unconnected_tables: findings.unconnected_tables || [],
    },
    domain_coverage: domainCoverage,
    source_domain_stats: sourceDomainStats,
    table_coverage: tableCoverage,
    catalog: {
      spaces: catalogSpaces,
      domains: catalogDomains,
      table_count: catalogTables.length,
      bundle_count: catalogBundles.length,
      row_counts: catalogRowCounts,
      sample_table: sampleTable,
      sample_rows: {
        table: sampleRows.table,
        column_count: safeArray(sampleRows.columns).length,
        row_count: safeArray(sampleRows.rows).length,
      },
    },
    payload_note: data.payload_note,
  };
  fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(latestJson, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`data management coverage audit ${report.ok ? 'PASS' : 'FAIL'}: ${path.relative(ROOT, outJson)}`);
  if (!report.ok) {
    console.log(JSON.stringify({ checks, summary: report.summary }, null, 2));
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
