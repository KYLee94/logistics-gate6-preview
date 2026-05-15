# Blocker-only closure matrix - 2026-05-14

## Scope

- Purpose: Do not restart Gate 0~5. This file only narrows the remaining blockers.
- Product source changes: `0`
- DB mutation: `0`
- migration apply: `0`
- Edge Function deploy: `0`
- commit/push: `0`
- Final implementation repo: `C:\tmp\IGIS-Fund-Production-DP`
- Legacy logistics repo/docs: comparison and audit only.

## Blocker 1. live Google Sheets 17-tab cell-level preservation

### Current finding

This is not a "data is absent everywhere" blocker.

- `ll_sheet_rows` already has `live_google_sheets` rows for 5 sheets, 347 rows total.
- `ll_source_cells` has only xlsx cell-level rows: 5 sheets, 13,752 cells.
- `ll_source_cells` currently has no `live_google_sheets` 17-tab cell-level rows.

### Read-only evidence

Supabase readback:

| table | source | scope | stored |
|---|---|---|---:|
| `public.ll_source_cells` | xlsx | 5 sheets | 13,752 cells |
| `public.ll_sheet_rows` | live_google_sheets | 5 sheets | 347 rows |
| `public.ll_source_cells` | live_google_sheets | 17 sheets | 0 cells |

Local 17-tab manifest evidence:

| source | sheet_count | used-range cells | non-empty cells | formula cells |
|---|---:|---:|---:|---:|
| `IGIS_Logistics_Leasing_Data` local parsed export | 17 | 181,470 | 21,276 | 9,994 |

Known tabs:

`meta_DB_일반`, `AuditLog`, `DB_일반`, `DB_히스토리 누적`, `DB_기업`, `DB_자산`, `DB_계산`, `펀드-자산-담당자 연결`, `이슈 리스트`, `SYS_설정`, `SYS_코드`, `SYS_기업명정규화`, `SYS_자산조회키`, `LOG_검증`, `LOG_API`, `LOG_계산`, `AUDIT_데이터이상`

### Decision

- Status: `deferred final data audit gate`
- Why not closed: `ll_source_cells` does not yet contain live Sheets 17-tab cell-level rows.
- What not to do now: do not re-import, append, delete, truncate, or rebuild data before Gate 6 approval.
- Gate 6 close condition: one controlled `import_run_id` for all 17 tabs, then readback expected/stored cell count, non-empty count, formula count, error count, sheet hash, and workbook hash.
- Current operational decision: because the user explicitly rejected unnecessary re-insertion when Supabase already has working values, this item no longer blocks UI/API blocker resolution. It remains a final data audit gate before claiming complete data integrity.

## Blocker 2. monthly cost reconciliation

### Current finding

The screen-level display basis has been separated. The remaining mismatch is now narrowed to 3 assets, not the whole dataset.

| basis | value | meaning |
|---|---:|---|
| Snapshot/Home/asset options total | 11,134,228,842 | current dashboard snapshot basis |
| `ll_rent_history.is_latest=true` total | 10,070,115,024 | normalized latest rent history basis |
| Difference | 1,064,113,818 | needs reason classification |

Supabase readback detail:

| source | count/detail | value |
|---|---:|---:|
| `docs_bootstrap_shell.assetOptions` | 17 assets | 11,134,228,842 |
| asset snapshot KPI monthly total | 153 KPI rows checked | 11,134,228,842 |
| asset snapshot KPI missing monthly total | 2 | n/a |
| `ll_rent_history` latest linked rows | 44 rows | 10,070,115,024 |

Existing Data Quality findings:

| finding_type | severity | status | rows |
|---|---|---|---:|
| `home_snapshot_value_diff` | warning | review_required | 3 |
| `source_sheet_coverage` | warning | open | 6 |
| `null_readback` | medium | open | 15 |
| `remaining_null_after_excel_backfill` | high/medium/low | open | 20 |

Additional read-only decomposition:

| asset | snapshot | normalized latest | diff | reason |
|---|---:|---:|---:|---|
| 여주 본두리 물류센터 | 1,028,369,423 | 656,143,323 | 372,226,100 | `aggregation_scope_mismatch` |
| 아레나스양지물류센터 | 552,212,356 | 189,633,928 | 362,578,428 | `aggregation_scope_mismatch` |
| 스카이박스1, 스카이박스2 | 669,324,200 | 340,014,910 | 329,309,290 | `aggregation_scope_mismatch` |

Matched asset total:

| matched_assets | snapshot_total | normalized_latest_total | diff |
|---:|---:|---:|---:|
| 12 | 8,884,322,863 | 8,884,322,863 | 0 |

### Decision

- Status: `partially resolved`
- Why not fully closed: The mismatch has been narrowed and classified, but the finding rows were not written to Supabase because Gate 6 DB mutation is still blocked by policy.
- Required reason categories: `period_mismatch`, `latest_flag_conflict`, `snapshot_stale`, `aggregation_scope_mismatch`, `rounding_or_unit_mismatch`, `duplicate_source_row`, `date_parse_failed`, `display_raw_mismatch`, `formula_dependency_missing`, `status_filter_mismatch`, plus existing null reasons.
- What not to do now: do not overwrite normalized tables and do not force the UI to match `ll_rent_history` until source-level reason classification is proven.
- Gate 6 close condition: execute `qa-artifacts/logistics-gate6/monthly-cost-reconciliation-write-preview-20260514.sql` after explicit DB mutation approval, then readback `public.ll_data_quality_findings` and expose `expected / actual / diff / reason / source_cell_id / source_row_id` in Data Quality.

## Blocker 3. Weekly/Data Quality/API operation

### Current finding

The required pieces exist only as drafts/previews. They are not live operational features yet.

Draft files:

| item | file | status |
|---|---|---|
| Weekly ingest schema | `supabase/migrations/20260513000100_create_ll_weekly_ingest.sql` | preview only |
| Dashboard API schema | `supabase/migrations/20260514000100_create_ll_dashboard_api_tables.sql` | preview only |
| Dashboard API Edge Function | `supabase/functions/ll-dashboard-api/index.ts` | draft |
| Weekly Word ingest Edge Function | `supabase/functions/ll-weekly-doc-ingest/index.ts` | draft |
| IOTA auth member sync Edge Function | `supabase/functions/iota-auth-member-sync/index.ts` | draft, not acceptable as-is |

Security/API static finding:

| check | status |
|---|---|
| logistics frontend direct insert/update/delete/upsert removed | pass |
| hardcoded IOTA access code removed from browser source | pass |
| server secret env names absent from browser source | pass |
| `ll-dashboard-api` has JWT/permission/ll allowlist draft | pass |
| `ll_weekly_*` and `ll_edit_requests` migration targets are public `ll_*` | pass |
| existing IOTA core direct mutation inventory | blocked, out-of-scope debt |
| `iota-auth-member-sync` writes `iota_seoul_pilot_members` | blocked under v2 plan |

### Decision

- Status: `blocked`
- Why not closed: no migration has been applied, no Edge Function has been deployed, no secret/CORS/live 401/403 smoke test exists.
- Additional blocker found: `iota-auth-member-sync` still writes a non-`ll_*` table. Under the v2 plan, this must be redesigned or removed from the logistics path before Gate 6 deploy.
- What not to do now: do not deploy these Edge Functions and do not apply migrations before explicit Gate 6 approval.
- Gate 6 close condition:
  1. Fix `iota-auth-member-sync` so logistics paths do not write non-`ll_*`, or remove it from logistics Gate 6.
  2. Apply only public `ll_*` migrations in controlled order.
  3. Deploy `ll-dashboard-api` and `ll-weekly-doc-ingest`.
  4. Set secrets only in Edge Function secret storage.
  5. Run unauth 401, insufficient role 403, CORS allowlist/denylist, Reader/Editor/Manager/Admin/System Admin checks.
  6. Confirm public bundle, logs, API responses, and audit rows expose no secrets.

## Final blocker status

| blocker | can close now without user approval? | current status | exact reason |
|---|---|---|---|
| live Sheets 17-tab cell-level preservation | no | deferred final data audit gate | Supabase readback lacks live 17-tab `ll_source_cells` rows, but user directed not to reinsert existing Supabase values unnecessarily |
| monthly cost reconciliation | no | partially resolved | reason narrowed to 3 assets with `aggregation_scope_mismatch`; Supabase write is pending Gate 6 DB mutation approval |
| Weekly/Data Quality/API operation | no | partially resolved | source blocker fixed; migration/deploy/secret/live auth QA not executed |

## Reviewer verdicts

| reviewer | verdict | summary |
|---|---|---|
| Supabase/Data reviewer | blocked | `ll_sheet_rows` 5-tab row preservation cannot replace live Sheets 17-tab cell-level preservation. Monthly cost difference still needs row-level reason classification. |
| QA reviewer | blocked | Existing screen QA passes stay valid, but 17-tab cell preservation, monthly cost reason classification, and deploy/secret/live storage checks remain blocked. |
| Security/API reviewer | re-run after fix: logistics pass | `iota-auth-member-sync` non-`ll_*` write removed, CORS fail-closed added, app_metadata fallback removed, QA allPass contradiction fixed. Existing IOTA core direct mutation remains out-of-scope debt. |

## Next Gate 6 work only after explicit approval

1. Create controlled live Sheets 17-tab cell import run and readback report.
2. Add reconciliation findings with reason categories and source cell/row links.
3. Remove or redesign `iota-auth-member-sync` from the logistics path.
4. Apply `ll_*` migrations.
5. Deploy Edge Functions with secrets.
6. Run local/live parity and security QA.
