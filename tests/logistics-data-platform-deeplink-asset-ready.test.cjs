const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const scriptPath = path.resolve(
  __dirname,
  '../scripts/qa/logistics-data-platform-deeplink-browser.cjs',
);

test('authenticated data-platform routes wait for the shared asset directory before measuring DOM', () => {
  const source = fs.readFileSync(scriptPath, 'utf8');
  const readyWait = source.indexOf('ASSET_DIRECTORY_READY_TIMEOUT');
  const measurement = source.indexOf('const assetSelected = isDataPlatform');

  assert.ok(readyWait >= 0, 'missing deterministic asset-directory readiness wait');
  assert.ok(readyWait < measurement, 'asset readiness must precede DOM measurement');
  assert.match(source, /optionCount\s*>\s*1\s*&&\s*Boolean\(select\.value\)/u);
  assert.match(source, /asset_directory_timing/u);
  assert.match(source, /initial_option_count/u);
  assert.match(source, /ready_elapsed_ms/u);
  assert.match(source, /home_read_responses/u);
});

test('asset readiness is independent of write-enabled QA and adds no mutation', () => {
  const source = fs.readFileSync(scriptPath, 'utf8');
  const readyWait = source.indexOf('ASSET_DIRECTORY_READY_TIMEOUT');
  const writeOnlyWait = source.indexOf('if (expectWriteEnabled && isDataPlatform)');
  const readinessWindow = source.slice(Math.max(0, readyWait - 1400), readyWait + 1400);

  assert.ok(readyWait >= 0 && writeOnlyWait >= 0);
  assert.ok(readyWait < writeOnlyWait, 'shared asset readiness cannot be gated by write permission');
  assert.doesNotMatch(readinessWindow, /batch-save|batch_save|click\(|fill\(/u);
});
