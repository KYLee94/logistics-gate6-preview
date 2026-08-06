begin;

-- Expose the revision of each physical row that the editable home projection
-- combines. Keep the legacy `revision` field for existing readers while new
-- writers can send the exact revision for the field being changed.
create or replace function logistics_core.home_read_entry(
  p_request_id uuid,
  p_asset_key text,
  p_payload jsonb,
  p_expected_revisions jsonb
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, logistics_core
as $body$
declare
  base_response jsonb;
  actor_id uuid := logistics_core.request_actor();
  resolved_asset_id uuid;
  asset_payload jsonb;
  fund_rows jsonb;
  investment_rows jsonb;
  loan_rows jsonb;
  write_status jsonb;
begin
  base_response := logistics_core.home_read_entry_v3(p_request_id, p_asset_key, p_payload, p_expected_revisions);
  if nullif(btrim(p_asset_key), '') is null then return base_response; end if;
  resolved_asset_id := logistics_core.resolve_asset_id(p_asset_key);
  perform logistics_core.assert_asset_permission(actor_id, resolved_asset_id, 'read');
  write_status := logistics_core.actor_write_status(actor_id, resolved_asset_id);

  select jsonb_strip_nulls(jsonb_build_object(
    'asset_key', asset.asset_key, 'asset_code', asset.asset_code, 'name', asset.name_ko,
    'address', asset.address_ko, 'sector', asset.sector, 'land_area_sqm', asset.land_area_sqm,
    'gross_area_sqm', asset.gross_area_sqm, 'leasable_area_sqm', asset.leasable_area_sqm,
    'floor_count', asset.floor_count, 'manager_name', asset.manager_name,
    'manager_team', asset.manager_team, 'acquisition_cost', asset.acquisition_cost,
    'current_valuation', asset.current_valuation, 'currency_code', asset.currency_code,
    'revision', asset.revision
  )) into asset_payload
  from logistics_core.assets asset where asset.id = resolved_asset_id and asset.deleted_at is null;

  select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
    'fund_key', fund.fund_key, 'fund_code', fund.fund_code, 'name', fund.name_ko,
    'status', fund.status, 'fund_type', fund.fund_type, 'legal_form', fund.legal_form,
    'investment_strategy', fund.investment_strategy, 'inception_date', fund.inception_date,
    'maturity_date', fund.maturity_date, 'effective_from', link.effective_from,
    'effective_to', link.effective_to, 'ownership_ratio', link.ownership_ratio,
    'revision', greatest(fund.revision, link.revision),
    'fund_revision', fund.revision, 'link_revision', link.revision
  )) order by fund.name_ko), '[]'::jsonb) into fund_rows
  from logistics_core.fund_asset_links link
  join logistics_core.funds fund on fund.id = link.fund_id and fund.deleted_at is null
  where link.asset_id = resolved_asset_id and link.deleted_at is null;

  select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
    'beneficiary_key', tranche.beneficiary_key, 'fund_key', fund.fund_key,
    'fund_name', fund.name_ko, 'tranche', tranche.tranche_code,
    'beneficiary_name', tranche.beneficiary_name,
    'agreed_amount_krw', coalesce(tranche.agreed_amount_krw, tranche.committed_amount_krw),
    'contributed_amount_krw', tranche.contributed_amount_krw,
    'revision', tranche.revision
  )) order by fund.name_ko, tranche.tranche_code), '[]'::jsonb) into investment_rows
  from logistics_core.fund_asset_links link
  join logistics_core.funds fund on fund.id = link.fund_id and fund.deleted_at is null
  join logistics_core.fund_beneficiary_tranches tranche
    on tranche.fund_id = fund.id and tranche.source_is_active and tranche.deleted_at is null
  where link.asset_id = resolved_asset_id and link.deleted_at is null;

  select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
    'loan_key', loan.loan_key, 'tranche', loan.tranche_name, 'lender_name', lender.name_ko,
    'committed_amount_krw', loan.commitment_amount, 'drawdown_date', loan.drawdown_date,
    'maturity_date', loan.maturity_date, 'loan_type', loan.loan_type,
    'interest_type', loan.interest_type, 'coupon_rate', loan.coupon_rate,
    'all_in_rate', loan.all_in_rate, 'fee_rate', loan.fee_rate,
    'revision', loan.revision, 'loan_revision', loan.revision,
    'lender_revision', lender.revision
  )) order by loan.tranche_name, lender.name_ko), '[]'::jsonb) into loan_rows
  from logistics_core.loans loan
  left join logistics_core.loan_lenders loan_lender on loan_lender.loan_id = loan.id and loan_lender.deleted_at is null
  left join logistics_core.lenders lender on lender.id = loan_lender.lender_id and lender.deleted_at is null
  where loan.deleted_at is null and (
    loan.asset_id = resolved_asset_id or exists (
      select 1 from logistics_core.fund_asset_links link
      where link.asset_id = resolved_asset_id and link.fund_id = loan.fund_id and link.deleted_at is null
    )
  );

  base_response := jsonb_set(base_response, '{data,asset}', asset_payload, true);
  base_response := jsonb_set(base_response, '{data,funds}', fund_rows, true);
  base_response := jsonb_set(base_response, '{data,investments}', investment_rows, true);
  base_response := jsonb_set(base_response, '{data,loans}', loan_rows, true);
  base_response := jsonb_set(base_response, '{data,write_enabled}', to_jsonb(coalesce((write_status->>'write_enabled')::boolean, false)), true);
  base_response := jsonb_set(base_response, '{data,write_reason}', to_jsonb(write_status->>'write_reason'), true);
  return base_response;
end;
$body$;

-- A home autosave batch may contain several field updates for the same row.
-- Check the caller's starting revision once per logical entity; subsequent
-- fields in the same transaction must compare against that same snapshot,
-- not the revision already advanced by an earlier field in this batch.
create or replace function logistics_core.home_batch_save_entry(
  p_request_id uuid,
  p_asset_key text,
  p_payload jsonb,
  p_expected_revisions jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, logistics_core, public
as $body$
declare
  actor_id uuid := logistics_core.request_actor();
  resolved_asset_id uuid := logistics_core.resolve_asset_id(p_asset_key);
  request_digest text := logistics_core.request_hash('v2/home/batch-save', p_asset_key, p_payload, p_expected_revisions);
  cached_response jsonb;
  operation jsonb;
  entity_name text;
  entity_key text;
  field_name text;
  target_column text;
  target_table regclass;
  entity_id uuid;
  current_revision bigint;
  expected_revision bigint;
  source_key text;
  before_row jsonb;
  after_row jsonb;
  checked_entities text[] := array[]::text[];
  revision_scope text;
  changed_count integer := 0;
  final_revision bigint := 0;
  response jsonb;
begin
  perform logistics_core.assert_v2_writer_route(resolved_asset_id);
  cached_response := logistics_core.claim_idempotency(actor_id, 'v2/home/batch-save', p_request_id, request_digest);
  if cached_response is not null then return cached_response; end if;
  if jsonb_typeof(p_payload->'operations') <> 'array' then
    raise exception using errcode = 'PT422', message = 'HOME_OPERATIONS_ARRAY_REQUIRED';
  end if;
  if jsonb_array_length(p_payload->'operations') > 200 then
    raise exception using errcode = 'PT422', message = 'BATCH_LIMIT_EXCEEDED';
  end if;

  for operation in select value from jsonb_array_elements(p_payload->'operations') loop
    entity_name := nullif(operation->>'entity', '');
    entity_key := nullif(operation->>'entity_key', '');
    field_name := nullif(operation->>'field', '');
    if entity_name is null or entity_key is null or field_name is null then
      raise exception using errcode = 'PT422', message = 'INVALID_HOME_OPERATION';
    end if;
    perform logistics_core.assert_asset_permission(actor_id, resolved_asset_id, 'update');

    if entity_name = 'asset' and field_name = any(array[
      'name','address','asset_code','sector','land_area_sqm','gross_area_sqm','leasable_area_sqm',
      'floor_count','manager_name','manager_team','acquisition_cost','current_valuation','currency_code'
    ]) then
      target_table := 'logistics_core.assets'::regclass;
      target_column := case field_name when 'name' then 'name_ko' when 'address' then 'address_ko' else field_name end;
      select asset.id, asset.revision, asset.public_key, to_jsonb(asset)
      into entity_id, current_revision, source_key, before_row
      from logistics_core.assets asset where asset.asset_key = entity_key and asset.id = resolved_asset_id for update;
    elsif entity_name = 'fund' and field_name = 'ownership_ratio' then
      target_table := 'logistics_core.fund_asset_links'::regclass;
      target_column := 'ownership_ratio';
      select link.id, link.revision, fund.fund_key, to_jsonb(link)
      into entity_id, current_revision, source_key, before_row
      from logistics_core.fund_asset_links link
      join logistics_core.funds fund on fund.id = link.fund_id and fund.deleted_at is null
      where fund.fund_key = entity_key
        and link.asset_id = resolved_asset_id
        and link.deleted_at is null
      for update of link;
    elsif entity_name = 'fund' and field_name = any(array[
      'name','fund_type','legal_form','investment_strategy','inception_date','maturity_date','status'
    ]) then
      target_table := 'logistics_core.funds'::regclass;
      target_column := case when field_name = 'name' then 'name_ko' else field_name end;
      select fund.id, fund.revision, fund.fund_key, to_jsonb(fund)
      into entity_id, current_revision, source_key, before_row
      from logistics_core.funds fund where fund.fund_key = entity_key and exists (
        select 1 from logistics_core.fund_asset_links link where link.fund_id = fund.id and link.asset_id = resolved_asset_id and link.deleted_at is null
      ) for update;
    elsif entity_name = 'beneficiary' and field_name = any(array[
      'tranche','beneficiary_name','agreed_amount_krw','contributed_amount_krw'
    ]) then
      target_table := 'logistics_core.fund_beneficiary_tranches'::regclass;
      target_column := case when field_name = 'tranche' then 'tranche_code' else field_name end;
      select tranche.id, tranche.revision, tranche.source_tranche_id::text, to_jsonb(tranche)
      into entity_id, current_revision, source_key, before_row
      from logistics_core.fund_beneficiary_tranches tranche where tranche.beneficiary_key = entity_key and exists (
        select 1 from logistics_core.fund_asset_links link where link.fund_id = tranche.fund_id and link.asset_id = resolved_asset_id and link.deleted_at is null
      ) for update;
    elsif entity_name = 'loan' and field_name = any(array[
      'tranche','committed_amount_krw','drawdown_date','maturity_date','loan_type','interest_type','coupon_rate','all_in_rate','fee_rate'
    ]) then
      target_table := 'logistics_core.loans'::regclass;
      target_column := case field_name when 'tranche' then 'tranche_name' when 'committed_amount_krw' then 'commitment_amount' else field_name end;
      select loan.id, loan.revision, loan.source_tranche_id::text, to_jsonb(loan)
      into entity_id, current_revision, source_key, before_row
      from logistics_core.loans loan where loan.loan_key = entity_key and (
        loan.asset_id = resolved_asset_id or exists (
          select 1 from logistics_core.fund_asset_links link where link.fund_id = loan.fund_id and link.asset_id = resolved_asset_id and link.deleted_at is null
        )
      ) for update;
    elsif entity_name = 'loan' and field_name = 'lender_name' then
      select lender.id, lender.revision, loan.source_tranche_id::text, to_jsonb(lender)
      into entity_id, current_revision, source_key, before_row
      from logistics_core.loans loan
      join logistics_core.loan_lenders loan_lender on loan_lender.loan_id = loan.id and loan_lender.deleted_at is null
      join logistics_core.lenders lender on lender.id = loan_lender.lender_id and lender.deleted_at is null
      where loan.loan_key = entity_key and (
        loan.asset_id = resolved_asset_id or exists (
          select 1 from logistics_core.fund_asset_links link where link.fund_id = loan.fund_id and link.asset_id = resolved_asset_id and link.deleted_at is null
        )
      ) order by loan_lender.seniority limit 1 for update of lender;
      target_table := 'logistics_core.lenders'::regclass;
      target_column := 'name_ko';
    else
      raise exception using errcode = 'PT422', message = 'HOME_FIELD_NOT_ALLOWED';
    end if;
    if entity_id is null then raise exception using errcode = 'PT404', message = 'NOT_FOUND'; end if;

    revision_scope := case
      when entity_name = 'fund' and field_name = 'ownership_ratio' then 'fund_link:' || entity_key
      when entity_name = 'loan' and field_name = 'lender_name' then 'loan_lender:' || entity_key
      else entity_name || ':' || entity_key
    end;
    expected_revision := coalesce(
      nullif(operation->>'expected_revision', '')::bigint,
      nullif(p_expected_revisions->>revision_scope, '')::bigint,
      nullif(p_expected_revisions->>entity_key, '')::bigint
    );

    if revision_scope <> (entity_name || ':' || entity_key) then
      if not (revision_scope = any (checked_entities)) then
        if expected_revision is not null and expected_revision <> current_revision then
          raise exception using errcode = 'PT409', message = 'REVISION_CONFLICT';
        end if;
        checked_entities := array_append(checked_entities, revision_scope);
      end if;
    elsif not (entity_name || ':' || entity_key = any (checked_entities)) then
      if expected_revision is not null and expected_revision <> current_revision then
        raise exception using errcode = 'PT409', message = 'REVISION_CONFLICT';
      end if;
      checked_entities := array_append(checked_entities, entity_name || ':' || entity_key);
    end if;

    perform logistics_core.set_core_field(target_table, entity_id, target_column, operation->>'value', actor_id);
    execute pg_catalog.format('select to_jsonb(row), revision from %s row where id = $1', target_table)
      into after_row, current_revision using entity_id;

    if entity_name = 'asset' then
      perform logistics_core.set_legacy_field('public.ll_assets'::regclass, 'asset_id', source_key,
        case field_name when 'name' then 'asset_name' when 'address' then 'road_address' else field_name end,
        operation->>'value', jsonb_build_object('request_id', p_request_id));
    elsif entity_name = 'fund' and field_name = 'ownership_ratio' then
      -- No verified legacy ownership-ratio column exists. Keep the value in
      -- normalized core and record it in the append-only audit event below.
      null;
    elsif entity_name = 'fund' then
      perform logistics_core.set_legacy_field('public.ll_funds'::regclass, 'fund_id', source_key,
        case field_name when 'name' then 'fund_name' else field_name end,
        operation->>'value', jsonb_build_object('request_id', p_request_id));
    elsif entity_name = 'beneficiary' then
      perform logistics_core.set_legacy_field('public.ll_fund_capital_tranches'::regclass, 'id', source_key,
        case field_name when 'tranche' then 'tranche' when 'beneficiary_name' then 'party_name' when 'agreed_amount_krw' then 'committed_amount_krw' else field_name end,
        operation->>'value', jsonb_build_object('request_id', p_request_id));
    else
      perform logistics_core.set_legacy_field('public.ll_fund_capital_tranches'::regclass, 'id', source_key,
        case field_name when 'tranche' then 'tranche' when 'lender_name' then 'party_name' when 'committed_amount_krw' then 'committed_amount_krw' when 'coupon_rate' then 'loan_rate' else field_name end,
        operation->>'value', jsonb_build_object('request_id', p_request_id));
    end if;

    insert into logistics_core.audit_events (
      actor_user_id, action, entity_type, entity_id, asset_id, entity_revision,
      before_hash, after_hash, change_payload, reason, client_request_id, mapping_version, correlation_id
    ) values (
      actor_id, 'update', entity_name, entity_id, resolved_asset_id, current_revision,
      logistics_core.json_sha256(before_row), logistics_core.json_sha256(after_row),
      jsonb_build_object('field', field_name), coalesce(nullif(operation->>'reason', ''), '홈 화면 직접 수정'),
      p_request_id, 'gate6-data-platform-3', p_request_id
    );
    changed_count := changed_count + 1;
    final_revision := greatest(final_revision, current_revision);
  end loop;

  response := logistics_core.primary_response(p_request_id, final_revision,
    jsonb_build_object('changed_count', changed_count, 'readback', 'verified'));
  perform logistics_core.complete_idempotency(actor_id, 'v2/home/batch-save', p_request_id, response);
  return response;
end;
$body$;

revoke all on function logistics_core.home_read_entry(uuid, text, jsonb, jsonb)
  from public, anon, authenticated;
revoke all on function logistics_core.home_batch_save_entry(uuid, text, jsonb, jsonb)
  from public, anon, authenticated;

notify pgrst, 'reload schema';

commit;
