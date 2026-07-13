const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');
const { pathToFileURL } = require('node:url');

const imageSourceUrl = pathToFileURL(path.join(
  __dirname,
  '..',
  'src',
  'components',
  'system',
  'workspace',
  'floorPlanImageSource.js',
)).href;

async function loadImageSource() {
  return import(imageSourceUrl);
}

test('preserves a Supabase signed floor-plan URL without display formatting', async () => {
  const { normalizeFloorPlanImageSource } = await loadImageSource();
  const signedUrl = 'https://project.supabase.co/storage/v1/object/sign/private-bucket/asset-spec/floor-plans/asset_a120085001/12f.png?token=signed-token';

  assert.equal(normalizeFloorPlanImageSource(`  ${signedUrl}  `), signedUrl);
});

test('returns an empty source for absent or non-string values', async () => {
  const { normalizeFloorPlanImageSource } = await loadImageSource();

  assert.equal(normalizeFloorPlanImageSource(''), '');
  assert.equal(normalizeFloorPlanImageSource(null), '');
  assert.equal(normalizeFloorPlanImageSource({ url: 'https://example.com/floor.png' }), '');
});

test('reads the canonical floor label from the API metadata contract', async () => {
  const { floorPlanLabelFromRecord } = await loadImageSource();

  assert.equal(floorPlanLabelFromRecord({ metadata: { floor_label: '8F' } }, 'B1'), '8F');
  assert.equal(floorPlanLabelFromRecord({ floorLabel: 'B2' }, '1F'), 'B2');
  assert.equal(floorPlanLabelFromRecord({}, '1F'), '1F');
});
