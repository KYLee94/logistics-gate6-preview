'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { pathToFileURL } = require('node:url');

const ROOT = path.resolve(__dirname, '..');
const SOURCE = fs.readFileSync(
  path.join(ROOT, 'src/features/logistics-data-platform/LogisticsDataPlatform.jsx'),
  'utf8',
);

test('초기 층 정렬은 화면 projection에만 적용하고 전체문서 원본 배열 순서는 유지한다', () => {
  const start = SOURCE.indexOf('function RentRollPanel');
  const end = SOURCE.indexOf('function periodFor', start);
  const panel = SOURCE.slice(start, end);
  assert.match(panel, /const primaryRows = rentRollRowsFromReadback\(source\)/u);
  assert.doesNotMatch(panel, /const primaryRows = sortRows\(rentRollRowsFromReadback\(source\), DEFAULT_SORT\)/u);
  assert.match(panel, /const displayedRows = useMemo\(\(\) => sortRows\(rows, sort\)/u);
  assert.match(panel, /buildRentRollDocumentPayload\(rows/u);
});

test('전체문서 serializer는 화면 정렬 정보 없이 전달받은 행 배열 순서를 보존한다', async () => {
  const contractPath = path.join(ROOT, 'src/features/logistics-data-platform/documentContract.js');
  const { buildRentRollDocumentPayload } = await import(
    `${pathToFileURL(contractPath).href}?rent-order=${Date.now()}`
  );
  const rows = [
    { tenant_name: '1층 먼저 저장', floor_label: '1F' },
    { tenant_name: '3층 나중 저장', floor_label: '3F' },
  ];
  assert.deepEqual(
    buildRentRollDocumentPayload(rows).rows.map((row) => row.tenant_name),
    ['1층 먼저 저장', '3층 나중 저장'],
  );
});
