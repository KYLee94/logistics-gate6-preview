-- Official portfolio evidence identifies this address as B1 / 3F.
-- Source: https://yunwoo.co.kr/bbs/portfolio_view.php?idx=55
begin;

do $$
declare
  target_asset_id constant text := 'asset_s00002001';
  target_asset_code constant text := 'S00002001';
  target_asset_name constant text := '양산 유산동 물류센터';
  current_floor_count constant text := '1F / 0B';
  canonical_floor_count constant text := '3F / B1';
  actual_asset_code text;
  actual_asset_name text;
  actual_floor_count text;
begin
  select asset_code, asset_name, floor_count
    into actual_asset_code, actual_asset_name, actual_floor_count
  from public.ll_assets
  where asset_id = target_asset_id
  for update;

  if not found then
    raise exception 'Yangsan floor-count repair stopped: asset_id % was not found', target_asset_id;
  end if;

  if actual_asset_code is distinct from target_asset_code
     or actual_asset_name is distinct from target_asset_name then
    raise exception 'Yangsan floor-count repair stopped: target identity does not match (asset_code=%, asset_name=%)',
      actual_asset_code, actual_asset_name;
  end if;

  if actual_floor_count = canonical_floor_count then
    return;
  end if;

  if actual_floor_count is distinct from current_floor_count then
    raise exception 'Yangsan floor-count repair stopped: expected current floor_count %, found %',
      current_floor_count, actual_floor_count;
  end if;

  update public.ll_assets
  set floor_count = canonical_floor_count
  where asset_id = target_asset_id
    and asset_code = target_asset_code
    and asset_name = target_asset_name
    and floor_count = current_floor_count;

  if not found then
    raise exception 'Yangsan floor-count repair stopped: target changed before update';
  end if;
end;
$$;

select asset_id, asset_code, asset_name, floor_count
from public.ll_assets
where asset_id = 'asset_s00002001';

commit;
