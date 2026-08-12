const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

const css = fs.readFileSync('src/index.css', 'utf8');
const platformSource = fs.readFileSync(
  'src/features/logistics-data-platform/LogisticsDataPlatform.jsx',
  'utf8',
);
const hostSource = fs.readFileSync('src/components/system/PlatformCenter.jsx', 'utf8');

function sourceBetween(startMarker, endMarker) {
  const start = platformSource.indexOf(startMarker);
  const end = platformSource.indexOf(endMarker, start + startMarker.length);
  assert.ok(start >= 0 && end > start, `${startMarker} 범위를 찾을 수 없습니다`);
  return platformSource.slice(start, end);
}

test('데이터 플랫폼의 모든 내부 스크롤은 얇은 다크 스크롤바 계약을 공유한다', () => {
  assert.match(
    css,
    /\.logistics-data-platform\s*,\s*\.logistics-data-platform\s+\*\s*\{[\s\S]*?scrollbar-width:\s*thin;[\s\S]*?scrollbar-color:\s*var\(--data-platform-scrollbar-thumb\)\s+var\(--data-platform-scrollbar-track\);[\s\S]*?\}/u,
  );
  assert.match(
    css,
    /\.logistics-data-platform::?-webkit-scrollbar\s*,\s*\.logistics-data-platform\s+\*::?-webkit-scrollbar\s*\{[\s\S]*?width:\s*8px;[\s\S]*?height:\s*8px;[\s\S]*?\}/u,
  );
  assert.match(
    css,
    /\.logistics-data-platform::?-webkit-scrollbar-track\s*,\s*\.logistics-data-platform\s+\*::?-webkit-scrollbar-track\s*\{[\s\S]*?background:\s*var\(--data-platform-scrollbar-track\);[\s\S]*?\}/u,
  );
  assert.match(
    css,
    /\.logistics-data-platform::?-webkit-scrollbar-thumb\s*,\s*\.logistics-data-platform\s+\*::?-webkit-scrollbar-thumb\s*\{[\s\S]*?background:\s*var\(--data-platform-scrollbar-thumb\);[\s\S]*?border:\s*2px solid var\(--data-platform-scrollbar-track\);[\s\S]*?border-radius:\s*999px;[\s\S]*?\}/u,
  );
  assert.match(css, /--data-platform-scrollbar-thumb-hover:\s*#636366;/u);
  assert.match(css, /-webkit-scrollbar-button[\s\S]*?display:\s*none;[\s\S]*?width:\s*0;[\s\S]*?height:\s*0;/u);
  assert.match(css, /-webkit-scrollbar-corner[\s\S]*?background:\s*var\(--data-platform-scrollbar-track\);/u);
});

test('스크롤바 테마는 데이터 플랫폼 밖의 기존 화면에 전역 적용되지 않는다', () => {
  const newThemeRules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/gu)]
    .filter((match) => `${match[1]} ${match[2]}`.includes('data-platform-scrollbar'));
  assert.ok(newThemeRules.length >= 6, '공통 테마의 각 스크롤바 부분이 독립적으로 정의돼야 한다');
  assert.ok(newThemeRules.every((match) => (
    match[1].includes('.logistics-data-platform')
    || match[1].includes('.logistics-data-platform-scroll-host')
  )));
  assert.doesNotMatch(css, /(?:^|[},]\s*)(?:html|body|\*)\s*::?-webkit-scrollbar/u);
});

test('렌트롤·드롭다운·모달·다중선택·재무 표는 다크 스크롤 계약을 유지한다', () => {
  assert.match(
    platformSource,
    /data-testid=["']logistics-data-platform["'][\s\S]*?className=["'][^"']*logistics-data-platform/u,
  );
  const goodsTooltip = sourceBetween('function GoodsInfoTooltip', 'function AddableMultiSelectCell');
  assert.match(goodsTooltip, /createPortal\(/u);
  assert.match(goodsTooltip, /role=["']tooltip["']/u);
  assert.match(goodsTooltip, /fixed[\s\S]*?bg-\[#161616\]/u);
  assert.match(goodsTooltip, /max-h-\[calc\(100vh-24px\)\][\s\S]*?overflow-y-auto/u);
  assert.match(goodsTooltip, /document\.body/u);

  const rentFreeDialog = sourceBetween('function RentFreePeriodsDialog', 'function PresetTextCell');
  assert.match(rentFreeDialog, /role=["']dialog["'][\s\S]*?overflow-y-auto/u);

  const multiSelect = sourceBetween('function AddableMultiSelectCell', 'function MultiSelectCell');
  assert.match(multiSelect, /<details[\s\S]*?max-h-52[^"']*overflow-y-auto/u);

  const rentRoll = sourceBetween('function RentRollPanel', 'function periodFor');
  assert.match(rentRoll, /custom-scrollbar[^"']*overflow-auto[\s\S]*?data-testid=["']rent-roll-table["']/u);

  const finance = sourceBetween('function FinancePanel', 'export default function LogisticsDataPlatform');
  assert.match(finance, /data-testid=["']finance-comparison-controls["'][\s\S]*?max-h-64[^"']*overflow-y-auto/u);
  assert.match(finance, /data-testid=["']finance-period-summary["']/u);
  assert.match(finance, /data-testid=["']finance-statement-scroll["'][\s\S]*?custom-scrollbar[^"']*max-h-\[calc\(100vh-190px\)\][^"']*overflow-auto/u);
});

test('데이터 플랫폼 탭 본문은 우측 다크 스크롤을 표시하고 기존 화면만 숨김 계약을 유지한다', () => {
  assert.match(
    hostSource,
    /isDataPlatformPath[\s\S]*?overflow-y-scroll logistics-data-platform-scroll-host[\s\S]*?overflow-y-auto hide-scrollbar/u,
  );
  assert.match(css, /\.logistics-data-platform-scroll-host[\s\S]*?scrollbar-width:\s*thin/u);
  assert.match(css, /\.logistics-data-platform-scroll-host::?-webkit-scrollbar[\s\S]*?width:\s*8px/u);
  const genericCustomScrollbar = css.indexOf('.custom-scrollbar::-webkit-scrollbar');
  const genericThinScrollbar = css.indexOf('.custom-thin-scrollbar::-webkit-scrollbar');
  const platformScrollbar = css.indexOf('.logistics-data-platform::-webkit-scrollbar');
  assert.ok(genericCustomScrollbar >= 0 && genericCustomScrollbar < platformScrollbar);
  assert.ok(genericThinScrollbar >= 0 && genericThinScrollbar < platformScrollbar);
});

test('네이티브 select 팝업은 운영체제 경계에서도 다크 color-scheme을 요청한다', () => {
  assert.match(
    css,
    /\.logistics-data-platform input,\s*\.logistics-data-platform select,\s*\.logistics-data-platform textarea\s*\{[\s\S]*?color-scheme:\s*dark;[\s\S]*?\}/u,
  );
  assert.match(
    css,
    /\.logistics-data-platform option\s*\{[\s\S]*?background-color:\s*#252524;[\s\S]*?color:\s*#FFFFFF;[\s\S]*?\}/u,
  );
});
