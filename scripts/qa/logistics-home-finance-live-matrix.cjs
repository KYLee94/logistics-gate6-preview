#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');

const ROOT = path.resolve(__dirname, '..', '..');

const HOME_ENTITY_MATRIX = Object.freeze([
  Object.freeze({
    entity: 'asset', collection: 'asset', key: 'asset_key',
    fields: Object.freeze(['name', 'address', 'zoning_text', 'land_area_sqm', 'building_area_sqm', 'gross_area_sqm', 'leasable_area_sqm', 'primary_use', 'building_coverage_ratio', 'floor_area_ratio', 'floor_count', 'structure_text', 'parking_count', 'completion_date']),
  }),
  Object.freeze({
    entity: 'fund', collection: 'funds', key: 'fund_key',
    fields: Object.freeze(['name', 'fund_type', 'investment_strategy', 'inception_date', 'maturity_date', 'ownership_ratio']),
  }),
  Object.freeze({
    entity: 'beneficiary', collection: 'investments', key: 'beneficiary_key',
    fields: Object.freeze(['tranche', 'beneficiary_name', 'agreed_amount_krw', 'contributed_amount_krw']),
  }),
  Object.freeze({
    entity: 'loan', collection: 'loans', key: 'loan_key',
    fields: Object.freeze(['tranche', 'lender_name', 'committed_amount_krw', 'drawdown_date', 'maturity_date', 'loan_type', 'interest_type', 'coupon_rate', 'all_in_rate', 'fee_rate']),
  }),
]);
const REQUIRED_DEFAULT_FINANCE_CODES = Object.freeze([
  'INTEREST_PAID',
  'TENANT_IMPROVEMENT',
  'LEASING_COMMISSION',
  'AMC_FEE',
  'CUSTODY_FEE',
  'GENERAL_ADMIN_TRUSTEE_FEE',
]);

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

function rowsForEntity(data, config) {
  if (config.collection === 'asset') return data?.asset ? [data.asset] : [];
  return Array.isArray(data?.[config.collection]) ? data[config.collection] : [];
}

function entityKey(row, config) {
  return row?.[config.key] || (config.entity === 'loan' ? row?.row_key : '') || '';
}

function sameValue(value) {
  if (value === undefined || value === null || value === '') return null;
  return JSON.parse(JSON.stringify(value));
}

function expectedRevision(row, entity, field) {
  if (entity === 'fund') {
    return field === 'ownership_ratio'
      ? row.link_revision ?? row.revision
      : row.fund_revision ?? row.revision;
  }
  if (entity === 'loan') {
    return field === 'lender_name'
      ? row.lender_revision ?? row.revision
      : row.loan_revision ?? row.revision;
  }
  return row.revision;
}

function buildHomeSameValueOperations(data) {
  return HOME_ENTITY_MATRIX.flatMap((config) => rowsForEntity(data, config).flatMap((row) => {
    const key = entityKey(row, config);
    assert.ok(key, `HOME_ENTITY_KEY_MISSING:${config.entity}`);
    return config.fields.map((field) => ({
      entity: config.entity,
      entity_key: key,
      field,
      value: sameValue(row[field]),
      expected_revision: expectedRevision(row, config.entity, field),
      reason: 'qa_live_same_value_readback_validation',
    }));
  }));
}

function compareHomeReadback(expected, actual) {
  const mismatches = [];
  for (const config of HOME_ENTITY_MATRIX) {
    const actualByKey = new Map(rowsForEntity(actual, config).map((row) => [entityKey(row, config), row]));
    for (const expectedRow of rowsForEntity(expected, config)) {
      const key = entityKey(expectedRow, config);
      const actualRow = actualByKey.get(key);
      if (!actualRow) {
        mismatches.push({ entity: config.entity, entity_key: key, field: '*', error: 'READBACK_ROW_MISSING' });
        continue;
      }
      for (const field of config.fields) {
        const before = sameValue(expectedRow[field]);
        const after = sameValue(actualRow[field]);
        try {
          assert.deepEqual(after, before);
        } catch {
          mismatches.push({ entity: config.entity, entity_key: key, field, expected: before, actual: after });
        }
      }
    }
  }
  return mismatches;
}

function optionalFiniteNumber(value) {
  if (value === '' || value === null || value === undefined) return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function validateHomeProjection(data) {
  const errors = [];
  const summary = data?.tenant_summary || data?.occupancy_summary;
  const provenance = data?.asset_source_provenance;
  if (!summary || typeof summary !== 'object' || Array.isArray(summary)) {
    errors.push('HOME_OCCUPANCY_SUMMARY_MISSING');
  }
  if (!provenance || typeof provenance !== 'object' || Array.isArray(provenance)) {
    errors.push('HOME_ASSET_PROVENANCE_MISSING');
  }
  const occupiedArea = optionalFiniteNumber(summary?.occupied_area_sqm);
  const denominatorArea = optionalFiniteNumber(summary?.denominator_area_sqm);
  const occupancyRate = optionalFiniteNumber(summary?.occupancy_rate);
  if (occupancyRate != null) {
    if (occupiedArea == null || denominatorArea == null || denominatorArea <= 0) {
      errors.push('HOME_OCCUPANCY_COMPONENT_MISSING');
    } else {
      const expectedRate = Number(((occupiedArea / denominatorArea) * 100).toFixed(2));
      if (Math.abs(expectedRate - occupancyRate) > 0.01) {
        errors.push('HOME_OCCUPANCY_RATE_MISMATCH');
      }
    }
  }
  const buildingSourceFields = Object.entries(provenance || {})
    .filter(([, source]) => /building_register|buildingRegister/iu.test(String(source || '')))
    .map(([field]) => field);
  return {
    errors,
    occupied_area_sqm: occupiedArea,
    denominator_area_sqm: denominatorArea,
    denominator_source: summary?.denominator_source || null,
    occupancy_rate: occupancyRate,
    building_register_match: provenance?.building_register_match || null,
    building_source_fields: buildingSourceFields,
  };
}

function validateFinanceDefaults(accounts = []) {
  const byCode = new Map(accounts.map((account) => [account.account_code, account]));
  return REQUIRED_DEFAULT_FINANCE_CODES.flatMap((code) => {
    const account = byCode.get(code);
    if (!account) return [{ account_code: code, error: 'FINANCE_DEFAULT_ACCOUNT_MISSING' }];
    if (account.selected !== true) return [{ account_code: code, error: 'FINANCE_DEFAULT_ACCOUNT_NOT_SELECTED' }];
    return [];
  });
}

function buildFinanceSelectionOperations(accounts = []) {
  return accounts
    .filter((account) => (
      account?.account_code
      && account.account_kind !== 'derived'
      && account.manual_entry_allowed !== false
    ))
    .map((account) => ({
      operation: 'upsert',
      account_code: account.account_code,
      selected: account.selected === true,
      ...(account.selection_revision == null
        ? {}
        : { expected_revision: account.selection_revision }),
    }));
}

function buildEmptyFinanceSaveRequest(assetKey, clientRequestId = randomUUID()) {
  return {
    asset_key: assetKey,
    client_request_id: clientRequestId,
    expected_revisions: {},
    entries: [],
    account_operations: [],
    selection_operations: [],
  };
}

function compareFinanceSelections(expectedOperations, accounts) {
  const actualByCode = new Map((Array.isArray(accounts) ? accounts : [])
    .map((account) => [account.account_code, account]));
  return expectedOperations.flatMap((operation) => {
    const actual = actualByCode.get(operation.account_code);
    if (!actual) return [{ account_code: operation.account_code, error: 'ACCOUNT_READBACK_MISSING' }];
    return actual.selected === operation.selected
      ? []
      : [{ account_code: operation.account_code, expected: operation.selected, actual: actual.selected }];
  });
}

function createRuntime() {
  const envRoot = path.resolve(argValue('env-root', ROOT));
  const fileEnv = {
    ...readEnvFile(path.join(envRoot, '.env')),
    ...readEnvFile(path.join(envRoot, '.env.local')),
  };
  const envValue = (...names) => names
    .map((name) => process.env[name] || fileEnv[name] || '')
    .find(Boolean) || '';
  const supabaseUrl = envValue('LOGISTICS_SUPABASE_URL', 'VITE_SUPABASE_URL').replace(/\/$/u, '');
  const anonKey = envValue('LOGISTICS_SUPABASE_ANON_KEY', 'VITE_SUPABASE_ANON_KEY');
  const accessTokenFromEnv = envValue('LOGISTICS_SUPABASE_ACCESS_TOKEN');
  const authEmail = envValue('LOGISTICS_SUPABASE_EMAIL', 'LOGISTICS_SUPABASE_AUTH_EMAIL');
  const authPassword = envValue('LOGISTICS_SUPABASE_PASSWORD', 'LOGISTICS_SUPABASE_AUTH_PASSWORD');
  assert.ok(supabaseUrl && anonKey, 'Supabase URL/anon key is missing');

  async function accessToken() {
    if (accessTokenFromEnv) return { token: accessTokenFromEnv, source: 'access_token' };
    assert.ok(authEmail && authPassword, 'Supabase QA login credentials are missing');
    const response = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { apikey: anonKey, 'content-type': 'application/json' },
      body: JSON.stringify({ email: authEmail, password: authPassword }),
    });
    const body = await response.json().catch(() => ({}));
    assert.equal(response.status, 200, `Supabase Auth login failed: ${body.message || response.status}`);
    assert.ok(body.access_token, 'Supabase Auth response has no access token');
    return { token: body.access_token, source: 'password_grant' };
  }

  async function invoke(action, token, payload = {}) {
    const response = await fetch(`${supabaseUrl}/functions/v1/ll-dashboard-api`, {
      method: 'POST',
      headers: {
        apikey: anonKey,
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
        origin: 'https://kylee94.github.io',
      },
      body: JSON.stringify({ action, payload }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok || body?.ok !== true || body?.status !== 'primary') {
      const error = new Error(`${action} failed (${response.status}): ${body.message || body.error || 'unknown error'}`);
      error.evidence = { status: response.status, body };
      throw error;
    }
    assert.ok(body.request_id, `${action} request_id is missing`);
    assert.ok(Object.prototype.hasOwnProperty.call(body, 'revision'), `${action} revision is missing`);
    return body;
  }

  return { accessToken, invoke };
}

const FINANCE_DIMENSIONS = Object.freeze([
  ['actual', 'accrual'], ['actual', 'cash'],
  ['budget', 'accrual'], ['budget', 'cash'],
  ['forecast', 'accrual'], ['forecast', 'cash'],
]);

async function readFinanceDimensions(invoke, token, assetKey) {
  const dimensions = [];
  for (const [scenario, accountingBasis] of FINANCE_DIMENSIONS) {
    const response = await invoke('v2/finance/read', token, {
      asset_key: assetKey,
      start_month: '2000-01',
      end_month: '2100-12',
      scenario,
      accounting_basis: accountingBasis,
    });
    dimensions.push({
      scenario,
      accounting_basis: accountingBasis,
      entries: Array.isArray(response.data?.entries) ? response.data.entries : [],
      accounts: Array.isArray(response.data?.accounts) ? response.data.accounts : [],
      write_enabled: response.data?.write_enabled === true,
    });
  }
  return dimensions;
}

async function main() {
  const execute = hasArg('execute-safe-noop');
  const confirmed = hasArg('confirm-live-same-value-writes');
  if (execute && !confirmed) {
    throw new Error('--execute-safe-noop requires --confirm-live-same-value-writes');
  }
  if (!execute && confirmed) {
    throw new Error('--confirm-live-same-value-writes requires --execute-safe-noop');
  }

  assert.deepEqual(HOME_ENTITY_MATRIX.map((entry) => entry.fields.length), [14, 6, 4, 10]);
  const runtime = createRuntime();
  const auth = await runtime.accessToken();
  const bootstrap = await runtime.invoke('v2/home/read', auth.token, {});
  const assets = (Array.isArray(bootstrap.data?.assets) ? bootstrap.data.assets : [])
    .filter((asset) => asset?.asset_key);
  assert.ok(assets.length, 'No readable assets were returned');
  const requestedAssetKey = argValue('asset-key');
  const requestedAssetName = argValue('asset-name');
  const targets = requestedAssetKey
    ? assets.filter((asset) => asset.asset_key === requestedAssetKey)
    : requestedAssetName
      ? assets.filter((asset) => asset.name === requestedAssetName)
      : assets;
  assert.ok(
    targets.length,
    `Readable asset not found: ${requestedAssetKey || requestedAssetName}`,
  );

  const results = [];
  for (const asset of targets) {
    const homeBefore = await runtime.invoke('v2/home/read', auth.token, { asset_key: asset.asset_key });
    const requestedHomeEntity = argValue('home-entity');
    const requestedHomeField = argValue('home-field');
    const homeOperations = buildHomeSameValueOperations(homeBefore.data)
      .filter((operation) => !requestedHomeEntity || operation.entity === requestedHomeEntity)
      .filter((operation) => !requestedHomeField || operation.field === requestedHomeField);
    const invalidRevisions = homeOperations.filter((operation) => (
      !Number.isInteger(Number(operation.expected_revision)) || Number(operation.expected_revision) < 1
    ));
    assert.deepEqual(invalidRevisions, [], `Home field revision missing: ${asset.asset_key}`);
    const homeCounts = Object.fromEntries(HOME_ENTITY_MATRIX.map((config) => [
      config.entity,
      rowsForEntity(homeBefore.data, config).length * config.fields.length,
    ]));
    const homeProjection = validateHomeProjection(homeBefore.data);

    const financeBefore = await readFinanceDimensions(runtime.invoke, auth.token, asset.asset_key);
    const ledgerBeforeCount = financeBefore.reduce((sum, dimension) => sum + dimension.entries.length, 0);
    assert.equal(ledgerBeforeCount, 0, `Existing finance ledger is not empty: ${asset.asset_key}`);
    const accounts = financeBefore[0]?.accounts || [];
    const selectionOperations = buildFinanceSelectionOperations(accounts);
    const financeDefaultErrors = validateFinanceDefaults(accounts);

    const assetResult = {
      asset_key: asset.asset_key,
      asset_name: asset.name || null,
      mode: execute ? 'live-same-value-write-readback' : 'read-only-matrix',
      home: {
        operation_count: homeOperations.length,
        field_cells_by_entity: homeCounts,
        projection: homeProjection,
        mismatches: [],
      },
      finance: {
        selectable_account_count: selectionOperations.length,
        required_default_account_errors: financeDefaultErrors,
        dimensions_checked: financeBefore.length,
        ledger_before_count: ledgerBeforeCount,
        ledger_after_count: ledgerBeforeCount,
        ledger_write_operation_count: 0,
        selection_response_mismatches: [],
        selection_readback_mismatches: [],
        empty_save_verified: false,
      },
      ok: homeProjection.errors.length === 0 && financeDefaultErrors.length === 0,
    };

    if (execute) {
      assert.equal(homeBefore.data?.write_enabled, true, `Home write is not enabled: ${asset.asset_key}`);
      assert.equal(financeBefore.every((dimension) => dimension.write_enabled), true, `Finance write is not enabled: ${asset.asset_key}`);

      try {
        await runtime.invoke('v2/home/batch-save', auth.token, {
          asset_key: asset.asset_key,
          client_request_id: randomUUID(),
          operations: homeOperations,
        });
      } catch (error) {
        error.evidence = {
          asset_key: asset.asset_key,
          asset_name: asset.name || null,
          operations: homeOperations.map((operation) => ({
            entity: operation.entity,
            entity_key: operation.entity_key,
            field: operation.field,
            expected_revision: operation.expected_revision,
          })),
          cause: error.evidence || null,
        };
        throw error;
      }
      const homeAfter = await runtime.invoke('v2/home/read', auth.token, { asset_key: asset.asset_key });
      assetResult.home.mismatches = compareHomeReadback(homeBefore.data, homeAfter.data);

      const selectionSave = await runtime.invoke('v2/finance/batch-save', auth.token, {
        asset_key: asset.asset_key,
        client_request_id: randomUUID(),
        expected_revisions: {},
        entries: [],
        account_operations: [],
        selection_operations: selectionOperations,
      });
      assetResult.finance.selection_response_mismatches = compareFinanceSelections(
        selectionOperations,
        selectionSave.data?.accounts_readback,
      );
      const financeAfterSelection = await runtime.invoke('v2/finance/read', auth.token, {
        asset_key: asset.asset_key,
        start_month: '2000-01',
        end_month: '2100-12',
        scenario: 'actual',
        accounting_basis: 'accrual',
      });
      assetResult.finance.selection_readback_mismatches = compareFinanceSelections(
        selectionOperations,
        financeAfterSelection.data?.accounts,
      );

      await runtime.invoke('v2/finance/batch-save', auth.token, buildEmptyFinanceSaveRequest(asset.asset_key));
      const financeAfter = await readFinanceDimensions(runtime.invoke, auth.token, asset.asset_key);
      assetResult.finance.ledger_after_count = financeAfter
        .reduce((sum, dimension) => sum + dimension.entries.length, 0);
      assetResult.finance.empty_save_verified = assetResult.finance.ledger_after_count === 0;
      assetResult.ok = assetResult.home.mismatches.length === 0
        && assetResult.home.projection.errors.length === 0
        && assetResult.finance.required_default_account_errors.length === 0
        && assetResult.finance.selection_response_mismatches.length === 0
        && assetResult.finance.selection_readback_mismatches.length === 0
        && assetResult.finance.empty_save_verified;
    }
    results.push(assetResult);
    if (hasArg('stop-on-failure') && !assetResult.ok) break;
  }

  const buildingMergeEvidenceCount = results.reduce(
    (sum, result) => sum
      + result.home.projection.building_source_fields.length
      + (result.home.projection.building_register_match ? 1 : 0),
    0,
  );
  const report = {
    ok: results.every((result) => result.ok) && buildingMergeEvidenceCount > 0,
    generated_at: new Date().toISOString(),
    auth_source: auth.source,
    mode: execute ? 'live-same-value-write-readback' : 'read-only-matrix',
    readable_asset_count: assets.length,
    checked_asset_count: results.length,
    home_contract_fields: Object.fromEntries(HOME_ENTITY_MATRIX.map((entry) => [entry.entity, entry.fields.length])),
    required_default_finance_codes: REQUIRED_DEFAULT_FINANCE_CODES,
    building_merge_evidence_count: buildingMergeEvidenceCount,
    ledger_write_operation_count: 0,
    assets: results,
  };
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (!report.ok) process.exitCode = 1;
}

module.exports = {
  HOME_ENTITY_MATRIX,
  REQUIRED_DEFAULT_FINANCE_CODES,
  buildEmptyFinanceSaveRequest,
  buildFinanceSelectionOperations,
  buildHomeSameValueOperations,
  compareFinanceSelections,
  compareHomeReadback,
  validateFinanceDefaults,
  validateHomeProjection,
};

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write(`${JSON.stringify({ ok: false, error: error.message, evidence: error.evidence || null }, null, 2)}\n`);
    process.exit(1);
  });
}
