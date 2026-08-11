const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');
const { pathToFileURL } = require('node:url');

const ROOT = path.resolve(__dirname, '..');
const schemaPath = path.join(ROOT, 'src/features/logistics-data-platform/rentRollSchema.js');
const contractPath = path.join(ROOT, 'src/features/logistics-data-platform/documentContract.js');

const importFresh = (filePath, key) => import(
  `${pathToFileURL(filePath).href}?${key}=${Date.now()}-${Math.random()}`
);

test('임차인·임대인 부담비용은 원본 Excel의 책임 주체에 맞춘 상호 배타적 기본항목이다', async () => {
  const { TENANT_COST_OPTIONS, LANDLORD_COST_OPTIONS } = await importFresh(schemaPath, 'cost-options');
  assert.deepEqual(TENANT_COST_OPTIONS, [
    '수도광열비·공과금',
    '임차인 시설 설치·개조비',
    '임차인 시설 유지보수·귀책수선',
    '전용부 운영·법정검사비',
    '전용부 미화·보안·방역',
    '보관화물·영업배상책임보험',
    '임차인 사유 추가 제세공과금·보험료',
    '교통유발·과밀부담금',
  ]);
  assert.deepEqual(LANDLORD_COST_OPTIONS, [
    '임차인 귀책 외 구조·기본설비 수선',
    '공용설비 유지관리·법정검사',
    '공용부 미화·보안·조경',
    '건물 화재·재산종합보험',
    '소유 관련 제세공과금',
    '도로점용·단지관리비',
  ]);
  assert.deepEqual(
    TENANT_COST_OPTIONS.filter((item) => LANDLORD_COST_OPTIONS.includes(item)),
    [],
  );
  assert.equal([...TENANT_COST_OPTIONS, ...LANDLORD_COST_OPTIONS]
    .some((item) => /^(?:N\/?A|-|없음|해당 없음)$/iu.test(item)), false);
});

test('기존 인공 분류는 새 MECE 항목으로 승격하고 N/A는 제거하되 사용자 추가값은 보존한다', async () => {
  const {
    TENANT_COST_OPTIONS,
    LANDLORD_COST_OPTIONS,
    normalizeCostTerms,
    serializeCostTerms,
  } = await importFresh(schemaPath, 'cost-normalization');

  assert.deepEqual(normalizeCostTerms({ items: [
    'N/A', '-', '해당 없음',
    '전기·수도·가스 등 공과금',
    '현장 합의 사용자 비용',
  ] }, TENANT_COST_OPTIONS), [
    '수도광열비·공과금',
    '현장 합의 사용자 비용',
  ]);
  assert.deepEqual(normalizeCostTerms({ items: [
    '구조체·기본설비 유지보수',
    '임차인 귀책 외 수선비',
    '별도 합의 임대인 비용',
  ] }, LANDLORD_COST_OPTIONS), [
    '임차인 귀책 외 구조·기본설비 수선',
    '별도 합의 임대인 비용',
  ]);
  assert.deepEqual(serializeCostTerms({ items: ['N/A'] }, [
    '수도광열비·공과금', '사용자 추가값', 'N/A',
  ]).items, ['수도광열비·공과금', '사용자 추가값']);
});

test('렌트롤 전체문서 저장도 N/A를 제거하고 사용자 추가 부담비용을 그대로 왕복한다', async () => {
  const { buildRentRollDocumentPayload } = await importFresh(contractPath, 'cost-document');
  const payload = buildRentRollDocumentPayload([{
    occupancy_status: 'occupied',
    tenant_name: '테스트 임차인',
    tenant_cost_terms: { items: ['N/A', '전기·수도·가스 등 공과금', '사용자 추가값'] },
    landlord_cost_terms: { items: ['-', '재산종합·화재보험', '별도 합의 임대인 비용'] },
  }]);

  assert.deepEqual(payload.rows[0].tenant_cost_terms, {
    items: ['수도광열비·공과금', '사용자 추가값'],
  });
  assert.deepEqual(payload.rows[0].landlord_cost_terms, {
    items: ['건물 화재·재산종합보험', '별도 합의 임대인 비용'],
  });
});
