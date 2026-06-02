const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const OUT_DIR = path.join(ROOT, 'qa-artifacts', 'logistics-gate6');
const EDGE_FUNCTION = 'll-dashboard-api';
const DEFAULT_ORIGIN = 'https://kylee94.github.io';
const PY_PER_SQM = 0.3025;

const INTERNAL_PATTERN = /\bll_[a-z0-9_]+\b|public\.|asset_id|tenant_id|lease_space_id|source[_ -]?(?:cell|row)|provider|fallback|answer_focus|required_facts|required_display_values|readable_asset_count|matched_tables|Edge Function|service role|JWT|Supabase/iu;
const MISSING_PATTERN = /확인할 수 없습니다|찾지 못했습니다|근거 데이터가 부족|제공 데이터에서 확인|추가적인 데이터|충분하지 않습니다|not enough|cannot confirm/iu;

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

function argsValue(name, fallback = '') {
  const flag = `--${name}`;
  const index = process.argv.indexOf(flag);
  return index === -1 ? fallback : (process.argv[index + 1] || fallback);
}

function timestampForFile() {
  return new Date().toISOString().replace(/[-:]/gu, '').replace(/\..+$/u, '').replace('T', '-');
}

function currentKstMonthEndDate() {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return new Date(Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth() + 1, 0)).toISOString().slice(0, 10);
}

function firstDefined(...values) {
  return values.find((value) => value !== undefined && value !== null && value !== '');
}

function clean(value) {
  return String(value || '').trim();
}

function normalizeLoose(value) {
  return clean(value)
    .replace(/\s+/gu, '')
    .replace(/[,.()_\-[\]{}·ㆍ]/gu, '')
    .replace(/물류센터|주식회사|유한책임회사|유한회사|\(주\)|㈜/gu, '')
    .toLowerCase();
}

function numberValue(value) {
  if (value === undefined || value === null || value === '') return null;
  const numeric = Number(String(value).replace(/,/gu, '').replace(/[^\d.-]/gu, ''));
  return Number.isFinite(numeric) ? numeric : null;
}

function formatWon(value) {
  return `${new Intl.NumberFormat('ko-KR').format(Math.round(value))}원`;
}

function compactWon(value) {
  if (!Number.isFinite(value)) return '';
  if (Math.abs(value) >= 100_000_000) return `${Math.round((value / 100_000_000) * 10) / 10}억`;
  if (Math.abs(value) >= 10_000) return `${Math.round((value / 10_000) * 10) / 10}만`;
  return formatWon(value);
}

function formatPy(value) {
  return `${new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 1 }).format(value)}평`;
}

function formatPercent(value) {
  return `${(value * 100).toFixed(1)}%`;
}

function dateDisplay(value) {
  return clean(value).slice(0, 10);
}

function rowAreaPy(row = {}) {
  const direct = numberValue(firstDefined(row.leased_area_py, row.leasedAreaPy, row.area_py, row.areaPy));
  if (direct && direct > 0) return direct;
  const sqm = numberValue(firstDefined(row.leased_area_sqm, row.leasedAreaSqm, row.exclusive_area_sqm, row.exclusiveAreaSqm, row.area_sqm, row.areaSqm));
  return sqm && sqm > 0 ? sqm * PY_PER_SQM : 0;
}

function grossAreaPy(asset = {}) {
  const direct = numberValue(firstDefined(asset.gross_floor_area_py, asset.grossFloorAreaPy, asset.total_area_py, asset.totalAreaPy));
  if (direct && direct > 0) return direct;
  const sqm = numberValue(firstDefined(asset.gross_floor_area_sqm, asset.grossFloorAreaSqm, asset.total_area_sqm, asset.totalAreaSqm));
  return sqm && sqm > 0 ? sqm * PY_PER_SQM : 0;
}

function rowMonthlyRent(row = {}) {
  return numberValue(firstDefined(row.current_monthly_rent_total, row.currentMonthlyRentTotal, row.monthly_rent_total, row.monthlyRentTotal)) || 0;
}

function rowMonthlyMf(row = {}) {
  return numberValue(firstDefined(row.current_monthly_mf_total, row.currentMonthlyMfTotal, row.monthly_mf_total, row.monthlyMfTotal)) || 0;
}

function rowMonthlyCombined(row = {}) {
  const combined = numberValue(firstDefined(row.current_monthly_cost_total, row.currentMonthlyCostTotal, row.monthly_cost_total, row.monthlyCostTotal, row.monthly_combined_total, row.monthlyCombinedTotal));
  return combined && combined > 0 ? combined : rowMonthlyRent(row) + rowMonthlyMf(row);
}

function weightedENoc(rows = []) {
  const acc = rows.reduce((sum, row) => {
    const area = rowAreaPy(row);
    const monthly = rowMonthlyCombined(row);
    const stored = numberValue(firstDefined(row.e_noc, row.eNoc, row.average_e_noc, row.averageENoc, row.current_e_noc, row.currentENoc));
    const value = monthly && area > 0 ? monthly / area : stored;
    if (!value || !area) return sum;
    sum.weighted += value * area;
    sum.area += area;
    return sum;
  }, { weighted: 0, area: 0 });
  return acc.area > 0 ? acc.weighted / acc.area : 0;
}

function assetName(row = {}) {
  return clean(firstDefined(row.asset_name, row.assetName, row.asset));
}

function fundName(row = {}) {
  return clean(firstDefined(row.fund_name, row.fundName, row.fund));
}

function tenantName(row = {}) {
  const text = clean(firstDefined(row.tenant_master_name, row.tenantMasterName, row.tenant_name, row.tenantName, row.company_name, row.companyName, row.raw_tenant_name, row.tenant));
  if (!text || text === '-' || /^(asset|tenant)[_-]/iu.test(text)) return '';
  return text;
}

function assetKey(row = {}) {
  return clean(firstDefined(row.asset_id, row.assetId, row.asset_code, row.assetCode, row.asset_name, row.assetName));
}

function tenantKey(row = {}) {
  return clean(firstDefined(row.tenant_id, row.tenantId, row.business_registration_no, row.businessRegistrationNo, row.tenant_master_name, row.tenantMasterName));
}

function rowsForAsset(rows, asset) {
  const keys = [asset.asset_id, asset.assetId, asset.asset_code, asset.assetCode, asset.asset_name, asset.assetName].map(normalizeLoose).filter(Boolean);
  return rows.filter((row) => [row.asset_id, row.assetId, row.asset_code, row.assetCode, row.asset_name, row.assetName, row.asset].map(normalizeLoose).some((key) => keys.includes(key)));
}

function rowsForTenant(rows, tenant) {
  const key = normalizeLoose(tenant);
  return rows.filter((row) => [tenantName(row), row.tenant_id, row.tenantId, row.business_registration_no, row.businessRegistrationNo].map(normalizeLoose).some((candidate) => candidate && (candidate === key || candidate.includes(key) || key.includes(candidate))));
}

function uniqueBy(values, keyFn) {
  const seen = new Set();
  return values.filter((value) => {
    const key = keyFn(value);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function topTenantsByArea(rows) {
  const grouped = new Map();
  rows.forEach((row) => {
    const name = tenantName(row);
    if (!name) return;
    const key = normalizeLoose(name);
    const current = grouped.get(key) || { tenantName: name, rows: [], area: 0, rent: 0, mf: 0, cost: 0 };
    current.rows.push(row);
    current.area += rowAreaPy(row);
    current.rent += rowMonthlyRent(row);
    current.mf += rowMonthlyMf(row);
    current.cost += rowMonthlyCombined(row);
    grouped.set(key, current);
  });
  return [...grouped.values()].filter((row) => row.area > 0).sort((a, b) => b.area - a.area || a.tenantName.localeCompare(b.tenantName, 'ko'));
}

function topTenantsByCost(rows) {
  return [...topTenantsByArea(rows)].sort((a, b) => b.cost - a.cost || a.tenantName.localeCompare(b.tenantName, 'ko'));
}

function summarizeAsset(asset, leaseRows) {
  const gross = grossAreaPy(asset);
  const leased = leaseRows.reduce((sum, row) => sum + rowAreaPy(row), 0);
  const rent = leaseRows.reduce((sum, row) => sum + rowMonthlyRent(row), 0);
  const mf = leaseRows.reduce((sum, row) => sum + rowMonthlyMf(row), 0);
  const cost = leaseRows.reduce((sum, row) => sum + rowMonthlyCombined(row), 0);
  const vacancy = Math.max(0, gross - leased);
  return {
    asset,
    assetName: assetName(asset),
    fundName: fundName(asset),
    leaseRows,
    gross,
    leased,
    rent,
    mf,
    cost,
    vacancy,
    vacancyRate: gross > 0 ? vacancy / gross : 0,
    eNoc: weightedENoc(leaseRows),
    tenantsByArea: topTenantsByArea(leaseRows),
    tenantsByCost: topTenantsByCost(leaseRows),
  };
}

function decorateRows(rows, assetMap, tenantMap) {
  return rows.map((row) => {
    const asset = assetMap.get(assetKey(row));
    const tenant = tenantMap.get(tenantKey(row));
    return {
      ...row,
      asset_name: assetName(row) || assetName(asset),
      fund_name: fundName(row) || fundName(asset),
      tenant_master_name: tenantName(row) || tenantName(tenant),
    };
  });
}

function groupRows(rows, keyFn) {
  const grouped = new Map();
  rows.forEach((row) => {
    const key = keyFn(row);
    if (!key) return;
    grouped.set(key, [...(grouped.get(key) || []), row]);
  });
  return grouped;
}

function shortAssetQuery(name) {
  const normalized = clean(name).replace(/\s*물류센터\s*/gu, '').replace(/\s+/gu, '');
  if (normalized.length <= 6) return normalized;
  return normalized.slice(0, Math.min(8, normalized.length));
}

function shortTenantQuery(name) {
  return clean(name)
    .replace(/주식회사|유한책임회사|유한회사|\(주\)|㈜/gu, '')
    .replace(/\s+/gu, '')
    .slice(0, 10);
}

function addCase(cases, input) {
  if (cases.length >= 100) return;
  cases.push({
    id: `risk_${String(cases.length + 1).padStart(3, '0')}_${input.id}`,
    ...input,
  });
}

function expectValue(value, kind = 'text', label = '') {
  return { value, kind, label: label || clean(value) };
}

function buildCases(model) {
  const cases = [];
  const { assets, summaries, leaseRows, leases, rentHistory, tenantsByArea, tenantsByCost, funds } = model;
  const byCost = [...summaries].sort((a, b) => b.cost - a.cost).filter((row) => row.assetName && row.cost > 0);
  const byArea = [...summaries].sort((a, b) => b.leased - a.leased).filter((row) => row.assetName && row.leased > 0);
  const byVacancy = [...summaries].sort((a, b) => b.vacancyRate - a.vacancyRate).filter((row) => row.assetName && row.gross > 0);
  const focusAssets = uniqueBy([...byCost.slice(0, 5), ...byArea.slice(0, 5), ...byVacancy.slice(0, 5), ...summaries], (row) => row.assetName).slice(0, 10);
  const focusTenants = uniqueBy([...tenantsByArea.slice(0, 8), ...tenantsByCost.slice(0, 8)], (row) => row.tenantName).slice(0, 10);
  const portfolioLeased = leaseRows.reduce((sum, row) => sum + rowAreaPy(row), 0);
  const portfolioCost = leaseRows.reduce((sum, row) => sum + rowMonthlyCombined(row), 0);
  const portfolioRent = leaseRows.reduce((sum, row) => sum + rowMonthlyRent(row), 0);
  const portfolioMf = leaseRows.reduce((sum, row) => sum + rowMonthlyMf(row), 0);
  const portfolioENoc = weightedENoc(leaseRows);

  focusAssets.slice(0, 8).forEach((summary, index) => {
    const query = shortAssetQuery(summary.assetName);
    addCase(cases, {
      id: `asset_short_area_${index}`,
      category: '자산 축약명/공백 제거',
      risk_reason: '전체 자산명이 아니라 짧은 이름만 입력해도 올바른 자산을 찾아야 합니다.',
      question: `${query} 임대된 면적이랑 빈 면적 같이 알려줘`,
      expect: [expectValue(summary.assetName), expectValue(formatPy(summary.leased), 'area', '임대면적'), expectValue(formatPy(summary.vacancy), 'area', '공실면적')],
    });
    addCase(cases, {
      id: `asset_short_rent_mf_${index}`,
      category: '자산 축약명/임대료 관리비 분리',
      risk_reason: '월 임대료와 월 관리비를 합산값으로만 답하지 않아야 합니다.',
      question: `${query} 월세랑 관리비 따로 보면?`,
      expect: [expectValue(summary.assetName), expectValue(formatWon(summary.rent), 'money', '월 임대료'), expectValue(formatWon(summary.mf), 'money', '월 관리비')],
    });
    addCase(cases, {
      id: `asset_short_enoc_${index}`,
      category: '자산 축약명/E. NOC',
      risk_reason: 'E. NOC 질문은 임대면적 가중평균 값으로 답해야 합니다.',
      question: `${query} 현재 기준 평당 비용 감각은 어느 정도야? E NOC로`,
      expect: [expectValue(summary.assetName), expectValue(formatWon(summary.eNoc), 'money', 'E. NOC')],
    });
  });

  focusTenants.slice(0, 8).forEach((tenant, index) => {
    const query = shortTenantQuery(tenant.tenantName);
    const assetNames = [...new Set(tenant.rows.map(assetName).filter(Boolean))];
    addCase(cases, {
      id: `tenant_alias_assets_${index}`,
      category: '임차인 단독/회사명 축약',
      risk_reason: '회사 법인명 접미사를 빼고 물어봐도 임차 자산을 찾아야 합니다.',
      question: `${query} 들어가 있는 센터들만 먼저 정리해줘`,
      expect: [expectValue(tenant.tenantName), ...assetNames.slice(0, 3).map((name) => expectValue(name))],
    });
    addCase(cases, {
      id: `tenant_alias_area_${index}`,
      category: '임차인 단독/전체 임차면적',
      risk_reason: '자산명을 안 쓰고 임차인명만 써도 전체 임차면적을 집계해야 합니다.',
      question: `${query}가 전체에서 차지하는 임차면적은 얼마야?`,
      expect: [expectValue(tenant.tenantName), expectValue(formatPy(tenant.area), 'area', '임차면적')],
    });
    addCase(cases, {
      id: `tenant_alias_cost_split_${index}`,
      category: '임차인 단독/비용 분리',
      risk_reason: '임차인 기준 임대료와 관리비를 월 임관리비 하나로 뭉개면 안 됩니다.',
      question: `${query} 월 임대료랑 월 관리비 각각 합계로 봐줘`,
      expect: [expectValue(tenant.tenantName), expectValue(formatWon(tenant.rent), 'money', '월 임대료'), expectValue(formatWon(tenant.mf), 'money', '월 관리비')],
    });
  });

  const topAreaTenant = tenantsByArea[0];
  const topCostTenant = tenantsByCost[0];
  [
    {
      id: 'portfolio_top_tenant_area_ratio',
      question: '전체 포트폴리오에서 임차면적 제일 큰 임차인이 누구고 비중은 대략 얼마야?',
      expect: [expectValue(topAreaTenant?.tenantName), expectValue(formatPy(topAreaTenant?.area || 0), 'area')],
    },
    {
      id: 'portfolio_top_tenant_cost_ratio',
      question: '전체 월 임관리비에서 가장 큰 비중을 내는 임차인은 누구야?',
      expect: [expectValue(topCostTenant?.tenantName), expectValue(formatWon(topCostTenant?.cost || 0), 'money')],
    },
    {
      id: 'portfolio_rent_mf_plain',
      question: '전체 기준으로 월세랑 관리비를 분리해서 말해줘',
      expect: [expectValue(formatWon(portfolioRent), 'money', '전체 월 임대료'), expectValue(formatWon(portfolioMf), 'money', '전체 월 관리비')],
    },
    {
      id: 'portfolio_area_plain',
      question: '지금 운영 중인 임대 면적을 전부 더하면 얼마야?',
      expect: [expectValue(formatPy(portfolioLeased), 'area', '전체 임대면적')],
    },
    {
      id: 'portfolio_enoc_plain',
      question: '전체 포트폴리오를 한 덩어리로 보면 E NOC가 얼마 정도야?',
      expect: [expectValue(formatWon(portfolioENoc), 'money', '전체 E. NOC')],
    },
    {
      id: 'portfolio_asset_cost_rank',
      question: '월 임관리비 규모가 제일 큰 센터 이름만 알려줘',
      expect: [expectValue(byCost[0]?.assetName)],
    },
    {
      id: 'portfolio_asset_area_rank',
      question: '임대면적 기준으로 가장 큰 센터는 어디야?',
      expect: [expectValue(byArea[0]?.assetName)],
    },
    {
      id: 'portfolio_asset_vacancy_rank',
      question: '공실률이 가장 부담되는 센터부터 보면 어디가 먼저야?',
      expect: [expectValue(byVacancy[0]?.assetName)],
    },
  ].forEach((item) => addCase(cases, {
    ...item,
    category: '전체 통계/순위/비중',
    risk_reason: '대시보드 전체 지표를 특정 자산 질문처럼 잘못 좁히면 안 됩니다.',
  }));

  funds.slice(0, 8).forEach((fund, index) => {
    addCase(cases, {
      id: `fund_assets_${index}`,
      category: '펀드명 단독',
      risk_reason: '펀드명만 물어봐도 연결된 자산을 찾아야 합니다.',
      question: `${fund.fundName}에 들어있는 물류센터가 뭐뭐야?`,
      expect: [expectValue(fund.fundName), ...fund.assets.slice(0, 3).map((summary) => expectValue(summary.assetName))],
    });
    addCase(cases, {
      id: `fund_cost_${index}`,
      category: '펀드 단위 집계',
      risk_reason: '자산 단위가 아니라 펀드 단위로 합산해야 합니다.',
      question: `${fund.fundName} 기준 월 임관리비 합계는?`,
      expect: [expectValue(fund.fundName), expectValue(formatWon(fund.cost), 'money', '펀드 월 임관리비')],
    });
  });

  const datedLeases = uniqueBy(leases
    .filter((row) => tenantName(row) && assetName(row) && (dateDisplay(row.current_end_date) || dateDisplay(row.currentEndDate) || dateDisplay(row.first_end_date)))
    .map((row) => ({ row, endDate: dateDisplay(firstDefined(row.current_end_date, row.currentEndDate, row.first_end_date, row.firstEndDate)) }))
    .filter((row) => row.endDate)
    .sort((a, b) => a.endDate.localeCompare(b.endDate))
    .slice(0, 80), (item) => assetName(item.row))
    .slice(0, 10);
  datedLeases.forEach((item, index) => {
    addCase(cases, {
      id: `future_expiry_${index}`,
      category: '미래 만기/계약 일정',
      risk_reason: '미래 일정 질문에서 현재 자산 운영현황으로 엉뚱하게 답하면 안 됩니다.',
      question: `${assetName(item.row)}에서 다음에 만기 신경써야 할 임차인은 누구고 언제야?`,
      expect: [expectValue(assetName(item.row)), expectValue(tenantName(item.row)), expectValue(item.endDate, 'date', '만기일')],
    });
  });

  const rentRows = uniqueBy(rentHistory
    .filter((row) => tenantName(row) && assetName(row) && dateDisplay(row.effective_date))
    .slice(0, 80), (row) => `${assetName(row)}::${tenantName(row)}`)
    .slice(0, 10);
  rentRows.forEach((row, index) => {
    addCase(cases, {
      id: `rent_history_change_${index}`,
      category: '임대료 변경 이력',
      risk_reason: '현재값과 이력값을 섞지 않고 기준일자별 변경 이력을 답해야 합니다.',
      question: `${assetName(row)} ${tenantName(row)} 임대료가 바뀐 기준일이랑 바뀐 금액을 알려줘`,
      expect: [expectValue(assetName(row)), expectValue(tenantName(row)), expectValue(dateDisplay(row.effective_date), 'date', '기준일자'), expectValue(formatWon(rowMonthlyRent(row)), 'money', '월 임대료')],
    });
  });

  focusAssets.slice(0, 4).forEach((summary, index) => {
    const firstTenant = summary.tenantsByArea[0];
    const secondTenant = summary.tenantsByCost[0];
    if (firstTenant) {
      addCase(cases, {
        id: `asset_tenant_share_area_${index}`,
        category: '자산 내 임차인 비중',
        risk_reason: '자산 안에서 어느 임차인이 면적을 많이 차지하는지 비중/면적을 답해야 합니다.',
        question: `${summary.assetName}에서 면적을 제일 많이 쓰는 임차인을 비중 느낌으로 설명해줘`,
        expect: [expectValue(summary.assetName), expectValue(firstTenant.tenantName), expectValue(formatPy(firstTenant.area), 'area')],
      });
    }
    if (secondTenant) {
      addCase(cases, {
        id: `asset_tenant_share_cost_${index}`,
        category: '자산 내 임차인 월 임관리비 비중',
        risk_reason: '월 임관리비 비중 질문에서 임차면적 순위로 잘못 답하면 안 됩니다.',
        question: `${summary.assetName} 월 임관리비에서 제일 큰 몫을 내는 임차인은 누구야?`,
        expect: [expectValue(summary.assetName), expectValue(secondTenant.tenantName), expectValue(formatWon(secondTenant.cost), 'money')],
      });
    }
  });

  focusAssets.slice(0, 5).forEach((summary, index) => {
    addCase(cases, {
      id: `followup_asset_context_${index}`,
      category: '이전 대화 맥락',
      risk_reason: '그 자산/거기 같은 표현을 직전 대화의 자산으로 해석해야 합니다.',
      question: '거기 월 임대료랑 관리비는 각각 얼마야?',
      history: [
        { role: 'user', content: `${summary.assetName} 운영현황 먼저 봐줘` },
        { role: 'assistant', content: `${summary.assetName} 기준으로 확인하겠습니다.` },
      ],
      expect: [expectValue(summary.assetName), expectValue(formatWon(summary.rent), 'money'), expectValue(formatWon(summary.mf), 'money')],
    });
  });

  focusTenants.slice(0, 5).forEach((tenant, index) => {
    addCase(cases, {
      id: `followup_tenant_context_${index}`,
      category: '이전 대화 맥락',
      risk_reason: '그 임차인 표현을 직전 임차인명으로 이어받아야 합니다.',
      question: '그 임차인의 전체 임차면적도 계산해줘',
      history: [
        { role: 'user', content: `${tenant.tenantName} 어느 센터에 있어?` },
        { role: 'assistant', content: `${tenant.tenantName} 관련 자산을 확인했습니다.` },
      ],
      expect: [expectValue(tenant.tenantName), expectValue(formatPy(tenant.area), 'area')],
    });
  });

  while (cases.length < 100) {
    const summary = focusAssets[cases.length % Math.max(1, focusAssets.length)];
    addCase(cases, {
      id: `asset_extra_${cases.length}`,
      category: '보강 질문',
      risk_reason: '남은 슬롯은 자산 단독 자연어 질문으로 채웁니다.',
      question: `${summary.assetName}을 비용 관점에서 한 문단으로 요약해줘`,
      expect: [expectValue(summary.assetName), expectValue(formatWon(summary.cost), 'money')],
    });
  }
  return cases.slice(0, 100);
}

async function signInForAccessToken(supabaseUrl, anonKey, email, password) {
  const response = await fetchWithRetry(`${supabaseUrl.replace(/\/$/u, '')}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: anonKey, 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body.access_token) {
    throw new Error(`Supabase Auth login failed (${response.status}): ${body.msg || body.message || body.error || 'unknown auth error'}`);
  }
  return body.access_token;
}

async function fetchWithRetry(url, options, retryOptions = {}) {
  const attempts = retryOptions.attempts || 4;
  const retryStatuses = retryOptions.retryStatuses || [429, 502, 503, 504];
  let lastError = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, options);
      if (!retryStatuses.includes(response.status) || attempt === attempts) return response;
      await new Promise((resolve) => setTimeout(resolve, 5000 * attempt));
    } catch (error) {
      lastError = error;
      if (attempt === attempts) throw error;
      await new Promise((resolve) => setTimeout(resolve, 5000 * attempt));
    }
  }
  throw lastError || new Error('fetch failed after retries');
}

async function resolveAccessToken(supabaseUrl, anonKey) {
  const token = envValue('LOGISTICS_SUPABASE_ACCESS_TOKEN');
  if (token) return { token, source: 'LOGISTICS_SUPABASE_ACCESS_TOKEN' };
  const email = argsValue('email', envValue('LOGISTICS_SUPABASE_EMAIL', 'LOGISTICS_SUPABASE_AUTH_EMAIL'));
  const password = argsValue('password', envValue('LOGISTICS_SUPABASE_PASSWORD', 'LOGISTICS_SUPABASE_AUTH_PASSWORD'));
  if (!email || !password) throw new Error('Set LOGISTICS_SUPABASE_ACCESS_TOKEN, or LOGISTICS_SUPABASE_EMAIL and LOGISTICS_SUPABASE_PASSWORD.');
  return { token: await signInForAccessToken(supabaseUrl, anonKey, email, password), source: 'password_grant' };
}

async function invoke(endpoint, anonKey, origin, token, action, payload) {
  const response = await fetchWithRetry(endpoint, {
    method: 'POST',
    headers: {
      apikey: anonKey,
      authorization: token ? `Bearer ${token}` : '',
      'content-type': 'application/json',
      origin,
    },
    body: JSON.stringify({ action, payload }),
  });
  const text = await response.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { raw: text.slice(0, 500) };
  }
  return { status: response.status, ok: response.ok, body };
}

function answerContains(answer, expected) {
  const text = clean(answer);
  const loose = normalizeLoose(text);
  const raw = clean(expected.value || expected);
  if (!raw) return true;
  if (text.includes(raw) || loose.includes(normalizeLoose(raw))) return true;
  const numeric = numberValue(raw);
  if (expected.kind === 'money' && numeric !== null) {
    return [formatWon(numeric), compactWon(numeric)].some((item) => text.includes(item) || loose.includes(normalizeLoose(item)));
  }
  if (expected.kind === 'area' && numeric !== null) {
    return loose.includes(normalizeLoose(formatPy(numeric)));
  }
  if (expected.kind === 'date') {
    const date = dateDisplay(raw);
    return loose.includes(date.replace(/-/gu, '')) || text.includes(date) || text.includes(date.replace(/-/gu, '.'));
  }
  return false;
}

function repeatedOpeningPenalty(answer, previousAnswers) {
  const opening = clean(answer).split(/[.!?\n]/u)[0].slice(0, 36);
  if (opening.length < 12) return false;
  return previousAnswers.slice(-10).some((item) => clean(item).startsWith(opening));
}

function validateAnswer(testCase, result, previousAnswers) {
  if (result.status !== 200) return [`HTTP ${result.status}`];
  if (result.body?.ok !== true) return ['ok=false'];
  const answer = clean(result.body?.answer);
  const failures = [];
  if (!answer) failures.push('empty answer');
  if (INTERNAL_PATTERN.test(JSON.stringify(result.body))) failures.push('internal detail exposed');
  if (testCase.mustAnswer !== false && MISSING_PATTERN.test(answer)) failures.push('answer says data is missing');
  if (repeatedOpeningPenalty(answer, previousAnswers)) failures.push('repeated opening style');
  (testCase.expect || []).forEach((expected) => {
    if (!answerContains(answer, expected)) failures.push(`missing expected: ${clean(expected.label || expected.value || expected)}`);
  });
  return failures;
}

function buildModel(data) {
  const assets = data.assets || [];
  const tenants = data.tenants || [];
  const assetMap = new Map(assets.map((row) => [assetKey(row), row]));
  const tenantMap = new Map(tenants.map((row) => [tenantKey(row), row]));
  const leaseRows = decorateRows(data.lease_spaces || [], assetMap, tenantMap);
  const leases = decorateRows(data.leases || [], assetMap, tenantMap);
  const rentHistory = decorateRows(data.rent_history || [], assetMap, tenantMap);
  const leaseRowsByAsset = groupRows(leaseRows, (row) => assetKey(row));
  const summaries = assets.map((asset) => summarizeAsset(asset, leaseRowsByAsset.get(assetKey(asset)) || [])).filter((row) => row.assetName);
  const fundMap = new Map();
  summaries.forEach((summary) => {
    if (!summary.fundName) return;
    const current = fundMap.get(summary.fundName) || { fundName: summary.fundName, assets: [], leased: 0, cost: 0, rent: 0, mf: 0 };
    current.assets.push(summary);
    current.leased += summary.leased;
    current.cost += summary.cost;
    current.rent += summary.rent;
    current.mf += summary.mf;
    fundMap.set(summary.fundName, current);
  });
  return {
    assets,
    tenants,
    leaseRows,
    leases,
    rentHistory,
    summaries,
    tenantsByArea: topTenantsByArea(leaseRows),
    tenantsByCost: topTenantsByCost(leaseRows),
    funds: [...fundMap.values()].sort((a, b) => b.cost - a.cost || a.fundName.localeCompare(b.fundName, 'ko')),
  };
}

async function main() {
  const supabaseUrl = envValue('LOGISTICS_SUPABASE_URL', 'VITE_SUPABASE_URL');
  const anonKey = envValue('LOGISTICS_SUPABASE_ANON_KEY', 'VITE_SUPABASE_ANON_KEY');
  const origin = argsValue('origin', DEFAULT_ORIGIN);
  const basisDate = argsValue('basis-date', envValue('LOGISTICS_BASIS_DATE') || currentKstMonthEndDate());
  const caseDelayMs = Number(argsValue('case-delay-ms', envValue('LOGISTICS_AI_RISK_QA_CASE_DELAY_MS') || 2200)) || 0;
  const startIndex = Math.max(0, Number(argsValue('start-index', '0')) || 0);
  const maxCases = Math.max(0, Number(argsValue('max-cases', '0')) || 0);
  const listOnly = process.argv.includes('--list-only');
  if (!supabaseUrl || !anonKey) throw new Error('Missing Supabase URL or anon key.');
  const endpoint = `${supabaseUrl.replace(/\/$/u, '')}/functions/v1/${EDGE_FUNCTION}`;
  const auth = await resolveAccessToken(supabaseUrl, anonKey);
  const homeRead = await invoke(endpoint, anonKey, origin, auth.token, 'dashboard/home/read', { basis_date: basisDate });
  if (homeRead.status !== 200 || homeRead.body?.ok === false) throw new Error(`dashboard/home/read failed: ${homeRead.status}`);
  const model = buildModel(homeRead.body?.data || {});
  const allCases = buildCases(model);
  const cases = maxCases > 0 ? allCases.slice(startIndex, startIndex + maxCases) : allCases.slice(startIndex);
  const results = [];
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const outJson = path.join(OUT_DIR, `ai-chatbot-risk-qa-${timestampForFile()}.json`);
  const latestJson = path.join(OUT_DIR, 'ai-chatbot-risk-qa-latest.json');

  function writeOutput(final = false) {
    const byCategory = {};
    results.forEach((row) => {
      byCategory[row.category] = byCategory[row.category] || { total: 0, passed: 0, failed: 0 };
      byCategory[row.category].total += 1;
      if (row.ok) byCategory[row.category].passed += 1;
      else byCategory[row.category].failed += 1;
    });
    const output = {
      ok: listOnly ? true : final && results.length === cases.length && results.every((row) => row.ok),
      complete: final && results.length === cases.length,
      generated_at: new Date().toISOString(),
      origin,
      basis_date: basisDate,
      auth_source: auth.source,
      question_count: cases.length,
      total_question_count: allCases.length,
      start_index: startIndex,
      max_cases: maxCases || null,
      tested_count: results.length,
      passed_count: results.filter((row) => row.ok).length,
      failed_count: results.filter((row) => !row.ok).length,
      by_category: byCategory,
      questions: cases.map((item) => ({
        id: item.id,
        category: item.category,
        risk_reason: item.risk_reason,
        question: item.question,
        expected: item.expect || [],
      })),
      results,
    };
    fs.writeFileSync(outJson, JSON.stringify(output, null, 2), 'utf8');
    fs.writeFileSync(latestJson, JSON.stringify(output, null, 2), 'utf8');
    return output;
  }

  if (!listOnly) {
    for (const testCase of cases) {
      let result = null;
      for (let attempt = 1; attempt <= 4; attempt += 1) {
        result = await invoke(endpoint, anonKey, origin, auth.token, 'ai/search-chat', {
          question: testCase.question,
          history: testCase.history || [],
          basis_date: basisDate,
        });
        if (![429, 502, 503].includes(result.status)) break;
        if (attempt < 4) await new Promise((resolve) => setTimeout(resolve, 5000 * attempt));
      }
      const previousAnswers = results.map((row) => row.answer);
      const failures = validateAnswer(testCase, result, previousAnswers);
      results.push({
        id: testCase.id,
        category: testCase.category,
        risk_reason: testCase.risk_reason,
        question: testCase.question,
        expected: testCase.expect || [],
        status: result?.status || 0,
        ok: failures.length === 0,
        failures,
        answer: clean(result?.body?.answer),
      });
      writeOutput(false);
      if (caseDelayMs > 0) await new Promise((resolve) => setTimeout(resolve, caseDelayMs));
    }
  }

  const output = writeOutput(true);
  console.log(JSON.stringify({
    ok: output.ok,
    generated_at: output.generated_at,
    question_count: output.question_count,
    tested_count: output.tested_count,
    passed_count: output.passed_count,
    failed_count: output.failed_count,
    by_category: output.by_category,
    failed_samples: output.results.filter((row) => !row.ok).slice(0, 20),
    artifact: outJson,
  }, null, 2));
  if (!listOnly && !output.ok) process.exit(1);
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
