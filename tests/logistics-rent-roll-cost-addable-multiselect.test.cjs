const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..');
const FRONTEND_PATH = path.join(ROOT, 'src/features/logistics-data-platform/LogisticsDataPlatform.jsx');

test('취급화물과 임차인·임대인 부담비용은 같은 항목 추가 다중선택을 사용한다', () => {
  const source = fs.readFileSync(FRONTEND_PATH, 'utf8');
  const genericStart = source.indexOf('function AddableMultiSelectCell');
  const genericEnd = source.indexOf('function parsePaste');
  const generic = source.slice(genericStart, genericEnd);

  assert.ok(genericStart >= 0, '공용 AddableMultiSelectCell이 필요합니다.');
  assert.match(generic, /type="checkbox"/u);
  assert.match(generic, /placeholder=\{`\$\{label\} 항목 추가`\}/u);
  assert.match(generic, />\s*추가\s*<\/button>/u);
  assert.doesNotMatch(generic, />\s*기타\s*<\/button>/u);
  assert.match(source, /function MultiSelectCell[\s\S]{0,900}<AddableMultiSelectCell/u);
  assert.match(source, /function GoodsMultiSelectCell[\s\S]{0,900}<AddableMultiSelectCell/u);
});
