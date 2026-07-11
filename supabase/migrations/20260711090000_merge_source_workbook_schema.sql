begin;

alter table public.ll_source_files
  add column if not exists workbook_schema jsonb not null default '{}'::jsonb;

with sheet_columns as (
  select
    s.source_file_id,
    s.source_sheet_id,
    jsonb_agg(
      jsonb_build_object(
        'column_index', c.column_index,
        'column_letter', c.column_letter,
        'header_label', c.header_label,
        'normalized_header', c.normalized_header,
        'value_type', c.value_type,
        'unit_label', c.unit_label,
        'target_table', c.target_table,
        'target_field', c.target_field,
        'edit_group', c.edit_group,
        'is_required', c.is_required,
        'is_user_editable', c.is_user_editable,
        'metadata', coalesce(c.metadata, '{}'::jsonb)
      )
      order by c.column_index
    ) as columns_json
  from public.ll_source_sheets s
  left join public.ll_source_columns c
    on c.source_sheet_id = s.source_sheet_id
  group by s.source_file_id, s.source_sheet_id
),
sheet_payload as (
  select
    s.source_file_id,
    jsonb_agg(
      jsonb_build_object(
        'sheet_name', s.sheet_name,
        'sheet_index', s.sheet_index,
        'header_row_number', s.header_row_number,
        'first_data_row_number', s.first_data_row_number,
        'last_row_number', s.last_row_number,
        'column_count', s.column_count,
        'row_count', s.row_count,
        'sheet_hash', s.sheet_hash,
        'metadata', coalesce(s.metadata, '{}'::jsonb),
        'columns', coalesce(sc.columns_json, '[]'::jsonb)
      )
      order by s.sheet_index
    ) as sheets_json
  from public.ll_source_sheets s
  left join sheet_columns sc
    on sc.source_sheet_id = s.source_sheet_id
  group by s.source_file_id
)
update public.ll_source_files f
set workbook_schema = jsonb_build_object(
  'schema_version', 'll_source_workbook_schema_v1',
  'sheets', coalesce(sp.sheets_json, '[]'::jsonb)
)
from sheet_payload sp
where sp.source_file_id = f.source_file_id
  and (
    f.workbook_schema = '{}'::jsonb
    or coalesce(jsonb_typeof(f.workbook_schema->'sheets'), '') <> 'array'
    or jsonb_array_length(coalesce(f.workbook_schema->'sheets', '[]'::jsonb)) = 0
  );

commit;
