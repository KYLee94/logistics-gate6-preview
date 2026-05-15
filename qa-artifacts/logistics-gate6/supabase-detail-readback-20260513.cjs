const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const root = process.cwd();
const outDir = path.join(root, 'qa-artifacts/logistics-gate6/supabase-detail-readback-20260513');
fs.mkdirSync(outDir, { recursive: true });

function readEnv() {
  const envPath = path.join(root, '.env');
  const env = {};
  if (!fs.existsSync(envPath)) return env;
  fs.readFileSync(envPath, 'utf8').split(/\r?\n/u).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const index = trimmed.indexOf('=');
    if (index < 0) return;
    env[trimmed.slice(0, index)] = trimmed.slice(index + 1).replace(/^["']|["']$/gu, '');
  });
  return env;
}

function readLogiDocsConfig() {
  const appPath = 'C:\\Users\\10524\\Desktop\\codex_realasset\\Project\\03_Logi_Leasing_Dashboard\\docs\\assets\\app.js';
  if (!fs.existsSync(appPath)) return {};
  const source = fs.readFileSync(appPath, 'utf8');
  const url = source.match(/SUPABASE_URL\s*=\s*["']([^"']+)["']/u)?.[1];
  const anonKey = source.match(/SUPABASE_PUBLISHABLE_KEY\s*=\s*["']([^"']+)["']/u)?.[1];
  return { url, anonKey, source: appPath };
}

async function safeQuery(label, query) {
  try {
    const { data, error, count } = await query;
    if (error) return { label, error: error.message, data: [], count: count ?? null };
    return { label, data: data || [], count: count ?? null, sampleKeys: data && data[0] ? Object.keys(data[0]) : [] };
  } catch (error) {
    return { label, error: error.message, data: [], count: null };
  }
}

(async () => {
  const env = readEnv();
  const logiDocs = readLogiDocsConfig();
  const url = process.env.LOGI_SUPABASE_URL || logiDocs.url || process.env.VITE_SUPABASE_URL || env.VITE_SUPABASE_URL;
  const anonKey = process.env.LOGI_SUPABASE_ANON_KEY || logiDocs.anonKey || process.env.VITE_SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY;
  if (!url || !anonKey) throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY');

  const supabase = createClient(url, anonKey, { auth: { persistSession: false } });
  const result = {
    generatedAt: new Date().toISOString(),
    projectRef: new URL(url).hostname.split('.')[0],
    configSource: logiDocs.url === url ? logiDocs.source : '.env/process.env',
    mutationPerformed: false,
    queries: {},
  };

  result.queries.findings = await safeQuery(
    'll_data_quality_findings',
    supabase.from('ll_data_quality_findings').select('*', { count: 'exact' }).limit(100)
  );
  result.queries.tenants = await safeQuery(
    'll_tenants',
    supabase.from('ll_tenants').select('*', { count: 'exact' }).limit(100)
  );
  result.queries.homeSnapshots = await safeQuery(
    'll_payload_snapshots home',
    supabase.from('ll_payload_snapshots').select('*', { count: 'exact' }).eq('page', 'home').limit(10)
  );
  result.queries.companySnapshots = await safeQuery(
    'll_payload_snapshots company',
    supabase.from('ll_payload_snapshots').select('*', { count: 'exact' }).eq('page', 'company').limit(80)
  );
  result.queries.rentHistoryLatest = await safeQuery(
    'll_rent_history latest',
    supabase.from('ll_rent_history').select('*', { count: 'exact' }).limit(200)
  );

  const findings = result.queries.findings.data || [];
  const tenants = result.queries.tenants.data || [];
  const companySnapshots = result.queries.companySnapshots.data || [];
  const homeSnapshots = result.queries.homeSnapshots.data || [];
  const companySnapshotTenantIds = [...new Set(companySnapshots.map((row) => row.entity_id).filter(Boolean))];
  const companySnapshotTenantNames = [...new Set(companySnapshots.map((row) => (
    row.payload?.profile?.tenantMasterName
    || row.payload?.profile?.company?.tenantMasterName
    || row.payload?.tenantMasterName
  )).filter(Boolean))];
  result.summary = {
    findingsCount: result.queries.findings.count,
    tenantsCount: result.queries.tenants.count,
    homeSnapshotRows: homeSnapshots.length,
    companySnapshotRows: companySnapshots.length,
    companySnapshotUniqueTenantIds: companySnapshotTenantIds.length,
    companySnapshotUniqueTenantNames: companySnapshotTenantNames.length,
    findingKeys: result.queries.findings.sampleKeys || [],
    tenantKeys: result.queries.tenants.sampleKeys || [],
    severityCounts: findings.reduce((acc, row) => {
      const key = row.severity || row.level || row.status || 'unknown';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {}),
    findingStatusCounts: findings.reduce((acc, row) => {
      const key = row.status || row.review_status || row.qa_status || 'unknown';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {}),
    tenantNames: tenants.map((row) => row.tenant_master_name || row.tenant_name || row.name || row.company_name || row.tenantMasterName).filter(Boolean),
    companySnapshotTenantNames,
  };

  fs.writeFileSync(path.join(outDir, 'result.json'), JSON.stringify(result, null, 2));
  fs.writeFileSync(path.join(outDir, 'summary.md'), [
    '# Supabase detail readback - 2026-05-13',
    '',
    '- mutationPerformed: false',
    `- projectRef: ${result.projectRef}`,
    `- ll_data_quality_findings count: ${result.summary.findingsCount}`,
    `- ll_tenants count: ${result.summary.tenantsCount}`,
    `- home snapshot rows: ${result.summary.homeSnapshotRows}`,
    `- company snapshot rows: ${result.summary.companySnapshotRows}`,
    `- company snapshot unique tenant ids: ${result.summary.companySnapshotUniqueTenantIds}`,
    `- company snapshot unique tenant names: ${result.summary.companySnapshotUniqueTenantNames}`,
    `- finding keys: ${result.summary.findingKeys.join(', ')}`,
    `- tenant keys: ${result.summary.tenantKeys.join(', ')}`,
    '',
    '## Finding severity counts',
    '',
    '| key | count |',
    '|---|---:|',
    ...Object.entries(result.summary.severityCounts).map(([key, value]) => `| ${key} | ${value} |`),
    '',
    '## Finding status counts',
    '',
    '| key | count |',
    '|---|---:|',
    ...Object.entries(result.summary.findingStatusCounts).map(([key, value]) => `| ${key} | ${value} |`),
    '',
  ].join('\n'));
  console.log(JSON.stringify({
    projectRef: result.projectRef,
    findingsCount: result.summary.findingsCount,
    tenantsCount: result.summary.tenantsCount,
    findingKeys: result.summary.findingKeys,
    tenantKeys: result.summary.tenantKeys,
    mutationPerformed: false,
  }, null, 2));
})();
