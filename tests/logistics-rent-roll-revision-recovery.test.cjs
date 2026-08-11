'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..');
const source = fs.readFileSync(
  path.join(ROOT, 'src/features/logistics-data-platform/LogisticsDataPlatform.jsx'),
  'utf8',
);
const apiSource = fs.readFileSync(
  path.join(ROOT, 'src/features/logistics-data-platform/api.js'),
  'utf8',
);

function region(startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.ok(start >= 0 && end > start, `${startMarker} region missing`);
  return source.slice(start, end);
}

test('only the exact 409 REVISION_CONFLICT is eligible for canonical idempotent readback', () => {
  assert.match(apiSource, /export function isDataPlatformRevisionConflict/u);
  assert.match(apiSource, /status\s*!==\s*409/u);
  assert.match(apiSource, /trim\(\)\s*===\s*["']REVISION_CONFLICT["']/u);
  assert.doesNotMatch(apiSource, /includes\(["']REVISION_CONFLICT/u);
});

test('rent-roll conflict handling compares the entire intended document and never field-rebases or retries a mutation', () => {
  const rent = region('function RentRollPanel', 'function periodFor');
  assert.match(rent, /buildRentRollDocumentPayload\(rows,\s*\{\s*asOfDate:\s*todayKst\(\)\s*\}\)/u);
  assert.match(rent, /expected_xmin:\s*rentRevision/u);
  assert.match(rent, /isDataPlatformRevisionConflict\(cause\)[\s\S]{0,500}DATA_PLATFORM_ACTIONS\.rentRollRead/u);
  assert.match(rent, /documentsEqual\(intendedDocument,\s*serverDocument\)/u);
  assert.doesNotMatch(rent, /rebaseRentRollDraftRow|planRentRollRevisionRecovery|revisionRetryCount/u);
  assert.equal((rent.match(/DATA_PLATFORM_ACTIONS\.rentRollBatchSave/gu) || []).length, 1);
});

test('a divergent conflict stays dirty and draft cleanup occurs only after exact full readback', () => {
  const rent = region('function RentRollPanel', 'function periodFor');
  const conflictEquality = rent.indexOf('documentsEqual(intendedDocument, serverDocument)');
  const readbackEquality = rent.indexOf('documentsEqual(intendedDocument, readbackDocument)');
  const cleanup = rent.indexOf('sessionStorage?.removeItem(draftStorageKey)', readbackEquality);
  const catchIndex = rent.indexOf('setSaveState(isDataPlatformRevisionConflict(cause) ? "dirty" : "error")');
  assert.ok(conflictEquality >= 0 && readbackEquality > conflictEquality);
  assert.ok(cleanup > readbackEquality && catchIndex > cleanup);
  assert.match(rent, /if\s*\(!documentsEqual\(intendedDocument,\s*serverDocument\)\)\s*throw\s+cause/u);
  assert.match(rent, /RENT_ROLL_DOCUMENT_READBACK_MISMATCH/u);
});

test('home and finance use the same full-document conflict/readback rule', () => {
  const home = region('function HomePanel', 'function RentRollPanel');
  const finance = region('function FinancePanel', 'export default function LogisticsDataPlatform');
  assert.match(home, /documentsEqual\(homeDocument,\s*buildHomeDocumentPayload\(conflictReadback\.data\)\)/u);
  assert.match(home, /documentsEqual\(homeDocument,\s*readbackDocument\)/u);
  assert.match(finance, /documentsEqual\(documentPayload,\s*conflictPayload\)/u);
  assert.match(finance, /documentsEqual\(documentPayload,\s*readbackPayload\)/u);
});
