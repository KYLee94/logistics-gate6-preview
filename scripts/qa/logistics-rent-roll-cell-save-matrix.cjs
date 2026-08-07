#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { pathToFileURL } = require('node:url');

const root = path.resolve(__dirname, '..', '..');

function argValue(name, fallback = '') {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? fallback : (process.argv[index + 1] || fallback);
}

function hasArg(name) {
  return process.argv.includes(`--${name}`);
}

function readEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  return Object.fromEntries(fs.readFileSync(filePath, 'utf8')
    .split(/\r?\n/gu)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#') && line.includes('='))
    .map((line) => {
      const separator = line.indexOf('=');
      return [
        line.slice(0, separator).trim(),
        line.slice(separator + 1).trim().replace(/^['"]|['"]$/gu, ''),
      ];
    }));
}

const envRoot = path.resolve(argValue('env-root', root));
const fileEnv = {
  ...readEnvFile(path.join(envRoot, '.env')),
  ...readEnvFile(path.join(envRoot, '.env.local')),
};
const envValue = (...names) => names
  .map((name) => process.env[name] || fileEnv[name] || '')
  .find(Boolean) || '';

const supabaseUrl = envValue('LOGISTICS_SUPABASE_URL', 'VITE_SUPABASE_URL').replace(/\/$/u, '');
const anonKey = envValue('LOGISTICS_SUPABASE_ANON_KEY', 'VITE_SUPABASE_ANON_KEY');
const authEmail = envValue('LOGISTICS_SUPABASE_EMAIL', 'LOGISTICS_SUPABASE_AUTH_EMAIL');
const authPassword = envValue('LOGISTICS_SUPABASE_PASSWORD', 'LOGISTICS_SUPABASE_AUTH_PASSWORD');
const accessTokenFromEnv = envValue('LOGISTICS_SUPABASE_ACCESS_TOKEN');

async function accessToken() {
  if (accessTokenFromEnv) return accessTokenFromEnv;
  assert.ok(authEmail && authPassword, 'Supabase QA login credentials are missing');
  const response = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: anonKey, 'content-type': 'application/json' },
    body: JSON.stringify({ email: authEmail, password: authPassword }),
  });
  const body = await response.json();
  assert.equal(response.status, 200, `Supabase Auth login failed: ${body?.message || response.status}`);
  return body.access_token;
}

async function directRpcDiagnostic(action, token, request) {
  const rpcName = action === 'v2/rent-roll/batch-save' ? 'rent_roll_batch_save' : 'rent_roll_read';
  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/${rpcName}`, {
    method: 'POST',
    headers: {
      apikey: anonKey,
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      'content-profile': 'logistics_api',
      'accept-profile': 'logistics_api',
    },
    body: JSON.stringify({
      p_request_id: request.client_request_id || randomUUID(),
      p_asset_key: request.asset_key || null,
      p_payload: request,
      p_expected_revisions: request.expected_revisions || {},
    }),
  });
  return { status: response.status, body: (await response.text()).slice(0, 1200) };
}

async function invoke(action, token, request = {}) {
  const response = await fetch(`${supabaseUrl}/functions/v1/ll-dashboard-api`, {
    method: 'POST',
    headers: {
      apikey: anonKey,
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      origin: 'https://kylee94.github.io',
    },
    body: JSON.stringify({ action, payload: request }),
  });
  const text = await response.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = { raw: text.slice(0, 500) }; }
  if (response.status !== 200 || body?.ok !== true || body?.status !== 'primary') {
    const diagnostic = hasArg('direct-rpc-diagnostic')
      ? await directRpcDiagnostic(action, token, request)
      : null;
    const error = new Error(`${action} failed`);
    error.evidence = {
      edge_status: response.status,
      edge_body: body,
      direct_rpc: diagnostic,
    };
    throw error;
  }
  return body;
}

function sameValue(value) {
  if (value === undefined) return null;
  return JSON.parse(JSON.stringify(value));
}

function rowIdentity(row) {
  return row?.row_key || row?.space_key || '';
}

function buildExpectedReadback(schema, source, payload) {
  const patch = Object.fromEntries([
    ...schema.RENT_ROLL_EDITABLE_FIELDS,
    'rent_free_periods',
    'fit_out_start_date',
    'fit_out_end_date',
  ].filter((field) => Object.prototype.hasOwnProperty.call(payload, field))
    .map((field) => [field, sameValue(payload[field])]));
  return schema.deriveRentRollRow({ ...source, ...patch });
}

function compareReadbackFields(expected, actual, fields) {
  return fields.flatMap((field) => {
    const expectedValue = sameValue(expected[field]);
    const actualValue = sameValue(actual[field]);
    try {
      assert.deepEqual(actualValue, expectedValue);
      return [];
    } catch {
      return [{ field, expected: expectedValue, actual: actualValue }];
    }
  });
}

function rentFreeBusinessValues(periods) {
  return (Array.isArray(periods) ? periods : []).map((period) => ({
    start_date: period?.start_date ?? null,
    end_date: period?.end_date ?? null,
    months: period?.months ?? null,
    reason: period?.reason ?? null,
    notes: period?.notes ?? null,
  }));
}

async function runAllAssetsAllFields({ schema, token, assets, execute }) {
  const editableFields = [...schema.RENT_ROLL_EDITABLE_FIELDS];
  const derivedFields = [...schema.RENT_ROLL_DERIVED_FIELDS];
  const comparisonFields = [...editableFields, ...derivedFields];
  assert.equal(editableFields.length, 43, 'Editable rent-roll field contract drifted');
  assert.equal(derivedFields.length, 12, 'Derived rent-roll field contract drifted');
  assert.equal(comparisonFields.length, 55, 'Rent-roll readback field contract drifted');

  const assetResults = [];
  let totalRows = 0;
  let comparedCells = 0;
  let comparedRentFreePeriods = 0;
  for (const asset of assets) {
    let rentRoll = await invoke('v2/rent-roll/read', token, { asset_key: asset.asset_key, limit: 500 });
    const identities = (rentRoll.data.rows || []).map(rowIdentity).filter(Boolean);
    totalRows += identities.length;
    const rowResults = [];
    for (const identity of identities) {
      const row = (rentRoll.data.rows || []).find((candidate) => rowIdentity(candidate) === identity);
      assert.ok(row, `Current revision row missing before save: ${asset.asset_key}/${identity}`);
      const extraFields = ['fit_out_start_date', 'fit_out_end_date']
        .filter((field) => Object.prototype.hasOwnProperty.call(row, field));
      const hasRentFreePeriods = Object.prototype.hasOwnProperty.call(row, 'rent_free_periods');
      const changedFields = [
        ...editableFields,
        ...extraFields,
        ...(hasRentFreePeriods ? ['rent_free_periods'] : []),
      ];
      const payloadRow = schema.buildRentRollSaveRow(row, changedFields);
      assert.equal(payloadRow.operation, 'update', `Existing row must use update: ${identity}`);
      for (const field of editableFields) {
        assert.equal(
          Object.prototype.hasOwnProperty.call(payloadRow, field),
          true,
          `Editable field missing from payload (including null contract): ${identity}/${field}`,
        );
      }
      const expected = buildExpectedReadback(schema, row, payloadRow);
      const request = {
        asset_key: asset.asset_key,
        client_request_id: randomUUID(),
        expected_revisions: schema.buildRentRollExpectedRevisions([row]),
        rows: [payloadRow],
      };
      if (!execute) {
        rowResults.push({ row_key: identity, mode: 'dry-run', payload_field_count: Object.keys(payloadRow).length });
        continue;
      }

      try {
        const save = await invoke('v2/rent-roll/batch-save', token, request);
        rentRoll = await invoke('v2/rent-roll/read', token, { asset_key: asset.asset_key, limit: 500 });
        const readback = (rentRoll.data.rows || []).find((candidate) => rowIdentity(candidate) === identity);
        assert.ok(readback, `Readback row missing: ${asset.asset_key}/${identity}`);
        const derivedReadback = schema.deriveRentRollRow(readback);
        const editablePayload = Object.fromEntries([
          'operation',
          'row_key',
          'space_key',
          ...editableFields,
        ].filter((field) => Object.prototype.hasOwnProperty.call(payloadRow, field))
          .map((field) => [field, payloadRow[field]]));
        const mismatches = [
          ...schema.rentRollReadbackMismatches([editablePayload], [readback]),
          ...compareReadbackFields(expected, derivedReadback, derivedFields),
        ];
        comparedCells += comparisonFields.length;
        let rentFreePeriodsMatch = null;
        if (hasRentFreePeriods) {
          comparedRentFreePeriods += 1;
          rentFreePeriodsMatch = compareReadbackFields(
            { rent_free_periods: rentFreeBusinessValues(expected.rent_free_periods) },
            { rent_free_periods: rentFreeBusinessValues(readback.rent_free_periods) },
            ['rent_free_periods'],
          ).length === 0;
          if (!rentFreePeriodsMatch) {
            mismatches.push({
              field: 'rent_free_periods',
              expected: sameValue(expected.rent_free_periods),
              actual: sameValue(readback.rent_free_periods),
            });
          }
        }
        rowResults.push({
          row_key: identity,
          ok: mismatches.length === 0,
          compared_cells: comparisonFields.length,
          rent_free_periods_compared: hasRentFreePeriods,
          response_revision: save.revision,
          readback_revision: readback.space_revision ?? readback.revision ?? null,
          mismatches,
        });
      } catch (error) {
        rowResults.push({
          row_key: identity,
          ok: false,
          payload_identity: {
            space_key: payloadRow.space_key ?? null,
            contract_key: payloadRow.contract_key ?? null,
            contract_space_key: payloadRow.contract_space_key ?? null,
            rent_term_key: payloadRow.rent_term_key ?? null,
            occupancy_status: payloadRow.occupancy_status ?? null,
            fit_out_start_date: payloadRow.fit_out_start_date ?? null,
            fit_out_end_date: payloadRow.fit_out_end_date ?? null,
            rent_free_period_count: Array.isArray(payloadRow.rent_free_periods)
              ? payloadRow.rent_free_periods.length
              : null,
          },
          evidence: error.evidence || error.message,
        });
        if (hasArg('stop-on-failure')) break;
      }
    }
    assetResults.push({
      asset_key: asset.asset_key,
      asset_name: asset.name,
      rows: rowResults,
      ok: rowResults.every((result) => result.ok !== false),
    });
    if (hasArg('stop-on-failure') && assetResults.at(-1).ok === false) break;
  }
  return {
    ok: assetResults.every((result) => result.ok),
    mode: execute ? 'all-assets-all-fields-safe-noop-live-matrix' : 'all-assets-all-fields-dry-run',
    asset_count: assets.length,
    row_count: totalRows,
    compared_cells: comparedCells,
    compared_rent_free_period_rows: comparedRentFreePeriods,
    expected_editable_fields_per_row: editableFields.length,
    expected_derived_fields_per_row: derivedFields.length,
    asset_results: assetResults,
  };
}

async function main() {
  assert.ok(supabaseUrl && anonKey, 'Supabase URL/anon key is missing');
  const schemaPath = path.join(root, 'src/features/logistics-data-platform/rentRollSchema.js');
  const schema = await import(`${pathToFileURL(schemaPath).href}?matrix=${Date.now()}`);
  const token = await accessToken();
  const home = await invoke('v2/home/read', token, {});
  const readableAssets = (home.data.assets || []).filter((asset) => asset?.asset_key);
  const execute = hasArg('execute-safe-noop');
  if (hasArg('all-assets') && hasArg('all-fields')) {
    assert.equal(readableAssets.length, 19, 'Readable asset count drifted from the release baseline');
    const evidence = await runAllAssetsAllFields({
      schema,
      token,
      assets: readableAssets,
      execute,
    });
    if (execute) {
      evidence.baseline_checks = {
        expected_row_count: 81,
        actual_row_count: evidence.row_count,
        expected_compared_cells: 81 * 55,
        actual_compared_cells: evidence.compared_cells,
      };
      evidence.ok = evidence.ok
        && evidence.row_count === evidence.baseline_checks.expected_row_count
        && evidence.compared_cells === evidence.baseline_checks.expected_compared_cells;
    }
    process.stdout.write(`${JSON.stringify(evidence, null, 2)}\n`);
    if (!evidence.ok) process.exitCode = 1;
    return;
  }
  const assetName = argValue('asset-name', '경산 쿠팡물류센터');
  const asset = readableAssets.find((candidate) => candidate.name === assetName);
  assert.ok(asset?.asset_key, `Readable asset not found: ${assetName}`);
  const assetKey = asset.asset_key;
  const requestedFields = argValue('fields', 'tenant_name')
    .split(',').map((field) => field.trim()).filter(Boolean);
  const results = [];
  let rentRoll = await invoke('v2/rent-roll/read', token, { asset_key: assetKey, limit: 500 });
  let row = (rentRoll.data.rows || []).find((candidate) => candidate.row_key || candidate.space_key);
  assert.ok(row, 'Existing rent-roll row is unavailable');

  for (const field of requestedFields) {
    assert.equal(
      schema.RENT_ROLL_COLUMNS.some((column) => column.key === field)
        || ['rent_free_periods', 'fit_out_start_date', 'fit_out_end_date'].includes(field),
      true,
      `Unknown rent-roll field: ${field}`,
    );
    const payloadRow = schema.buildRentRollSaveRow(row, [field]);
    assert.equal(payloadRow.operation, 'update', `Existing row must use update: ${field}`);
    const request = {
      asset_key: assetKey,
      client_request_id: randomUUID(),
      expected_revisions: schema.buildRentRollExpectedRevisions([row]),
      rows: [payloadRow],
    };
    if (!execute) {
      results.push({ field, mode: 'dry-run', operation: payloadRow.operation, payload_fields: Object.keys(payloadRow) });
      continue;
    }
    const before = sameValue(row[field]);
    try {
      const save = await invoke('v2/rent-roll/batch-save', token, request);
      rentRoll = await invoke('v2/rent-roll/read', token, { asset_key: assetKey, limit: 500 });
      const readback = (rentRoll.data.rows || []).find((candidate) => (
        (candidate.row_key || candidate.space_key) === (row.row_key || row.space_key)
      ));
      assert.ok(readback, `Readback row missing: ${field}`);
      const after = sameValue(readback[field]);
      assert.deepEqual(after, before, `Safe no-op changed ${field}`);
      results.push({
        field,
        ok: true,
        operation: payloadRow.operation,
        payload_fields: Object.keys(payloadRow),
        response_revision: save.revision,
        readback_revision: readback.space_revision ?? readback.revision ?? null,
      });
      row = readback;
    } catch (error) {
      results.push({
        field,
        ok: false,
        operation: payloadRow.operation,
        payload_identity: {
          space_key: payloadRow.space_key ?? null,
          contract_key: payloadRow.contract_key ?? null,
          contract_space_key: payloadRow.contract_space_key ?? null,
          rent_term_key: payloadRow.rent_term_key ?? null,
          occupancy_status: payloadRow.occupancy_status ?? null,
          fit_out_start_date: payloadRow.fit_out_start_date ?? null,
          fit_out_end_date: payloadRow.fit_out_end_date ?? null,
          rent_free_period_count: Array.isArray(payloadRow.rent_free_periods)
            ? payloadRow.rent_free_periods.length
            : null,
        },
        evidence: error.evidence || error.message,
      });
      if (hasArg('stop-on-failure')) break;
    }
  }

  process.stdout.write(`${JSON.stringify({
    ok: results.every((result) => result.ok !== false),
    mode: execute ? 'safe-noop-live-matrix' : 'dry-run',
    asset_key: assetKey,
    asset_name: assetName,
    results,
  }, null, 2)}\n`);
  if (results.some((result) => result.ok === false)) process.exitCode = 1;
}

main().catch((error) => {
  process.stderr.write(`${JSON.stringify({ ok: false, error: error.message, evidence: error.evidence || null }, null, 2)}\n`);
  process.exit(1);
});
