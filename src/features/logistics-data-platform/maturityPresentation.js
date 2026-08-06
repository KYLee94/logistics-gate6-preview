const INTERNAL_NAME_PATTERN = /^(?:[0-9a-f]{8}-[0-9a-f-]{27,}|(?:lease|fund|loan|contract|maturity)[-_])/iu;

function clean(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function humanFallback(value, fallback) {
  const text = clean(value);
  return text && !INTERNAL_NAME_PATTERN.test(text) ? text : fallback;
}

function lenderSummary(row) {
  const lenders = Array.isArray(row?.lender_names)
    ? row.lender_names.map(clean).filter(Boolean)
    : clean(row?.lender_names).split(/[,·]/u).map((value) => value.trim()).filter(Boolean);
  if (!lenders.length) return '';
  return lenders.length === 1 ? lenders[0] : `${lenders[0]} 외 ${lenders.length - 1}개사`;
}

export function maturityDisplayName(row = {}) {
  const type = row.type || row.kind;
  if (type === 'lease') {
    return humanFallback(row.tenant_name, humanFallback(row.target_name, '임차인 정보 확인 필요'));
  }
  if (type === 'fund') {
    return humanFallback(row.fund_name, humanFallback(row.target_name, '펀드 정보 확인 필요'));
  }
  if (type === 'loan') {
    const tranche = humanFallback(row.tranche_name || row.loan_name, '');
    const lenders = lenderSummary(row);
    if (tranche && lenders) return `${tranche} · ${lenders}`;
    return tranche || lenders || humanFallback(row.target_name, '대출 정보 확인 필요');
  }
  return humanFallback(row.target_name, '만기 정보 확인 필요');
}

export function maturityDetailRows(row = {}) {
  const type = row.type || row.kind;
  const commonDate = row.official_date || row.maturity_date;
  if (type === 'lease') {
    return [
      ['임차인', maturityDisplayName(row)],
      ['만기일', commonDate],
      ['계약 개시일', row.commencement_date],
      ['임대 공간', [row.floor_labels, row.zone_labels].filter(Boolean).join(' · ')],
      ['임대면적', row.leased_area_sqm, 'area'],
      ['보증금', row.deposit_amount, 'amount'],
      ['월 임대료', row.monthly_rent_total_krw, 'amount'],
      ['월 관리비', row.monthly_cam_total_krw, 'amount'],
      ['연장·갱신 조건', row.renewal_terms],
      ['중도해지 조건', row.termination_terms],
      ['원상복구 조건', row.restoration_terms],
    ];
  }
  if (type === 'fund') {
    return [
      ['펀드명', maturityDisplayName(row)],
      ['만기일', commonDate],
      ['설정일', row.inception_date],
      ['펀드 유형', row.fund_type],
      ['투자 전략', row.investment_strategy],
      ['자산 지분율', row.ownership_ratio, 'percentRatio'],
      ['상태', row.fund_status],
    ];
  }
  return [
    ['대출', maturityDisplayName(row)],
    ['대주', lenderSummary(row)],
    ['만기일', commonDate],
    ['실행일', row.drawdown_date],
    ['약정액', row.commitment_amount, 'amount'],
    ['대출잔액', row.outstanding_amount, 'amount'],
    ['대출 유형', row.loan_type],
    ['금리 유형', row.interest_type],
    ['이자 금리(Coupon)', row.coupon_rate],
    ['All-in 금리', row.all_in_rate],
    ['수수료', row.fee_rate],
    ['연계 펀드', row.fund_name],
  ];
}
