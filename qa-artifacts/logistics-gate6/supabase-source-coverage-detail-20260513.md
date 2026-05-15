# Supabase source coverage detail - 2026-05-13

범위: `public.ll_*`만 `SELECT`로 확인했습니다. DB 변경은 없습니다.

## 핵심 판정

현재 Supabase에는 값이 들어가 있지만, 초기 계획의 “live Google Sheets 17탭 cell-by-cell 보존” 기준은 충족하지 못했습니다.

| 항목 | 현재 확인 |
|---|---|
| `ll_source_cells` | xlsx 5개 sheet, 13,752 cells |
| `ll_sheet_rows` | live Google Sheets 5개 sheet, 347 rows |
| live Google Sheets cell-level | 없음 |
| xlsx cell-level | 있음 |
| source coverage finding | 8건 open |
| Home KPI snapshot value diff | 3건 review_required |

## Import runs

| import_id | source_type | source_name | status | key counts |
|---|---|---|---|---|
| `ll_google_sheets_20260508051443` | live_google_sheets | IGIS_Logistics_Leasing_Data | prepared | source_sheets 5, source_rows 347, payload_snapshots 56 |
| `xlsx_260414_logistics_leasing_8627_830f2d25d719_20260512002930` | xlsx | ★ 260414_물류센터 임대차계약 DB_취합본.xlsx | loaded | sheet_count 5, row_count 388, cell_count 13,752, formula_cell_count 941 |

## Source coverage findings

| sheet | coverage_status | source_cells | source_rows | supabase_rows | status |
|---|---|---:|---:|---:|---|
| Log | xlsx_only_sheet | 518 | 37 | - | warning/open |
| Meta_데이터 항목 설명 | xlsx_only_sheet | 3,476 | 79 | - | warning/open |
| 자산_담당자 연결 | xlsx_only_sheet | 160 | 20 | - | warning/open |
| DB_기업 | supabase_only_sheet | - | - | 30 | warning/open |
| 이슈 리스트 | supabase_only_sheet | - | - | 42 | warning/open |
| DB_자산 | supabase_only_sheet | - | - | 17 | warning/open |
| DB_일반 | both | 6,216 | 74 | 94 | info/open |
| DB_히스토리 누적 | both | 3,382 | 178 | 164 | info/open |

## Null density

| field | null_rows / total |
|---|---:|
| ll_assets.fund_code | 1 / 17 |
| ll_leases.first_contract_date | 5 / 45 |
| ll_leases.first_start_date | 5 / 45 |
| ll_leases.first_end_date | 5 / 45 |
| ll_lease_spaces.current_monthly_mf_total | 22 / 59 |
| ll_lease_spaces.current_monthly_cost_total | 17 / 59 |
| ll_rent_history.monthly_mf_total | 34 / 163 |
| ll_rent_history.monthly_rent_total | 1 / 163 |

## Plan alignment impact

- 사용자가 말한 “이미 Supabase에 값은 들어가 있으니 다시 넣지 말고 확인” 방향은 지켰습니다.
- 확인 결과, row-level 값과 일부 snapshot은 있지만 live Sheets 17탭 cell-level 보존은 아직 증명되지 않았습니다.
- 따라서 프론트의 모든 숫자를 “정확하고 완벽”하다고 말할 수 없습니다.

