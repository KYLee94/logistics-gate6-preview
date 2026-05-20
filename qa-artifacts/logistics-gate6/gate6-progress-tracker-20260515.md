# Gate 6 progress tracker

- Updated: 2026-05-20
- Source of truth: `gate6-progress-tracker-20260515.json`
- Overall: 171 / 285 (60%)
- Active work branch: `codex/logistics-gate6-post-deploy-updates` on `preview` remote.
- User-facing deployment branch `gh-pages` is intentionally untouched.

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
| 12 | 승인대기 대상 | 13 / 23 | 56.5% |
| 13 | 외부권한대기 대상 | 5 / 11 | 45.5% |
| 14 | QA 계획 | 15 / 36 | 41.7% |
| 15 | 최종 완료 기준 | 0 / 15 | 0.0% |

## Latest Process Update

- Main TASK seed rows are now treated as deletable by storing an archived/deleted Supabase record, then filtering them from active UI on refresh.
- Real Supabase TASK rows are removed from UI only after Edge delete success.
- Archive page remains read/search only; no edit/add/delete flow is added there.
- Edge deployment and live smoke remain separate before gh-pages release.
