const fs = require('fs');
const path = require('path');
const {
  ROOT,
  OUT_DIR,
  envValue,
  invoke,
  safeArray,
  signIn,
  text,
  timestampForFile,
} = require('./logistics-data-management-qa-utils.cjs');

const REQUIRED_PROBES = [
  { view_key: 'lease_contracts', field_key: 'exclusive_ratio', label: 'exclusive ratio' },
  { view_key: 'lease_contracts', field_key: 'current_end_date', label: 'current contract end date' },
  { view_key: 'lease_contracts', field_key: 'current_monthly_rent_total', label: 'monthly rent total' },
  { view_key: 'lease_contracts', field_key: 'current_monthly_mf_total', label: 'monthly management fee total' },
];

function numericValue(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function nextRequestedValue(fieldKey, beforeValue) {
  if (fieldKey === 'exclusive_ratio') return String(Number((numericValue(beforeValue, 0.8) + 0.001).toFixed(4)));
  if (/date$/u.test(fieldKey)) {
    const base = new Date(text(beforeValue) || '2030-12-31');
    if (Number.isFinite(base.getTime())) {
      base.setUTCDate(base.getUTCDate() + 1);
      return base.toISOString().slice(0, 10);
    }
    return '2030-12-31';
  }
  return String(Math.round(numericValue(beforeValue, 1000) + 1));
}

function findCandidate(rows, fieldKey) {
  return safeArray(rows).find((row) => (
    row?.editable !== false
    && text(row?.row_key)
    && text(row?.revision_hash)
    && row.edit_values
    && Object.prototype.hasOwnProperty.call(row.edit_values, fieldKey)
  ));
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const stamp = timestampForFile();
  const outJson = path.join(OUT_DIR, `data-management-required-fields-preview-${stamp}.json`);
  const latestJson = path.join(OUT_DIR, 'data-management-required-fields-preview-latest.json');
  const supabaseUrl = envValue('LOGISTICS_SUPABASE_URL', 'VITE_SUPABASE_URL');
  const anonKey = envValue('LOGISTICS_SUPABASE_ANON_KEY', 'VITE_SUPABASE_ANON_KEY');
  if (!supabaseUrl || !anonKey) {
    throw new Error('Set LOGISTICS_SUPABASE_URL/VITE_SUPABASE_URL and LOGISTICS_SUPABASE_ANON_KEY/VITE_SUPABASE_ANON_KEY.');
  }
  const auth = await signIn(supabaseUrl, anonKey);
  const probes = [];
  const errors = [];
  for (const probe of REQUIRED_PROBES) {
    try {
      const rowsResult = await invoke(supabaseUrl, anonKey, auth.token, 'data-management/view-rows', {
        view_key: probe.view_key,
        page: 1,
        page_size: 80,
      });
      const fields = safeArray(rowsResult.data?.fields);
      const field = fields.find((item) => text(item.field_key) === probe.field_key);
      const row = findCandidate(rowsResult.data?.rows, probe.field_key);
      if (!field || field.editable !== true || !row) {
        probes.push({
          ...probe,
          ok: false,
          reason: 'editable field or candidate row was not found',
          field_present: Boolean(field),
          field_editable: field?.editable === true,
          row_found: Boolean(row),
        });
        continue;
      }
      const beforeValue = row.edit_values?.[probe.field_key];
      const requestedValue = nextRequestedValue(probe.field_key, beforeValue);
      const preview = await invoke(supabaseUrl, anonKey, auth.token, 'data-management/preview-edit', {
        edit_mode: 'view_field',
        view_key: probe.view_key,
        row_key: row.row_key,
        field_key: probe.field_key,
        requested_value: requestedValue,
        revision_hash: row.revision_hash,
        reason: 'QA direct management field preview only. No submit is performed.',
      });
      const validations = safeArray(preview.data?.validations);
      const validationErrors = validations.filter((item) => item.level === 'error');
      probes.push({
        ...probe,
        ok: preview.body?.ok === true && preview.data?.can_submit === true && validationErrors.length === 0,
        field: {
          field_key: field.field_key,
          label: field.label,
          group: field.group,
          editable: field.editable,
          target_table: field.target_table,
          target_field: field.target_field,
        },
        row_label: row.row_label,
        before_value: beforeValue,
        requested_value: requestedValue,
        can_submit: preview.data?.can_submit === true,
        auto_write_enabled: preview.data?.auto_write_enabled === true,
        has_target_readback: Boolean(preview.data?.target?.readback),
        validation_errors: validationErrors,
        validation_warnings: validations.filter((item) => item.level === 'warning'),
      });
    } catch (error) {
      errors.push(`${probe.view_key}.${probe.field_key}: ${error.message}`);
      probes.push({ ...probe, ok: false, error: error.message });
    }
  }
  const checks = {
    all_required_fields_previewable: probes.every((probe) => probe.ok === true),
    no_runtime_errors: errors.length === 0,
    has_four_probes: probes.length === REQUIRED_PROBES.length,
  };
  const report = {
    ok: Object.values(checks).every(Boolean),
    generated_at: new Date().toISOString(),
    auth_source: auth.source,
    checks,
    errors,
    probes,
  };
  fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(latestJson, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`data management required fields preview ${report.ok ? 'PASS' : 'FAIL'}: ${path.relative(ROOT, outJson)}`);
  if (!report.ok) {
    console.log(JSON.stringify({ checks, errors, probes: probes.map((probe) => ({ field_key: probe.field_key, ok: probe.ok, reason: probe.reason, error: probe.error, validation_errors: probe.validation_errors })) }, null, 2));
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
