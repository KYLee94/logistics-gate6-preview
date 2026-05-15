# Local visual QA auth note - 2026-05-15

## Attempted target

- URL: `http://127.0.0.1:5173/platform/iotaseoul/workspace/logistics/dashboard/home`
- Purpose: verify Home chart axis and table-width fixes with an actual browser screenshot.

## Result

- Headless Chrome with a clean browser session redirected to the auth setup screen.
- Screenshot evidence:
  - `qa-artifacts/logistics-gate6/home-dashboard-visual-20260515.png`
  - `qa-artifacts/logistics-gate6/home-dashboard-visual-20260515-vtb.png`
- Attempting to reuse the default Chrome user profile was rejected as a credential/session-risky action.

## Classification

- External permission pending: a safe authenticated local/live QA session is required.
- The code-level checks still passed:
  - `npx eslint src/components/system/workspace/WorkspaceLogistics.jsx`
  - `npm run build`
  - `node qa-artifacts/logistics-gate6/session-implementation-static-qa-20260515.cjs`

## Required user-side action

- Provide a QA login flow/session for local/live testing, or confirm a dedicated test account that can be used for screenshot QA.
