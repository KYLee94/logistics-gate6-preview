# Home KPI canonical source check - 2026-05-13

목적: 사용자가 지적한 “자산별 월 임관리비 총액, 임차인별 월 임관리비 총액, 임대료 추이 총액이 다름” 문제를 숫자로 고정합니다.

## Current frontend snapshot values

`src/components/system/workspace/logisticsHomeData.json` 기준:

| metric | value |
|---|---:|
| 운영 자산 수 | 17 |
| 총 임대면적 | 1,340,655.46 |
| 총 공실면적 | 280,416.531 |
| 공실률 | 17.193% |
| 월 임대료 총액 | 10,613,355,289 |
| 월 임관리비 총액 | 11,134,228,842 |

`rentTrend` 마지막 row:

| month | monthlyRentTotal | monthlyMfTotal | monthlyTotal | monthlyRentTotalAdjusted | monthlyMfTotalAdjusted | monthlyCostTotalAdjusted |
|---|---:|---:|---:|---:|---:|---:|
| 2026-06 | 10,300,994,506 | 505,438,339 | 10,806,432,845 | 9,760,329,589 | 505,438,339 | 10,265,767,928 |

## Supabase readback comparison

`supabase-readonly-integrity-20260513.md` 기준:

| metric | snapshot | normalized ll_* | diff |
|---|---:|---:|---:|
| leased_area_total | 1,340,655.46 | 1,350,959.71 | -10,304.25 |
| monthly_rent_total | 10,613,355,289 | 9,625,568,269 | 987,787,020 |
| monthly_total_cost | 11,134,228,842 | 10,070,115,024 | 1,064,113,818 |

## Current decision

현재는 화면의 숫자를 임의로 하나에 맞추면 안 됩니다. 원본 Apps Script 계산식에서 아래 기준을 확정해야 합니다.

1. Home KPI는 `ll_payload_snapshots` snapshot을 canonical로 볼지, normalized `ll_rent_history` 합계를 canonical로 볼지
2. RF/FO 조정값을 월 임대료와 월 임관리비에 포함하는지
3. 임대료 추이의 마지막 month를 `2026-06`으로 보는 것이 원본과 같은지
4. 자산별/임차인별 월 임관리비 비중이 KPI total과 같은 source를 쓰는지
5. 팝업의 상세 table도 같은 source 기준인지

판정: Home KPI/차트 숫자 parity는 `blocked`입니다. 다음 작업은 Apps Script `Metrics.gs`와 `Client.html`의 원본 계산식 및 popup basis를 추출하는 것입니다.

