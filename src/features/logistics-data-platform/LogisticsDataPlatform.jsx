import React, { useEffect, useMemo, useRef, useState } from "react";
import { normalizeLogisticsPath } from "../../components/system/workspace/logisticsRoutes";
import {
  DATA_PLATFORM_ACTIONS,
  createClientRequestId,
  friendlyDataPlatformError,
  invokeDataPlatform,
  isDataPlatformRevisionConflict,
  usePrimaryResource,
} from "./api";
import {
  calculateRentRollENoc,
  calculateRentFreePeriodMonths,
  isValidRentFreePeriod,
  deriveRentRollRow,
  emptyRentRollRow,
  formatRentRollNumber,
  normalizeCostTerms,
  normalizeRentRollGoodsTypes,
  normalizeFitOutMonths,
  normalizeRentFreePeriod,
  parseRentRollMoneyInput,
  RENT_ROLL_COLUMNS,
  RENT_ROLL_EDITABLE_FIELDS,
  RENT_ROLL_GOODS_OPTIONS,
  RENT_ROLL_PASTE_COLUMNS,
  rentRollFloorSortValue,
  rentRollGroupSegments,
  rentRollStickyLeft,
  serializeCostTerms,
  serializeRentRollGoodsTypes,
  validateRentRollDelta,
} from "./rentRollSchema";
import {
  buildFinanceAccountHierarchy,
  calculateKoreanLogisticsNoi,
  filterFinanceCalculationAccounts,
  FINANCE_SECTION_ORDER,
  KOREAN_LOGISTICS_NOI_ACCOUNTS,
} from "./formulas";
import {
  buildFinanceStatementPresentationRows,
  FINANCE_COMPARISON_PRESENTATION_KEYS,
} from "./financePresentation";
import {
  maturityDetailRows,
  maturityDisplayName,
} from "./maturityPresentation";
import {
  buildHomeDocumentPayload,
  buildIncomeExpenseDocumentPayload,
  buildIncomeExpenseStatement,
  buildRentRollDocumentPayload,
  documentsEqual,
  financePeriodsFromEntries,
  isCurrentOccupiedRentRollRow,
  isExpiredRentRollRow,
  normalizeAssetDirectory,
  normalizeHomeOccupancySummary,
  normalizeMaturityRows,
  primaryHomeDataForAsset,
  projectIncomeExpenseStatement,
  reconcileAssetCode,
  replaceFinanceCellValue,
} from "./documentContract";
import {
  StackingPlan,
  buildStackingFloorsFromRows,
} from "../../components/system/workspace/StackingPlan";

const TITLES = Object.freeze({
  home: "홈",
  "rent-roll": "렌트롤",
  "income-expense": "수익·비용",
});
const TAB_KEYS = new Set(Object.keys(TITLES));
const DEFAULT_SORT = Object.freeze({ key: "floor_label", direction: "desc" });
const RENT_ROLL_DISPLAY_COLUMNS = Object.freeze(
  RENT_ROLL_COLUMNS.flatMap((column) => {
    if (["rent_free_start_date", "rent_free_end_date"].includes(column.key)) return [];
    if (column.key === "rent_free_months") {
      return [{ ...column, label: "렌트프리 세부", width: 132 }];
    }
    if (column.key === "fit_out_months") {
      return [
        { key: "fit_out_start_date", label: "Fit-out 시작일", group: column.group, kind: "date", width: 124 },
        { key: "fit_out_end_date", label: "Fit-out 종료일", group: column.group, kind: "date", width: 124 },
        { ...column, label: "Fit-out 개월", width: 112 },
      ];
    }
    return [column];
  }),
);
const RENT_ROLL_GROUP_SEGMENTS = Object.freeze(
  rentRollGroupSegments(RENT_ROLL_DISPLAY_COLUMNS).map((segment) => Object.freeze(segment)),
);
const FINANCE_PERIOD_PRESETS = Object.freeze([
  { key: "1m", label: "최근 1개월", months: 1 },
  { key: "3m", label: "최근 3개월", months: 3 },
  { key: "6m", label: "최근 6개월", months: 6 },
  { key: "1y", label: "최근 1년", months: 12 },
  { key: "custom", label: "직접 지정", months: null },
]);
const DEFAULT_FINANCE_ACCOUNT_CODES = Object.freeze(
  KOREAN_LOGISTICS_NOI_ACCOUNTS
    .filter((account) => account.defaultVisible)
    .map((account) => account.code),
);
const INPUT_CLASS =
  "w-full rounded-[6px] border border-transparent bg-transparent px-2 py-1.5 text-sm text-white outline-none hover:border-[#3A3A3C] focus:border-[#5E9EFF] focus:bg-[#202020] disabled:opacity-50";

function todayKst() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
function currentMonthKst() {
  return todayKst().slice(0, 7);
}
function addDays(text, days) {
  const date = new Date(`${text}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
function addMonths(month, delta) {
  const [y, m] = String(month).split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}
function monthsBetween(start, end) {
  const rows = [];
  for (
    let cursor = start;
    cursor <= end && rows.length < 60;
    cursor = addMonths(cursor, 1)
  )
    rows.push(cursor);
  return rows;
}
function amount(value) {
  return value === "" || value == null || !Number.isFinite(Number(value))
    ? "—"
    : new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 0 }).format(
        Number(value),
      );
}
function area(value) {
  if (value === "" || value == null || !Number.isFinite(Number(value)))
    return "—";
  return `${amount(value)}㎡ · ${new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 0 }).format(Number(value) * 0.3025)}평`;
}
function display(value) {
  return value === "" || value == null ? "—" : String(value);
}
function normalizeMaturities(data) {
  return normalizeMaturityRows(data);
}
function rowId(row) {
  return row._draft_id;
}

function LoadingLine({ visible }) {
  return visible ? (
    <div className="h-0.5 w-full animate-pulse rounded bg-[#5E9EFF]" />
  ) : null;
}
function DataPlatformErrorDialog({ error, onDismiss }) {
  const [dismissed, setDismissed] = useState(false);
  useEffect(() => setDismissed(false), [error]);
  if (!error || dismissed) return null;
  const message = error.userMessage ?? friendlyDataPlatformError(error);
  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/70 p-4">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="data-platform-error-title"
        data-testid="data-platform-error-dialog"
        className="w-full max-w-[440px] rounded-[16px] border border-[#3A3A3C] bg-[#252524] p-5 shadow-2xl"
      >
        <h2 id="data-platform-error-title" className="text-base font-semibold text-white">처리하지 못했습니다</h2>
        <p className="mt-3 text-sm leading-6 text-[#D1D1D6]">{message}</p>
        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={() => {
              setDismissed(true);
              onDismiss?.();
            }}
            className="rounded-[8px] border border-[#3A3A3C] px-4 py-2 text-sm font-semibold text-white hover:bg-[#303030]"
          >
            확인
          </button>
        </div>
      </section>
    </div>
  );
}
function EmptyText({ children = "표시할 데이터가 없습니다." }) {
  return <p className="py-5 text-sm text-[#86868B]">{children}</p>;
}
function Section({ title, action, children, className = "" }) {
  return (
    <section
      className={`rounded-[20px] border border-[#333333] bg-[#252524] p-5 ${className}`}
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-white">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}
function SaveState({ state }) {
  if (state === "error") return null;
  const label =
    state === "saving"
      ? "저장 중"
      : state === "saved"
        ? "저장 완료"
        : state === "dirty"
          ? "저장할 변경 있음"
        : "변경 내용 없음";
  const color =
    state === "saved"
        ? "text-[#7BD5A0]"
        : state === "dirty"
          ? "text-[#7DB7FF]"
        : "text-[#86868B]";
  return (
    <span
      data-save-state={state || "idle"}
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className={`text-xs ${color}`}
    >
      {label}
    </span>
  );
}

function HomeValue({ editing, value, type = "text", onChange, align = "left", ariaLabel }) {
  if (!editing) {
    return (
      <span className={`block min-h-8 px-2 py-1.5 text-sm text-white ${align === "right" ? "text-right tabular-nums" : ""}`}>
        {type === "number" ? amount(value) : display(value)}
      </span>
    );
  }
  return (
    <input
      aria-label={ariaLabel}
      type={type}
      value={value ?? ""}
      onChange={(event) => onChange(event.target.value)}
      className={`${INPUT_CLASS} bg-[#202020] ${align === "right" ? "text-right tabular-nums" : ""}`}
    />
  );
}

const HOME_ASSET_OVERVIEW_FIELDS = Object.freeze([
  { key: "name", label: "자산명", type: "text" },
  { key: "address", label: "주소", type: "text" },
  { key: "zoning_text", label: "용도지역", type: "text" },
  { key: "land_area_sqm", label: "대지면적", type: "number", format: "area" },
  { key: "building_area_sqm", label: "건축면적", type: "number", format: "area" },
  { key: "gross_area_sqm", label: "연면적", type: "number", format: "area" },
  { key: "leasable_area_sqm", label: "임대가능면적", type: "number", format: "area" },
  { key: "primary_use", label: "주용도", type: "text" },
  { key: "building_coverage_ratio", label: "건폐율", type: "number", format: "percent" },
  { key: "floor_area_ratio", label: "용적률", type: "number", format: "percent" },
  { key: "floor_count", label: "층수", type: "text" },
  { key: "structure_text", label: "구조", type: "text" },
  { key: "parking_count", label: "주차대수", type: "number", format: "count" },
  { key: "completion_date", label: "준공일", type: "date" },
]);

function homeText(value) {
  return value === "" || value == null ? "미입력" : String(value);
}

function homeFiniteNumber(value) {
  if (value === "" || value == null) return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function homeAmount(value) {
  return value === "" || value == null || !Number.isFinite(Number(value))
    ? "정보 없음"
    : `${amount(value)}원`;
}

function formatHomeArea(value) {
  if (value === "" || value == null || !Number.isFinite(Number(value))) return "미입력";
  return `${amount(value)}㎡ · ${new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 0 }).format(Number(value) * 0.3025)}평`;
}

function formatHomeOverviewValue(field, value) {
  if (field.format === "area") return formatHomeArea(value);
  if (field.format === "percent") return value === "" || value == null ? "미입력" : `${amount(value)}%`;
  if (field.format === "count") return value === "" || value == null ? "미입력" : `${amount(value)}대`;
  return homeText(value);
}

function AssetBrief({
  asset,
  editing,
  saveState,
  writeEnabled,
  onEdit,
  onCancel,
  onSave,
  onAssetChange,
  occupancyRate,
  tenantSummaries,
  activeTenantCount,
  occupiedSpaceCount,
  vacantSpaceCount,
  plannedRows,
  occupiedArea,
  monthlyRent,
  monthlyCam,
  averageRentPerPy,
  averageCamPerPy,
  averageEnoc,
  stackingFloors,
}) {
  const occupancyPercent = occupancyRate == null
    ? null
    : Number(Math.max(0, Math.min(100, occupancyRate)).toFixed(1));
  const operatingRows = [
    ["임차인", `${activeTenantCount}개사`],
    ["점유 공간", `${occupiedSpaceCount}개`],
    ["공실 공간", `${vacantSpaceCount}개`],
    ["입주 예정", `${plannedRows.length}개`],
    ["임대면적", formatHomeArea(occupiedArea)],
    ["월 임대료 총액", homeAmount(monthlyRent)],
    ["임대료/평", homeAmount(averageRentPerPy)],
    ["월 관리비 총액", homeAmount(monthlyCam)],
    ["관리비/평", homeAmount(averageCamPerPy)],
    ["평균 E.NOC/평", homeAmount(averageEnoc)],
  ];

  return (
    <section
      data-testid="home-asset-brief"
      aria-labelledby="home-asset-brief-title"
      className="overflow-visible rounded-[18px] border border-[#333333] bg-[#252524]"
    >
      <header
        data-testid="home-asset-brief-masthead"
        className="flex flex-col gap-4 border-b border-[#3A3A3C] px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
      >
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#6E6E73]">HOME</p>
          <h2 id="home-asset-brief-title" className="mt-0.5 text-lg font-semibold tracking-tight text-white">
            자산 브리프
          </h2>
        </div>
        <div className="flex shrink-0 items-center justify-end gap-2">
          <SaveState state={saveState} />
          {editing ? (
            <>
              <button
                data-testid="home-cancel"
                type="button"
                onClick={onCancel}
                className="rounded-[8px] border border-[#3A3A3C] px-3 py-2 text-sm text-white hover:bg-white/5"
              >
                취소
              </button>
              <button
                data-testid="home-save"
                type="button"
                onClick={onSave}
                disabled={saveState === "saving" || !writeEnabled}
                className="rounded-[8px] border border-[#2C66A2] bg-[#17314E] px-4 py-2 text-sm font-semibold text-[#9AD7FF] disabled:opacity-35"
              >
                저장
              </button>
            </>
          ) : (
            <button
              data-testid="home-edit"
              type="button"
              onClick={onEdit}
              disabled={!writeEnabled}
              aria-label={`${homeText(asset.name)} 자산 정보 수정`}
              className="rounded-[8px] border border-[#3A3A3C] px-3 py-2 text-sm text-white hover:bg-white/5 disabled:opacity-35"
            >
              수정
            </button>
          )}
        </div>
      </header>

      <div className="grid xl:grid-cols-[minmax(0,0.9fr)_minmax(0,0.85fr)_minmax(280px,1.25fr)]">
        <section
          data-testid="home-asset-overview"
          aria-labelledby="home-asset-overview-title"
          className="px-5 py-4"
        >
          <h3 id="home-asset-overview-title" className="mb-2 text-sm font-semibold text-white">자산 개요</h3>
          <dl className="divide-y divide-[#333333]">
            {HOME_ASSET_OVERVIEW_FIELDS.map((field) => (
              <div key={field.key} className="grid grid-cols-[104px_minmax(0,1fr)] items-center gap-3 py-2">
                <dt className="text-xs text-[#86868B]">{field.label}</dt>
                <dd className="min-w-0 text-right">
                  {!editing || field.editable === false ? (
                    <span className="block truncate text-sm text-white" title={homeText(asset[field.key])}>
                      {formatHomeOverviewValue(field, asset[field.key])}
                    </span>
                  ) : (
                    <HomeValue
                      ariaLabel={field.label}
                      value={asset[field.key]}
                      type={field.type}
                      editing
                      onChange={(value) => onAssetChange(field.key, value)}
                      align={field.type === "number" ? "right" : "left"}
                    />
                  )}
                </dd>
              </div>
            ))}
          </dl>
        </section>

        <aside
          data-testid="home-lease-operations"
          aria-labelledby="home-lease-operations-title"
          className="border-t border-[#3A3A3C] px-5 py-4 xl:border-l xl:border-t-0"
        >
          <div className="flex items-end justify-between gap-4">
            <div>
              <h3 id="home-lease-operations-title" className="text-sm font-semibold text-white">
                임대 운영
              </h3>
              <p className="mt-1 text-[11px] text-[#6E6E73]">현재 렌트롤 기준</p>
            </div>
            <p className="text-2xl font-semibold tracking-tight text-white tabular-nums">
              {occupancyPercent == null ? "정보 없음" : `${occupancyPercent.toFixed(1)}%`}
            </p>
          </div>
          <div
            role="progressbar"
            aria-label="임대율"
            aria-valuemin="0"
            aria-valuemax="100"
            aria-valuenow={occupancyPercent}
            aria-valuetext={occupancyPercent == null ? "임대율 정보 없음" : `임대율 ${occupancyPercent.toFixed(1)}%`}
            className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#3A3A3C]"
          >
            <div
              className="h-full rounded-full bg-[#5E9EFF] transition-[width]"
              style={{ width: `${occupancyPercent ?? 0}%` }}
            />
          </div>
          <p className="mt-1 text-right text-[10px] text-[#6E6E73]">임대율</p>

          <dl className="mt-3 divide-y divide-[#333333]">
            {operatingRows.map(([label, value]) => (
              <div key={label} className="flex items-center justify-between gap-4 py-2">
                <dt className="text-xs text-[#86868B]">{label}</dt>
                <dd className="text-right text-sm font-medium text-white tabular-nums">{value}</dd>
              </div>
            ))}
          </dl>

          <div className="mt-4 border-t border-[#3A3A3C] pt-3">
            <h4 className="text-[11px] font-semibold text-[#86868B]">임차인별 운영 현황</h4>
            <div data-testid="home-tenant-operations" className="mt-2 min-w-0">
              <div className="grid grid-cols-[minmax(0,1fr)_minmax(90px,auto)_minmax(90px,auto)] gap-x-3 pb-1 text-[10px] text-[#6E6E73]">
                <span>임차인</span>
                <span className="text-right">임대면적</span>
                <span className="text-right">월 임대료</span>
              </div>
              {tenantSummaries.length ? (
                <ul className="divide-y divide-[#333333]">
                  {tenantSummaries.map((tenant) => (
                    <li
                      key={tenant.tenant_name}
                      className="grid grid-cols-[minmax(0,1fr)_minmax(90px,auto)_minmax(90px,auto)] items-center gap-x-3 py-2 text-xs"
                    >
                      <span className="truncate font-medium text-[#D1D1D6]" title={tenant.tenant_name}>
                        {tenant.tenant_name}
                      </span>
                      <span className="text-right text-[#A1A1AA] tabular-nums">
                        {formatHomeArea(tenant.leased_area_sqm)}
                      </span>
                      <span className="text-right text-white tabular-nums">
                        {amount(tenant.monthly_rent_total_krw)}원
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="border-t border-[#333333] py-2 text-xs text-[#6E6E73]">등록된 임차인이 없습니다.</p>
              )}
            </div>
          </div>
        </aside>
        <section
          data-testid="home-stacking-plan"
          aria-labelledby="home-stacking-plan-title"
          className="min-w-0 max-w-full overflow-visible border-t border-[#3A3A3C] px-5 py-4 xl:border-l xl:border-t-0"
        >
          <div className="mb-3 flex items-end justify-between gap-3">
            <h3 id="home-stacking-plan-title" className="text-sm font-semibold text-white">층별 배치</h3>
            <span className="text-[10px] text-[#6E6E73]">상층부터 표시</span>
          </div>
          <StackingPlan floors={stackingFloors} />
        </section>
      </div>
    </section>
  );
}

const HOME_ENTITY_CONFIG = Object.freeze([
  {
    entity: "asset",
    collection: "asset",
    fields: ["name", "address", "zoning_text", "land_area_sqm", "building_area_sqm", "gross_area_sqm", "leasable_area_sqm", "primary_use", "building_coverage_ratio", "floor_area_ratio", "floor_count", "structure_text", "parking_count", "completion_date"],
  },
  {
    entity: "fund",
    collection: "funds",
    fields: ["name", "fund_type", "investment_strategy", "inception_date", "maturity_date", "ownership_ratio"],
  },
  {
    entity: "beneficiary",
    collection: "investments",
    fields: ["tranche", "beneficiary_name", "agreed_amount_krw", "contributed_amount_krw"],
  },
  {
    entity: "loan",
    collection: "loans",
    fields: ["tranche", "lender_name", "committed_amount_krw", "drawdown_date", "maturity_date", "loan_type", "interest_type", "coupon_rate", "all_in_rate", "fee_rate"],
  },
]);

function MaturityList({ rows }) {
  const [selected, setSelected] = useState(null);
  const typeLabel = {
    lease: "임대차",
    fund: "펀드",
    loan: "대출",
  };
  const detailValue = (value, format) => {
    if (format === "amount") return value == null || value === "" ? "—" : `${amount(value)}원`;
    if (format === "area") return area(value);
    if (format === "percentRatio") {
      if (value == null || value === "" || !Number.isFinite(Number(value))) return "—";
      const numeric = Number(value);
      return `${new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 2 }).format(Math.abs(numeric) <= 1 ? numeric * 100 : numeric)}%`;
    }
    return display(value);
  };
  return (
    <>
      <div className="grid gap-4 lg:grid-cols-3">
        {Object.entries(typeLabel).map(([type, label]) => {
          const items = rows
            .filter((row) => (row.type || row.kind) === type);
          return (
            <div key={type}>
              <p className="mb-2 text-xs font-semibold text-[#A1A1AA]">
                {label} 만기
              </p>
              {items.length ? (
                items.map((row) => (
                  <button
                    data-testid="maturity-row"
                    type="button"
                    key={row.maturity_key || `${type}-${row.official_date}`}
                    onClick={() => setSelected(row)}
                    className="flex w-full items-center justify-between gap-3 border-b border-[#333333] py-2.5 text-left text-sm outline-none hover:bg-[#2B2B2A] focus-visible:ring-1 focus-visible:ring-[#5E9EFF]"
                  >
                    <span className="truncate text-[#D1D1D6]">
                      {maturityDisplayName(row)}
                    </span>
                    <time className="shrink-0 tabular-nums text-white">
                      {display(row.official_date || row.maturity_date)}
                    </time>
                  </button>
                ))
              ) : (
                <p className="py-2 text-sm text-[#6E6E73]">365일 이내 {label} 만기가 없습니다.</p>
              )}
            </div>
          );
        })}
      </div>
      {selected ? (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/70 p-4">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="maturity-detail-title"
            data-testid="maturity-detail-dialog"
            className="max-h-[82vh] w-full max-w-[620px] overflow-y-auto rounded-[16px] border border-[#3A3A3C] bg-[#252524] p-5 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-semibold text-[#86868B]">
                  {typeLabel[selected.type || selected.kind]} 만기 상세
                </p>
                <h2 id="maturity-detail-title" className="mt-1 text-lg font-semibold text-white">
                  {maturityDisplayName(selected)}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="rounded-[8px] border border-[#3A3A3C] px-3 py-2 text-xs font-semibold text-white hover:bg-[#303030]"
              >
                닫기
              </button>
            </div>
            <dl className="mt-5 grid grid-cols-[minmax(120px,0.38fr)_1fr] border-t border-[#3A3A3C] text-sm">
              {maturityDetailRows(selected).map(([label, value, format]) => (
                <React.Fragment key={label}>
                  <dt className="border-b border-[#333333] bg-[#202020] px-3 py-2.5 text-[#86868B]">
                    {label}
                  </dt>
                  <dd className="whitespace-pre-wrap border-b border-[#333333] px-3 py-2.5 text-white">
                    {detailValue(value, format)}
                  </dd>
                </React.Fragment>
              ))}
            </dl>
          </section>
        </div>
      ) : null}
    </>
  );
}

function cloneHomeProjection(value) {
  if (Array.isArray(value)) return value.map(cloneHomeProjection);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, nestedValue]) => [
        key,
        cloneHomeProjection(nestedValue),
      ]),
    );
  }
  return value;
}

function cloneHomeData(data) {
  const cloned = cloneHomeProjection(data || {});
  return {
    ...cloned,
    asset: cloned?.asset ? { ...cloned.asset } : null,
    funds: (Array.isArray(cloned?.funds) ? cloned.funds : []).map((row) => ({ ...row })),
    investments: (Array.isArray(cloned?.investments) ? cloned.investments : []).map((row) => ({
      ...row,
      agreed_amount_krw: row.agreed_amount_krw ?? row.commitment_amount_krw ?? "",
      contributed_amount_krw: row.contributed_amount_krw ?? row.invested_amount_krw ?? "",
    })),
    loans: (Array.isArray(cloned?.loans) ? cloned.loans : []).map((row) => ({
      ...row,
      committed_amount_krw: row.committed_amount_krw
        ?? row.commitment_amount_krw
        ?? row.commitment_amount
        ?? "",
      coupon_rate: row.coupon_rate ?? row.loan_rate ?? row.interest_rate ?? "",
      all_in_rate: row.all_in_rate ?? row.all_in ?? "",
      fee_rate: row.fee_rate ?? row.fee ?? "",
    })),
  };
}

function HomePanel({ assetCode, resource, maturities }) {
  const primaryHomeData = primaryHomeDataForAsset(resource.data, assetCode);
  const appliedHomeRequestIdRef = useRef(null);
  const [homeSnapshot, setHomeSnapshot] = useState(() => cloneHomeData(primaryHomeData || {}));
  const sourceData = useMemo(() => cloneHomeData(homeSnapshot), [homeSnapshot]);
  const [isHomeEditing, setIsHomeEditing] = useState(false);
  const [homeDraft, setHomeDraft] = useState(() => cloneHomeData(primaryHomeData || {}));
  const [saveState, setSaveState] = useState("idle");
  const [homeError, setHomeError] = useState(null);
  useEffect(() => {
    if (!primaryHomeData || isHomeEditing) return;
    if (appliedHomeRequestIdRef.current === resource.requestId) return;
    appliedHomeRequestIdRef.current = resource.requestId;
    const snapshot = cloneHomeData(primaryHomeData);
    setHomeSnapshot(snapshot);
    setHomeDraft(snapshot);
  }, [isHomeEditing, primaryHomeData, resource.requestId]);
  const workingData = isHomeEditing ? homeDraft : sourceData;
  const asset = workingData.asset;
  const funds = workingData.funds;
  const investments = workingData.investments;
  const loans = workingData.loans;
  const rent = usePrimaryResource(
    DATA_PLATFORM_ACTIONS.rentRollRead,
    { asset_code: assetCode, limit: 500 },
    { enabled: Boolean(assetCode) },
  );
  const rows = Array.isArray(rent.data?.rows) ? rent.data.rows : [];
  const homeAsOfDate = todayKst();
  const occupiedRows = rows.filter((row) => isCurrentOccupiedRentRollRow(row, homeAsOfDate));
  const plannedRows = rows.filter((row) => row.occupancy_status === "planned");
  const vacantRows = rows.filter((row) => row.occupancy_status === "vacant");
  const tenantMap = new Map();
  occupiedRows.forEach((row) => {
    const tenantName = String(row.tenant_name || "").trim();
    if (!tenantName) return;
    const current = tenantMap.get(tenantName) || {
      tenant_name: tenantName,
      leased_area_sqm: 0,
      monthly_rent_total_krw: 0,
    };
    current.leased_area_sqm += Number(row.leased_area_sqm || 0);
    current.monthly_rent_total_krw += Number(row.monthly_rent_total_krw || 0);
    tenantMap.set(tenantName, current);
  });
  const tenantSummaries = [...tenantMap.values()].sort(
    (left, right) => right.leased_area_sqm - left.leased_area_sqm,
  );
  const occupancySummary = sourceData.occupancy_summary || {};
  const summarizedOccupiedArea = homeFiniteNumber(occupancySummary.occupied_area_sqm);
  const summarizedDenominatorArea = homeFiniteNumber(occupancySummary.denominator_area_sqm);
  const summarizedOccupancyRate = homeFiniteNumber(occupancySummary.occupancy_rate);
  const normalizedOccupancySummary = normalizeHomeOccupancySummary({
    ...occupancySummary,
    occupied_area_sqm: summarizedOccupiedArea,
    denominator_area_sqm: summarizedDenominatorArea,
    occupancy_rate: summarizedOccupancyRate,
  });
  const occupiedArea = normalizedOccupancySummary.occupiedAreaSqm ?? 0;
  const occupancyRate = normalizedOccupancySummary.occupancyRate;
  const activeTenantCount = Number.isFinite(Number(occupancySummary.active_tenant_count))
    ? Number(occupancySummary.active_tenant_count)
    : tenantSummaries.length;
  const occupiedSpaceCount = Number.isFinite(Number(occupancySummary.occupied_space_count))
    ? Number(occupancySummary.occupied_space_count)
    : occupiedRows.length;
  const vacantSpaceCount = Number.isFinite(Number(occupancySummary.vacant_space_count))
    ? Number(occupancySummary.vacant_space_count)
    : vacantRows.length;
  const monthlyRent = occupiedRows.reduce(
    (sum, row) => sum + Number(row.monthly_rent_total_krw || 0),
    0,
  );
  const monthlyCam = occupiedRows.reduce(
    (sum, row) => sum + Number(row.monthly_cam_total_krw || 0),
    0,
  );
  const occupiedAreaPy = occupiedArea * 0.3025;
  const averageRentPerPy = occupiedAreaPy > 0 ? monthlyRent / occupiedAreaPy : null;
  const averageCamPerPy = occupiedAreaPy > 0 ? monthlyCam / occupiedAreaPy : null;
  const averageEnoc = occupiedAreaPy > 0 ? (monthlyRent + monthlyCam) / occupiedAreaPy : null;
  const stackingFloors = buildStackingFloorsFromRows(
    occupiedRows,
    [],
  );
  const homeDocument = useMemo(() => buildHomeDocumentPayload(homeDraft), [homeDraft]);
  const sourceDocument = useMemo(() => buildHomeDocumentPayload(sourceData), [sourceData]);
  const homeChanged = !documentsEqual(homeDocument, sourceDocument);
  const updateHomeDraft = (entity, rowIndex, field, value) => {
    const config = HOME_ENTITY_CONFIG.find((item) => item.entity === entity);
    if (!config) return;
    setSaveState("dirty");
    setHomeDraft((current) => {
      if (config.collection === "asset") {
        return { ...current, asset: { ...current.asset, [field]: value } };
      }
      return {
        ...current,
        [config.collection]: current[config.collection].map((row, index) => (
          index === rowIndex ? { ...row, [field]: value } : row
        )),
      };
    });
  };
  const saveHome = async () => {
    if (!homeChanged) {
      setIsHomeEditing(false);
      return;
    }
    setSaveState("saving");
    setHomeError(null);
    try {
      let readback = null;
      try {
        await invokeDataPlatform(DATA_PLATFORM_ACTIONS.homeBatchSave, {
          asset_code: assetCode,
          client_request_id: createClientRequestId("home"),
          expected_revisions: {
            asset: sourceData.asset?.revision ?? resource.revision,
            fund: sourceData.funds?.[0]?.revision,
          },
          ...homeDocument,
        });
      } catch (cause) {
        if (!isDataPlatformRevisionConflict(cause)) throw cause;
        const conflictReadback = await invokeDataPlatform(DATA_PLATFORM_ACTIONS.homeRead, {
          asset_code: assetCode,
          as_of_date: todayKst(),
        });
        if (!documentsEqual(homeDocument, buildHomeDocumentPayload(conflictReadback.data))) {
          throw cause;
        }
        readback = conflictReadback;
      }
      readback ||= await invokeDataPlatform(DATA_PLATFORM_ACTIONS.homeRead, {
        asset_code: assetCode,
        as_of_date: todayKst(),
      });
      const readbackDocument = buildHomeDocumentPayload(readback.data);
      if (!documentsEqual(homeDocument, readbackDocument)) {
        throw new Error("HOME_DOCUMENT_READBACK_MISMATCH");
      }
      const snapshot = cloneHomeData(readback.data);
      setHomeSnapshot(snapshot);
      setHomeDraft(snapshot);
      setSaveState("saved");
      setIsHomeEditing(false);
      resource.reload();
    } catch (cause) {
      setSaveState(isDataPlatformRevisionConflict(cause) ? "dirty" : "error");
      setHomeError(cause);
    }
  };
  const cancelHome = () => {
    setHomeDraft(cloneHomeData(homeSnapshot));
    setIsHomeEditing(false);
    setSaveState("idle");
    setHomeError(null);
  };
  const writeEnabled = sourceData.write_enabled === true;
  if (!assetCode) return <EmptyText>조회 가능한 자산이 없습니다.</EmptyText>;
  return (
    <div className="space-y-4">
      <LoadingLine
        visible={resource.loading || maturities.loading || rent.loading}
      />
      <DataPlatformErrorDialog
        error={homeError || resource.error || maturities.error || rent.error}
        onDismiss={() => setHomeError(null)}
      />
      {asset ? (
        <AssetBrief
          asset={asset}
          editing={isHomeEditing}
          saveState={saveState}
          writeEnabled={writeEnabled}
          onEdit={() => {
            setHomeDraft(cloneHomeData(homeSnapshot));
            setIsHomeEditing(true);
            setSaveState("idle");
          }}
          onCancel={cancelHome}
          onSave={() => void saveHome()}
          onAssetChange={(field, value) => updateHomeDraft("asset", 0, field, value)}
          occupancyRate={occupancyRate}
          tenantSummaries={tenantSummaries}
          activeTenantCount={activeTenantCount}
          occupiedSpaceCount={occupiedSpaceCount}
          vacantSpaceCount={vacantSpaceCount}
          plannedRows={plannedRows}
          occupiedArea={occupiedArea}
          monthlyRent={monthlyRent}
          monthlyCam={monthlyCam}
          averageRentPerPy={averageRentPerPy}
          averageCamPerPy={averageCamPerPy}
          averageEnoc={averageEnoc}
          stackingFloors={stackingFloors}
        />
      ) : (
        <section data-testid="home-asset-brief" className="rounded-[18px] border border-[#333333] bg-[#252524] px-5">
          <EmptyText />
        </section>
      )}
      <div className="grid gap-4 xl:grid-cols-[1.35fr_0.65fr]">
        <Section title="펀드·수익증권 투자" className="min-w-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead>
                <tr className="text-[11px] text-[#86868B]">
                  {[
                    "펀드명",
                    "유형",
                    "투자전략",
                    "설정일",
                    "만기일",
                    "지분율",
                  ].map((label) => (
                    <th
                      key={label}
                      className="border-b border-[#333333] px-2 py-2 text-left"
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {funds.map((fund, fundIndex) => (
                  <tr key={fund.fund_code || fundIndex}>
                    {[
                      ["name", "text"],
                      ["fund_type", "text"],
                      ["investment_strategy", "text"],
                      ["inception_date", "date"],
                      ["maturity_date", "date"],
                      ["ownership_ratio", "number"],
                    ].map(([field, type]) => (
                      <td
                        key={field}
                        className="border-b border-[#333333] px-1 py-1"
                      >
                        <HomeValue
                          value={fund[field]}
                          type={type}
                          editing={isHomeEditing}
                          onChange={(value) => updateHomeDraft("fund", fundIndex, field, value)}
                          align={type === "number" ? "right" : "left"}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {investments.length ? (
            <div className="mt-4 overflow-x-auto">
              <p className="mb-2 text-xs font-semibold text-[#A1A1AA]">
                수익증권
              </p>
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="text-[11px] text-[#86868B]">
                    {["종 구분", "투자자", "약정액", "투입액"].map(
                      (label) => (
                        <th
                          key={label}
                          className="border-b border-[#333333] px-2 py-2 text-left"
                        >
                          {label}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {investments.map((row, investmentIndex) => (
                    <tr key={`${row.beneficiary_name || "investment"}-${investmentIndex}`}>
                      {[
                        ["tranche", "text"],
                        ["beneficiary_name", "text"],
                        ["agreed_amount_krw", "number"],
                        ["contributed_amount_krw", "number"],
                      ].map(([field, type]) => (
                        <td
                          key={field}
                          className="border-b border-[#333333] px-1 py-1"
                        >
                          <HomeValue
                            value={row[field]}
                            type={type}
                            editing={isHomeEditing}
                            onChange={(value) => updateHomeDraft("beneficiary", investmentIndex, field, value)}
                            align={type === "number" ? "right" : "left"}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </Section>
        <Section title="다가오는 만기">
          <MaturityList rows={normalizeMaturities(maturities.data)} />
        </Section>
      </div>
      <Section title="대출 현황">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] text-sm">
            <thead>
              <tr className="text-[11px] text-[#86868B]">
                {[
                  "구분",
                  "대주",
                  "약정액",
                  "실행일",
                  "만기일",
                  "대출 유형",
                  "금리 유형",
                  "Coupon",
                  "All-in",
                  "수수료",
                ].map((label) => (
                  <th
                    key={label}
                    className="border-b border-[#333333] px-2 py-2 text-left"
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loans.map((loan, loanIndex) => (
                <tr key={`${loan.tranche || loan.lender_name || "loan"}-${loanIndex}`}>
                  {[
                    ["tranche", "text"],
                    ["lender_name", "text"],
                    ["committed_amount_krw", "number"],
                    ["drawdown_date", "date"],
                    ["maturity_date", "date"],
                    ["loan_type", "text"],
                    ["interest_type", "text"],
                    ["coupon_rate", "text"],
                    ["all_in_rate", "text"],
                    ["fee_rate", "text"],
                  ].map(([field, type]) => (
                    <td
                      key={field}
                      className="border-b border-[#333333] px-1 py-1"
                    >
                      <HomeValue
                        value={loan[field]}
                        type={type}
                        editing={isHomeEditing}
                        onChange={(value) => updateHomeDraft("loan", loanIndex, field, value)}
                        align={type === "number" ? "right" : "left"}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
    </div>
  );
}

function sortRows(rows, sort) {
  const column = RENT_ROLL_DISPLAY_COLUMNS.find((item) => item.key === sort?.key);
  if (!column) return rows;
  const direction = sort.direction === "asc" ? 1 : -1;
  return rows
    .map((row, index) => ({ row, index }))
    .sort((a, b) => {
      let left = a.row[column.key];
      let right = b.row[column.key];
      if (column.key === "floor_label") {
        left = rentRollFloorSortValue(left);
        right = rentRollFloorSortValue(right);
      }
      if (column.kind === "multi_select") {
        left = normalizeCostTerms(left, column.options).join(", ");
        right = normalizeCostTerms(right, column.options).join(", ");
      }
      if (column.kind === "goods_multi_select") {
        left = normalizeRentRollGoodsTypes(left).join(", ");
        right = normalizeRentRollGoodsTypes(right).join(", ");
      }
      if (column.kind === "number" || column.kind === "readonly") {
        left = left === "" || left == null ? null : Number(left);
        right = right === "" || right == null ? null : Number(right);
      }
      if (left == null || left === "")
        return right == null || right === "" ? a.index - b.index : 1;
      if (right == null || right === "") return -1;
      return (
        (typeof left === "number" && typeof right === "number"
          ? left - right
          : String(left).localeCompare(String(right), "ko-KR", {
              numeric: true,
            })) * direction || a.index - b.index
      );
    })
    .map(({ row }) => row);
}

function RentRollCommaNumberInput({
  field,
  ariaLabel,
  invalid,
  describedBy,
  value,
  onChange,
  disabled,
}) {
  const [focused, setFocused] = useState(false);
  const displayValue = focused
    ? parseRentRollMoneyInput(value)
    : formatRentRollCommaInput(value);
  return (
    <input
      data-draft-field={field}
      aria-label={ariaLabel}
      aria-invalid={invalid || undefined}
      aria-describedby={invalid ? describedBy : undefined}
      type="text"
      inputMode="decimal"
      value={displayValue}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onChange={(event) => onChange(parseRentRollMoneyInput(event.target.value))}
      disabled={disabled}
      className={`${INPUT_CLASS} text-right tabular-nums`}
    />
  );
}

function percentInputValue(value) {
  if (value === "" || value === null || value === undefined) return "";
  const source = String(value).trim();
  const text = source.replace(/%/gu, "").trim();
  const numeric = Number(text);
  if (!Number.isFinite(numeric)) return text;
  const percent = !source.includes("%") && numeric > 0 && numeric < 1
    ? numeric * 100
    : numeric;
  return String(Number(percent.toFixed(10)));
}

function percentStoredValue(value) {
  const text = String(value ?? "").trim();
  return text === "" ? "" : `${text}%`;
}

function formatRentRollCommaInput(value) {
  const text = String(value ?? "").trim().replaceAll(",", "");
  if (!text) return "";
  const match = text.match(/^(-?)(\d*)(\.\d*)?$/u);
  if (!match || (!match[2] && !match[3])) {
    const numeric = Number(text);
    return Number.isFinite(numeric)
      ? new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 20 }).format(numeric)
      : text;
  }
  const integer = match[2] || "0";
  const grouped = integer.replace(/\B(?=(\d{3})+(?!\d))/gu, ",");
  return `${match[1]}${grouped}${match[3] || ""}`;
}

function formatRentRollReadonlyValue(column, row) {
  const value = column.key === "current_total_cost_per_py_krw"
    ? calculateRentRollENoc(row)
    : row[column.key];
  const maximumFractionDigits = ["contract_months", "effective_rent"].includes(column.key)
    ? 0
    : 2;
  return formatRentRollNumber(value, maximumFractionDigits) || "—";
}

function rentFreePeriodsFromRow(row = {}) {
  if (Array.isArray(row.rent_free_periods) && row.rent_free_periods.length) {
    return row.rent_free_periods.map((period, index) => {
      const normalized = normalizeRentFreePeriod(period);
      return {
        id: period.id || `rent-free-${index}`,
        start_date: normalized.start_date || "",
        end_date: normalized.end_date || "",
        months: normalized.months ?? "",
        reason: normalized.reason || "",
        notes: normalized.notes || "",
      };
    });
  }
  if (row.rent_free_start_date || row.rent_free_end_date || Number(row.rent_free_months) > 0) {
    return [{
      id: "rent-free-legacy",
      start_date: row.rent_free_start_date || "",
      end_date: row.rent_free_end_date || "",
      months: Number(row.rent_free_months || 0),
      reason: "",
      notes: "",
    }];
  }
  return [];
}

function RentFreePeriodsDialog({ row, disabled, onClose, onSave }) {
  const [periods, setPeriods] = useState(() => rentFreePeriodsFromRow(row));
  const firstInputRef = useRef(null);
  useEffect(() => {
    firstInputRef.current?.focus();
    const closeOnEscape = (event) => {
      if (event.key === "Escape") onClose();
    };
    globalThis.addEventListener?.("keydown", closeOnEscape);
    return () => globalThis.removeEventListener?.("keydown", closeOnEscape);
  }, [onClose]);
  const invalid = periods.some((period) => !isValidRentFreePeriod(period));
  const updatePeriod = (id, field, value) => setPeriods((current) => current.map((period) => {
    if (period.id !== id) return period;
    const next = { ...period, [field]: value };
    if (
      ["start_date", "end_date"].includes(field)
      && next.start_date
      && next.end_date
      && next.end_date >= next.start_date
    ) {
      next.months = normalizeRentFreePeriod(next).months ?? "";
    }
    return next;
  }));
  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/70 p-4">
      <section
        data-testid="rent-free-period-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="rent-free-period-dialog-title"
        className="w-full max-w-[1040px] rounded-[16px] border border-[#3A3A3C] bg-[#252524] p-5 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="rent-free-period-dialog-title" className="text-base font-semibold text-white">렌트프리 제공기간</h2>
            <p className="mt-1 text-xs text-[#86868B]">계약 중 제공되는 무상 임대기간을 모두 등록합니다.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="렌트프리 상세 닫기" className="rounded-[7px] border border-[#3A3A3C] px-3 py-1.5 text-xs text-white">닫기</button>
        </div>
        <div className="mt-4 max-h-[52vh] divide-y divide-[#333333] overflow-y-auto border-y border-[#333333]">
          {periods.length ? periods.map((period, index) => (
            <div key={period.id} className="grid gap-2 py-3 sm:grid-cols-[1fr_1fr_0.7fr_1fr_1fr_auto] sm:items-end">
              <label className="text-[11px] text-[#86868B]">
                {index + 1}차 시작일
                <input
                  ref={index === 0 ? firstInputRef : undefined}
                  type="date"
                  value={period.start_date}
                  onChange={(event) => updatePeriod(period.id, "start_date", event.target.value)}
                  disabled={disabled}
                  className={`${INPUT_CLASS} mt-1 bg-[#202020]`}
                />
              </label>
              <label className="text-[11px] text-[#86868B]">
                {index + 1}차 종료일
                <input
                  type="date"
                  value={period.end_date}
                  onChange={(event) => updatePeriod(period.id, "end_date", event.target.value)}
                  disabled={disabled}
                  className={`${INPUT_CLASS} mt-1 bg-[#202020]`}
                />
              </label>
              <label className="text-[11px] text-[#86868B]">
                {index + 1}차 개월
                <input
                  type="number"
                  data-testid="rent-free-months"
                  min="0.01"
                  step="0.01"
                  value={period.months ?? ""}
                  onChange={(event) => updatePeriod(period.id, "months", event.target.value)}
                  disabled={disabled}
                  readOnly={Boolean(period.start_date && period.end_date)}
                  aria-label={`${index + 1}차 렌트프리 개월`}
                  title={period.start_date && period.end_date ? "시작일과 종료일 기준으로 자동 계산됩니다." : "양수 개월을 직접 입력하세요."}
                  className={`${INPUT_CLASS} mt-1 bg-[#202020] text-right tabular-nums read-only:text-[#86868B]`}
                />
              </label>
              <label className="text-[11px] text-[#86868B]">
                렌트프리 사유
                <input
                  type="text"
                  value={period.reason}
                  onChange={(event) => updatePeriod(period.id, "reason", event.target.value)}
                  disabled={disabled}
                  placeholder="예: 오픈 지원"
                  className={`${INPUT_CLASS} mt-1 bg-[#202020]`}
                />
              </label>
              <label className="text-[11px] text-[#86868B]">
                렌트프리 비고
                <input
                  type="text"
                  value={period.notes}
                  onChange={(event) => updatePeriod(period.id, "notes", event.target.value)}
                  disabled={disabled}
                  placeholder="선택 입력"
                  className={`${INPUT_CLASS} mt-1 bg-[#202020]`}
                />
              </label>
              <button
                type="button"
                aria-label={`${index + 1}차 렌트프리 기간 삭제`}
                onClick={() => setPeriods((current) => current.filter((item) => item.id !== period.id))}
                disabled={disabled}
                className="rounded-[7px] border border-[#5A3333] px-3 py-2 text-xs text-[#FF9B9B] disabled:opacity-35"
              >
                삭제
              </button>
            </div>
          )) : (
            <p className="py-5 text-sm text-[#86868B]">등록된 렌트프리 기간이 없습니다.</p>
          )}
        </div>
        {invalid ? <p role="alert" className="mt-2 text-xs text-[#F2CF75]">각 기간에 시작일·종료일을 모두 입력하거나 양수 개월을 입력해 주세요.</p> : null}
        <div className="mt-4 flex flex-wrap justify-between gap-2">
          <button
            type="button"
            onClick={() => setPeriods((current) => [...current, {
              id: `rent-free-${globalThis.crypto?.randomUUID?.() || Date.now()}`,
              start_date: "",
              end_date: "",
              months: 0,
              reason: "",
              notes: "",
            }])}
            disabled={disabled}
            className="rounded-[8px] border border-[#3A3A3C] px-3 py-2 text-sm text-white disabled:opacity-35"
          >
            렌트프리 기간 추가
          </button>
          <button
            type="button"
            onClick={() => onSave(periods.map((period) => normalizeRentFreePeriod(period)))}
            disabled={disabled || invalid}
            className="rounded-[8px] bg-[#0A6CFF] px-4 py-2 text-sm font-semibold text-white disabled:opacity-35"
          >
            적용
          </button>
        </div>
      </section>
    </div>
  );
}

function PresetTextCell({
  column,
  value,
  disabled,
  invalid = false,
  describedBy,
  rowLabel,
  onChange,
  onCommit,
}) {
  const options = Array.isArray(column.options) ? column.options : [];
  const known = options.includes(value) && value !== "기타";
  const [customMode, setCustomMode] = useState(Boolean(value) && !known);
  const showCustom = !known && (customMode || Boolean(value));
  return (
    <div className="flex min-w-[220px] items-center gap-1">
      <select
        data-draft-field={column.key}
        aria-label={`${rowLabel} ${column.label} 유형`}
        aria-invalid={invalid || undefined}
        aria-describedby={invalid ? describedBy : undefined}
        value={showCustom ? "기타" : value || ""}
        disabled={disabled}
        onChange={(event) => {
          const next = event.target.value;
          if (next === "기타") {
            setCustomMode(true);
            if (known) onChange("");
            return;
          }
          setCustomMode(false);
          onChange(next);
          onCommit(next);
        }}
        className={`${INPUT_CLASS} min-w-[104px] flex-1`}
      >
        <option value="">선택</option>
        {options.map((option) => (
          <option key={option} value={option}>{option}</option>
        ))}
      </select>
      {showCustom ? (
        <input
          data-draft-field={column.key}
          aria-label={`${rowLabel} ${column.label} 직접 작성`}
          aria-invalid={invalid || undefined}
          aria-describedby={invalid ? describedBy : undefined}
          type="text"
          value={known ? "" : value || ""}
          onChange={(event) => onChange(event.target.value)}
          onBlur={(event) => onCommit(event.currentTarget.value)}
          disabled={disabled}
          placeholder="직접 작성"
          className={`${INPUT_CLASS} min-w-[104px] flex-1`}
        />
      ) : null}
    </div>
  );
}

function MultiSelectCell({
  column,
  value,
  disabled,
  invalid = false,
  describedBy,
  rowLabel,
  onChange,
  onCommit,
}) {
  const [customItem, setCustomItem] = useState("");
  const [customMode, setCustomMode] = useState(false);
  const standardOptions = Array.isArray(column.options) ? column.options : [];
  const selected = normalizeCostTerms(value, standardOptions);
  const customItems = selected.filter((item) => !standardOptions.includes(item));
  const apply = (items) => {
    const serialized = serializeCostTerms(value, items);
    onChange(serialized);
    onCommit(serialized);
  };
  const toggle = (item) => {
    if (standardOptions.includes(item)) {
      setCustomMode(false);
      setCustomItem("");
    }
    apply(
      selected.includes(item)
        ? selected.filter((valueItem) => valueItem !== item)
        : [...selected, item],
    );
  };
  const addCustom = () => {
    const next = customItem.trim();
    if (!next) return;
    apply([...selected, next]);
    setCustomItem("");
    setCustomMode(false);
  };
  return (
    <details
      className="relative min-w-[190px]"
      onToggle={(event) => {
        if (disabled && event.currentTarget.open) event.currentTarget.open = false;
        if (!event.currentTarget.open) {
          setCustomMode(false);
          setCustomItem("");
        }
      }}
    >
      <summary
        data-draft-field={column.key}
        aria-label={`${rowLabel} ${column.label}`}
        aria-disabled={disabled ? "true" : undefined}
        aria-invalid={invalid || undefined}
        aria-describedby={invalid ? describedBy : undefined}
        onClick={(event) => {
          if (disabled) event.preventDefault();
        }}
        className="cursor-pointer list-none rounded-[6px] px-2 py-1.5 text-xs text-[#D1D1D6] hover:bg-[#303030] focus:outline-none focus:ring-1 focus:ring-[#5E9EFF] aria-disabled:cursor-not-allowed aria-disabled:opacity-35"
      >
        {selected.length ? `${selected.length}개 선택` : "항목 선택"}
      </summary>
      <div className="absolute left-0 top-full z-[70] mt-1 w-[300px] rounded-[10px] border border-[#3A3A3C] bg-[#202020] p-3 shadow-2xl">
        <div className="max-h-52 space-y-1 overflow-y-auto pr-1">
          {standardOptions.map((option) => (
            <label key={option} className="flex cursor-pointer items-start gap-2 rounded px-1.5 py-1 text-xs text-[#E5E5E5] hover:bg-white/5">
              <input
                type="checkbox"
                checked={selected.includes(option)}
                onChange={() => toggle(option)}
                disabled={disabled}
                className="mt-0.5"
              />
              <span>{option}</span>
            </label>
          ))}
          {customItems.map((item) => (
            <div key={item} className="flex items-start justify-between gap-2 rounded bg-white/[0.04] px-2 py-1.5 text-xs text-[#D1D1D6]">
              <span className="break-all">{item}</span>
              <button type="button" aria-label={`${item} 삭제`} onClick={() => toggle(item)} disabled={disabled} className="shrink-0 text-[#FF9B9B]">×</button>
            </div>
          ))}
        </div>
        <div className="mt-2 flex items-center gap-1">
          <button
            type="button"
            aria-pressed={customMode}
            onClick={() => setCustomMode((current) => !current)}
            disabled={disabled}
            className="shrink-0 rounded-[6px] border border-[#3A3A3C] px-2 py-1.5 text-xs text-white disabled:opacity-35"
          >기타</button>
          {customMode ? (
            <div className="flex min-w-0 flex-1 items-center gap-1">
              <input
                type="text"
                aria-label={`${column.label} 사용자 항목`}
                value={customItem}
                onChange={(event) => setCustomItem(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    addCustom();
                  }
                }}
                disabled={disabled}
                placeholder="사용자 항목 추가"
                className={INPUT_CLASS}
              />
              <button type="button" onClick={addCustom} disabled={disabled || !customItem.trim()} className="shrink-0 rounded-[6px] border border-[#3A3A3C] px-2 py-1.5 text-xs text-white disabled:opacity-35">추가</button>
            </div>
          ) : null}
        </div>
      </div>
    </details>
  );
}

function GoodsMultiSelectCell({
  value,
  options,
  disabled,
  invalid = false,
  describedBy,
  rowLabel,
  onChange,
}) {
  const [customItem, setCustomItem] = useState("");
  const selected = normalizeRentRollGoodsTypes(value);
  const availableOptions = [...new Set([
    ...(Array.isArray(options) ? options : []),
    ...selected,
  ])];
  const apply = (items) => onChange(serializeRentRollGoodsTypes(items));
  const toggle = (item) => apply(
    selected.includes(item)
      ? selected.filter((selectedItem) => selectedItem !== item)
      : [...selected, item],
  );
  const addCustom = () => {
    const next = customItem.trim();
    if (!next) return;
    apply([...selected, next]);
    setCustomItem("");
  };
  return (
    <details className="relative min-w-[118px]">
      <summary
        data-draft-field="goods_type"
        aria-label={`${rowLabel} 취급 화물`}
        aria-disabled={disabled ? "true" : undefined}
        aria-invalid={invalid || undefined}
        aria-describedby={invalid ? describedBy : undefined}
        title={selected.join(", ")}
        onClick={(event) => {
          if (disabled) event.preventDefault();
        }}
        className="cursor-pointer list-none overflow-hidden text-ellipsis whitespace-nowrap rounded-[6px] px-2 py-1.5 text-xs text-[#D1D1D6] hover:bg-[#303030] focus:outline-none focus:ring-1 focus:ring-[#5E9EFF] aria-disabled:cursor-not-allowed aria-disabled:opacity-35"
      >
        {selected.length ? selected.join(", ") : "항목 선택"}
      </summary>
      <div className="absolute left-0 top-full z-[70] mt-1 w-[320px] rounded-[10px] border border-[#3A3A3C] bg-[#202020] p-3 shadow-2xl">
        <div className="max-h-52 space-y-1 overflow-y-auto pr-1">
          {availableOptions.map((option) => (
            <label key={option} className="flex cursor-pointer items-start gap-2 rounded px-1.5 py-1 text-xs text-[#E5E5E5] hover:bg-white/5">
              <input
                type="checkbox"
                checked={selected.includes(option)}
                onChange={() => toggle(option)}
                disabled={disabled}
                className="mt-0.5"
              />
              <span>{option}</span>
            </label>
          ))}
        </div>
        <div className="mt-2 flex items-center gap-1">
          <input
            type="text"
            aria-label="취급 화물 사용자 항목"
            value={customItem}
            onChange={(event) => setCustomItem(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                addCustom();
              }
            }}
            disabled={disabled}
            placeholder="취급 화물 항목 추가"
            className={INPUT_CLASS}
          />
          <button
            type="button"
            onClick={addCustom}
            disabled={disabled || !customItem.trim()}
            className="shrink-0 rounded-[6px] border border-[#3A3A3C] px-2 py-1.5 text-xs text-white disabled:opacity-35"
          >
            추가
          </button>
        </div>
      </div>
    </details>
  );
}

function parsePaste(text) {
  return String(text || "")
    .split(/\r?\n/u)
    .filter((line) => line.trim())
    .map((line, index) => {
      const row = emptyRentRollRow(`paste-${Date.now()}-${index}`);
      line.split("\t").forEach((value, columnIndex) => {
        const key = RENT_ROLL_PASTE_COLUMNS[columnIndex];
        if (!key) return;
        const column = RENT_ROLL_COLUMNS.find((item) => item.key === key);
        const trimmed = value.trim();
        row[key] = column?.kind === "multi_select"
          ? serializeCostTerms({}, trimmed ? [trimmed] : [])
          : column?.kind === "goods_multi_select"
            ? serializeRentRollGoodsTypes(trimmed)
          : column?.kind === "percent"
            ? percentStoredValue(percentInputValue(trimmed))
            : column?.kind === "number"
              ? parseRentRollMoneyInput(trimmed)
              : trimmed;
      });
      if (row.occupancy_status === "임대") row.occupancy_status = "occupied";
      if (row.occupancy_status === "공실") row.occupancy_status = "vacant";
      if (row.occupancy_status === "예정") row.occupancy_status = "planned";
      return deriveRentRollRow(row);
    });
}

function rentRollRowsFromReadback(readbackRows = []) {
  return readbackRows.map((row, index) => ({
    ...deriveRentRollRow(row),
    _draft_id: row._draft_id || `row-${index}`,
    operation: "update",
    display_order: row.display_order ?? index + 1,
  }));
}

function RentRollPanel({ assetCode }) {
  const resource = usePrimaryResource(
    DATA_PLATFORM_ACTIONS.rentRollRead,
    { asset_code: assetCode, limit: 500 },
    { enabled: Boolean(assetCode) },
  );
  const [rows, setRows] = useState([]);
  const [rentRevision, setRentRevision] = useState(null);
  const [sort, setSort] = useState(DEFAULT_SORT);
  const [paste, setPaste] = useState("");
  const [saveState, setSaveState] = useState("idle");
  const [error, setError] = useState(null);
  const [dirtyRowIds, setDirtyRowIds] = useState(() => new Set());
  const [dirtyFieldsByRow, setDirtyFieldsByRow] = useState(() => new Map());
  const [validationMessages, setValidationMessages] = useState([]);
  const [draftReady, setDraftReady] = useState(false);
  const [draggedRowId, setDraggedRowId] = useState(null);
  const [dragOverTarget, setDragOverTarget] = useState(null);
  const [rentFreeRowId, setRentFreeRowId] = useState(null);
  const draftHydratedRef = useRef(false);
  const saveInFlightRef = useRef(false);
  const rowRefs = useRef(new Map());
  const draftStorageKey = `gate6-rent-roll-draft-${assetCode}`;
  const writeEnabled = resource.data?.write_enabled === true;
  const rentRollEditingDisabled = !writeEnabled || saveState === "saving";
  useEffect(() => {
    if (!resource.data) return;
    const source = Array.isArray(resource.data?.rows) ? resource.data.rows : [];
    const primaryRows = sortRows(rentRollRowsFromReadback(source), DEFAULT_SORT);
    let restoredDocumentRevision = resource.revision;
    let restoredRows = primaryRows;
    let restoredSort = DEFAULT_SORT;
    let restoredDirtyRowIds = new Set();
    let restoredDirtyFieldsByRow = new Map();
    try {
      const storedDraft = JSON.parse(
        globalThis.sessionStorage?.getItem(draftStorageKey) || "null",
      );
      if (storedDraft && Array.isArray(storedDraft.dirtyRows)) {
        const primaryById = new Map(primaryRows.map((row) => [rowId(row), row]));
        const storedFields = new Map(
          Array.isArray(storedDraft.dirtyFieldsByRow)
            ? storedDraft.dirtyFieldsByRow
            : [],
        );
        const dirtyById = new Map(
          storedDraft.dirtyRows.map((row) => {
            const id = rowId(row);
            return [id, deriveRentRollRow(row)];
          }),
        );
        const orderedIds = Array.isArray(storedDraft.rowOrder)
          ? storedDraft.rowOrder
          : primaryRows.map(rowId);
        restoredRows = orderedIds
          .map((id) => dirtyById.get(id) || primaryById.get(id))
          .filter(Boolean);
        primaryRows.forEach((row) => {
          if (!orderedIds.includes(rowId(row))) restoredRows.push(row);
        });
        dirtyById.forEach((row, id) => {
          if (!restoredRows.some((item) => rowId(item) === id)) restoredRows.push(row);
        });
        restoredDirtyRowIds = new Set(
          (storedDraft.dirtyRowIds || []).filter((id) =>
            restoredRows.some((row) => rowId(row) === id),
          ),
        );
        restoredDirtyFieldsByRow = new Map(
          [...restoredDirtyRowIds].map((id) => [
            id,
            new Set(Array.isArray(storedFields.get(id))
              ? storedFields.get(id)
              : RENT_ROLL_EDITABLE_FIELDS),
          ]),
        );
        restoredSort = storedDraft.sort === null || storedDraft.sort?.key
          ? storedDraft.sort
          : DEFAULT_SORT;
        const storedRevision = storedDraft.documentRevision;
        if (restoredDirtyRowIds.size) {
          restoredDocumentRevision = storedRevision ?? "__draft_without_xmin__";
        }
      }
    } catch {
      // A malformed or unavailable session draft must not block primary data.
    }
    setRentRevision(restoredDocumentRevision);
    setRows(restoredRows);
    setSort(restoredSort);
    setDirtyRowIds(restoredDirtyRowIds);
    setDirtyFieldsByRow(restoredDirtyFieldsByRow);
    setValidationMessages([]);
    setError(null);
    setSaveState(restoredDirtyRowIds.size ? "dirty" : "idle");
    draftHydratedRef.current = true;
    setDraftReady(true);
  }, [draftStorageKey, resource.data, resource.revision]);
  const displayedRows = useMemo(() => sortRows(rows, sort), [rows, sort]);
  const goodsOptions = useMemo(() => [...new Set([
    ...RENT_ROLL_GOODS_OPTIONS,
    ...rows.flatMap((row) => normalizeRentRollGoodsTypes(row.goods_type)),
  ])], [rows]);
  useEffect(() => {
    if (!draftReady || !draftHydratedRef.current) return;
    try {
      if (!dirtyRowIds.size) {
        globalThis.sessionStorage?.removeItem(draftStorageKey);
        return;
      }
      globalThis.sessionStorage?.setItem(draftStorageKey, JSON.stringify({
        dirtyRowIds: [...dirtyRowIds],
        dirtyRows: rows.filter((row) => dirtyRowIds.has(rowId(row))),
        dirtyFieldsByRow: [...dirtyFieldsByRow].map(([id, fields]) => [id, [...fields]]),
        rowOrder: rows.map(rowId),
        documentRevision: rentRevision,
        sort,
      }));
    } catch {
      // The in-memory draft remains editable when browser storage is unavailable.
    }
  }, [draftReady, draftStorageKey, dirtyFieldsByRow, dirtyRowIds, rentRevision, rows, sort]);
  useEffect(() => {
    if (!dirtyRowIds.size) return undefined;
    const confirmUnsavedDraft = (event) => {
      event.preventDefault();
      event.returnValue = "";
    };
    globalThis.addEventListener?.("beforeunload", confirmUnsavedDraft);
    return () => globalThis.removeEventListener?.("beforeunload", confirmUnsavedDraft);
  }, [dirtyRowIds]);
  const invalidRowIds = useMemo(
    () => new Set(validationMessages.map((issue) => issue.rowId)),
    [validationMessages],
  );
  const focusRentRollRow = (id) => {
    const rowNode = rowRefs.current.get(id);
    const field = rowNode?.querySelector(
      '[data-draft-field]:not([disabled]):not([aria-disabled="true"])',
    );
    field?.focus();
    rowNode?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
  };
  const markDirty = (id, fields = []) => {
    setDirtyRowIds((current) => {
      const next = new Set(current);
      if (id) next.add(id);
      return next;
    });
    setDirtyFieldsByRow((current) => {
      const next = new Map(current);
      const rowFields = new Set(next.get(id) || []);
      fields.filter(Boolean).forEach((field) => rowFields.add(field));
      if (id) next.set(id, rowFields);
      return next;
    });
    setValidationMessages([]);
    setError(null);
    setSaveState("dirty");
  };
  const update = (id, field, value) => {
    setRows((current) =>
      current.map((row) =>
        rowId(row) === id ? deriveRentRollRow({ ...row, [field]: value }) : row,
      ),
    );
    markDirty(id, [field]);
  };
  const updateFields = (id, patch) => {
    setRows((current) => current.map((row) => (
      rowId(row) === id ? deriveRentRollRow({ ...row, ...patch }) : row
    )));
    markDirty(id, Object.keys(patch));
  };
  const saveRows = async () => {
    const validationTargets = rows.filter((row) => row.operation !== "delete");
    const issues = validationTargets.flatMap((row) => {
      const id = rowId(row);
      const visibleIndex = displayedRows.findIndex((item) => rowId(item) === id);
      const tenantName = String(row.tenant_name || "").trim();
      const rowLabel = `${visibleIndex >= 0 ? visibleIndex + 1 : "?"}행${tenantName ? ` (${tenantName})` : ""}`;
      const changedFields = [...(dirtyFieldsByRow.get(id) || [])];
      return validateRentRollDelta(row, changedFields).map((message, issueIndex) => ({
        id: `${id}-${issueIndex}`,
        rowId: id,
        message: String(message).replace(/^1행:\s*/u, `${rowLabel}: `),
      }));
    });
    if (issues.length) {
      setValidationMessages(issues);
      setSaveState("dirty");
      return false;
    }
    setSaveState("saving");
    setError(null);
    const intendedDocument = buildRentRollDocumentPayload(rows, { asOfDate: todayKst() });
    try {
      let readbackResponse = null;
      try {
        await invokeDataPlatform(DATA_PLATFORM_ACTIONS.rentRollBatchSave, {
          asset_code: assetCode,
          client_request_id: createClientRequestId("rent-roll"),
          expected_xmin: rentRevision,
          ...intendedDocument,
        });
      } catch (cause) {
        if (!isDataPlatformRevisionConflict(cause)) throw cause;
        const conflictReadback = await invokeDataPlatform(DATA_PLATFORM_ACTIONS.rentRollRead, {
          asset_code: assetCode,
          limit: 500,
        });
        const serverDocument = buildRentRollDocumentPayload(
          Array.isArray(conflictReadback.data?.rows) ? conflictReadback.data.rows : [],
          { asOfDate: todayKst() },
        );
        if (!documentsEqual(intendedDocument, serverDocument)) throw cause;
        readbackResponse = conflictReadback;
      }
      readbackResponse ||= await invokeDataPlatform(DATA_PLATFORM_ACTIONS.rentRollRead, {
        asset_code: assetCode,
        limit: 500,
      });
      const readbackRows = Array.isArray(readbackResponse.data?.rows)
        ? readbackResponse.data.rows
        : [];
      const readbackDocument = buildRentRollDocumentPayload(
        readbackRows,
        { asOfDate: todayKst() },
      );
      if (!documentsEqual(intendedDocument, readbackDocument)) {
        throw new Error("RENT_ROLL_DOCUMENT_READBACK_MISMATCH");
      }
      setRows(rentRollRowsFromReadback(readbackRows));
      setRentRevision(readbackResponse.revision);
      setDirtyRowIds(new Set());
      setDirtyFieldsByRow(new Map());
      setValidationMessages([]);
      setSaveState("saved");
      try {
        globalThis.sessionStorage?.removeItem(draftStorageKey);
      } catch {
        // Browser storage cleanup must never turn a committed API save into failure.
      }
      return true;
    } catch (cause) {
      setError(cause);
      setSaveState(isDataPlatformRevisionConflict(cause) ? "dirty" : "error");
      return false;
    }
  };
  const saveDirtyRows = async () => {
    if (!dirtyRowIds.size || saveState === "saving" || saveInFlightRef.current) return;
    saveInFlightRef.current = true;
    try {
      await saveRows();
    } finally {
      saveInFlightRef.current = false;
    }
  };
  const commitField = (id, field, value) => {
    update(id, field, value);
  };
  const reorderRows = (sourceId, targetId, position = "before") => {
    if (rentRollEditingDisabled || !sourceId || !targetId || sourceId === targetId) return;
    const ordered = [...displayedRows];
    const sourceIndex = ordered.findIndex((row) => rowId(row) === sourceId);
    const initialTargetIndex = ordered.findIndex((row) => rowId(row) === targetId);
    if (sourceIndex < 0 || initialTargetIndex < 0) return;
    const [moved] = ordered.splice(sourceIndex, 1);
    const targetIndex = ordered.findIndex((row) => rowId(row) === targetId);
    const insertionIndex = targetIndex + (position === "after" ? 1 : 0);
    ordered.splice(insertionIndex, 0, moved);
    const changed = ordered.map((row, rowIndex) => ({
      ...row,
      display_order: rowIndex + 1,
    }));
    const rangeStart = Math.min(sourceIndex, insertionIndex);
    const rangeEnd = Math.max(sourceIndex, insertionIndex);
    const changedRange = changed.slice(rangeStart, rangeEnd + 1);
    setRows(changed);
    setSort(null);
    changedRange.forEach((row) => markDirty(rowId(row), ["display_order"]));
  };
  const archive = (id) => {
    if (rentRollEditingDisabled) return;
    const row = rows.find((item) => rowId(item) === id);
    if (!row || isExpiredRentRollRow(row, todayKst())) return;
    const deleted = { ...row, operation: "delete" };
    setRows((current) =>
      current.map((item) => (rowId(item) === id ? deleted : item)),
    );
    markDirty(id, ["operation"]);
  };
  const undoArchive = (id) => {
    if (rentRollEditingDisabled) return;
    setRows((current) => current.map((row) => {
      if (rowId(row) !== id) return row;
      const operation = (row.space_revision ?? row.revision) ? "update" : "create";
      return { ...row, operation };
    }));
    markDirty(id, ["operation"]);
  };
  const add = () => {
    if (rentRollEditingDisabled) return;
    const next = { ...emptyRentRollRow(), display_order: rows.length + 1 };
    setRows((current) => [...current, next]);
    setSort(null);
    markDirty(rowId(next), RENT_ROLL_EDITABLE_FIELDS);
  };
  const dragOverRow = dragOverTarget
    ? displayedRows.find((row) => rowId(row) === dragOverTarget.id)
    : null;
  const dragOverLabel = dragOverRow
    ? dragOverRow.tenant_name || dragOverRow.floor_label || "선택한 행"
    : null;
  const rentFreeRow = rentFreeRowId
    ? rows.find((row) => rowId(row) === rentFreeRowId)
    : null;
  if (!assetCode) return <EmptyText>먼저 자산을 선택해 주세요.</EmptyText>;
  return (
    <div className="space-y-4">
      <LoadingLine visible={resource.loading} />
      <DataPlatformErrorDialog error={error || resource.error} onDismiss={() => setError(null)} />
      <Section
        title="렌트롤"
        action={
          <div className="flex items-center gap-3">
            <SaveState state={saveState} />
            <button
              data-testid="rent-roll-save"
              type="button"
              onClick={() => void saveDirtyRows()}
              disabled={!writeEnabled || dirtyRowIds.size === 0 || saveState === "saving"}
              className="rounded-[8px] bg-[#0A6CFF] px-3 py-2 text-sm font-semibold text-white hover:bg-[#2680FF] disabled:cursor-not-allowed disabled:opacity-35"
            >
              변경사항 저장
            </button>
            <button
              data-testid="rent-roll-add"
              type="button"
              onClick={add}
              disabled={rentRollEditingDisabled}
              className="rounded-[8px] border border-[#3A3A3C] px-3 py-2 text-sm text-white disabled:opacity-35"
            >
              행 추가
            </button>
          </div>
        }
      >
        <div className="mb-3 flex items-center gap-2">
          <textarea
            value={paste}
            onChange={(event) => setPaste(event.target.value)}
            disabled={rentRollEditingDisabled}
            rows={1}
            className="min-w-[320px] flex-1 rounded-[8px] border border-[#3A3A3C] bg-[#1F1F1E] px-3 py-2 text-sm text-white outline-none focus:border-[#5E9EFF]"
            placeholder="엑셀 행을 그대로 붙여넣으세요."
          />
          <button
            data-testid="rent-roll-paste"
            type="button"
            onClick={() => {
              const parsed = parsePaste(paste).map((row, index) => ({
                ...row,
                display_order: rows.length + index + 1,
              }));
              setRows((current) => [...current, ...parsed]);
              parsed.forEach((row) => markDirty(rowId(row), RENT_ROLL_EDITABLE_FIELDS));
              setPaste("");
              setSort(null);
            }}
            disabled={rentRollEditingDisabled}
            className="rounded-[8px] border border-[#3A3A3C] px-4 py-2 text-sm text-white"
          >
            붙여넣기
          </button>
          <span className="text-xs text-[#86868B]">
            {rows.filter((row) => row.operation !== "delete").length}행
          </span>
        </div>
        {validationMessages.length ? (
          <div
            id="rent-roll-validation-summary"
            data-testid="rent-roll-validation-summary"
            role="alert"
            aria-live="assertive"
            className="mb-3 rounded-[8px] border border-[#725A28] bg-[#302819] px-3 py-2 text-xs text-[#F2CF75]"
          >
            <p className="font-semibold">저장할 행의 필수값을 확인해 주세요.</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-4">
              {validationMessages.map((issue) => (
                <li key={issue.id}>
                  <button
                    type="button"
                    data-validation-row-id={issue.rowId}
                    onClick={() => focusRentRollRow(issue.rowId)}
                    className="text-left underline decoration-[#A98B45] underline-offset-2 hover:text-white focus:outline-none focus:ring-1 focus:ring-[#F2CF75]"
                  >
                    {issue.message}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {draggedRowId ? (
          <div
            data-testid="rent-roll-drag-status"
            role="status"
            aria-live="polite"
            className="flex items-center gap-2 rounded-[8px] border border-[#2C66A2] bg-[#17314E] px-3 py-2 text-xs font-medium text-[#9AD7FF]"
          >
            <span aria-hidden="true">⋮⋮</span>
            {dragOverLabel
              ? `${dragOverLabel} ${dragOverTarget.position === "before" ? "위" : "아래"}에 놓습니다.`
              : "이동할 위치의 위쪽 또는 아래쪽 절반에 놓아 주세요."}
          </div>
        ) : null}
        <div
          className="custom-scrollbar h-[calc(100vh-190px)] overflow-auto rounded-[12px] border border-[#333333]"
          onDragOver={(event) => {
            if (!draggedRowId) return;
            event.preventDefault();
            event.dataTransfer.dropEffect = "move";
          }}
        >
          <table
            data-testid="rent-roll-table"
            className="w-max min-w-full border-separate border-spacing-0 text-sm"
          >
            <thead>
              <tr>
                <th
                  rowSpan={2}
                  className="sticky left-0 top-0 z-50 w-[62px] border-b border-r border-[#333333] bg-[#202020] px-2 text-center text-xs text-[#A1A1AA]"
                >
                  순서
                </th>
                {RENT_ROLL_GROUP_SEGMENTS.map((segment) => (
                  <th
                    key={`${segment.group}-${segment.keys[0]}`}
                    data-sticky-group-header={segment.stickyLeft == null ? undefined : segment.keys[0]}
                    colSpan={segment.colSpan}
                    style={{
                      left: segment.stickyLeft == null ? undefined : segment.stickyLeft,
                      minWidth: segment.width,
                      width: segment.width,
                    }}
                    className={`sticky top-0 border-b border-r border-[#333333] bg-[#202020] px-2 py-2 text-center text-xs font-semibold text-[#A1A1AA] ${segment.stickyLeft == null ? "z-30" : "z-[55] shadow-[1px_0_0_#333333]"}`}
                  >
                    {segment.group}
                  </th>
                ))}
                <th
                  rowSpan={2}
                  className="sticky right-0 top-0 z-40 w-[64px] border-b border-l border-[#333333] bg-[#202020] text-xs text-[#A1A1AA]"
                >
                  관리
                </th>
              </tr>
              <tr>
                {RENT_ROLL_DISPLAY_COLUMNS.map((column) => {
                  const columnLabel = column.label;
                  const columnWidth = column.width;
                  const stickyLeft = rentRollStickyLeft(column.key);
                  return (
                    <th
                      key={column.key}
                      data-sticky-column-header={stickyLeft == null ? undefined : column.key}
                      style={{
                        minWidth: columnWidth,
                        width: columnWidth,
                        left: stickyLeft == null ? undefined : stickyLeft,
                      }}
                      className={`sticky top-[33px] border-b border-r border-[#333333] bg-[#202020] px-2 py-2 text-left text-[11px] font-medium text-[#A1A1AA] ${stickyLeft == null ? "z-30" : "z-[60] shadow-[1px_0_0_#333333]"}`}
                    >
                      <button
                        type="button"
                        onClick={() =>
                          setSort((current) => ({
                            key: column.key,
                            direction:
                              current?.key === column.key &&
                              current.direction === "asc"
                                ? "desc"
                                : "asc",
                          }))
                        }
                        className="flex w-full justify-between gap-2"
                      >
                        <span>{columnLabel}</span>
                        <span>
                          {sort?.key === column.key
                            ? sort.direction === "asc"
                              ? "↑"
                              : "↓"
                            : "↕"}
                        </span>
                      </button>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {displayedRows.map((sourceRow, index) => {
                const row = deriveRentRollRow(sourceRow);
                const id = rowId(row);
                const expiredContract = isExpiredRentRollRow(row, todayKst());
                const rowInvalid = invalidRowIds.has(id);
                const rowLabel = `${index + 1}행 ${row.tenant_name || row.floor_label || "미입력"}`;
                const rowEditingDisabled = rentRollEditingDisabled || row.operation === "delete";
                const dropPosition = dragOverTarget?.id === id
                  ? dragOverTarget.position
                  : null;
                const dropLineClass = dropPosition === "before"
                  ? "border-t-2 border-t-[#5E9EFF]"
                  : dropPosition === "after"
                    ? "border-b-2 border-b-[#5E9EFF]"
                    : "";
                return (
                  <tr
                    key={id}
                    ref={(node) => {
                      if (node) rowRefs.current.set(id, node);
                      else rowRefs.current.delete(id);
                    }}
                    data-rent-roll-row-id={id}
                    aria-invalid={rowInvalid || undefined}
                    onDragOver={(event) => {
                      if (rentRollEditingDisabled || !draggedRowId) return;
                      event.preventDefault();
                      event.dataTransfer.dropEffect = "move";
                      if (draggedRowId === id) {
                        setDragOverTarget(null);
                        return;
                      }
                      const bounds = event.currentTarget.getBoundingClientRect();
                      const position = event.clientY < bounds.top + bounds.height / 2
                        ? "before"
                        : "after";
                      setDragOverTarget((current) => (
                        current?.id === id && current.position === position
                          ? current
                          : { id, position }
                      ));
                    }}
                    onDrop={(event) => {
                      event.preventDefault();
                      const sourceId = event.dataTransfer.getData("text/plain") || draggedRowId;
                      reorderRows(sourceId, id, dropPosition || "before");
                      setDraggedRowId(null);
                      setDragOverTarget(null);
                    }}
                    className={`hover:bg-[#292929] ${draggedRowId === id ? "opacity-45" : ""} ${dropPosition ? "bg-[#17314E]/40" : ""} ${row.operation === "delete" ? "opacity-35" : ""}`}
                  >
                    <td className={`sticky left-0 z-20 border-b border-r border-[#333333] bg-[#252524] px-1 ${dropLineClass}`}>
                      <div className="flex justify-center">
                        <button
                          data-testid="rent-roll-drag-handle"
                          type="button"
                          draggable={!rowEditingDisabled}
                          disabled={rowEditingDisabled}
                          aria-label={`${row.tenant_name || row.floor_label || `${index + 1}행`} 순서 이동`}
                          aria-grabbed={draggedRowId === id}
                          title="드래그하여 순서 이동"
                          onDragStart={(event) => {
                            event.dataTransfer.effectAllowed = "move";
                            event.dataTransfer.setData("text/plain", id);
                            setDraggedRowId(id);
                          }}
                          onDragEnd={() => {
                            setDraggedRowId(null);
                            setDragOverTarget(null);
                          }}
                          onKeyDown={(event) => {
                            if (!event.altKey || !["ArrowUp", "ArrowDown"].includes(event.key)) return;
                            event.preventDefault();
                            const targetIndex = index + (event.key === "ArrowUp" ? -1 : 1);
                            if (targetIndex >= 0 && targetIndex < displayedRows.length) {
                              reorderRows(
                                id,
                                rowId(displayedRows[targetIndex]),
                                event.key === "ArrowUp" ? "before" : "after",
                              );
                            }
                          }}
                          className="flex h-8 w-8 cursor-grab items-center justify-center rounded-[6px] text-[#86868B] hover:bg-[#303030] hover:text-white active:cursor-grabbing disabled:cursor-not-allowed disabled:opacity-30"
                        >
                          <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 16 16" fill="currentColor">
                            <circle cx="5" cy="3" r="1.25" /><circle cx="11" cy="3" r="1.25" />
                            <circle cx="5" cy="8" r="1.25" /><circle cx="11" cy="8" r="1.25" />
                            <circle cx="5" cy="13" r="1.25" /><circle cx="11" cy="13" r="1.25" />
                          </svg>
                        </button>
                      </div>
                    </td>
                    {RENT_ROLL_DISPLAY_COLUMNS.map((column) => {
                      const stickyLeft = rentRollStickyLeft(column.key);
                      const sticky = stickyLeft != null;
                      const depositEscalationDetailsDisabled =
                        row.deposit_escalation_enabled !== "Y"
                        && [
                          "deposit_escalation_first_date",
                          "deposit_escalation_interval_months",
                          "deposit_escalation_rate",
                        ].includes(column.key);
                      const fieldEditingDisabled = rowEditingDisabled || depositEscalationDetailsDisabled;
                      const fieldDisplayValue = depositEscalationDetailsDisabled ? "" : row[column.key];
                      const cellStyle = sticky ? { left: stickyLeft } : undefined;
                      const cellClass = `border-b border-r border-[#333333] px-1 py-1 ${depositEscalationDetailsDisabled ? "bg-[#202020] text-[#68686D]" : "bg-[#252524]"} ${dropLineClass} ${sticky ? "sticky z-10 shadow-[1px_0_0_#333333]" : ""}`;
                      if (column.key === "rent_free_months") {
                        const periods = rentFreePeriodsFromRow(row);
                        const totalMonths = periods.length
                          ? periods.reduce((sum, period) => sum + Number(period.months || 0), 0)
                          : Number(row.rent_free_months || 0);
                        return (
                          <td key={column.key} style={cellStyle} className={cellClass}>
                            <button
                              data-testid="rent-free-details"
                              type="button"
                              onClick={() => setRentFreeRowId(id)}
                              disabled={rowEditingDisabled}
                              aria-label={`${rowLabel} 렌트프리 세부입력`}
                              className="w-full rounded-[6px] border border-[#3A3A3C] px-2 py-1.5 text-left text-xs text-[#D1D1D6] hover:bg-[#303030] disabled:opacity-35"
                            >
                              {periods.length ? `${periods.length}개 기간 · ${amount(totalMonths)}개월` : "세부입력"}
                            </button>
                          </td>
                        );
                      }
                      if (column.kind === "readonly")
                        return (
                          <td
                            key={column.key}
                            style={cellStyle}
                            className={`${cellClass} px-3 text-right tabular-nums text-[#A1A1AA]`}
                          >
                            {formatRentRollReadonlyValue(column, row)}
                          </td>
                        );
                      if (column.kind === "select")
                        return (
                          <td key={column.key} style={cellStyle} className={cellClass}>
                            <select
                              data-draft-field={column.key}
                              aria-label={`${rowLabel} ${column.label}`}
                              aria-invalid={rowInvalid || undefined}
                              aria-describedby={rowInvalid ? "rent-roll-validation-summary" : undefined}
                              value={row[column.key] || ""}
                              onChange={(event) =>
                                update(id, column.key, event.target.value)
                              }
                              disabled={fieldEditingDisabled}
                              className={INPUT_CLASS}
                            >
                              {column.options.map(([value, label]) => (
                                <option key={value} value={value}>
                                  {label}
                                </option>
                              ))}
                            </select>
                          </td>
                        );
                      if (column.kind === "goods_multi_select")
                        return (
                          <td key={column.key} style={cellStyle} className={cellClass}>
                            <GoodsMultiSelectCell
                              value={row[column.key]}
                              options={goodsOptions}
                              disabled={fieldEditingDisabled}
                              invalid={rowInvalid}
                              describedBy="rent-roll-validation-summary"
                              rowLabel={rowLabel}
                              onChange={(value) => update(id, column.key, value)}
                            />
                          </td>
                        );
                      if (column.kind === "preset_text")
                        return (
                          <td key={column.key} style={cellStyle} className={cellClass}>
                            <PresetTextCell
                              column={column}
                              value={row[column.key]}
                              disabled={fieldEditingDisabled}
                              invalid={rowInvalid}
                              describedBy="rent-roll-validation-summary"
                              rowLabel={rowLabel}
                              onChange={(value) => update(id, column.key, value)}
                              onCommit={(value) => commitField(id, column.key, value)}
                            />
                          </td>
                        );
                      if (column.kind === "multi_select")
                        return (
                          <td key={column.key} style={cellStyle} className={cellClass}>
                            <MultiSelectCell
                              column={column}
                              value={row[column.key]}
                              disabled={fieldEditingDisabled}
                              invalid={rowInvalid}
                              describedBy="rent-roll-validation-summary"
                              rowLabel={rowLabel}
                              onChange={(value) => update(id, column.key, value)}
                              onCommit={(value) => commitField(id, column.key, value)}
                            />
                          </td>
                        );
                      if (column.kind === "percent")
                        return (
                          <td key={column.key} style={cellStyle} className={cellClass}>
                            <div className="flex items-center gap-1">
                              <input
                                data-draft-field={column.key}
                                aria-label={`${rowLabel} ${column.label}`}
                                aria-invalid={rowInvalid || undefined}
                                aria-describedby={rowInvalid ? "rent-roll-validation-summary" : undefined}
                                type="number"
                                min="0"
                                max="100"
                                step="0.01"
                                value={percentInputValue(fieldDisplayValue)}
                                onChange={(event) => update(id, column.key, percentStoredValue(event.target.value))}
                                 disabled={fieldEditingDisabled}
                                className={`${INPUT_CLASS} text-right tabular-nums`}
                              />
                              <span className="pr-1 text-xs text-[#86868B]">%</span>
                            </div>
                          </td>
                        );
                      const commaNumberField = column.kind === "number";
                      return (
                        <td key={column.key} style={cellStyle} className={cellClass}>
                          {column.key === "tenant_name" ? (
                            <input
                              data-draft-field="tenant_name"
                              aria-label={`${rowLabel} ${column.label}`}
                              aria-invalid={rowInvalid || undefined}
                              aria-describedby={rowInvalid ? "rent-roll-validation-summary" : undefined}
                              type="text"
                              value={row.tenant_name ?? ""}
                              onChange={(event) =>
                                update(id, "tenant_name", event.target.value)
                              }
                              disabled={
                                rowEditingDisabled ||
                                row.occupancy_status === "vacant"
                              }
                              className={INPUT_CLASS}
                            />
                          ) : commaNumberField ? (
                            <RentRollCommaNumberInput
                              field={column.key}
                              ariaLabel={`${rowLabel} ${column.label}`}
                              invalid={rowInvalid}
                              describedBy="rent-roll-validation-summary"
                              value={fieldDisplayValue}
                              onChange={(value) => update(id, column.key, value)}
                              disabled={
                                fieldEditingDisabled
                                || (column.key === "fit_out_months"
                                  && Boolean(row.fit_out_start_date || row.fit_out_end_date))
                              }
                            />
                          ) : (
                            <input
                              data-draft-field={column.key}
                              aria-label={`${rowLabel} ${column.label}`}
                              aria-invalid={rowInvalid || undefined}
                              aria-describedby={rowInvalid ? "rent-roll-validation-summary" : undefined}
                              type={
                                column.kind === "number"
                                  ? "number"
                                  : column.kind === "date"
                                    ? "date"
                                    : "text"
                              }
                              value={fieldDisplayValue ?? ""}
                              onChange={(event) => {
                                const value = event.target.value;
                                if (["fit_out_start_date", "fit_out_end_date"].includes(column.key)) {
                                  const nextStart = column.key === "fit_out_start_date"
                                    ? value
                                    : row.fit_out_start_date;
                                  const nextEnd = column.key === "fit_out_end_date"
                                    ? value
                                    : row.fit_out_end_date;
                                  const calculatedMonths = calculateRentFreePeriodMonths(nextStart, nextEnd);
                                  const nextFields = {
                                    [column.key]: value,
                                  };
                                  if (calculatedMonths !== null) {
                                    nextFields.fit_out_months = calculatedMonths;
                                  } else if (!nextStart && !nextEnd) {
                                    nextFields.fit_out_months = normalizeFitOutMonths(
                                      nextStart,
                                      nextEnd,
                                      row.fit_out_months,
                                    ) ?? "";
                                  }
                                  updateFields(id, nextFields);
                                  return;
                                }
                                update(id, column.key, value);
                              }}
                              disabled={fieldEditingDisabled}
                              className={`${INPUT_CLASS} ${column.kind === "number" ? "text-right tabular-nums" : ""}`}
                            />
                          )}
                        </td>
                      );
                    })}
                    <td className="sticky right-0 z-20 border-b border-l border-[#333333] bg-[#252524] px-2 text-center">
                      <button
                        data-testid={row.operation === "delete" ? "rent-roll-archive-undo" : "rent-roll-archive"}
                        type="button"
                        onClick={() => (row.operation === "delete" ? undoArchive(id) : archive(id))}
                        disabled={rentRollEditingDisabled || expiredContract}
                        title={expiredContract ? "만료 계약은 이력 보존을 위해 삭제할 수 없습니다." : undefined}
                        className="text-xs text-[#86868B] hover:text-[#FF9B9B] disabled:cursor-not-allowed disabled:opacity-30"
                      >
                        {expiredContract ? "만료 보존" : row.operation === "delete" ? "삭제 취소" : "삭제"}
                      </button>
                      <button
                        data-testid="rent-roll-detail-toggle"
                        type="button"
                        className="sr-only"
                      >
                        상세
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Section>
      {rentFreeRow ? (
        <RentFreePeriodsDialog
          key={rentFreeRowId}
          row={rentFreeRow}
          disabled={rentRollEditingDisabled || rentFreeRow.operation === "delete"}
          onClose={() => setRentFreeRowId(null)}
          onSave={(periods) => {
            const canonicalPeriods = periods.map((period) => normalizeRentFreePeriod(period));
            const datedPeriods = canonicalPeriods
              .filter((period) => period.start_date && period.end_date)
              .sort((left, right) => left.start_date.localeCompare(right.start_date));
            updateFields(rentFreeRowId, {
              rent_free_periods: canonicalPeriods,
              rent_free_start_date: datedPeriods[0]?.start_date || "",
              rent_free_end_date: datedPeriods.at(-1)?.end_date || "",
              rent_free_months: canonicalPeriods.reduce(
                (sum, period) => sum + Number(period.months || 0),
                0,
              ),
            });
            setRentFreeRowId(null);
          }}
        />
      ) : null}
    </div>
  );
}

function periodFor(month, aggregation) {
  if (aggregation === "year") return month.slice(0, 4);
  if (aggregation === "quarter")
    return `${month.slice(0, 4)} Q${Math.floor((Number(month.slice(5, 7)) - 1) / 3) + 1}`;
  return month;
}
function buildFinanceSeries(entries, accounts, months, aggregation) {
  const signs = new Map(
    accounts.map((account) => [
      account.account_code,
      Number(account.normal_sign || 1),
    ]),
  );
  const periods = [
    ...new Set(months.map((month) => periodFor(month, aggregation))),
  ];
  return periods.map((period) => {
    const totals = {
      potential_income: 0,
      income_loss: 0,
      operating_expense: 0,
      below_noi_cash_cost: 0,
      noncash_addback: 0,
      debt_service: 0,
    };
    entries
      .filter(
        (entry) =>
          periodFor(String(entry.month).slice(0, 7), aggregation) === period &&
          entry.operation !== "delete",
      )
      .forEach((entry) => {
        const account = accounts.find(
          (item) => item.account_code === entry.account_code,
        );
        if (!account) return;
        // Keep manual adjustments signed so an operator can reduce a projected
        // rent/CAM amount without the adjustment being added back as positive.
        const raw = Number(entry.amount || 0);
        if (
          account.statement_section === "potential_income" ||
          account.statement_section === "other_operating_income"
        )
          totals.potential_income += raw;
        else if (account.statement_section === "income_loss")
          totals.income_loss += raw;
        else if (account.statement_section === "operating_expense")
          totals.operating_expense += raw;
        else if (
          account.statement_section === "below_noi" &&
          account.account_code === "NONCASH_ADDBACK"
        )
          totals.noncash_addback += raw;
        else if (account.statement_section === "below_noi")
          totals.below_noi_cash_cost += raw;
        else if (account.statement_section === "debt_service")
          totals.debt_service += raw;
        void signs;
      });
    return { period, ...calculateKoreanLogisticsNoi(totals) };
  });
}
function FinanceTrend({ series }) {
  const [activeIndex, setActiveIndex] = useState(null);
  const values = series
    .flatMap((row) => [row.net_operating_income, row.after_debt_service_cash_flow])
    .map((value) => Math.abs(Number(value || 0)));
  const max = Math.max(...values, 1);
  const active = activeIndex === null ? null : series[activeIndex];
  return (
    <div className="relative">
      <div
        data-testid="finance-trend"
        className="flex h-44 items-end gap-3 border-b border-[#3A3A3C] px-3 pt-4"
      >
        {series.map((row, index) => (
          <button
            key={row.period}
            type="button"
            aria-label={`${row.period} 상세 보기`}
            onMouseEnter={() => setActiveIndex(index)}
            onMouseLeave={() => setActiveIndex(null)}
            onFocus={() => setActiveIndex(index)}
            onBlur={() => setActiveIndex(null)}
            className="relative flex h-full min-w-0 flex-1 items-end justify-center gap-1 outline-none focus-visible:ring-1 focus-visible:ring-[#5E9EFF]"
          >
            <span
              data-testid={index === 0 ? "finance-primary-chart" : undefined}
              style={{ height: `${Math.max(3, (Math.abs(row.net_operating_income) / max) * 130)}px` }}
              className="w-4 rounded-t bg-[#5E9EFF]"
            />
            <span
              style={{ height: `${Math.max(3, (Math.abs(row.after_debt_service_cash_flow) / max) * 130)}px` }}
              className="w-4 rounded-t bg-[#7BD5A0]"
            />
            <span className="absolute -bottom-4 hidden text-[9px] text-[#86868B] xl:block">{row.period}</span>
          </button>
        ))}
      </div>
      {active ? (
        <div
          data-testid="finance-trend-tooltip"
          role="tooltip"
          className="pointer-events-none absolute right-3 top-2 z-20 min-w-[230px] rounded-[10px] border border-[#3A3A3C] bg-[#161616]/95 p-3 text-xs shadow-xl"
        >
          <p className="mb-2 font-semibold text-white">{active.period}</p>
          {[
            ["유효총수입", "effective_gross_income"],
            ["운영비용", "total_operating_expense"],
            ["순영업소득", "net_operating_income"],
            ["부채상환 후 현금흐름", "after_debt_service_cash_flow"],
          ].map(([label, key]) => (
            <div key={key} className="flex justify-between gap-5 py-0.5">
              <span className="text-[#A1A1AA]">{label}</span>
              <span className="tabular-nums text-white">
                {amount(active[key])}
              </span>
            </div>
          ))}
        </div>
      ) : null}
      <div className="mt-4 flex items-center gap-4 text-[11px] text-[#A1A1AA]">
        <span><span className="mr-1.5 inline-block h-2 w-2 rounded-sm bg-[#5E9EFF]" />순영업소득</span>
        <span><span className="mr-1.5 inline-block h-2 w-2 rounded-sm bg-[#7BD5A0]" />부채상환 후 현금흐름</span>
      </div>
    </div>
  );
}

function FinanceComparisonLoader({ assetCode, payload, setResources }) {
  const resource = usePrimaryResource(
    DATA_PLATFORM_ACTIONS.financeRead,
    { ...payload, asset_code: assetCode },
    { enabled: Boolean(assetCode) },
  );
  useEffect(() => {
    setResources((current) => {
      const previous = current[assetCode];
      if (
        previous?.data === resource.data &&
        previous?.error === resource.error &&
        previous?.loading === resource.loading
      ) return current;
      return {
        ...current,
        [assetCode]: {
          data: resource.data,
          error: resource.error,
          loading: resource.loading,
        },
      };
    });
  }, [assetCode, resource.data, resource.error, resource.loading, setResources]);
  return null;
}

function FinancePanel({ assetCode, assets }) {
  const current = currentMonthKst();
  const [start, setStart] = useState(addMonths(current, -11));
  const [end, setEnd] = useState(current);
  const [periodPreset, setPeriodPreset] = useState("1y");
  const scenario = "actual";
  const basis = "accrual";
  const aggregation = "month";
  const [comparisonKeys, setComparisonKeys] = useState([]);
  const [comparisonResources, setComparisonResources] = useState({});
  const [accounts, setAccounts] = useState([]);
  const [entries, setEntries] = useState([]);
  const [financeRevision, setFinanceRevision] = useState(null);
  const [saveState, setSaveState] = useState("idle");
  const [error, setError] = useState(null);
  const [accountSelectionAnnouncement, setAccountSelectionAnnouncement] = useState("");
  const [customAccountDrafts, setCustomAccountDrafts] = useState({});
  const [accountMutationPending, setAccountMutationPending] = useState(false);
  const accountToggleRefs = useRef(new Map());
  const pendingAccountFocusRef = useRef(null);
  const [selectedAccountCodes, setSelectedAccountCodes] = useState(
    () => new Set(DEFAULT_FINANCE_ACCOUNT_CODES),
  );
  const payload = {
    asset_code: assetCode,
    start_month: start,
    end_month: end,
    scenario,
    accounting_basis: basis,
  };
  const resource = usePrimaryResource(
    DATA_PLATFORM_ACTIONS.financeRead,
    payload,
    { enabled: Boolean(assetCode) },
  );
  useEffect(() => {
    if (!resource.data) return;
    const projection = resource.data?.statement
      ? projectIncomeExpenseStatement(resource.data.statement, KOREAN_LOGISTICS_NOI_ACCOUNTS)
      : {
          periods: [],
          accounts: Array.isArray(resource.data?.accounts) ? resource.data.accounts : [],
          entries: Array.isArray(resource.data?.entries)
            ? resource.data.entries.map((row) => ({ ...row, operation: "update" }))
            : [],
          selectedAccountCodes: [],
        };
    setAccounts(projection.accounts);
    setEntries(projection.entries);
    setFinanceRevision(resource.revision);
    const readbackAccounts = projection.accounts;
    if (!readbackAccounts.length) return;
    const hasServerSelection = readbackAccounts.some((account) => (
      Object.prototype.hasOwnProperty.call(account, "selected")
    ));
    setSelectedAccountCodes(new Set(
      hasServerSelection
        ? readbackAccounts.filter((account) => account.selected === true).map((account) => account.account_code)
        : DEFAULT_FINANCE_ACCOUNT_CODES,
    ));
  }, [resource.data, resource.revision]);
  useEffect(() => {
    const accountCode = pendingAccountFocusRef.current;
    if (!accountCode) return;
    const accountToggle = accountToggleRefs.current.get(accountCode);
    if (!accountToggle) return;
    accountToggle.focus({ preventScroll: true });
    pendingAccountFocusRef.current = null;
  }, [accounts, selectedAccountCodes]);
  const visibleAccounts = accounts
    .filter((account) => (
      account.account_kind !== "derived"
      && FINANCE_SECTION_ORDER.includes(account.statement_section)
    ))
    .sort((a, b) => Number(a.display_order) - Number(b.display_order));
  const financeHierarchy = buildFinanceAccountHierarchy(visibleAccounts, selectedAccountCodes);
  const calculationAccounts = filterFinanceCalculationAccounts(visibleAccounts, selectedAccountCodes);
  const months = monthsBetween(start, end);
  const series = buildFinanceSeries(entries, calculationAccounts, months, aggregation);
  const comparisonResults = comparisonKeys.map((comparisonAssetKey) => {
    const comparisonData = comparisonResources[comparisonAssetKey]?.data;
    const comparisonProjection = comparisonData?.statement
      ? projectIncomeExpenseStatement(comparisonData.statement, KOREAN_LOGISTICS_NOI_ACCOUNTS)
      : null;
    const comparisonEntries = comparisonProjection?.entries
      || (Array.isArray(comparisonData?.entries) ? comparisonData.entries : []);
    const comparisonAccountRows = comparisonProjection?.accounts
      || (Array.isArray(comparisonData?.accounts) ? comparisonData.accounts : visibleAccounts);
    const comparisonSelectedCodes = comparisonAccountRows.some((account) => (
      Object.prototype.hasOwnProperty.call(account, "selected")
    ))
      ? new Set(comparisonAccountRows.filter((account) => account.selected === true).map((account) => account.account_code))
      : selectedAccountCodes;
    const comparisonAccounts = filterFinanceCalculationAccounts(
      comparisonAccountRows,
      comparisonSelectedCodes,
    );
    return {
      assetKey: comparisonAssetKey,
      assetName: assets.find((asset) => asset.asset_code === comparisonAssetKey)?.name || "비교 자산",
      series: buildFinanceSeries(
        comparisonEntries,
        comparisonAccounts,
        months,
        aggregation,
      ),
    };
  });
  const periods = series.map((row) => row.period);
  const writeEnabled = resource.data?.write_enabled === true;
  const saveFinanceDocument = async ({
    nextAccounts = accounts,
    nextEntries = entries,
    nextSelectedAccountCodes = selectedAccountCodes,
  } = {}) => {
    const statement = buildIncomeExpenseStatement({
      periods: financePeriodsFromEntries(nextEntries),
      accounts: nextAccounts,
      entries: nextEntries,
      selectedAccountCodes: nextSelectedAccountCodes,
    });
    const documentPayload = buildIncomeExpenseDocumentPayload(statement);
    let readback = null;
    try {
      await invokeDataPlatform(DATA_PLATFORM_ACTIONS.financeBatchSave, {
        asset_code: assetCode,
        client_request_id: createClientRequestId("finance"),
        expected_xmin: financeRevision,
        ...documentPayload,
      });
    } catch (cause) {
      if (!isDataPlatformRevisionConflict(cause)) throw cause;
      const conflictReadback = await invokeDataPlatform(DATA_PLATFORM_ACTIONS.financeRead, {
        asset_code: assetCode,
      });
      const conflictPayload = buildIncomeExpenseDocumentPayload(
        conflictReadback.data?.statement || {},
      );
      if (!documentsEqual(documentPayload, conflictPayload)) throw cause;
      readback = conflictReadback;
    }
    readback ||= await invokeDataPlatform(DATA_PLATFORM_ACTIONS.financeRead, {
      asset_code: assetCode,
    });
    const readbackPayload = buildIncomeExpenseDocumentPayload(readback.data?.statement || {});
    if (!documentsEqual(documentPayload, readbackPayload)) {
      throw new Error("FINANCE_DOCUMENT_READBACK_MISMATCH");
    }
    const projection = projectIncomeExpenseStatement(
      readback.data.statement,
      KOREAN_LOGISTICS_NOI_ACCOUNTS,
    );
    setAccounts(projection.accounts);
    setEntries(projection.entries);
    setSelectedAccountCodes(new Set(projection.selectedAccountCodes));
    setFinanceRevision(readback.revision);
    setSaveState("saved");
    return projection;
  };
  const toggleFinanceAccount = async (row) => {
    const nextActive = !row.active;
    const nextSelectedAccountCodes = new Set(selectedAccountCodes);
    if (nextActive) nextSelectedAccountCodes.add(row.key);
    else nextSelectedAccountCodes.delete(row.key);
    pendingAccountFocusRef.current = row.key;
    setSelectedAccountCodes(nextSelectedAccountCodes);
    setAccountSelectionAnnouncement(
      `${row.label} 계정을 ${nextActive ? "활성화" : "비활성화"}했습니다. ${nextActive ? "NOI 계산에 포함됩니다." : "저장된 금액은 유지되고 NOI 계산에서는 제외됩니다."}`,
    );
    setAccountMutationPending(true);
    setSaveState("saving");
    setError(null);
    try {
      await saveFinanceDocument({ nextSelectedAccountCodes });
    } catch (cause) {
      setError(cause);
      setSaveState(isDataPlatformRevisionConflict(cause) ? "dirty" : "error");
    } finally {
      setAccountMutationPending(false);
    }
  };
  const addCustomFinanceAccount = async (section) => {
    const name = String(customAccountDrafts[section] || "").trim();
    if (!name || name.length > 60 || accountMutationPending) return;
    const accountCode = `DOCUMENT:${section}:${accounts.length}`;
    const displayOrder = Math.max(
      0,
      ...accounts
        .filter((account) => account.statement_section === section)
        .map((account) => Number(account.display_order || 0)),
    ) + 10;
    const normalSign = section === "potential_income" ? 1 : -1;
    const nextAccount = {
      account_code: accountCode,
      name,
      name_ko: name,
      statement_section: section,
      normal_sign: normalSign,
      display_order: displayOrder,
      is_custom: true,
      selected: true,
    };
    const nextAccounts = [...accounts, nextAccount];
    const nextSelectedAccountCodes = new Set([...selectedAccountCodes, accountCode]);
    setAccounts(nextAccounts);
    setSelectedAccountCodes(nextSelectedAccountCodes);
    setAccountMutationPending(true);
    setSaveState("saving");
    setError(null);
    try {
      await saveFinanceDocument({ nextAccounts, nextSelectedAccountCodes });
      pendingAccountFocusRef.current = accountCode;
      setCustomAccountDrafts((currentDrafts) => ({ ...currentDrafts, [section]: "" }));
      setAccountSelectionAnnouncement(`${name} 계정을 추가하고 활성화했습니다.`);
    } catch (cause) {
      setError(cause);
      setSaveState(isDataPlatformRevisionConflict(cause) ? "dirty" : "error");
    } finally {
      setAccountMutationPending(false);
    }
  };
  const deleteCustomFinanceAccount = async (row) => {
    if (!row.account?.is_custom || accountMutationPending) return;
    const nextAccounts = accounts.filter((account) => account.account_code !== row.key);
    const nextEntries = entries.filter((entry) => entry.account_code !== row.key);
    const nextSelectedAccountCodes = new Set(selectedAccountCodes);
    nextSelectedAccountCodes.delete(row.key);
    setAccounts(nextAccounts);
    setEntries(nextEntries);
    setSelectedAccountCodes(nextSelectedAccountCodes);
    setAccountMutationPending(true);
    setSaveState("saving");
    setError(null);
    try {
      await saveFinanceDocument({
        nextAccounts,
        nextEntries,
        nextSelectedAccountCodes,
      });
      setAccountSelectionAnnouncement(`${row.label} 항목을 이 자산에서 삭제했습니다.`);
    } catch (cause) {
      setError(cause);
      setSaveState(isDataPlatformRevisionConflict(cause) ? "dirty" : "error");
    } finally {
      setAccountMutationPending(false);
    }
  };
  const accountEntries = (code, month, source = entries) =>
    source.filter(
      (entry) =>
        entry.account_code === code &&
        String(entry.month).slice(0, 7) === month &&
        entry.operation !== "delete",
    );
  const accountMonthTotal = (code, month, source = entries) =>
    accountEntries(code, month, source).reduce(
      (sum, entry) => sum + Number(entry.amount || 0),
      0,
    );
  const setCell = (account, month, value) => {
    setEntries((currentEntries) => replaceFinanceCellValue(
      currentEntries,
      account.account_code,
      month,
      value,
    ));
    setSaveState("dirty");
  };
  const saveCell = async (account, month, explicitValue) => {
    if (saveState !== "dirty") return;
    const nextEntries = replaceFinanceCellValue(
      entries,
      account.account_code,
      month,
      explicitValue,
    );
    setEntries(nextEntries);
    setSaveState("saving");
    setError(null);
    try {
      await saveFinanceDocument({ nextEntries });
    } catch (cause) {
      setError(cause);
      setSaveState(isDataPlatformRevisionConflict(cause) ? "dirty" : "error");
    }
  };
  const aggregateAccount = (code, period) =>
    months
      .filter((month) => periodFor(month, aggregation) === period)
      .reduce((sum, month) => sum + accountMonthTotal(code, month), 0);
  const total = (key) =>
    series.reduce((sum, row) => sum + Number(row[key] || 0), 0);
  const seriesTotal = (targetSeries, key) =>
    targetSeries.reduce((sum, row) => sum + Number(row[key] || 0), 0);
  const selectedAssetName =
    assets.find((asset) => asset.asset_code === assetCode)?.name || "선택 자산";
  const applyPeriodPreset = (preset) => {
    setPeriodPreset(preset.key);
    if (!preset.months) return;
    setEnd(current);
    setStart(addMonths(current, 1 - preset.months));
  };
  const toggleComparisonAsset = (comparisonAssetKey) => {
    setComparisonKeys((currentKeys) => (
      currentKeys.includes(comparisonAssetKey)
        ? currentKeys.filter((key) => key !== comparisonAssetKey)
        : [...currentKeys, comparisonAssetKey]
    ));
  };
  const comparisonLoading = comparisonKeys.some(
    (key) => comparisonResources[key]?.loading,
  );
  const comparisonError = comparisonKeys
    .map((key) => comparisonResources[key]?.error)
    .find(Boolean);
  const summaryLabels = Object.freeze({
    potential_gross_income: "잠재총수입",
    total_income_loss: "수입손실",
    effective_gross_income: "영업수익",
    total_operating_expense: "운영비용",
    net_operating_income: "순영업소득(NOI)",
    asset_net_cash_flow: "자산 NCF",
    after_debt_service_cash_flow: "부채상환 후 현금흐름",
  });
  const rows = buildFinanceStatementPresentationRows(financeHierarchy);
  const comparisonAction = (
    <div
      data-testid="finance-comparison-controls"
      className="flex justify-end"
    >
      <details className="relative min-w-[220px] text-[11px] text-[#86868B]">
        <summary className="cursor-pointer list-none rounded-[7px] border border-[#3A3A3C] bg-[#1F1F1E] px-3 py-1.5 text-right text-xs text-white">
          비교 자산 {comparisonKeys.length ? `${comparisonKeys.length}개 선택` : "선택"}
        </summary>
        <div className="absolute right-0 top-full z-50 mt-1 max-h-64 w-full min-w-[280px] overflow-y-auto rounded-[10px] border border-[#3A3A3C] bg-[#202020] p-2 shadow-2xl">
          {assets.filter((asset) => asset.asset_code !== assetCode).map((asset) => (
            <label key={asset.asset_code} className="flex cursor-pointer items-center gap-2 rounded px-2 py-2 text-xs text-[#D1D1D6] hover:bg-white/5">
              <input
                data-testid="finance-comparison-asset-toggle"
                type="checkbox"
                checked={comparisonKeys.includes(asset.asset_code)}
                onChange={() => toggleComparisonAsset(asset.asset_code)}
              />
              <span>{asset.name || asset.asset_code}</span>
            </label>
          ))}
        </div>
      </details>
    </div>
  );
  if (!assetCode) return <EmptyText>먼저 자산을 선택해 주세요.</EmptyText>;
  return (
    <div className="space-y-4">
      <LoadingLine visible={resource.loading || comparisonLoading} />
      <DataPlatformErrorDialog error={error || resource.error || comparisonError} onDismiss={() => setError(null)} />
      {comparisonKeys.map((comparisonAssetKey) => (
        <FinanceComparisonLoader
          key={comparisonAssetKey}
          assetCode={comparisonAssetKey}
          payload={payload}
          setResources={setComparisonResources}
        />
      ))}
      <div
        data-testid="finance-analysis-grid"
        className="grid gap-4 xl:grid-cols-[minmax(0,1.22fr)_minmax(420px,0.78fr)]"
      >
        <Section title="NOI·부채상환 후 현금흐름 시계열" className="p-4">
          <div
            data-testid="finance-period-controls"
            className="mb-4 border-b border-[#333333] pb-3"
          >
            <p className="mb-2 text-[10px] text-[#86868B]">
              시계열·자산 비교에 함께 적용돼요.
            </p>
            <fieldset>
              <legend className="sr-only">조회 기간</legend>
              <div className="flex flex-wrap gap-1">
                {FINANCE_PERIOD_PRESETS.map((preset) => (
                  <button
                    key={preset.key}
                    data-testid="finance-period-preset"
                    type="button"
                    aria-pressed={periodPreset === preset.key}
                    onClick={() => applyPeriodPreset(preset)}
                    className={`rounded-[7px] border px-2.5 py-1.5 text-[11px] ${periodPreset === preset.key ? "border-[#5E9EFF] bg-[#17314E] text-[#9AD7FF]" : "border-[#3A3A3C] bg-[#1F1F1E] text-[#D1D1D6]"}`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </fieldset>
            {periodPreset === "custom" ? (
              <div className="mt-2 flex flex-wrap items-end gap-2">
                {[
                  ["시작 월", start, setStart],
                  ["종료 월", end, setEnd],
                ].map(([label, value, setter]) => (
                  <label key={label} className="text-[10px] text-[#86868B]">
                    {label}
                    <input
                      type="month"
                      value={value}
                      onChange={(event) => setter(event.target.value)}
                      className="mt-1 block rounded-[7px] border border-[#3A3A3C] bg-[#1F1F1E] px-2 py-1.5 text-xs text-white"
                    />
                  </label>
                ))}
              </div>
            ) : null}
          </div>
          <FinanceTrend series={series} />
        </Section>
        <Section
          title="기간 누계 · 자산 비교"
          action={comparisonAction}
          className="p-4"
        >
          <div className="overflow-x-auto rounded-[10px] border border-[#333333]">
            <table
              data-testid="finance-period-summary"
              className="w-full min-w-[520px] table-fixed text-xs"
            >
              <colgroup>
                <col className="w-[34%]" />
                <col className="w-[22%]" />
                {comparisonResults.length ? comparisonResults.map((result) => (
                  <col key={result.assetKey} className="w-[22%]" />
                )) : <col className="w-[22%]" />}
              </colgroup>
              <thead className="bg-[#202020] text-[10px] text-[#86868B]">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">항목</th>
                  <th className="truncate px-2 py-2 text-right font-medium" title={selectedAssetName}>
                    {selectedAssetName}
                  </th>
                  {comparisonResults.length ? comparisonResults.map((result) => (
                    <th key={result.assetKey} className="truncate px-2 py-2 text-right font-medium" title={result.assetName}>
                      {result.assetName}
                    </th>
                  )) : (
                    <th className="px-2 py-2 text-right font-medium">비교 자산 미선택</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {FINANCE_COMPARISON_PRESENTATION_KEYS.map((key) => {
                  const isKeyResult = key === "net_operating_income" || key === "after_debt_service_cash_flow";
                  return (
                    <tr key={key} className={isKeyResult ? "bg-[#17314E]" : "bg-[#252524]"}>
                      <th className={`border-t border-[#333333] px-3 py-2 text-left ${isKeyResult ? "font-semibold text-[#9AD7FF]" : "font-medium text-[#D1D1D6]"}`}>
                        {summaryLabels[key]}
                      </th>
                      <td className={`border-t border-[#333333] px-2 py-2 text-right tabular-nums ${isKeyResult ? "font-semibold text-[#9AD7FF]" : "text-white"}`}>
                        {amount(total(key))}
                      </td>
                      {comparisonResults.length ? comparisonResults.map((result) => (
                        <td key={result.assetKey} className="border-t border-[#333333] px-2 py-2 text-right tabular-nums text-[#A1A1AA]">
                          {amount(seriesTotal(result.series, key))}
                        </td>
                      )) : (
                        <td className="border-t border-[#333333] px-2 py-2 text-right text-[#68686D]">비교 없음</td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Section>
      </div>
      <Section
        title="물류센터 NOI 손익표"
        action={<SaveState state={saveState} />}
      >
        <p
          id="finance-account-selection-status"
          role="status"
          aria-live="polite"
          aria-atomic="true"
          className="sr-only"
        >
          {accountSelectionAnnouncement}
        </p>
        <div
          data-testid="finance-statement-scroll"
          className="custom-scrollbar overflow-x-auto rounded-[10px] border border-[#333333]"
        >
          <table
            data-testid="finance-statement-table"
            className="w-max min-w-full border-separate border-spacing-0 text-sm"
          >
            <thead>
              <tr>
                <th className="sticky left-0 top-0 z-20 min-w-[264px] border-b border-r border-[#333333] bg-[#202020] px-3 py-2.5 text-left text-xs text-[#A1A1AA]">
                  구분 / 계정 선택
                </th>
                {periods.map((period) => (
                  <th
                    key={period}
                    className="min-w-[104px] border-b border-[#333333] bg-[#202020] px-2 py-2.5 text-right text-xs text-[#A1A1AA]"
                  >
                    {period}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={`${row.kind}-${row.key}`}
                  data-finance-account-active={row.kind === "account" ? String(row.active) : undefined}
                >
                  {row.kind === "section" ? (
                    <>
                      <th className="sticky left-0 z-10 border-b border-r border-[#414145] bg-[#1D1D1D] px-3 py-2 text-left text-xs font-semibold text-[#9A9AA0]">
                        {row.label}
                      </th>
                      {periods.map((period) => (
                        <td
                          key={period}
                          className="border-b border-[#414145] bg-[#1D1D1D]"
                        />
                      ))}
                    </>
                  ) : row.kind === "subsection" ? (
                    <>
                      <th className="sticky left-0 z-10 border-b border-r border-[#3A3A3C] bg-[#222222] px-6 py-1.5 text-left text-[11px] font-semibold text-[#A1A1AA]">
                        {row.label}
                      </th>
                      {periods.map((period) => (
                        <td key={period} className="border-b border-[#3A3A3C] bg-[#222222]" />
                      ))}
                    </>
                  ) : row.kind === "inactive-divider" ? (
                    <>
                      <th className="sticky left-0 z-10 border-b border-r border-[#333333] bg-[#202020] px-7 py-1.5 text-left text-[10px] font-medium uppercase tracking-[0.08em] text-[#68686D]">
                        미사용 계정 · NOI 제외
                      </th>
                      {periods.map((period) => (
                        <td key={period} className="border-b border-[#333333] bg-[#202020]" />
                      ))}
                    </>
                  ) : row.kind === "custom-add" ? (
                    <>
                      <th
                        data-finance-section={row.section}
                        className="sticky left-0 z-10 border-b border-r border-[#333333] bg-[#252524] px-3 py-2 text-left"
                      >
                        <div className="flex items-center gap-2 pl-3">
                          <input
                            data-testid="finance-custom-account-name"
                            aria-label={`${financeHierarchy.find((section) => section.key === row.section)?.label || "NOI"} 사용자 항목명`}
                            type="text"
                            maxLength={60}
                            value={customAccountDrafts[row.section] || ""}
                            onChange={(event) => setCustomAccountDrafts((currentDrafts) => ({
                              ...currentDrafts,
                              [row.section]: event.target.value,
                            }))}
                            onKeyDown={(event) => {
                              if (event.key === "Enter") {
                                event.preventDefault();
                                void addCustomFinanceAccount(row.section);
                              }
                            }}
                            disabled={!writeEnabled || accountMutationPending}
                            placeholder="사용자 항목명"
                            className="min-w-0 flex-1 rounded-[6px] border border-[#3A3A3C] bg-[#202020] px-2 py-1.5 text-xs text-white outline-none placeholder:text-[#5C5C61] focus:border-[#5E9EFF] disabled:cursor-not-allowed disabled:opacity-40"
                          />
                          <button
                            data-testid="finance-custom-account-add"
                            type="button"
                            onClick={() => void addCustomFinanceAccount(row.section)}
                            disabled={!writeEnabled || accountMutationPending || !String(customAccountDrafts[row.section] || "").trim()}
                            className="shrink-0 rounded-[6px] border border-[#3A3A3C] px-2 py-1.5 text-[11px] font-medium text-[#D1D1D6] hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-35"
                          >
                            항목 추가
                          </button>
                        </div>
                      </th>
                      {periods.map((period) => (
                        <td key={period} className="border-b border-[#333333] bg-[#252524]" />
                      ))}
                    </>
                  ) : (
                    <>
                      <th
                        className={`sticky left-0 z-10 border-b border-r border-[#333333] px-3 py-2 text-left ${row.kind === "metric" ? "bg-[#17314E] font-semibold text-[#9AD7FF]" : row.active ? "bg-[#252524] text-[#D1D1D6]" : "bg-[#202020] text-[#68686D]"}`}
                      >
                        {row.kind === "account" ? (
                          <div className="flex min-w-0 items-center gap-2 pl-3">
                            <label data-testid="finance-account-row" className="flex min-w-0 flex-1 cursor-pointer items-center gap-2">
                              <input
                                ref={(node) => {
                                  if (node) accountToggleRefs.current.set(row.key, node);
                                  else accountToggleRefs.current.delete(row.key);
                                }}
                                data-testid="finance-account-toggle"
                                type="checkbox"
                                checked={row.active}
                                disabled={!writeEnabled || accountMutationPending}
                                aria-describedby="finance-account-selection-status"
                                onChange={() => void toggleFinanceAccount(row)}
                                className="h-3.5 w-3.5 shrink-0 accent-[#5E9EFF] disabled:cursor-not-allowed disabled:opacity-35"
                              />
                              <span className="min-w-0 truncate">{row.label}</span>
                            </label>
                            {row.account?.is_custom ? (
                              <button
                                data-testid="finance-custom-account-delete"
                                type="button"
                                aria-label={`${row.label} 삭제`}
                                title="이 자산에서 사용자 추가 항목 삭제"
                                onClick={() => void deleteCustomFinanceAccount(row)}
                                disabled={!writeEnabled || accountMutationPending}
                                className="shrink-0 rounded-[5px] border border-[#49494D] px-1.5 py-1 text-[10px] font-medium text-[#A9A9AE] hover:border-[#6C6C72] hover:bg-white/5 hover:text-white disabled:cursor-not-allowed disabled:opacity-35"
                              >
                                삭제
                              </button>
                            ) : null}
                          </div>
                        ) : row.label}
                      </th>
                      {periods.map((period, periodIndex) => {
                        if (row.kind === "metric")
                          return (
                            <td
                              key={period}
                              className="border-b border-[#333333] bg-[#17314E] px-3 py-2 text-right font-semibold tabular-nums text-[#9AD7FF]"
                            >
                              {amount(series[periodIndex]?.[row.key])}
                            </td>
                          );
                        if (aggregation !== "month")
                          return (
                            <td
                              key={period}
                              className={`border-b border-[#333333] px-3 py-2 text-right tabular-nums ${row.active ? "bg-[#252524] text-white" : "bg-[#202020] text-[#68686D]"}`}
                            >
                              {amount(aggregateAccount(row.key, period))}
                            </td>
                          );
                        const cellEntries = accountEntries(row.key, period);
                        return (
                          <td
                            key={period}
                            className={`border-b border-[#333333] px-2 py-1 ${row.active ? "bg-[#222A32]" : "bg-[#202020]"}`}
                          >
                            <input
                              data-autosave-field={`${row.key}-${period}`}
                              aria-label={`${row.label} ${period}`}
                              type="number"
                              value={
                                cellEntries.length
                                  ? accountMonthTotal(row.key, period)
                                  : ""
                              }
                              onChange={(event) =>
                                setCell(row.account, period, event.target.value)
                              }
                              onBlur={(event) => void saveCell(row.account, period, event.currentTarget.value)}
                              disabled={!writeEnabled || !row.active || saveState === "saving"}
                              className="w-full rounded-[6px] border border-transparent bg-transparent px-2 py-1.5 text-right tabular-nums text-white outline-none hover:border-[#35414E] focus:border-[#5E9EFF] disabled:cursor-not-allowed disabled:text-[#5C5C61]"
                            />
                          </td>
                        );
                      })}
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button
          data-testid="finance-save"
          type="button"
          disabled={!writeEnabled}
          className="sr-only"
        >
          자동 저장
        </button>
      </Section>
    </div>
  );
}

function activeTabFromPath(path) {
  const part = normalizeLogisticsPath(path).split("/").at(-1);
  return TAB_KEYS.has(part) ? part : "home";
}
export default function LogisticsDataPlatform({ currentPath = "" }) {
  const activeTab = activeTabFromPath(currentPath);
  const [assetCode, setAssetCode] = useState(
    () => sessionStorage.getItem("gate6-data-platform-asset-code") || "",
  );
  const [showMaturities, setShowMaturities] = useState(false);
  const [maturityTransition, setMaturityTransition] = useState(null);
  const assetDirectory = usePrimaryResource(DATA_PLATFORM_ACTIONS.homeRead, {
    as_of_date: todayKst(),
  });
  const home = usePrimaryResource(
    DATA_PLATFORM_ACTIONS.homeRead,
    {
      asset_code: assetCode,
      as_of_date: todayKst(),
    },
    { enabled: Boolean(assetCode) },
  );
  const assets = useMemo(
    () => normalizeAssetDirectory(assetDirectory.data),
    [assetDirectory.data],
  );
  const maturities = usePrimaryResource(
    DATA_PLATFORM_ACTIONS.maturitiesRead,
    {
      asset_code: assetCode,
      from_date: todayKst(),
      to_date: addDays(todayKst(), 365),
    },
    { enabled: Boolean(assetCode) },
  );
  const maturityRows = normalizeMaturities(maturities.data);
  const maturityUiLoading = Boolean(assetCode) && (
    !maturities.requestId
    || maturities.loading
    || maturityTransition?.assetCode === assetCode
  );
  const maturityButtonText = !assetCode
    ? "만기 알림 자산 선택"
    : maturityUiLoading
      ? "만기 알림 불러오는 중"
      : maturities.error
        ? "만기 알림 확인 필요"
        : `만기 알림 ${maturityRows.length}`;
  useEffect(() => {
    if (!assets.length) return;
    const nextAssetCode = reconcileAssetCode(assets, assetCode);
    if (nextAssetCode !== assetCode) setAssetCode(nextAssetCode);
  }, [assetCode, assets]);
  useEffect(() => {
    if (assetCode)
      sessionStorage.setItem("gate6-data-platform-asset-code", assetCode);
  }, [assetCode]);
  useEffect(() => {
    if (!maturityTransition) return;
    if (!assetCode || maturityTransition.assetCode !== assetCode) {
      setMaturityTransition(null);
      return;
    }
    if (maturities.loading) return;
    if (
      maturities.error
      || (maturities.requestId && maturities.requestId !== maturityTransition.requestId)
    ) {
      setMaturityTransition(null);
    }
  }, [assetCode, maturities.error, maturities.loading, maturities.requestId, maturityTransition]);
  const changeAsset = (nextAssetCode) => {
    if (nextAssetCode === assetCode) return;
    setShowMaturities(false);
    setMaturityTransition({
      assetCode: nextAssetCode,
      requestId: maturities.requestId,
    });
    setAssetCode(nextAssetCode);
  };
  return (
    <main
      data-testid="logistics-data-platform"
      className="logistics-data-platform min-h-full bg-[#1F1F1E] text-[#E5E5E5]"
    >
      <header className="border-b border-[#333333] bg-[#1F1F1E]">
        <div className="mx-auto max-w-[1680px] px-8 py-5">
          <div className="flex items-center justify-between gap-4">
            <h1 className="text-[26px] font-semibold text-white">
              {TITLES[activeTab]}
            </h1>
            <div className="relative flex items-end gap-2">
              <label className="flex min-w-64 flex-col gap-1 text-xs text-[#A1A1AA]">
                담당 자산
                <select
                  data-testid="data-platform-asset-select"
                  value={assetCode}
                  onChange={(event) => changeAsset(event.target.value)}
                  className="rounded-[8px] border border-[#3A3A3C] bg-[#252524] px-3 py-2 text-sm text-white"
                >
                  <option value="">자산 선택</option>
                  {assets.map((asset) => (
                    <option key={asset.asset_code} value={asset.asset_code}>
                      {asset.name || asset.asset_code}
                    </option>
                  ))}
                </select>
              </label>
              <button
                data-testid="data-platform-maturity-button"
                type="button"
                onClick={() => setShowMaturities((value) => !value)}
                disabled={!assetCode || maturityUiLoading || Boolean(maturities.error)}
                className="rounded-[8px] border border-[#3A3A3C] bg-[#252524] px-3 py-2 text-sm text-[#D1D1D6] disabled:cursor-wait disabled:opacity-60"
              >
                {maturityButtonText}
              </button>
              {showMaturities ? (
                <section className="absolute right-0 top-full z-50 mt-2 w-[min(54rem,calc(100vw-2.5rem))] rounded-[16px] border border-[#3A3A3C] bg-[#252524] p-4 shadow-2xl">
                  <MaturityList rows={maturityRows} />
                </section>
              ) : null}
            </div>
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-[1680px] px-8 py-6">
        {activeTab === "home" ? (
          <HomePanel
            key={`home-${assetCode}`}
            assetCode={assetCode}
            resource={home}
            maturities={maturities}
          />
        ) : null}
        {activeTab === "rent-roll" ? (
          <RentRollPanel key={`rent-${assetCode}`} assetCode={assetCode} />
        ) : null}
        {activeTab === "income-expense" ? (
          <FinancePanel
            key={`finance-${assetCode}`}
            assetCode={assetCode}
            assets={assets}
          />
        ) : null}
      </div>
    </main>
  );
}
