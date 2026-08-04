# Gate 6 물류센터 데이터 관리 플랫폼 재구축

## 현재 판정

상태: **복구 게이트 미통과 — 기능 구현·운영 적용 차단**

이 디렉터리는 기존 운영본을 독립 복구 가능한 상태로 보존한 뒤 `홈 / 렌트롤 / 수익·비용` 플랫폼을 SDD·TDD 순서로 구축하기 위한 실행 명세와 증거를 모읍니다. 복구 게이트가 모두 통과하기 전에는 신규 migration, 운영 Edge 배포, 운영 frontend 배포를 수행하지 않습니다.

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

## 복구 검증 결과

| 검증 | 결과 | 판정 |
|---|---|---|
| 운영 DB dump | roles/schema/data/full 모두 종료 코드 0 | 통과 |
| 로컬 roles 복원 | 종료 코드 0 | 통과 |
| 로컬 전체 DB 복원 | `pg_net`, `postgis`, `supabase_vault`, `vector` 부재로 종료 코드 1 | 미통과 |
| `public.ll_*` 행 수 readback | 27개 테이블 전부 일치, 총 27,512행 | 통과 |
| `public.ll_*` 내용 해시 | 24개 일치, 3개 불일치 | 조건부 |
| 해시 불일치 테이블 | `ll_news_items`, `ll_notifications`, `ll_sector_market_lease_observations`; 행 수는 모두 일치 | 재검증 필요 |
| Auth 사용자 | 운영 13명, 로컬 복원 13명 | 통과 |
| Storage metadata | 운영 49개, 로컬 복원 49개 | 통과 |
| Storage 원본 파일 | 기존 로그인 사용자의 RLS로 49/49 다운로드 거부 | 미통과 |
| 운영 Edge archive | 8개 함수, `ll-dashboard-api` 운영 버전 545 포함 | 통과 |
| Supabase staging branch | 기존 branch 0개 | 미통과 |

해시 불일치 3개는 dump 이후에도 갱신될 수 있는 동적 테이블입니다. 원인이 시간 차이인지 데이터 손실인지 단정하지 않으며, 동일 시점 snapshot 또는 쓰기 잠금 하에서 다시 비교하기 전에는 성공으로 처리하지 않습니다.

## 현재 차단 항목

1. Supabase와 동일한 전용 확장을 가진 staging에서 전체 restore 종료 코드 0과 기능 readback을 확인해야 합니다.
2. Storage 원본 49개를 권한 있는 비공개 경로로 백업하고 크기·SHA-256을 확인해야 합니다.
3. 운영 유사 staging branch는 현재 존재하지 않습니다. 공식 요금 기준 Preview branch는 Micro에서 시간당 USD 0.01344부터 시작하며 추가 사용량이 발생할 수 있으므로 비용 승인이 필요합니다.
4. 15분 rollback 리허설은 위 두 복구 공백이 해소된 뒤 다시 수행해야 합니다.

## 구현 금지선

- `public.ll_*` 삭제·이름 변경 금지
- `ll_v2_*` 난립 금지
- 샘플·추정 budget/forecast 생성 금지
- stale·fallback·timeout을 primary 성공으로 처리 금지
- 기존 사용자 권한의 임의 회수 금지
- dirty 운영 작업공간 정리·되돌리기 금지
- 민감한 DB/Auth/Storage/Edge 백업의 공개 Git 업로드 금지
- 복구 게이트 통과 전 신규 schema·Edge·frontend의 운영 적용 금지

## 문서 순서

1. `00-execution-gates.md`: 실행·승인·차단 게이트
2. `01-feature-disposition.md`: 기존 기능 보존·미이관·호환·폐기 검토 분류
3. `02-acceptance-matrix.md`: 제품 수준 인수 기준
4. `10-data-api-sdd.md`: DB·권한·API·계산 계약
5. `11-backfill-rollback-sdd.md`: 이관·호환·역이관·rollback 계약
6. `20-frontend-test-sdd.md`: 세 탭 화면과 브라우저 TDD 계약
7. `21-release-gate-sdd.md`: 파일럿·배포·live 검증 게이트
