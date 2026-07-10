const { runSupabaseDbQuery } = require('../lib/logistics-db-cleanup-core.cjs');

const rows = runSupabaseDbQuery(`
select jsonb_build_object(
  'news_columns', (
    select count(*)
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'll_news_items'
      and column_name in ('news_date', 'ingested_at')
  ),
  'news_missing_collection_fields', (
    select count(*)
    from public.ll_news_items
    where news_date is null or ingested_at is null
  ),
  'notification_columns', (
    select count(*)
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'll_notifications'
      and column_name in ('recipient_email', 'delivery_status', 'read_at', 'dismissed_at', 'notified_at')
  ),
  'notification_inbox_rows_missing_state', (
    select count(*)
    from public.ll_notifications
    where recipient_email is not null
      and (delivery_status is null or notified_at is null)
  )
) as result;
`, { prefix: 'gate6-phase1-readback', timeoutMs: 120000 });

const result = rows[0]?.result || {};
const checks = {
  news_columns_ready: Number(result.news_columns || 0) === 2,
  news_rows_backfilled: Number(result.news_missing_collection_fields || 0) === 0,
  notification_columns_ready: Number(result.notification_columns || 0) === 5,
  notification_rows_backfilled: Number(result.notification_inbox_rows_missing_state || 0) === 0,
};

console.log(JSON.stringify({ ok: Object.values(checks).every(Boolean), checks, result }, null, 2));
if (!Object.values(checks).every(Boolean)) process.exitCode = 1;
