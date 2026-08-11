-- SDD: rent-roll major cargo taxonomy V1
-- UI title: 주요 취급 화물
--
-- Sources and decisions:
--   * Operating read-only snapshot (2026-08-11): 19 rent_roll documents / 81 rows.
--   * User workbook: ★ 260414_물류센터 임대차계약 DB_취합본.xlsx,
--     DB_일반 column L (취급 상품 유형) and Meta row 12.
--   * KTDB freight commodity categories keep food/beverage, apparel, furniture,
--     electric/electronic machinery and other manufactured goods as product groups.
--   * The user explicitly approved a product-only field: parenthetical handling
--     attributes (high value, medium/heavy load, temperature and fulfillment)
--     are removed and no hidden handling field is created.
--   * Unknown/custom values are preserved exactly; only the exact aliases below
--     are canonicalized.  No new table or logistics_core column is added.
--
-- Safety contract:
--   * Fail closed unless the exact 19-document / 81-row source distribution and
--     all nine source-backed blank-row signatures match.
--   * Preserve row count, array order, expired rows and every non-goods JSON key.
--   * Backfill, writer normalization and readback use one canonical function.

begin;

create or replace function logistics_core.canonical_goods_type_item(p_value text)
returns text
language plpgsql
immutable
set search_path = pg_catalog
as $body$
declare
  v_value text := btrim(coalesce(p_value, ''));
begin
  if v_value = '' then
    return null;
  end if;

  return case v_value
    when '하중물' then null
    when '생필품' then '일상용품'
    when '라이프스타일 용품' then '일상용품'
    when '공산품' then '기타 공산품'
    when '어패럴' then '의류'
    when '의류(중하중)' then '의류'
    when '가전제품' then '디지털·가전'
    when '가전제품 등' then '디지털·가전'
    when '전자기기(컴퓨터 등)' then '디지털·가전'
    when '가구' then '가구·인테리어'
    when '반도체(고가 화물)' then '반도체'
    when '식품(온도)' then '식품·음료'
    when '식음료' then '식품·음료'
    when '신선식품' then '식품·음료'
    when '유제품' then '식품·음료'
    when '유제품 등' then '식품·음료'
    when '화장품 등' then '화장품'
    when '전체 상품 취급(풀필먼트)' then '종합상품'
    else v_value
  end;
end;
$body$;

create or replace function logistics_core.normalize_goods_type(p_value jsonb)
returns jsonb
language plpgsql
immutable
set search_path = pg_catalog, logistics_core
as $body$
declare
  v_result jsonb := '[]'::jsonb;
  v_seen text[] := array[]::text[];
  v_item jsonb;
  v_source_text text;
  v_value text;
begin
  if p_value is null or jsonb_typeof(p_value) = 'null' then
    return v_result;
  end if;

  if jsonb_typeof(p_value) = 'string' then
    for v_source_text in
      select part.value
      from regexp_split_to_table(p_value #>> '{}', '[,;\n\r]+')
        with ordinality part(value, ordinality)
      order by part.ordinality
    loop
      v_value := logistics_core.canonical_goods_type_item(v_source_text);
      if v_value is not null and not (v_value = any(v_seen)) then
        v_seen := array_append(v_seen, v_value);
        v_result := v_result || jsonb_build_array(v_value);
      end if;
    end loop;
    if '종합상품' = any(v_seen) and cardinality(v_seen) > 1 then
      raise exception using
        errcode = 'PT422',
        message = 'GOODS_TYPE_AGGREGATE_EXCLUSIVE_REQUIRED';
    end if;
    return v_result;
  end if;

  if jsonb_typeof(p_value) = 'array' then
    for v_item in
      select item.value
      from jsonb_array_elements(p_value) with ordinality item(value, ordinality)
      order by item.ordinality
    loop
      if jsonb_typeof(v_item) <> 'string' then
        raise exception using errcode = 'PT422', message = 'GOODS_TYPE_STRING_ARRAY_REQUIRED';
      end if;
      v_value := logistics_core.canonical_goods_type_item(v_item #>> '{}');
      if v_value is not null and not (v_value = any(v_seen)) then
        v_seen := array_append(v_seen, v_value);
        v_result := v_result || jsonb_build_array(v_value);
      end if;
    end loop;
    if '종합상품' = any(v_seen) and cardinality(v_seen) > 1 then
      raise exception using
        errcode = 'PT422',
        message = 'GOODS_TYPE_AGGREGATE_EXCLUSIVE_REQUIRED';
    end if;
    return v_result;
  end if;

  raise exception using errcode = 'PT422', message = 'GOODS_TYPE_STRING_ARRAY_REQUIRED';
end;
$body$;

create temporary table rent_goods_expected_source (
  item text primary key,
  expected_count integer not null check (expected_count >= 0)
) on commit drop;

insert into rent_goods_expected_source (item, expected_count) values
  ('가구', 1),
  ('가전제품', 1),
  ('가전제품 등', 1),
  ('공산품', 3),
  ('라이프스타일 용품', 1),
  ('반도체(고가 화물)', 1),
  ('생필품', 6),
  ('식음료', 1),
  ('식품(온도)', 1),
  ('신선식품', 1),
  ('어패럴', 1),
  ('유제품', 1),
  ('유제품 등', 1),
  ('의류', 2),
  ('의류(중하중)', 1),
  ('의약품', 2),
  ('전자기기(컴퓨터 등)', 1),
  ('전체 상품 취급(풀필먼트)', 1),
  ('하중물', 29),
  ('화장품', 1),
  ('화장품 등', 1);

create temporary table rent_goods_expected_post (
  item text primary key,
  expected_count integer not null check (expected_count >= 0)
) on commit drop;

insert into rent_goods_expected_post (item, expected_count) values
  ('일상용품', 9),
  ('기타 공산품', 7),
  ('의약품', 2),
  ('의류', 5),
  ('반도체', 1),
  ('식품·음료', 7),
  ('화장품', 2),
  ('디지털·가전', 5),
  ('가구·인테리어', 2),
  ('종합상품', 1);

create temporary table rent_goods_source_backfill (
  asset_code text not null,
  tenant_name text not null,
  floor_label text not null,
  leased_area_sqm numeric(18, 2) not null,
  commencement_date date not null,
  expiry_date date,
  source_excel_row integer not null,
  expected_goods jsonb not null check (jsonb_typeof(expected_goods) = 'array'),
  primary key (asset_code, tenant_name, floor_label, leased_area_sqm, commencement_date)
) on commit drop;

-- Physical Excel row numbers are retained only in this transaction-local
-- evidence table; they are not persisted in logistics_core.
insert into rent_goods_source_backfill (
  asset_code, tenant_name, floor_label, leased_area_sqm,
  commencement_date, expiry_date, source_excel_row, expected_goods
) values
  ('A112527001', '(주)우진글로벌', '4', 6409.61, '2026-01-12', '2029-01-11', 55, '["기타 공산품"]'),
  ('A112527001', '쿠팡(주)', 'B1, 2~3', 36165.62, '2026-01-12', '2028-01-11', 53, '["기타 공산품"]'),
  ('A112527003', '아워박스(주)', 'B4~B3, 2', 18052.43, '2025-01-01', '2027-12-31', 58, '["기타 공산품"]'),
  ('A112527003', '아워박스(주)', 'B2~B1, 1', 11927.59, '2025-04-01', '2028-03-31', 59, '["기타 공산품"]'),
  ('A112642001', '삼성전자로지텍(주)', 'B2~3', 107009.56, '2024-01-01', null, 46, '["디지털·가전"]'),
  ('AP00014001', '롯데글로벌로지스(주)', 'B1, 3~4', 32768.93, '2026-01-01', '2028-12-31', 63, '["가구·인테리어", "디지털·가전"]'),
  ('A112606001', '한국머스크물류서비스(주)', 'B1, 2~3', 23211.70, '2024-06-01', '2029-05-31', 49, '["의류"]'),
  ('A112505001', '(주)아이앤피앤피', '1', 3777.00, '2025-12-11', '2032-01-31', 68, '["일상용품", "식품·음료"]'),
  ('A112505001', 'JM 로지스', '1', 4028.00, '2025-11-01', '2031-11-30', 70, '["일상용품", "식품·음료"]');

create temporary table rent_goods_v1_before on commit drop as
select document.asset_code, document.rows
from logistics_core.rent_roll document;

do $preflight$
declare
  v_document_count integer;
  v_row_count integer;
  v_match_count integer;
  v_signature record;
begin
  select count(*), coalesce(sum(jsonb_array_length(snapshot.rows)), 0)
  into v_document_count, v_row_count
  from pg_temp.rent_goods_v1_before snapshot;

  if v_document_count <> 19 then
    raise exception using errcode = 'PT422', message = 'RENT_GOODS_DOCUMENT_COUNT_MISMATCH';
  end if;
  if v_row_count <> 81 then
    raise exception using errcode = 'PT422', message = 'RENT_GOODS_ROW_COUNT_MISMATCH';
  end if;

  if exists (
    select 1
    from pg_temp.rent_goods_v1_before snapshot
    cross join lateral jsonb_array_elements(snapshot.rows) item(value)
    where not (item.value ? 'goods_type')
       or jsonb_typeof(item.value->'goods_type') <> 'array'
       or exists (
         select 1
         from jsonb_array_elements(item.value->'goods_type') goods(value)
         where jsonb_typeof(goods.value) <> 'string'
            or btrim(goods.value #>> '{}') = ''
       )
  ) then
    raise exception using errcode = 'PT422', message = 'GOODS_TYPE_STRING_ARRAY_REQUIRED';
  end if;

  if exists (
    with actual as (
      select goods.value #>> '{}' as item, count(*)::integer as actual_count
      from pg_temp.rent_goods_v1_before snapshot
      cross join lateral jsonb_array_elements(snapshot.rows) row_item(value)
      cross join lateral jsonb_array_elements(row_item.value->'goods_type') goods(value)
      group by goods.value #>> '{}'
    )
    select 1
    from pg_temp.rent_goods_expected_source expected
    full join actual using (item)
    where expected.expected_count is distinct from actual.actual_count
  ) then
    raise exception using errcode = 'PT422', message = 'RENT_GOODS_SOURCE_DISTRIBUTION_MISMATCH';
  end if;

  select count(*) into v_match_count
  from pg_temp.rent_goods_v1_before snapshot
  cross join lateral jsonb_array_elements(snapshot.rows) item(value)
  where item.value->'goods_type' ? '전체 상품 취급(풀필먼트)';

  if v_match_count <> 1 or exists (
    select 1
    from pg_temp.rent_goods_v1_before snapshot
    cross join lateral jsonb_array_elements(snapshot.rows) item(value)
    where item.value->'goods_type' ? '전체 상품 취급(풀필먼트)'
      and jsonb_array_length(item.value->'goods_type') <> 1
  ) then
    raise exception using errcode = 'PT422', message = 'RENT_GOODS_AGGREGATE_SOURCE_NOT_EXCLUSIVE';
  end if;

  for v_signature in select * from pg_temp.rent_goods_source_backfill loop
    select count(*) into v_match_count
    from pg_temp.rent_goods_v1_before snapshot
    cross join lateral jsonb_array_elements(snapshot.rows) item(value)
    where snapshot.asset_code = v_signature.asset_code
      and item.value->>'tenant_name' = v_signature.tenant_name
      and item.value->>'floor_label' = v_signature.floor_label
      and round((item.value->>'leased_area_sqm')::numeric, 2) = v_signature.leased_area_sqm
      and (item.value->>'commencement_date')::date = v_signature.commencement_date
      and (nullif(item.value->>'expiry_date', ''))::date is not distinct from v_signature.expiry_date;

    if v_match_count <> 1 then
      raise exception using errcode = 'PT422', message = 'RENT_GOODS_SOURCE_BACKFILL_SIGNATURE_MISMATCH';
    end if;

    select count(*) into v_match_count
    from pg_temp.rent_goods_v1_before snapshot
    cross join lateral jsonb_array_elements(snapshot.rows) item(value)
    where snapshot.asset_code = v_signature.asset_code
      and item.value->>'tenant_name' = v_signature.tenant_name
      and item.value->>'floor_label' = v_signature.floor_label
      and round((item.value->>'leased_area_sqm')::numeric, 2) = v_signature.leased_area_sqm
      and (item.value->>'commencement_date')::date = v_signature.commencement_date
      and (nullif(item.value->>'expiry_date', ''))::date is not distinct from v_signature.expiry_date
      and item.value->'goods_type' = '[]'::jsonb;

    if v_match_count <> 1 then
      raise exception using errcode = 'PT422', message = 'RENT_GOODS_SOURCE_BACKFILL_VALUE_MISMATCH';
    end if;
  end loop;
end;
$preflight$;

create temporary table rent_goods_v1_target on commit drop as
select snapshot.asset_code,
  coalesce((
    select jsonb_agg(
      jsonb_set(
        item.value,
        '{goods_type}',
        coalesce(
          (
            select signature.expected_goods
            from pg_temp.rent_goods_source_backfill signature
            where signature.asset_code = snapshot.asset_code
              and item.value->>'tenant_name' = signature.tenant_name
              and item.value->>'floor_label' = signature.floor_label
              and round((item.value->>'leased_area_sqm')::numeric, 2) = signature.leased_area_sqm
              and (item.value->>'commencement_date')::date = signature.commencement_date
              and (nullif(item.value->>'expiry_date', ''))::date is not distinct from signature.expiry_date
              and item.value->'goods_type' = '[]'::jsonb
          ),
          logistics_core.normalize_goods_type(item.value->'goods_type')
        ),
        true
      )
      order by item.ordinality
    )
    from jsonb_array_elements(snapshot.rows) with ordinality item(value, ordinality)
  ), '[]'::jsonb) as rows
from pg_temp.rent_goods_v1_before snapshot;

do $target_validation$
begin
  if exists (
    select 1
    from pg_temp.rent_goods_v1_before before_document
    join pg_temp.rent_goods_v1_target target_document using (asset_code)
    where jsonb_array_length(before_document.rows) <> jsonb_array_length(target_document.rows)
  ) then
    raise exception using errcode = 'PT500', message = 'RENT_GOODS_ROW_ORDER_CHANGED';
  end if;

  if exists (
    select 1
    from pg_temp.rent_goods_v1_before before_document
    join pg_temp.rent_goods_v1_target target_document using (asset_code)
    cross join lateral jsonb_array_elements(before_document.rows)
      with ordinality before_item(value, ordinality)
    cross join lateral jsonb_array_elements(target_document.rows)
      with ordinality after_item(value, ordinality)
    where before_item.ordinality = after_item.ordinality
      and (before_item.value - 'goods_type') is distinct from (after_item.value - 'goods_type')
  ) then
    raise exception using errcode = 'PT500', message = 'RENT_GOODS_NON_GOODS_DATA_CHANGED';
  end if;
end;
$target_validation$;

update logistics_core.rent_roll document
set rows = target.rows
from pg_temp.rent_goods_v1_target target
where document.asset_code = target.asset_code
  and document.rows is distinct from target.rows;

do $readback$
declare
  v_document_count integer;
  v_row_count integer;
  v_match_count integer;
  v_signature record;
begin
  if exists (
    select 1
    from pg_temp.rent_goods_v1_target target
    full join logistics_core.rent_roll document using (asset_code)
    where target.rows is distinct from document.rows
  ) then
    raise exception using errcode = 'PT500', message = 'RENT_GOODS_READBACK_MISMATCH';
  end if;

  select count(*), coalesce(sum(jsonb_array_length(document.rows)), 0)
  into v_document_count, v_row_count
  from logistics_core.rent_roll document;

  if v_document_count <> 19 or v_row_count <> 81 then
    raise exception using errcode = 'PT500', message = 'RENT_GOODS_ROW_ORDER_CHANGED';
  end if;

  if exists (
    with actual as (
      select goods.value #>> '{}' as item, count(*)::integer as actual_count
      from logistics_core.rent_roll document
      cross join lateral jsonb_array_elements(document.rows) row_item(value)
      cross join lateral jsonb_array_elements(row_item.value->'goods_type') goods(value)
      group by goods.value #>> '{}'
    )
    select 1
    from pg_temp.rent_goods_expected_post expected
    full join actual using (item)
    where expected.expected_count is distinct from actual.actual_count
  ) then
    raise exception using errcode = 'PT500', message = 'RENT_GOODS_POST_DISTRIBUTION_MISMATCH';
  end if;

  select count(*) into v_match_count
  from logistics_core.rent_roll document
  cross join lateral jsonb_array_elements(document.rows) item(value)
  where item.value->'goods_type' ? '종합상품';

  if v_match_count <> 1 or exists (
    select 1
    from logistics_core.rent_roll document
    cross join lateral jsonb_array_elements(document.rows) item(value)
    where item.value->'goods_type' ? '종합상품'
      and jsonb_array_length(item.value->'goods_type') <> 1
  ) then
    raise exception using errcode = 'PT500', message = 'RENT_GOODS_AGGREGATE_POST_NOT_EXCLUSIVE';
  end if;

  if exists (
    select 1
    from logistics_core.rent_roll document
    cross join lateral jsonb_array_elements(document.rows) item(value)
    where logistics_core.normalize_goods_type(item.value->'goods_type')
      is distinct from item.value->'goods_type'
  ) then
    raise exception using errcode = 'PT500', message = 'RENT_GOODS_NOT_IDEMPOTENT';
  end if;

  for v_signature in select * from pg_temp.rent_goods_source_backfill loop
    select count(*) into v_match_count
    from logistics_core.rent_roll document
    cross join lateral jsonb_array_elements(document.rows) item(value)
    where document.asset_code = v_signature.asset_code
      and item.value->>'tenant_name' = v_signature.tenant_name
      and item.value->>'floor_label' = v_signature.floor_label
      and round((item.value->>'leased_area_sqm')::numeric, 2) = v_signature.leased_area_sqm
      and (item.value->>'commencement_date')::date = v_signature.commencement_date
      and (nullif(item.value->>'expiry_date', ''))::date is not distinct from v_signature.expiry_date
      and item.value->'goods_type' = v_signature.expected_goods;

    if v_match_count <> 1 then
      raise exception using errcode = 'PT500', message = 'RENT_GOODS_SOURCE_BACKFILL_VALUE_MISMATCH';
    end if;
  end loop;
end;
$readback$;

revoke all on function logistics_core.canonical_goods_type_item(text)
  from public, anon, authenticated;
revoke all on function logistics_core.normalize_goods_type(jsonb)
  from public, anon, authenticated;

do $contract_readback$
begin
  if to_regprocedure('logistics_core.canonical_goods_type_item(text)') is null
     or to_regprocedure('logistics_core.normalize_goods_type(jsonb)') is null then
    raise exception using errcode = 'PT500', message = 'RENT_GOODS_CANONICAL_FUNCTION_MISSING';
  end if;

  perform logistics_core.assert_rent_rows_document_valid(document.rows)
  from logistics_core.rent_roll document;
end;
$contract_readback$;

notify pgrst, 'reload schema';

commit;
