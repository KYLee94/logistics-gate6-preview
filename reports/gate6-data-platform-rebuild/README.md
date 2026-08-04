# Gate 6 물류센터 데이터 관리 플랫폼 재구축

## 현재 판정

상태: **R0 독립 복구 PASS · R1 원본 mapping PARTIAL · 운영 적용 차단**

이 디렉터리는 기존 운영본을 독립 복구 가능한 상태로 보존한 뒤 `홈 / 렌트롤 / 수익·비용` 플랫폼을 SDD·TDD 순서로 구축하기 위한 실행 명세와 증거를 모읍니다. R0는 기존 운영본의 DB·Auth·Storage·Edge·Pages 복구 가능성을 검증하는 단계이며 통과했습니다. R1은 도메인별 공식 원천·기존 API·화면·신규 필드의 의미를 연결하는 단계로 아직 진행 중입니다. 임대차와 대출은 기존 운영 Supabase 저장값을 공식 이관 원천으로 사용하고, 월별 actual 수익·비용·수납은 초기 0행에서 웹 `manual_input`으로 시작합니다. Excel은 historical provenance 또는 렌트롤 UI 구조 참고자료일 뿐 운영값 이관 원천이 아닙니다. R0·R1 통과 전에는 SDD 문서와 의도적으로 실패하는 테스트만 진척으로 인정합니다. 이미 작성된 migration·Edge·frontend 초안은 격리 상태로 보존하며 R1 승인 뒤 계약에 맞게 수정합니다. R1과 로컬 리허설 통과 뒤에만 같은 프로젝트에 외부 권한·writer가 없는 비노출 additive DDL을 1회 적용해 R2를 검증할 수 있습니다. 공개 권한 부여·쓰기 활성화·배포는 신규 delta rollback을 포함한 R3 및 릴리스 게이트 통과 뒤에만 수행합니다.

## 고정 기준점

| 구분 | 확인값 |
|---|---|
| clean `main` | `c3e3f51adf5deb324f38d76da3a331f63dd37c87` |
| 실제 원격 `gh-pages` | `9809c960bb373ed10a69e9adfb766677bf672d2d` |
| archive Release | `gate6-pre-data-platform-20260804` |
| 격리 개발 브랜치 | `codex/gate6-data-platform-rebuild` |
| 격리 worktree | `C:\tmp\IGIS-Fund-Production-DP-data-platform` |

## 완료된 보존 작업

- clean main과 실제 Pages를 각각 archive branch 및 annotated tag로 고정했습니다.
- 공개 Release에는 clean main 소스, 실제 Pages 배포본, redacted SHA-256 manifest만 첨부했습니다.
- 821개 dirty 상태 항목은 tracked patch, 미추적 원본, 파일 목록, 크기, SHA-256으로 로컬 분리 보존했습니다. 원래 dirty 작업공간의 파일은 이동·삭제·되돌리기하지 않았습니다.
- 운영 DB roles·전체 custom dump·schema SQL·data custom dump·catalog·Storage metadata를 Windows EFS 암호화 폴더에 저장했습니다.
- 운영 Edge 함수 8개의 배포 목록과 원격 소스를 같은 암호화 폴더에 저장했습니다.
- Gate 6 애플리케이션 객체 375개를 별도 로컬 DB에 종료 코드 0으로 복원하고, 27개 테이블·27,512행·전체 내용 해시 27/27과 제약·인덱스·RLS를 확인했습니다.
- source·Pages archive와 Edge 8개를 5.25초 안에 재조립하고 live 기존 경로·번들 hash를 readback했습니다.

## 복구 검증 결과

| 검증 | 결과 | 판정 |
|---|---|---|
| 운영 DB dump | roles/schema/data/full 모두 종료 코드 0 | 통과 |
| 로컬 roles 복원 | 종료 코드 0 | 통과 |
| 로컬 전체 DB 복원 | Supabase 관리 확장 4개는 플랫폼 책임으로 분리; Gate 6 소유 객체 375개 선택 복원 종료 코드 0 | 통과 |
| `public.ll_*` 행 수 readback | 27개 테이블 전부 일치, 총 27,512행 | 통과 |
| 동일 dump snapshot `public.ll_*` 내용 해시 | 27/27 일치 | 통과 |
| 운영-vs-dump 동적 테이블 해시 | 24/27 일치 | cutover 직전 동일 snapshot 재검증 |
| Auth 사용자 | 운영 13명, 로컬 복원 13명 | 통과 |
| Storage metadata | 운영 49개, 로컬 복원 49개 | 통과 |
| Storage 원본 파일 | 관리 권한으로 49/49·113,226,015바이트·파일별 SHA-256 확보 | 통과 |
| 운영 Edge archive | 8개 함수, `ll-dashboard-api` 운영 버전 545 포함 | 통과 |
| schema 격리 방식 | 동일 프로젝트 `logistics_core`·`logistics_api` additive schema | 사용자 승인 |

운영-vs-dump 해시 불일치 3개는 서로 다른 시점의 동적 테이블 비교이며 R0 복원본의 동일 snapshot 검증과 구분합니다. R0는 동일 dump snapshot 27/27 해시로 통과했고, cutover 직전에는 쓰기 잠금 하에 운영 snapshot을 다시 고정하여 비교합니다.

## 현재 차단 항목

1. 운영 Supabase 임대차·대출 field를 canonical entity에 연결하고 critical exception을 0건으로 만들어야 합니다.
2. 월별 actual 수익·비용·수납의 계정표·발생/현금·웹 입력 검증과 계산 fixture를 승인해야 합니다. 대출 canonical은 `public.ll_fund_capital_tranches`의 loan 59행(active 51행)이며 약정·인출·만기·금리 값은 55행에 존재하고, 월별 실제 상환 schedule은 `not_provided`입니다.
3. additive schema의 production shadow와 신규 delta를 포함한 R2·R3 rollback 리허설을 수행해야 합니다.

## 현재 개발 상태

- 2026-08-04 SDD 계약 감사 뒤 사용자 결정에 따라 공식 원천·finance 최초입력·인앱 만기 알림·렌트롤 참고서식 계약을 재기준화했습니다. 수정된 RED 테스트 재실행과 문서 간 의미 감사 전에는 구현 완료로 계산하지 않습니다.
- DB·API·계산·frontend 정적 계약 테스트는 구현보다 먼저 작성했고, 누락 계약을 정확히 가리키며 RED로 실패했습니다.
- 기존에 작성된 schema·Edge·frontend 초안은 RED를 통과하기 전까지 격리 상태이며 운영 구현 완료로 계산하지 않습니다.
- 다음 순서는 원천 mapping의 critical exception을 해소한 뒤, RED를 하나씩 GREEN으로 만드는 구현과 로컬 migration·backfill·reverse 리허설입니다.

## 구현 금지선

- `public.ll_*` 삭제·이름 변경 금지
- `ll_v2_*` 난립 금지
- 샘플·추정 budget/forecast 생성 금지
- 임대차·대출 운영값을 Excel로 덮어쓰거나 Excel을 backfill 원천으로 사용 금지
- 웹 finance 입력에서 `budget`, `forecast`, 대출상환 또는 `approved_import` 사칭 금지
- Resend·DNS·Cron·외부 이메일 worker를 신규 범위에 재도입 금지
- stale·fallback·timeout을 primary 성공으로 처리 금지
- 기존 사용자 권한의 임의 회수 금지
- dirty 운영 작업공간 정리·되돌리기 금지
- 민감한 DB/Auth/Storage/Edge 백업의 공개 Git 업로드 금지
- 복구 게이트 통과 전 신규 schema·Edge·frontend의 운영 적용 금지

## 문서 순서

1. `00-execution-gates.md`: 실행·승인·차단 게이트
2. `01-feature-disposition.md`: 기존 기능 보존·미이관·호환·폐기 검토 분류
3. `02-acceptance-matrix.md`: 제품 수준 인수 기준
4. `03-r0-recovery-result.md`: 독립 복구·archive rollback 실행 결과
5. `04-ll-inventory-mapping.md`: 27개 `ll_*` 전수조사와 old-to-new mapping manifest
6. `05-source-workbook-manifest.md`: 업무 Excel 해시·물리 좌표·마지막 정상 버전 증거
7. `06-rent-roll-reference-mapping.md`: `260804_렌트롤 참고자료`의 UI 구조·범용 열 계약
8. `field-mapping.csv`: 운영 Supabase→신규 field와 비이관 참고자료 분류
9. `10-data-api-sdd.md`: DB·권한·API·계산 계약
10. `11-backfill-rollback-sdd.md`: 이관·호환·역이관·rollback 계약
11. `20-frontend-test-sdd.md`: 세 탭 화면과 브라우저 TDD 계약
12. `21-release-gate-sdd.md`: 파일럿·배포·live 검증 게이트
