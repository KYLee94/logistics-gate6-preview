# Home / Asset QA - E.NOC, 용도 범례, 임차인 계약

- 자산 JSON 수: 17
- flag 자산 수: 5

## 코드 체크
- weeklyFreeWeekSelector: PASS
- doughnutHoverTooltip: PASS
- normalizedUseLegend: PASS
- tenantContractFullTable: PASS
- assetENocWon: PASS
- assetExpiryZoneTooltip: PASS

## E.NOC 확인 필요 자산
| 자산명 | E.NOC | overview E.NOC | flag |
| --- | ---: | ---: | --- |
| 부산송정물류센터 | - | 0 | missing_or_zero_enoc |
| 아레나스양지물류센터 | 43824 | 6706 | user_named_check |
| 아레나스안성 | - | 0 | missing_or_zero_enoc |
| 부국물류센터 | - | 0 | missing_or_zero_enoc |
| 경산 쿠팡물류센터 | 589563 | 589562.8 | outlier_high_enoc |

## 용도 범례 기준
- 허용 범례: 상온창고, 복합, 저온창고, 사무실
- 하역장/공용/기타 등은 Home 도넛 범례에 직접 노출하지 않고 복합으로 합산합니다.
