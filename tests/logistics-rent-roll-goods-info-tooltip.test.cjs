'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { pathToFileURL } = require('node:url');

const ROOT = path.resolve(__dirname, '..');
const SCHEMA_PATH = path.join(ROOT, 'src/features/logistics-data-platform/rentRollSchema.js');
const FRONTEND_PATH = path.join(ROOT, 'src/features/logistics-data-platform/LogisticsDataPlatform.jsx');

const EXPECTED_INFO = Object.freeze({
  '가구·인테리어': '포함: 거실·침실·주방가구, 침구, 커튼·블라인드, 인테리어소품, DIY 인테리어 자재·원예용품. 제외: 디지털·가전, 일상 소모품, 가정용 공구.',
  '기타 공산품': '포함: 다른 분류에 속하지 않는 산업용 기계·부품, 금속·플라스틱·종이·포장제품, 문구·완구·스포츠용품, 신발·가방. 제외: 나머지 9개 분류에 해당하는 상품.',
  '디지털·가전': '포함: 컴퓨터·주변기기, 통신·영상·음향기기, 생활·주방가전, 저장·네트워크·카메라. 제외: 웨이퍼·반도체 칩·IC.',
  '반도체': '포함: 웨이퍼, 반도체 칩·IC·메모리, 반도체 모듈. 제외: 완제품 전자기기·가전.',
  '식품·음료': '포함: 가공식품, 신선 농축수산물, 유제품, 냉동·즉석식품, 음료·주류. 제외: 의약품, 화장품.',
  '의류': '포함: 패션의류, 스포츠웨어, 속옷, 유아동의류, 한복, 홈웨어. 제외: 신발·가방·시계 등 패션잡화.',
  '의약품': '포함: 전문·일반의약품, 의약외품, 의료용품·기기. 제외: 건강식품, 화장품.',
  '일상용품': '포함: 생활·세탁·위생·청소·욕실·주방용품, 영유아·반려동물용품, 가정용 공구·자동차용품, 일용잡화. 제외: 화장품, 의약품·의료용품, 식품, 가전, 가구.',
  '종합상품': '포함: 서로 다른 여러 상품군을 함께 취급하는 풀필먼트·종합유통 화물. 제외: 주요 상품군을 특정할 수 있는 단일·소수 상품군.',
  '화장품': '포함: 스킨케어, 색조, 헤어·바디케어, 향수. 제외: 세탁·청소용품, 의약품·의약외품.',
});

test('주요 취급 화물 10종은 저장값과 분리된 정확한 포함·제외 설명을 가진다', async () => {
  const {
    addRentRollGoodsType,
    RENT_ROLL_GOODS_INFO,
    RENT_ROLL_GOODS_OPTIONS,
    serializeRentRollGoodsTypes,
    toggleRentRollGoodsType,
  } = await import(
    `${pathToFileURL(SCHEMA_PATH).href}?goods-info=${Date.now()}`
  );
  assert.deepEqual(RENT_ROLL_GOODS_INFO, EXPECTED_INFO);
  assert.deepEqual(Object.keys(RENT_ROLL_GOODS_INFO), RENT_ROLL_GOODS_OPTIONS);
  const persisted = ['화장품', '사용자 추가값', '의류'];
  assert.deepEqual(serializeRentRollGoodsTypes(persisted), persisted);
  assert.deepEqual(toggleRentRollGoodsType(persisted, '종합상품'), ['종합상품']);
  assert.deepEqual(toggleRentRollGoodsType(['종합상품'], '의약품'), ['의약품']);
  assert.deepEqual(addRentRollGoodsType(['종합상품'], '사용자 추가값'), ['사용자 추가값']);
  assert.deepEqual(toggleRentRollGoodsType(persisted, '의류'), ['화장품', '사용자 추가값']);
});

test('정보 아이콘은 hover와 keyboard focus만 열고 click sticky와 checkbox toggle을 막는다', () => {
  const source = fs.readFileSync(FRONTEND_PATH, 'utf8');
  const start = source.indexOf('function GoodsInfoTooltip');
  const end = source.indexOf('function AddableMultiSelectCell', start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  const tooltip = source.slice(start, end);

  assert.match(tooltip, /role="tooltip"/u);
  assert.match(tooltip, /aria-describedby=\{tooltipId\}/u);
  assert.match(tooltip, /onPointerEnter=\{openTooltip\}/u);
  assert.match(tooltip, /onPointerLeave=\{closeTooltip\}/u);
  assert.match(tooltip, /matches\(":focus-visible"\)/u);
  assert.match(tooltip, /onBlur=\{closeTooltip\}/u);
  assert.match(tooltip, /event\.preventDefault\(\)/u);
  assert.match(tooltip, /event\.stopPropagation\(\)/u);
  assert.match(tooltip, /event\.currentTarget\.blur\(\)/u);
  assert.doesNotMatch(tooltip, /focus-within/u);
});

test('기본 10종에만 설명 아이콘을 연결하고 custom 항목과 저장 serializer는 그대로 둔다', () => {
  const source = fs.readFileSync(FRONTEND_PATH, 'utf8');
  const start = source.indexOf('function AddableMultiSelectCell');
  const end = source.indexOf('function MultiSelectCell', start);
  const component = source.slice(start, end);

  assert.match(component, /optionInfo\?\.\[option\]/u);
  assert.match(component, /<GoodsInfoTooltip[\s\S]*?description=\{optionInfo\[option\]\}/u);
  assert.match(component, /serializeItems\(items\)/u);
  assert.doesNotMatch(component, /serializeItems\([^)]*RENT_ROLL_GOODS_INFO/u);
  assert.match(source, /optionInfo=\{RENT_ROLL_GOODS_INFO\}/u);
  assert.match(source, /toggleItems=\{toggleRentRollGoodsType\}/u);
  assert.match(source, /addItem=\{addRentRollGoodsType\}/u);
});
