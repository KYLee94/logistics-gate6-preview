const PY_PER_SQM = 0.3025;

const column = (key, label, group, kind = 'text', width = 128, extra = {}) => Object.freeze({
  key, label, group, kind, width, ...extra,
});

// 네 개의 운영 렌트롤 원본에서 반복되는 필드를 한 셀 한 값 원칙으로 평탄화했습니다.
export const RENT_ROLL_COLUMNS = Object.freeze([
  column('occupancy_status', '임대 상태', '공간', 'select', 104, { options: [['occupied', '임대'], ['vacant', '공실'], ['planned', '예정']] }),
  column('tenant_name', '임차인', '임차인', 'text', 190),
  column('business_registration_number', '사업자등록번호', '임차인', 'text', 142),
  column('temperature_type', '온도대', '공간', 'text', 94),
  column('use_category', '용도', '공간', 'text', 116),
  column('goods_type', '취급 화물', '공간', 'text', 118),
  column('floor_label', '층', '공간', 'text', 72),
  column('zone_label', '구역', '공간', 'text', 96),
  column('subtenant_name', '전대 임차인', '공간', 'text', 140),
  column('free_area_type', '유·무상', '공간', 'text', 92),
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
  column('construction_start_date', '공사 착공일', '계약 기간', 'date', 124),
  column('completion_date', '준공일', '계약 기간', 'date', 124),
  column('operation_start_date', '운영 개시일', '계약 기간', 'date', 124),
  column('deposit_total_krw', '보증금 합계', '보증금', 'number', 140),
  column('deposit_per_py_krw', '보증금/평', '보증금', 'number', 116),
  column('security_type', '담보 방식', '보증금', 'text', 116),
  column('security_ratio', '담보 비율(%)', '보증금', 'number', 112),
  column('rent_calculation_method', '임대료 산정', '임대료', 'text', 130),
  column('monthly_rent_total_krw', '월 임대료', '임대료', 'number', 140),
  column('rent_per_py_krw', '임대료/평', '임대료', 'number', 116),
  column('monthly_cam_total_krw', '월 관리비', '임대료', 'number', 136),
  column('cam_per_py_krw', '관리비/평', '임대료', 'number', 116),
  column('pallet_rack_fee', '랙 사용료', '임대료', 'number', 124),
  column('pallet_rack_fee_per_py', '랙 사용료/평', '임대료', 'number', 120),
  column('current_total_cost_per_py_krw', 'E.NOC/평', '임대료', 'readonly', 122),
  column('rent_free_months', '렌트프리(개월)', '무상·지원', 'number', 118),
  column('rent_free_start_date', '렌트프리 시작', '무상·지원', 'date', 124),
  column('rent_free_end_date', '렌트프리 종료', '무상·지원', 'date', 124),
  column('effective_rent', '실효 임대료', '무상·지원', 'readonly', 126),
  column('fit_out_months', 'Fit-out(개월)', '무상·지원', 'number', 112),
  column('fit_out_amount', 'Fit-out 금액', '무상·지원', 'number', 128),
  column('tenant_improvement_amount', 'TI 지원금', '무상·지원', 'number', 128),
  column('deposit_escalation_first_date', '보증금 인상일', '인상 조건', 'date', 124),
  column('deposit_escalation_interval_months', '보증금 주기(개월)', '인상 조건', 'number', 126),
  column('deposit_escalation_rate', '보증금 인상률', '인상 조건', 'text', 120),
  column('rent_escalation_first_date', '임대료 인상일', '인상 조건', 'date', 124),
  column('rent_escalation_interval_months', '임대료 주기(개월)', '인상 조건', 'number', 126),
  column('rent_escalation_rate', '임대료 인상률', '인상 조건', 'text', 120),
  column('cam_escalation_first_date', '관리비 인상일', '인상 조건', 'date', 124),
  column('cam_escalation_interval_months', '관리비 주기(개월)', '인상 조건', 'number', 126),
  column('cam_escalation_rate', '관리비 인상률', '인상 조건', 'text', 120),
  column('tenant_cost_terms', '임차인 부담비용', '권리·비용', 'text', 180),
  column('landlord_cost_terms', '임대인 부담비용', '권리·비용', 'text', 180),
  column('renewal_terms', '연장·갱신권', '권리·비용', 'text', 180),
  column('termination_terms', '중도해지권', '권리·비용', 'text', 180),
  column('restoration_terms', '원상복구', '권리·비용', 'text', 180),
  column('notes', '비고', '기타', 'text', 220),
]);

export const RENT_ROLL_DETAIL_FIELDS = Object.freeze([]);
export const RENT_ROLL_PASTE_COLUMNS = Object.freeze(
  RENT_ROLL_COLUMNS.filter(({ kind }) => kind !== 'readonly').map(({ key }) => key),
);

const numberOrNull = (value) => {
  if (value === '' || value === null || value === undefined) return null;
  const parsed = Number(String(value).replaceAll(',', ''));
  return Number.isFinite(parsed) ? parsed : null;
};

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
  const rentFreeMonths = numberOrNull(row?.rent_free_months);
  const effectiveRent = rent !== null && contractMonths > 0 && rentFreeMonths !== null
    ? Math.round((rent * Math.max(0, contractMonths - rentFreeMonths) / contractMonths) * 100) / 100 : null;
  return {
    ...row,
    exclusive_area_py: exclusive === null ? null : Math.round(exclusive * PY_PER_SQM * 100) / 100,
    common_area_py: common === null ? null : Math.round(common * PY_PER_SQM * 100) / 100,
    leased_area_py: leased === null ? null : Math.round(leased * PY_PER_SQM * 100) / 100,
    efficiency_ratio: leased > 0 && exclusive !== null ? Math.round((exclusive / leased) * 10000) / 100 : null,
    contract_months: contractMonths,
    wale_years: remainingYears === null ? null : Math.round(remainingYears * 100) / 100,
    effective_rent: effectiveRent,
    current_total_cost_per_py_krw: calculateRentRollENoc(row),
  };
}

export function emptyRentRollRow(draftId) {
  const key = String(draftId || globalThis.crypto?.randomUUID?.() || Date.now());
  const row = {
    _draft_id: key,
    row_key: `space-${key}`,
    space_key: `space-${key}`,
    contract_key: `contract-${key}`,
    contract_space_key: `allocation-${key}`,
    rent_term_key: `rent-${key}`,
    operation: 'create',
    display_order: null,
  };
  RENT_ROLL_COLUMNS.forEach(({ key: fieldKey }) => { row[fieldKey] = ''; });
  row.occupancy_status = 'occupied';
  return row;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/u;
const NUMERIC_FIELDS = new Set(RENT_ROLL_COLUMNS.filter(({ kind }) => kind === 'number').map(({ key }) => key));
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
  });
  return errors;
}
