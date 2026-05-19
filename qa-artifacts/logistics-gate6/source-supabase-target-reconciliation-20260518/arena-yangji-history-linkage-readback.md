# Arena Yangji DB_GENERAL / DB_HISTORY linkage readback - 2026-05-19

> Superseded for mutation status by `db-history-full-linkage-readback-20260519.md`. This file remains as the earlier read-only diagnosis that identified why 아레나스양지 looked disconnected before the full `DB_히스토리 누적` linkage migration was applied.

- Asset: 아레나스양지물류센터
- Asset code: `A112127001`
- Asset id: `asset_a112127001`
- Source workbook: `C:\Users\10524\Desktop\codex_realasset\Project\03_Logi_Leasing_Dashboard\★ 260414_물류센터 임대차계약 DB_취합본.xlsx`
- Mutation performed: false
- Readback method: Excel workbook read-only parse and Supabase `npx supabase@2.90.0 db query --linked`.

## Corrected Finding

The source Excel does contain 아레나스양지물류센터 data. The previous interpretation that user-visible missing rows were caused by missing source rows was wrong.

`DB_일반` and `DB_히스토리 누적` serve different purposes and must be connected:

- `DB_일반`: current contract-state rows. For 아레나스양지 it has 8 aggregate rows.
- `DB_히스토리 누적`: cumulative time-series rows. For 아레나스양지 it has 70 rows, including initial, previous, and current contract terms by floor/sector where asset owners provided the information.

## Excel Source Evidence

`DB_일반` has 8 rows:

| Excel row | Tenant | Floor | Detail | Leased area | Exclusive area |
|---:|---|---|---|---:|---:|
| 11 | CJ대한통운 | 1~10 |  | 217,453.10 | 176,761.80 |
| 12 | CJ대한통운 | B2~B1 | 1~5섹터 | 19,307.34 | 14,576.49 |
| 13 | CJ대한통운 | B2~B1 | 6섹터 | 4,017.89 | 3,059.64 |
| 14 | CJ대한통운 | B2~B1 | 7섹터 | 4,260.67 | 3,404.38 |
| 15 | CJ대한통운 | B2~B1 | 8~10섹터 | 10,990.18 | 9,489.31 |
| 16 | 용마로지스 | B2 | 11섹터 | 3,279.73 | 2,566.79 |
| 17 | 용마로지스 | B2 | 12섹터 | 3,199.39 | 2,503.91 |
| 18 | 용마로지스 | B2 | 13~14섹터 | 9,709.97 | 8,690.01 |

`DB_히스토리 누적` has 70 rows:

- CJ대한통운 `1~10`: split by actual floors 10, 9, 8, 7, 6, 5, 4, 3, 2, 1.
- CJ대한통운 `B2~B1`: split by sector groups `1~5섹터`, `6섹터`, `7섹터`, `8~10섹터`.
- 용마로지스 `B2`: split by sectors `11섹터`, `12섹터`, `13~14섹터`.
- Current and prior rows include monetary fields such as rent and management fee where provided.

Representative current rows:

| Excel source | Floor / detail | Current start | Leased area | Exclusive area | Rent | Management fee |
|---|---|---:|---:|---:|---:|---:|
| DB_히스토리 누적 row 13 | 10F / office | 2024-03-01 | 1,845.17 | 1,445.16 | 14,803,799 | 592,152 |
| DB_히스토리 누적 row 16 | 9F / N | 2024-03-01 | 42,371.86 | 35,065.08 | 339,951,879 | 13,598,075 |
| DB_히스토리 누적 rows 43-50 | B1/B2 / 1~5 sectors | mixed | source provided | source provided | source provided | source provided |
| DB_히스토리 누적 rows 53-58 | B1/B2 / 7 sector | mixed | source provided | source provided | source provided | source provided |

## Supabase Readback Evidence

`ll_rent_history` has 70 rows for `asset_a112127001`, but linkage quality is incomplete:

| Match status | Review status | Row count | Null lease_space_id |
|---|---|---:|---:|
| linked | ok | 22 | 0 |
| linked_by_unique_asset_tenant_period | review_required | 20 | 0 |
| linked_by_xlsx_cell_detail_exact | review_required | 18 | 0 |
| linked_by_xlsx_cell_floor_to_sector_range | review_required | 5 | 0 |
| linked_by_xlsx_cell_floor_to_sector_exact | review_required | 1 | 0 |
| unmatched_review_required | review_required | 4 | 4 |

The 4 null linkage rows are latest/current CJ대한통운 `1~10` floor rows dated `2024-03-01`.

## UI/Payload Issue

`src/components/system/workspace/logisticsAssetData/asset_a112127001.json` currently displays `1~10` as an artificial even split from the `DB_일반` aggregate row:

- each 1F-10F display row uses the same aggregate `leaseSpaceId`;
- each row uses roughly one tenth of the aggregate area;
- floor-specific current rent and management fee values from `DB_히스토리 누적` are not carried through consistently.

This is why 아레나스양지 can look incomplete or inconsistent even though the Excel source has data.

## Required Fix

1. Treat `DB_일반` as the current aggregate contract-state layer.
2. Treat `DB_히스토리 누적` as the cumulative floor/sector-level history layer.
3. Add first-class history fields, at minimum:
   - `floor_label`
   - `detail_area_label`
   - `temperature_type`
   - `source_row_id`
   - `source_cell_ids`
4. Connect history rows to current contract rows through either:
   - detailed child lease-space rows derived from `DB_히스토리 누적`; or
   - a relation table between `ll_lease_spaces` aggregate rows and `ll_rent_history` detailed rows.
5. Rebuild 아레나스양지 Asset tab rows, E.NOC, tenant detail popups, and AI evidence from the linked model.

## Status

- Source data existence: pass.
- Excel/Supabase read-only evidence: pass.
- Current UI/model parity: fail.
- DB mutation: not executed in this pass.
