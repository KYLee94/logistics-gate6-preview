const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { pathToFileURL } = require('node:url');

const ROOT = path.resolve(__dirname, '..');
const API_PATH = path.join(ROOT, 'src', 'features', 'logistics-data-platform', 'api.js');

test('렌트롤 read와 batch-save는 공간·계약·연결·임대료 조건 revision을 같은 계약으로 검증한다', () => {
  const migrations = fs.readdirSync(path.join(ROOT, 'supabase', 'migrations'))
    .filter((name) => name.includes('rent_roll_revision_contract'))
    .sort();
  assert.ok(migrations.length, '렌트롤 revision 계약 보정 migration이 필요합니다.');
  const sql = fs.readFileSync(path.join(ROOT, 'supabase', 'migrations', migrations.at(-1)), 'utf8');

  for (const field of ['space_revision', 'contract_revision', 'allocation_revision', 'rent_term_revision']) {
    assert.match(sql, new RegExp(field, 'u'));
  }
  assert.match(sql, /REVISION_CONFLICT/u);
  assert.match(sql, /expected_revision/u);
  assert.match(sql, /jsonb_set\(row_record, '\{expected_revision\}'/u);
});

test('렌트롤 저장은 기존 행의 모든 component revision을 null 상태까지 필수 검증한다', () => {
  const sql = fs.readFileSync(
    path.join(ROOT, 'supabase', 'migrations', '20260806062529_rent_roll_revision_contract.sql'),
    'utf8',
  );

  assert.match(sql, /COMPONENT_REVISIONS_REQUIRED/u);
  for (const field of ['space_revision', 'contract_revision', 'allocation_revision', 'rent_term_revision']) {
    assert.match(sql, new RegExp(`row_record\\s*\\?\\s*'${field}'`, 'u'));
  }
  assert.match(sql, /expected_revision\s+is\s+distinct\s+from\s+v_contract_revision/iu);
  assert.match(sql, /expected_revision\s+is\s+distinct\s+from\s+v_allocation_revision/iu);
  assert.match(sql, /expected_revision\s+is\s+distinct\s+from\s+v_rent_term_revision/iu);
  assert.doesNotMatch(sql, /expected_revision\s+is\s+not\s+null\s+and\s+expected_revision\s+is\s+distinct/iu);
});

test('렌트롤 security definer writer는 잠금 전 권한을 검증하고 delete 권한을 별도로 적용한다', () => {
  const sql = fs.readFileSync(
    path.join(ROOT, 'supabase', 'migrations', '20260806062529_rent_roll_revision_contract.sql'),
    'utf8',
  );
  const writer = sql.slice(sql.indexOf('create or replace function logistics_core.rent_roll_batch_save_entry('));
  const routeCheck = writer.indexOf('assert_v2_writer_route');
  const permissionCheck = writer.indexOf('assert_asset_permission');
  const assetLock = writer.indexOf('for update;');

  assert.ok(routeCheck >= 0 && permissionCheck >= 0 && assetLock >= 0);
  assert.ok(routeCheck < assetLock, 'writer-route 검증은 잠금보다 먼저여야 합니다.');
  assert.ok(permissionCheck < assetLock, '행별 권한 검증은 잠금보다 먼저여야 합니다.');
  assert.match(writer, /operation_name\s*=\s*'delete'[\s\S]{0,180}permission_operation\s*:=\s*'delete'/iu);
  assert.match(writer, /assert_asset_permission\(actor_id,\s*resolved_asset_id,\s*permission_operation\)/iu);
});

test('렌트롤 writer는 자산별 직렬화와 component 소유권 재검증으로 교착·타 자산 key를 차단한다', () => {
  const sql = fs.readFileSync(
    path.join(ROOT, 'supabase', 'migrations', '20260806062529_rent_roll_revision_contract.sql'),
    'utf8',
  );
  const writer = sql.slice(sql.indexOf('create or replace function logistics_core.rent_roll_batch_save_entry('));

  assert.match(writer, /from\s+logistics_core\.assets[\s\S]{0,180}for\s+update/iu);
  assert.match(writer, /RENT_ROLL_COMPONENT_SCOPE_MISMATCH/u);
  assert.match(writer, /CROSS_ASSET_COMPONENT_KEY/u);
  assert.match(writer, /base_response\s*:=\s*logistics_core\.rent_roll_batch_save_entry_v4[\s\S]+RENT_ROLL_COMPONENT_SCOPE_MISMATCH/iu);
  assert.match(writer, /allocation\.space_id\s*=\s*v_space_id/iu);
  assert.match(writer, /term\.contract_space_id\s*=\s*v_allocation_id/iu);
});

test('렌트롤 동일 요청 재시도는 stale revision 검사 전 저장된 최종 응답을 반환한다', () => {
  const sql = fs.readFileSync(
    path.join(ROOT, 'supabase', 'migrations', '20260806062529_rent_roll_revision_contract.sql'),
    'utf8',
  );
  const writer = sql.slice(sql.indexOf('create or replace function logistics_core.rent_roll_batch_save_entry('));
  const cachedReturn = writer.indexOf('return existing_request.response');
  const componentCheck = writer.indexOf('COMPONENT_REVISIONS_REQUIRED');

  assert.ok(cachedReturn >= 0 && componentCheck >= 0 && cachedReturn < componentCheck);
  assert.match(writer, /request_hash\([\s\S]{0,180}transformed_payload/iu);
  assert.match(writer, /update\s+logistics_core\.api_idempotency_keys[\s\S]{0,180}set\s+request_hash\s*=\s*request_digest[\s\S]{0,120}response\s*=\s*final_response/iu);
});

test('렌트롤 저장 생명주기는 저장 중 편집 잠금과 세션 초안 복구를 함께 보장한다', () => {
  const source = fs.readFileSync(
    path.join(ROOT, 'src', 'features', 'logistics-data-platform', 'LogisticsDataPlatform.jsx'),
    'utf8',
  );
  const rentRollSource = source.slice(
    source.indexOf('function RentRollPanel'),
    source.indexOf('function periodFor'),
  );

  assert.match(rentRollSource, /saveState === ["']saving["']/u);
  assert.match(rentRollSource, /rentRollEditingDisabled/u);
  assert.match(rentRollSource, /saveReadbackPendingRef/u);
  assert.match(rentRollSource, /sessionStorage\?\.setItem\(draftStorageKey/u);
  assert.match(rentRollSource, /sessionStorage\?\.removeItem\(draftStorageKey/u);
  assert.match(rentRollSource, /addEventListener\?\.\(["']beforeunload["']/u);
  assert.match(rentRollSource, /operation === ["']delete["']/u);
});

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

global.window = {
  __SUPABASE_CLIENT__: {
    auth: {
      getSession: async () => ({ data: { session: null }, error: null }),
      refreshSession: async () => ({ data: { session: null }, error: null }),
    },
    functions: {
      invoke: async () => ({ data: null, error: null }),
    },
  },
  sessionStorage: new MemoryStorage(),
  localStorage: new MemoryStorage(),
  setTimeout,
  clearTimeout,
  dispatchEvent: () => true,
};

async function loadApi(label) {
  return import(`${pathToFileURL(API_PATH).href}?request-lifecycle=${label}-${Date.now()}-${Math.random()}`);
}

test('data platform request lifecycle contract', async (t) => {
  const api = await loadApi('contract');

  await t.test('lifecycle cancellation is silent, including a wrapped Supabase abort', () => {
    const abort = new Error('The operation was aborted');
    abort.name = 'AbortError';
    abort.status = 499;
    const wrapped = new api.DataPlatformResponseError('cancelled', {
      status: 499,
      cause: abort,
    });
    assert.equal(api.isDataPlatformRequestCancellation(abort), true);
    assert.equal(api.isDataPlatformRequestCancellation(wrapped), true);

    const controller = new AbortController();
    controller.abort();
    assert.equal(api.isDataPlatformRequestCancellation(new Error('cleanup'), controller.signal), true);
  });

  await t.test('real authorization, conflict, timeout, server, and network failures stay visible', () => {
    for (const status of [401, 403, 409, 408, 500, 503]) {
      const error = new api.DataPlatformResponseError('actionable failure', { status });
      assert.equal(api.isDataPlatformRequestCancellation(error), false, `status ${status}`);
    }
    assert.equal(api.isDataPlatformRequestCancellation(new TypeError('Failed to fetch')), false);
  });

  await t.test('Supabase FunctionsHttpError의 nested HTTP status를 사용자 메시지에 보존한다', () => {
    const conflict = new Error('Edge Function returned a non-2xx status code');
    conflict.context = { status: 409 };
    assert.equal(
      api.friendlyDataPlatformError(conflict),
      '다른 담당자가 먼저 수정했습니다. 최신 내용을 다시 불러온 뒤 저장해 주세요.',
    );

    const invalid = new Error('Edge Function returned a non-2xx status code');
    invalid.context = { status: 422 };
    assert.equal(
      api.friendlyDataPlatformError(invalid),
      '입력한 값 중 저장할 수 없는 항목이 있습니다. 표시된 값을 확인해 주세요.',
    );
  });

  await t.test('disabling a comparison/read resource clears its stale popup error', () => {
    const current = {
      data: { preserved: true },
      revision: 7,
      requestId: 'request-1',
      loading: true,
      error: new Error('old inactive comparison failure'),
    };
    assert.deepEqual(api.inactivePrimaryResourceState(current), {
      data: { preserved: true },
      revision: 7,
      requestId: 'request-1',
      loading: false,
      error: null,
    });

    const source = fs.readFileSync(API_PATH, 'utf8');
    assert.match(source, /if\s*\(!enabled\)\s*\{[\s\S]*?generation\.current\s*\+=\s*1[\s\S]*?inactivePrimaryResourceState/iu);
    assert.match(source, /isDataPlatformRequestCancellation\(error,\s*controller\.signal\)/u);
  });
});
