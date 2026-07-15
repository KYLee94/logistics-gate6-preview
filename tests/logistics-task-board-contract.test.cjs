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

test('LogisticsTaskBoard keeps the reference table shell with the requested compact controls', () => {
  const { source } = taskBoardComponent();

  assert.match(source, /text-\[28px\][^>]*>통합 업무 보드</u);
  assert.match(source, /w-\[280px\]/u);
  assert.match(source, /rounded-(?:l-)?\[24px\]/u);
  assert.match(source, /bg-\[#252524\]/u);
  assert.match(source, /h-\[46px\]/u);
  assert.match(source, />등록일</u);
  assert.match(source, /formatCreatedDateWithAge\(task\.created_at\)/u);
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
