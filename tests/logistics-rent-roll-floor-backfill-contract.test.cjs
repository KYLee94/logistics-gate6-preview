const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const migrationPath = path.resolve(
  __dirname,
  '../supabase/migrations/20260810080000_logistics_rent_roll_floor_backfill.sql',
);

test('floor backfill is scoped to the 19 exact source-backed signatures', () => {
  const sql = fs.readFileSync(migrationPath, 'utf8');

  assert.match(sql, /RENT_ROLL_FLOOR_SOURCE_BACKFILL_20260810/u);
  assert.match(sql, /RENT_ROLL_FLOOR_MAPPING_COUNT_MISMATCH/u);
  assert.match(sql, /v_match_count\s*<>\s*19/u);
  assert.match(sql, /RENT_ROLL_FLOOR_SIGNATURE_NOT_UNIQUE/u);
  assert.match(sql, /RENT_ROLL_FLOOR_TOTAL_COUNT_MISMATCH/u);
  assert.match(sql, /sum\(jsonb_array_length\(rows\)\)[\s\S]*v_total_count\s*<>\s*81/u);
  assert.match(sql, /RENT_ROLL_FLOOR_BLANK_COUNT_MISMATCH/u);
  assert.match(sql, /v_blank_count\s*<>\s*20/u);

  const expectedMappings = [
    ['A120085001', '2304.76', 'B1'],
    ['A120085001', '10914.64', 'B2'],
    ['A112527001', '36165.62', 'B1, 2~3'],
    ['A112527001', '5898.23', 'B1'],
    ['A112755001', '54566.21', '1~4'],
    ['A112527002', '18706.18', '1~3'],
    ['A112299001', '24706.57', '1~2'],
    ['A112505001', '12572', 'B2'],
    ['AP00014001', '32768.93', 'B1, 3~4'],
    ['AP00014001', '10910.3', 'B2'],
    ['A112500003', '32824.14', '1~2'],
    ['S00002001', '8688', 'B1'],
    ['A112527003', '18052.43', 'B4~B3, 2'],
    ['A112527003', '11927.59', 'B2~B1, 1'],
    ['A112606001', '23211.7', 'B1, 2~3'],
    ['A112606001', '38300.04', 'B2~B1'],
    ['A112606001', '16453.61', '3~4'],
    ['A112573001', '11660.69', 'B2'],
    ['A112642001', '107009.56', 'B2~3'],
  ];

  for (const [assetCode, area, floor] of expectedMappings) {
    assert.ok(
      sql.includes(`'${assetCode}'`) && sql.includes(area) && sql.includes(`'${floor}'`),
      `missing source-backed mapping ${assetCode}/${area}/${floor}`,
    );
  }
});

test('all 19 mappings retain the exact DB_일반 Excel source row for traceability', () => {
  const sql = fs.readFileSync(migrationPath, 'utf8');
  const actualSourceRows = [...sql.matchAll(/^\s*\((\d+),.+,\s*(\d+)\)[,;]\s*$/gmu)]
    .map((match) => [Number(match[1]), Number(match[2])])
    .filter(([mappingOrder]) => mappingOrder >= 1 && mappingOrder <= 19)
    .sort(([left], [right]) => left - right)
    .map(([, sourceRow]) => sourceRow);
  assert.deepEqual(actualSourceRows, [
    39, 41, 52, 53, 51, 56, 22, 70, 62, 59, 44, 73, 57, 58, 48, 47, 50, 63, 45,
  ]);
});

test('Busan vacant row stays blank and all non-floor JSON is immutable', () => {
  const sql = fs.readFileSync(migrationPath, 'utf8');

  assert.match(sql, /RENT_ROLL_FLOOR_BUSAN_BLANK_MISMATCH/u);
  assert.match(sql, /A112109001/u);
  assert.match(sql, /23729\.34/u);
  assert.match(sql, /RENT_ROLL_FLOOR_NON_TARGET_MUTATION/u);
  assert.match(sql, /RENT_ROLL_FLOOR_NON_FLOOR_MUTATION/u);
  assert.match(sql, /RENT_ROLL_FLOOR_READBACK_MISMATCH/u);
  assert.match(sql, /row_before\s*-\s*'floor_label'/u);
  assert.match(sql, /row_after\s*-\s*'floor_label'/u);
  assert.match(sql, /with ordinality/u);
  assert.match(sql, /jsonb_agg\([\s\S]*order by[\s\S]*ordinality/u);
  assert.match(sql, /v_blank_count\s*<>\s*1/u);
});

test('migration changes no schema surface and updates only the rows document', () => {
  const sql = fs.readFileSync(migrationPath, 'utf8');

  assert.match(sql, /update logistics_core\.rent_roll/u);
  assert.match(sql, /set rows\s*=/u);
  assert.doesNotMatch(sql, /create\s+(?:unlogged\s+)?table\s+(?!floor_backfill_)/iu);
  assert.doesNotMatch(sql, /alter\s+table/iu);
  assert.doesNotMatch(sql, /insert\s+into\s+logistics_core/iu);
  assert.doesNotMatch(sql, /delete\s+from\s+logistics_core/iu);
  assert.doesNotMatch(sql, /drop\s+(?:table|schema)/iu);
});
