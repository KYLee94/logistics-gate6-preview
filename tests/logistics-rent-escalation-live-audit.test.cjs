'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const { classifyEscalation } = require('../scripts/qa/logistics-rent-escalation-live-audit.cjs');

test('fraction, percent number, and explicit percent keep distinct input provenance', () => {
  assert.deepEqual(classifyEscalation(0.03), {
    classification: 'raw_fraction',
    canonical_display: '3%',
    numeric_percent: 3,
  });
  assert.deepEqual(classifyEscalation('3'), {
    classification: 'percent_number',
    canonical_display: '3%',
    numeric_percent: 3,
  });
  assert.deepEqual(classifyEscalation('3%'), {
    classification: 'explicit_percent',
    canonical_display: '3%',
    numeric_percent: 3,
  });
  assert.deepEqual(classifyEscalation('0.03%'), {
    classification: 'ambiguous_subunit_percent',
    canonical_display: '0.03%',
    numeric_percent: 0.03,
  });
});

test('missing and out-of-range escalation values are reported without guessing', () => {
  assert.deepEqual(classifyEscalation(null), {
    classification: 'missing',
    canonical_display: null,
    numeric_percent: null,
  });
  assert.equal(classifyEscalation('101%').classification, 'invalid');
  assert.equal(classifyEscalation('not-a-rate').classification, 'invalid');
});
