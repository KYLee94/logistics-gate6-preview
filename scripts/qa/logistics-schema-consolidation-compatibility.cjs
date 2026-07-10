const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const files = [
  'src/components/system/workspace/WorkspaceLogistics.jsx',
  'src/components/system/workspace/WorkspaceArchive.jsx',
  'src/components/system/IotaLeftNav.jsx',
];
const forbiddenTableNames = [
  'll_source_rows',
  'll_audit_events',
  'll_news_runs',
  'll_notification_deliveries',
  'll_board_posts',
  'll_weekly_records',
  'll_payload_snapshots',
];

function source(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

function requireContract(value, description) {
  if (!value) throw new Error(`Missing compatibility contract: ${description}`);
  return description;
}

function main() {
  const workspace = source(files[0]);
  const archive = source(files[1]);
  const nav = source(files[2]);
  const newsSmoke = source('scripts/qa/logistics-news-api-smoke.cjs');
  const dataManagementSmoke = source('scripts/qa/logistics-data-management-browser-readback-smoke.cjs');
  const allSource = [workspace, archive, nav].join('\n');
  const checks = [];
  const check = (id, fn) => {
    try {
      checks.push({ id, ok: true, evidence: fn() });
    } catch (error) {
      checks.push({ id, ok: false, error: error.message });
    }
  };

  check('no-consolidated-table-name-coupling', () => forbiddenTableNames.map((name) => requireContract(!allSource.includes(name), `${name} is not referenced by owned UI`)));
  check('login-last-login-minimal-contract', () => [
    requireContract(nav.includes('row.last_login'), 'last_login alias'),
    requireContract(nav.includes('data.members'), 'members collection alias'),
    requireContract(nav.includes('data.login_capabilities'), 'login capability collection alias'),
  ]);
  check('semantic-quality-origin-contract', () => [
    requireContract(workspace.includes("source_kind: 'quality_finding'"), 'semantic quality source kind'),
    requireContract(workspace.includes("permission_source: 'access_control'"), 'semantic permission source'),
    requireContract(workspace.includes("dashboard_snapshot: '대시보드 스냅샷'"), 'semantic snapshot display label'),
  ]);
  check('ui-action-contracts-remain-semantic', () => [
    requireContract(nav.includes("'notifications/list'"), 'notification list action'),
    requireContract(newsSmoke.includes("action: 'news/list'"), 'news list smoke action'),
    requireContract(dataManagementSmoke.includes('data-management/views'), 'data management view smoke action'),
    requireContract(archive.includes("'work-platform/tasks/snapshots/list'"), 'work platform snapshot action'),
  ]);

  const report = {
    ok: checks.every((checkRow) => checkRow.ok),
    mode: 'source-contract',
    database_write_used: false,
    files,
    checks,
  };
  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) process.exitCode = 1;
}

main();
