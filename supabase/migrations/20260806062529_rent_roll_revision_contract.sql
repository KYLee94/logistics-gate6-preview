-- Keep the optimistic-lock contract identical between rent-roll read and save.
-- The legacy implementation returned the greatest related revision but compared
-- that number only with spaces.revision, which caused valid first edits to fail.

do $migration$
begin
  if to_regprocedure('logistics_core.rent_roll_read_entry_v4(uuid,text,jsonb,jsonb)') is null then
    execute 'alter function logistics_core.rent_roll_read_entry(uuid, text, jsonb, jsonb) rename to rent_roll_read_entry_v4';
  end if;
  if to_regprocedure('logistics_core.rent_roll_batch_save_entry_v4(uuid,text,jsonb,jsonb)') is null then
    execute 'alter function logistics_core.rent_roll_batch_save_entry(uuid, text, jsonb, jsonb) rename to rent_roll_batch_save_entry_v4';
  end if;
end;
$migration$;

create or replace function logistics_core.rent_roll_read_entry(
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
  revision_rows jsonb;
begin
  base_response := logistics_core.rent_roll_read_entry_v4(
    p_request_id,
    p_asset_key,
    p_payload,
    p_expected_revisions
  );

  select coalesce(jsonb_agg(
    row_item.value || jsonb_build_object(
      'space_revision', space.revision,
      'contract_revision', contract.revision,
      'allocation_revision', allocation.revision,
      'rent_term_revision', term.revision,
      'revision', greatest(
        coalesce(space.revision, 0),
        coalesce(contract.revision, 0),
        coalesce(allocation.revision, 0),
        coalesce(term.revision, 0)
      )
    ) order by row_item.ordinality
  ), '[]'::jsonb)
  into revision_rows
  from jsonb_array_elements(coalesce(base_response #> '{data,rows}', '[]'::jsonb))
    with ordinality row_item(value, ordinality)
  left join logistics_core.spaces space
    on space.space_key = row_item.value->>'space_key'
   and space.deleted_at is null
  left join logistics_core.contract_spaces allocation
    on allocation.contract_space_key = row_item.value->>'contract_space_key'
   and allocation.deleted_at is null
  left join logistics_core.lease_contracts contract
    on contract.contract_key = row_item.value->>'contract_key'
   and contract.deleted_at is null
  left join logistics_core.rent_terms term
    on term.rent_term_key = row_item.value->>'rent_term_key'
   and term.deleted_at is null;

  return jsonb_set(base_response, '{data,rows}', revision_rows, true);
end;
$body$;

create or replace function logistics_core.rent_roll_batch_save_entry(
  p_request_id uuid,
  p_asset_key text,
  p_payload jsonb,
  p_expected_revisions jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, logistics_core
as $body$
declare
  actor_id uuid := logistics_core.request_actor();
  resolved_asset_id uuid := logistics_core.resolve_asset_id(p_asset_key);
  transformed_payload jsonb := p_payload;
  row_record jsonb;
  operation_record jsonb;
  row_index integer := 0;
  operation_name text;
  permission_operation text;
  v_space_key text;
  v_contract_key text;
  v_allocation_key text;
  v_term_key text;
  v_space_id uuid;
  v_contract_id uuid;
  v_allocation_id uuid;
  v_space_revision bigint;
  v_contract_revision bigint;
  v_allocation_revision bigint;
  v_rent_term_revision bigint;
  expected_revision bigint;
  v_expected_space_revision bigint;
  request_digest text;
  existing_request logistics_core.api_idempotency_keys%rowtype;
  base_response jsonb;
  final_response jsonb;
  latest_revision bigint;
begin
  -- SECURITY DEFINER must authenticate and authorize before taking any lock.
  perform logistics_core.assert_v2_writer_route(resolved_asset_id);
  perform logistics_core.assert_asset_permission(actor_id, resolved_asset_id, 'read');

  -- Preflight every row permission, including the distinct delete capability.
  if jsonb_typeof(p_payload->'rows') = 'array' then
    for row_record in select value from jsonb_array_elements(p_payload->'rows') loop
      operation_name := coalesce(nullif(row_record->>'operation', ''), 'update');
      v_space_key := coalesce(nullif(row_record->>'space_key', ''), nullif(row_record->>'row_key', ''));
      if operation_name not in ('create', 'update', 'delete') then
        raise exception using errcode = 'PT422', message = 'INVALID_RENT_ROLL_OPERATION';
      end if;
      if v_space_key is null then
        raise exception using errcode = 'PT422', message = 'ROW_KEY_REQUIRED';
      end if;

      if operation_name = 'delete' then
        permission_operation := 'delete';
      elsif exists (
        select 1 from logistics_core.spaces space
        where space.asset_id = resolved_asset_id and space.space_key = v_space_key
      ) then
        permission_operation := 'update';
      else
        permission_operation := 'create';
      end if;
      perform logistics_core.assert_asset_permission(actor_id, resolved_asset_id, permission_operation);

      -- The legacy v1 writer hashes the transformed payload. Inject only the
      -- client-supplied space token so an idempotent retry hashes identically.
      if row_record ? 'space_revision'
         and nullif(row_record->>'space_revision', '') is not null then
        row_record := jsonb_set(
          row_record,
          '{expected_revision}',
          to_jsonb((row_record->>'space_revision')::bigint),
          true
        );
        transformed_payload := jsonb_set(
          transformed_payload,
          array['rows', row_index::text],
          row_record,
          true
        );
      end if;
      row_index := row_index + 1;
    end loop;
  end if;

  -- The alternate operations contract must not acquire the asset lock before
  -- its exact create/update/delete permission has been checked either.
  if jsonb_typeof(p_payload->'operations') = 'array' then
    for operation_record in select value from jsonb_array_elements(p_payload->'operations') loop
      operation_name := nullif(operation_record->>'operation', '');
      if nullif(operation_record->>'entity', '') not in ('contract', 'space', 'rent_term')
         or operation_name not in ('create', 'update', 'delete')
         or nullif(operation_record->>'entity_key', '') is null then
        raise exception using errcode = 'PT422', message = 'INVALID_RENT_ROLL_OPERATION';
      end if;
      permission_operation := operation_name;
      perform logistics_core.assert_asset_permission(actor_id, resolved_asset_id, permission_operation);
    end loop;
  end if;

  -- All rent-roll writers for one asset serialize on the same row. This fixed
  -- first lock prevents payload-order deadlocks between shared contracts.
  perform 1
  from logistics_core.assets asset
  where asset.id = resolved_asset_id
  for update;

  -- A retry with the same request id must return the stored result before stale
  -- component tokens are compared. The hash matches the v1 transformed input.
  request_digest := logistics_core.request_hash(
    'v2/rent-roll/batch-save', p_asset_key, transformed_payload, p_expected_revisions
  );
  select request.*
  into existing_request
  from logistics_core.api_idempotency_keys request
  where request.actor_user_id = actor_id
    and request.action = 'v2/rent-roll/batch-save'
    and request.client_request_id = p_request_id
  for update;
  if existing_request.id is not null then
    if existing_request.request_hash <> request_digest then
      raise exception using errcode = 'PT409', message = 'IDEMPOTENCY_CONFLICT';
    end if;
    if existing_request.status = 'completed' and existing_request.response is not null then
      return existing_request.response;
    end if;
    raise exception using errcode = 'PT409', message = 'IDEMPOTENT_REQUEST_IN_PROGRESS';
  end if;

  row_index := 0;
  if jsonb_typeof(transformed_payload->'rows') = 'array' then
    for row_record in select value from jsonb_array_elements(transformed_payload->'rows') loop
      operation_name := coalesce(nullif(row_record->>'operation', ''), 'update');
      v_space_key := coalesce(nullif(row_record->>'space_key', ''), nullif(row_record->>'row_key', ''));
      v_contract_key := nullif(row_record->>'contract_key', '');
      v_allocation_key := coalesce(
        nullif(row_record->>'contract_space_key', ''),
        case when v_contract_key is not null then v_contract_key || ':' || v_space_key end
      );
      v_term_key := coalesce(
        nullif(row_record->>'rent_term_key', ''),
        case when v_allocation_key is not null then v_allocation_key || ':current' end
      );

      v_space_id := null;
      v_contract_id := null;
      v_allocation_id := null;
      v_space_revision := null;
      v_contract_revision := null;
      v_allocation_revision := null;
      v_rent_term_revision := null;

      select space.id, space.revision
      into v_space_id, v_space_revision
      from logistics_core.spaces space
      where space.asset_id = resolved_asset_id
        and space.space_key = v_space_key
      for update;

      if v_space_id is null and exists (
        select 1 from logistics_core.spaces space where space.space_key = v_space_key
      ) then
        raise exception using errcode = 'PT403', message = 'CROSS_ASSET_COMPONENT_KEY';
      end if;

      select contract.id, contract.revision
      into v_contract_id, v_contract_revision
      from logistics_core.lease_contracts contract
      where contract.asset_id = resolved_asset_id
        and contract.contract_key = v_contract_key
      for update;

      if v_contract_id is null and v_contract_key is not null and exists (
        select 1 from logistics_core.lease_contracts contract where contract.contract_key = v_contract_key
      ) then
        raise exception using errcode = 'PT403', message = 'CROSS_ASSET_COMPONENT_KEY';
      end if;

      select allocation.id, allocation.revision
      into v_allocation_id, v_allocation_revision
      from logistics_core.contract_spaces allocation
      where allocation.contract_space_key = v_allocation_key
        and allocation.space_id = v_space_id
        and (
          (v_contract_key is null and v_contract_id is null)
          or allocation.contract_id = v_contract_id
        )
      for update;

      if v_allocation_id is null and v_allocation_key is not null and exists (
        select 1 from logistics_core.contract_spaces allocation
        where allocation.contract_space_key = v_allocation_key
      ) then
        if exists (
          select 1
          from logistics_core.contract_spaces allocation
          join logistics_core.spaces space on space.id = allocation.space_id
          where allocation.contract_space_key = v_allocation_key
            and space.asset_id <> resolved_asset_id
        ) then
          raise exception using errcode = 'PT403', message = 'CROSS_ASSET_COMPONENT_KEY';
        end if;
        raise exception using errcode = 'PT422', message = 'RENT_ROLL_COMPONENT_SCOPE_MISMATCH';
      end if;

      select term.revision
      into v_rent_term_revision
      from logistics_core.rent_terms term
      where term.rent_term_key = v_term_key
        and term.contract_space_id = v_allocation_id
      for update;

      if v_rent_term_revision is null and v_term_key is not null and exists (
        select 1 from logistics_core.rent_terms term where term.rent_term_key = v_term_key
      ) then
        if exists (
          select 1
          from logistics_core.rent_terms term
          join logistics_core.contract_spaces allocation on allocation.id = term.contract_space_id
          join logistics_core.spaces space on space.id = allocation.space_id
          where term.rent_term_key = v_term_key
            and space.asset_id <> resolved_asset_id
        ) then
          raise exception using errcode = 'PT403', message = 'CROSS_ASSET_COMPONENT_KEY';
        end if;
        raise exception using errcode = 'PT422', message = 'RENT_ROLL_COMPONENT_SCOPE_MISMATCH';
      end if;

      if operation_name = 'delete' then
        if coalesce(nullif(row_record->>'occupancy_status', ''), 'occupied') = 'vacant' then
          if v_contract_key is not null or v_allocation_key is not null or v_term_key is not null then
            raise exception using errcode = 'PT422', message = 'RENT_ROLL_COMPONENT_SCOPE_MISMATCH';
          end if;
        elsif v_contract_id is null or v_allocation_id is null or v_rent_term_revision is null then
          raise exception using errcode = 'PT422', message = 'RENT_ROLL_COMPONENT_SCOPE_MISMATCH';
        end if;
      end if;

      if v_space_revision is not null then
        if not (row_record ? 'space_revision')
           or not (row_record ? 'contract_revision')
           or not (row_record ? 'allocation_revision')
           or not (row_record ? 'rent_term_revision') then
          raise exception using errcode = 'PT409', message = 'REVISION_CONFLICT:COMPONENT_REVISIONS_REQUIRED';
        end if;

        v_expected_space_revision := nullif(row_record->>'space_revision', '')::bigint;
        if v_expected_space_revision is distinct from v_space_revision then
          raise exception using errcode = 'PT409', message = 'REVISION_CONFLICT';
        end if;
        expected_revision := nullif(row_record->>'contract_revision', '')::bigint;
        if expected_revision is distinct from v_contract_revision then
          raise exception using errcode = 'PT409', message = 'REVISION_CONFLICT';
        end if;
        expected_revision := nullif(row_record->>'allocation_revision', '')::bigint;
        if expected_revision is distinct from v_allocation_revision then
          raise exception using errcode = 'PT409', message = 'REVISION_CONFLICT';
        end if;
        expected_revision := nullif(row_record->>'rent_term_revision', '')::bigint;
        if expected_revision is distinct from v_rent_term_revision then
          raise exception using errcode = 'PT409', message = 'REVISION_CONFLICT';
        end if;

        -- The v1 writer owns spaces.revision checking. Preserve the exact
        -- client token rather than replacing it with a newly-read revision.
        row_record := jsonb_set(row_record, '{expected_revision}', to_jsonb(v_expected_space_revision), true);
        transformed_payload := jsonb_set(
          transformed_payload,
          array['rows', row_index::text],
          row_record,
          true
        );
      elsif operation_name <> 'create' then
        raise exception using errcode = 'PT404', message = 'NOT_FOUND';
      elsif v_contract_revision is not null then
        if not (row_record ? 'contract_revision') then
          raise exception using errcode = 'PT409', message = 'REVISION_CONFLICT:COMPONENT_REVISIONS_REQUIRED';
        end if;
        expected_revision := nullif(row_record->>'contract_revision', '')::bigint;
        if expected_revision is distinct from v_contract_revision then
          raise exception using errcode = 'PT409', message = 'REVISION_CONFLICT';
        end if;
      end if;
      row_index := row_index + 1;
    end loop;
  end if;

  base_response := logistics_core.rent_roll_batch_save_entry_v4(
    p_request_id,
    p_asset_key,
    transformed_payload,
    p_expected_revisions
  );

  -- The legacy writer uses globally unique keys. Recheck the committed graph
  -- inside the same transaction so a cross-asset conflict race rolls back.
  if jsonb_typeof(transformed_payload->'rows') = 'array' then
    for row_record in select value from jsonb_array_elements(transformed_payload->'rows') loop
      operation_name := coalesce(nullif(row_record->>'operation', ''), 'update');
      if operation_name <> 'delete' then
        v_space_key := coalesce(nullif(row_record->>'space_key', ''), nullif(row_record->>'row_key', ''));
        v_contract_key := nullif(row_record->>'contract_key', '');
        v_allocation_key := coalesce(
          nullif(row_record->>'contract_space_key', ''),
          case when v_contract_key is not null then v_contract_key || ':' || v_space_key end
        );
        v_term_key := coalesce(
          nullif(row_record->>'rent_term_key', ''),
          case when v_allocation_key is not null then v_allocation_key || ':current' end
        );

        if coalesce(nullif(row_record->>'occupancy_status', ''), 'occupied') = 'vacant' then
          if not exists (
            select 1 from logistics_core.spaces space
            where space.asset_id = resolved_asset_id
              and space.space_key = v_space_key
              and space.deleted_at is null
          ) then
            raise exception using errcode = 'PT422', message = 'RENT_ROLL_COMPONENT_SCOPE_MISMATCH';
          end if;
        elsif not exists (
          select 1
          from logistics_core.spaces space
          join logistics_core.contract_spaces allocation
            on allocation.space_id = space.id
           and allocation.contract_space_key = v_allocation_key
           and allocation.deleted_at is null
          join logistics_core.lease_contracts contract
            on contract.id = allocation.contract_id
           and contract.asset_id = resolved_asset_id
           and contract.contract_key = v_contract_key
           and contract.deleted_at is null
          join logistics_core.rent_terms term
            on term.contract_space_id = allocation.id
           and term.rent_term_key = v_term_key
           and term.deleted_at is null
          where space.asset_id = resolved_asset_id
            and space.space_key = v_space_key
            and space.deleted_at is null
        ) then
          raise exception using errcode = 'PT422', message = 'RENT_ROLL_COMPONENT_SCOPE_MISMATCH';
        end if;
      end if;
    end loop;
  end if;

  select greatest(
    coalesce((select max(space.revision) from logistics_core.spaces space where space.asset_id = resolved_asset_id), 0),
    coalesce((select max(contract.revision) from logistics_core.lease_contracts contract where contract.asset_id = resolved_asset_id), 0),
    coalesce((select max(allocation.revision)
      from logistics_core.contract_spaces allocation
      join logistics_core.spaces space on space.id = allocation.space_id
      where space.asset_id = resolved_asset_id), 0),
    coalesce((select max(term.revision)
      from logistics_core.rent_terms term
      join logistics_core.contract_spaces allocation on allocation.id = term.contract_space_id
      join logistics_core.spaces space on space.id = allocation.space_id
      where space.asset_id = resolved_asset_id), 0)
  ) into latest_revision;

  final_response := jsonb_set(base_response, '{revision}', to_jsonb(latest_revision), true);
  update logistics_core.api_idempotency_keys request
  set request_hash = request_digest,
      response = final_response,
      completed_at = now()
  where request.actor_user_id = actor_id
    and request.action = 'v2/rent-roll/batch-save'
    and request.client_request_id = p_request_id
    and request.status = 'completed';
  return final_response;
end;
$body$;

revoke all on function logistics_core.rent_roll_read_entry_v4(uuid, text, jsonb, jsonb) from public, anon, authenticated;
revoke all on function logistics_core.rent_roll_batch_save_entry_v4(uuid, text, jsonb, jsonb) from public, anon, authenticated;
revoke all on function logistics_core.rent_roll_read_entry(uuid, text, jsonb, jsonb) from public, anon, authenticated;
revoke all on function logistics_core.rent_roll_batch_save_entry(uuid, text, jsonb, jsonb) from public, anon, authenticated;
