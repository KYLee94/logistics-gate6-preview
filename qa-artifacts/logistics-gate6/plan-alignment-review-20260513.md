# Plan alignment review - 2026-05-13

초기 계획과 현재 진행분을 다시 대조했습니다.

## 부합한 점

| 초기 계획 | 현재 상태 | 증거 |
|---|---|---|
| 최종 구현은 IOTA/IFPDP repo 새 브랜치 | 부합 | `C:\tmp\IGIS-Fund-Production-DP`, branch `codex/logistics-leasing-work-platform` |
| `docs/` 실패 산출물을 최종 기준으로 쓰지 않음 | 부합 | Apps Script 코드/JSON/snapshot 기준으로 산출물 작성 |
| 첫 화면은 대시보드가 아니라 업무 로그/Weekly/검색/업무 리스트 중심 | 부분 부합 | `WorkspaceLogistics.jsx`, `worklog-main-current-qa-20260513` |
| 임대차 대시보드는 내부 Dashboard 모듈 | 부합 | `/workspace/logistics/dashboard/*` 구조 |
| Admin 별도 페이지 제거 방향 | 부분 부합 | 별도 Admin 탭 없음, 단 권한별 서버 검증 미완 |
| 권한표 기반 담당 자산/펀드 매핑 | 부분 부합 | `logisticsPermissionData.json`, 권한 UI 적용 |
| 차트 hover/click/popup | 부분 부합 | 로컬 chart QA 통과, 원본 값 parity는 blocked |
| Company selector 동작 | 부합 | `company-selector-change-qa-20260513/result.json` |
| Supabase는 다시 밀어넣지 않고 read-only 확인 | 부합 | `supabase-readonly-integrity-20260513.md`, `supabase-source-coverage-detail-20260513.md` |
| secret/API key 프론트 노출 금지 | 부합 | `secret-scan-public-bundle-20260513/result.json` pass |

## 이탈 또는 미흡한 점

| 항목 | 문제 | 조치 |
|---|---|---|
| live Google Sheets 17탭 cell-by-cell | 현재 5개 sheet row-level만 있고 cell-level 없음 | approval/OAuth 필요한 작업으로 분리 |
| Home KPI/월 임관리비/임대료 추이 | snapshot, normalized, trend total 기준이 다름 | canonical source 확정 전 숫자 완료 금지 |
| Company option 수 | 프론트 31개, `ll_tenants` 36개 | 누락 5개가 inactive/중복/매핑 누락인지 조사 |
| Data Quality 수정 | UI 계약만 있음 | ll_edits/RLS/Edge Function 배포 필요 |
| Weekly Word ingest | 화면 계약과 함수 draft만 있음 | migration/Edge Function 배포 승인 필요 |
| OpenDART/건축물대장 | 프론트 직접 호출은 안 하지만 실제 서버 QA 없음 | 서버 endpoint와 401/403 QA 필요 |
| live QA | local QA만 있음 | 배포 승인 후 live URL QA 필요 |
| subagent gate | 일부 reviewer blocked 유지 | blocked 해소 전 완료 판정 금지 |
| repo secret hygiene | `.env`가 git tracked 상태 | `.gitignore`/`.env.example` 보강 완료, 추적 해제는 승인 필요 |

## 추가 업무 계획

사용자 개입 없이 진행 가능한 작업:

1. 프론트 source consistency QA 자동화
2. Supabase source coverage read-only 재확인
3. 초기 계획 부합/이탈 표 고정
4. blocker를 사용자 승인 필요/불필요로 분리
5. local lint/build/QA 재실행
6. subagent reviewer 결과 회수
7. repository secret hygiene 검사

사용자 승인 또는 외부 클릭이 필요한 작업:

1. live Sheets 17탭 OAuth/API cell-level 추출
2. Supabase migration/RLS/policy 적용
3. Edge Function 배포 및 secret 설정
4. live 배포와 live QA
5. commit/push

## 현재 판정

Gate 6 구현은 진행 중이지만, 완성 판정은 아직 불가합니다. 현재 상태는 `부분 통과 + 데이터/보안/API blocker 유지`입니다.
