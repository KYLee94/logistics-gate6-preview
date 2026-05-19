-- DB_???? ?? ?? ?? ll_rent_history ? ll_lease_spaces? ????.
-- Generated from Excel sheet DB_???? ??, visible rows 15-178.

alter table public.ll_rent_history
  add column if not exists floor_label text,
  add column if not exists detail_area_label text,
  add column if not exists temperature_type text,
  add column if not exists source_excel_visible_row integer,
  add column if not exists source_contract_lease_space_id text references public.ll_lease_spaces(lease_space_id);

create index if not exists ll_rent_history_asset_contract_latest_idx
  on public.ll_rent_history(asset_id, source_contract_lease_space_id, is_latest);

create index if not exists ll_rent_history_asset_floor_effective_idx
  on public.ll_rent_history(asset_id, floor_label, detail_area_label, effective_date desc);

create temporary table ll_db_history_excel_manifest (
  source_sheet_row_id text primary key,
  source_excel_visible_row integer not null,
  asset_code text,
  tenant_name text,
  tenant_business_no text,
  floor_label text,
  detail_area_label text,
  temperature_type text
) on commit drop;

insert into ll_db_history_excel_manifest (
  source_sheet_row_id,
  source_excel_visible_row,
  asset_code,
  tenant_name,
  tenant_business_no,
  floor_label,
  detail_area_label,
  temperature_type
) values
  ('sheet_db_history:r000002', 15, 'A112127001', '씨제이대한통운(주)', '110-81-05034', '10', null, '사무실'),
  ('sheet_db_history:r000003', 16, 'A112127001', '씨제이대한통운(주)', '110-81-05034', '10', null, '사무실'),
  ('sheet_db_history:r000004', 17, 'A112127001', '씨제이대한통운(주)', '110-81-05034', '10', null, '사무실'),
  ('sheet_db_history:r000005', 18, 'A112127001', '씨제이대한통운(주)', '110-81-05034', '9', null, 'N'),
  ('sheet_db_history:r000006', 19, 'A112127001', '씨제이대한통운(주)', '110-81-05034', '9', null, 'N'),
  ('sheet_db_history:r000007', 20, 'A112127001', '씨제이대한통운(주)', '110-81-05034', '9', null, 'N'),
  ('sheet_db_history:r000008', 21, 'A112127001', '씨제이대한통운(주)', '110-81-05034', '8', null, '사무실'),
  ('sheet_db_history:r000009', 22, 'A112127001', '씨제이대한통운(주)', '110-81-05034', '8', null, '사무실'),
  ('sheet_db_history:r000010', 23, 'A112127001', '씨제이대한통운(주)', '110-81-05034', '8', null, '사무실'),
  ('sheet_db_history:r000011', 24, 'A112127001', '씨제이대한통운(주)', '110-81-05034', '7', null, 'N'),
  ('sheet_db_history:r000012', 25, 'A112127001', '씨제이대한통운(주)', '110-81-05034', '7', null, 'N'),
  ('sheet_db_history:r000013', 26, 'A112127001', '씨제이대한통운(주)', '110-81-05034', '7', null, 'N'),
  ('sheet_db_history:r000014', 27, 'A112127001', '씨제이대한통운(주)', '110-81-05034', '6', null, '사무실'),
  ('sheet_db_history:r000015', 28, 'A112127001', '씨제이대한통운(주)', '110-81-05034', '6', null, '사무실'),
  ('sheet_db_history:r000016', 29, 'A112127001', '씨제이대한통운(주)', '110-81-05034', '6', null, '사무실'),
  ('sheet_db_history:r000017', 30, 'A112127001', '씨제이대한통운(주)', '110-81-05034', '5', null, 'N'),
  ('sheet_db_history:r000018', 31, 'A112127001', '씨제이대한통운(주)', '110-81-05034', '5', null, 'N'),
  ('sheet_db_history:r000019', 32, 'A112127001', '씨제이대한통운(주)', '110-81-05034', '5', null, 'N'),
  ('sheet_db_history:r000020', 33, 'A112127001', '씨제이대한통운(주)', '110-81-05034', '4', null, '사무실'),
  ('sheet_db_history:r000021', 34, 'A112127001', '씨제이대한통운(주)', '110-81-05034', '4', null, '사무실'),
  ('sheet_db_history:r000022', 35, 'A112127001', '씨제이대한통운(주)', '110-81-05034', '4', null, '사무실'),
  ('sheet_db_history:r000023', 36, 'A112127001', '씨제이대한통운(주)', '110-81-05034', '3', null, 'N'),
  ('sheet_db_history:r000024', 37, 'A112127001', '씨제이대한통운(주)', '110-81-05034', '3', null, 'N'),
  ('sheet_db_history:r000025', 38, 'A112127001', '씨제이대한통운(주)', '110-81-05034', '3', null, 'N'),
  ('sheet_db_history:r000026', 39, 'A112127001', '씨제이대한통운(주)', '110-81-05034', '2', null, '사무실'),
  ('sheet_db_history:r000027', 40, 'A112127001', '씨제이대한통운(주)', '110-81-05034', '2', null, '사무실'),
  ('sheet_db_history:r000028', 41, 'A112127001', '씨제이대한통운(주)', '110-81-05034', '2', null, '사무실'),
  ('sheet_db_history:r000029', 42, 'A112127001', '씨제이대한통운(주)', '110-81-05034', '1', null, 'N'),
  ('sheet_db_history:r000030', 43, 'A112127001', '씨제이대한통운(주)', '110-81-05034', '1', null, 'N'),
  ('sheet_db_history:r000031', 44, 'A112127001', '씨제이대한통운(주)', '110-81-05034', '1', null, 'N'),
  ('sheet_db_history:r000032', 45, 'A112127001', '씨제이대한통운(주)', '110-81-05034', 'B1', '1~5섹터', '사무실'),
  ('sheet_db_history:r000033', 46, 'A112127001', '씨제이대한통운(주)', '110-81-05034', 'B1', '1~5섹터', '사무실'),
  ('sheet_db_history:r000034', 47, 'A112127001', '씨제이대한통운(주)', '110-81-05034', 'B1', '1~5섹터', '사무실'),
  ('sheet_db_history:r000035', 48, 'A112127001', '씨제이대한통운(주)', '110-81-05034', 'B1', '1~5섹터', '사무실'),
  ('sheet_db_history:r000036', 49, 'A112127001', '씨제이대한통운(주)', '110-81-05034', 'B2', '1~5섹터', 'N'),
  ('sheet_db_history:r000037', 50, 'A112127001', '씨제이대한통운(주)', '110-81-05034', 'B2', '1~5섹터', 'N'),
  ('sheet_db_history:r000038', 51, 'A112127001', '씨제이대한통운(주)', '110-81-05034', 'B2', '1~5섹터', 'N'),
  ('sheet_db_history:r000039', 52, 'A112127001', '씨제이대한통운(주)', '110-81-05034', 'B2', '1~5섹터', 'N'),
  ('sheet_db_history:r000040', 53, 'A112127001', '씨제이대한통운(주)', '110-81-05034', 'B1', '6섹터', '사무실'),
  ('sheet_db_history:r000041', 54, 'A112127001', '씨제이대한통운(주)', '110-81-05034', 'B2', '6섹터', 'N'),
  ('sheet_db_history:r000042', 55, 'A112127001', '씨제이대한통운(주)', '110-81-05034', 'B1', '7섹터', '사무실'),
  ('sheet_db_history:r000043', 56, 'A112127001', '씨제이대한통운(주)', '110-81-05034', 'B1', '7섹터', '사무실'),
  ('sheet_db_history:r000044', 57, 'A112127001', '씨제이대한통운(주)', '110-81-05034', 'B1', '7섹터', '사무실'),
  ('sheet_db_history:r000045', 58, 'A112127001', '씨제이대한통운(주)', '110-81-05034', 'B2', '7섹터', 'N'),
  ('sheet_db_history:r000046', 59, 'A112127001', '씨제이대한통운(주)', '110-81-05034', 'B2', '7섹터', 'N'),
  ('sheet_db_history:r000047', 60, 'A112127001', '씨제이대한통운(주)', '110-81-05034', 'B2', '7섹터', 'N'),
  ('sheet_db_history:r000048', 61, 'A112127001', '씨제이대한통운(주)', '110-81-05034', 'B1', '8~10섹터', '사무실'),
  ('sheet_db_history:r000049', 62, 'A112127001', '씨제이대한통운(주)', '110-81-05034', 'B2', '8~10섹터', 'N'),
  ('sheet_db_history:r000050', 63, 'A112127001', '용마로지스(주)', '211-86-40630', 'B2', '11섹터', 'N'),
  ('sheet_db_history:r000051', 64, 'A112127001', '용마로지스(주)', '211-86-40630', 'B2', '11섹터', 'N'),
  ('sheet_db_history:r000052', 65, 'A112127001', '용마로지스(주)', '211-86-40630', 'B2', '11섹터', 'N'),
  ('sheet_db_history:r000053', 66, 'A112127001', '용마로지스(주)', '211-86-40630', 'B2', '11섹터', 'N'),
  ('sheet_db_history:r000054', 67, 'A112127001', '용마로지스(주)', '211-86-40630', 'B2', '11섹터', 'N'),
  ('sheet_db_history:r000055', 68, 'A112127001', '용마로지스(주)', '211-86-40630', 'B2', '11섹터', 'N'),
  ('sheet_db_history:r000056', 69, 'A112127001', '용마로지스(주)', '211-86-40630', 'B2', '11섹터', 'N'),
  ('sheet_db_history:r000057', 70, 'A112127001', '용마로지스(주)', '211-86-40630', 'B2', '12섹터', 'N'),
  ('sheet_db_history:r000058', 71, 'A112127001', '용마로지스(주)', '211-86-40630', 'B2', '12섹터', 'N'),
  ('sheet_db_history:r000059', 72, 'A112127001', '용마로지스(주)', '211-86-40630', 'B2', '12섹터', 'N'),
  ('sheet_db_history:r000060', 73, 'A112127001', '용마로지스(주)', '211-86-40630', 'B2', '12섹터', 'N'),
  ('sheet_db_history:r000061', 74, 'A112127001', '용마로지스(주)', '211-86-40630', 'B2', '12섹터', 'N'),
  ('sheet_db_history:r000062', 75, 'A112127001', '용마로지스(주)', '211-86-40630', 'B2', '12섹터', 'N'),
  ('sheet_db_history:r000063', 76, 'A112127001', '용마로지스(주)', '211-86-40630', 'B2', '12섹터', 'N'),
  ('sheet_db_history:r000064', 77, 'A112127001', '용마로지스(주)', '211-86-40630', 'B2', '13~14섹터', 'N'),
  ('sheet_db_history:r000065', 78, 'A112127001', '용마로지스(주)', '211-86-40630', 'B2', '13~14섹터', 'N'),
  ('sheet_db_history:r000066', 79, 'A112127001', '용마로지스(주)', '211-86-40630', 'B2', '13~14섹터', 'N'),
  ('sheet_db_history:r000067', 80, 'A112127001', '용마로지스(주)', '211-86-40630', 'B2', '13~14섹터', 'N'),
  ('sheet_db_history:r000068', 81, 'A112127001', '용마로지스(주)', '211-86-40630', 'B2', '13~14섹터', 'N'),
  ('sheet_db_history:r000069', 82, 'A112127001', '용마로지스(주)', '211-86-40630', 'B2', '13~14섹터', 'N'),
  ('sheet_db_history:r000070', 83, 'A112127001', '용마로지스(주)', '211-86-40630', 'B2', '13~14섹터', 'N'),
  ('sheet_db_history:r000071', 84, 'A112127001', '용마로지스(주)', '211-86-40630', 'B2', '13~14섹터', 'N'),
  ('sheet_db_history:r000072', 85, 'A112299001', '(주)하나로티앤에스', '124-81-59766', '1', '스카이박스1', 'N'),
  ('sheet_db_history:r000073', 86, 'A112299001', '(주)하나로티앤에스', '124-81-59766', '1', '스카이박스1', 'N'),
  ('sheet_db_history:r000074', 87, 'A112299001', '(주)하나로티앤에스', '124-81-59766', '1', '스카이박스1', 'N'),
  ('sheet_db_history:r000075', 88, 'A112299001', '(주)하나로티앤에스', '124-81-59766', '1', '스카이박스1', 'N'),
  ('sheet_db_history:r000076', 89, 'A112299001', '(주)하나로티앤에스', '124-81-59766', '1', '스카이박스1', 'N'),
  ('sheet_db_history:r000077', 90, 'A112299001', '(주)하나로티앤에스', '124-81-59766', '1', '스카이박스1', '사무실'),
  ('sheet_db_history:r000078', 91, 'A112299001', '(주)하나로티앤에스', '124-81-59766', '1', '스카이박스1', '사무실'),
  ('sheet_db_history:r000079', 92, 'A112299001', '(주)하나로티앤에스', '124-81-59766', '1', '스카이박스1', '사무실'),
  ('sheet_db_history:r000080', 93, 'A112299001', '(주)하나로티앤에스', '124-81-59766', '1', '스카이박스1', '사무실'),
  ('sheet_db_history:r000081', 94, 'A112299001', '(주)하나로티앤에스', '124-81-59766', '1', '스카이박스1', '사무실'),
  ('sheet_db_history:r000082', 95, 'A112299001', '(주)LG생활건강', '107-81-98143', '2', '스카이박스1', 'N'),
  ('sheet_db_history:r000083', 96, 'A112299001', '(주)LG생활건강', '107-81-98143', '2', '스카이박스1', 'N'),
  ('sheet_db_history:r000084', 97, 'A112299001', '(주)LG생활건강', '107-81-98143', '2', '스카이박스1', 'N'),
  ('sheet_db_history:r000085', 98, 'A112299001', '(주)LG생활건강', '107-81-98143', '2', '스카이박스1', 'N'),
  ('sheet_db_history:r000086', 99, 'A112299001', '(주)LG생활건강', '107-81-98143', '2', '스카이박스1', 'N'),
  ('sheet_db_history:r000087', 100, 'A112299001', '(주)LG생활건강', '107-81-98143', '2', '스카이박스1', '사무실'),
  ('sheet_db_history:r000088', 101, 'A112299001', '(주)LG생활건강', '107-81-98143', '2', '스카이박스1', '사무실'),
  ('sheet_db_history:r000089', 102, 'A112299001', '(주)LG생활건강', '107-81-98143', '2', '스카이박스1', '사무실'),
  ('sheet_db_history:r000090', 103, 'A112299001', '(주)LG생활건강', '107-81-98143', '2', '스카이박스1', '사무실'),
  ('sheet_db_history:r000091', 104, 'A112299001', '(주)LG생활건강', '107-81-98143', '2', '스카이박스1', '사무실'),
  ('sheet_db_history:r000092', 105, 'A112299001', '아이씨비로지스(주)', '153-86-03528', '3', '스카이박스1', 'N'),
  ('sheet_db_history:r000093', 106, 'A112299001', '아이씨비로지스(주)', '153-86-03528', '3', '스카이박스1', 'N'),
  ('sheet_db_history:r000094', 107, 'A112299001', '아이씨비로지스(주)', '153-86-03528', '3', '스카이박스1', '사무실'),
  ('sheet_db_history:r000095', 108, 'A112299001', '아이씨비로지스(주)', '153-86-03528', '3', '스카이박스1', '사무실'),
  ('sheet_db_history:r000096', 109, 'A112299001', '쿠팡(주)', '120-88-00767', '1~2', '스카이박스2', 'N'),
  ('sheet_db_history:r000097', 110, 'A112299001', '쿠팡(주)', '120-88-00767', '1~2', '스카이박스2', 'N'),
  ('sheet_db_history:r000098', 111, 'A112299001', '쿠팡(주)', '120-88-00767', '1~2', '스카이박스2', 'N'),
  ('sheet_db_history:r000099', 112, 'A112299001', '쿠팡(주)', '120-88-00767', '1~2', '스카이박스2', 'N'),
  ('sheet_db_history:r000100', 113, 'A112299001', '쿠팡(주)', '120-88-00767', '1~2', '스카이박스2', 'N'),
  ('sheet_db_history:r000101', 114, 'A112299001', '쿠팡(주)', '120-88-00767', '1~2', '스카이박스2', 'N'),
  ('sheet_db_history:r000102', 115, 'A112299001', '쿠팡(주)', '120-88-00767', '1~2', '스카이박스2', 'N'),
  ('sheet_db_history:r000103', 116, 'A112299001', '쿠팡(주)', '120-88-00767', '1~2', '스카이박스2', 'N'),
  ('sheet_db_history:r000104', 117, 'A112299001', '쿠팡(주)', '120-88-00767', '1~2', '스카이박스2', 'N'),
  ('sheet_db_history:r000105', 118, 'A112299001', '봄날창고', '256-12-00547', '3', '스카이박스2', 'N'),
  ('sheet_db_history:r000106', 119, 'A112299001', '봄날창고', '256-12-00547', '3', '스카이박스2', 'N'),
  ('sheet_db_history:r000107', 120, 'A112299001', '봄날창고', '256-12-00547', '3', '스카이박스2', 'N'),
  ('sheet_db_history:r000108', 121, 'A112299001', '봄날창고', '256-12-00547', '3', '스카이박스2', 'N'),
  ('sheet_db_history:r000109', 122, 'A112299001', '봄날창고', '256-12-00547', '3', '스카이박스2', 'N'),
  ('sheet_db_history:r000110', 123, 'A112299001', '봄날창고', '256-12-00547', '3', '스카이박스2', 'N'),
  ('sheet_db_history:r000111', 124, 'A112299001', '봄날창고', '256-12-00547', '3', '스카이박스2', '사무실'),
  ('sheet_db_history:r000112', 125, 'A112299001', '봄날창고', '256-12-00547', '3', '스카이박스2', '사무실'),
  ('sheet_db_history:r000113', 126, 'A112299001', '봄날창고', '256-12-00547', '3', '스카이박스2', '사무실'),
  ('sheet_db_history:r000114', 127, 'A112299001', '봄날창고', '256-12-00547', '3', '스카이박스2', '사무실'),
  ('sheet_db_history:r000115', 128, 'A112299001', '봄날창고', '256-12-00547', '3', '스카이박스2', 'N'),
  ('sheet_db_history:r000116', 129, 'A112299001', '봄날창고', '256-12-00547', '3', '스카이박스2', 'N'),
  ('sheet_db_history:r000117', 130, 'A112299001', '㈜싸이버로지텍', '107-81-80100', '4', '스카이박스2', 'N'),
  ('sheet_db_history:r000118', 131, 'A112299001', '㈜싸이버로지텍', '107-81-80100', '4', '스카이박스2', '사무실'),
  ('sheet_db_history:r000119', 132, 'A112299001', '㈜싸이버로지텍', '107-81-80100', '4', '스카이박스2', 'N'),
  ('sheet_db_history:r000120', 133, 'A112299001', '쿠팡(주)', '120-88-00767', '4', '스카이박스2', 'N'),
  ('sheet_db_history:r000121', 134, 'A112299001', '쿠팡(주)', '120-88-00767', '4', '스카이박스2', 'N'),
  ('sheet_db_history:r000122', 135, 'A120085001', '쿠팡(주)', '120-88-00767', '12', null, '사무실'),
  ('sheet_db_history:r000123', 136, 'A120085001', '쿠팡(주)', '120-88-00767', '11', null, 'N'),
  ('sheet_db_history:r000124', 137, 'A120085001', '쿠팡(주)', '120-88-00767', '10', null, '사무실'),
  ('sheet_db_history:r000125', 138, 'A120085001', '쿠팡(주)', '120-88-00767', '9', null, 'N'),
  ('sheet_db_history:r000126', 139, 'A120085001', '쿠팡(주)', '120-88-00767', '8', null, '사무실'),
  ('sheet_db_history:r000127', 140, 'A120085001', '쿠팡(주)', '120-88-00767', '7', null, 'N'),
  ('sheet_db_history:r000128', 141, 'A120085001', '쿠팡(주)', '120-88-00767', '6', null, '사무실'),
  ('sheet_db_history:r000129', 142, 'A120085001', '쿠팡(주)', '120-88-00767', '5', null, 'N'),
  ('sheet_db_history:r000130', 143, 'A120085001', '쿠팡(주)', '120-88-00767', '4', null, '사무실'),
  ('sheet_db_history:r000131', 144, 'A120085001', '쿠팡(주)', '120-88-00767', '3', null, 'N'),
  ('sheet_db_history:r000132', 145, 'A120085001', '쿠팡(주)', '120-88-00767', '2', null, '사무실'),
  ('sheet_db_history:r000133', 146, 'A120085001', '쿠팡(주)', '120-88-00767', '1', null, 'N'),
  ('sheet_db_history:r000134', 147, 'A120085001', '쿠팡(주)', '120-88-00767', '1', null, 'Y'),
  ('sheet_db_history:r000135', 148, 'A120085001', '쿠팡(주)', '120-88-00767', 'B1', null, '사무실'),
  ('sheet_db_history:r000136', 149, 'A120085001', '쿠팡(주)', '120-88-00767', 'B2', null, 'N'),
  ('sheet_db_history:r000137', 150, 'A120085001', '쿠팡(주)', '120-88-00767', 'B2', null, 'Y'),
  ('sheet_db_history:r000138', 151, 'A112500002', '아디다스코리아유한책임회사', '214-81-07412', '1~4', null, 'N'),
  ('sheet_db_history:r000139', 152, 'A112721001', '쿠팡(주)', '120-88-00767', 'B1~8', null, 'Y(복합)'),
  ('sheet_db_history:r000140', 153, 'A112500003', '홈플러스(주)', '220-81-60348', '1~2', null, 'Y'),
  ('sheet_db_history:r000141', 154, 'A112642001', '삼성전자로지텍(주)', '124-81-55381', 'B2~3', null, 'N'),
  ('sheet_db_history:r000142', 155, 'A112642001', '삼성전자로지텍(주)', '124-81-55381', 'B2~3', null, 'N'),
  ('sheet_db_history:r000143', 156, 'A112109001', null, '#N/A', null, null, null),
  ('sheet_db_history:r000144', 157, 'A112606001', '(주)버킷플레이스', '119-86-91245', 'B2~B1, 1', null, 'N'),
  ('sheet_db_history:r000145', 158, 'A112606001', '한국머스크물류서비스(주)', '101-86-54822', 'B1, 2~3', null, 'N'),
  ('sheet_db_history:r000146', 159, 'A112606001', '한국머스크물류서비스(주)', '101-86-54822', '1', null, 'N'),
  ('sheet_db_history:r000147', 160, 'A112606001', '굿앤파트너스(주)', '897-86-00825', '3~4', null, 'N'),
  ('sheet_db_history:r000148', 161, 'A112755001', 'LG전자(주), ㈜엘엑스판토스', '107-86-14075 / 116-81-31734', '1~4', null, 'N'),
  ('sheet_db_history:r000149', 162, 'A112527001', '쿠팡(주)', '120-88-00767', 'B1, 2~3', null, 'N'),
  ('sheet_db_history:r000150', 163, 'A112527001', '송림물류(주)', '126-81-93358', 'B1', null, 'N'),
  ('sheet_db_history:r000151', 164, 'A112527001', '(주)우진글로벌', '0', '4', null, 'N'),
  ('sheet_db_history:r000152', 165, 'A112527001', '뉴성진에이원(주)', '529-88-00926', '4', null, 'N'),
  ('sheet_db_history:r000153', 166, 'A112527002', '(주)한익스프레스', '130-81-16025', '1~3', null, 'N'),
  ('sheet_db_history:r000154', 167, 'A112527003', '아워박스(주)', '358-81-00820', 'B4~B3, 2', null, 'N'),
  ('sheet_db_history:r000155', 168, 'A112527003', '아워박스(주)', '358-81-00820', 'B2~B1, 1', null, 'N'),
  ('sheet_db_history:r000156', 169, 'AP00014001', '아디다스코리아유한책임회사', '214-81-07412', '1', null, 'N'),
  ('sheet_db_history:r000157', 170, 'AP00014001', '한국일본통운(주)', '107-86-23496', '3', null, 'N'),
  ('sheet_db_history:r000158', 171, 'AP00014001', '(주)에이스코리아로지스', '312-86-20956', 'B2', null, 'Y'),
  ('sheet_db_history:r000159', 172, 'A112573001', '(주)한진', '201-81-02823', 'B2', null, 'Y'),
  ('sheet_db_history:r000160', 173, 'A112573001', '한국로지스풀(주)', '105-86-40937', '2', null, 'N'),
  ('sheet_db_history:r000161', 174, 'A112573001', '한국로지스풀(주)', '105-86-40937', '3', null, 'N'),
  ('sheet_db_history:r000162', 175, 'A112505001', null, '#N/A', null, null, null),
  ('sheet_db_history:r000163', 176, 'S00002001', '(주)소셜빈', '615-86-02347', '3', null, 'N'),
  ('sheet_db_history:r000164', 177, 'S00002001', '(주)파크랜드', '621-81-05081', '1', null, 'N'),
  ('sheet_db_history:r000165', 178, 'S00002001', '(주)한진', '201-81-02823', 'B1', null, 'Y');

update public.ll_rent_history rh
set
  source_excel_visible_row = m.source_excel_visible_row,
  floor_label = m.floor_label,
  detail_area_label = m.detail_area_label,
  temperature_type = m.temperature_type,
  updated_at = now()
from ll_db_history_excel_manifest m
where rh.source_sheet_row_id = m.source_sheet_row_id;

update public.ll_rent_history
set source_contract_lease_space_id = lease_space_id,
    updated_at = now()
where source_sheet_row_id like 'sheet_db_history:r%'
  and lease_space_id is not null;

-- ?? ?? ???? lease_space_id? ?? ?? ? ? Excel ???? ?? ??? ?? ????.
update public.ll_rent_history rh
set source_contract_lease_space_id = 'asset_a112127001|tenant_brn_1108105034|20190301|20340228|1~10|na',
    lease_space_id = coalesce(rh.lease_space_id, 'asset_a112127001|tenant_brn_1108105034|20190301|20340228|1~10|na'),
    updated_at = now()
where rh.source_sheet_row_id in ('sheet_db_history:r000002', 'sheet_db_history:r000005', 'sheet_db_history:r000008', 'sheet_db_history:r000014');

update public.ll_rent_history rh
set source_contract_lease_space_id = (
      select lease_space_id
      from public.ll_lease_spaces ls
      where ls.asset_id = 'asset_a112527001'
        and ls.floor_label = '4'
        and ls.lease_space_id like '%|20260112|20290111|4|na'
      limit 1
    ),
    updated_at = now()
where rh.source_sheet_row_id = 'sheet_db_history:r000151';

with ranked as (
  select
    rent_history_id,
    row_number() over (
      partition by asset_id, tenant_id, coalesce(source_contract_lease_space_id, lease_space_id, ''), coalesce(floor_label, ''), coalesce(detail_area_label, ''), coalesce(temperature_type, '')
      order by effective_date desc nulls last, source_excel_visible_row desc nulls last, source_sheet_row_id desc
    ) = 1 as next_is_latest
  from public.ll_rent_history
  where source_sheet_row_id like 'sheet_db_history:r%'
)
update public.ll_rent_history rh
set is_latest = ranked.next_is_latest,
    updated_at = now()
from ranked
where rh.rent_history_id = ranked.rent_history_id;

with latest_amounts as (
  select
    source_contract_lease_space_id as lease_space_id,
    sum(coalesce(monthly_rent_total, 0)) as monthly_rent_total,
    sum(coalesce(monthly_mf_total, 0)) as monthly_mf_total
  from public.ll_rent_history
  where source_sheet_row_id like 'sheet_db_history:r%'
    and is_latest = true
    and source_contract_lease_space_id is not null
  group by source_contract_lease_space_id
)
update public.ll_lease_spaces ls
set
  current_monthly_rent_total = latest_amounts.monthly_rent_total,
  current_monthly_mf_total = latest_amounts.monthly_mf_total,
  current_monthly_cost_total = latest_amounts.monthly_rent_total + latest_amounts.monthly_mf_total,
  e_noc = case
    when coalesce(ls.leased_area_sqm, 0) > 0
      then round(((latest_amounts.monthly_rent_total + latest_amounts.monthly_mf_total) / (ls.leased_area_sqm * 0.3025))::numeric, 2)
    else null
  end,
  review_status = 'linked_from_db_history',
  review_note = concat_ws(' / ', nullif(ls.review_note, ''), 'DB_???? ?? ?? ? ?? ??/E.NOC ???'),
  updated_at = now()
from latest_amounts
where ls.lease_space_id = latest_amounts.lease_space_id;

comment on column public.ll_rent_history.source_excel_visible_row is '?? Excel DB_???? ?? ??? ?? ?? ? ??.';
comment on column public.ll_rent_history.source_contract_lease_space_id is 'DB_???? ?? ?? DB_?? ?? ??? ???? ?? FK.';
