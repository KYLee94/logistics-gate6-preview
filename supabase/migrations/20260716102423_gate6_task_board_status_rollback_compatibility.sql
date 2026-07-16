begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

-- Keep the previous Edge version writable during an emergency rollback.
-- The current UI and API still expose only the five approved labels.
alter table public.ll_work_items
  drop constraint if exists ll_work_items_task_status_check restrict;

alter table public.ll_work_items
  add constraint ll_work_items_task_status_check
    check (
      item_type <> 'task'
      or status in ('예정', '진행 중', '중단', '보류', '완료', '진행중', '검토중')
    ) not valid;

commit;

begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

alter table public.ll_work_items
  validate constraint ll_work_items_task_status_check;

commit;
