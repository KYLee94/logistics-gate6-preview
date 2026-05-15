# Gate 6 체크리스트 재정리 및 완성도 점검

- 기준 시점: 2026-05-15
- 최신 기준표: `gate6-progress-tracker-20260515.json`
- 현재 전체: 106 / 186 (57.0%)
- 판정 원칙: 코드/데이터/QA 증거가 함께 있는 항목만 `done`으로 둡니다.
- 변경 원칙: 실제 브라우저 화면 QA는 사용자가 직접 수행하고, Codex는 정적 QA, 빌드, 데이터 readback, 보안 스크립트 중심으로 검증합니다.

## 이번에 정리한 사용자 요청

| 단계 | 항목 | 현재 상태 |
| ---: | --- | --- |
| 3 | 메인 페이지 통합 검색을 사용자 정보와 담당 자산 grid 사이 한 줄형으로 재배치 | done |
| 3 | 원본 데이터 수정 Excel 다운로드/업로드 컴포넌트를 메인 페이지 최하단으로 이동 | done |
| 5 | 주간업무보고자료 업로드 팝업 실행 버튼을 `데이터 반영`으로 변경하고 버튼 안 글자 맞춤 | done |
| 6 | Top 자산 표에서 공실률 대신 핵심 임차인 표시 | done |
| 6 | 임차인 계약 표에서 사업자번호 제거, 자산 목록 컬럼 중심으로 폭 조정 | done |
| 9 | Data Playground를 Excel 피벗테이블형 행/열/값/보조값/필터/Top N 구조로 보강 | done |
| 10 | Excel 한 시트 수정 파일 컴포넌트를 `원본 데이터 수정`으로 정리하고 메인 페이지 하단 이동, 한 시트/관계키/선택 자산 범위 검증 강화 | done |
| 14 | 실제 브라우저 화면 QA는 사용자 수행 목록으로 분리 | external_pending |

## 현재 남은 핵심 미완료

| 단계 | 남은 항목 | 이유 |
| ---: | --- | --- |
| 2 | Excel/Supabase/UI 주요 숫자 1 by 1 readback | 실제 대상 Supabase project ref 확정 및 readback 필요 |
| 5 | Weekly 실제 Word ingest DB 반영 | Edge Function 배포와 live JWT 권한 확인 필요 |
| 10 | Data Quality 실제 approve/write/readback/audit | Edge Function 배포와 실제 DB write readback 필요 |
| 12 | migration/Edge deploy/commit/push | 사용자가 승인했지만, 실제 대상 project ref가 로컬 `.env`와 connector 사이에서 불일치 |
| 13 | 외부 API live 검증 | OpenDART/건축물대장/Naver secret은 저장됐다고 했으나 `qgrszltduzblpvpqvkqr` connector 재인증 필요 |
| 14 | live 화면 parity | 사용자 직접 화면 QA 리스트로 분리 |

## 사용자 직접 화면 QA 목록

- 상세 목록은 `manual-browser-qa-checklist-20260515.md`에 둡니다.
- Codex는 앞으로 이 목록을 실행하지 않고, 사용자가 확인한 결과를 받아 수정 항목으로 편입합니다.
