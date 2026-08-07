# Gate 6 전 화면 편집·Supabase 연동 백엔드 계약표

- 기준일: 2026-08-07 KST
- 대상 API: `ll-dashboard-api`의 v2 RPC
- 원칙: 화면 제목과 서버 계산값은 직접 저장하지 않습니다. 사용자가 바꾸는 원천값은 같은 DB 트랜잭션에서 권한, revision, 감사 이력, legacy projection, commit 후 readback을 검증합니다.
- 운영 반영 상태: `20260807090000_logistics_editable_contracts_v6.sql`은 linked dry-run만 통과했으며 아직 운영 DB에는 적용하지 않았습니다.

## 1. 공통 저장 계약

| 항목 | 계약 |
|---|---|
| 인증·권한 | Edge는 사용자 JWT로 RPC를 호출하고 DB 함수가 `auth.uid()` 기반 자산 권한을 검사합니다. |
| 원자성 | 한 요청의 변경은 하나의 DB 트랜잭션으로 처리합니다. 일부만 성공하지 않습니다. |
| 중복 저장 방지 | `(사용자, action, client_request_id)`와 request hash로 같은 요청을 한 번만 반영합니다. 동일 ID에 다른 payload는 409입니다. |
| 동시 편집 | 각 자산·펀드·대출·렌트롤 구성요소·원장 행의 `expected_revision`이 현재 revision과 다르면 409입니다. |
| 삭제 | hard delete가 아니라 `deleted_at/deleted_by`를 기록하는 soft delete입니다. |
| 감사 | `logistics_core.audit_events`에 변경 전후 hash, 필드, 사유, 사용자, request ID, revision을 기록합니다. |
| 응답 | 성공만 `ok:true/status:primary`이며, 저장 후 서버 재조회가 일치해야 readback 성공을 반환합니다. |
| 실패 | 401/403/409/422/500을 stale·fallback 성공으로 포장하지 않습니다. DB unique 충돌 23505도 409 `RESOURCE_CONFLICT`로 반환합니다. |

## 2. 홈

### API

| 화면 동작 | action | payload | readback |
|---|---|---|---|
| 조회 | `v2/home/read` | `asset_key` | `asset`, `funds`, `investments`, `loans`, `occupancy_summary`, `asset_source_provenance` |
| 저장 | `v2/home/batch-save` | `operations[{entity,entity_key,field,value,expected_revision,reason}]` | `revision`, `changed_count`, `readback`, `asset_overview_readback` |

### 편집 필드와 DB

| 화면 영역 | 편집 필드 | 정규화 저장 | 구버전 호환 투영 |
|---|---|---|---|
| 자산 개요 | `name`, `address` | `logistics_core.assets.name_ko/address_ko` | `public.ll_assets.asset_name/road_address` |
| 자산 개요 | `land_area_sqm`, `gross_area_sqm`, `leasable_area_sqm`, `floor_count` | 같은 이름의 `logistics_core.assets` 컬럼 | 실제 legacy 컬럼이 있으면 컬럼과 `source_payload.data_platform_overrides`를 함께 갱신 |
| 자산 개요 | `zoning_text`, `building_area_sqm`, `primary_use`, `building_coverage_ratio`, `floor_area_ratio`, `structure_text`, `parking_count`, `completion_date` | 같은 이름의 `logistics_core.assets` 컬럼 | `public.ll_assets.source_payload.data_platform_overrides`에 필드별 deep merge |
| 펀드 | `name`, `fund_type`, `investment_strategy`, `inception_date`, `maturity_date` | `logistics_core.funds` | `public.ll_funds`의 대응 컬럼 또는 override |
| 자산-펀드 | `ownership_ratio` | `logistics_core.fund_asset_links.ownership_ratio` | 검증된 legacy 컬럼이 없어 core+audit만 사용 |
| 수익증권 | `tranche`, `beneficiary_name`, `agreed_amount_krw`, `contributed_amount_krw` | `logistics_core.fund_beneficiary_tranches` | `public.ll_fund_capital_tranches` 대응 컬럼 또는 override |
| 대출 | `tranche`, `committed_amount_krw`, `drawdown_date`, `maturity_date`, `loan_type`, `interest_type`, `coupon_rate`, `all_in_rate`, `fee_rate` | `logistics_core.loans` | 기존 `public.ll_fund_capital_tranches` 대응 컬럼 또는 override |
| 대주 | `lender_name` | `logistics_core.lenders.name_ko` | 기존 자본 tranche의 `party_name` 또는 override |

임차인 수, 공간 수, 임대면적, 월 임대료, 관리비, E.NOC와 임대율은 홈에서 별도 숫자로 저장하지 않습니다. 렌트롤 원천을 수정하면 홈 조회가 즉시 다시 계산되므로 두 탭이 서로 어긋나지 않습니다.

### 운영 데이터 원천 감사

- 활성 자산은 19개입니다. core의 `leasable_area_sqm`은 19개 모두 null이므로 이 값을 가짜로 만들어 저장하지 않습니다.
- 기존 자산 개요의 대지면적·연면적·층수는 `public.ll_assets` 19개에 있고, 사용승인일은 18개에 있습니다.
- 건축물대장 응답은 `public.ll_cache_entries(provider='building-register/summary')`에 있습니다. 주소만으로 붙이면 경비실 같은 부속동이 섞이므로 대지면적+연면적+사용승인일이 모두 맞는 10개 자산만 검증 원천으로 사용합니다.
- 홈 자산 payload의 `leasable_area_sqm`은 explicit core/override만 반환합니다. 임대율 분모는 `explicit 임대가능면적 → 검증된 연면적 → active 공간 합계` 순이며 `denominator_source`를 함께 반환합니다.
- active 홈 writer는 위 8개 건축 개요 필드 allowlist, core writer, 감사 이력을 모두 보유하고 있음을 운영 catalog에서 확인했습니다.
- 기존 `set_legacy_field`가 한 필드 저장 때 `data_platform_overrides` 전체를 덮는 결함은 v6에서 `jsonb_set(existing_overrides || new_field)` deep merge로 교체했습니다.

## 3. 렌트롤

### API

| 화면 동작 | action | payload | readback |
|---|---|---|---|
| 조회 | `v2/rent-roll/read` | `asset_key`, 선택적 limit | `rows[]`와 공간·계약·배분·임대조건 revision |
| 셀/행 저장 | `v2/rent-roll/batch-save` | `rows[{operation, keys, component revisions, 변경 필드}]` | `revision`, `changed_count`, `contract_terms_readback`, `rows_readback` |

### 편집 43개 필드

| DB 엔터티 | 화면 필드 |
|---|---|
| `logistics_core.tenants` | `tenant_name → legal_name_ko`, `business_registration_number` |
| `logistics_core.spaces` | `occupancy_status`, `temperature_type`, `goods_type`, `floor_label`, `zone_label`, `subtenant_name`, `free_area_type`, `exclusive_area_sqm`, `common_area_sqm`, `leased_area_sqm`, `display_order` |
| `logistics_core.lease_contracts` | `signed_date`, `commencement_date`, `expiry_date`, `operation_start_date`, `deposit_total_krw → deposit_amount`, `security_type`, `security_ratio`, `renewal_terms`, `termination_terms`, `restoration_terms`, `notes` |
| `logistics_core.rent_terms` | `monthly_rent_total_krw → base_monthly_rent`, `monthly_cam_total_krw → base_monthly_management_fee`, `pallet_rack_fee`, `rent_free_months`, `rent_free_start_date`, `rent_free_end_date`, `fit_out_months`, `fit_out_amount`, `tenant_improvement_amount`, 보증금·임대료·관리비의 `*_escalation_first_date`, `*_escalation_interval_months`, `*_escalation_rate`, `tenant_cost_terms`, `landlord_cost_terms`, `notes` |
| `logistics_core.lease_rent_free_periods` | 상세 팝업의 `rent_free_periods[{start_date,end_date,months,reason,notes}]`; 여러 무상기간을 서로 다른 행으로 저장 |
| `logistics_core.rent_terms` v5 | `fit_out_start_date`, `fit_out_end_date`; 월수는 날짜가 있으면 서버에서 검증된 파생값으로 유지 |

다음 12개는 화면 자동 계산값이므로 직접 저장하지 않습니다: `exclusive_area_py`, `common_area_py`, `leased_area_py`, `efficiency_ratio`, `contract_months`, `wale_years`, `deposit_per_py_krw`, `rent_per_py_krw`, `cam_per_py_krw`, `pallet_rack_fee_per_py`, `effective_rent`, `current_total_cost_per_py_krw(E.NOC)`.

E.NOC는 기존 Supabase 방식인 `(월 임대료 + 월 관리비) ÷ (임대면적㎡ × 0.3025)`로 서버와 화면에서 계산하며, core `rent_terms.e_noc`와 legacy `ll_lease_spaces.e_noc`를 같은 트랜잭션에서 갱신합니다. 보증금·임대료·관리비 인상률 입력 `0.03`, `3`, `3%`는 모두 canonical `3%` text로 저장·조회하며, 기존 fraction을 다시 100배하지 않습니다. `N`, `중도해지불가`, `기타(없음)`은 모두 `없음`으로 저장·조회합니다.

### 즉시 저장 오류 원인과 v6 수정

1. 운영 archived v1 writer가 기존 공간 조회에서 `row_record` 대신 null인 `operation`을 참조하여 기존 행을 INSERT로 오판했습니다. 그 결과 `spaces_space_key_key` 23505와 Edge 500이 발생했습니다. v6는 정확한 `row_record.space_key`로 수정하고 23505를 409로 매핑합니다.
2. 새 UI는 수정한 셀만 보내는데 기존 full-row writer는 생략 필드를 null로 덮고 `tenant_name`도 항상 요구했습니다. v6 sparse wrapper는 현재 canonical 행과 변경 셀을 병합한 뒤 기존 검증 writer에 위임합니다. 원본 sparse payload용 idempotency와 commit 후 행 존재/삭제 readback을 별도로 둡니다.
3. 화성 석포리 자산의 기존 원문 한 행은 `expiry_date='2028-06-30/2029-12-31'`이지만 정규화 `lease_contracts.expiry_date`는 null입니다. 어느 날짜도 공식값으로 임의 선택할 근거가 없습니다. v6 read는 날짜 칸을 null로 반환하고 `LEGACY_MULTIPLE_DATE_CONFLICT/status=blocked` 예외를 붙입니다. 담당자가 단일 날짜를 직접 입력하면 그때 정상 date로 저장합니다.
4. 해당 행의 다른 셀을 저장할 때는 `ll_leases/ll_lease_spaces`의 원본 lease·space key, 원천 sheet row ID, source table/PK, source row hash·번호를 저장 전후 비교합니다. 하나라도 달라지면 `LEGACY_COMPOUND_DATE_SOURCE_LOST`로 전체 트랜잭션을 rollback합니다.
5. 신규 행 commit readback은 client space key 외에 `contract_space_key`와 `rent_term_key`도 안정된 상관키로 사용합니다. 실제 server space key가 client 임시 key와 다르면 응답의 `key_mappings`에 두 키를 함께 반환합니다.
6. `기타(N)`, `기타(n)`, `기타(NO)`와 괄호 앞뒤 공백은 Edge와 SQL 모두 공백 제거·소문자 기준으로 `없음`으로 정규화합니다.

## 4. 수익·비용

### API와 저장 대상

| 동작 | payload | DB |
|---|---|---|
| 월 금액 생성·수정·삭제 | `operations[{operation,entry_key,expected_revision,record:{month,account_code,scenario,accounting_basis,amount,currency_code}}]` | `logistics_core.monthly_ledger_entries` |
| 사용자 계정 생성·수정·삭제 | `account_operations[{operation,account_code:CUSTOM:uuid,expected_revision,record:{name_ko,statement_section,parent_account_code,display_order}}]` | 자산 범위의 `logistics_core.cashflow_accounts` |
| 계정 사용 여부 | `selection_operations[{operation:'upsert',account_code,selected,expected_revision}]` | `logistics_core.finance_account_selections` |
| 조회 | `v2/finance/read` | 계정 hierarchy, 선택 여부/revision, 월 원장, 선택 계정 기준 waterfall |

- 손익 구간은 `potential_income`, `income_loss`, `operating_expense`, `below_noi`, `debt_service`입니다.
- 기본 계정과 사용자 계정 모두 자산별 선택 상태를 Supabase에 저장합니다. 체크 해제는 금액을 삭제하지 않고 계산에서만 제외합니다.
- 사용자 계정은 해당 자산에만 노출되고 사람이 입력한 한국어 이름으로 조회됩니다.
- 시나리오는 `actual|budget|forecast`, 회계 기준은 `accrual|cash`만 허용합니다. 현재 없는 예산·예측 데이터를 서버가 만들지 않습니다.
- 계정 생성→선택→월 원장 저장 순으로 한 트랜잭션에서 처리하고 `accounts_readback`, `selection_readback`, revision을 반환합니다.
- selections 테이블은 private schema, RLS, direct grant revoke, audit, soft delete, revision을 사용합니다. DDL은 `if not exists`, partial-schema preflight, unique index, trigger drop/recreate로 반복 실행 가능합니다.

## 5. 검증 결과와 배포 게이트

- 백엔드 관련 Node 계약 테스트: 31/31 통과.
- Edge Deno type check: 통과.
- linked Supabase dry-run: pending migration은 v6 한 건뿐이며 실제 DB write는 없었습니다.
- 운영 read-only audit: 19자산, active 공간 81개, occupied 80, vacant 1, planned 0을 확인했습니다.
- 운영 반영 후 필수 검증: SQL 실제 컴파일 → 홈 8개 필드 2개 연속 저장 후 override 둘 다 유지 → 기존 렌트롤 한 셀 safe write/readback → rent-free 저장/readback → finance custom 계정 생성/선택/월 금액 저장/readback → 동일 request 재시도 동일 응답 → stale revision 409.
- 위 검증 전에는 프론트 배포와 완료 선언을 하면 안 됩니다.
