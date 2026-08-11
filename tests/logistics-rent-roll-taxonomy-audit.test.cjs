const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const scriptPath = path.resolve(
  __dirname,
  '../scripts/qa/logistics-rent-roll-taxonomy-audit.cjs',
);

test('temperature/goods taxonomy audit separates valid, blank, and invalid row evidence', () => {
  const { auditAssetRows } = require(scriptPath);
  const result = auditAssetRows({ asset_code: 'A1', asset_name: '자산1' }, [
    { display_order: 1, temperature_type: '상온', goods_type: '식품' },
    { display_order: 2, temperature_type: '', goods_type: '' },
    { display_order: 3, temperature_type: '극저온', goods_type: ['식품', '의약품'] },
    { display_order: 4, temperature_type: null, goods_type: 17 },
  ]);

  assert.equal(result.row_count, 4);
  assert.deepEqual(result.temperature_unique_values, ['극저온', '상온']);
  assert.deepEqual(result.goods_unique_values, ['식품']);
  assert.equal(result.temperature_blank_count, 2);
  assert.equal(result.temperature_invalid_count, 1);
  assert.equal(result.goods_blank_count, 1);
  assert.equal(result.goods_invalid_count, 2);
  assert.deepEqual(result.issue_rows.map((row) => row.row_index), [2, 3, 4]);
  assert.deepEqual(result.rows[2].temperature.reasons, ['not_in_declared_options']);
  assert.deepEqual(result.rows[2].goods.reasons, ['expected_string_or_null_got_array']);
});

test('API/XLSX comparison keeps unmatched values and assets explicit without fuzzy matching', () => {
  const { compareTaxonomySources } = require(scriptPath);
  const comparison = compareTaxonomySources(
    {
      temperature_unique_values: ['상온', '저온'],
      goods_unique_values: ['식품', '화장품'],
      asset_keys: ['A1', 'A2'],
    },
    {
      temperature_unique_values: ['상온', '복합'],
      goods_unique_values: ['식품', '의약품'],
      asset_keys: ['A1', '별칭자산'],
    },
  );
  assert.deepEqual(comparison.temperature.shared, ['상온']);
  assert.deepEqual(comparison.temperature.api_only, ['저온']);
  assert.deepEqual(comparison.temperature.xlsx_only, ['복합']);
  assert.deepEqual(comparison.goods.api_only, ['화장품']);
  assert.deepEqual(comparison.goods.xlsx_only, ['의약품']);
  assert.deepEqual(comparison.assets.api_only, ['A2']);
  assert.deepEqual(comparison.assets.xlsx_only, ['별칭자산']);
});

test('canonical goods array mode preserves direct additions and rejects scalar or malformed items', () => {
  const { auditAssetRows } = require(scriptPath);
  const result = auditAssetRows({ asset_code: 'A1' }, [
    { temperature_type: '\uc0c1\uc628', goods_type: ['\uc2dd\ud488', '\uc0ac\uc6a9\uc790 \ucd94\uac00', '\uc2dd\ud488'] },
    { temperature_type: '\uc800\uc628', goods_type: [] },
    { temperature_type: '\ubcf5\ud569', goods_type: '\uae30\uc874 \ub2e8\uc77c\uac12' },
    { temperature_type: '\uc0ac\ubb34\uc2e4', goods_type: ['\uc2dd\ud488', 17, ''] },
  ], { goodsMode: 'array' });

  assert.deepEqual(result.goods_unique_values, ['\uc0ac\uc6a9\uc790 \ucd94\uac00', '\uc2dd\ud488']);
  assert.equal(result.goods_blank_count, 1);
  assert.equal(result.goods_invalid_count, 2);
  assert.deepEqual(result.rows[2].goods.reasons, ['expected_array_or_null_got_string']);
  assert.deepEqual(result.rows[3].goods.reasons, [
    'array_item_2_expected_nonblank_string_got_number',
    'array_item_3_expected_nonblank_string_got_blank',
  ]);
});

test('operating taxonomy audit is fail-closed read-only and cannot invoke batch-save', () => {
  const source = fs.readFileSync(scriptPath, 'utf8');
  assert.match(source, /v2\/home\/read/u);
  assert.match(source, /v2\/rent-roll\/read/u);
  assert.match(source, /expectedAssetCount\s*=\s*19/u);
  assert.match(source, /production_mutation_used:\s*false/u);
  assert.doesNotMatch(source, /batch-save|batch_save|exercise-browser-writes/u);
});

test('goods category map collapses the 21 operating atoms without retaining handling annotations', () => {
  const {
    GOODS_CATEGORY_MAP,
    GOODS_CATEGORY_VALUES,
    normalizeGoodsCategories,
  } = require(scriptPath);

  assert.equal(Object.keys(GOODS_CATEGORY_MAP).length, 21);
  assert.deepEqual(GOODS_CATEGORY_VALUES, [
    '가구·인테리어', '기타 공산품', '디지털·가전', '반도체', '식품·음료',
    '의류', '의약품', '일상용품', '종합상품', '화장품',
  ]);
  assert.deepEqual(GOODS_CATEGORY_MAP['반도체(고가 화물)'], ['반도체']);
  assert.deepEqual(GOODS_CATEGORY_MAP['의류(중하중)'], ['의류']);
  assert.deepEqual(GOODS_CATEGORY_MAP['식품(온도)'], ['식품·음료']);
  assert.deepEqual(GOODS_CATEGORY_MAP['전자기기(컴퓨터 등)'], ['디지털·가전']);
  assert.deepEqual(GOODS_CATEGORY_MAP['전체 상품 취급(풀필먼트)'], ['종합상품']);
  assert.deepEqual(GOODS_CATEGORY_MAP['하중물'], []);

  assert.deepEqual(
    normalizeGoodsCategories(['하중물', '의약품', '의약품']).categories,
    ['의약품'],
  );
  assert.deepEqual(
    normalizeGoodsCategories(['가전제품 등', '어패럴', '사용자 추가']).categories,
    ['디지털·가전', '의류', '사용자 추가'],
  );
  assert.deepEqual(
    normalizeGoodsCategories(['의약품', '가전제품', '의류', '가전제품 등']).categories,
    ['의약품', '디지털·가전', '의류'],
  );
  assert.deepEqual(
    normalizeGoodsCategories(['하중물']).removed_non_categories,
    ['하중물'],
  );
});

test('row evidence retains the exact source signature needed for workbook matching', () => {
  const { auditAssetRows } = require(scriptPath);
  const result = auditAssetRows({ asset_code: 'A1' }, [{
    tenant_name: '임차인',
    business_registration_number: '000-00-00000',
    floor_label: 'B1',
    zone_label: '1구역',
    leased_area_sqm: 123.45,
    commencement_date: '2026-01-01',
    expiry_date: '2027-01-01',
    temperature_type: '상온',
    goods_type: ['가전제품 등'],
  }], { goodsMode: 'array' });

  assert.deepEqual(result.rows[0].source_signature, {
    tenant_name: '임차인',
    business_registration_number: '000-00-00000',
    floor_label: 'B1',
    zone_label: '1구역',
    leased_area_sqm: 123.45,
    commencement_date: '2026-01-01',
    expiry_date: '2027-01-01',
  });
  assert.deepEqual(result.rows[0].goods_categories.categories, ['디지털·가전']);
});

test('operating 81-row audit atom counts collapse to the approved 10 product categories', () => {
  const { GOODS_CATEGORY_VALUES, normalizeGoodsCategories } = require(scriptPath);
  const operatingAtomicCounts = new Map([
    ['가구', 1], ['가전제품', 1], ['가전제품 등', 1], ['공산품', 3],
    ['라이프스타일 용품', 1], ['반도체(고가 화물)', 1], ['생필품', 6],
    ['식음료', 1], ['식품(온도)', 1], ['신선식품', 1], ['어패럴', 1],
    ['유제품', 1], ['유제품 등', 1], ['의류', 2], ['의류(중하중)', 1],
    ['의약품', 2], ['전자기기(컴퓨터 등)', 1], ['전체 상품 취급(풀필먼트)', 1],
    ['하중물', 29], ['화장품', 1], ['화장품 등', 1],
  ]);
  const categoryCounts = new Map(GOODS_CATEGORY_VALUES.map((value) => [value, 0]));
  for (const [source, count] of operatingAtomicCounts) {
    for (const category of normalizeGoodsCategories([source]).categories) {
      categoryCounts.set(category, categoryCounts.get(category) + count);
    }
  }

  assert.deepEqual(Object.fromEntries(categoryCounts), {
    '가구·인테리어': 1,
    '기타 공산품': 3,
    '디지털·가전': 3,
    '반도체': 1,
    '식품·음료': 5,
    '의류': 4,
    '의약품': 2,
    '일상용품': 7,
    '종합상품': 1,
    '화장품': 2,
  });
  assert.equal([...operatingAtomicCounts.values()].reduce((sum, count) => sum + count, 0), 58);
  assert.equal(operatingAtomicCounts.get('하중물'), 29);
});
