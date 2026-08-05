import React, { useEffect, useMemo, useState } from 'react';
import { normalizeLogisticsPath } from '../../components/system/workspace/logisticsRoutes';
import {
  DATA_PLATFORM_ACTIONS,
  createClientRequestId,
  invokeDataPlatform,
  usePrimaryResource,
} from './api';
import {
  financeEntryForSave,
  validateManualFinanceEntries,
} from './financeSchema';
import {
  emptyRentRollRow,
  RENT_ROLL_COLUMNS,
  RENT_ROLL_DETAIL_FIELDS,
  RENT_ROLL_PASTE_COLUMNS,
  validateUniversalRentRoll,
} from './rentRollSchema';

const DATA_PLATFORM_PAGE_TITLES = Object.freeze({
  home: '홈',
  'rent-roll': '렌트롤',
  'income-expense': '수익·비용',
});
const DATA_PLATFORM_TAB_KEYS = new Set(Object.keys(DATA_PLATFORM_PAGE_TITLES));
const DEFAULT_RENT_ROLL_SORT = Object.freeze({ key: 'floor_label', direction: 'desc' });

const NOI_TABLE_ROWS = Object.freeze([
  { key: 'potential_gross_income', label: '잠재총수입' },
  { key: 'loss', label: '손실' },
  { key: 'effective_gross_income', label: '유효총수입' },
  { key: 'operating_expense', label: '운영비용' },
  { key: 'net_operating_income', label: '순영업소득' },
  { key: 'asset_net_cash_flow', label: '자산 순현금흐름' },
  { key: 'after_debt_service_cash_flow', label: '부채상환 후 현금흐름' },
]);

const SECTION_LABELS = Object.freeze({
  potential_income: '수입 입력',
  income_loss: '손실 입력',
  other_operating_income: '기타 운영수입 입력',
  operating_expense: '운영비용 입력',
  below_noi: 'NOI 하단 조정 입력',
  debt_service: '부채상환 입력',
});

function todayKst() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
}

function addDays(dateText, days) {
  const date = new Date(`${dateText}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function currentMonthKst() {
  return todayKst().slice(0, 7);
}

function addMonths(month, delta) {
  const [year, monthNumber] = String(month).split('-').map(Number);
  if (!year || !monthNumber) return month;
  const date = new Date(Date.UTC(year, monthNumber - 1 + delta, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

function monthsBetween(startMonth, endMonth) {
  const months = [];
  let cursor = startMonth;
  while (cursor && cursor <= endMonth && months.length < 60) {
    months.push(cursor);
    cursor = addMonths(cursor, 1);
  }
  return months;
}

function formatAmount(value) {
  if (value === null || value === undefined || value === '' || !Number.isFinite(Number(value))) return '—';
  return new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 0 }).format(Number(value));
}

function formatAreaPair(value) {
  if (value === null || value === undefined || value === '' || !Number.isFinite(Number(value))) return '—';
  const sqm = Number(value);
  const pyeong = sqm / 3.305785;
  return `${new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 2 }).format(sqm)} ㎡ · ${new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 2 }).format(pyeong)} 평`;
}

function formatRate(value) {
  if (value === null || value === undefined || value === '') return '—';
  const text = String(value).trim();
  if (!text) return '—';
  return /%/u.test(text) ? text : Number.isFinite(Number(text)) ? `${text}%` : text;
}

function valueOrDash(value) {
  return value === null || value === undefined || value === '' ? '—' : String(value);
}

function humanizeStructuredValue(value) {
  if (value === null || value === undefined || value === '') return '';
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) {
    return value.map((item) => humanizeStructuredValue(item)).filter(Boolean).join(' · ');
  }
  if (typeof value === 'object') {
    return Object.entries(value)
      .map(([key, item]) => `${key}: ${humanizeStructuredValue(item)}`)
      .filter((item) => !item.endsWith(': '))
      .join(' · ');
  }
  return String(value);
}

function withoutDraftId(row) {
  const responseOnlyFields = new Set([
    '_draft_id',
    'current_total_cost_per_py_krw',
    'source_status',
    'effective_date_status',
    'tenant_improvement_amount',
  ]);
  return Object.fromEntries(Object.entries(row).filter(([key]) => !responseOnlyFields.has(key)));
}

function normalizeMaturityRows(data) {
  if (Array.isArray(data?.maturities)) return data.maturities;
  if (Array.isArray(data?.rows)) return data.rows;
  return [];
}

function ErrorNotice({ error }) {
  if (!error) return null;
  return <p className="text-sm text-[#FF9B9B]" role="alert">{error.message || '데이터를 불러오지 못했습니다.'}</p>;
}

function LoadingLine({ visible }) {
  if (!visible) return null;
  return <div className="h-0.5 w-full animate-pulse rounded-full bg-[#5E9EFF]" aria-label="데이터를 불러오는 중" />;
}

function EmptyText({ children = '표시할 데이터가 없습니다.' }) {
  return <p className="py-5 text-sm text-[#86868B]">{children}</p>;
}

function SectionCard({ title, action = null, children, className = '' }) {
  return (
    <section className={`rounded-[20px] border border-[#333333] bg-[#252524] p-5 ${className}`}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-white">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function MaturityList({ rows, limit = 12 }) {
  const groups = [
    ['lease', '임대차 만기'],
    ['fund', '펀드 만기'],
    ['loan', '대출 만기'],
  ];
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {groups.map(([type, label]) => {
        const items = rows.filter((row) => (row.type || row.kind) === type).slice(0, limit);
        return (
          <div key={type}>
            <p className="mb-2 text-xs font-semibold text-[#A1A1AA]">{label}</p>
            {items.length ? items.map((row) => (
              <div key={row.maturity_key || row.maturity_id || `${type}-${row.official_date}`} className="flex items-center justify-between gap-3 border-b border-[#333333] py-2.5 text-sm">
                <span className="min-w-0 truncate text-[#D1D1D6]">{valueOrDash(row.target_name || row.title || row.subject_name)}</span>
                <time className="shrink-0 tabular-nums text-white">{valueOrDash(row.official_date || row.maturity_date)}</time>
              </div>
            )) : <p className="py-2 text-sm text-[#6E6E73]">—</p>}
          </div>
        );
      })}
    </div>
  );
}

function HomePanel({ assetKey, homeResource, maturities }) {
  const data = homeResource.data || {};
  const asset = data.asset || null;
  const funds = Array.isArray(data.funds) ? data.funds : [];
  const investments = Array.isArray(data.investments) ? data.investments : [];
  const loans = Array.isArray(data.loans) ? data.loans : [];
  const maturityRows = normalizeMaturityRows(maturities.data);
  const rentRollPayload = useMemo(() => ({ asset_key: assetKey, include_archived: false, limit: 500 }), [assetKey]);
  const rentRollResource = usePrimaryResource(DATA_PLATFORM_ACTIONS.rentRollRead, rentRollPayload, { enabled: Boolean(assetKey) });
  const rentRollRows = useMemo(() => (Array.isArray(rentRollResource.data?.rows) ? rentRollResource.data.rows : []), [rentRollResource.data?.rows]);
  const activeTenantNames = useMemo(() => [...new Set(rentRollRows
    .filter((row) => row.occupancy_status !== 'vacant' && row.tenant_name)
    .map((row) => row.tenant_name))], [rentRollRows]);
  const occupiedRows = rentRollRows.filter((row) => row.occupancy_status !== 'vacant');
  const vacantRows = rentRollRows.filter((row) => row.occupancy_status === 'vacant');
  const occupiedArea = occupiedRows.reduce((sum, row) => sum + (Number.isFinite(Number(row.leased_area_sqm)) ? Number(row.leased_area_sqm) : 0), 0);
  const nearestLeaseExpiry = occupiedRows.map((row) => row.expiry_date).filter(Boolean).sort()[0] || null;
  const assetFields = asset ? [
    ['자산 코드', asset.asset_code],
    ['섹터', asset.sector],
    ['층수', asset.floor_count],
    ['담당자', [asset.manager_name, asset.manager_team].filter(Boolean).join(' · ')],
    ['기준 통화', asset.currency_code],
  ] : [];
  const investmentCommittedAmount = (row) => row.agreed_amount_krw ?? row.commitment_amount_krw ?? row.subscription_commitment_krw ?? null;
  const investmentContributedAmount = (row) => row.contributed_amount_krw ?? row.paid_in_amount_krw ?? row.invested_amount_krw ?? row.investment_amount_krw ?? row.committed_amount_krw ?? null;

  return (
    <div className="space-y-4">
      <LoadingLine visible={homeResource.loading || maturities.loading || rentRollResource.loading} />
      <ErrorNotice error={homeResource.error || maturities.error || rentRollResource.error} />
      {!assetKey ? <EmptyText>조회 가능한 담당 자산이 없습니다.</EmptyText> : null}
      {assetKey ? (
        <>
          <SectionCard title="자산 개요">
            {asset ? (
              <div className="grid grid-cols-12 gap-4">
                <div className="col-span-12 xl:col-span-8">
                  <div className="mb-4 border-b border-[#333333] pb-4"><h2 className="text-xl font-semibold text-white">{valueOrDash(asset.name || asset.name_ko)}</h2><p className="mt-1 text-sm text-[#A1A1AA]">{valueOrDash(asset.address)}</p></div>
                  <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-[10px] border border-[#333333] bg-[#333333] lg:grid-cols-4">
                    {[
                      ['토지면적', formatAreaPair(asset.land_area_sqm)],
                      ['연면적', formatAreaPair(asset.gross_area_sqm)],
                      ['임대가능면적', formatAreaPair(asset.leasable_area_sqm)],
                      ['취득가', asset.acquisition_cost == null ? '—' : `${formatAmount(asset.acquisition_cost)} 원`],
                      ['현재 평가액', asset.current_valuation == null ? '—' : `${formatAmount(asset.current_valuation)} 원`],
                      ...assetFields,
                    ].map(([label, value]) => <div key={label} className="min-w-0 bg-[#222221] px-3 py-2.5"><dt className="text-[11px] text-[#86868B]">{label}</dt><dd className="mt-1 truncate text-[13px] font-medium text-white" title={valueOrDash(value)}>{valueOrDash(value)}</dd></div>)}
                  </dl>
                </div>
                <aside data-testid="home-tenant-summary" className="col-span-12 rounded-[12px] border border-[#333333] bg-[#202020] p-4 xl:col-span-4">
                  <div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-semibold text-white">임차인 현황</h3><span className="text-xs text-[#86868B]">렌트롤 {rentRollRows.length}행</span></div>
                  <div className="grid grid-cols-2 gap-px overflow-hidden rounded-[9px] border border-[#333333] bg-[#333333]">
                    {[['임차인', `${activeTenantNames.length}개사`], ['임대 / 공실', `${occupiedRows.length} / ${vacantRows.length}행`], ['임대면적', formatAreaPair(occupiedArea || null)], ['최근 임대차 만기', nearestLeaseExpiry || '—']].map(([label, value]) => <div key={label} className="bg-[#252524] px-3 py-3"><p className="text-[11px] text-[#86868B]">{label}</p><p className="mt-1 text-sm font-semibold text-white">{value}</p></div>)}
                  </div>
                  {activeTenantNames.length ? <p className="mt-3 line-clamp-2 text-xs leading-5 text-[#A1A1AA]">{activeTenantNames.join(' · ')}</p> : null}
                </aside>
              </div>
            ) : <EmptyText />}
          </SectionCard>

          <div className="grid gap-4 xl:grid-cols-[1.5fr_0.5fr]">
            <SectionCard title="투자 현황">
              {funds.length || investments.length ? (
                <div className="space-y-4">
                  <div>
                    <p className="mb-2 text-xs font-semibold text-[#A1A1AA]">펀드 정보</p>
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[720px] text-left text-sm">
                        <thead><tr className="text-xs text-[#86868B]"><th className="border-b border-[#333333] px-3 py-2">펀드명</th><th className="border-b border-[#333333] px-3 py-2">유형</th><th className="border-b border-[#333333] px-3 py-2">투자전략</th><th className="border-b border-[#333333] px-3 py-2">설정일</th><th className="border-b border-[#333333] px-3 py-2">만기</th><th className="border-b border-[#333333] px-3 py-2 text-right">지분율</th></tr></thead>
                        <tbody>{funds.map((fund) => <tr key={fund.fund_key || fund.fund_code}><td className="border-b border-[#333333] px-3 py-2.5 font-medium text-white">{valueOrDash(fund.name || fund.name_ko)}</td><td className="border-b border-[#333333] px-3 py-2.5 text-[#D1D1D6]">{valueOrDash(fund.fund_type || fund.legal_form || fund.status)}</td><td className="border-b border-[#333333] px-3 py-2.5 text-[#D1D1D6]">{valueOrDash(fund.investment_strategy)}</td><td className="border-b border-[#333333] px-3 py-2.5 tabular-nums text-[#D1D1D6]">{valueOrDash(fund.inception_date || fund.initial_setup_date || fund.effective_from)}</td><td className="border-b border-[#333333] px-3 py-2.5 tabular-nums text-[#D1D1D6]">{valueOrDash(fund.maturity_date || fund.effective_to)}</td><td className="border-b border-[#333333] px-3 py-2.5 text-right tabular-nums text-white">{fund.ownership_ratio === null || fund.ownership_ratio === undefined ? '—' : `${(Number(fund.ownership_ratio) * 100).toFixed(2)}%`}</td></tr>)}</tbody>
                      </table>
                    </div>
                  </div>
                  <div>
                    <p className="mb-2 text-xs font-semibold text-[#A1A1AA]">수익증권 투자자</p>
                    {investments.length ? <div className="overflow-x-auto"><table className="w-full min-w-[700px] text-left text-sm"><thead><tr className="text-xs text-[#86868B]"><th className="border-b border-[#333333] px-3 py-2">펀드</th><th className="border-b border-[#333333] px-3 py-2">구분</th><th className="border-b border-[#333333] px-3 py-2">투자자</th><th className="border-b border-[#333333] px-3 py-2 text-right">약정액</th><th className="border-b border-[#333333] px-3 py-2 text-right">투입액</th></tr></thead><tbody>{investments.map((investment) => <tr key={investment.beneficiary_key || `${investment.tranche}-${investment.beneficiary_name}`}><td className="border-b border-[#333333] px-3 py-2.5 text-[#A1A1AA]">{valueOrDash(investment.fund_name)}</td><td className="border-b border-[#333333] px-3 py-2.5 text-[#D1D1D6]">{valueOrDash(investment.tranche)}</td><td className="border-b border-[#333333] px-3 py-2.5 font-medium text-white">{valueOrDash(investment.beneficiary_name)}</td><td className="border-b border-[#333333] px-3 py-2.5 text-right tabular-nums text-white">{formatAmount(investmentCommittedAmount(investment))}</td><td className="border-b border-[#333333] px-3 py-2.5 text-right tabular-nums text-white">{formatAmount(investmentContributedAmount(investment))}</td></tr>)}</tbody></table></div> : <EmptyText />}
                  </div>
                </div>
              ) : <EmptyText />}
            </SectionCard>
            <SectionCard title="다가오는 만기">
              <MaturityList rows={maturityRows} limit={5} />
            </SectionCard>
          </div>

          <SectionCard title="대출 현황">
            {loans.length ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1120px] text-left text-sm">
                  <thead><tr className="text-xs text-[#86868B]"><th className="border-b border-[#333333] px-3 py-2">구분</th><th className="border-b border-[#333333] px-3 py-2">대주</th><th className="border-b border-[#333333] px-3 py-2 text-right">약정액</th><th className="border-b border-[#333333] px-3 py-2">실행일</th><th className="border-b border-[#333333] px-3 py-2">만기</th><th className="border-b border-[#333333] px-3 py-2">금리 유형</th><th className="border-b border-[#333333] px-3 py-2 text-right">Coupon 금리</th><th className="border-b border-[#333333] px-3 py-2 text-right">All-in 금리</th></tr></thead>
                  <tbody>{loans.map((loan) => <tr key={loan.loan_key || loan.row_key}><td className="border-b border-[#333333] px-3 py-2.5 font-medium text-white">{valueOrDash(loan.tranche || loan.name)}</td><td className="border-b border-[#333333] px-3 py-2.5 text-[#D1D1D6]">{valueOrDash(loan.lender_name || loan.party_name)}</td><td className="border-b border-[#333333] px-3 py-2.5 text-right tabular-nums text-white">{formatAmount(loan.committed_amount_krw || loan.commitment_amount)}</td><td className="border-b border-[#333333] px-3 py-2.5 tabular-nums text-[#D1D1D6]">{valueOrDash(loan.drawdown_date)}</td><td className="border-b border-[#333333] px-3 py-2.5 tabular-nums text-[#D1D1D6]">{valueOrDash(loan.maturity_date)}</td><td className="border-b border-[#333333] px-3 py-2.5 text-[#D1D1D6]">{valueOrDash(loan.interest_type || loan.loan_type)}</td><td className="border-b border-[#333333] px-3 py-2.5 text-right tabular-nums text-white">{formatRate(loan.loan_rate || loan.interest_rate)}</td><td className="border-b border-[#333333] px-3 py-2.5 text-right tabular-nums text-white">{formatRate(loan.all_in_rate || loan.all_in)}</td></tr>)}</tbody>
                </table>
              </div>
            ) : <EmptyText />}
          </SectionCard>
        </>
      ) : null}
    </div>
  );
}

function floorSortValue(value) {
  const text = String(value || '').trim().toUpperCase();
  if (!text) return Number.NEGATIVE_INFINITY;
  const number = Number(text.match(/\d+(?:\.\d+)?/u)?.[0] || 0);
  if (/^B|지하/u.test(text)) return -number;
  if (/옥탑|ROOF/u.test(text)) return 1000 + number;
  return number;
}

function comparableValue(value, kind, key) {
  if (key === 'floor_label') return floorSortValue(value);
  if (kind === 'number') return value === '' || value === null || value === undefined ? null : Number(value);
  if (kind === 'date') return value ? new Date(value).getTime() : null;
  return humanizeStructuredValue(value).toLocaleLowerCase('ko-KR');
}

function sortRentRollRows(rows, sortConfig) {
  if (!sortConfig) return rows;
  const column = RENT_ROLL_COLUMNS.find((item) => item.key === sortConfig.key);
  if (!column) return rows;
  return rows.map((row, index) => ({ row, index })).sort((left, right) => {
    const valueKey = column.sortKey || column.key;
    const comparableKind = ['area', 'moneyPair', 'readonlyMoney'].includes(column.kind)
      ? 'number'
      : column.kind === 'period'
        ? 'date'
        : column.kind === 'summary' && valueKey === 'rent_free_months'
          ? 'number'
          : column.kind;
    const a = comparableValue(left.row[valueKey], comparableKind, valueKey);
    const b = comparableValue(right.row[valueKey], comparableKind, valueKey);
    if (a === null || a === '') return b === null || b === '' ? left.index - right.index : 1;
    if (b === null || b === '') return -1;
    const direction = sortConfig.direction === 'asc' ? 1 : -1;
    if (typeof a === 'number' && typeof b === 'number') return a === b ? left.index - right.index : (a - b) * direction;
    const compared = String(a).localeCompare(String(b), 'ko-KR', { numeric: true, sensitivity: 'base' });
    return compared === 0 ? left.index - right.index : compared * direction;
  }).map(({ row }) => row);
}

function parseRentRollClipboard(text) {
  return String(text || '').split(/\r?\n/u).filter((line) => line.trim()).map((line, index) => {
    const row = emptyRentRollRow(`paste-${Date.now()}-${index}`);
    const values = line.split('\t');
    RENT_ROLL_PASTE_COLUMNS.forEach((key, columnIndex) => { row[key] = values[columnIndex]?.trim() || ''; });
    if (row.occupancy_status === '임대') row.occupancy_status = 'occupied';
    if (row.occupancy_status === '공실') row.occupancy_status = 'vacant';
    return row;
  });
}

function RentRollPanel({ assetKey }) {
  const payload = useMemo(() => ({ asset_key: assetKey, include_archived: false, limit: 500 }), [assetKey]);
  const resource = usePrimaryResource(DATA_PLATFORM_ACTIONS.rentRollRead, payload, { enabled: Boolean(assetKey) });
  const [draftRows, setDraftRows] = useState([]);
  const [sortConfig, setSortConfig] = useState(DEFAULT_RENT_ROLL_SORT);
  const [clipboard, setClipboard] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [saveError, setSaveError] = useState(null);
  const [showValidationErrors, setShowValidationErrors] = useState(false);
  const [expandedRows, setExpandedRows] = useState(() => new Set());
  const rentRollWriteEnabled = resource.data?.write_enabled === true;
  const rentRollWriteLockReason = resource.data?.write_reason;
  const tenants = useMemo(() => (Array.isArray(resource.data?.tenants) ? resource.data.tenants : []), [resource.data?.tenants]);

  useEffect(() => {
    const rows = Array.isArray(resource.data?.rows) ? resource.data.rows : [];
    const ordered = sortRentRollRows(rows, DEFAULT_RENT_ROLL_SORT);
    setDraftRows(ordered.map((row, index) => ({ ...row, display_order: index + 1, operation: 'update' })));
    setSortConfig(DEFAULT_RENT_ROLL_SORT);
    setExpandedRows(new Set());
    setShowValidationErrors(false);
  }, [resource.data]);

  const validationErrors = useMemo(() => validateUniversalRentRoll(draftRows), [draftRows]);
  const displayedRows = useMemo(() => sortRentRollRows(draftRows, sortConfig), [draftRows, sortConfig]);
  const updateCell = (rowIdentity, key, value) => {
    if (!rentRollWriteEnabled) return;
    setDraftRows((rows) => rows.map((row) => {
      if ((row.row_key || row._draft_id) !== rowIdentity) return row;
      if (key !== 'tenant_key') return { ...row, [key]: value };
      const tenant = tenants.find((item) => item.tenant_key === value);
      return {
        ...row,
        tenant_key: value,
        tenant_name: tenant?.tenant_name || '',
        business_registration_number: tenant?.business_registration_number || '',
      };
    }));
  };
  const requestSort = (key) => setSortConfig((current) => ({
    key,
    direction: current?.key === key && current.direction === 'asc' ? 'desc' : 'asc',
  }));
  const toggleRowDetail = (rowIdentity) => setExpandedRows((current) => {
    const next = new Set(current);
    if (next.has(rowIdentity)) next.delete(rowIdentity);
    else next.add(rowIdentity);
    return next;
  });
  const moveRow = (rowIdentity, delta) => {
    if (!rentRollWriteEnabled) return;
    const currentOrder = [...displayedRows];
    const index = currentOrder.findIndex((row) => (row.row_key || row._draft_id) === rowIdentity);
    const target = index + delta;
    if (index < 0 || target < 0 || target >= currentOrder.length) return;
    [currentOrder[index], currentOrder[target]] = [currentOrder[target], currentOrder[index]];
    setDraftRows(currentOrder.map((row, rowIndex) => ({ ...row, display_order: rowIndex + 1 })));
    setSortConfig(null);
  };
  const addRow = () => {
    if (!rentRollWriteEnabled) return;
    const key = globalThis.crypto?.randomUUID?.() || `${Date.now()}`;
    setDraftRows((rows) => [...rows, { ...emptyRentRollRow(key), display_order: rows.length + 1 }]);
    setSortConfig(null);
  };
  const archiveRow = (rowIdentity) => {
    if (!rentRollWriteEnabled) return;
    setDraftRows((rows) => rows.map((row) => ((row.row_key || row._draft_id) === rowIdentity ? { ...row, operation: 'delete' } : row)));
  };
  const pasteRows = () => {
    if (!rentRollWriteEnabled) return;
    const parsed = parseRentRollClipboard(clipboard).map((row) => {
      const tenant = tenants.find((item) => item.tenant_name === row.tenant_name);
      return tenant ? { ...row, tenant_key: tenant.tenant_key, business_registration_number: tenant.business_registration_number || '' } : row;
    });
    if (!parsed.length) return;
    setDraftRows((rows) => [...rows, ...parsed.map((row, index) => ({ ...row, display_order: rows.length + index + 1 }))]);
    setClipboard('');
    setSortConfig(null);
  };
  const save = async () => {
    if (!assetKey || !rentRollWriteEnabled) return;
    if (validationErrors.length) {
      setShowValidationErrors(true);
      return;
    }
    setSaving(true);
    setMessage('');
    setSaveError(null);
    try {
      const response = await invokeDataPlatform(DATA_PLATFORM_ACTIONS.rentRollBatchSave, {
        asset_key: assetKey,
        client_request_id: createClientRequestId('rent-roll'),
        expected_revision: resource.revision,
        expected_revisions: Object.fromEntries(draftRows.filter((row) => row.row_key && row.revision).map((row) => [row.row_key, row.revision])),
        rows: draftRows.map(withoutDraftId),
      });
      setMessage(`저장 완료 · revision ${response.revision}`);
      setShowValidationErrors(false);
      resource.reload();
    } catch (error) {
      setSaveError(error);
    } finally {
      setSaving(false);
    }
  };

  if (!assetKey) return <EmptyText>먼저 조회할 자산을 선택해 주세요.</EmptyText>;
  return (
    <div className="space-y-4">
      <LoadingLine visible={resource.loading} />
      <ErrorNotice error={resource.error || saveError} />
      <SectionCard
        title="렌트롤"
        action={<div className="flex flex-wrap items-center gap-2"><button data-testid="rent-roll-add" type="button" onClick={addRow} disabled={!rentRollWriteEnabled} className="rounded-[8px] border border-[#3A3A3C] px-3 py-2 text-sm text-white disabled:opacity-35">행 추가</button><button data-testid="rent-roll-save" type="button" onClick={save} disabled={saving || !rentRollWriteEnabled} className="rounded-[8px] border border-[#2C66A2] bg-[#17314E] px-4 py-2 text-sm font-semibold text-[#9AD7FF] disabled:opacity-35">{saving ? '저장 중' : '변경 저장'}</button></div>}
      >
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <textarea data-testid="rent-roll-paste-input" value={clipboard} onChange={(event) => setClipboard(event.target.value)} disabled={!rentRollWriteEnabled} rows={1} className="min-w-[320px] flex-1 rounded-[8px] border border-[#3A3A3C] bg-[#1F1F1E] px-3 py-2 text-sm text-white outline-none focus:border-[#5E9EFF]" placeholder="엑셀 행을 그대로 붙여넣으세요." />
          <button data-testid="rent-roll-paste" type="button" onClick={pasteRows} disabled={!rentRollWriteEnabled} className="rounded-[8px] border border-[#3A3A3C] px-4 py-2 text-sm font-semibold text-white disabled:opacity-35">다중 붙여넣기</button>
          <span className="text-xs text-[#86868B]">{draftRows.filter((row) => row.operation !== 'delete').length}행</span>
        </div>
        {!rentRollWriteEnabled && rentRollWriteLockReason ? <p className="mb-3 text-xs text-[#86868B]">{rentRollWriteLockReason}</p> : null}
        {showValidationErrors && validationErrors.length ? <div className="mb-3 text-xs leading-5 text-[#FFB4B4]">{validationErrors.slice(0, 8).map((error) => <p key={error}>{error}</p>)}</div> : null}
        {message ? <p className="mb-3 text-xs text-[#8FD3A7]">{message}</p> : null}
        {draftRows.length ? (
          <div className="max-h-[calc(100vh-230px)] overflow-auto rounded-[12px] border border-[#333333]">
            <table data-testid="rent-roll-table" className="w-max min-w-full border-separate border-spacing-0 text-left text-sm">
              <thead><tr>
                <th className="sticky left-0 top-0 z-40 w-[68px] min-w-[68px] border-b border-r border-[#333333] bg-[#202020] px-2 py-3 text-center text-xs font-semibold text-[#A1A1AA]">순서</th>
                {RENT_ROLL_COLUMNS.map((column) => {
                  const stickyClass = column.key === 'occupancy_status'
                    ? 'sticky left-[68px] z-30'
                    : column.key === 'tenant_name'
                      ? 'sticky left-[180px] z-30 border-r'
                      : '';
                  const ariaSort = sortConfig?.key === column.key ? (sortConfig.direction === 'asc' ? 'ascending' : 'descending') : 'none';
                  return <th key={column.key} aria-sort={ariaSort} style={{ minWidth: column.width, width: column.width }} className={`sticky top-0 z-20 border-b border-[#333333] bg-[#202020] px-2 py-2 ${stickyClass}`}><button type="button" onClick={() => requestSort(column.key)} className="flex w-full items-center justify-between gap-2 text-left text-xs font-semibold text-[#A1A1AA] hover:text-white"><span>{column.label}</span><span aria-hidden="true">{sortConfig?.key === column.key ? (sortConfig.direction === 'asc' ? '↑' : '↓') : '↕'}</span></button></th>;
                })}
                <th className="sticky right-0 top-0 z-30 min-w-[78px] border-b border-l border-[#333333] bg-[#202020] px-2 py-3 text-center text-xs font-semibold text-[#A1A1AA]">관리</th>
              </tr></thead>
              <tbody>{displayedRows.map((row, index) => {
                const identity = row.row_key || row._draft_id;
                const detailOpen = expandedRows.has(identity);
                return (
                  <React.Fragment key={identity}>
                  <tr className={row.operation === 'delete' ? 'opacity-35' : ''}>
                    <td className="sticky left-0 z-20 border-b border-r border-[#333333] bg-[#252524] px-1 py-2"><div className="flex items-center justify-center gap-1"><button data-testid="rent-roll-move-up" type="button" aria-label={`${index + 1}행 위로 이동`} onClick={() => moveRow(identity, -1)} disabled={!rentRollWriteEnabled || index === 0} className="rounded px-1.5 py-1 text-[#A1A1AA] hover:bg-[#333333] hover:text-white disabled:opacity-20">↑</button><button data-testid="rent-roll-move-down" type="button" aria-label={`${index + 1}행 아래로 이동`} onClick={() => moveRow(identity, 1)} disabled={!rentRollWriteEnabled || index === displayedRows.length - 1} className="rounded px-1.5 py-1 text-[#A1A1AA] hover:bg-[#333333] hover:text-white disabled:opacity-20">↓</button></div></td>
                    {RENT_ROLL_COLUMNS.map((column) => {
                      const stickyClass = column.key === 'occupancy_status'
                        ? 'sticky left-[68px] z-10'
                        : column.key === 'tenant_name'
                          ? 'sticky left-[180px] z-10 border-r'
                          : '';
                      const baseClass = `border-b border-[#333333] bg-[#252524] px-1.5 py-2 align-top ${stickyClass}`;
                      if (column.kind === 'tenant') return <td key={column.key} className={baseClass}><select value={row.tenant_key || ''} onChange={(event) => updateCell(identity, 'tenant_key', event.target.value)} disabled={!rentRollWriteEnabled || row.occupancy_status === 'vacant'} className="w-full rounded-[6px] border border-transparent bg-[#252524] px-2 py-1.5 text-sm text-white outline-none hover:border-[#3A3A3C] focus:border-[#5E9EFF] disabled:opacity-50"><option value="">임차인 선택</option>{row.tenant_key && !tenants.some((tenant) => tenant.tenant_key === row.tenant_key) ? <option value={row.tenant_key}>{row.tenant_name || '기존 임차인'}</option> : null}{tenants.map((tenant) => <option key={tenant.tenant_key} value={tenant.tenant_key}>{tenant.tenant_name}</option>)}</select></td>;
                      if (column.kind === 'select') return <td key={column.key} className={baseClass}><select value={row[column.key] || ''} onChange={(event) => updateCell(identity, column.key, event.target.value)} disabled={!rentRollWriteEnabled} className="w-full rounded-[6px] border border-transparent bg-[#252524] px-2 py-1.5 text-sm text-white outline-none hover:border-[#3A3A3C] focus:border-[#5E9EFF] disabled:opacity-50">{column.options.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></td>;
                      if (column.kind === 'area') return <td key={column.key} className={baseClass}><input aria-label="임대면적 제곱미터" type="number" value={row.leased_area_sqm ?? ''} onChange={(event) => updateCell(identity, 'leased_area_sqm', event.target.value)} disabled={!rentRollWriteEnabled} placeholder="임대면적" className="w-full rounded-[6px] border border-[#343437] bg-[#202020] px-2 py-1.5 text-right tabular-nums text-white outline-none focus:border-[#5E9EFF] disabled:opacity-50" /><p className="mt-1 truncate px-1 text-right text-[11px] tabular-nums text-[#86868B]">{formatAreaPair(row.leased_area_sqm)}</p></td>;
                      if (column.kind === 'period') return <td key={column.key} className={baseClass}><div className="space-y-1"><input aria-label="계약개시일" type="date" value={row.commencement_date ?? ''} onChange={(event) => updateCell(identity, 'commencement_date', event.target.value)} disabled={!rentRollWriteEnabled} className="w-full rounded-[6px] border border-[#343437] bg-[#202020] px-2 py-1 text-xs text-white outline-none focus:border-[#5E9EFF]" /><input aria-label="계약만기일" type="date" value={row.expiry_date ?? ''} onChange={(event) => updateCell(identity, 'expiry_date', event.target.value)} disabled={!rentRollWriteEnabled} className="w-full rounded-[6px] border border-[#343437] bg-[#202020] px-2 py-1 text-xs text-white outline-none focus:border-[#5E9EFF]" /></div></td>;
                      if (column.kind === 'moneyPair') return <td key={column.key} className={baseClass}><input aria-label={`${column.label} 총액`} type="number" value={row[column.totalKey] ?? ''} onChange={(event) => updateCell(identity, column.totalKey, event.target.value)} disabled={!rentRollWriteEnabled} placeholder="총액" className="w-full rounded-[6px] border border-[#343437] bg-[#202020] px-2 py-1.5 text-right tabular-nums text-white outline-none focus:border-[#5E9EFF]" /><div className="mt-1 flex items-center gap-1"><span className="shrink-0 text-[10px] text-[#6E6E73]">평당</span><input aria-label={`${column.label} 평당`} type="number" value={row[column.unitKey] ?? ''} onChange={(event) => updateCell(identity, column.unitKey, event.target.value)} disabled={!rentRollWriteEnabled} placeholder="—" className="min-w-0 w-full rounded-[6px] border border-transparent bg-[#252524] px-1 py-0.5 text-right text-[11px] tabular-nums text-[#A1A1AA] outline-none focus:border-[#5E9EFF]" /></div></td>;
                      if (column.kind === 'readonlyMoney') return <td key={column.key} className={`${baseClass} text-right`}><p className="px-2 py-1.5 tabular-nums text-white">{formatAmount(row[column.key])}</p><p className="mt-1 px-2 text-[11px] text-[#86868B]">임대료+관리비 / 평</p></td>;
                      if (column.key === 'rent_free_summary') return <td key={column.key} className={baseClass}><div className="flex items-center gap-1"><input aria-label="Rent Free 개월" type="number" value={row.rent_free_months ?? ''} onChange={(event) => updateCell(identity, 'rent_free_months', event.target.value)} disabled={!rentRollWriteEnabled} className="w-16 rounded-[6px] border border-[#343437] bg-[#202020] px-2 py-1.5 text-right tabular-nums text-white outline-none focus:border-[#5E9EFF]" /><span className="text-xs text-[#86868B]">개월</span></div><p className="mt-1 line-clamp-2 text-[11px] leading-4 text-[#86868B]">{humanizeStructuredValue(row.rent_free_schedule) || '일정 —'}</p></td>;
                      if (column.key === 'escalation_summary') return <td key={column.key} className={baseClass}><textarea aria-label="임대료 인상 조건" value={humanizeStructuredValue(row.rent_escalation_rule)} onChange={(event) => updateCell(identity, 'rent_escalation_rule', event.target.value)} disabled={!rentRollWriteEnabled} rows={2} placeholder="인상률·주기" className="w-full resize-none rounded-[6px] border border-[#343437] bg-[#202020] px-2 py-1 text-xs leading-4 text-white outline-none focus:border-[#5E9EFF]" /></td>;
                      if (column.kind === 'textarea') return <td key={column.key} className={baseClass}><textarea value={humanizeStructuredValue(row[column.key])} onChange={(event) => updateCell(identity, column.key, event.target.value)} disabled={!rentRollWriteEnabled} rows={2} className="w-full resize-y rounded-[6px] border border-transparent bg-[#252524] px-2 py-1.5 text-xs leading-5 text-white outline-none hover:border-[#3A3A3C] focus:border-[#5E9EFF] disabled:opacity-50" /></td>;
                      return <td key={column.key} className={baseClass}><input type={column.kind === 'number' ? 'number' : column.kind === 'date' ? 'date' : 'text'} value={row[column.key] ?? ''} onChange={(event) => updateCell(identity, column.key, event.target.value)} disabled={!rentRollWriteEnabled} placeholder="—" className={`w-full rounded-[6px] border border-transparent bg-[#252524] px-2 py-1.5 text-sm text-white outline-none hover:border-[#3A3A3C] focus:border-[#5E9EFF] disabled:opacity-50 ${column.kind === 'number' ? 'text-right tabular-nums' : ''}`} /></td>;
                    })}
                    <td className="sticky right-0 z-20 border-b border-l border-[#333333] bg-[#252524] px-2 py-2 text-center"><div className="flex flex-col gap-1"><button data-testid="rent-roll-detail-toggle" type="button" onClick={() => toggleRowDetail(identity)} aria-expanded={detailOpen} className="rounded-[5px] px-1 py-1 text-xs font-medium text-[#9AD7FF] hover:bg-[#17314E]">{detailOpen ? '접기' : '상세'}</button>{row.operation === 'delete' ? <span className="text-xs text-[#FF9B9B]">삭제 예정</span> : <button data-testid="rent-roll-archive" type="button" onClick={() => archiveRow(identity)} disabled={!rentRollWriteEnabled} className="text-xs text-[#86868B] hover:text-[#FF9B9B] disabled:opacity-35">삭제</button>}</div></td>
                  </tr>
                  {detailOpen ? <tr><td colSpan={RENT_ROLL_COLUMNS.length + 2} className="border-b border-[#3A3A3C] bg-[#1D1D1D] px-5 py-4"><div className="grid gap-x-5 gap-y-3 sm:grid-cols-2 xl:grid-cols-4">{RENT_ROLL_DETAIL_FIELDS.map((field) => <label key={field.key} className={`${field.kind === 'textarea' ? 'xl:col-span-2' : ''} text-[11px] font-medium text-[#86868B]`}>{field.label}{field.kind === 'textarea' ? <textarea value={humanizeStructuredValue(row[field.key])} onChange={(event) => updateCell(identity, field.key, event.target.value)} disabled={!rentRollWriteEnabled} rows={2} placeholder="—" className="mt-1 w-full resize-y rounded-[7px] border border-[#343437] bg-[#252524] px-2.5 py-2 text-xs leading-5 text-white outline-none focus:border-[#5E9EFF]" /> : <input type={field.kind === 'number' ? 'number' : 'text'} value={row[field.key] ?? ''} onChange={(event) => updateCell(identity, field.key, event.target.value)} disabled={!rentRollWriteEnabled} placeholder="—" className={`mt-1 w-full rounded-[7px] border border-[#343437] bg-[#252524] px-2.5 py-2 text-xs text-white outline-none focus:border-[#5E9EFF] ${field.kind === 'number' ? 'text-right tabular-nums' : ''}`} />}</label>)}</div></td></tr> : null}
                  </React.Fragment>
                );
              })}</tbody>
            </table>
          </div>
        ) : <EmptyText />}
      </SectionCard>
    </div>
  );
}

function aggregatePeriod(month, aggregation) {
  if (aggregation === 'year') return month.slice(0, 4);
  if (aggregation === 'quarter') return `${month.slice(0, 4)} Q${Math.floor((Number(month.slice(5, 7)) - 1) / 3) + 1}`;
  return month;
}

function buildFinanceSeries(entries, accounts, startMonth, endMonth, aggregation) {
  const accountByCode = new Map(accounts.map((account) => [account.account_code, account]));
  const monthly = monthsBetween(startMonth, endMonth).map((month) => {
    const monthEntries = entries.filter((entry) => entry.operation !== 'delete' && String(entry.month).slice(0, 7) === month && entry.amount !== '' && Number.isFinite(Number(entry.amount)));
    const sections = {};
    for (const entry of monthEntries) {
      const account = accountByCode.get(entry.account_code);
      if (!account) continue;
      const section = account.statement_section;
      sections[section] = (sections[section] || 0) + (Number(entry.amount) * Number(account.normal_sign || 1));
    }
    const has = monthEntries.length > 0;
    const potential = sections.potential_income || 0;
    const lossSigned = sections.income_loss || 0;
    const other = sections.other_operating_income || 0;
    const operatingSigned = sections.operating_expense || 0;
    const belowNoi = sections.below_noi || 0;
    const debtService = sections.debt_service || 0;
    const effective = potential + lossSigned + other;
    const noi = effective + operatingSigned;
    const assetNcf = noi + belowNoi;
    return {
      period: month,
      has,
      potential_gross_income: has ? potential : null,
      loss: has ? Math.abs(lossSigned) : null,
      effective_gross_income: has ? effective : null,
      operating_expense: has ? Math.abs(operatingSigned) : null,
      net_operating_income: has ? noi : null,
      asset_net_cash_flow: has ? assetNcf : null,
      after_debt_service_cash_flow: has && Object.hasOwn(sections, 'debt_service') ? assetNcf + debtService : null,
    };
  });
  const grouped = new Map();
  for (const item of monthly) {
    const period = aggregatePeriod(item.period, aggregation);
    if (!grouped.has(period)) grouped.set(period, { period, has: false });
    const target = grouped.get(period);
    target.has = target.has || item.has;
    for (const row of NOI_TABLE_ROWS) {
      if (item[row.key] === null) continue;
      target[row.key] = (target[row.key] || 0) + item[row.key];
    }
  }
  return [...grouped.values()].map((item) => {
    if (item.has) return item;
    return { ...item, ...Object.fromEntries(NOI_TABLE_ROWS.map((row) => [row.key, null])) };
  });
}

function buildFinanceTableRows(accounts) {
  const bySection = new Map();
  accounts.forEach((account) => {
    const rows = bySection.get(account.statement_section) || [];
    rows.push({ kind: 'account', key: account.account_code, label: account.name || account.name_ko, account });
    bySection.set(account.statement_section, rows);
  });
  const rows = [];
  const addAccounts = (section) => rows.push(...(bySection.get(section) || []));
  addAccounts('potential_income');
  rows.push({ kind: 'metric', ...NOI_TABLE_ROWS[0] });
  addAccounts('income_loss');
  rows.push({ kind: 'metric', ...NOI_TABLE_ROWS[1] });
  addAccounts('other_operating_income');
  rows.push({ kind: 'metric', ...NOI_TABLE_ROWS[2] });
  addAccounts('operating_expense');
  rows.push({ kind: 'metric', ...NOI_TABLE_ROWS[3] }, { kind: 'metric', ...NOI_TABLE_ROWS[4] });
  addAccounts('below_noi');
  rows.push({ kind: 'metric', ...NOI_TABLE_ROWS[5] });
  addAccounts('debt_service');
  rows.push({ kind: 'metric', ...NOI_TABLE_ROWS[6] });
  return rows;
}

function FinanceTrend({ primaryName, comparisonName, primarySeries, comparisonSeries }) {
  const points = primarySeries.map((item, index) => ({
    period: item.period,
    income: item.effective_gross_income,
    expense: item.operating_expense,
    noi: item.net_operating_income,
    comparisonNoi: comparisonSeries[index]?.period === item.period ? comparisonSeries[index]?.net_operating_income : null,
  }));
  const values = points.flatMap((item) => [item.income, item.expense, item.noi, item.comparisonNoi]).filter((value) => Number.isFinite(Number(value)));
  if (!values.length) return <div data-testid="finance-primary-chart" data-chart="finance-trend"><EmptyText>선택한 기간에 표시할 수익·비용 값이 없습니다.</EmptyText></div>;
  const min = Math.min(0, ...values);
  const max = Math.max(0, ...values);
  const range = max - min || 1;
  const plotLeft = 76;
  const plotRight = 742;
  const plotTop = 22;
  const plotBottom = 184;
  const x = (index) => plotLeft + ((index + 0.5) * ((plotRight - plotLeft) / Math.max(1, points.length)));
  const y = (value) => plotBottom - (((Number(value) - min) / range) * (plotBottom - plotTop));
  const barWidth = Math.max(4, Math.min(18, ((plotRight - plotLeft) / Math.max(1, points.length)) * 0.28));
  const pathFor = (key) => points.map((point, index) => Number.isFinite(Number(point[key])) ? `${index === 0 ? 'M' : 'L'} ${x(index)} ${y(point[key])}` : '').filter(Boolean).join(' ');
  const labelStep = Math.max(1, Math.ceil(points.length / 8));
  const ticks = [max, (max + min) / 2, min];
  return (
    <div data-testid="finance-primary-chart" data-chart="finance-trend">
      <div className="mb-1 flex flex-wrap gap-x-4 gap-y-1 text-[11px]"><span className="text-[#7FB2FF]">■ 유효총수입</span><span className="text-[#6E6E73]">■ 운영비용</span><span className="text-[#7BD5A0]">● NOI · {primaryName}</span>{comparisonName ? <span className="text-[#FFB86B]">┄ NOI · {comparisonName}</span> : null}</div>
      <svg viewBox="0 0 780 224" className="h-[250px] w-full" role="img" aria-label="수익 비용 NOI 시계열">
        {ticks.map((tick) => <g key={tick}><line x1={plotLeft} y1={y(tick)} x2={plotRight} y2={y(tick)} stroke="#303033" strokeWidth="1" /><text x={plotLeft - 8} y={y(tick) + 4} textAnchor="end" fill="#77777D" fontSize="10">{formatAmount(tick)}</text></g>)}
        <text x="10" y="14" fill="#77777D" fontSize="10">원</text>
        <line x1={plotLeft} y1={y(0)} x2={plotRight} y2={y(0)} stroke="#4A4A4D" strokeWidth="1" />
        {points.map((point, index) => <g key={point.period}>{Number.isFinite(Number(point.income)) ? <rect x={x(index) - barWidth - 1} y={y(Math.max(0, point.income))} width={barWidth} height={Math.abs(y(point.income) - y(0))} rx="2" fill="#477CBF"><title>{point.period} · 유효총수입 {formatAmount(point.income)}원</title></rect> : null}{Number.isFinite(Number(point.expense)) ? <rect x={x(index) + 1} y={y(Math.max(0, point.expense))} width={barWidth} height={Math.abs(y(point.expense) - y(0))} rx="2" fill="#56565B"><title>{point.period} · 운영비용 {formatAmount(point.expense)}원</title></rect> : null}{index % labelStep === 0 || index === points.length - 1 ? <text x={x(index)} y="213" textAnchor="middle" fill="#86868B" fontSize="10">{point.period}</text> : null}</g>)}
        <path d={pathFor('noi')} fill="none" stroke="#7BD5A0" strokeWidth="2.5" />
        {comparisonName ? <path d={pathFor('comparisonNoi')} fill="none" stroke="#FFB86B" strokeDasharray="7 5" strokeWidth="2" /> : null}
        {points.map((point, index) => Number.isFinite(Number(point.noi)) ? <circle key={`${point.period}-noi`} cx={x(index)} cy={y(point.noi)} r="3" fill="#7BD5A0"><title>{primaryName} · {point.period} · NOI {formatAmount(point.noi)}원</title></circle> : null)}
      </svg>
    </div>
  );
}

function FinancePanel({ assetKey, assets }) {
  const [startMonth, setStartMonth] = useState(() => addMonths(currentMonthKst(), -11));
  const [endMonth, setEndMonth] = useState(() => currentMonthKst());
  const [basis, setBasis] = useState('accrual');
  const [aggregation, setAggregation] = useState('month');
  const [comparisonAssetKey, setComparisonAssetKey] = useState('');
  const payload = useMemo(() => ({ asset_key: assetKey, from_month: startMonth, to_month: endMonth, scenario: 'actual', accounting_basis: basis }), [assetKey, basis, endMonth, startMonth]);
  const comparisonPayload = useMemo(() => ({ asset_key: comparisonAssetKey, from_month: startMonth, to_month: endMonth, scenario: 'actual', accounting_basis: basis }), [basis, comparisonAssetKey, endMonth, startMonth]);
  const resource = usePrimaryResource(DATA_PLATFORM_ACTIONS.financeRead, payload, { enabled: Boolean(assetKey) });
  const comparisonResource = usePrimaryResource(DATA_PLATFORM_ACTIONS.financeRead, comparisonPayload, { enabled: Boolean(comparisonAssetKey && comparisonAssetKey !== assetKey) });
  const [entries, setEntries] = useState([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [message, setMessage] = useState('');
  const [pendingSaveRevision, setPendingSaveRevision] = useState(null);
  const financeWriteEnabled = resource.data?.write_enabled === true;
  const financeWriteLockReason = resource.data?.write_reason;
  const accounts = useMemo(() => (Array.isArray(resource.data?.accounts) ? resource.data.accounts : []), [resource.data?.accounts]);
  const comparisonEntries = useMemo(
    () => (Array.isArray(comparisonResource.data?.entries) ? comparisonResource.data.entries : []),
    [comparisonResource.data?.entries],
  );

  useEffect(() => {
    setEntries(Array.isArray(resource.data?.entries) ? resource.data.entries.map((row) => ({
      ...row,
      month: String(row.month || '').slice(0, 7),
      operation: 'update',
      reason: row.reason || '웹 NOI 표 입력값 수정',
    })) : []);
  }, [resource.data]);
  useEffect(() => {
    if (comparisonAssetKey === assetKey) setComparisonAssetKey('');
  }, [assetKey, comparisonAssetKey]);
  useEffect(() => {
    if (pendingSaveRevision === null || resource.loading || resource.error) return;
    if (Number(resource.revision) < Number(pendingSaveRevision)) return;
    setMessage(`저장·재조회 완료 · revision ${resource.revision}`);
    setPendingSaveRevision(null);
  }, [pendingSaveRevision, resource.error, resource.loading, resource.revision]);

  const entryErrors = useMemo(() => validateManualFinanceEntries(entries, accounts), [accounts, entries]);
  const months = useMemo(() => monthsBetween(startMonth, endMonth), [endMonth, startMonth]);
  const primarySeries = useMemo(() => buildFinanceSeries(entries, accounts, startMonth, endMonth, aggregation), [accounts, aggregation, endMonth, entries, startMonth]);
  const comparisonAccounts = useMemo(
    () => (Array.isArray(comparisonResource.data?.accounts) ? comparisonResource.data.accounts : accounts),
    [accounts, comparisonResource.data?.accounts],
  );
  const comparisonSeries = useMemo(() => buildFinanceSeries(comparisonEntries, comparisonAccounts, startMonth, endMonth, aggregation), [aggregation, comparisonAccounts, comparisonEntries, endMonth, startMonth]);
  const tableRows = useMemo(() => buildFinanceTableRows(accounts), [accounts]);
  const periods = primarySeries.map((item) => item.period);
  const selectedAsset = assets.find((asset) => asset.asset_key === assetKey);
  const comparisonAsset = assets.find((asset) => asset.asset_key === comparisonAssetKey);
  const totalMetric = (series, key) => {
    const values = series.map((item) => item[key]).filter((value) => value !== null && value !== undefined && Number.isFinite(Number(value)));
    return values.length ? values.reduce((sum, value) => sum + Number(value), 0) : null;
  };
  const primaryTotals = Object.fromEntries(NOI_TABLE_ROWS.map((row) => [row.key, totalMetric(primarySeries, row.key)]));
  const comparisonTotals = Object.fromEntries(NOI_TABLE_ROWS.map((row) => [row.key, totalMetric(comparisonSeries, row.key)]));
  const noiMargin = primaryTotals.effective_gross_income
    ? (Number(primaryTotals.net_operating_income || 0) / Number(primaryTotals.effective_gross_income)) * 100
    : null;

  const findEntry = (accountCode, month) => entries.find((entry) => entry.account_code === accountCode && String(entry.month).slice(0, 7) === month && entry.operation !== 'delete');
  const updateCell = (account, month, value) => {
    if (!financeWriteEnabled) return;
    setEntries((rows) => {
      const existingIndex = rows.findIndex((entry) => entry.account_code === account.account_code && String(entry.month).slice(0, 7) === month);
      if (existingIndex >= 0) {
        if (value === '' && rows[existingIndex].operation === 'create') return rows.filter((_, index) => index !== existingIndex);
        return rows.map((entry, index) => index === existingIndex ? { ...entry, amount: value, operation: value === '' ? 'delete' : 'update', reason: '웹 NOI 표 입력값 수정' } : entry);
      }
      if (value === '') return rows;
      return [...rows, {
        _draft_id: `finance-${month}-${account.account_code}-${Date.now()}`,
        operation: 'create', month, account_code: account.account_code, amount: value,
        scenario: 'actual', accounting_basis: basis, reason: '웹 NOI 표 직접 입력',
      }];
    });
  };
  const accountAggregateValue = (accountCode, period) => {
    const periodMonths = months.filter((month) => aggregatePeriod(month, aggregation) === period);
    const values = periodMonths.map((month) => findEntry(accountCode, month)?.amount).filter((value) => value !== undefined && value !== null && value !== '');
    return values.length ? values.reduce((sum, value) => sum + Number(value), 0) : null;
  };
  const save = async () => {
    if (!financeWriteEnabled || entryErrors.length) return;
    setSaving(true);
    setSaveError(null);
    setMessage('');
    try {
      const response = await invokeDataPlatform(DATA_PLATFORM_ACTIONS.financeBatchSave, {
        asset_key: assetKey,
        client_request_id: createClientRequestId('finance'),
        expected_revision: resource.revision,
        expected_revisions: Object.fromEntries(entries.filter((row) => row.entry_key && row.revision).map((row) => [row.entry_key, row.revision])),
        entries: entries.map(financeEntryForSave),
      });
      setMessage('저장값을 다시 확인하는 중입니다.');
      setPendingSaveRevision(response.revision);
      resource.reload();
    } catch (error) {
      setSaveError(error);
    } finally {
      setSaving(false);
    }
  };

  if (!assetKey) return <EmptyText>먼저 조회할 자산을 선택해 주세요.</EmptyText>;
  return (
    <div className="space-y-4">
      <LoadingLine visible={resource.loading || comparisonResource.loading} />
      <ErrorNotice error={resource.error || comparisonResource.error || saveError} />
      <div className="flex flex-wrap items-end gap-3 rounded-[14px] border border-[#333333] bg-[#242423] px-4 py-3">
        <label className="min-w-[150px] flex-1 text-[11px] font-medium text-[#86868B]">시작 월<input type="month" value={startMonth} onChange={(event) => setStartMonth(event.target.value)} className="mt-1 block w-full rounded-[7px] border border-[#3A3A3C] bg-[#1F1F1E] px-2.5 py-2 text-sm text-white outline-none focus:border-[#5E9EFF]" /></label>
        <label className="min-w-[150px] flex-1 text-[11px] font-medium text-[#86868B]">종료 월<input type="month" value={endMonth} onChange={(event) => setEndMonth(event.target.value)} className="mt-1 block w-full rounded-[7px] border border-[#3A3A3C] bg-[#1F1F1E] px-2.5 py-2 text-sm text-white outline-none focus:border-[#5E9EFF]" /></label>
        <label className="min-w-[138px] flex-1 text-[11px] font-medium text-[#86868B]">회계 기준<select value={basis} onChange={(event) => setBasis(event.target.value)} className="mt-1 block w-full rounded-[7px] border border-[#3A3A3C] bg-[#1F1F1E] px-2.5 py-2 text-sm text-white outline-none focus:border-[#5E9EFF]"><option value="accrual">발생</option><option value="cash">현금</option></select></label>
        <label className="min-w-[138px] flex-1 text-[11px] font-medium text-[#86868B]">집계 단위<select data-testid="finance-aggregation" value={aggregation} onChange={(event) => setAggregation(event.target.value)} className="mt-1 block w-full rounded-[7px] border border-[#3A3A3C] bg-[#1F1F1E] px-2.5 py-2 text-sm text-white outline-none focus:border-[#5E9EFF]"><option value="month">월</option><option value="quarter">분기</option><option value="year">연</option></select></label>
        <label className="min-w-[220px] flex-[1.4] text-[11px] font-medium text-[#86868B]">비교 자산<select data-testid="finance-comparison-asset" value={comparisonAssetKey} onChange={(event) => setComparisonAssetKey(event.target.value)} className="mt-1 block w-full rounded-[7px] border border-[#3A3A3C] bg-[#1F1F1E] px-2.5 py-2 text-sm text-white outline-none focus:border-[#5E9EFF]"><option value="">비교 안 함</option>{assets.filter((asset) => asset.asset_key !== assetKey).map((asset) => <option key={asset.asset_key} value={asset.asset_key}>{asset.name || asset.name_ko || asset.asset_code}</option>)}</select></label>
      </div>

      <section data-testid="finance-kpi-strip" className="grid grid-cols-2 gap-px overflow-hidden rounded-[14px] border border-[#333333] bg-[#333333] lg:grid-cols-5">
        {[
          ['잠재총수입', primaryTotals.potential_gross_income, null],
          ['유효총수입', primaryTotals.effective_gross_income, null],
          ['운영비용', primaryTotals.operating_expense, null],
          ['순영업소득', primaryTotals.net_operating_income, comparisonTotals.net_operating_income],
          ['NOI 마진', noiMargin, null],
        ].map(([label, value, comparison], index) => <div key={label} className={`bg-[#242423] px-4 py-3.5 ${index === 3 ? 'shadow-[inset_0_2px_0_#5E9EFF]' : ''}`}><p className="text-[11px] font-medium text-[#86868B]">{label}</p><p className={`mt-1.5 text-lg font-semibold tabular-nums ${index === 3 ? 'text-[#9AD7FF]' : 'text-white'}`}>{label === 'NOI 마진' ? (value == null ? '—' : `${value.toFixed(1)}%`) : (value == null ? '—' : `${formatAmount(value)} 원`)}</p>{comparison != null && value != null ? <p className={`mt-1 text-[11px] tabular-nums ${value - comparison >= 0 ? 'text-[#7BD5A0]' : 'text-[#FF9B9B]'}`}>비교 대비 {value - comparison >= 0 ? '+' : ''}{formatAmount(value - comparison)}</p> : <p className="mt-1 text-[11px] text-[#5F5F64]">{startMonth} ~ {endMonth}</p>}</div>)}
      </section>

      <div className="grid gap-4 xl:grid-cols-[1.35fr_0.65fr]">
        <SectionCard title="수익·비용 및 NOI 추이">
          <FinanceTrend primaryName={selectedAsset?.name || selectedAsset?.name_ko || selectedAsset?.asset_code || '선택 자산'} comparisonName={comparisonAsset?.name || comparisonAsset?.name_ko || comparisonAsset?.asset_code || ''} primarySeries={primarySeries} comparisonSeries={comparisonSeries} />
        </SectionCard>
        <SectionCard title="자산 비교">
          <div className="overflow-x-auto"><table data-testid="finance-comparison-table" className="w-full min-w-[500px] text-sm"><thead><tr className="text-[11px] text-[#86868B]"><th className="border-b border-[#333333] px-2 py-2 text-left">지표</th><th className="border-b border-[#333333] px-2 py-2 text-right">선택</th><th className="border-b border-[#333333] px-2 py-2 text-right">비교</th><th className="border-b border-[#333333] px-2 py-2 text-right">차이</th></tr></thead><tbody>{NOI_TABLE_ROWS.map((row) => {
            const primary = primaryTotals[row.key];
            const comparison = comparisonTotals[row.key];
            const difference = primary != null && comparison != null ? primary - comparison : null;
            return <tr key={row.key} className={row.key === 'net_operating_income' ? 'bg-[#17314E]/50' : ''}><td className={`border-b border-[#333333] px-2 py-2.5 ${row.key === 'net_operating_income' ? 'font-semibold text-[#9AD7FF]' : 'text-[#D1D1D6]'}`}>{row.label}</td><td className="border-b border-[#333333] px-2 py-2.5 text-right tabular-nums text-white">{formatAmount(primary)}</td><td className="border-b border-[#333333] px-2 py-2.5 text-right tabular-nums text-[#D1D1D6]">{formatAmount(comparison)}</td><td className={`border-b border-[#333333] px-2 py-2.5 text-right tabular-nums ${difference == null ? 'text-[#6E6E73]' : difference >= 0 ? 'text-[#7BD5A0]' : 'text-[#FF9B9B]'}`}>{difference == null ? '—' : `${difference >= 0 ? '+' : ''}${formatAmount(difference)}`}</td></tr>;
          })}</tbody></table></div>
        </SectionCard>
      </div>

      <SectionCard title="NOI 손익표 · 직접 입력" action={<button data-testid="finance-save" type="button" onClick={save} disabled={saving || !financeWriteEnabled || entryErrors.length > 0} className="rounded-[8px] border border-[#2C66A2] bg-[#17314E] px-4 py-2 text-sm font-semibold text-[#9AD7FF] disabled:opacity-35">{saving ? '저장 중' : '변경 저장'}</button>}>
        {!financeWriteEnabled && financeWriteLockReason ? <p className="mb-3 text-xs text-[#86868B]">{financeWriteLockReason}</p> : null}
        {entryErrors.length ? <div className="mb-3 text-xs leading-5 text-[#FFB4B4]">{entryErrors.slice(0, 8).map((error) => <p key={error}>{error}</p>)}</div> : null}
        {message ? <p className="mb-3 text-xs text-[#8FD3A7]">{message}</p> : null}
        <div className="max-h-[620px] overflow-auto rounded-[10px] border border-[#333333]">
          <table data-testid="finance-statement-table" className="w-max min-w-full border-separate border-spacing-0 text-sm">
            <thead><tr><th className="sticky left-0 top-0 z-30 min-w-[250px] border-b border-r border-[#333333] bg-[#202020] px-3 py-2.5 text-left text-xs font-semibold text-[#A1A1AA]">NOI 단계 / 계정과목</th>{periods.map((period) => <th key={period} className="sticky top-0 z-20 min-w-[138px] border-b border-[#333333] bg-[#202020] px-3 py-2.5 text-right text-xs font-semibold text-[#A1A1AA]">{period}</th>)}</tr></thead>
            <tbody>{tableRows.map((row) => <tr key={`${row.kind}-${row.key}`} className={row.kind === 'metric' ? 'font-semibold' : ''}><th className={`sticky left-0 z-10 border-b border-r px-3 text-left ${row.kind === 'metric' ? `border-[#414145] py-2.5 ${row.key === 'net_operating_income' ? 'bg-[#17314E] text-[#9AD7FF]' : 'bg-[#202020] text-white'}` : 'border-[#303033] bg-[#252524] py-2 text-[#D1D1D6]'}`}>{row.kind === 'account' ? <span className="flex items-center gap-2"><span className="h-4 w-0.5 rounded bg-[#4A78A8]" /><span className="min-w-0 flex-1 truncate">{row.label}</span><span className="rounded bg-[#303033] px-1.5 py-0.5 text-[9px] font-normal text-[#86868B]">입력</span></span> : row.label}</th>{periods.map((period, periodIndex) => {
              if (row.kind === 'metric') return <td key={period} className={`border-b border-[#414145] px-3 py-2.5 text-right tabular-nums ${row.key === 'net_operating_income' ? 'bg-[#17314E] text-[#9AD7FF]' : 'bg-[#202020] text-white'}`}>{formatAmount(primarySeries[periodIndex]?.[row.key])}</td>;
              if (aggregation !== 'month') return <td key={period} className="border-b border-[#303033] bg-[#252524] px-3 py-2 text-right tabular-nums text-[#D1D1D6]">{formatAmount(accountAggregateValue(row.key, period))}</td>;
              const entry = findEntry(row.key, period);
              return <td key={period} className="border-b border-[#303033] bg-[#222A32] px-2 py-1.5"><input aria-label={`${row.label} ${period}`} type="number" value={entry?.operation === 'delete' ? '' : entry?.amount ?? ''} onChange={(event) => updateCell(row.account, period, event.target.value)} disabled={!financeWriteEnabled} className="w-full rounded-[6px] border border-[#35414E] bg-[#1D252D] px-2 py-1.5 text-right tabular-nums text-white outline-none focus:border-[#5E9EFF] disabled:opacity-50" placeholder="—" /></td>;
            })}</tr>)}</tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}

function activeTabFromPath(currentPath) {
  const normalized = normalizeLogisticsPath(currentPath);
  const lastPart = normalized.split('/').at(-1);
  return DATA_PLATFORM_TAB_KEYS.has(lastPart) ? lastPart : 'home';
}

export default function LogisticsDataPlatform({ currentPath = '' }) {
  const activeTab = activeTabFromPath(currentPath);
  const [assetKey, setAssetKey] = useState(() => sessionStorage.getItem('gate6-data-platform-asset-key') || '');
  const [showMaturities, setShowMaturities] = useState(false);
  const homePayload = useMemo(() => ({ ...(assetKey ? { asset_key: assetKey } : {}), as_of_date: todayKst() }), [assetKey]);
  const homeResource = usePrimaryResource(DATA_PLATFORM_ACTIONS.homeRead, homePayload);
  const assets = useMemo(() => (Array.isArray(homeResource.data?.assets) ? homeResource.data.assets : []), [homeResource.data?.assets]);
  const maturityPayload = useMemo(() => ({ asset_key: assetKey, from_date: todayKst(), to_date: addDays(todayKst(), 365) }), [assetKey]);
  const maturities = usePrimaryResource(DATA_PLATFORM_ACTIONS.maturitiesRead, maturityPayload, { enabled: Boolean(assetKey) });
  const maturityRows = normalizeMaturityRows(maturities.data);

  useEffect(() => {
    if (!assetKey && assets.length) setAssetKey(assets[0].asset_key);
  }, [assetKey, assets]);
  useEffect(() => {
    if (assetKey) sessionStorage.setItem('gate6-data-platform-asset-key', assetKey);
  }, [assetKey]);

  return (
    <main data-testid="logistics-data-platform" className="logistics-data-platform min-h-full bg-[#1F1F1E] text-[#E5E5E5]">
      <header className="border-b border-[#333333] bg-[#1F1F1E]">
        <div className="mx-auto max-w-[1680px] px-8 py-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h1 className="text-[26px] font-semibold tracking-tight text-white">{DATA_PLATFORM_PAGE_TITLES[activeTab]}</h1>
            <div className="relative flex flex-wrap items-end justify-end gap-2">
              <label className="flex min-w-64 flex-col gap-1 text-xs font-medium text-[#A1A1AA]">담당 자산<select data-testid="data-platform-asset-select" value={assetKey} onChange={(event) => setAssetKey(event.target.value)} className="rounded-[8px] border border-[#3A3A3C] bg-[#252524] px-3 py-2 text-sm font-medium text-white outline-none focus:border-[#5E9EFF]"><option value="">자산 선택</option>{assets.map((asset) => <option key={asset.asset_key} value={asset.asset_key}>{asset.name || asset.name_ko || asset.asset_code}</option>)}</select></label>
              <button data-testid="data-platform-maturity-button" type="button" onClick={() => setShowMaturities((current) => !current)} className="rounded-[8px] border border-[#3A3A3C] bg-[#252524] px-3 py-2 text-sm font-semibold text-[#D1D1D6] hover:border-[#5E9EFF] hover:text-white" aria-expanded={showMaturities} aria-haspopup="dialog">만기 알림 {maturityRows.length}</button>
              {showMaturities ? (
                <section className="absolute right-0 top-full z-50 mt-2 w-[min(54rem,calc(100vw-2.5rem))] rounded-[16px] border border-[#3A3A3C] bg-[#252524] p-4 shadow-2xl" role="dialog" aria-label="만기 알림">
                  <div className="mb-3 flex items-center justify-between gap-3"><h2 className="text-sm font-semibold text-white">1년 이내 만기</h2><button type="button" onClick={() => setShowMaturities(false)} className="rounded-[6px] px-2 py-1 text-xs text-[#A1A1AA] hover:bg-[#333333] hover:text-white">닫기</button></div>
                  <LoadingLine visible={maturities.loading} />
                  <ErrorNotice error={maturities.error} />
                  <MaturityList rows={maturityRows} />
                </section>
              ) : null}
            </div>
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-[1680px] px-8 py-6">
        {activeTab === 'home' ? <HomePanel key={`home-${assetKey}`} assetKey={assetKey} homeResource={homeResource} maturities={maturities} /> : null}
        {activeTab === 'rent-roll' ? <RentRollPanel key={`rent-roll-${assetKey}`} assetKey={assetKey} /> : null}
        {activeTab === 'income-expense' ? <FinancePanel key={`income-expense-${assetKey}`} assetKey={assetKey} assets={assets} /> : null}
      </div>
    </main>
  );
}
