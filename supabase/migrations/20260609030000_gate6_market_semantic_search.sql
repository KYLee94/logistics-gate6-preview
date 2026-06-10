-- Gate 6 market research semantic search support.
-- Additive only: extends existing market RAG tables without changing operational ll_* data.

begin;

create extension if not exists vector with schema extensions;

alter table public.ll_market_chunks
  add column if not exists embedding extensions.vector(768),
  add column if not exists embedding_model text,
  add column if not exists embedding_dim integer,
  add column if not exists embedding_status text not null default 'not_generated',
  add column if not exists embedding_updated_at timestamptz;

alter table public.ll_market_documents
  add column if not exists extracted_text_storage_bucket text,
  add column if not exists extracted_text_storage_path text;

alter table public.ll_market_facts
  add column if not exists embedding extensions.vector(768),
  add column if not exists embedding_model text,
  add column if not exists embedding_dim integer,
  add column if not exists embedding_status text not null default 'not_generated',
  add column if not exists embedding_updated_at timestamptz;

create index if not exists ll_market_chunks_embedding_hnsw_idx
  on public.ll_market_chunks
  using hnsw (embedding extensions.vector_cosine_ops)
  where embedding is not null;

create index if not exists ll_market_facts_embedding_hnsw_idx
  on public.ll_market_facts
  using hnsw (embedding extensions.vector_cosine_ops)
  where embedding is not null;

create index if not exists ll_market_documents_extracted_text_storage_idx
  on public.ll_market_documents(extracted_text_storage_bucket, extracted_text_storage_path);

create or replace function public.match_ll_market_chunks(
  query_embedding extensions.vector(768),
  match_count integer default 12,
  match_threshold double precision default 0.25,
  filter_publishers text[] default null,
  filter_years integer[] default null
)
returns table (
  source_hash text,
  file_name text,
  publisher text,
  report_title text,
  report_period text,
  as_of_date date,
  source_type text,
  extraction_status text,
  chunk_type text,
  source_locator jsonb,
  page_number integer,
  sheet_name text,
  row_start integer,
  row_end integer,
  content text,
  ocr_quality_score numeric,
  similarity double precision
)
language sql
stable
as $$
  select
    c.source_hash,
    d.file_name,
    d.publisher,
    d.report_title,
    d.report_period,
    d.as_of_date,
    d.source_type,
    c.extraction_status,
    c.chunk_type,
    c.source_locator,
    c.page_number,
    c.sheet_name,
    c.row_start,
    c.row_end,
    c.content,
    c.ocr_quality_score,
    1 - (c.embedding operator(extensions.<=>) query_embedding) as similarity
  from public.ll_market_chunks c
  join public.ll_market_documents d on d.source_hash = c.source_hash
  where c.embedding is not null
    and 1 - (c.embedding operator(extensions.<=>) query_embedding) >= match_threshold
    and (
      filter_publishers is null
      or cardinality(filter_publishers) = 0
      or lower(coalesce(d.publisher, '')) = any(filter_publishers)
      or exists (
        select 1
        from unnest(filter_publishers) value
        where lower(coalesce(d.report_title, '')) like '%' || value || '%'
           or lower(coalesce(d.file_name, '')) like '%' || value || '%'
      )
    )
    and (
      filter_years is null
      or cardinality(filter_years) = 0
      or extract(year from d.as_of_date)::integer = any(filter_years)
      or substring(coalesce(d.report_period, '') from '(20[0-9]{2})')::integer = any(filter_years)
    )
  order by c.embedding operator(extensions.<=>) query_embedding
  limit least(greatest(match_count, 1), 80);
$$;

create or replace function public.match_ll_market_facts(
  query_embedding extensions.vector(768),
  match_count integer default 12,
  match_threshold double precision default 0.25,
  filter_publishers text[] default null,
  filter_years integer[] default null
)
returns table (
  source_hash text,
  file_name text,
  publisher text,
  report_title text,
  report_period text,
  as_of_date date,
  source_type text,
  fact_type text,
  metric_name text,
  metric_code text,
  period text,
  year integer,
  quarter integer,
  region text,
  submarket text,
  asset_name text,
  building_name text,
  address text,
  buyer_name text,
  seller_name text,
  numeric_value numeric,
  numeric_value2 numeric,
  unit text,
  amount_krw numeric,
  area_py numeric,
  area_sqm numeric,
  cap_rate numeric,
  fact_text text,
  source_locator jsonb,
  similarity double precision
)
language sql
stable
as $$
  select
    f.source_hash,
    d.file_name,
    d.publisher,
    d.report_title,
    d.report_period,
    d.as_of_date,
    d.source_type,
    f.fact_type,
    f.metric_name,
    f.metric_code,
    f.period,
    f.year,
    f.quarter,
    f.region,
    f.submarket,
    f.asset_name,
    f.building_name,
    f.address,
    f.buyer_name,
    f.seller_name,
    f.numeric_value,
    f.numeric_value2,
    f.unit,
    f.amount_krw,
    f.area_py,
    f.area_sqm,
    f.cap_rate,
    f.fact_text,
    f.source_locator,
    1 - (f.embedding operator(extensions.<=>) query_embedding) as similarity
  from public.ll_market_facts f
  join public.ll_market_documents d on d.source_hash = f.source_hash
  where f.embedding is not null
    and 1 - (f.embedding operator(extensions.<=>) query_embedding) >= match_threshold
    and (
      filter_publishers is null
      or cardinality(filter_publishers) = 0
      or lower(coalesce(d.publisher, '')) = any(filter_publishers)
      or exists (
        select 1
        from unnest(filter_publishers) value
        where lower(coalesce(d.report_title, '')) like '%' || value || '%'
           or lower(coalesce(d.file_name, '')) like '%' || value || '%'
      )
    )
    and (
      filter_years is null
      or cardinality(filter_years) = 0
      or f.year = any(filter_years)
      or extract(year from d.as_of_date)::integer = any(filter_years)
      or substring(coalesce(d.report_period, '') from '(20[0-9]{2})')::integer = any(filter_years)
    )
  order by f.embedding operator(extensions.<=>) query_embedding
  limit least(greatest(match_count, 1), 80);
$$;

grant execute on function public.match_ll_market_chunks(extensions.vector(768), integer, double precision, text[], integer[]) to service_role;
grant execute on function public.match_ll_market_facts(extensions.vector(768), integer, double precision, text[], integer[]) to service_role;

insert into public.ll_schema_metadata (
  metadata_key, object_type, table_schema, table_name, column_name, domain_group, role_category, description, is_active, updated_at
)
values
  ('public.ll_market_chunks.embedding', 'column', 'public', 'll_market_chunks', 'embedding', 'Market Research', 'semantic_retrieval', 'Gemini embedding vector for semantic market report chunk retrieval.', true, now()),
  ('public.ll_market_facts.embedding', 'column', 'public', 'll_market_facts', 'embedding', 'Market Research', 'semantic_retrieval', 'Gemini embedding vector for semantic market fact retrieval.', true, now()),
  ('public.ll_market_documents.extracted_text_storage_path', 'column', 'public', 'll_market_documents', 'extracted_text_storage_path', 'Market Research', 'source_archive', 'Private Supabase Storage path for extracted text JSON used by market RAG.', true, now())
on conflict (metadata_key) do update set
  domain_group = excluded.domain_group,
  role_category = excluded.role_category,
  description = excluded.description,
  is_active = true,
  updated_at = now();

commit;
