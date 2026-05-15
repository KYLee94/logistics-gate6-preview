# Component source consistency QA - 2026-05-13

- pass: 11
- blocked: 0
- fail: 0

| check | status | detail | evidence |
|---|---|---|---|
| home_asset_count_matches_asset_options | pass | Home 운영 자산 수 KPI와 Asset option 수가 일치해야 합니다. | {"kpi":17,"assetOptions":17} |
| home_rent_trend_starts_at_original_first_month | pass | 임대료 추이는 기존 원본처럼 2018-04부터 시작해야 합니다. | {"firstMonth":"2018-04","monthCount":44} |
| home_monthly_cost_kpi_vs_composition_sources | pass | Home KPI 월 임관리비는 현재 포트폴리오 스냅샷 기준이며 자산별/임차인별 비중 합계와 일치해야 합니다. | {"homeMonthlyCost":11134228842,"assetMonthlyCostSum":11134228842,"companyMonthlyCostSum":11134228842} |
| home_rent_trend_uses_contract_history_basis | pass | 임대료 추이는 현재 스냅샷 KPI가 아니라 계약 이력 월별 시계열 기준으로 분리 표시해야 합니다. | {"homeMonthlyCost":11134228842,"latestTrendMonth":"2026-06","latestAdjustedCost":10265767928,"latestRawTotal":10806432845,"diffVsAdjusted":868460914} |
| home_cold_storage_raw_labels_mapped | pass | 저온/상온 source label은 UI에서 Y=저온, N=상온으로 해석 가능해야 하며, 복합/사무실은 별도 용도로 유지합니다. | {"labels":["N","복합","Y","사무실"],"uiMapping":{"Y":"저온","N":"상온","other":"원본 용도명 유지"}} |
| asset_options_have_payloads | pass | 모든 Asset option은 상세 payload를 가져야 합니다. | {"optionCount":17,"payloadCount":17,"missing":[]} |
| company_options_have_payloads | pass | 모든 Company option은 상세 payload를 가져야 합니다. | {"optionCount":31,"payloadCount":31,"missing":[]} |
| company_option_count_vs_supabase_tenants | pass | Supabase ll_tenants 36건은 raw tenant_id 기준이고, 현재 Company option 31건은 화면 표시용 tenant_master_name 중복/placeholder 정리 기준입니다. | {"companyOptions":31,"supabaseLlTenantsReadback":36,"knownReason":"우진글로벌/JM로지스 중복 tenant_id와 tenant_name_* placeholder가 ll_tenants에 포함됨"} |
| sector_assets_by_rent_sorted | pass | Sector Top 자산 월 임관리비 정렬은 monthlyCostTotal desc이어야 합니다. | {"first":"인천석남물류센터"} |
| sector_tenants_by_rent_sorted | pass | Sector Top 임차인 월 임관리비 정렬은 monthlyCostTotal desc이어야 합니다. | {"first":"쿠팡(주)"} |
| permissions_asset_count_matches_asset_options_for_global_manager | pass | 권한표에는 전체 물류 자산을 볼 수 있는 사용자 매핑이 있어야 합니다. | {"assetOptions":17,"maxManagedAssets":17} |

판정: `blocked` 항목은 프론트 UI 문제가 아니라 원본 계산식, Supabase snapshot/normalized 기준, 또는 source coverage 확정이 필요한 항목입니다.