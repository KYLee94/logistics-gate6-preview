const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');
const { pathToFileURL } = require('node:url');

const normalizerUrl = pathToFileURL(path.join(
  __dirname,
  '..',
  'src',
  'components',
  'system',
  'workspace',
  'stackingFloorNormalizer.js',
)).href;

async function loadNormalizer() {
  return import(normalizerUrl);
}

test('normalizes verified single-floor labels to one canonical label', async () => {
  const { normalizeStackingFloorLabel } = await loadNormalizer();

  assert.equal(normalizeStackingFloorLabel('1'), '1F');
  assert.equal(normalizeStackingFloorLabel(' 1F '), '1F');
  assert.equal(normalizeStackingFloorLabel('지상 1층'), '1F');
  assert.equal(normalizeStackingFloorLabel('B 2'), 'B2');
  assert.equal(normalizeStackingFloorLabel('지하 2층'), 'B2');
});

test('rejects aggregate or multi-floor contract labels instead of splitting them', async () => {
  const { normalizeStackingFloorLabel } = await loadNormalizer();

  ['B1~8', '1~2', 'B1, 2~3', 'B2~B1, 1', '-'].forEach((label) => {
    assert.equal(normalizeStackingFloorLabel(label), '');
  });
});

test('does not infer a floor from an explicit aggregate label', async () => {
  const { normalizeStackingFloorLabelFromRow } = await loadNormalizer();

  assert.equal(normalizeStackingFloorLabelFromRow({ floorLabel: 'B1~8', spaceLabel: 'B1' }), '');
  assert.equal(normalizeStackingFloorLabelFromRow({ spaceLabel: '3F A구역' }), '3F');
});
