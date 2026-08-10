const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');
const { pathToFileURL } = require('node:url');

const ROOT = path.resolve(__dirname, '..');
const SCHEMA_PATH = path.join(ROOT, 'src/features/logistics-data-platform/rentRollSchema.js');

async function schema() {
  return import(`${pathToFileURL(SCHEMA_PATH).href}?floor-sort=${Date.now()}-${Math.random()}`);
}

test('렌트롤 층 정렬값은 지상층 다음 B1, B2 순으로 내려간다', async () => {
  const { rentRollFloorSortValue } = await schema();
  const labels = ['B2', '2F', 'B1', '1F'];

  assert.deepEqual(
    labels.toSorted((left, right) => rentRollFloorSortValue(right) - rentRollFloorSortValue(left)),
    ['2F', '1F', 'B1', 'B2'],
  );
});

test('렌트롤 층 정렬값은 운영 표기 B/지하와 옥탑을 일관되게 해석한다', async () => {
  const { rentRollFloorSortValue } = await schema();

  assert.equal(rentRollFloorSortValue('B1'), -1);
  assert.equal(rentRollFloorSortValue('B2'), -2);
  assert.equal(rentRollFloorSortValue('지하 2층'), -2);
  assert.equal(rentRollFloorSortValue('옥탑'), 1000);
  assert.equal(rentRollFloorSortValue('ROOF 1'), 1001);
  assert.equal(rentRollFloorSortValue(''), Number.NEGATIVE_INFINITY);
});
