'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  BUILDING_ACTION,
  DEVELOPMENT_NO_REGISTER_ASSET_CODES,
  EXCLUDED_ASSET_CODES,
  buildBuildingRegisterPayload,
  isExpectedNoRegisterResponse,
  loadBuildingRegisterPlan,
  summarizeBuildingRegisterData,
} = require('../scripts/qa/logistics-building-register-refresh-audit.cjs');

test('building-register refresh plan is limited to the 17 visible assets', () => {
  assert.equal(BUILDING_ACTION, 'building-register/summary');
  assert.deepEqual([...EXCLUDED_ASSET_CODES].sort(), ['A112127001', 'AP00014001']);
  assert.deepEqual([...DEVELOPMENT_NO_REGISTER_ASSET_CODES], ['A190013001']);

  const plan = loadBuildingRegisterPlan();
  assert.equal(plan.length, 17);
  assert.equal(new Set(plan.map((row) => row.asset_code)).size, 17);
  assert.equal(plan.some((row) => EXCLUDED_ASSET_CODES.has(row.asset_code)), false);
  for (const row of plan) {
    assert.match(row.asset_code, /^(?:A|S)\w+$/u);
    assert.ok(Array.isArray(row.payloads) && row.payloads.length > 0);
    for (const payload of row.payloads) {
      assert.deepEqual(Object.keys(payload).sort(), [
        'bjdong_cd',
        'bun',
        'ji',
        'plat_gb_cd',
        'sigungu_cd',
      ]);
      assert.match(payload.sigungu_cd, /^\d{5}$/u);
      assert.match(payload.bjdong_cd, /^\d{5}$/u);
      assert.match(payload.bun, /^\d{4}$/u);
      assert.match(payload.ji, /^\d{4}$/u);
    }
  }
  assert.equal(plan.reduce((sum, row) => sum + row.payloads.length, 0), 18);
  assert.equal(plan.find((row) => row.asset_code === 'A112299001').payloads.length, 2);
  assert.equal(plan.filter((row) => DEVELOPMENT_NO_REGISTER_ASSET_CODES.has(row.asset_code)).length, 1);
});

test('포천 정교리의 공식 무자료 응답만 개발 중 예외로 판정한다', () => {
  const response = {
    ok: true,
    body: {
      ok: true,
      provider_attempts: [
        { endpoint: 'recap_title', status: 200, has_data: false },
        { endpoint: 'title', status: 200, has_data: false },
      ],
    },
  };
  assert.equal(isExpectedNoRegisterResponse('A190013001', response, {}), true);
  assert.equal(isExpectedNoRegisterResponse('A112721001', response, {}), false);
  assert.equal(isExpectedNoRegisterResponse('A190013001', response, { tot_area: 1 }), false);
});

test('building-register payload pads parcel numbers without changing official codes', () => {
  assert.deepEqual(buildBuildingRegisterPayload({
    sigunguCd: '28260',
    bjdongCd: '11000',
    platGbCd: '0',
    bun: '224',
    ji: '8',
  }), {
    sigungu_cd: '28260',
    bjdong_cd: '11000',
    plat_gb_cd: '0',
    bun: '0224',
    ji: '0008',
  });
});

test('building-register summary keeps only auditable official fields', () => {
  assert.deepEqual(summarizeBuildingRegisterData({
    plat_plc: '인천광역시 서구 석남동 224-8',
    new_plat_plc: '인천광역시 서구 봉수대로 370',
    main_purps_cd_nm: '창고시설',
    etc_purps: '창고시설',
    strct_cd_nm: '철근콘크리트구조',
    grnd_flr_cnt: 8,
    ugrnd_flr_cnt: 1,
    plat_area: 54193,
    arch_area: 12345.67,
    tot_area: 299308.3,
    bc_rat: 22.78,
    vl_rat: 301.12,
    tot_pkng_cnt: 421,
    use_apr_day: '20250415',
    secret: 'must not pass through',
  }), {
    plat_plc: '인천광역시 서구 석남동 224-8',
    new_plat_plc: '인천광역시 서구 봉수대로 370',
    main_purps_cd_nm: '창고시설',
    etc_purps: '창고시설',
    strct_cd_nm: '철근콘크리트구조',
    grnd_flr_cnt: 8,
    ugrnd_flr_cnt: 1,
    plat_area: 54193,
    arch_area: 12345.67,
    tot_area: 299308.3,
    bc_rat: 22.78,
    vl_rat: 301.12,
    tot_pkng_cnt: 421,
    use_apr_day: '20250415',
  });
});
