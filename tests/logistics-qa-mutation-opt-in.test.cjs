'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..');
const QA = path.join(ROOT, 'scripts', 'qa');
const { assertQaMutationOptIn } = require('../scripts/qa/lib/qa-mutation-guard.cjs');

const FAIL_CLOSED_CASES = [
  ['logistics-current-addendum-live.cjs', [], '--allow-mutation'],
  ['logistics-data-quality-e2e.cjs', [], '--allow-mutation'],
  ['logistics-data-update-auto-smoke.cjs', [], '--allow-mutation'],
  ['logistics-external-api-smoke.cjs', [], '--allow-write'],
  ['logistics-feature-access-save-readback.cjs', [], '--allow-write'],
  ['logistics-data-platform-live-document-qa.cjs', ['--exercise-browser-writes'], '--allow-write'],
  ['logistics-data-platform-live-smoke.cjs', ['--validate-safe-writes'], '--allow-write'],
  ['logistics-home-finance-live-matrix.cjs', ['--execute-safe-noop'], '--allow-write'],
  ['logistics-rent-roll-cell-save-matrix.cjs', ['--execute-safe-noop'], '--allow-write'],
];

test('shared QA mutation guard is fail-closed and accepts only the exact opt-in', () => {
  assert.equal(assertQaMutationOptIn({ enabled: false, argv: [] }), false);
  assert.throws(
    () => assertQaMutationOptIn({ argv: ['node', 'qa.cjs'], flag: 'allow-submit' }),
    /fail-closed[\s\S]*--allow-submit/u,
  );
  assert.equal(assertQaMutationOptIn({ argv: ['node', 'qa.cjs', '--allow-submit'], flag: 'allow-submit' }), true);
});

test('all nine mutation-capable QA executables stop before credentials or network without opt-in', () => {
  for (const [file, triggerArgs, requiredFlag] of FAIL_CLOSED_CASES) {
    const result = spawnSync(process.execPath, [path.join(QA, file), ...triggerArgs], {
      cwd: ROOT,
      encoding: 'utf8',
      env: {
        VITE_SUPABASE_URL: 'https://qa-guard.invalid',
        VITE_SUPABASE_ANON_KEY: 'qa-guard-only',
      },
      timeout: 10_000,
    });
    assert.notEqual(result.status, 0, `${file} unexpectedly ran without ${requiredFlag}`);
    assert.match(`${result.stderr}\n${result.stdout}`, new RegExp(`fail-closed[\\s\\S]*${requiredFlag}`, 'u'), file);
  }
});

test('guard and dangerous-script auditor self-tests pass without network or artifacts', () => {
  for (const [file, args] of [
    ['lib/qa-mutation-guard.cjs', ['--self-test']],
    ['logistics-dangerous-script-audit.cjs', ['--self-test']],
  ]) {
    const result = spawnSync(process.execPath, [path.join(QA, file), ...args], {
      cwd: ROOT,
      encoding: 'utf8',
      env: {},
      timeout: 10_000,
    });
    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.equal(JSON.parse(result.stdout).ok, true);
  }
});
