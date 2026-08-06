const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const source = fs.readFileSync(
  path.resolve(__dirname, '../src/features/logistics-data-platform/LogisticsDataPlatform.jsx'),
  'utf8',
);

test('자산 개요는 빈 칸 없이 식별·규모·가치관리 정보를 12열 구조로 정렬한다', () => {
  assert.match(source, /data-testid=["']home-asset-overview-grid["']/u);
  assert.match(source, /grid-cols-12/u);
  for (const group of ['identity', 'scale', 'value-management']) {
    assert.match(source, new RegExp(`group: ["']${group}["']`, 'u'));
  }
  assert.match(source, /data-home-group=\{group\}/u);
});

test('임차 현황은 실제 점유 행만 집계하고 면적·월수익·E.NOC를 한 블록에 표시한다', () => {
  assert.match(source, /row\.occupancy_status === ["']occupied["']/u);
  assert.match(source, /row\.occupancy_status === ["']planned["']/u);
  assert.match(source, /row\.monthly_rent_total_krw/u);
  assert.match(source, /row\.monthly_cam_total_krw/u);
  for (const label of ['임대율', '임차인', '점유 공간', '공실 · 예정', '임대면적', '월 임대료', '월 관리비', '평균 E.NOC/평']) {
    assert.ok(source.includes(label), `임차 현황 항목 누락: ${label}`);
  }
  assert.match(source, /data-testid=["']home-tenant-names["']/u);
});
