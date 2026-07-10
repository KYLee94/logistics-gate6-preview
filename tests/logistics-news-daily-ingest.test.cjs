const assert = require('node:assert/strict');
const test = require('node:test');

const {
  currentSevenAmBasisKst,
  hasCompletedDailyRun,
  mapWithConcurrency,
} = require('../scripts/integrations/logistics-news-daily-ingest.cjs');

test('07:00 KST 이전에는 전날 07:00을 기준 시각으로 사용한다', () => {
  const now = new Date('2026-07-09T21:59:59.000Z');
  assert.equal(currentSevenAmBasisKst(now).toISOString(), '2026-07-08T22:00:00.000Z');
});

test('07:00 KST 이후에는 당일 07:00을 기준 시각으로 사용한다', () => {
  const now = new Date('2026-07-09T22:00:00.000Z');
  assert.equal(currentSevenAmBasisKst(now).toISOString(), '2026-07-09T22:00:00.000Z');
});

test('completed run도 실제 저장 기사 수가 기준 이상일 때만 건너뛴다', () => {
  assert.equal(hasCompletedDailyRun({ run_status: 'completed' }, 8), true);
  assert.equal(hasCompletedDailyRun({ run_status: 'completed' }, 7), false);
  assert.equal(hasCompletedDailyRun({ run_status: 'failed' }, 10), false);
  assert.equal(hasCompletedDailyRun(null, 10), false);
});

test('뉴스 질의는 지정한 동시 실행 수를 넘지 않고 입력 순서를 보존한다', async () => {
  let active = 0;
  let peak = 0;
  const result = await mapWithConcurrency([1, 2, 3, 4, 5, 6], 3, async (value) => {
    active += 1;
    peak = Math.max(peak, active);
    await new Promise((resolve) => setTimeout(resolve, value % 2 ? 8 : 2));
    active -= 1;
    return value * 10;
  });

  assert.deepEqual(result, [10, 20, 30, 40, 50, 60]);
  assert.ok(peak <= 3);
});
