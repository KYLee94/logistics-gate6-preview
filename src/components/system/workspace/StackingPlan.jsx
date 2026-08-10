import React, { useState } from "react";
import {
  normalizeStackingFloorLabel,
  normalizeStackingFloorLabelFromRow,
} from "./stackingFloorNormalizer";
import { hoverDetailVisibility } from "./hoverDetailInteraction";

function firstDefined(...values) {
  return values.find((value) => value !== undefined && value !== null && value !== "");
}

function humanTenantName(...values) {
  return String(firstDefined(...values, "") || "").trim();
}

function cleanText(value, fallback = "") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function floorSortValue(label) {
  const value = String(label || "").trim().toUpperCase();
  const basement = value.match(/^B\s*(\d+)/u);
  if (basement) return -Number(basement[1]);
  const numeric = value.match(/-?\d+(?:\.\d+)?/u);
  return numeric ? Number(numeric[0]) : -999;
}

function formatArea(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return "면적 미입력";
  return `${new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 0 }).format(numeric * 0.3025)}평`;
}

function formatAreaDetail(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return "미입력";
  const formatter = new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 0 });
  return `${formatter.format(numeric)}㎡ · ${formatter.format(numeric * 0.3025)}평`;
}

function formatCurrency(value) {
  if (value === "" || value === null || value === undefined) return "미입력";
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "미입력";
  return `${new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 0 }).format(numeric)}원`;
}

function StackingPlanTenant({ floor, tenant, index, onTenantClick }) {
  const [tooltipVisible, setTooltipVisible] = useState(false);
  const updateTooltip = (eventType) => {
    setTooltipVisible((current) => hoverDetailVisibility(current, eventType));
  };
  const openTooltip = () => updateTooltip("pointer-enter");
  const closeTooltip = () => updateTooltip("pointer-leave");
  const handleFocus = (event) => {
    if (event.currentTarget.matches(":focus-visible")) updateTooltip("keyboard-focus");
  };
  const handleBlur = () => updateTooltip("blur");
  const handleClick = () => {
    updateTooltip("click");
    onTenantClick?.(tenant);
  };
  const tooltipId = `stacking-plan-${String(floor.floorLabel || "floor").replace(/[^a-zA-Z0-9가-힣_-]/gu, "-")}-${index}`;
  const monthlyRent = firstDefined(tenant.monthlyRentTotal, tenant.monthly_rent_total_krw);
  const monthlyCam = firstDefined(tenant.monthlyCamTotal, tenant.monthly_cam_total_krw);
  const monthlyTotal = firstDefined(
    tenant.monthlyCostTotal,
    Number(monthlyRent || 0) + Number(monthlyCam || 0),
  );
  const detailRows = [
    ["임차인", tenant.tenantMasterName || "임차인 미입력"],
    ["층·구역", [tenant.sourceFloorLabel || floor.floorLabel, tenant.detailAreaLabel].filter(Boolean).join(" · ") || "미입력"],
    ["임대면적", formatAreaDetail(tenant.leasedAreaSqm)],
    ["월 임대료", formatCurrency(monthlyRent)],
    ["월 관리비", formatCurrency(monthlyCam)],
    ["월 합계", formatCurrency(monthlyTotal)],
  ];
  const content = (
    <>
      <span className="block min-w-0 overflow-hidden">
        <span className="block truncate font-semibold">{tenant.tenantMasterName || "임차인 미입력"}</span>
        <span className="block truncate text-[#B8DFFF]">
          {[tenant.detailAreaLabel, formatArea(tenant.leasedAreaSqm)].filter(Boolean).join(" · ")}
        </span>
      </span>
      <span
        id={tooltipId}
        role="tooltip"
        data-testid="stacking-plan-tooltip"
        aria-hidden={!tooltipVisible}
        className={`pointer-events-none absolute bottom-[calc(100%+8px)] left-1/2 z-40 w-64 -translate-x-1/2 rounded-[10px] border border-[#4A4A4D] bg-[#111111] p-3 text-left shadow-2xl transition-opacity ${tooltipVisible ? "visible opacity-100" : "invisible opacity-0"}`}
      >
        <span className="mb-2 block text-[11px] font-semibold text-white">임대 운영 세부정보</span>
        <span className="grid grid-cols-[72px_minmax(0,1fr)] gap-x-3 gap-y-1.5">
          {detailRows.map(([label, value]) => (
            <React.Fragment key={label}>
              <span className="text-[10px] text-[#86868B]">{label}</span>
              <span className="truncate text-right text-[11px] text-[#D1D1D6] tabular-nums" title={String(value)}>{value}</span>
            </React.Fragment>
          ))}
        </span>
      </span>
    </>
  );
  const sharedProps = {
    "data-testid": "stacking-plan-tenant",
    "aria-describedby": tooltipId,
    onPointerEnter: openTooltip,
    onPointerLeave: closeTooltip,
    onFocus: handleFocus,
    onBlur: handleBlur,
    className: "group/tenant relative min-w-0 border-r border-[#252524] bg-[#263A45] px-3 py-2 text-left text-[12px] text-white first:rounded-l-[7px] last:rounded-r-[7px] last:border-r-0",
    style: {
      flexGrow: Math.max(1, Number(tenant.share || 0.08) * 100),
      flexShrink: 1,
      flexBasis: 0,
    },
  };
  return onTenantClick ? (
    <button
      {...sharedProps}
      type="button"
      onClick={handleClick}
      className={`${sharedProps.className} hover:bg-[#315268] focus:outline-none focus:ring-2 focus:ring-[#9AD7FF]`}
    >
      {content}
    </button>
  ) : (
    <div {...sharedProps} role="group" tabIndex={0}>{content}</div>
  );
}

export function buildStackingFloorsFromRows(rows = [], fallbackFloors = []) {
  const grouped = new Map();
  const expansionGroups = new Map();
  (rows || []).forEach((row, rowIndex) => {
    const floorLabels = normalizeStackingFloorLabelFromRow(row, { expandRanges: true });
    if (!floorLabels.length) return;
    const leasedAreaSqm = Number(firstDefined(row.leasedAreaSqm, row.leased_area_sqm, 0) || 0);
    const tenantDisplayName = humanTenantName(
      row.tenantMasterName,
      row.tenant_name,
      row.tenantName,
      row.companyName,
    );
    const leaseSpaceId = firstDefined(row.leaseSpaceId, row.lease_space_id, row.space_key, row.row_key);
    const sourceFloorLabel = firstDefined(
      row.sourceFloorLabel,
      row.source_floor_label,
      row.floorLabel,
      row.floor_label,
      floorLabels.join(","),
    );
    const leaseKey = leaseSpaceId ? String(leaseSpaceId) : `row-${rowIndex}`;
    const sourceFloorKey = String(sourceFloorLabel || "").replace(/\s+/gu, "").toUpperCase();
    const tenantKey = String(tenantDisplayName || "미입력").toUpperCase();
    const expansionKey = `${leaseKey}|${sourceFloorKey}|${tenantKey}`;
    if (!expansionGroups.has(expansionKey)) {
      expansionGroups.set(expansionKey, {
        row,
        floorLabels,
        sourceFloorLabel,
        tenantDisplayName: tenantDisplayName || "임차인 미입력",
        totalLeasedAreaSqm: 0,
      });
    }
    const expansionGroup = expansionGroups.get(expansionKey);
    expansionGroup.totalLeasedAreaSqm += Number.isFinite(leasedAreaSqm) ? leasedAreaSqm : 0;
  });
  expansionGroups.forEach((expansionGroup) => {
    const leasedAreaSqm = expansionGroup.totalLeasedAreaSqm / expansionGroup.floorLabels.length;
    expansionGroup.floorLabels.forEach((floorLabel) => {
      const key = floorLabel.toUpperCase();
      if (!grouped.has(key)) grouped.set(key, { floorLabel, totalLeasedAreaSqm: 0, tenants: [] });
      const group = grouped.get(key);
      group.totalLeasedAreaSqm += leasedAreaSqm;
      group.tenants.push({
        ...expansionGroup.row,
        floorLabel,
        sourceFloorLabel: expansionGroup.sourceFloorLabel,
        tenantMasterName: expansionGroup.tenantDisplayName,
        detailAreaLabel: cleanText(firstDefined(expansionGroup.row.detailAreaLabel, expansionGroup.row.zone_label)),
        leasedAreaSqm,
        monthlyCostTotal: firstDefined(
          expansionGroup.row.monthlyCostTotal,
          expansionGroup.row.monthlyCombinedTotal,
          expansionGroup.row.currentMonthlyCostTotal,
          Number(expansionGroup.row.monthly_rent_total_krw || 0) + Number(expansionGroup.row.monthly_cam_total_krw || 0),
        ),
      });
    });
  });
  if (grouped.size) {
    return [...grouped.values()].map((floor) => ({
      ...floor,
      tenants: floor.tenants.map((tenant) => ({
        ...tenant,
        share: floor.totalLeasedAreaSqm > 0
          ? Number(tenant.leasedAreaSqm || 0) / floor.totalLeasedAreaSqm
          : 1 / floor.tenants.length,
      })),
    }));
  }
  return (fallbackFloors || []).map((floor) => {
    const floorLabel = normalizeStackingFloorLabel(floor.floorLabel);
    if (!floorLabel) return null;
    const floorArea = Number(firstDefined(floor.leasedAreaSqm, floor.totalFloorAreaSqm, 0) || 0);
    const tenants = (floor.tenants || []).map((tenant, index, tenantRows) => (
      typeof tenant === "string"
        ? {
            tenantMasterName: tenant,
            leasedAreaSqm: floorArea,
            monthlyCostTotal: floor.monthlyCostTotal,
            share: tenantRows.length ? 1 / tenantRows.length : 1,
          }
        : {
            ...tenant,
            tenantMasterName: humanTenantName(tenant.tenantMasterName, tenant.tenantName, tenant.companyName) || "임차인 미입력",
            leasedAreaSqm: firstDefined(tenant.leasedAreaSqm, floorArea),
            monthlyCostTotal: firstDefined(tenant.monthlyCostTotal, floor.monthlyCostTotal),
            share: firstDefined(tenant.share, tenantRows.length ? 1 / tenantRows.length : 1),
          }
    ));
    return { ...floor, floorLabel, tenants };
  }).filter(Boolean);
}

export function StackingPlan({ floors, onTenantClick }) {
  const rows = (floors || []).slice().sort(
    (left, right) => floorSortValue(right.floorLabel) - floorSortValue(left.floorLabel),
  );
  if (!rows.length) return <div className="text-[13px] text-[#86868B]">층별 배치 정보가 없습니다.</div>;
  return (
    <div data-testid="stacking-plan-layout" className="min-w-0 max-w-full space-y-2 overflow-visible">
      {rows.map((floor) => (
        <div key={floor.floorLabel} className="grid w-full min-w-0 grid-cols-[52px_minmax(0,1fr)] items-stretch gap-3">
          <div
            className="flex items-center justify-center rounded-[8px] border border-[#333333] bg-[#1F1F1E] text-[13px] font-semibold text-white"
            data-stacking-floor-label={floor.floorLabel}
          >
            {floor.floorLabel}
          </div>
          <div
            data-testid="stacking-plan-track"
            className="flex min-h-[38px] w-full min-w-0 max-w-full overflow-visible rounded-[8px] border border-[#333333] bg-[#191918]"
          >
            {(floor.tenants || []).map((tenant, index) => (
              <StackingPlanTenant
                key={`${tenant.tenantId || tenant.row_key || tenant.tenantMasterName}-${index}`}
                floor={floor}
                tenant={tenant}
                index={index}
                onTenantClick={onTenantClick}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
