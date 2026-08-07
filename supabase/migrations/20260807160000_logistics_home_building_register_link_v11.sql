-- Gate 6 data platform v11
-- Link official building-register cache rows to assets without requiring
-- decimal-identical source areas, and make home provenance truthful.

begin;

set local statement_timeout = '120s';

-- HOME_BUILDING_REGISTER_CACHE_LINK_V11
-- Historical cache rows predate asset metadata. Only a unique candidate whose
-- land/gross areas are within 1 sqm and whose approval date agrees is linked.
with candidate_matches as (
  select
    cache.id as cache_id,
    asset.asset_id,
    asset.asset_name,
    count(*) over (partition by cache.id) as candidate_count
  from public.ll_cache_entries cache
  join public.ll_assets asset
    on asset.land_area_sqm is not null
   and asset.gross_floor_area_sqm is not null
   and asset.approval_date is not null
   and nullif(cache.payload->>'plat_area', '') is not null
   and nullif(cache.payload->>'tot_area', '') is not null
   and abs((cache.payload->>'plat_area')::numeric - asset.land_area_sqm) <= 1
   and abs((cache.payload->>'tot_area')::numeric - asset.gross_floor_area_sqm) <= 1
   and nullif(cache.payload->>'use_apr_day', '') = to_char(asset.approval_date, 'YYYYMMDD')
  where cache.provider = 'building-register/summary'
    and cache.provider_status = 200
    and cache.asset_id is null
), unique_matches as (
  select cache_id, asset_id, asset_name, candidate_count
  from candidate_matches
  where candidate_count = 1
)
update public.ll_cache_entries cache
set asset_id = candidate.asset_id,
    asset_name = candidate.asset_name,
    updated_at = now()
from unique_matches candidate
where cache.id = candidate.cache_id;

do $patch_home_building_register_link_v11$
declare
  v_function regprocedure := to_regprocedure(
    'logistics_core.home_read_entry(uuid,text,jsonb,jsonb)'
  );
  v_definition text;
  v_old_link text := $old_link$
    and v_legacy.asset_id is not null
    and v_legacy.land_area_sqm is not null
    and v_legacy.gross_floor_area_sqm is not null
    and nullif(cache.payload->>'plat_area', '')::numeric is not distinct from v_legacy.land_area_sqm
    and nullif(cache.payload->>'tot_area', '')::numeric is not distinct from v_legacy.gross_floor_area_sqm
    and (
      v_legacy.approval_date is null
      or nullif(cache.payload->>'use_apr_day', '') = to_char(v_legacy.approval_date, 'YYYYMMDD')
    )
  order by cache.fetched_at desc
$old_link$;
  v_new_link text := $new_link$
    -- HOME_BUILDING_REGISTER_CACHE_LINK_V11: direct asset link first, unique tolerance second.
    and v_legacy.asset_id is not null
    and (
      cache.asset_id = v_legacy.asset_id
      or (
        cache.asset_id is null
        and v_legacy.land_area_sqm is not null
        and v_legacy.gross_floor_area_sqm is not null
        and v_legacy.approval_date is not null
        and nullif(cache.payload->>'plat_area', '') is not null
        and nullif(cache.payload->>'tot_area', '') is not null
        and abs((cache.payload->>'plat_area')::numeric - v_legacy.land_area_sqm) <= 1
        and abs((cache.payload->>'tot_area')::numeric - v_legacy.gross_floor_area_sqm) <= 1
        and nullif(cache.payload->>'use_apr_day', '') = to_char(v_legacy.approval_date, 'YYYYMMDD')
        and (
          select count(*)
          from public.ll_assets candidate
          where candidate.land_area_sqm is not null
            and candidate.gross_floor_area_sqm is not null
            and candidate.approval_date is not null
            and abs((cache.payload->>'plat_area')::numeric - candidate.land_area_sqm) <= 1
            and abs((cache.payload->>'tot_area')::numeric - candidate.gross_floor_area_sqm) <= 1
            and nullif(cache.payload->>'use_apr_day', '') = to_char(candidate.approval_date, 'YYYYMMDD')
        ) = 1
      )
    )
  order by (cache.asset_id = v_legacy.asset_id) desc, cache.fetched_at desc
$new_link$;
  v_old_provenance text := $old_provenance$
  v_provenance := jsonb_build_object(
    'building_register_match', case when v_register <> '{}'::jsonb then 'legacy_land_gross_approval_exact' else null end,
    'building_register_provider', case when v_register <> '{}'::jsonb then 'll_cache_entries:building-register/summary' else null end,
    'building_register_fetched_at', v_register_fetched_at,
    'land_area_sqm', case when v_asset.land_area_sqm is not null then 'logistics_core.assets' when v_register ? 'plat_area' then 'building_register_cache' else 'public.ll_assets' end,
    'building_area_sqm', case when v_asset.building_area_sqm is not null then 'logistics_core.assets' when v_register ? 'arch_area' then 'building_register_cache' when v_legacy_register ? 'buildingAreaSqm' then 'll_assets.source_payload.buildingRegister' end,
    'gross_area_sqm', case when v_asset.gross_area_sqm is not null then 'logistics_core.assets' when v_overrides ? 'gross_area_sqm' then 'll_assets.data_platform_overrides' when v_register ? 'tot_area' then 'building_register_cache' else 'public.ll_assets' end,
    'leasable_area_sqm', case when v_asset.leasable_area_sqm is not null then 'logistics_core.assets' when v_overrides ? 'leasable_area_sqm' then 'll_assets.data_platform_overrides' end,
    'primary_use', case when v_asset.primary_use is not null then 'logistics_core.assets' when v_register ? 'main_purps_cd_nm' then 'building_register_cache' when v_legacy_register <> '{}'::jsonb then 'll_assets.source_payload.buildingRegister' end,
    'occupancy_summary', 'logistics_core.current_contract_spaces'
  );
$old_provenance$;
  v_new_provenance text := $new_provenance$
  -- HOME_BUILDING_REGISTER_PROVENANCE_V11: record the selected, non-null source.
  v_provenance := jsonb_build_object(
    'building_register_match', case
      when v_register = '{}'::jsonb then null
      when exists (
        select 1 from public.ll_cache_entries linked_cache
        where linked_cache.provider = 'building-register/summary'
          and linked_cache.provider_status = 200
          and linked_cache.asset_id = v_legacy.asset_id
          and linked_cache.payload = v_register
      ) then 'cache_asset_id'
      else 'legacy_land_gross_approval_tolerance'
    end,
    'building_register_provider', case when v_register <> '{}'::jsonb then 'll_cache_entries:building-register/summary' else null end,
    'building_register_fetched_at', case when v_register <> '{}'::jsonb then v_register_fetched_at else null end,
    'zoning_text', case
      when nullif(v_asset.zoning_text, '') is not null then 'logistics_core.assets'
      when nullif(v_overrides->>'zoning_text', '') is not null then 'll_assets.data_platform_overrides'
    end,
    'land_area_sqm', case
      when v_asset.land_area_sqm is not null then 'logistics_core.assets'
      when nullif(v_overrides->>'land_area_sqm', '') is not null then 'll_assets.data_platform_overrides'
      when nullif(v_register->>'plat_area', '') is not null then 'building_register_cache'
      when v_legacy.land_area_sqm is not null then 'public.ll_assets'
    end,
    'building_area_sqm', case
      when v_asset.building_area_sqm is not null then 'logistics_core.assets'
      when nullif(v_overrides->>'building_area_sqm', '') is not null then 'll_assets.data_platform_overrides'
      when nullif(v_register->>'arch_area', '') is not null then 'building_register_cache'
      when nullif(v_legacy_register->>'buildingAreaSqm', '') is not null then 'll_assets.source_payload.buildingRegister'
    end,
    'gross_area_sqm', case
      when v_asset.gross_area_sqm is not null then 'logistics_core.assets'
      when nullif(v_overrides->>'gross_area_sqm', '') is not null then 'll_assets.data_platform_overrides'
      when nullif(v_register->>'tot_area', '') is not null then 'building_register_cache'
      when v_legacy.gross_floor_area_sqm is not null then 'public.ll_assets'
    end,
    'leasable_area_sqm', case
      when v_asset.leasable_area_sqm is not null then 'logistics_core.assets'
      when nullif(v_overrides->>'leasable_area_sqm', '') is not null then 'll_assets.data_platform_overrides'
    end,
    'primary_use', case
      when nullif(v_asset.primary_use, '') is not null then 'logistics_core.assets'
      when nullif(v_overrides->>'primary_use', '') is not null then 'll_assets.data_platform_overrides'
      when nullif(v_register->>'main_purps_cd_nm', '') is not null or nullif(v_register->>'etc_purps', '') is not null then 'building_register_cache'
      when nullif(v_legacy_register->>'mainPurposeName', '') is not null or nullif(v_legacy_register->>'etcPurpose', '') is not null then 'll_assets.source_payload.buildingRegister'
    end,
    'building_coverage_ratio', case
      when v_asset.building_coverage_ratio is not null then 'logistics_core.assets'
      when nullif(v_overrides->>'building_coverage_ratio', '') is not null then 'll_assets.data_platform_overrides'
      when nullif(v_register->>'bc_rat', '') is not null then 'building_register_cache'
      when nullif(v_legacy_register->>'buildingCoverageRatioPct', '') is not null then 'll_assets.source_payload.buildingRegister'
    end,
    'floor_area_ratio', case
      when v_asset.floor_area_ratio is not null then 'logistics_core.assets'
      when nullif(v_overrides->>'floor_area_ratio', '') is not null then 'll_assets.data_platform_overrides'
      when nullif(v_register->>'vl_rat', '') is not null then 'building_register_cache'
      when nullif(v_legacy_register->>'floorAreaRatioPct', '') is not null then 'll_assets.source_payload.buildingRegister'
    end,
    'floor_count', case
      when nullif(v_asset.floor_count, '') is not null then 'logistics_core.assets'
      when nullif(v_legacy_register->>'floorCount', '') is not null then 'll_assets.source_payload.buildingRegister'
      when nullif(v_register->>'grnd_flr_cnt', '') is not null then 'building_register_cache'
      when nullif(v_legacy.floor_count, '') is not null then 'public.ll_assets'
    end,
    'structure_text', case
      when nullif(v_asset.structure_text, '') is not null then 'logistics_core.assets'
      when nullif(v_overrides->>'structure_text', '') is not null then 'll_assets.data_platform_overrides'
      when nullif(v_register->>'strct_cd_nm', '') is not null then 'building_register_cache'
      when nullif(v_legacy_register->>'structureName', '') is not null then 'll_assets.source_payload.buildingRegister'
    end,
    'parking_count', case
      when v_asset.parking_count is not null then 'logistics_core.assets'
      when nullif(v_overrides->>'parking_count', '') is not null then 'll_assets.data_platform_overrides'
      when v_register ?| array['tot_pkng_cnt','indr_auto_utcnt','oudr_auto_utcnt','indr_mech_utcnt','oudr_mech_utcnt'] then 'building_register_cache'
      when nullif(v_legacy_register->>'totalParkingCount', '') is not null then 'll_assets.source_payload.buildingRegister'
    end,
    'completion_date', case
      when v_asset.completion_date is not null then 'logistics_core.assets'
      when nullif(v_overrides->>'completion_date', '') is not null then 'll_assets.data_platform_overrides'
      when nullif(v_register->>'use_apr_day', '') is not null then 'building_register_cache'
      when nullif(v_legacy_register->>'approvalDate', '') is not null then 'll_assets.source_payload.buildingRegister'
      when v_legacy.approval_date is not null then 'public.ll_assets'
    end,
    'occupancy_summary', 'logistics_core.current_contract_spaces'
  );
$new_provenance$;
begin
  if v_function is null then
    raise exception 'HOME_BUILDING_REGISTER_LINK_V11_FAILED: home reader is missing';
  end if;

  v_definition := pg_get_functiondef(v_function);
  if position('HOME_BUILDING_REGISTER_CACHE_LINK_V11' in v_definition) = 0 then
    if position(v_old_link in v_definition) = 0 then
      raise exception 'HOME_BUILDING_REGISTER_LINK_V11_FAILED: exact-match fragment is missing';
    end if;
    v_definition := replace(v_definition, v_old_link, v_new_link);
  end if;

  if position('HOME_BUILDING_REGISTER_PROVENANCE_V11' in v_definition) = 0 then
    if position(v_old_provenance in v_definition) = 0 then
      raise exception 'HOME_BUILDING_REGISTER_LINK_V11_FAILED: provenance fragment is missing';
    end if;
    v_definition := replace(v_definition, v_old_provenance, v_new_provenance);
  end if;

  execute v_definition;
  v_definition := pg_get_functiondef(v_function);
  if position('HOME_BUILDING_REGISTER_CACHE_LINK_V11' in v_definition) = 0
     or position('HOME_BUILDING_REGISTER_PROVENANCE_V11' in v_definition) = 0
     or position(v_old_link in v_definition) > 0
     or position(v_old_provenance in v_definition) > 0 then
    raise exception 'HOME_BUILDING_REGISTER_LINK_V11_FAILED: patched definition did not persist';
  end if;
end;
$patch_home_building_register_link_v11$;

notify pgrst, 'reload schema';

commit;
