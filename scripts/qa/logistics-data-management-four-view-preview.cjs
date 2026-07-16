const {
  envValue,
  invoke,
  safeArray,
  signIn,
  text,
} = require('./logistics-data-management-qa-utils.cjs');

const VIEW_PROBES = [
  { view_key: 'asset_integrated', field_key: 'asset_name' },
  { view_key: 'investment_integrated', field_key: 'fund_name' },
  { view_key: 'lease_general_excel', field_key: 'tenant_master_name' },
  { view_key: 'lease_asset_manager_links', field_key: 'disposition_status', row_match: '아레나스양지물류센터' },
  { view_key: 'lease_asset_manager_links', field_key: 'disposition_status', row_match: '인천석남물류센터' },
  { view_key: 'lease_asset_manager_links', field_key: 'disposition_status', row_match: '화성 석포리 물류센터' },
];
const STALE_CODES = new Set(['stale_current_value', 'stale_revision_hash']);
const MAX_STALE_REFRESHES = 1;

function hasOwn(object, key) {
  return Boolean(object && typeof object === 'object' && Object.prototype.hasOwnProperty.call(object, key));
}

function validationCodes(data) {
  return safeArray(data?.validations).map((item) => text(item?.code)).filter(Boolean);
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
  if (['area_sqm', 'krw', 'krw_per_py', 'number', 'percent'].includes(type)) {
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
    if (!option) throw new Error('No alternate select option is available for the preview probe.');
    return option;
  }
  const base = before.slice(0, 80);
  return base ? `${base} QA-preview-${stamp}` : `QA preview ${stamp}`;
}

function candidates(rows, fieldKey, rowMatch = '') {
  return safeArray(rows).filter((row) => (
    row?.editable !== false
    && text(row?.row_key)
    && text(row?.revision_hash)
    && hasOwn(row?.edit_values, fieldKey)
    && (!rowMatch || text(row?.row_label).includes(rowMatch))
  ));
}

function reportAttempt(row, field, data, refresh, candidateIndex) {
  const codes = validationCodes(data);
  const stale = codes.filter((code) => STALE_CODES.has(code));
  const readback = data?.target?.readback || data?.readback || {};
  return {
    refresh,
    candidate_index: candidateIndex,
    row_label: text(row?.row_label),
    revision_hash_present: Boolean(text(row?.revision_hash)),
    can_submit: data?.can_submit === true,
    auto_write_enabled: data?.auto_write_enabled === true,
    validation_codes: codes,
    stale_codes: stale,
    semantic_before_value_accepted: stale.length === 0,
    target_readback_stale: readback?.stale,
    target_readback_matches_before_value: readback?.matches_before_value,
  };
}

async function fetchViewRows(supabaseUrl, anonKey, token, viewKey) {
  return (await invoke(supabaseUrl, anonKey, token, 'data-management/view-rows', {
    view_key: viewKey,
    page: 1,
    page_size: 200,
  })).data;
}

async function previewView(supabaseUrl, anonKey, token, probe, stamp) {
  const attempts = [];
  for (let refresh = 0; refresh <= MAX_STALE_REFRESHES; refresh += 1) {
    const rowsData = await fetchViewRows(supabaseUrl, anonKey, token, probe.view_key);
    const field = safeArray(rowsData?.fields).find((item) => text(item?.field_key) === probe.field_key);
    if (!field || field.editable !== true) {
      return {
        ...probe,
        ok: false,
        reason: 'The representative field was not returned as editable by the live view API.',
        field_present: Boolean(field),
        field_editable: field?.editable === true,
        attempts,
      };
    }

    const rows = candidates(rowsData?.rows, probe.field_key, probe.row_match);
    if (!rows.length) {
      return {
        ...probe,
        ok: false,
        reason: 'The live view API returned no editable row with a revision hash for the representative field.',
        row_count: safeArray(rowsData?.rows).length,
        attempts,
      };
    }

    let sawStale = false;
    for (const [candidateIndex, row] of rows.entries()) {
      const beforeValue = row.edit_values[probe.field_key];
      let requestedValue;
      try {
        requestedValue = nextRequestedValue(beforeValue, field, stamp);
      } catch (error) {
        return { ...probe, ok: false, reason: error.message, attempts };
      }
      const preview = await invoke(supabaseUrl, anonKey, token, 'data-management/preview-edit', {
        edit_mode: 'view_field',
        view_key: probe.view_key,
        row_key: row.row_key,
        field_key: probe.field_key,
        before_value: beforeValue,
        requested_value: requestedValue,
        revision_hash: row.revision_hash,
        reason: 'Read-only QA preview. This request is never submitted.',
      });
      const attempt = reportAttempt(row, field, preview.data, refresh, candidateIndex);
      attempts.push(attempt);
      if (attempt.stale_codes.length) {
        sawStale = true;
        continue;
      }
      if (attempt.can_submit && attempt.semantic_before_value_accepted) {
        return {
          ...probe,
          ok: true,
          field: { field_key: field.field_key, type: field.type, editable: field.editable },
          stale_retried: refresh > 0,
          attempts,
        };
      }
    }
    if (!sawStale) break;
  }
  return {
    ...probe,
    ok: false,
    reason: 'No fresh, submittable preview was returned for the representative field.',
    attempts,
  };
}

async function main() {
  const supabaseUrl = envValue('LOGISTICS_SUPABASE_URL', 'VITE_SUPABASE_URL');
  const anonKey = envValue('LOGISTICS_SUPABASE_ANON_KEY', 'VITE_SUPABASE_ANON_KEY');
  if (!supabaseUrl || !anonKey) {
    throw new Error('Set LOGISTICS_SUPABASE_URL/VITE_SUPABASE_URL and LOGISTICS_SUPABASE_ANON_KEY/VITE_SUPABASE_ANON_KEY.');
  }

  const auth = await signIn(supabaseUrl, anonKey);
  const stamp = new Date().toISOString().replace(/[-:.TZ]/gu, '');
  const probes = [];
  for (const probe of VIEW_PROBES) {
    try {
      probes.push(await previewView(supabaseUrl, anonKey, auth.token, probe, stamp));
    } catch (error) {
      probes.push({ ...probe, ok: false, error: error?.message || String(error) });
    }
  }

  const checks = {
    four_live_views_read: new Set(probes.map((probe) => probe.view_key)).size === 4,
    each_representative_field_is_submittable_from_fresh_readback: probes.every((probe) => probe.ok === true),
    preview_only: true,
  };
  const report = {
    ok: Object.values(checks).every(Boolean),
    mode: 'data_management_four_view_preview_only',
    generated_at: new Date().toISOString(),
    auth_source: auth.source,
    checks,
    probes,
  };
  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) process.exit(1);
}

main().catch((error) => {
  console.error(error?.stack || error?.message || error);
  process.exit(1);
});
