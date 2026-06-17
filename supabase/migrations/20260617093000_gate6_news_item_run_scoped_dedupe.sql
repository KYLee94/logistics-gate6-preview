begin;

alter table public.ll_news_items
  drop constraint if exists ll_news_items_dedupe_key_key;

create unique index if not exists ll_news_items_run_dedupe_key
  on public.ll_news_items(news_run_id, dedupe_key);

commit;
