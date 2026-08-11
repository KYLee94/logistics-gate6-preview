begin;

-- LOGISTICS_HOME_BUILDING_REGISTER_BACKFILL_V12
-- Source priority:
--   1. Official BuildingHUB recap/title responses refreshed on 2026-08-11.
--   2. Parking values absent from the official response use the user-provided
--      260619 logistics asset specification workbook for the two exact assets.
-- Existing non-null values are never overwritten.
-- A190013001 development in progress: no building register and no completion date.

create temporary table logistics_home_building_register_v12_source (
  asset_code text primary key,
  building_area_sqm numeric,
  primary_use text,
  building_coverage_ratio numeric,
  floor_area_ratio numeric,
  structure_text text,
  parking_count integer,
  source_kind text not null,
  parking_source_kind text
) on commit drop;

insert into pg_temp.logistics_home_building_register_v12_source (
  asset_code,
  building_area_sqm,
  primary_use,
  building_coverage_ratio,
  floor_area_ratio,
  structure_text,
  parking_count,
  source_kind,
  parking_source_kind
)
values
  ('A112755001', 31919.43, '창고시설', 67.87, 116.03, '철근콘크리트구조', null, 'official_building_register', null),
  ('A112299001', 24075.12, '창고시설', 59.7204871877558, 212.346364696252, '프리케스트콘크리트구조', null, 'official_building_register_two_parcels', null),
  ('A112505001', 29845.16, '창고시설', 59.83, 146.02, '프리케스트콘크리트구조', 415, 'official_building_register', 'user_reference_workbook'),
  ('A112500003', 30823.89, '창고시설', 30.44, 32.18, '기타강구조', null, 'official_building_register', null),
  ('A112721001', 37407.23, '창고시설', 69.03, 359.96036, '프리케스트콘크리트구조', 416, 'official_building_register', 'user_reference_workbook'),
  ('A112642001', 29633.14, '창고시설', 37.6, 89.12, '철골철근콘크리트합성구조', 441, 'official_building_register', 'official_building_register'),
  ('A112109001', null, null, null, null, '프리케스트콘크리트구조', null, 'official_building_register', null),
  ('A112500002', null, null, null, null, '일반철골구조', null, 'official_building_register', null);

do $migration$
declare
  visible_asset_count integer;
  source_row_count integer;
  matched_source_count integer;
begin
  select count(*)
  into visible_asset_count
  from logistics_core.assets
  where asset_code not in ('A112127001', 'AP00014001');

  if visible_asset_count <> 17 then
    raise exception 'HOME_VISIBLE_ASSET_COUNT_MISMATCH'
      using errcode = 'PT422', detail = visible_asset_count::text;
  end if;

  select count(*) into source_row_count
  from pg_temp.logistics_home_building_register_v12_source;

  if source_row_count <> 8 then
    raise exception 'HOME_BUILDING_REGISTER_SOURCE_COUNT_MISMATCH'
      using errcode = 'PT422', detail = source_row_count::text;
  end if;

  select count(*)
  into matched_source_count
  from logistics_core.assets asset
  join pg_temp.logistics_home_building_register_v12_source source using (asset_code);

  if matched_source_count <> source_row_count then
    raise exception 'HOME_BUILDING_REGISTER_ASSET_MATCH_MISMATCH'
      using errcode = 'PT422', detail = matched_source_count::text;
  end if;

  if exists (
    select 1
    from logistics_core.assets asset
    join pg_temp.logistics_home_building_register_v12_source source using (asset_code)
    where (source.building_area_sqm is not null and asset.building_area_sqm is not null and asset.building_area_sqm <> source.building_area_sqm)
       or (source.primary_use is not null and asset.primary_use is not null and btrim(asset.primary_use) <> source.primary_use)
       or (source.building_coverage_ratio is not null and asset.building_coverage_ratio is not null and asset.building_coverage_ratio <> source.building_coverage_ratio)
       or (source.floor_area_ratio is not null and asset.floor_area_ratio is not null and asset.floor_area_ratio <> source.floor_area_ratio)
       or (source.structure_text is not null and asset.structure_text is not null and btrim(asset.structure_text) <> source.structure_text)
       or (source.parking_count is not null and asset.parking_count is not null and asset.parking_count <> source.parking_count)
  ) then
    raise exception 'HOME_BUILDING_REGISTER_SOURCE_CONFLICT'
      using errcode = 'PT422';
  end if;

  if not exists (
    select 1
    from logistics_core.assets
    where asset_code = 'A190013001'
      and completion_date is null
  ) then
    raise exception 'HOME_DEVELOPMENT_STATUS_MISMATCH'
      using errcode = 'PT422', detail = 'A190013001 completion_date is not null';
  end if;

  update logistics_core.assets asset
  set building_area_sqm = coalesce(asset.building_area_sqm, source.building_area_sqm),
      primary_use = coalesce(asset.primary_use, source.primary_use),
      building_coverage_ratio = coalesce(asset.building_coverage_ratio, source.building_coverage_ratio),
      floor_area_ratio = coalesce(asset.floor_area_ratio, source.floor_area_ratio),
      structure_text = coalesce(asset.structure_text, source.structure_text),
      parking_count = coalesce(asset.parking_count, source.parking_count)
  from pg_temp.logistics_home_building_register_v12_source source
  where asset.asset_code = source.asset_code;

  if exists (
    select 1
    from logistics_core.assets asset
    join pg_temp.logistics_home_building_register_v12_source source using (asset_code)
    where (source.building_area_sqm is not null and asset.building_area_sqm is distinct from source.building_area_sqm)
       or (source.primary_use is not null and asset.primary_use is distinct from source.primary_use)
       or (source.building_coverage_ratio is not null and asset.building_coverage_ratio is distinct from source.building_coverage_ratio)
       or (source.floor_area_ratio is not null and asset.floor_area_ratio is distinct from source.floor_area_ratio)
       or (source.structure_text is not null and asset.structure_text is distinct from source.structure_text)
       or (source.parking_count is not null and asset.parking_count is distinct from source.parking_count)
  ) then
    raise exception 'HOME_BUILDING_REGISTER_READBACK_MISMATCH'
      using errcode = 'PT500';
  end if;
end;
$migration$;

commit;
