'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..');
const SOURCE = fs.readFileSync(
  path.join(ROOT, 'src/features/logistics-data-platform/LogisticsDataPlatform.jsx'),
  'utf8',
);

function between(startText, endText) {
  const start = SOURCE.indexOf(startText);
  const end = SOURCE.indexOf(endText, start);
  assert.notEqual(start, -1, `${startText} 시작점을 찾지 못했습니다.`);
  assert.notEqual(end, -1, `${endText} 종료점을 찾지 못했습니다.`);
  return SOURCE.slice(start, end);
}

test('공용 modal hook은 내부 초기 포커스, Escape 닫기, 호출 위치 포커스 복귀를 보장한다', () => {
  const hook = between('function useAccessibleModal', 'function LoadingLine');
  assert.match(hook, /documentRef\?\.activeElement/u);
  assert.match(hook, /initialFocusRef\?\.current/u);
  assert.match(hook, /querySelector\(/u);
  assert.match(hook, /event\.key !== "Escape"/u);
  assert.match(hook, /closeRef\.current\?\.\(\)/u);
  assert.match(hook, /previousFocus\?\.focus/u);
});

test('오류·만기·렌트프리 modal은 공용 focus lifecycle을 실제 dialog에 연결한다', () => {
  const errorDialog = between('function DataPlatformErrorDialog', 'function EmptyText');
  const maturityDialog = between('function MaturityList', 'function cloneHomeProjection');
  const rentFreeDialog = between('function RentFreePeriodsDialog', 'function PresetTextCell');

  for (const component of [errorDialog, maturityDialog, rentFreeDialog]) {
    assert.match(component, /useAccessibleModal\(/u);
    assert.match(component, /ref=\{dialogRef\}/u);
    assert.match(component, /role="dialog"/u);
  }
  assert.match(errorDialog, /ref=\{confirmButtonRef\}/u);
  assert.match(maturityDialog, /ref=\{closeButtonRef\}/u);
  assert.match(rentFreeDialog, /initialFocusRef:\s*firstInputRef/u);
  assert.match(SOURCE, /returnFocusRef=\{maturityButtonRef\}/u);
});

test('로딩 표시선은 보조기술에 비동기 상태를 알린다', () => {
  const loadingLine = between('function LoadingLine', 'function DataPlatformErrorDialog');
  assert.match(loadingLine, /role="status"/u);
  assert.match(loadingLine, /aria-live="polite"/u);
  assert.match(loadingLine, /데이터 불러오는 중/u);
});
