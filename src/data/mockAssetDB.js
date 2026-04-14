/**
 * IFPDP Asset Database Mock (V4: Executive Tracking & Holistic DB)
 * 더케이트윈타워 단일 자산의 모든 펀더멘털을 포함하면서,
 * 대표님의 '계획(UW) 대비 실행(Actual)' 트래킹 철학을 수치와 타임라인에 직접 관통시킨 스키마.
 */

export const mockAssets = [
  {
    id: "asset_001",
    
    // =====================================================================
    // ① 정적 데이터 (Static/Profile): 불변하는 자산 및 조직 뼈대
    // =====================================================================
    staticProfile: {
      missionId: "더케이트윈타워 매입 프로젝트",
      assetName: "The-K 트윈타워",
      assetClass: "오피스/리테일",
      address: "서울 종로구 율곡로 6",
      grossArea: "25,000평",
      vehicleInfo: {
        type: "Fund",
        name: "이지스전문투자형사모부동산 389호"
      },
      hrAllocation: {
        director: "정영진",
        pm: "장민호",
        department: "투자/사업센터",
        involvedTeams: ["투자본부 1팀", "DSC 파트", "공간솔루션팀"],
      }
    },

    // =====================================================================
    // ② 동적 & 시계열 데이터 (Dynamic/Financial): UW 목표 vs 실적 트래킹 (CEO Needs)
    // =====================================================================
    dynamicData: {
      // 투입 인적 자원 밀도 추적
      manpowerStatus: {
        totalFTE: { target_UW: 5.0, actual_Current: 7.5 }
      },
      // 핵심 재무 지표 (UW vs Actual 대비)
      financials: {
        aum: { target_UW: 950000000000, actual_Current: 985000000000 },
        rentRate: { target_UW: 145000, actual_Current: 200000 }, // 평당 임대료 (대표님 니즈 수치 차용)
        irr: { target_UW: 29.66, actual_Current: 122.11 }, // EM 2.9x vs 5.06x (극적인 성과 반영)
        ltv: { target_UW: 65.0, actual_Current: 55.5 },
      },
      // 실물 영업(Sales) 및 임대 지표 트래킹
      operations: {
        occupancyRate: { target_UW: 90.0, actual_Current: 99.0 }, // 99% 이상 (카카오, LG 등 반영)
        walt: { target_UW: 5.0, actual_Current: 8.2 },
        stabilizationPeriod: { target_UW: "운영개시 50% -> 안정화 2년", actual_Current: "운영개시 전 99% 조기 셋업" }
      },
      // 기간별 단계 진입 로깅 (매각 일정 트래킹)
      timeSeries: {
        constructionStart: { target_UW: "2021-09-01", actual_Current: "2021-09-01" },
        preLeasing: { target_UW: "2023-11-01", actual_Current: "2023-03-01" }, // 약 8개월 조기 달성
        preMarketing: { target_UW: "2025-06-01", actual_Current: "2023-09-01" }, 
        completionDate: { target_UW: "2023-11-01", actual_Current: "2023-11-15" },
        bidding: { target_UW: "2026-05-01", actual_Current: "2024-04-15" },
        exitDate: { target_UW: "2027-02-01", actual_Current: "2024-08-30" } // UW 3년 운영 후 매각 vs 6개월 단기매각차익
      }
    },

    // =====================================================================
    // ③ 맥락 & 심층 네트워크 데이터 (Contextual) : 실무운용 허브
    // =====================================================================
    contextualData: {
      statusIndicators: {
        valueChainStep: "10. 엑시트 진행",
        handoverStatus: "우선협상대상자 선정 및 실사 중"
      },
      strategy: {
        productStrategy: "단독 리모델링 강행 및 저층부 최고급 F&B 앵커 집중 유치로 가치(Value) 극대화",
        stackingPlan: "B1~3F 고급 리테일 MD, 4~20F 테크/금융 앵커 데스크 균등분할 확정",
        tenantTargeting: "카카오 92%, LG계열사 7% 등 IT 앵커 테넌트로 건물 전면 장악 성공"
      },
      anchorTenants: ["카카오", "LG 화학", "마이크로소프트"],
      
      // 투자자 현황
      investorNetwork: {
        lpList: ["국민연금", "교직원공제회", "해외 블라인드 펀드"],
        lenderList: ["KB국민은행", "메리츠증권"]
      },

      // 외부 조력 네트워크
      partnerships: {
        partnerContacts: [
           { company: "현대건설", role: "시공사", issue: "인건비 인상 및 철근가 상승에 따른 도급액 1.2% 방어협상 완료" }
        ],
        operatorInfo: {
          hasOpCo: true,
          operatorName: "이지스 직할 PM & 옵코팀 파견",
          status: "최적화 관리 중"
        }
      },

      // 리스크 그래프 (Red Flags)
      redFlags: {
        status: "Green",
        issue: "운영 및 매각이 계획(UW)보다 3년 조기 초과달성 중. 시장 매각가 이견 조율 외 특이사항 없음.",
        mitigation: "Pre-marketing에서의 긍정적 시그널을 바탕으로 쇼트리스트 2차 비딩 강행"
      },

      // 하드 코스트 및 ESG 스펙
      esgAndSpecs: {
        permitStatus: "사용승인 완료",
        esgCertification: "LEED Platinum (인증 유효: 2029년)",
        carbonReduction: "에너지 효율화로 탄소인벤토리 Scope 2 배출량 전년대비 18% 감소"
      }
    }
  }
];
