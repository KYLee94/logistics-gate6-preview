#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const { createHash, randomUUID } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const root = path.resolve(__dirname, '..', '..');

function argValue(name, fallback = '') {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? fallback : (process.argv[index + 1] || fallback);
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

function rowIdentity(row) {
  return row?.space_key || row?.row_key || '';
}

function rowRef(assetKey, row) {
  return createHash('sha256').update(`${assetKey}|${rowIdentity(row)}`).digest('hex').slice(0, 16);
}

function revisions(row) {
  return {
    space_revision: row?.space_revision ?? null,
    contract_revision: row?.contract_revision ?? null,
    allocation_revision: row?.allocation_revision ?? null,
    rent_term_revision: row?.rent_term_revision ?? null,
    revision: row?.revision ?? null,
  };
}

async function main() {
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
  const email = envValue('LOGISTICS_SUPABASE_EMAIL', 'LOGISTICS_SUPABASE_AUTH_EMAIL');
  const password = envValue('LOGISTICS_SUPABASE_PASSWORD', 'LOGISTICS_SUPABASE_AUTH_PASSWORD');
  assert.ok(supabaseUrl && anonKey && email && password, 'Supabase QA credentials are missing');

  const auth = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: anonKey, 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const authBody = await auth.json();
  assert.equal(auth.status, 200, `Supabase Auth login failed: ${authBody?.message || auth.status}`);
  const token = authBody.access_token;

  const edge = async (action, payload = {}) => {
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
    const text = await response.text();
    let body;
    try { body = text ? JSON.parse(text) : null; } catch { body = { raw: text.slice(0, 500) }; }
    return { status: response.status, body };
  };

  const directSave = async (request) => {
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/rent_roll_batch_save`, {
      method: 'POST',
      headers: {
        apikey: anonKey,
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
        'content-profile': 'logistics_api',
        'accept-profile': 'logistics_api',
      },
      body: JSON.stringify({
        p_request_id: request.client_request_id,
        p_asset_key: request.asset_key,
        p_payload: request,
        p_expected_revisions: request.expected_revisions || {},
      }),
    });
    return { status: response.status, body: (await response.text()).slice(0, 1200) };
  };

  const requirePrimary = (result, action) => {
    assert.equal(result.status, 200, `${action} HTTP ${result.status}: ${JSON.stringify(result.body)}`);
    assert.equal(result.body?.ok, true, `${action} did not return ok:true`);
    assert.equal(result.body?.status, 'primary', `${action} did not return primary`);
    return result.body;
  };

  const schemaPath = path.join(root, 'src', 'features', 'logistics-data-platform', 'rentRollSchema.js');
  const schema = await import(`${pathToFileURL(schemaPath).href}?revision=${Date.now()}`);
  const home = requirePrimary(await edge('v2/home/read', {}), 'v2/home/read');
  let selected = null;
  for (const asset of (home.data.assets || []).filter((item) => item?.asset_key)) {
    const read = requirePrimary(await edge('v2/rent-roll/read', {
      asset_key: asset.asset_key,
      limit: 500,
    }), 'v2/rent-roll/read');
    const groups = new Map();
    for (const row of (read.data.rows || [])) {
      if (!row?.contract_key || !rowIdentity(row)) continue;
      const group = groups.get(row.contract_key) || [];
      group.push(row);
      groups.set(row.contract_key, group);
    }
    const sharedRows = [...groups.values()].find((rows) => rows.length >= 2);
    if (sharedRows) {
      selected = { asset, rows: sharedRows };
      break;
    }
  }
  assert.ok(selected, 'No readable asset has two rows sharing one contract');

  const [firstSnapshot, siblingSnapshot] = selected.rows;
  const buildRequest = (row) => ({
    asset_key: selected.asset.asset_key,
    client_request_id: randomUUID(),
    expected_revisions: schema.buildRentRollExpectedRevisions([row]),
    rows: [schema.buildRentRollSaveRow(row, ['rent_escalation_rate'])],
  });
  const summarizePayload = (request) => ({
    asset_key: request.asset_key,
    row_ref: rowRef(request.asset_key, request.rows[0]),
    expected_revisions: request.expected_revisions,
    component_revisions: revisions(request.rows[0]),
  });

  const firstRequest = buildRequest(firstSnapshot);
  const firstSave = await edge('v2/rent-roll/batch-save', firstRequest);
  requirePrimary(firstSave, 'first same-user save');
  const exactIdempotentReplay = await edge('v2/rent-roll/batch-save', firstRequest);
  requirePrimary(exactIdempotentReplay, 'exact idempotent replay');
  assert.equal(
    exactIdempotentReplay.body?.revision,
    firstSave.body?.revision,
    'exact idempotent replay must return the stored response revision',
  );

  const repeatedStaleRequest = buildRequest(firstSnapshot);
  const repeatedStaleEdge = await edge('v2/rent-roll/batch-save', repeatedStaleRequest);
  assert.equal(repeatedStaleEdge.status, 409, 'same-user stale retry must return 409');
  const repeatedStaleRpc = await directSave(repeatedStaleRequest);

  const afterFirstRead = requirePrimary(await edge('v2/rent-roll/read', {
    asset_key: selected.asset.asset_key,
    limit: 500,
  }), 'read after first save');
  const firstFresh = (afterFirstRead.data.rows || []).find((row) => rowIdentity(row) === rowIdentity(firstSnapshot));
  const siblingFresh = (afterFirstRead.data.rows || []).find((row) => rowIdentity(row) === rowIdentity(siblingSnapshot));
  assert.ok(firstFresh && siblingFresh, 'fresh rows missing after first save');

  const freshRequest = buildRequest(firstFresh);
  const freshSave = await edge('v2/rent-roll/batch-save', freshRequest);
  requirePrimary(freshSave, 'fresh-read save');

  const staleSiblingRequest = buildRequest(siblingSnapshot);
  const staleSiblingEdge = await edge('v2/rent-roll/batch-save', staleSiblingRequest);
  assert.equal(staleSiblingEdge.status, 409, 'shared-contract stale sibling must return 409');
  const staleSiblingRpc = await directSave(staleSiblingRequest);

  const finalRead = requirePrimary(await edge('v2/rent-roll/read', {
    asset_key: selected.asset.asset_key,
    limit: 500,
  }), 'final read');
  const siblingFinal = (finalRead.data.rows || []).find((row) => rowIdentity(row) === rowIdentity(siblingSnapshot));
  assert.ok(siblingFinal, 'final sibling row missing');
  const finalFreshRequest = buildRequest(siblingFinal);
  const finalFreshSave = await edge('v2/rent-roll/batch-save', finalFreshRequest);
  requirePrimary(finalFreshSave, 'fresh sibling save');

  const preBatchRead = requirePrimary(await edge('v2/rent-roll/read', {
    asset_key: selected.asset.asset_key,
    limit: 500,
  }), 'pre shared-contract batch read');
  const preBatchFirst = (preBatchRead.data.rows || [])
    .find((row) => rowIdentity(row) === rowIdentity(firstSnapshot));
  const preBatchSibling = (preBatchRead.data.rows || [])
    .find((row) => rowIdentity(row) === rowIdentity(siblingSnapshot));
  assert.ok(preBatchFirst && preBatchSibling, 'pre-batch shared rows missing');
  assert.equal(
    preBatchFirst.contract_revision,
    preBatchSibling.contract_revision,
    'shared-contract rows must start from one contract revision',
  );
  const sharedBatchRequest = {
    asset_key: selected.asset.asset_key,
    client_request_id: randomUUID(),
    expected_revisions: schema.buildRentRollExpectedRevisions([preBatchFirst, preBatchSibling]),
    rows: [
      schema.buildRentRollSaveRow(preBatchFirst, ['rent_escalation_rate']),
      schema.buildRentRollSaveRow(preBatchSibling, ['rent_escalation_rate']),
    ],
  };
  const sharedBatchSave = await edge('v2/rent-roll/batch-save', sharedBatchRequest);
  const sharedBatchDirectRpc = sharedBatchSave.status === 200
    ? null
    : await directSave(sharedBatchRequest);
  requirePrimary(sharedBatchSave, 'shared-contract two-row batch');
  const postBatchRead = requirePrimary(await edge('v2/rent-roll/read', {
    asset_key: selected.asset.asset_key,
    limit: 500,
  }), 'post shared-contract batch read');
  const postBatchFirst = (postBatchRead.data.rows || [])
    .find((row) => rowIdentity(row) === rowIdentity(firstSnapshot));
  const postBatchSibling = (postBatchRead.data.rows || [])
    .find((row) => rowIdentity(row) === rowIdentity(siblingSnapshot));
  assert.ok(postBatchFirst && postBatchSibling, 'post-batch shared rows missing');

  process.stdout.write(`${JSON.stringify({
    ok: true,
    asset_key: selected.asset.asset_key,
    shared_contract_row_count: selected.rows.length,
    first_row_ref: rowRef(selected.asset.asset_key, firstSnapshot),
    sibling_row_ref: rowRef(selected.asset.asset_key, siblingSnapshot),
    initial_first_revisions: revisions(firstSnapshot),
    after_first_first_revisions: revisions(firstFresh),
    initial_sibling_revisions: revisions(siblingSnapshot),
    after_first_sibling_revisions: revisions(siblingFresh),
    exact_idempotent_replay: {
      request_id_reused: true,
      first_status: firstSave.status,
      replay_status: exactIdempotentReplay.status,
      first_response_revision: firstSave.body?.revision ?? null,
      replay_response_revision: exactIdempotentReplay.body?.revision ?? null,
    },
    repeated_same_user_stale: {
      request: summarizePayload(repeatedStaleRequest),
      edge: repeatedStaleEdge,
      direct_rpc: repeatedStaleRpc,
    },
    shared_contract_stale_sibling: {
      request: summarizePayload(staleSiblingRequest),
      edge: staleSiblingEdge,
      direct_rpc: staleSiblingRpc,
    },
    fresh_read_saves: {
      first: { status: freshSave.status, response_revision: freshSave.body?.revision ?? null },
      sibling: { status: finalFreshSave.status, response_revision: finalFreshSave.body?.revision ?? null },
    },
    shared_contract_two_row_batch: {
      status: sharedBatchSave.status,
      direct_rpc: sharedBatchDirectRpc,
      response_revision: sharedBatchSave.body?.revision ?? null,
      before: {
        first: revisions(preBatchFirst),
        sibling: revisions(preBatchSibling),
      },
      after: {
        first: revisions(postBatchFirst),
        sibling: revisions(postBatchSibling),
      },
      no_op_revision_increased: {
        first_space: postBatchFirst.space_revision > preBatchFirst.space_revision,
        sibling_space: postBatchSibling.space_revision > preBatchSibling.space_revision,
        shared_contract: postBatchFirst.contract_revision > preBatchFirst.contract_revision,
        first_allocation: postBatchFirst.allocation_revision > preBatchFirst.allocation_revision,
        sibling_allocation: postBatchSibling.allocation_revision > preBatchSibling.allocation_revision,
        first_rent_term: postBatchFirst.rent_term_revision > preBatchFirst.rent_term_revision,
        sibling_rent_term: postBatchSibling.rent_term_revision > preBatchSibling.rent_term_revision,
      },
    },
  }, null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${JSON.stringify({ ok: false, error: error.message }, null, 2)}\n`);
  process.exit(1);
});
