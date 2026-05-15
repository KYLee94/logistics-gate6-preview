# Weekly upload and dashboard contract preview - 2026-05-14

## Goal

The main worklog page must upload a Word weekly report and update the selected weekly dashboard week.

The upload control label must be:

`주간업무보고자료 업로드`

## Week selector

The selector must not be fixed to `2026년 4월 4주차`.

Required controls:

| control | requirement |
|---|---|
| year | selectable full configured range |
| month | 1 to 12 |
| week | all weeks in selected month |
| week date range | visible label, e.g. `2026-04-20 ~ 2026-04-26` |

## Week key rule

Recommended key:

`YYYY-MM-Wn`

Stored fields:

| field | example |
|---|---|
| `report_year` | `2026` |
| `report_month` | `4` |
| `report_week` | `4` |
| `week_start_date` | `2026-04-20` |
| `week_end_date` | `2026-04-26` |
| `week_key` | `2026-04-W4` |

## Upload flow

1. User selects year/month/week.
2. UI shows week date range.
3. User uploads Word file.
4. Server parses document.
5. Server stores original text, parsed summary, issue/status/plan rows.
6. Weekly dashboard reloads the selected `week_key`.
7. Readback confirms saved row counts and rendered dashboard content.

## Dashboard display rule

Weekly dashboard must not show all raw project fields by default.

Default view should emphasize:

| block | default content |
|---|---|
| 핵심 이슈 | high-impact issue text |
| 현재 현황 | current status/progress |
| 향후 계획 | next action / schedule |
| 관련 자산/펀드 | linked asset/fund |
| 담당/이해관계자 | owner/stakeholder |

Raw details should be available through popup/drawer/detail table, not dumped into the main weekly table.

## Project grouping

| group | meaning | default UI |
|---|---|---|
| 신규 투자 projects | acquisition/new investment/project pipeline | compact issue/status/plan cards or rows |
| 관리 projects | existing asset/fund management | compact issue/status/plan cards or rows |
| 공통/섹터 tasks | sector-level operations | separate tab/filter |

## Required server endpoints

| endpoint | behavior |
|---|---|
| `weekly/ingest` or `ll-weekly-doc-ingest` | parse and save uploaded Word |
| `weekly/read` | read selected week |
| `weekly/update` | edit weekly issue/status/plan rows |
| `weekly/history` | audit uploaded/edited weekly rows |

## QA acceptance

| scenario | expected |
|---|---|
| select 2026/4/W4 | date range shown |
| select other valid week | selectable, not disabled |
| upload Word to selected week | that week dashboard changes |
| reopen same week | saved content persists |
| upload duplicate file | duplicate handling visible |
| Reader upload | 403 |
| Manager/Admin upload | accepted if permission allows |
| malformed file | clear error, no partial write |
| weekly edit | before/after/readback audit exists |

