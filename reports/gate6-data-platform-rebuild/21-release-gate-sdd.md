# Release Gate SDD

현재 상태: **BLOCKED** — 독립 복구 게이트 미통과

## 증거 등급

| 등급 | 의미 | 릴리스 성공 증거 |
|---|---|---|
| `primary` | 실제 사용자 JWT와 서버 권한으로 운영 Supabase 직접 readback | 인정 |
| `fresh-cache` | primary 성공 뒤 생성된 유효 cache | 보조만 인정 |
| `stale-cache` | 원천 실패 뒤 남은 값 | 불인정 |
| `fallback` | 정적 JSON·대체 데이터 | 불인정 |
| `local-only` | 로컬 build·fixture | 불인정 |
| `skipped` | 자격증명·환경 부재로 생략 | 불인정 |

모든 QA JSON은 `evidence_mode`, `source_status`, `request_id`, `revision`, `readback_confirmed`를 기록합니다.

## 배포 전 게이트

1. archive·DB/Auth/Storage/Edge restore와 15분 rollback 통과
2. 데이터·API·권한·계산·frontend·메일 SDD 확정
3. 의도된 실패 테스트 확인 후 구현 테스트 green
4. staging migration 2회 실행 결과 동일
5. old/new API wire-shape와 forward/reverse delta sync 확인
6. 3인 pilot user ID·8개 권한 확인
7. 회사 발신 도메인 SPF·DKIM과 Resend 실제 수신 확인

## 필수 명령

릴리스 전 다음 명령을 구현하고 순서대로 통과시킵니다.

1. `npm run lint`
2. `npm run test:v2:contract`
3. `npm run test:v2:formula`
4. `npm run qa:v2:permission-matrix`
5. `npm run qa:v2:browser`
6. `npm run qa:v2:crud-readback`
7. `npm run qa:v2:idle-stability -- --idle-ms 900000`
8. `npm run qa:v2:accessibility`
9. `npm run build:preview`
10. `npm run check:edge`
11. `npm run qa:v2:release-gate`
12. Supabase security/performance advisor

테스트는 최신 JSON과 timestamp JSON, screenshot, network 요약, console/page error, primary/fallback 판정을 남깁니다.

## 배포 순서

1. remote·branch·HEAD·dirty 파일·base path·Supabase project ref 재확인
2. staging migration·backfill·reverse 검증
3. 승인된 운영 migration 적용과 readback
4. Edge 배포, auth/permission/action smoke
5. frontend `build:preview`
6. 명시적 파일만 stage·commit; `git add -A` 금지
7. 검증 커밋만 원격 main에 반영
8. gh-pages 배포
9. live HTML·JS·CSS hash 확인
10. root·`/home`·`/rent-roll`·`/income-expense` deep link 검증

Edge가 먼저, frontend가 다음입니다. 대상은 `qvegpozwrcmspdvjokiz`와 `KYLee94/logistics-gate6-preview`뿐입니다.

## Live 통과 조건

- 세션 없는 deep link→로그인→원래 경로 복귀
- 읽기 가능한 자산만 노출
- 렌트롤 create/update/archive transaction과 primary readback
- 새로고침·로그아웃·재로그인 후 값 유지
- 수익비용 월/분기/연도·발생/현금·formula explain 일치
- 15분 idle 후 새로고침 없이 primary 재조회
- 탭 반복·늦은 응답 차단
- 실제 30·7·3·1·0일 이메일 수신
- console/page error 0, 예상 밖 4xx/5xx 0
- 숨은 탭 요청 0, 권한 밖 응답 0
- WCAG 2.2 AA serious/critical 0

## Rollback 트리거

권한 밖 데이터 노출, CRUD 유실·중복·부분 반영, readback 불일치, 계산 오류, stale/fallback 성공 오판, 주요 경로 404, 새로고침/재로그인 데이터 소실, 무한 로딩 중 하나라도 발생하면 즉시 rollback합니다.

## Rollback 절차

1. 신규 write 잠금
2. 신규 delta를 legacy projection으로 reverse sync
3. archive Edge 버전 복원
4. archive Pages 재배포
5. 기존 화면 로그인·권한·자산·계약 readback
6. live asset hash와 DB checksum 기록

15분 이내 이전 화면 복귀, 신규 데이터 유실 0, 권한 우회 0, archive hash 일치가 모두 필요합니다. 하나라도 실패·skipped·fallback-only·local-only이면 완료로 보고하지 않습니다.
