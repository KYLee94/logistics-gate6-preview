const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const workspacePath = path.join(
  __dirname,
  '..',
  'src',
  'components',
  'system',
  'workspace',
  'WorkspaceLogistics.jsx',
);
const marketModulesPath = path.join(
  __dirname,
  '..',
  'src',
  'components',
  'system',
  'workspace',
  'LogisticsSectorModules.jsx',
);

const workspaceSource = fs.readFileSync(workspacePath, 'utf8');
const marketModulesSource = fs.readFileSync(marketModulesPath, 'utf8');

function buttonByAriaLabel(source, label) {
  const labelIndex = source.indexOf(`aria-label="${label}"`);
  assert.ok(labelIndex >= 0, `${label} button must exist`);
  const start = source.lastIndexOf('<button', labelIndex);
  const end = source.indexOf('</button>', labelIndex);
  assert.ok(start >= 0 && end >= 0, `${label} button must be complete`);
  return source.slice(start, end + '</button>'.length);
}

function selfClosingElement(source, marker, fromIndex = 0) {
  const start = source.indexOf(marker, fromIndex);
  assert.ok(start >= 0, `${marker} must exist`);
  const end = source.indexOf('/>', start);
  assert.ok(end >= 0, `${marker} must be a self-closing element`);
  return source.slice(start, end + 2);
}

function sourceBetween(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  assert.ok(start >= 0, `${startMarker} must exist`);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.ok(end >= 0, `${endMarker} must exist after ${startMarker}`);
  return source.slice(start, end);
}

test('floor-plan carousel controls keep their geometry and behavior with a contrasting background', () => {
  const previous = buttonByAriaLabel(workspaceSource, '이전 평면도 보기');
  const next = buttonByAriaLabel(workspaceSource, '다음 평면도 보기');

  assert.match(previous, /onClick=\{\(event\) => moveSlide\(-1, event\)\}/u);
  assert.match(next, /onClick=\{\(event\) => moveSlide\(1, event\)\}/u);
  assert.match(previous, /absolute left-3 top-1\/2 flex h-10 w-10/u);
  assert.match(next, /absolute right-3 top-1\/2 flex h-10 w-10/u);

  [previous, next].forEach((control) => {
    assert.match(control, /rounded-full/u);
    assert.match(control, /bg-black\/50/u);
    assert.match(control, /hover:bg-black\/70/u);
    assert.doesNotMatch(control, /bg-white\/25|hover:bg-white\/35/u);
  });
});

test('floor-plan popup zoom is bounded, accessible, and reset when slides change', () => {
  const carousel = sourceBetween(
    workspaceSource,
    'function FloorplanCarousel',
    'function floorplanLabelsFromFloorCount',
  );

  assert.match(workspaceSource, /const FLOORPLAN_ZOOM_MIN = 0\.5;/u);
  assert.match(workspaceSource, /const FLOORPLAN_ZOOM_DEFAULT = 1;/u);
  assert.match(workspaceSource, /const FLOORPLAN_ZOOM_MAX = 3;/u);
  assert.match(workspaceSource, /Math\.min\(FLOORPLAN_ZOOM_MAX, Math\.max\(FLOORPLAN_ZOOM_MIN,/u);
  assert.match(carousel, /useState\(FLOORPLAN_ZOOM_DEFAULT\)/u);
  assert.match(carousel, /setZoom\(FLOORPLAN_ZOOM_DEFAULT\);[\s\S]*setActiveIndex/u);
  assert.match(carousel, /modalMode && imageUrl/u);
  assert.match(carousel, /aria-label="평면도 축소"[\s\S]*title="축소"/u);
  assert.match(carousel, /aria-label="평면도 확대"[\s\S]*title="확대"/u);
  assert.match(carousel, /aria-label="평면도 원래 크기로 복원"[\s\S]*title="원래 크기"/u);
  assert.match(carousel, /<FloorplanLucideIcon name="zoom-out"/u);
  assert.match(carousel, /<FloorplanLucideIcon name="zoom-in"/u);
  assert.match(carousel, /<FloorplanLucideIcon name="rotate-ccw"/u);
  assert.match(workspaceSource, /data-lucide=\{name\}/u);
  assert.match(carousel, /disabled=\{zoom <= FLOORPLAN_ZOOM_MIN\}/u);
  assert.match(carousel, /disabled=\{zoom >= FLOORPLAN_ZOOM_MAX\}/u);
  assert.match(carousel, /data-floorplan-zoom=\{zoom\}/u);
  assert.match(carousel, /disabled=\{isFloorplanAtDefault\}/u);
});

test('floor-plan popup pans at every zoom level and preserves carousel button clicks', () => {
  const carousel = sourceBetween(
    workspaceSource,
    'function FloorplanCarousel',
    'function floorplanLabelsFromFloorCount',
  );

  assert.match(carousel, /const floorplanViewportRef = useRef\(null\);/u);
  assert.match(carousel, /const isPannable = modalMode && Boolean\(imageUrl\);/u);
  assert.match(carousel, /const \[floorplanPanOffset, setFloorplanPanOffset\] = useState\(\{ x: 0, y: 0 \}\);/u);
  assert.match(carousel, /cursor-grab/u);
  assert.match(carousel, /cursor-grabbing/u);
  assert.match(carousel, /onPointerDown=\{handleFloorplanPointerDown\}/u);
  assert.match(carousel, /onPointerMove=\{handleFloorplanPointerMove\}/u);
  assert.match(carousel, /onPointerUp=\{finishFloorplanPointerPan\}/u);
  assert.match(carousel, /onPointerCancel=\{finishFloorplanPointerPan\}/u);
  assert.match(carousel, /const interactiveTarget = event\.target\.closest\?\.\('button, a, input, select, textarea, \[role="button"\]'\);/u);
  assert.match(carousel, /if \(interactiveTarget\) return;[\s\S]*if \(!isPannable/u);
  assert.match(carousel, /setPointerCapture\(event\.pointerId\)/u);
  assert.match(carousel, /scrollLeft = panStart\.scrollLeft - \(event\.clientX - panStart\.clientX\);/u);
  assert.match(carousel, /scrollTop = panStart\.scrollTop - \(event\.clientY - panStart\.clientY\);/u);
  assert.match(carousel, /setFloorplanPanOffset\(\{[\s\S]*x: clampFloorplanPanOffset[\s\S]*y: clampFloorplanPanOffset/u);
  assert.match(carousel, /translate3d\(\$\{floorplanPanOffset\.x\}px, \$\{floorplanPanOffset\.y\}px, 0\) scale\(\$\{zoom\}\)/u);
  assert.match(carousel, /draggable=\{false\}/u);
  assert.match(carousel, /onDragStart=\{\(event\) => event\.preventDefault\(\)\}/u);
  assert.match(carousel, /viewport\.scrollLeft = 0;[\s\S]*viewport\.scrollTop = 0;/u);
  assert.match(carousel, /setFloorplanPanOffset\(\{ x: 0, y: 0 \}\);/u);
  assert.match(carousel, /const moveSlide[\s\S]*resetFloorplanPosition\(\);[\s\S]*setActiveIndex/u);
  assert.match(carousel, /const resetZoom[\s\S]*resetFloorplanPosition\(\);[\s\S]*setZoom\(FLOORPLAN_ZOOM_DEFAULT\)/u);
  assert.match(carousel, /onClick=\{\(event\) => moveSlide\(-1, event\)\}/u);
  assert.match(carousel, /onClick=\{\(event\) => moveSlide\(1, event\)\}/u);
});

test('only the fullscreen floor-plan popup uses the compact media header', () => {
  const logisticsModal = sourceBetween(
    workspaceSource,
    'function LogisticsModal',
    'function TenantContractFullView',
  );
  const floorplanOpen = sourceBetween(
    workspaceSource,
    'title: `${overview.assetName || \'자산\'} 평면도 이미지`',
    'data-testid="asset-3d-model-link"',
  );

  assert.match(logisticsModal, /const isFloorplanModal = modal\.variant === 'floorplan';/u);
  assert.match(logisticsModal, /isFloorplanModal \? 'flex min-h-10/u);
  assert.match(logisticsModal, /aria-label="평면도 팝업 닫기"/u);
  assert.match(logisticsModal, /title="닫기"/u);
  assert.match(logisticsModal, /<FloorplanLucideIcon name="x"/u);
  assert.match(floorplanOpen, /size: 'fullscreen'/u);
  assert.match(floorplanOpen, /variant: 'floorplan'/u);
  assert.match(floorplanOpen, /<FloorplanCarousel[^>]+modalMode/u);
  assert.match(workspaceSource, /data-testid="asset-3d-model-link"/u);
});

test('only the transaction comparison table opens the existing fullscreen modal', () => {
  const transactionSection = marketModulesSource.indexOf('title="거래 사례 비교"');
  assert.ok(transactionSection >= 0, 'transaction comparison section must exist');
  const mapPopup = selfClosingElement(
    marketModulesSource,
    '<MarketMapPanel title="거래 자산 위치"',
    transactionSection,
  );
  const tablePopup = selfClosingElement(
    marketModulesSource,
    '<SortableTable',
    transactionSection,
  );

  assert.doesNotMatch(mapPopup, /fullscreen:\s*true/u);
  assert.match(tablePopup, /onRowClick=\{\(row\) => setModal\(/u);
  assert.match(tablePopup, /fullscreen:\s*true/u);
  assert.match(tablePopup, /width:\s*'max-w-\[calc\(100vw-32px\)\]'/u);
  assert.match(tablePopup, /maxHeight:\s*'calc\(100vh - 150px\)'/u);
  const marketModalStart = marketModulesSource.indexOf('<Modal title={modal?.title}');
  assert.ok(marketModalStart >= 0, 'market data modal must exist');
  const marketModalOpening = marketModulesSource.slice(marketModalStart, marketModalStart + 300);
  assert.match(marketModalOpening, /fullscreen=\{modal\?\.fullscreen\}/u);
});
