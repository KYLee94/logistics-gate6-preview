'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
const sectorSource = read('src/components/system/workspace/LogisticsSectorModules.jsx');
const taskBoardSource = read('src/components/system/workspace/LogisticsTaskBoard.jsx');
const workspaceSource = read('src/components/system/workspace/WorkspaceLogistics.jsx');
const navigationSource = read('src/components/system/IotaLeftNav.jsx');
const digitalWorkspaceSource = read('src/components/system/workspace/WorkspaceDigital.jsx');

function between(source, startText, endText) {
  const start = source.indexOf(startText);
  const end = source.indexOf(endText, start + startText.length);
  assert.notEqual(start, -1, `${startText} 시작점을 찾지 못했습니다.`);
  assert.notEqual(end, -1, `${endText} 종료점을 찾지 못했습니다.`);
  return source.slice(start, end);
}

test('지도 ResizeObserver는 지도 교체와 컴포넌트 해제 때 disconnect된다', () => {
  const clearResize = between(sectorSource, 'const clearMapResizeObserver', 'const clearNaverListeners');
  assert.match(clearResize, /mapResizeObserverRef\.current\?\.disconnect\?\.\(\)/u);
  assert.match(sectorSource, /useEffect\(\(\) => \{\s*return \(\) => \{\s*destroyCurrentMapRef\.current\?\.\(\)/u);
});

test('외부 내비게이션은 새 창 opener를 차단하고 실제 button으로 키보드 접근된다', () => {
  const subNavigation = between(navigationSource, '{item.subItems.map(sub => {', '{/* 워크스페이스 영역 */}');
  assert.match(subNavigation, /<button[\s\S]*type="button"/u);
  assert.match(subNavigation, /window\.open\(sub\.externalUrl, '_blank', 'noopener,noreferrer'\)/u);
  assert.doesNotMatch(subNavigation, /<div[\s\S]*window\.open/u);
});

test('상태 updater는 화면 측정이나 localStorage 쓰기 같은 부수효과를 실행하지 않는다', () => {
  const taskToggle = between(taskBoardSource, 'aria-expanded={open}', 'className={`flex w-full');
  const quickTabs = between(workspaceSource, 'const persistQuickTabKeys', 'const addQuickTab');
  const dismissFinding = between(workspaceSource, 'const dismissFinding', 'const requestEditForFinding');

  assert.doesNotMatch(taskToggle, /setOpen\(\(current\) => \{[\s\S]*updateMenuRect/u);
  assert.doesNotMatch(quickTabs, /setQuickTabKeys\(\(current\) => \{[\s\S]*localStorage\.setItem/u);
  assert.doesNotMatch(dismissFinding, /setDismissedFindingIds\(\(current\) => \{[\s\S]*localStorage\.setItem/u);
});

test('공용 대화상자는 보이는 제목으로 접근 가능한 이름을 가진다', () => {
  const marketModal = between(sectorSource, 'function Modal({', 'function FilterPills');
  const detailModal = between(workspaceSource, 'function LogisticsModal(', 'function TenantContractFullView');
  const mainOverlay = between(workspaceSource, 'function MainOverlay(', 'function PermissionDetailContent');

  for (const dialog of [marketModal, detailModal, mainOverlay]) {
    assert.match(dialog, /role="dialog"/u);
    assert.match(dialog, /aria-label=\{(?:modal\.)?title\}/u);
  }
});

test('데이터 관리 열 너비 손잡이는 키보드로도 조절할 수 있다', () => {
  assert.match(sectorSource, /const resizeColumnFromKeyboard = \(event, column, fallback = 170\)/u);
  const handles = [];
  let cursor = 0;
  while ((cursor = sectorSource.indexOf('role="separator"', cursor)) >= 0) {
    const start = sectorSource.lastIndexOf('<span', cursor);
    const end = sectorSource.indexOf('/>', cursor);
    if (start >= 0 && end >= 0) handles.push(sectorSource.slice(start, end + 2));
    cursor += 'role="separator"'.length;
  }
  assert.ok(handles.length >= 3, '열 너비 손잡이 3개를 찾지 못했습니다.');
  for (const handle of handles.slice(-3)) {
    assert.match(handle, /tabIndex=\{0\}/u);
    assert.match(handle, /aria-valuemin=\{90\}/u);
    assert.match(handle, /aria-valuemax=\{720\}/u);
    assert.match(handle, /aria-valuenow=\{columnWidthFor\(column/u);
    assert.match(handle, /onKeyDown=\{\(event\) => resizeColumnFromKeyboard/u);
  }
});

test('디지털 업무 동기화는 사용자 브라우저 콘솔에 내부 진행 로그를 남기지 않는다', () => {
  assert.doesNotMatch(digitalWorkspaceSource, /console\.log\(["']Syncing local tasks/u);
});

test('디지털 업무의 초기 조회는 로컬 백업을 Supabase에 자동 INSERT하지 않는다', () => {
  const fetchTasks = between(digitalWorkspaceSource, 'const fetchTasks = async () => {', '    useEffect(() => {');
  assert.doesNotMatch(fetchTasks, /supabase\.from\('iota_digital_tasks'\)\.insert/u);
  assert.match(fetchTasks, /setTasks\(localTasks\);\s*return;/u);
});
