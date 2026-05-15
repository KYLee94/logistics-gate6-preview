# Logistics blocker resolution update - 2026-05-14

## 이번 처리 범위

- DB mutation: `0건`
- migration apply: `0건`
- Edge Function deploy: `0건`
- commit/push: `0건`
- source repo: `C:\tmp\IGIS-Fund-Production-DP`

## 닫은 blocker

| blocker | 조치 | 증거 | 판정 |
|---|---|---|---|
| Home 월 임관리비 값이 자산/임차인/추이에서 서로 달라 보임 | KPI/도넛은 현재 포트폴리오 기준, 추이는 계약 이력 월별 기준으로 분리. 추이 최신값을 KPI로 덮어쓰던 보정 제거 | `monthly-cost-basis-reconciliation-20260514.md`, `component-source-consistency-qa-20260513/result.json` | `pass` |
| Company 선택 변경 후 내용 미변경 | QA 재실행, 선택 전후 회사명/내용 변경 확인 | `company-selector-change-qa-20260513/result.json` | `pass` |
| Home 차트 hover/click/popup | Home 도넛/추이/Sector/Tools/Playground hover와 modal click 재검증 | `home-chart-interaction-qa-20260513/result.json` | `pass` |
| Home 포트폴리오 스냅샷 잔존 | Home 문구에서 `포트폴리오 스냅샷` 제거, 지도+자산표 배치 유지 | `dashboard-parity-tabs-qa-20260513/result.json` | `pass` |
| Data Quality 수정 요청 UI와 서버 계약 부재 | UI는 `ll-dashboard-api` `edits/submit` 호출로 연결, Edge Function draft와 ll_* migration preview 추가 | `edge-api-security-static-qa-20260514/result.json` | `source pass / deploy pending` |
| Weekly Word ingest 서버 계약 부재 | 기존 `ll-weekly-doc-ingest` draft와 migration preview 유지. 이번 턴에서는 재배포/DB 적용 없음 | `weekly-edge-function-preflight-20260513.md` | `source prepared / deploy pending` |
| OpenDART/건축물대장 프론트 직접 호출 위험 | `ll-dashboard-api`에서 서버 env 기반 proxy 후보 구현. 프론트 secret 노출 없음 | `edge-api-security-static-qa-20260514/result.json`, `secret-scan-public-bundle-20260513/result.json` | `source pass / live key test pending` |
| 접속 코드 하드코딩 | `IOTA2026` 소스 하드코딩 제거, `VITE_IOTA_PILOT_ACCESS_CODE` env로 이동 | `edge-api-security-static-qa-20260514/result.json`, `.env.example` | `pass` |
| AuthSetup 직접 non-ll update | `iota_seoul_pilot_members` 직접 update 제거, `iota-auth-member-sync` Edge Function draft로 격리 | `edge-api-security-static-qa-20260514/result.json` | `source pass / deploy pending` |

## 남은 blocker

| blocker | 현재 상태 | 이유 |
|---|---|---|
| live Google Sheets 17탭 cell-level Supabase 보존 | `blocked` | Google Sheets metadata는 17탭 확인, 로컬 17탭 추출 증거도 있으나 `ll_source_cells`에는 live 17탭 cell row가 없음. 추가 cell sample readback은 Sheets API `429 RATE_LIMIT_EXCEEDED` |
| Supabase 정규화 최신 이력 합계와 스냅샷 KPI 차이 | `blocked` | `ll_rent_history.is_latest` 합계 `10,070,115,024`, Home snapshot KPI `11,134,228,842`. 화면에서는 기준 분리 완료, 데이터 원인 분류는 미완료 |
| Weekly/Data Quality 실제 저장 | `blocked until deploy/apply` | Edge Function/migration preview만 작성. 사용자 승인 없이 Supabase deploy/migration apply 하지 않음 |
| OpenDART/건축물대장 live API 검증 | `blocked until secrets/deploy` | 서버 함수 draft는 있으나 Edge Function secret과 배포가 필요 |
| 기존 IOTA core 전역 직접 mutation | `external blocked` | 물류 모듈/인증 진입부는 격리했지만, 기존 IOTA core 모듈에 직접 mutation 101건이 남아 있음. 물류 gate 범위 밖의 별도 리팩터링 대상 |

## QA 결과

- `npm run build`: pass
- `npx eslint src/components/system/workspace/WorkspaceLogistics.jsx src/components/system/AuthSetup.jsx`: pass
- `component-source-consistency-qa-20260513`: pass 11 / blocked 0
- `home-chart-interaction-qa-20260513`: allPass true
- `dashboard-parity-tabs-qa-20260513`: allPass true
- `advanced-tabs-browser-qa-20260513`: allPass true
- `company-selector-change-qa-20260513`: allPass true
- `worklog-main-current-qa-20260513`: allPass true
- `supabase-snapshot-parity-20260513`: pass_with_notes
- `secret-scan-public-bundle-20260513`: allPass true
- `repo-secret-hygiene-20260513`: allPass true
- `edge-api-security-static-qa-20260514`: logisticsGatePass true, IOTA legacy mutation inventory blocked

## Subagent reviewer 반영

- Data reviewer: 17탭 live cell-level 보존은 여전히 blocked. 이번 산출물에 그대로 반영.
- Security/API reviewer: 하드코딩 접속 코드와 물류/인증 진입부 직접 mutation은 조치. 기존 IOTA core 직접 mutation은 별도 inventory로 분리.
- QA/UI reviewer: Home 기준값 혼선은 화면 기준 분리 및 QA pass. 실제 저장/배포/live 검증은 blocked로 유지.
