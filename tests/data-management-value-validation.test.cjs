const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const test = require('node:test');

const edgePath = path.join(__dirname, '..', 'supabase', 'functions', 'll-dashboard-api', 'index.ts');
const edgeSource = fs.readFileSync(edgePath, 'utf8');

function sourceBetween(startMarker, endMarker) {
  const start = edgeSource.indexOf(startMarker);
  const end = edgeSource.indexOf(endMarker, start);
  assert.ok(start >= 0 && end > start, `${startMarker} must have a bounded source section`);
  return edgeSource.slice(start, end);
}

test('asset_integrated detail fields resolve to an editable canonical asset cell', () => {
  const assetRows = sourceBetween(
    'async function dataManagementAssetIntegratedRows(',
    '\nasync function dataManagementInvestmentIntegratedRows(',
  );
  const detailResolver = sourceBetween(
    'async function dataManagementResolveDetailFieldEdit(',
    '\nasync function callDataManagementSubmitDetailRowChange(',
  );
  const submitEdit = sourceBetween(
    'async function callDataManagementSubmitEdit(',
    '\nfunction newsStripHtml(',
  );

  assert.match(assetRows, /cell_details:\s*\{[\s\S]*building_register_summary:/u);
  assert.match(assetRows, /target_table:\s*'public\.ll_assets'/u);
  assert.match(assetRows, /target_record_id:\s*assetId/u);
  assert.match(detailResolver, /if \(viewKey === 'asset_integrated'\)/u);
  assert.match(detailResolver, /dataManagementAssetIntegratedRows\(ctx, \{ \.\.\.payload, page_size: 5000, resolve_all: true \}, scope, viewKey\)/u);
  assert.match(detailResolver, /edit_mode:\s*'table_cell'/u);
  assert.match(submitEdit, /edit_mode \|\| payload\.editMode\) === 'detail_field'/u);
  assert.match(submitEdit, /dataManagementResolveDetailFieldEdit\(ctx, payload, scopeResult\.scope \|\| dataManagementEmptyScope\(\)\)/u);
  assert.match(submitEdit, /callDataManagementSubmitTableCell\(ctx, \{ \.\.\.resolved\.table_payload, client_request_id: clientRequestId \|\| undefined \}\)/u);
});

test('single-field submits retain both the client before_value and the live target before value', () => {
  const detailResolver = sourceBetween(
    'async function dataManagementResolveDetailFieldEdit(',
    '\nasync function callDataManagementSubmitDetailRowChange(',
  );
  const tableCellSubmit = sourceBetween(
    'async function callDataManagementSubmitTableCell(',
    '\nasync function dataManagementResolveViewFieldPayload(',
  );

  assert.match(detailResolver, /before_value:\s*currentRawValue/u);
  assert.match(detailResolver, /client_before_value:\s*firstPresent\(payload\.before_value, payload\.beforeValue, payload\.client_before_value, payload\.clientBeforeValue\)/u);
  assert.match(tableCellSubmit, /const observedBeforeValue = clientBeforeValue !== undefined && clientBeforeValue !== null \? clientBeforeValue : input\.beforeValue;/u);
  assert.match(tableCellSubmit, /before_value:\s*normalizeText\(beforeValue\)/u);
});

test('invalid numeric and date view values are rejected instead of being coerced to null or zero', () => {
  const parser = sourceBetween(
    'function dataManagementParseViewRequestedValue(',
    '\nasync function dataManagementOpaqueRowKey(',
  );

  assert.match(parser, /const requireNumericText = \(\) => \{[\s\S]*throw new Error\(/u);
  assert.match(parser, /type === 'krw'[\s\S]{0,500}requireNumericText\(\)/u);
  assert.match(parser, /type === 'area_sqm'[\s\S]{0,500}requireNumericText\(\)/u);
  assert.match(parser, /type === 'number'[\s\S]{0,500}requireNumericText\(\)/u);
  assert.match(parser, /type === 'date'[\s\S]{0,500}throw new Error\(/u);
  assert.doesNotMatch(parser, /if \(type === 'date'\) return safeDateText\(value\);/u);
});

test('manager rows use the canonical asset row without asset-name hardcodes', () => {
  const managerResolver = sourceBetween(
    'function dataManagementEffectiveAssetManager(',
    '\nasync function dataManagementAssetIntegratedRows(',
  );
  const managerRows = sourceBetween(
    'async function dataManagementManagerLinkRows(',
    '\nasync function dataManagementResolveLeaseViewEdit(',
  );

  assert.doesNotMatch(managerResolver, /경산|gyeongsan|shkang@igisam\.com|강성호/iu);
  assert.match(managerRows, /dataManagementEffectiveAssetManager\(assetRecord\)/u);
});
