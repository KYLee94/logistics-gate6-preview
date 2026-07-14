begin;

alter table public.ll_assets
  drop column if exists last_etl_run_id restrict;

alter table public.ll_funds
  drop column if exists last_etl_run_id restrict;

alter table public.ll_leases
  drop column if exists source_doc_ref restrict;

commit;
