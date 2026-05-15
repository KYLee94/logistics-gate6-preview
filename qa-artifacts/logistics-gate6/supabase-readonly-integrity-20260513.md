# Supabase read-only integrity check - 2026-05-13

범위: `qvegpozwrcmspdvjokiz` 프로젝트의 `public.ll_*` 테이블만 `SELECT`로 확인했습니다. 데이터 입력, 수정, 삭제, RLS/policy 변경, migration 적용은 하지 않았습니다.

## Row count readback

| table | row_count |
|---|---:|
| public.ll_asset_managers | 17 |
| public.ll_assets | 17 |
| public.ll_data_quality_findings | 47 |
| public.ll_import_runs | 2 |
| public.ll_issues | 42 |
| public.ll_lease_spaces | 59 |
| public.ll_leases | 45 |
| public.ll_payload_snapshots | 107 |
| public.ll_rent_history | 163 |
| public.ll_sheet_rows | 347 |
| public.ll_source_cells | 13,752 |
| public.ll_tenants | 36 |

## Source cell preservation readback

현재 `ll_source_cells`에 확인된 source는 xlsx 5개 sheet입니다.

| source_type | source_name | sheet | cells | non_empty | formulas | used_range |
|---|---|---|---:|---:|---:|---|
| xlsx | ★ 260414_물류센터 임대차계약 DB_취합본.xlsx | DB_일반 | 6,216 | 4,909 | 763 | R1:R74 / C1:C84 |
| xlsx | ★ 260414_물류센터 임대차계약 DB_취합본.xlsx | DB_히스토리 누적 | 3,382 | 2,885 | 172 | R1:R178 / C1:C19 |
| xlsx | ★ 260414_물류센터 임대차계약 DB_취합본.xlsx | Log | 518 | 321 | 0 | R1:R37 / C1:C14 |
| xlsx | ★ 260414_물류센터 임대차계약 DB_취합본.xlsx | Meta_데이터 항목 설명 | 3,476 | 385 | 6 | R1:R79 / C1:C44 |
| xlsx | ★ 260414_물류센터 임대차계약 DB_취합본.xlsx | 자산_담당자 연결 | 160 | 127 | 0 | R1:R20 / C1:C8 |

판정: xlsx 기준 cell-level 보존은 읽혔습니다. 다만 live Google Sheets 17탭 전체 cell-by-cell 보존은 이 readback에서 확인되지 않았습니다. 따라서 live Sheets 17탭 보존은 아직 `blocked`입니다.

## Sheet rows readback

`ll_sheet_rows`에는 live Google Sheets 5개 sheet가 확인됩니다.

| source_type | source_name | sheet | rows |
|---|---|---|---:|
| live_google_sheets | IGIS_Logistics_Leasing_Data | DB_기업 | 30 |
| live_google_sheets | IGIS_Logistics_Leasing_Data | DB_일반 | 94 |
| live_google_sheets | IGIS_Logistics_Leasing_Data | DB_자산 | 17 |
| live_google_sheets | IGIS_Logistics_Leasing_Data | DB_히스토리 누적 | 164 |
| live_google_sheets | IGIS_Logistics_Leasing_Data | 이슈 리스트 | 42 |

판정: row-level JSON은 일부 live sheet에서 확인됩니다. 그러나 row-level 보존은 cell-level 보존을 대체하지 못합니다.

## Rent history null readback

| field | null_count |
|---|---:|
| monthly_rent_total | 1 |
| monthly_mf_total | 34 |
| rent_per_py | 1 |
| mf_per_py | 34 |
| source_payload | 0 |

`ll_rent_history` match/review status:

| match_status | review_status | rows |
|---|---|---:|
| linked | ok | 73 |
| linked_by_unique_asset_tenant_period | review_required | 60 |
| linked_by_xlsx_cell_detail_exact | review_required | 18 |
| linked_by_xlsx_cell_floor_to_sector_exact | review_required | 1 |
| linked_by_xlsx_cell_floor_to_sector_range | review_required | 5 |
| unmatched_review_required | #VALUE! | 1 |
| unmatched_review_required | missing | 1 |
| unmatched_review_required | review_required | 4 |

판정: 값은 들어가 있지만 `review_required`와 unmatched row가 남아 있습니다. 기존 화면과 숫자 1:1 parity 전에 null 원인 분류가 필요합니다.

## Snapshot source readback

`ll_payload_snapshots`는 전부 `source='supabase_snapshot'`입니다.

| page | rows | latest_created_at |
|---|---:|---|
| asset | 34 | 2026-05-11T09:55:29Z |
| bootstrap | 2 | 2026-05-11T09:55:28Z |
| company | 61 | 2026-05-11T09:55:30Z |
| home | 2 | 2026-05-11T09:55:28Z |
| playground | 2 | 2026-05-11T09:55:28Z |
| sector | 2 | 2026-05-11T09:55:28Z |
| tools | 2 | 2026-05-11T09:55:28Z |
| weekly | 2 | 2026-05-11T09:55:28Z |

판정: GitHub JSON fallback만 보이는 상태는 아닙니다. 다만 snapshot 기준일이 2026-05-11이라 최신 Google Sheets 17탭과의 cell-level 비교는 별도 필요합니다.

## Data quality findings

`ll_data_quality_findings` 47건이 확인됐습니다. 최신 finding에는 Home KPI snapshot과 normalized ll_* 합계 불일치가 이미 남아 있습니다.

주요 finding:
- `monthly_rent_total`: snapshot 10,613,355,289 vs ll_rent_history latest sum 9,625,568,269
- `monthly_total_cost`: snapshot 11,134,228,842 vs ll_rent_history latest sum 10,070,115,024
- `leased_area_total`: snapshot 1,340,655.46 vs ll_lease_spaces sum 1,350,959.71
- `ll_lease_spaces.current_monthly_mf_total`: null 22 / 59
- `ll_lease_spaces.current_monthly_cost_total`: null 17 / 59
- `ll_lease_spaces.e_noc`: null 23 / 59

판정: 사용자가 지적한 “탭마다 월 임관리비/임대료 합계가 다름”은 실제 DB readback에서도 재검토 대상으로 확인됐습니다. 프론트에서 숫자를 임의로 맞추는 방식이 아니라 원본 계산식과 snapshot/normalized 기준을 확정해야 합니다.

## Edge Function status

Supabase Edge Function 목록 read-only 확인:

| slug | status | verify_jwt |
|---|---|---|
| logistics-admin-api | ACTIVE | false |

판정: `verify_jwt=false`는 서버 내부에서 자체 JWT 검증을 하고 있는지 별도 코드 확인이 필요합니다. 확인 전에는 보안/API gate `blocked`입니다.

## Overall status

- `xlsx` cell-level 보존: 부분 확인
- live Google Sheets 17탭 cell-level 보존: blocked
- `ll_payload_snapshots` supabase_snapshot source: 확인
- KPI/normalized 불일치: blocked
- `ll_rent_history` null/review_required: blocked
- Edge Function JWT 검증 상태: blocked

