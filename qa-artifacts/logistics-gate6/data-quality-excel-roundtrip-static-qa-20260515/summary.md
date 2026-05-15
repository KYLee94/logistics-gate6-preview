# Data Quality Excel roundtrip static QA - 2026-05-15

- pass: 9
- fail: 0
- allPass: true

| check | status | detail |
|---|---|---|
| one_sheet_upload_required | pass | Excel roundtrip upload must reject workbooks that are not exactly one sheet. |
| relation_key_columns_required | pass | Upload must require hidden relation-key columns so Supabase mapping is preserved. |
| exclusive_area_exported | pass | Excel export must include exclusive area so 경산 전용면적-type corrections can be handled. |
| source_excel_headers_visible | pass | Excel export must expose source sheet/header and a human-readable row identifier. |
| db_general_and_history_fields_exported | pass | Excel export must cover both original DB_일반 and DB_히스토리 누적 style fields. |
| display_value_for_user | pass | Excel export must include a Korean/user-readable display value beside raw DB value. |
| upload_blocks_broken_relation_keys | pass | Upload must block rows with broken target table, row id, or field name instead of silently dropping them. |
| upload_blocks_selected_asset_scope_escape | pass | Upload must block rows outside the selected asset scope. |
| upload_row_limit | pass | Upload must enforce a row limit to avoid accidental massive submissions. |
