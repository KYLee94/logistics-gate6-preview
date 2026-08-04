# 기존 기능·데이터 처분 명세

## 분류

- `보존`: archive/rollback에서 계속 복구할 기능
- `신규 미이관`: 신규 플랫폼에 포함하지 않을 기능
- `호환 유지`: 구 frontend/API rollback을 위해 유지할 기능
- `안정화 후 폐기 검토`: 별도 통합 승인 전에는 삭제하지 않을 기능

## 화면 분류

| 기존 영역 | 분류 | 신규 처리 |
|---|---|---|
| 기존 홈·통합 업무보드·Weekly | 보존·신규 미이관 | 신규 `/home`은 만기와 검증된 핵심값만 재구축 |
| 자산·기업·투자 정보 | 호환 유지 | 실제 마스터·관계만 홈/렌트롤/수익비용에 projection |
| Data Management 자산·투자 | 호환 유지 | 1단계 v2 공개 action에는 직접 CRUD를 넣지 않고 기존 admin/compat 경로를 유지; 별도 설정·관리 API SDD 승인 후 이관 검토 |
| Data Management 임대차 | 재구축 | `/rent-roll` Excel형 편집으로 교체 |
| 담당자·권한 | 호환 유지 | 1단계에는 기존 admin/compat UI와 서버 권한표를 유지; 신규 설정 UI·관리 action은 별도 SDD 승인 대상 |
| 시장 데이터·임대시장·공급·거래 | 보존·신규 미이관 | 신규 주요 탭에서 제외 |
| 뉴스·지도·평면도 | 보존·신규 미이관 | 초기 bundle과 신규 schema에서 제외 |
| 피벗·분석·Data Playground | 보존·신규 미이관 | 월별 export는 안정화 후 별도 검토 |
| PDF·AI 챗봇·외부 조회 | 보존·신규 미이관 | 초기 재구축 범위에서 제외 |
| 로그인·알림·권한 | 호환 유지·보조 UI | 주요 탭이 아니라 설정·팝업으로 제공 |
| 기존 frontend·DB | 안정화 후 폐기 검토 | 신규 데이터 reverse sync와 15분 rollback 검증 전 삭제 금지 |

## 데이터 분류

| 데이터 | 처리 |
|---|---|
| 자산·펀드·자산-펀드 연결 | 검증된 운영 행만 정규화 이관 |
| 대출·대주 | 운영 `public.ll_fund_capital_tranches`의 loan 59행(active 51행)을 공식 원천으로 사용하고 수익권과 분리 이관. 약정·인출·만기·금리 값이 있는 55행을 보존하며 월별 상환 schedule 부재는 `not_provided` |
| 임차인·계약·공간·임대료 이력 | 운영 `public.ll_*`를 공식 원천으로 별도 엔티티에 이관하고 화면에서 렌트롤 projection. Excel은 historical provenance 또는 UI 참고만 허용 |
| 월별 수익·비용·수납 | 초기 0행이 정상이며 권한 있는 담당자의 웹 `manual_input` actual을 월 단위로 저장; 분기·연도는 계산 |
| actual/budget/forecast | 1단계 영구 저장은 actual 수익·비용·수납만 허용. budget/forecast는 승인 원천이 없으므로 `not_provided`이고 수동입력 금지 |
| accrual/cash | 별도 기준으로 저장하고 혼합 금지 |
| 권한·감사·idempotency | 신규 truth table로 구축하되 기존 권한 자동 회수 금지 |
| 만기·인앱 알림 | 공식 만기·자산 범위·30·7·3·1·0 schedule을 유지하고 로그인 사용자 권한으로 조회. 외부 이메일 전달 이력은 신규 구축하지 않음 |
| cache·fallback·QA·dev·임시 source | 신규 운영 schema 미이관 |
| 시장·뉴스 | archive schema/기존 버전에만 보존 |
| Storage 49개 | 원본과 SHA-256 확보 전 보존 완료로 판정 금지 |

## 권한 기본값

담당 자산과 기타 자산 각각의 읽기·추가·수정·삭제, 총 8개 권한을 유지합니다. 3인 pilot은 이름·이메일이 아니라 Auth user ID와 서버 권한표로 지정합니다. 기존 전체 권한자는 명시적 회수 승인 전까지 권한을 유지합니다.

1단계 신규 공개 action은 계획에 잠근 7개 read·batch-save·계산 action으로 제한합니다. 따라서 신규 화면의 직접 저장 범위는 렌트롤과 actual 수익·비용·수납이고, 홈은 읽기 전용입니다. budget/forecast와 대출상환 수동입력은 허용하지 않습니다. 자산·펀드·대출·권한의 관리 데이터는 신규 정규화 schema 범위에는 포함하지만 별도 관리 API·화면 계약이 승인되기 전까지 신규 공개 CRUD를 열지 않습니다.

## 삭제 정책

사용자 삭제는 `deleted_at`, `deleted_by`, `delete_reason`이 있는 soft delete입니다. hard purge는 안정화 후 대상·백업·의존성·readback을 확인한 별도 승인 절차로만 수행합니다.

## 손익 분류

`잠재총수입 → 손실 → 유효총수입 → 운영비용 → 순영업소득 → 자산 순현금흐름 → 부채상환 후 현금흐름` 순서를 사용합니다. 대출 원리금·금융수수료·CapEx·임차인 공사비·감가상각·법인세·취득매각 비용은 NOI 운영비용에 섞지 않습니다.
