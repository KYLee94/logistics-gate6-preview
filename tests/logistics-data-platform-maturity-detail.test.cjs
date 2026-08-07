const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { pathToFileURL } = require('node:url');

const ROOT = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(ROOT, relativePath), 'utf8');

test('만기 목록은 내부 키 대신 종류별 실제 기업·펀드·대주명을 사용한다', async () => {
  const modulePath = path.join(ROOT, 'src/features/logistics-data-platform/maturityPresentation.js');
  const presentation = await import(`${pathToFileURL(modulePath).href}?test=${Date.now()}`);
  assert.equal(presentation.maturityDisplayName({ type: 'lease', tenant_name: '실제임차인 주식회사', target_name: 'lease_contract_uuid' }), '실제임차인 주식회사');
  assert.equal(presentation.maturityDisplayName({ type: 'fund', fund_name: '물류전문투자형 사모펀드', target_name: 'fund_uuid' }), '물류전문투자형 사모펀드');
  assert.equal(presentation.maturityDisplayName({ type: 'loan', lender_names: ['은행A', '보험사B'], tranche_name: '선순위' }), '선순위 · 은행A 외 1개사');
  assert.equal(presentation.maturityDisplayName({ type: 'lease', target_name: 'lease_maturity_8fd3' }), '임차인 정보 확인 필요');
});

test('만기 행 클릭은 종류별 상세 팝업을 열고 내부 식별자를 본문에 표시하지 않는다', () => {
  const source = read('src/features/logistics-data-platform/LogisticsDataPlatform.jsx');
  assert.match(source, /data-testid=["']maturity-detail-dialog["']/u);
  assert.match(source, /data-testid=["']maturity-row["']/u);
  assert.match(source, /maturityDisplayName/u);
  assert.match(source, /maturityDetailRows/u);
  assert.doesNotMatch(source, /maturity_key[^\n]{0,120}(?:display|target_name|title)/u);
});

test('만기 알림은 로딩과 빈 상태를 구분하고 유형별 전체 목록을 조용히 자르지 않는다', () => {
  const source = read('src/features/logistics-data-platform/LogisticsDataPlatform.jsx');
  assert.match(source, /maturities\.loading\s*\?\s*["']만기 알림 불러오는 중["']/u);
  assert.match(source, /365일 이내 \{label\} 만기가 없습니다/u);
  assert.doesNotMatch(source, /\.filter\(\(row\)[\s\S]{0,180}\.slice\(0,\s*limit\)/u);
  assert.doesNotMatch(source, /<MaturityList[^>]*limit=/u);
});

test('대출 만기 상세의 연계 펀드는 내부 키를 사람용 안내로 차단한다', async () => {
  const modulePath = path.join(ROOT, 'src/features/logistics-data-platform/maturityPresentation.js');
  const presentation = await import(`${pathToFileURL(modulePath).href}?fund=${Date.now()}`);
  const rows = presentation.maturityDetailRows({ type: 'loan', fund_name: 'fund_8fd3_internal' });
  assert.equal(rows.find(([label]) => label === '연계 펀드')?.[1], '펀드 정보 확인 필요');
});

test('만기 API projection은 임차인 기업명과 펀드·대출 상세를 조인한다', () => {
  const migrationDir = path.join(ROOT, 'supabase/migrations');
  const candidates = fs.readdirSync(migrationDir)
    .filter((name) => /maturity.*detail/iu.test(name))
    .sort();
  assert.ok(candidates.length, '만기 상세 projection migration이 필요합니다.');
  const sql = read(path.join('supabase/migrations', candidates.at(-1)));
  assert.match(sql, /tenant\.legal_name_ko/iu);
  assert.match(sql, /loan_lenders/iu);
  assert.match(sql, /'tenant_name'/iu);
  assert.match(sql, /'fund_name'/iu);
  assert.match(sql, /'lender_names'/iu);
  assert.match(sql, /'commencement_date'/iu);
  assert.match(sql, /'commitment_amount'/iu);
  assert.match(sql, /'coupon_rate'/iu);
});
