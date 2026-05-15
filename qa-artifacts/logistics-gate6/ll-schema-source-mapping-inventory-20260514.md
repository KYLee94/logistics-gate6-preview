# ll schema/source mapping inventory - 2026-05-14

## Scope

- Purpose: Gate 6 entry review for data structure cleanup and source reconciliation.
- DB mutation: `0`
- DDL/migration apply: `0`
- Source of truth:
  - `★ 260414_물류센터 임대차계약 DB_취합본.xlsx`
  - `260513_담당자별 권한 부여_수식 제거.xlsx`
  - live Google Sheets 17-tab export evidence
- Output files:
  - `source-excel-structure-20260514.csv`
  - `source-excel-headers-20260514.csv`
  - `gate6-user-requirements-addendum-20260514.md`

## Source workbook structure

| file | sheet | rows | columns | cells | non-empty | formulas | note |
|---|---|---:|---:|---:|---:|---:|---|
| `260513_담당자별 권한 부여_수식 제거.xlsx` | `Sheet1` | 56 | 13 | 728 | 536 | 0 | permission source |
| `★ 260414_물류센터 임대차계약 DB_취합본.xlsx` | `Meta_데이터 항목 설명` | 79 | 44 | 3,476 | 385 | 6 | field dictionary |
| `★ 260414_물류센터 임대차계약 DB_취합본.xlsx` | `DB_일반` | 74 | 84 | 6,216 | 4,909 | 763 | main lease/asset table; multi-row header |
| `★ 260414_물류센터 임대차계약 DB_취합본.xlsx` | `DB_히스토리 누적` | 178 | 19 | 3,382 | 2,885 | 172 | rent history source |
| `★ 260414_물류센터 임대차계약 DB_취합본.xlsx` | `Log` | 37 | 14 | 518 | 321 | 0 | check/audit note source |
| `★ 260414_물류센터 임대차계약 DB_취합본.xlsx` | `자산_담당자 연결` | 20 | 8 | 160 | 127 | 0 | asset-manager source |

## Live Sheets structure to preserve later

The local live Sheets parsed export has 17 tabs and 181,470 used-range cells. This is larger than the xlsx source because the live workbook contains operational/system tabs.

| live sheet group | examples | decision |
|---|---|---|
| source data | `DB_일반`, `DB_히스토리 누적`, `DB_기업`, `DB_자산`, `이슈 리스트` | source/audit required |
| calculation/system | `DB_계산`, `SYS_설정`, `SYS_코드`, `SYS_기업명정규화`, `SYS_자산조회키` | preserve in `ll_source_cells`; normalized use after review |
| logs/audit | `LOG_검증`, `LOG_API`, `LOG_계산`, `AUDIT_데이터이상`, `AuditLog` | audit required |
| metadata | `meta_DB_일반` | field dictionary/audit required |

## Current Supabase ll_* tables

| table | rows | role | classification | Gate 6 decision |
|---|---:|---|---|---|
| `ll_import_runs` | 2 | import/run audit | operational audit | keep |
| `ll_sheet_rows` | 347 | row-level source preservation | source preservation | keep, but not enough for cell-level proof |
| `ll_source_cells` | 13,752 | cell-level source preservation | source preservation | keep; append live 17-tab only after approval |
| `ll_assets` | 17 | asset master normalized from source | normalized required | keep |
| `ll_tenants` | 36 | tenant/company normalized from source/API | normalized required | keep |
| `ll_leases` | 45 | lease contract normalized table | normalized required | keep |
| `ll_lease_spaces` | 59 | leased area/unit normalized table | normalized required | keep |
| `ll_rent_history` | 163 | rent/management fee history | normalized required | keep; reconcile latest mismatch |
| `ll_asset_managers` | 17 | asset-manager mapping | permission/workflow required | keep |
| `ll_issues` | 42 | weekly/issues source | workflow required | keep |
| `ll_payload_snapshots` | 107 | dashboard payload cache | derived cache | keep until parity source migration is finished |
| `ll_data_quality_findings` | 47 | data QA findings | operational audit | keep |

## Column classification rules

| class | meaning | examples | cleanup rule |
|---|---|---|---|
| `source_preservation_required` | needed to prove original cell/row values | `raw_value_text`, `display_value_text`, `formula_text`, `cell_hash`, `row_values_json` | never drop before final data audit |
| `normalized_required` | required for dashboard filters/KPI/table/popup/chart/map | `asset_name`, `tenant_master_name`, `monthly_rent_total`, `effective_date`, `leased_area_sqm` | keep |
| `permission_required` | required for user/asset/fund access control | `manager_email`, permission workbook columns, future `ll_user_permissions` | keep |
| `operational_audit_required` | required for approval, review, traceability | `review_status`, `review_note`, `source_sheet_row_id`, `source_payload`, timestamps | keep unless replacement exists |
| `api_enrichment_required` | required for Naver map/OpenDART/building-register enrichment | `latitude`, `longitude`, `dart_corp_code`, address fields | keep if used by UI/API |
| `derived_cache_review` | generated for performance or Apps Script parity | `ll_payload_snapshots.payload` | keep until local/live dashboard no longer depends on it |
| `delete_candidate_later` | duplicate or unused after source/parity/API scan | none confirmed yet | do not drop until usage scan and rollback plan exist |

## Initial table-level cleanup decision

No `ll_*` table is safe to delete immediately.

Reasons:

- `ll_source_cells`, `ll_sheet_rows`, `ll_import_runs` are audit foundations.
- `ll_payload_snapshots` is still needed as current screen parity source.
- normalized tables are needed for dashboard filters and later Data Quality editing.
- workflow/security tables planned for Gate 6 are not applied yet, so they cannot replace current tables.

## User requirements carried into Gate 6

These are not optional UI polish items; they change data/API design:

1. Data Quality must allow Excel-like editing and DB writeback through permissioned server paths.
2. Weekly upload must allow all year/month/week selections, including visible week date ranges.
3. Weekly dashboard must summarize issue/status/plan, not dump all raw project columns.
4. All tables must be column-width optimized; first columns must not waste width.

## Gate 6 entry recommendation

Gate 6 can start, but the first Gate 6 module must be `Data structure and source reconciliation`, not arbitrary UI work.

Required first module:

1. Build full source-to-Supabase field map using `Meta_데이터 항목 설명`, `DB_일반`, `DB_히스토리 누적`, permission workbook, and live 17-tab export.
2. Produce `required / derived / audit / delete_candidate` field register.
3. Run read-only mismatch sampling by table before any DB write.
4. Prepare migration preview for confirmed cleanup only.
5. Apply DB changes only after preview review and readback plan.

## Important mapping caveat

`DB_일반` is not a simple single-header table. The automatic header guess only found sparse group labels such as `값복사 - 이 값 사용 예정`, `수식 - 이 값 안 사용`, `체크`, and a long tenant-spec instruction block.

Therefore Gate 6 data mapping must not depend on the first detected header row alone. It must use:

1. `Meta_데이터 항목 설명` as the field dictionary,
2. actual populated columns from `DB_일반`,
3. existing `ll_source_cells` cell coordinates and hashes,
4. dashboard component field usage,
5. normalized table source payload lineage.

Until this mapping is complete, no source column or normalized column should be dropped.
