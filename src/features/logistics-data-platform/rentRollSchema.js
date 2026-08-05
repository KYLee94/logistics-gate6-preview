export const RENT_ROLL_COLUMNS = Object.freeze([
  { key: 'occupancy_status', label: '임대 상태', kind: 'select', width: 112, options: [['occupied', '임대'], ['vacant', '공실']] },
  { key: 'tenant_name', label: '임차인', kind: 'tenant', width: 190 },
  { key: 'business_registration_number', label: '사업자등록번호', kind: 'text', width: 150 },
  { key: 'use_category', label: '용도', kind: 'text', width: 120 },
  { key: 'floor_label', label: '층', kind: 'text', width: 90 },
  { key: 'zone_label', label: '구역', kind: 'text', width: 130 },
  { key: 'exclusive_area_sqm', label: '전용면적(㎡)', kind: 'number', width: 130 },
  { key: 'common_area_sqm', label: '공용면적(㎡)', kind: 'number', width: 130 },
  { key: 'leased_area_sqm', label: '임대면적(㎡)', kind: 'number', width: 130 },
  { key: 'efficiency_ratio', label: '전용률', kind: 'number', width: 110 },
  { key: 'commencement_date', label: '계약개시일', kind: 'date', width: 140 },
  { key: 'expiry_date', label: '계약만기일', kind: 'date', width: 140 },
  { key: 'deposit_total_krw', label: '보증금', kind: 'number', width: 150 },
  { key: 'deposit_per_py_krw', label: '보증금 평당', kind: 'number', width: 140 },
  { key: 'monthly_rent_total_krw', label: '월 임대료', kind: 'number', width: 150 },
  { key: 'rent_per_py_krw', label: '임대료 평당', kind: 'number', width: 140 },
  { key: 'monthly_cam_total_krw', label: '월 관리비', kind: 'number', width: 150 },
  { key: 'cam_per_py_krw', label: '관리비 평당', kind: 'number', width: 140 },
  { key: 'rent_free_months', label: 'Rent Free(개월)', kind: 'number', width: 150 },
  { key: 'rent_free_schedule', label: 'Rent Free 일정', kind: 'textarea', width: 260 },
  { key: 'deposit_escalation_rule', label: '보증금 인상', kind: 'textarea', width: 230 },
  { key: 'rent_escalation_rule', label: '임대료 인상', kind: 'textarea', width: 260 },
  { key: 'cam_escalation_rule', label: '관리비 인상', kind: 'textarea', width: 230 },
  { key: 'fit_out_months', label: 'Fit Out(개월)', kind: 'number', width: 130 },
  { key: 'fit_out_amount', label: 'Fit Out 금액', kind: 'number', width: 150 },
  { key: 'effective_rent', label: '실효 임대료', kind: 'number', width: 150 },
  { key: 'pallet_rack_fee', label: '팔레트랙 사용료', kind: 'number', width: 160 },
  { key: 'tenant_cost_terms', label: '임차인 부담비용', kind: 'textarea', width: 300 },
  { key: 'landlord_cost_terms', label: '임대인 부담비용', kind: 'textarea', width: 300 },
  { key: 'renewal_terms', label: '계약 연장·갱신', kind: 'textarea', width: 300 },
  { key: 'termination_terms', label: '중도해지', kind: 'textarea', width: 300 },
  { key: 'restoration_terms', label: '원상복구', kind: 'textarea', width: 300 },
  { key: 'bond_terms', label: '채권·담보 조건', kind: 'textarea', width: 260 },
  { key: 'operation_start_date', label: '운영개시일', kind: 'date', width: 140 },
  { key: 'notes', label: '비고', kind: 'textarea', width: 320 },
]);

export const RENT_ROLL_PASTE_COLUMNS = Object.freeze([
  'occupancy_status', 'tenant_name', 'business_registration_number', 'use_category', 'floor_label', 'zone_label',
  'exclusive_area_sqm', 'common_area_sqm', 'leased_area_sqm', 'commencement_date', 'expiry_date',
  'deposit_total_krw', 'monthly_rent_total_krw', 'monthly_cam_total_krw',
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
const NUMERIC_FIELDS = new Set(RENT_ROLL_COLUMNS
  .filter((column) => column.kind === 'number')
  .map((column) => column.key));

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
