# Data Quality editing permission preview - 2026-05-14

## Goal

Data Quality must work like a controlled Excel-style editor:

- users can view data in a grid,
- editable cells depend on permission,
- submitted changes are saved as requests,
- Manager/Admin approval applies changes,
- every change has before/after/readback evidence.

## Permission source

Source workbook:

`260513_담당자별 권한 부여_수식 제거.xlsx`

Detected columns:

| source column | meaning |
|---|---|
| `이름` | user display name |
| `이메일` | login identity |
| `소속` | organization/team |
| `담당 자산 읽기 권한` | read own/managed assets |
| `담당 자산 추가 권한` | create on managed assets |
| `담당 자산 수정 권한` | update on managed assets |
| `담당 자산 삭제 권한` | delete on managed assets |
| `기타 자산 읽기 권한` | read other assets |
| `기타 자산 추가 권한` | create on other assets |
| `기타 자산 수정 권한` | update on other assets |
| `기타 자산 삭제 권한` | delete on other assets |
| `담당 자산코드` | asset scope |

## Required tables, preview only

No migration is applied yet.

| table | purpose |
|---|---|
| `public.ll_user_permissions` | user role, org, default rights |
| `public.ll_permission_scopes` | user-to-asset/fund scope and CRUD rights |
| `public.ll_edit_requests` | requested cell/field edits |
| `public.ll_edit_request_events` | submit/approve/reject/apply audit trail |

## Required server endpoints

All endpoints must run in Edge Function/server layer. Browser direct mutation is prohibited.

| endpoint | minimum role | behavior |
|---|---|---|
| `edits/submit` | Editor with matching scope | creates pending edit request |
| `edits/approve` | Manager/Admin with matching scope | approves and applies change |
| `edits/reject` | Manager/Admin with matching scope | rejects request with reason |
| `edits/readback` | Reader with matching scope | returns original/current/requested values |
| `edits/history` | Reader with matching scope | returns audit trail |

## Required server-side checks

The server must check all of these again even if UI already hides buttons:

1. JWT is valid.
2. User exists in `ll_user_permissions` or permission scope table.
3. Target table starts with `public.ll_`.
4. Target field is allowlisted for editing.
5. Target row belongs to user asset/fund scope.
6. Requested action is allowed: read/create/update/delete.
7. Current DB value still equals `expected_before_value`.
8. Approver is not the same user as requester.
9. Approval applies only the reviewed field.
10. Readback confirms final value and audit event.

## Field editing policy

| field class | direct edit? | approval? | note |
|---|---|---|---|
| source preservation fields | no | n/a | original cell evidence is immutable |
| normalized business fields | yes | required | asset/fund scope required |
| derived/cache fields | no | n/a | regenerate from source, do not hand edit |
| review/status/note fields | yes | may require Manager | useful for QA workflow |
| API enrichment fields | yes, Admin only | required | OpenDART/building-register/Naver map evidence needed |

## QA acceptance

| scenario | expected |
|---|---|
| unauth edit submit | 401 |
| Reader submit update | 403 |
| Editor update own asset | pending edit created |
| Editor update other asset without permission | 403 |
| Manager approve own request | 403 |
| Manager approve allowed asset request | value applied and readback matches |
| stale before value | approval blocked |
| direct browser Supabase update | not present in frontend source |
| non-ll target table | 403 |
| source preservation field edit | 403 |

