begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

create or replace function public.ll_task_board_append_comment(
  p_task_code text,
  p_comment jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_comments jsonb;
  v_parent jsonb;
  v_parent_id text;
begin
  if p_task_code !~ '^T-[0-9]{6,}$' then
    raise exception using errcode = '22023', message = 'task_comment_not_found';
  end if;
  if jsonb_typeof(p_comment) <> 'object'
     or nullif(btrim(p_comment->>'id'), '') is null
     or nullif(btrim(p_comment->>'text'), '') is null
     or nullif(btrim(coalesce(p_comment->>'created_by_user_id', p_comment->>'author_user_id')), '') is null
     or p_comment->>'id' !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
     or coalesce(p_comment->>'created_by_user_id', p_comment->>'author_user_id') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
     or (nullif(btrim(p_comment->>'parent_comment_id'), '') is not null
         and p_comment->>'parent_comment_id' !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$')
     or char_length(btrim(p_comment->>'text')) not between 1 and 2000 then
    raise exception using errcode = '22023', message = 'task_comment_invalid';
  end if;

  select coalesce(task_comments, '[]'::jsonb)
    into v_comments
  from public.ll_work_items
  where item_type = 'task'
    and task_code = upper(p_task_code)
    and deleted_at is null
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'task_comment_not_found';
  end if;
  if jsonb_typeof(v_comments) <> 'array' then
    raise exception using errcode = '22023', message = 'task_comment_invalid';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(v_comments) as existing(comment)
    where existing.comment->>'id' = p_comment->>'id'
  ) then
    return v_comments;
  end if;

  v_parent_id := nullif(btrim(p_comment->>'parent_comment_id'), '');
  if v_parent_id is not null then
    select existing.comment
      into v_parent
    from jsonb_array_elements(v_comments) as existing(comment)
    where existing.comment->>'id' = v_parent_id
    limit 1;
    if v_parent is null then
      raise exception using errcode = '22023', message = 'task_comment_parent_not_found';
    end if;
  end if;

  update public.ll_work_items
  set task_comments = v_comments || jsonb_build_array(p_comment),
      updated_at = now()
  where item_type = 'task'
    and task_code = upper(p_task_code)
    and deleted_at is null
  returning task_comments into v_comments;

  return v_comments;
end;
$$;

create or replace function public.ll_task_board_update_comment(
  p_task_code text,
  p_comment_id uuid,
  p_text text,
  p_created_by_user_id uuid,
  p_client_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_comments jsonb;
  v_comment jsonb;
  v_updated_comment jsonb;
  v_updated_comments jsonb;
begin
  if p_task_code !~ '^T-[0-9]{6,}$' then
    raise exception using errcode = '22023', message = 'task_comment_not_found';
  end if;
  if p_comment_id is null
     or p_created_by_user_id is null
     or p_client_request_id is null
     or p_text is null
     or char_length(btrim(p_text)) not between 1 and 2000 then
    raise exception using errcode = '22023', message = 'task_comment_invalid';
  end if;

  select coalesce(task_comments, '[]'::jsonb)
    into v_comments
  from public.ll_work_items
  where item_type = 'task'
    and task_code = upper(p_task_code)
    and deleted_at is null
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'task_comment_not_found';
  end if;
  if jsonb_typeof(v_comments) <> 'array' then
    raise exception using errcode = '22023', message = 'task_comment_invalid';
  end if;

  select existing.comment
    into v_comment
  from jsonb_array_elements(v_comments) as existing(comment)
  where existing.comment->>'id' = p_comment_id::text
  limit 1;

  if v_comment is null then
    raise exception using errcode = 'P0002', message = 'task_comment_not_found';
  end if;
  if nullif(btrim(coalesce(v_comment->>'created_by_user_id', v_comment->>'author_user_id')), '') is null
     or lower(coalesce(v_comment->>'created_by_user_id', v_comment->>'author_user_id')) <> p_created_by_user_id::text then
    raise exception using errcode = '42501', message = 'task_comment_not_author';
  end if;
  if v_comment->>'last_update_client_request_id' = p_client_request_id::text then
    return v_comments;
  end if;

  v_updated_comment := v_comment || jsonb_build_object(
    'text', btrim(p_text),
    'updated_at', now(),
    'last_update_client_request_id', p_client_request_id
  );
  select coalesce(
    jsonb_agg(
      case when existing.comment->>'id' = p_comment_id::text then v_updated_comment else existing.comment end
      order by existing.position
    ),
    '[]'::jsonb
  )
    into v_updated_comments
  from jsonb_array_elements(v_comments) with ordinality as existing(comment, position);

  update public.ll_work_items
  set task_comments = v_updated_comments,
      updated_at = now()
  where item_type = 'task'
    and task_code = upper(p_task_code)
    and deleted_at is null
  returning task_comments into v_comments;

  return v_comments;
end;
$$;

revoke all on function public.ll_task_board_append_comment(text, jsonb) from public, anon, authenticated;
grant execute on function public.ll_task_board_append_comment(text, jsonb) to service_role;
revoke all on function public.ll_task_board_update_comment(text, uuid, text, uuid, uuid) from public, anon, authenticated;
grant execute on function public.ll_task_board_update_comment(text, uuid, text, uuid, uuid) to service_role;

commit;
