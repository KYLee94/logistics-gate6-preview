import React, { useEffect, useMemo, useState } from "react";
import { normalizeLogisticsPath } from "../../components/system/workspace/logisticsRoutes";
import {
  DATA_PLATFORM_ACTIONS,
  createClientRequestId,
  invokeDataPlatform,
  usePrimaryResource,
} from "./api";
import {
  calculateRentRollENoc,
  deriveRentRollRow,
  emptyRentRollRow,
  RENT_ROLL_COLUMNS,
  RENT_ROLL_PASTE_COLUMNS,
  validateUniversalRentRoll,
} from "./rentRollSchema";
import {
  calculateKoreanLogisticsNoi,
  FINANCE_WATERFALL_KEYS,
  KOREAN_LOGISTICS_NOI_ACCOUNTS,
} from "./formulas";

const TITLES = Object.freeze({
  home: "홈",
  "rent-roll": "렌트롤",
  "income-expense": "수익·비용",
});
const TAB_KEYS = new Set(Object.keys(TITLES));
const DEFAULT_SORT = Object.freeze({ key: "floor_label", direction: "desc" });
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
  return `${amount(value)}㎡ · ${new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 2 }).format(Number(value) * 0.3025)}평`;
}
function display(value) {
  return value === "" || value == null ? "—" : String(value);
}
function normalizeMaturities(data) {
  return Array.isArray(data?.maturities)
    ? data.maturities
    : Array.isArray(data?.rows)
      ? data.rows
      : [];
}
function floorValue(value) {
  const text = String(value || "")
    .trim()
    .toUpperCase();
  const number = Number(text.match(/\d+(?:\.\d+)?/u)?.[0] || 0);
  if (/^B|지하/u.test(text)) return -number;
  if (/옥탑|ROOF/u.test(text)) return 1000 + number;
  return text ? number : -Infinity;
}
function rowId(row) {
  return row.row_key || row._draft_id;
}

function LoadingLine({ visible }) {
  return visible ? (
    <div className="h-0.5 w-full animate-pulse rounded bg-[#5E9EFF]" />
  ) : null;
}
function ErrorNotice({ error }) {
  return error ? (
    <p className="text-sm text-[#FF9B9B]" role="alert">
      {error.message || "데이터 처리에 실패했습니다."}
    </p>
  ) : null;
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
  const label =
    state === "saving"
      ? "저장 중"
      : state === "saved"
        ? "저장 완료"
        : state === "error"
          ? "저장 실패"
          : "변경 시 자동 저장";
  const color =
    state === "error"
      ? "text-[#FF9B9B]"
      : state === "saved"
        ? "text-[#7BD5A0]"
        : "text-[#86868B]";
  return (
    <span data-save-state={state || "idle"} className={`text-xs ${color}`}>
      {label}
    </span>
  );
}

function EditableValue({
  value,
  type = "text",
  disabled,
  onSave,
  align = "left",
  ariaLabel,
}) {
  const [draft, setDraft] = useState(value ?? "");
  const [state, setState] = useState("idle");
  useEffect(() => {
    setDraft(value ?? "");
  }, [value]);
  const save = async () => {
    if (disabled || String(draft ?? "") === String(value ?? "")) return;
    setState("saving");
    try {
      await onSave(draft);
      setState("saved");
    } catch {
      setState("error");
    }
  };
  return (
    <div data-autosave-field={ariaLabel || true} className="group relative">
      <input
        aria-label={ariaLabel}
        type={type}
        value={draft}
        onChange={(event) => {
          setDraft(event.target.value);
          setState("idle");
        }}
        onBlur={save}
        disabled={disabled}
        className={`${INPUT_CLASS} ${align === "right" ? "text-right tabular-nums" : ""}`}
      />
      <span
        className={`pointer-events-none absolute bottom-0 right-1 text-[8px] ${state === "saved" ? "text-[#7BD5A0]" : state === "error" ? "text-[#FF9B9B]" : "opacity-0"}`}
      >
        {state === "saved" ? "●" : state === "error" ? "!" : ""}
      </span>
    </div>
  );
}

function MaturityList({ rows, limit = 5 }) {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {[
        ["lease", "임대차"],
        ["fund", "펀드"],
        ["loan", "대출"],
      ].map(([type, label]) => {
        const items = rows
          .filter((row) => (row.type || row.kind) === type)
          .slice(0, limit);
        return (
          <div key={type}>
            <p className="mb-2 text-xs font-semibold text-[#A1A1AA]">
              {label} 만기
            </p>
            {items.length ? (
              items.map((row) => (
                <div
                  key={
                    row.maturity_key ||
                    `${type}-${row.official_date}-${row.target_name}`
                  }
                  className="flex justify-between gap-3 border-b border-[#333333] py-2.5 text-sm"
                >
                  <span className="truncate text-[#D1D1D6]">
                    {display(row.target_name || row.title)}
                  </span>
                  <time className="shrink-0 tabular-nums text-white">
                    {display(row.official_date || row.maturity_date)}
                  </time>
                </div>
              ))
            ) : (
              <p className="py-2 text-sm text-[#6E6E73]">—</p>
            )}
          </div>
        );
      })}
    </div>
  );
}

function HomePanel({ assetKey, resource, maturities }) {
  const data = resource.data || {};
  const asset = data.asset;
  const funds = Array.isArray(data.funds) ? data.funds : [];
  const investments = Array.isArray(data.investments) ? data.investments : [];
  const loans = Array.isArray(data.loans) ? data.loans : [];
  const rent = usePrimaryResource(
    DATA_PLATFORM_ACTIONS.rentRollRead,
    { asset_key: assetKey, limit: 500 },
    { enabled: Boolean(assetKey) },
  );
  const rows = Array.isArray(rent.data?.rows) ? rent.data.rows : [];
  const activeRows = rows.filter((row) => row.occupancy_status !== "vacant");
  const tenants = [
    ...new Set(activeRows.map((row) => row.tenant_name).filter(Boolean)),
  ];
  const [saveState, setSaveState] = useState("idle");
  const saveHome = async (
    entity,
    entityKey,
    field,
    value,
    expectedRevision,
  ) => {
    setSaveState("saving");
    try {
      await invokeDataPlatform(DATA_PLATFORM_ACTIONS.homeBatchSave, {
        asset_key: assetKey,
        client_request_id: createClientRequestId("home"),
        operations: [
          {
            entity,
            entity_key: entityKey,
            field,
            value,
            expected_revision: expectedRevision,
            reason: "홈 화면 직접 수정",
          },
        ],
      });
      setSaveState("saved");
      resource.reload();
    } catch (error) {
      setSaveState("error");
      throw error;
    }
  };
  const writeEnabled = data.write_enabled === true;
  const assetFields = [
    ["name", "자산명", "text"],
    ["address", "주소", "text"],
    ["asset_code", "자산 코드", "text"],
    ["sector", "섹터", "text"],
    ["land_area_sqm", "대지면적(㎡)", "number"],
    ["gross_area_sqm", "연면적(㎡)", "number"],
    ["leasable_area_sqm", "임대가능면적(㎡)", "number"],
    ["floor_count", "층수", "text"],
    ["manager_name", "담당자", "text"],
    ["manager_team", "담당팀", "text"],
    ["acquisition_cost", "취득가", "number"],
    ["current_valuation", "현재 평가액", "number"],
    ["currency_code", "기준 통화", "text"],
  ];
  if (!assetKey) return <EmptyText>조회 가능한 자산이 없습니다.</EmptyText>;
  return (
    <div className="space-y-4">
      <LoadingLine
        visible={resource.loading || maturities.loading || rent.loading}
      />
      <ErrorNotice error={resource.error || maturities.error || rent.error} />
      <Section title="자산 개요" action={<SaveState state={saveState} />}>
        {asset ? (
          <div className="grid gap-4 xl:grid-cols-[1fr_340px]">
            <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-[10px] border border-[#333333] bg-[#333333] md:grid-cols-3 xl:grid-cols-4">
              {assetFields.map(([key, label, type]) => (
                <div
                  key={key}
                  className={`${key === "name" || key === "address" ? "col-span-2" : ""} bg-[#222221] px-3 py-2`}
                >
                  <dt className="text-[11px] text-[#86868B]">
                    {label}
                    {[
                      "land_area_sqm",
                      "gross_area_sqm",
                      "leasable_area_sqm",
                    ].includes(key) && asset[key]
                      ? ` · ${(Number(asset[key]) * 0.3025).toLocaleString("ko-KR", { maximumFractionDigits: 2 })}평`
                      : ""}
                  </dt>
                  <dd>
                    <EditableValue
                      ariaLabel={label}
                      value={asset[key]}
                      type={type}
                      disabled={!writeEnabled}
                      onSave={(value) =>
                        saveHome(
                          "asset",
                          asset.asset_key,
                          key,
                          value,
                          asset.revision || resource.revision,
                        )
                      }
                      align={type === "number" ? "right" : "left"}
                    />
                  </dd>
                </div>
              ))}
            </dl>
            <aside className="rounded-[12px] border border-[#333333] bg-[#202020] p-4">
              <h3 className="mb-3 text-sm font-semibold text-white">
                임차 현황
              </h3>
              <div className="grid grid-cols-2 gap-px overflow-hidden rounded-[8px] bg-[#333333]">
                {[
                  ["임차인", `${tenants.length}개사`],
                  [
                    "임대 / 공실",
                    `${activeRows.length} / ${rows.length - activeRows.length}개`,
                  ],
                  [
                    "임대면적",
                    area(
                      activeRows.reduce(
                        (sum, row) => sum + Number(row.leased_area_sqm || 0),
                        0,
                      ),
                    ),
                  ],
                  [
                    "임대율",
                    asset.leasable_area_sqm
                      ? `${((activeRows.reduce((sum, row) => sum + Number(row.leased_area_sqm || 0), 0) / Number(asset.leasable_area_sqm)) * 100).toFixed(1)}%`
                      : "—",
                  ],
                ].map(([label, value]) => (
                  <div key={label} className="bg-[#252524] p-3">
                    <p className="text-[11px] text-[#86868B]">{label}</p>
                    <p className="mt-1 text-sm font-semibold text-white">
                      {value}
                    </p>
                  </div>
                ))}
              </div>
              <p className="mt-3 line-clamp-3 text-xs leading-5 text-[#A1A1AA]">
                {tenants.join(" · ") || "—"}
              </p>
            </aside>
          </div>
        ) : (
          <EmptyText />
        )}
      </Section>
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
                {funds.map((fund) => (
                  <tr key={fund.fund_key}>
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
                        <EditableValue
                          value={fund[field]}
                          type={type}
                          disabled={!writeEnabled}
                          onSave={(value) =>
                            saveHome(
                              "fund",
                              fund.fund_key,
                              field,
                              value,
                              fund.revision,
                            )
                          }
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
                    {["펀드", "구분", "투자자", "약정액", "투입액"].map(
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
                  {investments.map((row) => (
                    <tr key={row.beneficiary_key}>
                      {[
                        ["fund_name", "text"],
                        ["tranche", "text"],
                        ["beneficiary_name", "text"],
                        ["agreed_amount_krw", "number"],
                        ["contributed_amount_krw", "number"],
                      ].map(([field, type], index) => (
                        <td
                          key={field}
                          className="border-b border-[#333333] px-1 py-1"
                        >
                          <EditableValue
                            value={
                              row[field] ??
                              (field === "agreed_amount_krw"
                                ? row.commitment_amount_krw
                                : row.invested_amount_krw)
                            }
                            type={type}
                            disabled={!writeEnabled || index === 0}
                            onSave={(value) =>
                              saveHome(
                                "beneficiary",
                                row.beneficiary_key,
                                field,
                                value,
                                row.revision,
                              )
                            }
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
              {loans.map((loan) => (
                <tr key={loan.loan_key || loan.row_key}>
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
                      <EditableValue
                        value={
                          loan[field] ??
                          (field === "coupon_rate"
                            ? loan.loan_rate || loan.interest_rate
                            : field === "all_in_rate"
                              ? loan.all_in
                              : null)
                        }
                        type={type}
                        disabled={!writeEnabled}
                        onSave={(value) =>
                          saveHome(
                            "loan",
                            loan.loan_key || loan.row_key,
                            field,
                            value,
                            loan.revision,
                          )
                        }
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
  const column = RENT_ROLL_COLUMNS.find((item) => item.key === sort?.key);
  if (!column) return rows;
  const direction = sort.direction === "asc" ? 1 : -1;
  return rows
    .map((row, index) => ({ row, index }))
    .sort((a, b) => {
      let left = a.row[column.key];
      let right = b.row[column.key];
      if (column.key === "floor_label") {
        left = floorValue(left);
        right = floorValue(right);
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
function parsePaste(text) {
  return String(text || "")
    .split(/\r?\n/u)
    .filter((line) => line.trim())
    .map((line, index) => {
      const row = emptyRentRollRow(`paste-${Date.now()}-${index}`);
      line.split("\t").forEach((value, columnIndex) => {
        const key = RENT_ROLL_PASTE_COLUMNS[columnIndex];
        if (key) row[key] = value.trim();
      });
      if (row.occupancy_status === "임대") row.occupancy_status = "occupied";
      if (row.occupancy_status === "공실") row.occupancy_status = "vacant";
      return row;
    });
}

function RentRollPanel({ assetKey }) {
  const resource = usePrimaryResource(
    DATA_PLATFORM_ACTIONS.rentRollRead,
    { asset_key: assetKey, limit: 500 },
    { enabled: Boolean(assetKey) },
  );
  const [rows, setRows] = useState([]);
  const [sort, setSort] = useState(DEFAULT_SORT);
  const [paste, setPaste] = useState("");
  const [saveState, setSaveState] = useState("idle");
  const [error, setError] = useState(null);
  const writeEnabled = resource.data?.write_enabled === true;
  useEffect(() => {
    const source = Array.isArray(resource.data?.rows) ? resource.data.rows : [];
    setRows(
      sortRows(
        source.map((row, index) => ({
          ...deriveRentRollRow(row),
          operation: "update",
          display_order: row.display_order ?? index + 1,
        })),
        DEFAULT_SORT,
      ),
    );
    setSort(DEFAULT_SORT);
  }, [resource.data]);
  const displayedRows = useMemo(() => sortRows(rows, sort), [rows, sort]);
  const update = (id, field, value) =>
    setRows((current) =>
      current.map((row) =>
        rowId(row) === id ? deriveRentRollRow({ ...row, [field]: value }) : row,
      ),
    );
  const saveRows = async (targetRows) => {
    const errors = validateUniversalRentRoll(
      targetRows.filter((row) => row.operation !== "delete"),
    );
    if (errors.length) {
      setError(new Error(errors[0]));
      setSaveState("error");
      return;
    }
    setSaveState("saving");
    setError(null);
    try {
      await invokeDataPlatform(DATA_PLATFORM_ACTIONS.rentRollBatchSave, {
        asset_key: assetKey,
        client_request_id: createClientRequestId("rent-roll"),
        expected_revisions: Object.fromEntries(
          targetRows
            .filter((row) => row.revision)
            .map((row) => [row.row_key, row.revision]),
        ),
        rows: targetRows.map((row) =>
          Object.fromEntries(
            Object.entries(row).filter(
              ([key]) =>
                ![
                  "_draft_id",
                  "exclusive_area_py",
                  "common_area_py",
                  "leased_area_py",
                  "contract_months",
                  "wale_years",
                ].includes(key),
            ),
          ),
        ),
      });
      setSaveState("saved");
      resource.reload();
    } catch (cause) {
      setError(cause);
      setSaveState("error");
    }
  };
  const blurSave = (id) => {
    const row = rows.find((item) => rowId(item) === id);
    if (row) void saveRows([row]);
  };
  const move = (id, delta) => {
    const ordered = [...displayedRows];
    const index = ordered.findIndex((row) => rowId(row) === id);
    const target = index + delta;
    if (target < 0 || target >= ordered.length) return;
    [ordered[index], ordered[target]] = [ordered[target], ordered[index]];
    const changed = ordered.map((row, rowIndex) => ({
      ...row,
      display_order: rowIndex + 1,
    }));
    setRows(changed);
    setSort(null);
    void saveRows([changed[index], changed[target]]);
  };
  const archive = (id) => {
    const row = rows.find((item) => rowId(item) === id);
    if (!row) return;
    const deleted = { ...row, operation: "delete" };
    setRows((current) =>
      current.map((item) => (rowId(item) === id ? deleted : item)),
    );
    void saveRows([deleted]);
  };
  const add = () => {
    const next = { ...emptyRentRollRow(), display_order: rows.length + 1 };
    setRows((current) => [...current, next]);
    setSort(null);
  };
  if (!assetKey) return <EmptyText>먼저 자산을 선택해 주세요.</EmptyText>;
  return (
    <div className="space-y-4">
      <LoadingLine visible={resource.loading} />
      <ErrorNotice error={resource.error || error} />
      <Section
        title="렌트롤"
        action={
          <div className="flex items-center gap-3">
            <SaveState state={saveState} />
            <button
              data-testid="rent-roll-add"
              type="button"
              onClick={add}
              disabled={!writeEnabled}
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
              setPaste("");
              setSort(null);
            }}
            disabled={!writeEnabled}
            className="rounded-[8px] border border-[#3A3A3C] px-4 py-2 text-sm text-white"
          >
            붙여넣기
          </button>
          <span className="text-xs text-[#86868B]">
            {rows.filter((row) => row.operation !== "delete").length}행
          </span>
        </div>
        <div className="custom-scrollbar h-[calc(100vh-190px)] overflow-auto rounded-[12px] border border-[#333333]">
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
                {[
                  ...new Set(RENT_ROLL_COLUMNS.map((column) => column.group)),
                ].map((group) => (
                  <th
                    key={group}
                    colSpan={
                      RENT_ROLL_COLUMNS.filter(
                        (column) => column.group === group,
                      ).length
                    }
                    className="sticky top-0 z-30 border-b border-r border-[#333333] bg-[#202020] px-2 py-2 text-center text-xs font-semibold text-[#A1A1AA]"
                  >
                    {group}
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
                {RENT_ROLL_COLUMNS.map((column) => {
                  const left =
                    column.key === "occupancy_status"
                      ? "left-[62px]"
                      : column.key === "tenant_name"
                        ? "left-[166px]"
                        : "";
                  return (
                    <th
                      key={column.key}
                      style={{ minWidth: column.width, width: column.width }}
                      className={`sticky top-[33px] z-30 border-b border-r border-[#333333] bg-[#202020] px-2 py-2 text-left text-[11px] font-medium text-[#A1A1AA] ${column.key === "occupancy_status" || column.key === "tenant_name" ? `left-sticky ${left}` : ""}`}
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
                        <span>{column.label}</span>
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
                return (
                  <tr
                    key={id}
                    className={`hover:bg-[#292929] ${row.operation === "delete" ? "opacity-35" : ""}`}
                  >
                    <td className="sticky left-0 z-20 border-b border-r border-[#333333] bg-[#252524] px-1">
                      <div className="flex justify-center">
                        <button
                          data-testid="rent-roll-move-up"
                          type="button"
                          onClick={() => move(id, -1)}
                          disabled={index === 0}
                        >
                          ↑
                        </button>
                        <button
                          data-testid="rent-roll-move-down"
                          type="button"
                          onClick={() => move(id, 1)}
                          disabled={index === displayedRows.length - 1}
                        >
                          ↓
                        </button>
                      </div>
                    </td>
                    {RENT_ROLL_COLUMNS.map((column) => {
                      const left =
                        column.key === "occupancy_status"
                          ? "left-[62px]"
                          : column.key === "tenant_name"
                            ? "left-[166px]"
                            : "";
                      const sticky =
                        column.key === "occupancy_status" ||
                        column.key === "tenant_name";
                      const cellClass = `border-b border-r border-[#333333] bg-[#252524] px-1 py-1 ${sticky ? `sticky z-10 ${left}` : ""}`;
                      if (column.kind === "readonly")
                        return (
                          <td
                            key={column.key}
                            className={`${cellClass} px-3 text-right tabular-nums text-[#A1A1AA]`}
                          >
                            {column.key === "current_total_cost_per_py_krw"
                              ? amount(calculateRentRollENoc(row))
                              : display(row[column.key])}
                          </td>
                        );
                      if (column.kind === "select")
                        return (
                          <td key={column.key} className={cellClass}>
                            <select
                              data-autosave-field={column.key}
                              value={row[column.key] || ""}
                              onChange={(event) =>
                                update(id, column.key, event.target.value)
                              }
                              onBlur={() => blurSave(id)}
                              disabled={!writeEnabled}
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
                      return (
                        <td key={column.key} className={cellClass}>
                          {column.key === "tenant_name" ? (
                            <input
                              data-autosave-field="tenant_name"
                              type="text"
                              value={row.tenant_name ?? ""}
                              onChange={(event) =>
                                update(id, "tenant_name", event.target.value)
                              }
                              onBlur={() => blurSave(id)}
                              disabled={
                                !writeEnabled ||
                                row.occupancy_status === "vacant"
                              }
                              className={INPUT_CLASS}
                            />
                          ) : (
                            <input
                              data-autosave-field={column.key}
                              type={
                                column.kind === "number"
                                  ? "number"
                                  : column.kind === "date"
                                    ? "date"
                                    : "text"
                              }
                              value={row[column.key] ?? ""}
                              onChange={(event) =>
                                update(id, column.key, event.target.value)
                              }
                              onBlur={() => blurSave(id)}
                              disabled={!writeEnabled}
                              className={`${INPUT_CLASS} ${column.kind === "number" ? "text-right tabular-nums" : ""}`}
                            />
                          )}
                        </td>
                      );
                    })}
                    <td className="sticky right-0 z-20 border-b border-l border-[#333333] bg-[#252524] px-2 text-center">
                      <button
                        data-testid="rent-roll-archive"
                        type="button"
                        onClick={() => archive(id)}
                        className="text-xs text-[#86868B] hover:text-[#FF9B9B]"
                      >
                        삭제
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
        <button
          data-testid="rent-roll-save"
          type="button"
          disabled
          className="sr-only"
        >
          자동 저장
        </button>
      </Section>
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
function FinanceTrend({ series, comparison }) {
  const values = [...series, ...comparison]
    .flatMap((row) => [row.net_operating_income, row.asset_net_cash_flow])
    .map((value) => Math.abs(Number(value || 0)));
  const max = Math.max(...values, 1);
  return (
    <div
      data-testid="finance-trend"
      className="flex h-44 items-end gap-3 border-b border-[#3A3A3C] px-3 pt-4"
    >
      {series.map((row, index) => (
        <div
          key={row.period}
          className="flex min-w-0 flex-1 items-end justify-center gap-1"
        >
          <div
            data-testid={index === 0 ? "finance-primary-chart" : undefined}
            title={`NOI ${amount(row.net_operating_income)}`}
            style={{
              height: `${Math.max(3, (Math.abs(row.net_operating_income) / max) * 130)}px`,
            }}
            className="w-4 rounded-t bg-[#5E9EFF]"
          />
          {comparison[index] ? (
            <div
              title={`비교 NOI ${amount(comparison[index].net_operating_income)}`}
              style={{
                height: `${Math.max(3, (Math.abs(comparison[index].net_operating_income) / max) * 130)}px`,
              }}
              className="w-4 rounded-t bg-[#737373]"
            />
          ) : null}
          <span className="absolute mt-5 hidden text-[9px] text-[#86868B] xl:block">
            {row.period}
          </span>
        </div>
      ))}
    </div>
  );
}

function FinancePanel({ assetKey, assets }) {
  const current = currentMonthKst();
  const [start, setStart] = useState(addMonths(current, -11));
  const [end, setEnd] = useState(current);
  const [scenario, setScenario] = useState("actual");
  const [basis, setBasis] = useState("accrual");
  const [aggregation, setAggregation] = useState("month");
  const [comparisonKey, setComparisonKey] = useState("");
  const [entries, setEntries] = useState([]);
  const [saveState, setSaveState] = useState("idle");
  const [error, setError] = useState(null);
  const payload = {
    asset_key: assetKey,
    start_month: start,
    end_month: end,
    scenario,
    accounting_basis: basis,
  };
  const resource = usePrimaryResource(
    DATA_PLATFORM_ACTIONS.financeRead,
    payload,
    { enabled: Boolean(assetKey) },
  );
  const comparison = usePrimaryResource(
    DATA_PLATFORM_ACTIONS.financeRead,
    { ...payload, asset_key: comparisonKey },
    { enabled: Boolean(comparisonKey && comparisonKey !== assetKey) },
  );
  useEffect(() => {
    setEntries(
      Array.isArray(resource.data?.entries)
        ? resource.data.entries.map((row) => ({ ...row, operation: "update" }))
        : [],
    );
  }, [resource.data]);
  const serverAccounts = Array.isArray(resource.data?.accounts)
    ? resource.data.accounts
    : [];
  const definitions = new Map(
    KOREAN_LOGISTICS_NOI_ACCOUNTS.map((row) => [row.code, row]),
  );
  const accounts = serverAccounts
    .filter((account) => definitions.has(account.account_code))
    .sort((a, b) => Number(a.display_order) - Number(b.display_order));
  const months = monthsBetween(start, end);
  const series = buildFinanceSeries(entries, accounts, months, aggregation);
  const comparisonEntries = Array.isArray(comparison.data?.entries)
    ? comparison.data.entries
    : [];
  const comparisonSeries = buildFinanceSeries(
    comparisonEntries,
    Array.isArray(comparison.data?.accounts)
      ? comparison.data.accounts
      : accounts,
    months,
    aggregation,
  );
  const periods = series.map((row) => row.period);
  const writeEnabled = resource.data?.write_enabled === true;
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
  const findEditableEntry = (code, month, source = entries) =>
    accountEntries(code, month, source).find(
      (entry) => entry.source_kind === "manual_input" || entry._draft_id,
    );
  const setCell = (account, month, value) =>
    setEntries((currentEntries) => {
      const editable = findEditableEntry(
        account.account_code,
        month,
        currentEntries,
      );
      const derivedAmount = accountEntries(
        account.account_code,
        month,
        currentEntries,
      )
        .filter((entry) => entry !== editable)
        .reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
      const manualAmount = value === "" ? "" : Number(value) - derivedAmount;
      if (editable)
        return currentEntries.map((entry) =>
          entry === editable
            ? {
                ...entry,
                amount: manualAmount,
                operation: value === "" ? "delete" : "update",
              }
            : entry,
        );
      if (value === "" || manualAmount === 0) return currentEntries;
      return [
        ...currentEntries,
        {
          _draft_id: `finance-${account.account_code}-${month}`,
          operation: "create",
          month,
          account_code: account.account_code,
          amount: manualAmount,
          scenario,
          accounting_basis: basis,
        },
      ];
    });
  const saveCell = async (account, month) => {
    const entry = findEditableEntry(account.account_code, month);
    if (!entry) return;
    setSaveState("saving");
    setError(null);
    try {
      await invokeDataPlatform(DATA_PLATFORM_ACTIONS.financeBatchSave, {
        asset_key: assetKey,
        client_request_id: createClientRequestId("finance"),
        expected_revisions:
          entry.entry_key && entry.revision
            ? { [entry.entry_key]: entry.revision }
            : {},
        entries: [
          {
            operation: entry.operation,
            entry_key: entry.entry_key,
            month,
            account_code: account.account_code,
            amount: entry.amount,
            scenario,
            accounting_basis: basis,
            reason: "NOI 손익표 직접 수정",
          },
        ],
      });
      setSaveState("saved");
      resource.reload();
    } catch (cause) {
      setError(cause);
      setSaveState("error");
    }
  };
  const aggregateAccount = (code, period) =>
    months
      .filter((month) => periodFor(month, aggregation) === period)
      .reduce((sum, month) => sum + accountMonthTotal(code, month), 0);
  const total = (key) =>
    series.reduce((sum, row) => sum + Number(row[key] || 0), 0);
  const comparisonTotal = (key) =>
    comparisonSeries.reduce((sum, row) => sum + Number(row[key] || 0), 0);
  const rows = [];
  let section = null;
  accounts.forEach((account) => {
    const definition = definitions.get(account.account_code);
    if (definition.section !== section) {
      section = definition.section;
      rows.push({
        kind: "section",
        key: section,
        label: definition.sectionLabel,
      });
    }
    rows.push({
      kind: "account",
      key: account.account_code,
      label: definition.label,
      account,
    });
    if (account.account_code === "OTHER_INCOME_LOSS")
      rows.push({
        kind: "metric",
        key: "effective_gross_income",
        label: "유효총수입(EGI)",
      });
    if (account.account_code === "OTHER_PROPERTY_OPEX")
      rows.push({
        kind: "metric",
        key: "net_operating_income",
        label: "순영업소득(NOI)",
      });
    if (account.account_code === "NONCASH_ADDBACK")
      rows.push({
        kind: "metric",
        key: "asset_net_cash_flow",
        label: "자산 순현금흐름(NCF)",
      });
    if (account.account_code === "LOAN_FEE")
      rows.push({
        kind: "metric",
        key: "after_debt_service_cash_flow",
        label: "부채상환 후 현금흐름",
      });
  });
  if (!assetKey) return <EmptyText>먼저 자산을 선택해 주세요.</EmptyText>;
  return (
    <div className="space-y-4">
      <LoadingLine visible={resource.loading || comparison.loading} />
      <ErrorNotice error={resource.error || comparison.error || error} />
      <div className="flex flex-wrap items-end gap-3 rounded-[14px] border border-[#333333] bg-[#242423] px-4 py-3">
        {[
          ["시작 월", "month", start, setStart],
          ["종료 월", "month", end, setEnd],
        ].map(([label, type, value, setter]) => (
          <label
            key={label}
            className="min-w-[145px] text-[11px] text-[#86868B]"
          >
            {label}
            <input
              type={type}
              value={value}
              onChange={(event) => setter(event.target.value)}
              className="mt-1 block rounded-[7px] border border-[#3A3A3C] bg-[#1F1F1E] px-2 py-2 text-sm text-white"
            />
          </label>
        ))}
        <label className="text-[11px] text-[#86868B]">
          시나리오
          <select
            value={scenario}
            onChange={(event) => setScenario(event.target.value)}
            className="mt-1 block rounded-[7px] border border-[#3A3A3C] bg-[#1F1F1E] px-3 py-2 text-sm text-white"
          >
            <option value="actual">실적</option>
            <option value="budget">예산</option>
            <option value="forecast">전망</option>
          </select>
        </label>
        <label className="text-[11px] text-[#86868B]">
          회계 기준
          <select
            value={basis}
            onChange={(event) => setBasis(event.target.value)}
            className="mt-1 block rounded-[7px] border border-[#3A3A3C] bg-[#1F1F1E] px-3 py-2 text-sm text-white"
          >
            <option value="accrual">발생</option>
            <option value="cash">현금</option>
          </select>
        </label>
        <label className="text-[11px] text-[#86868B]">
          집계
          <select
            data-testid="finance-aggregation"
            value={aggregation}
            onChange={(event) => setAggregation(event.target.value)}
            className="mt-1 block rounded-[7px] border border-[#3A3A3C] bg-[#1F1F1E] px-3 py-2 text-sm text-white"
          >
            <option value="month">월</option>
            <option value="quarter">분기</option>
            <option value="year">연도</option>
          </select>
        </label>
        <label className="min-w-[220px] flex-1 text-[11px] text-[#86868B]">
          비교 자산
          <select
            data-testid="finance-comparison-asset"
            value={comparisonKey}
            onChange={(event) => setComparisonKey(event.target.value)}
            className="mt-1 block w-full rounded-[7px] border border-[#3A3A3C] bg-[#1F1F1E] px-3 py-2 text-sm text-white"
          >
            <option value="">비교 안 함</option>
            {assets
              .filter((asset) => asset.asset_key !== assetKey)
              .map((asset) => (
                <option key={asset.asset_key} value={asset.asset_key}>
                  {asset.name || asset.asset_code}
                </option>
              ))}
          </select>
        </label>
        <SaveState state={saveState} />
      </div>
      <section
        data-testid="finance-kpi-strip"
        className="grid grid-cols-2 gap-px overflow-hidden rounded-[14px] border border-[#333333] bg-[#333333] lg:grid-cols-5"
      >
        {[
          ["잠재총수입", "potential_gross_income"],
          ["유효총수입", "effective_gross_income"],
          ["운영비용", "total_operating_expense"],
          ["순영업소득(NOI)", "net_operating_income"],
          ["자산 NCF", "asset_net_cash_flow"],
        ].map(([label, key]) => (
          <div
            key={key}
            className={`bg-[#242423] px-4 py-3 ${key === "net_operating_income" ? "shadow-[inset_0_2px_0_#5E9EFF]" : ""}`}
          >
            <p className="text-[11px] text-[#86868B]">{label}</p>
            <p
              className={`mt-1 text-lg font-semibold tabular-nums ${key === "net_operating_income" ? "text-[#9AD7FF]" : "text-white"}`}
            >
              {amount(total(key))}
            </p>
            {comparisonKey ? (
              <p className="mt-1 text-[11px] text-[#A1A1AA]">
                비교 {amount(comparisonTotal(key))}
              </p>
            ) : null}
          </div>
        ))}
      </section>
      <div className="grid gap-4 xl:grid-cols-[1.25fr_0.75fr]">
        <Section title="NOI·NCF 시계열">
          <FinanceTrend series={series} comparison={comparisonSeries} />
        </Section>
        <Section title="자산 비교">
          <table
            data-testid="finance-comparison-table"
            className="w-full text-sm"
          >
            <thead>
              <tr className="text-[11px] text-[#86868B]">
                <th className="py-2 text-left">지표</th>
                <th className="text-right">선택</th>
                <th className="text-right">비교</th>
                <th className="text-right">차이</th>
              </tr>
            </thead>
            <tbody>
              {FINANCE_WATERFALL_KEYS.map((key) => (
                <tr key={key}>
                  <td className="border-t border-[#333333] py-2 text-[#D1D1D6]">
                    {
                      {
                        potential_gross_income: "잠재총수입",
                        total_income_loss: "수입손실",
                        effective_gross_income: "유효총수입",
                        total_operating_expense: "운영비용",
                        net_operating_income: "NOI",
                        asset_net_cash_flow: "자산 NCF",
                        after_debt_service_cash_flow: "부채상환 후 CF",
                      }[key]
                    }
                  </td>
                  <td className="border-t border-[#333333] text-right tabular-nums text-white">
                    {amount(total(key))}
                  </td>
                  <td className="border-t border-[#333333] text-right tabular-nums text-[#A1A1AA]">
                    {comparisonKey ? amount(comparisonTotal(key)) : "—"}
                  </td>
                  <td className="border-t border-[#333333] text-right tabular-nums text-[#A1A1AA]">
                    {comparisonKey
                      ? amount(total(key) - comparisonTotal(key))
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      </div>
      <Section
        title="물류센터 NOI 손익표"
        action={<SaveState state={saveState} />}
      >
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
                <th className="sticky left-0 top-0 z-20 min-w-[250px] border-b border-r border-[#333333] bg-[#202020] px-3 py-2.5 text-left text-xs text-[#A1A1AA]">
                  구분 / 계정과목
                </th>
                {periods.map((period) => (
                  <th
                    key={period}
                    className="min-w-[135px] border-b border-[#333333] bg-[#202020] px-3 py-2.5 text-right text-xs text-[#A1A1AA]"
                  >
                    {period}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={`${row.kind}-${row.key}`}>
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
                  ) : (
                    <>
                      <th
                        className={`sticky left-0 z-10 border-b border-r border-[#333333] px-3 py-2 text-left ${row.kind === "metric" ? "bg-[#17314E] font-semibold text-[#9AD7FF]" : "bg-[#252524] text-[#D1D1D6]"}`}
                      >
                        {row.label}
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
                              className="border-b border-[#333333] bg-[#252524] px-3 py-2 text-right tabular-nums text-white"
                            >
                              {amount(aggregateAccount(row.key, period))}
                            </td>
                          );
                        const cellEntries = accountEntries(row.key, period);
                        return (
                          <td
                            key={period}
                            className="border-b border-[#333333] bg-[#222A32] px-2 py-1"
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
                              onBlur={() => void saveCell(row.account, period)}
                              disabled={!writeEnabled}
                              className="w-full rounded-[6px] border border-transparent bg-transparent px-2 py-1.5 text-right tabular-nums text-white outline-none hover:border-[#35414E] focus:border-[#5E9EFF]"
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
  const [assetKey, setAssetKey] = useState(
    () => sessionStorage.getItem("gate6-data-platform-asset-key") || "",
  );
  const [showMaturities, setShowMaturities] = useState(false);
  const home = usePrimaryResource(DATA_PLATFORM_ACTIONS.homeRead, {
    ...(assetKey ? { asset_key: assetKey } : {}),
    as_of_date: todayKst(),
  });
  const assets = useMemo(
    () => (Array.isArray(home.data?.assets) ? home.data.assets : []),
    [home.data?.assets],
  );
  const maturities = usePrimaryResource(
    DATA_PLATFORM_ACTIONS.maturitiesRead,
    {
      asset_key: assetKey,
      from_date: todayKst(),
      to_date: addDays(todayKst(), 365),
    },
    { enabled: Boolean(assetKey) },
  );
  const maturityRows = normalizeMaturities(maturities.data);
  useEffect(() => {
    if (!assetKey && assets.length) setAssetKey(assets[0].asset_key);
  }, [assetKey, assets]);
  useEffect(() => {
    if (assetKey)
      sessionStorage.setItem("gate6-data-platform-asset-key", assetKey);
  }, [assetKey]);
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
                  value={assetKey}
                  onChange={(event) => setAssetKey(event.target.value)}
                  className="rounded-[8px] border border-[#3A3A3C] bg-[#252524] px-3 py-2 text-sm text-white"
                >
                  <option value="">자산 선택</option>
                  {assets.map((asset) => (
                    <option key={asset.asset_key} value={asset.asset_key}>
                      {asset.name || asset.asset_code}
                    </option>
                  ))}
                </select>
              </label>
              <button
                data-testid="data-platform-maturity-button"
                type="button"
                onClick={() => setShowMaturities((value) => !value)}
                className="rounded-[8px] border border-[#3A3A3C] bg-[#252524] px-3 py-2 text-sm text-[#D1D1D6]"
              >
                만기 알림 {maturityRows.length}
              </button>
              {showMaturities ? (
                <section className="absolute right-0 top-full z-50 mt-2 w-[min(54rem,calc(100vw-2.5rem))] rounded-[16px] border border-[#3A3A3C] bg-[#252524] p-4 shadow-2xl">
                  <MaturityList rows={maturityRows} limit={12} />
                </section>
              ) : null}
            </div>
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-[1680px] px-8 py-6">
        {activeTab === "home" ? (
          <HomePanel
            key={`home-${assetKey}`}
            assetKey={assetKey}
            resource={home}
            maturities={maturities}
          />
        ) : null}
        {activeTab === "rent-roll" ? (
          <RentRollPanel key={`rent-${assetKey}`} assetKey={assetKey} />
        ) : null}
        {activeTab === "income-expense" ? (
          <FinancePanel
            key={`finance-${assetKey}`}
            assetKey={assetKey}
            assets={assets}
          />
        ) : null}
      </div>
    </main>
  );
}
