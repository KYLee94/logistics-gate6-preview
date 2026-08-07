const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const source = fs.readFileSync(
  path.resolve(__dirname, '../scripts/qa/logistics-data-platform-deeplink-browser.cjs'),
  'utf8',
);
const qaScriptPath = path.resolve(
  __dirname,
  '../scripts/qa/logistics-data-platform-deeplink-browser.cjs',
);

test('렌트롤 운영 브라우저 QA는 명시적인 same-value 저장 플래그와 단일 안전 경로만 허용한다', () => {
  assert.match(source, /process\.env\.LOGISTICS_QA_DIST_DIR/u);
  assert.match(source, /hasFlag\('same-value-rent-roll-save'\)/u);
  assert.match(source, /--same-value-rent-roll-save requires --require-authenticated/u);
  assert.match(source, /--same-value-rent-roll-save requires --expect-write-enabled/u);
  assert.match(source, /--same-value-rent-roll-save requires --route=data-platform-rent-roll/u);
});

test('렌트롤 same-value 안전 조건은 브라우저나 로컬 서버를 열기 전에 실패한다', () => {
  const cases = [
    {
      args: ['--same-value-rent-roll-save', '--route', 'data-platform-rent-roll'],
      message: '--same-value-rent-roll-save requires --require-authenticated.',
    },
    {
      args: ['--same-value-rent-roll-save', '--require-authenticated', '--route', 'data-platform-rent-roll'],
      message: '--same-value-rent-roll-save requires --expect-write-enabled.',
    },
    {
      args: ['--same-value-rent-roll-save', '--require-authenticated', '--expect-write-enabled', '--route', 'data-platform-home'],
      message: '--same-value-rent-roll-save requires --route=data-platform-rent-roll.',
    },
  ];
  for (const fixture of cases) {
    const result = spawnSync(process.execPath, [qaScriptPath, ...fixture.args], {
      encoding: 'utf8',
      timeout: 10_000,
    });
    assert.notEqual(result.status, 0);
    assert.match(`${result.stdout}\n${result.stderr}`, new RegExp(fixture.message.replaceAll('.', '\\.')));
  }
});

test('렌트롤 same-value 브라우저 QA는 실제 저장 1회와 reload readback을 검증한다', () => {
  const probeStart = source.indexOf('async function rentRollSameValueSaveProbe');
  const probeEnd = source.indexOf('async function authenticatedProbe', probeStart);
  assert.ok(probeStart >= 0 && probeEnd > probeStart, 'same-value browser probe가 필요하다');
  const probe = source.slice(probeStart, probeEnd);
  assert.match(probe, /data-draft-field/u);
  assert.match(probe, /inputmode="decimal"/u);
  assert.match(probe, /rent-roll-save/u);
  assert.match(probe, /v2\/rent-roll\/batch-save/u);
  assert.match(probe, /assert\.equal\(saveRequestCount, 1/u);
  assert.match(probe, /data-save-state="saved"/u);
  assert.match(probe, /data-platform-error-dialog/u);
  assert.match(probe, /page\.reload/u);
  assert.match(probe, /readback/u);
  assert.match(probe, /blurred_display/u);
  assert.match(probe, /temporarySemantic\s*=\s*String\(Number\(candidate\.semantic\) \+ 1\)/u);
  assert.match(probe, /payload_operation/u);
});

test('렌트롤 rate 0.03 표시는 결정적 fixture로 검증하되 운영 원본에 0.03을 강제하지 않는다', () => {
  assert.match(source, /function rentRollPercentDisplayValue/u);
  assert.match(source, /function findRentRollRateDisplayFixture/u);
  assert.match(source, /rent_escalation_rate:\s*0\.03/u);
  assert.match(source, /expected_display:\s*'3'/u);
  assert.match(source, /rate_fixture_raw/u);
  assert.match(source, /rate_display/u);
  assert.match(source, /data-rent-roll-row-id/u);
  assert.doesNotMatch(source, /No readable rent-roll row exposes the required raw 0\.03/u);
  assert.match(source, /!rentRollSameValueSave\.rate_fixture_checked/u);
});
