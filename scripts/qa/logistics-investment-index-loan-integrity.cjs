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
  if (!email || !password) throw new Error('Set LOGISTICS_SUPABASE_ACCESS_TOKEN, or set LOGISTICS_SUPABASE_EMAIL and LOGISTICS_SUPABASE_PASSWORD.');
  const response = await fetch(`${supabaseUrl.replace(/\/$/u, '')}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: anonKey, 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body.access_token) throw new Error(`Supabase Auth login failed (${response.status}).`);
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
  if (!response.ok || body?.ok === false) throw new Error(`${action} failed (${response.status}): ${body.message || body.error || 'unknown error'}`);
  return body.data || {};
}

function text(value) {
  return value === undefined || value === null ? '' : String(value).trim();
}

function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function hasMeaningfulLoanData(row) {
  const amount = number(row.amount_krw || row.committed_amount_krw || row.drawn_amount_krw);
  return amount > 0
    || text(row.counterparty_name)
    || text(row.party_name)
    || text(row.lender_name)
    || text(row.drawdown_date)
    || text(row.maturity_date)
    || text(row.interest_rate)
    || text(row.loan_rate)
    || text(row.all_in_rate)
    || text(row.spread_rate)
    || text(row.loan_type)
    || text(row.loan_period);
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const supabaseUrl = envValue('LOGISTICS_SUPABASE_URL', 'VITE_SUPABASE_URL');
  const anonKey = envValue('LOGISTICS_SUPABASE_ANON_KEY', 'VITE_SUPABASE_ANON_KEY');
  if (!supabaseUrl || !anonKey) throw new Error('Set LOGISTICS_SUPABASE_URL/VITE_SUPABASE_URL and LOGISTICS_SUPABASE_ANON_KEY/VITE_SUPABASE_ANON_KEY.');
  const auth = await signIn(supabaseUrl, anonKey);
  const data = await invoke(supabaseUrl, anonKey, auth.token, 'investment-index/read');
  const funds = Array.isArray(data.funds) ? data.funds : [];
  const assets = Array.isArray(data.assets) ? data.assets : [];
  const tranches = Array.isArray(data.tranches) ? data.tranches : [];
  const loanRows = tranches.filter((row) => row.capital_kind === 'loan' || row.tranche_type === 'loan');
  const emptyLoanRows = loanRows.filter((row) => !hasMeaningfulLoanData(row));
  const fundLoanMap = new Map();
  loanRows.filter(hasMeaningfulLoanData).forEach((row) => {
    const fundId = text(row.fund_id);
    if (!fundId) return;
    const current = fundLoanMap.get(fundId) || { count: 0, amount: 0 };
    current.count += 1;
    current.amount += number(row.amount_krw || row.committed_amount_krw);
    fundLoanMap.set(fundId, current);
  });
  const fundsWithNoLoanButRows = funds
    .filter((fund) => number(fund.loan_krw) === 0 && (fundLoanMap.get(text(fund.fund_id))?.count || 0) > 0)
    .map((fund) => ({
      fund_id: fund.fund_id,
      display_name: fund.display_name,
      asset_names: fund.asset_names,
      loan_krw: fund.loan_krw,
      meaningful_loan_rows: fundLoanMap.get(text(fund.fund_id))?.count || 0,
    }));
  const report = {
    ok: emptyLoanRows.length === 0 && fundsWithNoLoanButRows.length === 0,
    generated_at: new Date().toISOString(),
    auth_source: auth.source,
    counts: {
      funds: funds.length,
      assets: assets.length,
      tranches: tranches.length,
      loan_rows: loanRows.length,
      empty_loan_rows: emptyLoanRows.length,
      funds_with_no_loan_but_rows: fundsWithNoLoanButRows.length,
    },
    empty_loan_rows: emptyLoanRows.map((row) => ({
      id: row.id,
      fund_id: row.fund_id,
      fund_display_name: row.fund_display_name,
      tranche: row.tranche,
      counterparty_name: row.counterparty_name,
      amount_krw: row.amount_krw,
      maturity_date: row.maturity_date,
      row_key: row.row_key,
    })),
    funds_with_no_loan_but_rows: fundsWithNoLoanButRows,
  };
  const outJson = path.join(OUT_DIR, `investment-index-loan-integrity-${timestampForFile()}.json`);
  const latestJson = path.join(OUT_DIR, 'investment-index-loan-integrity-latest.json');
  fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(latestJson, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({ ok: report.ok, artifact: outJson, counts: report.counts }, null, 2));
  if (!report.ok) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
