const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const XLSX = require('xlsx');

const ROOT = path.resolve(__dirname, '..', '..');
const OUT_DIR = path.join(ROOT, 'qa-artifacts', 'logistics-gate6');
const DEFAULT_ORIGIN = 'https://kylee94.github.io';
const RUNTIME_NODE_MODULES = 'C:\\Users\\10524\\.cache\\codex-runtimes\\codex-primary-runtime\\dependencies\\node\\node_modules';
const MARKET_EMBEDDING_MODEL = 'gemini-embedding-001';
const MARKET_EMBEDDING_DIM = 768;

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

function hasFlag(name) {
  return process.argv.includes(`--${name}`);
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
  const numeric = Number(String(value).replace(/,/gu, '').replace(/[^\d.-]/gu, ''));
  return Number.isFinite(numeric) ? numeric : null;
}

function keywordList(text, limit = 24) {
  return [...new Set(normalizeText(text)
    .replace(/[^\p{Letter}\p{Number}\s.]/gu, ' ')
    .split(/\s+/u)
    .map((item) => item.trim())
    .filter((item) => item.length >= 2)
    .slice(0, limit))];
}

function inferMetadata(fileName, sourceType) {
  const lower = fileName.toLowerCase();
  let publisher = '기타';
  if (/세빌스|savills/iu.test(fileName)) publisher = '세빌스';
  else if (/알스퀘어|rsquare/iu.test(fileName)) publisher = '알스퀘어';
  else if (/젠스타|genstar/iu.test(fileName)) publisher = '젠스타메이트';
  else if (/쿠시먼|cushman/iu.test(fileName)) publisher = '쿠시먼앤웨이크필드';
  else if (/통합db|market db|거래사례/iu.test(fileName)) publisher = 'IGIS 내부 시장 DB';

  let reportPeriod = '';
  let asOfDate = '';
  const year = lower.match(/20\d{2}/u)?.[0] || '';
  const quarter = lower.match(/([1-4])\s*분기|([1-4])q|q([1-4])/iu);
  const half = lower.match(/([12])h/iu);
  if (year && quarter) {
    const q = Number(quarter[1] || quarter[2] || quarter[3]);
    reportPeriod = `${year} Q${q}`;
    asOfDate = `${year}-${String(q * 3).padStart(2, '0')}-${q === 1 ? '31' : q === 2 ? '30' : q === 3 ? '30' : '31'}`;
  } else if (year && half) {
    const h = Number(half[1]);
    reportPeriod = `${year} ${h}H`;
    asOfDate = `${year}-${h === 1 ? '06-30' : '12-31'}`;
  } else if (/25\.4분기/iu.test(fileName)) {
    reportPeriod = '2025 Q4';
    asOfDate = '2025-12-31';
  } else if (year) {
    reportPeriod = /전망|outlook/iu.test(fileName) ? `${year} 전망` : year;
    asOfDate = `${year}-12-31`;
  }

  return {
    publisher,
    report_title: fileName.replace(/\.(pdf|xlsx)$/iu, ''),
    source_type: sourceType,
    report_period: reportPeriod,
    as_of_date: asOfDate,
  };
}

function extractionQuality(text, pageCount = 1) {
  const normalized = normalizeText(text);
  const hangul = (normalized.match(/[가-힣]/gu) || []).length;
  const alphaNum = (normalized.match(/[\p{Letter}\p{Number}]/gu) || []).length;
  const charsPerPage = normalized.length / Math.max(1, pageCount);
  const density = Math.min(1, charsPerPage / 900);
  const hangulRatio = alphaNum ? hangul / alphaNum : 0;
  return Math.max(0, Math.min(1, (density * 0.65) + (Math.min(0.35, hangulRatio) * 1.0)));
}

function chunkText({ sourceHash, text, pageNumber = null, sheetName = '', rowStart = null, rowEnd = null, chunkType = 'narrative', status = 'ready', quality = null }) {
  const normalized = normalizeText(text);
  if (!normalized) return [];
  const chunks = [];
  const size = 950;
  const overlap = 110;
  for (let offset = 0; offset < normalized.length; offset += size - overlap) {
    const content = normalized.slice(offset, offset + size).trim();
    if (content.length < 30) continue;
    const keyBasis = [sourceHash, chunkType, pageNumber || '', sheetName, rowStart || '', rowEnd || '', offset, content.slice(0, 80)].join('|');
    chunks.push({
      chunk_key: sha256Text(keyBasis),
      chunk_type: chunkType,
      source_locator: {
        page: pageNumber || undefined,
        sheet: sheetName || undefined,
        row_start: rowStart || undefined,
        row_end: rowEnd || undefined,
        chunk_index: chunks.length + 1,
      },
      page_number: pageNumber || undefined,
      sheet_name: sheetName || undefined,
      row_start: rowStart || undefined,
      row_end: rowEnd || undefined,
      content,
      keywords: keywordList(content),
      extraction_status: status,
      ocr_quality_score: quality,
      metadata: { char_start: offset, char_end: offset + content.length },
    });
  }
  return chunks;
}

async function loadPdfJs() {
  globalThis.DOMMatrix = globalThis.DOMMatrix || class DOMMatrix {};
  globalThis.ImageData = globalThis.ImageData || class ImageData {};
  globalThis.Path2D = globalThis.Path2D || class Path2D {};
  const modulePath = path.join(RUNTIME_NODE_MODULES, 'pdfjs-dist', 'legacy', 'build', 'pdf.mjs').replace(/\\/gu, '/');
  return import(`file:///${modulePath}`);
}

async function extractPdf(filePath, sourceHash) {
  const pdfjs = await loadPdfJs();
  const data = new Uint8Array(fs.readFileSync(filePath));
  const loadingTask = pdfjs.getDocument({ data, disableFontFace: true, isEvalSupported: false, useSystemFonts: false });
  const pdf = await loadingTask.promise;
  const pages = [];
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const text = normalizeText((content.items || []).map((item) => item.str || '').join(' '));
    pages.push({ pageNumber, text });
  }
  const fullText = pages.map((page) => page.text).join('\n');
  const quality = extractionQuality(fullText, pdf.numPages);
  const status = quality >= 0.38 ? 'ready' : 'needs_ocr_review';
  const chunks = pages.flatMap((page) => chunkText({
    sourceHash,
    text: page.text,
    pageNumber: page.pageNumber,
    chunkType: 'narrative',
    status,
    quality,
  }));
  return { pageCount: pdf.numPages, textLength: fullText.length, quality, status, chunks };
}

function sheetRows(workbook, sheetName) {
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) return [];
  const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1:A1');
  return XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: '', range });
}

function findHeaderRow(rows, patterns) {
  let best = 0;
  let bestScore = -1;
  rows.forEach((row, index) => {
    const text = row.map(normalizeText).join('|');
    const score = patterns.reduce((sum, pattern) => sum + (pattern.test(text) ? 1 : 0), 0);
    if (score > bestScore) {
      bestScore = score;
      best = index;
    }
  });
  return best;
}

function rowsToObjects(rows, headerIndex) {
  const headers = rows[headerIndex].map((header, index) => normalizeText(header) || `col_${index + 1}`);
  return rows.slice(headerIndex + 1).map((row, rowOffset) => {
    const out = { __row_number: headerIndex + rowOffset + 2 };
    headers.forEach((header, index) => {
      out[header] = row[index];
    });
    return out;
  }).filter((row) => Object.entries(row).some(([key, value]) => key !== '__row_number' && normalizeText(value)));
}

function findByHeader(row, patterns) {
  for (const [key, value] of Object.entries(row)) {
    if (key === '__row_number') continue;
    if (patterns.some((pattern) => pattern.test(key))) return value;
  }
  return '';
}

function periodFromRow(row) {
  const year = numberValue(findByHeader(row, [/거래연도/u, /^year$/iu, /연도/u]));
  const quarterRaw = normalizeText(findByHeader(row, [/거래분기/u, /분기/u, /quarter/iu]));
  const quarter = numberValue(quarterRaw.match(/[1-4]/u)?.[0]);
  if (year && quarter) return { year, quarter, period: `${year} Q${quarter}` };
  if (year) return { year, quarter: null, period: String(year) };
  return { year: null, quarter: null, period: '' };
}

function transactionFacts(rows, sourceHash, sheetName) {
  return rows.map((row) => {
    const period = periodFromRow(row);
    const building = normalizeText(findByHeader(row, [/건물/u, /자산/u, /물류센터/u, /building/iu]));
    const region = normalizeText(findByHeader(row, [/권역/u, /region/iu]));
    const province = normalizeText(findByHeader(row, [/광역/u, /시도/u]));
    const city = normalizeText(findByHeader(row, [/시군/u, /시\/군/u]));
    const address = [province, city, normalizeText(findByHeader(row, [/구읍면/u])), normalizeText(findByHeader(row, [/동리/u]))].filter(Boolean).join(' ');
    const areaPy = numberValue(findByHeader(row, [/거래면적.*평/u, /area.*py/iu]));
    const areaSqm = numberValue(findByHeader(row, [/거래면적.*㎡/u, /거래면적.*m/u]));
    const amountThousand = numberValue(findByHeader(row, [/거래가격/u, /price/iu]));
    const unitPrice = numberValue(findByHeader(row, [/단가/u, /평당/u]));
    const capRate = numberValue(findByHeader(row, [/cap/iu, /수익률/u]));
    const seller = normalizeText(findByHeader(row, [/매도/u, /seller/iu]));
    const buyer = normalizeText(findByHeader(row, [/매수/u, /buyer/iu]));
    const rowNumber = row.__row_number;
    const text = [period.period, region, building, address, amountThousand ? `거래가격 ${amountThousand}천원` : '', unitPrice ? `단가 ${unitPrice}천원/평` : '', buyer ? `매수자 ${buyer}` : '', seller ? `매도자 ${seller}` : ''].filter(Boolean).join(', ');
    return {
      fact_key: sha256Text([sourceHash, sheetName, rowNumber, 'transaction', building, amountThousand, buyer, seller].join('|')),
      fact_type: 'transaction',
      metric_name: '물류센터 거래사례',
      metric_code: 'transaction_case',
      period: period.period,
      year: period.year,
      quarter: period.quarter,
      region,
      asset_name: building,
      building_name: building,
      address,
      buyer_name: buyer,
      seller_name: seller,
      amount_krw: amountThousand === null ? null : amountThousand * 1000,
      area_py: areaPy,
      area_sqm: areaSqm,
      numeric_value: unitPrice,
      unit: unitPrice === null ? '' : '천원/평',
      cap_rate: capRate,
      fact_text: text,
      source_locator: { sheet: sheetName, row: rowNumber },
      payload: row,
    };
  }).filter((fact) => fact.asset_name || fact.fact_text);
}

function cellText(row, index) {
  return normalizeText(Array.isArray(row) ? row[index] : '');
}

function transactionHeaderIndex(rawRows) {
  const index = rawRows.findIndex((row) => {
    const first = cellText(row, 0);
    const third = cellText(row, 2);
    return first.includes('거래') && first.includes('도') && third.includes('건물');
  });
  return index >= 0 ? index : 0;
}

function transactionColumnMap(header) {
  const headerText = (index) => cellText(header, index);
  const integratedWorkbookShape = headerText(17).includes('연면적') || headerText(24).includes('매수');
  if (integratedWorkbookShape) {
    return {
      year: 0,
      quarter: 1,
      building: 2,
      region: 4,
      province: 5,
      city: 6,
      town: 7,
      village: 8,
      lotMain: 9,
      lotSub: 10,
      tradeAreaPy: 13,
      tradeAreaSqm: 14,
      amountThousand: 15,
      unitPrice: 16,
      areaPy: 17,
      areaSqm: 18,
      seller: 23,
      buyer: 24,
      capRate: 28,
    };
  }
  return {
    year: 0,
    quarter: 1,
    building: 2,
    region: 3,
    province: 4,
    city: 5,
    town: 6,
    village: 7,
    lotMain: 8,
    lotSub: 9,
    tradeAreaPy: 10,
    tradeAreaSqm: 11,
    amountThousand: 12,
    unitPrice: 13,
    areaPy: 10,
    areaSqm: 11,
    seller: 15,
    buyer: 16,
    capRate: -1,
  };
}

function transactionFactsFromRawRows(rawRows, sourceHash, sheetName) {
  const headerIndex = transactionHeaderIndex(rawRows);
  const columns = transactionColumnMap(rawRows[headerIndex] || []);
  return rawRows.slice(headerIndex + 1).map((row, rowOffset) => {
    const rowNumber = headerIndex + rowOffset + 2;
    const year = numberValue(cellText(row, columns.year));
    const quarter = numberValue((cellText(row, columns.quarter).match(/[1-4]/u) || [])[0]);
    const building = cellText(row, columns.building);
    if (!year || !building) return null;
    const region = cellText(row, columns.region);
    const province = cellText(row, columns.province);
    const city = cellText(row, columns.city);
    const town = cellText(row, columns.town);
    const village = cellText(row, columns.village);
    const lotMain = cellText(row, columns.lotMain);
    const lotSub = cellText(row, columns.lotSub);
    const lot = lotMain ? `${lotMain}${lotSub && lotSub !== '0' ? `-${lotSub}` : ''}` : '';
    const address = [province, city, town, village, lot].filter(Boolean).join(' ');
    const areaPy = numberValue(cellText(row, columns.areaPy)) ?? numberValue(cellText(row, columns.tradeAreaPy));
    const areaSqm = numberValue(cellText(row, columns.areaSqm)) ?? numberValue(cellText(row, columns.tradeAreaSqm));
    const amountThousand = numberValue(cellText(row, columns.amountThousand));
    const unitPrice = numberValue(cellText(row, columns.unitPrice));
    const capRate = columns.capRate >= 0 ? numberValue(cellText(row, columns.capRate)) : null;
    const seller = cellText(row, columns.seller);
    const buyer = cellText(row, columns.buyer);
    const period = quarter ? `${year} Q${quarter}` : String(year);
    const factText = [
      period,
      region,
      building,
      address,
      areaPy ? `연면적 ${areaPy.toLocaleString('ko-KR')}평` : '',
      amountThousand ? `거래가격 ${amountThousand.toLocaleString('ko-KR')}천원` : '',
      unitPrice ? `단가 ${unitPrice.toLocaleString('ko-KR')}천원/평` : '',
      buyer ? `매수자 ${buyer}` : '',
      seller ? `매도자 ${seller}` : '',
    ].filter(Boolean).join(', ');
    return {
      fact_key: sha256Text([sourceHash, sheetName, rowNumber, 'transaction_v2', building, areaPy, amountThousand, buyer, seller].join('|')),
      fact_type: 'transaction',
      metric_name: '물류센터 거래사례',
      metric_code: 'transaction_case',
      period,
      year,
      quarter,
      region,
      asset_name: building,
      building_name: building,
      address,
      buyer_name: buyer,
      seller_name: seller,
      amount_krw: amountThousand === null ? null : amountThousand * 1000,
      area_py: areaPy,
      area_sqm: areaSqm,
      numeric_value: unitPrice,
      unit: unitPrice === null ? '' : '천원/평',
      cap_rate: capRate,
      fact_text: factText,
      source_locator: { sheet: sheetName, row: rowNumber },
      payload: { parser: 'column_position_transaction_v2', row_values: row },
    };
  }).filter((fact) => fact && (fact.asset_name || fact.fact_text));
}

function supplyFacts(rows, sourceHash, sheetName) {
  return rows.map((row) => {
    const period = periodFromRow(row);
    const name = normalizeText(findByHeader(row, [/물류센터/u, /건물/u, /센터명/u, /자산/u, /project/iu]));
    const region = normalizeText(findByHeader(row, [/권역/u, /region/iu]));
    const address = normalizeText(findByHeader(row, [/주소/u, /소재/u]));
    const areaPy = numberValue(findByHeader(row, [/면적.*평/u, /연면적.*평/u]));
    const areaSqm = numberValue(findByHeader(row, [/면적.*㎡/u, /연면적.*㎡/u, /sqm/iu]));
    const status = normalizeText(findByHeader(row, [/상태/u, /진행/u, /착공/u]));
    const tempType = normalizeText(findByHeader(row, [/온도/u, /상온/u, /저온/u]));
    const rowNumber = row.__row_number;
    const text = [period.period, region, name, address, areaPy ? `${areaPy}평` : '', status, tempType].filter(Boolean).join(', ');
    return {
      fact_key: sha256Text([sourceHash, sheetName, rowNumber, 'supply', name, address].join('|')),
      fact_type: 'supply_pipeline',
      metric_name: '물류센터 공급예정',
      metric_code: 'supply_pipeline',
      period: period.period,
      year: period.year,
      quarter: period.quarter,
      region,
      asset_name: name,
      building_name: name,
      address,
      area_py: areaPy,
      area_sqm: areaSqm,
      unit: areaPy ? '평' : '',
      fact_text: text,
      source_locator: { sheet: sheetName, row: rowNumber },
      payload: row,
    };
  }).filter((fact) => fact.asset_name || fact.fact_text);
}

function genericMarketMetricFacts(rows, sourceHash, sheetName) {
  return rows.map((row, index) => {
    const rowNumber = index + 1;
    const cells = row.map(normalizeText).filter(Boolean);
    if (cells.length < 2) return null;
    const rowText = cells.join(' | ');
    const numericCells = cells.map(numberValue).filter((value) => value !== null);
    const metricName = cells.find((cell) => /거래|공급|cap|임대료|공실|빈도|평당가|규모|면적/iu.test(cell)) || cells[0];
    if (!metricName || !numericCells.length) return null;
    return {
      fact_key: sha256Text([sourceHash, sheetName, rowNumber, 'market_metric', rowText.slice(0, 160)].join('|')),
      fact_type: 'market_metric',
      metric_name: metricName,
      metric_code: metricName.replace(/\s+/gu, '_').toLowerCase(),
      numeric_value: numericCells[0],
      unit: '',
      fact_text: rowText,
      source_locator: { sheet: sheetName, row: rowNumber },
      payload: { row_values: row },
      data_quality_flags: ['block_layout_metric_needs_human_label_review'],
    };
  }).filter(Boolean);
}

function workbookChunksAndFacts(filePath, sourceHash) {
  const workbook = XLSX.readFile(filePath, {
    cellDates: true,
    cellFormula: false,
    cellHTML: false,
    cellNF: false,
    cellStyles: false,
    dense: true,
    WTF: false,
  });
  const chunks = [];
  const facts = [];
  for (const sheetName of workbook.SheetNames) {
    const rows = sheetRows(workbook, sheetName);
    const nonEmptyRows = rows.filter((row) => row.some((cell) => normalizeText(cell)));
    for (let index = 0; index < nonEmptyRows.length; index += 25) {
      const slice = nonEmptyRows.slice(index, index + 25);
      const text = slice.map((row, offset) => `${index + offset + 1}: ${row.map(normalizeText).filter(Boolean).join(' | ')}`).join('\n');
      chunks.push(...chunkText({
        sourceHash,
        text,
        sheetName,
        rowStart: index + 1,
        rowEnd: index + slice.length,
        chunkType: /주의|개요/iu.test(sheetName) ? 'definition' : 'table_text',
        status: 'ready',
        quality: 1,
      }));
    }
    if (/rawdata_Transaction|transaction/iu.test(sheetName) || sheetName === 'sheet') {
      facts.push(...transactionFactsFromRawRows(rows, sourceHash, sheetName));
      continue;
    }
    if (/거래사례|rawdata_Transaction|transaction/iu.test(sheetName) || /Market DB 거래사례/iu.test(path.basename(filePath))) {
      const header = findHeaderRow(rows, [/거래연도/u, /거래분기/u, /거래가격/u, /건물/u]);
      facts.push(...transactionFacts(rowsToObjects(rows, header), sourceHash, sheetName));
    } else if (/공급예정|supply/iu.test(sheetName)) {
      const header = findHeaderRow(rows, [/예정/u, /권역/u, /물류/u, /면적/u]);
      facts.push(...supplyFacts(rowsToObjects(rows, header), sourceHash, sheetName));
    } else if (/Logistics_Yearly|Logistic_quarterly/iu.test(sheetName)) {
      facts.push(...genericMarketMetricFacts(nonEmptyRows, sourceHash, sheetName));
    } else if (/주의사항|개요/iu.test(sheetName)) {
      facts.push({
        fact_key: sha256Text([sourceHash, sheetName, 'definition-caveat'].join('|')),
        fact_type: /주의/iu.test(sheetName) ? 'caveat' : 'definition',
        metric_name: sheetName,
        metric_code: /주의/iu.test(sheetName) ? 'source_caveat' : 'source_definition',
        fact_text: nonEmptyRows.map((row) => row.map(normalizeText).filter(Boolean).join(' ')).join(' '),
        source_locator: { sheet: sheetName },
        payload: { sheet_name: sheetName },
      });
    }
  }
  return { sheetCount: workbook.SheetNames.length, rowCount: facts.length, chunks, facts };
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
  const email = argValue('email', envValue('LOGISTICS_SUPABASE_EMAIL', 'LOGISTICS_SUPABASE_AUTH_EMAIL'));
  const password = argValue('password', envValue('LOGISTICS_SUPABASE_PASSWORD', 'LOGISTICS_SUPABASE_AUTH_PASSWORD'));
  if (!email || !password) throw new Error('Set LOGISTICS_SUPABASE_ACCESS_TOKEN, or LOGISTICS_SUPABASE_EMAIL and LOGISTICS_SUPABASE_PASSWORD.');
  return signInForAccessToken(supabaseUrl, anonKey, email, password);
}

async function invoke(endpoint, anonKey, origin, token, action, payload) {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      apikey: anonKey,
      authorization: token ? `Bearer ${token}` : '',
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
    body = { raw: text.slice(0, 500) };
  }
  return { status: response.status, ok: response.ok, body };
}

async function uploadSourceFile(endpoint, anonKey, origin, token, filePath) {
  const fileName = path.basename(filePath);
  const buffer = fs.readFileSync(filePath);
  const formData = new FormData();
  formData.append('action', 'market-docs/upload');
  formData.append('payload', '{}');
  formData.append('file', new File([buffer], fileName, { type: fileName.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      apikey: anonKey,
      authorization: token ? `Bearer ${token}` : '',
      origin,
    },
    body: formData,
  });
  const text = await response.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { raw: text.slice(0, 500) };
  }
  return { status: response.status, ok: response.ok, body };
}

function googleAiKey() {
  return envValue('GOOGLE_AI_KEY', 'GEMINI_API_KEY');
}

function marketEmbeddingModel() {
  return envValue('GOOGLE_MARKET_EMBEDDING_MODEL', 'MARKET_EMBEDDING_MODEL') || MARKET_EMBEDDING_MODEL;
}

function embeddingInput(text, taskType, title = '') {
  const normalized = normalizeText(text).slice(0, 6000);
  if (marketEmbeddingModel() === 'gemini-embedding-2') {
    const prefix = taskType === 'QUESTION_ANSWERING'
      ? 'task: question answering | query:'
      : `title: ${title || 'market research source'} | text:`;
    return `${prefix} ${normalized}`;
  }
  return normalized;
}

function embeddingValues(raw) {
  const values = Array.isArray(raw) ? raw.map(Number).filter(Number.isFinite) : [];
  return values.length === MARKET_EMBEDDING_DIM ? values : null;
}

async function batchEmbedTexts(texts, taskType, title = '') {
  const apiKey = googleAiKey();
  if (!apiKey || !texts.length) return { status: apiKey ? 'empty' : 'skipped_no_google_key', embeddings: [] };
  const model = marketEmbeddingModel();
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:batchEmbedContents`;
  const requests = texts.map((text) => {
    const request = {
      model: `models/${model}`,
      content: { parts: [{ text: embeddingInput(text, taskType, title) }] },
      outputDimensionality: MARKET_EMBEDDING_DIM,
    };
    if (model !== 'gemini-embedding-2') request.taskType = taskType;
    return request;
  });
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify({ requests }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    return {
      status: `embedding_http_${response.status}`,
      error: body.error?.message || body.message || response.statusText,
      embeddings: [],
    };
  }
  const embeddings = Array.isArray(body.embeddings)
    ? body.embeddings.map((row) => embeddingValues(row?.values)).filter(Boolean)
    : [];
  return embeddings.length === texts.length
    ? { status: 'generated', embeddings }
    : { status: `embedding_count_mismatch_${embeddings.length}_${texts.length}`, embeddings };
}

async function attachEmbeddings(rows, textGetter, taskType, title) {
  if (hasFlag('skip-embeddings')) return { status: 'skipped_by_flag', generated: 0, failed: 0 };
  const apiKey = googleAiKey();
  if (!apiKey) return { status: 'skipped_no_google_key', generated: 0, failed: 0 };
  const batchSize = Number(argValue('embedding-batch-size', '20')) || 20;
  let generated = 0;
  let failed = 0;
  let lastStatus = 'generated';
  for (let index = 0; index < rows.length; index += batchSize) {
    const slice = rows.slice(index, index + batchSize);
    const texts = slice.map((row) => textGetter(row)).map(normalizeText);
    const result = await batchEmbedTexts(texts, taskType, title);
    lastStatus = result.status;
    if (result.status !== 'generated') {
      failed += slice.length;
      continue;
    }
    result.embeddings.forEach((embedding, offset) => {
      slice[offset].embedding = embedding;
      slice[offset].embedding_model = marketEmbeddingModel();
      slice[offset].embedding_status = 'generated';
    });
    generated += result.embeddings.length;
  }
  return { status: failed ? lastStatus : 'generated', generated, failed };
}

async function processFile(filePath) {
  const fileName = path.basename(filePath);
  const buffer = fs.readFileSync(filePath);
  const sourceHash = sha256Buffer(buffer);
  const ext = path.extname(fileName).toLowerCase();
  const sourceType = ext === '.pdf' ? 'pdf' : 'xlsx';
  const metadata = inferMetadata(fileName, sourceType);
  const document = {
    source_hash: sourceHash,
    file_name: fileName,
    ...metadata,
    extraction_method: sourceType === 'pdf' ? 'pdfjs_text_layer' : 'xlsx_structured_parser',
    metadata: {
      original_size: buffer.length,
      ingested_at: new Date().toISOString(),
    },
  };
  if (sourceType === 'pdf') {
    const extracted = await extractPdf(filePath, sourceHash);
    const extractedText = extracted.chunks.map((row) => row.content).join('\n');
    const chunkEmbedding = await attachEmbeddings(extracted.chunks, (row) => row.content, 'RETRIEVAL_DOCUMENT', metadata.report_title);
    return {
      document: {
        ...document,
        page_count: extracted.pageCount,
        row_count: 0,
        ocr_quality_score: extracted.quality,
        extraction_status: extracted.status,
        original_size_bytes: buffer.length,
        extracted_char_count: extractedText.length,
        extracted_text_hash: sha256Text(extractedText),
        metadata: { ...document.metadata, text_length: extracted.textLength, embedding: chunkEmbedding },
      },
      chunks: extracted.chunks,
      facts: [],
      extracted_text: extracted.chunks.map((row) => row.content).join('\n'),
      embedding: {
        chunks: chunkEmbedding,
        facts: { status: 'not_applicable', generated: 0, failed: 0 },
      },
    };
  }
  const extracted = workbookChunksAndFacts(filePath, sourceHash);
  const extractedText = extracted.chunks.map((row) => row.content).join('\n');
  const chunkEmbedding = await attachEmbeddings(extracted.chunks, (row) => row.content, 'RETRIEVAL_DOCUMENT', metadata.report_title);
  const factEmbedding = await attachEmbeddings(extracted.facts, (row) => [
    row.fact_type,
    row.metric_name,
    row.period,
    row.region,
    row.asset_name,
    row.building_name,
    row.address,
    row.buyer_name,
    row.seller_name,
    row.fact_text,
  ].filter(Boolean).join(' '), 'RETRIEVAL_DOCUMENT', metadata.report_title);
  return {
    document: {
      ...document,
      sheet_count: extracted.sheetCount,
      row_count: extracted.rowCount,
      ocr_quality_score: 1,
      extraction_status: 'ready',
      original_size_bytes: buffer.length,
      extracted_char_count: extractedText.length,
      extracted_text_hash: sha256Text(extractedText),
      metadata: { ...document.metadata, embedding: { chunks: chunkEmbedding, facts: factEmbedding } },
    },
    chunks: extracted.chunks,
    facts: extracted.facts,
    extracted_text: extracted.chunks.map((row) => row.content).join('\n'),
    embedding: {
      chunks: chunkEmbedding,
      facts: factEmbedding,
    },
  };
}

async function ingestPreparedInBatches(endpoint, anonKey, origin, token, prepared) {
  const chunkBatchSize = Number(argValue('chunk-batch-size', '80')) || 80;
  const factBatchSize = Number(argValue('fact-batch-size', '120')) || 120;
  const chunkBatchCount = Math.ceil(prepared.chunks.length / chunkBatchSize);
  const factBatchCount = Math.ceil(prepared.facts.length / factBatchSize);
  const batchCount = Math.max(1, chunkBatchCount, factBatchCount);
  const batches = [];
  let chunksWritten = 0;
  let factsWritten = 0;
  for (let batchIndex = 0; batchIndex < batchCount; batchIndex += 1) {
    const chunks = prepared.chunks.slice(batchIndex * chunkBatchSize, (batchIndex + 1) * chunkBatchSize);
    const facts = prepared.facts.slice(batchIndex * factBatchSize, (batchIndex + 1) * factBatchSize);
    const response = await invoke(endpoint, anonKey, origin, token, 'market-docs/ingest', {
      document: prepared.document,
      chunks,
      facts,
      extracted_text: batchIndex === 0 ? prepared.extracted_text : undefined,
      replace_existing: batchIndex === 0,
      batch_index: batchIndex + 1,
      batch_count: batchCount,
    });
    const ok = response.ok && response.body?.ok !== false;
    batches.push({
      batch_index: batchIndex + 1,
      batch_count: batchCount,
      status: response.status,
      ok,
      chunks: chunks.length,
      facts: facts.length,
      message: response.body?.message || response.body?.error || '',
      readback: response.body?.data || null,
    });
    if (!ok) {
      return {
        ok: false,
        status: response.status,
        message: response.body?.message || response.body?.error || '',
        body: response.body,
        batches,
        chunksWritten,
        factsWritten,
      };
    }
    chunksWritten += Number(response.body?.data?.chunks_written ?? chunks.length);
    factsWritten += Number(response.body?.data?.facts_written ?? facts.length);
  }
  return {
    ok: true,
    status: batches[batches.length - 1]?.status || 200,
    message: '',
    body: batches[batches.length - 1]?.readback || null,
    batches,
    chunksWritten,
    factsWritten,
  };
}

async function embedPreparedViaEdge(endpoint, anonKey, origin, token, sourceHash) {
  if (hasFlag('skip-embeddings')) return { status: 'skipped_by_flag', rounds: 0, chunks_embedded: 0, facts_embedded: 0, failures: 0 };
  const maxRounds = Number(argValue('embedding-edge-max-rounds', '80')) || 80;
  const limit = Number(argValue('embedding-edge-limit', '32')) || 32;
  let chunksEmbedded = 0;
  let factsEmbedded = 0;
  let failures = 0;
  const rounds = [];
  for (let round = 1; round <= maxRounds; round += 1) {
    const response = await invoke(endpoint, anonKey, origin, token, 'market-docs/embed', {
      source_hash: sourceHash,
      target: 'both',
      limit,
    });
    const data = response.body?.data || {};
    const chunkCount = Number(data.chunks?.embedded || 0);
    const factCount = Number(data.facts?.embedded || 0);
    const failed = Number(data.chunks?.failed || 0) + Number(data.facts?.failed || 0);
    rounds.push({
      round,
      status: response.status,
      ok: response.ok && response.body?.ok !== false,
      chunks_embedded: chunkCount,
      facts_embedded: factCount,
      failures: failed,
      chunk_status: data.chunks?.status || '',
      fact_status: data.facts?.status || '',
    });
    if (!response.ok || response.body?.ok === false) {
      failures += 1;
      break;
    }
    chunksEmbedded += chunkCount;
    factsEmbedded += factCount;
    failures += failed;
    if (chunkCount + factCount === 0) break;
  }
  return {
    status: failures ? 'partial_or_failed' : 'generated_or_already_complete',
    rounds: rounds.length,
    chunks_embedded: chunksEmbedded,
    facts_embedded: factsEmbedded,
    failures,
    detail: rounds,
  };
}

async function main() {
  const configuredDir = argValue('dir', envValue('LOGISTICS_MARKET_DATA_DIR'));
  if (!configuredDir) throw new Error('Set --dir or LOGISTICS_MARKET_DATA_DIR for the one-time local source input. The app itself reads only Supabase Storage/DB after ingest.');
  const marketDir = path.resolve(configuredDir);
  const dryRun = hasFlag('dry-run');
  if (!fs.existsSync(marketDir)) throw new Error(`Market data directory not found: ${marketDir}`);
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const files = fs.readdirSync(marketDir)
    .filter((name) => /\.(pdf|xlsx)$/iu.test(name))
    .map((name) => path.join(marketDir, name))
    .sort((a, b) => path.basename(a).localeCompare(path.basename(b), 'ko'));
  const maxFiles = Number(argValue('max-files', '0')) || 0;
  const targetFiles = maxFiles > 0 ? files.slice(0, maxFiles) : files;
  const supabaseUrl = envValue('VITE_SUPABASE_URL', 'SUPABASE_URL');
  const anonKey = envValue('VITE_SUPABASE_ANON_KEY', 'SUPABASE_ANON_KEY');
  const endpoint = `${supabaseUrl.replace(/\/$/u, '')}/functions/v1/ll-dashboard-api`;
  const origin = argValue('origin', DEFAULT_ORIGIN);
  const token = dryRun ? '' : await resolveAccessToken(supabaseUrl, anonKey);
  const results = [];
  for (const filePath of targetFiles) {
    console.log(`processing ${path.basename(filePath)}`);
    const prepared = await processFile(filePath);
    const summary = {
      file_name: prepared.document.file_name,
      source_type: prepared.document.source_type,
      extraction_status: prepared.document.extraction_status,
      ocr_quality_score: prepared.document.ocr_quality_score,
      chunks: prepared.chunks.length,
      facts: prepared.facts.length,
      embedding: prepared.embedding,
    };
    if (!dryRun) {
      const upload = await uploadSourceFile(endpoint, anonKey, origin, token, filePath);
      summary.upload_status = upload.status;
      summary.upload_ok = upload.ok && upload.body?.ok !== false;
      summary.upload_message = upload.body?.message || upload.body?.error || upload.body?.data?.message || '';
      summary.storage = upload.body?.data ? {
        source_hash: upload.body.data.source_hash,
        storage_bucket: upload.body.data.storage_bucket,
        storage_path: upload.body.data.storage_path,
        original_size_bytes: upload.body.data.original_size_bytes,
      } : null;
      if (!summary.upload_ok) {
        throw new Error(`${summary.file_name} source upload failed (${upload.status}): ${JSON.stringify(upload.body).slice(0, 500)}`);
      }
      prepared.document = {
        ...prepared.document,
        file_path: `storage://${summary.storage.storage_bucket}/${summary.storage.storage_path}`,
        storage_bucket: summary.storage.storage_bucket,
        storage_path: summary.storage.storage_path,
        source_preservation_status: 'stored',
        original_size_bytes: summary.storage.original_size_bytes,
      };
      const response = await ingestPreparedInBatches(endpoint, anonKey, origin, token, prepared);
      summary.provider_status = response.status;
      summary.provider_ok = response.ok;
      summary.provider_message = response.message || '';
      summary.batches = response.batches;
      summary.chunks_written = response.chunksWritten;
      summary.facts_written = response.factsWritten;
      summary.readback = response.body || null;
      if (!summary.provider_ok) {
        throw new Error(`${summary.file_name} ingest failed (${response.status}): ${JSON.stringify(response.body).slice(0, 500)}`);
      }
      summary.edge_embedding = await embedPreparedViaEdge(endpoint, anonKey, origin, token, prepared.document.source_hash);
    }
    results.push(summary);
    console.log(`${summary.provider_ok === false ? 'FAIL' : 'OK'} ${summary.file_name} chunks=${summary.chunks} facts=${summary.facts}`);
  }
  const artifact = {
    generated_at: new Date().toISOString(),
    source_input: 'local_runtime_directory_omitted',
    dry_run: dryRun,
    file_count: files.length,
    processed_file_count: targetFiles.length,
    expected_file_count: 12,
    pass: files.length === 12 && results.every((row) => dryRun || (row.upload_ok && row.provider_ok)),
    totals: {
      chunks: results.reduce((sum, row) => sum + row.chunks, 0),
      facts: results.reduce((sum, row) => sum + row.facts, 0),
      chunk_embeddings: results.reduce((sum, row) => sum + Number(row.embedding?.chunks?.generated || 0), 0),
      fact_embeddings: results.reduce((sum, row) => sum + Number(row.embedding?.facts?.generated || 0), 0),
      edge_chunk_embeddings: results.reduce((sum, row) => sum + Number(row.edge_embedding?.chunks_embedded || 0), 0),
      edge_fact_embeddings: results.reduce((sum, row) => sum + Number(row.edge_embedding?.facts_embedded || 0), 0),
    },
    semantic_vector_status: results.some((row) => /generated/u.test(row.embedding?.chunks?.status || '') || /generated/u.test(row.embedding?.facts?.status || '') || Number(row.edge_embedding?.chunks_embedded || 0) + Number(row.edge_embedding?.facts_embedded || 0) > 0)
      ? 'semantic_vectors_generated'
      : 'semantic_vectors_not_generated_fallback_search_only',
    results,
  };
  const outPath = path.join(OUT_DIR, `market-docs-ingest-${timestampForFile()}.json`);
  fs.writeFileSync(outPath, JSON.stringify(artifact, null, 2), 'utf8');
  console.log(`artifact=${outPath}`);
  if (!artifact.pass) process.exit(1);
}

main().catch((error) => {
  console.error(error.stack || error.message || error);
  process.exit(1);
});
