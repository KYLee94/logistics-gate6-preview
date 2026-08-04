# Gate 6 데이터 플랫폼 로컬 구현 검증 결과

검증일은 2026-08-04이며, 대상은 운영 DB가 아니라 암호화 보관된 R0 복구본에서 만든 별도 로컬 데이터베이스입니다. 운영 Supabase, Edge Function, GitHub Pages에는 이 구현을 아직 적용하지 않았습니다.

## 1. 실행 범위

- `20260804090000_logistics_data_platform_core.sql`
- `20260804091000_logistics_data_platform_api.sql`
- `20260804092000_logistics_data_platform_backfill.sql`
- `logistics_core` 비공개 정규화 schema
- `logistics_api` RPC 전용 공개 schema
- Edge `v2/*` 라우터와 `/home`, `/rent-roll`, `/income-expense` frontend

`public.ll_*`에는 삭제, 이름 변경, 열 변경을 수행하지 않았습니다. 로컬 C rehearsal에서는 세 migration을 처음부터 순서대로 실행한 뒤 backfill을 한 번 더 실행했습니다.

## 2. 기존 대출 검증

| 확인 항목 | 결과 |
| --- | ---: |
| 운영 복구본 loan 원천 행 | 59 |
| 운영 복구본 active loan 행 | 51 |
| 신규 `logistics_core.loans` 행 | 59 |
| 신규 active loan 행 | 51 |
| 대주 연결 행 | 55 |
| 중복 loan code | 0 |
| 임의 생성된 월별 상환 행 | 0 |
| open critical migration exception | 0 |

두 번의 backfill 뒤에도 target 대출 행 수는 59건으로 유지됐습니다. 기존 원천에 월별 상환 schedule이 없으므로 모든 대출은 `repayment_schedule.status=not_provided`, `rows=[]`로 반환합니다.

실제 Auth UUID 권한을 설정한 로컬 RPC 검증에서 인천석남 자산은 홈과 수익·비용 조회 모두 기존 대출 6건을 `status=primary`로 반환했습니다. 반환된 6건은 모두 `source_status=canonical`이었고 합성 상환행은 없었습니다.

## 3. 재무 최초 입력 상태

- 초기 `monthly_ledger_entries`: 0행
- 조회 상태: `not_entered`
- 수기 입력 계정 metadata: 수익, 비용, 수납 3개
- production shadow write flag: `false`
- formula 상태: `draft`
- budget, forecast, 대출상환 수기 입력: 금지 계약

초기 0행은 누락 오류가 아니라 담당자가 웹에서 처음 입력하기 전의 정상 상태입니다. 운영 쓰기는 pilot 승인 전까지 server flag와 asset writer route로 잠깁니다.

로컬 트랜잭션에서만 쓰기 잠금을 임시로 연 뒤 `MANUAL_REVENUE` 12,345원을 저장했습니다. 결과는 `status=primary`, `changed_count=1`, readback 1행, `source_kind=manual_input`, 서버 생성 `source_ref`로 확인됐습니다. 같은 `client_request_id`를 재전송했을 때 응답이 같았고 중복 행은 생기지 않았습니다. 검증 트랜잭션은 마지막에 전부 rollback했습니다.

서버 거절 계약도 실제 실행했습니다. budget 입력, 발생 기준 수납, 사유 누락, `NaN` 금액은 모두 `PT422`로 거절됐습니다.

## 4. 자동 검증

- DB 정적 계약: PASS
- API 정적·모듈 계약: PASS
- 계산 golden fixture: PASS
- Finance 수기 입력 frontend 계약: PASS
- 범용 렌트롤 계약: PASS
- 신규 frontend 계약: PASS
- 대상 ESLint: PASS
- Edge Deno type check: PASS
- `build:preview`: PASS
- GitHub Pages deep-link 산출물: `/home`, `/rent-roll`, `/income-expense` 생성 확인

전체 repository lint는 신규 범위 밖의 기존 `LogisticsSectorModules.jsx` 미사용 변수와 Hook 경고가 남아 있으므로 별도 정리 전 release gate PASS로 올리지 않습니다.

## 5. 아직 수행하지 않은 작업

- 운영 Supabase additive migration 적용
- 운영 Edge 배포
- 서버 feature flag를 이용한 3인 pilot 쓰기 개방
- pilot 실제 CRUD와 readback
- main 반영과 GitHub Pages 전환

위 항목은 로컬 검증 결과를 보존한 커밋을 만든 뒤 운영 shadow 적용과 pilot 순서로 수행합니다.
