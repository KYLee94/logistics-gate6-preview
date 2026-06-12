-- 인천석남물류센터 DB_일반 원본 행 기준 보정
-- 원본: 층 B1~8, 현재 계약개시 2024-03-13, 현재 계약만기 2034-06-12.

update public.ll_lease_spaces
set
  floor_label = 'B1~8',
  review_status = case
    when review_status = 'suspected_error' then 'source_repaired'
    else review_status
  end,
  review_note = concat_ws(' / ', nullif(review_note, ''), '인천석남 DB_일반 원본 기준 층 B1~8 보정'),
  updated_at = now()
where asset_id = 'asset_a112721001'
  and tenant_id = 'tenant_brn_1208800767';

update public.ll_leases
set
  first_contract_date = '2020-08-19',
  first_start_date = '2024-03-13',
  first_end_date = '2034-06-12',
  first_operation_date = '2024-06-13',
  recent_contract_date = '2024-03-12',
  current_start_date = '2024-03-13',
  current_end_date = '2034-06-12',
  review_status = case
    when review_status = 'suspected_error' then 'source_repaired'
    else review_status
  end,
  review_note = concat_ws(' / ', nullif(review_note, ''), '인천석남 DB_일반 원본 기준 계약일자 보정'),
  updated_at = now()
where asset_id = 'asset_a112721001'
  and tenant_id = 'tenant_brn_1208800767';
