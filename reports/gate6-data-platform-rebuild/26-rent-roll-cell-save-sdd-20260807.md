# Gate 6 렌트롤 셀 저장 SDD v6

- 기준일: 2026-08-07 KST
- 범위: `/data-platform/rent-roll`의 직접 입력, 계산 표시, 명시적 저장, Supabase primary readback
- 저장 원칙: 담당자가 값을 입력하거나 선택하는 동안에는 원격 요청과 오류 팝업을 만들지 않습니다. `변경사항 저장`을 누를 때만 변경된 셀을 저장합니다.

## 1. 스캔 개요

- 화면 열 55개를 입력 43개와 서버 계산 12개로 고정했습니다.
- 기존 행은 반드시 `operation: update`, 신규 행은 `operation: create`, 삭제 행은 `operation: delete`로 전송합니다.
- 기존 행 저장 payload는 행 식별 키, 구성요소 revision, 변경된 입력 필드만 포함합니다. 계산 필드는 저장하지 않습니다.
- `rent_free_periods`, `fit_out_start_date`, `fit_out_end_date`는 화면 확장 필드이며 관련 scalar 필드와 함께 저장합니다.
- 저장 성공은 Edge의 `{ok:true,status:"primary"}` 응답만으로 끝내지 않고 같은 자산을 다시 조회해 값과 revision을 확인해야 합니다.

## 2. UI → payload → readback 계약

| 분류 | 입력 43개 또는 확장 필드 | UI | 저장 payload | primary readback |
|---|---|---|---|---|
| 상태·임차인 | `occupancy_status`, `tenant_name`, `business_registration_number` | 선택/직접 입력 | 변경값 | 동일 의미의 실제 값 |
| 공간 | `temperature_type`, `goods_type`, `floor_label`, `zone_label`, `subtenant_name`, `free_area_type` | 선택/직접 입력 | 변경값 | 동일 의미의 실제 값 |
| 면적 | `exclusive_area_sqm`, `common_area_sqm`, `leased_area_sqm` | 숫자 직접 입력 | 쉼표 없는 숫자 또는 `null` | 숫자 또는 `null` |
| 계약 | `signed_date`, `commencement_date`, `expiry_date`, `operation_start_date` | 날짜 직접 입력 | ISO 날짜 또는 `null` | ISO 날짜 또는 `null` |
| 보증금 | `deposit_total_krw`, `security_type`, `security_ratio` | 금액/문자/% 직접 입력 | 변경값 | 동일 의미의 실제 값 |
| 임대료 | `monthly_rent_total_krw`, `monthly_cam_total_krw`, `pallet_rack_fee` | 금액 직접 입력 | 쉼표 없는 숫자 또는 `null` | 숫자 또는 `null` |
| 렌트프리 | `rent_free_months`, `rent_free_start_date`, `rent_free_end_date`, 확장 `rent_free_periods` | 단일 팝업에서 복수 기간·사유·비고 입력 | 기간 배열과 호환 scalar | 기간 배열과 scalar |
| Fit-out·TI | `fit_out_months`, `fit_out_amount`, `tenant_improvement_amount`, 확장 `fit_out_start_date`, `fit_out_end_date` | 날짜·금액 직접 입력 | 날짜·개월·금액 | 동일 의미의 실제 값 |
| 인상 조건 | 보증금·임대료·관리비별 `first_date`, `interval_months`, `rate` 9개 | 최초 인상일/주기/%를 각각 입력 | 한 셀 한 값 | 동일 의미의 실제 값 |
| 비용·권리 | `tenant_cost_terms`, `landlord_cost_terms`, `renewal_terms`, `termination_terms`, `restoration_terms` | 다중 선택 또는 선택+직접 입력 | JSON 보존/정규화 문자열 | 동일 의미의 실제 값 |
| 기타 | `notes` | 직접 입력 | 문자열 또는 `null` | 문자열 또는 `null` |

서버 계산 12개는 `exclusive_area_py`, `common_area_py`, `leased_area_py`, `efficiency_ratio`, `contract_months`, `wale_years`, `deposit_per_py_krw`, `rent_per_py_krw`, `cam_per_py_krw`, `pallet_rack_fee_per_py`, `current_total_cost_per_py_krw`, `effective_rent`입니다. 이 값들은 저장 payload에서 제외하고 서버 계산 후 재조회 값과 화면 계산값을 비교합니다.

## 3. 계산·표시 계약

- ㎡→평과 E.NOC는 기존 `0.3025평/㎡` 계약을 사용합니다.
- 금액과 모든 계산 숫자는 한국식 3자리 쉼표로 표시하고 저장할 때 쉼표를 제거합니다.
- 실효 임대료는 `월 임대료 × (계약개월 - 렌트프리개월) ÷ 계약개월`로 미리 표시하며 원 단위 미만을 버립니다. 최종 진실값은 서버 readback입니다.
- `기타(없음)`, `기타(N)`, `N`, `no`, `중도해지불가`, `중도해지 불가`는 `없음`으로 정규화해 선택 목록에 정확히 표시합니다.
- 직접 입력과 단순 포커스 이동은 자동 저장, 오류 팝업, 확인 팝업을 발생시키지 않습니다.

## 4. 저장 생명주기

1. 입력 이벤트는 브라우저 초안과 `dirtyFieldsByRow`만 갱신합니다.
2. 변경 행이 없으면 저장 버튼을 비활성화하고 API를 호출하지 않습니다.
3. 저장 버튼을 누르면 행별 허용목록 기반 delta payload와 구성요소 revision을 보냅니다. 연속 클릭은 in-flight 잠금으로 같은 저장 요청을 두 번 만들지 않습니다.
4. Edge 또는 DB 검증 오류는 성공으로 포장하지 않습니다.
5. 저장 성공 후 같은 자산을 직접 다시 조회해 변경 셀과 렌트프리 기간 배열을 의미값으로 비교합니다. 신규 행에서 서버 공간 키가 달라지면 응답의 `key_mappings`와 안정된 계약·임대조건 키로 연결합니다.
6. readback이 성공하기 전에는 초안을 지우거나 저장 완료로 표시하지 않습니다.

## 5. 확인된 필드 일관성 위험

- 현재 운영 `rows` 저장 경로는 기존 행의 `space_key`를 새 공간으로 삽입하려고 시도합니다. 실제 safe no-op에서 Edge HTTP 500, 직접 RPC 409/SQLSTATE 23505가 발생했고 `spaces_space_key_key` 중복이 확인됐습니다.
- 현재 `operations` writer는 `contract|space|rent_term` 일부 필드만 지원합니다. 임차인명, 사업자등록번호, 공실상태, 공용·임대면적, 계약 주요 날짜, 복수 렌트프리, 비용 JSON, 상세 인상 조건 등을 누락하므로 프론트만 `operations`로 바꾸면 데이터가 조용히 유실될 수 있습니다.
- 따라서 프론트는 행 식별 키와 변경 셀 delta를 유지하고, 백엔드는 기존 `space_key`, `contract_key`, `rent_term_key`를 기준으로 실제 UPDATE를 수행해야 합니다.
- `LEGACY_MULTIPLE_DATE_CONFLICT`처럼 기존 공식값이 null로 차단된 행은 관련 없는 셀 저장을 막지 않습니다. 기존 행은 dirty 필드만 사전 검증하고, 담당자가 만기일 셀 자체를 수정할 때만 단일 ISO 날짜를 요구합니다.

## 6. 예시 커버리지

- 기존 행에서 월 임대료를 `1,234,567`로 입력해도 저장 전 요청은 0건입니다.
- 복수 렌트프리 2개 기간을 입력해도 팝업의 `적용`은 브라우저 초안만 갱신합니다.
- 저장 버튼 1회에 요청 1건, `operation:update`, 변경된 월 임대료와 렌트프리 배열만 payload에 포함됩니다.
- 계산 필드 `effective_rent`는 payload에 없고 readback 표시에서는 정수와 3자리 쉼표 형식을 사용합니다.
- 권리 값 `기타(N)`, `중도해지불가`는 readback projection에서 `없음`으로 표시됩니다.

## 7. Breaking change 위험과 권장 수정

- 위험: 기존 행을 create로 처리하면 중복 키 오류 또는 중복 데이터가 생깁니다.
- 위험: 계산값을 브라우저에서 저장하면 서버 공식과 formula version을 우회합니다.
- 위험: 부분 지원 `operations`로 전환하면 사용자가 편집한 값 일부가 저장되지 않은 채 성공처럼 보일 수 있습니다.
- 권장 수정: `rows` 경로를 구성요소 키 기반 upsert/update 계약으로 고치고 43개 입력 필드와 3개 확장 필드를 명시적으로 매핑합니다.
- 권장 수정: 응답에는 저장된 행별 구성요소 revision을 반환하고, 프론트 readback에서 이를 새 기준으로 교체합니다.

## 8. 검증 체크리스트

- [x] 55개 화면 열을 입력 43개/계산 12개로 분류
- [x] 신규·기존·삭제 operation 결정 계약
- [x] 변경 셀 delta allowlist와 계산 필드 제외
- [x] 숫자 쉼표 입력·표시와 실효 임대료 원 단위 버림
- [x] 권리 없음 값 정규화
- [x] 복수 렌트프리 팝업 round-trip 계약
- [x] 로컬 mock browser에서 저장 전 요청 0건, 저장 시 1건 확인
- [ ] 백엔드 기존 행 UPDATE 수정 및 배포
- [ ] 운영 19개 자산·81행의 행별 43개 입력값 same-value 저장
- [ ] 재조회 4,455셀(81×55)과 렌트프리 기간 배열 비교

마지막 세 항목을 통과하기 전에는 렌트롤 저장 기능을 운영 완료로 판정하지 않습니다.
