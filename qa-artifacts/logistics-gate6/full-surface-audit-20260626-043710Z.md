# Gate 6 Full Surface Audit Manifest

Generated at: 2026-06-26T04:37:10.105Z

## Verdict

Complete for the required live URL evidence currently mapped in this audit. Older stale artifacts and QA script risk patterns are listed separately so they do not hide current live results.

## Known Blockers

| Severity | ID | Evidence | Problem |
| --- | --- | --- | --- |


## Surface Manifest

| ID | Axis | Screen | Route | Acceptance | Required evidence | Status |
| --- | --- | --- | --- | --- | --- | --- |
| global-auth-loading | global-stability | Global shell | all protected routes | no forced redirect after valid login<br>no blank data after idle<br>401/403 cannot be treated as success | OK full-app-loading-stability-latest.json<br>OK data-loading-idle-latest.json<br>OK auth-permission-matrix-latest.json | complete |
| system-modals | global-stability | System modals | left navigation footer | feature access persists<br>login history reloads<br>notification dismiss readback matches server | OK full-app-loading-stability-latest.json<br>OK access-modal-refresh-stability-latest.json<br>OK login-history-browser-smoke-latest.json<br>OK logout-browser-smoke-latest.json | complete |
| work-platform | screen-coverage | Work Platform | /work-platform | manager sees all assets/funds<br>external PM only sees assigned assets<br>navigation does not reset auth | OK full-app-loading-stability-latest.json<br>OK work-platform-browser-smoke-latest.json | complete |
| dashboard-home-asset-company | screen-coverage | Dashboard core tabs | /home, /asset, /company | all visible tables sort<br>maps show real tiles/markers<br>refresh buttons report provider/store/fallback separately | OK full-app-loading-stability-latest.json<br>OK sector-tabs-browser-smoke-latest.json<br>OK out-of-scope-regression-inventory-latest.json | complete |
| dashboard-special-tabs | screen-coverage | Dashboard special tabs | /investment-index, /asset-spec, /analysis-tools, /pivot-table, /data-quality, /pdf-report | no raw/internal IDs<br>chart popups expose full detail<br>every button changes UI or server state as expected | OK full-app-loading-stability-latest.json<br>OK sector-tabs-browser-smoke-latest.json<br>OK investment-index-browser-smoke-latest.json<br>OK asset-spec-browser-smoke-latest.json | complete |
| market-data | screen-coverage | Market Data tabs | /market-data/overview, /lease-market, /supply-pipeline, /transactions, /source-update | no blank chart/table<br>map labels stay inside panel<br>all chart clicks open detailed rows<br>UI row count matches API | OK full-app-loading-stability-latest.json<br>OK market-data-browser-smoke-latest.json<br>OK market-data-view-payload-audit-latest.json<br>OK live-market-map-naver-region-flow-latest.json<br>OK market-data-readback-smoke-latest.json<br>OK market-data-parity-audit-latest.json<br>OK market-map-address-precision-audit-latest.json | complete |
| data-management | screen-coverage | Data Management | /data-management | no ll_/payload/source_row_id/internal ID visible<br>submit/write/readback is proven<br>ended contracts and past history are locked | OK full-app-loading-stability-latest.json<br>OK data-management-browser-readback-smoke-latest.json<br>OK data-management-live-browser-flow-latest.json<br>OK data-management-release-gate-latest.json<br>OK data-management-coverage-audit-latest.json | complete |
| data-parity | data-consistency | All data-backed UI | all | no skipped readback accepted<br>fallback/cache states logged separately<br>screen count equals API count where applicable | OK market-data-view-payload-audit-latest.json<br>OK market-data-readback-smoke-latest.json<br>OK market-data-parity-audit-latest.json<br>OK data-management-release-gate-latest.json<br>OK data-management-browser-readback-smoke-latest.json | complete |
| dashboard-home | detailed-screen-coverage | Dashboard Home | /home | renders without blank/stuck state<br>all buttons and controls have observable effect<br>tables/charts/modals/maps meet component standards when present | OK full-app-loading-stability-latest.json<br>OK sector-tabs-browser-smoke-latest.json | complete |
| dashboard-asset | detailed-screen-coverage | Dashboard Asset | /asset | renders without blank/stuck state<br>all buttons and controls have observable effect<br>tables/charts/modals/maps meet component standards when present | OK full-app-loading-stability-latest.json<br>OK sector-tabs-browser-smoke-latest.json | complete |
| dashboard-company | detailed-screen-coverage | Dashboard Company | /company | renders without blank/stuck state<br>all buttons and controls have observable effect<br>tables/charts/modals/maps meet component standards when present | OK full-app-loading-stability-latest.json<br>OK sector-tabs-browser-smoke-latest.json | complete |
| investment-index | detailed-screen-coverage | Investment Index | /investment-index | renders without blank/stuck state<br>all buttons and controls have observable effect<br>tables/charts/modals/maps meet component standards when present | OK full-app-loading-stability-latest.json<br>OK investment-index-browser-smoke-latest.json | complete |
| asset-spec | detailed-screen-coverage | Asset Spec | /asset-spec | renders without blank/stuck state<br>all buttons and controls have observable effect<br>tables/charts/modals/maps meet component standards when present | OK full-app-loading-stability-latest.json<br>OK asset-spec-browser-smoke-latest.json<br>OK asset-spec-readback-smoke-latest.json | complete |
| analysis-tools | detailed-screen-coverage | Analysis Tools | /analysis-tools | renders without blank/stuck state<br>all buttons and controls have observable effect<br>tables/charts/modals/maps meet component standards when present | OK full-app-loading-stability-latest.json<br>OK sector-tabs-browser-smoke-latest.json | complete |
| pivot-table | detailed-screen-coverage | Pivot Table | /pivot-table | renders without blank/stuck state<br>all buttons and controls have observable effect<br>tables/charts/modals/maps meet component standards when present | OK full-app-loading-stability-latest.json<br>OK sector-tabs-browser-smoke-latest.json | complete |
| data-quality | detailed-screen-coverage | Data Quality | /data-quality | renders without blank/stuck state<br>all buttons and controls have observable effect<br>tables/charts/modals/maps meet component standards when present | OK full-app-loading-stability-latest.json<br>OK sector-tabs-browser-smoke-latest.json | complete |
| pdf-report | detailed-screen-coverage | PDF Report | /pdf-report | renders without blank/stuck state<br>all buttons and controls have observable effect<br>tables/charts/modals/maps meet component standards when present | OK full-app-loading-stability-latest.json | complete |
| contract-data | detailed-screen-coverage | Contract Data | /contract-data | renders without blank/stuck state<br>all buttons and controls have observable effect<br>tables/charts/modals/maps meet component standards when present | OK full-app-loading-stability-latest.json | complete |
| ai-chatbot | detailed-screen-coverage | AI Chatbot | global dock/work platform | renders without blank/stuck state<br>all buttons and controls have observable effect<br>tables/charts/modals/maps meet component standards when present | OK ai-chatbot-browser-smoke-latest.json<br>OK ai-chatbot-qa-latest.json | complete |
| market-overview | detailed-screen-coverage | Market Data Overview | /market-data/overview | renders without blank/stuck state<br>all buttons and controls have observable effect<br>tables/charts/modals/maps meet component standards when present | OK full-app-loading-stability-latest.json<br>OK market-data-browser-smoke-latest.json<br>OK market-data-view-payload-audit-latest.json | complete |
| market-lease | detailed-screen-coverage | Lease Market | /market-data/lease-market | renders without blank/stuck state<br>all buttons and controls have observable effect<br>tables/charts/modals/maps meet component standards when present | OK full-app-loading-stability-latest.json<br>OK market-data-browser-smoke-latest.json<br>OK live-market-map-naver-region-flow-latest.json | complete |
| market-supply | detailed-screen-coverage | Supply Pipeline | /market-data/supply-pipeline | renders without blank/stuck state<br>all buttons and controls have observable effect<br>tables/charts/modals/maps meet component standards when present | OK full-app-loading-stability-latest.json<br>OK market-data-browser-smoke-latest.json<br>OK live-market-map-naver-region-flow-latest.json<br>OK supply-period-slicer-flow-latest.json | complete |
| market-transactions | detailed-screen-coverage | Transactions | /market-data/transactions | renders without blank/stuck state<br>all buttons and controls have observable effect<br>tables/charts/modals/maps meet component standards when present | OK full-app-loading-stability-latest.json<br>OK market-data-browser-smoke-latest.json<br>OK live-market-map-naver-region-flow-latest.json | complete |
| market-source-update | detailed-screen-coverage | Source Update | /market-data/source-update | renders without blank/stuck state<br>all buttons and controls have observable effect<br>tables/charts/modals/maps meet component standards when present | OK full-app-loading-stability-latest.json<br>OK market-data-browser-smoke-latest.json<br>OK market-data-readback-smoke-latest.json | complete |
| data-management-igis | detailed-screen-coverage | Data Management - IGIS Data | /data-management | renders without blank/stuck state<br>all buttons and controls have observable effect<br>tables/charts/modals/maps meet component standards when present | OK full-app-loading-stability-latest.json<br>OK data-management-browser-readback-smoke-latest.json<br>OK data-management-live-browser-flow-latest.json | complete |
| data-management-market | detailed-screen-coverage | Data Management - Market Data | /data-management | renders without blank/stuck state<br>all buttons and controls have observable effect<br>tables/charts/modals/maps meet component standards when present | OK full-app-loading-stability-latest.json<br>OK data-management-browser-readback-smoke-latest.json | complete |
| data-management-system | detailed-screen-coverage | Data Management - System Data | /data-management | renders without blank/stuck state<br>all buttons and controls have observable effect<br>tables/charts/modals/maps meet component standards when present | OK full-app-loading-stability-latest.json<br>OK data-management-browser-readback-smoke-latest.json | complete |

## Suspicious Latest Artifacts

| Severity | Artifact | Findings |
| --- | --- | --- |
| major | access-ui-browser-smoke-latest.json | warnings=3 |
| major | ai-chatbot-model-sample-latest.json | status=model_unavailable |
| major | out-of-scope-regression-inventory-latest.json | warnings=2 |
| major | supply-period-slicer-flow-latest.json | warnings=1 |

## QA Script Risk Patterns

| Severity | Risk | Location | Problem |
| --- | --- | --- | --- |
| major | fixed-wait | scripts/qa/logistics-access-modal-refresh-stability.cjs:115 | fixed wait can hide async races |
| major | fixed-wait | scripts/qa/logistics-access-modal-refresh-stability.cjs:118 | fixed wait can hide async races |
| minor | service-worker-blocked | scripts/qa/logistics-access-modal-refresh-stability.cjs:146 | blocking service workers may miss production cache behavior |
| major | fixed-wait | scripts/qa/logistics-access-ui-browser-smoke.cjs:219 | fixed wait can hide async races |
| major | network-intercept | scripts/qa/logistics-access-ui-browser-smoke.cjs:154 | network intercept cannot prove live backend behavior |
| major | network-intercept | scripts/qa/logistics-access-ui-browser-smoke.cjs:158 | network intercept cannot prove live backend behavior |
| minor | service-worker-blocked | scripts/qa/logistics-access-ui-browser-smoke.cjs:145 | blocking service workers may miss production cache behavior |
| minor | service-worker-blocked | scripts/qa/logistics-ai-chatbot-browser-smoke.cjs:151 | blocking service workers may miss production cache behavior |
| minor | service-worker-blocked | scripts/qa/logistics-asset-spec-browser-smoke.cjs:117 | blocking service workers may miss production cache behavior |
| major | fixed-wait | scripts/qa/logistics-auth-password-flow-smoke.cjs:175 | fixed wait can hide async races |
| minor | service-worker-blocked | scripts/qa/logistics-auth-password-flow-smoke.cjs:243 | blocking service workers may miss production cache behavior |
| major | fixed-wait | scripts/qa/logistics-browser-visible-parity.cjs:216 | fixed wait can hide async races |
| major | fixed-wait | scripts/qa/logistics-browser-visible-parity.cjs:225 | fixed wait can hide async races |
| major | network-intercept | scripts/qa/logistics-browser-visible-parity.cjs:280 | network intercept cannot prove live backend behavior |
| major | network-intercept | scripts/qa/logistics-browser-visible-parity.cjs:288 | network intercept cannot prove live backend behavior |
| minor | service-worker-blocked | scripts/qa/logistics-browser-visible-parity.cjs:278 | blocking service workers may miss production cache behavior |
| minor | service-worker-blocked | scripts/qa/logistics-dart-chart-browser-smoke.cjs:131 | blocking service workers may miss production cache behavior |
| major | fixed-wait | scripts/qa/logistics-data-loading-idle.cjs:308 | fixed wait can hide async races |
| major | fake-session | scripts/qa/logistics-data-loading-map-qa-common.cjs:120 | fake session cannot prove live auth behavior |
| major | fake-session | scripts/qa/logistics-data-loading-map-qa-common.cjs:443 | fake session cannot prove live auth behavior |
| major | network-intercept | scripts/qa/logistics-data-loading-map-qa-common.cjs:485 | network intercept cannot prove live backend behavior |
| major | network-intercept | scripts/qa/logistics-data-loading-map-qa-common.cjs:491 | network intercept cannot prove live backend behavior |
| major | network-intercept | scripts/qa/logistics-data-loading-map-qa-common.cjs:496 | network intercept cannot prove live backend behavior |
| major | network-intercept | scripts/qa/logistics-data-loading-map-qa-common.cjs:501 | network intercept cannot prove live backend behavior |
| major | network-intercept | scripts/qa/logistics-data-loading-map-qa-common.cjs:503 | network intercept cannot prove live backend behavior |
| major | network-intercept | scripts/qa/logistics-data-loading-map-qa-common.cjs:511 | network intercept cannot prove live backend behavior |
| major | network-intercept | scripts/qa/logistics-data-loading-map-qa-common.cjs:516 | network intercept cannot prove live backend behavior |
| major | network-intercept | scripts/qa/logistics-data-loading-map-qa-common.cjs:520 | network intercept cannot prove live backend behavior |
| major | network-intercept | scripts/qa/logistics-data-loading-map-qa-common.cjs:523 | network intercept cannot prove live backend behavior |
| major | network-intercept | scripts/qa/logistics-data-loading-map-qa-common.cjs:528 | network intercept cannot prove live backend behavior |
| major | network-intercept | scripts/qa/logistics-data-loading-map-qa-common.cjs:548 | network intercept cannot prove live backend behavior |
| major | network-intercept | scripts/qa/logistics-data-loading-map-qa-common.cjs:555 | network intercept cannot prove live backend behavior |
| major | network-intercept | scripts/qa/logistics-data-loading-map-qa-common.cjs:558 | network intercept cannot prove live backend behavior |
| major | network-intercept | scripts/qa/logistics-data-loading-map-qa-common.cjs:561 | network intercept cannot prove live backend behavior |
| minor | service-worker-blocked | scripts/qa/logistics-data-loading-map-qa-common.cjs:578 | blocking service workers may miss production cache behavior |
| major | unconditional-ok | scripts/qa/logistics-data-loading-map-qa-common.cjs:523 | empty ok response can mask unsupported actions |
| major | unconditional-ok | scripts/qa/logistics-data-loading-map-qa-common.cjs:561 | empty ok response can mask unsupported actions |
| major | fixed-wait | scripts/qa/logistics-data-management-browser-readback-smoke.cjs:314 | fixed wait can hide async races |
| minor | service-worker-blocked | scripts/qa/logistics-data-management-browser-readback-smoke.cjs:227 | blocking service workers may miss production cache behavior |
| minor | service-worker-blocked | scripts/qa/logistics-data-management-live-browser-flow.cjs:102 | blocking service workers may miss production cache behavior |
| minor | service-worker-blocked | scripts/qa/logistics-data-update-browser-smoke.cjs:216 | blocking service workers may miss production cache behavior |
| minor | service-worker-blocked | scripts/qa/logistics-external-refresh-buttons-browser-smoke.cjs:103 | blocking service workers may miss production cache behavior |
| minor | service-worker-blocked | scripts/qa/logistics-investment-index-browser-smoke.cjs:117 | blocking service workers may miss production cache behavior |
| major | fixed-wait | scripts/qa/logistics-legacy-intro-block-smoke.cjs:236 | fixed wait can hide async races |
| major | network-intercept | scripts/qa/logistics-legacy-intro-block-smoke.cjs:143 | network intercept cannot prove live backend behavior |
| major | network-intercept | scripts/qa/logistics-legacy-intro-block-smoke.cjs:151 | network intercept cannot prove live backend behavior |
| major | network-intercept | scripts/qa/logistics-legacy-intro-block-smoke.cjs:157 | network intercept cannot prove live backend behavior |
| major | network-intercept | scripts/qa/logistics-legacy-intro-block-smoke.cjs:160 | network intercept cannot prove live backend behavior |
| minor | service-worker-blocked | scripts/qa/logistics-legacy-intro-block-smoke.cjs:142 | blocking service workers may miss production cache behavior |
| minor | service-worker-blocked | scripts/qa/logistics-login-history-browser-smoke.cjs:127 | blocking service workers may miss production cache behavior |
| minor | service-worker-blocked | scripts/qa/logistics-logout-browser-smoke.cjs:128 | blocking service workers may miss production cache behavior |
| major | fixed-wait | scripts/qa/logistics-map-callout-browser-smoke.cjs:218 | fixed wait can hide async races |
| major | fixed-wait | scripts/qa/logistics-map-callout-browser-smoke.cjs:237 | fixed wait can hide async races |
| major | network-intercept | scripts/qa/logistics-map-callout-browser-smoke.cjs:119 | network intercept cannot prove live backend behavior |
| major | network-intercept | scripts/qa/logistics-map-callout-browser-smoke.cjs:127 | network intercept cannot prove live backend behavior |
| major | network-intercept | scripts/qa/logistics-map-callout-browser-smoke.cjs:133 | network intercept cannot prove live backend behavior |
| major | network-intercept | scripts/qa/logistics-map-callout-browser-smoke.cjs:136 | network intercept cannot prove live backend behavior |
| major | network-intercept | scripts/qa/logistics-map-callout-browser-smoke.cjs:155 | network intercept cannot prove live backend behavior |
| major | network-intercept | scripts/qa/logistics-map-callout-browser-smoke.cjs:162 | network intercept cannot prove live backend behavior |
| minor | service-worker-blocked | scripts/qa/logistics-map-callout-browser-smoke.cjs:117 | blocking service workers may miss production cache behavior |

## UI Inventory Summary

- Files with interactions: 44
- Buttons: 538
- onClick handlers: 671
- Modal references: 7
- Table references: 93
- Chart references: 12
- data-testid count: 41

## Required Next Evidence

- Keep running live URL 50-cycle and idle-return checks after every deploy.
- Add narrower button-by-button evidence when a surface receives new behavior changes.
- Keep Supabase/API/UI parity artifacts attached to each data-backed change.
