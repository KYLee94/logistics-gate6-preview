const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const source = fs.readFileSync(
  path.resolve(__dirname, '../src/features/logistics-data-platform/LogisticsDataPlatform.jsx'),
  'utf8',
);
const stackingSource = fs.readFileSync(
  path.resolve(__dirname, '../src/components/system/workspace/StackingPlan.jsx'),
  'utf8',
);
const workspaceSource = fs.readFileSync(
  path.resolve(__dirname, '../src/components/system/workspace/WorkspaceLogistics.jsx'),
  'utf8',
);

test('홈 상단은 자산 개요·임대 운영·층별 배치의 세 개 세로 열로 구성한다', () => {
  assert.match(source, /function\s+AssetBrief\s*\(/u);
  assert.match(source, /data-testid=["']home-asset-brief["']/u);
  assert.match(source, /data-testid=["']home-asset-brief-masthead["']/u);
  assert.match(source, /data-testid=["']home-asset-overview["']/u);
  assert.match(source, /data-testid=["']home-lease-operations["']/u);
  assert.match(source, /data-testid=["']home-stacking-plan["']/u);
  assert.match(source, /aria-labelledby=["']home-asset-brief-title["']/u);
  assert.match(source, /xl:grid-cols-\[minmax\(0,0\.9fr\)_minmax\(0,0\.85fr\)_minmax\(280px,1\.25fr\)\]/u);

  const briefFields = source.slice(
    source.indexOf('const HOME_ASSET_OVERVIEW_FIELDS'),
    source.indexOf('function AssetBrief'),
  );
  for (const label of ['자산명', '주소', '용도지역', '대지면적', '건축면적', '연면적', '임대가능면적', '주용도', '건폐율', '용적률', '층수', '구조', '주차대수', '준공일']) {
    assert.ok(briefFields.includes(label), `자산 개요 필드 누락: ${label}`);
  }
  for (const removed of ['자산 코드', '섹터', '기준 통화', '담당팀', '담당자', '취득가', '현재 평가액', '건축물대장']) {
    assert.equal(briefFields.includes(removed), false, `제거 대상 필드 잔존: ${removed}`);
  }
  assert.doesNotMatch(source, /data-testid=["']home-asset-overview-grid["']/u);
  assert.doesNotMatch(source, /data-testid=["']home-tenant-summary["']/u);
  assert.doesNotMatch(source, /data-home-group=\{group\}/u);
});

test('임대 운영은 임대율과 월 임대료·관리비 총액 및 평단가를 정렬해 표시한다', () => {
  assert.match(source, /row\.occupancy_status === ["']occupied["']/u);
  assert.match(source, /row\.occupancy_status === ["']planned["']/u);
  assert.match(source, /row\.monthly_rent_total_krw/u);
  assert.match(source, /row\.monthly_cam_total_krw/u);
  assert.match(source, /role=["']progressbar["']/u);
  assert.match(source, /aria-valuenow=\{occupancyPercent\}/u);
  assert.match(source, /const\s+tenantSummaries\s*=\s*\[\.\.\.tenantMap\.values\(\)\]/u);
  assert.match(source, /tenant\.leased_area_sqm/u);
  assert.match(source, /tenant\.monthly_rent_total_krw/u);
  assert.match(source, /const\s+averageRentPerPy\s*=/u);
  assert.match(source, /const\s+averageCamPerPy\s*=/u);
  assert.match(source, /maximumFractionDigits:\s*0/u);
  for (const label of ['임대율', '임차인', '점유 공간', '공실 공간', '입주 예정', '임대면적', '월 임대료 총액', '임대료\/평', '월 관리비 총액', '관리비\/평', '평균 E.NOC\/평']) {
    assert.ok(source.includes(label), `임차 현황 항목 누락: ${label}`);
  }
  assert.match(source, /data-testid=["']home-tenant-operations["']/u);
  assert.match(source, /tenantSummaries\.map\(\(tenant\)/u);
  assert.match(source, /grid-cols-\[minmax\(0,1fr\)_minmax\(90px,auto\)_minmax\(90px,auto\)\]/u);
});

test('자산 브리프는 기존 편집·저장 계약과 ㎡·평 병기 및 하단 영역을 보존한다', () => {
  assert.match(source, /<AssetBrief[\s\S]*?editing=\{isHomeEditing\}/u);
  assert.match(source, /onAssetChange=\{\(field, value\)/u);
  assert.match(source, /data-testid=["']home-edit["']/u);
  assert.match(source, /data-testid=["']home-cancel["']/u);
  assert.match(source, /data-testid=["']home-save["']/u);
  assert.match(source, /formatHomeOverviewValue\(field, asset\[field\.key\]\)/u);
  assert.match(source, /buildStackingFloorsFromRows\(\s*occupiedRows,\s*\[\],\s*\)/u);
  assert.doesNotMatch(source, /overviewForAsset|stackingPlanForAsset/u);
  assert.match(source, /title=["']펀드·수익증권 투자["']/u);
  assert.match(source, /title=["']대출 현황["']/u);
  assert.match(source, /title=["']다가오는 만기["']/u);
});

test('기존 화면과 신규 홈은 하나의 공용 적층도 구현을 사용하고 정적 자산 JSON에 의존하지 않는다', () => {
  assert.match(stackingSource, /export function\s+StackingPlan\s*\(/u);
  assert.match(stackingSource, /export function\s+buildStackingFloorsFromRows\s*\(/u);
  assert.doesNotMatch(stackingSource, /logisticsAssetData|STATIC_STACKING|STATIC_ASSET/u);
  assert.match(workspaceSource, /import\s*\{\s*StackingPlan,\s*buildStackingFloorsFromRows\s*\}\s*from\s*["']\.\/StackingPlan["']/u);
  assert.doesNotMatch(workspaceSource, /function\s+StackingPlan\s*\(/u);
  assert.doesNotMatch(workspaceSource, /function\s+buildStackingFloorsFromRows\s*\(/u);
});

test('층별 배치의 임차 구획은 호버와 키보드 포커스로 운영 세부정보를 보여준다', () => {
  assert.match(stackingSource, /["']data-testid["']:\s*["']stacking-plan-tenant["']/u);
  assert.match(stackingSource, /data-testid=["']stacking-plan-tooltip["']/u);
  assert.match(stackingSource, /group-hover\/tenant:opacity-100/u);
  assert.match(stackingSource, /group-focus-within\/tenant:opacity-100/u);
  assert.match(stackingSource, /aria-describedby/u);
  for (const label of ['임차인', '층·구역', '임대면적', '월 임대료', '월 관리비', '월 합계']) {
    assert.ok(stackingSource.includes(label), `층별 배치 툴팁 항목 누락: ${label}`);
  }
});

test('임대율은 서버 점유 요약을 우선하고 임대가능면적이 없으면 연면적을 분모로 사용한다', () => {
  assert.match(source, /sourceData\.tenant_summary/u);
  assert.match(source, /occupied_area_sqm/u);
  assert.match(source, /active_tenant_count/u);
  assert.match(source, /asset\?\.leasable_area_sqm[\s\S]{0,120}asset\?\.gross_area_sqm/u);
  assert.match(source, /occupancyRate\s*=\s*[^;]+>\s*0\s*\?[^;]+\/[^;]+\*\s*100\s*:\s*null/u);
});

test('층별 배치 툴팁은 자산 브리프 바깥에서도 잘리지 않는다', () => {
  const assetBrief = source.slice(source.indexOf('function AssetBrief'), source.indexOf('const HOME_ENTITY_CONFIG'));
  assert.match(assetBrief, /data-testid=["']home-asset-brief["'][\s\S]{0,180}overflow-visible/u);
});

test('층별 배치는 자산 브리프 오른쪽 열 폭 안에서 적응하고 툴팁 가시성을 유지한다', () => {
  const assetBrief = source.slice(source.indexOf('function AssetBrief'), source.indexOf('const HOME_ENTITY_CONFIG'));
  assert.match(
    assetBrief,
    /data-testid=["']home-stacking-plan["'][\s\S]{0,220}min-w-0[\s\S]{0,80}max-w-full[\s\S]{0,80}overflow-visible/u,
  );
  assert.match(stackingSource, /data-testid=["']stacking-plan-layout["']/u);
  assert.match(stackingSource, /grid-cols-\[52px_minmax\(0,1fr\)\]/u);
  assert.match(stackingSource, /data-testid=["']stacking-plan-track["'][\s\S]{0,220}w-full[\s\S]{0,80}min-w-0[\s\S]{0,80}max-w-full[\s\S]{0,80}overflow-visible/u);
  assert.match(stackingSource, /flexGrow:/u);
  assert.match(stackingSource, /flexBasis:\s*0/u);
  assert.doesNotMatch(stackingSource, /style:\s*\{\s*width:/u);
  assert.match(stackingSource, /data-testid=["']stacking-plan-tooltip["']/u);
  assert.match(stackingSource, /group-focus-within\/tenant:visible/u);
});
