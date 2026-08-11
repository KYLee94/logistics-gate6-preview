const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { pathToFileURL } = require('node:url');

const featureDir = path.resolve(__dirname, '../src/features/logistics-data-platform');
const platformSource = fs.readFileSync(path.join(featureDir, 'LogisticsDataPlatform.jsx'), 'utf8');
const hookPath = path.join(featureDir, 'useDismissibleDetails.js');
const hookSource = fs.existsSync(hookPath) ? fs.readFileSync(hookPath, 'utf8') : '';

function componentSource(start, end) {
  const startIndex = platformSource.indexOf(start);
  const endIndex = platformSource.indexOf(end, startIndex + start.length);
  assert.notEqual(startIndex, -1, `component start not found: ${start}`);
  assert.notEqual(endIndex, -1, `component end not found after start: ${end}`);
  return platformSource.slice(startIndex, endIndex);
}

test('custom popover inventory covers Home, Rent, Finance comparison, and shared maturity', () => {
  assert.equal((platformSource.match(/<details\b/gu) || []).length, 3);
  assert.match(platformSource, /function AddableSingleSelectCell/u);
  assert.match(platformSource, /function AddableMultiSelectCell/u);
  assert.match(platformSource, /data-testid=["']finance-comparison-controls["']/u);
  assert.match(platformSource, /data-testid=["']data-platform-maturity-popover["']/u);
});

test('shared hook closes only an open popover for outside pointer or Escape and restores trigger focus', () => {
  assert.match(hookSource, /export function useDismissiblePopover/u);
  assert.match(hookSource, /export function useDismissibleDetails/u);
  assert.match(hookSource, /if \(!open\) return undefined/u);
  assert.match(hookSource, /ownerDocument\.addEventListener\(["']pointerdown["'][\s\S]*?true\)/u);
  assert.match(hookSource, /!container\.contains\(event\.target\)[\s\S]*?onCloseRef\.current/u);
  assert.match(hookSource, /event\.key !== ["']Escape["']/u);
  assert.match(hookSource, /triggerRef\.current\?\.focus\(\)/u);
  assert.match(hookSource, /removeEventListener\(["']pointerdown["']/u);
  assert.match(hookSource, /removeEventListener\(["']keydown["']/u);
});

test('single-select closes after selection while Rent multi-select stays open during option or custom-item editing', () => {
  const single = componentSource('function AddableSingleSelectCell', 'const HOME_ASSET_OVERVIEW_FIELDS');
  const multi = componentSource('function AddableMultiSelectCell', 'function MultiSelectCell');

  for (const source of [single, multi]) {
    assert.match(source, /useDismissibleDetails\(\)/u);
    assert.match(source, /ref=\{detailsRef/u);
    assert.match(source, /onToggle=\{onDetailsToggle/u);
    assert.match(source, /ref=\{summaryRef/u);
  }
  assert.match(single, /onChange\(option\)[\s\S]{0,100}closeDetails\(\)/u);
  assert.match(single, /onChange\(next\)[\s\S]{0,140}closeDetails\(\)/u);
  assert.match(multi, /const toggle[\s\S]*?apply\(/u);
  assert.match(multi, /apply\(\[\.\.\.selected, next\]\)/u);
  assert.doesNotMatch(multi, /closeDetails\(\)/u);
});

test('Finance comparison stays open during multi-selection; maturity closes after row selection', () => {
  const comparison = componentSource('const comparisonAction =', 'if (!assetCode)');
  const platform = componentSource('export default function LogisticsDataPlatform', 'return (\n    <main');

  assert.match(platformSource, /detailsRef: comparisonDetailsRef[\s\S]*?useDismissibleDetails\(\)/u);
  assert.match(comparison, /ref=\{comparisonDetailsRef/u);
  assert.match(comparison, /ref=\{comparisonSummaryRef/u);
  assert.match(comparison, /toggleComparisonAsset\(asset\.asset_code\)/u);
  assert.doesNotMatch(comparison, /closeComparisonDetails\(\)/u);

  assert.match(platform, /useDismissiblePopover\(\{[\s\S]*?open: showMaturities[\s\S]*?setShowMaturities\(false\)/u);
  assert.match(platformSource, /ref=\{maturityPopoverRef\}[\s\S]*?ref=\{maturityButtonRef\}/u);
  assert.match(platformSource, /data-testid=["']data-platform-maturity-button["']/u);
  assert.match(platformSource, /data-testid=["']data-platform-maturity-popover["']/u);
  assert.match(platformSource, /data-testid=["']maturity-row["'][\s\S]*?onSelect\?\.\(row\)/u);
  assert.match(platformSource, /onSelect=\{\(row\) => \{[\s\S]{0,120}setShowMaturities\(false\)[\s\S]{0,120}setSelectedHeaderMaturity\(row\)/u);
});

test('native and inline control inventory remains outside custom popover dismissal management', async () => {
  const { RENT_ROLL_COLUMNS } = await import(pathToFileURL(path.join(featureDir, 'rentRollSchema.js')).href);
  const kindByKey = Object.fromEntries(RENT_ROLL_COLUMNS.map((column) => [column.key, column.kind]));

  assert.deepEqual(
    Object.fromEntries([
      'goods_type', 'tenant_cost_terms', 'landlord_cost_terms',
      'security_type', 'renewal_terms', 'termination_terms', 'restoration_terms',
      'occupancy_status', 'temperature_type', 'deposit_escalation_enabled',
    ].map((key) => [key, kindByKey[key]])),
    {
      goods_type: 'goods_multi_select',
      tenant_cost_terms: 'multi_select',
      landlord_cost_terms: 'multi_select',
      security_type: 'preset_text',
      renewal_terms: 'preset_text',
      termination_terms: 'preset_text',
      restoration_terms: 'preset_text',
      occupancy_status: 'select',
      temperature_type: 'select',
      deposit_escalation_enabled: 'select',
    },
  );

  const nativeSelects = [...platformSource.matchAll(/<select\b[\s\S]*?<\/select>/gu)];
  assert.equal(nativeSelects.length, 3);
  for (const match of nativeSelects) {
    assert.doesNotMatch(match[0], /detailsRef|onDetailsToggle|closeDetails/u);
  }
  assert.match(platformSource, /data-testid=["']data-platform-asset-select["']/u);
  assert.match(platformSource, /FINANCE_PERIOD_PRESETS\.map/u);
  assert.match(platformSource, /start, setStart[\s\S]*?end, setEnd[\s\S]*?type=["']month["']/u);
  assert.equal((platformSource.match(/type=["']month["']/gu) || []).length, 1);
  assert.match(platformSource, /data-testid=["']finance-custom-account-name["']/u);
});
