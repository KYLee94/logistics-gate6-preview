# Market Data 온도 구분 의미 검증

- 결과: PASS
- 기준: 임대시장 통계 sheet의 별도 segment row를 Edge API statistics_rows와 source_row_number로 검증

- 복합 상온: 복합 물류센터 행 중 상온 조건을 별도 관측한 원천 행입니다.
- 복합 저온: 복합 물류센터 행 중 저온 조건을 별도 관측한 원천 행입니다.
- 상온(복합포함): 단일 상온과 복합센터 상온 조건을 포함한 원천 집계 행입니다. 앱에서 임의 합산하지 않습니다.
- 저온(복합포함): 단일 저온과 복합센터 저온 조건을 포함한 원천 집계 행입니다. 앱에서 임의 합산하지 않습니다.

| segment | row_count | source rows | metrics | periods | region values | size values |
| --- | ---: | --- | --- | ---: | ---: | ---: |
| 복합 상온 | 1183 | 13, 14, 15, 16, 17, 18, 60, 61, 62, 63, 64, 65 | deposit_manwon_per_py, management_fee_manwon_per_py, rent_free_months_per_year, rent_free_vacancy_10, rent_manwon_per_py, vacancy_rate | 12 | 674 | 509 |
| 복합 저온 | 1186 | 19, 20, 21, 22, 23, 24, 66, 67, 68, 69, 70, 71 | deposit_manwon_per_py, management_fee_manwon_per_py, rent_free_months_per_year, rent_free_vacancy_10, rent_manwon_per_py, vacancy_rate | 12 | 680 | 506 |
| 상온(복합포함) | 1198 | 37, 38, 39, 40, 41, 42, 84, 85, 86, 87, 88, 89 | deposit_manwon_per_py, management_fee_manwon_per_py, rent_free_months_per_year, rent_free_vacancy_10, rent_manwon_per_py, vacancy_rate | 12 | 683 | 515 |
| 저온(복합포함) | 1126 | 43, 44, 45, 46, 47, 48, 90, 91, 92, 93, 94 | deposit_manwon_per_py, management_fee_manwon_per_py, rent_free_months_per_year, rent_free_vacancy_10, rent_manwon_per_py, vacancy_rate | 12 | 646 | 480 |
