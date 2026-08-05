# Gate 6 루트 화면 전환 및 재배포 결과 (2026-08-05)

## 정정

이전 배포는 `/home`, `/rent-roll`, `/income-expense`의 신규 화면과 API를 추가했지만, 사용자가 실제로 접속하는 루트 주소와 공통 왼쪽 메뉴는 기존 `업무 보드` 화면을 계속 표시했습니다. 따라서 루트 화면이 전면 재구축됐다는 이전 완료 판단은 잘못이었습니다.

## 이번 수정

- 루트 `/`, `/work-platform`, 내부 물류 루트가 모두 신규 데이터 플랫폼의 `/home`으로 이동하도록 라우팅 계약을 변경했습니다.
- 신규 데이터 플랫폼에서는 기존 `IotaLeftNav`와 `SystemLeftNav`를 렌더링하지 않도록 공통 레이아웃을 분리했습니다.
- 신규 화면의 상단을 `홈 / 렌트롤 / 수익·비용` 세 탭, 담당 자산 선택, 만기 알림, 계정·권한, 로그아웃으로 구성했습니다.
- 홈의 만기 조회를 상단 알림과 공유하고, 기존 대출 원장과 담당 자산 조회는 그대로 유지했습니다.
- 브라우저 계약에 루트 주소, 루트→홈 전환, 기존 업무보드 미노출, 새로고침 유지, 담당 자산 조회, 렌트롤·수익비용 쓰기 가능 여부를 추가했습니다.

## 검증 및 배포 증거

- 전체 릴리스 게이트: 14/14 통과
- 라이브 검증 시각: 2026-08-05 13:25 KST
- GitHub Pages 브랜치: `f0760fb1f85dfa0fb23bc82cf302289949384cfa`
- 라이브 번들: `/logistics-gate6-preview/assets/index-zkQryVcu.js`
- 루트, 홈, 렌트롤, 수익·비용: HTTP 200 및 새로고침 통과
- 로그인 세션 유지: 통과
- 담당 자산: 19개 조회
- 기존 업무보드 노출: 0건
- 렌트롤·수익비용 행 추가: 서버 권한 기준 활성화 확인
- 라이브 화면 캡처: `C:\tmp\gate6-data-platform-live-screenshots\root.png`, `rent-roll.png`, `income-expense.png`

## 실제 주소

- 루트: https://kylee94.github.io/logistics-gate6-preview/
- 홈: https://kylee94.github.io/logistics-gate6-preview/home
- 렌트롤: https://kylee94.github.io/logistics-gate6-preview/rent-roll
- 수익·비용: https://kylee94.github.io/logistics-gate6-preview/income-expense
