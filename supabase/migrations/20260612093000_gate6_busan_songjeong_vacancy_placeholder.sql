-- 부산송정물류센터는 원본 DB_일반에 임차인 '-' placeholder 면적 행이 있으나, 운영 기준은 전체 공실입니다.
-- 원본 추적 행은 삭제하지 않고 공실 placeholder로 표시해 dashboard 임대면적/임차인 계산에서 제외합니다.

update public.ll_lease_spaces
set
  contract_status = 'vacant',
  current_monthly_rent_total = 0,
  current_monthly_mf_total = 0,
  current_monthly_cost_total = 0,
  e_noc = null,
  review_status = 'vacancy_placeholder',
  review_note = concat_ws(' / ', nullif(review_note, ''), '부산송정 전체 공실 기준: 원본 tenant "-" 면적 행은 계산 제외'),
  updated_at = now()
where asset_id = 'asset_a112109001'
  and (
    tenant_id = 'tenant_name_'
    or lease_space_id like 'asset_a112109001|tenant_name_%'
    or coalesce(current_monthly_cost_total, 0) = 0
  );

update public.ll_leases
set
  lease_status = 'vacant',
  review_status = 'vacancy_placeholder',
  review_note = concat_ws(' / ', nullif(review_note, ''), '부산송정 전체 공실 기준: 원본 tenant "-" 계약 행은 계산 제외'),
  updated_at = now()
where asset_id = 'asset_a112109001'
  and (
    tenant_id = 'tenant_name_'
    or lease_id like 'asset_a112109001|tenant_name_%'
  );
