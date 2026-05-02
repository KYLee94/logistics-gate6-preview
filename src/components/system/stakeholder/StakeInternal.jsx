import React, { useState } from 'react';

export default function StakeInternal() {
    const [hoveredRow, setHoveredRow] = useState(null);
    const [hoveredImage, setHoveredImage] = useState(null);
    const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

    const handleMouseMove = (e) => {
        setMousePos({ x: e.clientX, y: e.clientY });
    };

    const handleNavigation = (path) => {
        const base = import.meta.env.BASE_URL.endsWith('/') ? import.meta.env.BASE_URL.slice(0, -1) : import.meta.env.BASE_URL;
        window.history.pushState(null, '', `${base}/${path}`);
        window.dispatchEvent(new Event('popstate'));
    };

    const renderMembers = (namesString) => {
        return namesString.split(' ').map((name, idx) => {
            const cleanName = name.split('(')[0];
            return (
                <div key={idx} 
                     className="flex items-center gap-[6px] bg-[#222] hover:bg-[#333] transition-colors rounded-full pl-[4px] pr-[10px] py-[4px] border border-[#333] cursor-pointer group min-w-[76px]"
                     onMouseEnter={() => setHoveredImage(cleanName)}
                     onMouseLeave={() => setHoveredImage(null)}
                >
                    <div className="w-[20px] h-[20px] shrink-0 rounded-full bg-[#3c3c3c] overflow-hidden">
                        <img src={`/${cleanName}.webp`} alt={name} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" onError={(e) => { e.target.src = '/default_avatar.svg'; }} />
                    </div>
                    <span className="text-[#E5E5E5] text-[12px] font-medium group-hover:text-white transition-colors leading-none">{name}</span>
                </div>
            );
        });
    };

    const renderLeader = (name, title) => {
        const cleanName = name.split('(')[0];
        return (
        <div className="flex items-center gap-[12px]"
             onMouseEnter={() => setHoveredImage(cleanName)}
             onMouseLeave={() => setHoveredImage(null)}
        >
            <div className="relative w-[36px] h-[36px] shrink-0 rounded-full bg-[#3c3c3c] flex items-center justify-center overflow-hidden">
                <img src={`/${cleanName}.webp`} alt={name} className="w-full h-full object-cover" onError={(e) => { e.target.src = '/default_avatar.svg'; }} />
                <div className="absolute inset-0 rounded-full border border-white/10 pointer-events-none"></div>
            </div>
            <div className="flex flex-col text-left">
                <span className="text-white font-bold text-[14px] cursor-pointer hover:text-[#fbf167] transition-colors leading-tight">{name}</span>
                <span className="text-[#A1A1AA] text-[12px] mt-[2px] leading-tight">{title}</span>
            </div>

            {hoveredRow && (
                <div 
                    className="fixed z-[100] pointer-events-none px-[10px] py-[6px] bg-[#111] border border-[#333] text-[#bbb9af] text-[12px] font-normal whitespace-nowrap flex items-center gap-[6px]"
                    style={{
                        left: mousePos.x + 15,
                        top: mousePos.y + 15
                    }}
                >
                    
                    {hoveredRow} 워크스페이스 가기
                </div>
            )}
        </div>
        );
    };

    return (
        <div className="w-full flex-1 flex flex-col pt-[77px] pb-[60px] max-w-[1112px] mx-auto" onMouseMove={handleMouseMove}>
            <h1 className="text-[36px] font-bold text-white tracking-tight leading-none font-['Inter'] mb-[12px]">IGIS 내부인력</h1>
            <p className="text-[15px] text-[#86868B] mb-[36px]">이오타서울 통합 업무수행 조직(CFT)의 핵심 책임/실무 인력 명단입니다.</p>
            
            <div className="w-full border border-[#333] rounded-[24px] overflow-hidden">
                <table className="w-full text-left bg-transparent border-collapse table-fixed">
                    <thead>
                        <tr>
                            <th className="px-[24px] py-[16px] text-[13px] font-normal text-[#86868B] border-b border-[#333] border-r border-[#333] w-[140px] bg-transparent">기능셀</th>
                            <th className="px-[14px] py-[16px] text-[13px] font-normal text-[#86868B] border-b border-[#333]  w-[200px] bg-transparent">책임인력</th>
                            <th className="px-[14px] py-[16px] text-[13px] font-normal text-[#86868B] border-b border-[#333] border-r border-[#333] bg-transparent">실무인력</th>
                            <th className="px-[14px] py-[16px] text-[13px] font-normal text-[#86868B] border-b border-[#333] border-r border-[#333] w-[260px] bg-transparent">핵심 책임</th>
                            <th className="px-[14px] py-[16px] text-[13px] font-normal text-[#86868B] border-b border-[#333] w-[130px] bg-transparent">부문 내 소속</th>
                        </tr>
                    </thead>
                    <tbody>
                        {/* CFT 총괄 */}
                        <tr className="border-b border-[#333]">
                            <td className="px-[24px] py-[16px] text-[14px] font-normal text-[#E5E5E5] border-r border-[#333]">CFT 총괄</td>
                            <td className="px-[14px] py-[16px] ">
                                {renderLeader('이철승', '부문대표')}
                            </td>
                            <td className="px-[14px] py-[16px] text-[13px] text-[#bbb9af] border-r border-[#333]">CFT 사무국 (신설 / 기획추진센터 IEC 협업)</td>
                            <td className="px-[14px] py-[16px] text-[13px] text-[#bbb9af] border-r border-[#333]">IOTA CFT 총괄</td>
                            <td className="px-[14px] py-[16px] text-[13px] text-[#bbb9af]">부문직속</td>
                        </tr>

                        {/* 사업 PM */}
                        <tr className={`cursor-pointer transition-colors ${hoveredRow === '사업 PM' ? 'bg-white/5' : ''}`} onMouseEnter={() => setHoveredRow('사업 PM')} onMouseLeave={() => setHoveredRow(null)} onClick={() => handleNavigation('platform/iotaseoul/workspace/pm')}>
                            <td rowSpan={2} className="px-[24px] py-[16px] text-[14px] font-normal text-[#E5E5E5] border-r border-[#333] border-b border-[#333]">사업 PM</td>
                            <td className="px-[14px] py-[16px] border-b border-[#333]">
                                {renderLeader('권순일', '사업1파트장')}
                            </td>
                            <td className="px-[14px] py-[16px] text-[13px] border-r border-b border-[#333] leading-[22px]"><div className="flex flex-wrap gap-x-3 gap-y-1">{renderMembers('윤주형 김제익 류홍 박만진 박일훈 이정원 전무경')}</div></td>
                            <td rowSpan={2} className="px-[14px] py-[16px] text-[13px] text-[#bbb9af] border-r border-[#333] border-b border-[#333] leading-[22px]">전체 일정·예산 통제<br/>변경관리 결정<br/>PFV 외부 단일 창구</td>
                            <td rowSpan={2} className="px-[14px] py-[16px] text-[13px] text-[#bbb9af] border-b border-[#333]">사업그룹</td>
                        </tr>
                        <tr className={`border-b border-[#333] cursor-pointer transition-colors ${hoveredRow === '사업 PM' ? 'bg-white/5' : ''}`} onMouseEnter={() => setHoveredRow('사업 PM')} onMouseLeave={() => setHoveredRow(null)} onClick={() => handleNavigation('platform/iotaseoul/workspace/pm')}>
                            <td className="px-[14px] py-[16px] ">
                                {renderLeader('강순용', '사업2파트장')}
                            </td>
                            <td className="px-[14px] py-[16px] text-[13px] border-r border-[#333] leading-[22px]"><div className="flex flex-wrap gap-x-3 gap-y-1">{renderMembers('한찬호 박석제 박채현 소현준 이수정 조영비 한수정')}</div></td>
                        </tr>

                        {/* 파이낸싱 */}
                        <tr className={`border-b border-[#333] cursor-pointer transition-colors ${hoveredRow === '파이낸싱' ? 'bg-white/5' : ''}`} onMouseEnter={() => setHoveredRow('파이낸싱')} onMouseLeave={() => setHoveredRow(null)} onClick={() => handleNavigation('platform/iotaseoul/workspace/financing')}>
                            <td className="px-[24px] py-[16px] text-[14px] font-normal text-[#E5E5E5] border-r border-[#333]">파이낸싱</td>
                            <td className="px-[14px] py-[16px] ">
                                {renderLeader('박준호', 'LFC 센터장')}
                            </td>
                            <td className="px-[14px] py-[16px] text-[13px] border-r border-[#333] leading-[22px]"><div className="flex flex-wrap gap-x-3 gap-y-1">{renderMembers('강석민 정리훈 손유정 김지우 박현승 이성민 한승환')}</div></td>
                            <td className="px-[14px] py-[16px] text-[13px] text-[#bbb9af] border-r border-[#333] leading-[22px]">본PF·통합PF 구조, 대주단 모니터링<br/>리파이낸싱 옵션 상시 검토</td>
                            <td className="px-[14px] py-[16px] text-[13px] text-[#bbb9af]">LFC</td>
                        </tr>

                        {/* 개발관리 */}
                        <tr className={`border-b border-[#333] cursor-pointer transition-colors ${hoveredRow === '개발관리' ? 'bg-white/5' : ''}`} onMouseEnter={() => setHoveredRow('개발관리')} onMouseLeave={() => setHoveredRow(null)} onClick={() => handleNavigation('platform/iotaseoul/workspace/development')}>
                            <td className="px-[24px] py-[16px] text-[14px] font-normal text-[#E5E5E5] border-r border-[#333]">개발관리</td>
                            <td className="px-[14px] py-[16px]">
                                {renderLeader('홍장군', '개발솔루션센터장')}
                            </td>
                            <td className="px-[14px] py-[16px] text-[13px] text-[#bbb9af] border-r border-[#333] leading-[22px]">
                                <div className="flex gap-4"><span className="w-[60px] text-[#86868B] shrink-0">건설담당</span><div className="flex flex-wrap gap-x-3 gap-y-1">{renderMembers('채원 김보성 전승희')}</div></div>
                                <div className="flex gap-4"><span className="w-[60px] text-[#86868B] shrink-0">설계담당</span><div className="flex flex-wrap gap-x-3 gap-y-1">{renderMembers('김대익 장성진')}</div></div>
                                <div className="flex gap-4"><span className="w-[60px] text-[#86868B] shrink-0">인허가</span><div className="flex flex-wrap gap-x-3 gap-y-1">{renderMembers('이정훈')}</div></div>
                                <div className="flex gap-4"><span className="w-[60px] text-[#86868B] shrink-0">전문위원</span><div className="flex flex-wrap gap-x-3 gap-y-1">{renderMembers('박봉서')}</div></div>
                            </td>
                            <td className="px-[14px] py-[16px] text-[13px] text-[#bbb9af] border-r border-[#333] leading-[22px]">설계·시공·CM·감리 통제<br/>인허가/명도 대응<br/>공정·품질·안전 KPI</td>
                            <td className="px-[14px] py-[16px] text-[13px] text-[#bbb9af]">개발솔루션센터</td>
                        </tr>

                        {/* 기업마케팅 */}
                        <tr className={`border-b border-[#333] cursor-pointer transition-colors ${hoveredRow === '기업마케팅' ? 'bg-white/5' : ''}`} onMouseEnter={() => setHoveredRow('기업마케팅')} onMouseLeave={() => setHoveredRow(null)} onClick={() => handleNavigation('platform/iotaseoul/workspace/marketing')}>
                            <td className="px-[24px] py-[16px] text-[14px] font-normal text-[#E5E5E5] border-r border-[#333]">기업마케팅</td>
                            <td className="px-[14px] py-[16px]">
                                {renderLeader('김민지', '기업마케팅담당')}
                            </td>
                            <td className="px-[14px] py-[16px] text-[13px] text-[#bbb9af] border-r border-[#333] leading-[22px]">
                                <div className="flex gap-4"><span className="w-[60px] text-[#86868B] shrink-0">EMC</span><div className="flex flex-wrap gap-x-3 gap-y-1">{renderMembers('고아라')}</div></div>
                                <div className="flex gap-4"><span className="w-[60px] text-[#86868B] shrink-0">SSC</span><div className="flex flex-wrap gap-x-3 gap-y-1">{renderMembers('이가현 정수명')}</div></div>
                                <div className="flex gap-4"><span className="w-[60px] text-[#86868B] shrink-0">사업1</span><div className="flex flex-wrap gap-x-3 gap-y-1">{renderMembers('권순일(자문)')}</div></div>
                            </td>
                            <td className="px-[14px] py-[16px] text-[13px] text-[#bbb9af] border-r border-[#333] leading-[22px]">LM 전략·잠재 임차인 피칭<br/>임대차 조건 협의<br/>LM사 관리</td>
                            <td className="px-[14px] py-[16px] text-[13px] text-[#bbb9af] leading-[22px]">EMC<br/>SSC</td>
                        </tr>

                        {/* 상품·디지털 */}
                        <tr className={`cursor-pointer transition-colors ${hoveredRow === '상품·디지털' ? 'bg-white/5' : ''}`} onMouseEnter={() => setHoveredRow('상품·디지털')} onMouseLeave={() => setHoveredRow(null)} onClick={() => handleNavigation('platform/iotaseoul/workspace/digital')}>
                            <td rowSpan={2} className="px-[24px] py-[16px] text-[14px] font-normal text-[#E5E5E5] border-r border-[#333] border-b border-[#333]">상품·디지털</td>
                            <td className="px-[14px] py-[16px] border-b border-[#333]">
                                {renderLeader('김현수', '공간솔루션센터장')}
                            </td>
                            <td className="px-[14px] py-[16px] text-[13px] border-r border-b border-[#333] leading-[22px]"><div className="flex flex-wrap gap-x-3 gap-y-1">{renderMembers('이가현 정수명')}</div></td>
                            <td rowSpan={2} className="px-[14px] py-[16px] text-[13px] text-[#bbb9af] border-r border-[#333] border-b border-[#333] leading-[22px]">상품 차별화 전략·POC<br/>테넌트 경험 설계<br/>디지털 인프라(보안·통신·DC 등)</td>
                            <td rowSpan={2} className="px-[14px] py-[16px] text-[13px] text-[#bbb9af] border-b border-[#333] leading-[22px]">SSC<br/>디지털사업그룹</td>
                        </tr>
                        <tr className={`border-b border-[#333] cursor-pointer transition-colors ${hoveredRow === '상품·디지털' ? 'bg-white/5' : ''}`} onMouseEnter={() => setHoveredRow('상품·디지털')} onMouseLeave={() => setHoveredRow(null)} onClick={() => handleNavigation('platform/iotaseoul/workspace/digital')}>
                            <td className="px-[14px] py-[16px] ">
                                {renderLeader('현철호', '디지털사업그룹장')}
                            </td>
                            <td className="px-[14px] py-[16px] text-[13px] border-r border-[#333] leading-[22px]"><div className="flex flex-wrap gap-x-3 gap-y-1">{renderMembers('신민호')}</div></td>
                        </tr>

                        {/* 펀드운용 */}
                        <tr className={`border-b border-[#333] cursor-pointer transition-colors ${hoveredRow === '펀드운용' ? 'bg-white/5' : ''}`} onMouseEnter={() => setHoveredRow('펀드운용')} onMouseLeave={() => setHoveredRow(null)} onClick={() => handleNavigation('platform/iotaseoul/workspace/fund')}>
                            <td className="px-[24px] py-[16px] text-[14px] font-normal text-[#E5E5E5] border-r border-[#333]">펀드운용</td>
                            <td className="px-[14px] py-[16px] ">
                                {renderLeader('김행단', 'KAM그룹장')}
                            </td>
                            <td className="px-[14px] py-[16px] text-[13px] text-[#bbb9af] border-r border-[#333] leading-[22px]">KAM 1파트 실무진</td>
                            <td className="px-[14px] py-[16px] text-[13px] text-[#bbb9af] border-r border-[#333] leading-[22px]">421 펀드 운용</td>
                            <td className="px-[14px] py-[16px] text-[13px] text-[#bbb9af]">KAM그룹</td>
                        </tr>

                        {/* IPR */}
                        <tr className={`cursor-pointer transition-colors ${hoveredRow === 'IPR' ? 'bg-white/5' : ''}`} onMouseEnter={() => setHoveredRow('IPR')} onMouseLeave={() => setHoveredRow(null)} onClick={() => handleNavigation('platform/iotaseoul/workspace/ipr')}>
                            <td rowSpan={2} className="px-[24px] py-[16px] text-[14px] font-normal text-[#E5E5E5] border-r border-[#333] border-b border-[#333]">IPR</td>
                            <td className="px-[14px] py-[16px] border-b border-[#333]">
                                {renderLeader('권순일', '(투자) 사업1파트장')}
                            </td>
                            <td className="px-[14px] py-[16px] text-[13px] text-[#bbb9af] border-r border-b border-[#333] leading-[22px]">사업1파트 실무진</td>
                            <td rowSpan={2} className="px-[14px] py-[16px] text-[13px] text-[#bbb9af] border-r border-[#333] border-b border-[#333] leading-[22px]">프로젝트리츠 TFT 운영<br/>투자자 대응<br/>외부 자문사 선정</td>
                            <td rowSpan={2} className="px-[14px] py-[16px] text-[13px] text-[#bbb9af] border-b border-[#333] leading-[22px]">부문직속<br/>신설TFT</td>
                        </tr>
                        <tr className={`border-b border-[#333] cursor-pointer transition-colors ${hoveredRow === 'IPR' ? 'bg-white/5' : ''}`} onMouseEnter={() => setHoveredRow('IPR')} onMouseLeave={() => setHoveredRow(null)} onClick={() => handleNavigation('platform/iotaseoul/workspace/ipr')}>
                            <td className="px-[14px] py-[16px] ">
                                {renderLeader('윤용택', '(관리) 사업3파트')}
                            </td>
                            <td className="px-[14px] py-[16px] text-[13px] text-[#bbb9af] border-r border-[#333] leading-[22px]">신규 영입 예정</td>
                        </tr>

                        {/* 전략자문 */}
                        <tr className="border-b-0">
                            <td className="px-[24px] py-[16px] text-[14px] font-normal text-[#E5E5E5] border-r border-[#333]">전략자문</td>
                            <td className="px-[14px] py-[16px] ">
                                {renderLeader('권순일', '사업1파트장')}
                            </td>
                            <td className="px-[14px] py-[16px] text-[13px] text-[#bbb9af] border-r border-[#333] leading-[22px]">사업1파트 실무진</td>
                            <td className="px-[14px] py-[16px] text-[13px] text-[#bbb9af] border-r border-[#333] leading-[22px]">거시경제 분석 및 자본시장 전략 자문</td>
                            <td className="px-[14px] py-[16px] text-[13px] text-[#bbb9af]">사업그룹</td>
                        </tr>
                    </tbody>
                </table>
            </div>

            {hoveredRow && (
                <div 
                    className="fixed z-[100] pointer-events-none px-[10px] py-[6px] bg-[#111] border border-[#333] text-[#bbb9af] text-[12px] font-normal whitespace-nowrap flex items-center gap-[6px]"
                    style={{
                        left: mousePos.x + 15,
                        top: mousePos.y + 15
                    }}
                >
                    
                    {hoveredRow} 워크스페이스 가기
                </div>
            )}

            {hoveredImage && (
                <div 
                    className="fixed z-[110] pointer-events-none rounded-full overflow-hidden border border-[#333] shadow-2xl bg-[#222]"
                    style={{
                        left: mousePos.x + 10,
                        top: mousePos.y - 50,
                        width: '160px',
                        height: '160px'
                    }}
                >
                    <img src={`/${hoveredImage}.webp`} alt="preview" className="w-full h-full object-cover" onError={(e) => { e.target.src = '/default_avatar.svg'; }} />
                </div>
            )}
        </div>
    );
}
