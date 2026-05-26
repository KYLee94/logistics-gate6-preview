# Static JSON / Hardcoding Inventory - 2026-05-26

## Scope

This inventory records residual static JSON and hardcoded fallback paths in `WorkspaceLogistics.jsx`. It does not remove fallback code. Removal must wait until browser-visible parity and permission fallback QA are closed.

## Reviewed Paths

- `src/components/system/workspace/WorkspaceLogistics.jsx`
- `src/components/system/workspace/logisticsHomeData.json`
- `src/components/system/workspace/logisticsWeeklyReportData.json`
- `src/components/system/workspace/logisticsAssetOptionsData.json`
- `src/components/system/workspace/logisticsCompanyOptionsData.json`
- `src/components/system/workspace/logisticsSectorData.json`
- `src/components/system/workspace/logisticsAssetData/*.json`
- `src/components/system/workspace/logisticsCompanyData/*.json`

## Current Runtime Pattern

The frontend uses a Supabase read bridge with mode default `primary-safe`.

- If the Edge read API succeeds and shape checks pass, the screen uses API payload.
- If the error is `401` or `403`, static fallback is blocked.
- If the failure is network, timeout, or server error, static fallback may still be used.

This is acceptable only as a temporary operational fallback.

## Residual Static Dependencies

### Dashboard Home

- Static imports still exist:
  - `logisticsHomeData.json`
  - `logisticsSectorData.json`
  - generated general rows from bundled data helpers
- Supabase adapter exists:
  - `homePayloadFromDashboardRead`
  - `useDashboardReadBridge('dashboard/home/read', ...)`
- Risk:
  - if fallback is triggered, stale JSON can be displayed.
  - sector/weekly helper data may still override or enrich runtime values.

### Asset

- Static imports still exist:
  - `logisticsAssetOptionsData.json`
  - `logisticsAssetData/*.json`
- Supabase adapter exists:
  - `assetPayloadFromDashboardRead`
  - `useDashboardReadBridge('dashboard/asset/read', ...)`
- Remaining fallback-specific paths:
  - fund overview default rows
  - PDF fund rows
  - stacking/floor layout fallback
- Risk:
  - fallback can hide missing API fields.
  - fund overview can show old or empty values during transient failures.

### Company

- Static imports still exist:
  - `logisticsCompanyOptionsData.json`
  - `logisticsCompanyData/*.json`
- Supabase adapter exists:
  - `companyPayloadFromDashboardRead`
  - `useDashboardReadBridge('dashboard/company/read', ...)`
- Risk:
  - stale company payload can appear during allowed fallback.
  - DART profile fields can diverge between API cache and static company payload.

### PDF Report

- PDF report still has print-safe static map fallback.
- Asset payload read bridge exists, but PDF-specific fallback remains.
- Risk:
  - PDF can differ from Asset tab during API fallback.

### Analysis / Pivot

- Both still inherit Home read bridge results and block static fallback on auth failures.
- Risk:
  - if Home falls back because of 5xx/network, Analysis/Pivot values can be stale.

## Hardcoded UI/Seed-like Items

The following are not necessarily wrong, but should be revisited after primary read QA:

- `DATA_STATUS`
- default fund info rows
- demo/fallback search and map text
- UI labels for dashboard access blocked states
- local fallback tenant/asset labels derived from ids

## Removal Policy

Do not delete static JSON until these pass:

1. Home browser-visible parity.
2. Asset browser-visible parity across representative assets.
3. Company browser-visible parity across representative tenants.
4. PDF Report parity against the selected Asset screen.
5. Analysis/Pivot parity against Home and raw Supabase evidence.
6. 401/403 fallback exposure test.

## Recommendation

Keep static JSON only as an explicit degraded-mode source. Add telemetry/audit when fallback is used, so stale data is detectable rather than silent.

## Reviewer Priority

P0:

- Replace bundled `assetOptionsData`, `companyOptionsData`, and generated general rows with server-provided selector/search datasets.
- This must happen before removing `logisticsAssetData/*.json`, because Asset, search, Data Quality, and PDF still depend on those rows as fallback/enrichment.

P1:

- Replace Asset/Company detailed static payloads with complete `dashboard/asset/read` and `dashboard/company/read` responses.
- Replace PDF/Weekly/fund fallback rows with server reads.
- Move permission UI options from `logisticsPermissionData.json` to a server read endpoint while keeping server-side permission enforcement.

P2:

- Confirm Analysis and Pivot only consume the canonical Home dataset after P0/P1.

P3:

- Remove dead Sector import/function only after confirming no route or deep link should revive it.
