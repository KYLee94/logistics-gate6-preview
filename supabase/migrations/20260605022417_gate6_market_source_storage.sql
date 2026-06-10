-- Gate 6 market research source file storage.
-- Original source files are preserved in a private Supabase Storage bucket.

begin;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'll-market-sources',
  'll-market-sources',
  false,
  104857600,
  array[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'text/plain',
    'application/octet-stream'
  ]
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types,
  updated_at = now();

alter table public.ll_market_documents
  add column if not exists storage_bucket text,
  add column if not exists storage_path text,
  add column if not exists original_size_bytes bigint,
  add column if not exists source_preservation_status text not null default 'not_uploaded',
  add column if not exists extracted_char_count integer,
  add column if not exists extracted_text_hash text;

create index if not exists ll_market_documents_storage_idx
  on public.ll_market_documents(storage_bucket, storage_path);

create index if not exists ll_market_documents_preservation_idx
  on public.ll_market_documents(source_preservation_status, updated_at desc);

insert into public.ll_schema_metadata (
  metadata_key, object_type, table_schema, table_name, column_name, domain_group, role_category, description, is_active, updated_at
)
values
  ('public.ll_market_documents.storage_bucket', 'column', 'public', 'll_market_documents', 'storage_bucket', 'Market Research', 'source_archive', 'Private Supabase Storage bucket that preserves the original uploaded market source file.', true, now()),
  ('public.ll_market_documents.storage_path', 'column', 'public', 'll_market_documents', 'storage_path', 'Market Research', 'source_archive', 'Private Supabase Storage object path for the original market source file.', true, now()),
  ('public.ll_market_documents.original_size_bytes', 'column', 'public', 'll_market_documents', 'original_size_bytes', 'Market Research', 'source_archive', 'Original source file size in bytes for preservation/readback checks.', true, now()),
  ('public.ll_market_documents.source_preservation_status', 'column', 'public', 'll_market_documents', 'source_preservation_status', 'Market Research', 'source_archive', 'Whether the original source file is preserved in Supabase Storage.', true, now()),
  ('public.ll_market_documents.extracted_char_count', 'column', 'public', 'll_market_documents', 'extracted_char_count', 'Market Research', 'retrieval_quality', 'Character count of text extracted for chatbot retrieval; not a substitute for original-file preservation.', true, now()),
  ('public.ll_market_documents.extracted_text_hash', 'column', 'public', 'll_market_documents', 'extracted_text_hash', 'Market Research', 'retrieval_quality', 'Hash of extracted text/chunk content used to detect extraction drift.', true, now())
on conflict (metadata_key) do update set
  domain_group = excluded.domain_group,
  role_category = excluded.role_category,
  description = excluded.description,
  is_active = true,
  updated_at = now();

commit;
