# 경산 쿠팡물류센터 E.NOC 보정 QA

- 판정: PASS
- 대상: 경산 쿠팡물류센터 전용면적 3건
- 원본 Excel 확인: DB_일반!R38=8970.67, DB_일반!R39=8970.67, DB_일반!R41=10219.43
- 보정 row: 1/N 852.09, 1/Y 8055.63, B2/N 1444.85
- 자산 임대면적 가중평균 E.NOC: 47097.67

## 체크
- workspace_weighted_enoc_uses_contract_leased_area: PASS
- target_asset_b2_ambient_exclusive_area_corrected: PASS
- target_asset_three_exclusive_area_rows_corrected: PASS
- target_asset_b2_ambient_audit_matches_corrected_row: PASS
- target_asset_three_audit_rows_match_corrected_rows: PASS
- target_company_duplicate_row_matches_asset_snapshot: PASS
- target_company_three_duplicate_rows_match_asset_snapshot: PASS
- source_excel_readback_records_user_reported_before_values: PASS
- asset_overview_average_matches_row_weighted_recalculation: PASS

## 추가 전수점검 후보
| floor | 구분 | 임대면적 | 전용면적 | E.NOC |
| --- | --- | ---: | ---: | ---: |
| B1 | 사무실 | 2304.76 | 347.9 | 216399.49 |
