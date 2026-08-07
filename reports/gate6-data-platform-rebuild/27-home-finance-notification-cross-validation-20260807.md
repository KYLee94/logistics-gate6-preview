# Gate 6 홈·수익비용·알림 교차검증 SDD

- 기준일: 2026-08-07 KST
- 대상: 운영 `v2/home/*`, `v2/finance/*`, 신규 만기 알림, 기존 우측 알림 패널
- 금지: 샘플 금액 생성, 임의 값 보충, 브라우저 fallback·stale 응답의 성공 판정, 실제값을 다른 값으로 변경

## 1. 홈 편집 매트릭스

| 엔티티 | 필드 수 | 필드 |
|---|---:|---|
| asset | 14 | name, address, zoning_text, land_area_sqm, building_area_sqm, gross_area_sqm, leasable_area_sqm, primary_use, building_coverage_ratio, floor_area_ratio, floor_count, structure_text, parking_count, completion_date |
| fund | 6 | name, fund_type, investment_strategy, inception_date, maturity_date, ownership_ratio |
| beneficiary | 4 | tranche, beneficiary_name, agreed_amount_krw, contributed_amount_krw |
| loan | 10 | tranche, lender_name, committed_amount_krw, drawdown_date, maturity_date, loan_type, interest_type, coupon_rate, all_in_rate, fee_rate |

기본 모드는 모든 읽기 가능한 자산을 조회하고 필드·행·revision 매트릭스만 만든다. 운영 저장은 읽어온 값을 그대로 보내는 same-value update만 허용한다. 저장 뒤 `v2/home/read`를 다시 호출해 엔티티 키와 필드별 값을 비교한다. fund의 `ownership_ratio`는 `link_revision`, 나머지는 `fund_revision`, loan의 `lender_name`은 `lender_revision`, 나머지는 `loan_revision`을 사용한다.

## 2. 수익비용 매트릭스

- 모든 읽기 가능한 자산의 atomic 계정만 대상으로 현재 `selected` 값을 동일하게 upsert한다.
- `selection_revision`이 있는 계정만 `expected_revision`을 보낸다.
- 저장 응답 `accounts_readback`과 재호출한 `v2/finance/read` 모두에서 계정별 선택 상태가 일치해야 한다.
- 전체 기간·`actual|budget|forecast`·`accrual|cash` 조합에서 기존 ledger 0건을 확인한다.
- empty save는 `entries:[]`, `account_operations:[]`, `selection_operations:[]`만 보내며 금액이나 샘플 행을 만들지 않는다.

## 3. 실행 명령

읽기 전용 매트릭스:

```powershell
node scripts/qa/logistics-home-finance-live-matrix.cjs --env-root C:\tmp\IGIS-Fund-Production-DP
```

운영 same-value 저장 및 필드별 재조회:

```powershell
node scripts/qa/logistics-home-finance-live-matrix.cjs --env-root C:\tmp\IGIS-Fund-Production-DP --execute-safe-noop --confirm-live-same-value-writes
```

두 알림 패널 라이브 브라우저 검증:

```powershell
node scripts/qa/logistics-notification-panels-live-browser.cjs --env-root C:\tmp\IGIS-Fund-Production-DP --base-url https://kylee94.github.io/logistics-gate6-preview/
```

## 4. 알림 판정 기준

### 만기 알림

- 선택 자산 전환 중 `만기 알림 0`이 잠시 노출되지 않는다.
- `v2/maturities/read`가 HTTP 200과 `{ok:true,status:"primary"}`로 응답한다.
- 헤더 건수와 팝업 행 수가 일치한다.
- 행과 상세에는 임차인·펀드·대주 등 사람이 읽는 명칭과 날짜가 보이며 내부 UUID·키가 보이지 않는다.
- 검증 중 쓰기 호출 0건이어야 한다.

### 기존 우측 알림 패널

- `logistics-notification-button` 클릭 후 `logistics-notification-panel`이 열린다.
- `notifications/list`가 정상 응답하고 stale/fallback 안내문이 없어야 한다.
- 알림이 있으면 제목·본문이 사람용 문구이고 내부 필드키·UUID가 보이지 않는다. 알림이 없으면 `새 알림이 없습니다.`가 표시된다.
- 읽음·삭제 버튼은 누르지 않으며 검증 중 쓰기 호출 0건이어야 한다.

## 5. 완료 기준

- 홈 계약 필드 정의가 14+6+4+10으로 정확하다.
- dry-run은 운영 데이터를 변경하지 않는다.
- 실행 모드는 모든 대상 필드의 same-value 저장과 재조회 비교가 일치한다.
- 선택 상태는 save response와 재조회가 모두 일치하고 ledger는 계속 0건이다.
- 두 알림 패널의 라이브 결과가 위 판정 기준을 모두 통과한다.

## 6. 2026-08-07 실행 결과와 잔여 게이트

- 읽기 전용 홈·수익비용 매트릭스: PASS. 읽기 가능한 자산 19개, 홈 필드 셀 1,302개, 자산별 수익비용 선택 가능 계정 36개, 6개 `scenario × basis` 조합의 ledger 0건, 쓰기 0건을 확인했다.
- 신규 만기 알림 라이브 브라우저: PASS. `불러오는 중 → 만기 알림 2` 전환 중 0건 깜빡임이 없었고, 국민은행·신한은행 대출 만기 2건과 상세 2건, primary 응답, 쓰기 0건을 확인했다.
- 기존 우측 알림 패널의 배포본 사전 점검: FAIL. 신규 3탭 전용 사이드바 분기가 기존 버튼과 패널을 렌더링하지 않아 `RIGHT_NOTIFICATION_BUTTON_NOT_VISIBLE`로 판정됐다.
- 소스 수정: 기존 알림 버튼·패널을 공용 렌더러로 추출하고 기존 화면과 신규 3탭 화면이 같은 구현을 재사용하도록 했다. 회귀 테스트 11개와 임시 production build가 통과했다.
- 잔여 게이트: 수정본 배포 후 두 알림 패널 라이브 브라우저 검증을 다시 실행해야 하며, 운영 same-value 전수 저장·재조회는 명시적 실행 옵션을 사용해 별도 수행한다.
