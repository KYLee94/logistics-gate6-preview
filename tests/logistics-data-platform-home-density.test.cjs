const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const source = fs.readFileSync(
  path.resolve(__dirname, '../src/features/logistics-data-platform/LogisticsDataPlatform.jsx'),
  'utf8',
);

test('홈 상단은 카드 격자 없이 하나의 연속형 자산 브리프로 구성한다', () => {
  assert.match(source, /function\s+AssetBrief\s*\(/u);
  assert.match(source, /data-testid=["']home-asset-brief["']/u);
  assert.match(source, /data-testid=["']home-asset-brief-masthead["']/u);
  assert.match(source, /data-testid=["']home-asset-specification["']/u);
  assert.match(source, /data-testid=["']home-lease-operations["']/u);
  assert.match(source, /aria-labelledby=["']home-asset-brief-title["']/u);
  assert.match(source, /xl:grid-cols-\[minmax\(0,1fr\)_minmax\(280px,0\.38fr\)\]/u);

  for (const section of ['기본정보', '면적', '담당 · 가치']) {
    assert.ok(source.includes(section), `연속 명세 구획 누락: ${section}`);
  }
  assert.doesNotMatch(source, /data-testid=["']home-asset-overview-grid["']/u);
  assert.doesNotMatch(source, /data-testid=["']home-tenant-summary["']/u);
  assert.doesNotMatch(source, /data-home-group=\{group\}/u);
});

test('임대 운영 요약은 점유율 막대와 실제 임차인명·공실·운영 수치를 선형 정보로 표시한다', () => {
  assert.match(source, /row\.occupancy_status === ["']occupied["']/u);
  assert.match(source, /row\.occupancy_status === ["']planned["']/u);
  assert.match(source, /row\.monthly_rent_total_krw/u);
  assert.match(source, /row\.monthly_cam_total_krw/u);
  assert.match(source, /role=["']progressbar["']/u);
  assert.match(source, /aria-valuenow=\{occupancyPercent\}/u);
  assert.match(source, /const\s+tenantSummaries\s*=\s*\[\.\.\.tenantMap\.values\(\)\]/u);
  assert.match(source, /tenant\.leased_area_sqm/u);
  assert.match(source, /tenant\.monthly_rent_total_krw/u);
  for (const label of ['임대율', '임차인', '점유 공간', '공실 공간', '입주 예정', '임대면적', '월 임대료', '월 관리비', '평균 E.NOC\/평']) {
    assert.ok(source.includes(label), `임차 현황 항목 누락: ${label}`);
  }
  assert.match(source, /data-testid=["']home-tenant-operations["']/u);
  assert.match(source, /tenantSummaries\.map\(\(tenant\)/u);
});

test('자산 브리프는 기존 편집·저장 계약과 ㎡·평 병기 및 하단 영역을 보존한다', () => {
  assert.match(source, /<AssetBrief[\s\S]*?editing=\{isHomeEditing\}/u);
  assert.match(source, /onAssetChange=\{\(field, value\)/u);
  assert.match(source, /data-testid=["']home-edit["']/u);
  assert.match(source, /data-testid=["']home-cancel["']/u);
  assert.match(source, /data-testid=["']home-save["']/u);
  assert.match(source, /format\s*===\s*["']area["'][\s\S]*?area\(asset\[field\.key\]\)/u);
  assert.match(source, /title=["']펀드·수익증권 투자["']/u);
  assert.match(source, /title=["']대출 현황["']/u);
  assert.match(source, /title=["']다가오는 만기["']/u);
});
