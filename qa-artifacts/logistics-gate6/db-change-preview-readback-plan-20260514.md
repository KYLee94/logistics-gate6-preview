# DB change preview and readback plan - 2026-05-14

## Current decision

No immediate DB schema cleanup is approved.

Reason:

- No `ll_*` table is confirmed safe to delete.
- No column is confirmed safe to drop before full field map and UI/API usage scan.
- Original Excel and live Sheets preservation are still required for audit.

## Existing write preview

| preview | target | status |
|---|---|---|
| `monthly-cost-reconciliation-write-preview-20260514.sql` | `public.ll_data_quality_findings` | ready for review, not executed |

## Required preview before any DB mutation

Every DB change must include:

1. target table and column list,
2. source Excel field or business reason,
3. UI/API usage scan result,
4. before row count,
5. after expected row count,
6. rollback SQL or rollback plan,
7. readback SQL,
8. owner/reviewer decision.

## Readback requirements

| change type | readback required |
|---|---|
| value correction | before value, after value, source Excel value, diff reason |
| new audit finding | finding row exists, payload has expected/actual/diff/reason |
| column cleanup | column absent, dependent UI/API tests pass |
| table cleanup | table absent or archived, source preservation still intact |
| permission import | user/email/org/asset/fund scope and CRUD flags match workbook |
| weekly ingest | selected week row exists and dashboard reads same week |

## First permitted DB work after review

The first low-risk DB write candidate is not schema deletion. It is:

1. Insert/update Data Quality findings for the 3 monthly cost mismatch assets.
2. Read back the 3 rows.
3. Confirm UI Data Quality can display them.

Deletion/cleanup comes later, after the field register is complete.

