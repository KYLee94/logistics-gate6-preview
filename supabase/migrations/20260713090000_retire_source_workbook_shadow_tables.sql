begin;

do $$
declare
  incomplete_schema_count integer;
  missing_sheet_count integer;
  missing_column_count integer;
  missing_row_sheet_count integer;
  null_sheet_name_count integer;
  external_foreign_key_count integer;
begin
  if to_regclass('public.ll_source_files') is null or to_regclass('public.ll_source_rows') is null then
    raise exception 'stop: source files and source rows must remain available';
  end if;

  if to_regclass('public.ll_source_sheets') is null or to_regclass('public.ll_source_columns') is null then
    raise exception 'stop: source workbook shadow tables are missing before retirement';
  end if;

  select count(*) into incomplete_schema_count
  from public.ll_source_files f
  where exists (
    select 1
    from public.ll_source_sheets s
    where s.source_file_id = f.source_file_id
  )
    and (
      jsonb_typeof(f.workbook_schema) <> 'object'
      or jsonb_typeof(f.workbook_schema->'sheets') <> 'array'
      or jsonb_array_length(f.workbook_schema->'sheets') = 0
    );

  select count(*) into missing_sheet_count
  from public.ll_source_sheets s
  join public.ll_source_files f on f.source_file_id = s.source_file_id
  where not exists (
    select 1
    from jsonb_array_elements(f.workbook_schema->'sheets') as schema_sheet
    where schema_sheet->>'sheet_name' = s.sheet_name
      and schema_sheet->>'sheet_index' = s.sheet_index::text
  );

  select count(*) into missing_column_count
  from public.ll_source_columns c
  join public.ll_source_sheets s on s.source_sheet_id = c.source_sheet_id
  join public.ll_source_files f on f.source_file_id = s.source_file_id
  where not exists (
    select 1
    from jsonb_array_elements(f.workbook_schema->'sheets') as schema_sheet
    cross join lateral jsonb_array_elements(schema_sheet->'columns') as schema_column
    where schema_sheet->>'sheet_name' = s.sheet_name
      and schema_sheet->>'sheet_index' = s.sheet_index::text
      and schema_column->>'column_index' = c.column_index::text
  );

  select count(*) into null_sheet_name_count
  from public.ll_source_rows
  where sheet_name is null;

  select count(*) into missing_row_sheet_count
  from public.ll_source_rows r
  join public.ll_source_files f on f.source_file_id = r.source_file_id
  where not exists (
    select 1
    from jsonb_array_elements(f.workbook_schema->'sheets') as schema_sheet
    where schema_sheet->>'sheet_name' = r.sheet_name
  );

  if incomplete_schema_count <> 0 or missing_sheet_count <> 0 or missing_column_count <> 0 or missing_row_sheet_count <> 0 or null_sheet_name_count <> 0 then
    raise exception 'stop: workbook_schema backfill is incomplete (files %, sheets %, columns %, rows %, null sheet names %)', incomplete_schema_count, missing_sheet_count, missing_column_count, missing_row_sheet_count, null_sheet_name_count;
  end if;

  select count(*) into external_foreign_key_count
  from pg_constraint c
  where c.contype = 'f'
    and c.confrelid in ('public.ll_source_sheets'::regclass, 'public.ll_source_columns'::regclass)
    and c.conrelid not in ('public.ll_source_rows'::regclass, 'public.ll_source_columns'::regclass);

  if external_foreign_key_count <> 0 then
    raise exception 'stop: % external foreign key dependencies still reference retired source workbook tables', external_foreign_key_count;
  end if;
end $$;

alter table public.ll_source_rows
  drop constraint if exists ll_source_rows_source_sheet_id_fkey restrict;

drop index if exists public.ll_source_rows_sheet_idx;

alter table public.ll_source_rows
  drop column if exists source_sheet_id restrict;

drop table if exists public.ll_source_columns restrict;
drop table if exists public.ll_source_sheets restrict;

commit;
