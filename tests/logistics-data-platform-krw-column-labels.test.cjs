'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..');
const platformSource = fs.readFileSync(
  path.join(ROOT, 'src/features/logistics-data-platform/LogisticsDataPlatform.jsx'),
  'utf8',
);
const rentRollSource = fs.readFileSync(
  path.join(ROOT, 'src/features/logistics-data-platform/rentRollSchema.js'),
  'utf8',
);
const maturitySource = fs.readFileSync(
  path.join(ROOT, 'src/features/logistics-data-platform/maturityPresentation.js'),
  'utf8',
);
const stackingSource = fs.readFileSync(
  path.join(ROOT, 'src/components/system/workspace/StackingPlan.jsx'),
  'utf8',
);

test('AUM 기준일 tooltip은 사용자가 지정한 한국어 문구를 정확히 표시한다', () => {
  assert.match(
    platformSource,
    /const HOME_FUND_AUM_INFO = "2026년 07월 31일 기준";/u,
  );
});

test('홈의 모든 원화 금액 제목은 원 단위를 표시하고 비율 제목은 원 단위를 붙이지 않는다', () => {
  for (const label of [
    'AUM(원)',
    '약정액(원)',
    '투입액(원)',
    '월 임대료 총액(원)',
    '임대료/평(원)',
    '월 관리비 총액(원)',
    '관리비/평(원)',
    '평균 E.NOC/평(원)',
    '월 임대료(원)',
  ]) {
    assert.ok(platformSource.includes(label), `홈 원화 제목 누락: ${label}`);
  }

  assert.match(
    platformSource,
    /"Coupon",\s*"All-in",\s*"수수료"/u,
  );
  assert.doesNotMatch(platformSource, /Coupon\(원\)|All-in\(원\)|수수료\(원\)/u);
});

test('렌트롤의 모든 원화 필드는 제목에 원 단위를 표시한다', () => {
  const expectedByKey = new Map([
    ['deposit_total_krw', '보증금 합계(원)'],
    ['deposit_per_py_krw', '보증금/평(원)'],
    ['monthly_rent_total_krw', '월 임대료(원)'],
    ['rent_per_py_krw', '임대료/평(원)'],
    ['monthly_cam_total_krw', '월 관리비(원)'],
    ['cam_per_py_krw', '관리비/평(원)'],
    ['pallet_rack_fee', '랙 사용료(원)'],
    ['pallet_rack_fee_per_py', '랙 사용료/평(원)'],
    ['current_total_cost_per_py_krw', 'E.NOC/평(원)'],
    ['effective_rent', '실효 임대료(원)'],
    ['fit_out_amount', 'Fit-out 금액(원)'],
    ['tenant_improvement_amount', 'TI 지원금(원)'],
  ]);

  for (const [key, label] of expectedByKey) {
    const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
    assert.match(
      rentRollSource,
      new RegExp(`column\\('${key}',\\s*'${escapedLabel}'`, 'u'),
      `렌트롤 원화 제목 누락: ${key}`,
    );
  }
});

test('수익비용 월 입력 열과 자산 비교 금액 열은 원 단위를 표시한다', () => {
  assert.match(platformSource, /\{period\}\s*\(원\)/u);
  assert.match(platformSource, /\{selectedAssetName\}\s*\(원\)/u);
  assert.match(platformSource, /\{result\.assetName\}\s*\(원\)/u);
});

test('금액 상세 표시 라벨도 원 단위를 일관되게 표시한다', () => {
  for (const label of ['보증금(원)', '월 임대료(원)', '월 관리비(원)', '약정액(원)', '대출잔액(원)']) {
    assert.ok(maturitySource.includes(label), `만기 상세 원화 라벨 누락: ${label}`);
  }
  for (const label of ['월 임대료(원)', '월 관리비(원)', '월 합계(원)']) {
    assert.ok(stackingSource.includes(label), `층별 배치 원화 라벨 누락: ${label}`);
  }
});
