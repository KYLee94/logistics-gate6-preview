alter table public.ll_sector_market_cap_rate_series
  drop constraint if exists ll_sector_market_cap_rate_ser_source_file_id_report_year_re_key;

comment on table public.ll_sector_market_cap_rate_series is
  'Quarterly logistics sector cap-rate observations from source workbooks. Source-row uniqueness is authoritative because a workbook can contain multiple observations in the same report quarter.';
