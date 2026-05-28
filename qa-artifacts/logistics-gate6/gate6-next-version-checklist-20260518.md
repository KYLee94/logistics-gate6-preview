# Gate 6 Current Checklist - 2026-05-28

Scope: 사용자 2026-05-28 요청 0~8번만 유지한다. 이전 체크리스트 항목은 이번 기준에서 삭제했다.

## 0. Data Quality 정리
- [x] 데이터 무결성 카드 5개를 한 줄 레이아웃으로 조정
- [x] `Data Quality 정비 계획` 섹션 제거
- [x] 무결성 점검 결과 테이블 긴 셀 truncate/line-clamp 적용
- [x] 코드성 필드명을 자산/항목/문제 사유/권장 조치 중심의 사용자 문구로 표시
- [x] `문제 아님` 로컬 숨김 처리 추가
- [x] `담당자에게 수정 요청` 플로우와 알림 payload 연결
- Evidence: `npm run build:preview` pass, `npm run qa:data-quality-e2e` pass

## 1. AI 챗봇
- [x] canned template 우선 응답이 아니라 Supabase readback 기반 deterministic answer 우선 처리
- [x] 연결 확인 질문에서 `drivers` 같은 내부 단어 노출 방지
- [x] 자산/임차인/포트폴리오 E. NOC는 임대면적 가중평균 기준으로 답변
- [x] 자산 follow-up E. NOC는 대시보드 asset read와 같은 자산 단독 readback 기준으로 계산
- [x] 내부 table/provider/fallback/source row/asset id 노출 차단 QA
- Evidence: `qa-artifacts/logistics-gate6/ai-chatbot-qa-20260528-062617.json` (`npm run qa:ai-chatbot`, 24/24 pass)

## 2. Data Update 추가/수정/삭제
- [x] Data Update 화면 smoke: 필드 100/100 노출, 추가/수정/삭제 모드, 원장 모달, 단일 반영 버튼 확인
- [x] 정규 Supabase 자동 반영 smoke: 수정/readback/rollback, 신규 계약 생성 rollback, 계약 종료 아카이빙 rollback, 임대료 이력 append 중복 차단 등 23/23 pass
- [x] 삭제는 물리 삭제가 아니라 archive 흐름으로 유지
- Evidence: `qa-artifacts/logistics-gate6/data-update-auto-smoke-20260528-062823.json`

## 3. 권한 분기 전체 점검
- [x] 서버 기능 권한: feature access config를 Edge Function에 추가
- [x] Data Quality/Login History/Edit Request list 권한을 hard-coded 3명에서 기능 권한 설정 기반으로 확장 가능하게 변경
- [x] Data Update lease-events submit은 add/create, update/update, archive/delete 권한으로 분리
- [x] 배포 후 실제 live browser에서 탭/컴포넌트별 visibility/use 권한 재검증
- Evidence: `qa-artifacts/logistics-gate6/login-history-browser-smoke-20260528-065324.json`, `qa-artifacts/logistics-gate6/data-update-browser-smoke-20260528-064122.json`

## 4. 기능 권한 관리 팝업
- [x] 좌측 사이드바 로그인 이력 위에 `기능 권한 관리` 버튼 추가
- [x] 기획추진센터 3명만 기능 권한 관리 버튼 표시
- [x] AI 챗봇, Data Quality, Analysis Tools, Pivot Table, 로그인 이력, 건축물대장 새로고침, OpenDART 새로고침 대상자를 팝업에서 설정
- [x] 설정 저장 시 Edge Function `feature-access/update` 및 localStorage 동기화
- [x] 배포 후 live browser에서 노출/팝업 smoke
- Evidence: `qa-artifacts/logistics-gate6/login-history-browser-smoke-20260528-065324.json`

## 5. 건축물대장/OpenDART 새로고침 진행률
- [x] 각 새로고침 버튼별 진행 중 percent, 완료/전체 건수, progress bar 표시
- [x] 기능 권한 설정에 따라 버튼 표시 분리
- [x] 배포 후 live browser에서 버튼 표시 smoke
- Evidence: `qa-artifacts/logistics-gate6/external-refresh-buttons-browser-smoke-20260528-065456.png`, `qa-artifacts/logistics-gate6/external-api-smoke-20260528-070149.json`

## 6. Company DART UI
- [x] DART 상세 정보 본문은 핵심 row만 노출
- [x] 전체 상세 row와 3개년 주요 지표 차트는 상세보기 팝업으로 이동
- [x] 자산별 노출도를 임차 자산 현황 바로 아래로 이동
- [x] 배포 후 live browser에서 DART 상세보기 팝업/차트 hover smoke
- Evidence: `qa-artifacts/logistics-gate6/dart-chart-browser-smoke-20260528-065743.png`

## 7. 탭 전환 깜빡임
- [x] 좌측 네비게이션에서 `window.location.href` reload를 `history.pushState`로 교체
- [x] Dashboard 모듈 전환은 display 제거 대신 opacity/transform transition 적용
- [x] 배포 후 live browser에서 Work Platform/Home/게시판/만기 차트 smoke
- Evidence: `qa-artifacts/logistics-gate6/work-platform-browser-smoke-20260528-065901.json`

## 8. 배포 및 live smoke
- [x] Edge Function deploy: `ll-dashboard-api` to `qvegpozwrcmspdvjokiz`
- [x] Build: `npm run build:preview`
- [x] GitHub Pages deploy
- [x] Live URL 200 및 주요 화면 smoke
- [x] 로그인 전 blank page 회귀 수정 및 live `/auth-setup` 렌더링 확인
- Evidence: `qa-artifacts/logistics-gate6/live-root-unauth-after-fix.png`
