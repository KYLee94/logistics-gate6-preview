-- Preview only. Do not execute before explicit Gate 6 DB mutation approval.
-- Target check: all writes target public.ll_data_quality_findings.

insert into public.ll_data_quality_findings (
  finding_id,
  audit_run_id,
  finding_type,
  severity,
  entity_type,
  entity_id,
  source_sheet_name,
  source_header,
  source_value_text,
  supabase_value_text,
  status,
  finding_payload
)
values
  (
    'dq_monthly_total_scope_asset_a112606001_20260514',
    'gate6_blocker_resolution_20260514',
    'monthly_total_reconciliation',
    'warning',
    'asset',
    'asset_a112606001',
    'll_payload_snapshots/docs_asset_asset_a112606001',
    'monthly_total_cost',
    'snapshot=1028369423',
    'll_rent_history_latest=656143323',
    'review_required',
    jsonb_build_object(
      'reason', 'aggregation_scope_mismatch',
      'asset_name', '여주 본두리 물류센터',
      'expected', 1028369423,
      'actual', 656143323,
      'diff', 372226100,
      'latest_rows', 3,
      'null_mf_rows', 0,
      'source_row_hint', 'sheet_db_history:r000144 appears non-latest but equals diff amount'
    )
  ),
  (
    'dq_monthly_total_scope_asset_a112127001_20260514',
    'gate6_blocker_resolution_20260514',
    'monthly_total_reconciliation',
    'warning',
    'asset',
    'asset_a112127001',
    'll_payload_snapshots/docs_asset_asset_a112127001',
    'monthly_total_cost',
    'snapshot=552212356',
    'll_rent_history_latest=189633928',
    'review_required',
    jsonb_build_object(
      'reason', 'aggregation_scope_mismatch',
      'asset_name', '아레나스양지물류센터',
      'expected', 552212356,
      'actual', 189633928,
      'diff', 362578428,
      'latest_rows', 3,
      'null_mf_rows', 0
    )
  ),
  (
    'dq_monthly_total_scope_asset_a112299001_20260514',
    'gate6_blocker_resolution_20260514',
    'monthly_total_reconciliation',
    'warning',
    'asset',
    'asset_a112299001',
    'll_payload_snapshots/docs_asset_asset_a112299001',
    'monthly_total_cost',
    'snapshot=669324200',
    'll_rent_history_latest=340014910',
    'review_required',
    jsonb_build_object(
      'reason', 'aggregation_scope_mismatch',
      'asset_name', '스카이박스1, 스카이박스2',
      'expected', 669324200,
      'actual', 340014910,
      'diff', 329309290,
      'latest_rows', 2,
      'null_mf_rows', 0
    )
  )
on conflict (finding_id) do update
set audit_run_id = excluded.audit_run_id,
    finding_type = excluded.finding_type,
    severity = excluded.severity,
    entity_type = excluded.entity_type,
    entity_id = excluded.entity_id,
    source_sheet_name = excluded.source_sheet_name,
    source_header = excluded.source_header,
    source_value_text = excluded.source_value_text,
    supabase_value_text = excluded.supabase_value_text,
    status = excluded.status,
    finding_payload = excluded.finding_payload,
    updated_at = now()
returning finding_id, entity_id, source_value_text, supabase_value_text, status, finding_payload;
