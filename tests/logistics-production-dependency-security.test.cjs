const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const ROOT = path.resolve(__dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const lock = JSON.parse(fs.readFileSync(path.join(ROOT, 'package-lock.json'), 'utf8'));

function versionTuple(value) {
  return String(value || '').split('.').map((part) => Number(part));
}

function isAtLeast(actual, expected) {
  const left = versionTuple(actual);
  const right = versionTuple(expected);
  for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
    const delta = (left[index] || 0) - (right[index] || 0);
    if (delta !== 0) return delta > 0;
  }
  return true;
}

test('SheetJS uses the maintained official 0.20.3 release instead of the stale npm registry build', () => {
  assert.equal(
    pkg.dependencies.xlsx,
    'https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz',
  );
  assert.equal(lock.packages['node_modules/xlsx'].version, '0.20.3');
});

test('the production websocket dependency includes the memory-exhaustion fix', () => {
  const installed = lock.packages['node_modules/ws']?.version;
  assert.ok(installed, 'package-lock must resolve ws');
  assert.ok(isAtLeast(installed, '8.21.0'), `expected ws >= 8.21.0, received ${installed}`);
});
