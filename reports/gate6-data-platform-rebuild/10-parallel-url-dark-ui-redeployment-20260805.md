# Gate 6 신규 URL 병행 배포 정정 보고 (2026-08-05)

## 정정 결론

이 문서는 `09-root-shell-cutover-20260805.md`의 루트 전환 결론을 폐기하고 대체합니다. 기존 플랫폼은 기존 URL과 화면을 그대로 유지하며, 물류센터 데이터 관리 플랫폼은 별도 `/data-platform/*` URL에서만 실행합니다.

## URL 계약

- 기존 플랫폼 홈: `https://kylee94.github.io/logistics-gate6-preview/`
- 기존 업무 플랫폼: `https://kylee94.github.io/logistics-gate6-preview/work-platform`
- 기존 대시보드 홈: `https://kylee94.github.io/logistics-gate6-preview/home`
- 신규 데이터 플랫폼 홈: `https://kylee94.github.io/logistics-gate6-preview/data-platform/home`
- 신규 렌트롤: `https://kylee94.github.io/logistics-gate6-preview/data-platform/rent-roll`
- 신규 수익·비용: `https://kylee94.github.io/logistics-gate6-preview/data-platform/income-expense`

`/data-platform`은 로그인 후 `/data-platform/home`으로 정규화합니다. 기존 `/`, `/work-platform`, `/home`은 신규 플랫폼으로 전환하지 않습니다.

## UI·UX 계약

- 기존 공통 좌측 메뉴와 헤더 구조를 신규 화면에서도 사용합니다.
- 좌측 메뉴에는 기존 메뉴를 유지한 채 `물류센터 데이터 플랫폼` 항목만 추가합니다.
- 신규 화면은 기존 Gate 6의 다크 배경, 카드, 테두리, 파란 강조색과 같은 디자인 토큰을 사용합니다.
- 신규 플랫폼 내부 주요 탭은 `홈 / 렌트롤 / 수익·비용`만 노출합니다.

## TDD 및 배포 검증

- 라우팅 계약 테스트: 기존 URL 유지와 신규 중첩 URL을 먼저 실패 조건으로 작성한 뒤 통과시켰습니다.
- 전체 릴리스 게이트: 14/14 통과했습니다.
- 실제 로그인 브라우저 검증: 기존 3개 경로와 신규 4개 경로의 직접 접속·새로고침·세션 유지를 통과했습니다.
- 기존 루트에서는 업무보드가 표시되고 신규 데이터 플랫폼 본문은 표시되지 않습니다.
- 신규 URL에서는 데이터 플랫폼 본문과 기존 스타일의 좌측 메뉴가 함께 표시됩니다.
- 신규 화면에서 담당 자산 19건을 조회했습니다.
- 신규 렌트롤과 수익·비용의 입력 버튼은 서버 권한에 따라 활성화됨을 확인했습니다.
- 실제 배포 번들: `assets/index-o_QGgVZT.js`, `assets/index-CRp_uwF9.css`
- GitHub Pages 배포 커밋: `b38db5d882ef057f517cf574c50516521eb8b58d`

## 실화면 증거

- 기존 루트: `C:\tmp\gate6-data-platform-separated-live\root.png`
- 신규 홈: `C:\tmp\gate6-data-platform-separated-live\data-platform-home.png`
- 신규 렌트롤: `C:\tmp\gate6-data-platform-separated-live\data-platform-rent-roll.png`
- 신규 수익·비용: `C:\tmp\gate6-data-platform-separated-live\data-platform-income-expense.png`
