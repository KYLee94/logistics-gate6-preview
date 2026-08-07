const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { pathToFileURL } = require('node:url');

const ROOT = path.resolve(__dirname, '..');
const JSX_PATH = path.join(ROOT, 'src/features/logistics-data-platform/LogisticsDataPlatform.jsx');
const API_PATH = path.join(ROOT, 'src/features/logistics-data-platform/api.js');
const jsxSource = fs.readFileSync(JSX_PATH, 'utf8');
const apiSource = fs.readFileSync(API_PATH, 'utf8');

async function schema() {
  const target = path.join(ROOT, 'src/features/logistics-data-platform/rentRollSchema.js');
  return import(`${pathToFileURL(target).href}?revision-recovery=${Date.now()}-${Math.random()}`);
}

function functionSource(name, nextName) {
  const start = jsxSource.indexOf(`function ${name}`);
  const end = jsxSource.indexOf(`function ${nextName}`, start);
  assert.ok(start >= 0 && end > start, `${name} 함수 추출 실패`);
  return jsxSource.slice(start, end);
}

async function revisionHelpers() {
  const contract = await schema();
  const rebase = new Function(
    'deriveRentRollRow',
    `${functionSource('rebaseRentRollDraftRow', 'rentRollRevisionConflictFields')}\nreturn rebaseRentRollDraftRow;`,
  )(contract.deriveRentRollRow);
  const conflictFields = new Function(
    'buildRentRollSaveRow',
    'rentRollReadbackMismatches',
    `${functionSource('rentRollRevisionConflictFields', 'planRentRollRevisionRecovery')}\nreturn rentRollRevisionConflictFields;`,
  )(contract.buildRentRollSaveRow, contract.rentRollReadbackMismatches);
  const plan = new Function(
    'rowId',
    'rebaseRentRollDraftRow',
    'rentRollRevisionConflictFields',
    `${functionSource('planRentRollRevisionRecovery', 'rentRollRowsFromReadback')}\nreturn planRentRollRevisionRecovery;`,
  )((row) => row.row_key || row._draft_id, rebase, conflictFields);
  return { rebase, conflictFields, plan };
}

function row(overrides = {}) {
  return {
    operation: 'update',
    row_key: 'space-a',
    space_key: 'space-a',
    contract_key: 'contract-a',
    contract_space_key: 'allocation-a',
    rent_term_key: 'term-a',
    tenant_key: 'tenant-a',
    space_revision: 1,
    contract_revision: 2,
    allocation_revision: 3,
    rent_term_revision: 4,
    monthly_rent_total_krw: 1000,
    tenant_name: '기존 임차인',
    ...overrides,
  };
}

test('dirty draft 복원은 사용자 편집 필드만 유지하고 최신 component revision과 식별자를 사용한다', async () => {
  const { rebase } = await revisionHelpers();
  const draft = row({
    monthly_rent_total_krw: 1200,
    space_revision: 1,
    contract_revision: 2,
    allocation_revision: 3,
    rent_term_revision: 4,
  });
  const latest = row({
    tenant_name: '서버 최신 임차인',
    space_revision: 11,
    contract_revision: 12,
    allocation_revision: 13,
    rent_term_revision: 14,
  });
  const rebased = rebase(latest, draft, ['monthly_rent_total_krw']);
  assert.equal(rebased.monthly_rent_total_krw, 1200);
  assert.equal(rebased.tenant_name, '서버 최신 임차인');
  assert.deepEqual(
    [rebased.space_revision, rebased.contract_revision, rebased.allocation_revision, rebased.rent_term_revision],
    [11, 12, 13, 14],
  );
  assert.equal(rebased.contract_key, 'contract-a');
});

test('서버가 다른 필드만 변경했으면 최신 revision으로 재조정하고 자동 재시도할 수 있다', async () => {
  const { plan } = await revisionHelpers();
  const base = row();
  const draft = row({ monthly_rent_total_krw: 1200 });
  const latest = row({
    tenant_name: '서버 변경 임차인',
    space_revision: 7,
    contract_revision: 8,
    allocation_revision: 9,
    rent_term_revision: 10,
  });
  const result = plan(
    [draft],
    [latest],
    new Map([['space-a', base]]),
    new Map([['space-a', new Set(['monthly_rent_total_krw'])]]),
  );
  assert.deepEqual(result.conflicts, []);
  assert.equal(result.retryRows[0].monthly_rent_total_krw, 1200);
  assert.equal(result.retryRows[0].tenant_name, '서버 변경 임차인');
  assert.equal(result.retryRows[0].space_revision, 7);
  assert.equal(result.retryRows[0].contract_revision, 8);
});

test('서버와 사용자가 같은 셀을 다르게 변경하면 자동 덮어쓰지 않는다', async () => {
  const { plan } = await revisionHelpers();
  const base = row();
  const draft = row({ monthly_rent_total_krw: 1200 });
  const sameCellLatest = row({ monthly_rent_total_krw: 1100, space_revision: 5 });
  const changed = plan(
    [draft],
    [sameCellLatest],
    new Map([['space-a', base]]),
    new Map([['space-a', new Set(['monthly_rent_total_krw'])]]),
  );
  assert.deepEqual(changed.conflicts.map((issue) => issue.field), ['monthly_rent_total_krw']);

});

test('구버전 임시저장은 base가 없고 revision이 바뀌었으면 알 수 없는 동일 셀 충돌을 차단한다', async () => {
  const { plan } = await revisionHelpers();
  const draft = row({ monthly_rent_total_krw: 1200 });
  const latest = row({ monthly_rent_total_krw: 1100, space_revision: 5 });
  const missingBase = plan(
    [draft],
    [latest],
    new Map(),
    new Map([['space-a', new Set(['monthly_rent_total_krw'])]]),
  );
  assert.deepEqual(missingBase.conflicts.map((issue) => issue.field), ['monthly_rent_total_krw']);
  assert.equal(missingBase.retryRows[0].monthly_rent_total_krw, 1200);
  assert.equal(missingBase.retryRows[0].space_revision, 5);
});

test('구버전 임시저장도 revision이 그대로면 사용자 dirty field를 안전하게 유지한다', async () => {
  const { plan } = await revisionHelpers();
  const draft = row({ monthly_rent_total_krw: 1200 });
  const latest = row({ monthly_rent_total_krw: 1000 });
  const unchanged = plan(
    [draft],
    [latest],
    new Map(),
    new Map([['space-a', new Set(['monthly_rent_total_krw'])]]),
  );
  assert.deepEqual(unchanged.conflicts, []);
  assert.equal(unchanged.retryRows[0].monthly_rent_total_krw, 1200);
});

test('409 자동 복구는 REVISION_CONFLICT만 식별하고 최신 read 후 최대 한 번 재시도한다', () => {
  assert.match(apiSource, /export function isDataPlatformRevisionConflict/u);
  assert.match(apiSource, /this\.code\s*=\s*code/u);
  assert.match(apiSource, /this\.details\s*=\s*details/u);
  assert.match(apiSource, /REVISION_CONFLICT/u);
  assert.match(jsxSource, /revisionRetryCount\s*<\s*1/u);
  assert.match(jsxSource, /isDataPlatformRevisionConflict\(cause\)/u);
  assert.match(jsxSource, /DATA_PLATFORM_ACTIONS\.rentRollRead/u);
  assert.match(jsxSource, /planRentRollRevisionRecovery/u);
  assert.match(jsxSource, /createClientRequestId\("rent-roll"\)/u);
});

test('성공 readback과 임시저장 base는 화면 revision을 최신 상태로 갱신한다', () => {
  assert.match(jsxSource, /setRows\(rentRollRowsFromReadback\(readbackRows\)\)/u);
  assert.match(jsxSource, /baseRowsById/u);
  assert.match(jsxSource, /baseRows:/u);
  assert.match(jsxSource, /restoredRevisionConflicts/u);
});

test('revision 충돌은 일반 오류 팝업을 띄우지 않고 해당 행의 인라인 검증으로만 안내한다', () => {
  const rentRoll = jsxSource.slice(
    jsxSource.indexOf('function RentRollPanel'),
    jsxSource.indexOf('function periodFor'),
  );
  assert.match(rentRoll, /kind:\s*"revision-conflict"/u);
  assert.match(rentRoll, /data-testid="rent-roll-validation-summary"/u);
  assert.doesNotMatch(rentRoll, /conflictError\.userMessage/u);
});
