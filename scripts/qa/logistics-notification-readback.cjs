const fs = require('fs');
const path = require('path');
const {
  OUT_DIR,
  envValue,
  invoke,
  runLinkedDbQuery,
  signIn,
  timestampForFile,
} = require('./logistics-data-management-qa-utils.cjs');

const stamp = timestampForFile();
const outJson = path.join(OUT_DIR, `notification-readback-${stamp}.json`);
const latestJson = path.join(OUT_DIR, 'notification-readback-latest.json');

function sqlLiteral(value) {
  return `'${String(value ?? '').replace(/'/gu, "''")}'`;
}

function text(value) {
  return value === undefined || value === null ? '' : String(value).trim();
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const supabaseUrl = envValue('LOGISTICS_SUPABASE_URL', 'VITE_SUPABASE_URL');
  const anonKey = envValue('LOGISTICS_SUPABASE_ANON_KEY', 'VITE_SUPABASE_ANON_KEY');
  if (!supabaseUrl || !anonKey) throw new Error('Missing Supabase URL or anon key.');

  const auth = await signIn(supabaseUrl, anonKey);
  const recipientEmail = text(auth.user?.email || envValue('LOGISTICS_SUPABASE_EMAIL', 'LOGISTICS_SUPABASE_AUTH_EMAIL')).toLowerCase();
  assert(recipientEmail, 'Could not resolve QA notification recipient email.');

  const dedupeKey = `qa-notification-readback-${stamp}`;
  let report = null;
  let primaryError = null;
  let cleanupError = null;
  try {
    const inserted = runLinkedDbQuery(`
with notification_row as (
  insert into public.ll_notifications (
    notification_type,
    title,
    body,
    lead_days,
    payload,
    dedupe_key
  )
  values (
    'system',
    'QA notification readback',
    'QA notification readback probe',
    0,
    jsonb_build_object('qa_stamp', ${sqlLiteral(stamp)}, 'route', '/work-platform/data-management/approval'),
    ${sqlLiteral(dedupeKey)}
  )
  on conflict (dedupe_key) do update
    set title = excluded.title,
        body = excluded.body,
        payload = excluded.payload
  returning notification_id
),
delivery_row as (
  insert into public.ll_notification_deliveries (
    notification_id,
    recipient_email,
    delivery_status,
    read_at,
    dismissed_at
  )
  select notification_id, ${sqlLiteral(recipientEmail)}, 'unread', null, null
  from notification_row
  on conflict (notification_id, recipient_email) do update
    set delivery_status = 'unread',
        read_at = null,
        dismissed_at = null
  returning delivery_id, notification_id, recipient_email, delivery_status
)
select delivery_id::text, notification_id::text, recipient_email, delivery_status
from delivery_row;
`, 'notification-readback-insert');
    const delivery = inserted[0];
    assert(delivery?.delivery_id, 'Failed to create QA notification delivery.');

    const listBefore = await invoke(supabaseUrl, anonKey, auth.token, 'notifications/list', { limit: 120, include_smoke: true });
    const beforeRows = Array.isArray(listBefore.data?.notifications) ? listBefore.data.notifications : [];
    const createdBefore = beforeRows.find((row) => text(row.id) === text(delivery.delivery_id));
    assert(createdBefore, 'Created notification was not returned by notifications/list.');

    await invoke(supabaseUrl, anonKey, auth.token, 'notifications/mark-read', { ids: [delivery.delivery_id] });
    const afterReadRows = runLinkedDbQuery(`
select delivery_id::text, delivery_status, read_at is not null as has_read_at
from public.ll_notification_deliveries
where delivery_id = ${sqlLiteral(delivery.delivery_id)};
`, 'notification-readback-read');
    assert(afterReadRows[0]?.delivery_status === 'read' && afterReadRows[0]?.has_read_at === true, 'notifications/mark-read did not persist read status.');

    const listAfterRead = await invoke(supabaseUrl, anonKey, auth.token, 'notifications/list', { limit: 120, include_smoke: true });
    const readRow = (Array.isArray(listAfterRead.data?.notifications) ? listAfterRead.data.notifications : []).find((row) => text(row.id) === text(delivery.delivery_id));
    assert(readRow && text(readRow.delivery_status) === 'read', 'Read notification did not return read status on reload.');

    await invoke(supabaseUrl, anonKey, auth.token, 'notifications/dismiss', { ids: [delivery.delivery_id] });
    const afterDismissRows = runLinkedDbQuery(`
select delivery_id::text, delivery_status, dismissed_at is not null as has_dismissed_at
from public.ll_notification_deliveries
where delivery_id = ${sqlLiteral(delivery.delivery_id)};
`, 'notification-readback-dismiss');
    assert(afterDismissRows[0]?.delivery_status === 'dismissed' && afterDismissRows[0]?.has_dismissed_at === true, 'notifications/dismiss did not persist dismissed status.');

    const listAfterDismiss = await invoke(supabaseUrl, anonKey, auth.token, 'notifications/list', { limit: 120, include_smoke: true });
    const dismissedStillVisible = (Array.isArray(listAfterDismiss.data?.notifications) ? listAfterDismiss.data.notifications : []).some((row) => text(row.id) === text(delivery.delivery_id));
    assert(!dismissedStillVisible, 'Dismissed notification was still returned by notifications/list.');

    report = {
      ok: true,
      generated_at: new Date().toISOString(),
      recipient_email: recipientEmail,
      checks: {
        created_visible: true,
        read_persisted: true,
        read_visible_on_reload: true,
        dismissed_persisted: true,
        dismissed_hidden_on_reload: true,
        qa_row_cleaned: false,
      },
    };
  } catch (error) {
    primaryError = error;
  } finally {
    try {
      runLinkedDbQuery(`
delete from public.ll_notifications
where dedupe_key = ${sqlLiteral(dedupeKey)};
`, 'notification-readback-cleanup');
      const cleanupReadback = runLinkedDbQuery(`
select count(*)::integer as remaining_count
from public.ll_notifications
where dedupe_key = ${sqlLiteral(dedupeKey)};
`, 'notification-readback-cleanup-readback');
      assert(Number(cleanupReadback[0]?.remaining_count || 0) === 0, 'QA notification cleanup left a residual row.');
      if (report) report.checks.qa_row_cleaned = true;
    } catch (error) {
      cleanupError = error;
    }
  }

  if (primaryError || cleanupError) {
    throw new AggregateError(
      [primaryError, cleanupError].filter(Boolean),
      [primaryError?.message, cleanupError ? `cleanup failed: ${cleanupError.message}` : ''].filter(Boolean).join('; '),
    );
  }
  assert(report?.checks?.qa_row_cleaned === true, 'QA notification cleanup was not confirmed.');
  fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(latestJson, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({ ok: true, artifact: outJson, checks: report.checks }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
