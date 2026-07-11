const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const XLSX = require('xlsx');

const ingest = require('../scripts/ingest/logistics-source-workbook-ingest.cjs');

test('parseSourceWorkbook builds workbook_schema and preserves compatibility source sheet ids', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'logi-source-ingest-'));
  const workbookPath = path.join(tmpDir, 'market-2026q1.xlsx');
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([
    ['헤더전'],
    ['헤더전2'],
    ['분기', '거래금액_천원', '창고명'],
    ['Q1', 1200, '테스트창고'],
  ]);
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
  XLSX.writeFile(wb, workbookPath);

  const parsed = ingest.parseSourceWorkbook(workbookPath, {
    domain: 'fund_info',
    version: 'test-v1',
    reportPeriod: 'TEST',
  });

  assert.equal(typeof parsed.sourceFile.workbook_schema, 'object');
  assert.equal(Array.isArray(parsed.sourceFile.workbook_schema.sheets), true);
  assert.equal(parsed.sourceFile.workbook_schema.sheets.length, 1);
  assert.equal(parsed.sourceFile.workbook_schema.sheets[0].sheet_name, 'Sheet1');
  assert.equal(Array.isArray(parsed.sourceFile.workbook_schema.sheets[0].columns), true);
  assert.ok(parsed.sourceFile.workbook_schema.sheets[0].columns.length >= 1);
  assert.ok(parsed.rows.every((row) => row.sheet_name === 'Sheet1'));
  assert.ok(parsed.rows.every((row) => typeof row.source_sheet_id === 'string' && row.source_sheet_id.length > 10));
  assert.equal(parsed.sheets.length, 1);
  assert.ok(parsed.columns.length >= 1);
});

test('buildSqlExport writes workbook_schema to ll_source_files and keeps compatibility table upserts for now', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'logi-source-ingest-'));
  const workbookPath = path.join(tmpDir, 'market-2026q1.xlsx');
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([
    ['헤더전'],
    ['헤더전2'],
    ['분기', '거래금액_천원', '창고명'],
    ['Q1', 1200, '테스트창고'],
  ]);
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
  XLSX.writeFile(wb, workbookPath);

  const parsed = ingest.parseSourceWorkbook(workbookPath, {
    domain: 'fund_info',
    version: 'test-v1',
    reportPeriod: 'TEST',
  });
  const sql = ingest.buildSqlExport(parsed, { activate: false });

  assert.match(sql, /workbook_schema/iu);
  assert.match(sql, /insert into public\.ll_source_files/iu);
  assert.match(sql, /insert into public\.ll_source_sheets/iu);
  assert.match(sql, /insert into public\.ll_source_columns/iu);
  assert.match(sql, /insert into public\.ll_source_rows/iu);
  assert.match(sql, /Compatibility shadow writes/iu);
});
