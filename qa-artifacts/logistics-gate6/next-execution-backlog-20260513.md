# Next execution backlog - 2026-05-13

사용자 승인이나 외부 클릭 없이 계속 진행 가능한 순서와, 승인이 필요한 순서를 분리했습니다.

## Can continue without user action

1. Apps Script 코드 기준 chart/popup 계산식 추출 - done: `apps-script-source-formula-extract-20260513.md`
2. Home KPI, 월 임관리비, 임대료 추이의 canonical source 결정 후보표 작성 - done: `home-kpi-canonical-source-check-20260513.md`
3. Asset/Company/Sector 선택값별 component/entity QA runner 작성 - partial: `component-source-consistency-qa-20260513`
4. Analysis Tools, Data Playground, Data Quality 기능 축소 여부 원본 코드 대조 - done: `analysis-playground-quality-parity-gap-20260513.md`
5. local Playwright screenshot/DOM QA 확대 - partial: worklog, asset chip routing, chart interaction, advanced tabs browser QA
6. public bundle secret scan - done: `secret-scan-public-bundle-20260513`
7. `logistics-admin-api verify_jwt=false` 위험 보고서 작성 - done: `logistics-admin-api-verify-jwt-risk-20260513.md`
8. Analysis Tools 다중 선택/계약 원장/review highlights 구조 복원 - done: `advanced-tabs-static-qa-20260513`, `advanced-tabs-browser-qa-20260513`
9. Data Playground 모드/차원/지표/필터/저장 보기 구조 복원 - done: `advanced-tabs-static-qa-20260513`, `advanced-tabs-browser-qa-20260513`
10. Data Quality critical/sheet/field filter 구조 복원 - done: `advanced-tabs-static-qa-20260513`, `advanced-tabs-browser-qa-20260513`

## Needs later user approval or external setup

1. Supabase migration 적용: `ll_weekly_*`, 권한 테이블, RLS
2. Edge Function 배포: `ll-weekly-doc-ingest`, edits submit/approve, OpenDART, 건축물대장
3. Supabase policy 변경
4. live Google Sheets 17탭 cell-level OAuth/API 재추출
5. 네이버 지도 운영 URL 등록 기반 live map tile QA
6. GitHub Pages/live 배포와 live QA
7. commit/push

## Blocking facts

- `ll_payload_snapshots`는 `supabase_snapshot` 107건으로 확인됐지만, live Sheets 17탭 cell-level 보존은 확인되지 않았습니다.
- `ll_data_quality_findings`에 Home KPI 불일치 finding이 남아 있습니다.
- `ll_rent_history`에는 review_required/unmatched row와 null이 남아 있습니다.
- Supabase Edge Function `logistics-admin-api`는 `verify_jwt=false`입니다. 서버 내부 검증 코드를 보기 전까지 보안 gate는 `blocked`입니다.
- 프론트 Company option은 31개인데 Supabase `ll_tenants`는 36개입니다. 누락 5개가 비활성/중복/매핑 누락인지 확인 전에는 Company tab parity가 `blocked`입니다.
