export const RENT_ROLL_COLUMN_GROUPS = Object.freeze([
  Object.freeze({
    key: 'core',
    label: '핵심 열',
    description: '네 가지 참고 렌트롤에 공통으로 존재하는 계약·공간·금액 항목입니다.',
    columns: Object.freeze([
      { key: 'occupancy_status', label: '임대 상태', kind: 'select', options: [['occupied', '임대'], ['vacant', '공실']] },
      { key: 'tenant_name', label: '임차인', kind: 'text' },
      { key: 'use_category', label: '용도', kind: 'text' },
      { key: 'floor_label', label: '층', kind: 'text' },
      { key: 'zone_label', label: '구역', kind: 'text' },
      { key: 'exclusive_area_sqm', label: '전용면적(㎡)', kind: 'number' },
      { key: 'common_area_sqm', label: '공용면적(㎡)', kind: 'number' },
      { key: 'leased_area_sqm', label: '임대면적(㎡)', kind: 'number' },
      { key: 'commencement_date', label: '계약개시일', kind: 'date' },
      { key: 'expiry_date', label: '계약만기일', kind: 'date' },
      { key: 'deposit_total_krw', label: '보증금', kind: 'number' },
      { key: 'monthly_rent_total_krw', label: '월 임대료', kind: 'number' },
      { key: 'monthly_cam_total_krw', label: '월 관리비', kind: 'number' },
    ]),
  }),
  Object.freeze({
    key: 'terms',
    label: '계약 조건',
    description: '평당가·Rent Free·인상·Fit Out 등 반복 가능한 가격 조건입니다.',
    columns: Object.freeze([
      { key: 'efficiency_ratio', label: '전용률', kind: 'number' },
      { key: 'deposit_per_py_krw', label: '보증금 평당', kind: 'number' },
      { key: 'rent_per_py_krw', label: '임대료 평당', kind: 'number' },
      { key: 'cam_per_py_krw', label: '관리비 평당', kind: 'number' },
      { key: 'rent_free_schedule', label: 'Rent Free 일정', kind: 'textarea' },
      { key: 'deposit_escalation_rule', label: '보증금 인상', kind: 'textarea' },
      { key: 'rent_escalation_rule', label: '임대료 인상', kind: 'textarea' },
      { key: 'cam_escalation_rule', label: '관리비 인상', kind: 'textarea' },
      { key: 'fit_out_months', label: 'Fit Out(개월)', kind: 'number' },
      { key: 'fit_out_amount', label: 'Fit Out 금액', kind: 'number' },
      { key: 'effective_rent', label: '실효 임대료', kind: 'number' },
    ]),
  }),
  Object.freeze({
    key: 'rights',
    label: '비용·권리',
    description: '임차인·임대인 부담과 갱신·해지·원상복구 원문을 보존합니다.',
    columns: Object.freeze([
      { key: 'tenant_cost_terms', label: '임차인 부담비용', kind: 'textarea' },
      { key: 'landlord_cost_terms', label: '임대인 부담비용', kind: 'textarea' },
      { key: 'renewal_terms', label: '계약 연장·갱신', kind: 'textarea' },
      { key: 'termination_terms', label: '중도해지', kind: 'textarea' },
      { key: 'restoration_terms', label: '원상복구', kind: 'textarea' },
    ]),
  }),
  Object.freeze({
    key: 'additional',
    label: '부가 정보',
    description: 'JLL·Deloitte 참고자료에만 있는 담보·운영일정·팔레트랙 항목도 잃지 않습니다.',
    columns: Object.freeze([
      { key: 'bond_terms', label: '채권·담보 조건', kind: 'textarea' },
      { key: 'operation_start_date', label: '운영개시일', kind: 'date' },
      { key: 'pallet_rack_fee', label: '팔레트랙 사용료', kind: 'number' },
      { key: 'notes', label: '비고', kind: 'textarea' },
    ]),
  }),
]);

export const RENT_ROLL_PASTE_COLUMNS = Object.freeze(
  RENT_ROLL_COLUMN_GROUPS.find((group) => group.key === 'core').columns.map((column) => column.key),
);

export function emptyRentRollRow(draftId) {
  return {
    _draft_id: draftId,
    operation: 'create',
    occupancy_status: 'occupied',
    tenant_name: '',
    use_category: '',
    floor_label: '',
    zone_label: '',
    exclusive_area_sqm: '',
    common_area_sqm: '',
    leased_area_sqm: '',
    commencement_date: '',
    expiry_date: '',
    deposit_total_krw: '',
    monthly_rent_total_krw: '',
    monthly_cam_total_krw: '',
    rent_free_schedule: '',
    rent_escalation_rule: '',
    tenant_cost_terms: '',
    landlord_cost_terms: '',
    renewal_terms: '',
    termination_terms: '',
    restoration_terms: '',
    bond_terms: '',
    operation_start_date: '',
    pallet_rack_fee: '',
    notes: '',
  };
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/u;
const NUMERIC_FIELDS = new Set(
  RENT_ROLL_COLUMN_GROUPS.flatMap((group) => group.columns)
    .filter((column) => column.kind === 'number')
    .map((column) => column.key),
);

export function validateUniversalRentRoll(rows) {
  const errors = [];
  rows.forEach((row, index) => {
    if (row.operation === 'delete') return;
    const rowLabel = `${index + 1}행`;
    const vacant = row.occupancy_status === 'vacant';
    if (!vacant && !String(row.tenant_name || '').trim()) errors.push(`${rowLabel}: 임대 상태인 행은 임차인이 필요합니다.`);
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
    const exclusive = Number(row.exclusive_area_sqm || 0);
    const common = Number(row.common_area_sqm || 0);
    const leased = Number(row.leased_area_sqm || 0);
    if (exclusive > 0 && common >= 0 && leased > 0 && Math.abs((exclusive + common) - leased) > 0.02) {
      errors.push(`${rowLabel}: 전용면적과 공용면적의 합이 임대면적과 일치하지 않습니다.`);
    }
  });
  return errors;
}
