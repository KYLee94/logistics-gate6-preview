# Frontend·Browser Test SDD

상태: R0 PASS · R1 PARTIAL, 명세·실패 테스트만 진척 인정

## 정보 구조

| 탭 | 경로 | 책임 |
|---|---|---|
| 홈 | `/home` | 읽기 가능한 담당 자산, 임대차·펀드·대출 최근 만기, 검증된 핵심값 |
| 렌트롤 | `/rent-roll` | 계약·공간·임대료 이력의 Excel형 projection CRUD |
| 수익·비용 | `/income-expense` | 월별 원장, 한국어 손익, 의사결정 KPI, 브라우저 시나리오 |

로그인 후 기본 경로는 `/home`입니다. 로그인 직후 공통 셸과 홈은 권한 있는 자산의 인앱 만기 알림을 primary로 조회합니다. 로그인·알림·권한은 공통 셸의 설정·팝업으로 이동합니다. 미이관 기능은 신규 화면으로 위장하지 않고 이전 archive에 보존되었다고 안내합니다.

deep link 상태는 공개 자산 키, 기준일, 시작·종료월, 월/분기/연도, 발생/현금, 실제/예산/예측만 허용합니다. UUID·DB PK·raw source ID는 URL과 화면에 노출하지 않습니다.

## 공통 상태 계약

| 상태 | 기존 값 | 성공 판정 |
|---|---|---|
| `initial-loading` | 없음 | 아님 |
| `primary-ready` | 최신 primary | 성공 |
| `refreshing-primary` | 유지 | 이전 성공 유지, 새 요청 미완료 |
| `stale-visible` | 경고와 함께 유지 | 실패 |
| `saving` | 사용자 초안 유지 | 미완료 |
| `readback` | commit 전 값 유지 | 미완료 |
| `save-confirmed` | primary readback | 성공 |
| `conflict` | 사용자 초안 유지 | 실패 |
| `auth-required`/`forbidden`/`error` | 민감 데이터 제거 | 실패 |

- stale, fallback, timeout, 401, 403, local fixture는 `primary-ready`가 될 수 없습니다.
- background refresh 성공 전 기존 primary 값을 지우지 않습니다.
- 새 snapshot은 사용자·자산·기간·revision이 모두 같은 경우 원자적으로 교체합니다.
- 진행률은 완료된 실제 작업 수/전체 작업 수로 계산합니다.
- 상태는 색상뿐 아니라 한국어 문구, 아이콘, `aria-live`로 전달합니다.

## 요청 생명주기

- 활성 탭의 선택 자산·기간만 조회합니다.
- 비활성 탭은 실제로 unmount하고 요청·timer를 중단합니다.
- 탭 전환, 자산/기간 변경, 로그아웃 시 `AbortController`로 관련 요청을 취소합니다.
- 각 요청에 generation을 부여하고 시작 당시 사용자·자산·기간·generation이 현재와 모두 같을 때만 반영합니다.
- 이전 요청의 늦은 응답은 화면과 캐시를 갱신하지 않습니다.
- 저장 성공 후 해당 자산·기간 읽기 캐시를 무효화하고 primary readback합니다.

## 홈

KST 기준 임대차·펀드·대출의 최근 만기를 각각 표시합니다. 자산명, 대상명, 만기일, 남은 일수, 상태, 수정 링크가 필요합니다. 만기일이 없으면 `만기 정보 미등록`으로 표시하며 샘플 날짜를 만들지 않습니다.

30·7·3·1·0일 인앱 schedule은 로그인 사용자의 현재 read 권한으로 필터링합니다. 같은 `(maturity_id, maturity_revision, lead_days)`는 한 번만 표시하고, 권한 밖 만기 존재 여부를 노출하지 않습니다. 외부 이메일·Push 발송, 수신자 설정, provider 상태 UI는 만들지 않습니다.

자산개요→투자개요→펀드개요 순서의 세로 구조를 사용합니다. 실제 값이 있는 필드를 우선하고 상세값은 펼침 영역에 둡니다. 값이 없으면 `확인된 데이터 없음`으로 표시합니다.

## 렌트롤

화면은 하나의 표지만 DB의 계약·공간·임대료 이력을 합치지 않습니다. 운영값은 기존 `public.ll_*`를 canonical source로 읽어 구성하며 Excel 셀값을 가져오거나 덮어쓰지 않습니다. `06-rent-roll-reference-mapping.md`의 4개 `ui_reference_only` workbook을 사용해 공통 그리드 구조만 통합합니다. 필드는 임차인, 사업자번호, 용도, 층·구역, 임대/전용면적, 계약기간, 임대료·관리비·보증금, 평당 금액, 렌트프리, 공사·인테리어 지원, 인상률·주기, 특수조건, 미수, 현재/종료 상태와 가격 이력을 포함합니다.

주 그리드 열 순서는 `식별·상태 → 공간 → 계약기간 → 보증금 → 임대료 → 관리비 → 감면 → 인상 → 상세`로 고정합니다. 네 참고자료 공통 필드는 주 그리드에, 관리비·용도·총액/평당 쌍과 파일별 특수필드는 null 허용 선택 열 또는 상세 drawer에 둡니다. 숨김 초안, 합계·주석·장식 열, Excel formula cached result는 화면 입력이나 canonical data로 사용하지 않습니다.

### 편집 계약

- 키보드 이동, 셀/행/범위 선택, TSV/CSV 다중 붙여넣기를 지원합니다.
- 붙여넣기 전 행·열 수, 자료형, 단위, 필수값, 날짜 순서, 음수 허용 여부를 검증합니다.
- 하나라도 잘못된 셀이 있으면 전체 저장을 차단하고 오류 위치·이유를 표시합니다.
- 신규·수정·아카이브를 구분하고 저장 전 diff와 건수 요약을 보여줍니다.
- 빈 문자열, `-`, `자료 없음`을 숫자 0으로 저장하지 않습니다.
- 삭제는 soft delete/아카이브이며 물리 삭제가 아닙니다.

### 저장 계약

요청은 `client_request_id`, `base_revision`, 공개 자산 키, create/update/archive patch, 조정 사유를 포함합니다.

1. 클라이언트 검증
2. 변경 미리보기
3. 저장 잠금
4. 하나의 transaction 요청
5. mutation ID·write revision 확인
6. 별도 primary 재조회
7. 요청값과 readback 비교
8. 일치할 때만 저장 완료
9. 새로고침·재로그인 유지 확인

더블클릭과 timeout 재시도는 같은 request ID를 사용합니다. 여러 행·셀은 전부 성공하거나 전부 rollback됩니다. 409는 자동 덮어쓰기하지 않고 서버 최신값·사용자 초안·충돌 필드를 보여줍니다.

## 수익·비용

고정 순서는 `잠재총수입 → 공실·감면·미수 손실 → 유효총수입 → 운영비용 → 순영업소득 → 자산 순현금흐름 → 부채상환 후 현금흐름`입니다. 표와 waterfall은 같은 formula registry를 사용합니다.

발생/현금, 렌트롤 계산 임대수입/실제값/조정금액·사유를 구분합니다. 월별 원본에서 분기·연도를 집계하고 근거 월을 펼칠 수 있어야 합니다.

초기 actual 수익·비용·수납 행 0건은 오류가 아니라 입력 전 정상 상태입니다. 화면은 `확인된 입력 없음`과 입력 CTA를 표시하고 권한 있는 사용자가 월·계정·발생/현금·금액·사유를 직접 입력할 수 있어야 합니다. 저장 API가 `source_kind=manual_input`을 확정하며 화면은 source 종류나 임의 source ref를 입력받지 않습니다. 빈 값·NULL·숫자 0을 구분하고 수납은 `cash`만 허용합니다. budget/forecast와 대출상환 입력 UI는 제공하지 않으며 직접 API 요청도 거절됩니다.

운영 원장 입력과 아래 브라우저 시나리오는 별도 상태입니다. 운영 actual 입력은 Supabase에 영구 저장하고 primary readback해야 하지만, 가정 시나리오는 메모리 전용입니다. 기존 대출 원장의 월별 실제 상환 schedule이 없으면 부채상환 후 현금흐름을 완전한 값으로 표시하지 않고 `자료 미제공`과 누락 구성요소를 보여줍니다.

시나리오 입력은 브라우저 메모리에만 보관합니다. 새로고침하면 초기화되고 DB mutation 및 영구 local/session storage 기록은 0이어야 합니다. 계산은 권위 서버 action `v2/calculations/explain`에 read-only 요청하여 formula version·test vector hash와 결과를 함께 받고, 브라우저 자체 수식 실행은 금지합니다. 임의 시장 가정을 운영값처럼 자동 입력하지 않습니다.

공개 자산 식별자는 모든 요청의 `payload.asset_key`와 화면·URL에서만 사용합니다. 내부 UUID는 응답에 있더라도 계약 위반으로 폐기합니다. 기존 `{action,payload}` 전송 wrapper를 유지하며, 렌트롤·수익비용 저장 응답은 행별 공개키·operation·revision, mutation ID, readback hash를 확인한 뒤 별도 read action 결과와 비교합니다. archive 행은 `delete_reason`이 필수입니다.

## TDD 매트릭스

| ID | 실패 시나리오 | 기대 |
|---|---|---|
| AUTH-01 | JWT 없음·오류·만료 | 로그인 복귀 또는 401, 데이터 미노출 |
| AUTH-02 | 읽기 전용 사용자의 mutation | 버튼 비활성, 직접 API 403 |
| AUTH-03 | URL 자산 키 변조 | 권한 밖 데이터 0, 안전한 자산으로 전환 |
| NAV-01 | 세 경로 새로고침 | 동일 탭·허용 상태 복원 |
| LOAD-01 | 자산 A 느린 응답 후 B 선택 | A 응답이 B 화면을 덮지 않음 |
| LOAD-02 | 비활성 탭 | 요청·timer 0 |
| LOAD-03 | refresh 실패 | 기존 primary 유지+실패 표시 |
| RENT-01 | 정상 TSV 붙여넣기 | 셀 배치·변환 일치 |
| RENT-02 | 한 셀 날짜 오류 | 전체 저장 차단, 위치 표시 |
| RENT-03 | 여러 행 중 한 행 DB 오류 | 부분 반영 0 |
| RENT-04 | 중복 클릭·timeout 재시도 | 같은 ID, 중복 행 0 |
| RENT-05 | 오래된 revision | 409, 자동 덮어쓰기 0 |
| RENT-06 | commit 후 readback 불일치 | 성공 표시 0 |
| RENT-07 | 참고 Excel과 운영 Supabase 값 충돌 | 운영 Supabase 값 유지, Excel 자동 import·덮어쓰기 0 |
| RENT-08 | 공통/선택/특수 필드 렌더링 | 공통 열 순서 유지, 선택 필드는 null/drawer, 숨김 초안·합계·수식 입력 0 |
| FIN-01 | golden 월 fixture | 모든 소계·NOI·NCF 일치 |
| FIN-02 | 월→분기→연도 | 같은 월 원본 합계와 일치 |
| FIN-03 | 이자·CapEx·감가상각 | NOI 운영비용 혼합 0 |
| FIN-04 | 시나리오 변경 | 브라우저 값만 변경, mutation 0 |
| FIN-05 | 초기 actual 행 0건 | primary 빈 상태와 입력 CTA, 자동 0행 생성 0 |
| FIN-06 | actual 수익·비용·수납 저장 | `manual_input` audit·mutation ID·revision·primary readback 일치 |
| FIN-07 | budget/forecast·대출상환 수동입력 | UI 없음, 직접 API `BUSINESS_RULE_VIOLATION` |
| FIN-08 | 월별 대출상환 schedule 부재 | repayment 행 0, post-debt `incomplete` 표시 |
| ALERT-01 | 로그인 사용자별 30·7·3·1·0 만기 조회 | 권한 밖 0, 같은 alert key 중복 0 |
| ALERT-02 | 만기일 revision 변경 | 구 schedule 미표시, 새 revision만 표시 |
| LIFE-01 | 저장 후 새로고침·재로그인 | primary 값 유지 |
| LIFE-02 | 15분 idle 후 복귀 | 새로고침 없이 primary 재조회 |
| LIFE-03 | 탭 30회 전환 | 요청 누수·무한 로딩·overlay 0 |
| A11Y-01 | axe WCAG 2.2 AA | serious·critical 0 |
| RESP-01 | 390×844, 768×1024, 1440×900, 1600×1100 | 핵심 기능 잘림·겹침 0 |

## 현재 RED 실행 증거

실행일은 2026-08-04이며, 네 테스트 모두 외부 네트워크와 운영 DB 쓰기 없이 격리 worktree의 명세·초안만 검사했습니다. 실패는 테스트 자체의 오류가 아니라 아직 구현되지 않은 SDD 계약을 먼저 고정한 결과입니다.

| 계약 테스트 | 실행 명령 | 의도한 실패 범주 |
|---|---|---|
| DB | `node scripts/qa/logistics-data-platform-db-contract.cjs` | 수익권 tranche·만기 자산 범위·feature flag·월 원장 원천키·RLS·backfill/reverse gate 부재, core 함수 직접 grant 노출 |
| API | `node scripts/qa/logistics-data-platform-api-contract.cjs` | 점검 모드 503 계약·읽기/쓰기 grant 분리·platform feature flag 부재 |
| 계산 | `node scripts/qa/logistics-data-platform-formula-contract.cjs` | formula 승인 상태·test vector hash·미승인 실행 차단 함수 부재 |
| frontend | `node scripts/qa/logistics-data-platform-frontend-contract.cjs` | actual finance 웹 `manual_input`, budget/forecast·대출상환 차단, 인앱 만기, 렌트롤 reference-only 계약 부재 |

`network_used=false`, `production_database_write_used=false`입니다. 실제 DB runtime RED는 로컬 PostgreSQL에서 migration을 반복 실행하고 일부러 잘못된 FK·권한·revision·hash를 넣는 테스트로 보강합니다. 브라우저 RED는 세 deep link, 늦은 응답, 탭 unmount, 새로고침·재로그인·15분 idle을 자동화한 뒤 G5 재판정에 포함합니다.
