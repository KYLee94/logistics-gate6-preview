# R0 독립 복구·rollback 리허설 결과

실행일: 2026-08-04
판정: **PASS — 로컬 독립 복구와 비파괴 archive rollback 리허설**

## 1. 복구 책임 분리

전체 Supabase dump는 로컬에 없는 플랫폼 관리 확장 `pg_net`, `postgis`, `supabase_vault`, `vector` 때문에 종료 코드 1이었습니다. 이 네 확장은 애플리케이션 복구 실패가 아니라 플랫폼 inventory·버전·의존성 검증 대상으로 분리했습니다.

Gate 6 소유 객체와 필수 Auth 참조만 dump TOC에서 선택했습니다.

- 선택 객체: 375개
- 선택 목록: 암호화 비공개 백업의 `gate6-application-auth-restore-list.txt`
- 선택 목록 SHA-256: `BE0DCC0FCE5A10E39874DD3CF875F7B51A05EB0F08D403B063283EFBA7AA72C5`
- 포함: `public.ll_*`, `idx_ll_*`, 관련 함수·제약·FK·인덱스·트리거·RLS·정책·ACL, `auth.users`, `auth.uid()`
- 제외: 플랫폼 관리 확장과 Gate 6 외부 객체

## 2. 애플리케이션 복원 결과

격리 로컬 DB `gate6_app_restore_r0_final3`에 `pg_restore --exit-on-error --no-owner --use-list=...`를 실행했고 **종료 코드 0**이었습니다.

| 검증 | 복구 원본 | 최종 복원 | 판정 |
|---|---:|---:|---|
| `public.ll_*` 테이블 | 27 | 27 | PASS |
| 전체 행 | 27,512 | 27,512 | PASS |
| 테이블별 전체 내용 해시 | 27 | 27 | PASS |
| Gate 6 함수 | 7 | 7 | PASS |
| 제약·FK | 127 | 127 | PASS |
| 인덱스 | 121 | 121 | PASS |
| 트리거 | 2 | 2 | PASS |
| RLS 활성 테이블 | 27 | 27 | PASS |
| 정책 | 1 | 1 | PASS |
| Auth 사용자 | 13 | 13 | PASS |

권한 연결도 원본과 복원본이 같습니다. `ll_user_permissions` 263행, non-null user ID 263개, 현재 `auth.users`에 직접 연결되지 않는 legacy principal 257개, 직원 이메일 연결 38개가 양쪽에서 동일했습니다. **257개 legacy principal은 정상 사용자라고 추정하지 않으며 R1 mapping exception에서 principal type·source를 전수 분류합니다.**

Storage는 원본 49/49개, 113,226,015바이트를 암호화 비공개 위치에 보존했고 파일별 SHA-256 manifest를 갖습니다.

## 3. 비파괴 archive rollback 리허설

운영 배포를 바꾸지 않고 archive를 재조립하고 live readback하는 보수적 리허설을 수행했습니다.

- source archive: `c3e3f51adf5deb324f38d76da3a331f63dd37c87`
- Pages archive: `9809c960bb373ed10a69e9adfb766677bf672d2d`
- Edge source: 8개 확인
- Pages bundle: `index-B0dMdzaQ.js`
- Git blob과 live bundle SHA-256: `BB5912395966A075778231D34CC6DE6C31697304F6644F2D8CE42BA8E1125C8F`, 일치
- live root, `/home/`, `/data-management/lease-contracts/`, `/market-data/overview/`: 모두 HTTP 200
- archive 재조립·검증 시간: **5.25초**

Windows checkout 파일은 줄바꿈 변환 때문에 다른 로컬 파일 해시가 나올 수 있으므로 rollback 증거로 사용하지 않았습니다. Git blob 원본 바이트와 live 응답 바이트를 직접 비교했습니다.

이 리허설은 라이브를 실제로 재배포하지 않았습니다. 신규 schema 적용 뒤의 `production shadow` rollback과 실제 Edge→Pages 복귀 시간은 R2·R3에서 별도로 측정하며, 그때도 15분을 넘으면 cutover를 차단합니다.
