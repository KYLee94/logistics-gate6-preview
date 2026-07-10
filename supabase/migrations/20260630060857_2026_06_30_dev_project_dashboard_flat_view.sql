-- Read-only dashboard view for the 2026-06-30 development-project snapshot.
-- The dashboard reads only this view, keeping the dev_project_* base tables RLS-protected.

create or replace view public.dev_project_34_dashboard_flat as
select
    dpl.list_no,
    dpl.dev_project_id,
    dpl.source_category,
    dpl.project_name,
    dpl.vehicle_text,
    dpl.inclusion_basis,
    dpl.match_status,
    dpl.review_note,
    dpl.source_asof_date,
    coalesce(projects.linked_project_count, 0) as linked_project_count,
    coalesce(funds.linked_fund_count, 0) as linked_fund_count,
    coalesce(assets.linked_asset_count, 0) as linked_asset_count,
    coalesce(flags.review_flags, array[]::text[]) as review_flags,
    projects.project_ids,
    projects.project_names,
    projects.project_codes,
    projects.project_types,
    projects.project_statuses,
    projects.project_notion_ids,
    projects.project_primary_asset_ids,
    projects.project_relation_roles,
    projects.project_match_methods,
    projects.project_match_confidences,
    projects.project_link_notes,
    funds.fund_ids,
    funds.fund_short_names,
    funds.fund_names,
    funds.fund_statuses,
    funds.fund_types,
    funds.legal_forms,
    funds.is_development_values,
    funds.notion_vehicle_classes,
    funds.notion_business_stage_classes,
    funds.notion_holding_type_classes,
    funds.fund_primary_asset_ids,
    funds.fund_depts,
    funds.fund_managers,
    funds.fund_vehicle_roles,
    funds.fund_match_methods,
    funds.fund_match_confidences,
    funds.fund_link_notes,
    funds.benchmark_aum_total,
    funds.invested_aum_total,
    assets.asset_ids,
    assets.asset_names,
    assets.asset_types,
    assets.asset_kinds,
    assets.business_stages,
    assets.address_texts,
    assets.pnus,
    assets.latitudes,
    assets.longitudes,
    assets.main_usages,
    assets.site_areas,
    assets.gross_floor_areas,
    assets.scrs,
    assets.fars,
    assets.completion_dates,
    assets.asset_roles,
    assets.asset_link_sources,
    assets.asset_match_methods,
    assets.asset_match_confidences,
    assets.asset_link_notes
from public.dev_project_list dpl
left join lateral (
    select
        count(*) as linked_project_count,
        array_agg(project_id order by is_primary desc, project_id) as project_ids,
        array_agg(project_name order by is_primary desc, project_id) as project_names,
        array_agg(project_code order by is_primary desc, project_id) as project_codes,
        array_agg(project_type order by is_primary desc, project_id) as project_types,
        array_agg(status order by is_primary desc, project_id) as project_statuses,
        array_agg(notion_id order by is_primary desc, project_id) as project_notion_ids,
        array_agg(primary_asset_id order by is_primary desc, project_id) as project_primary_asset_ids,
        array_agg(relation_role order by is_primary desc, project_id) as project_relation_roles,
        array_agg(match_method order by is_primary desc, project_id) as project_match_methods,
        array_agg(match_confidence::text order by is_primary desc, project_id) as project_match_confidences,
        array_agg(notes order by is_primary desc, project_id) as project_link_notes
    from (
        select
            dppl.project_id,
            dppl.relation_role,
            dppl.is_primary,
            dppl.match_method,
            dppl.match_confidence,
            dppl.notes,
            p.project_name,
            p.project_code,
            p.project_type,
            p.status,
            p.notion_id,
            p.primary_asset_id
        from public.dev_project_project_links dppl
        join public.projects p
            on p.project_id = dppl.project_id
        where dppl.dev_project_id = dpl.dev_project_id
    ) project_rows
) projects on true
left join lateral (
    select
        count(*) as linked_fund_count,
        array_agg(fund_id order by is_primary desc, fund_id) as fund_ids,
        array_agg(short_name order by is_primary desc, fund_id) as fund_short_names,
        array_agg(fund_name order by is_primary desc, fund_id) as fund_names,
        array_agg(status order by is_primary desc, fund_id) as fund_statuses,
        array_agg(fund_type order by is_primary desc, fund_id) as fund_types,
        array_agg(legal_form order by is_primary desc, fund_id) as legal_forms,
        array_agg(is_development::text order by is_primary desc, fund_id) as is_development_values,
        array_agg(notion_vehicle_class order by is_primary desc, fund_id) as notion_vehicle_classes,
        array_agg(notion_business_stage_class order by is_primary desc, fund_id) as notion_business_stage_classes,
        array_agg(notion_holding_type_class order by is_primary desc, fund_id) as notion_holding_type_classes,
        array_agg(primary_asset_id order by is_primary desc, fund_id) as fund_primary_asset_ids,
        array_agg(dept_resolved order by is_primary desc, fund_id) as fund_depts,
        array_agg(manager_resolved order by is_primary desc, fund_id) as fund_managers,
        array_agg(vehicle_role order by is_primary desc, fund_id) as fund_vehicle_roles,
        array_agg(match_method order by is_primary desc, fund_id) as fund_match_methods,
        array_agg(match_confidence::text order by is_primary desc, fund_id) as fund_match_confidences,
        array_agg(notes order by is_primary desc, fund_id) as fund_link_notes,
        sum(benchmark_aum) as benchmark_aum_total,
        sum(invested_aum) as invested_aum_total
    from (
        select
            dpfl.fund_id,
            dpfl.vehicle_role,
            dpfl.is_primary,
            dpfl.match_method,
            dpfl.match_confidence,
            dpfl.notes,
            f.short_name,
            f.fund_name,
            f.status,
            f.fund_type,
            f.legal_form,
            f.is_development,
            f.notion_vehicle_class,
            f.notion_business_stage_class,
            f.notion_holding_type_class,
            f.primary_asset_id,
            f.dept_resolved,
            f.manager_resolved,
            f.benchmark_aum,
            f.invested_aum
        from public.dev_project_fund_links dpfl
        join public.v_funds_enriched f
            on f.fund_id = dpfl.fund_id
        where dpfl.dev_project_id = dpl.dev_project_id
    ) fund_rows
) funds on true
left join lateral (
    select
        count(*) as linked_asset_count,
        array_agg(asset_id order by is_primary desc, asset_id) as asset_ids,
        array_agg(canonical_name order by is_primary desc, asset_id) as asset_names,
        array_agg(asset_type order by is_primary desc, asset_id) as asset_types,
        array_agg(asset_kind order by is_primary desc, asset_id) as asset_kinds,
        array_agg(business_stage order by is_primary desc, asset_id) as business_stages,
        array_agg(address_text order by is_primary desc, asset_id) as address_texts,
        array_agg(pnu order by is_primary desc, asset_id) as pnus,
        array_agg(latitude::text order by is_primary desc, asset_id) as latitudes,
        array_agg(longitude::text order by is_primary desc, asset_id) as longitudes,
        array_agg(main_usage order by is_primary desc, asset_id) as main_usages,
        array_agg(site_area::text order by is_primary desc, asset_id) as site_areas,
        array_agg(gross_floor_area::text order by is_primary desc, asset_id) as gross_floor_areas,
        array_agg(scr::text order by is_primary desc, asset_id) as scrs,
        array_agg(far::text order by is_primary desc, asset_id) as fars,
        array_agg(completion_date::text order by is_primary desc, asset_id) as completion_dates,
        array_agg(asset_role order by is_primary desc, asset_id) as asset_roles,
        array_agg(link_source order by is_primary desc, asset_id) as asset_link_sources,
        array_agg(match_method order by is_primary desc, asset_id) as asset_match_methods,
        array_agg(match_confidence::text order by is_primary desc, asset_id) as asset_match_confidences,
        array_agg(notes order by is_primary desc, asset_id) as asset_link_notes
    from (
        select
            dpal.asset_id,
            dpal.asset_role,
            dpal.is_primary,
            dpal.link_source,
            dpal.match_method,
            dpal.match_confidence,
            dpal.notes,
            am.canonical_name,
            am.asset_type,
            am.asset_kind,
            am.business_stage,
            am.address_text,
            am.pnu,
            am.latitude,
            am.longitude,
            am.main_usage,
            am.site_area,
            am.gross_floor_area,
            am.scr,
            am.far,
            am.completion_date
        from public.dev_project_asset_links dpal
        join public.asset_master am
            on am.asset_id = dpal.asset_id
        where dpal.dev_project_id = dpl.dev_project_id
    ) asset_rows
) assets on true
left join lateral (
    select review_flags
    from public.dev_project_34_review_flags rf
    where rf.dev_project_id = dpl.dev_project_id
) flags on true;

comment on view public.dev_project_34_dashboard_flat is
    'Browser-readable flat/aggregated dashboard view for the 34 development-project snapshot.';
;
