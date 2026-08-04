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
| 로컬 restore | 관리 확장 포함 full 1, Gate 6 애플리케이션 375개 선택 restore 0 | PASS |
| Storage | metadata·원본 49/49, 총 113,226,015바이트, SHA-256 manifest | PASS |
| schema 격리 방식 | 동일 운영 프로젝트의 `logistics_core`·`logistics_api` additive schema | 승인 |

## G0. Repo·Live 동결 — PASS

- 원격 `main`과 `gh-pages`를 `ls-remote`로 직접 확인합니다.
- dirty 운영 작업공간과 clean archive를 섞지 않습니다.
- live HTML과 번들 파일명을 함께 기록합니다.
- 오래된 local tracking ref를 배포 기준으로 사용하지 않습니다.

## G1. 독립 복구 — PASS

통과 조건은 다음과 같습니다.

1. 애플리케이션 소유 schema·data·function·RLS restore 종료 코드 0
2. PK·FK·check·RLS·index·view·function·trigger readback
3. Auth 사용자-직원-권한 연결 readback
4. Storage 49개 원본 파일·크기·SHA-256 확보
5. archive source·Pages·Edge를 독립적으로 재조립하고 기존 public deep link를 readback
6. 기존 버전 archive rollback 경로를 15분 이내 재현

동일 dump snapshot으로 Gate 6 애플리케이션 객체 375개를 새 로컬 DB에 복원했고 종료 코드 0이었습니다. 27개 `public.ll_*` 테이블·총 27,512행·전체 내용 해시 27/27, 함수 7개, 제약 127개, 인덱스 121개, 트리거 2개, RLS 27개, 정책 1개가 일치했습니다. 이전의 운영-vs-dump 해시 24/27은 dump 이후 변경 가능한 동적 테이블 비교였으며, cutover 직전 동일 snapshot에서 다시 확인합니다.

전체 restore는 로컬 PostgreSQL에 Supabase 관리 확장인 `pg_net`, `postgis`, `supabase_vault`, `vector`가 없어 종료 코드 1입니다. 이 네 확장은 플랫폼 소유 inventory·버전·의존성 검증 대상으로 분리했고, Gate 6 소유 객체와 필수 Auth 참조는 선택 목록으로 종료 코드 0 복원했습니다. Storage 원본 49개·113,226,015바이트는 관리 권한으로 EFS 암호화 백업하고 파일별 SHA-256을 기록했습니다. archive source·Pages·Edge 재조립과 기존 live readback은 5.25초로 15분 기준 안에 통과했습니다.

## G2. 데이터 원천·누락 manifest — PARTIAL

각 자산·필드는 도메인별 공식 원천과 신규 저장 경로를 기록해야 합니다.

- 임대차·대출: `운영 Supabase → canonical → 신규 API → 신규 화면`
- 월별 actual 수익·비용·수납: `웹 입력 → 신규 API → canonical Supabase → primary readback`
- Excel: `historical_provenance` 또는 `ui_reference_only`; 운영값 이관 경로에 포함하지 않음

필수 속성은 마지막 운영 snapshot, 값, source table·PK·hash, 승인 상태, 불일치 사유입니다. 임대차와 대출은 Excel이 아니라 기존 `public.ll_*`를 공식 원천으로 사용합니다. 월별 actual 수익·비용·수납은 초기 0행이 정상이며 권한 있는 담당자의 `manual_input`으로 생성합니다. budget/forecast와 대출상환 수동입력은 금지하고, 기존 대출 원장에 월별 실제 상환 schedule이 없으면 `not_provided`로 표시합니다.

## G3. 운영 catalog·ERD — PARTIAL

- 27개 `public.ll_*` 테이블의 컬럼·행 수·용량·PK/FK/RLS/index/function/trigger와 코드 사용처를 전수조사합니다.
- 운영·source·cache·QA·log를 구분합니다.
- `logistics_core` old-to-new ERD, `logistics_api` RPC 계약, compatibility projection, reverse migration을 확정합니다.
- Preview branch는 만들지 않습니다. migration은 기존 객체를 수정하지 않는 additive schema SQL로 제한하고, 정적 계약 테스트·transaction rollback 검증 후 같은 프로젝트에 적용합니다.

## G4. SDD — PASS

DB·API·backfill·rollback·frontend·release 명세를 격리 브랜치에 확정했습니다. 2026-08-04 계약 감사에서 확인된 자산 공개키, 사용자 JWT RPC, 단일 writer, 월 원장 자연키, 계산 실행 주체, 만기 범위를 문서에 잠갔고, 이후 사용자 결정으로 임대차·대출의 운영 Supabase 원천, finance 웹 최초입력, 로그인 후 인앱 만기 조회를 재기준화했습니다. 원천 승인이 필요한 formula는 승인 전 금액을 만들지 않고 해당 계산·cutover만 차단합니다. 기능 구현은 수정된 실패 테스트를 먼저 작성하고, 운영 적용은 additive schema migration의 사전 검증 뒤에만 수행합니다.

필수 문서는 홈 필드, 렌트롤 열·붙여넣기·저장, 한국어 손익, formula registry, 8개 권한, 만기·인앱 알림, error/status, backfill·rollback 계약입니다.

## G5. TDD 실패 테스트 — PARTIAL

신규 구현 전 다음 테스트가 의도한 이유로 실패해야 합니다.

- DB PK/FK/check/RLS, 8개 권한, 반복 migration, backfill/reverse hash
- API auth, batch 원자성, idempotency, revision 409, timeout retry, commit readback
- 계산 렌트프리·인상률·월 경계·집계·발생/현금·NOI/NCF
- 브라우저 자산 전파, CRUD/붙여넣기, 새로고침/재로그인/idle, 탭 전환, 늦은 응답 차단

2026-08-04에 DB·API·계산·frontend 정적 계약 테스트를 먼저 작성하고 실행했습니다. 네 테스트는 모두 아직 구현되지 않은 계약 때문에 의도대로 실패했습니다. 이후 finance 최초입력과 인앱 알림 범위가 변경되었으므로 delivery table·이메일과 finance write 차단을 기대하던 테스트는 새 계약으로 다시 RED를 확인해야 합니다. 이 결과는 구현 완료가 아니라 RED 기준점입니다. 실제 PostgreSQL 반복 migration·backfill·reverse 실행 테스트와 브라우저 E2E 실패 테스트는 아직 남아 있으므로 G5를 `PASS`로 올리지 않습니다.

## G6~G10. 구현·배포 — 차단

R0와 R1 통과 전에는 SDD 문서와 의도적으로 실패하는 테스트 외의 구현을 진척으로 인정하지 않습니다. 이미 존재하는 schema·Edge·frontend 초안은 격리 보존하고 R1 승인 전 더 진행하거나 완료로 계산하지 않습니다. R0·R1 통과 뒤에는 공통 골격 구현을 시작할 수 있지만 임대료·대출 약정 계산처럼 formula 승인이 필요한 기능은 승인 전까지 비활성 상태를 유지합니다. 월별 actual 수익·비용·수납은 승인된 계정표와 웹 입력 검증을 갖춘 뒤 `manual_input`으로 활성화합니다. R1과 로컬 migration·backfill·reverse 리허설 통과 뒤에는 외부 grant·writer가 모두 비활성인 additive DDL만 같은 프로젝트에 1회 적용하여 R2 production shadow를 검증할 수 있습니다. 공개 권한·쓰기·Edge·frontend 활성화는 R3와 릴리스 게이트 통과 뒤에만 수행합니다.

## 필요한 추가 승인·입력

- finance cutover: actual 수익·비용·수납 계정표, 발생/현금 구분, 필수 입력·증빙·반올림 규칙이 필요합니다.
- 계산 cutover: 임대료 일할·Rent Free·인상과 대출 약정 지표 formula fixture 승인이 필요합니다.
