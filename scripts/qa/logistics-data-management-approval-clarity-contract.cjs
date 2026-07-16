const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const EDGE_PATH = path.join(ROOT, 'supabase', 'functions', 'll-dashboard-api', 'index.ts');
const UI_PATH = path.join(ROOT, 'src', 'components', 'system', 'workspace', 'LogisticsSectorModules.jsx');

const edge = fs.readFileSync(EDGE_PATH, 'utf8');
const ui = fs.readFileSync(UI_PATH, 'utf8');

const checks = [
  ['API가 승인 항목의 업무 탭을 판정함', /function dataManagementApprovalTabMeta\(/u.test(edge)],
  ['API가 승인 항목에 탭명을 반환함', /tab_label:\s*tabMeta\.label/u.test(edge)],
  ['API가 승인 항목에 업무 컬럼명을 반환함', /column_label:/u.test(edge)],
  ['네 개 데이터 탭명이 API 계약에 존재함', ['자산 데이터', '투자 데이터', '임대차계약 데이터', '담당자 데이터'].every((label) => edge.includes(label))],
  ['목록이 변경 위치를 표시함', ui.includes("'변경 위치'") && /locationSummaryFor\(row\)/u.test(ui)],
  ['상세가 탭과 컬럼을 분리해 표시함', ui.includes("['데이터 탭', '컬럼', '변경 전', '변경 후']")],
  ['상세가 API 탭명을 사용함', /item\.tab_label/u.test(ui)],
  ['내부 테이블명을 사용자 표시값으로 사용하지 않음', !/text\(item\.(target_table|source_table)/u.test(ui)],
];

const failed = checks.filter(([, ok]) => !ok);
for (const [label, ok] of checks) console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`);
if (failed.length) {
  console.error(`\n${failed.length}개 계약 검사가 실패했습니다.`);
  process.exit(1);
}

console.log('\n승인 대기 변경 위치 표시 계약을 통과했습니다.');
