const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..', '..');
const assetOptionsPath = path.join(repoRoot, 'src', 'components', 'system', 'workspace', 'logisticsAssetOptionsData.json');
const assetDataDirectory = path.join(repoRoot, 'src', 'components', 'system', 'workspace', 'logisticsAssetData');
const outputPath = path.join(repoRoot, 'src', 'components', 'system', 'workspace', 'logisticsAssetSearchIndex.json');

function firstDefined(...values) {
  return values.find((value) => value !== undefined && value !== null && value !== '');
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function legacyRowsFor(payload = {}) {
  return [
    ...(payload.normalizedRows || []),
    ...(payload.leaseSpaces || []),
    ...(payload.contracts || []),
    ...(payload.monthlyCostByTenant || []),
  ];
}

function buildLegacySearchText(option = {}, payload = {}) {
  const overview = payload.overview || {};
  const asset = {
    ...option,
    assetName: option.assetName || overview.assetName,
    fundName: firstDefined(option.fundName, overview.fundName),
    uniqueTenantCount: firstDefined(overview.uniqueTenantCount, overview.tenantCount, option.uniqueTenantCount),
    averageENoc: firstDefined(overview.averageENoc, option.averageENoc),
    vacancyRate: firstDefined(overview.vacancyRate, option.vacancyRate),
    monthlyCostTotal: firstDefined(overview.monthlyCostTotal, option.monthlyCostTotal),
  };
  const rows = legacyRowsFor(payload);
  const tenantNames = rows
    .map((row) => firstDefined(row.tenantMasterName, row.tenantName, row.companyName, row.rawTenantName))
    .filter(Boolean);
  const rowTextValue = rows.slice(0, 80).map((row) => [
    row.tenantMasterName,
    row.tenantName,
    row.companyName,
    row.assetName,
    row.spaceLabel,
    row.floorLabel,
    row.detailAreaLabel,
    row.coldStorageType,
  ].filter(Boolean).join(' ')).join(' ');

  return [
    asset.assetName,
    asset.assetId,
    asset.assetCode,
    asset.fundName,
    asset.address,
    asset.standardizedAddress,
    overview.assetName,
    overview.fundName,
    overview.standardizedAddress,
    ...tenantNames,
    rowTextValue,
  ].filter(Boolean).join(' ');
}

function validateSearchCoverage(assetId, searchText, payload) {
  const rows = legacyRowsFor(payload).slice(0, 80);
  const searchFields = ['tenantMasterName', 'tenantName', 'companyName', 'rawTenantName', 'floorLabel', 'spaceLabel', 'detailAreaLabel'];
  for (const row of rows) {
    for (const field of searchFields) {
      const value = row[field];
      if (value && !searchText.includes(String(value))) {
        throw new Error(`${assetId}: legacy search text is missing ${field}`);
      }
    }
  }
}

function buildIndex() {
  const options = readJson(assetOptionsPath);
  const payloadById = Object.create(null);
  for (const fileName of fs.readdirSync(assetDataDirectory).filter((file) => file.endsWith('.json')).sort()) {
    const payload = readJson(path.join(assetDataDirectory, fileName));
    const assetId = String(firstDefined(payload.overview?.assetId, payload.meta?.selection?.assetId, '')).trim();
    if (assetId) payloadById[assetId] = payload;
  }

  const assets = Object.create(null);
  for (const option of options) {
    const assetId = String(option.assetId || '').trim();
    const payload = payloadById[assetId];
    if (!assetId || !payload) throw new Error(`Missing asset payload for ${assetId || 'unknown asset'}`);
    const searchText = buildLegacySearchText(option, payload);
    if (!searchText) throw new Error(`${assetId}: search text is empty`);
    validateSearchCoverage(assetId, searchText, payload);
    assets[assetId] = { assetId, searchText };
  }

  return { version: 1, assets };
}

function assertIndexMatches(actual, expected) {
  const actualIds = Object.keys(actual?.assets || {}).sort();
  const expectedIds = Object.keys(expected.assets).sort();
  if (actual?.version !== expected.version || actualIds.join('|') !== expectedIds.join('|')) {
    throw new Error('Search index asset coverage does not match the lazy asset payload source.');
  }
  for (const assetId of expectedIds) {
    if (actual.assets[assetId]?.searchText !== expected.assets[assetId].searchText) {
      throw new Error(`${assetId}: generated search text differs from the legacy payload search contract.`);
    }
  }
}

const expected = buildIndex();
const isCheck = process.argv.includes('--check');
if (isCheck) {
  if (!fs.existsSync(outputPath)) throw new Error(`Search index is missing: ${outputPath}`);
  assertIndexMatches(readJson(outputPath), expected);
  console.log(`[logistics-search-index] verified ${Object.keys(expected.assets).length} assets`);
} else {
  fs.writeFileSync(outputPath, `${JSON.stringify(expected, null, 2)}\n`, 'utf8');
  console.log(`[logistics-search-index] wrote ${Object.keys(expected.assets).length} assets to ${path.relative(repoRoot, outputPath)}`);
}
