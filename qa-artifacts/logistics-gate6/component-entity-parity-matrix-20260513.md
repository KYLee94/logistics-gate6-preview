# Component/entity parity matrix - 2026-05-13

각 컴포넌트가 현재 어떤 선택값과 데이터를 기준으로 표시되어야 하는지 정리했습니다. 다음 QA는 이 표를 기준으로 baseline/new local/new live를 같은 사용자 동작으로 비교해야 합니다.

| page | component | selected entity | intended source | current status | required parity check |
|---|---|---|---|---|---|
| Main | 담당자 요약 | login email / organization | `logisticsPermissionData.json`, later `public.ll_* permission table` | partial | 로그인 계정별 개인/팀/담당 자산이 권한표와 일치하는지 |
| Main | 담당 자산 chips | current user | 권한표 asset mapping | pass local | chip 클릭 시 Asset 탭 + selected asset payload 일치 |
| Main | 개인/팀/섹터 업무 전환 | active work scope | `MAIN_WORKLOGS`, later `ll_worklogs` | pass local | scope별 row가 권한 범위와 맞는지 |
| Main | 협업게시판 | workspace code | `WorkspaceActivityLog` | partial | 실제 등록/검색/권한 저장 확인 |
| Main | 주요 TASK 관리 | selected week | `weeklyReportData` | partial | Word 원본의 Task/Next Action/이해관계자 누락 0건 |
| Weekly | 주차 선택 | year/month/week | `WEEKLY_REPORT_LIBRARY`, later `ll_weekly_*` | partial | 워드 원본의 프로젝트/신규/관리/이슈/계획 항목 전체 반영 |
| Weekly | 수정 UI | selected week + permission | weekly draft + permission data | partial | Editor/Manager/Admin별 수정/승인 가능 범위 |
| Home | KPI cards | portfolio total | `homeData`, `ll_payload_snapshots`, normalized `ll_*` | blocked | snapshot 111억, normalized 100.7억 등 불일치 원인 확정 |
| Home | 포트폴리오 위치 | asset | asset location payload + Naver/Leaflet | partial | 지도 마커/표 행/자산 상세 popup 1:1 |
| Home | 용도별 면적 비중 | portfolio total | cold storage flag/area | partial | N=상온/Y=저온 원본 기준 확인 및 segment total 일치 |
| Home | 월 임관리비 비중 | asset or tenant mode | monthly cost snapshot | blocked | 자산별/임차인별/추이 총액이 서로 다르지 않게 기준 확정 |
| Home | 임대료 추이 | month | rent trend snapshot | partial | 원본 시작월, 축, 2/3 series, hover/popup table 값 일치 |
| Asset | Asset selector | assetId | `ASSET_PAYLOADS` | partial | selected asset별 KPI/table/chart/map 전수 비교 |
| Company | Company selector | tenantId | `COMPANY_PAYLOADS` | pass selector | company별 KPI/table/chart 값 전수 비교 |
| Sector | 월 임관리비 추이 | sector/month | `sectorData` | partial | 원본 2-series line chart 축/범례/값 비교 |
| Sector | Top 자산 | sort metric | `sectorData` ranking | blocked | 원본 sorting 기준과 동일한지 |
| Sector | Top 임차인 | sort metric | `sectorData` ranking | blocked | 원본 sorting 기준과 동일한지 |
| Analysis Tools | 비교 차트 | selected assets/metric | asset payloads | partial | filter, chart, popup이 Apps Script 원본과 같은지 |
| Data Playground | grouping/filter | selected dimension/metric | sector/asset payload | partial | 필터별 row count, chart value, popup table 비교 |
| Data Quality | findings | source rows | `ll_data_quality_findings`, local fallback | blocked | 실제 Supabase findings readback + 수정 요청/승인 endpoint |

## Next QA runner contract

필수 필드:

| field | meaning |
|---|---|
| page | Weekly/Home/Asset/Company/Sector/Analysis Tools/Data Playground/Data Quality |
| component_id | stable component id |
| selected_entity | current asset/company/week/filter |
| baseline_value | Apps Script 원본 값 |
| local_value | 신규 로컬 값 |
| live_value | 배포 후 값 |
| popup_baseline | 원본 popup 내용 |
| popup_local | 신규 popup 내용 |
| data_source | snapshot / normalized table / fallback |
| qa_status | pass / fail / blocked |
| failure_reason | 숫자 불일치, selector 미동작, popup 누락 등 |

현재 판정: local UI 개선은 진행됐지만, 전체 component/entity parity는 아직 `blocked`입니다.

