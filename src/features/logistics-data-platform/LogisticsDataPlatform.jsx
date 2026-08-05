import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  LOGISTICS_INTERNAL_BASE,
  normalizeLogisticsPath,
  pathForLogisticsUrl,
} from '../../components/system/workspace/logisticsRoutes';
import {
  DATA_PLATFORM_ACTIONS,
  createClientRequestId,
  invokeDataPlatform,
  usePrimaryResource,
} from './api';
import {
  FINANCE_WATERFALL_LABELS,
  FINANCE_WATERFALL_KEYS,
} from './formulas';
import {
  emptyManualFinanceEntry,
  financeEntryForSave,
  validateManualFinanceEntries,
} from './financeSchema';
import {
  emptyRentRollRow,
  RENT_ROLL_COLUMN_GROUPS,
  RENT_ROLL_PASTE_COLUMNS,
  validateUniversalRentRoll,
} from './rentRollSchema';

const TABS = Object.freeze([
  { key: 'home', label: '홈' },
  { key: 'rent-roll', label: '렌트롤' },
  { key: 'income-expense', label: '수익·비용' },
]);

const IN_APP_MATURITY_ALERT = 'in_app_maturity_alert';
const CALCULATION_AUTHORITY = 'v2/calculations/explain';

const FINANCE_COLUMNS = Object.freeze([
  ['month', '월'],
  ['account_code', '계정 코드'],
  ['amount', '금액'],
  ['scenario', '구분'],
  ['accounting_basis', '회계 기준'],
  ['reason', '입력·조정 사유'],
]);

function todayKst() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
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

function formatAmount(value) {
  if (value === null || value === undefined || value === '' || !Number.isFinite(Number(value))) return '—';
  return new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 0 }).format(Number(value));
}

function valueOrDash(value) {
  return value === null || value === undefined || value === '' ? '—' : String(value);
}

function withoutDraftId(row) {
  return Object.fromEntries(Object.entries(row).filter(([key]) => key !== '_draft_id'));
}

function ErrorNotice({ error }) {
  if (!error) return null;
  return (
    <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800" role="alert">
      <strong className="font-semibold">운영 데이터 조회 실패</strong>
      <p className="mt-1">{error.message || '요청을 완료하지 못했습니다.'}</p>
    </div>
  );
}

function WriteLockNotice({ visible, reason, testId }) {
  if (!visible) return null;
  return (
    <div data-testid={testId} className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900" role="status">
      <strong className="font-semibold">현재 편집이 잠겨 있습니다.</strong>
      <p className="mt-1">{String(reason || '서버에서 쓰기 기능을 열기 전까지 조회만 가능합니다.')}</p>
    </div>
  );
}

function LoadingLine({ visible }) {
  if (!visible) return null;
  return <div className="h-1 w-full animate-pulse rounded-full bg-emerald-500" aria-label="데이터를 불러오는 중" />;
}

function EmptyState({ children }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center text-sm text-slate-500">
      {children}
    </div>
  );
}

function SectionCard({ title, description, children, action = null }) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-950">{title}</h2>
          {description ? <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function HomePanel({ assetKey, homeResource, maturities }) {
  const data = homeResource.data || {};
  const asset = data.asset || null;
  const kpis = Array.isArray(data.kpis) ? data.kpis : [];
  const maturityRows = Array.isArray(maturities.data?.rows) ? maturities.data.rows : [];
  const loanRows = Array.isArray(data.loans) ? data.loans : [];

  return (
    <div className="space-y-5">
      <LoadingLine visible={homeResource.loading || maturities.loading} />
      <ErrorNotice error={homeResource.error || maturities.error} />
      {!assetKey ? <EmptyState>조회 가능한 담당 자산이 없습니다.</EmptyState> : null}
      {assetKey ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {kpis.length ? kpis.map((kpi) => (
              <div key={kpi.key || kpi.label} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-xs font-medium text-slate-500">{valueOrDash(kpi.label)}</p>
                <p className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">
                  {valueOrDash(kpi.display_value ?? kpi.value)}
                </p>
                <p className="mt-2 text-xs text-slate-400">출처: {valueOrDash(kpi.source_label)}</p>
              </div>
            )) : (
              <div className="sm:col-span-2 xl:col-span-4"><EmptyState>검증이 끝난 핵심 지표가 없습니다.</EmptyState></div>
            )}
          </div>
          <div className="grid gap-5 xl:grid-cols-[1.2fr_1fr]">
            <SectionCard title="자산 정보" description="승인된 자산 원장의 현재 값입니다.">
              {asset ? (
                <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
                  {[
                    ['자산명', asset.name_ko],
                    ['자산 코드', asset.asset_code],
                    ['주소', asset.address],
                    ['연면적', asset.gross_floor_area],
                    ['임대 가능 면적', asset.leasable_area],
                    ['현재 평가액', asset.current_valuation],
                  ].map(([label, value]) => (
                    <div key={label} className="border-b border-slate-100 pb-3">
                      <dt className="text-xs text-slate-500">{label}</dt>
                      <dd className="mt-1 text-sm font-medium text-slate-900">{valueOrDash(value)}</dd>
                    </div>
                  ))}
                </dl>
              ) : <EmptyState>확인된 자산 상세값이 없습니다.</EmptyState>}
            </SectionCard>
            <SectionCard title="다가오는 만기" description="로그인 후 확인하는 인앱 알림입니다. 임대차·펀드·대출의 공식 만기만 표시합니다.">
              <span className="sr-only">{IN_APP_MATURITY_ALERT}</span>
              {maturityRows.length ? (
                <div className="space-y-2">
                  {maturityRows.slice(0, 8).map((row) => (
                    <div key={row.maturity_id || `${row.kind}-${row.maturity_date}`} className="flex items-center justify-between gap-4 rounded-2xl bg-slate-50 px-4 py-3">
                      <div>
                        <p className="text-sm font-medium text-slate-900">{valueOrDash(row.title || row.subject_name)}</p>
                        <p className="mt-1 text-xs text-slate-500">{valueOrDash(row.kind_label || row.kind)}</p>
                      </div>
                      <time className="text-sm font-semibold text-slate-700">{valueOrDash(row.maturity_date)}</time>
                    </div>
                  ))}
                </div>
              ) : <EmptyState>조회 기간 안에 확인된 만기가 없습니다.</EmptyState>}
            </SectionCard>
          </div>
          <SectionCard title="기존 대출 원장" description="기존 Supabase 대출 자료를 읽기 전용으로 연결합니다. 월별 상환일정을 새로 만들거나 추정하지 않습니다.">
            {loanRows.length ? (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {loanRows.map((loan) => (
                  <article key={loan.loan_key || loan.row_key} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-sm font-semibold text-slate-950">{valueOrDash(loan.name || loan.tranche)}</p>
                    <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
                      <dt className="text-slate-500">대주</dt><dd className="text-right text-slate-800">{valueOrDash(loan.lender_name || loan.party_name)}</dd>
                      <dt className="text-slate-500">약정·인출액</dt><dd className="text-right text-slate-800">{formatAmount(loan.commitment_amount || loan.committed_amount_krw)}</dd>
                      <dt className="text-slate-500">만기</dt><dd className="text-right text-slate-800">{valueOrDash(loan.maturity_date)}</dd>
                      <dt className="text-slate-500">금리</dt><dd className="text-right text-slate-800">{valueOrDash(loan.loan_rate || loan.interest_rate)}</dd>
                    </dl>
                  </article>
                ))}
              </div>
            ) : <EmptyState>기존 대출 원장에서 연결된 행이 없습니다.</EmptyState>}
          </SectionCard>
        </>
      ) : null}
    </div>
  );
}

function parseRentRollClipboard(text) {
  const lines = String(text || '').split(/\r?\n/).filter((line) => line.trim());
  return lines.map((line, index) => {
    const values = line.split('\t');
    const row = emptyRentRollRow(`paste-${Date.now()}-${index}`);
    RENT_ROLL_PASTE_COLUMNS.forEach((key, columnIndex) => {
      row[key] = values[columnIndex]?.trim() || '';
    });
    return row;
  });
}

function RentRollPanel({ assetKey }) {
  const payload = useMemo(() => ({ asset_key: assetKey, include_archived: false, limit: 200 }), [assetKey]);
  const resource = usePrimaryResource(DATA_PLATFORM_ACTIONS.rentRollRead, payload, { enabled: Boolean(assetKey) });
  const [draftRows, setDraftRows] = useState([]);
  const [clipboard, setClipboard] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [saveError, setSaveError] = useState(null);
  const [activeColumnGroup, setActiveColumnGroup] = useState('core');
  const rentRollWriteEnabled = resource.data?.write_enabled === true;
  const rentRollWriteLockReason = resource.data?.reason;

  useEffect(() => {
    const rows = Array.isArray(resource.data?.rows) ? resource.data.rows : [];
    setDraftRows(rows.map((row) => ({ ...row, operation: 'update' })));
  }, [resource.data]);

  const validationErrors = useMemo(() => validateUniversalRentRoll(draftRows), [draftRows]);
  const visibleGroup = RENT_ROLL_COLUMN_GROUPS.find((group) => group.key === activeColumnGroup)
    || RENT_ROLL_COLUMN_GROUPS[0];
  const updateCell = (index, key, value) => {
    if (!rentRollWriteEnabled) return;
    setDraftRows((rows) => rows.map((row, rowIndex) => (
      rowIndex === index ? { ...row, [key]: value } : row
    )));
  };
  const addRow = () => {
    if (!rentRollWriteEnabled) return;
    setDraftRows((rows) => [...rows, emptyRentRollRow(`new-${Date.now()}`)]);
  };
  const archiveRow = (index) => {
    if (!rentRollWriteEnabled) return;
    setDraftRows((rows) => rows.map((row, rowIndex) => (
      rowIndex === index ? { ...row, operation: 'delete' } : row
    )));
  };
  const pasteRows = () => {
    if (!rentRollWriteEnabled) return;
    const parsed = parseRentRollClipboard(clipboard);
    if (!parsed.length) return;
    setDraftRows((rows) => [...rows, ...parsed]);
    setClipboard('');
  };
  const save = async () => {
    if (!assetKey || !rentRollWriteEnabled || validationErrors.length) return;
    setSaving(true);
    setMessage('');
    setSaveError(null);
    try {
      const response = await invokeDataPlatform(DATA_PLATFORM_ACTIONS.rentRollBatchSave, {
        asset_key: assetKey,
        client_request_id: createClientRequestId('rent-roll'),
        expected_revision: resource.revision,
        expected_revisions: Object.fromEntries(draftRows
          .filter((row) => row.row_key && row.revision)
          .map((row) => [row.row_key, row.revision])),
        rows: draftRows.map(withoutDraftId),
      });
      setMessage(`저장 후 readback 확인 완료 · revision ${response.revision}`);
      resource.reload();
    } catch (error) {
      setSaveError(error);
    } finally {
      setSaving(false);
    }
  };

  if (!assetKey) return <EmptyState>먼저 조회할 자산을 선택해 주세요.</EmptyState>;
  return (
    <div className="space-y-5">
      <LoadingLine visible={resource.loading} />
      <ErrorNotice error={resource.error || saveError} />
      <WriteLockNotice
        visible={Boolean(resource.data) && !rentRollWriteEnabled}
        reason={rentRollWriteLockReason}
        testId="rent-roll-write-lock"
      />
      <SectionCard
        title="렌트롤 편집"
        description="한 번의 저장 요청은 전체가 함께 반영되거나, 오류가 있으면 전부 취소됩니다. 삭제는 복구 가능한 아카이브로 처리됩니다."
        action={(
          <div className="flex gap-2">
            <button data-testid="rent-roll-add" type="button" onClick={addRow} disabled={!rentRollWriteEnabled} className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40">행 추가</button>
            <button data-testid="rent-roll-save" type="button" onClick={save} disabled={saving || !rentRollWriteEnabled || validationErrors.length > 0} className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40">
              {saving ? '저장 중' : '변경 저장'}
            </button>
          </div>
        )}
      >
        <div className="mb-4 flex flex-wrap gap-2" role="tablist" aria-label="렌트롤 열 그룹">
          {RENT_ROLL_COLUMN_GROUPS.map((group) => (
            <button
              key={group.key}
              type="button"
              role="tab"
              aria-selected={activeColumnGroup === group.key}
              onClick={() => setActiveColumnGroup(group.key)}
              className={`rounded-xl px-3 py-2 text-sm font-semibold ${activeColumnGroup === group.key ? 'bg-slate-950 text-white' : 'border border-slate-300 bg-white text-slate-600 hover:bg-slate-50'}`}
            >
              {group.label}
            </button>
          ))}
        </div>
        <p className="mb-4 text-xs leading-5 text-slate-500">{visibleGroup.description}</p>
        <div className="mb-4 grid gap-3 lg:grid-cols-[1fr_auto]">
          <textarea
            data-testid="rent-roll-paste-input"
            value={clipboard}
            onChange={(event) => setClipboard(event.target.value)}
            disabled={!rentRollWriteEnabled}
            rows={2}
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-600"
            placeholder="임대상태, 임차인, 용도, 층, 구역, 전용·공용·임대면적, 계약개시·만기, 보증금, 월 임대료, 월 관리비 순서로 붙여넣으세요."
            aria-label="다중 붙여넣기 입력"
          />
          <button data-testid="rent-roll-paste" type="button" onClick={pasteRows} disabled={!rentRollWriteEnabled} className="rounded-xl border border-emerald-700 px-4 py-2 text-sm font-semibold text-emerald-800 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-40">다중 붙여넣기</button>
        </div>
        {validationErrors.length ? (
          <div className="mb-4 rounded-xl bg-amber-50 px-4 py-3 text-xs text-amber-900">
            {validationErrors.slice(0, 8).map((error) => <p key={error}>{error}</p>)}
          </div>
        ) : null}
        {message ? <p className="mb-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{message}</p> : null}
        {draftRows.length ? (
          <div className="overflow-x-auto">
            <table className="min-w-[1180px] w-full border-separate border-spacing-0 text-left text-sm">
              <thead><tr>{visibleGroup.columns.map(({ key, label }) => <th key={key} className="sticky top-0 border-b border-slate-200 bg-slate-50 px-3 py-3 text-xs font-semibold text-slate-600">{label}</th>)}<th className="sticky right-0 top-0 border-b border-slate-200 bg-slate-50 px-3 py-3">상태</th></tr></thead>
              <tbody>
                {draftRows.map((row, index) => (
                  <tr key={row.row_key || row._draft_id || index} className={row.operation === 'delete' ? 'opacity-45' : ''}>
                    {visibleGroup.columns.map((column) => (
                      <td key={column.key} className="border-b border-slate-100 px-2 py-2 align-top">
                        {column.kind === 'select' ? (
                          <select value={row[column.key] ?? ''} onChange={(event) => updateCell(index, column.key, event.target.value)} disabled={!rentRollWriteEnabled || row.operation === 'delete'} className="w-full min-w-28 rounded-lg border border-slate-200 bg-white px-2 py-1.5 outline-none focus:border-emerald-600 disabled:opacity-60">
                            {column.options.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                          </select>
                        ) : column.kind === 'textarea' ? (
                          <textarea rows={2} value={row[column.key] ?? ''} onChange={(event) => updateCell(index, column.key, event.target.value)} disabled={!rentRollWriteEnabled || row.operation === 'delete'} className="w-full min-w-52 resize-y rounded-lg border border-slate-200 bg-white px-2 py-1.5 outline-none focus:border-emerald-600 disabled:opacity-60" />
                        ) : (
                          <input type={column.kind === 'number' ? 'number' : column.kind} step={column.kind === 'number' ? 'any' : undefined} value={row[column.key] ?? ''} onChange={(event) => updateCell(index, column.key, event.target.value)} disabled={!rentRollWriteEnabled || row.operation === 'delete'} className="w-full min-w-32 rounded-lg border border-transparent bg-transparent px-2 py-1.5 outline-none hover:border-slate-200 focus:border-emerald-600 disabled:opacity-60" />
                        )}
                      </td>
                    ))}
                    <td className="sticky right-0 border-b border-slate-100 bg-white px-3 py-2">
                      {row.operation === 'delete' ? <span className="text-xs font-medium text-rose-700">아카이브 예정</span> : <button data-testid="rent-roll-archive" type="button" onClick={() => archiveRow(index)} disabled={!rentRollWriteEnabled} className="text-xs font-medium text-slate-500 hover:text-rose-700 disabled:cursor-not-allowed disabled:opacity-40">아카이브</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <EmptyState>현재 자산의 렌트롤 행이 없습니다. 행 추가 또는 다중 붙여넣기로 시작할 수 있습니다.</EmptyState>}
      </SectionCard>
    </div>
  );
}

function FinancePanel({ assetKey }) {
  const [startMonth, setStartMonth] = useState(() => addMonths(currentMonthKst(), -11));
  const [endMonth, setEndMonth] = useState(() => currentMonthKst());
  const [scenario, setScenario] = useState('actual');
  const [basis, setBasis] = useState('accrual');
  const payload = useMemo(() => ({
    asset_key: assetKey,
    from_month: startMonth,
    to_month: endMonth,
    scenario,
    accounting_basis: basis,
  }), [assetKey, basis, endMonth, scenario, startMonth]);
  const resource = usePrimaryResource(DATA_PLATFORM_ACTIONS.financeRead, payload, { enabled: Boolean(assetKey) });
  const [entries, setEntries] = useState([]);
  const [browserScenario, setBrowserScenario] = useState({ rent_change_rate: 0, expense_change_rate: 0 });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [message, setMessage] = useState('');
  const financeWriteEnabled = resource.data?.write_enabled === true;
  const financeWriteLockReason = resource.data?.reason;
  const dataStatus = resource.data?.data_status || 'not_entered';
  const formulaStatus = resource.data?.formula_status || 'draft';
  const accounts = useMemo(
    () => (Array.isArray(resource.data?.accounts) ? resource.data.accounts : []),
    [resource.data?.accounts],
  );
  const legacyLoans = Array.isArray(resource.data?.loans) ? resource.data.loans : [];
  const entryErrors = useMemo(() => validateManualFinanceEntries(entries, accounts), [accounts, entries]);

  useEffect(() => {
    setEntries(Array.isArray(resource.data?.entries) ? resource.data.entries.map((row) => ({
      ...row,
      month: String(row.month || '').slice(0, 7),
      operation: 'update',
    })) : []);
  }, [resource.data]);
  const calculationPayload = useMemo(() => ({
    asset_key: assetKey,
    metric: 'cashflow_waterfall',
    from_month: startMonth,
    to_month: endMonth,
    formula_version: resource.data?.formula_version || null,
    scenario_inputs: browserScenario,
  }), [assetKey, browserScenario, endMonth, resource.data?.formula_version, startMonth]);
  const calculationResource = usePrimaryResource(DATA_PLATFORM_ACTIONS.calculationsExplain, calculationPayload, {
    enabled: Boolean(assetKey && resource.data?.formula_version && formulaStatus === 'approved'),
  });
  const baseWaterfall = resource.data?.waterfall || null;
  const simulatedWaterfall = calculationResource.data?.result || null;
  const updateEntry = (index, key, value) => setEntries((rows) => rows.map((row, rowIndex) => (
    rowIndex === index ? { ...row, [key]: value } : row
  )));
  const addEntry = () => {
    if (!financeWriteEnabled) return;
    setEntries((rows) => [...rows, emptyManualFinanceEntry({
      draftId: `finance-${Date.now()}`,
      month: endMonth,
      accountingBasis: basis,
    })]);
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
        expected_revisions: Object.fromEntries(entries
          .filter((row) => row.entry_key && row.revision)
          .map((row) => [row.entry_key, row.revision])),
        entries: entries.map(financeEntryForSave),
      });
      setMessage(`저장 후 readback 확인 완료 · revision ${response.revision}`);
      resource.reload();
    } catch (error) {
      setSaveError(error);
    } finally {
      setSaving(false);
    }
  };

  if (!assetKey) return <EmptyState>먼저 조회할 자산을 선택해 주세요.</EmptyState>;
  return (
    <div className="space-y-5">
      <LoadingLine visible={resource.loading} />
      <ErrorNotice error={resource.error || calculationResource.error || saveError} />
      <WriteLockNotice
        visible={Boolean(resource.data) && !financeWriteEnabled}
        reason={financeWriteLockReason}
        testId="finance-write-lock"
      />
      <span className="sr-only">{CALCULATION_AUTHORITY}</span>
      {['not_entered', 'not_provided'].includes(dataStatus) ? (
        <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
          아직 입력된 수익·비용·수납 자료가 없습니다. 담당자가 아래에서 첫 월별 행을 작성하면 Supabase 운영 원장에 저장됩니다.
        </div>
      ) : null}
      {formulaStatus !== 'approved' ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          계산식 승인 전에는 합계 계산만 잠겨 있습니다. 원천 입력과 저장은 계속할 수 있습니다. <span className="sr-only">FORMULA_NOT_APPROVED</span>
        </div>
      ) : null}
      <div className="grid gap-3 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-xs font-medium text-slate-600">시작 월<input type="month" value={startMonth} onChange={(event) => setStartMonth(event.target.value)} className="mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" /></label>
        <label className="text-xs font-medium text-slate-600">종료 월<input type="month" value={endMonth} onChange={(event) => setEndMonth(event.target.value)} className="mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" /></label>
        <label className="text-xs font-medium text-slate-600">구분<select value={scenario} onChange={(event) => setScenario(event.target.value)} className="mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"><option value="actual">실적</option></select></label>
        <label className="text-xs font-medium text-slate-600">회계 기준<select value={basis} onChange={(event) => setBasis(event.target.value)} className="mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"><option value="accrual">발생</option><option value="cash">현금</option></select></label>
      </div>
      <div className="grid gap-5 xl:grid-cols-[1.45fr_0.75fr]">
        <SectionCard title="월별 수익·비용·수납 원장" description="담당자가 웹에서 직접 입력한 월별 원자행만 저장합니다. 분기·연도 합계는 저장하지 않고 조회할 때 계산합니다." action={<div className="flex gap-2"><button data-testid="finance-add" type="button" onClick={addEntry} disabled={!financeWriteEnabled} className="rounded-xl border border-slate-300 px-3 py-2 text-sm disabled:opacity-40">행 추가</button><button data-testid="finance-save" type="button" onClick={save} disabled={saving || !financeWriteEnabled || entryErrors.length > 0} className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">{saving ? '저장 중' : '변경 저장'}</button></div>}>
          {message ? <p className="mb-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{message}</p> : null}
          {entryErrors.length ? <div className="mb-4 rounded-xl bg-amber-50 px-4 py-3 text-xs text-amber-900">{entryErrors.slice(0, 8).map((error) => <p key={error}>{error}</p>)}</div> : null}
          {entries.length ? (
            <div className="overflow-x-auto">
              <table className="min-w-[900px] w-full text-left text-sm">
                <thead><tr>{FINANCE_COLUMNS.map(([, label]) => <th key={label} className="border-b border-slate-200 bg-slate-50 px-3 py-3 text-xs font-semibold text-slate-600">{label}</th>)}</tr></thead>
                <tbody>{entries.map((row, index) => (
                  <tr key={row.entry_key || row._draft_id || index}>
                    {FINANCE_COLUMNS.map(([key]) => (
                      <td key={key} className="border-b border-slate-100 px-2 py-2">
                        {key === 'account_code' && accounts.length ? (
                          <select value={row[key] ?? ''} onChange={(event) => updateEntry(index, key, event.target.value)} disabled={!financeWriteEnabled} className="w-full min-w-44 rounded-lg border border-slate-200 px-2 py-1.5 outline-none focus:border-emerald-600 disabled:opacity-60">
                            <option value="">계정 선택</option>
                            {accounts.map((account) => <option key={account.account_code} value={account.account_code}>{account.name_ko}</option>)}
                          </select>
                        ) : key === 'scenario' ? (
                          <input value="actual" disabled className="w-full min-w-24 rounded-lg bg-slate-100 px-2 py-1.5 text-slate-500" />
                        ) : key === 'accounting_basis' ? (
                          <select value={row[key] || basis} onChange={(event) => updateEntry(index, key, event.target.value)} disabled={!financeWriteEnabled} className="w-full min-w-24 rounded-lg border border-slate-200 px-2 py-1.5 outline-none focus:border-emerald-600 disabled:opacity-60">
                            <option value="accrual">발생</option>
                            <option value="cash">현금·수납</option>
                          </select>
                        ) : (
                          <input type={key === 'month' ? 'month' : key === 'amount' ? 'number' : 'text'} value={row[key] ?? ''} onChange={(event) => updateEntry(index, key, event.target.value)} disabled={!financeWriteEnabled} className="w-full min-w-24 rounded-lg border border-transparent px-2 py-1.5 outline-none hover:border-slate-200 focus:border-emerald-600 disabled:opacity-60" />
                        )}
                      </td>
                    ))}
                  </tr>
                ))}</tbody>
              </table>
            </div>
          ) : <EmptyState>선택한 조건에 확인된 월별 원장 행이 없습니다.</EmptyState>}
        </SectionCard>
        <div className="space-y-5">
          <SectionCard title="기존 대출 원장" description="기존 Supabase 대출 조건과 만기를 그대로 사용합니다. 월별 상환 일정이 없으면 미등록으로 표시합니다.">
            {legacyLoans.length ? <div className="space-y-2">{legacyLoans.map((loan) => <div key={loan.loan_key || loan.row_key} className="rounded-xl bg-slate-50 px-3 py-3 text-sm"><div className="flex items-center justify-between gap-3"><span className="font-medium text-slate-900">{valueOrDash(loan.tranche || loan.name)}</span><span className="text-slate-600">{formatAmount(loan.committed_amount_krw ?? loan.commitment_amount)}</span></div><p className="mt-1 text-xs text-slate-500">만기 {valueOrDash(loan.maturity_date)} · 월별 상환 {(loan.repayment_schedule?.status || loan.repayment_schedule_status) === 'provided' ? '등록' : '미등록'}</p></div>)}</div> : <EmptyState>연결된 기존 대출 원장이 없습니다.</EmptyState>}
          </SectionCard>
          <SectionCard title="현금흐름 단계" description="승인된 계산 입력과 공식 버전으로만 계산합니다.">
            {baseWaterfall ? <div className="space-y-2">{FINANCE_WATERFALL_LABELS.map((label, index) => <div key={label} className={`flex items-center justify-between rounded-xl px-3 py-2.5 ${index >= 4 ? 'bg-emerald-50 font-semibold text-emerald-950' : 'bg-slate-50 text-slate-700'}`}><span className="text-sm">{label}</span><span className="text-sm tabular-nums">{formatAmount(baseWaterfall[FINANCE_WATERFALL_KEYS[index]])}</span></div>)}</div> : <EmptyState>공식 계산에 필요한 원천값이 모두 확인되지 않았습니다.</EmptyState>}
          </SectionCard>
          <SectionCard title="브라우저 시나리오" description="이 가정은 현재 브라우저에만 보관되며 운영 DB 저장 요청에 포함되지 않습니다.">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
              <label className="text-xs font-medium text-slate-600">임대수입 증감률 (%)<input type="number" value={browserScenario.rent_change_rate} onChange={(event) => setBrowserScenario((current) => ({ ...current, rent_change_rate: event.target.value }))} className="mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" /></label>
              <label className="text-xs font-medium text-slate-600">운영비 증감률 (%)<input type="number" value={browserScenario.expense_change_rate} onChange={(event) => setBrowserScenario((current) => ({ ...current, expense_change_rate: event.target.value }))} className="mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" /></label>
            </div>
            {simulatedWaterfall ? <div className="mt-4 rounded-2xl bg-slate-950 p-4 text-white"><p className="text-xs text-slate-400">시나리오 적용 후 부채상환 후 현금흐름</p><p className="mt-2 text-xl font-semibold tabular-nums">{formatAmount(simulatedWaterfall.after_debt_service_cash_flow)}</p></div> : null}
          </SectionCard>
        </div>
      </div>
    </div>
  );
}

function activeTabFromPath(currentPath) {
  const normalized = normalizeLogisticsPath(currentPath);
  const lastPart = normalized.split('/').at(-1);
  return TABS.some((tab) => tab.key === lastPart) ? lastPart : 'home';
}

export default function LogisticsDataPlatform({ currentPath = '' }) {
  const { user, memberInfo, signOut } = useAuth();
  const activeTab = activeTabFromPath(currentPath);
  const [assetKey, setAssetKey] = useState(() => sessionStorage.getItem('gate6-data-platform-asset-key') || '');
  const [openUtility, setOpenUtility] = useState('');
  const homePayload = useMemo(() => ({
    ...(assetKey ? { asset_key: assetKey } : {}),
    as_of_date: todayKst(),
  }), [assetKey]);
  const homeResource = usePrimaryResource(DATA_PLATFORM_ACTIONS.homeRead, homePayload);
  const assets = useMemo(
    () => (Array.isArray(homeResource.data?.assets) ? homeResource.data.assets : []),
    [homeResource.data?.assets],
  );
  const maturityPayload = useMemo(() => ({
    asset_key: assetKey,
    as_of_date: todayKst(),
    horizon_days: 365,
  }), [assetKey]);
  const maturities = usePrimaryResource(DATA_PLATFORM_ACTIONS.maturitiesRead, maturityPayload, {
    enabled: Boolean(assetKey),
  });
  const maturityRows = Array.isArray(maturities.data?.rows) ? maturities.data.rows : [];
  const accountName = memberInfo?.staff_name || memberInfo?.name || user?.email || '로그인 사용자';
  const accountEmail = user?.email || memberInfo?.email || '';
  const accountOrganization = memberInfo?.organization || memberInfo?.department || '';

  useEffect(() => {
    if (!assetKey && assets.length) setAssetKey(assets[0].asset_key);
  }, [assetKey, assets]);
  useEffect(() => {
    if (assetKey) sessionStorage.setItem('gate6-data-platform-asset-key', assetKey);
  }, [assetKey]);

  const navigate = (tab) => {
    const internalPath = `${LOGISTICS_INTERNAL_BASE}/data-platform/${tab}`;
    const nextUrl = pathForLogisticsUrl(import.meta.env.BASE_URL || '/', internalPath);
    window.history.pushState({}, '', nextUrl);
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  return (
    <main data-testid="logistics-data-platform" className="min-h-screen bg-slate-100 text-slate-950">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-[1680px] px-5 py-5 lg:px-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">Gate 6</p>
              <h1 className="mt-1 text-xl font-semibold tracking-tight">물류센터 데이터 관리 플랫폼</h1>
            </div>
            <div className="relative flex flex-wrap items-end justify-end gap-2">
              <label className="flex min-w-64 flex-col gap-1 text-xs font-medium text-slate-500">
                담당 자산
                <select value={assetKey} onChange={(event) => setAssetKey(event.target.value)} className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-900 outline-none focus:border-emerald-600">
                  {!assets.length ? <option value="">조회 가능한 자산 없음</option> : null}
                  {assets.map((asset) => <option key={asset.asset_key} value={asset.asset_key}>{asset.name_ko || asset.asset_code}</option>)}
                </select>
              </label>
              <button
                data-testid="data-platform-maturity-button"
                type="button"
                onClick={() => setOpenUtility((current) => (current === 'maturities' ? '' : 'maturities'))}
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:border-emerald-600 hover:text-emerald-800"
                aria-expanded={openUtility === 'maturities'}
                aria-haspopup="dialog"
              >
                만기 알림 {maturityRows.length}
              </button>
              <button
                data-testid="data-platform-account-button"
                type="button"
                onClick={() => setOpenUtility((current) => (current === 'account' ? '' : 'account'))}
                className="rounded-xl bg-slate-950 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800"
                aria-expanded={openUtility === 'account'}
                aria-haspopup="dialog"
              >
                {accountName}
              </button>
              {openUtility === 'maturities' ? (
                <section className="absolute right-0 top-full z-30 mt-2 w-[min(26rem,calc(100vw-2.5rem))] rounded-2xl border border-slate-200 bg-white p-4 shadow-xl" role="dialog" aria-label="만기 알림">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h2 className="text-sm font-semibold text-slate-950">1년 이내 만기 알림</h2>
                      <p className="mt-1 text-xs text-slate-500">선택한 자산의 확인된 계약·대출 만기만 표시합니다.</p>
                    </div>
                    <button type="button" onClick={() => setOpenUtility('')} className="rounded-lg px-2 py-1 text-xs text-slate-500 hover:bg-slate-100">닫기</button>
                  </div>
                  <LoadingLine visible={maturities.loading} />
                  <ErrorNotice error={maturities.error} />
                  {maturityRows.length ? (
                    <div className="mt-3 max-h-80 space-y-2 overflow-y-auto">
                      {maturityRows.slice(0, 12).map((row) => (
                        <div key={row.maturity_id || `${row.kind}-${row.maturity_date}`} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2.5">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-slate-900">{valueOrDash(row.title || row.subject_name)}</p>
                            <p className="mt-0.5 text-xs text-slate-500">{valueOrDash(row.kind_label || row.kind)}</p>
                          </div>
                          <time className="shrink-0 text-xs font-semibold text-slate-700">{valueOrDash(row.maturity_date)}</time>
                        </div>
                      ))}
                    </div>
                  ) : <p className="mt-3 rounded-xl bg-slate-50 px-3 py-4 text-sm text-slate-600">조회 기간 안에 확인된 만기가 없습니다.</p>}
                </section>
              ) : null}
              {openUtility === 'account' ? (
                <section className="absolute right-0 top-full z-30 mt-2 w-[min(22rem,calc(100vw-2.5rem))] rounded-2xl border border-slate-200 bg-white p-4 shadow-xl" role="dialog" aria-label="계정 및 권한">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-sm font-semibold text-slate-950">{accountName}</h2>
                      {accountEmail ? <p className="mt-1 text-xs text-slate-500">{accountEmail}</p> : null}
                      {accountOrganization ? <p className="mt-1 text-xs text-slate-500">{accountOrganization}</p> : null}
                    </div>
                    <button type="button" onClick={() => setOpenUtility('')} className="rounded-lg px-2 py-1 text-xs text-slate-500 hover:bg-slate-100">닫기</button>
                  </div>
                  <p className="mt-4 rounded-xl bg-emerald-50 px-3 py-3 text-xs leading-5 text-emerald-900">조회·수정 권한은 로그인 사용자 ID와 서버 권한표, 선택 자산을 기준으로 적용됩니다.</p>
                  <button data-testid="data-platform-sign-out" type="button" onClick={() => void signOut()} className="mt-3 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700">로그아웃</button>
                </section>
              ) : null}
            </div>
          </div>
          <nav className="mt-5 flex gap-1" aria-label="데이터 관리 주요 탭">
            {TABS.map((tab) => (
              <button key={tab.key} type="button" onClick={() => navigate(tab.key)} className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${activeTab === tab.key ? 'bg-slate-950 text-white' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950'}`} aria-current={activeTab === tab.key ? 'page' : undefined}>{tab.label}</button>
            ))}
          </nav>
        </div>
      </header>
      <div className="mx-auto max-w-[1680px] px-5 py-6 lg:px-8">
        {activeTab === 'home' ? <HomePanel key={`home-${assetKey}`} assetKey={assetKey} homeResource={homeResource} maturities={maturities} /> : null}
        {activeTab === 'rent-roll' ? <RentRollPanel key={`rent-roll-${assetKey}`} assetKey={assetKey} /> : null}
        {activeTab === 'income-expense' ? <FinancePanel key={`income-expense-${assetKey}`} assetKey={assetKey} /> : null}
      </div>
    </main>
  );
}
