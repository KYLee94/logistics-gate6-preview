#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const XLSX = require('xlsx');
const { createClient } = require('@supabase/supabase-js');

const ROOT = path.resolve(__dirname, '..', '..');
const DEFAULT_SOURCE_DIR = 'C:/Users/10524/Desktop/codex_realasset/Project/03_Logi_Leasing_Dashboard';
const MARKET_BUCKET = 'logistics-sector-market-workbooks';
const OUT_DIR = path.join(ROOT, 'qa-artifacts', 'logistics-gate6', 'source-workbook-ingest');

const SOURCE_PRESETS = {
  market2026q1: {
    domain: 'sector_market',
    token: '20261Q',
    reportPeriod: '2026Q1',
    asOfDate: '2026-03-31',
    version: '2026Q1',
  },
  leaseContracts: { domain: 'lease_contracts', token: '260414', version: '260414' },
  permissions: { domain: 'permissions', token: '260513', requiredNamePart: '수식 제거', version: '260513_formula_removed' },
  fundInfo: { domain: 'fund_info', token: '260520', version: '260520' },
};

function argValue(name, fallback = '') {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] || fallback : fallback;
}

function requiredArgValue(name) {
  const index = process.argv.indexOf(name);
  const value = index >= 0 ? process.argv[index + 1] : '';
  if (!value || value.startsWith('--')) throw new Error(`${name} requires a path value.`);
  return value;
}

function hasFlag(name) {
  return process.argv.includes(name);
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function sha256Buffer(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function sha256Json(value) {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function uuidFromHash(value) {
  const hex = crypto.createHash('sha256').update(String(value)).digest('hex').slice(0, 32);
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    `4${hex.slice(13, 16)}`,
    `${(parseInt(hex.slice(16, 18), 16) & 0x3f | 0x80).toString(16).padStart(2, '0')}${hex.slice(18, 20)}`,
    hex.slice(20, 32),
  ].join('-');
}

function clean(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function cleanKey(value, fallback) {
  const base = clean(value)
    .toLowerCase()
    .replace(/[()\[\]{}]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, '_')
    .replace(/^_+|_+$/g, '');
  return base || fallback;
}

function numberValue(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const text = clean(value)
    .replace(/,/g, '')
    .replace(/%$/g, '')
    .replace(/[^\d.-]/g, '');
  if (!text || text === '-' || text === '.') return null;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
}

function integerValue(value) {
  const parsed = numberValue(value);
  return parsed === null ? null : Math.trunc(parsed);
}

function dateValue(value) {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
  const text = clean(value);
  if (!text || text === '-' || text.toLowerCase() === 'null') return null;
  const excelSerial = Number(text);
  if (Number.isFinite(excelSerial) && excelSerial > 20000 && excelSerial < 80000) {
    const parsed = XLSX.SSF.parse_date_code(excelSerial);
    if (parsed) return `${parsed.y}-${String(parsed.m).padStart(2, '0')}-${String(parsed.d).padStart(2, '0')}`;
  }
  const normalized = text.replace(/\./g, '-').replace(/\//g, '-');
  const match = normalized.match(/^(\d{2,4})-(\d{1,2})-(\d{1,2})/);
  if (match) {
    const year = match[1].length === 2 ? `20${match[1]}` : match[1];
    const month = Number(match[2]);
    const day = Number(match[3]);
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    const parsedDate = new Date(Date.UTC(Number(year), month - 1, day));
    if (
      parsedDate.getUTCFullYear() !== Number(year)
      || parsedDate.getUTCMonth() !== month - 1
      || parsedDate.getUTCDate() !== day
    ) {
      return null;
    }
    return `${year}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`;
  }
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
}

function findPresetFile(preset) {
  const dir = argValue('--source-dir', DEFAULT_SOURCE_DIR);
  const files = fs.readdirSync(dir)
    .filter((name) => /\.xlsx$/i.test(name))
    .filter((name) => name.includes(preset.token))
    .filter((name) => !preset.requiredNamePart || name.includes(preset.requiredNamePart));
  if (!files.length) throw new Error(`No workbook found for preset token ${preset.token} in ${dir}`);
  return path.join(dir, files.sort((a, b) => a.length - b.length)[0]);
}

function workbookRows(ws) {
  return XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: true, blankrows: false });
}

function detectHeaderRow(rows) {
  let best = { index: 0, filled: 0 };
  rows.slice(0, 12).forEach((row, index) => {
    const filled = (row || []).filter((value) => clean(value)).length;
    if (filled > best.filled) best = { index, filled };
  });
  return best.index + 1;
}

function headerRowFor(domain, sheetIndex, rows) {
  if (domain === 'sector_market') {
    const fixed = { 0: 6, 1: 6, 2: 4, 3: 5, 4: 7, 5: 4, 6: 4, 7: 4, 8: 3 };
    return fixed[sheetIndex] || detectHeaderRow(rows);
  }
  if (domain === 'lease_contracts') {
    const fixed = { 0: 2, 1: 8, 2: 8, 3: 2, 4: 2 };
    return fixed[sheetIndex] || detectHeaderRow(rows);
  }
  return detectHeaderRow(rows);
}

function buildHeaders(headerRow, maxLength) {
  const counts = new Map();
  return Array.from({ length: maxLength }, (_, index) => {
    const rawLabel = clean(headerRow[index]);
    const baseKey = cleanKey(rawLabel, `col_${index + 1}`);
    const nextCount = (counts.get(baseKey) || 0) + 1;
    counts.set(baseKey, nextCount);
    return {
      column_index: index + 1,
      column_letter: XLSX.utils.encode_col(index),
      header_label: rawLabel || `Column ${index + 1}`,
      normalized_header: nextCount === 1 ? baseKey : `${baseKey}_${nextCount}`,
    };
  });
}

function rowObject(headers, row) {
  const out = {};
  headers.forEach((header, index) => {
    const value = row[index];
    if (value !== null && value !== undefined && clean(value) !== '') out[header.normalized_header] = value;
  });
  return out;
}

function cell(row, candidates) {
  for (const key of candidates) {
    if (row[key] !== undefined && row[key] !== null && clean(row[key]) !== '') return row[key];
  }
  return null;
}

function sourceLocator(sheetName, rowNumber) {
  return { sheet_name: sheetName, row_number: rowNumber };
}

function makeNaturalKey(parts) {
  return parts.map((part) => clean(part).replace(/\s+/g, '')).filter(Boolean).join('|');
}

function normalizeQuarter(value) {
  const text = clean(value);
  if (!text) return null;
  if (/q$/i.test(text)) return text.toUpperCase();
  const numeric = integerValue(text);
  return numeric ? `Q${numeric}` : text;
}

function parseSourceWorkbook(filePath, options = {}) {
  const buffer = fs.readFileSync(filePath);
  const sourceHash = sha256Buffer(buffer);
  const wb = XLSX.readFile(filePath, { cellDates: true, raw: false });
  const domain = options.domain || 'sector_market';
  const sourceVersion = options.version || options.reportPeriod || sourceHash.slice(0, 12);
  const sourceKey = `${domain}:${sourceVersion}:${sourceHash.slice(0, 12)}`;
  const sourceFileId = uuidFromHash(`source_file:${sourceKey}`);
  const sheets = [];
  const columns = [];
  const rows = [];
  const sourceRowIndex = new Map();

  wb.SheetNames.forEach((sheetName, sheetIndex) => {
    const sheetId = uuidFromHash(`source_sheet:${sourceKey}:${sheetIndex}:${sheetName}`);
    const allRows = workbookRows(wb.Sheets[sheetName]);
    const headerRowNumber = headerRowFor(domain, sheetIndex, allRows);
    const header = allRows[headerRowNumber - 1] || [];
    const maxLength = Math.max(...allRows.map((row) => (row || []).length), header.length, 1);
    const headers = buildHeaders(header, maxLength);
    const dataRows = allRows.slice(headerRowNumber).map((row, offset) => ({ row, rowNumber: headerRowNumber + offset + 1 }));
    const nonEmptyDataRows = dataRows.filter(({ row }) => (row || []).some((value) => clean(value)));
    const sheetRows = nonEmptyDataRows.map(({ row, rowNumber }) => {
      const values = rowObject(headers, row);
      const sourceRowId = uuidFromHash(`source_row:${sourceKey}:${sheetName}:${rowNumber}`);
      const rowHash = sha256Json(values);
      const item = {
        source_row_id: sourceRowId,
        source_sheet_id: sheetId,
        source_file_id: sourceFileId,
        sheet_name: sheetName,
        row_number: rowNumber,
        row_hash: rowHash,
        natural_key: makeNaturalKey([sheetName, rowNumber, cell(values, ['asset_code', 'pnu', 'code', 'fund_code', 'warehouse_name', 'center_name'])]),
        row_values: values,
        normalized_values: {},
        validation_flags: [],
        source_locator: sourceLocator(sheetName, rowNumber),
      };
      sourceRowIndex.set(`${sheetIndex}:${rowNumber}`, item);
      return item;
    });
    sheets.push({
      source_sheet_id: sheetId,
      source_file_id: sourceFileId,
      sheet_name: sheetName,
      sheet_index: sheetIndex + 1,
      header_row_number: headerRowNumber,
      first_data_row_number: headerRowNumber + 1,
      last_row_number: allRows.length,
      column_count: headers.length,
      row_count: sheetRows.length,
      sheet_hash: sha256Json(sheetRows.map((item) => item.row_hash)),
      metadata: {},
    });
    headers.forEach((header) => columns.push({
      source_column_id: uuidFromHash(`source_column:${sourceKey}:${sheetName}:${header.column_index}`),
      source_sheet_id: sheetId,
      ...header,
      value_type: '',
      unit_label: '',
      target_table: '',
      target_field: '',
      edit_group: domain,
      is_required: false,
      is_user_editable: true,
      metadata: {},
    }));
    rows.push(...sheetRows);
  });

  const normalized = domain === 'sector_market' ? normalizeSectorMarket(wb, sourceFileId, sourceRowIndex) : {};
  const rowCounts = Object.fromEntries(sheets.map((sheet) => [sheet.sheet_name, sheet.row_count]));
  const sourceFile = {
    source_file_id: sourceFileId,
    source_domain: domain,
    source_key: sourceKey,
    source_version: sourceVersion,
    file_name: path.basename(filePath),
    original_file_name: path.basename(filePath),
    source_hash: sourceHash,
    storage_bucket: MARKET_BUCKET,
    storage_path: `${domain}/${sourceVersion}/${sourceHash.slice(0, 12)}/source-workbook.xlsx`,
    mime_type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    file_size_bytes: buffer.length,
    active_version: false,
    parse_status: 'validated',
    report_period: options.reportPeriod || null,
    as_of_date: options.asOfDate || null,
    row_counts: rowCounts,
    validation_summary: buildValidationSummary(domain, rowCounts, normalized),
    metadata: { parser_version: 'logistics_source_workbook_ingest_v1' },
  };
  return { sourceFile, sheets, columns, rows, normalized, sourceHash, buffer };
}

function normalizeSectorMarket(wb, sourceFileId, sourceRowIndex) {
  const findRowNumber = (sheetIndex, predicate) => {
    const sheetName = wb.SheetNames[sheetIndex];
    if (!sheetName) return null;
    const allRows = workbookRows(wb.Sheets[sheetName]);
    const index = allRows.findIndex((row) => predicate((row || []).map(clean).join(' '), row || []));
    return index >= 0 ? index + 1 : null;
  };
  const findHeaderAfter = (sheetIndex, titleRowNumber, stopAtRowNumber = null) => {
    if (!titleRowNumber) return null;
    const sheetName = wb.SheetNames[sheetIndex];
    if (!sheetName) return null;
    const allRows = workbookRows(wb.Sheets[sheetName]);
    const startIndex = titleRowNumber;
    const stopIndex = stopAtRowNumber ? stopAtRowNumber - 1 : allRows.length;
    const relativeIndex = allRows.slice(startIndex, stopIndex).findIndex((row) => (row || []).some((value) => clean(value) === '창고명'));
    return relativeIndex >= 0 ? titleRowNumber + relativeIndex + 1 : null;
  };
  const getSheetRows = (sheetIndex, headerRowNumber) => {
    const sheetName = wb.SheetNames[sheetIndex];
    if (!sheetName) return [];
    const allRows = workbookRows(wb.Sheets[sheetName]);
    const headers = buildHeaders(allRows[headerRowNumber - 1] || [], Math.max(...allRows.map((row) => (row || []).length), 1));
    return allRows.slice(headerRowNumber).map((row, offset) => ({
      sheetName,
      rowNumber: headerRowNumber + offset + 1,
      values: rowObject(headers, row),
    })).filter(({ values }) => Object.keys(values).length);
  };
  const getHeaderSegmentRows = (sheetIndex, headerRowNumber, stopAtRowNumber = null) => {
    const sheetName = wb.SheetNames[sheetIndex];
    if (!sheetName) return [];
    const allRows = workbookRows(wb.Sheets[sheetName]);
    const headers = buildHeaders(allRows[headerRowNumber - 1] || [], Math.max(...allRows.map((row) => (row || []).length), 1));
    const startIndex = headerRowNumber;
    const stopIndex = stopAtRowNumber ? stopAtRowNumber - 1 : allRows.length;
    return allRows.slice(startIndex, stopIndex).map((row, offset) => ({
      sheetName,
      rowNumber: headerRowNumber + offset + 1,
      values: rowObject(headers, row),
    })).filter(({ values }) => {
      const marker = clean(Object.values(values).find(Boolean));
      return Object.keys(values).length && marker && !/^(\d+\.|ⅰ\.|ⅱ\.|\[)/u.test(marker);
    });
  };

  const leaseObservations = getSheetRows(2, 4).map(({ sheetName, rowNumber, values }) => {
    const sourceRow = sourceRowIndex.get(`2:${rowNumber}`);
    const year = integerValue(cell(values, ['년도']));
    const quarter = normalizeQuarter(cell(values, ['분기']));
    return {
      observation_id: uuidFromHash(`lease_observation:${sourceRow?.source_row_id}`),
      source_row_id: sourceRow?.source_row_id,
      source_file_id: sourceFileId,
      report_year: year,
      report_quarter: quarter,
      report_period: year && quarter ? `${year}${quarter}` : null,
      center_name: clean(cell(values, ['물류센터명'])),
      pnu: clean(cell(values, ['pnu'])),
      legal_dong_code: clean(cell(values, ['법정동코드'])),
      legal_address: clean(cell(values, ['법정동주소', '기타주소'])),
      region_group: clean(cell(values, ['수도권_지방'])),
      region: clean(cell(values, ['권역'])),
      province: clean(cell(values, ['시_도', '법정도'])),
      city: clean(cell(values, ['시_군'])),
      district: clean(cell(values, ['구_읍_면'])),
      gross_area_py: numberValue(cell(values, ['연면적_평', '연면적평', '연면적_3_3', '연면적3_3'])),
      completion_year: integerValue(cell(values, ['준공년도'])),
      temperature_type: clean(cell(values, ['보관방식_상온_저온_복합'])),
      size_bucket: clean(cell(values, ['규모'])),
      deposit_manwon_per_py: numberValue(cell(values, ['보증금_만원_평', '보증금만원_평', '보증금만원평'])),
      rent_manwon_per_py: numberValue(cell(values, ['임대료_만원_평', '임대료만원_평', '임대료만원평'])),
      management_fee_manwon_per_py: numberValue(cell(values, ['관리비_만원_평', '관리비만원_평', '관리비만원평'])),
      rent_free_months_per_year: numberValue(cell(values, ['rf_개월_년', 'rf개월_년', 'rf개월년'])),
      fit_out_months: numberValue(cell(values, ['fo개월'])),
      tenant_improvement_manwon_per_py: numberValue(cell(values, ['ti만원_평'])),
      leasable_area_py: numberValue(cell(values, ['보관면적_평', '보관면적평'])),
      vacancy_area_py: numberValue(cell(values, ['창고_공실면적_평', '창고공실면적_평', '창고공실면적평'])),
      vacancy_rate: numberValue(cell(values, ['공실률'])),
      payload: values,
    };
  }).filter((row) => row.source_row_id && row.center_name);

  const under2kTitleRow = findRowNumber(4, (text) => /당분기 신규공급사례_2,000평 미만/.test(text));
  const over2kTitleRow = findRowNumber(4, (text) => /당분기 신규공급사례_2,000평 이상/.test(text));
  const cumulativeTitleRow = findRowNumber(4, (text) => /누적 신규공급사례/.test(text));
  const under2kHeaderRow = findHeaderAfter(4, under2kTitleRow, over2kTitleRow);
  const over2kHeaderRow = findHeaderAfter(4, over2kTitleRow, cumulativeTitleRow);
  const newSupplyRows = [
    ...getHeaderSegmentRows(4, under2kHeaderRow, over2kTitleRow),
    ...getHeaderSegmentRows(4, over2kHeaderRow, cumulativeTitleRow),
  ];
  const newSupplyCases = newSupplyRows.filter(({ values }) => {
    const note = clean(cell(values, ['비고']));
    return !/\d{2}\.\dQ/.test(note);
  }).map(({ rowNumber, values }) => {
    const sourceRow = sourceRowIndex.get(`4:${rowNumber}`);
    return supplyRow(sourceRow, sourceFileId, values, 'new_supply');
  }).filter((row) => row.source_row_id && row.warehouse_name);

  const pipelineCases = [5, 6].flatMap((sheetIndex) => getSheetRows(sheetIndex, 4).map(({ rowNumber, values }) => {
    const sourceRow = sourceRowIndex.get(`${sheetIndex}:${rowNumber}`);
    return supplyRow(sourceRow, sourceFileId, values, 'pipeline');
  })).filter((row) => row.source_row_id && row.warehouse_name);

  const transactionCases = getSheetRows(8, 3).map(({ rowNumber, values }) => {
    const sourceRow = sourceRowIndex.get(`8:${rowNumber}`);
    const transactionAmountThousand = numberValue(cell(values, ['거래가_천원', '거래가천원']));
    return {
      transaction_case_id: uuidFromHash(`transaction_case:${sourceRow?.source_row_id}`),
      source_row_id: sourceRow?.source_row_id,
      source_file_id: sourceFileId,
      transaction_type: clean(cell(values, ['구분'])),
      transaction_code: clean(cell(values, ['code', 'code_1'])),
      warehouse_name: clean(cell(values, ['창고명'])),
      pnu: clean(cell(values, ['pnu'])),
      legal_address: clean(cell(values, ['법정동주소'])),
      national_region: clean(cell(values, ['전국권역'])),
      capital_region: clean(cell(values, ['수도권역'])),
      size_bucket: clean(cell(values, ['규모'])),
      temperature_type: clean(cell(values, ['보관방식'])),
      province: clean(cell(values, ['시_도'])),
      city: clean(cell(values, ['시_군'])),
      district: clean(cell(values, ['구_읍_면'])),
      building_area_sqm: numberValue(cell(values, ['건축면적_sqm', '건축면적sqm'])),
      building_area_py: numberValue(cell(values, ['건축면적_3_3', '건축면적3_3'])),
      gross_area_sqm: numberValue(cell(values, ['연면적_sqm', '연면적sqm'])),
      gross_area_py: numberValue(cell(values, ['연면적_3_3', '연면적3_3'])),
      land_area_sqm: numberValue(cell(values, ['대지면적_sqm', '대지면적sqm'])),
      land_area_py: numberValue(cell(values, ['대지면적_3_3', '대지면적3_3'])),
      contract_date: dateValue(cell(values, ['계약일자'])),
      closing_date: dateValue(cell(values, ['잔금일자'])),
      transaction_year: integerValue(cell(values, ['거래년도_잔금기준', '거래시기계산_연도'])),
      transaction_quarter: normalizeQuarter(cell(values, ['거래분기_잔금기준'])),
      transaction_amount_thousand_krw: transactionAmountThousand,
      transaction_amount_krw: transactionAmountThousand ? transactionAmountThousand * 1000 : numberValue(cell(values, ['거래가격'])),
      unit_price_thousand_krw_per_py: numberValue(cell(values, ['평당가_연면적_천원', '평당가연면적_천원', '평당가연면적천원'])),
      seller_name: clean(cell(values, ['매도인'])),
      seller_type: clean(cell(values, ['유형'])),
      buyer_name: clean(cell(values, ['매수인'])),
      buyer_type: clean(cell(values, ['유형_2'])),
      senior_loan_rate: clean(cell(values, ['대출금리_선순위'])),
      tenant_name: clean(cell(values, ['임차인'])),
      lease_start_date: dateValue(cell(values, ['임차개시일자'])),
      lease_end_date: dateValue(cell(values, ['임차종료일자'])),
      remaining_lease_months: numberValue(cell(values, ['잔여임차기간_개월'])),
      leased_area_sqm: numberValue(cell(values, ['임대면적_sqm'])),
      target_area_sqm: numberValue(cell(values, ['대상면적_sqm'])),
      deposit_thousand_krw_per_py: numberValue(cell(values, ['보증금_천원_평'])),
      rent_thousand_krw_per_py: numberValue(cell(values, ['임대료_천원_평'])),
      management_fee_thousand_krw_per_py: numberValue(cell(values, ['관리비_천원_평'])),
      vacancy_rate: numberValue(cell(values, ['공실률'])),
      initial_cap_rate: numberValue(cell(values, ['최종_initial_cap', '계산_initial_cap'])),
      stabilized_cap_rate: numberValue(cell(values, ['최종_stablized_cap', '계산_going_cap_공실률_5_이상은_5_렌트프리는_0으로_가정'])),
      cap_rate: numberValue(cell(values, ['cap_rate'])),
      payload: values,
    };
  }).filter((row) => row.source_row_id && row.warehouse_name);

  const capRateSeries = getSheetRows(7, 4).map(({ rowNumber, values }) => {
    const sourceRow = sourceRowIndex.get(`7:${rowNumber}`);
    const year = integerValue(cell(values, ['년도']));
    const quarter = normalizeQuarter(cell(values, ['분기']));
    return {
      cap_rate_id: uuidFromHash(`cap_rate:${sourceRow?.source_row_id}`),
      source_row_id: sourceRow?.source_row_id,
      source_file_id: sourceFileId,
      report_year: year,
      report_quarter: quarter,
      capital_area_cap_rate: numberValue(cell(values, ['수도권'])),
      national_cap_rate: numberValue(cell(values, ['전국'])),
      payload: values,
    };
  }).filter((row) => row.source_row_id && row.report_year && row.report_quarter);

  return {
    leaseObservations,
    supplyCases: [...newSupplyCases, ...pipelineCases],
    transactionCases,
    capRateSeries,
  };
}

function supplyRow(sourceRow, sourceFileId, values, supplyKind) {
  const expectedYear = integerValue(cell(values, ['준공예정_연도']));
  const expectedQuarter = normalizeQuarter(cell(values, ['준공예정_분기']));
  const progressStatus = clean(cell(values, ['진행_상황_26_1q', '진행_상황_25_4q', '비고']));
  return {
    supply_case_id: uuidFromHash(`supply_case:${sourceRow?.source_row_id}`),
    source_row_id: sourceRow?.source_row_id,
    source_file_id: sourceFileId,
    supply_kind: supplyKind,
    expected_year: expectedYear,
    expected_quarter: expectedQuarter,
    initial_expected_year: integerValue(cell(values, ['초기_준공예정_연도'])),
    initial_expected_quarter: normalizeQuarter(cell(values, ['초기_준공예정_분기'])),
    warehouse_name: clean(cell(values, ['창고명'])),
    pnu: clean(cell(values, ['pnu'])),
    legal_address: clean(cell(values, ['법정동주소'])),
    region_group: clean(cell(values, ['권역'])),
    region: clean(cell(values, ['세부_권역', '세부권역'])),
    province: clean(cell(values, ['도'])),
    city: clean(cell(values, ['시_군'])),
    district: clean(cell(values, ['구_읍_면'])),
    construction_type: clean(cell(values, ['건축구분'])),
    site_area_sqm: numberValue(cell(values, ['대지면적_㎡', '대지면적', '대지면적_sqm'])),
    site_area_py: numberValue(cell(values, ['대지면적_평', '대지면적평', '대지면적_3_3'])),
    building_area_sqm: numberValue(cell(values, ['건축면적_㎡', '건축면적', '건축면적_sqm'])),
    building_area_py: numberValue(cell(values, ['건축면적_평', '건축면적평', '건축면적_3_3'])),
    gross_area_sqm: numberValue(cell(values, ['연면적_㎡', '연면적', '연면적_sqm'])),
    gross_area_py: numberValue(cell(values, ['연면적_평', '연면적평', '연면적_3_3'])),
    main_use: clean(cell(values, ['주용도'])),
    temperature_type: clean(cell(values, ['용도_상온_저온_복합', '용도_상온_저온_복합_2'])),
    permit_date: dateValue(cell(values, ['건축허가일'])),
    start_date: dateValue(cell(values, ['실제착공일'])),
    completion_date: dateValue(cell(values, ['사용승인일'])),
    owner_name: clean(cell(values, ['소유주_시행주체', '소유주시행주체'])),
    owner_type: clean(cell(values, ['소유주_유형'])),
    construction_company: clean(cell(values, ['시공사'])),
    progress_status: progressStatus,
    schedule_confidence: expectedYear && expectedQuarter && !/미정|-/.test(`${expectedYear} ${expectedQuarter}`) ? 'dated' : 'undated',
    payload: values,
  };
}

function buildValidationSummary(domain, rowCounts, normalized) {
  if (domain !== 'sector_market') return { status: 'validated', row_counts: rowCounts };
  const newSupplyCases = (normalized.supplyCases || []).filter((row) => row.supply_kind === 'new_supply');
  const pipelineSupplyCases = (normalized.supplyCases || []).filter((row) => row.supply_kind === 'pipeline');
  const newSupplyTotal = newSupplyCases
    .reduce((sum, row) => sum + (Number(row.gross_area_py) || 0), 0);
  const warnings = [];
  const rawNewSupplyRows = Object.entries(rowCounts)
    .filter(([sheetName]) => /신규|supply|공급|좉퇋|怨듦툒/iu.test(sheetName))
    .reduce((sum, [, count]) => sum + Number(count || 0), 0);
  if (rawNewSupplyRows && newSupplyCases.length && newSupplyCases.length / rawNewSupplyRows < 0.2) {
    warnings.push({
      code: 'new_supply_normalized_drop',
      message: 'Raw 신규공급 후보 행 대비 정규화된 신규공급 사례 수가 크게 적습니다. 제목/주석/누적 섹션 제외 로직을 검토하세요.',
      raw_candidate_rows: rawNewSupplyRows,
      normalized_rows: newSupplyCases.length,
    });
  }
  return {
    status: warnings.length ? 'validated_with_warnings' : 'validated',
    row_counts: rowCounts,
    normalized_counts: {
      lease_observations: normalized.leaseObservations?.length || 0,
      supply_cases: normalized.supplyCases?.length || 0,
      pipeline_supply_cases: pipelineSupplyCases.length,
      new_supply_cases: newSupplyCases.length,
      transaction_cases: normalized.transactionCases?.length || 0,
      cap_rate_series: normalized.capRateSeries?.length || 0,
    },
    check_values: {
      new_supply_total_gross_area_py: Math.round(newSupplyTotal * 10) / 10,
    },
    warnings,
  };
}

function batch(items, size = 500) {
  const out = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

function buildValidationSummary(domain, rowCounts, normalized) {
  if (domain !== 'sector_market') return { status: 'validated', row_counts: rowCounts };
  const newSupplyCases = (normalized.supplyCases || []).filter((row) => row.supply_kind === 'new_supply');
  const pipelineSupplyCases = (normalized.supplyCases || []).filter((row) => row.supply_kind === 'pipeline');
  const newSupplyTotal = newSupplyCases.reduce((sum, row) => sum + (Number(row.gross_area_py) || 0), 0);
  const rawNewSupplyRows = Object.entries(rowCounts)
    .filter(([sheetName]) => /(\uB2F9\uBD84\uAE30|\uC2E0\uADDC)/iu.test(sheetName) && /\uACF5\uAE09/iu.test(sheetName))
    .reduce((sum, [, count]) => sum + Number(count || 0), 0);
  const warnings = [];
  if (rawNewSupplyRows && !newSupplyCases.length) {
    warnings.push({
      code: 'new_supply_normalized_empty',
      message: 'Quarterly new supply source rows were detected, but no normalized new supply cases were produced.',
      raw_candidate_rows: rawNewSupplyRows,
      normalized_rows: newSupplyCases.length,
    });
  }
  return {
    status: warnings.length ? 'validated_with_warnings' : 'validated',
    row_counts: rowCounts,
    normalized_counts: {
      lease_observations: normalized.leaseObservations?.length || 0,
      supply_cases: normalized.supplyCases?.length || 0,
      pipeline_supply_cases: pipelineSupplyCases.length,
      new_supply_cases: newSupplyCases.length,
      transaction_cases: normalized.transactionCases?.length || 0,
      cap_rate_series: normalized.capRateSeries?.length || 0,
    },
    check_values: {
      new_supply_total_gross_area_py: Math.round(newSupplyTotal * 10) / 10,
    },
    warnings,
  };
}

async function publishParsed(parsed, options) {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) throw new Error('Set SUPABASE_URL/VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before --publish.');
  const supabase = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

  const storagePath = parsed.sourceFile.storage_path;
  const upload = await supabase.storage.from(MARKET_BUCKET).upload(storagePath, parsed.buffer, {
    contentType: parsed.sourceFile.mime_type,
    upsert: true,
  });
  if (upload.error) throw new Error(`Storage upload failed: ${upload.error.message}`);
  const extractedPath = storagePath.replace(/\.xlsx$/i, '.extracted.json');
  const extractedPayload = Buffer.from(JSON.stringify({
    sourceFile: parsed.sourceFile,
    sheets: parsed.sheets,
    columns: parsed.columns,
    rows: parsed.rows,
    normalized: parsed.normalized,
  }));
  const extractedUpload = await supabase.storage.from(MARKET_BUCKET).upload(extractedPath, extractedPayload, {
    contentType: 'application/json',
    upsert: true,
  });
  if (extractedUpload.error) throw new Error(`Extracted JSON upload failed: ${extractedUpload.error.message}`);

  if (options.activate) {
    const deactivate = await supabase.from('ll_source_files').update({ active_version: false, parse_status: 'archived' }).eq('source_domain', parsed.sourceFile.source_domain).eq('active_version', true);
    if (deactivate.error) throw new Error(`Deactivate previous source failed: ${deactivate.error.message}`);
  }

  const sourceFile = {
    ...parsed.sourceFile,
    active_version: Boolean(options.activate),
    parse_status: options.activate ? 'published' : 'validated',
    published_at: options.activate ? new Date().toISOString() : null,
  };
  for (const [table, rows] of [
    ['ll_source_files', [sourceFile]],
    ['ll_source_sheets', parsed.sheets],
    ['ll_source_columns', parsed.columns],
    ['ll_source_rows', parsed.rows],
    ['ll_sector_market_lease_observations', parsed.normalized.leaseObservations || []],
    ['ll_sector_market_supply_cases', parsed.normalized.supplyCases || []],
    ['ll_sector_market_transaction_cases', parsed.normalized.transactionCases || []],
    ['ll_sector_market_cap_rate_series', parsed.normalized.capRateSeries || []],
  ]) {
    for (const chunk of batch(rows, table === 'll_source_rows' ? 400 : 800)) {
      if (!chunk.length) continue;
      const result = await supabase.from(table).upsert(chunk);
      if (result.error) throw new Error(`${table} upsert failed: ${result.error.message}`);
    }
  }
  return { storage_path: storagePath, extracted_path: extractedPath, active_version: sourceFile.active_version };
}

function sqlLiteral(value) {
  if (value === null || value === undefined) return 'null';
  return `'${String(value).replace(/'/g, "''")}'`;
}

function dollarJson(value, tag) {
  const json = JSON.stringify(value || []);
  return `$${tag}$${json}$${tag}$::jsonb`;
}

function upsertFromJsonSql(table, rows, conflictColumns, tag) {
  if (!rows.length) return '';
  const columns = Object.keys(rows.reduce((acc, row) => Object.assign(acc, row), {}));
  const insertColumns = columns.map((column) => `"${column}"`).join(', ');
  const updateColumns = columns
    .filter((column) => !conflictColumns.includes(column))
    .map((column) => `"${column}" = excluded."${column}"`)
    .join(',\n    ');
  const conflictTarget = conflictColumns.map((column) => `"${column}"`).join(', ');
  return `
with incoming as (
  select * from jsonb_populate_recordset(null::public.${table}, ${dollarJson(rows, tag)})
)
insert into public.${table} (${insertColumns})
select ${insertColumns} from incoming
on conflict (${conflictTarget}) do update set
    ${updateColumns};
`;
}

function buildSqlExport(parsed, options = {}) {
  const activate = Boolean(options.activate);
  const sourceFile = {
    ...parsed.sourceFile,
    active_version: activate,
    parse_status: activate ? 'published' : 'validated',
    published_at: activate ? new Date().toISOString() : null,
  };
  const sections = [
    '-- Generated by logistics-source-workbook-ingest.cjs',
    `-- Source: ${parsed.sourceFile.file_name}`,
    'begin;',
    activate
      ? `update public.ll_source_files set active_version = false, parse_status = 'archived', updated_at = now() where source_domain = ${sqlLiteral(parsed.sourceFile.source_domain)} and active_version is true and source_file_id <> ${sqlLiteral(parsed.sourceFile.source_file_id)};`
      : '',
    upsertFromJsonSql('ll_source_files', [sourceFile], ['source_key'], 'source_files_json'),
    upsertFromJsonSql('ll_source_sheets', parsed.sheets, ['source_file_id', 'sheet_name'], 'source_sheets_json'),
    upsertFromJsonSql('ll_source_columns', parsed.columns, ['source_sheet_id', 'column_index'], 'source_columns_json'),
    upsertFromJsonSql('ll_source_rows', parsed.rows, ['source_file_id', 'sheet_name', 'row_number'], 'source_rows_json'),
    upsertFromJsonSql('ll_sector_market_lease_observations', parsed.normalized.leaseObservations || [], ['source_row_id'], 'lease_observations_json'),
    upsertFromJsonSql('ll_sector_market_supply_cases', parsed.normalized.supplyCases || [], ['source_row_id'], 'supply_cases_json'),
    upsertFromJsonSql('ll_sector_market_transaction_cases', parsed.normalized.transactionCases || [], ['source_row_id'], 'transaction_cases_json'),
    upsertFromJsonSql('ll_sector_market_cap_rate_series', parsed.normalized.capRateSeries || [], ['source_row_id'], 'cap_rate_series_json'),
    'commit;',
  ];
  return sections.filter(Boolean).join('\n');
}

function writeSqlChunkFiles(parsed, options = {}) {
  const activate = Boolean(options.activate);
  const chunkDir = options.chunkDir;
  ensureDir(chunkDir);
  const sourceFile = {
    ...parsed.sourceFile,
    active_version: activate,
    parse_status: activate ? 'published' : 'validated',
    published_at: activate ? new Date().toISOString() : null,
  };
  const files = [];
  const write = (name, sql) => {
    if (!sql.trim()) return;
    const filePath = path.join(chunkDir, `${String(files.length + 1).padStart(3, '0')}_${name}.sql`);
    fs.writeFileSync(filePath, sql, 'utf8');
    files.push(filePath);
  };
  write('source_file', [
    'begin;',
    activate
      ? `update public.ll_source_files set active_version = false, parse_status = 'archived', updated_at = now() where source_domain = ${sqlLiteral(parsed.sourceFile.source_domain)} and active_version is true and source_file_id <> ${sqlLiteral(parsed.sourceFile.source_file_id)};`
      : '',
    upsertFromJsonSql('ll_source_files', [sourceFile], ['source_key'], 'chunk_source_files_json'),
    'commit;',
  ].filter(Boolean).join('\n'));
  const tableSpecs = [
    ['ll_source_sheets', parsed.sheets, ['source_file_id', 'sheet_name'], 200, 'source_sheets'],
    ['ll_source_columns', parsed.columns, ['source_sheet_id', 'column_index'], 250, 'source_columns'],
    ['ll_source_rows', parsed.rows, ['source_file_id', 'sheet_name', 'row_number'], 120, 'source_rows'],
    ['ll_sector_market_lease_observations', parsed.normalized.leaseObservations || [], ['source_row_id'], 500, 'lease_observations'],
    ['ll_sector_market_supply_cases', parsed.normalized.supplyCases || [], ['source_row_id'], 300, 'supply_cases'],
    ['ll_sector_market_transaction_cases', parsed.normalized.transactionCases || [], ['source_row_id'], 250, 'transaction_cases'],
    ['ll_sector_market_cap_rate_series', parsed.normalized.capRateSeries || [], ['source_row_id'], 300, 'cap_rate_series'],
  ];
  tableSpecs.forEach(([table, rows, conflict, chunkSize, label]) => {
    batch(rows, chunkSize).forEach((chunk, index) => {
      write(`${label}_${String(index + 1).padStart(3, '0')}`, [
        'begin;',
        upsertFromJsonSql(table, chunk, conflict, `chunk_${label}_${index + 1}_json`),
        'commit;',
      ].join('\n'));
    });
  });
  return files;
}

async function main() {
  const presetKey = argValue('--preset', 'market2026q1');
  const preset = SOURCE_PRESETS[presetKey] || SOURCE_PRESETS.market2026q1;
  const filePath = path.resolve(argValue('--file', findPresetFile(preset)));
  const domain = argValue('--domain', preset.domain);
  const reportPeriod = argValue('--report-period', preset.reportPeriod || '');
  const asOfDate = argValue('--as-of-date', preset.asOfDate || '');
  const version = argValue('--version', preset.version || reportPeriod || '');
  const publish = hasFlag('--publish');
  const emitSql = hasFlag('--emit-sql');
  const noArtifact = hasFlag('--no-artifact');
  const activate = publish && !hasFlag('--no-activate');

  if (!noArtifact) ensureDir(OUT_DIR);
  const parsed = parseSourceWorkbook(filePath, { domain, reportPeriod, asOfDate, version });
  const summary = {
    source_file: parsed.sourceFile,
    workbook: filePath,
    dry_run: !publish,
    sheet_count: parsed.sheets.length,
    source_row_count: parsed.rows.length,
    source_column_count: parsed.columns.length,
    normalized_counts: parsed.sourceFile.validation_summary.normalized_counts || {},
    check_values: parsed.sourceFile.validation_summary.check_values || {},
    published: null,
  };
  if (publish) summary.published = await publishParsed(parsed, { activate });
  if (emitSql) {
    ensureDir(OUT_DIR);
    const sqlPath = path.join(OUT_DIR, `source-workbook-ingest-${domain}-${version || parsed.sourceHash.slice(0, 8)}.sql`);
    const chunkDir = path.join(OUT_DIR, `source-workbook-ingest-${domain}-${version || parsed.sourceHash.slice(0, 8)}-sql-chunks`);
    const extractedPath = path.join(OUT_DIR, `source-workbook-ingest-${domain}-${version || parsed.sourceHash.slice(0, 8)}.extracted.json`);
    fs.writeFileSync(sqlPath, buildSqlExport(parsed, { activate: !hasFlag('--no-activate') }), 'utf8');
    const sqlChunkFiles = writeSqlChunkFiles(parsed, { activate: !hasFlag('--no-activate'), chunkDir });
    fs.writeFileSync(extractedPath, JSON.stringify({
      sourceFile: parsed.sourceFile,
      sheets: parsed.sheets,
      columns: parsed.columns,
      rows: parsed.rows,
      normalized: parsed.normalized,
    }, null, 2), 'utf8');
    summary.sql_path = sqlPath;
    summary.sql_chunk_dir = chunkDir;
    summary.sql_chunk_count = sqlChunkFiles.length;
    summary.extracted_path = extractedPath;
  }
  const outPath = path.join(OUT_DIR, `source-workbook-ingest-${domain}-${version || parsed.sourceHash.slice(0, 8)}.json`);
  if (!noArtifact) {
    fs.writeFileSync(outPath, JSON.stringify(summary, null, 2), 'utf8');
    fs.writeFileSync(path.join(OUT_DIR, 'source-workbook-ingest-latest.json'), JSON.stringify(summary, null, 2), 'utf8');
  }
  console.log(JSON.stringify({ ok: true, outPath: noArtifact ? null : outPath, ...summary }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
