const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..');
const EDGE_PATH = path.join(ROOT, 'supabase', 'functions', 'll-dashboard-api', 'index.ts');
const UI_PATH = path.join(ROOT, 'src', 'components', 'system', 'workspace', 'LogisticsSectorModules.jsx');

const edgeSource = fs.readFileSync(EDGE_PATH, 'utf8');
const uiSource = fs.readFileSync(UI_PATH, 'utf8');

function sourceBetween(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  assert.ok(start >= 0 && end > start, `Expected source section ${startMarker}.`);
  return source.slice(start, end);
}

test('asset floor count is a floor notation field instead of a generic number', () => {
  const fields = sourceBetween(
    edgeSource,
    'const DATA_MANAGEMENT_ASSET_INTEGRATED_VIEW_FIELDS_V2 = [',
    '\nconst DATA_MANAGEMENT_INVESTMENT_INTEGRATED_VIEW_FIELDS_V2 = [',
  );
  const definition = fields.match(/\{[^\n]*field_key:\s*'floor_count'[^\n]*\}/u)?.[0] || '';

  assert.match(definition, /type:\s*'floor_count'/u);
  assert.doesNotMatch(definition, /type:\s*'number'/u);
});

test('server preserves floor semantics and canonicalizes both basement suffix forms', () => {
  const parser = sourceBetween(
    edgeSource,
    'function dataManagementNormalizeFloorCountValue',
    '\nfunction dataManagementParseViewRequestedValue',
  );
  const requestParser = sourceBetween(
    edgeSource,
    'function dataManagementParseViewRequestedValue',
    '\nasync function dataManagementResolveWorkbookViewEdit',
  );

  assert.match(parser, /4F \/ B2/u);
  assert.match(parser, /B\(\\d\+\).*\(\\d\+\)B/su);
  assert.match(requestParser, /type === 'floor_count'/u);
  assert.match(requestParser, /dataManagementNormalizeFloorCountValue\(value/u);
});

test('server and UI compare canonical floor notation rather than concatenated digits', () => {
  const equality = sourceBetween(
    edgeSource,
    'function dataManagementFieldValuesEqual',
    '\nfunction parseJsonValue',
  );
  const uiNormalizer = sourceBetween(
    uiSource,
    'function normalizeManagementCellInputValue',
    '\nconst DATA_MANAGEMENT_YN_FIELD_KEYS',
  );

  assert.match(equality, /field === 'floor_count'/u);
  assert.match(equality, /dataManagementFloorCountComparable/u);
  assert.match(uiNormalizer, /column\?\.type === 'floor_count'/u);
  assert.match(uiNormalizer, /normalizeFloorCountInputValue/u);
});
