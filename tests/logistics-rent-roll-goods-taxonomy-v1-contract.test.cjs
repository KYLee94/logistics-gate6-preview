'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..');
const MIGRATION_PATH = path.join(
  ROOT,
  'supabase/migrations/20260811054533_logistics_rent_roll_goods_taxonomy_v1.sql',
);
const SQL = fs.readFileSync(MIGRATION_PATH, 'utf8');

const EXACT_MAPPING = new Map([
  ['하중물', null],
  ['생필품', '일상용품'],
  ['라이프스타일 용품', '일상용품'],
  ['공산품', '기타 공산품'],
  ['어패럴', '의류'],
  ['의류(중하중)', '의류'],
  ['가전제품', '디지털·가전'],
  ['가전제품 등', '디지털·가전'],
  ['전자기기(컴퓨터 등)', '디지털·가전'],
  ['가구', '가구·인테리어'],
  ['반도체(고가 화물)', '반도체'],
  ['식품(온도)', '식품·음료'],
  ['식음료', '식품·음료'],
  ['신선식품', '식품·음료'],
  ['유제품', '식품·음료'],
  ['유제품 등', '식품·음료'],
  ['화장품 등', '화장품'],
  ['전체 상품 취급(풀필먼트)', '종합상품'],
]);

function canonicalize(values) {
  const seen = new Set();
  const result = [];
  for (const raw of values) {
    const value = String(raw).trim();
    const mapped = EXACT_MAPPING.has(value) ? EXACT_MAPPING.get(value) : value;
    if (!mapped || seen.has(mapped)) continue;
    seen.add(mapped);
    result.push(mapped);
  }
  return result;
}

function canonicalizeStrict(values) {
  const result = canonicalize(values);
  if (result.includes('종합상품') && result.length > 1) {
    const error = new Error('GOODS_TYPE_AGGREGATE_EXCLUSIVE_REQUIRED');
    error.code = 'PT422';
    throw error;
  }
  return result;
}

test('RED contract: exact aliases become product-only MECE values and unknown custom values survive', () => {
  assert.deepEqual(canonicalize(['하중물']), []);
  assert.deepEqual(canonicalize(['하중물', '의약품']), ['의약품']);
  assert.deepEqual(canonicalize(['가전제품', '가전제품 등', '전자기기(컴퓨터 등)']), ['디지털·가전']);
  assert.deepEqual(canonicalize(['유제품 등', '신선식품', '식음료']), ['식품·음료']);
  assert.deepEqual(canonicalize(['어패럴', '의류(중하중)', '의류']), ['의류']);
  assert.deepEqual(canonicalize(['생필품', '라이프스타일 용품']), ['일상용품']);
  assert.deepEqual(canonicalize(['공산품']), ['기타 공산품']);
  assert.deepEqual(canonicalize(['가구']), ['가구·인테리어']);
  assert.deepEqual(canonicalize(['기존 사용자 추가값']), ['기존 사용자 추가값']);

  for (const [source, target] of EXACT_MAPPING) {
    assert.match(SQL, new RegExp(`when\\s+'${source.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')}'\\s+then\\s+${target === null ? 'null' : `'${target}'`}`, 'u'));
  }
  assert.match(SQL, /else\s+v_value/u);
});

test('RED contract: production preflight is exact and source-backed blank rows are strict signatures', () => {
  for (const marker of [
    'RENT_GOODS_DOCUMENT_COUNT_MISMATCH',
    'RENT_GOODS_ROW_COUNT_MISMATCH',
    'RENT_GOODS_SOURCE_DISTRIBUTION_MISMATCH',
    'RENT_GOODS_SOURCE_BACKFILL_SIGNATURE_MISMATCH',
    'RENT_GOODS_SOURCE_BACKFILL_VALUE_MISMATCH',
  ]) assert.match(SQL, new RegExp(marker, 'u'));

  assert.match(SQL, /v_document_count\s*<>\s*19/u);
  assert.match(SQL, /v_row_count\s*<>\s*81/u);

  const signatures = [
    ['A112527001', '(주)우진글로벌', '6409.61', '기타 공산품'],
    ['A112527001', '쿠팡(주)', '36165.62', '기타 공산품'],
    ['A112527003', '아워박스(주)', '18052.43', '기타 공산품'],
    ['A112527003', '아워박스(주)', '11927.59', '기타 공산품'],
    ['A112642001', '삼성전자로지텍(주)', '107009.56', '디지털·가전'],
    ['AP00014001', '롯데글로벌로지스(주)', '32768.93', '가구·인테리어'],
    ['A112606001', '한국머스크물류서비스(주)', '23211.70', '의류'],
    ['A112505001', '(주)아이앤피앤피', '3777.00', '일상용품'],
    ['A112505001', 'JM 로지스', '4028.00', '일상용품'],
  ];
  for (const signature of signatures) {
    for (const value of signature) assert.ok(SQL.includes(value), `missing source signature ${value}`);
  }
});

test('RED contract: backfill preserves row order and every non-goods field, then exact readback is canonical', () => {
  for (const marker of [
    'RENT_GOODS_NON_GOODS_DATA_CHANGED',
    'RENT_GOODS_ROW_ORDER_CHANGED',
    'RENT_GOODS_READBACK_MISMATCH',
    'RENT_GOODS_POST_DISTRIBUTION_MISMATCH',
    'RENT_GOODS_NOT_IDEMPOTENT',
  ]) assert.match(SQL, new RegExp(marker, 'u'));

  assert.match(SQL, /with\s+ordinality/u);
  assert.match(SQL, /before_item\.value\s*-\s*'goods_type'/u);
  assert.match(SQL, /after_item\.value\s*-\s*'goods_type'/u);
  assert.match(SQL, /order\s+by\s+item\.ordinality/u);

  const expectedPostCounts = new Map([
    ['일상용품', 9], ['기타 공산품', 7], ['의약품', 2], ['의류', 5], ['반도체', 1],
    ['식품·음료', 7], ['화장품', 2], ['디지털·가전', 5], ['가구·인테리어', 2], ['종합상품', 1],
  ]);
  for (const [value, count] of expectedPostCounts) {
    assert.match(SQL, new RegExp(`'${value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')}'\\s*,\\s*${count}`, 'u'));
  }
});

test('RED contract: the four-table document shape remains unchanged and future saves use the canonicalizer', () => {
  assert.match(SQL, /create\s+or\s+replace\s+function\s+logistics_core\.canonical_goods_type_item\s*\(/iu);
  assert.match(SQL, /create\s+or\s+replace\s+function\s+logistics_core\.normalize_goods_type\s*\(/iu);
  assert.match(SQL, /GOODS_TYPE_STRING_ARRAY_REQUIRED/u);
  assert.match(SQL, /revoke\s+all\s+on\s+function\s+logistics_core\.canonical_goods_type_item\(text\)/iu);
  assert.doesNotMatch(SQL, /add\s+column/iu);
  assert.doesNotMatch(SQL, /create\s+table\s+(?!rent_goods_)/iu);
  assert.doesNotMatch(SQL, /handling_attributes|고가\s*화물.*jsonb|중하중.*jsonb/iu);
  assert.match(SQL, /commit\s*;/iu);
});

test('RED contract: 종합상품 is an exclusive aggregate in source, backfill and future writes', () => {
  assert.deepEqual(canonicalizeStrict(['전체 상품 취급(풀필먼트)']), ['종합상품']);
  assert.throws(
    () => canonicalizeStrict(['종합상품', '의류']),
    (error) => error?.code === 'PT422' && error?.message === 'GOODS_TYPE_AGGREGATE_EXCLUSIVE_REQUIRED',
  );
  assert.throws(
    () => canonicalizeStrict(['사용자 추가값', '전체 상품 취급(풀필먼트)']),
    /GOODS_TYPE_AGGREGATE_EXCLUSIVE_REQUIRED/u,
  );

  assert.match(SQL, /GOODS_TYPE_AGGREGATE_EXCLUSIVE_REQUIRED/u);
  assert.match(SQL, /RENT_GOODS_AGGREGATE_SOURCE_NOT_EXCLUSIVE/u);
  assert.match(SQL, /RENT_GOODS_AGGREGATE_POST_NOT_EXCLUSIVE/u);
  assert.match(SQL, /'전체 상품 취급\(풀필먼트\)'[\s\S]{0,500}jsonb_array_length/u);
  assert.match(SQL, /'종합상품'[\s\S]{0,500}jsonb_array_length/u);
});
