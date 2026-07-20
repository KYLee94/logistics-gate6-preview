const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..');
const EDGE_PATH = path.join(ROOT, 'supabase', 'functions', 'll-dashboard-api', 'index.ts');
const UI_PATH = path.join(ROOT, 'src', 'components', 'system', 'workspace', 'LogisticsSectorModules.jsx');

test('approval keeps an explicit null cell value instead of falling back to the request summary', () => {
  const source = fs.readFileSync(EDGE_PATH, 'utf8');
  const normalizeStart = source.indexOf('function normalizeEditCells');
  const normalizeEnd = source.indexOf('type NormalizedEditCell', normalizeStart);
  const normalizeBlock = source.slice(normalizeStart, normalizeEnd);

  assert.match(normalizeBlock, /Object\.prototype\.hasOwnProperty\.call\(cell, 'before_value'\)/u);
  assert.doesNotMatch(normalizeBlock, /beforeValue:\s*firstPresent\(cell\.before_value,\s*record\.before_value\)/u);
});

test('Data Management submit and view resolution keep an explicit requested null value', () => {
  const source = fs.readFileSync(EDGE_PATH, 'utf8');
  const inputStart = source.indexOf('function dataManagementTableCellInput');
  const inputEnd = source.indexOf('async function readDataManagementTableCellRow', inputStart);
  const inputBlock = source.slice(inputStart, inputEnd);
  const leaseStart = source.indexOf('async function dataManagementResolveLeaseViewEdit');
  const leaseEnd = source.indexOf('async function dataManagementResolveWorkbookViewEdit', leaseStart);
  const leaseBlock = source.slice(leaseStart, leaseEnd);

  assert.match(inputBlock, /firstOwnValue\(payload, \['requested_value', 'requestedValue', 'after_value', 'afterValue'\]\)/u);
  assert.match(leaseBlock, /dataManagementParseViewRequestedValue\(firstOwnValue\(payload, \['requested_value', 'requestedValue', 'after_value', 'afterValue'\]\), field\)/u);
});

test('legacy single-cell requests keep explicit zero, false, and empty values', () => {
  const source = fs.readFileSync(EDGE_PATH, 'utf8');
  const submitStart = source.indexOf('async function submitEdit');
  const submitEnd = source.indexOf('function publicEditCell', submitStart);
  const submitBlock = source.slice(submitStart, submitEnd);

  assert.match(submitBlock, /before_value:\s*firstOwnValue\(payload, \['before_value', 'beforeValue'\]\) \?\? null/u);
  assert.match(submitBlock, /requested_value:\s*firstOwnValue\(payload, \['requested_value', 'requestedValue'\]\) \?\? null/u);
  assert.doesNotMatch(submitBlock, /before_value:\s*payload\.before_value \|\| null/u);
  assert.doesNotMatch(submitBlock, /requested_value:\s*payload\.requested_value \|\| null/u);
});

test('completed, running, rejected, or failed requests cannot be classified as pending', () => {
  const source = fs.readFileSync(EDGE_PATH, 'utf8');
  const pendingStart = source.indexOf('function isEditRequestPendingStatus');
  const pendingEnd = source.indexOf('function isEditRequestRunningStatus', pendingStart);
  const pendingBlock = source.slice(pendingStart, pendingEnd);

  assert.match(pendingBlock, /isEditRequestRunningStatus\(status, writeStatus\)/u);
  assert.match(pendingBlock, /isEditRequestCompletedStatus\(status, writeStatus\)/u);
  assert.match(pendingBlock, /isEditRequestFailedStatus\(status, writeStatus, null\)/u);
  assert.match(pendingBlock, /status === 'rejected'/u);
});

test('approval status fetches every pending request separately from recent history', () => {
  const source = fs.readFileSync(EDGE_PATH, 'utf8');
  const statusStart = source.indexOf('async function callDataManagementStatus');
  const statusEnd = source.indexOf('async function callDataManagementPreviewEdit', statusStart);
  const statusBlock = source.slice(statusStart, statusEnd);

  assert.match(statusBlock, /pendingEditsResult/u);
  assert.match(statusBlock, /\.or\('status\.eq\.submitted,status\.eq\.approval_required,write_status\.eq\.approval_required'\)/u);
  assert.match(statusBlock, /new Map<string, Record<string, unknown>>\(\)/u);
});

test('repeated approval returns the completed readback instead of a conflict', () => {
  const source = fs.readFileSync(EDGE_PATH, 'utf8');
  const approveStart = source.indexOf('async function approveEdit');
  const approveEnd = source.indexOf('async function rejectEdit', approveStart);
  const approveBlock = source.slice(approveStart, approveEnd);

  assert.match(approveBlock, /isEditRequestCompletedStatus\(data\.status, data\.write_status\)/u);
  assert.match(approveBlock, /already_processed:\s*true/u);
});

test('approval UI force-refreshes the server list after every failed review attempt', () => {
  const source = fs.readFileSync(UI_PATH, 'utf8');
  const dashboardStart = source.indexOf('function DataManagementApprovalDashboard');
  const dashboardEnd = source.indexOf('function DataManagementDashboard', dashboardStart);
  const dashboardBlock = source.slice(dashboardStart, dashboardEnd);
  const catchStart = dashboardBlock.indexOf('} catch (reviewError)');
  const finallyStart = dashboardBlock.indexOf('} finally {', catchStart);
  const catchBlock = dashboardBlock.slice(catchStart, finallyStart);

  assert.match(catchBlock, /invalidateDataManagementEdgeCache\(\)/u);
  assert.match(catchBlock, /await reload\(\{\}, \{ force: true \}\)/u);
});
