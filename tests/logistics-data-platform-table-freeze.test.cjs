const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..');
const FRONTEND_PATH = path.join(
  ROOT,
  'src',
  'features',
  'logistics-data-platform',
  'LogisticsDataPlatform.jsx',
);
const SCHEMA_PATH = path.join(
  ROOT,
  'src',
  'features',
  'logistics-data-platform',
  'rentRollSchema.js',
);

const importSchema = () => import(`${pathToFileURL(SCHEMA_PATH).href}?v=${Date.now()}`);

test('렌트롤 표시 순서는 순서 다음 층·구역·임대 상태·임차인이며 임차인까지 고정한다', async () => {
  const { RENT_ROLL_COLUMNS, rentRollStickyLeft } = await importSchema();
  assert.deepEqual(
    RENT_ROLL_COLUMNS.slice(0, 4).map(({ key }) => key),
    ['floor_label', 'zone_label', 'occupancy_status', 'tenant_name'],
  );
  assert.deepEqual(
    RENT_ROLL_COLUMNS.slice(0, 4).map(({ key }) => rentRollStickyLeft(key)),
    [62, 134, 230, 334],
  );
  assert.equal(rentRollStickyLeft(RENT_ROLL_COLUMNS[4].key), null);
});

test('렌트롤의 두 제목행은 각 높이에 맞춰 세로 고정된다', () => {
  const source = fs.readFileSync(FRONTEND_PATH, 'utf8');
  const table = source.slice(
    source.indexOf('data-testid="rent-roll-table"'),
    source.indexOf('<tbody>', source.indexOf('data-testid="rent-roll-table"')),
  );
  assert.match(table, /rowSpan=\{2\}[\s\S]{0,180}sticky left-0 top-0/u);
  assert.match(table, /RENT_ROLL_GROUP_SEGMENTS\.map[\s\S]{0,520}sticky top-0/u);
  assert.match(table, /RENT_ROLL_DISPLAY_COLUMNS\.map[\s\S]{0,1200}sticky top-\[33px\]/u);
});

test('수익비용 연도 제목행은 세로 스크롤 영역 상단에 고정된다', () => {
  const source = fs.readFileSync(FRONTEND_PATH, 'utf8');
  const table = source.slice(
    source.indexOf('data-testid="finance-statement-scroll"'),
    source.indexOf('</table>', source.indexOf('data-testid="finance-statement-scroll"')),
  );
  assert.match(table, /finance-statement-scroll[\s\S]{0,180}max-h-\[calc\(100vh-190px\)\][^"']*overflow-auto/u);
  assert.match(table, /구분 \/ 계정 선택[\s\S]*?periods\.map\(\(period\)[\s\S]{0,220}sticky top-0/u);
});

test('NOI 손익표 원 단위는 컴포넌트 제목에 한 번만 표시하고 연월 제목에서는 제거한다', () => {
  const source = fs.readFileSync(FRONTEND_PATH, 'utf8');
  assert.match(source, /title="물류센터 NOI 손익표 \(원\)"/u);
  assert.doesNotMatch(source, /\{period\} \(원\)/u);
});

test('NOI 손익표 제목행은 구분 셀과 모든 연월 셀을 가운데 정렬한다', () => {
  const source = fs.readFileSync(FRONTEND_PATH, 'utf8');
  const table = source.slice(
    source.indexOf('data-testid="finance-statement-scroll"'),
    source.indexOf('</thead>', source.indexOf('data-testid="finance-statement-scroll"')),
  );
  assert.match(table, /data-testid="finance-statement-corner-header"[\s\S]{0,180}className="[^"]*text-center/u);
  assert.match(table, /periods\.map\(\(period\)[\s\S]{0,260}className="[^"]*text-center/u);
});

test('NOI 손익표의 구분 제목 셀은 상단과 왼쪽 교차 지점에 최우선 고정된다', () => {
  const source = fs.readFileSync(FRONTEND_PATH, 'utf8');
  assert.match(
    source,
    /data-testid="finance-statement-corner-header"[\s\S]{0,180}className="[^"]*sticky left-0 top-0 z-40/u,
  );
});
