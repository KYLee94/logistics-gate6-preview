# Table column width QA rules - 2026-05-14

## Goal

All dashboard tables must fit the work-platform information density. First columns must not be unnecessarily wide.

## Column width policy

| column type | width rule | alignment |
|---|---|---|
| id/code | compact | left |
| date | compact | center |
| status/role/permission | compact | center |
| numeric/currency/area/percent | compact to medium | right |
| asset/fund/tenant name | medium | left |
| issue/status/plan/description | flexible | left |
| action buttons | icon-sized | center |

## Page coverage

This rule applies to:

- main worklog page
- Weekly
- Home
- Asset
- Company
- Sector
- Analysis Tools
- Data Playground
- Data Quality

## QA checks

| check | expected |
|---|---|
| first column width | not larger than needed for code/status/date |
| horizontal scroll | absent where practical; if present, justified by data density |
| numbers | right-aligned and same unit formatting |
| issue/plan text | uses flexible width, wraps cleanly |
| clickable rows/cells | cursor pointer and hover state |
| header text | no overlap or truncation without tooltip |
| mobile/narrow viewport | no incoherent overlap |

## Implementation preference

- Use fixed compact widths for small fields.
- Use `minmax()` or flexible columns for descriptions.
- Do not make the first column a large generic label column.
- Detail-heavy rows should use popup/drawer rather than overly wide table columns.

