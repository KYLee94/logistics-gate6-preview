const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { pathToFileURL } = require('node:url');

const ROOT = path.resolve(__dirname, '..');
const JSX_PATH = path.join(ROOT, 'src/features/logistics-data-platform/LogisticsDataPlatform.jsx');
const API_PATH = path.join(ROOT, 'src/features/logistics-data-platform/api.js');
const SCHEMA_PATH = path.join(ROOT, 'src/features/logistics-data-platform/rentRollSchema.js');
const jsxSource = fs.readFileSync(JSX_PATH, 'utf8');

class MemoryStorage {
  constructor() {
    this.values = new Map();
  }

  get length() { return this.values.size; }
  clear() { this.values.clear(); }
  getItem(key) { return this.values.get(String(key)) ?? null; }
  key(index) { return [...this.values.keys()][index] ?? null; }
  removeItem(key) { this.values.delete(String(key)); }
  setItem(key, value) { this.values.set(String(key), String(value)); }
}

let invokeResult = { data: null, error: null };
global.window = {
  __SUPABASE_CLIENT__: {
    auth: {
      getSession: async () => ({ data: { session: null }, error: null }),
      refreshSession: async () => ({ data: { session: null }, error: null }),
    },
    functions: {
      invoke: async () => invokeResult,
    },
  },
  sessionStorage: new MemoryStorage(),
  localStorage: new MemoryStorage(),
  setTimeout,
  clearTimeout,
  dispatchEvent: () => true,
};

async function loadApi(label) {
  return import(`${pathToFileURL(API_PATH).href}?revision-failure=${label}-${Date.now()}-${Math.random()}`);
}

async function loadSchema(label) {
  return import(`${pathToFileURL(SCHEMA_PATH).href}?revision-failure=${label}-${Date.now()}-${Math.random()}`);
}

function functionSource(name, nextName) {
  const start = jsxSource.indexOf(`function ${name}`);
  const end = jsxSource.indexOf(`function ${nextName}`, start);
  assert.ok(start >= 0 && end > start, `${name} 함수를 추출할 수 없습니다.`);
  return jsxSource.slice(start, end);
}

async function revisionHelpers() {
  const contract = await loadSchema('helpers');
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
    contract_key: 'contract-shared',
    contract_space_key: 'allocation-a',
    rent_term_key: 'term-a',
    tenant_key: 'tenant-a',
    space_revision: 1,
    contract_revision: 2,
    allocation_revision: 3,
    rent_term_revision: 4,
    revision: 1,
    display_order: 1,
    tenant_name: '기존 임차인',
    monthly_rent_total_krw: 1000,
    monthly_cam_total_krw: 100,
    ...overrides,
  };
}

function functionsHttpError(status, body) {
  const error = new Error('Edge Function returned a non-2xx status code');
  error.name = 'FunctionsHttpError';
  error.context = {
    status,
    clone: () => ({ json: async () => body }),
  };
  return error;
}

test('FunctionsHttpError의 409 JSON 본문을 읽어 실제 revision 충돌로 분류한다', async () => {
  const api = await loadApi('functions-http-error');
  invokeResult = {
    data: null,
    error: functionsHttpError(409, {
      ok: false,
      status: 409,
      message: 'REVISION_CONFLICT',
      request_id: 'req-conflict-1',
      detail: { retryable: false, row_key: 'space-a' },
    }),
  };

  await assert.rejects(
    api.invokeDataPlatform(api.DATA_PLATFORM_ACTIONS.rentRollBatchSave, { rows: [] }),
    (error) => {
      assert.equal(error.name, 'DataPlatformResponseError');
      assert.equal(error.status, 409);
      assert.equal(error.code, 'REVISION_CONFLICT');
      assert.equal(error.requestId, 'req-conflict-1');
      assert.deepEqual(error.details, { retryable: false, row_key: 'space-a' });
      assert.equal(api.isDataPlatformRevisionConflict(error), true);
      return true;
    },
  );
});

test('정확한 REVISION_CONFLICT 외 409·401·403·500은 revision 자동 복구 대상이 아니다', async () => {
  const api = await loadApi('classification-boundary');
  const cases = [
    [409, 'IDEMPOTENCY_CONFLICT'],
    [409, 'IDEMPOTENT_REQUEST_IN_PROGRESS'],
    [409, 'NOT_REVISION_CONFLICT'],
    [409, 'REVISION_CONFLICT_ARCHIVED'],
    [409, 'CONFLICT'],
    [401, 'REVISION_CONFLICT'],
    [403, 'REVISION_CONFLICT'],
    [500, 'REVISION_CONFLICT'],
  ];
  for (const [status, code] of cases) {
    const error = new api.DataPlatformResponseError(code, { status, code });
    assert.equal(
      api.isDataPlatformRevisionConflict(error),
      false,
      `${status} ${code}를 revision 복구 대상으로 분류하면 안 됩니다.`,
    );
  }
});

test('기준본 없는 세션 초안은 revision이 같을 때만 자동 재배치한다', async () => {
  const { plan } = await revisionHelpers();
  const dirtyFields = new Map([['space-a', new Set(['monthly_rent_total_krw'])]]);
  const draft = row({ monthly_rent_total_krw: 1200 });

  const unchanged = plan([draft], [row()], new Map(), dirtyFields);
  assert.deepEqual(unchanged.conflicts, []);
  assert.equal(unchanged.retryRows[0].monthly_rent_total_krw, 1200);

  const changed = plan(
    [draft],
    [row({ monthly_rent_total_krw: 1100, contract_revision: 9 })],
    new Map(),
    dirtyFields,
  );
  assert.deepEqual(changed.conflicts.map(({ field }) => field), ['monthly_rent_total_krw']);
});

test('삭제는 모든 component revision이 같을 때만 재시도한다', async () => {
  const { plan } = await revisionHelpers();
  const base = row();
  const draft = row({ operation: 'delete' });
  const fields = new Map([['space-a', new Set(['operation'])]]);
  const baseRows = new Map([['space-a', base]]);

  const unchanged = plan([draft], [row()], baseRows, fields);
  assert.deepEqual(unchanged.conflicts, []);
  assert.equal(unchanged.retryRows[0].operation, 'delete');

  const changed = plan([draft], [row({ rent_term_revision: 8 })], baseRows, fields);
  assert.deepEqual(changed.conflicts.map(({ field }) => field), ['operation']);
});

test('신규 행은 식별자와 create 작업을 유지해 한 번만 다시 제출할 수 있다', async () => {
  const { plan } = await revisionHelpers();
  const draft = row({
    operation: 'create',
    _draft_id: 'draft-new',
    row_key: 'space-draft-new',
    space_key: 'space-draft-new',
    contract_key: 'contract-draft-new',
    contract_space_key: 'allocation-draft-new',
    rent_term_key: 'term-draft-new',
    tenant_key: undefined,
  });
  const result = plan(
    [draft],
    [],
    new Map(),
    new Map([['space-draft-new', new Set(['tenant_name'])]]),
  );
  assert.deepEqual(result.conflicts, []);
  assert.equal(result.retryRows[0].operation, 'create');
  assert.equal(result.retryRows[0]._draft_id, 'draft-new');
  assert.equal(result.retryRows[0].space_key, 'space-draft-new');
});

test('공유 계약의 여러 행은 최신 공통 revision으로 함께 재배치한다', async () => {
  const { plan } = await revisionHelpers();
  const baseA = row();
  const baseB = row({
    row_key: 'space-b',
    space_key: 'space-b',
    contract_space_key: 'allocation-b',
    rent_term_key: 'term-b',
    tenant_key: 'tenant-b',
  });
  const draftA = { ...baseA, monthly_rent_total_krw: 1200 };
  const draftB = { ...baseB, monthly_cam_total_krw: 140 };
  const latestA = { ...baseA, contract_revision: 10 };
  const latestB = { ...baseB, contract_revision: 10 };
  const result = plan(
    [draftA, draftB],
    [latestA, latestB],
    new Map([['space-a', baseA], ['space-b', baseB]]),
    new Map([
      ['space-a', new Set(['monthly_rent_total_krw'])],
      ['space-b', new Set(['monthly_cam_total_krw'])],
    ]),
  );

  assert.deepEqual(result.conflicts, []);
  assert.deepEqual(result.retryRows.map(({ contract_revision }) => contract_revision), [10, 10]);
  assert.equal(result.retryRows[0].monthly_rent_total_krw, 1200);
  assert.equal(result.retryRows[1].monthly_cam_total_krw, 140);
});

test('다중 행 중 같은 필드가 충돌한 행만 표시하고 배치 전체 자동 재시도를 막을 수 있다', async () => {
  const { plan } = await revisionHelpers();
  const baseA = row();
  const baseB = row({
    row_key: 'space-b',
    space_key: 'space-b',
    contract_space_key: 'allocation-b',
    rent_term_key: 'term-b',
    tenant_key: 'tenant-b',
  });
  const result = plan(
    [
      { ...baseA, monthly_rent_total_krw: 1200 },
      { ...baseB, monthly_cam_total_krw: 140 },
    ],
    [
      { ...baseA, monthly_rent_total_krw: 1100, contract_revision: 10 },
      { ...baseB, contract_revision: 10 },
    ],
    new Map([['space-a', baseA], ['space-b', baseB]]),
    new Map([
      ['space-a', new Set(['monthly_rent_total_krw'])],
      ['space-b', new Set(['monthly_cam_total_krw'])],
    ]),
  );

  assert.deepEqual(
    result.conflicts.map(({ rowId, field }) => [rowId, field]),
    [['space-a', 'monthly_rent_total_krw']],
  );
  assert.equal(result.retryRows[1].monthly_cam_total_krw, 140);
});

test('서버에서 기존 행이 사라졌으면 자동 재시도하지 않고 충돌로 남긴다', async () => {
  const { plan } = await revisionHelpers();
  const result = plan(
    [row({ monthly_rent_total_krw: 1200 })],
    [],
    new Map([['space-a', row()]]),
    new Map([['space-a', new Set(['monthly_rent_total_krw'])]]),
  );
  assert.deepEqual(result.conflicts.map(({ field }) => field), ['monthly_rent_total_krw']);
});

test('저장 후 재조회는 누락·변경·삭제 미반영을 모두 실패로 판정한다', async () => {
  const schema = await loadSchema('readback');
  const updatePayload = schema.buildRentRollSaveRow(
    row({ monthly_rent_total_krw: 1200 }),
    ['monthly_rent_total_krw'],
  );
  assert.deepEqual(
    schema.rentRollReadbackMismatches([updatePayload], []).map(({ field }) => field),
    ['row'],
  );
  assert.deepEqual(
    schema.rentRollReadbackMismatches([updatePayload], [row({ monthly_rent_total_krw: 1100 })])
      .map(({ field }) => field),
    ['monthly_rent_total_krw'],
  );
  const deletePayload = schema.buildRentRollSaveRow(row({ operation: 'delete' }), ['operation']);
  assert.deepEqual(
    schema.rentRollReadbackMismatches([deletePayload], [row()]).map(({ field }) => field),
    ['operation'],
  );
  assert.deepEqual(schema.rentRollReadbackMismatches([deletePayload], []), []);
});

test('자동 복구는 fresh read 후 정확히 한 번만 재시도하고 다른 실패에는 진입하지 않는다', () => {
  const saveSource = functionSource('RentRollPanel', 'FinancePanel');
  assert.match(saveSource, /let\s+revisionRetryCount\s*=\s*0/u);
  assert.match(
    saveSource,
    /if\s*\(!isDataPlatformRevisionConflict\(cause\)\s*\|\|\s*!\(revisionRetryCount\s*<\s*1\)\)\s*throw\s+cause/u,
  );
  assert.match(saveSource, /revisionRetryCount\s*\+=\s*1/u);
  assert.match(
    saveSource,
    /latestResponse\s*=\s*await\s+invokeDataPlatform\(DATA_PLATFORM_ACTIONS\.rentRollRead/u,
  );
  assert.match(saveSource, /if\s*\(plan\.conflicts\.length\)\s*\{[\s\S]*?return\s+false/u);
  assert.doesNotMatch(saveSource, /visibilitychange/u);
});

test('fresh read·두 번째 409·readback 실패는 dirty 초안을 지우는 성공 경로로 포장하지 않는다', () => {
  const saveSource = functionSource('RentRollPanel', 'FinancePanel');
  const saveStart = saveSource.indexOf('const saveRows');
  const catchIndex = saveSource.indexOf('setError(cause);', saveStart);
  const cleanupIndex = saveSource.indexOf('sessionStorage?.removeItem(draftStorageKey)', saveSource.indexOf('const saveRows'));
  const readbackMismatchIndex = saveSource.indexOf('if (readbackMismatches.length)', saveSource.indexOf('const saveRows'));
  assert.ok(catchIndex >= 0, '저장 실패 catch가 필요합니다.');
  assert.ok(readbackMismatchIndex >= 0 && readbackMismatchIndex < cleanupIndex);
  assert.ok(cleanupIndex < catchIndex, '초안 삭제는 실패 catch가 아니라 검증된 성공 경로에만 있어야 합니다.');
  assert.match(saveSource.slice(catchIndex), /setError\(cause\)[\s\S]*?setSaveState\("error"\)[\s\S]*?return\s+false/u);
  assert.match(saveSource, /baseRows:/u);
  assert.match(saveSource, /storedDraft\.baseRows/u);
});
