# DB_HISTORY full linkage readback - 2026-05-19

- Source workbook: `C:\Users\10524\Desktop\codex_realasset\Project\03_Logi_Leasing_Dashboard\★ 260414_물류센터 임대차계약 DB_취합본.xlsx`
- Source sheet: `DB_히스토리 누적`
- Applied SQL: `supabase/migrations/20260519010604_logistics_db_history_full_linkage.sql`
- Readback method: Supabase `npx supabase@2.90.0 db query --linked`.

## Scope Correction

`DB_히스토리 누적` migration is not an 아레나스양지-only fix. It is the cumulative history layer for every logistics asset where managers provided initial, prior, and current contract terms.

The migration therefore links all history rows to the normalized contract model:

- `ll_rent_history.source_sheet_row_id`
- `ll_rent_history.source_excel_visible_row`
- `ll_rent_history.floor_label`
- `ll_rent_history.detail_area_label`
- `ll_rent_history.temperature_type`
- `ll_rent_history.source_contract_lease_space_id`

## Readback Result

| Metric | Count | Result |
|---|---:|---|
| Excel `DB_히스토리 누적` source rows | 164 | read |
| Rows preserved in `ll_sheet_rows` | 164 | pass |
| Cells preserved in `ll_source_cells` | 3,382 | pass |
| Blank source cells | 497 | read |
| Non-blank source cells | 2,885 | read |
| Contract-history rows in `ll_rent_history` | 162 | pass |
| Contract-history rows mapped to source row | 162 | pass |
| Contract-history rows mapped to detailed lease-space relation | 162 | pass |
| Contract-history rows linked to contract/lease row | 162 | pass |

## Source-only Rows

Two Excel rows are intentionally not inserted into `ll_rent_history` because they contain asset-level placeholders but no tenant, area, date, rent, management fee, or per-pyeong values.

| Sheet row id | Excel visible row | Asset | Reason |
|---|---:|---|---|
| `sheet_db_history:r000143` | 156 | 부산송정물류센터 | `review_status=missing`, `review_note=기준일자/임대면적/코드 누락` |
| `sheet_db_history:r000162` | 175 | 아레나스안성 | `review_status=missing`, `review_note=기준일자/임대면적/코드 누락` |

These rows remain preserved in `ll_sheet_rows`/`ll_source_cells` and should be shown as Data Quality source-only findings, not as active rent-history rows.

## Asset-level Unlinked Check

Per-asset unlinked readback found no unlinked rows among contract-history rows. The only source-only placeholder row remains `asset_a112505001` because the Excel source has no tenant/area/date/amount on that row.

## Status

- Full `DB_히스토리 누적` migration: pass for contract-history rows.
- Source-only placeholder preservation: pass.
- Remaining UX work: Data Quality should surface the two source-only placeholder rows as editable/source-completion items.
