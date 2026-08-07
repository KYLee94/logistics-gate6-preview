import React from "react";
import {
  normalizeStackingFloorLabel,
  normalizeStackingFloorLabelFromRow,
} from "./stackingFloorNormalizer";

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
    <div className="space-y-2">
      {rows.map((floor) => (
        <div key={floor.floorLabel} className="grid grid-cols-[52px_1fr] items-stretch gap-3">
          <div
            className="flex items-center justify-center rounded-[8px] border border-[#333333] bg-[#1F1F1E] text-[13px] font-semibold text-white"
            data-stacking-floor-label={floor.floorLabel}
          >
            {floor.floorLabel}
          </div>
          <div className="flex min-h-[38px] overflow-hidden rounded-[8px] border border-[#333333] bg-[#191918]">
            {(floor.tenants || []).map((tenant, index) => {
              const content = (
                <>
                  <div className="truncate font-semibold">{tenant.tenantMasterName || "임차인 미입력"}</div>
                  <div className="truncate text-[#B8DFFF]">
                    {[tenant.detailAreaLabel, formatArea(tenant.leasedAreaSqm)].filter(Boolean).join(" · ")}
                  </div>
                </>
              );
              const sharedProps = {
                key: `${tenant.tenantId || tenant.row_key || tenant.tenantMasterName}-${index}`,
                className: "overflow-hidden border-r border-[#252524] bg-[#263A45] px-3 py-2 text-left text-[12px] text-white last:border-r-0",
                style: { width: `${Math.max(8, Number(tenant.share || 0.08) * 100)}%` },
                title: `${tenant.tenantMasterName || "임차인 미입력"}${tenant.detailAreaLabel ? ` · ${tenant.detailAreaLabel}` : ""} · ${formatArea(tenant.leasedAreaSqm)}`,
              };
              return onTenantClick ? (
                <button
                  {...sharedProps}
                  type="button"
                  onClick={() => onTenantClick(tenant)}
                  className={`${sharedProps.className} hover:bg-[#315268] focus:outline-none focus:ring-2 focus:ring-[#9AD7FF]`}
                >
                  {content}
                </button>
              ) : (
                <div {...sharedProps}>{content}</div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
