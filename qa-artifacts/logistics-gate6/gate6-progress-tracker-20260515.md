# Gate 6 progress tracker

- Updated: 2026-05-20
- Source of truth: `gate6-progress-tracker-20260515.json`
- Overall: 173 / 286 (60.5%)
- Active work branch: `codex/logistics-gate6-post-deploy-updates` on `preview` remote.
- User-facing deployment branch `gh-pages` has been updated for TASK deletion flow.

| Stage | Area | Done/Total | Rate |
|---:|---|---:|---:|
| 2 | 공통 데이터 기준 | 8 / 18 | 44.4% |
| 3 | 업무 로그 메인 페이지 | 31 / 41 | 75.6% |
| 4 | Dashboard 공통 | 7 / 15 | 46.7% |
| 5 | Weekly source data after tab removal | 2 / 4 | 50.0% |
| 6 | Home 탭 | 32 / 41 | 78.0% |
| 7 | Asset 탭 | 15 / 24 | 62.5% |
| 8 | Company 탭 | 10 / 15 | 66.7% |
| 9 | Pivot Table | 12 / 13 | 92.3% |
| 10 | Data Quality | 15 / 20 | 75.0% |
| 11 | Analysis Tools | 6 / 9 | 66.7% |
| 12 | 승인대기 대상 | 14 / 23 | 60.9% |
| 13 | 외부권한대기 대상 | 5 / 11 | 45.5% |
| 14 | QA 계획 | 16 / 37 | 43.2% |
| 15 | 최종 완료 기준 | 0 / 15 | 0.0% |

## Latest Deployment Update

- qveg live Edge Function `ll-dashboard-api` deployed as version 33.
- GitHub Pages `gh-pages` deployed and cache-busted live URL returns `assets/index-B6zSL6-K.js`.
- Live JS bundle includes `work-platform/tasks/archive-seed` and `weekly-assets/latest`.
- Actual browser button QA remains a user-facing check because it writes/deletes live TASK records.
