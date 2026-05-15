# Gate 6 user requirements addendum - 2026-05-14

## Data Quality editing

- Data Quality tab must support Excel-like direct editing.
- Edits must write back to Supabase only through controlled server/API paths.
- Permissions must follow the user-provided manager/asset/fund permission workbook:
  - asset/fund scope
  - read/create/update/delete rights
  - user identity and organization
- Frontend hiding is not enough. Server-side permission checks are required.
- Data Quality needs submit/approve/reject/readback flow, not raw direct browser mutation.

## Weekly report upload and dashboard

- Weekly upload control label should be `주간업무보고자료 업로드`.
- Year, month, and week must not be fixed to `2026년 4월 4주차`.
- User must be able to select all valid years/months/weeks.
- Week selector must clearly show the date range for each week.
- Uploaded Word report must update the selected weekly dashboard week.
- Weekly dashboard UI should focus on:
  - 핵심 이슈
  - 현재 현황
  - 향후 계획
  - 담당/관련 자산 또는 펀드
- Weekly dashboard should not dump every raw project field into large tables.
- 신규 투자 projects and 관리 projects should be summarized around issue/status/plan, with detail available by popup or drilldown.

## Table column ratio and density

- All dashboard tables must be reviewed for column width.
- First columns must not be unnecessarily wide.
- Tables should avoid horizontal scroll where practical.
- Width should be allocated by information importance:
  - ID/code/date/status: compact
  - asset/tenant/fund names: medium
  - issue/plan/description: flexible
  - numeric values: right-aligned compact
- This applies to Home, Asset, Company, Sector, Weekly, Analysis Tools, Data Playground, and Data Quality.

