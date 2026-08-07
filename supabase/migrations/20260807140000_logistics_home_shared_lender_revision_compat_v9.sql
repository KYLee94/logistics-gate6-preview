-- Gate 6 data platform v9
-- Preserve the public revision key after v8, restore missing lender links only
-- from the official legacy loan source, and make a source-blank no-op explicit.

do $patch_home_shared_lender_revision_compat_v9$
declare
  v_function regprocedure := to_regprocedure(
    'logistics_core.home_batch_save_entry_v5(uuid,text,jsonb,jsonb)'
  );
  v_definition text;
  v_old text := $old_fragment$
    expected_revision := coalesce(
      nullif(operation->>'expected_revision', '')::bigint,
      nullif(p_expected_revisions->>revision_scope, '')::bigint,
      nullif(p_expected_revisions->>entity_key, '')::bigint
    );
$old_fragment$;
  v_new text := $new_fragment$
    expected_revision := coalesce(
      nullif(operation->>'expected_revision', '')::bigint,
      nullif(p_expected_revisions->>revision_scope, '')::bigint,
      -- HOME_SHARED_LENDER_LEGACY_REVISION_KEY_V9: public v5 compatibility.
      case
        when entity_name = 'loan' and field_name = 'lender_name' then
          nullif(p_expected_revisions->>('loan_lender:' || entity_key), '')::bigint
      end,
      nullif(p_expected_revisions->>entity_key, '')::bigint
    );
$new_fragment$;
begin
  if v_function is null then
    raise exception 'HOME_SHARED_LENDER_REVISION_COMPAT_PATCH_FAILED: archived home writer is missing';
  end if;
  v_definition := pg_get_functiondef(v_function);
  if position('HOME_SHARED_LENDER_LEGACY_REVISION_KEY_V9' in v_definition) > 0 then
    return;
  end if;
  if position('HOME_SHARED_LENDER_REVISION_V8' in v_definition) = 0 then
    raise exception 'HOME_SHARED_LENDER_REVISION_COMPAT_PATCH_FAILED: v8 scope patch is missing';
  end if;
  if position(v_old in v_definition) = 0 then
    raise exception 'HOME_SHARED_LENDER_REVISION_COMPAT_PATCH_FAILED: expected revision lookup is missing';
  end if;
  execute replace(v_definition, v_old, v_new);
  v_definition := pg_get_functiondef(v_function);
  if position('HOME_SHARED_LENDER_REVISION_V8' in v_definition) = 0
     or position('HOME_SHARED_LENDER_LEGACY_REVISION_KEY_V9' in v_definition) = 0
     or position(v_old in v_definition) > 0 then
    raise exception 'HOME_SHARED_LENDER_REVISION_COMPAT_PATCH_FAILED: replacement did not persist';
  end if;
end;
$patch_home_shared_lender_revision_compat_v9$;

-- HOME_MISSING_LENDER_CREATE_V9 is a deterministic recovery only. It never
-- creates a lender from an unverified UI value: the source is the existing
-- public.ll_fund_capital_tranches loan row with the same source_tranche_id.
do $backfill_home_missing_lender_v9$
declare
  v_source record;
  v_lender_id uuid;
  v_lender_revision bigint;
  v_lender_key text;
  v_lender_code text;
  v_link_id uuid;
  v_link_revision bigint;
  v_lender_after jsonb;
  v_link_after jsonb;
  v_source_hash text;
begin
  for v_source in
    select
      loan.id as loan_id,
      loan.asset_id,
      loan.source_tranche_id,
      loan.commitment_amount,
      legacy.id as source_id,
      btrim(legacy.party_name) as lender_name,
      to_jsonb(legacy) as source_row
    from logistics_core.loans loan
    join public.ll_fund_capital_tranches legacy
      on legacy.id = loan.source_tranche_id
    where loan.deleted_at is null
      and legacy.tranche_type = 'loan'
      and coalesce(legacy.is_active, true)
      and legacy.deleted_at is null
      and nullif(btrim(legacy.party_name), '') is not null
      and not exists (
        select 1
        from logistics_core.loan_lenders loan_lender
        join logistics_core.lenders lender
          on lender.id = loan_lender.lender_id and lender.deleted_at is null
        where loan_lender.loan_id = loan.id
          and loan_lender.deleted_at is null
      )
    order by loan.id
  loop
    v_lender_key := 'lender_' || substr(md5(lower(v_source.lender_name)), 1, 24);
    v_lender_code := 'L-' || substr(md5(lower(v_source.lender_name)), 1, 12);
    v_lender_id := null;
    select lender.id, lender.revision
    into v_lender_id, v_lender_revision
    from logistics_core.lenders lender
    where lender.deleted_at is null
      and (
        lender.lender_key = v_lender_key
        or lower(btrim(lender.name_ko)) = lower(v_source.lender_name)
      )
    order by (lender.lender_key = v_lender_key) desc, lender.created_at
    limit 1
    for update;

    if v_lender_id is null then
      insert into logistics_core.lenders (
        lender_key, lender_code, name_ko, deleted_at, deleted_by
      ) values (
        v_lender_key, v_lender_code, v_source.lender_name, null, null
      )
      on conflict (lender_key) do update
      set name_ko = excluded.name_ko,
          deleted_at = null,
          deleted_by = null
      returning id, revision into v_lender_id, v_lender_revision;
    end if;

    insert into logistics_core.loan_lenders (
      loan_lender_key, loan_id, lender_id, seniority, commitment_amount,
      deleted_at, deleted_by
    ) values (
      'loan_lender_' || v_source.source_tranche_id::text,
      v_source.loan_id,
      v_lender_id,
      1,
      v_source.commitment_amount,
      null,
      null
    )
    on conflict (loan_lender_key) do update
    set loan_id = excluded.loan_id,
        lender_id = excluded.lender_id,
        seniority = excluded.seniority,
        commitment_amount = excluded.commitment_amount,
        deleted_at = null,
        deleted_by = null
    returning id, revision into v_link_id, v_link_revision;

    select to_jsonb(lender) into v_lender_after
    from logistics_core.lenders lender where lender.id = v_lender_id;
    select to_jsonb(loan_lender) into v_link_after
    from logistics_core.loan_lenders loan_lender where loan_lender.id = v_link_id;
    v_source_hash := logistics_core.json_sha256(v_source.source_row);

    if not exists (
      select 1
      from logistics_core.audit_events event
      where event.entity_type = 'loan_lender'
        and event.entity_id = v_link_id
        and event.mapping_version = 'gate6-data-platform-9'
        and event.change_payload->>'source_id' = v_source.source_id::text
    ) then
      insert into logistics_core.audit_events (
        actor_user_id, action, entity_type, entity_id, asset_id, entity_revision,
        before_hash, after_hash, change_payload, reason, client_request_id,
        mapping_version, correlation_id
      ) values (
        null,
        'backfill',
        'loan_lender',
        v_link_id,
        v_source.asset_id,
        v_link_revision,
        null,
        logistics_core.json_sha256(jsonb_build_object(
          'lender', v_lender_after,
          'loan_lender', v_link_after
        )),
        jsonb_build_object(
          'legacy_table', 'public.ll_fund_capital_tranches',
          'source_id', v_source.source_id,
          'source_hash', v_source_hash,
          'lender_key', v_lender_key,
          'source_field', 'party_name'
        ),
        '기존 대출 원천의 대주 연결 복구',
        null,
        'gate6-data-platform-9',
        gen_random_uuid()
      );
    end if;
  end loop;

  if exists (
    select 1
    from logistics_core.loans loan
    join public.ll_fund_capital_tranches legacy
      on legacy.id = loan.source_tranche_id
    where loan.deleted_at is null
      and legacy.tranche_type = 'loan'
      and coalesce(legacy.is_active, true)
      and legacy.deleted_at is null
      and nullif(btrim(legacy.party_name), '') is not null
      and not exists (
        select 1
        from logistics_core.loan_lenders loan_lender
        join logistics_core.lenders lender
          on lender.id = loan_lender.lender_id and lender.deleted_at is null
        where loan_lender.loan_id = loan.id
          and loan_lender.deleted_at is null
      )
  ) then
    raise exception 'HOME_MISSING_LENDER_READBACK_MISMATCH';
  end if;
end;
$backfill_home_missing_lender_v9$;

-- A legacy source with no lender name provides no authorized identity for a
-- new lender. Empty-to-empty is a no-op; a non-empty input is rejected until a
-- verified lender-link creation contract is approved.
do $patch_home_missing_lender_guard_v9$
declare
  v_function regprocedure := to_regprocedure(
    'logistics_core.home_batch_save_entry_v5(uuid,text,jsonb,jsonb)'
  );
  v_definition text;
  v_old text := $old_fragment$
      ) order by loan_lender.seniority limit 1 for update of lender;
      target_table := 'logistics_core.lenders'::regclass;
      target_column := 'name_ko';
$old_fragment$;
  v_new text := $new_fragment$
      ) order by loan_lender.seniority limit 1 for update of lender;
      if entity_id is null then
        if nullif(btrim(operation->>'value'), '') is null then
          -- HOME_MISSING_LENDER_BLANK_NOOP_V9
          continue;
        end if;
        raise exception using errcode = 'PT422', message = 'LENDER_LINK_REQUIRED';
      end if;
      target_table := 'logistics_core.lenders'::regclass;
      target_column := 'name_ko';
$new_fragment$;
begin
  if v_function is null then
    raise exception 'HOME_MISSING_LENDER_GUARD_PATCH_FAILED: archived home writer is missing';
  end if;
  v_definition := pg_get_functiondef(v_function);
  if position('HOME_MISSING_LENDER_BLANK_NOOP_V9' in v_definition) > 0 then
    return;
  end if;
  if position('HOME_SHARED_LENDER_REVISION_V8' in v_definition) = 0
     or position('HOME_SHARED_LENDER_LEGACY_REVISION_KEY_V9' in v_definition) = 0 then
    raise exception 'HOME_MISSING_LENDER_GUARD_PATCH_FAILED: revision prerequisites are missing';
  end if;
  if position(v_old in v_definition) = 0 then
    raise exception 'HOME_MISSING_LENDER_GUARD_PATCH_FAILED: lender writer fragment is missing';
  end if;
  execute replace(v_definition, v_old, v_new);
  v_definition := pg_get_functiondef(v_function);
  if position('HOME_MISSING_LENDER_BLANK_NOOP_V9' in v_definition) = 0
     or position('LENDER_LINK_REQUIRED' in v_definition) = 0
     or position(v_old in v_definition) > 0 then
    raise exception 'HOME_MISSING_LENDER_GUARD_PATCH_FAILED: replacement did not persist';
  end if;
end;
$patch_home_missing_lender_guard_v9$;

revoke all on function logistics_core.home_batch_save_entry_v5(uuid, text, jsonb, jsonb)
  from public, anon, authenticated;
