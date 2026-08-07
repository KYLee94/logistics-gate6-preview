const assert = require('node:assert/strict');
const fs = require('node:fs');
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
const stackingPlanPath = path.join(
  __dirname,
  '..',
  'src',
  'components',
  'system',
  'workspace',
  'StackingPlan.jsx',
);

async function loadNormalizer() {
  return import(normalizerUrl);
}

async function loadBuildStackingFloorsFromRows() {
  const normalizer = await loadNormalizer();
  const source = fs.readFileSync(stackingPlanPath, 'utf8');
  const start = source.indexOf('export function buildStackingFloorsFromRows');
  const end = source.indexOf('export function StackingPlan', start);
  assert.ok(start >= 0 && end > start, 'buildStackingFloorsFromRows must exist');
  const declaration = source.slice(start, end).replace('export function', 'function');
  const firstDefined = (...values) => values.find((value) => value !== undefined && value !== null && value !== '');
  const humanTenantName = (...values) => String(firstDefined(...values, '') || '').trim();
  const cleanText = (value, fallback = '') => String(value ?? '').trim() || fallback;

  return new Function(
    'normalizeStackingFloorLabel',
    'normalizeStackingFloorLabelFromRow',
    'firstDefined',
    'humanTenantName',
    'cleanText',
    `${declaration}\nreturn buildStackingFloorsFromRows;`,
  )(
    normalizer.normalizeStackingFloorLabel,
    normalizer.normalizeStackingFloorLabelFromRow,
    firstDefined,
    humanTenantName,
    cleanText,
  );
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

test('expands basement-to-ground, ground-only, and comma-combined floor ranges', async () => {
  const { expandStackingFloorLabels, normalizeStackingFloorLabelFromRow } = await loadNormalizer();

  assert.deepEqual(expandStackingFloorLabels('B1~8'), [
    'B1', '1F', '2F', '3F', '4F', '5F', '6F', '7F', '8F',
  ]);
  assert.deepEqual(expandStackingFloorLabels('B2~3'), ['B2', 'B1', '1F', '2F', '3F']);
  assert.deepEqual(expandStackingFloorLabels('1~3'), ['1F', '2F', '3F']);
  assert.deepEqual(expandStackingFloorLabels('B2~B1, 1~3, 5'), [
    'B2', 'B1', '1F', '2F', '3F', '5F',
  ]);
  assert.deepEqual(normalizeStackingFloorLabelFromRow({
    floorLabel: 'B2',
    sourceFloorLabel: 'B2~3',
  }, { expandRanges: true }), ['B2', 'B1', '1F', '2F', '3F']);
});

test('expands one aggregate API row once and evenly preserves its leased area total', async () => {
  const buildStackingFloorsFromRows = await loadBuildStackingFloorsFromRows();
  const floors = buildStackingFloorsFromRows([{
    leaseSpaceId: 'lease-api-1',
    floorLabel: 'B1~8',
    sourceFloorLabel: 'B1~8',
    tenantMasterName: 'API Tenant',
    leasedAreaSqm: 900,
  }]);

  assert.deepEqual(floors.map((floor) => floor.floorLabel), [
    'B1', '1F', '2F', '3F', '4F', '5F', '6F', '7F', '8F',
  ]);
  assert.deepEqual(floors.map((floor) => floor.tenants.length), Array(9).fill(1));
  assert.deepEqual(floors.map((floor) => floor.tenants[0].leasedAreaSqm), Array(9).fill(100));
  assert.equal(floors.reduce((sum, floor) => sum + floor.totalLeasedAreaSqm, 0), 900);
});

test('deduplicates split fallback rows by lease, source range, and tenant before distributing area', async () => {
  const buildStackingFloorsFromRows = await loadBuildStackingFloorsFromRows();
  const floorLabels = ['B2', 'B1', '1F', '2F', '3F'];
  const splitAreas = [80, 90, 100, 110, 120];
  const floors = buildStackingFloorsFromRows(floorLabels.map((floorLabel, index) => ({
    leaseSpaceId: 'lease-fallback-1',
    sourceFloorLabel: 'B2~3',
    floorLabel,
    tenantMasterName: 'Fallback Tenant',
    leasedAreaSqm: splitAreas[index],
  })));

  assert.deepEqual(floors.map((floor) => floor.floorLabel), floorLabels);
  assert.deepEqual(floors.map((floor) => floor.tenants.length), Array(5).fill(1));
  assert.deepEqual(floors.map((floor) => floor.tenants[0].leasedAreaSqm), Array(5).fill(100));
  assert.equal(floors.reduce((sum, floor) => sum + floor.totalLeasedAreaSqm, 0), 500);
});

test('preserves existing single-floor stacking behavior', async () => {
  const buildStackingFloorsFromRows = await loadBuildStackingFloorsFromRows();
  const floors = buildStackingFloorsFromRows([{
    leaseSpaceId: 'lease-single-1',
    floorLabel: '2F',
    tenantMasterName: 'Single Tenant',
    leasedAreaSqm: 120,
  }]);

  assert.equal(floors.length, 1);
  assert.equal(floors[0].floorLabel, '2F');
  assert.equal(floors[0].totalLeasedAreaSqm, 120);
  assert.equal(floors[0].tenants[0].leasedAreaSqm, 120);
  assert.equal(floors[0].tenants[0].share, 1);
});
