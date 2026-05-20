# Post-deploy priority plan - 2026-05-20

## Branch policy

- Source branch for all new work: preview/codex/logistics-gate6-post-deploy-updates
- Existing user-facing branch: gh-pages
- Rule: do not deploy to gh-pages until a change group is build-verified and explicitly ready for release.

## Priority 1 - Data truth and broken visible numbers

1. Supabase-first data source cleanup: remove remaining static JSON fallback for active dashboard data paths.
2. Excel/Supabase 1-by-1 readback for monthly rent/maintenance, E.NOC, cold ratio, gross area, leased area, vacancy, and asset-specific anomalies.
3. Arena Yangji, Busan Songjeong, Hwaseong Seokpori floor/expiry data verification and correction.
4. Home/Asset/Company numeric consistency for monthly rent+maintenance and area values.

## Priority 2 - High-impact visible UI corrections

1. Home/Company map hover card navigation and close behavior.
2. Home maturity concentration readability after position swap and height adjustment.
3. Asset overview/investment editable panels and save/readback flow.
4. Work Platform Management Project Status edit/fullscreen table browser QA fixes.

## Priority 3 - Core workflow completeness

1. Task and board stakeholder suggestion edge cases, new stakeholder reappearance QA, and permission-scoped visibility.
2. Data Quality submit/approve/readback/write/audit end-to-end completion.
3. Pivot Table saved view and drilldown QA.
4. Analysis Tools benchmark matrix browser behavior QA.

## Priority 4 - External provider and AI completion

1. OpenDART live provider response and redaction QA.
2. Building registry live provider response and redaction QA.
3. Naver map tile/marker visual QA.
4. AI chatbot provider fallback and concise-answer behavior after data evidence layer is reliable.

## Priority 5 - Release QA and deployment

1. Secret scan and bundle scan.
2. Permission-role QA for Reader/Editor/Admin.
3. Manual browser QA checklist for key screens.
4. Build, commit, push, then release to gh-pages only when approved for public preview update.
