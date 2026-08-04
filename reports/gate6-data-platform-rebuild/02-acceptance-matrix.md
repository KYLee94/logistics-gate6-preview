# 제품 인수 기준 매트릭스

## 복구·데이터

| ID | 기준 | 현재 |
|---|---|---|
| ARC-01 | main·Pages·dirty가 각각 별도 hash/manifest로 보존됨 | PASS |
| ARC-02 | DB roles/schema/data/full dump가 암호화 보존됨 | PASS |
| ARC-03 | Supabase 관리 확장과 Gate 6 소유 객체 책임 분리, 애플리케이션 restore 종료 코드 0 | PASS |
| ARC-04 | 동일 dump snapshot 27개 `ll_*` count/hash parity | PASS |
| ARC-05 | Storage 49개 원본·크기·SHA-256 | PASS |
| ARC-06 | Auth 사용자·직원·권한 행 수와 연결 관계 복원 parity | PASS |
| ARC-07 | 동일 프로젝트 additive schema의 15분 rollback | NOT STARTED |
| DAT-01 | 임대차·대출은 운영 Supabase→canonical→API→화면 mapping, Excel은 historical provenance 또는 UI reference로만 분류 | PARTIAL |
| DAT-02 | critical migration exception 0 | BLOCKED |
| DAT-03 | 초기 0행에서 actual 수익·비용·수납을 웹 `manual_input`으로 저장하고 샘플·추정·자동 0 생성 0건 | BLOCKED |

## DB·API

| ID | 기준 |
|---|---|
| DB-01 | `logistics_core` 테이블은 외부 직접 접근이 없고 `logistics_api` RPC만 노출합니다. |
| DB-02 | PK/FK/check/RLS/index가 8개 권한 truth table과 함께 검증됩니다. |
| DB-03 | migration과 backfill을 두 번 실행해도 결과 hash가 같습니다. |
| DB-04 | 모든 중요 행에 old PK, new UUID, source/target hash, 상태가 있습니다. |
| DB-05 | 신규 write와 legacy projection이 하나의 transaction에서 commit/rollback됩니다. |
| API-01 | JWT 없음·오류·만료는 401, 권한 부족은 403이며 `ok:true`가 아닙니다. |
| API-02 | 정상 응답만 `{ok:true,status:"primary",request_id,revision,data}`입니다. |
| API-03 | batch 일부 오류는 전체 rollback되고 readback에서 변경이 없습니다. |
| API-04 | `(auth_uid, action, client_request_id)` 재시도는 중복 행을 만들지 않습니다. |
| API-05 | revision 충돌은 409이며 최신 revision을 제공합니다. |
| API-06 | timeout·stale·fallback을 정상 성공으로 포장하지 않습니다. |

## 홈·렌트롤·수익비용

| ID | 기준 |
|---|---|
| HOME-01 | 읽기 가능한 담당 자산만 선택할 수 있습니다. |
| HOME-02 | 임대차·펀드·대출의 최근 만기와 검증된 핵심값만 표시합니다. |
| HOME-03 | 내부 UUID·raw source key를 화면에 노출하지 않습니다. |
| RENT-01 | 계약·공간·임대료 이력은 DB에서 분리되고 표에서만 합쳐집니다. |
| RENT-02 | 행 추가·다중 붙여넣기·검증·soft delete·변경 요약·readback을 지원합니다. |
| RENT-03 | 새로고침·재로그인 뒤 primary readback 값이 유지됩니다. |
| RENT-04 | `260804_렌트롤 참고자료` 4종의 공통 열은 범용 그리드에, 선택·특수 필드는 상세 영역에 매핑하며 Excel 셀값은 운영 이관에 사용하지 않습니다. |
| FIN-01 | 월별 원장만 원본이며 분기·연도 합계가 월 합계와 정확히 일치합니다. |
| FIN-02 | actual/budget/forecast와 accrual/cash를 명확히 구분합니다. |
| FIN-03 | NOI=`유효총수입-운영비용`, NCF·부채상환 후 현금흐름을 분리합니다. |
| FIN-04 | 입력값·계산값·조정금액·사유·formula version을 설명할 수 있습니다. |
| FIN-05 | 시나리오 입력은 브라우저 메모리에만 두고, 계산은 서버 `v2/calculations/explain`이 수행하며 운영 DB에 저장하지 않습니다. |
| FIN-06 | 운영 웹 저장은 actual 수익·비용·수납만 허용하고 `manual_input` provenance·audit·primary readback을 남깁니다. budget/forecast와 대출상환 수동입력은 거절합니다. |
| FIN-07 | 기존 대출 원장의 월별 실제 상환 schedule이 없으면 대출상환 행은 0건이고 부채상환 후 현금흐름은 `not_provided` 또는 `incomplete`로 표시합니다. |

## 권한·인앱 알림·브라우저

| ID | 기준 |
|---|---|
| AUTH-01 | 담당/기타 자산 × CRUD 8개 판정이 SQL·API·UI에서 같습니다. |
| AUTH-02 | 이름·이메일·역할 하드코딩으로 권한을 우회하지 않습니다. |
| AUTH-03 | 기존 전체 권한은 명시적 회수 승인 전까지 유지됩니다. |
| ALERT-01 | KST 30·7·3·1·0일 schedule과 만기 변경 시 구 revision 취소·새 revision 생성을 검증합니다. |
| ALERT-02 | 로그인 사용자의 읽기 권한이 있는 자산 만기만 표시하며 같은 `(maturity_id, revision, lead_days)`는 한 번만 반환합니다. |
| ALERT-03 | Resend·DNS·Cron·provider webhook·외부 이메일 호출·delivery outbox가 신규 범위에 0건입니다. |
| UI-01 | 비활성 탭은 unmount되고 요청·timer가 중단됩니다. |
| UI-02 | background refresh 성공 전 기존 primary 값을 지우지 않습니다. |
| UI-03 | abort와 request generation으로 늦은 응답이 최신 화면을 덮지 못합니다. |
| UI-04 | 15분 idle, 반복 탭 전환, deep link, 새로고침, 재로그인을 통과합니다. |

## 릴리스

| ID | 기준 |
|---|---|
| REL-01 | 3인 pilot이 실제 CRUD·권한·계산·로그인 후 인앱 만기 알림을 확인합니다. |
| REL-02 | lint, SQL/Node contract, `build:preview`, `check:edge`, `qa:v2:release-gate`, advisor가 모두 통과합니다. |
| REL-03 | Edge→frontend 순으로 배포하고 live root·세 deep link를 readback합니다. |
| REL-04 | 실패 시 신규 delta reverse sync와 archive 재배포가 15분 안에 끝납니다. |
| REL-05 | 기존 frontend·DB 삭제는 안정화 후 별도 통합 승인으로 남습니다. |
