# Gate 6 progress tracker

- Updated: 2026-05-20
- Source of truth: `gate6-progress-tracker-20260515.json`
- Overall: 169 / 280 (60.4%)
- Cleanup: active checklist now keeps latest requirements only. Retired legacy items remain in `retired_items` inside the JSON for audit history.

| Stage | Area | Done/Total | Rate |
|---:|---|---:|---:|
| 2 | 공통 데이터 기준 | 8 / 17 | 47.1% |
| 3 | 업무 로그 메인 페이지 | 31 / 40 | 77.5% |
| 4 | Dashboard 공통 | 7 / 15 | 46.7% |
| 5 | Weekly source data after tab removal | 2 / 4 | 50.0% |
| 6 | Home 탭 | 32 / 41 | 78.0% |
| 7 | Asset 탭 | 15 / 24 | 62.5% |
| 8 | Company 탭 | 10 / 15 | 66.7% |
| 9 | Pivot Table | 12 / 13 | 92.3% |
| 10 | Data Quality | 15 / 20 | 75.0% |
| 11 | Analysis Tools | 6 / 9 | 66.7% |
| 12 | 승인대기 대상 | 12 / 21 | 57.1% |
| 13 | 외부권한대기 대상 | 5 / 11 | 45.5% |
| 14 | QA 계획 | 14 / 35 | 40.0% |
| 15 | 최종 완료 기준 | 0 / 15 | 0.0% |

## Conflict Cleanup Applied

- Exact duplicate checklist IDs: 0.
- Legacy status alias normalized: `completed` -> `done`.
- Weekly tab/upload requirements are retired from the active checklist because the latest requirement removes Weekly from navigation and upload from active UI.
- Main integrated AI search requirement is retired/reworded because the latest requirement keeps keyword search in the main row and moves AI to the right chatbot dock.
- `Data Playground` wording is replaced by `Pivot Table`.
- PDF Report implementation details are tracked in Stage 4; Stage 15 keeps only final acceptance criteria.

## Newly Active Latest Items

| Stage | ID | Status | Item |
|---:|---|---|---|
| 5 | 5.17 | done | Latest requirement kept: Weekly tab is not an active navigation item. Legacy weekly routes redirect to Dashboard Home. |
| 5 | 5.18 | done | Latest requirement kept: weekly report upload buttons/popups are removed from active user flow. |
| 5 | 5.19 | partial | Weekly source asset status is now exposed through Work Platform Management Project Status table, including full-table popup and edit flow. User browser QA remains. |
| 5 | 5.20 | partial | Weekly source data remains a backend/source dataset for Management Project Status and Asset overview/investment panels. Remaining work is to remove static JSON fallback and rely on Supabase live fetch only. |
| 15 | 15.15 | pending | PDF Report final acceptance: selected Dashboard components, Asset overview/investment/map, A4 portrait multi-page export, and permission-scoped output pass live/manual QA. |
