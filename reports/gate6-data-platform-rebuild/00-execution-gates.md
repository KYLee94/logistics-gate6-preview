# 실행·승인·차단 게이트

작성 기준일: 2026-08-04

## 판정 체계

- `PASS`: 운영 원천과 readback 증거가 모두 존재합니다.
- `PARTIAL`: 일부만 확인되었으며 성공으로 보고하지 않습니다.
- `BLOCKED`: 추가 권한·비용·원천이 없으면 진행할 수 없습니다.
- `FAIL`: 실행했으나 요구 기준을 충족하지 못했습니다.

fallback, stale cache, local-only 결과는 `PASS`가 될 수 없습니다.

## 현재 기준점

| 항목 | 확인값 | 판정 |
|---|---|---|
| clean main | `c3e3f51adf5deb324f38d76da3a331f63dd37c87` | PASS |
| 실제 원격 Pages | `9809c960bb373ed10a69e9adfb766677bf672d2d` | PASS |
| live root·deep link | root, `home`, `data-management/lease-contracts`, `market-data/overview` HTTP 200 | PASS |
| live main bundle | `index-B0dMdzaQ.js`, SHA-256 `BB5912395966A075778231D34CC6DE6C31697304F6644F2D8CE42BA8E1125C8F` | PASS |
| archive | branch·annotated tag·GitHub Release 생성 | PASS |
| 운영 DB dump | roles·full·schema·data 종료 코드 0, EFS 암호화 | PASS |
| 운영 Edge | 8개 원격 소스·배포 목록 보존, `ll-dashboard-api` v545 | PASS |
| 로컬 restore | roles 0, full 1 | FAIL |
| Storage | metadata 49개, 원본 다운로드 0/49 | FAIL |
| staging branch | 0개 | BLOCKED |

## G0. Repo·Live 동결 — PASS

- 원격 `main`과 `gh-pages`를 `ls-remote`로 직접 확인합니다.
- dirty 운영 작업공간과 clean archive를 섞지 않습니다.
- live HTML과 번들 파일명을 함께 기록합니다.
- 오래된 local tracking ref를 배포 기준으로 사용하지 않습니다.

## G1. 독립 복구 — BLOCKED

통과 조건은 다음과 같습니다.

1. DB 전체 restore 종료 코드 0
2. PK·FK·check·RLS·index·view·function·trigger readback
3. Auth 사용자-직원-권한 연결 readback
4. Storage 49개 원본 파일·크기·SHA-256 확보
5. 운영 유사 staging에서 Edge·DB·Auth·Storage 통합 복구
6. 신규 delta까지 포함한 15분 rollback

현재 로컬 restore는 27개 `public.ll_*` 테이블의 행 수가 모두 일치하고 총 27,512행이 복구되었습니다. UTC 기준 내용 해시는 24개가 일치했습니다. `ll_news_items`, `ll_notifications`, `ll_sector_market_lease_observations`는 행 수만 일치하고 해시는 다릅니다. dump 이후 변경 가능성을 배제할 수 없으므로 동일 시점 snapshot 재검증 전에는 parity 성공으로 보지 않습니다.

전체 restore는 `pg_net`, `postgis`, `supabase_vault`, `vector` 확장 부재로 종료 코드 1입니다. Storage는 기존 사용자 RLS로 49개 원본 전부 거부되었습니다.

## G2. 데이터 원천·누락 manifest — BLOCKED

각 자산·필드에 다음 연결을 기록해야 합니다.

`Excel 원본 → 기존 Supabase → 기존 API → 기존 화면 → 신규 필드`

필수 속성은 마지막 정상 버전, 값, 원천, source hash, 승인 상태, 불일치 사유입니다. 불일치는 자동 선택하지 않고 migration exception으로 차단합니다. 월별 수익·비용·수납·대출상환 원천이 없으면 finance cutover를 차단합니다.

## G3. 운영 catalog·ERD — BLOCKED

- 27개 `public.ll_*` 테이블의 컬럼·행 수·용량·PK/FK/RLS/index/function/trigger와 코드 사용처를 전수조사합니다.
- 운영·source·cache·QA·log를 구분합니다.
- `logistics_core` old-to-new ERD, `logistics_api` RPC 계약, compatibility projection, reverse migration을 확정합니다.
- staging 없는 migration 실행은 금지합니다.

## G4. SDD — 진행 가능

복구 게이트 미통과 상태에서 허용되는 작업은 문서화, 읽기 전용 조사, 테스트 설계뿐입니다. DB migration·Edge·frontend 기능 코드는 작성하지 않습니다.

필수 문서는 홈 필드, 렌트롤 열·붙여넣기·저장, 한국어 손익, formula registry, 8개 권한, 만기·메일, error/status, backfill·rollback 계약입니다.

## G5. TDD 실패 테스트 — G1~G4 후 진입

신규 구현 전 다음 테스트가 의도한 이유로 실패해야 합니다.

- DB PK/FK/check/RLS, 8개 권한, 반복 migration, backfill/reverse hash
- API auth, batch 원자성, idempotency, revision 409, timeout retry, commit readback
- 계산 렌트프리·인상률·월 경계·집계·발생/현금·NOI/NCF
- 브라우저 자산 전파, CRUD/붙여넣기, 새로고침/재로그인/idle, 탭 전환, 늦은 응답 차단

## G6~G10. 구현·배포 — 차단

G1~G5 통과 전에는 schema, backfill, Edge, 이메일, frontend, pilot, cutover를 시작하지 않습니다. 이후에도 Edge→frontend 순으로 배포하고 실패 시 쓰기 잠금→reverse sync→archive Edge/Pages 재배포→구화면 readback을 15분 안에 수행합니다.

## 필요한 추가 승인·입력

- Supabase Preview branch: 현재 branch 0개이며 Micro 기준 시간당 USD 0.01344부터 사용량 과금이 발생합니다.
- Storage 관리 백업: service-role 또는 동등한 관리 권한을 비공개 방식으로 제공해야 합니다.
- 이메일 cutover: Resend API key, 회사 발신 도메인 SPF·DKIM, 실제 수신함이 필요합니다.
- finance cutover: 월별 수익·비용·수납·대출상환 원천이 필요합니다.
