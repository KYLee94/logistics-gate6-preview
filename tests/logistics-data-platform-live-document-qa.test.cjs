const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const scriptPath = path.resolve(
  __dirname,
  '../scripts/qa/logistics-data-platform-live-document-qa.cjs',
);

test('운영 문서 QA는 기본 read-only이고 쓰기는 명시적 브라우저 원복 플래그가 필요하다', () => {
  const result = spawnSync(process.execPath, [scriptPath, '--exercise-browser-writes'], {
    encoding: 'utf8',
    timeout: 10_000,
  });
  assert.notEqual(result.status, 0);
  assert.match(
    `${result.stdout}\n${result.stderr}`,
    /fail-closed[\s\S]*--allow-write/u,
  );

  const missingRollbackConfirmation = spawnSync(process.execPath, [
    scriptPath,
    '--exercise-browser-writes',
    '--allow-write',
  ], {
    encoding: 'utf8',
    timeout: 10_000,
  });
  assert.notEqual(missingRollbackConfirmation.status, 0);
  assert.match(
    `${missingRollbackConfirmation.stdout}\n${missingRollbackConfirmation.stderr}`,
    /--exercise-browser-writes requires --confirm-production-rollback/u,
  );
});

test('운영 문서 QA는 세 화면 모두 원본 캡처, 저장, 재조회, finally 원복을 강제한다', () => {
  const source = fs.readFileSync(scriptPath, 'utf8');
  assert.match(source, /READ_ONLY_DEFAULT/u);
  assert.match(source, /collectAssetOccupancyCandidates/u);
  assert.match(source, /home_original_document/u);
  assert.match(source, /rent_roll_original_document/u);
  assert.match(source, /finance_original_document/u);
  assert.match(source, /async function exerciseHomeBrowserSave/u);
  assert.match(source, /async function exerciseRentRollBrowserSave/u);
  assert.match(source, /async function exerciseFinanceBrowserSave/u);
  assert.match(source, /finally\s*\{[\s\S]*rollbackHomeDocument/u);
  assert.match(source, /finally\s*\{[\s\S]*rollbackRentRollDocument/u);
  assert.match(source, /finally\s*\{[\s\S]*rollbackFinanceDocument/u);
  assert.match(source, /assertDocumentReadback/u);
  assert.match(source, /rollback_readback_verified/u);
  assert.match(source, /function chromeExecutablePath/u);
  assert.match(source, /chromium\.launch\(\{[\s\S]*?executablePath:\s*chromeExecutablePath\(\)/u);
  assert.doesNotMatch(source, /operations\s*:/u);
  assert.doesNotMatch(source, /entries\s*:/u);
});

test('home browser QA verifies the stable edit exit and primary readback instead of a transient saved label', () => {
  const source = fs.readFileSync(scriptPath, 'utf8');
  const homeRegion = source.slice(
    source.indexOf('async function exerciseHomeBrowserSave'),
    source.indexOf('function boundedDomText'),
  );
  assert.match(homeRegion, /\[data-testid="home-edit"\][\s\S]*waitFor\(\{ state: 'visible'/u);
  assert.match(homeRegion, /HOME_CHANGED/u);
  assert.doesNotMatch(homeRegion, /\[data-save-state="saved"\][\s\S]*waitFor/u);
});

test('browser QA waits for the requested asset option and confirms it after asynchronous directory loading', () => {
  const source = fs.readFileSync(scriptPath, 'utf8');
  const routeRegion = source.slice(
    source.indexOf('async function openAssetRoute'),
    source.indexOf('async function exerciseHomeBrowserSave'),
  );
  assert.match(routeRegion, /option\[value=/u);
  assert.match(routeRegion, /selectOption\(assetCode\)/u);
  assert.match(routeRegion, /inputValue\(\)/u);
  assert.match(routeRegion, /for\s*\(let attempt/u);
});

test('rent-roll browser QA races the Edge response against client validation and emits bounded DOM evidence', () => {
  const source = fs.readFileSync(scriptPath, 'utf8');
  const helperRegion = source.slice(
    source.indexOf('async function replaceRentRollInputValue'),
    source.indexOf('async function exerciseRentRollBrowserSave'),
  );
  const rentRegion = source.slice(
    source.indexOf('async function exerciseRentRollBrowserSave'),
    source.indexOf('async function exerciseFinanceBrowserSave'),
  );

  assert.match(helperRegion, /async function collectRentRollSaveEvidence/u);
  assert.match(helperRegion, /async function replaceRentRollInputValue/u);
  assert.match(helperRegion, /\.click\(\)/u);
  assert.match(helperRegion, /\.press\('Control\+A'\)/u);
  assert.match(helperRegion, /\.fill\(expectedValue\)/u);
  assert.match(helperRegion, /\.inputValue\(\)/u);
  assert.match(helperRegion, /assert\.equal/u);
  assert.match(helperRegion, /rent-roll-validation-summary/u);
  assert.match(helperRegion, /data-platform-error-dialog/u);
  assert.match(helperRegion, /\[aria-invalid="true"\]/u);
  assert.match(helperRegion, /data-save-state/u);
  assert.match(helperRegion, /dirtyRowIds/u);
  assert.match(helperRegion, /dirtyRows/u);
  assert.match(helperRegion, /candidate_dirty_value/u);
  assert.match(helperRegion, /candidate_dirty_value_type/u);
  assert.match(helperRegion, /dom_input_value/u);
  assert.match(helperRegion, /dom_input_value_type/u);
  assert.match(helperRegion, /original_value/u);
  assert.match(helperRegion, /temporary_value/u);
  assert.match(helperRegion, /save_button_disabled/u);
  assert.match(helperRegion, /candidate/u);
  assert.match(helperRegion, /Promise\.(?:race|any)/u);
  assert.match(helperRegion, /requestfailed/u);
  assert.match(rentRegion, /waitForRentRollSaveOutcome/u);
  assert.match(rentRegion, /replaceRentRollInputValue\(input,\s*temporaryValue/u);
  assert.match(rentRegion, /replaceRentRollInputValue\(rollbackInput,\s*candidate\.value/u);
  assert.doesNotMatch(rentRegion, /await\s+(?:input|rollbackInput)\.fill\(/u);
  assert.match(rentRegion, /RENT_ROLL_SAVE_BLOCKED[\s\S]*JSON\.stringify/u);
  assert.match(rentRegion, /RENT_ROLL_ROLLBACK_BLOCKED[\s\S]*JSON\.stringify/u);
  assert.doesNotMatch(rentRegion, /requirePrimaryBrowserResponse\(await\s+(?:responsePromise|rollbackPromise)/u);
  assert.match(rentRegion, /finally\s*\{[\s\S]*rollbackRentRollDocument/u);
});

test('finance rollback relocalizes the exact field and reports the first canonical readback mismatches', () => {
  const source = fs.readFileSync(scriptPath, 'utf8');
  const financeRegion = source.slice(
    source.indexOf('async function exerciseFinanceBrowserSave'),
    source.indexOf('async function chooseBrowserAsset'),
  );

  assert.match(source, /function firstDocumentMismatches/u);
  assert.match(source, /expected_type/u);
  assert.match(source, /actual_type/u);
  assert.match(source, /expected_value/u);
  assert.match(source, /actual_value/u);
  assert.match(financeRegion, /input\[data-autosave-field="\$\{candidate\.field\}"\]/u);
  assert.doesNotMatch(financeRegion, /rollbackInput\s*=\s*shell\.locator\('input\[data-autosave-field\]'\)\.nth/u);
  assert.match(financeRegion, /rollback_input_field_before_save/u);
  assert.match(financeRegion, /rollback_input_field_after_save/u);
  assert.match(financeRegion, /rollback_input_value_before_save/u);
  assert.match(financeRegion, /candidate_field:\s*candidate\.field/u);
  assert.match(financeRegion, /FINANCE_ROLLBACK[\s\S]*first_mismatches/u);
  assert.match(financeRegion, /finance_original_document\.statement/u);
  assert.match(financeRegion, /finally\s*\{[\s\S]*rollbackFinanceDocument/u);
});

test('19개 자산 집계는 현재 점유·전체 rent 면적과 자산 면적 후보를 분리한다', () => {
  const source = fs.readFileSync(scriptPath, 'utf8');
  assert.match(source, /occupied_leased_area_sqm/u);
  assert.match(source, /total_rent_leased_area_sqm/u);
  assert.match(source, /asset_leasable_area_sqm/u);
  assert.match(source, /asset_gross_area_sqm/u);
  assert.match(source, /expired_row_count/u);
  assert.match(source, /rent_denominator_rate/u);
  assert.match(source, /asset_leasable_rate/u);
  assert.match(source, /asset_gross_rate/u);
  assert.match(source, /selected_denominator_rate/u);
  assert.match(source, /denominator_basis/u);
  assert.match(source, /over_100_anomaly/u);
  assert.match(source, /proposed_leasable_area_sqm/u);
  assert.match(source, /expectedAssetCount\s*=\s*19/u);
});
