# logistics-admin-api verify_jwt risk - 2026-05-13

범위: Supabase read-only metadata에서 확인된 deployed function 상태를 보안 gate 관점으로 기록합니다.

## Finding

| item | status |
|---|---|
| deployed function | `logistics-admin-api` |
| metadata | `verify_jwt=false`로 확인됨 |
| current code visibility | deployed function 내부 코드 미확인 |
| mutation performed | none |

## Why this is a blocker

`verify_jwt=false`는 Supabase가 요청 JWT를 자동 검증하지 않는 설정입니다. 함수 내부에서 JWT를 직접 검증하고 권한 테이블을 다시 조회한다면 운영 가능할 수 있지만, 내부 코드 검증 전에는 기본 차단으로 봐야 합니다.

초기 보안 조건에 따르면 서버 전용 작업은 아래를 만족해야 합니다.

- 클라이언트가 보낸 role, user_id, scope, permission 값을 신뢰하지 않음
- Authorization JWT 검증
- Supabase Auth `app_metadata` 또는 `public.ll_*` 권한 테이블에서 서버 측 권한 재조회
- 인증 실패 401, 권한 부족 403
- write 대상은 `public.ll_*` allowlist
- raw SQL 입력 API 금지

## Current mitigation in local draft

`C:\tmp\IGIS-Fund-Production-DP\supabase\functions\ll-weekly-doc-ingest\index.ts`는 로컬 draft 기준으로 아래를 반영했습니다.

- `auth.getUser(jwt)` 기반 JWT 검증
- `app_metadata?.logistics_role` 또는 `public.ll_user_permissions` 기반 권한 조회
- `public.ll_*` write allowlist
- CORS allowlist outside origin 403
- client role/user_id 미신뢰

## Required before live use

1. deployed `logistics-admin-api` 내부 코드 확보 또는 폐기 여부 결정
2. `verify_jwt=false` 유지 시 함수 내부 JWT 검증 증거 확보
3. 미검증이면 `verify_jwt=true` 전환 또는 새 fail-closed Edge Function으로 대체
4. 권한 없는 호출 401/403 QA 로그 확보
5. public bundle 및 console/localStorage secret scan 재실행

판정: `blocked`

