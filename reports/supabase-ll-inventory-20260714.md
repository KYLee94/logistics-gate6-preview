# Supabase `public.ll_*` 운영 인벤토리

작성일: 2026-07-14
대상: 운영 Supabase 프로젝트의 `public.ll_*` 테이블
목적: 현재 구조를 비개발자도 이해할 수 있도록 정리하고, 유지·통합검토·삭제 대상을 구분합니다.

이 문서에는 운영 비밀, 행 원문, 사용자 식별용 내부 UUID를 기록하지 않습니다.

## 1. 핵심 결론

- 정리 전 운영 catalog는 `public.ll_*` **28개 테이블, 27,326행, 685컬럼**이었습니다.
- QA/test/dev 표식 284행을 재검토하여 실제 정정 기록 4행은 보호하고, 명백한 시험 데이터 280행만 백업 후 삭제했습니다.
- 삭제 대상 280행은 삭제 후 재조회(readback)에서 **0행**으로 확인했습니다.
- 이어서 `ll_market_deprecation_backups`의 4행과 테이블 자체를 별도 migration으로 삭제했습니다. 이 테이블은 8컬럼이었습니다.
- 이후 모든 값이 비어 있고 코드·인덱스·외래키 참조가 없는 열 3개(`ll_assets.last_etl_run_id`, `ll_funds.last_etl_run_id`, `ll_leases.source_doc_ref`)를 제한된 migration으로 삭제했습니다.
- 게시판 0행과 주간 기록 28행을 `ll_work_items`로 검증 이관한 뒤 `ll_board_posts`, `ll_weekly_records`를 `RESTRICT`로 삭제했습니다.
- 따라서 현재 운영 catalog는 **25개 테이블, 27,042행, 654컬럼**입니다.
- `ll_leases` → `ll_lease_spaces` → `ll_lease_attributes`는 서로 다른 상세 수준을 가진 3단 구조이므로 병합하지 않는 것이 안전합니다.
- `ll_source_files`와 `ll_source_rows`는 원본 파일과 원본 행을 추적하는 최소 출처 체계이므로 보호합니다.

판정 용어는 다음과 같습니다.

- **유지**: 현재 기능이나 데이터 관계에 필요합니다.
- **통합검토**: 당장 합치지 않으며, 코드 전환·데이터 이관·검증을 모두 마친 뒤 다시 판단합니다.
- **삭제**: 불필요한 행 또는 테이블의 백업·삭제·재조회 확인을 마쳤습니다.

## 2. 현재 25개 테이블 인벤토리

| 테이블 | 현재 행 수 | 판정 | 쉬운 설명과 판단 이유 |
|---|---:|---|---|
| `ll_asset_operating_costs` | 0 | 유지 | 현재 행은 없지만 운영비 입력·조회 API가 이미 있어 향후 데이터를 받을 빈 그릇입니다. 0행만으로 삭제하면 기능이 깨집니다. |
| `ll_asset_spec_files` | 23 | 유지 | 자산별 도면·사양 파일을 관리합니다. 실제 사용하는 파일 테이블입니다. |
| `ll_asset_specs` | 3 | 유지 | 자산 사양의 기준 정보이며 파일 테이블과 함께 사용됩니다. |
| `ll_assets` | 19 | 유지 | 자산 마스터입니다. 다수 테이블이 이 자산을 참조합니다. |
| `ll_cache_entries` | 1,113 | 유지 | 대시보드 계산값과 외부 API 응답을 재사용해 속도와 외부 호출 안정성을 지킵니다. |
| `ll_edit_requests` | 15 | 유지 | 데이터 수정 요청, 승인, 쓰기 결과와 readback을 남기는 운영 이력입니다. QA 262행을 삭제하고 실제 운영 기록만 남겼습니다. |
| `ll_fund_asset_links` | 19 | 유지 | 펀드와 자산의 연결 관계를 보존합니다. |
| `ll_fund_capital_tranches` | 119 | 유지 | 펀드의 대출·자본 tranche 세부내역입니다. |
| `ll_funds` | 17 | 유지 | 펀드 마스터입니다. |
| `ll_lease_attributes` | 2,436 | 유지 | 계약·임차공간의 세부 속성을 여러 행으로 저장합니다. 임대 3테이블 중 가장 상세한 단계입니다. |
| `ll_lease_spaces` | 81 | 유지 | 한 계약을 층·구역·용도별 공간으로 나눕니다. QA 표식이 있었던 1행은 실제 정정 기록이어서 삭제하지 않았습니다. |
| `ll_leases` | 46 | 유지 | 임대차 계약의 머리정보입니다. 계약 기간, 임차인, 자산 관계의 기준입니다. |
| `ll_news_items` | 235 | 유지 | 물류·부동산 관련 뉴스 데이터입니다. |
| `ll_notifications` | 71 | 유지 | 사용자 알림과 읽음·해제 상태를 관리합니다. QA 12행은 삭제했습니다. |
| `ll_rent_history` | 164 | 유지 | 임대료 변동 이력입니다. QA 표식이 있었던 3행은 실제 정정 기록이어서 보호했습니다. |
| `ll_sector_market_cap_rate_series` | 84 | 유지 | 시장 cap rate 시계열입니다. |
| `ll_sector_market_lease_observations` | 9,610 | 유지 | 시장 임대 사례의 정규화된 핵심 데이터입니다. |
| `ll_sector_market_supply_cases` | 276 | 유지 | 시장 공급 사례입니다. |
| `ll_sector_market_transaction_cases` | 541 | 유지 | 시장 거래 사례입니다. |
| `ll_source_files` | 1 | 유지 | 원본 workbook 한 개의 버전, 해시, 검증 결과와 workbook 구조를 대표합니다. |
| `ll_source_rows` | 11,738 | 유지 | 원본 workbook의 각 행, 위치, 해시와 원본 값을 보존합니다. 시장 데이터의 출처 확인과 수정 readback에 필요합니다. |
| `ll_staff_profiles` | 38 | 통합검토 | 직원 프로필과 권한 정보가 일부 겹치지만 사진·조직 등 프로필 전용 정보가 있어 즉시 합치면 안 됩니다. |
| `ll_tenants` | 36 | 유지 | 임차인 마스터입니다. |
| `ll_user_permissions` | 263 | 유지 | 사용자·주체별 권한을 관리합니다. QA 1행은 삭제했습니다. |
| `ll_work_items` | 94 | 유지 | 이슈·업무·snapshot과 이관된 주간 기록 28행을 관리하는 통합 업무 테이블입니다. QA 2행은 삭제했습니다. |

현재 행 수 합계: **27,042행**

## 3. QA/test/dev 표식 데이터 정리 결과

표식 문자열만으로 바로 삭제하지 않고, 실제 업무 정정 기록인지 다시 확인했습니다.

### 3-1. 보호한 실제 정정 기록

| 테이블 | 보호 행 수 | 이유 |
|---|---:|---|
| `ll_lease_spaces` | 1 | 시험 데이터가 아니라 실제 임차공간 정정 기록이었습니다. |
| `ll_rent_history` | 3 | 시험 데이터가 아니라 실제 임대료 이력 정정 기록이었습니다. |
| **합계** | **4** | 운영 데이터로 유지했습니다. |

### 3-2. 백업 후 삭제한 명백한 시험 데이터

| 테이블 | 삭제 행 수 | 정리 직전 → 직후 |
|---|---:|---:|
| `ll_board_posts` | 3 | 3 → 0 |
| `ll_edit_requests` | 262 | 277 → 15 |
| `ll_notifications` | 12 | 83 → 71 |
| `ll_user_permissions` | 1 | 264 → 263 |
| `ll_work_items` | 2 | 68 → 66 |
| **합계** | **280** | 삭제 대상 readback **0행** |

모든 삭제 대상은 사전 백업 후 삭제했습니다. 이 문서에는 보안을 위해 백업 식별자, 내부 UUID, 삭제 행의 원문을 적지 않습니다.

## 4. 사용자 지정 테이블별 호출 여부

여기서 **직접 호출**은 Edge/API 코드가 테이블을 실제로 조회하거나 쓰는 경우입니다. **관리 catalog 호출**은 공통 Data Management 기능이 테이블 이름과 기본키를 사용해 접근하는 경우입니다.

| 요청 테이블 | 실재 여부 | 호출 여부 | 판단 |
|---|---|---|---|
| `ll_work_items` | 실재, 94행 | 직접 읽기·쓰기 | 유지. Work·Board·Weekly API가 한 테이블을 사용합니다. |
| `ll_weekly_records` | **통합 후 삭제** | 호출 없음 | 28행을 `ll_work_items`로 검증 이관한 뒤 삭제했습니다. |
| `ll_board_posts` | **통합 후 삭제** | 호출 없음 | 시험 데이터 정리 후 0행이었고 Board API 전환을 확인한 뒤 삭제했습니다. |
| `ll_user_permissions` | 실재 | 직접 읽기·쓰기 | 유지. 로그인 후 권한 판정의 기준입니다. |
| `ll_source_rows` | 실재 | 직접 읽기 | 유지. 출처 조회, preview, 수정 readback에 사용합니다. |
| `ll_source_files` | 실재 | 직접 읽기 | 유지. 활성 원본 파일과 workbook 구조 조회에 사용합니다. |
| `ll_market_deprecation_backups` | **삭제 완료** | 호출 없음 | 삭제. 4행 백업 테이블과 Edge catalog 참조를 제거했습니다. |
| `ll_cache_entries` | 실재 | 직접 읽기·쓰기 | 유지. 외부 API와 계산값 cache에 사용합니다. |
| `ll_spec_files` | **미존재** | 호출 없음 | rename 대상이 아닙니다. |
| `ll_asset_spec_files` | 실재, 23행 | 직접 읽기·쓰기 | 유지. 자산별 도면·사양 파일의 실제 테이블입니다. |
| `ll_lease_attributes` | 실재 | 직접 읽기·쓰기 | 유지. 세부 임대 속성 API가 사용합니다. |
| `ll_lease_spaces` | 실재 | 직접 읽기·쓰기 | 유지. 임차공간·공실·AI 조회가 사용합니다. |
| `ll_leases` | 실재 | 직접 읽기·쓰기 | 유지. 계약 API가 사용합니다. |
| `ll_edit_requests` | 실재 | 직접 읽기·쓰기 | 유지. 수정 승인과 readback 흐름이 사용합니다. |

주요 코드 근거:

- 권한·cache: [ll-dashboard-api/index.ts](C:/tmp/IGIS-Fund-Production-DP/supabase/functions/ll-dashboard-api/index.ts:901), [ll-dashboard-api/index.ts](C:/tmp/IGIS-Fund-Production-DP/supabase/functions/ll-dashboard-api/index.ts:1205)
- 임대 3테이블: [ll-dashboard-api/index.ts](C:/tmp/IGIS-Fund-Production-DP/supabase/functions/ll-dashboard-api/index.ts:2267)
- 자산 사양 파일: [ll-dashboard-api/index.ts](C:/tmp/IGIS-Fund-Production-DP/supabase/functions/ll-dashboard-api/index.ts:2491)
- 수정 요청: [ll-dashboard-api/index.ts](C:/tmp/IGIS-Fund-Production-DP/supabase/functions/ll-dashboard-api/index.ts:3635)
- source 파일·행: [ll-dashboard-api/index.ts](C:/tmp/IGIS-Fund-Production-DP/supabase/functions/ll-dashboard-api/index.ts:5122), [ll-dashboard-api/index.ts](C:/tmp/IGIS-Fund-Production-DP/supabase/functions/ll-dashboard-api/index.ts:5431)
- Work·Weekly: [ll-dashboard-api/index.ts](C:/tmp/IGIS-Fund-Production-DP/supabase/functions/ll-dashboard-api/index.ts:16239), [ll-dashboard-api/index.ts](C:/tmp/IGIS-Fund-Production-DP/supabase/functions/ll-dashboard-api/index.ts:16904)

## 5. 임대 3테이블 병합을 권장하지 않는 이유

임대 데이터는 **46 → 81 → 2,436**의 단계로 세분화됩니다.

1. `ll_leases` 46행: 계약 한 건의 공통 정보
2. `ll_lease_spaces` 81행: 한 계약 안의 층·구역·용도별 공간
3. `ll_lease_attributes` 2,436행: 계약 또는 공간에 붙는 세부 속성

쉽게 말하면 계약서 46건에 공간표 81줄이 있고, 각 공간과 계약에 세부 항목 2,436개가 붙은 구조입니다. 이를 한 테이블로 합치면 계약 기간·임차인 같은 공통 정보가 수십 번 반복되고, 해당되지 않는 컬럼은 대부분 비게 됩니다. 수정 시에도 같은 계약 정보를 여러 행에서 동시에 바꿔야 하므로 값이 서로 달라질 위험이 커집니다.

따라서 세 테이블은 **각자 유지**하고, 화면과 API에서 필요한 내용을 묶어 보여주는 현재 방식을 유지하는 것이 안전합니다.

## 6. `ll_source_files`와 `ll_source_rows` 보호 이유

두 테이블은 원본 Excel과 운영 데이터 사이의 추적 경로입니다.

- `ll_source_files`는 파일 단위 정보입니다. 파일명, 버전, 파일 해시, 검증 결과, sheet/column 구조를 담은 `workbook_schema`를 보존합니다.
- `ll_source_rows`는 행 단위 정보입니다. 어느 sheet의 몇 번째 행인지, 원본 값과 행 해시가 무엇인지 기록합니다.
- 네 개의 정규화 시장 테이블이 이 source 파일·행을 출처로 참조합니다.
- Data Management의 source preview, 수정 요청, write readback과 최신 자료 출처 표시에 사용됩니다.

기존 `ll_source_sheets`와 `ll_source_columns`은 `ll_source_files.workbook_schema`로 통합된 뒤 제거되었습니다. 따라서 현재의 `ll_source_files`와 `ll_source_rows`는 중복 잔여물이 아니라, 파일 수준과 행 수준을 나누어 보존하는 **최소 보호 구조**입니다. 관련 migration은 [20260713090000_retire_source_workbook_shadow_tables.sql](C:/tmp/IGIS-Fund-Production-DP/supabase/migrations/20260713090000_retire_source_workbook_shadow_tables.sql:8)입니다.

## 7. 컬럼 rename 후보

아래 항목은 이름을 더 쉽게 만들 수 있는 후보일 뿐이며, 즉시 rename 대상은 아닙니다. rename 전에는 Edge/API, 화면, QA, migration, 외부 연동을 모두 함께 바꿔야 합니다.

| 현재 컬럼 | 제안 이름 | 판단 |
|---|---|---|
| 여러 핵심 테이블의 `source_sheet_row_id` | `legacy_source_row_ref` | 과거 source 행을 가리키는 문자열이라는 의미가 더 분명합니다. 현재 코드 참조가 많아 전환 후 검토합니다. |
| `ll_work_items.legacy_text_id` | `source_record_key` | 과거 데이터에서 넘어온 원본 키라는 뜻을 명확히 할 수 있습니다. 고유 제약과 이관 코드도 같이 변경해야 합니다. |
| `ll_user_permissions.permission_id` | `legacy_permission_id` | 현재 기본키와 혼동될 수 있어, 레거시 식별자 역할이 확정되면 검토할 수 있습니다. |
| `ll_lease_spaces.e_noc` | `effective_noc_per_py` | 계산 단위가 더 분명해집니다. 다만 E. NOC는 현업 용어이고 코드 사용처가 매우 많아 우선순위가 낮습니다. |

다음 rename은 권장하지 않습니다.

- `ll_asset_spec_files` → `ll_spec_files`: `ll_spec_files`는 존재하지 않으며, 현재 이름이 “자산별 파일”이라는 범위를 더 정확히 설명합니다.
- `notification_id`, `asset_spec_id`, `source_file_id`, `source_row_id` → 일괄 `id`: 의미 있는 기본키 이름을 없애 오히려 관계를 이해하기 어려워집니다.

## 8. 물리 컬럼 순서 변경 비권장

PostgreSQL은 기존 테이블의 물리 컬럼 순서를 단순 명령으로 바꾸는 기능을 제공하지 않습니다. 순서를 바꾸려면 보통 다음 작업이 필요합니다.

1. 같은 구조의 새 테이블 생성
2. 전체 데이터 복사
3. PK, FK, index, RLS, 권한, trigger 재생성
4. 기존 테이블과 새 테이블 이름 교체
5. 모든 API와 운영 기능 readback

이 과정은 현재 654개 컬럼 전체에 불필요한 잠금·복사·누락 위험을 만듭니다. 컬럼 순서는 데이터의 의미나 조회 결과를 바꾸지 않으므로, **물리 순서는 유지**하고 문서·API select 목록·화면 그룹에서 논리적인 순서로 보여주는 방식을 권장합니다.

## 9. 완료된 `ll_market_deprecation_backups` 삭제

`ll_market_deprecation_backups` 4행은 이미 제거된 Market RAG/Storage의 이름과 건수만 보존한 임시 메타데이터였습니다. Edge catalog 참조를 제거한 뒤 다음의 제한된 migration으로 테이블을 삭제했습니다.

- migration: [20260714090000_remove_market_deprecation_backups.sql](C:/tmp/IGIS-Fund-Production-DP/supabase/migrations/20260714090000_remove_market_deprecation_backups.sql:1)
- 보호 검증: [ll-market-deprecation-backups-retirement.test.cjs](C:/tmp/IGIS-Fund-Production-DP/tests/ll-market-deprecation-backups-retirement.test.cjs:9)

이 migration은 `CASCADE`를 사용하지 않으며 `ll_source_files`, `ll_source_rows`, 임대 3테이블을 삭제하지 않는 계약 테스트가 있습니다. 이 단계에서 운영 catalog는 **27개 테이블**이 됐습니다.

## 10. 완료된 업무·주간 테이블 통합

- `ll_board_posts`: 정리 후 0행, API 직접 참조 0건, 승인 이력·외래키·뷰 의존성 0건을 확인했습니다.
- `ll_weekly_records`: 자산 20행, 프로젝트 7행, 보고서 1행을 `ll_work_items`로 이관했습니다.
- 이관 전후 행 수와 핵심값 checksum이 다르면 전체 transaction이 취소되도록 했습니다.
- 적용 후 `ll_work_items`는 94행이고 두 구 테이블은 존재하지 않습니다.
- migration: [20260714110000_consolidate_weekly_board_into_work_items.sql](C:/tmp/IGIS-Fund-Production-DP/supabase/migrations/20260714110000_consolidate_weekly_board_into_work_items.sql:1)
- Supabase Studio에서 역할을 쉽게 확인할 수 있도록 주요 테이블·PK·FK에 한국어 설명을 추가했습니다: [20260714120000_describe_canonical_ll_tables.sql](C:/tmp/IGIS-Fund-Production-DP/supabase/migrations/20260714120000_describe_canonical_ll_tables.sql:1)

## 11. 최종 권고

- 즉시 유지: 핵심 마스터, 임대 3테이블, source 2테이블, cache, 수정요청, 알림, 시장 데이터, 자산 사양 데이터
- 추가 통합검토: `ll_staff_profiles`의 권한/프로필 역할 재정리
- 삭제 완료: `ll_market_deprecation_backups`, `ll_board_posts`, `ll_weekly_records` 테이블
- 보류: 컬럼 rename과 물리 컬럼 순서 변경

현재 구조는 정리 전 28개에서 25개로 줄였으며, 나머지는 실제 화면 기능·관계·출처 추적을 보존하기 위해 유지합니다.
