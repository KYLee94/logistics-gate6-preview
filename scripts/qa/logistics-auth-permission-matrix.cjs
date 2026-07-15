const fs = require('node:fs');
const path = require('node:path');
const {
  buildPermissionManifest,
  extractDirectActions,
  selectExcelInput,
  validateWorkbookSourceRanges,
} = require('./logistics-permission-manifest-core.cjs');

const ROOT = path.resolve(__dirname, '..', '..');
const SOURCE_JSON = path.join(ROOT, 'src', 'components', 'system', 'workspace', 'logisticsPermissionData.json');
const EDGE_SOURCE = path.join(ROOT, 'supabase', 'functions', 'll-dashboard-api', 'index.ts');
const SOURCE_DIR = path.join(ROOT, 'src');
const DESKTOP_FALLBACK_XLSX = 'C:\\Users\\10524\\Desktop\\codex_realasset\\Project\\03_Logi_Leasing_Dashboard\\260513_담당자별 권한 부여_수식 제거.xlsx';

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function optionValue(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? '' : text(process.argv[index + 1]);
}

function hasOption(name) {
  return process.argv.includes(name);
}

function text(value) {
  return String(value || '').trim();
}

function sourceFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(target);
    return /\.(?:js|jsx|ts|tsx)$/u.test(entry.name) ? [target] : [];
  });
}

function staticRuntimeFindings() {
  return sourceFiles(SOURCE_DIR).flatMap((filePath) => {
    const source = fs.readFileSync(filePath, 'utf8');
    if (/import[\s\S]{0,300}logisticsPermissionData\.json/u.test(source)) {
      return [{ code: 'runtime_permission_json_fallback', severity: 'blocking', file: path.relative(ROOT, filePath) }];
    }
    return [];
  });
}

function workbookRows(workbookPath, sourceData) {
  const XLSX = require('xlsx');
  const workbook = XLSX.readFile(workbookPath, { raw: false });
  const sheet = workbook.Sheets[sourceData.sourceSheet];
  if (!sheet) throw new Error(`workbook sheet not found: ${sourceData.sourceSheet}`);
  // The legacy JSON range ends at row 62, but the actual 19th asset is on row 63.
  // Scan the worksheet's populated cells so merged-cell layout cannot silently trim it.
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: '' });
  const userRows = rows.filter((row) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/u.test(text(row[1]))
    && row.slice(3, 11).every((value) => ['Y', 'N'].includes(text(value).toUpperCase())));
  const assetRows = rows.filter((row) => /^[A-Z][A-Z0-9]+$/iu.test(text(row[0])));
  return {
    users: userRows,
    assetMaster: assetRows,
    structure: {
      populated_range: sheet['!ref'] || '',
      merged_ranges: (sheet['!merges'] || []).length,
      extraction: 'whole_sheet_identity_scan',
      user_email_column: 2,
      user_row_count: userRows.length,
      asset_row_count: assetRows.length,
      a190013001_present: assetRows.some((row) => text(row[0]).toUpperCase() === 'A190013001'),
    },
  };
}

function staticSourceForContract() {
  const workspacePath = path.join(SOURCE_DIR, 'components', 'system', 'workspace', 'WorkspaceLogistics.jsx');
  return fs.readFileSync(workspacePath, 'utf8');
}

function authContractFindings(edgeSource, workspaceSource) {
  const findings = [];
  const authMeStart = edgeSource.indexOf('async function callAuthMe(');
  const authMeEnd = edgeSource.indexOf('async function listPermissionUsers(', authMeStart);
  const authMe = authMeStart >= 0 && authMeEnd > authMeStart ? edgeSource.slice(authMeStart, authMeEnd) : '';
  if (!/permission_revision/u.test(authMe)) findings.push({ code: 'missing_permission_revision_contract', severity: 'blocking' });
  if (!/asset_capabilities/u.test(authMe)) findings.push({ code: 'missing_asset_capabilities_contract', severity: 'blocking' });
  if (!/permission_revision/u.test(workspaceSource) || !/asset_capabilities/u.test(workspaceSource)) {
    findings.push({ code: 'dashboard_capability_loading_contract_missing', severity: 'blocking' });
  }
  return findings;
}

function dispatcherContractFindings(directActions) {
  const findings = [];
  if (directActions.length !== 94) findings.push({ code: 'unexpected_direct_dispatcher_action_count', severity: 'blocking', expected: 94, actual: directActions.length });
  if (directActions.includes('weekly-assets/latest-preview')) {
    findings.push({ code: 'removed_weekly_assets_latest_preview_still_dispatched', severity: 'blocking' });
  }
  return findings;
}

function main() {
  const sourceData = readJson(SOURCE_JSON);
  const edgeSource = fs.readFileSync(EDGE_SOURCE, 'utf8');
  const workspaceSource = staticSourceForContract();
  const directActions = extractDirectActions(edgeSource);
  const manifest = buildPermissionManifest(sourceData, directActions);
  const runtimeFindings = staticRuntimeFindings();
  const contractFindings = authContractFindings(edgeSource, workspaceSource);
  const dispatcherFindings = dispatcherContractFindings(directActions);
  const requireExcel = hasOption('--require-excel');
  const excelInput = selectExcelInput({
    cli_excel: optionValue('--excel'),
    env_excel: process.env.LOGISTICS_PERMISSION_XLSX,
    fallback_excel: DESKTOP_FALLBACK_XLSX,
  }, fs.existsSync);
  const workbookEvidence = excelInput.evidence_status === 'selected' ? workbookRows(excelInput.path, sourceData) : null;
  const workbookParity = workbookEvidence
    ? { ...excelInput, evidence_status: 'verified', ...validateWorkbookSourceRanges(sourceData, workbookEvidence), workbook_structure: workbookEvidence.structure }
    : { ...excelInput, ok: !requireExcel, failures: requireExcel ? [excelInput.reason] : [] };
  const failures = [
    ...manifest.failures,
    ...runtimeFindings.map((finding) => finding.code),
    ...contractFindings.map((finding) => finding.code),
    ...dispatcherFindings.map((finding) => finding.code),
    ...workbookParity.failures,
  ];
  const report = {
    schema_version: 'auth_permission_qa_report.v2',
    evidence_mode: 'source_contract',
    database_write_used: false,
    artifact_write_used: false,
    live_evidence: { status: 'not_attempted', qualifies_as_live: false },
    mock_or_fake_session: { status: 'not_used', qualifies_as_live: false },
    source_contract: {
      static_json: path.relative(ROOT, SOURCE_JSON),
      manifest: {
        counts: manifest.counts,
        direct_route_count: directActions.length,
        identity_issues: manifest.identity_issues,
        action_issues: manifest.action_issues,
      },
      excel_parity: workbookParity,
      runtime_static_findings: runtimeFindings,
      api_contract_findings: contractFindings,
      dispatcher_contract_findings: dispatcherFindings,
    },
    ok: failures.length === 0,
    failures,
  };
  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) process.exitCode = 1;
}

main();
