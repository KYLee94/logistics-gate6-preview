# Edge/API security static QA - 2026-05-14

- pass: 12
- fail: 0
- allPass: false
- logisticsGatePass: true

| check | status | detail | evidence |
|---|---|---|---|
| frontend_no_direct_mutation | pass | 물류 모듈과 인증 진입부 브라우저 소스에서 Supabase insert/update/delete/upsert 직접 호출이 없어야 합니다. | {"clientMutations":[],"scopedFiles":["src/components/system/AuthSetup.jsx","src/components/system/workspace/WorkspaceLogistics.jsx"]} |
| iota_legacy_direct_mutation_inventory | blocked | 기존 IOTA core 모듈에는 직접 mutation이 남아 있으나, 이번 물류 gate 범위 밖의 별도 보안 부채로 분리합니다. | {"count":100,"sample":[{"file":"src/components/system/DecisionLog.jsx","tableExpression":"'iota_seoul_log_stakeholders'","method":"delete"},{"file":"src/components/system/DecisionLog.jsx","tableExpression":"'iota_seoul_logs'","method":"delete"},{"file":"src/components/system/DecisionLog.jsx","tableExpression":"'iota_seoul_logs'","method":"update"},{"file":"src/components/system/DecisionLog.jsx","tableExpression":"'iota_seoul_logs'","method":"update"},{"file":"src/components/system/DecisionLog.jsx","tableExpression":"'iota_seoul_logs'","method":"update"},{"file":"src/components/system/LogWriteBox.jsx","tableExpression":"'iota_stakeholder_master'","method":"insert"},{"file":"src/components/system/LogWriteBox.jsx","tableExpression":"'iota_seoul_logs'","method":"update"},{"file":"src/components/system/LogWriteBox.jsx","tableExpression":"'iota_seoul_log_links'","method":"delete"},{"file":"src/components/system/LogWriteBox.jsx","tableExpression":"'iota_seoul_log_stakeholders'","method":"delete"},{"file":"src/components/system/LogWriteBox.jsx","tableExpression":"'iota_seoul_logs'","method":"insert"},{"file":"src/components/system/LogWriteBox.jsx","tableExpression":"'iota_seoul_log_links'","method":"insert"},{"file":"src/components/system/LogWriteBox.jsx","tableExpression":"'iota_stakeholder_master'","method":"insert"}]} |
| frontend_no_hardcoded_iota_access_code | pass | 최초 접속 코드가 브라우저 소스에 고정 문자열로 남아 있으면 안 됩니다. | {"literalAccessCodeHits":[]} |
| frontend_no_server_secret_env_names | pass | 서버 전용 secret env 이름이 브라우저 소스에 없어야 합니다. | {"clientSecretEnvHits":[]} |
| ll_dashboard_api_jwt_and_permission | pass | ll-dashboard-api는 JWT 검증, 서버 권한 조회, ll_* allowlist를 가져야 합니다. | {} |
| ll_dashboard_api_edit_write_readback_audit | pass | Data Quality approve는 승인 후 readback, stale 차단, write, post-write readback, audit, rollback을 포함해야 합니다. | {} |
| ll_dashboard_api_external_api_controls | pass | OpenDART/건축물대장/Naver API는 server-only secret, timeout, rate limit, redacted response를 가져야 합니다. | {} |
| ll_weekly_ingest_monday_sunday_and_rollback | pass | Weekly ingest는 월요일~일요일 주차를 서버에서 재계산하고 실패 시 기존 report/assets/projects를 복원해야 합니다. | {} |
| iota_auth_sync_jwt_email_scope | pass | IOTA 회원정보 동기화 초안은 JWT와 이메일/auth_id 범위를 검증해야 합니다. | {} |
| iota_auth_sync_no_non_ll_write | pass | 물류 Gate 초안에서는 iota-auth-member-sync가 non-ll_* 테이블에 직접 write하면 안 됩니다. | {} |
| iota_auth_sync_origin_fail_closed | pass | iota-auth-member-sync는 허용되지 않은 Origin 요청을 서버에서 fail-closed로 차단해야 합니다. | {} |
| edge_permissions_no_app_metadata_fallback | pass | 권한 판단은 ll_user_permissions 기준이어야 하며 app_metadata fallback으로 임시 승격하면 안 됩니다. | {} |
| ll_migrations_only_public_ll_targets | pass | 물류 migration preview는 public.ll_* 대상만 가져야 합니다. | {"nonLlMigrationTargets":[]} |
