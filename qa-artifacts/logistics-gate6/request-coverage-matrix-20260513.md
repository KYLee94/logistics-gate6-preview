# Logistics work platform request coverage matrix - 2026-05-13

사용자 요청 전체를 현재 코드/QA/Supabase readback 기준으로 나눈 표입니다. `pass`는 로컬 증거가 있는 항목만 표시했습니다.

| request | current_status | evidence | remaining work |
|---|---|---|---|
| 첫 화면은 업무 로그, Weekly 현황, 검색, 개인/팀/섹터 업무 중심 | partial | `WorkspaceLogistics.jsx`, `worklog-main-current-qa-20260513/result.json` | 검색과 실제 Supabase worklog 저장/권한 필터 연동 필요 |
| 개인/팀/섹터 업무를 한 컴포넌트 안에서 전환 | pass | `worklog-main-current-qa-20260513/result.json` | 실제 서버 데이터 연결 필요 |
| 업무별 관련 자산 표기 | pass | `worklog-main-current-qa-20260513/result.json` | 자산 ID 기준 정규 매핑 필요 |
| 담당 자산 블록 크기 동일화, 코드 제거, 2줄 표시 | pass | `assetButtonMetrics` width 171 / height 54 | 모바일 캡처 추가 필요 |
| 주간자료 업로드 버튼명 변경 | pass | `주간업무보고자료 업로드` QA 통과 | 없음 |
| 업로드 시 연도/월/주차/기간 선택 | pass for UI | 업로드 modal QA 통과 | 실제 서버 파싱/저장 미배포 |
| Word 양식 기반 Weekly 자동 업데이트 | partial | `supabase/functions/ll-weekly-doc-ingest/index.ts` draft | Edge Function 배포, docx parser, RLS, ll_weekly_* migration 승인 필요 |
| Weekly 탭에서 연도/월/주차 선택 | partial | `WeeklyDashboard` selector code | 주차 라이브러리 확장 및 Supabase source 연결 필요 |
| Data Quality 탭에서 무결성 검사 + 수정 | partial | `DataQualityDashboard` UI | 실제 edit submit/approve endpoint, RLS, 권한표 server-side 검증 필요 |
| 권한표 기반 개인/팀/자산/CRUD 권한 | partial | `logisticsPermissionData.json` 정상 한글 readback | Supabase 권한 테이블/RLS/Edge Function 검증 미적용 |
| 별도 Admin 페이지 제거 | partial | Dashboard 내부 권한 패널 구조 | 인증 전 DOM/권한별 DOM live QA 필요 |
| 대시보드에서 업무 로그로 돌아가기 | implemented | `DashboardShell` navigation | live QA 필요 |
| Company 선택 시 내용 변경 | pass | `company-selector-change-qa-20260513/result.json` | 숫자/팝업 단위 parity 추가 필요 |
| Home 지도 + 자산표 좌우 배치, 좌표 제거, 연면적 평 단위 | pass local | `map-asset-qa`, `home-chart-interaction-qa` | 네이버 지도 실타일/마커 visual QA는 사용자 URL 등록 없이 보류 |
| Home 저온/상온 도넛 의미 표시 | implemented | `normalizeColdStorageLabel`, Home QA | Apps Script 원본 segment parity 추가 필요 |
| 월 임관리비 비중 자산별/임차인별 선택 | implemented | Home chart QA | 총액 기준이 snapshot/normalized와 달라 데이터 gate blocked |
| 차트 축/범례/hover/click popup 개선 | partial-pass | `chart-unit-parity`, `home-chart-interaction`, `dashboard-parity-tabs` | Apps Script 값 단위 1:1 및 모든 popup table parity 필요 |
| Sector 월 임관리비 2-series line chart | partial | `RichTrendChart` series 구조 | 원본 Apps Script 2-series와 값/축 기간 비교 필요 |
| Analysis Tools/Data Playground/Data Quality chart/filter/popup parity | partial | `dashboard-parity-tabs-qa-20260513/result.json` | 원본 기능 축소 여부 재검증 필요 |
| 포트폴리오 위치 표 한 줄 표시, 주소 시군구, 0평 제거 | implemented | Home code + QA | narrow viewport QA 필요 |
| 모든 클릭 가능 컴포넌트 cursor pointer | partial-pass | Main QA, chart QA | 전체 탭 DOM 전수 스캔 필요 |
| OpenDART/건축물대장 API 연계 | blocked | Security/API reviewer finding | 서버 계층, secret, 401/403 QA 필요 |
| Supabase 값 무결성 재점검 | blocked with evidence | `supabase-readonly-integrity-20260513.md` | live Sheets 17탭 cell-by-cell, KPI 계산식 확정 필요 |
| 기존 Apps Script 차트와 값 단위까지 1:1 parity | blocked | Apps Script parity reviewer blocked | 탭별 chart raw data extraction + popup capture 필요 |
| 모든 숫자/세부 블록/팝업이 선택 자산/임차인과 일치하는지 전수조사 | not_started | - | component-entity parity runner 필요 |
| local + live QA | partial | local QA only | 배포/Live URL QA는 별도 승인 필요 |

## Current decision

구현은 계속 진행 가능하지만, “완성” 판정은 불가합니다. 특히 DB 원본 보존과 KPI 계산 기준이 아직 `blocked`라서 프론트 숫자를 더 손대기 전에 원본 계산식과 Supabase readback을 맞춰야 합니다.

