begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

alter table public.ll_work_items
  add column if not exists task_comments jsonb default '[]'::jsonb;

update public.ll_work_items
set task_comments = '[]'::jsonb
where task_comments is null;

alter table public.ll_work_items
  alter column task_comments set default '[]'::jsonb,
  alter column task_comments set not null;

alter table public.ll_work_items
  drop constraint if exists ll_work_items_task_comments_json_array_check restrict;

alter table public.ll_work_items
  add constraint ll_work_items_task_comments_json_array_check
    check (item_type <> 'task' or jsonb_typeof(task_comments) = 'array');

update public.ll_work_items
set status = '진행 중'
where item_type = 'task'
  and status in ('진행중', '검토중');

alter table public.ll_work_items
  drop constraint if exists ll_work_items_task_status_check restrict;

alter table public.ll_work_items
  add constraint ll_work_items_task_status_check
    check (item_type <> 'task' or status in ('예정', '진행 중', '중단', '보류', '완료'));

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
     or nullif(btrim(p_comment->>'author_user_id'), '') is null
     or p_comment->>'id' !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
     or char_length(p_comment->>'text') > 2000 then
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
    if nullif(btrim(v_parent->>'parent_comment_id'), '') is not null then
      raise exception using errcode = '22023', message = 'task_comment_reply_depth_exceeded';
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

revoke all on function public.ll_task_board_append_comment(text, jsonb) from public, anon, authenticated;
grant execute on function public.ll_task_board_append_comment(text, jsonb) to service_role;

commit;
