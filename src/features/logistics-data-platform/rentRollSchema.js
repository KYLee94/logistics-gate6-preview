const PY_PER_SQM = 0.3025;

export function rentRollFloorSortValue(value) {
  const text = String(value || '').trim().toUpperCase();
  const number = Number(text.match(/\d+(?:\.\d+)?/u)?.[0] || 0);
  if (/^(?:B|지하)/u.test(text)) return -number;
  if (/(?:옥탑|ROOF)/u.test(text)) return 1000 + number;
  return text ? number : Number.NEGATIVE_INFINITY;
}

// 운영 19개 자산에서 확인된 기존 atomic 값만 사용합니다. 임의 샘플은 추가하지 않습니다.
export const RENT_ROLL_GOODS_OPTIONS = Object.freeze([
  '하중물',
  '생필품',
  '공산품',
  '의약품',
  '의류',
  '반도체(고가 화물)',
  '의류(중하중)',
  '식품(온도)',
  '화장품',
  '화장품 등',
  '유제품',
  '가전제품',
  '전자기기(컴퓨터 등)',
  '라이프스타일 용품',
  '가전제품 등',
  '가구',
  '유제품 등',
  '어패럴',
  '식음료',
  '전체 상품 취급(풀필먼트)',
  '신선식품',
]);

export const TENANT_COST_OPTIONS = Object.freeze([
  '전기·수도·가스 등 공과금',
  '임차인 설치시설·영업상 수선',
  '시설 변경·설치 비용',
  '추가 제세공과금·보험료',
  '화재·배상책임보험',
  '전용부 미화·보안·방역',
  '교통유발·과밀부담금',
  '법정검사·시설관리비',
]);
export const LANDLORD_COST_OPTIONS = Object.freeze([
  '구조체·기본설비 유지보수',
  '재산종합·화재보험',
  '소유 관련 제세공과금',
  '공용부 미화·보안·조경',
  '승강기·전기·소방 유지관리',
  '도로점용·단지관리비',
  '임차인 귀책 외 수선비',
]);

const RENEWAL_PRESETS = Object.freeze([
  '없음',
  '만기 전 서면 통지',
  '상호 합의 갱신',
  '연장 옵션',
  '기타',
]);
const TERMINATION_PRESETS = Object.freeze([
  '없음',
  '임차인 중도해지권',
  '임대인·임차인 중도해지권',
  '의무임대차기간 후 중도해지',
  '기타',
]);
const RESTORATION_PRESETS = Object.freeze([
  '임차인 책임·비용으로 원상복구',
  '자연마모 제외 원상복구',
  '일부 시설 원상복구 제외',
  '원상복구기간 제공',
  '기타',
]);

const column = (key, label, group, kind = 'text', width = 128, extra = {}) => Object.freeze({
  key, label, group, kind, width, ...extra,
});

// 네 개의 운영 렌트롤 원본에서 반복되는 필드를 한 셀 한 값 원칙으로 평탄화했습니다.
export const RENT_ROLL_COLUMNS = Object.freeze([
  column('occupancy_status', '임대 상태', '임대 상태', 'select', 104, { options: [['occupied', '임대'], ['vacant', '공실'], ['planned', '예정']] }),
  column('tenant_name', '임차인', '임차인', 'text', 190),
  column('business_registration_number', '사업자등록번호', '임차인 정보', 'text', 142),
  column('temperature_type', '용도', '공간', 'select', 94, { options: [['저온', '저온'], ['상온', '상온'], ['복합', '복합'], ['사무실', '사무실']] }),
  column('goods_type', '취급 화물', '공간', 'goods_multi_select', 118, { options: RENT_ROLL_GOODS_OPTIONS }),
  column('floor_label', '층', '공간', 'text', 72),
  column('zone_label', '구역', '공간', 'text', 96),
  column('subtenant_name', '전대 임차인', '전차 여부', 'text', 140),
  column('free_area_type', '유·무상', '전차 여부', 'text', 92),
  column('exclusive_area_sqm', '전용면적(㎡)', '면적', 'number', 118),
  column('exclusive_area_py', '전용면적(평)', '면적', 'readonly', 112),
  column('common_area_sqm', '공용면적(㎡)', '면적', 'number', 118),
  column('common_area_py', '공용면적(평)', '면적', 'readonly', 112),
  column('leased_area_sqm', '임대면적(㎡)', '면적', 'number', 118),
  column('leased_area_py', '임대면적(평)', '면적', 'readonly', 112),
  column('efficiency_ratio', '전용률(%)', '면적', 'readonly', 100),
  column('signed_date', '계약 체결일', '계약 기간', 'date', 124),
  column('commencement_date', '임대 개시일', '계약 기간', 'date', 124),
  column('expiry_date', '임대 만기일', '계약 기간', 'date', 124),
  column('contract_months', '계약기간(개월)', '계약 기간', 'readonly', 112),
  column('wale_years', '잔존기간(년)', '계약 기간', 'readonly', 104),
  column('operation_start_date', '운영 개시일', '계약 기간', 'date', 124),
  column('deposit_total_krw', '보증금 합계', '보증금', 'number', 140),
  column('deposit_per_py_krw', '보증금/평', '보증금', 'readonly', 116),
  column('security_type', '담보 방식', '보증금', 'preset_text', 158, { options: ['보증보험', '근저당권', '없음', '기타'] }),
  column('security_ratio', '담보 비율(%)', '보증금', 'number', 112),
  column('monthly_rent_total_krw', '월 임대료', '임대료', 'number', 140),
  column('rent_per_py_krw', '임대료/평', '임대료', 'readonly', 116),
  column('monthly_cam_total_krw', '월 관리비', '임대료', 'number', 136),
  column('cam_per_py_krw', '관리비/평', '임대료', 'readonly', 116),
  column('pallet_rack_fee', '랙 사용료', '임대료', 'number', 124),
  column('pallet_rack_fee_per_py', '랙 사용료/평', '임대료', 'readonly', 120),
  column('current_total_cost_per_py_krw', 'E.NOC/평', '임대료', 'readonly', 122),
  column('rent_free_months', '렌트프리(개월)', '무상·지원', 'number', 118),
  column('rent_free_start_date', '렌트프리 시작', '무상·지원', 'date', 124),
  column('rent_free_end_date', '렌트프리 종료', '무상·지원', 'date', 124),
  column('effective_rent', '실효 임대료', '무상·지원', 'readonly', 126),
  column('fit_out_months', 'Fit-out(개월)', '무상·지원', 'number', 112),
  column('fit_out_amount', 'Fit-out 금액', '무상·지원', 'number', 128),
  column('tenant_improvement_amount', 'TI 지원금', '무상·지원', 'number', 128),
  column('deposit_escalation_enabled', '보증금 인상 여부', '인상 조건', 'select', 118, { options: [['N', 'N'], ['Y', 'Y']] }),
  column('deposit_escalation_first_date', '보증금 인상일', '인상 조건', 'date', 124),
  column('deposit_escalation_interval_months', '보증금 주기(개월)', '인상 조건', 'number', 126),
  column('deposit_escalation_rate', '보증금 인상률', '인상 조건', 'percent', 120),
  column('rent_escalation_first_date', '임대료 인상일', '인상 조건', 'date', 124),
  column('rent_escalation_interval_months', '임대료 주기(개월)', '인상 조건', 'number', 126),
  column('rent_escalation_rate', '임대료 인상률', '인상 조건', 'percent', 120),
  column('cam_escalation_first_date', '관리비 인상일', '인상 조건', 'date', 124),
  column('cam_escalation_interval_months', '관리비 주기(개월)', '인상 조건', 'number', 126),
  column('cam_escalation_rate', '관리비 인상률', '인상 조건', 'percent', 120),
  column('tenant_cost_terms', '임차인 부담비용', '권리·비용', 'multi_select', 210, { options: TENANT_COST_OPTIONS }),
  column('landlord_cost_terms', '임대인 부담비용', '권리·비용', 'multi_select', 210, { options: LANDLORD_COST_OPTIONS }),
  column('renewal_terms', '연장·갱신권', '권리·비용', 'preset_text', 220, { options: RENEWAL_PRESETS }),
  column('termination_terms', '중도해지권', '권리·비용', 'preset_text', 220, { options: TERMINATION_PRESETS }),
  column('restoration_terms', '원상복구', '권리·비용', 'preset_text', 220, { options: RESTORATION_PRESETS }),
  column('notes', '비고', '기타', 'text', 220),
]);

const RENT_ROLL_STICKY_LEFT = Object.freeze({
  occupancy_status: 62,
  tenant_name: 166,
});

export function rentRollStickyLeft(columnKey) {
  return RENT_ROLL_STICKY_LEFT[columnKey] ?? null;
}

export function rentRollGroupSegments(columns = RENT_ROLL_COLUMNS) {
  return (Array.isArray(columns) ? columns : []).reduce((segments, columnValue) => {
    const previous = segments.at(-1);
    if (previous?.group === columnValue.group) {
      previous.keys.push(columnValue.key);
      previous.colSpan += 1;
      previous.width += columnValue.width;
      return segments;
    }
    segments.push({
      group: columnValue.group,
      keys: [columnValue.key],
      colSpan: 1,
      width: columnValue.width,
      stickyLeft: rentRollStickyLeft(columnValue.key),
    });
    return segments;
  }, []);
}

export const RENT_ROLL_DETAIL_FIELDS = Object.freeze([]);
export const RENT_ROLL_PASTE_COLUMNS = Object.freeze(
  RENT_ROLL_COLUMNS.filter(({ kind }) => kind !== 'readonly').map(({ key }) => key),
);
export const RENT_ROLL_EDITABLE_FIELDS = Object.freeze(
  RENT_ROLL_COLUMNS.filter(({ kind }) => kind !== 'readonly').map(({ key }) => key),
);
export const RENT_ROLL_DERIVED_FIELDS = Object.freeze(
  RENT_ROLL_COLUMNS.filter(({ kind }) => kind === 'readonly').map(({ key }) => key),
);

const RENT_ROLL_COMPONENT_FIELDS = Object.freeze([
  'row_key',
  'space_key',
  'contract_key',
  'contract_space_key',
  'rent_term_key',
  'tenant_key',
  'space_revision',
  'contract_revision',
  'allocation_revision',
  'rent_term_revision',
  'revision',
]);
const RENT_ROLL_EXTENDED_FIELDS = Object.freeze([
  'rent_free_periods',
  'fit_out_start_date',
  'fit_out_end_date',
]);
const RENT_ROLL_FIELD_DEPENDENCIES = Object.freeze({
  rent_free_periods: ['rent_free_months', 'rent_free_start_date', 'rent_free_end_date'],
  fit_out_start_date: ['fit_out_months'],
  fit_out_end_date: ['fit_out_months'],
});
const RENT_ROLL_SAVE_FIELD_SET = new Set([
  ...RENT_ROLL_EDITABLE_FIELDS,
  ...RENT_ROLL_EXTENDED_FIELDS,
  'display_order',
]);

const numberOrNull = (value) => {
  if (value === '' || value === null || value === undefined) return null;
  const parsed = Number(String(value).replaceAll(',', ''));
  return Number.isFinite(parsed) ? parsed : null;
};

export function calculateRentFreePeriodMonths(startDate, endDate) {
  if (!startDate || !endDate) return null;
  const start = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end < start) return null;
  return Math.round(((end - start) / 2_629_800_000) * 100) / 100;
}

export function normalizeRentFreePeriod(period = {}) {
  const startDate = String(period?.start_date || period?.start || '').trim() || null;
  const endDate = String(period?.end_date || period?.end || '').trim() || null;
  const calculatedMonths = calculateRentFreePeriodMonths(startDate, endDate);
  const enteredMonths = numberOrNull(period?.months);
  return {
    start_date: startDate,
    end_date: endDate,
    months: calculatedMonths ?? (enteredMonths !== null && enteredMonths > 0 ? enteredMonths : null),
    reason: period?.reason === null || period?.reason === undefined
      ? null
      : String(period.reason).trim(),
    notes: period?.notes === null || period?.notes === undefined
      ? null
      : String(period.notes).trim(),
  };
}

export function isValidRentFreePeriod(period = {}) {
  const startDate = String(period?.start_date || period?.start || '').trim();
  const endDate = String(period?.end_date || period?.end || '').trim();
  if (startDate || endDate) {
    return Boolean(startDate && endDate && calculateRentFreePeriodMonths(startDate, endDate) !== null);
  }
  const months = numberOrNull(period?.months);
  return months !== null && months > 0;
}

export function normalizeFitOutMonths(startDate, endDate, months) {
  const calculatedMonths = calculateRentFreePeriodMonths(startDate, endDate);
  if (calculatedMonths !== null) return calculatedMonths;
  const enteredMonths = numberOrNull(months);
  return enteredMonths !== null && enteredMonths > 0 ? enteredMonths : null;
}

const uniqueTextItems = (values) => [...new Set((Array.isArray(values) ? values : [])
  .map((value) => String(value || '').trim()).filter(Boolean))];

export function normalizeRentRollGoodsTypes(value) {
  let source = value;
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    source = value.items ?? value.values ?? value.selected ?? value.text ?? '';
  }
  const items = Array.isArray(source)
    ? source
    : String(source ?? '').split(/[\n,;]+/u);
  return uniqueTextItems(items);
}

export function serializeRentRollGoodsTypes(value) {
  return normalizeRentRollGoodsTypes(value);
}

export function normalizeDepositEscalationEnabled(value) {
  if (value === true || value === 1) return 'Y';
  const normalized = String(value ?? '').trim().toLowerCase();
  return ['y', 'yes', 'true', '1', '있음'].includes(normalized) ? 'Y' : 'N';
}

export function normalizeRentRollOptionTerm(value) {
  if (value === null || value === undefined) return value;
  const text = String(value).trim();
  if (!text) return '';
  const compact = text.replace(/\s+/gu, '').toLowerCase();
  if (
    ['n', 'no', '없음', '중도해지불가'].includes(compact)
    || /^기타\((?:없음|n|no)\)$/u.test(compact)
  ) return '없음';
  if (['y', 'yes', '있음'].includes(compact)) return '있음';
  return text;
}

export function formatRentRollNumber(value, maximumFractionDigits = 2) {
  const numeric = numberOrNull(value);
  if (numeric === null) return '';
  return new Intl.NumberFormat('ko-KR', {
    minimumFractionDigits: 0,
    maximumFractionDigits,
  }).format(numeric);
}

export function parseRentRollMoneyInput(value) {
  return String(value ?? '').replaceAll(',', '').replace(/[^\d.-]/gu, '');
}

const COST_TERM_PATTERNS = Object.freeze([
  ['전기·수도·가스 등 공과금', /전기[\s\S]*수도[\s\S]*가스|제반\s*공과금/iu],
  ['임차인 설치시설·영업상 수선', /임차인\s*설치|영업상\s*필요|임차인.*귀책/iu],
  ['시설 변경·설치 비용', /시설.*(?:변경|개조|설치)/iu],
  ['추가 제세공과금·보험료', /추가.*(?:제세공과금|보험료)|증가.*(?:제세공과금|보험료)/iu],
  ['화재·배상책임보험', /화재보험|배상책임보험|종합보험/iu],
  ['전용부 미화·보안·방역', /미화|보안|방역|구서|구충/iu],
  ['교통유발·과밀부담금', /교통유발부담금|과밀부담금/iu],
  ['법정검사·시설관리비', /법정검사|시설.*관리비/iu],
  ['구조체·기본설비 유지보수', /구조물|기본적\s*설비|배관|보일러/iu],
  ['재산종합·화재보험', /재산종합보험|화재보험/iu],
  ['소유 관련 제세공과금', /소유.*제세공과금|재산세|종합부동산세|취득세/iu],
  ['공용부 미화·보안·조경', /공용부.*미화|정문.*보안|조경/iu],
  ['승강기·전기·소방 유지관리', /승강기|전기\s*안전관리|소방안전관리/iu],
  ['도로점용·단지관리비', /도로점용료|단지관리비/iu],
  ['임차인 귀책 외 수선비', /귀책사유.*제외|수선에\s*관한\s*비용/iu],
]);

export function normalizeCostTerms(value, availableOptions = null) {
  const allowed = Array.isArray(availableOptions) ? new Set(availableOptions) : null;
  const matchRawText = (rawText) => {
    const matched = COST_TERM_PATTERNS
      .filter(([label, pattern]) => (!allowed || allowed.has(label)) && pattern.test(rawText))
      .map(([label]) => label);
    return matched.length ? uniqueTextItems(matched) : [rawText];
  };
  if (Array.isArray(value)) return uniqueTextItems(value);
  if (value && typeof value === 'object') {
    if (Object.prototype.hasOwnProperty.call(value, 'items')) return uniqueTextItems(value.items);
    const alternate = value.selected_items || value.selected || value.values;
    if (Array.isArray(alternate)) return uniqueTextItems(alternate);
    const rawText = String(value.raw_text || value.text || '').trim();
    if (!rawText) return [];
    return matchRawText(rawText);
  }
  const rawText = String(value || '').trim();
  if (!rawText) return [];
  return matchRawText(rawText);
}

export function serializeCostTerms(original, items) {
  const base = original && typeof original === 'object' && !Array.isArray(original)
    ? { ...original }
    : String(original || '').trim() ? { raw_text: String(original).trim() } : {};
  return { ...base, items: uniqueTextItems(items) };
}

const perPy = (total, leasedAreaPy) => total === null || !(leasedAreaPy > 0)
  ? null : Math.round((total / leasedAreaPy) * 100) / 100;

export function calculateRentRollENoc(row) {
  const area = numberOrNull(row?.leased_area_sqm);
  const rent = numberOrNull(row?.monthly_rent_total_krw);
  const cam = numberOrNull(row?.monthly_cam_total_krw);
  if (!(area > 0) || rent === null || cam === null) return null;
  return Math.round(((rent + cam) / (area * PY_PER_SQM)) * 100) / 100;
}

export function deriveRentRollRow(row) {
  const exclusive = numberOrNull(row?.exclusive_area_sqm);
  const common = numberOrNull(row?.common_area_sqm);
  const leased = numberOrNull(row?.leased_area_sqm);
  const commencement = row?.commencement_date ? new Date(`${row.commencement_date}T00:00:00`) : null;
  const expiry = row?.expiry_date ? new Date(`${row.expiry_date}T00:00:00`) : null;
  const contractMonths = commencement && expiry && expiry >= commencement
    ? Math.max(0, Math.round((expiry - commencement) / 2_629_800_000)) : null;
  const remainingYears = expiry
    ? Math.max(0, (expiry - new Date()) / 31_557_600_000) : null;
  const rent = numberOrNull(row?.monthly_rent_total_krw);
  const deposit = numberOrNull(row?.deposit_total_krw);
  const cam = numberOrNull(row?.monthly_cam_total_krw);
  const palletRackFee = numberOrNull(row?.pallet_rack_fee);
  const rentFreeMonths = numberOrNull(row?.rent_free_months);
  const effectiveRent = rent !== null && contractMonths > 0 && rentFreeMonths !== null
    ? Math.floor(rent * Math.max(0, contractMonths - rentFreeMonths) / contractMonths) : null;
  const leasedAreaPyRaw = leased === null ? null : leased * PY_PER_SQM;
  const leasedAreaPy = leasedAreaPyRaw === null ? null : Math.round(leasedAreaPyRaw * 100) / 100;
  return {
    ...row,
    goods_type: serializeRentRollGoodsTypes(row?.goods_type),
    deposit_escalation_enabled: normalizeDepositEscalationEnabled(row?.deposit_escalation_enabled),
    renewal_terms: normalizeRentRollOptionTerm(row?.renewal_terms),
    termination_terms: normalizeRentRollOptionTerm(row?.termination_terms),
    exclusive_area_py: exclusive === null ? null : Math.round(exclusive * PY_PER_SQM * 100) / 100,
    common_area_py: common === null ? null : Math.round(common * PY_PER_SQM * 100) / 100,
    leased_area_py: leasedAreaPy,
    efficiency_ratio: leased > 0 && exclusive !== null ? Math.round((exclusive / leased) * 10000) / 100 : null,
    contract_months: contractMonths,
    wale_years: remainingYears === null ? null : Math.round(remainingYears * 100) / 100,
    deposit_per_py_krw: perPy(deposit, leasedAreaPyRaw),
    rent_per_py_krw: perPy(rent, leasedAreaPyRaw),
    cam_per_py_krw: perPy(cam, leasedAreaPyRaw),
    pallet_rack_fee_per_py: perPy(palletRackFee, leasedAreaPyRaw),
    effective_rent: effectiveRent,
    current_total_cost_per_py_krw: calculateRentRollENoc(row),
  };
}

function rentFreePeriodsForSave(value) {
  if (!Array.isArray(value)) return [];
  return value.map((period) => {
    const normalized = normalizeRentFreePeriod(period);
    return {
      ...normalized,
      reason: normalized.reason || null,
      notes: normalized.notes || null,
    };
  });
}

const RENT_ROLL_READBACK_META_FIELDS = new Set([
  'operation',
  'row_key',
  'space_key',
  'contract_key',
  'contract_space_key',
  'rent_term_key',
  'tenant_key',
  'space_revision',
  'contract_revision',
  'allocation_revision',
  'rent_term_revision',
  'revision',
]);

function canonicalPercentValue(value) {
  if (value === '' || value === null || value === undefined) return null;
  const text = String(value).trim();
  const numeric = Number(text.replace('%', ''));
  if (!Number.isFinite(numeric)) return text;
  if (text.endsWith('%')) return numeric;
  return numeric > 0 && numeric < 1 ? numeric * 100 : numeric;
}

function comparableRentRollValue(field, value) {
  if (field === 'rent_free_periods') return rentFreePeriodsForSave(value);
  if (field === 'goods_type') return serializeRentRollGoodsTypes(value);
  if (field === 'tenant_cost_terms' || field === 'landlord_cost_terms') {
    return normalizeCostTerms(value).slice().sort((left, right) => left.localeCompare(right, 'ko'));
  }
  if (field === 'renewal_terms' || field === 'termination_terms') {
    return normalizeRentRollOptionTerm(value) || null;
  }
  const column = RENT_ROLL_COLUMNS.find(({ key }) => key === field);
  if (column?.kind === 'number' || field === 'display_order') return numberOrNull(value);
  if (column?.kind === 'percent') return canonicalPercentValue(value);
  return value === '' || value === undefined ? null : value;
}

export function rentRollReadbackMismatches(payloadRows = [], readbackRows = [], keyMappings = []) {
  return payloadRows.flatMap((payload) => {
    const identity = payload.space_key || payload.row_key;
    const mappedIdentity = (Array.isArray(keyMappings) ? keyMappings : []).find(
      (mapping) => mapping?.client_space_key === identity,
    )?.server_space_key;
    const readback = readbackRows.find((row) => (
      (row.space_key || row.row_key) === identity
      || (mappedIdentity && (row.space_key || row.row_key) === mappedIdentity)
      || (payload.operation === 'create' && payload.contract_space_key
        && row.contract_space_key === payload.contract_space_key)
      || (payload.operation === 'create' && payload.rent_term_key
        && row.rent_term_key === payload.rent_term_key)
    ));
    if (payload.operation === 'delete') {
      return readback ? [{ row_key: identity, field: 'operation', expected: 'deleted', actual: 'present' }] : [];
    }
    if (!readback) return [{ row_key: identity, field: 'row', expected: 'present', actual: 'missing' }];
    return Object.keys(payload).flatMap((field) => {
      if (RENT_ROLL_READBACK_META_FIELDS.has(field)) return [];
      const expected = comparableRentRollValue(field, payload[field]);
      const actual = comparableRentRollValue(field, readback[field]);
      return JSON.stringify(actual) === JSON.stringify(expected)
        ? []
        : [{ row_key: identity, field, expected, actual }];
    });
  });
}

export function rentRollFieldsForSave(changedFields = []) {
  const fields = new Set();
  for (const field of changedFields) {
    if (RENT_ROLL_SAVE_FIELD_SET.has(field)) fields.add(field);
    for (const dependent of RENT_ROLL_FIELD_DEPENDENCIES[field] || []) fields.add(dependent);
  }
  return [...fields];
}

export function buildRentRollSaveRow(source = {}, changedFields = null) {
  const row = deriveRentRollRow(source);
  const operation = source.operation === 'delete'
    ? 'delete'
    : source.operation === 'create' || source._draft_id
      ? 'create'
      : 'update';
  const payload = { operation };
  RENT_ROLL_COMPONENT_FIELDS.forEach((key) => {
    if (Object.prototype.hasOwnProperty.call(row, key)) payload[key] = row[key];
  });
  if (operation === 'update') {
    for (const key of ['space_revision', 'contract_revision', 'allocation_revision', 'rent_term_revision']) {
      if (!Object.prototype.hasOwnProperty.call(payload, key)) payload[key] = null;
    }
  }
  const saveFields = operation === 'delete'
    ? new Set()
    : new Set(changedFields === null || operation === 'create'
      ? [...RENT_ROLL_EDITABLE_FIELDS, ...RENT_ROLL_EXTENDED_FIELDS, 'display_order']
      : rentRollFieldsForSave(changedFields));
  if (saveFields.has('display_order')) payload.display_order = numberOrNull(row.display_order);
  RENT_ROLL_COLUMNS.forEach((column) => {
    if (column.kind === 'readonly' || !saveFields.has(column.key)) return;
    let value = row[column.key];
    if (column.key === 'goods_type') value = serializeRentRollGoodsTypes(value);
    if (column.kind === 'number' || column.kind === 'readonly') value = numberOrNull(value);
    if (column.key === 'renewal_terms' || column.key === 'termination_terms') {
      value = normalizeRentRollOptionTerm(value);
    }
    payload[column.key] = value ?? null;
  });
  RENT_ROLL_EXTENDED_FIELDS.forEach((key) => {
    if (!saveFields.has(key) || !Object.prototype.hasOwnProperty.call(row, key)) return;
    payload[key] = key === 'rent_free_periods'
      ? rentFreePeriodsForSave(row[key])
      : (String(row[key] || '').trim() || null);
  });
  return payload;
}

export function buildRentRollExpectedRevisions(rows = []) {
  return Object.fromEntries(rows.flatMap((row) => {
    const revision = row?.space_revision ?? row?.revision;
    const key = row?.row_key || row?.space_key;
    return key && revision !== null && revision !== undefined ? [[key, Number(revision)]] : [];
  }));
}

export function emptyRentRollRow(draftId) {
  const key = String(draftId || globalThis.crypto?.randomUUID?.() || Date.now());
  const row = {
    _draft_id: key,
    operation: 'create',
    display_order: null,
  };
  RENT_ROLL_COLUMNS.forEach(({ key: fieldKey }) => { row[fieldKey] = ''; });
  row.occupancy_status = 'occupied';
  row.deposit_escalation_enabled = 'N';
  row.tenant_cost_terms = { items: [] };
  row.landlord_cost_terms = { items: [] };
  return row;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/u;
const NUMERIC_FIELDS = new Set(RENT_ROLL_COLUMNS.filter(({ kind }) => kind === 'number').map(({ key }) => key));
const PERCENT_FIELDS = RENT_ROLL_COLUMNS.filter(({ kind }) => kind === 'percent').map(({ key }) => key);
const DATE_FIELDS = RENT_ROLL_COLUMNS.filter(({ kind }) => kind === 'date').map(({ key }) => key);

export function validateUniversalRentRoll(rows) {
  const errors = [];
  rows.forEach((row, index) => {
    if (row.operation === 'delete') return;
    const rowLabel = `${index + 1}행`;
    const vacant = row.occupancy_status === 'vacant';
    if (!vacant && !String(row.tenant_name || '').trim()) errors.push(`${rowLabel}: 임차인명을 입력해 주세요.`);
    if (!String(row.floor_label || '').trim() && !String(row.zone_label || '').trim()) errors.push(`${rowLabel}: 층 또는 구역이 필요합니다.`);
    if (!vacant && (!row.commencement_date || !row.expiry_date)) errors.push(`${rowLabel}: 임대 개시일과 만기일이 필요합니다.`);
    DATE_FIELDS.forEach((field) => {
      if (row[field] && !ISO_DATE.test(String(row[field]))) errors.push(`${rowLabel}: ${field}는 YYYY-MM-DD 형식이어야 합니다.`);
    });
    if (row.commencement_date && row.expiry_date && row.commencement_date > row.expiry_date) {
      errors.push(`${rowLabel}: 임대 만기일이 개시일보다 빠릅니다.`);
    }
    NUMERIC_FIELDS.forEach((field) => {
      const value = numberOrNull(row[field]);
      if (row[field] !== '' && row[field] !== null && row[field] !== undefined && (value === null || value < 0)) {
        errors.push(`${rowLabel}: ${field}는 0 이상의 숫자여야 합니다.`);
      }
    });
    PERCENT_FIELDS.forEach((field) => {
      if (row[field] === '' || row[field] === null || row[field] === undefined) return;
      const value = numberOrNull(String(row[field]).replace('%', ''));
      if (value === null || value < 0 || value > 100) errors.push(`${rowLabel}: ${field}는 0~100 사이의 % 값이어야 합니다.`);
    });
  });
  return errors;
}

export function validateRentRollDelta(row, changedFields = []) {
  if (row?.operation === 'create') return validateUniversalRentRoll([row]);
  if (row?.operation === 'delete') return [];
  const fields = new Set(changedFields);
  const errors = [];
  const rowLabel = '1행';
  const vacant = row?.occupancy_status === 'vacant';
  if (fields.has('tenant_name') && !vacant && !String(row?.tenant_name || '').trim()) {
    errors.push(`${rowLabel}: 임차인명을 입력해 주세요.`);
  }
  if ((fields.has('floor_label') || fields.has('zone_label'))
      && !String(row?.floor_label || '').trim() && !String(row?.zone_label || '').trim()) {
    errors.push(`${rowLabel}: 층 또는 구역이 필요합니다.`);
  }
  DATE_FIELDS.forEach((field) => {
    if (fields.has(field) && row?.[field] && !ISO_DATE.test(String(row[field]))) {
      errors.push(`${rowLabel}: ${field}는 YYYY-MM-DD 형식이어야 합니다.`);
    }
  });
  if ((fields.has('commencement_date') || fields.has('expiry_date'))
      && row?.commencement_date && row?.expiry_date
      && ISO_DATE.test(String(row.commencement_date)) && ISO_DATE.test(String(row.expiry_date))
      && row.commencement_date > row.expiry_date) {
    errors.push(`${rowLabel}: 임대 만기일이 개시일보다 빠릅니다.`);
  }
  NUMERIC_FIELDS.forEach((field) => {
    if (!fields.has(field)) return;
    const value = numberOrNull(row?.[field]);
    if (row?.[field] !== '' && row?.[field] !== null && row?.[field] !== undefined
        && (value === null || value < 0)) {
      errors.push(`${rowLabel}: ${field}는 0 이상의 숫자여야 합니다.`);
    }
  });
  PERCENT_FIELDS.forEach((field) => {
    if (!fields.has(field) || row?.[field] === '' || row?.[field] === null || row?.[field] === undefined) return;
    const value = numberOrNull(String(row[field]).replace('%', ''));
    if (value === null || value < 0 || value > 100) {
      errors.push(`${rowLabel}: ${field}는 0~100 사이의 % 값이어야 합니다.`);
    }
  });
  return errors;
}
