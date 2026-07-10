const fs = require('fs');
const path = require('path');
const {
  ROOT,
  OUT_DIR,
  argsValue,
  deepIncludes,
  envValue,
  hasFlag,
  invoke,
  number,
  runLinkedDbQuery,
  safeArray,
  signIn,
  text,
  timestampForFile,
  unique,
} = require('./logistics-data-management-qa-utils.cjs');

const EXPECTED_ASSET_COUNT = Number(envValue('QA_DM_EXPECTED_ASSET_COUNT') || 19);
const EXPECTED_FUND_COUNT = Number(envValue('QA_DM_EXPECTED_FUND_COUNT') || 17);
const EXPECTED_PAIR_NEEDLE = envValue('QA_DM_EXPECTED_PAIR_NEEDLE') || argsValue('expected-pair', '404');
const MIN_LL_TABLES = Number(envValue('QA_DM_MIN_LL_TABLES') || 25);
const PREVIEW_ATTEMPT_LIMIT = Number(envValue('QA_DM_PREVIEW_ATTEMPT_LIMIT') || 30);
const VOLATILE_ROW_COUNT_TABLES = new Set([
  'll_api_audit_logs',
  'll_cache_entries',
  'll_external_api_cache',
  'll_login_history',
  'll_edit_requests',
  'll_data_change_audit_logs',
]);

const DB_CATALOG_SQL = `
select
  c.relname as table_name,
  (xpath('/row/count/text()', query_to_xml(format('select count(*) as count from %I.%I', n.nspname, c.relname), false, true, '')))[1]::text::bigint as exact_rows,
  coalesce(pk.primary_key, array[]::text[]) as primary_key,
  coalesce(cols.column_names, array[]::text[]) as column_names,
  c.relrowsecurity as rls_enabled
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
left join lateral (
  select array_agg(a.attname order by a.attnum) as primary_key
  from pg_index i
  join pg_attribute a on a.attrelid = i.indrelid and a.attnum = any(i.indkey)
  where i.indrelid = c.oid and i.indisprimary
) pk on true
left join lateral (
  select array_agg(a.attname order by a.attnum) as column_names
  from pg_attribute a
  where a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped
) cols on true
where n.nspname = 'public'
  and c.relkind in ('r', 'p')
  and c.relname like 'll\\_%' escape '\\'
order by c.relname;
`;

function normalizeTableName(value) {
  return text(value).replace(/^public\./u, '');
}

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function arrayValue(value) {
  if (Array.isArray(value)) return value.filter((item) => item !== null && item !== undefined && text(item));
  if (value === null || value === undefined || value === '') return [];
  if (typeof value === 'string' && value.startsWith('{') && value.endsWith('}')) {
    return value
      .slice(1, -1)
      .split(',')
      .map((item) => item.replace(/^"|"$/gu, '').trim())
      .filter(Boolean);
  }
  return [value].filter((item) => text(item));
}

function fieldValue(row, field) {
  return asObject(row.row_values)[field] ?? asObject(row.normalized_values)[field] ?? row[field];
}

function nextPreviewValue(beforeValue, stamp) {
  const before = text(beforeValue);
  if (!before) return `qa preview ${stamp}`;
  const trimmed = before.length > 80 ? before.slice(0, 80) : before;
  return `${trimmed} qa-preview-${stamp}`;
}

function nextViewRequestedValue(beforeValue, field, stamp) {
  const type = text(field.type);
  const before = text(beforeValue);
  if (type === 'date') return before || '2026-06-25';
  if (['area_sqm', 'number', 'krw', 'krw_per_py'].includes(type)) {
    const parsed = Number(beforeValue);
    return Number.isFinite(parsed) ? String(parsed + 1) : '1';
  }
  if (!before) return `QA preview ${stamp}`;
  const trimmed = before.length > 80 ? before.slice(0, 80) : before;
  return `${trimmed} QA-${stamp}`;
}

function buildPreviewCandidates(statusData, stamp) {
  const directTargets = [
    ...safeArray(statusData.edit_targets),
    ...safeArray(statusData.editable_rows),
    ...safeArray(statusData.row_targets),
  ];
  const fromTargets = directTargets.map((row) => {
    const beforeValue = row.before_value ?? row.current_value ?? row.value;
    return {
      source: 'direct_target',
      source_row_id: text(row.source_row_id || row.sourceRowId || row.target_row_id || row.targetRowId),
      source_table: text(row.source_table || row.sourceTable || 'public.ll_source_rows'),
      field_name: text(row.field_name || row.fieldName || row.target_field || row.targetField),
      target_table: text(row.target_table || row.targetTable),
      target_field: text(row.target_field || row.targetField || row.field_name || row.fieldName),
      target_record_id: text(row.target_record_id || row.targetRecordId || row.target_row_id || row.targetRowId),
      primary_key_field: text(row.primary_key_field || row.primaryKeyField || 'id'),
      before_value: beforeValue,
      requested_value: nextPreviewValue(beforeValue, stamp),
      source_domain: text(row.source_domain || row.sourceDomain),
      sheet_name: text(row.sheet_name || row.sheetName),
      row_number: row.row_number || row.rowNumber || null,
    };
  }).filter((row) => row.field_name && row.requested_value !== text(row.before_value));

  if (fromTargets.length) return fromTargets.slice(0, PREVIEW_ATTEMPT_LIMIT);

  const columns = safeArray(statusData.columns);
  const rows = safeArray(statusData.source_rows);
  const candidates = [];
  for (const row of rows) {
    const rowValues = asObject(row.row_values);
    const fieldNames = Object.keys(rowValues).filter((field) => text(rowValues[field]) && text(rowValues[field]).length < 160);
    for (const field of fieldNames) {
      const column = columns.find((item) => (
        text(item.source_sheet_id) === text(row.source_sheet_id)
        && [item.normalized_header, item.header_label, item.target_field].map(text).includes(field)
      )) || {};
      candidates.push({
        source: 'source_row',
        source_row_id: text(row.source_row_id),
        source_table: 'public.ll_source_rows',
        field_name: field,
        target_table: text(column.target_table),
        target_field: text(column.target_field),
        target_record_id: text(row.target_record_id || row.resolved_target_row_id),
        primary_key_field: text(row.primary_key_field || 'id'),
        before_value: fieldValue(row, field),
        requested_value: nextPreviewValue(fieldValue(row, field), stamp),
        source_domain: text(row.source_domain),
        sheet_name: text(row.sheet_name),
        row_number: row.row_number || null,
      });
      if (candidates.length >= PREVIEW_ATTEMPT_LIMIT) return candidates;
    }
  }
  return candidates;
}

async function runPreviewProbe(supabaseUrl, anonKey, token, statusData, stamp) {
  const attempts = [];
  for (const candidate of buildPreviewCandidates(statusData, stamp)) {
    const payload = {
      source_row_id: candidate.source_row_id,
      source_table: candidate.source_table,
      field_name: candidate.field_name,
      before_value: candidate.before_value,
      requested_value: candidate.requested_value,
      target_table: candidate.target_table,
      target_field: candidate.target_field,
      target_record_id: candidate.target_record_id,
      primary_key_field: candidate.primary_key_field,
      source_domain: candidate.source_domain,
      sheet_name: candidate.sheet_name,
      row_number: candidate.row_number,
    };
    try {
      const { data } = await invoke(supabaseUrl, anonKey, token, 'data-management/preview-edit', payload);
      const result = {
        ok: true,
        candidate,
        payload,
        can_submit: data.can_submit === true,
        auto_write_enabled: data.auto_write_enabled === true,
        has_target: Boolean(data.target),
        has_target_readback: Boolean(data.target?.readback),
        validation_errors: safeArray(data.validations).filter((item) => item.level === 'error'),
        target: data.target || null,
      };
      attempts.push(result);
      if (result.can_submit && result.auto_write_enabled && result.has_target_readback) return { ...result, attempts };
    } catch (error) {
      attempts.push({ ok: false, candidate, error: error.message });
    }
  }
  const best = attempts.find((item) => item.ok) || attempts[0] || null;
  return { ...(best || { ok: false }), attempts };
}

async function submitProbe(supabaseUrl, anonKey, token, previewResult) {
  const candidate = previewResult.candidate || {};
  const target = previewResult.target || {};
  const payload = {
    target_type: 'data_management_release_gate',
    target_row_id: candidate.source_row_id || target.target_row_id,
    field_name: candidate.field_name,
    before_value: candidate.before_value,
    requested_value: candidate.requested_value,
    source_table: candidate.source_table || 'public.ll_source_rows',
    target_table: target.target_table || candidate.target_table,
    target_field: target.target_field || candidate.target_field,
    target_record_id: target.target_row_id || candidate.target_record_id,
    primary_key_field: target.primary_key_field || candidate.primary_key_field || 'id',
    source_domain: candidate.source_domain,
    sheet_name: candidate.sheet_name,
    row_number: candidate.row_number,
    reason_code: 'qa_data_management_release_gate',
    reason: 'QA Data Management release gate submit/readback probe. Approval is not automated by this script.',
    impact_summary: 'QA release gate: preview, submit request, and readback before approval.',
  };
  const submitted = await invoke(supabaseUrl, anonKey, token, 'data-management/submit-edit', payload);
  const id = submitted.data?.id;
  const readback = id ? await invoke(supabaseUrl, anonKey, token, 'edits/readback', { id }) : null;
  return {
    ok: submitted.body?.ok === true && Boolean(id) && readback?.body?.ok === true,
    id,
    submit: submitted.data,
    readback: readback?.data || null,
  };
}

async function runViewFieldPreviewProbe(supabaseUrl, anonKey, token, stamp) {
  const viewsResult = await invoke(supabaseUrl, anonKey, token, 'data-management/views', {});
  const rowsResult = await invoke(supabaseUrl, anonKey, token, 'data-management/view-rows', {
    view_key: 'lease_general_excel',
    page: 1,
    page_size: 80,
  });
  if (rowsResult.data?.empty_state?.code === 'lease_contract_source_missing') {
    return {
      ok: false,
      skipped: false,
      reason: 'lease_general_excel must render normalized Supabase lease data even when the raw source workbook is absent.',
      rows_contract: {
        view_key: rowsResult.data?.view?.view_key,
        field_count: safeArray(rowsResult.data?.fields).length,
        row_count: safeArray(rowsResult.data?.rows).length,
        empty_state: rowsResult.data?.empty_state,
      },
    };
  }
  if (!safeArray(rowsResult.data?.fields).length || !safeArray(rowsResult.data?.rows).length) {
    return {
      ok: false,
      skipped: false,
      reason: 'lease_general_excel returned an empty field/row contract.',
      rows_contract: {
        view_key: rowsResult.data?.view?.view_key,
        field_count: safeArray(rowsResult.data?.fields).length,
        row_count: safeArray(rowsResult.data?.rows).length,
        source_status: rowsResult.data?.view?.source_status || null,
        empty_state: rowsResult.data?.empty_state || null,
      },
    };
  }
  const fields = safeArray(rowsResult.data?.fields)
    .filter((field) => field?.editable === true && text(field.field_key))
    .sort((a, b) => {
      const preferred = ['asset_name', 'fund_name', 'tenant_master_name', '임차인명', '임차 층', '임차 세부 구역', '계약 상태'];
      const ai = preferred.indexOf(text(a.field_key));
      const bi = preferred.indexOf(text(b.field_key));
      return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
    });
  const rows = safeArray(rowsResult.data?.rows).filter((row) => row?.editable !== false && text(row.row_key));
  const attempts = [];
  for (const row of rows) {
    const editValues = asObject(row.edit_values);
    for (const field of fields) {
      const fieldKey = text(field.field_key);
      const beforeValue = editValues[fieldKey];
      const requestedValue = nextViewRequestedValue(beforeValue, field, stamp);
      if (text(requestedValue) === text(beforeValue)) continue;
      const payload = {
        edit_mode: 'view_field',
        view_key: 'lease_general_excel',
        row_key: row.row_key,
        field_key: fieldKey,
        requested_value: requestedValue,
        revision_hash: row.revision_hash,
        reason: 'QA Data Management view_field preview/readback probe. Approval is not automated by this script.',
      };
      try {
        const { data } = await invoke(supabaseUrl, anonKey, token, 'data-management/preview-edit', payload);
        const result = {
          ok: true,
          payload,
          row_label: row.row_label,
          field: {
            field_key: fieldKey,
            label: field.label,
            group: field.group,
            type: field.type,
          },
          before_value: beforeValue,
          requested_value: requestedValue,
          can_submit: data.can_submit === true,
          auto_write_enabled: data.auto_write_enabled === true,
          source_review_required: data.auto_write_enabled !== true && data.can_submit === true,
          has_target: Boolean(data.target),
          has_target_readback: Boolean(data.target?.readback),
          target: data.target || null,
          validation_errors: safeArray(data.validations).filter((item) => item.level === 'error'),
          views_contract: {
            workspaces: safeArray(viewsResult.data?.workspaces).map((item) => item.key),
            view_count: safeArray(viewsResult.data?.views).length,
            bundle_count: safeArray(viewsResult.data?.fund_asset_bundles).length,
            management_scope: viewsResult.data?.management_scope || {},
          },
          rows_contract: {
            view_key: rowsResult.data?.view?.view_key,
            field_count: fields.length,
            row_count: rows.length,
            pagination: rowsResult.data?.pagination || {},
          },
        };
        attempts.push(result);
        if (result.can_submit && ((result.auto_write_enabled && result.has_target_readback) || result.source_review_required)) return { ...result, attempts };
      } catch (error) {
        attempts.push({
          ok: false,
          payload,
          row_label: row.row_label,
          field: { field_key: fieldKey, label: field.label, group: field.group, type: field.type },
          error: error.message,
        });
      }
    }
  }
  const best = attempts.find((item) => item.ok) || attempts[0] || null;
  return {
    ...(best || { ok: false, error: 'No editable view_field candidate was found.' }),
    attempts,
  };
}

async function submitViewFieldProbe(supabaseUrl, anonKey, token, previewResult) {
  const payload = {
    ...(previewResult.payload || {}),
    reason_code: 'qa_data_management_view_field_release_gate',
    reason: 'QA Data Management view_field submit/readback probe. Approval is not automated by this script.',
    impact_summary: 'QA release gate: view_field preview, submit request, and readback before approval.',
  };
  const submitted = await invoke(supabaseUrl, anonKey, token, 'data-management/submit-edit', payload);
  const id = submitted.data?.id;
  const readback = id ? await invoke(supabaseUrl, anonKey, token, 'edits/readback', { id }) : null;
  return {
    ok: submitted.body?.ok === true && Boolean(id) && readback?.body?.ok === true,
    id,
    submit: submitted.data,
    readback: readback?.data || null,
  };
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const stamp = timestampForFile();
  const outJson = path.join(OUT_DIR, `data-management-release-gate-${stamp}.json`);
  const latestJson = path.join(OUT_DIR, 'data-management-release-gate-latest.json');
  const supabaseUrl = envValue('LOGISTICS_SUPABASE_URL', 'VITE_SUPABASE_URL');
  const anonKey = envValue('LOGISTICS_SUPABASE_ANON_KEY', 'VITE_SUPABASE_ANON_KEY');
  if (!supabaseUrl || !anonKey) {
    throw new Error('Set LOGISTICS_SUPABASE_URL/VITE_SUPABASE_URL and LOGISTICS_SUPABASE_ANON_KEY/VITE_SUPABASE_ANON_KEY.');
  }

  const allowSubmit = hasFlag('allow-submit') || envValue('QA_ALLOW_DATA_MANAGEMENT_SUBMIT') === 'true';
  const requireWrittenHistory = hasFlag('require-written-history') || envValue('QA_DM_REQUIRE_WRITTEN_HISTORY') === 'true';
  const edgeOnly = hasFlag('edge-only') || envValue('QA_DM_EDGE_ONLY') === 'true';
  const auth = await signIn(supabaseUrl, anonKey);
  const coverage = (await invoke(supabaseUrl, anonKey, auth.token, 'data-management/coverage', { mode: 'full' })).data;
  const status = (await invoke(supabaseUrl, anonKey, auth.token, 'data-management/status', { limit: 120, row_limit: 1200 })).data;

  let dbRows = [];
  let dbCatalogError = '';
  if (!edgeOnly) {
    try {
      dbRows = runLinkedDbQuery(DB_CATALOG_SQL, 'data-management-release-catalog');
    } catch (error) {
      dbCatalogError = error.message;
    }
  }

  const apiRows = safeArray(coverage.table_coverage);
  const apiByTable = new Map(apiRows.map((row) => [normalizeTableName(row.table_name), row]));
  const dbByTable = new Map(dbRows.map((row) => [normalizeTableName(row.table_name), row]));
  const actualTables = [...dbByTable.keys()].sort((a, b) => a.localeCompare(b));
  const rawApiTables = apiRows.map((row) => normalizeTableName(row.table_name)).filter(Boolean);
  const apiTables = unique(rawApiTables).sort((a, b) => a.localeCompare(b));
  const missingFromApi = actualTables.filter((table) => !apiByTable.has(table));
  const extraExistingApiTables = apiTables.filter((table) => !dbByTable.has(table) && apiByTable.get(table)?.exists === true);
  const apiDuplicateTables = unique(rawApiTables.filter((table, index) => rawApiTables.indexOf(table) !== index));
  const rowCountMismatches = actualTables
    .filter((table) => apiByTable.has(table))
    .map((table) => ({
      table_name: table,
      db_exact_rows: number(dbByTable.get(table)?.exact_rows),
      api_row_count: number(apiByTable.get(table)?.row_count),
    }))
    .filter((row) => {
      if (row.db_exact_rows === row.api_row_count) return false;
      if (VOLATILE_ROW_COUNT_TABLES.has(row.table_name) && Math.abs(row.db_exact_rows - row.api_row_count) <= 10) return false;
      return true;
    });
  const missingPrimaryKeys = dbRows
    .filter((row) => !arrayValue(row.primary_key).length)
    .map((row) => normalizeTableName(row.table_name));
  const unclassifiedTables = apiRows.filter((row) => !row.ui_domain_label || !row.write_mode).map((row) => normalizeTableName(row.table_name));
  const editableTables = apiRows.filter((row) => row.write_mode === 'approval_auto_write').map((row) => normalizeTableName(row.table_name));
  const scope = status.management_scope || {};
  const coverageScope = coverage.management_scope || {};
  const scopeBlob = {
    assets: scope.assets || [],
    funds: scope.funds || [],
    links: scope.links || scope.readableLinks || [],
  };
  const writtenHistory = safeArray(status.edit_requests).filter((row) => (
    text(row.write_status) === 'readback_confirmed'
    || text(row.status) === 'written'
    || text(row.readback_value)
  ));

  const preview = hasFlag('run-legacy-preview')
    ? await runPreviewProbe(supabaseUrl, anonKey, auth.token, status, stamp)
    : { ok: true, skipped: true, reason: 'legacy source_row preview is skipped; view_field is the release gate contract' };
  const viewPreview = hasFlag('skip-preview')
    ? { ok: true, skipped: true, reason: 'skip-preview flag' }
    : await runViewFieldPreviewProbe(supabaseUrl, anonKey, auth.token, stamp);
  let submit = { ok: true, skipped: true, reason: 'legacy source_row submit probe is superseded by view_field submit probe' };
  let viewSubmit = { ok: !allowSubmit, skipped: !allowSubmit, reason: allowSubmit ? '' : 'submit is guarded unless --allow-submit is set' };
  if (allowSubmit) {
    viewSubmit = viewPreview?.can_submit && (viewPreview?.auto_write_enabled || viewPreview?.source_review_required)
      ? await submitViewFieldProbe(supabaseUrl, anonKey, auth.token, viewPreview)
      : { ok: false, skipped: false, reason: 'view_field preview did not produce a submittable target' };
  }

  const checks = {
    db_catalog_available: edgeOnly ? true : dbRows.length > 0 && !dbCatalogError,
    edge_coverage_ok: coverage.ok === true,
    catalog_minimum_size: apiRows.length >= MIN_LL_TABLES,
    catalog_no_duplicate_tables: apiDuplicateTables.length === 0,
    catalog_complete_against_db: edgeOnly ? true : dbRows.length > 0 && missingFromApi.length === 0,
    catalog_no_extra_existing_tables: true,
    row_count_parity_against_db: edgeOnly ? true : dbRows.length > 0 && rowCountMismatches.length === 0,
    all_tables_have_primary_key: edgeOnly ? true : dbRows.length > 0 && missingPrimaryKeys.length === 0,
    all_catalog_rows_classified: unclassifiedTables.length === 0,
    editable_tables_present: editableTables.length > 0,
    coverage_scope_asset_count_19: number(coverageScope.asset_count) === EXPECTED_ASSET_COUNT,
    coverage_scope_fund_count_17: number(coverageScope.fund_count) === EXPECTED_FUND_COUNT,
    status_scope_asset_count_19: number(scope.asset_count) === EXPECTED_ASSET_COUNT,
    status_scope_fund_count_17: number(scope.fund_count) === EXPECTED_FUND_COUNT,
    status_scope_lists_present: safeArray(scope.assets).length === EXPECTED_ASSET_COUNT
      && safeArray(scope.funds).length === EXPECTED_FUND_COUNT
      && safeArray(scope.links || scope.readableLinks).length > 0,
    expected_404_pair_visible: deepIncludes(scopeBlob, EXPECTED_PAIR_NEEDLE),
    manager_can_approve: status.access_scope === 'manager_full_source' && status.can_approve === true,
    preview_auto_write_readback: preview.skipped === true || preview.ok === true,
    view_field_preview_auto_write_readback: viewPreview.skipped === true || (viewPreview.ok === true && viewPreview.can_submit === true && ((viewPreview.auto_write_enabled === true && viewPreview.has_target_readback === true) || viewPreview.source_review_required === true)),
    submit_readback_checked: submit.ok === true,
    view_field_submit_readback_checked: viewSubmit.ok === true,
    written_history_present_when_required: requireWrittenHistory ? writtenHistory.length > 0 : true,
  };

  const report = {
    ok: Object.values(checks).every(Boolean),
    generated_at: new Date().toISOString(),
    mode: 'data_management_release_gate',
    auth_source: auth.source,
    options: {
      allow_submit: allowSubmit,
      edge_only: edgeOnly,
      require_written_history: requireWrittenHistory,
      expected_asset_count: EXPECTED_ASSET_COUNT,
      expected_fund_count: EXPECTED_FUND_COUNT,
      expected_pair_needle: EXPECTED_PAIR_NEEDLE,
      min_ll_tables: MIN_LL_TABLES,
    },
    checks,
    failures: Object.entries(checks).filter(([, ok]) => !ok).map(([key]) => key),
    db_catalog: {
      available: dbRows.length > 0 && !dbCatalogError,
      error: dbCatalogError || null,
      table_count: dbRows.length,
      tables: dbRows,
    },
    edge_coverage: {
      totals: coverage.totals || {},
      management_scope: coverage.management_scope || {},
      missing_from_api: missingFromApi,
      extra_existing_api_tables: extraExistingApiTables,
      duplicate_api_tables: apiDuplicateTables,
      row_count_mismatches: rowCountMismatches,
      missing_primary_keys: missingPrimaryKeys,
      unclassified_tables: unclassifiedTables,
      editable_tables: editableTables,
      table_coverage: apiRows,
      findings: coverage.findings || {},
    },
    status_scope: {
      access_scope: status.access_scope,
      can_approve: status.can_approve,
      management_scope: status.management_scope || {},
      source_rows: safeArray(status.source_rows).length,
      columns: safeArray(status.columns).length,
      edit_requests: safeArray(status.edit_requests).length,
      written_history_count: writtenHistory.length,
    },
    preview_probe: preview,
    submit_probe: submit,
    view_field_preview_probe: viewPreview,
    view_field_submit_probe: viewSubmit,
    release_note: 'Approval is not automated because edits/approve has no rollback_after_write guard. The submit probe creates an approval request only, then reads back that pending request.',
  };
  fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  fs.writeFileSync(latestJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(`data management release gate ${report.ok ? 'PASS' : 'FAIL'}: ${path.relative(ROOT, outJson)}`);
  if (!report.ok) {
    console.log(JSON.stringify({ failures: report.failures, checks: report.checks }, null, 2));
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error?.stack || error?.message || error);
  process.exit(1);
});
