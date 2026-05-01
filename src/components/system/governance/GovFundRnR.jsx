import React from 'react';

export default function GovFundRnR() {
    return (
        <div className="w-full flex-1 flex flex-col pt-[77px] pb-[110px] max-w-[1112px] mx-auto">
            {/* Header */}
            <h1 className="text-[36px] font-bold text-white tracking-tight leading-none font-['Inter'] mb-[18px]">
                421호 펀드 운용 R&R
            </h1>
            <p className="text-[17px] text-[#A1A1AA] leading-[28px] mb-[64px]">
                421호 펀드는 이오타서울의 핵심 자본 공급 주체이자 LP를 위한 신탁 구조입니다. PFV의 개발 리스크가 펀드 수익자에게 직접 전이되는 것을 철저히 차단하기 위해, 명확하고 견고한 방화벽과 투명한 보고 체계를 확립하여 운영하고 있습니다.
            </p>

            {/* LP 커뮤니케이션 프로토콜 */}
            <h2 className="text-[22px] font-bold text-white mb-[24px] tracking-tight">
                LP 커뮤니케이션 프로토콜
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-[16px] mb-[44px]">
                <div className="bg-[#111] rounded-[16px] p-[24px]">
                    <h3 className="text-[17px] font-bold text-white mb-[8px]">정기보고</h3>
                    <p className="text-[17px] text-[#A1A1AA] leading-[26px]">
                        분기보고서(KAM 1 파트 작성, CFT 총괄 승인),<br />월간 진척 노트(PM 작성, KAM 검토)
                    </p>
                </div>
                <div className="bg-[#111] rounded-[16px] p-[24px]">
                    <h3 className="text-[17px] font-bold text-white mb-[8px]">비정기보고</h3>
                    <p className="text-[17px] text-[#A1A1AA] leading-[26px]">
                        UW 범위 외 사안 24 시간 내 통지,<br />대주단 Covenants 위반 가능성 식별 즉시 통지
                    </p>
                </div>
                <div className="bg-[#111] rounded-[16px] p-[24px]">
                    <h3 className="text-[17px] font-bold text-white mb-[8px]">Q&A 응대</h3>
                    <p className="text-[17px] text-[#A1A1AA] leading-[26px]">
                        단일 채널 운용(KAM 1 파트가 게이트키퍼),<br />모든 답변은 운영위 사전 검토 후 발신
                    </p>
                </div>
                <div className="bg-[#111] rounded-[16px] p-[24px]">
                    <h3 className="text-[17px] font-bold text-white mb-[8px]">연 1 회 IR Day</h3>
                    <p className="text-[17px] text-[#A1A1AA] leading-[26px]">
                        PFV 현장 실사 + IPR 사전 안내 세션 동반
                    </p>
                </div>
            </div>

            {/* Divider */}
            <div className="w-full h-px bg-[#333] my-[48px]"></div>

            {/* 자본콜·운용지시·자금집행 라인 */}
            <h2 className="text-[22px] font-bold text-white mb-[10px] tracking-tight">
                자본콜·운용지시·자금집행 라인
            </h2>
            <p className="text-[16px] text-[#A1A1AA] leading-[26px] mb-[32px]">
                자본콜 프로세스는 PFV 자금 수요 → PM 검증 → LFC 검토 → KAM 운용지시 → LP 통지 → 자금집행의 체계적인 단계를 거쳐 표준화되어 있습니다. 각 단계마다 엄격한 결재선과 문서 보존 규정을 적용하여 자금 집행의 투명성을 보장합니다.
            </p>

            <div className="bg-transparent border border-[#333] rounded-[24px] p-[32px] mb-[64px]">
                <div className="flex flex-col relative pl-[20px]">
                    <div className="absolute left-0 top-[12px] bottom-[12px] w-[1px] bg-[#333]"></div>
                    
                    {[
                        { title: '① PFV', desc: '자금 수요 (시공·설계·운영 등)' },
                        { title: '② Co-PM(권순일/강순용)', desc: '1차 검증 – 사업계획·UW 범위 점검' },
                        { title: '③ LFC(박준호)', desc: '자금 구조 검토 – 대출·자본 비중' },
                        { title: '④ KAM 1파트', desc: '운용지시서 발행 – 펀드 한도·LP 약정 점검' },
                        { title: '⑤ LP 통지', desc: '(사전 / 사후 구분) – KAM 1파트 단일 채널' },
                        { title: '⑥ 자금집행', desc: '운용지원 자금팀 → 신탁회사 → PFV' },
                    ].map((step, idx) => (
                        <div key={idx} className="relative flex items-start py-[12px]">
                            <div className="absolute left-[-24px] top-[18px] w-[9px] h-[9px] rounded-full bg-[#86868B] border-[2px] border-[#0a0a0a]"></div>
                            <div className="flex flex-col md:flex-row md:items-center gap-[4px] md:gap-[16px]">
                                <span className="text-[17px] font-bold text-[#E5E5E5] min-w-[180px]">{step.title}</span>
                                <span className="text-[17px] text-[#86868B]">{step.desc}</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Divider */}
            <div className="w-full h-px bg-[#333] mt-[28px] mb-[48px]"></div>

            {/* 회계·세무·컴플라이언스 */}
            <h2 className="text-[22px] font-bold text-white mb-[24px] tracking-tight">
                회계·세무·컴플라이언스
            </h2>
            <ul className="flex flex-col gap-[16px] mb-[44px] pl-[8px]">
                <li className="flex items-start">
                    <span className="text-[#86868B] mr-[16px] mt-[4px] text-[12px]">■</span>
                    <span className="text-[18px] text-[#A1A1AA] leading-[28px]">
                        회계·기장·세무·부가세 신고 등은 KAM 1 파트 산하 운용지원이 책임 (엑셀 '공통사항' 영역)
                    </span>
                </li>
                <li className="flex items-start">
                    <span className="text-[#86868B] mr-[16px] mt-[4px] text-[12px]">■</span>
                    <span className="text-[18px] text-[#A1A1AA] leading-[28px]">
                        계약서 원본·공문 수발신·운용지시 원본은 통합 데이터룸 '원본보존소'에 분리 폴더로 보관
                    </span>
                </li>
                <li className="flex items-start">
                    <span className="text-[#86868B] mr-[16px] mt-[4px] text-[12px]">■</span>
                    <span className="text-[18px] text-[#A1A1AA] leading-[28px]">
                        현금흐름표는 월간 단위로 PM/LFC/KAM 이 동시 열람, 분기 단위로 LP 보고서에 첨부
                    </span>
                </li>
            </ul>

            {/* 펀드 ↔ PFV 방화벽 원칙 */}
            <h2 className="text-[22px] font-bold text-white mb-[24px] tracking-tight">
                펀드 ↔ PFV 방화벽 원칙
            </h2>
            <div className="bg-[#111] rounded-[24px] p-[32px]">
                <h3 className="text-[18px] font-bold text-[#E5E5E5] mb-[20px]">
                    3대 방화벽 원칙
                </h3>
                <div className="flex flex-col gap-[20px]">
                    <div className="flex items-start">
                        <span className="inline-flex min-w-[24px] text-[17px] font-bold text-[#86868B] mt-[2px]">1)</span>
                        <div>
                            <span className="text-[18px] font-bold text-[#E5E5E5] mr-[8px]">의사결정 분리 —</span>
                            <span className="text-[18px] text-[#A1A1AA] leading-[28px]">
                                PFV 이사회의 의사결정과 펀드의 운용지시는 엄격하게 분리되어, 별도의 결재선과 의사록을 통해 독립적으로 관리됩니다.
                            </span>
                        </div>
                    </div>
                    <div className="flex items-start">
                        <span className="inline-flex min-w-[24px] text-[17px] font-bold text-[#86868B] mt-[2px]">2)</span>
                        <div>
                            <span className="text-[18px] font-bold text-[#E5E5E5] mr-[8px]">자금 분리 —</span>
                            <span className="text-[18px] text-[#A1A1AA] leading-[28px]">
                                PFV 계좌, 펀드 계좌, 신탁 계좌는 일체 통합되지 않으며, 모든 자금의 이동은 정식으로 승인된 운용지시서에 기반하여 투명하게 이루어집니다.
                            </span>
                        </div>
                    </div>
                    <div className="flex items-start">
                        <span className="inline-flex min-w-[24px] text-[17px] font-bold text-[#86868B] mt-[2px]">3)</span>
                        <div>
                            <span className="text-[18px] font-bold text-[#E5E5E5] mr-[8px]">정보 분리 —</span>
                            <span className="text-[18px] text-[#A1A1AA] leading-[28px]">
                                LP는 펀드 운용 관련 정보에 한정하여 접근 권한을 가지며, PFV의 일상적인 운영 데이터는 KAM 1파트의 철저한 검증과 가공을 거친 공식 보고서를 통해서만 제공됩니다.
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
