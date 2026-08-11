'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { pathToFileURL } = require('node:url');

const ROOT = path.resolve(__dirname, '..');
const SCHEMA_PATH = path.join(ROOT, 'src/features/logistics-data-platform/rentRollSchema.js');
const FRONTEND_PATH = path.join(ROOT, 'src/features/logistics-data-platform/LogisticsDataPlatform.jsx');

test('goods base options use the approved Korean display order while persisted arrays retain input order', async () => {
  const {
    RENT_ROLL_GOODS_OPTIONS,
    normalizeRentRollGoodsTypes,
    serializeRentRollGoodsTypes,
  } = await import(`${pathToFileURL(SCHEMA_PATH).href}?goods-display=${Date.now()}`);

  assert.deepEqual(RENT_ROLL_GOODS_OPTIONS, [
    '가구·인테리어', '기타 공산품', '디지털·가전', '반도체', '식품·음료',
    '의류', '의약품', '일상용품', '종합상품', '화장품',
  ]);
  const persisted = ['의약품', '가구·인테리어', '식품·음료', '의약품'];
  assert.deepEqual(normalizeRentRollGoodsTypes(persisted), persisted.slice(0, 3));
  assert.deepEqual(serializeRentRollGoodsTypes(persisted), persisted.slice(0, 3));
});

test('dropdown sorts the base plus existing/custom union for display only', () => {
  const source = fs.readFileSync(FRONTEND_PATH, 'utf8');
  const start = source.indexOf('function AddableMultiSelectCell');
  const end = source.indexOf('function MultiSelectCell', start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  const component = source.slice(start, end);

  assert.match(component, /new Set\(\[\.\.\.standardOptions, \.\.\.selected\]\)/u);
  assert.match(component, /localeCompare\([^,]+,\s*["']ko-KR["']\)/u);
  assert.match(component, /const apply = \(items\) => \{[\s\S]*?serializeItems\(items\)/u);
  assert.doesNotMatch(component, /serializeItems\([^)]*\.sort\(/u);
});

test('종합상품 is mutually exclusive while concrete and custom goods preserve their order through save', async () => {
  const {
    addRentRollGoodsType,
    buildRentRollSaveRow,
    toggleRentRollGoodsType,
  } = await import(`${pathToFileURL(SCHEMA_PATH).href}?goods-exclusive=${Date.now()}`);

  assert.deepEqual(
    toggleRentRollGoodsType(['의약품', '사용자 정의'], '종합상품'),
    ['종합상품'],
  );
  assert.deepEqual(
    toggleRentRollGoodsType(['종합상품'], '의류'),
    ['의류'],
  );
  assert.deepEqual(
    toggleRentRollGoodsType(['종합상품', '의약품'], '식품·음료'),
    ['의약품', '식품·음료'],
  );
  assert.deepEqual(
    toggleRentRollGoodsType(['의약품', '식품·음료'], '의약품'),
    ['식품·음료'],
  );
  const custom = addRentRollGoodsType(['종합상품'], '사용자 정의');
  assert.deepEqual(custom, ['사용자 정의']);
  assert.deepEqual(
    buildRentRollSaveRow({ goods_type: custom }, ['goods_type']).goods_type,
    ['사용자 정의'],
  );
});
