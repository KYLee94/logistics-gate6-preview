# Edits and worklogs API contract - 2026-05-13

이 문서는 아직 배포/적용하지 않은 서버 계약입니다. 프론트 버튼 숨김이 아니라 서버에서 다시 권한을 확인하기 위한 기준입니다.

## 공통 원칙

| rule | requirement |
|---|---|
| 인증 | `Authorization: Bearer <JWT>` 필수 |
| 인증 실패 | 401 |
| 권한 부족 | 403 |
| 권한 source | Supabase Auth `app_metadata` 또는 `public.ll_user_permissions` |
| 금지 | client가 보낸 role/user_id/scope 신뢰 금지 |
| write allowlist | `public.ll_*`만 |
| raw SQL | 금지 |
| service role | Edge Function secret에서만 사용 |
| audit | 모든 write는 요청자, 원본값, 변경값, 승인상태, source row를 기록 |

## Endpoint candidates

| endpoint | method | min role | purpose |
|---|---|---|---|
| `/worklogs` | GET/POST | Reader for GET, Editor for POST | 업무 로그 조회/등록 |
| `/edits/submit` | POST | Editor | Data Quality/Weekly 수정 요청 |
| `/edits/approve` | POST | Manager/Admin | 수정 승인 |
| `/snapshot-refresh` | POST | Admin | snapshot refresh 요청 |
| `/cache-clear` | POST | Admin | cache clear |
| `/opendart/company` | POST | Admin/System Admin | OpenDART 서버 조회 |
| `/building-register/summary` | POST | Admin/System Admin | 건축물대장 서버 조회 |

## `/edits/submit`

Request:

```json
{
  "entity_type": "asset|tenant|lease|lease_space|rent_history|weekly_asset|weekly_project",
  "entity_id": "string",
  "field_name": "string",
  "before_value": "string|number|null",
  "after_value": "string|number|null",
  "reason": "string",
  "source_ref": {
    "source_type": "xlsx|live_google_sheets|supabase_snapshot",
    "sheet_name": "string",
    "row_number": 1,
    "column_number": 1
  }
}
```

Server checks:

1. JWT 검증
2. `public.ll_user_permissions` 조회
3. 담당 자산이면 managedAsset 권한 확인
4. 기타 자산이면 otherAsset 권한 확인
5. entity와 asset/fund scope 매칭
6. target table이 `public.ll_*`인지 확인
7. 원본값 readback 후 `before_value`와 비교
8. `pending` 상태로 edit row 저장

## `/edits/approve`

Server checks:

1. JWT 검증
2. Manager/Admin 이상인지 확인
3. 승인 대상 edit row가 `pending`인지 확인
4. target table allowlist 재확인
5. update 실행
6. audit row에 승인자/승인시각/변경 전후값 기록

## Suggested tables

| table | purpose |
|---|---|
| `public.ll_edit_requests` | 수정 요청 |
| `public.ll_edit_audit_logs` | 승인/반려/적용 로그 |
| `public.ll_worklogs` | 업무 로그 |
| `public.ll_worklog_links` | 업무 로그와 자산/펀드/임차인 연결 |

## Current status

프론트 UI에는 수정 요청 버튼과 권한 안내가 있지만, 이 서버 계약은 아직 구현/배포되지 않았습니다. 따라서 Data Quality 수정과 Weekly 수정은 `blocked`입니다.

