set lock_timeout = '5s';
set statement_timeout = '30s';

do $$
begin
  if exists (
    select 1
    from public.ll_work_items
    where item_type = 'task'
      and task_category not in (
        '신규 투자 검토',
        '자산 매각',
        '파이낸싱',
        '개발·인허가',
        '임대·마케팅',
        '법률·세무 이슈',
        '기타 자산관리',
        '기타 리스크 관리'
      )
  ) then
    raise exception 'Existing task rows use categories outside the approved eight-category taxonomy';
  end if;
end
$$;

alter table public.ll_work_items
  drop constraint if exists ll_work_items_task_category_check restrict;

alter table public.ll_work_items
  add constraint ll_work_items_task_category_check
    check (item_type <> 'task' or task_category in (
      '신규 투자 검토',
      '자산 매각',
      '파이낸싱',
      '개발·인허가',
      '임대·마케팅',
      '법률·세무 이슈',
      '기타 자산관리',
      '기타 리스크 관리'
    ));
