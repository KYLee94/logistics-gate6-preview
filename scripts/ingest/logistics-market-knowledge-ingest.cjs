const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const XLSX = require('xlsx');

const ROOT = path.resolve(__dirname, '..', '..');
const OUT_DIR = path.join(ROOT, 'qa-artifacts', 'logistics-gate6');
const DEFAULT_SOURCE_DIR = 'C:\\Users\\10524\\Desktop\\codex_realasset\\Project\\03_Logi_Leasing_Dashboard\\260604_market data';
const DEFAULT_ORIGIN = 'https://kylee94.github.io';
const EDGE_FUNCTION = 'll-dashboard-api';
const RUNTIME_NODE_MODULES = 'C:\\Users\\10524\\.cache\\codex-runtimes\\codex-primary-runtime\\dependencies\\node\\node_modules';

function readEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  return Object.fromEntries(fs.readFileSync(filePath, 'utf8')
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#') && line.includes('='))
    .map((line) => {
      const index = line.indexOf('=');
      return [line.slice(0, index).trim(), line.slice(index + 1).trim().replace(/^['"]|['"]$/gu, '')];
    }));
}

const fileEnv = {
  ...readEnvFile(path.join(ROOT, '.env')),
  ...readEnvFile(path.join(ROOT, '.env.local')),
};

function envValue(...keys) {
  for (const key of keys) {
    if (process.env[key]) return process.env[key];
    if (fileEnv[key]) return fileEnv[key];
  }
  return '';
}

function argValue(name, fallback = '') {
  const flag = `--${name}`;
  const index = process.argv.indexOf(flag);
  return index === -1 ? fallback : (process.argv[index + 1] || fallback);
}

function timestampForFile() {
  return new Date().toISOString().replace(/[-:]/gu, '').replace(/\..+$/u, '').replace('T', '-');
}

function sha256Buffer(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function sha256Text(text) {
  return crypto.createHash('sha256').update(String(text || '')).digest('hex');
}

function normalizeText(value) {
  return String(value ?? '').replace(/\u0000/gu, '').replace(/\s+/gu, ' ').trim();
}

function numberValue(value) {
  if (value === undefined || value === null || value === '') return null;
  const numeric = Number(String(value).replace(/,/gu, '').replace(/%/gu, '').replace(/[^\d.-]/gu, ''));
  return Number.isFinite(numeric) ? numeric : null;
}

function keywords(text, limit = 32) {
  return [...new Set(normalizeText(text)
    .replace(/[^\p{Letter}\p{Number}\s.]/gu, ' ')
    .split(/\s+/u)
    .map((item) => item.trim())
    .filter((item) => item.length >= 2))]
    .slice(0, limit);
}

function inferMetadata(fileName, sourceType) {
  let publisher = 'IGIS 내부 시장 DB';
  if (fileName.includes('세빌스')) publisher = '세빌스';
  else if (fileName.includes('알스퀘어')) publisher = '알스퀘어';
  else if (fileName.includes('젠스타메이트')) publisher = '젠스타메이트';
  else if (fileName.includes('쿠시먼')) publisher = '쿠시먼앤웨이크필드';
  else if (fileName.toLowerCase().includes('market db') || fileName.includes('통합DB')) publisher = 'IGIS 내부 시장 DB';

  const year = fileName.match(/20\d{2}/u)?.[0] || (fileName.includes('25.') ? '2025' : '');
  let reportPeriod = year;
  let asOfDate = year ? `${year}-12-31` : '';
  const quarter = fileName.match(/([1-4])\s*분기|([1-4])Q|Q([1-4])/iu);
  const half = fileName.match(/([12])H/iu);
  if (year && quarter) {
    const q = Number(quarter[1] || quarter[2] || quarter[3]);
    reportPeriod = `${year} Q${q}`;
    asOfDate = `${year}-${String(q * 3).padStart(2, '0')}-${q === 1 ? '31' : q === 2 ? '30' : q === 3 ? '30' : '31'}`;
  } else if (year && half) {
    const h = Number(half[1]);
    reportPeriod = `${year} ${h}H`;
    asOfDate = `${year}-${h === 1 ? '06-30' : '12-31'}`;
  } else if (fileName.includes('25.4')) {
    reportPeriod = '2025 Q4';
    asOfDate = '2025-12-31';
  }

  return {
    publisher,
    report_title: fileName.replace(/\.(pdf|xlsx)$/iu, ''),
    source_type: sourceType,
    report_period: reportPeriod,
    as_of_date: asOfDate,
  };
}

function chunkText({ sourceHash, text, chunkType, pageNumber, sheetName, rowStart, rowEnd, status = 'ready', quality = 1 }) {
  const normalized = normalizeText(text);
  if (!normalized) return [];
  const output = [];
  const size = 1100;
  const overlap = 120;
  for (let offset = 0; offset < normalized.length; offset += size - overlap) {
    const content = normalized.slice(offset, offset + size).trim();
    if (content.length < 25) continue;
    const keyBasis = [sourceHash, chunkType, pageNumber || '', sheetName || '', rowStart || '', rowEnd || '', offset, content.slice(0, 120)].join('|');
    output.push({
      chunk_key: sha256Text(keyBasis),
      chunk_type: chunkType,
      source_locator: {
        page: pageNumber || undefined,
        sheet: sheetName || undefined,
        row_start: rowStart || undefined,
        row_end: rowEnd || undefined,
      },
      page_number: pageNumber || undefined,
      sheet_name: sheetName || undefined,
      row_start: rowStart || undefined,
      row_end: rowEnd || undefined,
      content,
      keywords: keywords(content),
      extraction_status: status,
      ocr_quality_score: quality,
      embedding_status: 'not_generated',
      metadata: { char_start: offset, char_end: offset + content.length },
    });
  }
  return output;
}

function sheetRows(workbook, sheetName) {
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) return [];
  return XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: '' });
}

function cell(row, index) {
  return normalizeText(Array.isArray(row) ? row[index] : '');
}

function compactRowValues(row) {
  return Array.isArray(row)
    ? row.map(normalizeText).filter(Boolean).slice(0, 80)
    : [];
}

function findTransactionHeader(rows) {
  const index = rows.findIndex((row) => cell(row, 0).includes('거래') && cell(row, 0).includes('도') && cell(row, 2).includes('건물'));
  return index >= 0 ? index : 0;
}

function transactionColumns(header) {
  if (cell(header, 17).includes('연면적') || cell(header, 24).includes('매수')) {
    return { year: 0, quarter: 1, building: 2, type: 3, region: 4, province: 5, city: 6, town: 7, village: 8, lotMain: 9, lotSub: 10, tradeAreaPy: 13, tradeAreaSqm: 14, amountThousand: 15, unitPrice: 16, areaPy: 17, areaSqm: 18, seller: 23, buyer: 24, capRate: 28 };
  }
  return { year: 0, quarter: 1, building: 2, type: -1, region: 3, province: 4, city: 5, town: 6, village: 7, lotMain: 8, lotSub: 9, tradeAreaPy: 10, tradeAreaSqm: 11, amountThousand: 12, unitPrice: 13, areaPy: 10, areaSqm: 11, seller: 15, buyer: 16, capRate: -1 };
}

function transactionFacts(rows, sourceHash, sheetName) {
  const headerIndex = findTransactionHeader(rows);
  const cols = transactionColumns(rows[headerIndex] || []);
  return rows.slice(headerIndex + 1).map((row, offset) => {
    const rowNumber = headerIndex + offset + 2;
    const year = numberValue(cell(row, cols.year));
    const buildingName = cell(row, cols.building);
    if (!year || !buildingName) return null;
    const quarter = numberValue((cell(row, cols.quarter).match(/[1-4]/u) || [])[0]);
    const lot = cell(row, cols.lotMain) ? `${cell(row, cols.lotMain)}${cell(row, cols.lotSub) && cell(row, cols.lotSub) !== '0' ? `-${cell(row, cols.lotSub)}` : ''}` : '';
    const address = [cell(row, cols.province), cell(row, cols.city), cell(row, cols.town), cell(row, cols.village), lot].filter(Boolean).join(' ');
    const areaPy = numberValue(cell(row, cols.areaPy)) ?? numberValue(cell(row, cols.tradeAreaPy));
    const areaSqm = numberValue(cell(row, cols.areaSqm)) ?? numberValue(cell(row, cols.tradeAreaSqm));
    const amountThousand = numberValue(cell(row, cols.amountThousand));
    const unitPrice = numberValue(cell(row, cols.unitPrice));
    const capRate = cols.capRate >= 0 ? numberValue(cell(row, cols.capRate)) : null;
    const buyer = cell(row, cols.buyer);
    const seller = cell(row, cols.seller);
    const period = quarter ? `${year} Q${quarter}` : String(year);
    const factText = [
      period,
      cell(row, cols.region),
      buildingName,
      address,
      areaPy ? `연면적 ${areaPy.toLocaleString('ko-KR')}평` : '',
      amountThousand ? `거래가격 ${amountThousand.toLocaleString('ko-KR')}천원` : '',
      unitPrice ? `단가 ${unitPrice.toLocaleString('ko-KR')}천원/평` : '',
      buyer ? `매수자 ${buyer}` : '',
      seller ? `매도자 ${seller}` : '',
    ].filter(Boolean).join(', ');
    return {
      fact_key: sha256Text([sourceHash, sheetName, rowNumber, 'transaction', buildingName, areaPy, amountThousand, buyer, seller].join('|')),
      fact_type: 'transaction',
      metric_name: '물류센터 거래사례',
      metric_code: 'transaction_case',
      period,
      year,
      quarter,
      region: cell(row, cols.region),
      submarket: cell(row, cols.type),
      asset_name: buildingName,
      building_name: buildingName,
      address,
      buyer_name: buyer,
      seller_name: seller,
      numeric_value: unitPrice,
      unit: unitPrice === null ? '' : '천원/평',
      amount_krw: amountThousand === null ? null : amountThousand * 1000,
      area_py: areaPy,
      area_sqm: areaSqm,
      cap_rate: capRate,
      fact_text: factText,
      source_locator: { sheet: sheetName, row: rowNumber },
      data_quality_flags: areaPy === null ? ['missing_area_py'] : [],
      payload: { row_values: compactRowValues(row) },
    };
  }).filter(Boolean);
}

function findSupplyHeader(rows) {
  const index = rows.findIndex((row) => cell(row, 0).includes('준공예정') && cell(row, 4).includes('창고'));
  return index >= 0 ? index : -1;
}

function supplyFacts(rows, sourceHash, sheetName) {
  const headerIndex = findSupplyHeader(rows);
  if (headerIndex < 0) return [];
  return rows.slice(headerIndex + 1).map((row, offset) => {
    const rowNumber = headerIndex + offset + 2;
    const year = numberValue(cell(row, 0));
    const name = cell(row, 4);
    if (!year || !name) return null;
    const quarter = numberValue((cell(row, 1).match(/[1-4]/u) || [])[0]);
    const address = [cell(row, 6), cell(row, 7), cell(row, 8), cell(row, 9), cell(row, 10) ? `${cell(row, 10)}${cell(row, 11) && cell(row, 11) !== '0' ? `-${cell(row, 11)}` : ''}` : ''].filter(Boolean).join(' ');
    const areaSqm = numberValue(cell(row, 13));
    const areaPy = numberValue(cell(row, 14));
    const period = quarter ? `${year} Q${quarter}` : String(year);
    const factText = [
      period,
      cell(row, 5),
      name,
      address,
      areaPy ? `연면적 ${areaPy.toLocaleString('ko-KR')}평` : '',
      cell(row, 20),
      cell(row, 21),
      cell(row, 22),
    ].filter(Boolean).join(', ');
    return {
      fact_key: sha256Text([sourceHash, sheetName, rowNumber, 'supply', name, areaPy, address].join('|')),
      fact_type: 'supply_pipeline',
      metric_name: '공급예정 물류센터',
      metric_code: 'supply_pipeline',
      period,
      year,
      quarter,
      region: cell(row, 5),
      asset_name: name,
      building_name: name,
      address,
      numeric_value: areaPy,
      unit: areaPy === null ? '' : '평',
      area_py: areaPy,
      area_sqm: areaSqm,
      fact_text: factText,
      source_locator: { sheet: sheetName, row: rowNumber },
      data_quality_flags: areaPy === null ? ['missing_area_py'] : [],
      payload: { row_values: compactRowValues(row) },
    };
  }).filter(Boolean);
}

function genericMetricFacts(rows, sourceHash, sheetName) {
  return rows.map((row, index) => {
    const cells = row.map(normalizeText).filter(Boolean);
    if (cells.length < 2) return null;
    const numericCells = cells.map(numberValue).filter((value) => value !== null);
    if (!numericCells.length) return null;
    const rowText = cells.join(' | ');
    return {
      fact_key: sha256Text([sourceHash, sheetName, index + 1, 'market_metric', rowText.slice(0, 160)].join('|')),
      fact_type: 'market_metric',
      metric_name: cells[0],
      metric_code: `sheet_metric_${sheetName}_${index + 1}`.replace(/\s+/gu, '_').toLowerCase(),
      numeric_value: numericCells[0],
      unit: '',
      fact_text: rowText,
      source_locator: { sheet: sheetName, row: index + 1 },
      data_quality_flags: ['generic_sheet_metric'],
      payload: { row_values: compactRowValues(row) },
    };
  }).filter(Boolean);
}

function processWorkbook(filePath, sourceHash) {
  const workbook = XLSX.readFile(filePath, { raw: false, cellDates: true, cellFormula: false, cellHTML: false, cellNF: false, cellStyles: false });
  const chunks = [];
  const facts = [];
  const extractedParts = [];
  for (const sheetName of workbook.SheetNames) {
    const rows = sheetRows(workbook, sheetName);
    const nonEmpty = rows
      .map((row, index) => ({ row, rowNumber: index + 1 }))
      .filter(({ row }) => row.some((value) => normalizeText(value)));
    for (let index = 0; index < nonEmpty.length; index += 30) {
      const slice = nonEmpty.slice(index, index + 30);
      const text = slice.map(({ row, rowNumber }) => `${rowNumber}: ${compactRowValues(row).join(' | ')}`).filter((line) => line.replace(/^\d+:\s*/u, '').trim()).join('\n');
      extractedParts.push(`[${sheetName}] ${text}`);
      chunks.push(...chunkText({
        sourceHash,
        text,
        sheetName,
        rowStart: slice[0]?.rowNumber,
        rowEnd: slice[slice.length - 1]?.rowNumber,
        chunkType: 'excel_rows',
      }));
    }
    const lowerSheet = sheetName.toLowerCase();
    if (lowerSheet.includes('transaction') || lowerSheet === 'sheet') facts.push(...transactionFacts(rows, sourceHash, sheetName));
    if (sheetName.includes('공급예정')) facts.push(...supplyFacts(rows, sourceHash, sheetName));
    if (lowerSheet.includes('yearly') || lowerSheet.includes('quarter')) facts.push(...genericMetricFacts(nonEmpty.map((item) => item.row), sourceHash, sheetName));
    if (sheetName.includes('주의') || sheetName.includes('개요')) {
      const text = nonEmpty.map(({ row }) => row.map(normalizeText).filter(Boolean).join(' ')).join('\n');
      if (text) facts.push({
        fact_key: sha256Text([sourceHash, sheetName, 'definition'].join('|')),
        fact_type: sheetName.includes('주의') ? 'caveat' : 'definition',
        metric_name: sheetName,
        metric_code: sheetName.includes('주의') ? 'source_caveat' : 'source_definition',
        fact_text: text,
        source_locator: { sheet: sheetName },
        payload: { sheet_name: sheetName },
      });
    }
  }
  return {
    sheetCount: workbook.SheetNames.length,
    rowCount: facts.length,
    chunks,
    facts,
    extractedText: extractedParts.join('\n\n'),
  };
}

async function loadPdfJs() {
  globalThis.DOMMatrix = globalThis.DOMMatrix || class DOMMatrix {};
  globalThis.ImageData = globalThis.ImageData || class ImageData {};
  globalThis.Path2D = globalThis.Path2D || class Path2D {};
  const modulePath = path.join(RUNTIME_NODE_MODULES, 'pdfjs-dist', 'legacy', 'build', 'pdf.mjs').replace(/\\/gu, '/');
  return import(`file:///${modulePath}`);
}

async function processPdf(filePath, sourceHash) {
  const pdfjs = await loadPdfJs();
  const data = new Uint8Array(fs.readFileSync(filePath));
  const loadingTask = pdfjs.getDocument({ data, disableFontFace: true, isEvalSupported: false, useSystemFonts: false });
  const pdf = await loadingTask.promise;
  const chunks = [];
  const pages = [];
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const text = normalizeText((content.items || []).map((item) => item.str || '').join(' '));
    pages.push({ pageNumber, text });
    chunks.push(...chunkText({
      sourceHash,
      text,
      pageNumber,
      chunkType: 'pdf_page_text',
      quality: text.length >= 120 ? 1 : 0.25,
      status: text.length >= 120 ? 'ready' : 'needs_ocr_review',
    }));
  }
  const extractedText = pages.map((page) => `[p.${page.pageNumber}] ${page.text}`).join('\n\n');
  return {
    pageCount: pdf.numPages,
    chunks,
    facts: [],
    extractedText,
    quality: extractedText.length / Math.max(1, pdf.numPages) >= 120 ? 1 : 0.25,
    status: extractedText.length / Math.max(1, pdf.numPages) >= 120 ? 'ready' : 'needs_ocr_review',
  };
}

async function signInForAccessToken(supabaseUrl, anonKey, email, password) {
  const response = await fetch(`${supabaseUrl.replace(/\/$/u, '')}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: anonKey, 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body.access_token) {
    const message = body.msg || body.message || body.error_description || body.error || 'unknown auth error';
    throw new Error(`Supabase Auth login failed (${response.status}): ${message}`);
  }
  return body.access_token;
}

async function resolveAccessToken(supabaseUrl, anonKey) {
  const token = envValue('LOGISTICS_SUPABASE_ACCESS_TOKEN');
  if (token) return token;
  const email = argValue('email', envValue('LOGISTICS_SUPABASE_EMAIL', 'LOGISTICS_SUPABASE_AUTH_EMAIL', 'VITE_LOGISTICS_QA_EMAIL'));
  const password = argValue('password', envValue('LOGISTICS_SUPABASE_PASSWORD', 'LOGISTICS_SUPABASE_AUTH_PASSWORD', 'VITE_LOGISTICS_QA_PASSWORD'));
  if (!email || !password) throw new Error('Set LOGISTICS_SUPABASE_ACCESS_TOKEN, or LOGISTICS_SUPABASE_EMAIL and LOGISTICS_SUPABASE_PASSWORD.');
  return signInForAccessToken(supabaseUrl, anonKey, email, password);
}

async function invokeJson(endpoint, anonKey, origin, token, action, payload) {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      apikey: anonKey,
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      origin,
    },
    body: JSON.stringify({ action, payload }),
  });
  const text = await response.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { raw: text.slice(0, 800) };
  }
  if (!response.ok || body?.ok === false) {
    throw new Error(`${action} failed ${response.status}: ${JSON.stringify(body).slice(0, 800)}`);
  }
  return body;
}

async function uploadOriginal(endpoint, anonKey, origin, token, filePath) {
  const fileName = path.basename(filePath);
  const buffer = fs.readFileSync(filePath);
  const formData = new FormData();
  formData.append('action', 'market-docs/upload');
  formData.append('payload', '{}');
  formData.append('file', new File([buffer], fileName, {
    type: fileName.toLowerCase().endsWith('.pdf')
      ? 'application/pdf'
      : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  }));
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { apikey: anonKey, authorization: `Bearer ${token}`, origin },
    body: formData,
  });
  const text = await response.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { raw: text.slice(0, 800) };
  }
  if (!response.ok || body?.ok === false) {
    throw new Error(`market-docs/upload failed ${response.status}: ${JSON.stringify(body).slice(0, 800)}`);
  }
  return body;
}

async function processFile(filePath) {
  const fileName = path.basename(filePath);
  const ext = path.extname(fileName).toLowerCase();
  const buffer = fs.readFileSync(filePath);
  const sourceHash = sha256Buffer(buffer);
  const sourceType = ext === '.pdf' ? 'pdf' : 'xlsx';
  const metadata = inferMetadata(fileName, sourceType);
  const extracted = sourceType === 'pdf'
    ? await processPdf(filePath, sourceHash)
    : processWorkbook(filePath, sourceHash);
  const extractedHash = sha256Text(extracted.extractedText);
  return {
    sourceHash,
    document: {
      source_hash: sourceHash,
      file_name: fileName,
      ...metadata,
      extraction_status: extracted.status || 'ready',
      extraction_method: sourceType === 'pdf' ? 'pdfjs_text_layer_v2' : 'xlsx_full_cell_and_fact_parser_v2',
      ocr_quality_score: extracted.quality ?? 1,
      page_count: extracted.pageCount || undefined,
      sheet_count: extracted.sheetCount || undefined,
      row_count: extracted.rowCount || 0,
      original_size_bytes: buffer.length,
      source_preservation_status: 'stored',
      extracted_char_count: extracted.extractedText.length,
      extracted_text_hash: extractedHash,
      metadata: {
        ingested_at: new Date().toISOString(),
        source_file_name: fileName,
        parser_version: 'market_knowledge_ingest_v2',
      },
    },
    chunks: extracted.chunks,
    facts: extracted.facts,
    extracted_text: extracted.extractedText,
  };
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const sourceDir = path.resolve(argValue('source-dir', envValue('LOGISTICS_MARKET_SOURCE_DIR') || DEFAULT_SOURCE_DIR));
  const supabaseUrl = envValue('VITE_SUPABASE_URL', 'SUPABASE_URL');
  const anonKey = envValue('VITE_SUPABASE_ANON_KEY', 'SUPABASE_ANON_KEY');
  if (!supabaseUrl || !anonKey) throw new Error('VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are required.');
  if (!fs.existsSync(sourceDir)) throw new Error(`Market source dir not found: ${sourceDir}`);
  const endpoint = `${supabaseUrl.replace(/\/$/u, '')}/functions/v1/${EDGE_FUNCTION}`;
  const origin = argValue('origin', DEFAULT_ORIGIN);
  const token = await resolveAccessToken(supabaseUrl, anonKey);
  const files = fs.readdirSync(sourceDir)
    .filter((file) => /\.(pdf|xlsx)$/iu.test(file))
    .sort((a, b) => a.localeCompare(b, 'ko-KR'))
    .map((file) => path.join(sourceDir, file));
  if (!files.length) throw new Error(`No market source files found in ${sourceDir}`);

  const results = [];
  const chunkBatchSize = Number(argValue('chunk-batch-size', '80')) || 80;
  const factBatchSize = Number(argValue('fact-batch-size', '180')) || 180;
  for (const filePath of files) {
    const parsed = await processFile(filePath);
    console.log(`PROCESS ${path.basename(filePath)} chunks=${parsed.chunks.length} facts=${parsed.facts.length} chars=${parsed.extracted_text.length}`);
    await uploadOriginal(endpoint, anonKey, origin, token, filePath);
    const firstIngest = await invokeJson(endpoint, anonKey, origin, token, 'market-docs/ingest', {
      document: parsed.document,
      chunks: parsed.chunks.slice(0, chunkBatchSize),
      facts: parsed.facts.slice(0, factBatchSize),
      extracted_text: parsed.extracted_text.slice(0, 900_000),
      replace_existing: true,
    });
    const ingestBatches = [{
      chunks: Math.min(parsed.chunks.length, chunkBatchSize),
      facts: Math.min(parsed.facts.length, factBatchSize),
      replace_existing: true,
      edge_written: firstIngest.data || firstIngest,
    }];
    for (let index = chunkBatchSize; index < parsed.chunks.length; index += chunkBatchSize) {
      const body = await invokeJson(endpoint, anonKey, origin, token, 'market-docs/ingest', {
        document: { ...parsed.document, extracted_text_hash: undefined, extracted_char_count: undefined },
        chunks: parsed.chunks.slice(index, index + chunkBatchSize),
        facts: [],
        replace_existing: false,
      });
      ingestBatches.push({ chunks: Math.min(chunkBatchSize, parsed.chunks.length - index), facts: 0, replace_existing: false, edge_written: body.data || body });
    }
    for (let index = factBatchSize; index < parsed.facts.length; index += factBatchSize) {
      const body = await invokeJson(endpoint, anonKey, origin, token, 'market-docs/ingest', {
        document: { ...parsed.document, extracted_text_hash: undefined, extracted_char_count: undefined },
        chunks: [],
        facts: parsed.facts.slice(index, index + factBatchSize),
        replace_existing: false,
      });
      ingestBatches.push({ chunks: 0, facts: Math.min(factBatchSize, parsed.facts.length - index), replace_existing: false, edge_written: body.data || body });
    }
    const typeCounts = parsed.facts.reduce((acc, row) => {
      acc[row.fact_type] = (acc[row.fact_type] || 0) + 1;
      return acc;
    }, {});
    results.push({
      file_name: path.basename(filePath),
      source_hash: parsed.sourceHash,
      chunks: parsed.chunks.length,
      facts: parsed.facts.length,
      fact_type_counts: typeCounts,
      extracted_chars: parsed.extracted_text.length,
      ingest_batches: ingestBatches,
    });
    console.log(`INGESTED ${path.basename(filePath)} chunks=${parsed.chunks.length} facts=${parsed.facts.length}`);
  }

  const status = await invokeJson(endpoint, anonKey, origin, token, 'market-docs/status', {});
  const top3 = await invokeJson(endpoint, anonKey, origin, token, 'market-docs/search', {
    question: '2025년 거래된 물류센터 중 연면적 기준 top 3 알려줘.',
    limit: 8,
  });
  const artifact = {
    generated_at: new Date().toISOString(),
    source_dir: sourceDir,
    file_count: results.length,
    totals: {
      chunks: results.reduce((sum, row) => sum + row.chunks, 0),
      facts: results.reduce((sum, row) => sum + row.facts, 0),
      transaction_facts: results.reduce((sum, row) => sum + (row.fact_type_counts.transaction || 0), 0),
      supply_pipeline_facts: results.reduce((sum, row) => sum + (row.fact_type_counts.supply_pipeline || 0), 0),
    },
    status: status.data || status,
    top3_search_preview: top3.data?.evidence?.slice(0, 5) || [],
    results,
  };
  artifact.pass = artifact.file_count >= 12
    && artifact.totals.facts > 0
    && artifact.totals.transaction_facts > 0
    && artifact.totals.supply_pipeline_facts > 0
    && Number(artifact.status?.facts || 0) > 0;
  const outPath = path.join(OUT_DIR, `market-docs-ingest-${timestampForFile()}.json`);
  fs.writeFileSync(outPath, JSON.stringify(artifact, null, 2), 'utf8');
  fs.writeFileSync(path.join(OUT_DIR, 'market-docs-ingest-latest.json'), JSON.stringify(artifact, null, 2), 'utf8');
  console.log(`artifact=${outPath}`);
  if (!artifact.pass) process.exit(1);
}

main().catch((error) => {
  console.error(error.stack || error.message || error);
  process.exit(1);
});
