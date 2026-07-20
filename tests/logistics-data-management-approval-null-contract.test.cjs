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
