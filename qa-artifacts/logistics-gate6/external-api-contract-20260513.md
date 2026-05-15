# OpenDART and building-register API contract - 2026-05-13

이 문서는 아직 배포/적용하지 않은 서버 계약입니다. OpenDART와 건축물대장은 브라우저에서 직접 호출하지 않고 Edge Function 같은 서버 계층에서만 호출합니다.

## 공통 보안 원칙

| rule | requirement |
|---|---|
| key storage | Edge Function secret only |
| frontend exposure | 금지 |
| auth | Authorization JWT 필수 |
| permission | Admin/System Admin 이상 |
| fail closed | 인증 실패 401, 권한 부족 403 |
| provider raw response | 그대로 프론트 반환 금지 |
| write target | 필요 시 `public.ll_*` allowlist만 |
| CORS | GitHub Pages 운영 도메인 + local dev만 |

## `/opendart/company`

Request:

```json
{
  "tenant_id": "string",
  "business_registration_no": "string",
  "tenant_master_name": "string"
}
```

Response:

```json
{
  "ok": true,
  "tenant_id": "string",
  "dart_linked": true,
  "corp_code": "string",
  "summary": {
    "revenue": 0,
    "operating_income": 0,
    "debt_ratio": 0,
    "employee_count": 0,
    "basis_year": "2025"
  }
}
```

Server checks:

1. JWT 검증
2. Admin/System Admin 권한 확인
3. business registration normalization
4. OpenDART key는 secret에서만 읽기
5. raw provider response를 정리된 summary로 변환
6. 필요 시 `public.ll_*` snapshot/update만 수행

## `/building-register/summary`

Request:

```json
{
  "asset_id": "string",
  "asset_name": "string",
  "address": "string"
}
```

Response:

```json
{
  "ok": true,
  "asset_id": "string",
  "building_name": "string",
  "gross_floor_area_sqm": 0,
  "approval_date": "YYYY-MM-DD",
  "review_status": "ok|official_not_found|review_required"
}
```

Server checks:

1. JWT 검증
2. Admin/System Admin 권한 확인
3. 주소 표준화
4. 건축물대장 key는 secret에서만 읽기
5. 공식 응답을 normalized summary로 변환
6. 복합 자산은 `review_required` 또는 `ok_composite`로 분류

## Current status

- 프론트 bundle에 OpenDART/건축물대장 key는 없습니다.
- 자산/기업 JSON에는 기존 snapshot 상태값이 있지만 실제 신규 서버 호출 QA는 없습니다.
- 서버 endpoint 구현과 401/403 QA 전까지 API gate는 `blocked`입니다.

