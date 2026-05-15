# Monthly cost basis reconciliation - 2026-05-14

## 판정

- 상태: `partial pass`
- mutation: `0건`
- 결론: 화면에서 같은 이름으로 섞이던 `월 임관리비` 기준을 분리했습니다.

## 기준별 값

| 기준 | 값 | 의미 | 화면 처리 |
|---|---:|---|---|
| Home KPI / 자산별 비중 / 임차인별 비중 | `11,134,228,842` | 현재 포트폴리오 스냅샷 기준 | KPI와 도넛 비중 차트 기준 |
| 임대료 추이 최신월 adjusted | `10,265,767,928` | 계약 이력 월별 시계열 기준 | `계약 이력 기준 임대료·관리비 추이`로 라벨 분리 |
| 임대료 추이 최신월 raw total | `10,806,432,845` | 원 월임대료+원 월관리비 기준 | 추이 상세 표에만 노출 |
| Supabase `ll_rent_history.is_latest` 합계 | `10,070,115,024` | 정규화 테이블 최신 이력 기준 | 데이터 무결성 검토 대상 |

## 확인 증거

- 로컬 payload 확인
  - `logisticsHomeData.json` KPI `monthly_total_cost`: `11,134,228,842`
  - `logisticsAssetOptionsData.json` 합계: `11,134,228,842`
  - `logisticsCompanyOptionsData.json` 합계: `11,134,228,842`
  - rent trend latest month: `2026-06`
  - rent trend latest adjusted: `10,265,767,928`
  - rent trend latest raw: `10,806,432,845`

- Supabase readback
  - `ll_rent_history.is_latest = true`
  - tenant group count with latest rows: `18`
  - latest monthly total sum: `10,070,115,024`

## 조치

- Home 추이 차트에서 최신월 값을 KPI로 덮어쓰던 보정 로직을 제거했습니다.
- 추이 차트 제목을 `계약 이력 기준 임대료·관리비 추이`로 바꿨습니다.
- 차이 안내 문구를 추가해 KPI/도넛은 현재 스냅샷, 추이는 계약 이력 월별 시계열임을 분리했습니다.

## 남은 blocker

- Supabase 정규화 최신 이력 합계와 스냅샷 KPI 차이의 원인 분류는 아직 필요합니다.
- 이 항목은 화면 오표기 blocker는 닫았지만, 데이터 정규화 gate는 `blocked`입니다.

## 2026-05-14 추가 분해 결과

정규화 최신 이력 합계와 스냅샷 KPI 차이 `1,064,113,818`은 전체 자산 문제가 아니라 아래 3개 자산에서만 발생합니다.

| 자산 | snapshot | ll_rent_history latest | diff | reason |
|---|---:|---:|---:|---|
| 여주 본두리 물류센터 | 1,028,369,423 | 656,143,323 | 372,226,100 | `aggregation_scope_mismatch` |
| 아레나스양지물류센터 | 552,212,356 | 189,633,928 | 362,578,428 | `aggregation_scope_mismatch` |
| 스카이박스1, 스카이박스2 | 669,324,200 | 340,014,910 | 329,309,290 | `aggregation_scope_mismatch` |

정상 일치 자산은 12개이며, 이 12개 합계는 snapshot과 normalized latest가 모두 `8,884,322,863`으로 일치합니다.

따라서 이 blocker는 막연한 전체 데이터 오류가 아니라, 위 3개 자산의 스냅샷 집계 범위와 `is_latest=true` 정규화 이력 범위 차이로 축소됐습니다.

## DB 기록 상태

- `public.ll_data_quality_findings`에 위 3건을 기록하는 SQL은 작성했습니다.
- 실제 INSERT/UPDATE는 현재 Gate 6 전 DB mutation 금지 정책으로 차단되어 실행하지 않았습니다.
- SQL preview: `qa-artifacts/logistics-gate6/monthly-cost-reconciliation-write-preview-20260514.sql`
