const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const repoRoot = path.resolve(__dirname, '..');
const workflow = fs.readFileSync(path.join(repoRoot, '.github', 'workflows', 'logistics-news-daily.yml'), 'utf8');

test('뉴스 자동화는 07:00 KST 본 실행과 08:00 KST 복구 실행을 예약한다', () => {
  assert.match(workflow, /cron:\s*['"]0 22 \* \* \*['"]/u);
  assert.match(workflow, /cron:\s*['"]0 23 \* \* \*['"]/u);
});

test('겹친 예약 실행은 취소하지 않고 순서대로 처리한다', () => {
  assert.match(workflow, /concurrency:\s*[\s\S]*?group:\s*logistics-daily-automation[\s\S]*?cancel-in-progress:\s*false/u);
});

test('정상 수집된 날짜는 복구 실행에서 다시 수집하지 않는다', () => {
  assert.match(workflow, /npm run ingest:news:daily -- --skip-if-complete/u);
});
