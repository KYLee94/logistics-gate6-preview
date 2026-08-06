-- Gate 6 maturity read model: human-readable counterparties and type-specific detail.
-- Internal UUIDs and source keys are never used as visible names.

update logistics_core.maturities maturity
set target_name_ko = tenant.legal_name_ko,
    updated_at = now()
from logistics_core.lease_contracts contract
join logistics_core.tenants tenant on tenant.id = contract.tenant_id
where maturity.lease_contract_id = contract.id
  and maturity.maturity_type = 'lease'
  and tenant.deleted_at is null
  and nullif(btrim(tenant.legal_name_ko), '') is not null
  and tenant.legal_name_ko !~* '^[0-9a-f]{8}-[0-9a-f-]{27,}$'
  and tenant.legal_name_ko !~* '^(tenant|lease|contract|maturity)[_-]'
  and tenant.legal_name_ko is distinct from tenant.tenant_key
  and tenant.legal_name_ko is distinct from tenant.tenant_code
  and maturity.target_name_ko is distinct from tenant.legal_name_ko;

create or replace function logistics_core.maturities_read_entry(
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
  actor_email text;
  legacy_asset_id text;
  from_date date := coalesce(nullif(p_payload->>'from_date', '')::date, current_date);
  to_date date := coalesce(nullif(p_payload->>'to_date', '')::date, current_date + 365);
  rows jsonb;
  alerts jsonb;
  latest_revision bigint;
begin
  perform logistics_core.assert_asset_permission(actor_id, resolved_asset_id, 'read');
  if from_date > to_date then
    raise exception using errcode = 'PT422', message = 'INVALID_DATE_RANGE';
  end if;

  select email into actor_email from auth.users where id = actor_id;
  select asset.public_key into legacy_asset_id
  from logistics_core.assets asset
  where asset.id = resolved_asset_id;

  insert into public.ll_notifications (
    notification_type, dedupe_key, asset_id, title, body, due_date, lead_days,
    recipient_user_id, recipient_email, delivery_status, notified_at
  )
  select
    case when maturity.maturity_type = 'loan' then 'loan_maturity'
         when maturity.maturity_type = 'lease' then 'lease_maturity'
         else 'data_update' end,
    'v2:maturity:' || maturity.maturity_key || ':' || maturity.revision::text || ':' ||
      (case
        when maturity.official_date - current_date <= 0 then 0
        when maturity.official_date - current_date <= 1 then 1
        when maturity.official_date - current_date <= 3 then 3
        when maturity.official_date - current_date <= 7 then 7
        else 30
      end)::text || ':' || actor_id::text,
    legacy_asset_id,
    case when maturity.maturity_type = 'loan' then '대출 만기'
         when maturity.maturity_type = 'lease' then '임대차 만기'
         else '펀드 만기' end,
    (case
      when maturity.maturity_type = 'lease' then
        case
          when nullif(btrim(tenant.legal_name_ko), '') is not null
            and tenant.legal_name_ko !~* '^[0-9a-f]{8}-[0-9a-f-]{27,}$'
            and tenant.legal_name_ko !~* '^(tenant|lease|contract|maturity)[_-]'
            and tenant.legal_name_ko is distinct from tenant.tenant_key
            and tenant.legal_name_ko is distinct from tenant.tenant_code
          then tenant.legal_name_ko else '임차인 정보 확인 필요' end
      when maturity.maturity_type = 'fund' then coalesce(nullif(btrim(fund.name_ko), ''), '펀드 정보 확인 필요')
      when maturity.maturity_type = 'loan' then coalesce(nullif(btrim(loan.tranche_name), ''), nullif(btrim(loan.name_ko), ''), loan_party.first_lender, '대출 정보 확인 필요')
      else '만기 정보 확인 필요'
    end) || ' 만기일은 ' || maturity.official_date::text || '입니다.',
    maturity.official_date,
    case
      when maturity.official_date - current_date <= 0 then 0
      when maturity.official_date - current_date <= 1 then 1
      when maturity.official_date - current_date <= 3 then 3
      when maturity.official_date - current_date <= 7 then 7
      else 30
    end,
    actor_id,
    actor_email,
    'unread',
    now()
  from logistics_core.maturities maturity
  left join logistics_core.lease_contracts contract on contract.id = maturity.lease_contract_id and contract.deleted_at is null
  left join logistics_core.tenants tenant on tenant.id = contract.tenant_id and tenant.deleted_at is null
  left join logistics_core.funds fund on fund.id = maturity.fund_id and fund.deleted_at is null
  left join logistics_core.loans loan on loan.id = maturity.loan_id and loan.deleted_at is null
  left join lateral (
    select min(lender_name) as first_lender
    from (
      select lender.name_ko as lender_name
      from logistics_core.loan_lenders loan_lender
      join logistics_core.lenders lender on lender.id = loan_lender.lender_id and lender.deleted_at is null
      where loan_lender.loan_id = loan.id and loan_lender.deleted_at is null
        and nullif(btrim(lender.name_ko), '') is not null
        and lender.name_ko !~* '^[0-9a-f]{8}-[0-9a-f-]{27,}$'
        and lender.name_ko !~* '^(lender|loan)[_-]'
      order by loan_lender.seniority, lender.name_ko
      limit 1
    ) names
  ) loan_party on true
  where maturity.deleted_at is null
    and maturity.status = 'active'
    and maturity.official_date between current_date and current_date + 30
    and (
      maturity.asset_id = resolved_asset_id
      or exists (
        select 1 from logistics_core.maturity_asset_scopes scope
        where scope.maturity_id = maturity.id
          and scope.asset_id = resolved_asset_id
          and scope.retired_at is null
      )
    )
  on conflict (dedupe_key) do update set
    title = excluded.title,
    body = excluded.body,
    due_date = excluded.due_date,
    recipient_email = excluded.recipient_email;

  select coalesce(jsonb_agg(
    jsonb_strip_nulls(jsonb_build_object(
      'maturity_key', maturity.maturity_key,
      'type', maturity.maturity_type,
      'target_name', case
        when maturity.maturity_type = 'lease' then
          case
            when nullif(btrim(tenant.legal_name_ko), '') is not null
              and tenant.legal_name_ko !~* '^[0-9a-f]{8}-[0-9a-f-]{27,}$'
              and tenant.legal_name_ko !~* '^(tenant|lease|contract|maturity)[_-]'
              and tenant.legal_name_ko is distinct from tenant.tenant_key
              and tenant.legal_name_ko is distinct from tenant.tenant_code
            then tenant.legal_name_ko else '임차인 정보 확인 필요' end
        when maturity.maturity_type = 'fund' then coalesce(nullif(btrim(fund.name_ko), ''), '펀드 정보 확인 필요')
        when maturity.maturity_type = 'loan' then coalesce(nullif(btrim(loan.tranche_name), ''), nullif(btrim(loan.name_ko), ''), loan_party.first_lender, '대출 정보 확인 필요')
        else '만기 정보 확인 필요' end,
      'display_name', case
        when maturity.maturity_type = 'lease' then
          case
            when nullif(btrim(tenant.legal_name_ko), '') is not null
              and tenant.legal_name_ko !~* '^[0-9a-f]{8}-[0-9a-f-]{27,}$'
              and tenant.legal_name_ko !~* '^(tenant|lease|contract|maturity)[_-]'
              and tenant.legal_name_ko is distinct from tenant.tenant_key
              and tenant.legal_name_ko is distinct from tenant.tenant_code
            then tenant.legal_name_ko else '임차인 정보 확인 필요' end
        when maturity.maturity_type = 'fund' then coalesce(nullif(btrim(fund.name_ko), ''), '펀드 정보 확인 필요')
        when maturity.maturity_type = 'loan' then coalesce(nullif(btrim(loan.tranche_name), ''), nullif(btrim(loan.name_ko), ''), loan_party.first_lender, '대출 정보 확인 필요')
        else '만기 정보 확인 필요' end,
      'official_date', maturity.official_date,
      'days_remaining', maturity.official_date - current_date,
      'status', maturity.status,
      'revision', maturity.revision,
      'tenant_name', case when maturity.maturity_type = 'lease' then
        case
          when nullif(btrim(tenant.legal_name_ko), '') is not null
            and tenant.legal_name_ko !~* '^[0-9a-f]{8}-[0-9a-f-]{27,}$'
            and tenant.legal_name_ko !~* '^(tenant|lease|contract|maturity)[_-]'
            and tenant.legal_name_ko is distinct from tenant.tenant_key
            and tenant.legal_name_ko is distinct from tenant.tenant_code
          then tenant.legal_name_ko else '임차인 정보 확인 필요' end end,
      'commencement_date', contract.commencement_date,
      'deposit_amount', contract.deposit_amount,
      'renewal_terms', contract.renewal_terms,
      'termination_terms', contract.termination_terms,
      'restoration_terms', contract.restoration_terms,
      'floor_labels', lease_summary.floor_labels,
      'zone_labels', lease_summary.zone_labels,
      'leased_area_sqm', lease_summary.leased_area_sqm,
      'monthly_rent_total_krw', lease_summary.monthly_rent_total_krw,
      'monthly_cam_total_krw', lease_summary.monthly_cam_total_krw,
      'fund_name', coalesce(fund.name_ko, loan_fund.name_ko),
      'inception_date', fund.inception_date,
      'fund_type', fund.fund_type,
      'investment_strategy', fund.investment_strategy,
      'ownership_ratio', fund_link.ownership_ratio,
      'fund_status', fund.status,
      'lender_names', loan_party.lender_names,
      'tranche_name', coalesce(loan.tranche_name, loan.name_ko),
      'loan_name', loan.name_ko,
      'drawdown_date', loan.drawdown_date,
      'commitment_amount', loan.commitment_amount,
      'outstanding_amount', loan.outstanding_amount,
      'loan_type', loan.loan_type,
      'interest_type', loan.interest_type,
      'coupon_rate', loan.coupon_rate,
      'all_in_rate', loan.all_in_rate,
      'fee_rate', loan.fee_rate
    )) order by maturity.official_date, maturity.maturity_key
  ), '[]'::jsonb), coalesce(max(maturity.revision), 0)
  into rows, latest_revision
  from logistics_core.maturities maturity
  left join logistics_core.lease_contracts contract on contract.id = maturity.lease_contract_id and contract.deleted_at is null
  left join logistics_core.tenants tenant on tenant.id = contract.tenant_id and tenant.deleted_at is null
  left join logistics_core.funds fund on fund.id = maturity.fund_id and fund.deleted_at is null
  left join logistics_core.loans loan on loan.id = maturity.loan_id and loan.deleted_at is null
  left join logistics_core.funds loan_fund on loan_fund.id = loan.fund_id and loan_fund.deleted_at is null
  left join lateral (
    select link.ownership_ratio
    from logistics_core.fund_asset_links link
    where link.fund_id = fund.id and link.asset_id = resolved_asset_id and link.deleted_at is null
    order by link.updated_at desc
    limit 1
  ) fund_link on true
  left join lateral (
    select
      string_agg(distinct space.floor_label, ', ') filter (where nullif(btrim(space.floor_label), '') is not null) as floor_labels,
      string_agg(distinct space.zone_label, ', ') filter (where nullif(btrim(space.zone_label), '') is not null) as zone_labels,
      sum(coalesce(allocation.allocated_leasable_area_sqm, space.leased_area_sqm)) as leased_area_sqm,
      sum(latest_term.base_monthly_rent) as monthly_rent_total_krw,
      sum(latest_term.base_monthly_management_fee) as monthly_cam_total_krw
    from logistics_core.contract_spaces allocation
    join logistics_core.spaces space on space.id = allocation.space_id and space.deleted_at is null
    left join lateral (
      select term.base_monthly_rent, term.base_monthly_management_fee
      from logistics_core.rent_terms term
      where term.contract_space_id = allocation.id and term.deleted_at is null
      order by term.effective_from_month desc nulls last, term.updated_at desc
      limit 1
    ) latest_term on true
    where allocation.contract_id = contract.id and allocation.deleted_at is null
  ) lease_summary on true
  left join lateral (
    select
      coalesce(jsonb_agg(names.lender_name order by names.seniority, names.lender_name), '[]'::jsonb) as lender_names,
      min(names.lender_name) as first_lender
    from (
      select distinct on (lender.id)
        lender.name_ko as lender_name,
        loan_lender.seniority
      from logistics_core.loan_lenders loan_lender
      join logistics_core.lenders lender on lender.id = loan_lender.lender_id and lender.deleted_at is null
      where loan_lender.loan_id = loan.id and loan_lender.deleted_at is null
        and nullif(btrim(lender.name_ko), '') is not null
        and lender.name_ko !~* '^[0-9a-f]{8}-[0-9a-f-]{27,}$'
        and lender.name_ko !~* '^(lender|loan)[_-]'
      order by lender.id, loan_lender.seniority, lender.name_ko
    ) names
  ) loan_party on true
  where (
      maturity.asset_id = resolved_asset_id
      or exists (
        select 1 from logistics_core.maturity_asset_scopes scope
        where scope.maturity_id = maturity.id
          and scope.asset_id = resolved_asset_id
          and scope.retired_at is null
      )
    )
    and maturity.official_date between from_date and to_date
    and maturity.deleted_at is null;

  select coalesce(jsonb_agg(jsonb_build_object(
    'notification_id', notification.notification_id,
    'type', notification.notification_type,
    'title', notification.title,
    'body', notification.body,
    'due_date', notification.due_date,
    'lead_days', notification.lead_days,
    'status', notification.delivery_status,
    'read_at', notification.read_at,
    'dismissed_at', notification.dismissed_at
  ) order by notification.due_date, notification.notification_id), '[]'::jsonb)
  into alerts
  from public.ll_notifications notification
  where notification.recipient_user_id = actor_id
    and notification.asset_id = legacy_asset_id
    and notification.delivery_status <> 'dismissed';

  return logistics_core.primary_response(
    p_request_id,
    latest_revision,
    jsonb_build_object(
      'from_date', from_date,
      'to_date', to_date,
      'maturities', rows,
      'in_app_alerts', alerts,
      'delivery_channel', 'in_app_only'
    )
  );
end;
$body$;
