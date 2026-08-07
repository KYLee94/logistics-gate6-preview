# Gate 6 수익·비용 사용자 정의 계정 SDD

- 기준일: 2026-08-07 (KST)
- 화면: `/data-platform/income-expense`
- 저장 원칙: 화면 값과 계정 선택 상태를 브라우저에만 남기지 않고 Supabase primary 응답으로 readback한다.

## 1. 기본 NOI 계정 계약

기본 체크 계정에는 기존 계정과 함께 아래 여섯 계정을 반드시 포함한다.

- `INTEREST_PAID`: 이자 지급액
- `TENANT_IMPROVEMENT`: 임차인 시설공사비(TI)
- `LEASING_COMMISSION`: 임대 중개수수료(LC)
- `AMC_FEE`: AMC 수수료
- `CUSTODY_FEE`: 자산보관 수수료
- `GENERAL_ADMIN_TRUSTEE_FEE`: 일반사무·수탁 수수료

기본 체크는 최초 서버 선택값이 없을 때만 적용한다. 서버 readback 선택값이 있으면 그것을 우선한다.

## 2. 사용자 정의 계정 계약

- `영업수익`, `수입 손실`, `운영비용`, `NOI 하단 조정`, `부채상환` 각 계층에 `항목 추가` 진입점을 둔다.
- 항목명은 담당자가 직접 입력하며 앞뒤 공백을 제거한 1~60자 한글·영문·숫자·일반 문장부호를 허용한다.
- 사용자 정의 계정은 선택 자산에 귀속한다. 다른 자산의 손익표에 자동 노출하지 않는다.
- 추가 저장은 `v2/finance/batch-save` 한 트랜잭션에서 계정 생성과 해당 자산의 활성 선택을 함께 처리한다.
- 성공 응답은 생성된 `account_code`, 표시명, 계층, 표시 순서, `is_custom`, `selected`를 포함한다. 화면은 성공 응답 뒤 `v2/finance/read`를 다시 호출해 readback이 일치할 때만 저장 완료로 표시한다.
- 생성 직후 행은 활성 계정 마지막에 배치하고 체크·월 금액 입력을 허용한다.
- 체크 해제 시 원장 금액은 삭제하지 않는다. 계산에서 제외하고 회색·입력 불가 상태로 같은 계층의 `미사용 계정` 하단으로 이동한다.
- 다시 체크하면 저장된 금액을 복구 표시하고 계산에 포함한다.
- 표준 계정과 사용자 정의 계정 모두 선택 상태를 Supabase에 저장한다. `localStorage`는 진리 원천으로 사용하지 않는다.

## 3. API 요청·응답 계약

`v2/finance/batch-save` 요청은 기존 `entries`와 함께 다음 선택적 배열을 받는다.

```json
{
  "account_operations": [
    {
      "operation": "create",
      "account_code": "CUSTOM:uuid",
      "record": {
        "name_ko": "사용자 입력명",
        "statement_section": "operating_expense",
        "normal_sign": -1,
        "display_order": 999
      }
    }
  ],
  "selection_operations": [
    {
      "operation": "upsert",
      "account_code": "CUSTOM:uuid",
      "selected": true
    }
  ]
}
```

브라우저가 UUID 기반 숨은 `account_code`를 생성하되 화면에는 `name_ko`만 표시한다. `finance/read`의 각 `accounts[]`는 최소 `account_code`, `name`, `statement_section`, `display_order`, `is_custom`, `selected`, `selection_revision`을 반환한다. 저장 응답은 `accounts_readback`을 반환한다.

## 4. 계산·화면 계약

- NOI·NCF 시계열과 기간 누계 자산 비교는 입력표보다 위에 유지한다.
- 사용자 정의 계정은 선택한 계층의 기존 부호·계산 규칙을 그대로 따른다.
- 선택 계정만 시계열·비교·소계 계산에 포함한다.
- 월 집계에서만 입력을 허용하며 분기·연도 집계에서는 합계만 읽는다.
- 저장 중에는 중복 저장을 막고, 409 충돌·권한 오류·readback 불일치는 기존 오류 팝업으로 처리한다.

## 5. TDD 승인 기준

- 기본 체크 여섯 계정 회귀 테스트
- 미등록 서버 계정을 계층에 사람용 이름으로 포함하는 formula 테스트
- 활성 우선·비활성 하단·비활성 입력 잠금 테스트
- 계층별 추가 UI, 생성 payload, reload/readback 계약 테스트
- 시계열·비교 표가 입력표보다 앞에 있는 레이아웃 회귀 테스트
- 새로고침 후 사용자 정의 계정·선택 상태·입력값 유지 브라우저 테스트

## 6. 국내 NOI·NCF 근거와 화면 반영

- 한국부동산원 상업용 임대동향조사의 기본식은 `NOI = 유효조소득 - 운영경비`이다. 임대수입에는 월세, 보증금 운용수입, 실비 및 관리비가 포함되고, 기타수입에는 주차·창고·광고판·송신탑 등이 포함된다. 운영경비에는 청소, 시설유지, 수도광열, 주차관리, 제세공과, 보안경비, 조경, 임대관련비, 일반관리비 등이 포함된다. 이 구조를 화면의 `영업수익 → 수입 손실 → 유효총수입(EGI) → 운영비용 → NOI`에 반영한다.
- 한국신용평가 CMBS 평가방법론은 `NCF = NOI - 자본적 지출 + NOI에서 차감된 비현금성 비용`으로 설명하며, 대출 상환능력은 NCF를 원리금 지급액과 비교한다. 자산관리수수료·보유세·부담금·보험료·유지보수비는 경상비용으로, 자본적 지출과 임대중개수수료는 별도 현금흐름 항목으로 검토한다. 따라서 TI·LC·CAPEX 및 소유자 수수료는 NOI 아래 `자산 NCF 조정`, 이자·원금은 그 아래 `부채상환`에 분리한다.
- 같은 방법론은 물류·창고를 산업용 부동산으로 명시하고, 임대료·공실률·임차인 구성·유지보수·자본적 지출과 과거 실적을 함께 보도록 요구한다. 따라서 화면 상단의 월별 시계열과 자산 비교를 입력표보다 먼저 유지한다.
- 출처: [한국부동산원 통계산출항목](https://www.reb.or.kr/reb/cm/cntnts/cntntsView.do?cntntsId=1051&mi=9802), [한국신용평가 CMBS 평가방법론](https://m.kisrating.com/fileDown.do?fileName=rm20230130-6.pdf&gubun=G&menuCd=R4&writedate=20230130)
