# Supabase Cell Readback MCP - 2026-05-14

## Scope

- Project: `qvegpozwrcmspdvjokiz`
- Query mode: Supabase MCP `SELECT` only
- Mutation performed: `false`
- Tables read: `public.ll_source_cells`, `public.ll_sheet_rows`, `public.ll_import_runs`, `public.ll_data_quality_findings`, `public.ll_payload_snapshots`, `public.ll_rent_history`, `public.ll_tenants`

## Row Counts

| table | rows |
|---|---:|
| ll_data_quality_findings | 47 |
| ll_import_runs | 2 |
| ll_payload_snapshots | 107 |
| ll_rent_history | 163 |
| ll_sheet_rows | 347 |
| ll_source_cells | 13,752 |
| ll_tenants | 36 |

## ll_source_cells Coverage

| source_type | source_name | sheet | cells | non-empty | formulas | range |
|---|---|---|---:|---:|---:|---|
| xlsx | ★ 260414_물류센터 임대차계약 DB_취합본.xlsx | DB_일반 | 6,216 | 4,909 | 763 | R1:R74 / C1:C84 |
| xlsx | ★ 260414_물류센터 임대차계약 DB_취합본.xlsx | DB_히스토리 누적 | 3,382 | 2,885 | 172 | R1:R178 / C1:C19 |
| xlsx | ★ 260414_물류센터 임대차계약 DB_취합본.xlsx | Log | 518 | 321 | 0 | R1:R37 / C1:C14 |
| xlsx | ★ 260414_물류센터 임대차계약 DB_취합본.xlsx | Meta_데이터 항목 설명 | 3,476 | 385 | 6 | R1:R79 / C1:C44 |
| xlsx | ★ 260414_물류센터 임대차계약 DB_취합본.xlsx | 자산_담당자 연결 | 160 | 127 | 0 | R1:R20 / C1:C8 |

## ll_sheet_rows Coverage

| source_type | source_name | sheet | rows |
|---|---|---|---:|
| live_google_sheets | IGIS_Logistics_Leasing_Data | DB_기업 | 30 |
| live_google_sheets | IGIS_Logistics_Leasing_Data | DB_일반 | 94 |
| live_google_sheets | IGIS_Logistics_Leasing_Data | DB_자산 | 17 |
| live_google_sheets | IGIS_Logistics_Leasing_Data | DB_히스토리 누적 | 164 |
| live_google_sheets | IGIS_Logistics_Leasing_Data | 이슈 리스트 | 42 |

## Rent History Nulls

| field | null rows |
|---|---:|
| monthly_rent_total | 1 |
| monthly_mf_total | 34 |
| rent_per_py | 1 |
| mf_per_py | 34 |

Latest rows:
- latest rows: 44
- latest monthly rent sum: 9,625,568,269
- latest monthly MF sum: 444,546,755
- latest monthly total sum: 10,070,115,024

## Payload Snapshots

| page | rows | source | latest_created_at |
|---|---:|---|---|
| asset | 34 | supabase_snapshot | 2026-05-11T09:55:29.433333+00:00 |
| bootstrap | 2 | supabase_snapshot | 2026-05-11T09:55:28.112792+00:00 |
| company | 61 | supabase_snapshot | 2026-05-11T09:55:30.179222+00:00 |
| home | 2 | supabase_snapshot | 2026-05-11T09:55:28.458424+00:00 |
| playground | 2 | supabase_snapshot | 2026-05-11T09:55:28.792795+00:00 |
| sector | 2 | supabase_snapshot | 2026-05-11T09:55:28.458424+00:00 |
| tools | 2 | supabase_snapshot | 2026-05-11T09:55:28.673696+00:00 |
| weekly | 2 | supabase_snapshot | 2026-05-11T09:55:28.112792+00:00 |

## Finding Summary

| severity | finding_type | status | rows |
|---|---|---|---:|
| high | remaining_null_after_excel_backfill | open | 2 |
| info | null_readback | resolved | 1 |
| info | source_sheet_coverage | open | 2 |
| low | remaining_null_after_excel_backfill | open | 8 |
| medium | null_readback | open | 15 |
| medium | remaining_null_after_excel_backfill | open | 10 |
| warning | home_snapshot_value_diff | review_required | 3 |
| warning | source_sheet_coverage | open | 6 |

## Gate Judgment

- xlsx cell-level preservation: `pass` for the 5 sheets currently loaded into `ll_source_cells`.
- live Google Sheets 17-tab cell-level preservation: `blocked`. `ll_sheet_rows` has only 5 live sheets and `ll_source_cells` has no `live_google_sheets` cell-level rows.
- dashboard snapshot source: `pass_with_notes`. All pages use `source='supabase_snapshot'`, but latest snapshot timestamp is 2026-05-11 and data quality findings remain open.
- normalized rent history: `blocked`. Latest normalized sum is lower than Home KPI and null/review rows remain.
