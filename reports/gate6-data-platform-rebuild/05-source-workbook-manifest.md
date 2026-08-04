# 운영 원천·Excel provenance·UI 참고자료 manifest

작성 기준일: 2026-08-04
현재 판정: **R1 PARTIAL — Excel 보존 완료, 운영 Supabase field mapping·업무값 승인 미완료**

임대차와 대출의 공식 이관 원천은 기존 운영 Supabase `public.ll_*` snapshot입니다. 이 문서의 Excel은 `historical_provenance` 또는 `ui_reference_only`이며, 값이 운영 Supabase와 다르더라도 canonical 값을 덮어쓰거나 backfill 원천으로 사용할 수 없습니다.

## 1. 업무 원본 파일

원본 파일은 공개 Git에 넣지 않고 `C:\tmp\gate6-pre-data-platform-20260804-sensitive-backup-efs\source-workbooks`에 Windows EFS로 암호화 복사했습니다.

| 파일 | 수정일 KST | bytes | SHA-256 | 역할 |
|---|---|---:|---|---|
| `260513_담당자별 권한 부여.xlsx` | 2026-05-13 10:52:22 | 15,419 | `FDD8613C5D59A13AC8C1E44C6A323318D46EF88CDBC235B55870902B5E9E865A` | 수식 포함 권한 원본 |
| `260513_담당자별 권한 부여_수식 제거.xlsx` | 2026-06-10 15:26:31 | 15,694 | `C8B3D48F014669B536A536FD870E12E51AE7E69E80863ED11741A57EA65135A5` | 권한 ingest 입력 후보 |
| `260520_물류센터 펀드 정보.xlsx` | 2026-06-10 14:52:40 | 22,183 | `B8A37E68D62BB80F1A17CE54067456789A597A71FF52DBC2E20D947554056009` | 펀드·수익자·대주 historical provenance; 운영값 원천 아님 |
| `260619_물류 자산 spec 샘플.xlsx` | 2026-06-19 13:45:38 | 67,090 | `AD9CB5DEAF3A26E873208078B9F58B565C60DD9A0740FAD666FFA968174EF83D` | 자산 spec 샘플·운영 원천 미승인 |
| `★ 260414_물류센터 임대차계약 DB_취합본.xlsx` | 2026-05-21 11:17:34 | 99,828 | `B809E16CFC04AD78DBD4E26BB1BDBF903F6C0F970BB3CD9C566A74BB67841BAC` | 임대차·공간·임대료·계약 조건 historical provenance; 운영값 원천 아님 |

암호화 원본은 5개·220,214바이트입니다. `source-workbooks-manifest.json` SHA-256은 `16BA004501C86DD43CA65A31FE1F1FBC3C3B4F3E2BF487FE130C4366033E1E6B`, 갱신한 전체 민감 백업 manifest SHA-256은 `BC3807564F11F0D75E0D4602D0F5CC081BD40740E912BE5C3E62623B72C8DF0E`입니다.

`물류 시장 데이터_20261Q.xlsx`는 SHA-256 `60EB2B8913287EF77C04E21FFCDDABDE455B56668336F55A6573A930067915EF`로 Storage 49개 백업에 이미 포함되어 있습니다. 신규 세 탭 이관 제외 범위이므로 위 업무 원본 5개와 섞지 않습니다.

`260804_렌트롤 참고자료`의 4개 workbook은 `06-rent-roll-reference-mapping.md`에 SHA-256·시트·헤더 구조를 기록했으며 모두 `ui_reference_only`입니다. 실제 임차인·금액·날짜·면적 셀값, formula cached result, 숨김 초안은 운영 이관에 사용하지 않습니다.

## 2. 물리 Excel 좌표

제목 행이 아니라 실제 열 이름이 들어 있는 물리 셀을 직접 read-only로 확인했습니다.

| 파일·sheet | 실제 header | 실제 data 시작 | 열 수 | 비고 |
|---|---:|---:|---:|---|
| 임대차 `DB_일반` | 9 | 12 | 82개 업무 열 | 10행 예시, 11행 단위 |
| 임대차 `DB_히스토리 누적` | 10 | 15 | 18개 업무 열 | 11~13행 예시, 14행 단위 |
| 펀드 `펀드 정보` | 3 | 4 | 11 | 2행은 sheet 제목 |
| 펀드 `수익자 정보` | 3 | 4 | 7 | 2행은 sheet 제목 |
| 펀드 `대주 정보` | 3 | 4 | 16 | 2행은 sheet 제목 |
| 권한 수식 제거 `Sheet1` | 3 | 4 | 12 | 2행은 sheet 제목 |

기존 `build-source-extract.py`의 임대차 header 9·10과 `apply-logistics-supplemental.py`의 펀드 header 3은 물리 좌표와 일치합니다. 다만 Google Sheets ingest가 빈 행을 제거한 논리 행 번호를 `source_ref`에 쓴 경로가 있으므로, 기존 row number는 파일 hash·sheet·A1 좌표와 함께 검증할 때만 증거로 인정합니다.

## 3. 임대차 Excel version 차이와 비권위 판정

2026-05-12 문서 `docs/source-file-manifest-20260512.md`는 같은 파일명을 다음처럼 기록했습니다.

| 기준 | bytes | SHA-256 |
|---|---:|---|
| 2026-05-12 감사본 | 99,894 | `AE31E860C409B50D6246E5B9CECE16BEE18DEB57A95BB00787EB6C91A889BCD2` |
| 2026-08-04 현재 로컬본 | 99,828 | `B809E16CFC04AD78DBD4E26BB1BDBF903F6C0F970BB3CD9C566A74BB67841BAC` |

현재 로컬본은 5개 sheet·388행·최대 열 합 169·non-blank 8,627·formula 941로 과거 감사 수치와 같습니다. 파일 hash가 다르므로 두 Excel의 값이 같다고 추정하지 않습니다. 다만 임대차 canonical 원천은 운영 Supabase로 확정되었으므로 이 차이는 `MAP-C01` 이관 차단 사유가 아니라 historical provenance 차이로 기록합니다.

## 4. 운영 Supabase→canonical과 Excel 역할 분리

| Excel 참고 | 기존 `public.ll_*` | 신규 `logistics_core` | 판정 |
|---|---|---|---|
| 임대차 `DB_일반` | assets·tenants·leases·lease_spaces·lease_attributes | assets·tenants·lease_contracts·spaces·contract_spaces·rent_terms | historical provenance만 보존; 운영 Supabase field mapping이 권위 |
| 임대차 `DB_히스토리 누적` | rent_history·lease_spaces·tenants | rent_terms·rent_term_history | historical provenance만 보존; Excel 값 직접 이관 금지 |
| 펀드 `펀드 정보` | funds·fund_asset_links | funds·fund_asset_links·maturities | 관계 효력일 원천 없음 |
| 펀드 `수익자 정보` | fund_capital_tranches beneficiary 60건 | fund_beneficiary_tranches | SDD target 확정, migration 구현 전 |
| 펀드 `대주 정보` | fund_capital_tranches loan 59건 | loans·lenders·loan_lenders·maturities | historical provenance. 운영 Supabase loan 59건(active 51건), 약정·인출·만기·금리 55건이 공식 원천 |
| 권한 수식 제거 | user_permissions·staff_profiles·Auth | user_permission_profiles·user_asset_assignments | Excel·legacy 두 표현·Auth 4자 reconciliation 필요 |
| 자산 spec 샘플 | asset_specs 3건 | 신규 canonical 이관 없음 | archive·호환 유지 |

상세 field 단위 상태는 `field-mapping.csv`에 기록합니다. `blocked`, `not_provided`도 명시적 분류이며 임의 기본값을 만들지 않습니다.

공식 source 계약은 다음과 같습니다.

| 도메인 | 공식 source | target | 누락 처리 |
|---|---|---|---|
| 임대차 | 운영 `ll_tenants`, `ll_leases`, `ll_lease_spaces`, `ll_lease_attributes`, `ll_rent_history` | `tenants`, `lease_contracts`, `spaces`, `contract_spaces`, `rent_terms`, `rent_term_history`, `maturities` | source 상태와 원문을 보존하고 구조상 이관 불가만 critical exception |
| 대출·대주 | 운영 `ll_fund_capital_tranches` loan 59건(active 51건) | `loans`, `lenders`, `loan_lenders`, `maturities` | 약정·인출·만기·금리 값 55건 mapping; 월별 상환 schedule 부재는 `not_provided` |
| actual 수익·비용·수납 | 초기 source 행 없음 | 웹 `manual_input`으로 `monthly_ledger_entries` 생성 | 최초 입력 전 `not_entered`; budget/forecast·대출상환 수동입력 금지 |

## 5. 마지막 정상 버전 증거

하나의 commit이 Excel 값·DB·API·UI를 모두 검증했다는 증거는 아직 없습니다. 따라서 아래 증거를 목적별로 분리합니다.

| 목적 | source/QA 기준 | 확인 범위 |
|---|---|---|
| 투자 인덱스 전문 UI | source `360411f3fdb9d409a68742efb289b3ad5e68105f`, QA commit `78b1280c`, 2026-06-22 live `cb=360411f` | 자본 차트·단위·대출 만기·금리·상세·정렬, 오류 0 |
| 더 늦은 화면 렌더링 | source `fca2286a`, Pages `600a0616`, QA `b3c5251f`, 2026-07-03 | deep link·selector·표·차트 렌더링; Excel 값 일치 미검증 |
| 데이터 관리 계약 | `baf22ba6556de3b51907e4a3a86849e9b9bcab0a`, 2026-07-09 release gate | 자산 19·펀드 17·링크 19 readable 및 row parity |
| 현재 archive | main `c3e3f51a`, Pages `9809c960` | 2026-07-31 운영본 보존; 7월 15일 이후 Excel 전문 대조 없음 |

화면 복구 기준은 `MAP-C10`으로 계속 관리하지만 임대차·대출 업무값의 canonical 원천은 운영 Supabase snapshot입니다. 과거 UI 또는 Excel 표시값으로 운영 DB를 되돌리지 않습니다.

## 6. 현재 critical source gaps

1. 운영 Supabase 임대차 field→canonical field·자연키·cardinality mapping 승인 미완료
2. 펀드-자산 관계 `effective_from` 원천 없음
3. 수익자 60건 target의 실제 migration·backfill 없음
4. 펀드 만기의 다중 자산 scope와 실제 migration 없음
5. 운영 loan 59건의 자연키·대주 분리·선순위 생성 규칙과 약정 formula 승인 미완료
6. `assets.acquisition_cost`, `current_valuation` 원천 없음
7. 계약 suspected error 40·missing 3, 임대료 review 88 등 운영 Supabase 품질 상태 처리 미완료
8. 권한 profile 39행·사용자별 224행·Excel provenance·Auth reconciliation 미완료
9. actual 수익·비용·수납의 웹 입력 계정표·필수값·발생/현금·reverse 규칙 미승인; 월별 대출상환 schedule은 없음
10. current `ll_source_files` 1건은 시장 workbook뿐이라 Excel provenance registry로 사용할 수 없음

이 항목들은 샘플이나 추정값으로 해소하지 않습니다. finance 초기 0행은 정상이며 사용자 입력 전 `not_entered`로 표시합니다. budget/forecast와 월별 대출상환은 target 행을 만들지 않고 `not_provided`로 유지합니다.
