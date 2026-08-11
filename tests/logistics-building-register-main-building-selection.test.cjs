'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..');
const EDGE_SOURCE = fs.readFileSync(
  path.join(ROOT, 'supabase', 'functions', 'll-dashboard-api', 'index.ts'),
  'utf8',
);

test('building-register title responses select the main building by total area', () => {
  assert.match(EDGE_SOURCE, /function buildingRegisterItems\(/u);
  assert.match(EDGE_SOURCE, /function buildingRegisterBestItem\(/u);
  assert.match(EDGE_SOURCE, /totArea/u);
  assert.match(EDGE_SOURCE, /vlRatEstmTotArea/u);
  assert.match(
    EDGE_SOURCE,
    /buildingRegisterSummaryFromItem\(buildingRegisterBestItem\(attemptBody\)\)/u,
  );
  assert.doesNotMatch(
    EDGE_SOURCE,
    /buildingRegisterSummaryFromItem\(buildingRegisterFirstItem\(body\)\)/u,
  );
});

test('building-register main-building selection is deterministic on equal areas', () => {
  assert.match(EDGE_SOURCE, /mgmBldrgstPk/u);
  assert.match(EDGE_SOURCE, /localeCompare/u);
});

test('building-register summary merges aggregate recap values with main-building details', () => {
  assert.match(EDGE_SOURCE, /recapSummary/u);
  assert.match(EDGE_SOURCE, /titleSummary/u);
  assert.match(EDGE_SOURCE, /\.\.\.titleSummary,\s*\.\.\.recapSummary/su);
  assert.doesNotMatch(
    EDGE_SOURCE,
    /if \(!providerOk \|\| Object\.keys\(summary\)\.length > 0\) break;/u,
  );
});
