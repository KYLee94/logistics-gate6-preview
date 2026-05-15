# Gate 6 외부권한대기 요청 목록

현재 Codex가 더 진행하려면 필요한 외부 조치입니다. 로컬 코드, 정적 QA, 빌드는 계속 진행 가능하지만, 아래 항목 없이는 실제 Supabase 적용과 live readback을 완료로 판정할 수 없습니다.

## 1. Supabase 대상 프로젝트 확정

- 로컬 앱 `.env` 기준 project ref: `qgrszltduzblpvpqvkqr`
- 현재 Codex Supabase connector 접근 가능 project ref: `qvegpozwrcmspdvjokiz`
- `qgrszltduzblpvpqvkqr` 조회 시 connector가 `Reauthentication required`로 막힙니다.

사용자 조치:

1. Supabase connector를 `qgrszltduzblpvpqvkqr` 프로젝트에 접근 가능하도록 재인증합니다.
2. 실제 Gate 6 적용 대상이 `qgrszltduzblpvpqvkqr`인지 확인합니다.
3. 만약 `qvegpozwrcmspdvjokiz`가 실제 적용 대상이면, 로컬 `.env`와 배포 환경의 Supabase URL을 그 프로젝트로 맞출지 별도 결정이 필요합니다.

## 2. Edge Function secret 확인

사용자가 이미 저장했다고 한 secret:

- `GOOGLE_AI_KEY`
- OpenDART key
- 건축물대장 key
- Naver Cloud key 계열

추가 확인 필요:

- Supabase Edge 기본 secret bundle 또는 service role key가 Edge Function에서 읽히는지 확인해야 합니다.
- Supabase가 `SUPABASE_` 접두어 사용자 secret을 막으므로, 현재 코드에서는 기본 secret bundle fallback을 사용하도록 준비했습니다.

## 3. 실제 DB/Edge 적용 후 readback

대상 project ref가 확정되면 Codex가 수행할 항목:

1. `public.ll_*` migration 적용
2. `ll-dashboard-api`, `ll-weekly-doc-ingest` Edge Function 배포
3. `ll_user_permissions` seed/readback
4. Data Quality 샘플 `submit -> readback -> approve -> write -> post-write readback -> audit` 실행
5. OpenDART/건축물대장/Naver cache miss/hit/stale fallback 검증

## 4. 사용자가 직접 수행할 화면 QA

- 실제 브라우저 화면 QA는 `manual-browser-qa-checklist-20260515.md` 기준으로 사용자가 수행합니다.
- Codex는 사용자가 발견한 화면 문제를 다시 체크리스트에 편입하고 수정합니다.
