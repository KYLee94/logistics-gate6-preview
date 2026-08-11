'use strict';

const assert = require('node:assert/strict');

const ALLOWED_FLAGS = new Set(['allow-write', 'allow-submit', 'allow-mutation']);

function hasFlag(argv, flag) {
  return argv.includes(`--${flag}`);
}

function assertQaMutationOptIn({
  enabled = true,
  flag = 'allow-write',
  argv = process.argv,
  purpose = 'QA mutation',
} = {}) {
  assert.equal(ALLOWED_FLAGS.has(flag), true, `Unsupported QA mutation flag: --${flag}`);
  if (!enabled) return false;
  if (!hasFlag(argv, flag)) {
    const error = new Error(`${purpose} is fail-closed. Re-run with --${flag} only after the target and rollback plan are verified.`);
    error.code = 'QA_MUTATION_OPT_IN_REQUIRED';
    throw error;
  }
  return true;
}

function runSelfTest() {
  assert.equal(assertQaMutationOptIn({ enabled: false, argv: [] }), false);
  assert.throws(
    () => assertQaMutationOptIn({ argv: ['node', 'qa.cjs'], flag: 'allow-write', purpose: 'write probe' }),
    /write probe is fail-closed[\s\S]*--allow-write/u,
  );
  assert.equal(
    assertQaMutationOptIn({ argv: ['node', 'qa.cjs', '--allow-write'], flag: 'allow-write' }),
    true,
  );
  assert.throws(
    () => assertQaMutationOptIn({ argv: ['node', 'qa.cjs', '--allow-write'], flag: 'unsafe' }),
    /Unsupported QA mutation flag/u,
  );
  process.stdout.write(`${JSON.stringify({ ok: true, cases: 4 })}\n`);
}

module.exports = { assertQaMutationOptIn, hasFlag };

if (require.main === module && process.argv.includes('--self-test')) runSelfTest();
