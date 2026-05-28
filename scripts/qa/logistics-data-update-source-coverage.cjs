const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const ROOT = path.resolve(__dirname, '..', '..');
const OUT_DIR = path.join(ROOT, 'qa-artifacts', 'logistics-gate6');

function timestampForFile() {
  return new Date().toISOString().replace(/[-:]/gu, '').replace(/\..+$/u, '').replace('T', '-');
}

function excelColumnIndex(letter) {
  return String(letter || '').toUpperCase().split('').reduce((sum, char) => sum * 26 + char.charCodeAt(0) - 64, 0);
}

function excelColumnName(index) {
  let current = index;
  let name = '';
  while (current > 0) {
    const remainder = (current - 1) % 26;
    name = String.fromCharCode(65 + remainder) + name;
    current = Math.floor((current - 1) / 26);
  }
  return name;
}

function excelColumnRange(start, end) {
  const startIndex = excelColumnIndex(start);
  const endIndex = excelColumnIndex(end);
  return Array.from({ length: endIndex - startIndex + 1 }, (_, offset) => excelColumnName(startIndex + offset));
}

function normalizeKey(value) {
  return String(value || '')
    .replace(/^히스토리\s*/u, '')
    .replace(/\s+/gu, '')
    .replace(/[·ㆍ]/gu, '')
    .trim()
    .toLowerCase();
}

function candidateExcelPaths() {
  return [
    process.env.LOGISTICS_CONTRACT_EXCEL_PATH,
    path.join(ROOT, '★ 260414_물류센터 임대차계약 DB_취합본.xlsx'),
    'C:\\Users\\10524\\Desktop\\codex_realasset\\Project\\03_Logi_Leasing_Dashboard\\★ 260414_물류센터 임대차계약 DB_취합본.xlsx',
  ].filter(Boolean);
}

function findExcelPath() {
  return candidateExcelPaths().find((candidate) => fs.existsSync(candidate));
}

function cellText(sheet, address) {
  const cell = sheet[address];
  return cell?.w ?? cell?.v ?? '';
}

function actualSheetColumns(workbook, sheetName, headerRow, ranges) {
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) throw new Error(`${sheetName} sheet not found`);
  const columns = ranges.flatMap(([start, end]) => excelColumnRange(start, end));
  return columns.map((column) => ({
    column,
    header: String(cellText(sheet, `${column}${headerRow}`) || '').trim(),
  })).filter((entry) => entry.header);
}

function parseWorkspaceFields() {
  const source = fs.readFileSync(path.join(ROOT, 'src', 'components', 'system', 'workspace', 'WorkspaceLogistics.jsx'), 'utf8');
  const fieldMatches = [...source.matchAll(/\{[^\n{}]*fieldName: '([^']+)'[^\n{}]*label: '([^']+)'[^\n{}]*sourceHeader: '([^']+)'[^\n{}]*sourceColumnLetter: '([^']+)'[^\n{}]*domain: '([^']+)'[^\n{}]*table: '([^']+)'[^\n{}]*(?:sourceOnly: true)?[^\n{}]*\}/gu)];
  return fieldMatches.map((match) => {
    const full = match[0];
    return {
      fieldName: match[1],
      label: match[2],
      sourceHeader: match[3],
      sourceColumnLetter: match[4],
      domain: match[5],
      table: match[6],
      sourceOnly: full.includes('sourceOnly: true') || match[6] === 'source_only',
    };
  });
}

function parseMetaRows(workbook) {
  const sheet = workbook.Sheets['Meta_데이터 항목 설명'];
  if (!sheet) throw new Error('Meta_데이터 항목 설명 sheet not found');
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false, blankrows: false });
  return rows.slice(1)
    .filter((row) => row[1])
    .map((row) => ({
      item: String(row[1] || '').trim(),
      dataType: String(row[2] || '').trim(),
      unit: String(row[3] || '').trim(),
      timeSeries: String(row[4] || '').trim(),
      sample: String(row[5] || '').trim(),
      description: String(row[6] || '').trim(),
    }));
}

function compareSheet(sheetName, actualColumns, fields) {
  const byColumn = new Map(fields.filter((field) => field.domain === sheetName).map((field) => [field.sourceColumnLetter, field]));
  const missingInUi = actualColumns.filter((entry) => !byColumn.has(entry.column));
  const missingInExcel = [...byColumn.values()].filter((field) => !actualColumns.some((entry) => entry.column === field.sourceColumnLetter));
  const headerMismatches = actualColumns
    .map((entry) => {
      const field = byColumn.get(entry.column);
      if (!field) return null;
      return normalizeKey(entry.header) === normalizeKey(field.sourceHeader)
        ? null
        : { column: entry.column, excel_header: entry.header, ui_source_header: field.sourceHeader };
    })
    .filter(Boolean);
  return {
    ok: missingInUi.length === 0 && missingInExcel.length === 0 && headerMismatches.length === 0,
    excel_column_count: actualColumns.length,
    ui_field_count: fields.filter((field) => field.domain === sheetName).length,
    missing_in_ui: missingInUi,
    missing_in_excel: missingInExcel,
    header_mismatches: headerMismatches,
  };
}

function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const stamp = timestampForFile();
  const outJson = path.join(OUT_DIR, `data-update-source-coverage-${stamp}.json`);
  const excelPath = findExcelPath();
  if (!excelPath) throw new Error('Original contract Excel file not found. Set LOGISTICS_CONTRACT_EXCEL_PATH.');
  const workbook = XLSX.readFile(excelPath, { cellDates: false });
  const fields = parseWorkspaceFields();
  const metaRows = parseMetaRows(workbook);
  const metaByItem = new Map(metaRows.map((row) => [normalizeKey(row.item), row]));
  const dbGeneralColumns = actualSheetColumns(workbook, 'DB_일반', 9, [['B', 'S'], ['U', 'Z'], ['AA', 'CF']]);
  const dbHistoryColumns = actualSheetColumns(workbook, 'DB_히스토리 누적', 10, [['B', 'S']]);
  const metaMatched = fields.filter((field) => metaByItem.has(normalizeKey(field.sourceHeader)) || metaByItem.has(normalizeKey(field.label)));
  const timeSeriesMeta = metaRows.filter((row) => row.timeSeries === 'O').map((row) => row.item);
  const historyFields = fields.filter((field) => field.domain === 'DB_히스토리 누적');
  const timeSeriesHistoryCoverage = timeSeriesMeta.map((item) => ({
    item,
    covered_by_history: historyFields.some((field) => normalizeKey(field.sourceHeader) === normalizeKey(item) || normalizeKey(field.label) === normalizeKey(item)),
  }));
  const result = {
    ok: false,
    generated_at: new Date().toISOString(),
    excel_path: excelPath,
    workspace_field_count: fields.length,
    meta_item_count: metaRows.length,
    sheets: {
      'DB_일반': compareSheet('DB_일반', dbGeneralColumns, fields),
      'DB_히스토리 누적': compareSheet('DB_히스토리 누적', dbHistoryColumns, fields),
    },
    meta_coverage: {
      matched_field_count: metaMatched.length,
      unmatched_fields: fields
        .filter((field) => !metaByItem.has(normalizeKey(field.sourceHeader)) && !metaByItem.has(normalizeKey(field.label)))
        .map((field) => ({ domain: field.domain, column: field.sourceColumnLetter, label: field.label, source_header: field.sourceHeader })),
    },
    time_series_history_coverage: timeSeriesHistoryCoverage,
    management_model: {
      current_contract_state: ['ll_leases', 'll_lease_spaces'],
      rent_management_history: ['ll_rent_history append-only'],
      source_only_preservation: ['ll_lease_attributes'],
      archive_strategy: 'lease and lease_space archived; physical delete is not used',
    },
  };
  result.ok = fields.length === 100
    && result.sheets['DB_일반'].ok
    && result.sheets['DB_히스토리 누적'].ok
    && timeSeriesHistoryCoverage.every((entry) => entry.covered_by_history);
  fs.writeFileSync(outJson, JSON.stringify(result, null, 2), 'utf8');
  console.log(JSON.stringify({ ...result, artifact: outJson }, null, 2));
  if (!result.ok) process.exit(1);
}

main();
