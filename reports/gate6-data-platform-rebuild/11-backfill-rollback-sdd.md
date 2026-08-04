# Gate 6 backfill·호환·rollback SDD

문서 상태: **R0 PASS · R1 PARTIAL — 구현 진척·운영 migration 실행 금지**
작성 기준일: 2026-08-04
적용 범위: 운영 snapshot, old-to-new mapping, backfill, legacy projection, 역이관, cutover, 15분 rollback

## 1. 목적과 최우선 원칙

이 문서는 기존 운영 데이터를 잃지 않고 새 `logistics_core` 원장으로 옮기고, 새 플랫폼에서 생성된 데이터까지 기존 화면으로 되돌릴 수 있게 하는 실행 계약입니다. 신규 데이터가 완전히 검증되기 전에는 `public.ll_*`, 기존 frontend, 기존 Edge Function을 삭제하지 않습니다.

다음 원칙은 예외가 없습니다.

- R0·R1 통과 전에는 SDD 문서와 의도적으로 실패하는 테스트만 진척으로 인정합니다. 이미 생긴 migration·handler·frontend 구현 초안은 격리 보존하되 R1 승인 전 더 수정하거나 진척으로 인정하지 않습니다.
- source를 정리·수정한 뒤 이관하지 않습니다. source 원문과 hash를 먼저 고정합니다.
- 행 수 일치만으로 성공 처리하지 않습니다. 관계, 업무값, 권한, 계산, source/target hash가 모두 일치해야 합니다.
- source 자료가 없으면 NULL과 `not_provided`를 보존합니다. 샘플·추정값으로 통과시키지 않습니다.
- backfill과 reverse migration은 같은 mapping registry를 사용합니다.
- cutover 이후 쓰기는 canonical 원장과 legacy projection을 한 transaction으로 확정합니다.
- rollback 가능 시간은 실제 리허설에서 15분 이내여야 하며 문서상의 예상 시간으로 통과시키지 않습니다.

## 2. 현재 복구 기준선과 판정

### 2.1 보존 기준점

| 항목 | 고정값 |
|---|---|
| clean main | `c3e3f51adf5deb324f38d76da3a331f63dd37c87` |
| 실제 원격 gh-pages | `9809c960bb373ed10a69e9adfb766677bf672d2d` |
| archive Release | `gate6-pre-data-platform-20260804` |
| 기존 운영 Edge | 보존된 8개 함수, `ll-dashboard-api` 운영 버전 545 포함 |
| 격리 개발 브랜치 | `codex/gate6-data-platform-rebuild` |

### 2.2 restore 확인값

| 검증 | 확인값 | 현재 판정 |
|---|---:|---|
| 운영 DB dump | roles/schema/data/full 종료 코드 0 | 통과 |
| 로컬 roles restore | 종료 코드 0 | 통과 |
| 로컬 전체 DB restore | 플랫폼 관리 확장 4개 부재로 종료 코드 1 | 책임 분리 |
| Gate 6 애플리케이션 선택 restore | 375개 객체, 종료 코드 0 | 통과 |
| `public.ll_*` table count | 27개 | 통과 |
| `public.ll_*` row readback | 27/27 일치, 총 27,512행 | 통과 |
| 동일 dump snapshot `public.ll_*` content hash | 27/27 일치 | 통과 |
| 운영-vs-dump 동적 table hash | 24/27 일치 | cutover 직전 동일 snapshot 재검증 |
| Auth 사용자 | 운영 13명 = 로컬 13명 | 통과 |
| Storage metadata | 운영 49개 = 로컬 49개 | 통과 |
| Storage 원본 파일 | 49/49, 총 113,226,015바이트, 파일별 SHA-256 | 통과 |
| schema 격리 방식 | 동일 프로젝트 `logistics_core`·`logistics_api` additive schema | 승인 |

운영-vs-dump의 세 hash 불일치는 서로 다른 시점 비교라서 R0 복원 parity 증거로 사용하지 않습니다. R0는 같은 dump snapshot의 27/27 content hash로 통과했습니다. cutover 직전에는 쓰기 잠금 상태에서 운영 snapshot을 새로 고정해 다시 비교합니다.

### 2.3 현재 확인된 27개 `ll_*`

다음 27개가 old-to-new 조사와 restore manifest의 최소 모집단입니다.

1. `ll_asset_operating_costs`
2. `ll_asset_spec_files`
3. `ll_asset_specs`
4. `ll_assets`
5. `ll_cache_entries`
6. `ll_edit_requests`
7. `ll_fund_asset_links`
8. `ll_fund_capital_tranches`
9. `ll_funds`
10. `ll_lease_attributes`
11. `ll_lease_spaces`
12. `ll_leases`
13. `ll_news_items`
14. `ll_notifications`
15. `ll_notification_subscriptions`
16. `ll_rent_history`
17. `ll_sector_market_cap_rate_series`
18. `ll_sector_market_lease_observations`
19. `ll_sector_market_supply_cases`
20. `ll_sector_market_transaction_cases`
21. `ll_source_files`
22. `ll_source_rows`
23. `ll_staff_profiles`
24. `ll_tenants`
25. `ll_user_permissions`
26. `ll_work_items`
27. `ll_login_events`

2026-07-14 catalog의 25개·27,042행은 구조 설명용 과거 snapshot입니다. 이후 `ll_notification_subscriptions`, `ll_login_events`가 추가되고 운영 데이터도 변했으므로, backfill의 수량 기준은 반드시 복구 manifest의 **27개·27,512행 동일 시점 snapshot**을 사용합니다. 두 숫자를 섞어 합계를 추론하지 않습니다.

## 3. 복구·이관 게이트

### R0. 독립 복구 게이트

R0는 아래 기존 운영본의 독립 복구 조건을 검증하는 게이트이며 통과했습니다. 신규 schema·delta를 포함한 운영 rollback은 R2·R3에서 별도로 검증합니다.

1. Supabase 관리 확장과 애플리케이션 소유 객체의 복구 책임을 분리한 manifest 확정
2. 플랫폼 소유 확장 네 개를 제외한 roles, application schema, application data restore와 readback 종료 코드 0
3. 27개 table의 행 수와 전체 열 content hash 27/27 일치
4. Auth 사용자 13명의 UUID·이메일·직원·권한 연결 관계 일치
5. Storage 49개 원본의 파일 수·크기·SHA-256 일치
6. 함수·trigger·RLS·policy·grant·index·FK·sequence inventory 일치
7. 보존 Edge 8개의 원격 source와 hash 확인
8. archive source·Pages·Edge를 독립적으로 재조립하고 기존 public deep link readback 통과
9. 기존 버전 archive rollback 경로를 15분 이내 재현

### R1. mapping 승인 게이트

- 모든 source table과 사용 열에 disposition과 target이 지정됨
- 27개 table 중 `unclassified` 0개
- source 자연키·target 자연키·cardinality가 확정됨
- 실제 업무자료가 없는 예산·예측·현금수취·부채상환·평가값은 `not_provided`로 명시됨
- 임대료 일할·반올림·인상·렌트프리 fixture 승인
- critical migration exception 0건

현재 판정은 `PARTIAL`입니다. 27개 source table의 disposition은 분류했지만 Excel 원본과 기존 화면의 마지막 정상값, 권한 이중 표현, finance 원천, 임대료·대출 계산식에 critical exception이 남아 있습니다.

### R2. local rehearsal·production shadow backfill 게이트

- 복구된 로컬 DB(`local rehearsal`)의 동일 snapshot에서 migration·backfill 재실행 2회 결과가 동일함
- 같은 운영 프로젝트의 비노출 additive schema(`production shadow`)에서 외부 grant·writer·worker를 비활성화한 채 readback 통과
- source/target business hash 일치
- PK/FK·기간 중복·8개 권한·계산·만기 검증 통과
- 기존 화면용 legacy projection readback 통과
- 삭제·rename·추정값 생성 0건

### R3. cutover 게이트

- shadow read 비교 기간과 표본이 승인됨
- 신규 write와 legacy projection transaction 테스트 통과
- 역이관 delta 0건 또는 전건 검증 완료
- 실제 이메일 공급자·허용 수신자 승인 및 30·7·3·1·0 수신 검증
- 운영 rollback 리허설 15분 이내 통과

## 4. source·target hash 계약

### 4.1 두 단계 hash

restore와 backfill은 목적이 다르므로 hash를 두 단계로 나눕니다.

| 단계 | 대상 | 목적 |
|---|---|---|
| L0 restore hash | 같은 `public.ll_*` source와 restore target의 모든 열 | 백업이 원본을 그대로 복원했는지 확인 |
| L1 business hash | mapping으로 정규화한 source 업무 record와 `logistics_core` record | 구조가 달라도 업무값이 손실 없이 이관됐는지 확인 |

### 4.2 canonical 직렬화

각 hash manifest는 `snapshot_id`, DB transaction snapshot 또는 write-freeze 시작시각, schema, table, PK 열, row count, canonicalization version, hash algorithm을 기록합니다.

- 알고리즘: SHA-256
- 열 이름은 사전순, 배열은 업무상 순서가 없으면 명시된 key로 정렬합니다.
- 날짜·시간은 ISO-8601 UTC, 월은 `YYYY-MM-01`, 숫자는 지수표현 없이 고정 문자열로 직렬화합니다.
- NULL, 빈 문자열, 0, false는 서로 다른 값입니다.
- JSON object key는 정렬하고 의미 없는 공백만 제거합니다.
- 행은 PK 또는 승인된 복합 자연키로 정렬합니다.
- L0에서는 `updated_at` 같은 동적 열도 제외하지 않습니다. 동일 시점 snapshot을 사용합니다.
- L1에서 열을 제외하거나 변환하려면 mapping registry에 열별 근거와 승인자를 남깁니다.

각 table은 `row_hash` 목록과 정렬된 `table_hash`를 갖고, run 전체에는 27개 table manifest의 정렬된 `database_hash`를 둡니다. 대용량 table도 무작위 표본으로 대체하지 않습니다.

### 4.3 critical exception 0

`migration_exceptions`는 심각도를 `critical`, `warning`, `information`으로 구분합니다. 아래는 항상 critical입니다.

- source 행 누락, target 중복, mapping 없는 운영 행
- source/target 업무값 hash 불일치
- 고아 FK, 기간 중복, 자연키 충돌
- 권한 범위 또는 8개 flag 불일치
- 공식 만기일 또는 대상 관계 불일치
- 렌트롤 계산과 월별 임대수입 불일치
- 승인되지 않은 기본값·예산·예측·시장값 생성
- reverse projection 불가능 또는 legacy 필수값 손실

backfill·cutover·rollback의 합격 조건은 `critical_exception_count = 0`입니다. warning은 원본에 이미 존재하고 값 손실 없이 보존된 품질 문제만 허용하며, 승인자·사유·처리기한이 없으면 critical로 승격합니다.

## 5. migration registry

`logistics_core`에 다음 이관 메타데이터를 설계합니다. 이 구조도 R0 통과 후에만 구현합니다.

| 테이블 | 역할 |
|---|---|
| `migration_runs` | `run_id`, snapshot, source/target version, 시작·종료, 상태, 행 수·hash 합계, 승인 증거를 보존합니다. |
| `migration_field_mappings` | source table·column, target entity·field, 변환 규칙, 단위·NULL·enum 계약, mapping version을 보존합니다. |
| `migration_row_mappings` | source table·PK·row hash와 target entity·ID·row hash를 연결합니다. one-to-many와 many-to-one을 명시합니다. |
| `migration_exceptions` | 심각도, entity, source key, expected/actual hash, 원인, 승인·해소 상태를 보존합니다. |
| `legacy_projection_state` | target entity와 대응 legacy row, projection version, 마지막 성공 revision·hash·시각을 보존합니다. |

source PK가 UUID가 아니어도 `source_table + source_pk_json`으로 유일하게 식별합니다. source ID를 신규 업무 PK로 재사용하지 않고 row mapping으로 연결합니다.

## 6. 27개 old-to-new disposition

| source | 신규 처리 | target 또는 보존 위치 | 검증 핵심 |
|---|---|---|---|
| `ll_assets` | backfill | `assets` | asset code·명칭·면적·투자 핵심값 필드별 hash |
| `ll_funds` | backfill | `funds` | fund code·명칭·상태; 만기는 `maturities`로 분리 |
| `ll_fund_asset_links` | backfill | `fund_asset_links` | asset-fund 관계와 유효기간 |
| `ll_fund_capital_tranches` | 조건부 분해 | `fund_beneficiary_tranches`, `loans`, `lenders`, `loan_lenders` | 수익증권과 대출을 원본 type으로 분리. 이름 추정 병합 금지 |
| `ll_tenants` | backfill | `tenants` | 사업자번호 우선, 이름 유사도 병합 금지 |
| `ll_leases` | backfill | `lease_contracts`, `maturities` | 계약 단위와 공식 종료일 |
| `ll_lease_spaces` | backfill | `spaces`, `contract_spaces`, 초기 `rent_terms` | 공간·계약 배정 cardinality와 면적 |
| `ll_lease_attributes` | 필드별 분해 | 계약·공간·rent term의 승인된 target field | 동적 key 전수 분류, 미분류 key 0 |
| `ll_rent_history` | backfill | `rent_terms`, `rent_term_history` | 유효기간, 임대료·관리비, 겹침 0 |
| `ll_asset_operating_costs` | 조건부 backfill | `monthly_ledger_entries` | 2026-07-14 snapshot은 0행. 최신 source 재확인, 임의 생성 금지 |
| `ll_user_permissions` | backfill | `user_permission_profiles`, `user_asset_assignments` | Auth UUID 연결, scope와 8개 flag 완전 일치 |
| `ll_staff_profiles` | 최소 참조 | 사용자 표시 프로필 또는 기존 보존 | Auth 연결만 검증; 권한 원장으로 사용 금지 |
| `ll_edit_requests` | 이력 보존 | `audit_events`, migration provenance, legacy 원본 | 승인·실제 write·readback 상태를 구분; 미완료를 성공으로 이관 금지 |
| `ll_notifications` | 선택 backfill | 공식 만기 관련 건만 delivery 감사로 분류, 나머지 legacy 보존 | 일반 알림을 신규 만기로 오인 금지 |
| `ll_notification_subscriptions` | legacy 보존 | 기존 browser push 호환 | 이메일 구독으로 변환 금지 |
| `ll_login_events` | legacy 보존 | 기존 인증 지원 이력 | 비밀번호·raw 오류를 신규 schema로 복제 금지 |
| `ll_source_files` | provenance 보존 | migration manifest의 source artifact 참조 | 파일 hash·workbook 구조 연결 |
| `ll_source_rows` | provenance 보존 | `migration_row_mappings`의 source 참조 | 원본 sheet·row·hash 추적 |
| `ll_asset_specs` | archive/호환 | `public.ll_*` 유지 | 신규 3탭 필수값과 명시적으로 매핑된 필드만 assets로 승격 |
| `ll_asset_spec_files` | archive/호환 | 기존 Storage·`public.ll_*` 유지 | Storage 49개 검증 전 이동 금지 |
| `ll_sector_market_cap_rate_series` | archive/승인 참조 | legacy 보존, 승인 시 시나리오 입력 reference | 운영 actual로 자동 적재 금지 |
| `ll_sector_market_lease_observations` | archive/승인 참조 | legacy 보존, 승인된 시장 임대료 지표에만 사용 | 현재 restore hash 불일치 해소 전 사용 금지 |
| `ll_sector_market_supply_cases` | archive | legacy 보존 | 신규 3탭 자동 이관 안 함 |
| `ll_sector_market_transaction_cases` | archive | legacy 보존 | 신규 3탭 자동 이관 안 함 |
| `ll_news_items` | archive | legacy 보존 | 현재 restore hash 불일치 해소 필요 |
| `ll_cache_entries` | 이관 제외 | legacy cache로만 보존 | canonical source로 사용 금지 |
| `ll_work_items` | archive | legacy 보존 | 신규 주요 탭으로 자동 이관 안 함 |

`archive`, `legacy 보존`, `이관 제외`는 삭제를 의미하지 않습니다. 새 제품의 canonical 업무 원장으로 복사하지 않고 기존 복구본과 호환 환경에서 유지한다는 뜻입니다.

## 7. 필드 mapping 승인 절차

각 source column은 아래 중 정확히 하나의 상태를 가져야 합니다.

- `direct`: 형식만 표준화해 같은 의미로 이동
- `split`: 한 source 행 또는 열이 여러 target entity·field로 분해
- `combine`: 여러 source가 하나의 target field를 구성하며 우선순위가 승인됨
- `provenance_only`: 운영값으로 승격하지 않고 근거만 보존
- `legacy_only`: 신규 제품 범위 밖이라 기존에만 보존
- `blocked`: 의미 또는 source가 확인되지 않아 이관 금지

필드 mapping 문서에는 source sample 원문이 아니라 안전한 예시, source/target type, 단위, NULL 처리, enum mapping, 반올림, timezone, cardinality, 역변환 가능 여부, 승인자를 기록합니다. `blocked`가 핵심 엔터티에 하나라도 남으면 R1은 실패합니다.

특히 기존 자산·투자·펀드 화면에서 사라진 값은 Git 이력, 과거 배포본, 운영 Supabase, 원본 Excel, 과거 QA 화면을 자산별·필드별로 비교해 정상 source를 확정한 뒤에만 mapping합니다. `-`, `개발 중`, `자료 없음`을 값으로 이관하지 않습니다.

## 8. backfill 실행 계약

### B0. 준비

1. 승인된 동일 시점 운영 snapshot과 27-table manifest를 읽기 전용으로 고정합니다.
2. `local rehearsal`은 복구된 로컬 DB이며 migration 2회·backfill·reverse·rollback을 실행합니다.
3. `production shadow`는 같은 운영 프로젝트의 `logistics_core`·`logistics_api` additive schema입니다. 검증 중 `logistics_api` 외부 grant, v2 writer, 이메일 worker를 비활성화합니다.
4. 이메일·Push worker는 비활성화하고 outbox만 검증합니다.
5. mapping version과 formula version을 run에 고정합니다.

### B1. 순서

1. assets, funds, tenants, lenders
2. fund-asset links, loans, loan-lenders
3. spaces, lease contracts, contract-spaces
4. rent terms, rent history
5. cashflow accounts, 월별 ledger·adjustments
6. Auth UUID 기반 permission profiles·asset assignments
7. maturities·schedule
8. 필요한 승인·변경 audit와 migration provenance

부모 entity가 검증되기 전에 자식 entity를 적재하지 않습니다.

### B2. 재실행과 실패

- backfill은 `run_id + source_table + source_pk + mapping_version`으로 멱등입니다.
- 같은 source hash의 재실행은 target을 중복 생성하지 않습니다.
- source hash가 바뀌면 같은 run을 덮어쓰지 않고 새 snapshot·run을 요구합니다.
- 단계별 transaction은 허용하지만 전체 run이 합격하기 전 target은 공개하지 않습니다.
- 오류 행을 건너뛰고 완료 처리하지 않습니다. critical exception으로 run을 실패시킵니다.

### B3. 검증

각 단계 후 다음을 자동 산출합니다.

- source·target entity별 count와 cardinality
- L1 business hash와 불일치 row key
- NULL·enum·숫자·날짜 범위 검증
- 모든 FK와 고아 행 수
- 임대 계약·공간·rent term 기간 겹침
- 렌트롤 계산 월액과 ledger 계약 임대료의 formula version·금액
- 8개 권한 matrix와 read/create/update/delete 결과
- 만기 대상·날짜·30·7·3·1·0 schedule
- critical/warning exception 목록

성공 조건은 critical 0건, 승인되지 않은 warning 0건입니다.

## 9. 신규 write의 legacy projection

cutover 뒤 신규 화면에서 생성·수정·soft delete한 값은 기존 화면 rollback을 위해 대응 `public.ll_*`에도 투영합니다.

### 9.1 transaction 계약

`10-data-api-sdd.md`의 write RPC 한 transaction에서 다음을 수행합니다.

1. canonical revision 확인·쓰기
2. `legacy_projection_state`에서 mapping version과 legacy key 확인
3. `ll_leases`, `ll_lease_spaces`, `ll_lease_attributes`, `ll_rent_history`, `ll_assets`, `ll_funds`, `ll_fund_asset_links`, `ll_fund_capital_tranches`, `ll_user_permissions` 등 승인 대상에 투영
4. legacy 행 readback과 business hash 확인
5. canonical audit와 projection state 갱신
6. commit

legacy schema가 표현할 수 없는 신규 필드는 별도 승인 전 저장 기능을 열지 않습니다. JSON 임시 필드나 이름 기반 조합으로 우회하지 않습니다. projection 실패 시 canonical write도 rollback하고 `READBACK_MISMATCH`를 반환합니다.

### 9.2 단일 writer

cutover 이후 동일 업무 entity를 신규 API와 기존 API가 동시에 수정하게 두지 않습니다.

- 신규 파일럿 자산: 신규 RPC만 writer, 기존 화면은 read-only
- 비파일럿 자산: 기존 API writer 유지
- 전체 전환: 신규 RPC만 writer

writer 소유권은 `logistics_core.asset_writer_routes`로 관리합니다. 상태는 `legacy|v2|locked`이며 revision·변경자·변경시각·잠금 사유를 기록합니다. 기존 API와 v2 RPC 모두 동일한 DB guard를 호출하고, 전환은 `locked` → in-flight idempotency drain → 최종 delta/readback → 목표 mode 순서로 수행합니다. frontend 표시만 바꾸는 것은 writer 전환이 아닙니다.

## 10. shadow read와 cutover

### 10.1 shadow read

사용자 응답은 현재 writer의 primary 결과만 반환합니다. 배경에서 같은 요청을 신규/legacy로 읽어 다음을 비교하되, shadow 또는 cache를 성공 fallback으로 사용하지 않습니다.

- 홈 핵심 필드
- 렌트롤 계약·공간·rent term 조합
- 월별 임대료와 손익 소계
- 공식 만기
- 권한 판정

불일치는 correlation ID, asset, field, source hash, target hash, mapping·formula version으로 기록합니다. critical 불일치 0건의 승인된 관찰 기간을 지나야 cutover할 수 있습니다.

### 10.2 운영 cutover 순서

1. archive manifest와 복구물 접근성을 재확인합니다.
2. 구 writer를 쓰기 잠금하고 in-flight request와 idempotency 상태를 drain합니다.
3. 최종 source snapshot과 delta를 backfill합니다.
4. source/target count·hash·권한·계산·만기를 검증합니다.
5. critical exception이 0인지 확인합니다.
6. writer routing을 신규 RPC로 전환합니다.
7. 신규 frontend를 전환하고 login·세 탭·CRUD·새로고침 smoke를 수행합니다.
8. 기존 frontend와 Edge는 삭제하지 않고 rollback 가능한 상태로 유지합니다.

한 단계라도 실패하면 다음 단계로 진행하지 않고 아래 rollback을 시작합니다.

## 11. 역이관 계약

역이관은 신규 platform의 데이터를 과거 snapshot으로 되돌리는 것이 아니라, cutover 이후의 승인된 업무 변경을 legacy가 이해할 수 있는 형태로 보존하는 작업입니다.

### 11.1 delta 기준

- cutover 직전 `cutover_watermark`를 확정합니다.
- 이후 `audit_events`의 순번과 canonical revision으로 delta를 식별합니다.
- `legacy_projection_state.last_success_revision`보다 큰 entity만 대상입니다.
- 동일 entity·revision은 다시 투영해도 결과가 같아야 합니다.

### 11.2 역변환

- forward와 같은 `migration_field_mappings` version의 reverse rule을 사용합니다.
- target 한 건이 여러 legacy 행이면 `migration_row_mappings`의 모든 관계를 갱신합니다.
- soft delete는 legacy가 지원하는 삭제 상태 또는 승인된 종료 상태로 투영하고 물리 DELETE하지 않습니다.
- legacy가 표현하지 못하는 필드가 있으면 cutover 전 critical exception입니다. 운영 중 새로 발생했다면 legacy 화면 복귀 전에 read-only 보호를 유지하고 사용자 승인을 받습니다.
- 역이관 후 legacy row readback과 L1 business hash를 다시 확인합니다.

### 11.3 손실 0 증거

역이관 완료 manifest는 다음을 포함합니다.

- cutover watermark와 rollback watermark
- 대상 audit event 수, entity 수, legacy row 수
- source/target count와 hash
- 멱등 재실행 결과
- critical exception 0건
- 신규에서만 존재하는 필드 0건 또는 승인된 별도 보존 artifact

## 12. 15분 rollback runbook

시간은 실제 리허설의 server timestamp로 측정합니다. 담당자, 실행 명령, 승인자는 별도 운영 runbook에 채우되 아래 순서와 종료 조건을 바꾸지 않습니다.

| 누적 시간 | 조치 | 통과 증거 |
|---:|---|---|
| 0~1분 | incident 선언, `MAINTENANCE_MODE` 설정, 신규 write 차단, rollback correlation ID 발급 | 신규 write 503, 진행 중 요청 목록 |
| 1~3분 | in-flight RPC drain, idempotency `in_progress` 상태 확정 또는 취소 | 미확정 transaction 0건 |
| 3~7분 | watermark 이후 delta를 legacy로 역이관 | 대상 count 일치, projection critical 0 |
| 7~9분 | legacy readback과 L1 hash·권한·공식 만기 검증 | 불일치 0건 |
| 9~11분 | 보존 Edge 8개와 `ll-dashboard-api` 운영 버전 545 경로 복귀 | 배포·route version readback |
| 11~12분 | 실제 gh-pages archive 배포본으로 frontend 복귀 | asset hash와 base path 확인 |
| 12~14분 | 허용된 계정으로 login, 자산 목록, 기존 렌트롤 read/write/readback smoke | 권한·쓰기·새로고침 유지 |
| 14~15분 | legacy writer 잠금 해제, 신규 경로 read-only 유지, 증거 봉인 | 종료시각, 총 소요시간, manifest hash |

15분을 넘기거나 hash·권한·readback이 하나라도 불일치하면 rollback 리허설은 실패입니다. 단순히 과거 화면이 열리는 것은 성공이 아닙니다. 신규 변경이 legacy에 보존되고 기존 사용자가 정확한 권한으로 다시 읽고 쓸 수 있어야 합니다.

## 13. rollback 이후 운영

- `logistics_core`를 삭제하거나 되감지 않습니다. 실패 시점 그대로 read-only 격리합니다.
- 실패 correlation ID와 audit·mapping·projection evidence를 보존합니다.
- 사용자에게 영향 자산, 차단된 시간, 보존된 변경 건수, 미해결 exception을 알립니다.
- root cause와 재진입 기준을 승인하기 전 신규 writer를 다시 열지 않습니다.
- archive Release와 민감한 암호화 백업을 공개 저장소에 업로드하지 않습니다.

## 14. TDD 계약

구현 전에 아래 테스트를 실패 상태로 작성합니다.

| 테스트 ID | Given / When / Then |
|---|---|
| MIG-T001 | 동일 snapshot을 동일 mapping version으로 두 번 backfill하면 target ID, count, hash가 같습니다. |
| MIG-T002 | source 한 행을 누락시키면 critical exception이 1 이상이고 run이 성공 처리되지 않습니다. |
| MIG-T003 | NULL·빈 문자열·0·false 중 하나를 바꾸면 L0/L1 hash가 차이를 검출합니다. |
| MIG-T004 | 27개 table 중 하나가 manifest에서 빠지면 R0가 실패합니다. |
| MIG-T005 | restore 행 수가 27/27 같아도 한 업무값이 바뀌면 content hash gate가 실패합니다. |
| MIG-T006 | 임대 source 46→공간 81→속성 다수 같은 one-to-many 관계도 row mapping으로 전건 추적됩니다. |
| MIG-T007 | 미분류 `ll_lease_attributes` key가 하나라도 있으면 backfill이 중단됩니다. |
| MIG-T008 | 기존 권한 사용자 전원의 담당·기타 8개 flag와 Auth UUID가 target 판정과 일치합니다. |
| MIG-T009 | 예산 source가 없을 때 target budget 행은 0건이고 API는 `not_provided`를 반환합니다. |
| MIG-T010 | legacy projection을 실패시키면 canonical write, audit, idempotency 성공 응답이 모두 rollback됩니다. |
| MIG-T011 | cutover 후 신규 create/update/delete를 역이관하면 legacy readback과 L1 hash가 일치합니다. |
| MIG-T012 | reverse rule이 없는 신규 필드가 있으면 cutover gate가 실패합니다. |
| MIG-T013 | writer routing 경합을 만들어도 한 자산에 활성 writer가 동시에 둘이 되지 않습니다. |
| MIG-T014 | 실제 archive Edge·Pages로 rollback하고 신규 delta를 보존한 전체 리허설이 15분 이내 완료됩니다. |
| MIG-T015 | cutover 직전 쓰기 잠금 snapshot에서 `ll_news_items`, `ll_notifications`, `ll_sector_market_lease_observations`를 포함한 27개 hash가 고정되지 않으면 R3가 실패합니다. |
| MIG-T016 | Storage 49개 중 한 파일의 size 또는 SHA-256이 다르면 R0가 실패합니다. |

## 15. 필수 증거 산출물

민감정보는 암호화 저장소에 두고 Git에는 redacted manifest만 둡니다.

- `restore-manifest.json`: dump·extension·role·schema·table·Auth·Storage·Edge 기준
- `ll-table-hashes.json`: 27개 L0 count·hash
- `field-mapping.csv`: 열별 mapping 상태·단위·역변환·승인
- `migration-run.json`: run·mapping·formula version과 단계별 결과
- `row-mapping-hashes.json`: L1 source/target count·hash와 불일치 key
- `permission-parity.json`: Auth UUID별 담당·기타 8개 flag 판정
- `calculation-parity.json`: 월별 rent·ledger·formula version 비교
- `maturity-parity.json`: lease·fund·loan 공식 날짜와 schedule 비교
- `reverse-migration.json`: watermark, delta, projection, critical exception 0
- `rollback-rehearsal.json`: 단계별 시작·종료시각, 실제 배포 version, smoke, 총 소요시간

## 16. 사용자 승인 또는 자료가 필요한 차단 항목

1. 실제 월별 손익·현금 수취·예산·예측·대출 상환·평가액 자료 위치
2. 시장 임대료에 사용할 승인 source와 적용 방식
3. 실제 이메일 공급자와 허용된 테스트 수신자
4. 임대료 일할·반올림, 대출 약정 지표 계산식의 업무 승인자

위 항목을 확인하지 않고 값이나 공급자를 추정해 구현하지 않습니다.
