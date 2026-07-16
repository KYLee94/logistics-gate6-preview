const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..');
const WORKSPACE_PATH = path.join(ROOT, 'src', 'components', 'system', 'workspace', 'WorkspaceLogistics.jsx');

function workspaceSource() {
  return fs.readFileSync(WORKSPACE_PATH, 'utf8');
}

test('work-platform header keeps the compact search, quick-tab, and asset-grid contract', () => {
  const source = workspaceSource();
  const headerStart = source.indexOf('<section className="mb-4 rounded-[24px]');
  const taskBoardStart = source.indexOf('<LogisticsTaskBoard', headerStart);

  assert.ok(headerStart >= 0 && taskBoardStart > headerStart, 'work-platform header card must be present');
  const header = source.slice(headerStart, taskBoardStart);

  assert.match(header, /lg:grid-cols-\[minmax\(0,65fr\)_minmax\(280px,35fr\)\]/u);
  assert.match(header, /data-testid="logistics-main-search-panel"/u);
  assert.match(header, /<label[^>]*text-\[15px\][^>]*>통합 검색<\/label>/u);
  assert.match(header, /data-testid="logistics-main-search-input"/u);
  assert.match(header, /className="h-10 min-w-0 flex-1/u);
  assert.match(header, /event\.key === 'Enter'[\s\S]{0,180}setSelectedSearchResult\(searchResults\[0\]\)/u);
  assert.match(header, /data-work-platform-quick-tabs="true"/u);
  assert.match(header, /data-testid="logistics-managed-assets-grid"/u);
  assert.doesNotMatch(header, />빠른 탭<\/div>/u);
  assert.doesNotMatch(header, /\{quickTabs\.length\}\/\{WORK_PLATFORM_QUICK_TAB_LIMIT\}/u);
  assert.match(header, /onDragStart=/u);
  assert.match(header, /moveQuickTab\(quickTabKeyFromDragEvent\(event\), item\.key\)/u);
  assert.match(header, /removeQuickTab\(item\.key\)/u);
  assert.match(header, /좌측 메뉴에서 자주 쓰는 탭을 끌어오세요\./u);
  assert.match(source, /workPlatformQuickTabCacheKey\(quickTabCacheIdentity\)/u);
  assert.match(source, /memberInfo\?\.auth_subject/u);
  assert.match(source, /localStorage\.removeItem\(WORK_PLATFORM_QUICK_TAB_CACHE_KEY\)/u);
  assert.match(header, /xl:grid-cols-9/u);
  assert.doesNotMatch(header, /<MemberAvatar\b/u);
  assert.doesNotMatch(header, /담당 펀드 \{permission\.managedFunds\.length\}개/u);
  assert.doesNotMatch(header, /topAssets\.map\([\s\S]{0,500}min-h-\[/u);
});
