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
