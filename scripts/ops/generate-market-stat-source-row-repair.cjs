#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const OUT_DIR = path.join(ROOT, 'qa-artifacts', 'logistics-gate6');
const EXTRACTED_PATH = path.join(
  OUT_DIR,
  'source-workbook-ingest',
  'source-workbook-ingest-sector_market-2026Q1.extracted.json',
);
const TARGET_SHEETS = new Set(['임대시장 통계', '공급시장 통계']);

function timestampForFile() {
  return new Date().toISOString().replace(/[-:]/gu, '').replace(/\..+$/u, '').replace('T', '-');
}

function dollarJson(value, tag) {
  return `$${tag}$${JSON.stringify(value)}$${tag}$::jsonb`;
}

function sqlLiteral(value) {
  if (value === null || value === undefined) return 'null';
  return `'${String(value).replace(/'/gu, "''")}'`;
}

function main() {
  if (!fs.existsSync(EXTRACTED_PATH)) throw new Error(`Extracted workbook JSON not found: ${EXTRACTED_PATH}`);
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const extracted = JSON.parse(fs.readFileSync(EXTRACTED_PATH, 'utf8'));
  const sourceFileId = extracted.sourceFile?.source_file_id;
  if (!sourceFileId) throw new Error('source_file_id is missing in extracted workbook JSON.');

  const rows = (extracted.rows || [])
    .filter((row) => row.source_file_id === sourceFileId && TARGET_SHEETS.has(row.sheet_name))
    .sort((a, b) => `${a.sheet_name}:${String(a.row_number).padStart(6, '0')}`.localeCompare(`${b.sheet_name}:${String(b.row_number).padStart(6, '0')}`));
  if (!rows.length) throw new Error('No target statistic rows found.');

  const stamp = timestampForFile();
  const backupSqlPath = path.join(OUT_DIR, `market-stat-source-rows-backup-query-${stamp}.sql`);
  const repairSqlPath = path.join(OUT_DIR, `market-stat-source-rows-repair-${stamp}.sql`);
  const manifestPath = path.join(OUT_DIR, `market-stat-source-rows-repair-${stamp}.json`);

  const sheetListSql = Array.from(TARGET_SHEETS).map(sqlLiteral).join(', ');
  const backupSql = `select jsonb_build_object(
  'generated_at', now(),
  'source_file', to_jsonb(f),
  'row_count', (
    select count(*)
    from public.ll_source_rows r
    where r.source_file_id = f.source_file_id
      and r.sheet_name in (${sheetListSql})
  ),
  'rows', (
    select jsonb_agg(to_jsonb(r) order by r.sheet_name, r.row_number)
    from public.ll_source_rows r
    where r.source_file_id = f.source_file_id
      and r.sheet_name in (${sheetListSql})
  )
) as backup
from public.ll_source_files f
where f.source_file_id = ${sqlLiteral(sourceFileId)}
  and f.active_version is true;
`;

  const repairSql = `begin;

with incoming as (
  select * from jsonb_populate_recordset(null::public.ll_source_rows, ${dollarJson(rows, 'market_stat_rows_json')})
)
update public.ll_source_rows as target
set
  row_hash = incoming.row_hash,
  natural_key = incoming.natural_key,
  row_values = incoming.row_values,
  normalized_values = incoming.normalized_values,
  validation_flags = incoming.validation_flags,
  source_locator = incoming.source_locator,
  updated_at = now()
from incoming
where target.source_file_id = incoming.source_file_id
  and target.sheet_name = incoming.sheet_name
  and target.row_number = incoming.row_number
  and target.source_file_id = ${sqlLiteral(sourceFileId)}
  and target.sheet_name in (${sheetListSql});

commit;
`;

  fs.writeFileSync(backupSqlPath, backupSql, 'utf8');
  fs.writeFileSync(repairSqlPath, repairSql, 'utf8');
  const manifest = {
    ok: true,
    generated_at: new Date().toISOString(),
    source_file_id: sourceFileId,
    source_hash: extracted.sourceFile?.source_hash || null,
    target_sheets: Array.from(TARGET_SHEETS),
    target_row_count: rows.length,
    backup_sql_path: backupSqlPath,
    repair_sql_path: repairSqlPath,
    sample_rows: rows.slice(0, 3).map((row) => ({
      sheet_name: row.sheet_name,
      row_number: row.row_number,
      row_value_keys: Object.keys(row.row_values || {}).length,
    })),
  };
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  fs.writeFileSync(path.join(OUT_DIR, 'market-stat-source-rows-repair-latest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify(manifest, null, 2));
}

main();
