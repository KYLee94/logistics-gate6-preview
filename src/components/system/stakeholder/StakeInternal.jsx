import React from 'react';

export default function StakeInternal() {
    const renderMembers = (namesString) => {
        return namesString.split(' ').map((name, idx) => (
            <span key={idx} className="text-white cursor-pointer hover:underline underline-offset-4 decoration-white/30 transition-all">{name}</span>
        ));
    };

    const renderLeader = (name, title) => (
        <div className="flex items-center gap-[12px]">
            <div className="w-[36px] h-[36px] shrink-0 rounded-full bg-[#3c3c3c] flex items-center justify-center border border-[#555]">
                <span className="text-[#E5E5E5] text-[13px] font-bold">{name.charAt(0)}</span>
            </div>
            <div className="flex flex-col text-left">
                <span className="text-white font-bold text-[14px] cursor-pointer hover:underline underline-offset-4 decoration-white/30 transition-all leading-tight">{name}</span>
                <span className="text-[#A1A1AA] text-[12px] mt-[2px] leading-tight">{title}</span>
            </div>
        </div>
    );

    return (
        <div className="w-full flex-1 flex flex-col pt-[77px] pb-[60px] max-w-[1112px] mx-auto">
            <h1 className="text-[36px] font-bold text-white tracking-tight leading-none font-['Inter'] mb-[12px]">IGIS 내부인력</h1>
            <p className="text-[15px] text-[#86868B] mb-[36px]">이오타서울 통합 업무수행 조직(CFT)의 핵심 책임/실무 인력 명단입니다.</p>
            
            <div className="w-full border border-[#333] rounded-[24px] overflow-hidden">
                <table className="w-full text-left bg-transparent border-collapse table-fixed">
                    <thead>
                        <tr>
                            <th className="px-[24px] py-[16px] text-[13px] font-normal text-[#86868B] border-b border-[#333] border-r border-[#333] w-[140px] bg-transparent">기능셀</th>
                            <th className="px-[24px] py-[16px] text-[13px] font-normal text-[#86868B] border-b border-[#333]  w-[220px] bg-transparent">책임인력</th>
                            <th className="px-[24px] py-[16px] text-[13px] font-normal text-[#86868B] border-b border-[#333] border-r border-[#333] bg-transparent">실무인력</th>
                            <th className="px-[24px] py-[16px] text-[13px] font-normal text-[#86868B] border-b border-[#333] border-r border-[#333] w-[260px] bg-transparent">핵심 책임</th>
                            <th className="px-[24px] py-[16px] text-[13px] font-normal text-[#86868B] border-b border-[#333] w-[130px] bg-transparent">부문 내 소속</th>
                        </tr>
                    </thead>
                    <tbody>
                        {/* CFT 총괄 */}
                        <tr className="border-b border-[#333]">
                            <td className="px-[24px] py-[16px] text-[14px] font-normal text-[#E5E5E5] border-r border-[#333]">CFT 총괄</td>
                            <td className="px-[24px] py-[16px] ">
                                {renderLeader('이철승', '부문대표')}
                            </td>
                            <td className="px-[24px] py-[16px] text-[13px] text-[#bbb9af] border-r border-[#333]">CFT 사무국 (신설 / 기획추진센터 IEC 협업)</td>
                            <td className="px-[24px] py-[16px] text-[13px] text-[#bbb9af] border-r border-[#333]">CFT 총괄 책임</td>
                            <td className="px-[24px] py-[16px] text-[13px] text-[#bbb9af]">부문직속</td>
                        </tr>

                        {/* 사업 PM */}
                        <tr>
                            <td rowSpan={2} className="px-[24px] py-[16px] text-[14px] font-normal text-[#E5E5E5] border-r border-[#333] border-b border-[#333]">사업 PM</td>
                            <td className="px-[24px] py-[16px] border-b border-[#333]">
                                {renderLeader('권순일', '사업1파트장')}
                            </td>
                            <td className="px-[24px] py-[16px] text-[13px] border-r border-b border-[#333] leading-[22px]"><div className="flex flex-wrap gap-x-3 gap-y-1">{renderMembers('윤주형 김제익 류홍 박만진 박일훈 이정원 전무경')}</div></td>
                            <td rowSpan={2} className="px-[24px] py-[16px] text-[13px] text-[#bbb9af] border-r border-[#333] border-b border-[#333] leading-[22px]">전체 일정·예산 통제<br/>변경관리 결정<br/>PFV 외부 단일 창구</td>
                            <td rowSpan={2} className="px-[24px] py-[16px] text-[13px] text-[#bbb9af] border-b border-[#333]">사업그룹</td>
                        </tr>
                        <tr className="border-b border-[#333]">
                            <td className="px-[24px] pb-[16px] pt-[0px] ">
                                {renderLeader('강순용', '사업2파트장')}
                            </td>
                            <td className="px-[24px] pb-[16px] pt-[0px] text-[13px] border-r border-[#333] leading-[22px]"><div className="flex flex-wrap gap-x-3 gap-y-1">{renderMembers('한찬호 박석제 박채현 소현준 이수정 조영비 한수정')}</div></td>
                        </tr>

                        {/* 파이낸싱 */}
                        <tr className="border-b border-[#333]">
                            <td className="px-[24px] py-[16px] text-[14px] font-normal text-[#E5E5E5] border-r border-[#333]">파이낸싱</td>
                            <td className="px-[24px] py-[16px] ">
                                {renderLeader('박준호', 'LFC 센터장')}
                            </td>
                            <td className="px-[24px] py-[16px] text-[13px] border-r border-[#333] leading-[22px]"><div className="flex flex-wrap gap-x-3 gap-y-1">{renderMembers('강석민 정리훈 손유정 김지우 박현승 이성민 한승환')}</div></td>
                            <td className="px-[24px] py-[16px] text-[13px] text-[#bbb9af] border-r border-[#333] leading-[22px]">본PF·통합PF 구조, 대주단 모니터링<br/>리파이낸싱 옵션 상시 검토</td>
                            <td className="px-[24px] py-[16px] text-[13px] text-[#bbb9af]">LFC</td>
                        </tr>

                        {/* 개발관리 */}
                        <tr className="border-b border-[#333]">
                            <td className="px-[24px] py-[16px] text-[14px] font-normal text-[#E5E5E5] border-r border-[#333]">개발관리</td>
                            <td className="px-[24px] py-[16px]  align-top">
                                {renderLeader('홍장군', '개발솔루션센터장')}
                            </td>
                            <td className="px-[24px] py-[16px] text-[13px] text-[#bbb9af] border-r border-[#333] leading-[24px]">
                                <div className="flex gap-4"><span className="w-[50px] text-[#86868B] shrink-0">건설담당</span><div className="flex flex-wrap gap-x-3 gap-y-1">{renderMembers('채원 김보성 전승희')}</div></div>
                                <div className="flex gap-4"><span className="w-[50px] text-[#86868B] shrink-0">설계담당</span><div className="flex flex-wrap gap-x-3 gap-y-1">{renderMembers('김대익 장성진')}</div></div>
                                <div className="flex gap-4"><span className="w-[50px] text-[#86868B] shrink-0">인허가</span><div className="flex flex-wrap gap-x-3 gap-y-1">{renderMembers('이정훈')}</div></div>
                                <div className="flex gap-4"><span className="w-[50px] text-[#86868B] shrink-0">전문위원</span><div className="flex flex-wrap gap-x-3 gap-y-1">{renderMembers('박봉서')}</div></div>
                            </td>
                            <td className="px-[24px] py-[16px] text-[13px] text-[#bbb9af] border-r border-[#333] leading-[22px]">설계·시공·CM·감리 통제<br/>인허가/명도 대응<br/>공정·품질·안전 KPI</td>
                            <td className="px-[24px] py-[16px] text-[13px] text-[#bbb9af]">개발솔루션센터</td>
                        </tr>

                        {/* 기업마케팅 */}
                        <tr className="border-b border-[#333]">
                            <td className="px-[24px] py-[16px] text-[14px] font-normal text-[#E5E5E5] border-r border-[#333]">기업마케팅</td>
                            <td className="px-[24px] py-[16px]  align-top">
                                {renderLeader('김민지', '기업마케팅담당')}
                            </td>
                            <td className="px-[24px] py-[16px] text-[13px] text-[#bbb9af] border-r border-[#333] leading-[24px]">
                                <div className="flex gap-4"><span className="w-[40px] text-[#86868B] shrink-0">EMC</span><div className="flex flex-wrap gap-x-3 gap-y-1">{renderMembers('고아라')}</div></div>
                                <div className="flex gap-4"><span className="w-[40px] text-[#86868B] shrink-0">SSC</span><div className="flex flex-wrap gap-x-3 gap-y-1">{renderMembers('이가현 정수명')}</div></div>
                                <div className="flex gap-4"><span className="w-[40px] text-[#86868B] shrink-0">사업1</span><div className="flex flex-wrap gap-x-3 gap-y-1">{renderMembers('권순일(자문)')}</div></div>
                            </td>
                            <td className="px-[24px] py-[16px] text-[13px] text-[#bbb9af] border-r border-[#333] leading-[22px]">LM 전략·잠재 임차인 피칭<br/>임대차 조건 협의<br/>LM사 관리</td>
                            <td className="px-[24px] py-[16px] text-[13px] text-[#bbb9af] leading-[22px]">EMC<br/>SSC</td>
                        </tr>

                        {/* 상품·디지털 */}
                        <tr>
                            <td rowSpan={2} className="px-[24px] py-[16px] text-[14px] font-normal text-[#E5E5E5] border-r border-[#333] border-b border-[#333]">상품·디지털</td>
                            <td className="px-[24px] py-[16px] border-b border-[#333]">
                                {renderLeader('김현수', '공간솔루션센터장')}
                            </td>
                            <td className="px-[24px] py-[16px] text-[13px] border-r border-b border-[#333] leading-[22px]"><div className="flex flex-wrap gap-x-3 gap-y-1">{renderMembers('이가현 정수명')}</div></td>
                            <td rowSpan={2} className="px-[24px] py-[16px] text-[13px] text-[#bbb9af] border-r border-[#333] border-b border-[#333] leading-[22px]">상품 차별화 전략·POC<br/>테넌트 경험 설계<br/>디지털 인프라(보안·통신·DC 등)</td>
                            <td rowSpan={2} className="px-[24px] py-[16px] text-[13px] text-[#bbb9af] border-b border-[#333] leading-[22px]">SSC<br/>디지털사업그룹</td>
                        </tr>
                        <tr className="border-b border-[#333]">
                            <td className="px-[24px] pb-[16px] pt-[0px] ">
                                {renderLeader('현철호', '디지털사업그룹장')}
                            </td>
                            <td className="px-[24px] pb-[16px] pt-[0px] text-[13px] border-r border-[#333] leading-[22px]"><div className="flex flex-wrap gap-x-3 gap-y-1">{renderMembers('신민호')}</div></td>
                        </tr>

                        {/* 펀드운용 */}
                        <tr className="border-b border-[#333]">
                            <td className="px-[24px] py-[16px] text-[14px] font-normal text-[#E5E5E5] border-r border-[#333]">펀드운용</td>
                            <td className="px-[24px] py-[16px] ">
                                {renderLeader('김행단', 'KAM그룹장')}
                            </td>
                            <td className="px-[24px] py-[16px] text-[13px] text-[#bbb9af] border-r border-[#333] leading-[22px]">KAM 1파트 실무진</td>
                            <td className="px-[24px] py-[16px] text-[13px] text-[#bbb9af] border-r border-[#333] leading-[22px]">421 펀드 운용</td>
                            <td className="px-[24px] py-[16px] text-[13px] text-[#bbb9af]">KAM그룹</td>
                        </tr>

                        {/* IPR */}
                        <tr>
                            <td rowSpan={2} className="px-[24px] py-[16px] text-[14px] font-normal text-[#E5E5E5] border-r border-[#333] border-b border-[#333]">IPR</td>
                            <td className="px-[24px] py-[16px] border-b border-[#333]">
                                {renderLeader('권순일', '(투자) 사업1파트장')}
                            </td>
                            <td className="px-[24px] py-[16px] text-[13px] text-[#bbb9af] border-r border-b border-[#333] leading-[22px]">사업1파트 실무진</td>
                            <td rowSpan={2} className="px-[24px] py-[16px] text-[13px] text-[#bbb9af] border-r border-[#333] border-b border-[#333] leading-[22px]">프로젝트리츠 TFT 운영<br/>투자자 대응<br/>외부 자문사 선정</td>
                            <td rowSpan={2} className="px-[24px] py-[16px] text-[13px] text-[#bbb9af] border-b border-[#333] leading-[22px]">부문직속<br/>신설TFT</td>
                        </tr>
                        <tr className="border-b border-[#333]">
                            <td className="px-[24px] pb-[16px] pt-[0px] ">
                                {renderLeader('윤용택', '(관리) 사업3파트')}
                            </td>
                            <td className="px-[24px] pb-[16px] pt-[0px] text-[13px] text-[#bbb9af] border-r border-[#333] leading-[22px]">신규 영입 예정</td>
                        </tr>

                        {/* 전략자문 */}
                        <tr className="border-b-0">
                            <td className="px-[24px] py-[16px] text-[14px] font-normal text-[#E5E5E5] border-r border-[#333]">전략자문</td>
                            <td className="px-[24px] py-[16px] ">
                                {renderLeader('권순일', '사업1파트장')}
                            </td>
                            <td className="px-[24px] py-[16px] text-[13px] text-[#bbb9af] border-r border-[#333] leading-[22px]">사업1파트 실무진</td>
                            <td className="px-[24px] py-[16px] text-[13px] text-[#bbb9af] border-r border-[#333] leading-[22px]">거시경제 분석 및 자본시장 전략 자문</td>
                            <td className="px-[24px] py-[16px] text-[13px] text-[#bbb9af]">사업그룹</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    );
}
