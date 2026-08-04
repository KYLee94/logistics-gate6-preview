# `public.ll_*` 전수조사·old-to-new mapping manifest

작성 기준일: 2026-08-04
현재 판정: **R1 PARTIAL — 27개 table 분류 완료, critical exception 미해소**

## 조사 기준

- 동일 dump snapshot의 복원 DB `gate6_app_restore_r0_final3`을 구조·행 수·내용 hash의 기준으로 사용합니다.
- 운영 화면·API 코드 사용처는 archive main `c3e3f51adf5deb324f38d76da3a331f63dd37c87` 기준으로 조사합니다.
- `archive`, `호환 유지`, `신규 미이관`은 삭제를 뜻하지 않습니다.
- 값의 의미가 충돌하면 최신값을 임의 선택하지 않고 아래 critical exception으로 남깁니다.
- 임대차·대출의 공식 이관 원천은 이 snapshot의 `public.ll_*` 저장값입니다. Excel은 historical provenance 또는 UI reference이며 운영값을 덮어쓰지 않습니다.

## 27개 table disposition

| source table | 행 | 코드 사용 | 신규 disposition | target 또는 보존 위치 |
|---|---:|---:|---|---|
| `ll_asset_operating_costs` | 0 | 5 | backfill 0건·신규 웹 최초입력 | 초기 0행을 정상으로 보존하고 actual 수익·비용·수납은 권한 있는 사용자의 `manual_input`으로 `monthly_ledger_entries`에 생성 |
| `ll_asset_spec_files` | 23 | 7 | 보존·1단계 미이관 | 기존 Storage/호환 화면 |
| `ll_asset_specs` | 3 | 4 | 보존·선별 승격 | 기존 `public.ll_*`; 승인된 3탭 필수값만 `assets`로 mapping |
| `ll_assets` | 19 | 46 | 정규화 이관 | `assets`; 중복 펀드 필드는 provenance로 보존 |
| `ll_cache_entries` | 1,354 | 7 | 신규 미이관 | legacy cache/archive |
| `ll_edit_requests` | 21 | 13 | 이력 보존 | `audit_events` provenance 또는 legacy archive |
| `ll_fund_asset_links` | 19 | 11 | 정규화 이관 | `fund_asset_links` |
| `ll_fund_capital_tranches` | 119 | 11 | 유형별 분리 이관 | 수익증권 60건 → `fund_beneficiary_tranches`; 대출성 59건(active 51건) → `loans`·`lenders`·`loan_lenders`. 약정·인출·만기·금리 값 55건 보존 |
| `ll_funds` | 17 | 16 | 정규화 이관 | `funds`·`maturities` |
| `ll_lease_attributes` | 2,436 | 13 | 전 key 분류 후 이관 | `lease_contracts`·`spaces`·`contract_spaces`·`rent_terms` 승인 필드; 미분류 key 0 필수 |
| `ll_lease_spaces` | 81 | 37 | 정규화 이관 | `spaces`·`contract_spaces` |
| `ll_leases` | 46 | 27 | 정규화 이관 | `lease_contracts`·`maturities` |
| `ll_login_events` | 20 | 4 | 보존·신규 미이관 | legacy audit archive |
| `ll_news_items` | 433 | 13 | 신규 미이관 | legacy/archive |
| `ll_notification_subscriptions` | 3 | 7 | legacy 호환 유지 | 기존 browser push 구독만 보존하며 신규 인앱 만기 알림으로 변환하지 않음 |
| `ll_notifications` | 90 | 19 | legacy 알림 이력 보존 | 신규 인앱 만기 알림의 canonical 원천으로 사용하거나 delivery table로 이관하지 않음 |
| `ll_rent_history` | 164 | 27 | 정규화 이관 | `rent_terms`·`rent_term_history`·formula provenance |
| `ll_sector_market_cap_rate_series` | 84 | 6 | 신규 미이관 | legacy market/archive |
| `ll_sector_market_lease_observations` | 9,610 | 5 | 신규 미이관 | legacy market/archive |
| `ll_sector_market_supply_cases` | 276 | 4 | 신규 미이관 | legacy market/archive |
| `ll_sector_market_transaction_cases` | 541 | 4 | 신규 미이관 | legacy market/archive |
| `ll_source_files` | 1 | 18 | 원본 계보 보존 | `migration_runs`의 source artifact 참조·비공개 archive |
| `ll_source_rows` | 11,738 | 20 | 원본 계보 보존 | `migration_row_mappings`의 source sheet·row·hash 참조 |
| `ll_staff_profiles` | 38 | 5 | 최소 표시 참조·호환 유지 | 기존 `public.ll_staff_profiles` 또는 승인된 사용자 표시 profile; 권한 원장으로 사용 금지 |
| `ll_tenants` | 36 | 24 | 정규화 이관 | `tenants` |
| `ll_user_permissions` | 263 | 27 | reconciliation 후 이관 | `user_permission_profiles`·`user_asset_assignments`; 기존 권한 자동 회수 금지 |
| `ll_work_items` | 77 | 20 | 신규 미이관 | legacy 업무보드/archive |

합계는 27개 table·27,512행이며 `unclassified table = 0`입니다. 다만 table 수준 분류 완료는 필드 의미 승인이나 R1 통과를 뜻하지 않습니다.

## 핵심 필드군 mapping

| 업무 묶음 | 기존 원천 | 신규 필드군 | 현재 상태 |
|---|---|---|---|
| 자산·홈 핵심값 | `ll_assets`, `ll_asset_specs`, `ll_source_rows` | `assets`, `maturities`; specs 원본은 legacy 보존 | 자산 19건 중 review 상태 및 마지막 정상 화면값 확인 필요 |
| 펀드·자산 연결 | `ll_funds`, `ll_fund_asset_links` | `funds`, `fund_asset_links`, `maturities` | 구조 확인, source payload와 직접 열 우선순위 승인 필요 |
| 수익증권·대출 | `ll_fund_capital_tranches` | `fund_beneficiary_tranches`, `loans`, `lenders`, `loan_lenders` | 운영 Supabase 119건 중 loan 59건(active 51건), 약정·인출·만기·금리 55건을 공식 원천으로 확정. 월별 상환 schedule은 없음 |
| 임차인 | `ll_tenants` | `tenants` | 사업자번호 누락·review 상태 reconciliation 필요 |
| 계약·공간 | 운영 `ll_leases`, `ll_lease_spaces`, `ll_lease_attributes` | `lease_contracts`, `spaces`, `contract_spaces`, `rent_terms` 승인 필드 | 운영 Supabase 저장값이 공식 원천. dynamic attribute key 전수 분류와 오류 상태 보존 필요 |
| 임대료 | 운영 `ll_rent_history`, 계약·공간 원천 | `rent_terms`, formula input/provenance | 운영 Supabase 저장값을 이관하고 review 88건의 상태와 일할·반올림·인상·렌트프리 fixture를 보존·승인 |
| 월별 actual 수익·비용·수납 | 초기 운영 행 없음, 신규 웹 입력 | `cashflow_accounts`, `monthly_ledger_entries` | 초기 0행이 정상. `manual_input` provenance·권한·계정·발생/현금·readback 계약 승인 필요 |
| 권한 | `ll_staff_profiles`, `ll_user_permissions`, `auth.users` | 표시용 직원 참조, `user_permission_profiles`, `user_asset_assignments` | profile형 39행과 사용자별 224행의 이중 표현 조정 필요 |
| 만기·인앱 알림 | 펀드·대출·임대차 공식 날짜 | `maturities`, `maturity_asset_scopes`, `maturity_schedules` | 로그인 사용자의 읽기 권한으로 조회. 기존 notifications와 외부 delivery 이관 없음 |

## 데이터 품질 관찰값

- `ll_assets`: `ok` 15, `review_required` 1, `정상` 3
- `ll_funds`: `ok` 17
- `ll_leases`: `suspected_error` 40, `missing` 3, `backfilled` 1, `source_repaired` 1, `vacancy_placeholder` 1
- `ll_lease_spaces`: `linked` 46, `excel_db_history_latest_split` 21, `superseded` 8, 그 외 오류·누락·placeholder 6
- `ll_rent_history`: `ok` 70, `review_required` 88, `corrected` 3, 나머지 오류·누락·backfill 3
- `ll_tenants`: `ok` 21, `review_required` 12, `suspected_error` 2, `missing` 1
- 권한은 staff/profile 표현 39행과 사용자별 scope 표현 224행이 함께 존재합니다. 복원 parity는 통과했지만 어느 표현이 현재 업무 진실인지 자동 선택하지 않습니다.

## R1 critical exceptions

| ID | 차단 내용 | 통과 조건 |
|---|---|---|
| MAP-C01 | 운영 Supabase 임대차 field와 canonical field 연결 미완료 | `public.ll_*` snapshot·table·PK·field·hash와 target field 전건 기록. Excel은 provenance/UI reference로만 분류 |
| MAP-C02 | 자산 review 상태와 홈 표시값 불일치 가능성 | 자산 19건의 화면·API·source 우선순위 승인 |
| MAP-C03 | 계약 40건 suspected error·3건 missing | 계약별 승인·제외·보정 상태 확정 |
| MAP-C04 | 임대료 88건 review 및 오류 상태 | 기간·금액·인상·렌트프리 fixture와 승인 결과 확정 |
| MAP-C05 | 임차인 사업자번호·식별자 불완전 | 동일 법인 판정키와 중복 merge 규칙 승인 |
| MAP-C06 | 권한의 profile형·사용자별 이중 표현 | Auth UID·직원·자산별 8권한 truth table reconciliation 완료 |
| MAP-C07 | 월별 actual 수익·비용 초기 0행 | 웹 `manual_input` 계정표·필수값·발생/현금·감사·readback 계약 승인 |
| MAP-C08 | 현금 수납 초기 0행 | 수납은 `actual/cash`로만 입력하고 빈 값·0·NULL, 중복·취소 규칙 승인 |
| MAP-C09 | 대출 자연키·약정식·월별 상환 상태 미확정 | loan 59건(active 51건)과 약정·인출·만기·금리 55건 field mapping 승인. 월별 상환 schedule 부재는 행 생성 없이 `not_provided`로 검증 |
| MAP-C10 | 기존 화면의 마지막 정상 버전·값 미확정 | Git·QA·live 증거로 화면별 정상 기준점 확정 |

R1 합격 조건은 위 critical exception 0건입니다. 초기 finance 0행은 source 실패가 아니며 웹 최초입력 전 `not_entered`로 표시합니다. budget/forecast, 월별 대출상환, 누락 원천은 샘플·추정값으로 채우지 않고 `not_provided`로 유지합니다.
