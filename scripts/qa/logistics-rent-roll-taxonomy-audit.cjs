#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const DEFAULT_ENV_ROOT = path.resolve(ROOT, '..', 'IGIS-Fund-Production-DP');
const DEFAULT_REFERENCE_BASE = 'C:\\Users\\10524\\Desktop\\codex_realasset\\Project\\03_Logi_Leasing_Dashboard';
const expectedAssetCount = 19;
const TEMPERATURE_OPTIONS = ['\uc800\uc628', '\uc0c1\uc628', '\ubcf5\ud569', '\uc0ac\ubb34\uc2e4'];
const GOODS_CATEGORY_VALUES = Object.freeze([
  '가구·인테리어', '기타 공산품', '디지털·가전', '반도체', '식품·음료',
  '의류', '의약품', '일상용품', '종합상품', '화장품',
]);
const GOODS_CATEGORY_MAP = Object.freeze(Object.fromEntries(Object.entries({
  '가구': ['가구·인테리어'],
  '가전제품': ['디지털·가전'],
  '가전제품 등': ['디지털·가전'],
  '공산품': ['기타 공산품'],
  '라이프스타일 용품': ['일상용품'],
  '반도체(고가 화물)': ['반도체'],
  '생필품': ['일상용품'],
  '식음료': ['식품·음료'],
  '식품(온도)': ['식품·음료'],
  '신선식품': ['식품·음료'],
  '어패럴': ['의류'],
  '유제품': ['식품·음료'],
  '유제품 등': ['식품·음료'],
  '의류': ['의류'],
  '의류(중하중)': ['의류'],
  '의약품': ['의약품'],
  '전자기기(컴퓨터 등)': ['디지털·가전'],
  '전체 상품 취급(풀필먼트)': ['종합상품'],
  '하중물': [],
  '화장품': ['화장품'],
  '화장품 등': ['화장품'],
}).map(([source, categories]) => [source, Object.freeze(categories)])));
const ALLOWED_ACTIONS = new Set(['v2/home/read', 'v2/rent-roll/read']);

function flagValue(name, fallback = '') {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? fallback : (process.argv[index + 1] || fallback);
}

function readEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  return Object.fromEntries(fs.readFileSync(filePath, 'utf8')
    .split(/\r?\n/gu)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#') && line.includes('='))
    .map((line) => {
      const separator = line.indexOf('=');
      return [
        line.slice(0, separator).trim(),
        line.slice(separator + 1).trim().replace(/^['"]|['"]$/gu, ''),
      ];
    }));
}

function sortedUnique(values) {
  return [...new Set(values)].sort();
}

function valueType(value) {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

function inspectScalar(value, { declaredOptions = null } = {}) {
  const type = valueType(value);
  const blank = value === null || value === undefined || (type === 'string' && value.trim() === '');
  const reasons = [];
  if (!blank && type !== 'string') reasons.push(`expected_string_or_null_got_${type}`);
  if (!blank && type === 'string' && declaredOptions && !declaredOptions.includes(value.trim())) {
    reasons.push('not_in_declared_options');
  }
  return {
    value,
    type,
    blank,
    invalid: reasons.length > 0,
    reasons,
  };
}

function inspectGoods(value, goodsMode) {
  if (goodsMode !== 'array') return inspectScalar(value);
  const type = valueType(value);
  const blank = value === null || value === undefined || (type === 'array' && value.length === 0);
  const reasons = [];
  const normalizedValues = [];
  if (!blank && type !== 'array') {
    reasons.push(`expected_array_or_null_got_${type}`);
  } else if (type === 'array') {
    value.forEach((item, index) => {
      const itemType = valueType(item);
      const itemBlank = itemType === 'string' && item.trim() === '';
      if (itemType !== 'string' || itemBlank) {
        reasons.push(`array_item_${index + 1}_expected_nonblank_string_got_${itemBlank ? 'blank' : itemType}`);
      } else {
        normalizedValues.push(item.trim());
      }
    });
  }
  return {
    value,
    type,
    blank,
    invalid: reasons.length > 0,
    reasons,
    normalized_values: sortedUnique(normalizedValues),
  };
}

function normalizeGoodsCategories(value) {
  const sourceValues = (Array.isArray(value) ? value : [value])
    .filter((item) => typeof item === 'string' && item.trim() !== '')
    .map((item) => item.trim());
  const categories = [];
  const removedNonCategories = [];
  const unmappedValues = [];
  for (const sourceValue of sourceValues) {
    if (!Object.hasOwn(GOODS_CATEGORY_MAP, sourceValue)) {
      if (!categories.includes(sourceValue)) categories.push(sourceValue);
      if (!unmappedValues.includes(sourceValue)) unmappedValues.push(sourceValue);
      continue;
    }
    const mapped = GOODS_CATEGORY_MAP[sourceValue];
    if (mapped.length === 0) {
      if (!removedNonCategories.includes(sourceValue)) removedNonCategories.push(sourceValue);
      continue;
    }
    for (const category of mapped) {
      if (!categories.includes(category)) categories.push(category);
    }
  }
  return {
    source_values: sourceValues,
    categories,
    removed_non_categories: removedNonCategories,
    unmapped_values: unmappedValues,
  };
}

function auditAssetRows(asset, rows, { goodsMode = 'scalar' } = {}) {
  const safeRows = Array.isArray(rows) ? rows : [];
  const evidence = safeRows.map((row, index) => {
    const temperature = inspectScalar(row?.temperature_type, { declaredOptions: TEMPERATURE_OPTIONS });
    const goods = inspectGoods(row?.goods_type, goodsMode);
    return {
      row_index: index + 1,
      display_order: row?.display_order ?? null,
      row_key: row?.row_key ?? row?.space_key ?? row?._draft_id ?? null,
      temperature,
      goods,
      goods_categories: normalizeGoodsCategories(row?.goods_type),
      source_signature: {
        tenant_name: row?.tenant_name ?? null,
        business_registration_number: row?.business_registration_number ?? null,
        floor_label: row?.floor_label ?? null,
        zone_label: row?.zone_label ?? null,
        leased_area_sqm: row?.leased_area_sqm ?? null,
        commencement_date: row?.commencement_date ?? null,
        expiry_date: row?.expiry_date ?? null,
      },
    };
  });
  const validNonblank = (entry) => !entry.blank && !entry.invalid && entry.type === 'string';
  return {
    asset_code: asset?.asset_code ?? asset?.asset_key ?? null,
    asset_name: asset?.asset_name ?? asset?.name ?? null,
    row_count: evidence.length,
    temperature_unique_values: sortedUnique(evidence
      .map((row) => row.temperature)
      .filter((entry) => !entry.blank && entry.type === 'string')
      .map((entry) => entry.value.trim())),
    goods_unique_values: sortedUnique(evidence.flatMap((row) => {
      const entry = row.goods;
      if (goodsMode === 'array') return entry.invalid ? [] : (entry.normalized_values || []);
      return validNonblank(entry) ? [entry.value.trim()] : [];
    })),
    goods_category_unique_values: sortedUnique(evidence.flatMap((row) => row.goods_categories.categories)),
    goods_category_unmapped_values: sortedUnique(evidence.flatMap((row) => row.goods_categories.unmapped_values)),
    goods_removed_non_category_count: evidence.reduce(
      (sum, row) => sum + row.goods_categories.removed_non_categories.length,
      0,
    ),
    temperature_blank_count: evidence.filter((row) => row.temperature.blank).length,
    temperature_invalid_count: evidence.filter((row) => row.temperature.invalid).length,
    goods_blank_count: evidence.filter((row) => row.goods.blank).length,
    goods_invalid_count: evidence.filter((row) => row.goods.invalid).length,
    issue_rows: evidence.filter((row) => (
      row.temperature.blank || row.temperature.invalid || row.goods.blank || row.goods.invalid
    )),
    rows: evidence,
  };
}

function compareSet(apiValues, xlsxValues) {
  const api = new Set(apiValues || []);
  const xlsx = new Set(xlsxValues || []);
  return {
    shared: sortedUnique([...api].filter((value) => xlsx.has(value))),
    api_only: sortedUnique([...api].filter((value) => !xlsx.has(value))),
    xlsx_only: sortedUnique([...xlsx].filter((value) => !api.has(value))),
  };
}

function compareTaxonomySources(api, xlsx) {
  return {
    assets: compareSet(api?.asset_keys, xlsx?.asset_keys),
    temperature: compareSet(api?.temperature_unique_values, xlsx?.temperature_unique_values),
    goods: compareSet(api?.goods_unique_values, xlsx?.goods_unique_values),
  };
}

function normalizeHeader(value) {
  return String(value ?? '').trim().toLowerCase().replace(/[\s_-]+/gu, '');
}

const HEADER_GROUPS = {
  temperature: new Set(['temperaturetype', '\uc628\ub3c4\uc720\ud615', '\uc628\ub3c4\uad6c\ubd84', '\uc628\ub3c4']),
  goods: new Set(['goodstype', '\ucde8\uae09\ud654\ubb3c', '\ucde8\uae09\ud654\ubb3c\uc885\ub958', '\ud654\ubb3c\uc885\ub958', '\ubcf4\uad00\ud488\ubaa9']),
  asset: new Set(['assetcode', '\uc790\uc0b0\ucf54\ub4dc', 'assetname', '\uc790\uc0b0\uba85']),
  ambiguousCategory: new Set(['category', '\uad6c\ubd84']),
};

function findHeaderCells(rows, aliases, maxRows = 40) {
  const matches = [];
  for (let rowIndex = 0; rowIndex < Math.min(rows.length, maxRows); rowIndex += 1) {
    for (let columnIndex = 0; columnIndex < rows[rowIndex].length; columnIndex += 1) {
      const label = String(rows[rowIndex][columnIndex] ?? '').trim();
      if (label && aliases.has(normalizeHeader(label))) {
        matches.push({ row_index: rowIndex + 1, column_index: columnIndex + 1, label });
      }
    }
  }
  return matches;
}

function valuesBelow(rows, header) {
  if (!header) return [];
  return rows.slice(header.row_index)
    .map((row, offset) => ({
      source_row: header.row_index + offset + 1,
      value: String(row[header.column_index - 1] ?? '').trim(),
    }))
    .filter((entry) => entry.value !== '');
}

function resolveReferenceDirectory(explicitPath = '') {
  if (explicitPath) return path.resolve(explicitPath);
  if (!fs.existsSync(DEFAULT_REFERENCE_BASE)) return '';
  const candidate = fs.readdirSync(DEFAULT_REFERENCE_BASE, { withFileTypes: true })
    .find((entry) => entry.isDirectory() && entry.name.startsWith('260804_'));
  return candidate ? path.join(DEFAULT_REFERENCE_BASE, candidate.name) : '';
}

function auditReferenceWorkbooks(directoryPath) {
  const XLSX = require('xlsx');
  if (!directoryPath || !fs.existsSync(directoryPath)) {
    return {
      reference_directory_found: false,
      directory: directoryPath || null,
      files: [],
      asset_keys: [],
      temperature_unique_values: [],
      goods_unique_values: [],
      unmapped_category_unique_values: [],
      unmatched: [{ reason: 'reference_directory_not_found', source: directoryPath || null }],
    };
  }
  const names = fs.readdirSync(directoryPath)
    .filter((name) => /\.(?:xlsx|xlsm|xls)$/iu.test(name))
    .sort();
  const files = [];
  const unmatched = [];
  const aggregate = { asset: [], temperature: [], goods: [], category: [] };
  for (const name of names) {
    const workbook = XLSX.readFile(path.join(directoryPath, name), { cellDates: false });
    const sheets = [];
    for (const sheetName of workbook.SheetNames) {
      const selected = /rent[\s-]*roll/iu.test(sheetName);
      const worksheet = workbook.Sheets[sheetName];
      if (!selected) {
        sheets.push({ sheet: sheetName, range: worksheet['!ref'] || null, selected: false });
        continue;
      }
      const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: false, defval: '' });
      const headers = {
        asset: findHeaderCells(rows, HEADER_GROUPS.asset),
        temperature: findHeaderCells(rows, HEADER_GROUPS.temperature),
        goods: findHeaderCells(rows, HEADER_GROUPS.goods),
        ambiguous_category: findHeaderCells(rows, HEADER_GROUPS.ambiguousCategory),
      };
      const explicitValues = {
        asset: valuesBelow(rows, headers.asset[0]).slice(0, 1),
        temperature: valuesBelow(rows, headers.temperature[0]),
        goods: valuesBelow(rows, headers.goods[0]),
      };
      const categoryValues = headers.ambiguous_category.flatMap((header) => valuesBelow(rows, header)
        .map((entry) => ({ ...entry, header_label: header.label, header_row: header.row_index })));
      aggregate.asset.push(...explicitValues.asset.map((entry) => entry.value));
      aggregate.temperature.push(...explicitValues.temperature.map((entry) => entry.value));
      aggregate.goods.push(...explicitValues.goods.map((entry) => entry.value));
      aggregate.category.push(...categoryValues.map((entry) => entry.value));
      if (headers.temperature.length === 0 && headers.goods.length === 0 && categoryValues.length > 0) {
        unmatched.push({
          file: name,
          sheet: sheetName,
          reason: 'ambiguous_category_not_mapped_to_temperature_or_goods',
          category_headers: headers.ambiguous_category,
          category_values: sortedUnique(categoryValues.map((entry) => entry.value)),
        });
      } else if (headers.temperature.length === 0 && headers.goods.length === 0) {
        unmatched.push({
          file: name,
          sheet: sheetName,
          reason: 'explicit_temperature_and_goods_headers_not_found',
        });
      }
      sheets.push({
        sheet: sheetName,
        range: worksheet['!ref'] || null,
        selected: true,
        headers,
        explicit_values: explicitValues,
        ambiguous_category_values: categoryValues,
      });
    }
    files.push({ file: name, sheets });
  }
  return {
    reference_directory_found: true,
    directory: directoryPath,
    file_count: files.length,
    files,
    asset_keys: sortedUnique(aggregate.asset),
    temperature_unique_values: sortedUnique(aggregate.temperature),
    goods_unique_values: sortedUnique(aggregate.goods),
    unmapped_category_unique_values: sortedUnique(aggregate.category),
    unmatched,
  };
}

function runtimeConfig() {
  const envRoot = path.resolve(flagValue('env-root', DEFAULT_ENV_ROOT));
  const fileEnv = {
    ...readEnvFile(path.join(envRoot, '.env')),
    ...readEnvFile(path.join(envRoot, '.env.local')),
  };
  const envValue = (...names) => names
    .map((name) => process.env[name] || fileEnv[name] || '')
    .find(Boolean) || '';
  return {
    supabaseUrl: envValue('LOGISTICS_SUPABASE_URL', 'VITE_SUPABASE_URL').replace(/\/$/u, ''),
    anonKey: envValue('LOGISTICS_SUPABASE_ANON_KEY', 'VITE_SUPABASE_ANON_KEY'),
    accessToken: envValue('LOGISTICS_SUPABASE_ACCESS_TOKEN'),
    email: envValue('LOGISTICS_SUPABASE_EMAIL', 'LOGISTICS_SUPABASE_AUTH_EMAIL'),
    password: envValue('LOGISTICS_SUPABASE_PASSWORD', 'LOGISTICS_SUPABASE_AUTH_PASSWORD'),
  };
}

async function acquireAuthenticatedSession(config) {
  assert.ok(config.supabaseUrl && config.anonKey, 'Supabase URL/anon key is missing');
  if (config.accessToken) {
    const response = await fetch(`${config.supabaseUrl}/auth/v1/user`, {
      headers: { apikey: config.anonKey, authorization: `Bearer ${config.accessToken}` },
    });
    const user = await response.json().catch(() => null);
    assert.equal(response.status, 200, 'Supabase access token validation failed');
    assert.ok(user?.id, 'Supabase access token user is missing');
    return { source: 'access_token', token: config.accessToken };
  }
  assert.ok(config.email && config.password, 'Supabase QA login credentials are missing');
  const response = await fetch(`${config.supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: config.anonKey, 'content-type': 'application/json' },
    body: JSON.stringify({ email: config.email, password: config.password }),
  });
  const session = await response.json().catch(() => null);
  assert.equal(response.status, 200, 'Supabase password login failed');
  assert.ok(session?.access_token && session?.user?.id, 'Supabase auth session is incomplete');
  return { source: 'password_grant', token: session.access_token };
}

async function invokeRead(config, token, action, payload = {}) {
  assert.ok(ALLOWED_ACTIONS.has(action), `READ_ONLY_ACTION_NOT_ALLOWED:${action}`);
  const response = await fetch(`${config.supabaseUrl}/functions/v1/ll-dashboard-api`, {
    method: 'POST',
    headers: {
      apikey: config.anonKey,
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      origin: 'https://kylee94.github.io',
    },
    body: JSON.stringify({ action, payload }),
  });
  const body = await response.json().catch(() => null);
  assert.equal(response.ok, true, `${action} HTTP ${response.status}`);
  assert.equal(body?.ok, true, `${action} did not return ok:true`);
  assert.equal(body?.status, 'primary', `${action} did not return primary data`);
  assert.ok(body?.request_id, `${action} request_id is missing`);
  assert.ok(body?.data && typeof body.data === 'object', `${action} data is missing`);
  return body;
}

async function collectOperatingAudit(config, token) {
  const bootstrap = await invokeRead(config, token, 'v2/home/read', {});
  const assets = Array.isArray(bootstrap.data?.assets) ? bootstrap.data.assets : [];
  assert.equal(assets.length, expectedAssetCount, `EXPECTED_${expectedAssetCount}_ASSETS_GOT_${assets.length}`);
  const audits = [];
  for (const directoryRow of assets) {
    const assetCode = directoryRow.asset_code || directoryRow.asset_key;
    assert.ok(assetCode, 'Readable asset has no asset_code');
    const response = await invokeRead(config, token, 'v2/rent-roll/read', {
      asset_code: assetCode,
      limit: 500,
    });
    audits.push({
      ...auditAssetRows({
        asset_code: assetCode,
        asset_name: directoryRow.name || directoryRow.asset_name || assetCode,
      }, response.data?.rows, { goodsMode: flagValue('goods-mode', 'scalar') }),
      revision: response.revision,
      request_id: response.request_id,
      status: response.status,
    });
  }
  return {
    asset_count: audits.length,
    total_row_count: audits.reduce((sum, audit) => sum + audit.row_count, 0),
    temperature_unique_values: sortedUnique(audits.flatMap((audit) => audit.temperature_unique_values)),
    goods_unique_values: sortedUnique(audits.flatMap((audit) => audit.goods_unique_values)),
    goods_category_unique_values: sortedUnique(audits.flatMap((audit) => audit.goods_category_unique_values)),
    goods_category_unmapped_values: sortedUnique(audits.flatMap((audit) => audit.goods_category_unmapped_values)),
    goods_removed_non_category_count: audits.reduce(
      (sum, audit) => sum + audit.goods_removed_non_category_count,
      0,
    ),
    temperature_blank_count: audits.reduce((sum, audit) => sum + audit.temperature_blank_count, 0),
    temperature_invalid_count: audits.reduce((sum, audit) => sum + audit.temperature_invalid_count, 0),
    goods_blank_count: audits.reduce((sum, audit) => sum + audit.goods_blank_count, 0),
    goods_invalid_count: audits.reduce((sum, audit) => sum + audit.goods_invalid_count, 0),
    asset_codes: audits.map((audit) => audit.asset_code),
    asset_names: audits.map((audit) => audit.asset_name),
    asset_keys: sortedUnique(audits.flatMap((audit) => [audit.asset_code, audit.asset_name])),
    assets: audits,
  };
}

async function main() {
  const config = runtimeConfig();
  const reference = auditReferenceWorkbooks(resolveReferenceDirectory(flagValue('xlsx-root')));
  const auth = await acquireAuthenticatedSession(config);
  const api = await collectOperatingAudit(config, auth.token);
  const report = {
    generated_at: new Date().toISOString(),
    mode: 'production_read_only',
    goods_contract_mode: flagValue('goods-mode', 'scalar'),
    expected_asset_count: expectedAssetCount,
    auth_source: auth.source,
    allowed_actions: [...ALLOWED_ACTIONS],
    production_mutation_used: false,
    api,
    xlsx: reference,
    comparison: compareTaxonomySources(api, reference),
  };
  if (process.argv.includes('--compact-table')) {
    report.api.assets = report.api.assets.map((asset) => ({
      asset_code: asset.asset_code,
      asset_name: asset.asset_name,
      row_count: asset.row_count,
      temperature_unique_values: asset.temperature_unique_values,
      temperature_blank_rows: asset.issue_rows
        .filter((row) => row.temperature.blank)
        .map((row) => row.row_index),
      temperature_invalid_rows: asset.issue_rows
        .filter((row) => row.temperature.invalid)
        .map((row) => [row.row_index, row.temperature.value, row.temperature.type, row.temperature.reasons]),
      goods_unique_values: asset.goods_unique_values,
      goods_category_unique_values: asset.goods_category_unique_values,
      goods_category_unmapped_values: asset.goods_category_unmapped_values,
      goods_removed_non_category_count: asset.goods_removed_non_category_count,
      goods_blank_rows: asset.issue_rows
        .filter((row) => row.goods.blank)
        .map((row) => row.row_index),
      goods_invalid_rows: asset.issue_rows
        .filter((row) => row.goods.invalid)
        .map((row) => [row.row_index, row.goods.value, row.goods.type, row.goods.reasons]),
    }));
    report.xlsx = {
      reference_directory_found: reference.reference_directory_found,
      directory: reference.directory,
      file_count: reference.file_count,
      asset_keys: reference.asset_keys,
      temperature_unique_values: reference.temperature_unique_values,
      goods_unique_values: reference.goods_unique_values,
      unmapped_category_unique_values: reference.unmapped_category_unique_values,
      unmatched: reference.unmatched,
    };
  } else if (process.argv.includes('--issues-only')) {
    report.api.assets = report.api.assets.map(({ rows, ...asset }) => asset);
  }
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

module.exports = {
  GOODS_CATEGORY_MAP,
  GOODS_CATEGORY_VALUES,
  TEMPERATURE_OPTIONS,
  auditAssetRows,
  auditReferenceWorkbooks,
  compareTaxonomySources,
  normalizeGoodsCategories,
  resolveReferenceDirectory,
};

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write(`${error.stack || error.message || error}\n`);
    process.exitCode = 1;
  });
}
