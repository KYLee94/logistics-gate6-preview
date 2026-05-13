# Chart axis and density QA - 2026-05-13

## Scope
- Tabs checked:
  - Home
  - Asset
  - Company
  - Sector

## Changes verified
- Common bar charts now show:
  - Y-axis category label
  - X-axis value label
  - 0 / midpoint / maximum tick labels
  - Legend explaining bar length
- Trend charts now show:
  - Y-axis amount labels
  - X-axis month labels
  - Series legend
- Table rows and section headers were tightened to reduce unused whitespace.
- Company exposure chart falls back to area mode when cost exposure values are blank, so the chart area is not left empty.

## Local QA result
- Result JSON: `qa-artifacts/logistics-gate6/chart-density-qa-20260513/chart-density-qa-result.json`
- Screenshots:
  - `home-chart-density.png`
  - `asset-chart-density.png`
  - `company-chart-density.png`
  - `sector-chart-density.png`

## Result
- Home axis/legend: PASS
- Asset axis/legend: PASS
- Company axis/legend: PASS
- Sector axis/legend: PASS
- Admin Data exposure: PASS
- Page errors: 0
