export const RENT_ROLL_COLUMNS = Object.freeze([
  { key: 'occupancy_status', label: '임대 상태', kind: 'select', width: 112, options: [['occupied', '임대'], ['vacant', '공실']] },
  { key: 'tenant_name', label: '임차인', kind: 'tenant', width: 190 },
  { key: 'use_category', label: '용도', kind: 'text', width: 120 },
  { key: 'floor_label', label: '층', kind: 'text', width: 90 },
  { key: 'area_pair', label: '면적', kind: 'area', sortKey: 'leased_area_sqm', width: 176 },
  { key: 'efficiency_ratio', label: '전용률', kind: 'number', width: 110 },
  { key: 'lease_period', label: '임대차 기간', kind: 'period', sortKey: 'expiry_date', width: 176 },
  { key: 'deposit_pair', label: '보증금', kind: 'moneyPair', totalKey: 'deposit_total_krw', unitKey: 'deposit_per_py_krw', sortKey: 'deposit_total_krw', width: 172 },
  { key: 'rent_pair', label: '월 임대료', kind: 'moneyPair', totalKey: 'monthly_rent_total_krw', unitKey: 'rent_per_py_krw', sortKey: 'monthly_rent_total_krw', width: 172 },
  { key: 'cam_pair', label: '월 관리비', kind: 'moneyPair', totalKey: 'monthly_cam_total_krw', unitKey: 'cam_per_py_krw', sortKey: 'monthly_cam_total_krw', width: 172 },
  { key: 'rent_free_summary', label: 'Rent Free', kind: 'summary', sortKey: 'rent_free_months', width: 164 },
  { key: 'escalation_summary', label: '인상 조건', kind: 'summary', sortKey: 'rent_escalation_rule', width: 190 },
  { key: 'current_total_cost_per_py_krw', label: '현재 임차비용', kind: 'readonlyMoney', sortKey: 'current_total_cost_per_py_krw', width: 158 },
  { key: 'operation_start_date', label: '운영개시일', kind: 'date', width: 140 },
  { key: 'notes', label: '비고', kind: 'textarea', width: 240 },
]);

export const RENT_ROLL_DETAIL_FIELDS = Object.freeze([
  { key: 'business_registration_number', label: '사업자등록번호', kind: 'text' },
  { key: 'zone_label', label: '구역', kind: 'text' },
  { key: 'exclusive_area_sqm', label: '전용면적(㎡)', kind: 'number' },
  { key: 'common_area_sqm', label: '공용면적(㎡)', kind: 'number' },
  { key: 'leased_area_sqm', label: '임대면적(㎡)', kind: 'number' },
  { key: 'deposit_per_py_krw', label: '보증금 평당', kind: 'number' },
  { key: 'rent_per_py_krw', label: '임대료 평당', kind: 'number' },
  { key: 'cam_per_py_krw', label: '관리비 평당', kind: 'number' },
  { key: 'rent_free_schedule', label: 'Rent Free 일정', kind: 'textarea' },
  { key: 'deposit_escalation_rule', label: '보증금 인상', kind: 'textarea' },
  { key: 'rent_escalation_rule', label: '임대료 인상', kind: 'textarea' },
  { key: 'cam_escalation_rule', label: '관리비 인상', kind: 'textarea' },
  { key: 'fit_out_months', label: 'Fit Out(개월)', kind: 'number' },
  { key: 'fit_out_amount', label: 'Fit Out 금액', kind: 'number' },
  { key: 'pallet_rack_fee', label: '팔레트랙 사용료', kind: 'number' },
  { key: 'tenant_cost_terms', label: '임차인 부담비용', kind: 'textarea' },
  { key: 'landlord_cost_terms', label: '임대인 부담비용', kind: 'textarea' },
  { key: 'renewal_terms', label: '계약 연장·갱신', kind: 'textarea' },
  { key: 'termination_terms', label: '중도해지', kind: 'textarea' },
  { key: 'restoration_terms', label: '원상복구', kind: 'textarea' },
  { key: 'bond_terms', label: '채권·담보 조건', kind: 'textarea' },
]);

export const RENT_ROLL_PASTE_COLUMNS = Object.freeze([
  'occupancy_status', 'tenant_name', 'use_category', 'floor_label',
  'exclusive_area_sqm', 'common_area_sqm', 'leased_area_sqm', 'commencement_date', 'expiry_date',
  'deposit_total_krw', 'monthly_rent_total_krw', 'monthly_cam_total_krw', 'rent_free_months', 'rent_escalation_rule',
]);

export function emptyRentRollRow(draftId) {
  const key = String(draftId || globalThis.crypto?.randomUUID?.() || Date.now());
  return {
    _draft_id: key,
    row_key: `space-${key}`,
    space_key: `space-${key}`,
    contract_key: `contract-${key}`,
    contract_space_key: `allocation-${key}`,
    rent_term_key: `rent-${key}`,
    operation: 'create',
    display_order: null,
    occupancy_status: 'occupied',
    tenant_key: '',
    tenant_name: '',
    business_registration_number: '',
    use_category: '',
    floor_label: '',
    zone_label: '',
    exclusive_area_sqm: '',
    common_area_sqm: '',
    leased_area_sqm: '',
    efficiency_ratio: '',
    commencement_date: '',
    expiry_date: '',
    deposit_total_krw: '',
    deposit_per_py_krw: '',
    monthly_rent_total_krw: '',
    rent_per_py_krw: '',
    monthly_cam_total_krw: '',
    cam_per_py_krw: '',
    rent_free_months: '',
    rent_free_schedule: '',
    deposit_escalation_rule: '',
    rent_escalation_rule: '',
    cam_escalation_rule: '',
    fit_out_months: '',
    fit_out_amount: '',
    effective_rent: '',
    current_total_cost_per_py_krw: '',
    pallet_rack_fee: '',
    tenant_cost_terms: '',
    landlord_cost_terms: '',
    renewal_terms: '',
    termination_terms: '',
    restoration_terms: '',
    bond_terms: '',
    operation_start_date: '',
    notes: '',
  };
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/u;
const NUMERIC_FIELDS = new Set([
  'exclusive_area_sqm', 'common_area_sqm', 'leased_area_sqm', 'efficiency_ratio',
  'deposit_total_krw', 'deposit_per_py_krw', 'monthly_rent_total_krw', 'rent_per_py_krw',
  'monthly_cam_total_krw', 'cam_per_py_krw', 'rent_free_months', 'fit_out_months',
  'fit_out_amount', 'effective_rent', 'pallet_rack_fee',
]);

export function validateUniversalRentRoll(rows) {
  const errors = [];
  rows.forEach((row, index) => {
    if (row.operation === 'delete') return;
    const rowLabel = `${index + 1}행`;
    const vacant = row.occupancy_status === 'vacant';
    if (!vacant && !String(row.tenant_key || '').trim()) errors.push(`${rowLabel}: 임차인을 선택해 주세요.`);
    if (!String(row.floor_label || '').trim() && !String(row.zone_label || '').trim()) errors.push(`${rowLabel}: 층 또는 구역이 필요합니다.`);
    if (!vacant && (!row.commencement_date || !row.expiry_date)) errors.push(`${rowLabel}: 계약개시일과 만기일이 필요합니다.`);
    for (const field of ['commencement_date', 'expiry_date', 'operation_start_date']) {
      if (row[field] && !ISO_DATE.test(String(row[field]))) errors.push(`${rowLabel}: ${field}는 YYYY-MM-DD 형식이어야 합니다.`);
    }
    if (row.commencement_date && row.expiry_date && row.commencement_date > row.expiry_date) {
      errors.push(`${rowLabel}: 계약만기일이 계약개시일보다 빠릅니다.`);
    }
    for (const field of NUMERIC_FIELDS) {
      if (row[field] === '' || row[field] === null || row[field] === undefined) continue;
      const value = Number(String(row[field]).replaceAll(',', ''));
      if (!Number.isFinite(value) || value < 0) errors.push(`${rowLabel}: ${field}는 0 이상의 숫자여야 합니다.`);
    }
  });
  return errors;
}
