const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..');
const WORKSPACE_PATH = path.join(ROOT, 'src', 'components', 'system', 'workspace', 'WorkspaceLogistics.jsx');
const APP_PATH = path.join(ROOT, 'src', 'App.jsx');
const ROUTES_PATH = path.join(ROOT, 'src', 'components', 'system', 'workspace', 'logisticsRoutes.js');
const EDGE_PATH = path.join(ROOT, 'supabase', 'functions', 'll-dashboard-api', 'index.ts');
const MIGRATIONS_PATH = path.join(ROOT, 'supabase', 'migrations');
const WORK_PLATFORM_SMOKE_PATH = path.join(ROOT, 'scripts', 'qa', 'logistics-work-platform-browser-smoke.cjs');
const PACKAGE_PATH = path.join(ROOT, 'package.json');
const PUSH_SW_PATH = path.join(ROOT, 'public', 'logistics-push-sw.js');
const PUSH_UTIL_PATH = path.join(ROOT, 'src', 'utils', 'logisticsPushNotifications.js');
const LEFT_NAV_PATH = path.join(ROOT, 'src', 'components', 'system', 'IotaLeftNav.jsx');
const PUSH_EDGE_PATH = path.join(ROOT, 'supabase', 'functions', 'll-push-notifications', 'index.ts');
const SOURCE_EXTENSIONS = /\.(?:[cm]?js|jsx|tsx?)$/iu;

function walkFiles(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return walkFiles(entryPath);
    return entry.isFile() ? [entryPath] : [];
  });
}

function sourceFiles() {
  return [path.join(ROOT, 'src'), path.join(ROOT, 'public')]
    .flatMap(walkFiles)
    .filter((filePath) => SOURCE_EXTENSIONS.test(filePath));
}

function sourceMatches(predicate) {
  return sourceFiles().flatMap((filePath) => {
    const source = fs.readFileSync(filePath, 'utf8');
    return predicate(source, filePath) ? [{ filePath, source }] : [];
  });
}

function taskBoardComponent() {
  const matches = walkFiles(path.join(ROOT, 'src'))
    .filter((filePath) => /(?:^|[\\/])LogisticsTaskBoard\.(?:jsx?|tsx?)$/u.test(filePath));
  assert.equal(matches.length, 1, 'LogisticsTaskBoard component must be added exactly once under src');
  return { filePath: matches[0], source: fs.readFileSync(matches[0], 'utf8') };
}

function arrayItemsAfter(source, offset) {
  const openingIndex = source.indexOf('[', offset);
  if (openingIndex < 0) return null;

  const items = [];
  let itemStart = openingIndex + 1;
  let nesting = 0;
  let quote = '';
  let escaped = false;

  for (let index = openingIndex + 1; index < source.length; index += 1) {
    const character = source[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === quote) quote = '';
      continue;
    }
    if (character === '\'' || character === '"' || character === '`') {
      quote = character;
      continue;
    }
    if (character === '[' || character === '{' || character === '(') {
      nesting += 1;
      continue;
    }
    if (character === ']' || character === '}' || character === ')') {
      if (character === ']' && nesting === 0) {
        const finalItem = source.slice(itemStart, index).trim();
        if (finalItem) items.push(finalItem);
        return items;
      }
      nesting -= 1;
      continue;
    }
    if (character === ',' && nesting === 0) {
      const item = source.slice(itemStart, index).trim();
      if (item) items.push(item);
      itemStart = index + 1;
    }
  }
  return null;
}

function hasNamedArrayLength(source, patterns, expectedLength) {
  return patterns.some((pattern) => {
    pattern.lastIndex = 0;
    for (let match = pattern.exec(source); match; match = pattern.exec(source)) {
      const items = arrayItemsAfter(source, match.index + match[0].length);
      if (items && items.length === expectedLength) return true;
    }
    return false;
  });
}

function containsButtonLabel(source, labelPattern) {
  const buttons = source.match(/<button\b[\s\S]*?<\/button>/gu) || [];
  return buttons.some((button) => labelPattern.test(button));
}

function taskBoardHandlers(edgeSource) {
  const markers = [
    ...edgeSource.matchAll(/\b(?:async\s+)?function\s+[A-Za-z0-9_]*task[A-Za-z0-9_]*board[A-Za-z0-9_]*\s*\(/giu),
    ...edgeSource.matchAll(/\b(?:const|let)\s+[A-Za-z0-9_]*task[A-Za-z0-9_]*board[A-Za-z0-9_]*\s*=\s*async\b/giu),
  ];
  return markers.map((marker) => edgeSource.slice(marker.index, marker.index + 14000)).join('\n');
}

function taskBoardMigration() {
  const candidates = fs.readdirSync(MIGRATIONS_PATH)
    .filter((fileName) => fileName.endsWith('.sql'))
    .filter((fileName) => {
      const source = fs.readFileSync(path.join(MIGRATIONS_PATH, fileName), 'utf8');
      return /\bll_work_items\b/iu.test(source)
        && /\btask_code\b/iu.test(source)
        && /\btask_category\b/iu.test(source)
        && /\bclient_request_id\b/iu.test(source);
    });
  assert.equal(candidates.length, 1, 'one task-board migration must extend canonical ll_work_items');
  return {
    filePath: path.join(MIGRATIONS_PATH, candidates[0]),
    source: fs.readFileSync(path.join(MIGRATIONS_PATH, candidates[0]), 'utf8'),
  };
}

function taskBoardCommentsMigration() {
  const candidates = fs.readdirSync(MIGRATIONS_PATH)
    .filter((fileName) => fileName.endsWith('.sql'))
    .filter((fileName) => fileName.includes('task_board_comments_status'))
    .filter((fileName) => {
      const source = fs.readFileSync(path.join(MIGRATIONS_PATH, fileName), 'utf8');
      return /\btask_comments\b/iu.test(source) && /\bll_task_board_append_comment\b/iu.test(source);
    });
  assert.equal(candidates.length, 1, 'one task-comment migration must own ll_work_items.task_comments');
  return {
    filePath: path.join(MIGRATIONS_PATH, candidates[0]),
    source: fs.readFileSync(path.join(MIGRATIONS_PATH, candidates[0]), 'utf8'),
  };
}

function taskBoardCommentFollowUpMigration() {
  const candidates = fs.readdirSync(MIGRATIONS_PATH)
    .filter((fileName) => fileName.endsWith('.sql'))
    .filter((fileName) => fileName.includes('task_board_comment_follow_up'));
  assert.equal(candidates.length, 1, 'one task-comment follow-up migration must exist');
  return {
    filePath: path.join(MIGRATIONS_PATH, candidates[0]),
    source: fs.readFileSync(path.join(MIGRATIONS_PATH, candidates[0]), 'utf8'),
  };
}

function taskBoardStatusCompatibilityMigration() {
  const candidates = fs.readdirSync(MIGRATIONS_PATH)
    .filter((fileName) => fileName.endsWith('.sql'))
    .filter((fileName) => fileName.includes('task_board_status_rollback_compatibility'))
    .filter((fileName) => {
      const source = fs.readFileSync(path.join(MIGRATIONS_PATH, fileName), 'utf8');
      return /ll_work_items_task_status_check/iu.test(source)
        && /not valid/iu.test(source)
        && /'진행중'/u.test(source)
        && /'검토중'/u.test(source);
    });
  assert.equal(candidates.length, 1, 'one rollback-compatible task status migration must exist');
  return {
    filePath: path.join(MIGRATIONS_PATH, candidates[0]),
    source: fs.readFileSync(path.join(MIGRATIONS_PATH, candidates[0]), 'utf8'),
  };
}

test('WorkspaceLogistics replaces the legacy home surface with the integrated task board', () => {
  const workspace = fs.readFileSync(WORKSPACE_PATH, 'utf8');

  assert.match(workspace, /import\s+LogisticsTaskBoard\s+from\s+['"][^'"]+['"]/u);
  assert.match(workspace, /<LogisticsTaskBoard\b/u);
  assert.doesNotMatch(workspace, /<WorkspaceActivityLog(?:\s|\/|>)/u);
  assert.doesNotMatch(workspace, /<(?:[A-Za-z0-9_]*AI[A-Za-z0-9_]*Dock|[A-Za-z0-9_]*Ai[A-Za-z0-9_]*Dock)\b/u);
  assert.doesNotMatch(workspace, /<(?:h[1-6]|[A-Za-z0-9_]+)[^>]*>\s*TASK\s*<\//u);

  for (const label of [/관리\s*(?:Project|프로젝트)/iu, /담당/u, /권한/u]) {
    assert.ok(containsButtonLabel(workspace, label), `top header must provide a ${label} button`);
  }
  assert.equal(containsButtonLabel(workspace, /데일리\s*물류\s*뉴스/u), false, 'daily news must use the ticker dropdown instead of a header button');
  assert.match(workspace, /<LogisticsNewsTicker\s*\/>/u);
  assert.match(workspace, /(?:max-w-\[1480px\]|maxWidth\s*:\s*['"]?1480px|width\s*:\s*['"]?1480px)/u);
  assert.match(workspace, /(?:\bmx-auto\b|margin\s*:\s*['"]?0\s+auto|margin(?:Left|Right)\s*:\s*['"]?auto)/u);
});

test('the retired logistics task archive cannot call removed snapshot APIs', () => {
  const app = fs.readFileSync(APP_PATH, 'utf8');
  const routes = fs.readFileSync(ROUTES_PATH, 'utf8');
  const edge = fs.readFileSync(EDGE_PATH, 'utf8');

  assert.doesNotMatch(app, /import\s+WorkspaceArchive\b/u);
  assert.doesNotMatch(app, /<WorkspaceArchive\b/u);
  assert.match(routes, /clean\s*===\s*['"]work-platform\/archive['"][\s\S]{0,160}return\s+LOGISTICS_INTERNAL_BASE/u);
  assert.match(edge, /action\.startsWith\(['"]work-platform\/tasks['"]\)[\s\S]{0,220}fail\(410/u);
  assert.match(edge, /action\.startsWith\(['"]work-platform\/board-posts['"]\)[\s\S]{0,220}fail\(410/u);
});

test('LogisticsTaskBoard exposes the planned board shape and mutation contract', () => {
  const { source } = taskBoardComponent();

  assert.ok(hasNamedArrayLength(source, [
    /\b(?:TASK(?:_BOARD)?|BOARD)_(?:COLUMNS?|COLUMN_OPTIONS)\b\s*=\s*(?:Object\.freeze\s*\()?/giu,
    /\b(?:task(?:Board)?|board)(?:Columns?|ColumnOptions)\b\s*=\s*(?:Object\.freeze\s*\()?/giu,
  ], 7), 'the board must declare the six business columns plus registration date');
  assert.ok(hasNamedArrayLength(source, [
    /\b(?:TASK(?:_BOARD)?|BOARD)_(?:CATEGORIES|CATEGORY_OPTIONS)\b\s*=\s*(?:Object\.freeze\s*\()?/giu,
    /\b(?:task(?:Board)?|board)(?:Categories|CategoryOptions)\b\s*=\s*(?:Object\.freeze\s*\()?/giu,
  ], 8), 'the board must declare exactly eight task categories');
  assert.ok(hasNamedArrayLength(source, [
    /\b(?:TASK(?:_BOARD)?|BOARD)_(?:STATUSES|STATUS_OPTIONS)\b\s*=\s*(?:Object\.freeze\s*\()?/giu,
    /\b(?:task(?:Board)?|board)(?:Statuses|StatusOptions)\b\s*=\s*(?:Object\.freeze\s*\()?/giu,
  ], 5), 'the board must declare exactly five task statuses');
  assert.match(source, /const PAGE_SIZE = 10;/u);
  assert.doesNotMatch(source, /PAGE_SIZE_OPTIONS|간추려보기|자세히보기|20개씩 보기/u);
  for (const category of ['신규 투자 검토', '자산 매각', '파이낸싱', '개발·인허가', '임대·마케팅', '법률·세무 이슈', '기타 자산관리', '기타 리스크 관리']) {
    assert.match(source, new RegExp(`['"]${category}['"]`, 'u'));
  }
  assert.match(source, /data-testid=['"]logistics-task-board-drawer['"]/u);
  assert.match(source, /(?:MAX_(?:TASK_)?SHARES|MAX_SHARED(?:_USERS)?|share(?:d|r)?[A-Za-z_]*\.slice\(0,\s*5\)|share(?:d|r)?[A-Za-z_]*\.length\s*<=\s*5)/u);
  assert.match(source, /recipient_user_ids:\s*\[\]/u);
  assert.match(source, /client_request_id/u);
});

test('LogisticsTaskBoard uses the five approved status labels and the spaced progress label', () => {
  const { source } = taskBoardComponent();
  const edge = fs.readFileSync(EDGE_PATH, 'utf8');
  const { source: migration } = taskBoardCommentsMigration();

  assert.match(source, /const TASK_BOARD_STATUSES = \['예정', '진행 중', '중단', '보류', '완료'\];/u);
  assert.match(source, /const TASK_BOARD_COLUMNS = \[[^\]]*'진행 상황'/u);
  assert.match(source, /<FieldLabel required>진행 상황<\/FieldLabel>/u);
  assert.match(source, /label="진행 상황"/u);
  assert.match(edge, /const TASK_BOARD_STATUSES = new Set\(\['예정', '진행 중', '중단', '보류', '완료'\]\)/u);
  assert.match(migration, /status in \('예정', '진행 중', '중단', '보류', '완료'\)/u);
});

test('task status constraint preserves rollback compatibility without exposing legacy labels', () => {
  const { source: migration } = taskBoardStatusCompatibilityMigration();

  assert.match(migration, /status in \('예정', '진행 중', '중단', '보류', '완료', '진행중', '검토중'\)/u);
  assert.match(migration, /add constraint ll_work_items_task_status_check[\s\S]{0,500}not valid/iu);
  assert.match(migration, /validate constraint ll_work_items_task_status_check/iu);
});

test('task-board maps canonical stakeholder_name throughout API and UI normalization', () => {
  const { source } = taskBoardComponent();
  const edge = fs.readFileSync(EDGE_PATH, 'utf8');
  const publicRowStart = edge.indexOf('function taskBoardPublicRow(');
  const publicRowEnd = edge.indexOf('\nfunction taskBoardText(', publicRowStart);
  assert.ok(publicRowStart >= 0 && publicRowEnd > publicRowStart, 'taskBoardPublicRow must be present');
  const publicRow = edge.slice(publicRowStart, publicRowEnd);

  assert.match(source, /row\.stakeholder_name/u);
  assert.match(source, /stakeholder_name: draft\.stakeholders\.trim\(\)/u);
  assert.match(publicRow, /stakeholder_name:\s*safeText\(row\.stakeholder_name\)/u);
});

test('task form explains required markers and preserves multiline detail text', () => {
  const { source } = taskBoardComponent();
  const edge = fs.readFileSync(EDGE_PATH, 'utf8');

  assert.match(source, /표시는 필수 작성 항목입니다\./u);
  assert.match(source, /whitespace-pre-wrap[^>]*>\{drawer\.task\?\.detail/u);
  assert.match(edge, /function taskBoardMultilineText\(/u);
  assert.match(edge, /description:\s*taskBoardMultilineText\(payload\.description,\s*8000\)/u);
  assert.doesNotMatch(edge, /description:\s*taskBoardText\(payload\.description,\s*8000\)/u);
});

test('task drawer does not expose an internal Task ID or the fixed 업무 상세 heading', () => {
  const { source } = taskBoardComponent();
  const drawerStart = source.indexOf('data-testid="logistics-task-board-drawer"');
  const drawerEnd = source.indexOf('{formMode ? (', drawerStart);
  assert.ok(drawerStart >= 0 && drawerEnd > drawerStart, 'task drawer must be present');
  const drawer = source.slice(drawerStart, drawerEnd);

  assert.doesNotMatch(drawer, /Task ID/u);
  assert.doesNotMatch(drawer, /<h3[^>]*>업무 상세<\/h3>/u);
  assert.match(drawer, /className="min-w-0 flex-1 pr-3"/u);
  assert.match(drawer, /<h3 className="truncate[^>]+title=\{drawer\.task\?\.summary/u);
  assert.match(drawer, /className="flex shrink-0 flex-nowrap gap-2"/u);
  assert.match(drawer, /whitespace-nowrap/u);
});

test('task comments support recursive replies, author edits, idempotency, and get readback', () => {
  const { source } = taskBoardComponent();
  const edge = fs.readFileSync(EDGE_PATH, 'utf8');
  const { source: migration } = taskBoardCommentsMigration();
  const { source: followUp } = taskBoardCommentFollowUpMigration();
  const createStart = edge.indexOf('async function createTaskBoardComment(');
  const createEnd = edge.indexOf('\nfunction validatedTaskBoardFields(', createStart);
  assert.ok(createStart >= 0 && createEnd > createStart, 'createTaskBoardComment must be present');
  const createComment = edge.slice(createStart, createEnd);

  for (const testId of ['logistics-task-board-comments', 'logistics-task-board-comment-input', 'logistics-task-board-reply-input']) {
    assert.match(source, new RegExp(`data-testid=[\"']${testId}[\"']`, 'u'));
  }
  assert.match(source, /parent_comment_id/u);
  assert.match(source, /renderCommentTree/u);
  assert.match(source, /collapsedReplyIds/u);
  assert.match(source, /const canToggleChildren = childComments\.length > 0/u);
  assert.match(source, /`답글 \$\{childComments\.length\}개 펼치기`/u);
  assert.match(source, /work-platform\/task-board\/comments\/create/u);
  assert.match(source, /work-platform\/task-board\/comments\/update/u);
  assert.doesNotMatch(source, /work-platform\/task-board\/comments\/(?:list|delete)/u);
  assert.match(edge, /['"]work-platform\/task-board\/comments\/create['"]/u);
  assert.match(edge, /['"]work-platform\/task-board\/comments\/update['"]/u);
  assert.match(createComment, /taskBoardClientRequestId\(payload\.client_request_id\)/u);
  assert.match(createComment, /id:\s*requestId/u);
  assert.match(createComment, /comments:\s*comments/u);
  assert.match(createComment, /task_comments:\s*comments/u);
  assert.match(edge, /task_comments:\s*Array\.isArray\(row\.task_comments\) \? row\.task_comments : \[\]/u);
  assert.match(migration, /add column if not exists task_comments jsonb default '\[\]'::jsonb/u);
  assert.match(migration, /create or replace function public\.ll_task_board_append_comment\(/u);
  assert.match(migration, /where existing\.comment->>'id' = p_comment->>'id'[\s\S]*return v_comments;/u);
  assert.match(migration, /v_parent_id := nullif\(btrim\(p_comment->>'parent_comment_id'\), ''\)/u);
  assert.doesNotMatch(followUp, /task_comment_reply_depth_exceeded/u);
  assert.match(followUp, /create or replace function public\.ll_task_board_update_comment\(/u);
  assert.match(followUp, /coalesce\(v_comment->>'created_by_user_id', v_comment->>'author_user_id'\)/u);
});

test('standard work-platform browser smoke stays read-only and CRUD is opt-in with finally cleanup', () => {
  const smoke = fs.readFileSync(WORK_PLATFORM_SMOKE_PATH, 'utf8');
  const packageJson = JSON.parse(fs.readFileSync(PACKAGE_PATH, 'utf8'));

  assert.match(smoke, /const shouldExerciseCrud = hasFlag\('exercise-crud'\);/u);
  assert.match(smoke, /if \(shouldExerciseCrud\) \{[\s\S]*await exerciseCrud\(session, report, stamp\);/u);
  assert.match(smoke, /finally \{[\s\S]*await cleanup\(taskCode\);/u);
  assert.match(smoke, /delete from public\.ll_work_items[\s\S]*client_request_id = \$\{sqlString\(taskRequestId\)\}::uuid/u);
  assert.match(smoke, /database_readback/u);
  assert.match(smoke, /physical_cleanup/u);
  assert.match(smoke, /temporary nested reply create failed/u);
  assert.match(smoke, /work-platform\/task-board\/comments\/update/u);
  assert.match(smoke, /has_nested_reply/u);
  assert.match(smoke, /const detailText = `QA detail first line \$\{stamp\}\\nQA detail second line\\n\\nQA detail fourth line`/u);
  assert.match(smoke, /databaseRow\.description !== detailText/u);
  assert.equal(packageJson.scripts['test:work-platform:contract'], 'node --test tests/logistics-task-board-contract.test.cjs');
  assert.equal(packageJson.scripts['qa:work-platform:browser'], 'node scripts/qa/logistics-work-platform-browser-smoke.cjs');
  assert.equal(packageJson.scripts['qa:work-platform:crud-live'], 'node scripts/qa/logistics-work-platform-browser-smoke.cjs --exercise-crud');
});

test('LogisticsTaskBoard keeps the reference table shell with the requested compact controls', () => {
  const { source } = taskBoardComponent();

  assert.match(source, /text-\[20px\][^>]*>통합 업무 보드</u);
  assert.match(source, /w-\[280px\]/u);
  assert.match(source, /rounded-(?:l-)?\[24px\]/u);
  assert.match(source, /bg-\[#252524\]/u);
  assert.match(source, /h-\[46px\]/u);
  assert.match(source, />등록일</u);
  assert.match(source, /formatCreatedDateWithAge\(task\.created_at\)/u);
  assert.doesNotMatch(source, /boardDate/u);
  assert.match(source, /PRIMARY_BLUE_BUTTON_CLASS/u);
  assert.match(source, /ml-auto[^"`]*shrink-0/u);
  assert.match(source, /custom-scrollbar grid min-h-0 flex-1/u);
  assert.match(source, /function HeaderFilterDropdown/u);
  assert.match(source, /role="listbox"/u);
  assert.match(source, /createPortal\(menu, document\.body\)/u);
  assert.match(source, /bg-\[#151515\]/u);
  assert.match(source, /event\.key !== 'Escape'/u);
  assert.match(source, /task-board-filter-menu-\$\{filterKey\}/u);
  assert.match(source, /filterKey="category"/u);
});

test('management Project opens only the full table and requires all four asset permissions to edit', () => {
  const workspace = fs.readFileSync(WORKSPACE_PATH, 'utf8');

  assert.match(workspace, /<WeeklyAssetStatusTable\s+defaultLargeTable\s+onClose=/u);
  assert.match(workspace, /\['read', 'create', 'update', 'delete'\]\.every/u);
  assert.match(workspace, /<MainOverlay[^>]*actions=\{editActions\}/u);
  assert.doesNotMatch(workspace, /<MainOverlay[^>]*관리 Project 현황[\s\S]{0,300}<WeeklyAssetStatusTable\s+defaultLargeTable/u);
});

test('weekly Project replacement requires read, create, update and delete on every asset', () => {
  const edge = fs.readFileSync(EDGE_PATH, 'utf8');
  const replaceStart = edge.indexOf('async function replaceWeeklyAssets');
  const replaceSource = edge.slice(replaceStart, replaceStart + 6000);

  assert.match(replaceSource, /\['read', 'create', 'update', 'delete'\]/u);
  assert.match(replaceSource, /permissions\.some\(\(permission\) => !permission\.allowed\)/u);
});

test('task-board Edge routes enforce CRUD permission checks and return the four-permission contract', () => {
  const edge = fs.readFileSync(EDGE_PATH, 'utf8');
  const handlers = taskBoardHandlers(edge);

  for (const action of ['list', 'get', 'create', 'update', 'delete']) {
    assert.match(edge, new RegExp(`['\"]work-platform/task-board/${action}['\"]`, 'u'));
  }
  assert.ok(handlers, 'task-board routes must be backed by named task-board handlers');
  assert.match(handlers, /canonicalAssetCapability\(ctx\.permission, asset\)/u);
  assert.match(handlers, /hasAllTaskBoardCrud\(capability\)/u);
  for (const permission of ['read', 'create', 'update', 'delete']) {
    assert.match(handlers, new RegExp(`capability\\?\\.${permission}\\s*===\\s*true`, 'u'));
  }
});

test('task-board share mutations materialize task_share notifications', () => {
  const edge = fs.readFileSync(EDGE_PATH, 'utf8');
  const handlers = taskBoardHandlers(edge);

  assert.match(handlers, /task_share/u);
  assert.match(edge, /\.from\(['"]ll_notifications['"]\)/u);
});

test('task-board create reuses the existing task only for a duplicate client request conflict', () => {
  const edge = fs.readFileSync(EDGE_PATH, 'utf8');
  const start = edge.indexOf('async function createTaskBoard(');
  const end = edge.indexOf('\nasync function updateTaskBoard(', start);
  const handler = edge.slice(start, end);

  assert.ok(start >= 0 && end > start, 'createTaskBoard handler must be present');
  assert.match(handler, /if\s*\(\s*error\.code\s*!==\s*['"]23505['"]\s*\)\s*return\s+fail\(500/u);
  assert.match(handler, /if\s*\(\s*error\s*\)\s*\{[\s\S]{0,260}error\.code\s*!==\s*['"]23505['"][\s\S]{0,1300}\.eq\(['"]created_by['"],\s*ctx\.user\.id\)[\s\S]{0,500}\.eq\(['"]client_request_id['"],\s*requestId\)/u);
  assert.match(handler, /reused:\s*true/u);
});

test('push subscriptions reject a different endpoint owner without upserting over it', () => {
  const edge = fs.readFileSync(EDGE_PATH, 'utf8');
  const start = edge.indexOf('async function subscribePushNotifications(');
  const end = edge.indexOf('\nasync function unsubscribePushNotifications(', start);
  const handler = edge.slice(start, end);

  assert.ok(start >= 0 && end > start, 'subscribePushNotifications handler must be present');
  assert.match(handler, /\.from\(['"]ll_notification_subscriptions['"]\)[\s\S]{0,300}\.eq\(['"]endpoint['"],\s*endpoint\)[\s\S]{0,500}\.maybeSingle\(\)/u);
  assert.match(handler, /safeText\(existing\.data\.user_id\)\s*!==\s*ctx\.user\.id[\s\S]{0,300}fail\(409/u);
  assert.match(handler, /if\s*\(\s*error\s*\)\s*\{[\s\S]{0,260}error\.code\s*!==\s*['"]23505['"][\s\S]{0,1200}safeText\(owner\.data\.user_id\)\s*!==\s*ctx\.user\.id[\s\S]{0,300}fail\(409/u);
  assert.doesNotMatch(handler, /\.upsert\(/u);
});

test('task-board migration reuses ll_work_items and protects retained record types', () => {
  const { source: migration } = taskBoardMigration();

  assert.doesNotMatch(migration, /create table(?: if not exists)? public\.ll_(?:task|work_platform_tasks)\b/iu);
  assert.match(migration, /alter table public\.ll_work_items[\s\S]{0,900}add column if not exists task_code\b/iu);
  assert.match(migration, /alter table public\.ll_work_items[\s\S]{0,1600}add column if not exists task_category\b/iu);
  assert.match(migration, /alter table public\.ll_work_items[\s\S]{0,2200}add column if not exists client_request_id\b/iu);
  assert.match(migration, /check\s*\(/iu);
  assert.match(migration, /create index if not exists [\s\S]{0,240}on public\.ll_work_items\s*\([\s\S]{0,240}(?:task_code|task_category|client_request_id)/iu);
  assert.match(migration, /alter table public\.ll_work_items enable row level security/iu);
  assert.match(migration, /revoke all on table public\.ll_notification_subscriptions from anon, authenticated/iu);
  assert.match(migration, /raise exception[\s\S]{0,300}(?:protect|preserv|retain|legacy|보존)/iu);
  assert.doesNotMatch(migration, /\bdrop\b[\s\S]{0,300}\bcascade\b/iu);
  assert.doesNotMatch(migration, /drop table[^;]+public\.ll_work_items/iu);
});

test('service-worker and Windows notification opt-in implementation files are present', () => {
  const registrations = sourceMatches((source) => /navigator\.serviceWorker\.register\(/u.test(source));
  const workers = sourceMatches((source) => /self\.addEventListener\(\s*['"](?:push|notificationclick)['"]/u.test(source)
    && /showNotification\(/u.test(source));
  const optIns = sourceMatches((source) => /Notification\.requestPermission\(\)/u.test(source));

  assert.ok(registrations.length > 0, 'a source file must register the service worker');
  assert.ok(workers.length > 0, 'a service-worker implementation must handle push or notification clicks');
  assert.ok(optIns.length > 0, 'a Windows notification opt-in implementation file must request browser permission');

  const optInSource = optIns.map(({ source }) => source).join('\n');
  assert.match(optInSource, /(?:Notification\.permission|permission)\s*!==\s*['"]granted['"]/u);
  assert.match(optInSource, /notifications\/push\/subscribe/u);

  const pushControls = sourceMatches((source) => /toggleWindowsNotifications/u.test(source));
  const pushControlSource = pushControls.map(({ source }) => source).join('\n');
  assert.match(pushControlSource, /data-testid="logistics-windows-push-toggle"/u);
  assert.match(pushControlSource, /data-testid="logistics-windows-push-message"/u);

  const pushEdge = fs.readFileSync(path.join(ROOT, 'supabase', 'functions', 'll-push-notifications', 'index.ts'), 'utf8');
  const { source: migration } = taskBoardMigration();
  assert.match(pushEdge, /\.rpc\(['"]ll_web_push_runtime_config['"]\)/u);
  assert.doesNotMatch(pushEdge, /Deno\.env\.get\(['"]LL_WEB_PUSH_(?:PUBLIC_KEY|PRIVATE_KEY|WEBHOOK_SECRET|SUBJECT)['"]\)/u);
  assert.match(migration, /grant execute on function public\.ll_web_push_runtime_config\(\) to service_role/u);
  assert.match(migration, /revoke all on function public\.ll_web_push_runtime_config\(\) from public, anon, authenticated/u);

  const secureWebhookMigration = walkFiles(MIGRATIONS_PATH)
    .map((filePath) => fs.readFileSync(filePath, 'utf8'))
    .find((source) => /ll_web_push_gateway_jwt/u.test(source));
  assert.ok(secureWebhookMigration, 'the database webhook must retain Supabase gateway JWT verification');
  assert.match(secureWebhookMigration, /['"]Authorization['"][\s\S]{0,120}['"]Bearer ['"]/u);
});

test('system push supports Windows and macOS and surfaces every delivered notification', () => {
  const worker = fs.readFileSync(PUSH_SW_PATH, 'utf8');
  const utility = fs.readFileSync(PUSH_UTIL_PATH, 'utf8');
  const leftNav = fs.readFileSync(LEFT_NAV_PATH, 'utf8');
  const pushEdge = fs.readFileSync(PUSH_EDGE_PATH, 'utf8');

  assert.match(worker, /self\.skipWaiting\(\)/u);
  assert.match(worker, /clients\.claim\(\)/u);
  assert.match(worker, /notification_id/u);
  assert.match(worker, /renotify:\s*true/u);
  assert.doesNotMatch(worker, /tag:\s*['"]logistics-push-notification['"]/u);
  assert.match(utility, /registration\.update\(\)/u);
  assert.match(utility, /prepareLogisticsPushNotifications/u);
  assert.match(utility, /const subscriptionPromise = prepared\.registration\.pushManager\.subscribe/u);
  assert.match(utility, /showLogisticsPushSetupConfirmation/u);
  assert.match(utility, /Safari/iu);
  assert.match(leftNav, /showLogisticsPushSetupConfirmation/u);
  assert.match(leftNav, /const permission = await requestLogisticsPushPermission\(\)/u);
  assert.match(leftNav, /permission !== 'granted'/u);
  assert.match(leftNav, /prepareLogisticsPushNotifications/u);
  assert.match(leftNav, /시스템 알림/u);
  assert.doesNotMatch(leftNav, />Windows 알림</u);
  assert.doesNotMatch(fs.readFileSync(EDGE_PATH, 'utf8'), /Windows notifications/u);
  assert.match(leftNav, /status\.subscribed && status\.permission === 'granted'/u);
  assert.match(worker, /IGIS Logistics Platform/u);
  assert.match(pushEdge, /notification_id:\s*taskShare\.notification_id/u);
});

test('system push database gateway tolerates Edge cold starts', () => {
  const migrations = walkFiles(MIGRATIONS_PATH)
    .map((filePath) => ({ filePath, source: fs.readFileSync(filePath, 'utf8') }))
    .filter(({ source }) => /ll_queue_web_push_notification/iu.test(source))
    .sort((left, right) => left.filePath.localeCompare(right.filePath));
  const latestMigration = migrations.at(-1);
  assert.ok(latestMigration, 'a web push trigger migration must exist');
  assert.match(latestMigration.source, /timeout_milliseconds\s*:=\s*10000/iu);
});
