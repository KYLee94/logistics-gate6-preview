-- Gate 6 market research RAG source tables.
-- Additive only: market documents are stored separately from operational ll_* data.

begin;

create extension if not exists pg_trgm with schema public;

create table if not exists public.ll_market_documents (
  document_id uuid primary key default gen_random_uuid(),
  source_hash text not null unique,
  file_name text not null,
  file_path text,
  publisher text,
  report_title text,
  source_type text not null check (source_type in ('pdf', 'xlsx', 'xlsx_sheet', 'xlsx_rowset')),
  report_period text,
  as_of_date date,
  access_level text not null default 'market_research',
  extraction_status text not null default 'ready',
  extraction_method text,
  ocr_quality_score numeric,
  page_count integer,
  sheet_count integer,
  row_count integer,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ll_market_chunks (
  chunk_id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.ll_market_documents(document_id) on delete cascade,
  source_hash text not null,
  chunk_key text not null unique,
  chunk_type text not null,
  source_locator jsonb not null default '{}'::jsonb,
  page_number integer,
  sheet_name text,
  row_start integer,
  row_end integer,
  content text not null,
  keywords text[] not null default '{}'::text[],
  extraction_status text not null default 'ready',
  ocr_quality_score numeric,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ll_market_facts (
  fact_id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.ll_market_documents(document_id) on delete cascade,
  source_hash text not null,
  fact_key text not null unique,
  fact_type text not null check (fact_type in ('transaction', 'supply_pipeline', 'market_metric', 'definition', 'caveat')),
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
  source_locator jsonb not null default '{}'::jsonb,
  data_quality_flags jsonb not null default '[]'::jsonb,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.ll_market_documents enable row level security;
alter table public.ll_market_chunks enable row level security;
alter table public.ll_market_facts enable row level security;

create index if not exists ll_market_documents_source_type_idx
  on public.ll_market_documents(source_type, extraction_status, as_of_date desc);

create index if not exists ll_market_documents_access_idx
  on public.ll_market_documents(access_level, updated_at desc);

create index if not exists ll_market_chunks_document_idx
  on public.ll_market_chunks(document_id, chunk_type, page_number, row_start);

create index if not exists ll_market_chunks_content_trgm_idx
  on public.ll_market_chunks using gin (content gin_trgm_ops);

create index if not exists ll_market_facts_type_period_idx
  on public.ll_market_facts(fact_type, year, quarter, region);

create index if not exists ll_market_facts_metric_idx
  on public.ll_market_facts(metric_code, metric_name, year, quarter, region);

create index if not exists ll_market_facts_asset_idx
  on public.ll_market_facts(asset_name, building_name, region);

grant select, insert, update, delete on public.ll_market_documents to service_role;
grant select, insert, update, delete on public.ll_market_chunks to service_role;
grant select, insert, update, delete on public.ll_market_facts to service_role;

insert into public.ll_schema_metadata (
  metadata_key, object_type, table_schema, table_name, column_name, domain_group, role_category, description, is_active, updated_at
)
values
  ('public.ll_market_documents', 'table', 'public', 'll_market_documents', null, 'Market Research', 'source_registry', 'Market report and workbook file registry for Gate 6 chatbot retrieval.', true, now()),
  ('public.ll_market_chunks', 'table', 'public', 'll_market_chunks', null, 'Market Research', 'retrieval_chunk', 'Searchable market report text chunks with page/sheet source locators.', true, now()),
  ('public.ll_market_facts', 'table', 'public', 'll_market_facts', null, 'Market Research', 'structured_fact', 'Structured market metrics, transactions, and supply pipeline facts extracted from market workbooks.', true, now())
on conflict (metadata_key) do update set
  domain_group = excluded.domain_group,
  role_category = excluded.role_category,
  description = excluded.description,
  is_active = true,
  updated_at = now();

update public.ll_user_permissions
set feature_permissions = coalesce(feature_permissions, '{}'::jsonb) || jsonb_build_object('market_research', true),
    updated_at = now()
where lower(email) in ('kylee@igisam.com', 'sjlee@igisam.com', 'jk.jeon@igisam.com');

commit;
