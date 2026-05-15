# Analysis Tools / Data Playground / Data Quality parity gap - 2026-05-13

목적: 기존 Apps Script 코드 기준으로 하위 3개 탭의 실제 기능을 다시 확인하고, 현재 IOTA 물류 워크 플랫폼 구현이 어느 부분까지 따라왔는지 구분합니다.

## Source files checked

| source | checked lines / functions | 확인 내용 |
|---|---|---|
| `C:\Users\10524\Desktop\codex_realasset\Project\03_Logi_Leasing_Dashboard\Client.html` | `renderPlaygroundLegacy_`, `renderDataQuality...`, `bindQuality...` | Playground 질의 빌더, 저장된 보기, 차트/표 클릭 팝업, Data Quality 심각도/시트/필드 그룹, 수정 modal |
| `C:\Users\10524\Desktop\codex_realasset\Project\03_Logi_Leasing_Dashboard\Metrics.gs` | `buildToolsPayload_`, `buildPlaygroundPayload_` | Analysis Tools와 Playground payload 계산식 |
| `C:\Users\10524\Desktop\codex_realasset\Project\03_Logi_Leasing_Dashboard\RuntimeServices.gs` | `getDataQualityData`, `buildDataQualityIssuesFromAdminReviewCache_`, `fetchBuildingRegister...` | Data Quality source, OpenDART/건축물대장 backlog, 품질 이슈 생성 |
| `C:\tmp\IGIS-Fund-Production-DP\src\components\system\workspace\WorkspaceLogistics.jsx` | `AnalysisToolsDashboard`, `DataPlaygroundDashboard`, `DataQualityDashboard` | 현재 IOTA 구현 상태 |

## Component gap table

| tab | original required behavior | current IOTA state | parity status | next action |
|---|---|---|---|---|
| Analysis Tools | 기본 top 3 자산/기업 선택, 자산/기업 다중 선택, 계약 원장, divergence, review highlights, benchmark chart/table, 선택 row 상세 팝업 | 다중 자산/기업 선택, 계약 원장, rent spread, review highlights, benchmark chart/table 복원 | partial | 원본 서버 payload와 숫자 parity 비교 필요 |
| Analysis Tools | 서버 payload basis: `selected_entity_rows`, source `DB_일반+DB_히스토리 누적` | 로컬 snapshot payload 기준 | blocked | Supabase canonical snapshot/source 기준 확정 후 숫자 parity 비교 |
| Data Playground | mode 전환: Sandbox / Explorer / BI Workspace | 3개 모드 segmented control 복원 | pass | 실제 원본 payload 숫자 parity 필요 |
| Data Playground | 차원: 자산, 펀드, 임차인, 섹터, 물류 유형, 저온 유형, 검토 상태 | 7개 차원 복원 | pass | 실제 원본 payload 숫자 parity 필요 |
| Data Playground | 지표: 임대면적, 월 임대료, 월 관리비, 월 임관리비, 평균 E.NOC, 건수 | 6개 지표 복원 | pass | 실제 원본 payload 숫자 parity 필요 |
| Data Playground | columnDimension, filterDimension, filterValue, Top N, 저장된 보기 | 컬럼/필터/Top N/저장 보기 복원 | pass | stacked column 수치 parity는 후속 QA |
| Data Playground | 차트 클릭 및 표 행 클릭 시 선택 차원 상세 팝업 | 차트 및 표 행 상세 팝업 복원 | pass | popup numeric parity 필요 |
| Data Quality | admin review cache, validateDashboardData 기반 이슈 생성 | 프론트에서 asset/company/weekly 일부 null만 자체 검사 | blocked | Supabase `ll_data_quality_findings` readback과 서버 검사 결과로 전환 |
| Data Quality | Critical/Warning/Info, 시트 그룹, 필드 그룹, issue modal | critical/warning/info, sheet/field filter 복원 | partial | 실제 `ll_data_quality_findings` readback 연결 필요 |
| Data Quality | 원본값 조회, 새 값/사유 입력, adminApplyQualityEdit | 수정 요청 modal만 있고 서버 저장 없음 | blocked | `/edits/submit`, `/edits/approve`, RLS/Edge Function 필요 |
| Data Quality | OpenDART/건축물대장 backlog를 품질 이슈에 포함 | 프론트 표시 없음 | fail | 서버 endpoint와 readback 결과를 품질 이슈로 연결 |

## 판단

현재 3개 탭은 원본 구조의 큰 축을 일부 복원했지만, 원본 payload와 숫자 parity는 아직 통과가 아닙니다.

- Analysis Tools는 `partial`
- Data Playground는 `structure pass / numeric parity blocked`
- Data Quality는 `partial + blocked`

따라서 다음 구현은 이 3개 탭을 "예쁜 카드 추가"가 아니라 원본 기능 복원 단위로 진행해야 합니다.
