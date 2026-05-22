const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const OUT_DIR = path.join(ROOT, 'qa-artifacts', 'logistics-gate6');
const OUT_JSON = path.join(OUT_DIR, 'legacy-view-denylist-scan-20260522.json');
const OUT_MD = path.join(OUT_DIR, 'legacy-view-denylist-scan-20260522.md');

const DENYLIST = [
  'll_lease_space_area_breakdowns',
  'll_lease_space_specs',
  'll_lease_special_terms',
  'll_fund_beneficiary_tranches',
  'll_fund_loan_tranches',
  'll_api_audit_logs',
  'll_data_change_audit_logs',
  'll_source_review_logs',
  'll_issues',
  'll_work_platform_tasks',
  'll_work_platform_task_snapshots',
  'll_work_platform_board_posts',
  'll_weekly_reports',
  'll_weekly_assets',
  'll_weekly_projects',
  'll_weekly_doc_ingest_runs',
  'll_sheet_rows',
  'll_import_runs',
  'll_data_quality_findings',
  'll_asset_managers',
  'll_migration_row_backups',
];

const ACTIVE_ROOTS = [
  'src',
  'supabase/functions',
  'scripts/qa',
  'package.json',
  'dist',
];

const EXCLUDED_FILES = new Set([
  path.normalize(__filename),
  path.join(ROOT, 'scripts', 'qa', 'logistics-supabase-catalog-inventory.cjs'),
]);

function walk(target, files = []) {
  if (!fs.existsSync(target)) return files;
  const stat = fs.statSync(target);
  if (stat.isFile()) {
    if (/\.(cjs|js|jsx|ts|tsx|json|html|css)$/iu.test(target)) files.push(target);
    return files;
  }
  for (const entry of fs.readdirSync(target, { withFileTypes: true })) {
    if (['node_modules', '.git', '.vite', 'tmp'].includes(entry.name)) continue;
    walk(path.join(target, entry.name), files);
  }
  return files;
}

function lineColumn(text, offset) {
  const before = text.slice(0, offset);
  const lines = before.split(/\r?\n/u);
  return { line: lines.length, column: lines[lines.length - 1].length + 1 };
}

function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const files = ACTIVE_ROOTS.flatMap((root) => walk(path.join(ROOT, root)))
    .filter((file) => !EXCLUDED_FILES.has(path.normalize(file)));
  const findings = [];

  for (const file of files) {
    const text = fs.readFileSync(file, 'utf8');
    for (const viewName of DENYLIST) {
      const pattern = new RegExp(`\\b${viewName}\\b`, 'gu');
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const location = lineColumn(text, match.index);
        findings.push({
          view_name: viewName,
          file: path.relative(ROOT, file),
          line: location.line,
          column: location.column,
        });
      }
    }
  }

  const result = {
    ok: findings.length === 0,
    generated_at: new Date().toISOString(),
    scanned_roots: ACTIVE_ROOTS,
    denylist_count: DENYLIST.length,
    finding_count: findings.length,
    findings,
  };

  fs.writeFileSync(OUT_JSON, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  const md = [
    '# Legacy Compatibility View Denylist Scan - 2026-05-22',
    '',
    `- Result: ${result.ok ? 'PASS' : 'FAIL'}`,
    `- Denylist count: ${DENYLIST.length}`,
    `- Finding count: ${findings.length}`,
    `- Scanned roots: ${ACTIVE_ROOTS.map((root) => `\`${root}\``).join(', ')}`,
    '',
    '| View | File | Line | Column |',
    '| --- | --- | ---: | ---: |',
    ...(findings.length ? findings.map((row) => `| \`${row.view_name}\` | \`${row.file}\` | ${row.line} | ${row.column} |`) : ['| - | - | - | - |']),
    '',
  ].join('\n');
  fs.writeFileSync(OUT_MD, md, 'utf8');

  console.log(JSON.stringify({
    ok: result.ok,
    finding_count: findings.length,
    json: path.relative(ROOT, OUT_JSON),
    markdown: path.relative(ROOT, OUT_MD),
  }, null, 2));

  if (!result.ok) process.exit(1);
}

main();
