-- LOGISTICS_HOME_ASSET_NONNEGATIVE_V1
-- Physical area, ratio, and count fields are nullable but never negative.

begin;

do $existing_value_preflight$
begin
  if exists (
    select 1
    from logistics_core.assets asset
    where asset.land_area_sqm < 0
       or asset.building_area_sqm < 0
       or asset.gross_area_sqm < 0
       or asset.leasable_area_sqm < 0
       or asset.building_coverage_ratio < 0
       or asset.floor_area_ratio < 0
       or asset.parking_count < 0
  ) then
    raise exception using errcode = 'PT422', message = 'HOME_ASSET_EXISTING_NEGATIVE_VALUE';
  end if;
end;
$existing_value_preflight$;

create or replace function logistics_core.assert_home_asset_document_valid(p_document jsonb)
returns void
language plpgsql
immutable
set search_path = pg_catalog, logistics_core
as $body$
declare
  v_field text;
  v_normalized jsonb;
begin
  if jsonb_typeof(p_document) <> 'object' then
    raise exception using errcode = 'PT422', message = 'HOME_ASSET_DOCUMENT_INVALID';
  end if;
  foreach v_field in array array[
    'name', 'address', 'zoning_text', 'primary_use', 'floor_count', 'structure_text'
  ] loop
    if p_document ? v_field and jsonb_typeof(p_document->v_field) not in ('string', 'null') then
      raise exception using errcode = 'PT422', message = 'HOME_ASSET_TEXT_INVALID';
    end if;
  end loop;
  foreach v_field in array array[
    'land_area_sqm', 'building_area_sqm', 'gross_area_sqm', 'leasable_area_sqm',
    'building_coverage_ratio', 'floor_area_ratio'
  ] loop
    if p_document ? v_field then
      begin
        v_normalized := logistics_core.normalize_home_optional_number(p_document->v_field);
      exception when sqlstate 'PT422' then
        raise exception using errcode = 'PT422', message = 'HOME_ASSET_NUMBER_INVALID';
      end;
      if jsonb_typeof(v_normalized) <> 'null'
         and (v_normalized #>> '{}')::numeric < 0 then
        raise exception using errcode = 'PT422', message = 'HOME_ASSET_NUMBER_NEGATIVE';
      end if;
    end if;
  end loop;
  if p_document ? 'parking_count' then
    begin
      v_normalized := logistics_core.normalize_home_optional_integer(p_document->'parking_count');
    exception when sqlstate 'PT422' then
      raise exception using errcode = 'PT422', message = 'HOME_ASSET_INTEGER_INVALID';
    end;
    if jsonb_typeof(v_normalized) <> 'null'
       and (v_normalized #>> '{}')::numeric < 0 then
      raise exception using errcode = 'PT422', message = 'HOME_ASSET_INTEGER_NEGATIVE';
    end if;
  end if;
  if p_document ? 'completion_date' then
    begin
      perform logistics_core.normalize_home_optional_date(p_document->'completion_date');
    exception when sqlstate 'PT422' then
      raise exception using errcode = 'PT422', message = 'HOME_ASSET_DATE_INVALID';
    end;
  end if;
end;
$body$;

revoke all on function logistics_core.assert_home_asset_document_valid(jsonb)
  from public, anon, authenticated;

do $contract_readback$
begin
  perform logistics_core.assert_home_asset_document_valid(to_jsonb(asset))
  from logistics_core.assets asset;
end;
$contract_readback$;

commit;
