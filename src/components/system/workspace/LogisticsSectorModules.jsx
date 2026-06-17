import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../../utils/supabaseClient';

const CARD = 'rounded-[16px] border border-[#333333] bg-[#252524]';
const INNER = 'rounded-[12px] border border-[#333333] bg-[#1F1F1E]';
const MUTED = 'text-[#A1A1AA]';

const SOURCE_DOMAINS = [
  { key: 'lease_contracts', label: '임대차' },
  { key: 'fund_info', label: '펀드/금융' },
  { key: 'sector_market', label: '시장자료' },
  { key: 'permissions', label: '권한/사용자' },
  { key: 'asset_specs', label: '자산 스펙' },
  { key: 'operating_costs', label: '운영비용' },
];

const MARKET_TABS = [
  { id: 'overview', route: 'overview', label: 'Overview' },
  { id: 'lease', route: 'lease-market', label: 'Lease Market' },
  { id: 'supply', route: 'supply-pipeline', label: 'Supply Pipeline' },
  { id: 'transactions', route: 'transactions', label: 'Transactions' },
  { id: 'source', route: 'source-update', label: 'Source Update' },
];

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function text(value, fallback = '-') {
  if (value === undefined || value === null || value === '') return fallback;
  return String(value);
}

function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatNumber(value, digits = 0) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return '-';
  return parsed.toLocaleString('ko-KR', {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  });
}

function formatKrw(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed === 0) return '-';
  if (Math.abs(parsed) >= 100000000) return `${formatNumber(parsed / 100000000, 1)}억원`;
  if (Math.abs(parsed) >= 10000) return `${formatNumber(parsed / 10000, 0)}만원`;
  return `${formatNumber(parsed, 0)}원`;
}

function formatRate(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return '-';
  const normalized = Math.abs(parsed) <= 1 ? parsed * 100 : parsed;
  return `${formatNumber(normalized, 2)}%`;
}

function formatDate(value) {
  const source = String(value || '');
  if (!source) return '-';
  return source.slice(0, 10);
}

function formatDateTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return formatDate(value);
  return new Intl.DateTimeFormat('ko-KR', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function dateKey(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const kstDate = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  return kstDate.toISOString().slice(0, 10);
}

function addDays(dateText, diff) {
  const match = String(dateText || '').match(/^(\d{4})-(\d{2})-(\d{2})$/u);
  if (!match) return dateKey();
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  date.setUTCDate(date.getUTCDate() + diff);
  return date.toISOString().slice(0, 10);
}

function formatNewsDateLabel(value) {
  const date = new Date(`${value}T00:00:00+09:00`);
  if (Number.isNaN(date.getTime())) return value || '-';
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
  }).format(date);
}

function sourceDomainLabel(domain) {
  return SOURCE_DOMAINS.find((item) => item.key === domain)?.label || text(domain);
}

async function invoke(action, payload = {}) {
  const { data, error } = await supabase.functions.invoke('ll-dashboard-api', {
    body: { action, payload },
  });
  if (error) throw error;
  if (data?.ok === false) throw new Error(data.message || data.error || `${action} failed`);
  return data?.data || data || {};
}

function userFacingLoadError() {
  return '데이터를 불러오지 못했습니다. 권한 또는 Supabase 반영 상태를 확인해 주세요.';
}

function useEdgeData(action, payload = {}, deps = []) {
  const [state, setState] = useState({ loading: true, error: '', data: null });
  const reload = async () => {
    setState((current) => ({ ...current, loading: true, error: '' }));
    try {
      const data = await invoke(action, payload);
      setState({ loading: false, error: '', data });
    } catch {
      setState({ loading: false, error: userFacingLoadError(), data: null });
    }
  };
  useEffect(() => {
    let active = true;
    const run = async () => {
      try {
        const data = await invoke(action, payload);
        if (active) setState({ loading: false, error: '', data });
      } catch {
        if (active) setState({ loading: false, error: userFacingLoadError(), data: null });
      }
    };
    run();
    return () => {
      active = false;
    };
  }, deps);
  return { ...state, reload };
}

function ModuleHeader({ eyebrow, title, subtitle, right = null }) {
  return (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div>
        <div className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#86868B]">{eyebrow}</div>
        <h2 className="mt-1 text-[24px] font-semibold tracking-tight text-white">{title}</h2>
        {subtitle ? <p className="mt-2 max-w-[860px] text-[13px] leading-5 text-[#A1A1AA]">{subtitle}</p> : null}
      </div>
      {right}
    </div>
  );
}

function MetricCard({ label, value, detail }) {
  return (
    <div className={`${INNER} px-4 py-3`}>
      <div className="text-[12px] font-semibold text-[#86868B]">{label}</div>
      <div className="mt-2 truncate text-[22px] font-semibold text-white" title={String(value)}>{value}</div>
      {detail ? <div className="mt-1 text-[11px] leading-5 text-[#86868B]">{detail}</div> : null}
    </div>
  );
}

function Tabs({ tabs, value, onChange }) {
  return (
    <div className="flex flex-wrap gap-1 rounded-[10px] border border-[#333333] bg-[#1F1F1E] p-1">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          disabled={tab.disabled}
          onClick={() => !tab.disabled && onChange(tab.id)}
          className={`h-8 rounded-[7px] px-3 text-[12px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${value === tab.id ? 'bg-white text-[#1F1F1E]' : 'text-[#A1A1AA] hover:text-white'}`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

function Table({ headers, rows, empty = '표시할 데이터가 없습니다.', minWidth = 820 }) {
  return (
    <div className="custom-scrollbar overflow-auto rounded-[12px] border border-[#333333]">
      <table className="w-full border-collapse text-left text-[12px]" style={{ minWidth }}>
        <thead className="sticky top-0 bg-[#1F1F1E] text-[#A1A1AA]">
          <tr>
            {headers.map((header) => (
              <th key={header} className="whitespace-nowrap px-3 py-2 font-semibold">{header}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[#303033]">
          {rows.length ? rows.map((row, index) => (
            <tr key={index} className="bg-[#171717] text-[#E5E5E5]">
              {row.map((cell, cellIndex) => (
                <td key={cellIndex} className="px-3 py-2 align-top">{cell}</td>
              ))}
            </tr>
          )) : (
            <tr>
              <td colSpan={headers.length} className="bg-[#171717] px-3 py-5 text-center text-[#86868B]">{empty}</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function SortableTable({
  columns,
  rows,
  empty = '표시할 데이터가 없습니다.',
  minWidth = 960,
  stickyCount = 0,
  onRowClick,
  defaultSort = null,
}) {
  const [sort, setSort] = useState(defaultSort || null);
  const visibleRows = useMemo(() => {
    const source = safeArray(rows);
    if (!sort?.key) return source;
    const column = columns.find((item) => item.key === sort.key);
    const sortValue = column?.sortValue || ((row) => row?.[sort.key]);
    return source.slice().sort((a, b) => {
      const left = sortValue(a);
      const right = sortValue(b);
      const leftNumber = Number(left);
      const rightNumber = Number(right);
      let result = 0;
      if (Number.isFinite(leftNumber) && Number.isFinite(rightNumber)) {
        result = leftNumber - rightNumber;
      } else {
        result = String(left ?? '').localeCompare(String(right ?? ''), 'ko');
      }
      return sort.direction === 'desc' ? -result : result;
    });
  }, [columns, rows, sort]);
  const nextSort = (column) => {
    if (column.sortable === false) return;
    setSort((current) => ({
      key: column.key,
      direction: current?.key === column.key && current.direction === 'asc' ? 'desc' : 'asc',
    }));
  };
  const stickyLeft = (index) => `${index * 168}px`;
  return (
    <div className="custom-scrollbar overflow-auto rounded-[12px] border border-[#333333]">
      <table className="w-full border-collapse text-left text-[12px]" style={{ minWidth }}>
        <thead className="sticky top-0 z-20 bg-[#1F1F1E] text-[#A1A1AA]">
          <tr>
            {columns.map((column, index) => {
              const sticky = index < stickyCount;
              return (
                <th
                  key={column.key}
                  style={{ width: column.width, left: sticky ? stickyLeft(index) : undefined }}
                  className={`whitespace-nowrap px-3 py-2 font-semibold ${sticky ? 'sticky z-30 bg-[#1F1F1E]' : ''} ${column.sortable === false ? '' : 'cursor-pointer select-none hover:text-white'}`}
                  onClick={() => nextSort(column)}
                >
                  <span className="inline-flex items-center gap-1">
                    {column.label}
                    {sort?.key === column.key ? <span className="text-[10px]">{sort.direction === 'asc' ? '▲' : '▼'}</span> : null}
                  </span>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody className="divide-y divide-[#303033]">
          {visibleRows.length ? visibleRows.map((row, rowIndex) => (
            <tr
              key={row.id || row.source_row_id || row.transaction_case_id || row.supply_case_id || row.observation_id || row.asset_id || row.fund_id || rowIndex}
              onClick={() => onRowClick?.(row)}
              className={`bg-[#171717] text-[#E5E5E5] ${onRowClick ? 'cursor-pointer hover:bg-[#222222]' : ''}`}
            >
              {columns.map((column, index) => {
                const sticky = index < stickyCount;
                const value = column.render ? column.render(row) : row[column.key];
                return (
                  <td
                    key={column.key}
                    style={{ width: column.width, left: sticky ? stickyLeft(index) : undefined }}
                    className={`px-3 py-2 align-top ${column.align === 'right' ? 'text-right' : ''} ${sticky ? 'sticky z-10 bg-inherit' : ''}`}
                  >
                    {value ?? '-'}
                  </td>
                );
              })}
            </tr>
          )) : (
            <tr>
              <td colSpan={columns.length} className="bg-[#171717] px-3 py-5 text-center text-[#86868B]">{empty}</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function Modal({ title, onClose, children, width = 'max-w-[1180px]' }) {
  if (!title) return null;
  return (
    <div className="fixed inset-0 z-[90] bg-black/70 px-4 py-8" role="dialog" aria-modal="true">
      <div className={`mx-auto max-h-[86vh] ${width} overflow-hidden rounded-[16px] border border-[#3A3A3C] bg-[#1F1F1E] shadow-2xl`}>
        <div className="flex items-center justify-between gap-3 border-b border-[#333333] px-5 py-4">
          <h3 className="truncate text-[18px] font-semibold text-white">{title}</h3>
          <button type="button" onClick={onClose} className="grid h-8 w-8 place-items-center rounded-[8px] border border-[#3A3A3C] text-[14px] font-bold text-white hover:bg-white/5">×</button>
        </div>
        <div className="custom-scrollbar max-h-[calc(86vh-64px)] overflow-auto p-5">{children}</div>
      </div>
    </div>
  );
}

function FilterPills({ label, options, value, onChange }) {
  return (
    <div>
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#86868B]">{label}</div>
      <div className="flex flex-wrap gap-1.5">
        {options.map((option) => {
          const optionValue = typeof option === 'string' ? option : option.value;
          const optionLabel = typeof option === 'string' ? option : option.label;
          return (
            <button
              key={optionValue}
              type="button"
              onClick={() => onChange(optionValue)}
              className={`h-8 rounded-[8px] border px-3 text-[12px] font-semibold ${value === optionValue ? 'border-white bg-white text-[#1F1F1E]' : 'border-[#3A3A3C] text-[#A1A1AA] hover:text-white'}`}
            >
              {optionLabel}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function MarketMapPanel({ title, rows, labelKey = 'asset_name', regionKey = 'region', onSelect }) {
  const visibleRows = safeArray(rows).slice(0, 80);
  const regionPositions = {
    동남권: [58, 57],
    남부권: [47, 64],
    중앙권: [50, 50],
    서부권: [38, 56],
    서북권: [32, 42],
    '수도권 기타권': [54, 43],
    경남권: [70, 77],
    충청권: [48, 70],
    전라권: [35, 82],
    경북권: [65, 67],
    '지방 기타권': [52, 82],
  };
  const hashPosition = (label, axis) => {
    const code = String(label || '').split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
    return 18 + ((code * (axis === 'x' ? 17 : 29)) % 64);
  };
  return (
    <div className={`${INNER} min-h-[360px] p-4`}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="text-[14px] font-semibold text-white">{title}</div>
        <div className="text-[11px] text-[#86868B]">{formatNumber(visibleRows.length)}건 표시</div>
      </div>
      <div className="relative h-[300px] overflow-hidden rounded-[12px] border border-[#333333] bg-[#151515]">
        <div className="absolute inset-0 opacity-50" style={{ backgroundImage: 'linear-gradient(#2B2B2D 1px, transparent 1px), linear-gradient(90deg, #2B2B2D 1px, transparent 1px)', backgroundSize: '38px 38px' }} />
        {Object.entries(regionPositions).map(([region, position]) => (
          <div key={region} className="absolute text-[10px] font-semibold text-[#5F6368]" style={{ left: `${position[0]}%`, top: `${position[1]}%` }}>{region}</div>
        ))}
        {visibleRows.map((row, index) => {
          const region = text(row[regionKey], '');
          const base = regionPositions[region] || [hashPosition(region || row[labelKey], 'x'), hashPosition(region || row[labelKey], 'y')];
          const left = Math.max(8, Math.min(92, base[0] + ((index % 5) - 2) * 2.3));
          const top = Math.max(8, Math.min(90, base[1] + ((Math.floor(index / 5) % 5) - 2) * 2.2));
          return (
            <button
              key={row.id || row.source_row_id || row.transaction_case_id || row.supply_case_id || index}
              type="button"
              title={text(row[labelKey])}
              onClick={() => onSelect?.(row)}
              className="absolute h-3 w-3 rounded-full border border-white/80 bg-[#7DD3FC] shadow-[0_0_0_4px_rgba(125,211,252,0.16)] hover:bg-white"
              style={{ left: `${left}%`, top: `${top}%` }}
            />
          );
        })}
        {!visibleRows.length ? <div className="absolute inset-0 grid place-items-center text-[13px] text-[#86868B]">표시할 지도 데이터가 없습니다.</div> : null}
      </div>
    </div>
  );
}

function TinyTrend({ rows, labelKey = 'label', valueKey = 'value', color = '#7DD3FC', formatter = formatNumber }) {
  const visibleRows = safeArray(rows).filter((row) => number(row[valueKey]) !== 0).slice(-14);
  const maxValue = Math.max(...visibleRows.map((row) => Math.abs(number(row[valueKey]))), 1);
  return (
    <div className="flex h-[170px] items-end gap-1 rounded-[12px] border border-[#333333] bg-[#171717] p-3">
      {visibleRows.length ? visibleRows.map((row) => (
        <div key={row[labelKey]} className="group flex min-w-0 flex-1 flex-col items-center justify-end gap-2">
          <div className="w-full rounded-t-[4px]" title={`${row[labelKey]} ${formatter(row[valueKey])}`} style={{ height: `${Math.max(4, Math.min(100, (Math.abs(number(row[valueKey])) / maxValue) * 100))}%`, backgroundColor: color }} />
          <div className="max-w-full truncate text-[10px] text-[#86868B]">{row[labelKey]}</div>
        </div>
      )) : <div className="grid h-full w-full place-items-center text-[13px] text-[#86868B]">차트 데이터가 없습니다.</div>}
    </div>
  );
}

function BarList({ rows, labelKey = 'label', valueKey = 'value', formatter = formatNumber, maxRows = 10, color = '#7DD3FC' }) {
  const visibleRows = rows.filter((row) => number(row[valueKey]) !== 0).slice(0, maxRows);
  const maxValue = Math.max(...visibleRows.map((row) => Math.abs(number(row[valueKey]))), 1);
  return (
    <div className="space-y-2">
      {visibleRows.length ? visibleRows.map((row) => {
        const value = number(row[valueKey]);
        return (
          <div key={row.id || row[labelKey]} className={`${INNER} px-3 py-2`}>
            <div className="mb-1 flex items-center justify-between gap-3">
              <span className="truncate text-[12px] font-semibold text-white">{text(row[labelKey])}</span>
              <span className="shrink-0 text-[12px] font-semibold text-[#E5E5E5]">{formatter(value)}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-[#2C2C2E]">
              <div className="h-full rounded-full" style={{ width: `${Math.max(3, Math.min(100, (Math.abs(value) / maxValue) * 100))}%`, backgroundColor: color }} />
            </div>
          </div>
        );
      }) : <div className={`${INNER} px-4 py-5 text-center text-[13px] text-[#86868B]`}>표시할 차트 데이터가 없습니다.</div>}
    </div>
  );
}

function aggregateRows(rows, labelFn, valueFn) {
  const grouped = new Map();
  rows.forEach((row) => {
    const label = text(labelFn(row), '미입력');
    const current = grouped.get(label) || { label, value: 0, count: 0 };
    current.value += number(valueFn(row));
    current.count += 1;
    grouped.set(label, current);
  });
  return [...grouped.values()].sort((a, b) => number(b.value) - number(a.value));
}

function periodBucket(value) {
  const source = text(value, '');
  if (/^\d{4}-\d{2}/u.test(source)) return source.slice(0, 7);
  if (/^\d{4}/u.test(source)) return source.slice(0, 4);
  return '미입력';
}

function StackedCapitalChart({ rows, labelKey = 'display_name', equityKey = 'equity_krw', loanKey = 'loan_krw', referenceKey = '' }) {
  const visibleRows = rows.slice(0, 14);
  const maxValue = Math.max(...visibleRows.map((row) => number(row[equityKey]) + number(row[loanKey]) + number(referenceKey ? row[referenceKey] : 0)), 1);
  return (
    <div className="space-y-2">
      {visibleRows.length ? visibleRows.map((row) => {
        const equity = number(row[equityKey]);
        const loan = number(row[loanKey]);
        const reference = number(referenceKey ? row[referenceKey] : 0);
        const total = equity + loan + reference;
        return (
          <div key={row.id || row.asset_id || row.fund_id || row[labelKey]} className={`${INNER} px-3 py-2`}>
            <div className="mb-1 flex items-center justify-between gap-3">
              <span className="truncate text-[12px] font-semibold text-white">{text(row[labelKey])}</span>
              <span className="shrink-0 text-[12px] font-semibold text-[#E5E5E5]">{formatKrw(total)}</span>
            </div>
            <div className="flex h-2 overflow-hidden rounded-full bg-[#2C2C2E]">
              <div className="h-full bg-[#34D399]" style={{ width: `${Math.max(0, (equity / maxValue) * 100)}%` }} />
              <div className="h-full bg-[#60A5FA]" style={{ width: `${Math.max(0, (loan / maxValue) * 100)}%` }} />
              {referenceKey ? <div className="h-full bg-[#F59E0B]" style={{ width: `${Math.max(0, (reference / maxValue) * 100)}%` }} /> : null}
            </div>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-[#A1A1AA]">
              <span>Equity {formatKrw(equity)}</span>
              <span>Loan {formatKrw(loan)}</span>
              {referenceKey ? <span>공동 펀드 참고 {formatKrw(reference)}</span> : null}
            </div>
          </div>
        );
      }) : <div className={`${INNER} px-4 py-5 text-center text-[13px] text-[#86868B]`}>표시할 투자 데이터가 없습니다.</div>}
    </div>
  );
}

function domainSources(sources, domain) {
  return sources.filter((row) => row.source_domain === domain);
}

function DailyLogisticsNewsCardLegacy() {
  const [expanded, setExpanded] = useState(true);
  const todayKey = dateKey();
  const [selectedDate, setSelectedDate] = useState(todayKey);
  const { loading, error, data, reload } = useEdgeData('news/list', { limit: 10, date: selectedDate }, [selectedDate]);
  const dataDate = text(data?.selected_date, '');
  const dataMatchesSelection = !dataDate || dataDate === selectedDate;
  const items = dataMatchesSelection ? safeArray(data?.items) : [];
  const latestRun = dataMatchesSelection ? data?.latest_run || null : null;
  const selectedRunStatus = latestRun ? text(latestRun.run_status) : 'no_run';
  const setClampedDate = (value) => setSelectedDate(value && value <= todayKey ? value : todayKey);
  const goDate = (diff) => setSelectedDate((current) => {
    const nextDate = addDays(current || todayKey, diff);
    return nextDate <= todayKey ? nextDate : todayKey;
  });
  return (
    <section className={`${CARD} mb-[28px] p-5`}>
      <div className="grid gap-3 md:grid-cols-[1fr_auto_1fr] md:items-start">
        <div>
          <div className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#86868B]">NEWS</div>
          <h2 className="mt-1 text-[20px] font-semibold tracking-tight text-white">데일리 물류 뉴스</h2>
          <div className="mt-1 text-[11px] text-[#86868B]">수집 기준 {latestRun ? formatDateTime(latestRun.window_end) : formatNewsDateLabel(selectedDate)} · {selectedRunStatus}</div>
        </div>
        <div className="flex w-full items-center justify-center gap-2 md:w-auto md:pt-6">
          <button
            type="button"
            aria-label="이전 날짜 뉴스"
            onClick={() => goDate(-1)}
            className="grid h-8 w-8 place-items-center rounded-[8px] border border-[#3A3A3C] text-[15px] font-semibold text-[#E5E5E5] hover:bg-white/5"
          >
            ‹
          </button>
          <label className="relative h-8 min-w-[178px]">
            <span className="sr-only">뉴스 날짜 선택</span>
            <input
              type="date"
              value={selectedDate}
              max={todayKey}
              onChange={(event) => setClampedDate(event.target.value || todayKey)}
              className="h-8 w-full rounded-[8px] border border-[#3A3A3C] bg-[#181818] px-3 text-center text-[12px] font-semibold text-white outline-none hover:bg-white/5 focus:border-[#7DD3FC]"
            />
          </label>
          <button
            type="button"
            aria-label="다음 날짜 뉴스"
            onClick={() => goDate(1)}
            disabled={selectedDate >= todayKey}
            className="grid h-8 w-8 place-items-center rounded-[8px] border border-[#3A3A3C] text-[15px] font-semibold text-[#E5E5E5] hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-35"
          >
            ›
          </button>
        </div>
        <div className="flex items-center gap-2 md:justify-end">
          <button type="button" onClick={reload} className="h-8 rounded-[8px] border border-[#3A3A3C] px-3 text-[12px] font-semibold text-[#E5E5E5] hover:bg-white/5">새로고침</button>
          <button type="button" onClick={() => setExpanded((value) => !value)} className="h-8 rounded-[8px] border border-[#3A3A3C] px-3 text-[12px] font-semibold text-[#E5E5E5] hover:bg-white/5">
            {expanded ? '접기' : '펼치기'}
          </button>
        </div>
      </div>
      {expanded ? (
        <div className="mt-4">
          {error ? <div className="rounded-[12px] border border-[#5A4420] bg-[#2A2115] px-4 py-3 text-[12px] text-[#FFD479]">{error}</div> : null}
          {loading && !items.length ? <div className={`${INNER} px-4 py-5 text-center text-[13px] text-[#A1A1AA]`}>뉴스를 불러오는 중입니다.</div> : null}
          {!loading && !items.length && !error ? <div className={`${INNER} px-4 py-5 text-center text-[13px] text-[#86868B]`}>{text(data?.empty_message, '수집된 뉴스가 없습니다.')}</div> : null}
          {items.length ? (
            <div className="grid gap-2">
              {items.map((item) => (
                <a key={item.news_item_id || item.canonical_url} href={item.canonical_url || item.original_url} target="_blank" rel="noreferrer" className={`${INNER} block px-4 py-3 hover:bg-[#242424]`}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-[14px] font-semibold text-white">{text(item.title)}</div>
                      <div className={`mt-1 line-clamp-2 text-[12px] leading-5 ${MUTED}`}>{text(item.summary, '요약이 아직 생성되지 않았습니다.')}</div>
                    </div>
                    <div className="shrink-0 text-right text-[11px] leading-5 text-[#86868B]">
                      <div>{text(item.publisher, '언론사 미확인')}</div>
                      <div>{formatDateTime(item.published_at)}</div>
                    </div>
                  </div>
                </a>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

export function DailyLogisticsNewsCard() {
  const [expanded, setExpanded] = useState(true);
  const todayKey = dateKey();
  const [selectedDate, setSelectedDate] = useState(todayKey);
  const { loading, error, data, reload } = useEdgeData('news/list', { limit: 10, date: selectedDate }, [selectedDate]);
  const dataDate = text(data?.selected_date, '');
  const dataMatchesSelection = !dataDate || dataDate === selectedDate;
  const items = dataMatchesSelection ? safeArray(data?.items).slice(0, 10) : [];
  const latestRun = dataMatchesSelection ? data?.latest_run || null : null;
  const selectedRunStatus = latestRun ? text(latestRun.run_status) : 'no_run';
  const setClampedDate = (value) => setSelectedDate(value && value <= todayKey ? value : todayKey);
  const goDate = (diff) => setSelectedDate((current) => {
    const nextDate = addDays(current || todayKey, diff);
    return nextDate <= todayKey ? nextDate : todayKey;
  });
  return (
    <section className={`${CARD} mb-[28px] p-5`}>
      <div className="grid gap-3 md:grid-cols-[1fr_auto_1fr] md:items-start">
        <div>
          <div className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#86868B]">NEWS</div>
          <h2 className="mt-1 text-[20px] font-semibold tracking-tight text-white">데일리 물류 뉴스</h2>
          <div className="mt-1 text-[11px] text-[#86868B]">수집 기준 {latestRun ? formatDateTime(latestRun.window_end) : formatNewsDateLabel(selectedDate)} · {selectedRunStatus}</div>
        </div>
        <div className="flex w-full items-center justify-center gap-2 md:w-auto md:pt-7">
          <button type="button" aria-label="이전 날짜 뉴스" onClick={() => goDate(-1)} className="grid h-8 w-8 place-items-center rounded-[8px] border border-[#3A3A3C] text-[15px] font-semibold text-[#E5E5E5] hover:bg-white/5">‹</button>
          <label className="relative h-8 min-w-[178px]">
            <span className="sr-only">뉴스 날짜 선택</span>
            <input
              type="date"
              value={selectedDate}
              max={todayKey}
              onChange={(event) => setClampedDate(event.target.value || todayKey)}
              className="h-8 w-full rounded-[8px] border border-[#3A3A3C] bg-[#181818] px-3 text-center text-[12px] font-semibold text-white outline-none hover:bg-white/5 focus:border-[#7DD3FC]"
            />
          </label>
          <button type="button" aria-label="다음 날짜 뉴스" onClick={() => goDate(1)} disabled={selectedDate >= todayKey} className="grid h-8 w-8 place-items-center rounded-[8px] border border-[#3A3A3C] text-[15px] font-semibold text-[#E5E5E5] hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-35">›</button>
        </div>
        <div className="flex items-center gap-2 md:justify-end">
          <button type="button" onClick={reload} className="h-8 rounded-[8px] border border-[#3A3A3C] px-3 text-[12px] font-semibold text-[#E5E5E5] hover:bg-white/5">새로고침</button>
          <button type="button" onClick={() => setExpanded((value) => !value)} className="h-8 rounded-[8px] border border-[#3A3A3C] px-3 text-[12px] font-semibold text-[#E5E5E5] hover:bg-white/5">
            {expanded ? '접기' : '펼치기'}
          </button>
        </div>
      </div>
      {expanded ? (
        <div className="mt-4">
          {error ? <div className="rounded-[12px] border border-[#5A4420] bg-[#2A2115] px-4 py-3 text-[12px] text-[#FFD479]">{error}</div> : null}
          {loading && !items.length ? <div className={`${INNER} px-4 py-5 text-center text-[13px] text-[#A1A1AA]`}>뉴스를 불러오는 중입니다.</div> : null}
          {!loading && !items.length && !error ? <div className={`${INNER} px-4 py-5 text-center text-[13px] text-[#86868B]`}>{text(data?.empty_message, '수집된 뉴스가 없습니다.')}</div> : null}
          {items.length ? (
            <div className="grid gap-1.5">
              {items.map((item) => {
                const keywords = safeArray(item.matched_keywords).join(' ');
                const isMajor = /쿠팡|CJ|대한통운|한진|컬리|롯데|리포트|보고서|거래|매매|선매입/iu.test(`${item.title} ${keywords}`);
                return (
                  <a key={item.news_item_id || item.canonical_url} href={item.canonical_url || item.original_url} target="_blank" rel="noreferrer" className={`${INNER} block px-3 py-2 hover:bg-[#242424]`}>
                    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
                      <div className="min-w-0 truncate text-[13px] font-semibold text-white">
                        {isMajor ? <span className="mr-2 rounded-[6px] bg-[#2E3A2F] px-1.5 py-0.5 text-[10px] text-[#B5E48C]">중요</span> : null}
                        {text(item.title)}
                      </div>
                      <div className="shrink-0 text-right text-[11px] text-[#86868B]">{formatDateTime(item.published_at)}</div>
                    </div>
                  </a>
                );
              })}
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function MarketDataDashboardLegacy({ activeTab = 'overview', onNavigate }) {
  const currentTab = MARKET_TABS.some((tab) => tab.id === activeTab) ? activeTab : 'overview';
  const { loading, error, data, reload } = useEdgeData('sector-market/read', { limit: 2000 }, []);
  const summary = data?.summary || {};
  const leases = safeArray(data?.leases);
  const supply = safeArray(data?.supply);
  const transactions = safeArray(data?.transactions);
  const capRates = safeArray(data?.cap_rates);
  const sources = safeArray(data?.sources);
  const charts = data?.charts || {};
  const expectedCounts = summary.expected_counts || {};
  const readback = summary.readback || {};
  const readbackItems = Object.entries(readback).map(([key, value]) => ({
    key,
    label: {
      lease_observations: '임대 관측치',
      supply_cases: '공급 전체',
      pipeline_supply_cases: '공급 예정',
      new_supply_cases: '신규 공급',
      transaction_cases: '매매 사례',
      cap_rate_series: 'Cap Rate',
      new_supply_total_gross_area_py: '신규공급 면적',
    }[key] || key,
    ...(value || {}),
  }));
  const latestTransaction = transactions.reduce((best, row) => (number(row.transaction_amount_krw) > number(best?.transaction_amount_krw) ? row : best), null);
  const supplyByStatus = aggregateRows(supply, (row) => row.status, () => 1).slice(0, 8);
  const selectTab = (id) => {
    const route = MARKET_TABS.find((tab) => tab.id === id)?.route || 'overview';
    if (onNavigate) onNavigate(route);
  };
  return (
    <div className="w-full max-w-[1480px] mx-auto px-8 pt-8 pb-14">
      <ModuleHeader
        eyebrow="MARKET DATA"
        title="Market Data"
        subtitle="물류 시장 데이터_20261Q Excel을 단일 원천으로 사용해 임대, 공급, 매매, Cap Rate를 분리해 보여줍니다."
        right={<button type="button" onClick={reload} className="h-9 rounded-[8px] border border-[#3A3A3C] px-3 text-[13px] font-semibold text-white hover:bg-white/5">새로고침</button>}
      />
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <Tabs tabs={MARKET_TABS} value={currentTab} onChange={selectTab} />
        <div className="text-[12px] text-[#86868B]">
          원천: {text(summary.source?.file_name, '물류 시장 데이터_20261Q.xlsx')} · {summary.status === 'ready' ? 'Active source 적용' : '원천 데이터 없음'}
        </div>
      </div>
      {error ? <div className="mb-4 rounded-[12px] border border-[#5A4420] bg-[#2A2115] px-4 py-3 text-[13px] text-[#FFD479]">{error}</div> : null}
      {loading ? <div className={`${INNER} px-4 py-6 text-center text-[#A1A1AA]`}>시장자료를 불러오는 중입니다.</div> : null}
      {!loading && summary.status !== 'ready' ? <div className={`${INNER} mb-4 px-4 py-5 text-center text-[13px] text-[#A1A1AA]`}>Supabase에 active 시장자료가 아직 없습니다.</div> : null}

      {currentTab === 'overview' ? (
        <div className="space-y-5">
          <section className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="임대 관측치" value={`${formatNumber(summary.lease_observation_count || leases.length)}건`} detail={`검증 기준 ${formatNumber(expectedCounts.lease_observations || 0)}건`} />
            <MetricCard label="평당 임대료" value={summary.weighted_rent_manwon_per_py == null ? '-' : `${formatNumber(summary.weighted_rent_manwon_per_py, 1)}만원`} detail="임대면적 가중평균" />
            <MetricCard label="공급 예정" value={`${formatNumber(summary.pipeline_supply_count || 0)}건`} detail={`신규공급 ${formatNumber(summary.new_supply_total_gross_area_py, 1)}평`} />
            <MetricCard label="매매 사례" value={`${formatNumber(summary.transaction_case_count || transactions.length)}건`} detail={summary.latest_cap_rate ? `최근 ${summary.latest_cap_rate.region} Cap Rate ${formatRate(summary.latest_cap_rate.cap_rate)}` : '거래 사례 기준'} />
          </section>
          <section className="grid grid-cols-1 gap-5 xl:grid-cols-2">
            <div className={`${CARD} p-5`}>
              <ModuleHeader eyebrow="LEASE" title="권역별 평당 임대료" />
              <BarList rows={safeArray(charts.lease_rent_by_region)} formatter={(value) => `${formatNumber(value, 1)}만원`} />
            </div>
            <div className={`${CARD} p-5`}>
              <ModuleHeader eyebrow="CAP RATE" title="Cap Rate 추이" />
              <Table headers={['기간', '권역', 'Cap Rate']} rows={capRates.slice(0, 12).map((row) => [text(row.period_label), text(row.region), formatRate(row.cap_rate)])} />
            </div>
          </section>
        </div>
      ) : null}

      {currentTab === 'lease' ? (
        <section className={`${CARD} p-5`}>
          <ModuleHeader eyebrow="LEASE MARKET" title="임대 시장 비교" subtitle="권역, 상/저온, 규모별 임대료와 공실률을 함께 확인합니다." />
          <div className="mb-5 grid grid-cols-1 gap-3 md:grid-cols-4">
            <MetricCard label="최신 기준" value={text(summary.latest_lease_period, '-')} detail="Excel report period" />
            <MetricCard label="관측치" value={`${formatNumber(summary.lease_observation_count || leases.length)}건`} detail={`샘플 표시 ${formatNumber(leases.length)}건`} />
            <MetricCard label="센터 수" value={`${formatNumber(summary.latest_lease_center_count || 0)}개`} detail="최신 기간 기준" />
            <MetricCard label="공실률" value={summary.weighted_vacancy_rate == null ? '-' : formatRate(summary.weighted_vacancy_rate)} detail="임대면적 가중평균" />
          </div>
          <div className="mb-5 grid grid-cols-1 gap-5 xl:grid-cols-2">
            <BarList rows={safeArray(charts.lease_rent_by_temperature)} formatter={(value) => `${formatNumber(value, 1)}만원`} color="#34D399" />
            <BarList rows={safeArray(charts.lease_vacancy_by_region)} formatter={formatRate} color="#F59E0B" />
          </div>
          <Table
            minWidth={980}
            headers={['기간', '권역', '센터명', '상/저온', '임대면적(평)', '평당 임대료(만원)', '관리비(만원)', '공실률']}
            rows={leases.slice(0, 250).map((row) => [
              text(row.report_period),
              text(row.region),
              text(row.center_name),
              text(row.temperature_type),
              formatNumber(row.leasable_area_py, 1),
              formatNumber(row.rent_manwon_per_py, 1),
              formatNumber(row.management_fee_manwon_per_py, 1),
              row.vacancy_rate == null ? '-' : formatRate(row.vacancy_rate),
            ])}
          />
        </section>
      ) : null}

      {currentTab === 'supply' ? (
        <section className={`${CARD} p-5`}>
          <ModuleHeader eyebrow="SUPPLY PIPELINE" title="공급 예정 및 신규 공급" subtitle="준공 예정 시점, 권역, 진행 상태별 공급 규모를 비교합니다." />
          <div className="mb-5 grid grid-cols-1 gap-3 md:grid-cols-4">
            <MetricCard label="공급 전체" value={`${formatNumber(summary.supply_case_count || supply.length)}건`} detail={`검증 기준 ${formatNumber(expectedCounts.supply_cases || 0)}건`} />
            <MetricCard label="공급 예정" value={`${formatNumber(summary.pipeline_supply_count || 0)}건`} detail="Pipeline cases" />
            <MetricCard label="당분기 신규" value={`${formatNumber(summary.new_supply_count || 0)}건`} detail={`${formatNumber(summary.new_supply_total_gross_area_py, 1)}평`} />
            <MetricCard label="진행상태" value={`${formatNumber(supplyByStatus.length)}종`} detail="상태별 분포 확인" />
          </div>
          <div className="mb-5 grid grid-cols-1 gap-5 xl:grid-cols-2">
            <BarList rows={safeArray(charts.supply_by_period)} formatter={(value) => `${formatNumber(value, 1)}평`} color="#60A5FA" />
            <BarList rows={supplyByStatus} formatter={(value) => `${formatNumber(value)}건`} color="#34D399" />
          </div>
          <Table
            minWidth={980}
            headers={['구분', '준공 예정', '권역', '센터명', '상/저온', '연면적(평)', '진행상태', '시공/소유주']}
            rows={supply.slice(0, 250).map((row) => [
              row.supply_kind === 'new_supply' ? '당분기 신규공급' : '공급예정',
              text(row.completion_period),
              text(row.region),
              text(row.center_name),
              text(row.temperature_type),
              formatNumber(row.gross_area_py, 1),
              text(row.status),
              text(row.owner_or_developer || row.contractor_name),
            ])}
          />
        </section>
      ) : null}

      {currentTab === 'transactions' ? (
        <section className={`${CARD} p-5`}>
          <ModuleHeader eyebrow="TRANSACTIONS" title="매매 사례 비교" subtitle="권역, 거래시점, 평당 단가, Cap Rate를 비교합니다." />
          <div className="mb-5 grid grid-cols-1 gap-3 md:grid-cols-4">
            <MetricCard label="매매 사례" value={`${formatNumber(summary.transaction_case_count || transactions.length)}건`} detail={`검증 기준 ${formatNumber(expectedCounts.transaction_cases || 0)}건`} />
            <MetricCard label="Cap Rate Row" value={`${formatNumber(summary.cap_rate_series_count || capRates.length)}건`} detail="수도권/전국 차트 전개 전" />
            <MetricCard label="최대 거래" value={latestTransaction ? formatKrw(latestTransaction.transaction_amount_krw) : '-'} detail={latestTransaction ? text(latestTransaction.asset_name) : '샘플 기준'} />
            <MetricCard label="표시 샘플" value={`${formatNumber(transactions.length)}건`} detail="전체 count는 readback 기준" />
          </div>
          <div className="mb-5 grid grid-cols-1 gap-5 xl:grid-cols-2">
            <BarList rows={safeArray(charts.transactions_by_region)} formatter={formatKrw} color="#A78BFA" />
            <BarList rows={aggregateRows(transactions, (row) => row.transaction_period || row.transaction_year, (row) => row.transaction_amount_krw).slice(0, 10)} formatter={formatKrw} color="#60A5FA" />
          </div>
          <Table
            minWidth={1050}
            headers={['거래시점', '권역', '자산명', '연면적(평)', '거래금액', '평당 단가', '매수/매도', 'Cap Rate']}
            rows={transactions.slice(0, 250).map((row) => [
              text(row.transaction_period || row.transaction_date),
              text(row.region),
              text(row.asset_name),
              formatNumber(row.area_py, 1),
              formatKrw(row.transaction_amount_krw),
              formatKrw(row.unit_price_krw_per_py),
              [row.buyer_name, row.seller_name].filter(Boolean).join(' / ') || '-',
              row.cap_rate == null ? '-' : formatRate(row.cap_rate),
            ])}
          />
        </section>
      ) : null}

      {currentTab === 'source' ? (
        <section className={`${CARD} p-5`}>
          <ModuleHeader eyebrow="SOURCE UPDATE" title="분기별 Excel 업데이트 관리" subtitle="업로드, dry-run 검증, active 버전 교체, readback 확인 순서로 관리합니다." />
          <div className="mb-5 grid grid-cols-1 gap-3 md:grid-cols-4">
            <MetricCard label="Active 상태" value={summary.status === 'ready' ? '정상' : '확인 필요'} detail={text(summary.source?.source_version, 'active 없음')} />
            <MetricCard label="원본 행" value={`${formatNumber(Object.values(summary.source?.row_counts || {}).reduce((sum, value) => sum + number(value), 0))}건`} detail="ll_source_rows 원천 기준" />
            <MetricCard label="정규화 합계" value={`${formatNumber((summary.lease_observation_count || 0) + (summary.supply_case_count || 0) + (summary.transaction_case_count || 0) + (summary.cap_rate_series_count || 0))}건`} detail="분석용 테이블 readback" />
            <MetricCard label="Readback" value={readbackItems.every((item) => item.ok !== false) ? '통과' : '불일치'} detail="expected vs actual" />
          </div>
          <div className="mb-5 grid grid-cols-1 gap-3 md:grid-cols-4">
            {['업로드', 'Dry-run 검증', 'Diff/승인', 'Active 교체'].map((step, index) => (
              <div key={step} className={`${INNER} px-4 py-4`}>
                <div className="text-[11px] font-semibold text-[#86868B]">STEP {index + 1}</div>
                <div className="mt-2 text-[14px] font-semibold text-white">{step}</div>
              </div>
            ))}
          </div>
          <div className="mb-5">
            <Table
              minWidth={820}
              headers={['검증 항목', '기대값', '실제값', '결과']}
              rows={readbackItems.map((item) => [
                item.label,
                item.expected == null ? '-' : formatNumber(item.expected, item.key.includes('area') ? 1 : 0),
                item.actual == null ? '-' : formatNumber(item.actual, item.key.includes('area') ? 1 : 0),
                item.ok === false ? '불일치' : '통과',
              ])}
            />
          </div>
          <Table
            minWidth={980}
            headers={['파일', '버전', 'Active', '상태', '원본 행수', '업데이트']}
            rows={sources.map((row) => [
              text(row.file_name),
              text(row.source_version),
              row.active_version ? 'Y' : 'N',
              text(row.parse_status),
              formatNumber(Object.values(row.row_counts || {}).reduce((sum, value) => sum + number(value), 0)),
              formatDate(row.updated_at || row.created_at),
            ])}
          />
        </section>
      ) : null}
    </div>
  );
}

export function MarketDataDashboard({ activeTab = 'overview' }) {
  const currentTab = MARKET_TABS.find((tab) => tab.id === activeTab || tab.route === activeTab)?.id || 'overview';
  const { loading, error, data, reload } = useEdgeData('sector-market/read', { limit: 12000 }, []);
  const [modal, setModal] = useState(null);
  const [txnWindow, setTxnWindow] = useState('3y');
  const [txnRegion, setTxnRegion] = useState('전체');
  const [txnTemp, setTxnTemp] = useState('전체');
  const [txnType, setTxnType] = useState('전체');
  const [leaseSegment, setLeaseSegment] = useState('전체');
  const [leaseMeasure, setLeaseMeasure] = useState('rent_manwon_per_py');
  const [leaseRegion, setLeaseRegion] = useState('전체');
  const [leaseSearch, setLeaseSearch] = useState('');
  const [supplyStart, setSupplyStart] = useState('2024-01-01');
  const [supplyEnd, setSupplyEnd] = useState('2028-12-31');
  const summary = data?.summary || {};
  const leases = safeArray(data?.leases);
  const supply = safeArray(data?.supply);
  const transactions = safeArray(data?.transactions);
  const capRates = safeArray(data?.cap_rates);
  const sources = safeArray(data?.sources);
  const charts = data?.charts || {};
  const sourceAudit = summary.source_audit || {};
  const expectedCounts = summary.expected_counts || {};
  const readback = summary.readback || {};
  const regions = ['전체', ...new Set([...leases, ...supply, ...transactions].map((row) => text(row.region, '')).filter(Boolean))].slice(0, 28);
  const temps = ['전체', ...new Set([...leases, ...supply, ...transactions].map((row) => text(row.temperature_type, '')).filter(Boolean))].filter(Boolean).slice(0, 10);
  const transactionTypes = ['전체', ...new Set(transactions.map((row) => text(row.transaction_type || row.deal_type, '')).filter(Boolean))].slice(0, 8);
  const maxTxnYear = Math.max(...transactions.map((row) => number(row.transaction_year || String(row.transaction_date || '').slice(0, 4))), new Date().getFullYear());
  const yearFrom = (row) => number(row.transaction_year || String(row.transaction_date || row.transaction_period || '').slice(0, 4));
  const txnWindowYears = { '1y': 1, '3y': 3, '5y': 5 }[txnWindow] || 3;
  const filteredTransactions = transactions.filter((row) => {
    const year = yearFrom(row);
    const inWindow = year ? year >= maxTxnYear - txnWindowYears + 1 : true;
    const regionOk = txnRegion === '전체' || text(row.region) === txnRegion;
    const tempOk = txnTemp === '전체' || text(row.temperature_type) === txnTemp;
    const typeText = text(row.transaction_type || row.deal_type, '');
    const typeOk = txnType === '전체' || typeText === txnType;
    return inWindow && regionOk && tempOk && typeOk;
  });
  const latestLeasePeriod = summary.latest_lease_period || leases.map((row) => text(row.report_period)).filter(Boolean).sort().at(-1);
  const latestLeases = leases.filter((row) => !latestLeasePeriod || text(row.report_period) === latestLeasePeriod);
  const leaseMeasureOptions = [
    { value: 'deposit_manwon_per_py', label: '보증금' },
    { value: 'rent_manwon_per_py', label: '임대료' },
    { value: 'management_fee_manwon_per_py', label: '관리비' },
    { value: 'rent_free_months_per_year', label: '렌트프리' },
    { value: 'vacancy_rate', label: '공실률' },
  ];
  const leaseSegmentedRows = latestLeases.filter((row) => {
    const temp = text(row.temperature_type);
    if (leaseSegment === '상온') return /상온|dry|ambient/iu.test(temp);
    if (leaseSegment === '저온') return /저온|냉동|냉장|cold/iu.test(temp);
    if (leaseSegment === '상온(복합포함)') return !/저온만|cold only/iu.test(temp);
    if (leaseSegment === '저온(복합포함)') return /저온|냉동|냉장|복합|cold/iu.test(temp);
    return true;
  });
  const filteredLeaseRows = leaseSegmentedRows
    .filter((row) => leaseRegion === '전체' || text(row.region) === leaseRegion)
    .filter((row) => !leaseSearch || `${row.center_name} ${row.legal_address}`.toLowerCase().includes(leaseSearch.toLowerCase()))
    .sort((a, b) => number(b.gross_area_py || b.leasable_area_py) - number(a.gross_area_py || a.leasable_area_py));
  const newSupplyRows = supply.filter((row) => row.supply_kind === 'new_supply');
  const pipelineRows = supply.filter((row) => row.supply_kind === 'pipeline');
  const yearDate = (row) => `${row.expected_year || row.completion_year || '1900'}-01-01`;
  const rangedPipelineRows = pipelineRows.filter((row) => yearDate(row) >= supplyStart && yearDate(row) <= supplyEnd);
  const cumulativeNewRows = supply.filter((row) => row.supply_kind === 'new_supply' && number(row.expected_year || row.completion_year) >= 2024);
  const aggregateBy = (rows, keyFn, valueFn, weightFn = null) => {
    const grouped = new Map();
    rows.forEach((row) => {
      const label = text(keyFn(row), '미분류');
      const current = grouped.get(label) || { label, count: 0, value: 0, weight: 0, weighted: 0 };
      const value = number(valueFn(row));
      const weight = weightFn ? number(weightFn(row)) : 1;
      current.count += 1;
      current.value += value;
      current.weight += weight;
      current.weighted += value * weight;
      grouped.set(label, current);
    });
    return [...grouped.values()].map((row) => ({ ...row, value: weightFn ? row.weighted / Math.max(1, row.weight) : row.value })).sort((a, b) => number(b.value) - number(a.value));
  };
  const transactionMetricCards = [
    { label: '거래면적', value: filteredTransactions.reduce((sum, row) => sum + number(row.area_py), 0), formatter: (value) => `${formatNumber(value, 1)}평`, color: '#60A5FA' },
    { label: '거래건수', value: filteredTransactions.length, formatter: (value) => `${formatNumber(value)}건`, color: '#34D399' },
    { label: '평당 거래가격', value: aggregateBy(filteredTransactions, () => 'weighted', (row) => row.unit_price_krw_per_py, (row) => row.area_py)[0]?.value || 0, formatter: formatKrw, color: '#F59E0B' },
    { label: '총거래가격', value: filteredTransactions.reduce((sum, row) => sum + number(row.transaction_amount_krw), 0), formatter: formatKrw, color: '#A78BFA' },
  ];
  const transactionColumns = [
    { key: 'transaction_period', label: '거래시점', width: 120, render: (row) => text(row.transaction_period || row.transaction_date) },
    { key: 'asset_name', label: '자산명', width: 190, render: (row) => text(row.asset_name) },
    { key: 'region', label: '권역' },
    { key: 'temperature_type', label: '상/저온' },
    { key: 'area_py', label: '면적(평)', align: 'right', render: (row) => formatNumber(row.area_py, 1), sortValue: (row) => number(row.area_py) },
    { key: 'transaction_amount_krw', label: '거래금액', align: 'right', render: (row) => formatKrw(row.transaction_amount_krw), sortValue: (row) => number(row.transaction_amount_krw) },
    { key: 'unit_price_krw_per_py', label: '평당가', align: 'right', render: (row) => formatKrw(row.unit_price_krw_per_py), sortValue: (row) => number(row.unit_price_krw_per_py) },
    { key: 'buyer_name', label: '매수인', render: (row) => text(row.buyer_name) },
    { key: 'seller_name', label: '매도인', render: (row) => text(row.seller_name) },
  ];
  const leaseColumns = [
    { key: 'center_name', label: '센터명', width: 190, render: (row) => text(row.center_name) },
    { key: 'region', label: '권역', width: 120 },
    { key: 'temperature_type', label: '상/저온' },
    { key: 'gross_area_py', label: '연면적(평)', align: 'right', render: (row) => formatNumber(row.gross_area_py || row.leasable_area_py, 1), sortValue: (row) => number(row.gross_area_py || row.leasable_area_py) },
    { key: 'rent_manwon_per_py', label: '임대료', align: 'right', render: (row) => `${formatNumber(row.rent_manwon_per_py, 1)}만원`, sortValue: (row) => number(row.rent_manwon_per_py) },
    { key: 'management_fee_manwon_per_py', label: '관리비', align: 'right', render: (row) => `${formatNumber(row.management_fee_manwon_per_py, 1)}만원`, sortValue: (row) => number(row.management_fee_manwon_per_py) },
    { key: 'vacancy_rate', label: '공실률', align: 'right', render: (row) => formatRate(row.vacancy_rate), sortValue: (row) => number(row.vacancy_rate) },
    { key: 'legal_address', label: '주소', render: (row) => text(row.legal_address) },
  ];
  const supplyColumns = [
    { key: 'center_name', label: '자산명', width: 190, render: (row) => text(row.center_name || row.warehouse_name) },
    { key: 'region', label: '권역', width: 120 },
    { key: 'gross_area_py', label: '연면적(평)', align: 'right', render: (row) => formatNumber(row.gross_area_py, 1), sortValue: (row) => number(row.gross_area_py) },
    { key: 'owner_or_developer', label: '소유주/시행사', render: (row) => text(row.owner_or_developer || row.owner_name) },
    { key: 'temperature_type', label: '상/저온' },
    { key: 'completion_period', label: '준공/예정', render: (row) => text(row.completion_period) },
    { key: 'status', label: '진행상태', render: (row) => text(row.status || row.progress_status) },
  ];
  const popupRows = modal?.rows || (modal?.row ? [modal.row] : []);
  return (
    <div className="w-full max-w-[1480px] mx-auto px-8 pt-8 pb-14">
      <ModuleHeader
        eyebrow="MARKET DATA"
        title="Market Data"
        right={<button type="button" onClick={reload} className="h-9 rounded-[8px] border border-[#3A3A3C] px-3 text-[13px] font-semibold text-white hover:bg-white/5">새로고침</button>}
      />
      <div className="mb-5 text-[12px] text-[#86868B]">원천: {text(summary.source?.file_name, '물류 시장 데이터_20261Q.xlsx')} · {summary.status === 'ready' ? 'Supabase readback 통과' : 'readback 확인 필요'}</div>
      {error ? <div className="mb-4 rounded-[12px] border border-[#5A4420] bg-[#2A2115] px-4 py-3 text-[13px] text-[#FFD479]">{error}</div> : null}
      {loading ? <div className={`${INNER} px-4 py-6 text-center text-[#A1A1AA]`}>시장자료를 불러오는 중입니다.</div> : null}

      {currentTab === 'overview' ? (
        <div className="space-y-5">
          <section className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="임대 관측치" value={`${formatNumber(summary.lease_observation_count || leases.length)}건`} detail={`최근 기준 ${text(summary.latest_lease_period, '-')}`} />
            <MetricCard label="평당 임대료" value={summary.weighted_rent_manwon_per_py == null ? '-' : `${formatNumber(summary.weighted_rent_manwon_per_py, 1)}만원`} detail="임대면적 가중평균" />
            <MetricCard label="공급 예정" value={`${formatNumber(summary.pipeline_supply_count || 0)}건`} detail={`당분기 신규공급 ${formatNumber(summary.new_supply_total_gross_area_py, 1)}평`} />
            <MetricCard label="매매 사례" value={`${formatNumber(summary.transaction_case_count || transactions.length)}건`} detail={summary.latest_cap_rate ? `최근 Cap Rate ${formatRate(summary.latest_cap_rate.cap_rate)}` : '2010년 이후 거래'} />
          </section>
          <section className="grid grid-cols-1 gap-5 xl:grid-cols-2">
            <div className={`${CARD} p-5`}>
              <ModuleHeader eyebrow="LEASE" title="권역별 최신 임대료" />
              <BarList rows={aggregateBy(latestLeases, (row) => row.region, (row) => row.rent_manwon_per_py, (row) => row.leasable_area_py)} formatter={(value) => `${formatNumber(value, 1)}만원`} />
            </div>
            <div className={`${CARD} p-5`}>
              <ModuleHeader eyebrow="TRANSACTION" title="권역별 거래금액" />
              <BarList rows={aggregateBy(transactions, (row) => row.region, (row) => row.transaction_amount_krw)} formatter={formatKrw} color="#A78BFA" />
            </div>
            <div className={`${CARD} p-5`}>
              <ModuleHeader eyebrow="SUPPLY" title="공급 예정 시점" />
              <TinyTrend rows={aggregateBy(supply, (row) => row.completion_period, (row) => row.gross_area_py)} formatter={(value) => `${formatNumber(value, 0)}평`} color="#60A5FA" />
            </div>
            <div className={`${CARD} p-5`}>
              <ModuleHeader eyebrow="SOURCE READBACK" title="원천 적재 검증" />
              <SortableTable
                minWidth={760}
                columns={[
                  { key: 'sheet_name', label: '시트', width: 220 },
                  { key: 'expected_rows', label: '기대 행수', align: 'right', render: (row) => formatNumber(row.expected_rows), sortValue: (row) => number(row.expected_rows) },
                  { key: 'actual_rows', label: 'DB 행수', align: 'right', render: (row) => formatNumber(row.actual_rows), sortValue: (row) => number(row.actual_rows) },
                  { key: 'status', label: '결과' },
                ]}
                rows={safeArray(sourceAudit.sheet_readback)}
              />
            </div>
          </section>
        </div>
      ) : null}

      {currentTab === 'transactions' ? (
        <div className="space-y-5">
          <section className={`${CARD} p-5`}>
            <ModuleHeader eyebrow="TRANSACTIONS" title="거래 사례 비교" />
            <div className="mb-5 grid grid-cols-1 gap-4 xl:grid-cols-4">
              <FilterPills label="시점" value={txnWindow} onChange={setTxnWindow} options={[{ value: '1y', label: '최근 1년' }, { value: '3y', label: '최근 3년' }, { value: '5y', label: '최근 5년' }]} />
              <FilterPills label="권역" value={txnRegion} onChange={setTxnRegion} options={regions.slice(0, 12)} />
              <FilterPills label="상/저온" value={txnTemp} onChange={setTxnTemp} options={temps} />
              <FilterPills label="실물/선매입" value={txnType} onChange={setTxnType} options={transactionTypes} />
            </div>
            <div className="mb-5 grid grid-cols-1 gap-4 xl:grid-cols-2">
              {transactionMetricCards.map((metric) => (
                <div key={metric.label} className={`${INNER} p-4`}>
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <div className="text-[13px] font-semibold text-white">{metric.label}</div>
                    <div className="text-[18px] font-semibold text-white">{metric.formatter(metric.value)}</div>
                  </div>
                  <BarList rows={aggregateBy(filteredTransactions, (row) => row.region, (row) => metric.label === '거래건수' ? 1 : metric.label === '평당 거래가격' ? row.unit_price_krw_per_py : metric.label === '거래면적' ? row.area_py : row.transaction_amount_krw, metric.label === '평당 거래가격' ? (row) => row.area_py : null)} formatter={metric.label === '거래건수' ? (value) => `${formatNumber(value)}건` : metric.formatter} color={metric.color} maxRows={8} />
                </div>
              ))}
            </div>
            <div className="grid grid-cols-1 gap-5 xl:grid-cols-[0.9fr_1.1fr]">
              <MarketMapPanel title="거래 자산 위치" rows={filteredTransactions} labelKey="asset_name" onSelect={(row) => setModal({ title: text(row.asset_name), row, columns: transactionColumns })} />
              <SortableTable minWidth={1120} stickyCount={2} defaultSort={{ key: 'transaction_amount_krw', direction: 'desc' }} columns={transactionColumns} rows={filteredTransactions} onRowClick={(row) => setModal({ title: text(row.asset_name), row, columns: transactionColumns })} />
            </div>
          </section>
          <section className="grid grid-cols-1 gap-5 xl:grid-cols-3">
            <div className={`${CARD} p-5`}>
              <ModuleHeader eyebrow="TIME SERIES" title="권역별 거래시장 규모" />
              <TinyTrend rows={aggregateBy(transactions, (row) => row.transaction_year, (row) => row.transaction_amount_krw).sort((a, b) => String(a.label).localeCompare(String(b.label)))} formatter={formatKrw} color="#A78BFA" />
            </div>
            <div className={`${CARD} p-5`}>
              <ModuleHeader eyebrow="SIZE" title="규모별 평당 거래가" />
              <BarList rows={aggregateBy(transactions, (row) => row.size_bucket, (row) => row.unit_price_krw_per_py, (row) => row.area_py)} formatter={formatKrw} color="#F59E0B" />
            </div>
            <div className={`${CARD} p-5`}>
              <ModuleHeader eyebrow="CAP RATE" title="Cap Rate 추이" />
              <TinyTrend rows={capRates.map((row) => ({ label: `${text(row.period_label)} ${text(row.region)}`, value: row.cap_rate }))} formatter={formatRate} color="#34D399" />
            </div>
          </section>
        </div>
      ) : null}

      {currentTab === 'lease' ? (
        <div className="space-y-5">
          <section className={`${CARD} p-5`}>
            <ModuleHeader eyebrow="LEASE MARKET" title="최신 임대시장 통계" />
            <div className="mb-5 grid grid-cols-1 gap-4 xl:grid-cols-[1fr_1fr]">
              <FilterPills label="상/저온 구분" value={leaseSegment} onChange={setLeaseSegment} options={['전체', '상온', '저온', '상온(복합포함)', '저온(복합포함)']} />
              <FilterPills label="지표" value={leaseMeasure} onChange={setLeaseMeasure} options={leaseMeasureOptions} />
            </div>
            <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
              <div>
                <div className="mb-2 text-[12px] font-semibold text-[#A1A1AA]">수도권/주요권역 비교</div>
                <BarList rows={aggregateBy(leaseSegmentedRows, (row) => row.region, (row) => row[leaseMeasure], (row) => row.leasable_area_py)} formatter={leaseMeasure === 'vacancy_rate' ? formatRate : (value) => formatNumber(value, 1)} color="#60A5FA" />
              </div>
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-[12px] font-semibold text-[#A1A1AA]">전체 기록</span>
                  <button type="button" onClick={() => setModal({ title: '임대시장 통계 전체 기록', rows: leases, columns: leaseColumns })} className="h-8 rounded-[8px] border border-[#3A3A3C] px-3 text-[12px] font-semibold text-white hover:bg-white/5">전체 기록 보기</button>
                </div>
                <BarList rows={aggregateBy(leaseSegmentedRows, (row) => row.temperature_type, (row) => row[leaseMeasure], (row) => row.leasable_area_py)} formatter={leaseMeasure === 'vacancy_rate' ? formatRate : (value) => formatNumber(value, 1)} color="#34D399" />
              </div>
            </div>
          </section>
          <section className={`${CARD} p-5`}>
            <ModuleHeader eyebrow="CENTER DETAIL" title="권역별 물류센터 임대 현황" />
            <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-[1fr_280px]">
              <FilterPills label="권역" value={leaseRegion} onChange={setLeaseRegion} options={regions.slice(0, 16)} />
              <label className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#86868B]">
                자산 검색
                <input value={leaseSearch} onChange={(event) => setLeaseSearch(event.target.value)} className="mt-2 h-9 w-full rounded-[8px] border border-[#3A3A3C] bg-[#171717] px-3 text-[12px] text-white outline-none" placeholder="센터명 또는 주소" />
              </label>
            </div>
            <div className="grid grid-cols-1 gap-5 xl:grid-cols-[0.9fr_1.1fr]">
              <MarketMapPanel title="권역별 센터" rows={filteredLeaseRows} labelKey="center_name" onSelect={(row) => setModal({ title: text(row.center_name), row, columns: leaseColumns })} />
              <SortableTable minWidth={1120} stickyCount={2} defaultSort={{ key: 'gross_area_py', direction: 'desc' }} columns={leaseColumns} rows={filteredLeaseRows} onRowClick={(row) => setModal({ title: text(row.center_name), row, columns: leaseColumns })} />
            </div>
          </section>
        </div>
      ) : null}

      {currentTab === 'supply' ? (
        <div className="space-y-5">
          <section className={`${CARD} p-5`}>
            <ModuleHeader eyebrow="NEW SUPPLY" title="최근 신규 공급 사례" />
            <div className="grid grid-cols-1 gap-5 xl:grid-cols-[0.9fr_1.1fr]">
              <MarketMapPanel title="당분기 신규공급" rows={newSupplyRows} labelKey="center_name" onSelect={(row) => setModal({ title: text(row.center_name), row, columns: supplyColumns })} />
              <SortableTable minWidth={1020} stickyCount={2} defaultSort={{ key: 'gross_area_py', direction: 'desc' }} columns={supplyColumns} rows={newSupplyRows} onRowClick={(row) => setModal({ title: text(row.center_name), row, columns: supplyColumns })} />
            </div>
          </section>
          <section className={`${CARD} p-5`}>
            <ModuleHeader eyebrow="PIPELINE" title="공급 예정 물량" />
            <div className="mb-4">
              <div className="mb-2 text-[12px] font-semibold text-[#A1A1AA]">Date</div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-[160px_160px_1fr] md:items-center">
                <input type="date" value={supplyStart} onChange={(event) => setSupplyStart(event.target.value)} className="h-9 rounded-[8px] border border-[#3A3A3C] bg-[#171717] px-3 text-[12px] text-white outline-none" />
                <input type="date" value={supplyEnd} onChange={(event) => setSupplyEnd(event.target.value)} className="h-9 rounded-[8px] border border-[#3A3A3C] bg-[#171717] px-3 text-[12px] text-white outline-none" />
                <div className="h-2 rounded-full bg-[#4A4A4D]"><div className="h-2 rounded-full bg-[#A1A1AA]" style={{ width: '100%' }} /></div>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-5 xl:grid-cols-[0.9fr_1.1fr]">
              <MarketMapPanel title="공급 예정 지도" rows={rangedPipelineRows} labelKey="center_name" onSelect={(row) => setModal({ title: text(row.center_name), row, columns: supplyColumns })} />
              <SortableTable minWidth={1020} stickyCount={2} defaultSort={{ key: 'expected_year', direction: 'asc' }} columns={supplyColumns} rows={rangedPipelineRows} onRowClick={(row) => setModal({ title: text(row.center_name), row, columns: supplyColumns })} />
            </div>
          </section>
          <section className={`${CARD} p-5`}>
            <ModuleHeader eyebrow="CUMULATIVE" title="2024년 이후 누적 신규공급 사례" />
            <div className="grid grid-cols-1 gap-5 xl:grid-cols-[0.9fr_1.1fr]">
              <MarketMapPanel title="누적 신규공급" rows={cumulativeNewRows} labelKey="center_name" onSelect={(row) => setModal({ title: text(row.center_name), row, columns: supplyColumns })} />
              <SortableTable minWidth={1020} stickyCount={2} defaultSort={{ key: 'gross_area_py', direction: 'desc' }} columns={supplyColumns} rows={cumulativeNewRows} onRowClick={(row) => setModal({ title: text(row.center_name), row, columns: supplyColumns })} />
            </div>
          </section>
          <section className="grid grid-cols-1 gap-5 xl:grid-cols-2">
            <div className={`${CARD} p-5`}>
              <ModuleHeader eyebrow="TIME SERIES" title="신규 공급 면적" />
              <TinyTrend rows={aggregateBy(supply, (row) => row.completion_period, (row) => row.gross_area_py).sort((a, b) => String(a.label).localeCompare(String(b.label)))} formatter={(value) => `${formatNumber(value, 0)}평`} color="#60A5FA" />
            </div>
            <div className={`${CARD} p-5`}>
              <ModuleHeader eyebrow="CUMULATIVE" title="누적 공급 면적" />
              <TinyTrend rows={aggregateBy(supply, (row) => row.region, (row) => row.gross_area_py)} formatter={(value) => `${formatNumber(value, 0)}평`} color="#34D399" />
            </div>
          </section>
        </div>
      ) : null}

      {currentTab === 'source' ? (
        <section className={`${CARD} p-5`}>
          <ModuleHeader eyebrow="SOURCE UPDATE" title="분기별 Excel 업데이트 관리" subtitle="업로드, dry-run 검증, active와 diff, 승인 후 active 교체 순서로 관리합니다." />
          <div className="mb-5 grid grid-cols-1 gap-3 md:grid-cols-4">
            <MetricCard label="원본 시트" value={`${formatNumber(sourceAudit.sheet_count || 0)}개`} detail={`${formatNumber(sourceAudit.source_row_count || 0)}행`} />
            <MetricCard label="원본 컬럼" value={`${formatNumber(sourceAudit.source_column_count || 0)}개`} detail="ll_source_columns readback" />
            <MetricCard label="정규화 행" value={`${formatNumber((summary.lease_observation_count || 0) + (summary.supply_case_count || 0) + (summary.transaction_case_count || 0) + (summary.cap_rate_series_count || 0))}건`} detail="분석용 테이블 합계" />
            <MetricCard label="검증 결과" value={Object.values(readback).every((item) => item.ok !== false) ? '통과' : '확인 필요'} detail="expected vs actual" />
          </div>
          <SortableTable
            minWidth={980}
            stickyCount={1}
            columns={[
              { key: 'sheet_name', label: '시트', width: 240 },
              { key: 'expected_rows', label: '기대 행수', align: 'right', render: (row) => formatNumber(row.expected_rows), sortValue: (row) => number(row.expected_rows) },
              { key: 'actual_rows', label: 'DB 행수', align: 'right', render: (row) => formatNumber(row.actual_rows), sortValue: (row) => number(row.actual_rows) },
              { key: 'column_count', label: '컬럼', align: 'right', render: (row) => formatNumber(row.column_count), sortValue: (row) => number(row.column_count) },
              { key: 'header_row_number', label: '헤더 행', align: 'right' },
              { key: 'status', label: '결과' },
            ]}
            rows={safeArray(sourceAudit.sheet_readback)}
          />
          <div className="mt-5">
            <SortableTable
              minWidth={980}
              columns={[
                { key: 'file_name', label: '파일', width: 260 },
                { key: 'source_version', label: '버전' },
                { key: 'active_version', label: 'Active', render: (row) => row.active_version ? 'Y' : 'N' },
                { key: 'parse_status', label: '상태' },
                { key: 'updated_at', label: '업데이트', render: (row) => formatDate(row.updated_at || row.created_at) },
              ]}
              rows={sources}
            />
          </div>
        </section>
      ) : null}

      <Modal title={modal?.title} onClose={() => setModal(null)}>
        <SortableTable
          minWidth={1180}
          stickyCount={2}
          columns={modal?.columns || transactionColumns}
          rows={popupRows}
          empty="상세 데이터가 없습니다."
        />
      </Modal>
    </div>
  );
}

function InvestmentIndexDashboardLegacy() {
  const [mode, setMode] = useState('fund');
  const { loading, error, data, reload } = useEdgeData('investment-index/read', {}, []);
  const summary = data?.summary || {};
  const funds = safeArray(data?.funds);
  const assets = safeArray(data?.assets);
  const tranches = safeArray(data?.tranches);
  const loanRates = safeArray(data?.loan_rates);
  const rows = mode === 'fund' ? funds : assets;
  const totals = rows.reduce((acc, row) => ({
    equity: acc.equity + number(row.equity_krw),
    loan: acc.loan + number(row.loan_krw),
    reference: acc.reference + number(row.reference_total_capital_krw),
  }), { equity: 0, loan: 0, reference: 0 });
  const timelineRows = tranches
    .slice()
    .sort((a, b) => String(a.drawdown_date || '').localeCompare(String(b.drawdown_date || '')))
    .slice(0, 240);
  const drawdownChartRows = aggregateRows(
    tranches.filter((row) => row.drawdown_date),
    (row) => periodBucket(row.drawdown_date),
    (row) => row.amount_krw,
  ).sort((a, b) => String(a.label).localeCompare(String(b.label))).slice(-12);
  const maturityChartRows = aggregateRows(
    tranches.filter((row) => row.maturity_date),
    (row) => periodBucket(row.maturity_date),
    (row) => row.amount_krw,
  ).sort((a, b) => String(a.label).localeCompare(String(b.label))).slice(0, 12);
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs tabs={[{ id: 'fund', label: '펀드 기준' }, { id: 'asset', label: '자산 기준' }]} value={mode} onChange={setMode} />
        <button type="button" onClick={reload} className="h-9 rounded-[8px] border border-[#3A3A3C] px-3 text-[13px] font-semibold text-white hover:bg-white/5">새로고침</button>
      </div>
      {error ? <div className="rounded-[12px] border border-[#5A4420] bg-[#2A2115] px-4 py-3 text-[13px] text-[#FFD479]">{error}</div> : null}
      {loading ? <div className={`${INNER} px-4 py-6 text-center text-[#A1A1AA]`}>투자지표를 불러오는 중입니다.</div> : null}
      <section className="grid grid-cols-1 gap-3 md:grid-cols-4">
        <MetricCard label="Equity" value={formatKrw(totals.equity)} detail="확정 배분 기준" />
        <MetricCard label="Loan" value={formatKrw(totals.loan)} detail="확정 배분 기준" />
        <MetricCard label="합계" value={formatKrw(totals.equity + totals.loan)} detail={mode === 'asset' ? '공동 펀드 참고금액 제외' : '펀드별 합계'} />
        <MetricCard label="공동 펀드 참고" value={formatKrw(totals.reference)} detail={`${formatNumber(summary.joint_asset_reference_count || 0)}개 자산은 참고금액 분리`} />
      </section>
      <section className="grid grid-cols-1 gap-3 md:grid-cols-4">
        <MetricCard label="펀드" value={`${formatNumber(summary.fund_count || funds.length)}개`} detail="표시 가능한 펀드" />
        <MetricCard label="자산" value={`${formatNumber(summary.asset_count || assets.length)}개`} detail="권한 범위 내 자산" />
        <MetricCard label="Tranche" value={`${formatNumber(summary.tranche_count || tranches.length)}건`} detail="active, 중복 제거 후" />
        <MetricCard label="중복 제거" value={`${formatNumber(summary.deduped_tranche_count || 0)}건`} detail="동일 조건 tranche 반복 방지" />
      </section>
      <section className="grid grid-cols-1 gap-5 xl:grid-cols-[0.95fr_1.05fr]">
        <div className={`${CARD} p-5`}>
          <ModuleHeader eyebrow="CAPITAL STRUCTURE" title={`${mode === 'fund' ? '펀드별' : '자산별'} Equity / Loan 비교`} />
          <StackedCapitalChart rows={rows} referenceKey={mode === 'asset' ? 'reference_total_capital_krw' : ''} />
        </div>
        <div className={`${CARD} p-5`}>
          <ModuleHeader eyebrow="SUMMARY TABLE" title="투자 규모 표" />
          <Table
            minWidth={940}
            headers={[mode === 'fund' ? '펀드명' : '자산명', mode === 'fund' ? '자산' : '펀드', 'Equity', 'Loan', '합계', '참고금액']}
            rows={rows.map((row) => [
              text(row.display_name),
              mode === 'fund' ? safeArray(row.asset_names).join(', ') || '-' : safeArray(row.fund_names).join(', ') || '-',
              formatKrw(row.equity_krw),
              formatKrw(row.loan_krw),
              formatKrw(row.total_capital_krw),
              formatKrw(row.reference_total_capital_krw),
            ])}
          />
        </div>
      </section>
      <section className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <div className={`${CARD} p-5`}>
          <ModuleHeader eyebrow="DRAWDOWN / MATURITY" title="인출 및 만기 일정" />
          <div className="mb-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
            <div>
              <div className="mb-2 text-[12px] font-semibold text-[#A1A1AA]">인출 금액 추이</div>
              <BarList rows={drawdownChartRows} formatter={formatKrw} color="#34D399" maxRows={12} />
            </div>
            <div>
              <div className="mb-2 text-[12px] font-semibold text-[#A1A1AA]">만기 금액 분포</div>
              <BarList rows={maturityChartRows} formatter={formatKrw} color="#60A5FA" maxRows={12} />
            </div>
          </div>
          <Table
            minWidth={1040}
            headers={['구분', '펀드명', '금액', '인출일', '만기일', '금리', '대주/수익자']}
            rows={timelineRows.map((row) => [
              text(row.tranche_type_label),
              text(row.fund_display_name),
              formatKrw(row.amount_krw),
              formatDate(row.drawdown_date),
              formatDate(row.maturity_date),
              row.interest_rate == null && row.loan_rate == null && row.all_in_rate == null ? '-' : formatRate(row.interest_rate || row.loan_rate || row.all_in_rate),
              text(row.counterparty_name),
            ])}
          />
        </div>
        <div className={`${CARD} p-5`}>
          <ModuleHeader eyebrow="LOAN RATE" title="대출 금리 비교" />
          <BarList rows={loanRates.map((row) => ({ ...row, label: `${text(row.fund_display_name)} · ${text(row.counterparty_name)}`, value: row.interest_rate }))} formatter={formatRate} color="#F59E0B" />
        </div>
      </section>
    </div>
  );
}

export function InvestmentIndexDashboard() {
  const [mode, setMode] = useState('fund');
  const { loading, error, data, reload } = useEdgeData('investment-index/read', {}, []);
  const funds = safeArray(data?.funds);
  const assets = safeArray(data?.assets);
  const tranches = safeArray(data?.tranches);
  const loanRates = safeArray(data?.loan_rates);
  const rows = mode === 'fund' ? funds : assets;
  const totals = rows.reduce((acc, row) => ({
    equity: acc.equity + number(row.equity_krw),
    loan: acc.loan + number(row.loan_krw),
    reference: acc.reference + number(row.reference_total_capital_krw),
  }), { equity: 0, loan: 0, reference: 0 });
  const drawdownChartRows = aggregateRows(
    tranches.filter((row) => row.drawdown_date),
    (row) => periodBucket(row.drawdown_date),
    (row) => row.amount_krw,
  ).sort((a, b) => String(a.label).localeCompare(String(b.label))).slice(-12);
  const maturityChartRows = aggregateRows(
    tranches.filter((row) => row.maturity_date),
    (row) => periodBucket(row.maturity_date),
    (row) => row.amount_krw,
  ).sort((a, b) => String(a.label).localeCompare(String(b.label))).slice(0, 12);
  const topExposureRows = rows
    .map((row) => ({ ...row, value: number(row.total_capital_krw) + number(row.reference_total_capital_krw), label: row.display_name }))
    .sort((a, b) => number(b.value) - number(a.value))
    .slice(0, 10);
  const tableColumns = mode === 'fund'
    ? [
      { key: 'display_name', label: '펀드명', width: 188 },
      { key: 'asset_names', label: '연결 자산', render: (row) => safeArray(row.asset_names).join(', ') || '-' },
      { key: 'equity_krw', label: 'Equity', align: 'right', render: (row) => formatKrw(row.equity_krw), sortValue: (row) => number(row.equity_krw) },
      { key: 'loan_krw', label: 'Loan', align: 'right', render: (row) => formatKrw(row.loan_krw), sortValue: (row) => number(row.loan_krw) },
      { key: 'total_capital_krw', label: '합계', align: 'right', render: (row) => formatKrw(row.total_capital_krw), sortValue: (row) => number(row.total_capital_krw) },
      { key: 'loan_ratio', label: 'Loan 비중', align: 'right', render: (row) => formatRate(number(row.loan_krw) / Math.max(1, number(row.total_capital_krw))), sortValue: (row) => number(row.loan_krw) / Math.max(1, number(row.total_capital_krw)) },
    ]
    : [
      { key: 'display_name', label: '자산명', width: 188 },
      { key: 'fund_names', label: '연결 펀드', render: (row) => safeArray(row.fund_names).join(', ') || '-' },
      { key: 'equity_krw', label: '확정 Equity', align: 'right', render: (row) => formatKrw(row.equity_krw), sortValue: (row) => number(row.equity_krw) },
      { key: 'loan_krw', label: '확정 Loan', align: 'right', render: (row) => formatKrw(row.loan_krw), sortValue: (row) => number(row.loan_krw) },
      { key: 'total_capital_krw', label: '확정 합계', align: 'right', render: (row) => formatKrw(row.total_capital_krw), sortValue: (row) => number(row.total_capital_krw) },
      { key: 'reference_total_capital_krw', label: '공동펀드 참조', align: 'right', render: (row) => row.joint_fund_reference ? formatKrw(row.reference_total_capital_krw) : '-', sortValue: (row) => number(row.reference_total_capital_krw) },
      { key: 'current_manager_name', label: '담당자', render: (row) => text(row.current_manager_name) },
    ];
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs tabs={[{ id: 'fund', label: '펀드 기준' }, { id: 'asset', label: '자산 기준' }]} value={mode} onChange={setMode} />
        <button type="button" onClick={reload} className="h-9 rounded-[8px] border border-[#3A3A3C] px-3 text-[13px] font-semibold text-white hover:bg-white/5">새로고침</button>
      </div>
      {error ? <div className="rounded-[12px] border border-[#5A4420] bg-[#2A2115] px-4 py-3 text-[13px] text-[#FFD479]">{error}</div> : null}
      {loading ? <div className={`${INNER} px-4 py-6 text-center text-[#A1A1AA]`}>투자지표를 불러오는 중입니다.</div> : null}
      <section className="grid grid-cols-1 gap-3 md:grid-cols-4">
        <MetricCard label="Equity" value={formatKrw(totals.equity)} detail={mode === 'asset' ? '자산에 확정 배분된 금액' : '펀드 기준 합계'} />
        <MetricCard label="Loan" value={formatKrw(totals.loan)} detail={mode === 'asset' ? '자산에 확정 배분된 금액' : '펀드 기준 합계'} />
        <MetricCard label="합계" value={formatKrw(totals.equity + totals.loan)} detail={mode === 'asset' ? '공동펀드 참조금액 제외' : 'Equity + Loan'} />
        <MetricCard label="공동펀드 참조" value={formatKrw(totals.reference)} detail="1펀드-다자산 금액은 중복 합산하지 않습니다." />
      </section>
      <section className="grid grid-cols-1 gap-5 xl:grid-cols-[1.05fr_0.95fr]">
        <div className={`${CARD} p-5`}>
          <ModuleHeader eyebrow="CAPITAL STACK" title={mode === 'fund' ? '펀드별 Equity / Loan 구성' : '자산별 확정금액 / 공동펀드 참조'} />
          <StackedCapitalChart rows={rows} referenceKey={mode === 'asset' ? 'reference_total_capital_krw' : ''} />
        </div>
        <div className={`${CARD} p-5`}>
          <ModuleHeader eyebrow="CONCENTRATION" title="상위 노출액 비교" />
          <BarList rows={topExposureRows} formatter={formatKrw} color="#A78BFA" maxRows={10} />
        </div>
      </section>
      <section className={`${CARD} p-5`}>
        <ModuleHeader eyebrow="COMPARISON TABLE" title={mode === 'fund' ? '펀드별 투자 구조' : '자산별 투자 구조'} />
        <SortableTable
          minWidth={mode === 'fund' ? 1080 : 1180}
          stickyCount={1}
          defaultSort={{ key: 'total_capital_krw', direction: 'desc' }}
          columns={tableColumns}
          rows={rows}
        />
      </section>
      <section className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <div className={`${CARD} p-5`}>
          <ModuleHeader eyebrow="DRAWDOWN / MATURITY" title="인출·만기 일정" />
          <div className="mb-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
            <div>
              <div className="mb-2 text-[12px] font-semibold text-[#A1A1AA]">인출 금액 추이</div>
              <BarList rows={drawdownChartRows} formatter={formatKrw} color="#34D399" maxRows={12} />
            </div>
            <div>
              <div className="mb-2 text-[12px] font-semibold text-[#A1A1AA]">만기 금액 분포</div>
              <BarList rows={maturityChartRows} formatter={formatKrw} color="#60A5FA" maxRows={12} />
            </div>
          </div>
          <SortableTable
            minWidth={1160}
            stickyCount={2}
            defaultSort={{ key: 'maturity_date', direction: 'asc' }}
            columns={[
              { key: 'tranche_type_label', label: '구분', width: 150 },
              { key: 'fund_display_name', label: '펀드명', width: 180 },
              { key: 'counterparty_name', label: '투자자/대주' },
              { key: 'amount_krw', label: '금액', align: 'right', render: (row) => formatKrw(row.amount_krw), sortValue: (row) => number(row.amount_krw) },
              { key: 'drawdown_date', label: '인출일', render: (row) => formatDate(row.drawdown_date) },
              { key: 'maturity_date', label: '만기일', render: (row) => formatDate(row.maturity_date) },
              { key: 'rate', label: '금리', align: 'right', render: (row) => row.interest_rate == null && row.loan_rate == null && row.all_in_rate == null ? '-' : formatRate(row.interest_rate || row.loan_rate || row.all_in_rate), sortValue: (row) => number(row.interest_rate || row.loan_rate || row.all_in_rate) },
            ]}
            rows={tranches}
          />
        </div>
        <div className={`${CARD} p-5`}>
          <ModuleHeader eyebrow="LOAN RATE" title="대출 금리 비교" />
          <BarList rows={loanRates.map((row) => ({ ...row, label: `${text(row.fund_display_name)} · ${text(row.counterparty_name)}`, value: row.interest_rate }))} formatter={formatRate} color="#F59E0B" maxRows={12} />
          <div className="mt-5">
            <SortableTable
              minWidth={760}
              defaultSort={{ key: 'interest_rate', direction: 'desc' }}
              columns={[
                { key: 'fund_display_name', label: '펀드명' },
                { key: 'counterparty_name', label: '대주' },
                { key: 'interest_rate', label: '금리', align: 'right', render: (row) => formatRate(row.interest_rate), sortValue: (row) => number(row.interest_rate) },
                { key: 'maturity_date', label: '만기', render: (row) => formatDate(row.maturity_date) },
              ]}
              rows={loanRates}
            />
          </div>
        </div>
      </section>
    </div>
  );
}

function AssetSpecDashboardLegacy() {
  const specRead = useEdgeData('asset-spec/read', {}, []);
  const costRead = useEdgeData('operating-costs/read', {}, []);
  const assets = safeArray(specRead.data?.assets);
  const specs = safeArray(specRead.data?.specs);
  const files = safeArray(specRead.data?.files);
  const tenantSummary = safeArray(specRead.data?.tenant_summary);
  const costs = safeArray(costRead.data?.rows);
  const specsByAsset = new Map(specs.map((row) => [row.asset_id, row]));
  const filesByAsset = new Map();
  files.forEach((row) => filesByAsset.set(row.asset_id, (filesByAsset.get(row.asset_id) || 0) + 1));
  const tenantsByAsset = new Map();
  tenantSummary.forEach((row) => {
    const assetRows = tenantsByAsset.get(row.asset_id) || [];
    assetRows.push(row);
    tenantsByAsset.set(row.asset_id, assetRows);
  });
  const latestCostByAsset = new Map();
  costs.forEach((row) => {
    if (!latestCostByAsset.has(row.asset_id)) latestCostByAsset.set(row.asset_id, row);
  });
  const rows = assets.map((asset) => ({
    ...asset,
    spec: specsByAsset.get(asset.asset_id) || {},
    cost: latestCostByAsset.get(asset.asset_id) || {},
    file_count: filesByAsset.get(asset.asset_id) || 0,
    tenants: tenantsByAsset.get(asset.asset_id) || [],
  }));
  return (
    <div className="space-y-5">
      {specRead.error || costRead.error ? <div className="rounded-[12px] border border-[#5A4420] bg-[#2A2115] px-4 py-3 text-[13px] text-[#FFD479]">{specRead.error || costRead.error}</div> : null}
      <section className="grid grid-cols-1 gap-3 md:grid-cols-4">
        <MetricCard label="자산" value={`${formatNumber(assets.length)}개`} detail="권한 범위 내 비교 대상" />
        <MetricCard label="스펙 입력" value={`${formatNumber(specs.length)}건`} detail="상/저온, 층고, 통로 폭 등" />
        <MetricCard label="첨부 파일" value={`${formatNumber(files.length)}건`} detail="평면도, 면적표, 사진" />
        <MetricCard label="임차인 점유" value={`${formatNumber(tenantSummary.length)}건`} detail="자산별 임차인 연결" />
      </section>
      <section className={`${CARD} p-5`}>
        <ModuleHeader eyebrow="ASSET SPEC" title="자산 스펙 비교" />
        <Table
          minWidth={1180}
          headers={['자산', '상/저온', '층고', '통로 폭', '램프 폭', '바닥하중', '임차인 점유', '평면도 파일']}
          rows={rows.map((row) => [
            text(row.asset_name),
            text(row.spec.temperature_type),
            text(row.spec.clear_height_m),
            text(row.spec.corridor_width_m || row.spec.aisle_width_m),
            text(row.spec.ramp_width_m),
            [row.spec.floor_load_warehouse_kg_sqm, row.spec.floor_load_corridor_kg_sqm].filter(Boolean).join(' / ') || '-',
            row.tenants.length ? row.tenants.slice(0, 3).map((tenant) => text(tenant.tenant_name)).join(', ') : '-',
            `${formatNumber(row.file_count)}건`,
          ])}
        />
      </section>
    </div>
  );
}

export function AssetSpecDashboard() {
  const specRead = useEdgeData('asset-spec/read', {}, []);
  const costRead = useEdgeData('operating-costs/read', {}, []);
  const assets = safeArray(specRead.data?.assets);
  const specs = safeArray(specRead.data?.specs);
  const files = safeArray(specRead.data?.files);
  const tenantSummary = safeArray(specRead.data?.tenant_summary);
  const costs = safeArray(costRead.data?.rows);
  const specsByAsset = new Map(specs.map((row) => [row.asset_id, row]));
  const filesByAsset = new Map();
  files.forEach((row) => filesByAsset.set(row.asset_id, (filesByAsset.get(row.asset_id) || 0) + 1));
  const tenantsByAsset = new Map();
  tenantSummary.forEach((row) => {
    const assetRows = tenantsByAsset.get(row.asset_id) || [];
    assetRows.push(row);
    tenantsByAsset.set(row.asset_id, assetRows);
  });
  const latestCostByAsset = new Map();
  costs.forEach((row) => {
    if (!latestCostByAsset.has(row.asset_id)) latestCostByAsset.set(row.asset_id, row);
  });
  const rows = assets.map((asset) => ({
    ...asset,
    spec: specsByAsset.get(asset.asset_id) || {},
    cost: latestCostByAsset.get(asset.asset_id) || {},
    file_count: filesByAsset.get(asset.asset_id) || 0,
    tenants: tenantsByAsset.get(asset.asset_id) || [],
  }));
  const [leftId, setLeftId] = useState('');
  const [rightId, setRightId] = useState('');
  const left = rows.find((row) => row.asset_id === leftId) || rows[0] || null;
  const right = rows.find((row) => row.asset_id === rightId) || rows[1] || rows[0] || null;
  const specItems = [
    ['상/저온', (row) => row?.spec?.temperature_type],
    ['연면적(평)', (row) => row?.gross_floor_area_py || row?.spec?.gross_area_py],
    ['층고(m)', (row) => row?.spec?.clear_height_m],
    ['통로 폭(m)', (row) => row?.spec?.corridor_width_m || row?.spec?.aisle_width_m],
    ['램프 폭(m)', (row) => row?.spec?.ramp_width_m],
    ['창고 바닥하중', (row) => row?.spec?.floor_load_warehouse_kg_sqm],
    ['통로 바닥하중', (row) => row?.spec?.floor_load_corridor_kg_sqm],
    ['도면/면적표 파일', (row) => `${formatNumber(row?.file_count || 0)}건`],
    ['현재 임차인', (row) => row?.tenants?.length ? row.tenants.slice(0, 4).map((tenant) => text(tenant.tenant_name)).join(', ') : '-'],
  ];
  const tenantRows = tenantSummary.map((tenant) => {
    const asset = rows.find((row) => row.asset_id === tenant.asset_id) || {};
    return {
      id: `${tenant.asset_id}:${tenant.tenant_name}`,
      tenant_name: tenant.tenant_name,
      asset_name: asset.asset_name,
      leased_area_sqm: tenant.leased_area_sqm,
      temperature_type: asset.spec?.temperature_type,
      clear_height_m: asset.spec?.clear_height_m,
      corridor_width_m: asset.spec?.corridor_width_m || asset.spec?.aisle_width_m,
      ramp_width_m: asset.spec?.ramp_width_m,
      floor_load: [asset.spec?.floor_load_warehouse_kg_sqm, asset.spec?.floor_load_corridor_kg_sqm].filter(Boolean).join(' / '),
    };
  });
  return (
    <div className="space-y-5">
      {specRead.error || costRead.error ? <div className="rounded-[12px] border border-[#5A4420] bg-[#2A2115] px-4 py-3 text-[13px] text-[#FFD479]">{specRead.error || costRead.error}</div> : null}
      <section className="grid grid-cols-1 gap-3 md:grid-cols-4">
        <MetricCard label="자산" value={`${formatNumber(assets.length)}개`} detail="비교 가능한 자산" />
        <MetricCard label="스펙 입력" value={`${formatNumber(specs.length)}건`} detail="상/저온, 층고, 통로 폭 등" />
        <MetricCard label="첨부 파일" value={`${formatNumber(files.length)}건`} detail="평면도, 면적표, 사진" />
        <MetricCard label="임차인 점유" value={`${formatNumber(tenantSummary.length)}건`} detail="임차인별 스펙 비교 기준" />
      </section>
      <section className={`${CARD} p-5`}>
        <ModuleHeader eyebrow="ASSET SPEC" title="자산 스펙 좌우 비교" subtitle="비교할 두 자산을 선택해 상/저온, 층고, 통로 폭, 램프 폭, 바닥하중, 임차인 점유를 나란히 확인합니다." />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {[['left', left, leftId, setLeftId], ['right', right, rightId, setRightId]].map(([side, selected, selectedId, setSelected]) => (
            <div key={side} className={`${INNER} p-4`}>
              <select
                value={selected?.asset_id || selectedId || ''}
                onChange={(event) => setSelected(event.target.value)}
                className="h-10 w-full rounded-[8px] border border-[#3A3A3C] bg-[#171717] px-3 text-[13px] font-semibold text-white outline-none"
              >
                {rows.map((row) => <option key={row.asset_id} value={row.asset_id}>{row.asset_name}</option>)}
              </select>
              <div className="mt-4 text-[18px] font-semibold text-white">{text(selected?.asset_name)}</div>
              <div className="mt-1 text-[12px] text-[#86868B]">{text(selected?.current_manager_name, '담당자 미입력')}</div>
              <div className="mt-4 divide-y divide-[#303033] rounded-[12px] border border-[#333333]">
                {specItems.map(([label, getter]) => (
                  <div key={label} className="grid grid-cols-[132px_minmax(0,1fr)] gap-3 px-3 py-2">
                    <div className="text-[12px] font-semibold text-[#86868B]">{label}</div>
                    <div className="min-w-0 break-words text-[12px] text-white">{text(getter(selected))}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
      <section className={`${CARD} p-5`}>
        <ModuleHeader eyebrow="TENANT SPEC FIT" title="임차인별 점유 자산 스펙 비교" subtitle="추후 임차인 요구 스펙과 실제 점유 자산의 스펙 차이를 비교하기 위한 작업 영역입니다." />
        <SortableTable
          minWidth={1040}
          stickyCount={2}
          defaultSort={{ key: 'tenant_name', direction: 'asc' }}
          columns={[
            { key: 'tenant_name', label: '임차인', width: 168 },
            { key: 'asset_name', label: '점유 자산', width: 168 },
            { key: 'temperature_type', label: '상/저온' },
            { key: 'leased_area_sqm', label: '임대면적(㎡)', align: 'right', render: (row) => formatNumber(row.leased_area_sqm, 1), sortValue: (row) => number(row.leased_area_sqm) },
            { key: 'clear_height_m', label: '층고(m)', align: 'right', render: (row) => text(row.clear_height_m), sortValue: (row) => number(row.clear_height_m) },
            { key: 'corridor_width_m', label: '통로 폭(m)', align: 'right', render: (row) => text(row.corridor_width_m), sortValue: (row) => number(row.corridor_width_m) },
            { key: 'ramp_width_m', label: '램프 폭(m)', align: 'right', render: (row) => text(row.ramp_width_m), sortValue: (row) => number(row.ramp_width_m) },
            { key: 'floor_load', label: '바닥하중(창고/통로)' },
          ]}
          rows={tenantRows}
          empty="아직 임차인별 스펙 비교 데이터가 없습니다."
        />
      </section>
    </div>
  );
}

export function DataManagementDashboard() {
  const [tab, setTab] = useState('my');
  const [selectedRowId, setSelectedRowId] = useState('');
  const [selectedField, setSelectedField] = useState('');
  const [afterValue, setAfterValue] = useState('');
  const [reason, setReason] = useState('');
  const [submitStatus, setSubmitStatus] = useState(null);
  const { loading, error, data, reload } = useEdgeData('data-management/status', { limit: 100, row_limit: 160 }, []);
  const sources = safeArray(data?.sources);
  const sheets = safeArray(data?.sheets);
  const columns = safeArray(data?.columns);
  const sourceRows = safeArray(data?.source_rows);
  const edits = safeArray(data?.edit_requests);
  const domainStats = safeArray(data?.domain_stats);
  const tabs = [
    { id: 'my', label: '내 작업' },
    { id: 'lease', label: '임대차' },
    { id: 'fund', label: '펀드/금융' },
    { id: 'market', label: '시장자료' },
    { id: 'permission', label: '권한/사용자' },
    { id: 'spec', label: '자산 스펙/비용' },
    { id: 'approval', label: '승인 대기' },
    { id: 'history', label: '반영 이력' },
  ];
  const domainForTab = {
    lease: 'lease_contracts',
    fund: 'fund_info',
    market: 'sector_market',
    permission: 'permissions',
    spec: 'asset_specs',
  }[tab];
  const filteredRows = domainForTab
    ? sourceRows.filter((row) => sources.find((source) => source.source_file_id === row.source_file_id)?.source_domain === domainForTab)
    : sourceRows;
  const selectedRow = filteredRows.find((row) => row.source_row_id === selectedRowId) || filteredRows[0] || null;
  const rowValues = selectedRow?.row_values && typeof selectedRow.row_values === 'object' ? selectedRow.row_values : {};
  const editableFields = Object.keys(rowValues).slice(0, 80);
  const currentBeforeValue = selectedField ? text(rowValues[selectedField], '') : '';
  const selectedSource = sources.find((row) => row.source_file_id === selectedRow?.source_file_id) || {};
  const selectedDomainStats = domainStats.find((row) => row.source_domain === domainForTab) || {};
  const hasPendingChange = Boolean(selectedRow && selectedField && afterValue && afterValue !== currentBeforeValue);
  useEffect(() => {
    setSelectedRowId('');
    setSelectedField('');
    setAfterValue('');
    setReason('');
    setSubmitStatus(null);
  }, [tab]);
  useEffect(() => {
    if (!selectedField && editableFields.length) setSelectedField(editableFields[0]);
  }, [editableFields.join('|'), selectedField]);
  const sourceCards = SOURCE_DOMAINS.map((domain) => {
    const rows = domainSources(sources, domain.key);
    const active = rows.find((row) => row.active_version) || rows[0] || {};
    const stats = domainStats.find((row) => row.source_domain === domain.key) || {};
    return { ...domain, count: rows.length, active, stats };
  });
  const submitEdit = async () => {
    if (!selectedRow || !selectedField || !afterValue || afterValue === currentBeforeValue) {
      setSubmitStatus({ type: 'error', message: '변경할 행, 필드, 변경 후 값을 입력해 주세요.' });
      return;
    }
    setSubmitStatus({ type: 'pending', message: '승인 요청을 저장하는 중입니다.' });
    try {
      const source = sources.find((row) => row.source_file_id === selectedRow.source_file_id) || {};
      const result = await invoke('data-management/submit-edit', {
        source_table: 'public.ll_source_rows',
        source_domain: source.source_domain,
        target_type: `${source.source_domain || 'source'}_edit`,
        target_name: `${selectedRow.sheet_name} ${selectedRow.row_number}행`,
        target_row_id: selectedRow.source_row_id,
        field_name: selectedField,
        before_value: currentBeforeValue,
        requested_value: afterValue,
        reason,
        sheet_name: selectedRow.sheet_name,
        row_number: selectedRow.row_number,
        impact_summary: '원본 행 변경 요청입니다. 승인 후 정규 테이블 반영 여부를 검토해야 합니다.',
      });
      setSubmitStatus({ type: 'success', message: `승인 요청이 저장되었습니다. ID: ${result.id || result.data?.id || '-'}` });
      reload();
    } catch (submitError) {
      setSubmitStatus({ type: 'error', message: submitError.message || '승인 요청 저장에 실패했습니다.' });
    }
  };
  const sourcePreviewRows = filteredRows.slice(0, 80).map((row) => [
    sourceDomainLabel(sources.find((source) => source.source_file_id === row.source_file_id)?.source_domain),
    text(row.sheet_name),
    formatNumber(row.row_number),
    text(row.natural_key),
    text(row.row_hash).slice(0, 12),
    safeArray(row.validation_flags).length ? `${safeArray(row.validation_flags).length}건` : '통과',
  ]);
  return (
    <div className="w-full max-w-[1480px] mx-auto px-8 pt-8 pb-14">
      <ModuleHeader eyebrow="DATA MANAGEMENT" title="Data Management" subtitle="Excel 원천, 검증, 변경 전후 비교, 승인 요청, 반영 이력을 한 화면에서 관리합니다." right={<button type="button" onClick={reload} className="h-9 rounded-[8px] border border-[#3A3A3C] px-3 text-[13px] font-semibold text-white hover:bg-white/5">새로고침</button>} />
      <div className="mb-5">
        <Tabs tabs={tabs} value={tab} onChange={setTab} />
      </div>
      <section className={`${CARD} mb-5 p-5`}>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          {[
            ['1. 데이터 종류 선택', '임대차, 펀드/금융, 시장자료, 권한, 자산 스펙/비용 중 고칠 업무를 먼저 고릅니다.'],
            ['2. 원천 행 선택', '엑셀에서 들어온 원본 행을 선택해 어떤 값이 현재 저장돼 있는지 확인합니다.'],
            ['3. 변경값 입력', '현재값과 변경값을 나란히 보면서 단위, 필수값, 중복 여부를 확인합니다.'],
            ['4. 승인 요청', '바로 DB를 바꾸지 않고 승인 대기에 올린 뒤, 관리자가 반영합니다.'],
          ].map(([title, body]) => (
            <div key={title} className={`${INNER} px-4 py-4`}>
              <div className="text-[13px] font-semibold text-white">{title}</div>
              <div className="mt-2 text-[12px] leading-5 text-[#A1A1AA]">{body}</div>
            </div>
          ))}
        </div>
        <div className="mt-3 text-[12px] leading-5 text-[#86868B]">
          이관용, 전기영, 이시정, 이승훈, 이철승 계정은 모든 자산의 데이터 관리 권한으로 처리됩니다. 외부 PM 계정은 자기 담당 자산만 제출할 수 있게 제한됩니다.
        </div>
      </section>
      {error ? <div className="mb-4 rounded-[12px] border border-[#5A4420] bg-[#2A2115] px-4 py-3 text-[13px] text-[#FFD479]">{error}</div> : null}
      {loading ? <div className={`${INNER} px-4 py-6 text-center text-[#A1A1AA]`}>데이터 관리 현황을 불러오는 중입니다.</div> : null}
      {tab === 'my' ? (
        <div className="space-y-5">
          <section className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <MetricCard label="원천 파일" value={`${formatNumber(sources.length)}개`} detail="Excel active/draft 버전" />
            <MetricCard label="시트" value={`${formatNumber(sheets.length)}개`} detail="header, row count 추적" />
            <MetricCard label="컬럼" value={`${formatNumber(columns.length)}개`} detail="원본 컬럼 및 매핑 정보" />
            <MetricCard label="승인 대기" value={`${formatNumber(edits.filter((row) => row.status === 'submitted').length)}건`} detail="검토 후 반영" />
          </section>
          <section className="grid grid-cols-1 gap-3 xl:grid-cols-6">
            {sourceCards.map((item) => (
              <button key={item.key} type="button" onClick={() => setTab(item.key === 'lease_contracts' ? 'lease' : item.key === 'fund_info' ? 'fund' : item.key === 'sector_market' ? 'market' : item.key === 'permissions' ? 'permission' : 'spec')} className={`${INNER} px-4 py-4 text-left hover:bg-[#262626]`}>
                <div className="text-[13px] font-semibold text-white">{item.label}</div>
                <div className="mt-2 min-h-[40px] text-[12px] leading-5 text-[#A1A1AA]">{text(item.active.file_name, '아직 업로드 없음')}</div>
                <div className="mt-3 flex items-center justify-between text-[11px] text-[#86868B]">
                  <span>{formatNumber(item.count)} versions</span>
                  <span>{item.active.active_version ? 'Active' : 'Draft'}</span>
                </div>
                <div className="mt-2 flex items-center justify-between text-[11px] text-[#86868B]">
                  <span>승인대기 {formatNumber(item.stats.pending_edits || 0)}건</span>
                  <span>{item.stats.latest_edit_at ? formatDate(item.stats.latest_edit_at) : '이력 없음'}</span>
                </div>
              </button>
            ))}
          </section>
        </div>
      ) : null}

      {['lease', 'fund', 'market', 'permission', 'spec'].includes(tab) ? (
        <div className="space-y-5">
          <section className={`${CARD} p-5`}>
            <ModuleHeader eyebrow="INPUT WIZARD" title={`${tabs.find((item) => item.id === tab)?.label} 입력 마법사`} subtitle="대형 표 직접 수정은 보조 기능으로 두고, 행 선택, 필드 선택, 값 검증, 변경 전후 비교, 승인 요청 순서로 처리합니다." />
            {!sourceRows.length && data?.access_scope !== 'manager_full_source' ? (
              <div className={`${INNER} px-4 py-5 text-[13px] leading-6 text-[#A1A1AA]`}>현재 계정은 전체 원천 행을 볼 수 없습니다. PM 계정은 본인 담당 자산 데이터만 제출하도록 권한 범위가 적용됩니다.</div>
            ) : (
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.1fr_0.9fr]">
                <div className={`${INNER} p-4`}>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <label className="text-[12px] font-semibold text-[#A1A1AA]">
                      원본 행
                      <select value={selectedRow?.source_row_id || ''} onChange={(event) => setSelectedRowId(event.target.value)} className="mt-2 h-10 w-full rounded-[8px] border border-[#3A3A3C] bg-[#171717] px-3 text-white outline-none">
                        {filteredRows.slice(0, 200).map((row) => (
                          <option key={row.source_row_id} value={row.source_row_id}>{row.sheet_name} · {row.row_number}행</option>
                        ))}
                      </select>
                    </label>
                    <label className="text-[12px] font-semibold text-[#A1A1AA]">
                      수정 필드
                      <select value={selectedField} onChange={(event) => { setSelectedField(event.target.value); setAfterValue(''); }} className="mt-2 h-10 w-full rounded-[8px] border border-[#3A3A3C] bg-[#171717] px-3 text-white outline-none">
                        {editableFields.map((field) => <option key={field} value={field}>{field}</option>)}
                      </select>
                    </label>
                  </div>
                  <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                    <label className="text-[12px] font-semibold text-[#A1A1AA]">
                      변경 전
                      <textarea value={currentBeforeValue} readOnly className="mt-2 h-24 w-full resize-none rounded-[8px] border border-[#333333] bg-[#151515] px-3 py-2 text-[13px] text-[#C7C7CC] outline-none" />
                    </label>
                    <label className="text-[12px] font-semibold text-[#A1A1AA]">
                      변경 후
                      <textarea value={afterValue} onChange={(event) => setAfterValue(event.target.value)} className="mt-2 h-24 w-full resize-none rounded-[8px] border border-[#3A3A3C] bg-[#171717] px-3 py-2 text-[13px] text-white outline-none focus:border-[#8E8E93]" />
                    </label>
                  </div>
                  <label className="mt-4 block text-[12px] font-semibold text-[#A1A1AA]">
                    수정 사유
                    <input value={reason} onChange={(event) => setReason(event.target.value)} className="mt-2 h-10 w-full rounded-[8px] border border-[#3A3A3C] bg-[#171717] px-3 text-white outline-none focus:border-[#8E8E93]" placeholder="예: PM 제출 자료 반영, 분기 Excel 업데이트" />
                  </label>
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={submitEdit}
                      disabled={!hasPendingChange}
                      className="h-10 rounded-[8px] bg-white px-4 text-[13px] font-bold text-[#1F1F1E] hover:bg-[#E5E5E5] disabled:cursor-not-allowed disabled:opacity-35"
                    >
                      승인 요청 저장
                    </button>
                    {submitStatus ? <span className={`text-[12px] ${submitStatus.type === 'error' ? 'text-[#FF9F9F]' : submitStatus.type === 'success' ? 'text-[#B5E48C]' : 'text-[#A1A1AA]'}`}>{submitStatus.message}</span> : null}
                  </div>
                </div>
                <div className={`${INNER} p-4`}>
                  <div className="text-[13px] font-semibold text-white">저장 전 영향 범위</div>
                  <div className="mt-3 space-y-2 text-[12px] leading-5 text-[#A1A1AA]">
                    <div>원천: {sourceDomainLabel(selectedSource.source_domain || domainForTab)}</div>
                    <div>시트/행: {selectedRow ? `${selectedRow.sheet_name} ${selectedRow.row_number}행` : '-'}</div>
                    <div>필드: {selectedField || '-'}</div>
                    <div>상태: {hasPendingChange ? '변경 감지' : '변경 없음'}</div>
                    <div>승인 대기: {formatNumber(selectedDomainStats.pending_edits || 0)}건</div>
                    <div>반영 방식: 승인 요청 생성 후 담당자가 검토합니다.</div>
                  </div>
                  <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                    <div className="rounded-[10px] border border-[#333333] bg-[#171717] p-3">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#86868B]">Before</div>
                      <div className="mt-2 max-h-32 overflow-auto whitespace-pre-wrap break-words text-[12px] leading-5 text-[#C7C7CC]">{currentBeforeValue || '-'}</div>
                    </div>
                    <div className={`rounded-[10px] border p-3 ${hasPendingChange ? 'border-[#4B5563] bg-[#182018]' : 'border-[#333333] bg-[#171717]'}`}>
                      <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#86868B]">After</div>
                      <div className="mt-2 max-h-32 overflow-auto whitespace-pre-wrap break-words text-[12px] leading-5 text-white">{afterValue || '-'}</div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </section>
          <section className={`${CARD} p-5`}>
            <ModuleHeader eyebrow="SOURCE PREVIEW" title="원본 행 미리보기" />
            <Table minWidth={1100} headers={['원천', '시트', '행', 'Natural Key', 'Row Hash', '검증']} rows={sourcePreviewRows} />
          </section>
        </div>
      ) : null}

      {tab === 'approval' ? (
        <section className={`${CARD} p-5`}>
          <ModuleHeader eyebrow="APPROVAL" title="승인 대기" />
          <Table
            minWidth={1180}
            headers={['구분', '대상', '필드', '변경 전', '변경 후', '상태', '요청자', '생성일']}
            rows={edits.filter((row) => row.status === 'submitted').map((row) => [
              sourceDomainLabel(row.source_domain),
              text(row.target_name),
              text(row.field_name),
              text(row.before_value),
              text(row.requested_value),
              text(row.write_status || row.status),
              text(row.requested_by),
              formatDate(row.created_at),
            ])}
          />
        </section>
      ) : null}

      {tab === 'history' ? (
        <div className="space-y-5">
          <section className={`${CARD} p-5`}>
            <ModuleHeader eyebrow="EDIT HISTORY" title="승인/반영 요청 이력" />
            <Table
              minWidth={1220}
              headers={['구분', '대상', '필드', '변경 후', 'Readback', '처리상태', '승인자', '업데이트']}
              rows={edits.map((row) => [
                sourceDomainLabel(row.source_domain),
                text(row.target_name),
                text(row.field_name),
                text(row.requested_value),
                text(row.readback_value, row.write_status === 'written' ? '확인 필요' : '-'),
                text(row.write_status || row.status),
                text(row.approved_by),
                formatDate(row.written_at || row.updated_at || row.created_at),
              ])}
            />
          </section>
          <section className={`${CARD} p-5`}>
            <ModuleHeader eyebrow="SOURCE HISTORY" title="원천 파일 반영 이력" />
            <Table
              minWidth={980}
              headers={['구분', '파일', '버전', 'Active', '상태', '행수', '업데이트']}
              rows={sources.map((row) => [
                sourceDomainLabel(row.source_domain),
                text(row.file_name),
                text(row.source_version),
                row.active_version ? 'Y' : 'N',
                text(row.parse_status),
                formatNumber(Object.values(row.row_counts || {}).reduce((sum, value) => sum + number(value), 0)),
                formatDate(row.updated_at || row.created_at),
              ])}
            />
          </section>
        </div>
      ) : null}
    </div>
  );
}

export function HomeOperatingCostSummary() {
  const { data, error, loading } = useEdgeData('operating-costs/read', {}, []);
  const rows = safeArray(data?.rows);
  const summary = data?.summary || {};
  const latestRows = rows.slice(0, 12);
  const chartRows = latestRows.map((row) => ({
    label: row.asset_name || row.asset_id,
    value: number(row.pm_cost_krw) + number(row.fm_cost_krw) + number(row.insurance_cost_krw) + number(row.utility_cost_krw),
  }));
  return (
    <section className={`${CARD} p-5`}>
      <ModuleHeader eyebrow="OPERATING COST" title="운영비용 포트폴리오 비교" subtitle="PM, FM, 보험료, Utility를 자산별로 비교합니다. 아직 입력되지 않은 자산은 Data Management에서 추가합니다." />
      {error ? <div className="mb-4 rounded-[12px] border border-[#4C4329] bg-[#2B2613] px-4 py-3 text-[13px] text-[#F7D774]">{error}</div> : null}
      <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-4">
        <MetricCard label="PM 비용" value={loading ? '조회 중' : formatKrw(summary.pm_cost_krw)} />
        <MetricCard label="FM 비용" value={loading ? '조회 중' : formatKrw(summary.fm_cost_krw)} />
        <MetricCard label="보험료" value={loading ? '조회 중' : formatKrw(summary.insurance_cost_krw)} />
        <MetricCard label="Utility" value={loading ? '조회 중' : formatKrw(summary.utility_cost_krw)} />
      </div>
      <div className="mb-5">
        <BarList rows={chartRows} formatter={formatKrw} color="#A78BFA" />
      </div>
      <Table
        minWidth={980}
        headers={['자산', '기간', 'PM', 'FM', 'PM 인원', 'FM 인원', '보험료', 'Utility']}
        rows={latestRows.map((row) => [
          text(row.asset_name || row.asset_id),
          [formatDate(row.period_start), formatDate(row.period_end)].filter((value) => value !== '-').join(' ~ ') || '-',
          formatKrw(row.pm_cost_krw),
          formatKrw(row.fm_cost_krw),
          formatNumber(row.pm_headcount),
          formatNumber(row.fm_headcount),
          formatKrw(row.insurance_cost_krw),
          formatKrw(row.utility_cost_krw),
        ])}
        empty={loading ? '운영비용 데이터를 불러오는 중입니다.' : '아직 입력된 운영비용 데이터가 없습니다.'}
      />
    </section>
  );
}
