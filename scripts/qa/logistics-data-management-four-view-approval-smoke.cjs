const fs = require('fs');
const path = require('path');
const {
  OUT_DIR,
  ROOT,
  envValue,
  invoke,
  runLinkedDbQuery,
  safeArray,
  signIn,
  text,
  timestampForFile,
} = require('./logistics-data-management-qa-utils.cjs');

const VIEW_PROBES = [
  { view_key: 'asset_integrated', field_key: 'sector', label: 'asset' },
  { view_key: 'investment_integrated', field_key: 'investment_strategy', label: 'investment' },
  { view_key: 'lease_general_excel', field_key: 'goods_type', label: 'lease' },
  { view_key: 'lease_asset_manager_links', field_key: 'manager_name', label: 'manager' },
];
const STALE_CODES = new Set(['stale_current_value', 'stale_revision_hash']);
const MAX_STALE_REFRESHES = 1;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function hasOwn(object, key) {
  return Boolean(object && typeof object === 'object' && Object.prototype.hasOwnProperty.call(object, key));
}

function validationCodes(data) {
  return safeArray(data?.validations).map((item) => text(item?.code)).filter(Boolean);
}

function valuesEqual(left, right) {
  return text(left) === text(right);
}

function sqlLiteral(value) {
  return `'${String(value ?? '').replace(/'/gu, "''")}'`;
}

function nextRequestedValue(beforeValue, field, stamp) {
  const before = text(beforeValue);
  const type = text(field?.type);
  if (type === 'date') {
    const date = new Date(before || '2030-01-01');
    if (!Number.isNaN(date.getTime())) {
      date.setUTCDate(date.getUTCDate() + 1);
      return date.toISOString().slice(0, 10);
    }
    return '2030-01-01';
  }
  if (['area_sqm', 'krw', 'krw_per_py', 'krw_raw', 'number', 'percent'].includes(type)) {
    const numeric = Number(beforeValue);
    return String(Number.isFinite(numeric) ? numeric + 1 : 1);
  }
  if (type === 'yn') return /^(y|yes|true|1)$/iu.test(before) ? 'N' : 'Y';
  if (type === 'select') {
    const knownOptions = text(field?.field_key) === 'disposition_status'
      ? ['정상', '매각', '리뷰 필요']
      : [];
    const option = [...safeArray(field?.options).map(text), ...knownOptions]
      .find((value) => value && value !== before);
    if (!option) throw new Error(`No alternate select value is available for ${text(field?.field_key)}.`);
    return option;
  }
  return before ? `${before.slice(0, 80)} QA-approval-${stamp}` : `QA approval ${stamp}`;
}

function candidates(rows, fieldKey) {
  return safeArray(rows).filter((row) => (
    row?.editable !== false
    && text(row?.row_key)
    && text(row?.revision_hash)
    && hasOwn(row?.edit_values, fieldKey)
  ));
}

async function fetchViewRows(supabaseUrl, anonKey, token, viewKey) {
  return (await invoke(supabaseUrl, anonKey, token, 'data-management/view-rows', {
    view_key: viewKey,
    page: 1,
    page_size: 200,
  })).data;
}

async function resolveFreshCandidate(supabaseUrl, anonKey, token, probe, stamp, requiredRowKey = '') {
  for (let refresh = 0; refresh <= MAX_STALE_REFRESHES; refresh += 1) {
    const rowsData = await fetchViewRows(supabaseUrl, anonKey, token, probe.view_key);
    const field = safeArray(rowsData?.fields).find((item) => text(item?.field_key) === probe.field_key);
    assert(field?.editable === true, `${probe.view_key}.${probe.field_key} is not an editable live view field.`);
    const rows = candidates(rowsData?.rows, probe.field_key)
      .filter((row) => !requiredRowKey || text(row.row_key) === requiredRowKey);
    assert(rows.length, `${probe.view_key} returned no eligible row for ${probe.field_key}.`);

    for (const row of rows) {
      const beforeValue = row.edit_values[probe.field_key];
      const requestedValue = nextRequestedValue(beforeValue, field, stamp);
      assert(!valuesEqual(beforeValue, requestedValue), `${probe.view_key}.${probe.field_key} did not produce a changed QA value.`);
      const preview = await invoke(supabaseUrl, anonKey, token, 'data-management/preview-edit', {
        edit_mode: 'view_field',
        view_key: probe.view_key,
        row_key: row.row_key,
        field_key: probe.field_key,
        before_value: beforeValue,
        requested_value: requestedValue,
        revision_hash: row.revision_hash,
        reason: `QA four-view approval smoke ${stamp}.`,
      });
      const codes = validationCodes(preview.data);
      if (codes.some((code) => STALE_CODES.has(code))) continue;
      assert(preview.data?.can_submit === true, `${probe.view_key}.${probe.field_key} preview cannot be submitted: ${codes.join(', ') || 'unknown validation'}.`);
      assert(preview.data?.auto_write_enabled === true, `${probe.view_key}.${probe.field_key} is not approval auto-write enabled.`);
      assert(preview.data?.target?.readback?.stale !== true, `${probe.view_key}.${probe.field_key} target readback is stale.`);
      return { field, row, beforeValue, requestedValue, preview: preview.data, refresh };
    }
  }
  throw new Error(`${probe.view_key}.${probe.field_key} did not yield a fresh submittable candidate.`);
}

function viewFieldPayload(candidate, requestedValue, stamp, phase) {
  return {
    edit_mode: 'view_field',
    client_request_id: `qa-four-view-approval-${phase}-${stamp}-${candidate.row.row_key}-${candidate.field.field_key}`,
    view_key: candidate.probe.view_key,
    row_key: candidate.row.row_key,
    field_key: candidate.field.field_key,
    before_value: candidate.beforeValue,
    requested_value: requestedValue,
    revision_hash: candidate.row.revision_hash,
    reason_code: 'qa_data_management_four_view_approval_smoke',
    reason: `QA four-view approval smoke ${phase}; original value will be restored immediately.`,
    impact_summary: `QA ${candidate.probe.label} view approval/readback/restore probe.`,
  };
}

async function submitAndReadback(supabaseUrl, anonKey, token, candidate, requestedValue, stamp, phase, onCreated) {
  const payload = viewFieldPayload(candidate, requestedValue, stamp, phase);
  const submitted = await invoke(supabaseUrl, anonKey, token, 'data-management/submit-edit', payload);
  const id = text(submitted.data?.id);
  assert(id, `${candidate.probe.view_key} ${phase} submit did not return an edit request id.`);
  onCreated(id);
  const readback = await invoke(supabaseUrl, anonKey, token, 'edits/readback', { id });
  const rows = safeArray(readback.data?.readbacks);
  assert(rows.length, `${candidate.probe.view_key} ${phase} submit did not produce a Supabase readback row.`);
  assert(rows.every((row) => row.matches_before_value === true && row.stale === false), `${candidate.probe.view_key} ${phase} submit readback was stale before approval.`);
  return { id, payload, submit: submitted.data, before_approval_readback: readback.data };
}

function switchQaRequester(editId, actorId, phase) {
  const rows = runLinkedDbQuery(`
with other_user as (
  select id as user_id
  from auth.users
  where id::text <> ${sqlLiteral(actorId)}
  order by email nulls last, created_at
  limit 1
)
update public.ll_edit_requests
set requested_by = (select user_id from other_user),
    request_payload = jsonb_set(
      coalesce(request_payload, '{}'::jsonb),
      '{qa_four_view_approval_smoke}',
      jsonb_build_object('phase', ${sqlLiteral(phase)}, 'requester_swapped', true),
      true
    ),
    updated_at = now()
where id = ${sqlLiteral(editId)}::uuid
  and status = 'submitted'
  and exists (select 1 from other_user)
returning id::text, requested_by::text, status, write_status;
`, 'data-management-four-view-approval-requester');
  assert(rows.length === 1, `Failed to assign a distinct requester to QA edit ${editId}.`);
}

async function approveAndReadback(supabaseUrl, anonKey, token, edit, actorId, phase) {
  switchQaRequester(edit.id, actorId, phase);
  const approved = await invoke(supabaseUrl, anonKey, token, 'edits/approve', {
    id: edit.id,
    approval_note: `QA four-view approval smoke ${phase}; original value is restored by the paired request.`,
  });
  const readback = await invoke(supabaseUrl, anonKey, token, 'edits/readback', { id: edit.id });
  const rows = safeArray(readback.data?.readbacks);
  assert(rows.length, `${phase} approval did not return a Supabase readback row.`);
  assert(rows.every((row) => row.matches_requested_value === true && row.write_confirmed === true && row.stale === false), `${phase} approval did not persist the requested value in Supabase.`);
  return { approve: approved.data, after_approval_readback: readback.data };
}

function cleanupQaRows(ids) {
  const validIds = ids.filter((id) => /^[0-9a-f-]{36}$/iu.test(id));
  if (!validIds.length) return { deleted_requests: 0, deleted_notifications: 0 };
  const idArray = validIds.map(sqlLiteral).join(', ');
  const rows = runLinkedDbQuery(`
with qa_ids as (
  select unnest(array[${idArray}]::uuid[]) as id
), deleted_notifications as (
  delete from public.ll_notifications notification
  using qa_ids
  where notification.dedupe_key like ('edit-request:' || qa_ids.id::text || ':%')
  returning notification.notification_id
), deleted_requests as (
  delete from public.ll_edit_requests request
  using qa_ids
  where request.id = qa_ids.id
  returning request.id
)
select
  (select count(*) from deleted_requests)::integer as deleted_requests,
  (select count(*) from deleted_notifications)::integer as deleted_notifications;
`, 'data-management-four-view-approval-cleanup');
  return rows[0] || { deleted_requests: 0, deleted_notifications: 0 };
}

async function exerciseProbe(supabaseUrl, anonKey, token, actorId, probe, stamp) {
  const record = { view_key: probe.view_key, field_key: probe.field_key, label: probe.label, edit_request_ids: [] };
  let changed = false;
  let restored = false;
  try {
    const changeCandidate = await resolveFreshCandidate(supabaseUrl, anonKey, token, probe, stamp);
    changeCandidate.probe = probe;
    record.row_key = text(changeCandidate.row.row_key);
    record.row_label = text(changeCandidate.row.row_label);
    record.original_value = changeCandidate.beforeValue;
    record.qa_value = changeCandidate.requestedValue;
    record.target = changeCandidate.preview.target || null;

    const change = await submitAndReadback(
      supabaseUrl,
      anonKey,
      token,
      changeCandidate,
      changeCandidate.requestedValue,
      stamp,
      'change',
      (id) => record.edit_request_ids.push(id),
    );
    record.change = await approveAndReadback(supabaseUrl, anonKey, token, change, actorId, 'change');
    changed = true;

    const restoreCandidate = await resolveFreshCandidate(supabaseUrl, anonKey, token, probe, stamp, record.row_key);
    restoreCandidate.probe = probe;
    assert(valuesEqual(restoreCandidate.beforeValue, record.qa_value), `${probe.view_key}.${probe.field_key} changed value was not visible before restoration.`);
    const restore = await submitAndReadback(
      supabaseUrl,
      anonKey,
      token,
      restoreCandidate,
      record.original_value,
      stamp,
      'restore',
      (id) => record.edit_request_ids.push(id),
    );
    record.restore = await approveAndReadback(supabaseUrl, anonKey, token, restore, actorId, 'restore');
    const finalRows = await fetchViewRows(supabaseUrl, anonKey, token, probe.view_key);
    const finalRow = safeArray(finalRows?.rows).find((row) => text(row?.row_key) === record.row_key);
    assert(finalRow && hasOwn(finalRow.edit_values, probe.field_key), `${probe.view_key}.${probe.field_key} could not be read after restoration.`);
    assert(valuesEqual(finalRow.edit_values[probe.field_key], record.original_value), `${probe.view_key}.${probe.field_key} did not restore the original value.`);
    restored = true;
    record.restored_value = finalRow.edit_values[probe.field_key];
    record.ok = true;
  } catch (error) {
    record.ok = false;
    record.error = error?.message || String(error);
    if (changed && !restored) record.recovery_required = true;
  } finally {
    // Deleting the QA request only follows a confirmed return to the original live value.
    if (restored || !changed) {
      record.cleanup = cleanupQaRows(record.edit_request_ids);
      record.cleanup_ok = Number(record.cleanup.deleted_requests) === record.edit_request_ids.length;
      if (!record.cleanup_ok) {
        record.ok = false;
        record.error = 'The original value was restored, but not every QA edit request was deleted.';
      }
    }
  }
  return record;
}

async function main() {
  const supabaseUrl = envValue('LOGISTICS_SUPABASE_URL', 'VITE_SUPABASE_URL');
  const anonKey = envValue('LOGISTICS_SUPABASE_ANON_KEY', 'VITE_SUPABASE_ANON_KEY');
  if (!supabaseUrl || !anonKey) {
    throw new Error('Set LOGISTICS_SUPABASE_URL/VITE_SUPABASE_URL and LOGISTICS_SUPABASE_ANON_KEY/VITE_SUPABASE_ANON_KEY.');
  }
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const stamp = timestampForFile();
  const outJson = path.join(OUT_DIR, `data-management-four-view-approval-smoke-${stamp}.json`);
  const latestJson = path.join(OUT_DIR, 'data-management-four-view-approval-smoke-latest.json');
  const auth = await signIn(supabaseUrl, anonKey);
  assert(text(auth.user?.id), 'The QA account must expose its Supabase user id for requester separation.');

  const probes = [];
  for (const probe of VIEW_PROBES) {
    const result = await exerciseProbe(supabaseUrl, anonKey, auth.token, auth.user.id, probe, stamp);
    probes.push(result);
    if (result.recovery_required) break;
  }
  const report = {
    ok: probes.every((probe) => probe.ok === true && probe.cleanup_ok === true),
    mode: 'data_management_four_view_submit_approve_supabase_readback_restore',
    generated_at: new Date().toISOString(),
    auth_source: auth.source,
    probes,
  };
  fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(latestJson, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`data management four-view approval smoke ${report.ok ? 'PASS' : 'FAIL'}: ${path.relative(ROOT, outJson)}`);
  if (!report.ok) process.exit(1);
}

main().catch((error) => {
  console.error(error?.stack || error?.message || error);
  process.exit(1);
});
