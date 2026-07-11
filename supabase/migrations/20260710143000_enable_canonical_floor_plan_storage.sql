-- Reuse the existing private canonical workbook bucket for asset floor-plan PNGs.
-- This migration deliberately creates no bucket and preserves every existing MIME type.
do $$
declare
  target_bucket_id constant text := 'logistics-sector-market-workbooks';
begin
  if not exists (
    select 1
    from storage.buckets
    where id = target_bucket_id
      and public = false
  ) then
    raise exception 'Expected private Storage bucket % does not exist', target_bucket_id;
  end if;

  update storage.buckets
  set allowed_mime_types = (
    select array_agg(distinct mime_type order by mime_type)
    from unnest(coalesce(allowed_mime_types, array[]::text[]) || array['image/png']) as mime_type
  )
  where id = target_bucket_id;
end $$;
