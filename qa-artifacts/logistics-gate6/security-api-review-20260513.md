# Security/API review - 2026-05-13

범위: 로컬 IOTA repo 소스와 Supabase read-only metadata만 확인했습니다. Edge Function 배포, secret 설정, policy 변경은 하지 않았습니다.

## 통과한 항목

| item | status | evidence |
|---|---|---|
| public bundle secret scan | pass | `secret-scan-public-bundle-20260513/result.json` |
| service role key frontend 노출 | pass | bundle scan finding 0 |
| OpenDART/건축물대장 key frontend 노출 | pass | bundle scan finding 0 |
| `ll-weekly-doc-ingest` draft JWT 검증 | pass draft | `auth.getUser(jwt)` 확인 |
| 권한 판단에 `user_metadata` 미사용 | pass draft | `app_metadata?.logistics_role` 또는 `ll_user_permissions` 사용 |
| write allowlist | pass draft | `WRITE_TABLE_ALLOWLIST` 전부 `public.ll_*` |
| CORS local/GitHub Pages allowlist | pass draft | 5173/4173/8081 + GitHub Pages |
| disallowed origin fail-closed | pass draft | `Origin not allowed` 403 |

## 유지되는 blocker

| item | blocker |
|---|---|
| `.env` git 추적 | 현재 `.env`가 git tracked 상태입니다. 값은 service role이 아니라 `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` 계열로 확인됐지만, 추적 해제는 별도 git index 조치가 필요합니다. 이번에는 `.gitignore`와 `.env.example`만 보강했습니다. |
| 실제 deployed Edge Function `logistics-admin-api` | Supabase read-only에서 `verify_jwt=false` 확인. 내부 코드가 JWT를 검증하는지 현재 확인 불가 |
| `ll-weekly-doc-ingest` | 로컬 draft만 있고 미배포 상태 |
| `ll_user_permissions`, `ll_weekly_*` | migration preview만 있고 DB 적용 안 됨 |
| `/edits/submit`, `/edits/approve`, `/worklogs` | 실제 서버 endpoint 없음 |
| OpenDART/건축물대장 | 서버 endpoint/live 401/403 QA 없음 |

## Local draft improvement applied

`supabase/functions/ll-weekly-doc-ingest/index.ts`에서 아래를 정리했습니다.

- 기본 CORS 허용 origin에 Vite local dev 주소 추가
- origin allowlist 밖 요청은 403으로 차단
- Word 파싱 키워드에 임대/관리/PFV/펀드/계획/후속/F/U 추가
- 업로드 폼의 `week_range`를 report_json에 보존
- `.gitignore`에 `.env`, `.env.*`를 추가하고 `.env.example`을 생성
- repository secret hygiene QA 추가: `repo-secret-hygiene-20260513/result.json`

판정: 로컬 draft 보안 방향은 초기 계획에 부합합니다. 다만 실제 deployed 함수와 DB 정책이 아직 없으므로 보안/API gate는 `blocked`입니다.
