# Gate 6 홈·수익비용·알림 배포 후 교차검증

- 기준일: 2026-08-07 KST
- 범위: 홈 적층도 호버, 임대율·건축물대장 병합, 수익비용 필수 6개 계정·사용자 계정 hierarchy, 신규 3탭의 기존 알림 기능 보존
- 원칙: primary 응답만 합격, 샘플 금액 생성 금지, 읽기 검증 중 쓰기 0건

## 1. 소스·계약 검토 결과

### 홈

- `StackingPlan`은 현재 렌트롤의 occupied 행으로 층과 임차 구획을 구성하며, 마우스 호버와 키보드 포커스에서 임차인·층/구역·임대면적·월 임대료·관리비·합계를 표시한다.
- v6 `home/read`는 임대가능면적 → 연면적 → 공간면적 합계 순으로 분모를 고르고, 현재 유효 계약의 점유면적으로 임대율을 계산한다.
- 건축물대장 cache는 독립적인 대지면적·연면적·사용승인일이 일치할 때만 연결하고, 각 자산 필드의 원천을 `asset_source_provenance`로 반환한다.
- 발견·수정: `cloneHomeData()`가 서버의 `tenant_summary`, `occupancy_summary`, `asset_source_provenance`를 버리던 문제를 수정했다. 서버 응답 전체를 재귀 복사하고, 임대율은 서버 요약을 우선 사용한다. `null` 임대율은 0%로 오표시하지 않는다.
- 홈 저장은 계속 `HOME_ENTITY_CONFIG`의 허용 필드만 operation으로 만들므로 보존한 서버 메타데이터는 저장 payload에 들어가지 않는다.

### 수익비용

- 필수 기본 선택 6개는 `INTEREST_PAID`, `TENANT_IMPROVEMENT`, `LEASING_COMMISSION`, `AMC_FEE`, `CUSTODY_FEE`, `GENERAL_ADMIN_TRUSTEE_FEE`다.
- frontend 기본값과 v6 `finance/read` 기본값이 일치한다. 운영 readback의 `selected` 값이 자산별 진리 원천이다.
- 사용자 계정은 각 NOI hierarchy 안에서 생성되고, 사람용 명칭·section·display order·선택 상태·revision·readback을 유지한다. 비활성 계정은 금액을 삭제하지 않고 hierarchy 하단에서 입력 불가 상태로 남는다.

### 알림

- 기존 우측 알림 버튼·패널 구현은 하나만 존재하며, 기존 물류 화면과 신규 3탭 사이드바가 같은 렌더러를 재사용한다.
- 읽지 않은 알림 표시, `notifications/list`, 새로고침, 읽음, 삭제, 시스템 알림 기능을 보존한다.

## 2. 배포 후 실행 명령

### A. 운영 데이터 projection·필수 계정 읽기 검증

```powershell
node scripts/qa/logistics-home-finance-live-matrix.cjs --env-root C:\tmp\IGIS-Fund-Production-DP
```

합격 기준:

- 최상위 `ok:true`
- 모든 자산의 `home.projection.errors:[]`
- 서버 임대율이 `occupied_area_sqm / denominator_area_sqm × 100`과 일치
- `building_merge_evidence_count > 0`
- 모든 자산의 `finance.required_default_account_errors:[]`
- 모든 6개 scenario/basis 조합의 ledger 0건, 쓰기 0건

### B. 홈 직접 URL·새로고침·적층도·임대율·알림 브라우저 검증

```powershell
node scripts/qa/logistics-data-platform-deeplink-browser.cjs --env-root C:\tmp\IGIS-Fund-Production-DP --base-url https://kylee94.github.io/logistics-gate6-preview/ --expected-base-path /logistics-gate6-preview/ --data-platform-only --route data-platform-home --require-authenticated --expect-write-enabled --screenshot-dir output/playwright/release-home

node scripts/qa/logistics-notification-panels-live-browser.cjs --env-root C:\tmp\IGIS-Fund-Production-DP --base-url https://kylee94.github.io/logistics-gate6-preview/ --timeout-ms 45000
```

합격 기준:

- 직접 진입과 새로고침 모두 HTTP 200, 홈 탭과 선택 자산 유지
- `home_projection.occupancy_matches_server:true`
- `home_projection.asset_provenance_present:true`
- `home_projection.stacking_tenant_count > 0`
- 적층도 툴팁이 호버·키보드 포커스에서 보이고 6개 업무 항목을 모두 포함
- 만기 알림과 우측 알림 패널 모두 표시, primary 응답, 내부 UUID 노출 없음, 쓰기 0건

### C. 수익비용 직접 URL·브라우저 계약 검증

```powershell
node scripts/qa/logistics-data-platform-deeplink-browser.cjs --env-root C:\tmp\IGIS-Fund-Production-DP --base-url https://kylee94.github.io/logistics-gate6-preview/ --expected-base-path /logistics-gate6-preview/ --data-platform-only --route data-platform-income-expense --require-authenticated --expect-write-enabled --screenshot-dir output/playwright/release-finance
```

합격 기준:

- 직접 진입과 새로고침 모두 HTTP 200
- 수익비용 쓰기 제어가 활성화되고 시계열 hover tooltip이 표시
- 손익표에 필수 6개 사람이 읽는 계정명이 있고 모두 선택 상태
- 5개 hierarchy마다 사용자 항목명 입력과 항목 추가 제어가 한 세트씩 존재
- 비활성 계정은 `미사용 계정 · NOI 제외` 아래에서 입력 불가

### D. 운영 same-value 저장·재조회

```powershell
node scripts/qa/logistics-home-finance-live-matrix.cjs --env-root C:\tmp\IGIS-Fund-Production-DP --execute-safe-noop --confirm-live-same-value-writes
```

합격 기준:

- 홈 14+6+4+10 필드 전수 same-value 저장 후 mismatch 0건
- 필수 6개를 포함한 선택 상태 save response·재조회 mismatch 0건
- empty finance save 전후 ledger 0건이며 샘플 금액 생성 0건

## 3. 자동 테스트

```powershell
node --test tests/logistics-data-platform-home-projection-preservation.test.cjs tests/logistics-data-platform-home-density.test.cjs tests/logistics-backend-editable-contracts-v6.test.cjs tests/logistics-data-platform-finance-custom-accounts.test.cjs tests/logistics-data-platform-notification-preservation.test.cjs tests/logistics-notification-frontend.test.cjs tests/logistics-home-finance-notification-cross-validation.test.cjs
```

현재 관련 테스트는 모두 통과한다. 라이브 브라우저와 운영 same-value 저장은 v6 migration·Edge·frontend 배포가 완료된 뒤 실행해야 한다.
