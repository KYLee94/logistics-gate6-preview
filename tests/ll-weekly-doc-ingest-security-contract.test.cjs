const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..');
const source = fs.readFileSync(
  path.join(ROOT, 'supabase', 'functions', 'll-weekly-doc-ingest', 'index.ts'),
  'utf8',
);

function blockBetween(startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  assert.ok(start >= 0, `missing ${startMarker}`);
  assert.ok(end > start, `missing end marker ${endMarker}`);
  return source.slice(start, end);
}

test('weekly document rows require exactly one asset match before any snapshot write', () => {
  const validation = blockBetween(
    '  const assets = await listRegisteredAssets(serviceClient);',
    '  const actorEmail = String(userData.user.email || \'\').trim().toLowerCase();',
  );

  assert.match(validation, /const assetResolutions = weekly\.assetRows\.map/u);
  assert.match(validation, /const projectResolutions = weekly\.projectRows\.map/u);
  assert.match(validation, /const allResolutions = \[\.\.\.assetResolutions, \.\.\.projectResolutions\];/u);
  assert.match(
    validation,
    /allResolutions\.some\(\(resolution\) => resolution\.status !== 'matched'\)[\s\S]*?return fail\(422,/u,
  );
  assert.doesNotMatch(validation, /return fail\(409, 'A parsed row matches multiple assets/u);
});

test('every resolved asset requires the active create or update permission before a snapshot write', () => {
  const validation = blockBetween(
    '  const assets = await listRegisteredAssets(serviceClient);',
    '  const actorEmail = String(userData.user.email || \'\').trim().toLowerCase();',
  );

  assert.match(validation, /const relevantAssets = allResolutions\.map\(\(resolution\) => resolution\.asset as Record<string, unknown>\);/u);
  assert.match(validation, /relevantAssets\.some\(\(asset\) => !canWriteAsset\(permission, writeAction, asset\)\)/u);

  const permissionCheck = validation.indexOf('relevantAssets.some((asset) => !canWriteAsset(permission, writeAction, asset))');
  const snapshotWrite = source.indexOf(".from('ll_work_items')\n      .update(snapshotRow)");
  assert.ok(permissionCheck >= 0, 'missing per-asset permission check');
  assert.ok(snapshotWrite > source.indexOf(validation), 'missing snapshot update');
  assert.ok(source.indexOf(validation) + permissionCheck < snapshotWrite, 'snapshot write must follow permission verification');
});

test('weekly ingest binds permission lookup to the authenticated JWT user id only', () => {
  assert.match(source, /\.eq\('user_id', userId\)/u);
  assert.doesNotMatch(source, /\.ilike\('email', email\)/u);
  assert.match(source, /findCanonicalPermission\(serviceClient, userData\.user\.id\)/u);
});
