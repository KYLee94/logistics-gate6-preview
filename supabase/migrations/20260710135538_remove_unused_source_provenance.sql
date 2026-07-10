begin;

-- Keep stable row identifiers on operating data, but remove their obsolete
-- foreign-key dependency on source-only provenance tables.
do $$
begin
  if to_regclass('public.ll_assets') is not null then
    alter table public.ll_assets
      drop constraint if exists ll_assets_source_sheet_row_id_fkey restrict;
  end if;
  if to_regclass('public.ll_tenants') is not null then
    alter table public.ll_tenants
      drop constraint if exists ll_tenants_source_sheet_row_id_fkey restrict;
  end if;
  if to_regclass('public.ll_leases') is not null then
    alter table public.ll_leases
      drop constraint if exists ll_leases_source_sheet_row_id_fkey restrict;
  end if;
  if to_regclass('public.ll_lease_spaces') is not null then
    alter table public.ll_lease_spaces
      drop constraint if exists ll_lease_spaces_source_sheet_row_id_fkey restrict;
  end if;
  if to_regclass('public.ll_rent_history') is not null then
    alter table public.ll_rent_history
      drop constraint if exists ll_rent_history_source_sheet_row_id_fkey restrict;
  end if;
  if to_regclass('public.ll_lease_attributes') is not null then
    alter table public.ll_lease_attributes
      drop constraint if exists ll_lease_attributes_source_cell_id_fkey restrict;
  end if;
end $$;

do $$
begin
  if to_regclass('public.ll_source_field_registry') is not null then
    execute 'drop table public.ll_source_field_registry restrict';
  end if;
  if to_regclass('public.ll_source_cells') is not null then
    execute 'drop table public.ll_source_cells restrict';
  end if;
  if to_regclass('public.ll_source_runs') is not null then
    execute 'drop table public.ll_source_runs restrict';
  end if;
end $$;

do $$
declare
  remaining_relations text[];
begin
  select array_agg(name order by name)
  into remaining_relations
  from (values
    ('public.ll_source_field_registry'),
    ('public.ll_source_cells'),
    ('public.ll_source_runs')
  ) as retired(name)
  where to_regclass(name) is not null;

  if remaining_relations is not null then
    raise exception 'Unused source provenance relations remain: %', array_to_string(remaining_relations, ', ');
  end if;
end $$;

commit;
