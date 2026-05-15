# Apps Script source formula extract - 2026-05-13

목적: 현재 프론트 숫자 불일치를 감으로 수정하지 않기 위해, 기존 Apps Script 코드에서 Home/Sector/Company 핵심 계산식과 popup basis를 코드 기준으로 고정했습니다.

## Home KPI source

원본: `C:\Users\10524\Desktop\codex_realasset\Project\03_Logi_Leasing_Dashboard\Metrics.gs`

| metric | source code basis |
|---|---|
| 운영 자산 수 | `assetSummaries.length` |
| 총 임대면적 | `totalLeasedAreaSqm` |
| 총 공실면적 | `totalVacancyAreaSqm` |
| 공실률 | `weightedVacancyRate` |
| 월 임대료 총액 | `sumKnownMetric_(activeRows, 'currentMonthlyRentTotal')` |
| 월 임관리비 총액 | `sumKnownMetric_(activeRows, function(row) { return row.currentMonthlyCostTotal != null ? row.currentMonthlyCostTotal : rent + mf })` |
| Home composition cold/warm | `aggregateDimension_(activeRows, 'coldStorageType', 'leasedAreaSqm')` |
| Home composition sector | `aggregateDimension_(activeRows, 'sector', 'currentMonthlyCostTotal')` |
| Top Contracts | tenant별 group 후 `monthlyTotal` desc Top 10 |
| Top Tenants | `companySummaries`의 `monthlyCostTotal` desc Top 10 |

## Home rent trend source

원본: `Metrics.gs > buildRollingRentTrendRows_`

| field | meaning |
|---|---|
| `monthlyRentTotal` | history row 월 임대료 원금 합계 |
| `monthlyMfTotal` | history row 월 관리비 원금 합계 |
| `monthlyTotal` | 원 월임대료 + 원 월관리비 |
| `monthlyRentTotalAdjusted` | RF/FO concession month일 때 rent 0 처리 |
| `monthlyMfTotalAdjusted` | 관리비 adjusted 합계 |
| `monthlyCostTotalAdjusted` | adjusted rent + adjusted mf |
| `activeAssetCount` | 해당 month 기준 active asset count |
| `grossFloorAreaSqm` | 총 연면적 basis row 합계 |

## Home popup source

원본: `Client.html`

| action | popup title | table/basis |
|---|---|---|
| `home-kpi-assets` | 운영 자산 수 | 자산명, 주소 / DB_자산 |
| `home-kpi-leased` | 총 임대면적 근거 | 자산명, 연면적, 공실면적, 공실률 / DB_일반+DB_자산 |
| `home-kpi-vacancy-area` | 총 공실면적 근거 | 자산명, 공실면적, 공실률 / DB_자산 |
| `home-kpi-vacancy-rate` | 공실률 계산 근거 | 연면적, 임대면적, 공실면적, 공실률 |
| `home-kpi-total-cost` | 월 임관리비 총액 근거 | 임차인명, 월 임대료, 월 관리비, 월 임관리비 / DB_히스토리 누적 |
| `home-rent-detail` | 임대료 추이 원본 표 | 월, 월 임대료(RF/FO 반영), 월 관리비, 월 임관리비(RF/FO 반영), 원 월임대료, 원 월관리비, 원 월임관리비, 자산 수, 총 연면적, 신규 편입 자산 |
| `home-cold-chart` | 저온/상온 구성 상세 | 구분, 비중 / DB_일반 |
| `home-sector-chart` | 섹터별 임관리비 상세 | 섹터, 집계값 / DB_일반+DB_히스토리 누적 |

## Sector source

원본: `Metrics.gs > buildSectorPayload_`

| component | source code basis |
|---|---|
| 지역별 노출도 | asset summary를 지역별 group, `monthlyCostTotal` desc |
| assetsByArea | `assetSummaries`의 `grossFloorAreaSqm` desc Top 10 |
| assetsByRent | `assetSummaries`의 `monthlyCostTotal` desc Top 10 |
| tenantsByArea | `companySummaries`의 `leasedAreaSqm` desc Top 10 |
| tenantsByRent | `companySummaries`의 `monthlyCostTotal` desc Top 10 |
| monthlyRent trend | `buildRentTrendRows_(model.historyRows)` |
| sectorMix | `aggregateDimension_(activeRows, 'sector', 'currentMonthlyRentTotal')` |

## Company source

원본: `Metrics.gs > buildCompanyPayload_`, `Client.html > renderCompanyLegacy_`

| component | source code basis |
|---|---|
| selector | `filters.companies` / selected tenant id |
| KPI | `company.kpis` |
| DART area | `DB_기업 + OpenDART` |
| leased assets table | 자산명, 층/세부구역, 면적, 월 임대료, 월 관리비, 월 임관리비, 만기 |
| KPI popup | 기업명, 값, DART 연결, basis line |

## Implementation implication

현재 새 프론트는 차트 UI는 개선됐지만, Home 월 임관리비 비중을 자산별/임차인별로 바꾸면서 원본의 `sector` composition과 source basis가 달라졌습니다. 사용자의 요구대로 자산별/임차인별 선택은 유지하되, KPI total과 같은 canonical source를 쓰도록 다음 단계에서 아래를 맞춰야 합니다.

1. Home KPI 월 임관리비 총액
2. 월 임관리비 도넛 total
3. 임대료 추이 latest total
4. Home KPI popup total
5. Company/Asset/Sector monthlyCostTotal

판정: 코드 기준 source는 추출됐고, 숫자 canonical 결정 및 전수 parity는 다음 blocker입니다.

