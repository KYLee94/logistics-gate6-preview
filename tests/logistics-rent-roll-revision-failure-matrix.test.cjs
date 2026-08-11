'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { pathToFileURL } = require('node:url');

const ROOT = path.resolve(__dirname, '..');
const API_PATH = path.join(ROOT, 'src/features/logistics-data-platform/api.js');
const source = fs.readFileSync(
  path.join(ROOT, 'src/features/logistics-data-platform/LogisticsDataPlatform.jsx'),
  'utf8',
);

class MemoryStorage {
  getItem() { return null; }
  setItem() {}
  removeItem() {}
}

global.window = {
  __SUPABASE_CLIENT__: {
    auth: {
      getSession: async () => ({ data: { session: null }, error: null }),
      refreshSession: async () => ({ data: { session: null }, error: null }),
    },
    functions: { invoke: async () => ({ data: null, error: null }) },
  },
  sessionStorage: new MemoryStorage(),
  localStorage: new MemoryStorage(),
  setTimeout,
  clearTimeout,
  dispatchEvent: () => true,
};

async function loadApi(label) {
  return import(`${pathToFileURL(API_PATH).href}?revision-failure=${label}-${Date.now()}-${Math.random()}`);
}

function region(startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.ok(start >= 0 && end > start, `${startMarker} region missing`);
  return source.slice(start, end);
}

function functionsHttpError(status, body) {
  const error = new Error('Edge Function returned a non-2xx status code');
  error.name = 'FunctionsHttpError';
  error.context = { status, clone: () => ({ json: async () => body }) };
  return error;
}

test('FunctionsHttpError preserves the exact revision conflict status, code, request id, and detail', async () => {
  const api = await loadApi('http');
  window.__SUPABASE_CLIENT__.functions.invoke = async () => ({
    data: null,
    error: functionsHttpError(409, {
      ok: false,
      status: 409,
      message: 'REVISION_CONFLICT',
      request_id: 'req-conflict-1',
      detail: { retryable: false },
    }),
  });
  await assert.rejects(
    api.invokeDataPlatform(api.DATA_PLATFORM_ACTIONS.rentRollBatchSave, { rows: [] }),
    (error) => error.status === 409
      && error.code === 'REVISION_CONFLICT'
      && error.requestId === 'req-conflict-1'
      && error.details?.retryable === false,
  );
});

test('near-match 409 codes and non-409 statuses fail closed', async () => {
  const api = await loadApi('boundary');
  for (const [status, code] of [
    [409, 'IDEMPOTENCY_CONFLICT'],
    [409, 'NOT_REVISION_CONFLICT'],
    [409, 'REVISION_CONFLICT_ARCHIVED'],
    [401, 'REVISION_CONFLICT'],
    [403, 'REVISION_CONFLICT'],
    [500, 'REVISION_CONFLICT'],
  ]) {
    const error = new api.DataPlatformResponseError(code, { status, code });
    assert.equal(api.isDataPlatformRevisionConflict(error), false, `${status}/${code}`);
  }
});

test('rent-roll never clears dirty state on conflict divergence, read failure, or readback mismatch', () => {
  const rent = region('function RentRollPanel', 'function periodFor');
  const catchBlock = rent.slice(rent.indexOf('} catch (cause) {', rent.indexOf('const saveRows')));
  assert.match(rent, /if\s*\(!documentsEqual\(intendedDocument,\s*serverDocument\)\)\s*throw\s+cause/u);
  assert.match(rent, /throw new Error\(["']RENT_ROLL_DOCUMENT_READBACK_MISMATCH["']\)/u);
  assert.match(catchBlock, /setError\(cause\)[\s\S]*setSaveState\(isDataPlatformRevisionConflict\(cause\)\s*\?\s*["']dirty["']\s*:\s*["']error["']\)[\s\S]*return false/u);
});

test('document CAS carries xmin and forbids removed component revision and delta recovery paths', () => {
  const rent = region('function RentRollPanel', 'function periodFor');
  const save = rent.slice(rent.indexOf('const saveRows'), rent.indexOf('const saveDirtyRows'));
  assert.match(rent, /expected_xmin:\s*rentRevision/u);
  assert.match(rent, /documentRevision:\s*rentRevision/u);
  assert.doesNotMatch(save, /expected_revisions|space_revision|contract_revision|allocation_revision|rent_term_revision/u);
  assert.doesNotMatch(rent, /rebaseRentRollDraftRow|rentRollRevisionConflictFields|planRentRollRevisionRecovery/u);
});
