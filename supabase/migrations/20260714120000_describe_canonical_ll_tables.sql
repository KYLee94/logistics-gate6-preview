-- Supabase Studio에서 운영 테이블의 역할과 시스템 연결용 식별자를 바로 확인하기 위한 설명입니다.

comment on table public.ll_work_items is
  '업무 이슈, 할 일, 주간 보고 등 운영 작업을 관리하는 테이블입니다.';
comment on column public.ll_work_items.id is
  '작업 항목의 시스템 ID입니다. 화면 표시명 대신 다른 데이터와 안정적으로 연결할 때 사용합니다.';
comment on column public.ll_work_items.asset_id is
  '연결된 자산의 시스템 ID입니다. ll_assets와 연결할 때 사용합니다.';
comment on column public.ll_work_items.tenant_id is
  '연결된 임차인의 시스템 ID입니다. ll_tenants와 연결할 때 사용합니다.';
comment on column public.ll_work_items.related_asset_id is
  '관련 자산의 시스템 ID입니다. ll_assets와 연결할 때 사용합니다.';
comment on column public.ll_work_items.related_tenant_id is
  '관련 임차인의 시스템 ID입니다. ll_tenants와 연결할 때 사용합니다.';
comment on column public.ll_work_items.created_by is
  '등록한 사용자의 시스템 ID입니다. Supabase Auth 사용자와 연결할 때 사용합니다.';

comment on table public.ll_user_permissions is
  '물류 대시보드 사용자의 역할, 자산 범위 및 기능별 권한을 관리하는 테이블입니다.';
comment on column public.ll_user_permissions.user_id is
  '권한 대상 사용자의 시스템 ID입니다. Supabase Auth 사용자와 연결할 때 사용합니다.';

comment on table public.ll_source_files is
  '업로드한 원본 파일의 버전, 보관 위치 및 검증 상태를 관리하는 테이블입니다.';
comment on column public.ll_source_files.source_file_id is
  '원본 파일의 시스템 ID입니다. 파일에서 파생된 행과 운영 데이터를 연결할 때 사용합니다.';
comment on column public.ll_source_files.uploaded_by is
  '파일을 업로드한 사용자의 시스템 ID입니다. Supabase Auth 사용자와 연결할 때 사용합니다.';
comment on column public.ll_source_files.published_by is
  '파일 버전을 게시한 사용자의 시스템 ID입니다. Supabase Auth 사용자와 연결할 때 사용합니다.';

comment on table public.ll_source_rows is
  '원본 파일에서 읽은 각 행의 값, 정규화 결과 및 검증 정보를 보관하는 테이블입니다.';
comment on column public.ll_source_rows.source_row_id is
  '원본 행의 시스템 ID입니다. 화면 행 번호 대신 데이터 연결에 사용합니다.';
comment on column public.ll_source_rows.source_file_id is
  '이 행이 속한 원본 파일의 시스템 ID입니다. ll_source_files와 연결할 때 사용합니다.';

comment on table public.ll_cache_entries is
  '대시보드 계산값과 외부 API 조회 결과를 재사용하기 위해 보관하는 캐시 테이블입니다.';
comment on column public.ll_cache_entries.id is
  '캐시 항목의 시스템 ID입니다. 화면 표시값 대신 내부 연결에 사용합니다.';

comment on table public.ll_asset_spec_files is
  '자산의 도면, 면적표, 사진 등 상세 사양 파일의 보관 위치와 유형을 관리하는 테이블입니다.';
comment on column public.ll_asset_spec_files.asset_spec_file_id is
  '자산 사양 파일의 시스템 ID입니다. 파일 레코드를 안정적으로 연결할 때 사용합니다.';
comment on column public.ll_asset_spec_files.asset_id is
  '파일이 속한 자산의 시스템 ID입니다. ll_assets와 연결할 때 사용합니다.';
comment on column public.ll_asset_spec_files.source_file_id is
  '이 파일의 원본 파일 시스템 ID입니다. ll_source_files와 연결할 때 사용합니다.';
comment on column public.ll_asset_spec_files.created_by is
  '파일 레코드를 등록한 사용자의 시스템 ID입니다. Supabase Auth 사용자와 연결할 때 사용합니다.';

comment on table public.ll_leases is
  '자산과 임차인 사이의 임대차 계약 조건 및 기간을 관리하는 테이블입니다.';
comment on column public.ll_leases.lease_id is
  '임대차 계약의 시스템 ID입니다. 계약을 다른 데이터와 연결할 때 사용합니다.';
comment on column public.ll_leases.asset_id is
  '계약이 속한 자산의 시스템 ID입니다. ll_assets와 연결할 때 사용합니다.';
comment on column public.ll_leases.tenant_id is
  '계약 상대 임차인의 시스템 ID입니다. ll_tenants와 연결할 때 사용합니다.';

comment on table public.ll_lease_spaces is
  '임대차 계약 안의 층, 구역별 임차 면적과 임대 조건을 관리하는 테이블입니다.';
comment on column public.ll_lease_spaces.lease_space_id is
  '계약 내 임차 구역의 시스템 ID입니다. 층과 구역 표시명 대신 연결에 사용합니다.';
comment on column public.ll_lease_spaces.lease_id is
  '상위 임대차 계약의 시스템 ID입니다. ll_leases와 연결할 때 사용합니다.';
comment on column public.ll_lease_spaces.asset_id is
  '임차 구역이 속한 자산의 시스템 ID입니다. ll_assets와 연결할 때 사용합니다.';
comment on column public.ll_lease_spaces.tenant_id is
  '임차 구역을 사용하는 임차인의 시스템 ID입니다. ll_tenants와 연결할 때 사용합니다.';

comment on table public.ll_lease_attributes is
  '임차 구역의 면적 구성, 사양, 특약 등 세부 속성을 유형별로 저장하는 테이블입니다.';
comment on column public.ll_lease_attributes.id is
  '임대차 세부 속성의 시스템 ID입니다. 속성 레코드를 안정적으로 연결할 때 사용합니다.';
comment on column public.ll_lease_attributes.lease_space_id is
  '연결된 임차 구역의 시스템 ID입니다. ll_lease_spaces와 연결할 때 사용합니다.';
comment on column public.ll_lease_attributes.lease_id is
  '연결된 임대차 계약의 시스템 ID입니다. ll_leases와 연결할 때 사용합니다.';
comment on column public.ll_lease_attributes.asset_id is
  '연결된 자산의 시스템 ID입니다. ll_assets와 연결할 때 사용합니다.';
comment on column public.ll_lease_attributes.tenant_id is
  '연결된 임차인의 시스템 ID입니다. ll_tenants와 연결할 때 사용합니다.';

comment on table public.ll_edit_requests is
  '원본 또는 운영 데이터의 수정 요청, 승인, 반려 및 반영 결과를 관리하는 테이블입니다.';
comment on column public.ll_edit_requests.id is
  '수정 요청의 시스템 ID입니다. 요청과 승인 이력을 안정적으로 연결할 때 사용합니다.';
comment on column public.ll_edit_requests.requested_by is
  '수정 요청을 등록한 사용자의 시스템 ID입니다. Supabase Auth 사용자와 연결할 때 사용합니다.';
comment on column public.ll_edit_requests.approved_by is
  '수정 요청을 승인한 사용자의 시스템 ID입니다. Supabase Auth 사용자와 연결할 때 사용합니다.';
comment on column public.ll_edit_requests.rejected_by is
  '수정 요청을 반려한 사용자의 시스템 ID입니다. Supabase Auth 사용자와 연결할 때 사용합니다.';
