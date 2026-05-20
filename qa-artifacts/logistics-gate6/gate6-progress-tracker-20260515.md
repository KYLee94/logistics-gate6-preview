# Gate 6 progress tracker

- Updated: 2026-05-20
- Source of truth: `gate6-progress-tracker-20260515.json`
- Overall: 177 / 288 (61.5%)
- Active work branch: `codex/logistics-gate6-post-deploy-updates` on `preview` remote.
- User-facing deployment branch `gh-pages` is being updated for the Work Platform profile avatar fallback.

| Stage | Area | Done/Total | Rate |
|---:|---|---:|---:|
| 2 | 공통 데이터 기준 | 9 / 18 | 50.0% |
| 3 | 업무 로그 메인 페이지 | 31 / 41 | 75.6% |
| 4 | Dashboard 공통 | 7 / 15 | 46.7% |
| 5 | Weekly source data after tab removal | 3 / 4 | 75.0% |
| 6 | Home 탭 | 32 / 41 | 78.0% |
| 7 | Asset 탭 | 15 / 24 | 62.5% |
| 8 | Company 탭 | 10 / 15 | 66.7% |
| 9 | Pivot Table | 12 / 13 | 92.3% |
| 10 | Data Quality | 15 / 20 | 75.0% |
| 11 | Analysis Tools | 6 / 9 | 66.7% |
| 12 | 승인대기 대상 | 14 / 23 | 60.9% |
| 13 | 외부권한대기 대상 | 5 / 11 | 45.5% |
| 14 | QA 계획 | 18 / 39 | 46.2% |
| 15 | 최종 완료 기준 | 0 / 15 | 0.0% |

## Latest Deployment Update

- 메인 워크 플랫폼 상단 프로필은 사진 파일/URL이 없거나 로딩 실패 시 이니셜 대신 `default_avatar.svg` 기본 이미지로 표시됩니다.
- 관리 Project 현황은 이제 JSX seed가 아니라 Supabase `ll_weekly_assets` 최신 report 20행을 읽습니다.
- 별도 권한 row 추가 없이, 로그인한 회사 이메일 사용자는 preview/local 경로에서도 `weekly-assets/latest-preview`로 같은 20행을 받습니다.
- 내부 `Supabase readback` / `임시 seed` 경고 문구는 화면 번들에서 제거됐습니다.
- Evidence: `weekly-assets/latest-preview` live smoke `ok=true`, rows `20`, report `00000000-0000-0000-0000-000000260427`; live bundle `assets/index-C_752woL.js` has preview action and `has_seed_warning=false`.
