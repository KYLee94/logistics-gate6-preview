# Work platform TASK / board CRUD smoke - 2026-05-19

- Project ref: `qvegpozwrcmspdvjokiz`
- Edge Function: `ll-dashboard-api`
- Tables:
  - `public.ll_work_platform_tasks`
  - `public.ll_work_platform_board_posts`
- Test auth user: `codex-logistics-crud-1779154256342@igisam.com`
- Permission row: `System Admin`, organization `기획추진센터`

## API Smoke Result

| Component | Operation | Result |
|---|---|---|
| TASK | create | pass |
| TASK | update | pass |
| TASK | complete | pass |
| TASK | delete | pass, soft-deleted |
| Board post | create | pass |
| Board post | update | pass |
| Board post | comment add | pass |
| Board post | comment delete | pass |
| Board post | delete | pass, soft-deleted |
| Unauthenticated request | `work-platform/tasks/list` | pass, HTTP 401 |

## Readback Evidence

| Component | Row id | Status | Asset FK |
|---|---|---|---|
| TASK | `dfaa64a8-7dab-431d-b993-2f43f0d25581` | `deleted` | `asset_a112127001` |
| Board post | `7995ea9f-9f35-4642-bf89-277318dd8813` | `deleted` | `asset_a112127001` |

## Notes

- Writes are performed through the Edge Function after JWT and `ll_user_permissions` checks.
- Browser direct insert/update/delete remains blocked by the absence of RLS write policies for authenticated users.
- The PowerShell smoke command passed Korean labels through the Windows console and readback displayed mojibake for those labels. This is a smoke-command encoding artifact, not evidence that browser UTF-8 payloads are broken.
