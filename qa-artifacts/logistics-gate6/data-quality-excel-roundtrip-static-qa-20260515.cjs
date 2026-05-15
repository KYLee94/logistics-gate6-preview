const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '../..');
const source = fs.readFileSync(path.join(repoRoot, 'src/components/system/workspace/WorkspaceLogistics.jsx'), 'utf8');
const outDir = path.join(repoRoot, 'qa-artifacts/logistics-gate6/data-quality-excel-roundtrip-static-qa-20260515');
fs.mkdirSync(outDir, { recursive: true });

const checks = [
  {
    id: 'one_sheet_upload_required',
    status: source.includes('workbook.SheetNames.length !== 1') && source.includes('반드시 한 시트만 포함') ? 'pass' : 'fail',
    detail: 'Excel roundtrip upload must reject workbooks that are not exactly one sheet.',
  },
  {
    id: 'relation_key_columns_required',
    status: source.includes('QUALITY_REQUIRED_UPLOAD_COLUMNS') && source.includes('필수 관계키 컬럼이 누락') ? 'pass' : 'fail',
    detail: 'Upload must require hidden relation-key columns so Supabase mapping is preserved.',
  },
  {
    id: 'exclusive_area_exported',
    status: source.includes("fieldName: 'exclusiveAreaSqm'") && source.includes("sourceHeader: '전용면적'") ? 'pass' : 'fail',
    detail: 'Excel export must include exclusive area so 경산 전용면적-type corrections can be handled.',
  },
  {
    id: 'source_excel_headers_visible',
    status: source.includes("'원본시트'") && source.includes("'원본항목명'") && source.includes("'계약/행 식별'") ? 'pass' : 'fail',
    detail: 'Excel export must expose source sheet/header and a human-readable row identifier.',
  },
  {
    id: 'db_general_and_history_fields_exported',
    status: source.includes("domain: 'DB_일반'") && source.includes("domain: 'DB_히스토리 누적'") && source.includes("sourceHeader: '월임대료 총액'") ? 'pass' : 'fail',
    detail: 'Excel export must cover both original DB_일반 and DB_히스토리 누적 style fields.',
  },
  {
    id: 'display_value_for_user',
    status: source.includes("'표시값'") && source.includes('qualityDisplayValue') && source.includes('formatArea(value)') ? 'pass' : 'fail',
    detail: 'Excel export must include a Korean/user-readable display value beside raw DB value.',
  },
  {
    id: 'upload_blocks_broken_relation_keys',
    status: source.includes('validationError') && source.includes('필수 관계키 또는 수정 필드가 깨진 행') ? 'pass' : 'fail',
    detail: 'Upload must block rows with broken target table, row id, or field name instead of silently dropping them.',
  },
  {
    id: 'upload_blocks_selected_asset_scope_escape',
    status: source.includes('outOfSelectedScopeRows') && source.includes('선택한 자산 범위 밖') ? 'pass' : 'fail',
    detail: 'Upload must block rows outside the selected asset scope.',
  },
  {
    id: 'upload_row_limit',
    status: source.includes('rows.length > 5000') && source.includes('5,000행 이하') ? 'pass' : 'fail',
    detail: 'Upload must enforce a row limit to avoid accidental massive submissions.',
  },
];

const statusCounts = checks.reduce((acc, check) => {
  acc[check.status] = (acc[check.status] || 0) + 1;
  return acc;
}, {});
const result = {
  generatedAt: new Date().toISOString(),
  checks,
  statusCounts,
  allPass: checks.every((check) => check.status === 'pass'),
};

fs.writeFileSync(path.join(outDir, 'result.json'), JSON.stringify(result, null, 2), 'utf8');
fs.writeFileSync(path.join(outDir, 'summary.md'), [
  '# Data Quality Excel roundtrip static QA - 2026-05-15',
  '',
  `- pass: ${statusCounts.pass || 0}`,
  `- fail: ${statusCounts.fail || 0}`,
  `- allPass: ${result.allPass}`,
  '',
  '| check | status | detail |',
  '|---|---|---|',
  ...checks.map((check) => `| ${check.id} | ${check.status} | ${check.detail} |`),
  '',
].join('\n'), 'utf8');

console.log(JSON.stringify(result, null, 2));
if (!result.allPass) process.exitCode = 1;
