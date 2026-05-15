# Gate 6 요청사항 상태 매트릭스 - 2026-05-14

## 기준
- `완료`: 현재 로컬 코드 또는 QA 산출물 기준으로 반영 확인.
- `부분`: 화면/로직 초안은 있으나 live QA, DB readback, Edge 배포, 원본 대조가 남음.
- `미완료`: 아직 구현 또는 검증 증거가 부족.
- `승인대기`: DB mutation, migration, Edge Function 배포, RLS/policy, commit/push.
- `외부권한대기`: API key, OAuth, live 인증, 외부 콘솔 설정.

## 완료 또는 부분 완료
| 영역 | 요청 | 상태 | 근거 |
| --- | --- | --- | --- |
| 업무 로그 | 첫 화면을 Dashboard가 아닌 업무 로그로 유지 | 완료 | `WorkspaceLogistics`가 `currentPath`가 dashboard가 아닐 때 업무 로그 렌더링 |
| 업무 로그 | 업무 공유 컴포넌트 제거, 협업게시판/Task 중심 | 완료 | 기존 공유 컴포넌트 제거 후 Task/게시판 중심 구성 |
| 업무 로그 | 주요 Task 작성자 수정/삭제/완료, `/` bullet 분리 | 부분 | 로컬 UI 구현, 서버 권한 readback은 Edge 배포 승인대기 |
| 업무 로그 | Task UI/기능을 GitHub main 레퍼런스 기반으로 복원 | 부분 | main 기준 카드/수정/삭제/완료/전환 UI 반영, live 비교 QA 남음 |
| 업무 로그 | 검색 시 자산/임차인 Dashboard-equivalent 팝업 | 부분 | 검색 팝업 UI 구현, 숫자 parity QA 남음 |
| Weekly | 조직명 표시, 타 조직 열람 제한 방향 | 부분 | UI는 로그인 조직명 사용, 서버 권한 강제는 Edge 배포 승인대기 |
| Weekly | 스카이박스1/2 그룹, 야탑쿠팡/포천정교리 제외 | 완료 | `normalizeWeeklyAssetRows`, 개발 자산 필터 반영 |
| Weekly | 주차별 자산 이슈/현황 수정 제거 | 완료 | 별도 수정 컴포넌트 제거 |
| Weekly | 연도/월/주차 자유 선택 | 완료 | 2026-05-14 최신 패치로 library 없는 주차도 선택 가능 |
| Weekly | 신규 투자/관리 Projects `/` 문장 bullet 표시 | 완료 | 2026-05-14 최신 패치로 `renderBulletListCell` 적용 |
| Home | Sector 탭을 Home 하위로 흡수, Sector redirect | 부분 | UI 이관 완료, 전체 parity QA 남음 |
| Home | 월 임관리비 추이 중복 제거, 계약 이력 기준 추이 상단 유지 | 완료 | 중복 trend 제거, 계약 이력 trend 유지 |
| Home | 저온 비율 컬럼 추가 | 완료 | 포트폴리오 표에 `저온창고 비율` 표시 |
| Home | E.NOC 원단위 가중평균 표시 | 완료 | 2026-05-14 최신 패치로 임대면적 가중평균 `formatWon` 적용 |
| Home | 도넛 hover 상세 tooltip | 완료 | 2026-05-14 최신 패치로 SVG segment hover tooltip 적용 |
| Home | 용도별 비율 범례를 상온창고/복합/저온창고/사무실로 고정 | 완료 | 2026-05-14 최신 패치로 카테고리 정규화 |
| Home | 억 단위 숫자 소수점 첫째자리 | 완료 | 2026-05-14 최신 패치로 `formatCurrency` 억 단위 1자리 |
| Home | 계약 이력 기준 임대료 추이 좌우 공백 축소 | 완료 | 2026-05-14 최신 패치로 `RichTrendChart` 좌우 padding 축소 |
| Home | 주요 임차인 계약 요약을 전체 임차인 계약 표로 확장 | 완료 | 2026-05-14 최신 패치로 `임차인 계약` full-width 표와 상세 팝업 |
| Asset | 자산 핵심 요약 제거, KPI를 임차인 현황 위 배치 | 부분 | UI 배치 완료, numeric parity 남음 |
| Asset | E.NOC 원단위 표시 | 완료 | 2026-05-14 최신 패치로 KPI/검산/표에 `formatWon` 적용 |
| Asset | 자산명 옆 펀드명 작은 글씨 | 완료 | 2026-05-14 최신 패치 반영 |
| Asset | 만기 스냅샷 차트에 구역/층과 만기일 hover 표시 | 완료 | 2026-05-14 최신 패치로 chart label/tooltipLines 추가 |
| Company | 삭제된 지도/DART/요약 컴포넌트 복구 | 완료 | `company-selector-change-qa-20260513.cjs` 기준 복구 |
| Company | 기업 선택 시 내용 변경 | 부분 | selector QA는 통과, 전체 숫자 parity 남음 |
| Company | 임차 자산 현황 컬럼 폭 개선 | 부분 | 공통 DataTable 폭 규칙 개선, live 화면 QA 남음 |
| Dashboard 공통 | 업무 흐름 기준 탭 배치 제거 | 완료 | Dashboard module nav에서 해당 배치 제거 |
| Dashboard 공통 | 표 컬럼 폭/줄바꿈 규칙 개선 | 부분 | 공통 규칙과 QA 스크립트 존재, 모든 탭 실화면 재검증 남음 |

## 아직 미완료 또는 승인/외부권한 필요
| 영역 | 요청 | 상태 | 다음 행동 |
| --- | --- | --- | --- |
| 데이터 정합성 | Excel 대비 Supabase `ll_*` 1 by 1 read-only 대조 | 부분 | 기존 preview 산출물 보강, read-only 쿼리/Excel source cell 대조 계속 |
| 데이터 정합성 | 월 임관리비 1,064,113,818원 차이 원인 3개 자산 source cell 기준 확정 | 부분 | 수정 SQL preview/readback은 있음, 실제 mutation은 승인대기 |
| live Sheets | 17탭 cell-level manifest 보존 증명 | 부분 | manifest/append preview 필요, 실제 append 승인대기 |
| 컬럼 감사 | 모든 `ll_*` 컬럼 분류와 삭제 후보 사용처 0건 확인 | 부분 | field register 존재, 삭제는 승인대기 |
| Weekly | Word 원본 미저장, 내용만 파싱/요약 저장 | 부분 | UI/계약은 있음, Edge Function 실제 구현/배포 승인대기 |
| Weekly | 런칭 후 AI 자동 요약 운영 방식 | 부분 | 별도 운영 설계 문서 추가 필요 |
| Data Quality | Excel 전체 내용 수정 UI와 submit/approve/readback/audit 완성 | 부분 | prototype UI 있음, 서버 write flow와 DB 적용 승인대기 |
| Data Quality | `DB_일반`과 `DB_히스토리` 연결 및 누적 수정/삭제 UX | 미완료 | schema/UI 설계와 preview 작성 필요 |
| OpenDART | server-only API live 연결 | 외부권한대기/승인대기 | key/secret 설정 및 Edge 배포 필요 |
| 건축물대장 | server-only API live 연결 | 외부권한대기/승인대기 | key/secret 설정 및 Edge 배포 필요 |
| Naver geocoding | 불확실 주소 server-only 재분류 | 외부권한대기/승인대기 | Naver key/secret 설정 및 Edge 배포 필요 |
| Analysis Tools | 완전 구현과 QA | 부분 | 현 UI 보강, selector/숫자/테이블 QA 필요 |
| Data Playground | 완전 구현과 QA | 부분 | DB_일반/DB_히스토리 기준 보강 필요 |
| Data Quality | 완전 구현과 QA | 부분 | Excel source cell 기반 수정 UI와 서버 flow 필요 |
| QA | 모든 탭 selector 변경 후 component/numeric/popup/chart/map parity | 미완료 | local Browser QA와 live QA 필요 |
| 보안 | secret scan 0건, Admin DOM 노출 0건, Reader write 차단 | 부분 | static scan 일부 있음, live/network QA 필요 |
| 배포/커밋 | DB/Edge/deploy/commit/push | 승인대기 | preview 제출 후 사용자 승인 필요 |

## 런칭 후 Weekly AI 요약 방식 초안
1. Word 업로드는 브라우저가 파일을 DB에 저장하지 않고, 서버 함수가 파일을 임시 메모리 또는 임시 스토리지에서만 파싱합니다.
2. 서버는 조직, 연도, 월, 주차, 파일 hash, 파싱된 section/table, source paragraph/table row id를 분리 저장합니다.
3. AI 요약은 서버에서만 실행하고, 원문을 `핵심 이슈`, `현재 현황`, `다음 계획`, `담당자`, `관련 자산/펀드`, `이해관계자` 스키마로 구조화합니다.
4. AI 결과는 바로 확정하지 않고 `parsed_result`, `ai_summary_draft`, `user_edited_summary`, `dashboard_record`로 단계 분리합니다.
5. 같은 파일 hash와 같은 조직/주차 중복 업로드는 차단하거나 새 revision으로만 저장합니다.
6. 실패 시 어떤 table에도 부분 write를 남기지 않도록 서버 transaction 또는 compensation delete를 적용합니다.
7. Weekly와 업무 로그 첫 화면은 `dashboard_record`만 읽고, 수정은 Data Quality 승인 흐름을 거칩니다.
