-- RENT_ROLL_FLOOR_SOURCE_BACKFILL_20260810
-- SDD source contract:
--   * authoritative workbook: ★ 260414_물류센터 임대차계약 DB_취합본.xlsx / DB_일반
--   * exact operating scope before change: 19 documents, 81 rows, 20 blank floor labels
--   * 19 blank rows have one source row each; 부산송정 vacant row has source floor '-' and stays blank
--   * the only permanent mutation is rows[*].floor_label on those 19 exact signatures
-- PostgreSQL migrations are transactional. Any failed assertion rolls the whole change back.

begin;

do $floor_backfill$
declare
  v_bad_count bigint;
  v_blank_count bigint;
  v_document_count bigint;
  v_match_count bigint;
  v_total_count bigint;
begin
  create temporary table floor_backfill_mapping (
    mapping_order integer primary key,
    asset_code text not null,
    tenant_name text not null,
    business_registration_number text not null,
    leased_area_sqm numeric not null,
    commencement_date text not null,
    expiry_date text not null,
    zone_label text not null,
    target_floor text not null,
    source_excel_row integer not null
  ) on commit drop;

  insert into floor_backfill_mapping (
    mapping_order,
    asset_code,
    tenant_name,
    business_registration_number,
    leased_area_sqm,
    commencement_date,
    expiry_date,
    zone_label,
    target_floor,
    source_excel_row
  ) values
    (1,  'A120085001', '쿠팡(주)', '120-88-00767', 2304.76,   '2024-08-01', '2030-05-01', '',            'B1',          39),
    (2,  'A120085001', '쿠팡(주)', '120-88-00767', 10914.64,  '2024-08-01', '2030-05-01', '',            'B2',          41),
    (3,  'A112527001', '쿠팡(주)', '120-88-00767', 36165.62,  '2026-01-12', '2028-01-11', '',            'B1, 2~3',     52),
    (4,  'A112527001', '송림물류(주)', '126-81-93358', 5898.23, '2026-01-12', '2029-01-11', '',          'B1',          53),
    (5,  'A112755001', 'LG전자(주), ㈜엘엑스판토스', '107-86-14075 / 116-81-31734', 54566.21, '2023-12-16', '2026-12-15', '', '1~4', 51),
    (6,  'A112527002', '(주)한익스프레스', '130-81-16025', 18706.18, '2026-01-01', '2026-12-31', '',      '1~3',         56),
    (7,  'A112299001', '쿠팡(주)', '120-88-00767', 24706.57,  '2025-04-02', '2029-04-01', '스카이박스2', '1~2',         22),
    (8,  'A112505001', '(주)휠라선', '488-81-01794', 12572,    '2025-04-08', '2028-12-31', '',            'B2',          70),
    (9,  'AP00014001', '롯데글로벌로지스(주)', '102-81-23012', 32768.93, '2026-01-01', '2028-12-31', '', 'B1, 3~4',     62),
    (10, 'AP00014001', '(주)에이스코리아로지스', '312-86-20956', 10910.3, '2025-03-17', '2027-05-16', '', 'B2',          59),
    (11, 'A112500003', '홈플러스(주)', '220-81-60348', 32824.14, '2012-12-21', '2032-12-20', '',          '1~2',         44),
    (12, 'S00002001', '(주)한진', '201-81-02823', 8688,        '2026-04-17', '2029-04-16', '',            'B1',          73),
    (13, 'A112527003', '아워박스(주)', '358-81-00820', 18052.43, '2025-01-01', '2027-12-31', '',          'B4~B3, 2',    57),
    (14, 'A112527003', '아워박스(주)', '358-81-00820', 11927.59, '2025-04-01', '2028-03-31', '',          'B2~B1, 1',    58),
    (15, 'A112606001', '한국머스크물류서비스(주)', '101-86-54822', 23211.7, '2024-06-01', '2029-05-31', '', 'B1, 2~3',   48),
    (16, 'A112606001', '(주)버킷플레이스', '119-86-91245', 38300.04, '2024-11-01', '2030-02-28', '',       'B2~B1',       47),
    (17, 'A112606001', '굿앤파트너스(주)', '897-86-00825', 16453.61, '2025-07-15', '2028-11-30', '',        '3~4',         50),
    (18, 'A112573001', '(주)한진', '201-81-02823', 11660.69,   '2026-04-10', '2029-04-17', '',            'B2',          63),
    (19, 'A112642001', '삼성전자로지텍(주)', '124-81-55381', 107009.56, '2024-01-01', '', '',             'B2~3',        45);

  select count(*) into v_match_count from floor_backfill_mapping;
  if v_match_count <> 19 then
    raise exception using errcode = 'PT422', message = 'RENT_ROLL_FLOOR_MAPPING_COUNT_MISMATCH';
  end if;

  create temporary table floor_backfill_snapshot on commit drop as
  select asset_code, rows
  from logistics_core.rent_roll;

  select count(*) into v_document_count from floor_backfill_snapshot;
  if v_document_count <> 19 then
    raise exception using errcode = 'PT422', message = 'RENT_ROLL_FLOOR_DOCUMENT_COUNT_MISMATCH';
  end if;

  select coalesce(sum(jsonb_array_length(rows)), 0)
  into v_total_count
  from floor_backfill_snapshot;
  if v_total_count <> 81 then
    raise exception using errcode = 'PT422', message = 'RENT_ROLL_FLOOR_TOTAL_COUNT_MISMATCH';
  end if;

  select count(*)
  into v_blank_count
  from floor_backfill_snapshot snapshot
  cross join lateral jsonb_array_elements(snapshot.rows) row_element(row_before)
  where coalesce(btrim(row_before->>'floor_label'), '') = '';
  if v_blank_count <> 20 then
    raise exception using errcode = 'PT422', message = 'RENT_ROLL_FLOOR_BLANK_COUNT_MISMATCH';
  end if;

  create temporary table floor_backfill_matches on commit drop as
  select
    mapping.mapping_order,
    snapshot.asset_code,
    row_element.ordinality::integer as row_ordinality,
    row_element.row_before,
    mapping.target_floor
  from floor_backfill_mapping mapping
  join floor_backfill_snapshot snapshot
    on snapshot.asset_code = mapping.asset_code
  cross join lateral jsonb_array_elements(snapshot.rows) with ordinality
    as row_element(row_before, ordinality)
  where coalesce(btrim(row_element.row_before->>'floor_label'), '') = ''
    and btrim(coalesce(row_element.row_before->>'tenant_name', '')) = mapping.tenant_name
    and btrim(coalesce(row_element.row_before->>'business_registration_number', '')) = mapping.business_registration_number
    and case
      when jsonb_typeof(row_element.row_before->'leased_area_sqm') = 'number'
        then round((row_element.row_before->>'leased_area_sqm')::numeric, 2)
      else null
    end = round(mapping.leased_area_sqm, 2)
    and btrim(coalesce(row_element.row_before->>'commencement_date', '')) = mapping.commencement_date
    and btrim(coalesce(row_element.row_before->>'expiry_date', '')) = mapping.expiry_date
    and btrim(coalesce(row_element.row_before->>'zone_label', '')) = mapping.zone_label;

  select count(*)
  into v_bad_count
  from (
    select mapping.mapping_order
    from floor_backfill_mapping mapping
    left join floor_backfill_matches match
      on match.mapping_order = mapping.mapping_order
    group by mapping.mapping_order
    having count(match.mapping_order) <> 1
  ) invalid_mapping;
  if v_bad_count <> 0 then
    raise exception using errcode = 'PT422', message = 'RENT_ROLL_FLOOR_SIGNATURE_NOT_UNIQUE';
  end if;

  select count(*) into v_match_count from floor_backfill_matches;
  if v_match_count <> 19
    or (select count(*) from (select distinct asset_code, row_ordinality from floor_backfill_matches) distinct_rows) <> 19
  then
    raise exception using errcode = 'PT422', message = 'RENT_ROLL_FLOOR_MAPPING_CARDINALITY_MISMATCH';
  end if;

  select count(*)
  into v_bad_count
  from floor_backfill_snapshot snapshot
  cross join lateral jsonb_array_elements(snapshot.rows) with ordinality
    as row_element(row_before, ordinality)
  left join floor_backfill_matches match
    on match.asset_code = snapshot.asset_code
   and match.row_ordinality = row_element.ordinality
  where coalesce(btrim(row_element.row_before->>'floor_label'), '') = ''
    and match.mapping_order is null
    and not (
      snapshot.asset_code = 'A112109001'
      and btrim(coalesce(row_element.row_before->>'tenant_name', '')) = '-'
      and jsonb_typeof(row_element.row_before->'leased_area_sqm') = 'number'
      and round((row_element.row_before->>'leased_area_sqm')::numeric, 2) = 23729.34
      and btrim(coalesce(row_element.row_before->>'commencement_date', '')) = ''
      and btrim(coalesce(row_element.row_before->>'expiry_date', '')) = ''
      and btrim(coalesce(row_element.row_before->>'zone_label', '')) = ''
    );
  if v_bad_count <> 0 then
    raise exception using errcode = 'PT422', message = 'RENT_ROLL_FLOOR_UNMAPPED_BLANK_MISMATCH';
  end if;

  select count(*)
  into v_bad_count
  from floor_backfill_snapshot snapshot
  cross join lateral jsonb_array_elements(snapshot.rows) row_element(row_before)
  where snapshot.asset_code = 'A112109001'
    and coalesce(btrim(row_element.row_before->>'floor_label'), '') = ''
    and btrim(coalesce(row_element.row_before->>'tenant_name', '')) = '-'
    and jsonb_typeof(row_element.row_before->'leased_area_sqm') = 'number'
    and round((row_element.row_before->>'leased_area_sqm')::numeric, 2) = 23729.34
    and btrim(coalesce(row_element.row_before->>'commencement_date', '')) = ''
    and btrim(coalesce(row_element.row_before->>'expiry_date', '')) = ''
    and btrim(coalesce(row_element.row_before->>'zone_label', '')) = '';
  if v_bad_count <> 1 then
    raise exception using errcode = 'PT422', message = 'RENT_ROLL_FLOOR_BUSAN_BLANK_MISMATCH';
  end if;

  update logistics_core.rent_roll rent_roll_document
  set rows = (
    select jsonb_agg(
      case
        when match.mapping_order is not null
          then jsonb_set(row_element.row_before, '{floor_label}', to_jsonb(match.target_floor), true)
        else row_element.row_before
      end
      order by row_element.ordinality
    ) as rows_after
    from jsonb_array_elements(rent_roll_document.rows) with ordinality
      as row_element(row_before, ordinality)
    left join floor_backfill_matches match
      on match.asset_code = rent_roll_document.asset_code
     and match.row_ordinality = row_element.ordinality
  )
  where exists (
    select 1
    from floor_backfill_matches match
    where match.asset_code = rent_roll_document.asset_code
  );

  select count(*) into v_document_count from logistics_core.rent_roll;
  if v_document_count <> 19 then
    raise exception using errcode = 'PT422', message = 'RENT_ROLL_FLOOR_DOCUMENT_READBACK_MISMATCH';
  end if;

  select coalesce(sum(jsonb_array_length(rows)), 0)
  into v_total_count
  from logistics_core.rent_roll;
  if v_total_count <> 81 then
    raise exception using errcode = 'PT422', message = 'RENT_ROLL_FLOOR_TOTAL_READBACK_MISMATCH';
  end if;

  select count(*)
  into v_bad_count
  from floor_backfill_snapshot snapshot
  full join logistics_core.rent_roll current_document
    on current_document.asset_code = snapshot.asset_code
  where snapshot.asset_code is null
     or current_document.asset_code is null
     or jsonb_array_length(snapshot.rows) <> jsonb_array_length(current_document.rows);
  if v_bad_count <> 0 then
    raise exception using errcode = 'PT422', message = 'RENT_ROLL_FLOOR_DOCUMENT_SHAPE_MUTATION';
  end if;

  create temporary table floor_backfill_readback on commit drop as
  select
    snapshot.asset_code,
    row_before.ordinality::integer as row_ordinality,
    row_before.row_before,
    row_after.row_after,
    match.mapping_order,
    match.target_floor
  from floor_backfill_snapshot snapshot
  join logistics_core.rent_roll current_document
    on current_document.asset_code = snapshot.asset_code
  cross join lateral jsonb_array_elements(snapshot.rows) with ordinality
    as row_before(row_before, ordinality)
  join lateral jsonb_array_elements(current_document.rows) with ordinality
    as row_after(row_after, ordinality)
    on row_after.ordinality = row_before.ordinality
  left join floor_backfill_matches match
    on match.asset_code = snapshot.asset_code
   and match.row_ordinality = row_before.ordinality;

  select count(*)
  into v_bad_count
  from floor_backfill_readback
  where (row_before - 'floor_label') is distinct from (row_after - 'floor_label');
  if v_bad_count <> 0 then
    raise exception using errcode = 'PT422', message = 'RENT_ROLL_FLOOR_NON_FLOOR_MUTATION';
  end if;

  select count(*)
  into v_bad_count
  from floor_backfill_readback
  where mapping_order is null
    and row_before is distinct from row_after;
  if v_bad_count <> 0 then
    raise exception using errcode = 'PT422', message = 'RENT_ROLL_FLOOR_NON_TARGET_MUTATION';
  end if;

  select count(*)
  into v_bad_count
  from floor_backfill_readback
  where mapping_order is not null
    and (
      coalesce(btrim(row_before->>'floor_label'), '') <> ''
      or row_after->>'floor_label' is distinct from target_floor
      or (row_before - 'floor_label') is distinct from (row_after - 'floor_label')
    );
  if v_bad_count <> 0
    or (select count(*) from floor_backfill_readback where mapping_order is not null) <> 19
  then
    raise exception using errcode = 'PT422', message = 'RENT_ROLL_FLOOR_READBACK_MISMATCH';
  end if;

  select count(*)
  into v_blank_count
  from logistics_core.rent_roll current_document
  cross join lateral jsonb_array_elements(current_document.rows) row_element(row_after)
  where coalesce(btrim(row_after->>'floor_label'), '') = '';
  if v_blank_count <> 1 then
    raise exception using errcode = 'PT422', message = 'RENT_ROLL_FLOOR_FINAL_BLANK_COUNT_MISMATCH';
  end if;

  select count(*)
  into v_bad_count
  from logistics_core.rent_roll current_document
  cross join lateral jsonb_array_elements(current_document.rows) row_element(row_after)
  where coalesce(btrim(row_after->>'floor_label'), '') = ''
    and not (
      current_document.asset_code = 'A112109001'
      and btrim(coalesce(row_after->>'tenant_name', '')) = '-'
      and jsonb_typeof(row_after->'leased_area_sqm') = 'number'
      and round((row_after->>'leased_area_sqm')::numeric, 2) = 23729.34
    );
  if v_bad_count <> 0 then
    raise exception using errcode = 'PT422', message = 'RENT_ROLL_FLOOR_BUSAN_BLANK_MISMATCH';
  end if;
end;
$floor_backfill$;

commit;
