import { useState } from 'react';

const menuItems = [
    {
        id: 1,
        label: '전체 현황',
        active: true,
        icon: (
            <svg className="w-4.5 h-4.5 mr-[10px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
        ),
    },
    {
        id: 2,
        label: 'Vehicle 통합',
        icon: (
            <svg className="w-4.5 h-4.5 mr-[10px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
        ),
    },
    {
        id: 3,
        label: 'IOTA One 427',
        icon: (
            <svg className="w-4.5 h-4.5 mr-[10px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
        ),
    },
    {
        id: 4,
        label: 'IOTA Two 816',
        icon: (
            <svg className="w-4.5 h-4.5 mr-[10px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
        ),
    },
    {
        id: 5,
        label: '421 Fund',
        icon: (
            <svg className="w-4.5 h-4.5 mr-[10px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
        ),
    },
    {
        id: 6,
        label: 'Project REITs',
        icon: (
            <svg className="w-4.5 h-4.5 mr-[10px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
            </svg>
        ),
    },
    {
        id: 7,
        label: '의사결정 로그',
        icon: (
            <svg className="w-4.5 h-4.5 mr-[10px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
        ),
    },
];

export default function IotaLeftNav({ onMenuChange }) {
    const [activeId, setActiveId] = useState(1);
    const [isWorkspaceOpen, setIsWorkspaceOpen] = useState(true);
    const [isStakeholderOpen, setIsStakeholderOpen] = useState(true);
    const [isGovOpen, setIsGovOpen] = useState(true);

    return (
        <div className="w-[275px] h-full bg-transparent border-r border-[#2C2C2E] flex flex-col flex-shrink-0 text-[14px] font-sans text-white transition-colors duration-300">

            {/* Header */}
            <div className="w-full flex items-center justify-between px-[15px] pt-[14px] pb-4">
                <span className="font-bold text-[20px] tracking-tight font-inter ml-[5px] text-white">
                    IOTA Seoul
                </span>
                <button className="text-[#86868B] hover:text-white pb-1 transition-colors cursor-pointer mt-[4px]">
                    <svg className="w-[22px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.8">
                        <rect x="2" y="4" width="20" height="16" rx="3" ry="3" />
                        <line x1="8" y1="4" x2="8" y2="20" />
                    </svg>
                </button>
            </div>

            {/* Main Menu */}
            <div className="flex-1 overflow-y-auto pb-5 hide-scrollbar flex flex-col px-[11px]">

                <div className="flex flex-col gap-0">
                    {menuItems.map((item) => {
                        const isActive = activeId === item.id;
                        return (
                            <div
                                key={item.id}
                                onClick={() => { setActiveId(item.id); onMenuChange?.(item.id); }}
                                className={`flex items-center justify-between py-[7px] rounded-xl cursor-pointer transition-colors duration-200 outline-none select-none ${isActive ? 'bg-[#151515] px-[9px] -mx-[2px]' : 'px-[7px] hover:bg-[#151515]'}`}
                            >
                                <div className="flex items-center">
                                    <span className="text-white">
                                        {item.icon}
                                    </span>
                                    <span className={`text-[14px] text-white ${isActive ? 'font-medium' : 'font-light'}`}>
                                        {item.label}
                                    </span>
                                </div>
                                <div className="flex items-center gap-2">
                                    {item.badge && (
                                        <div className="bg-[#f87171]/20 text-[#f87171] text-[10px] px-2 py-0.5 rounded-full">
                                            {item.badge}
                                        </div>
                                    )}
                                    {/* 숨김 처리된 꺾쇠 화살표 */}
                                    <svg className="w-3.5 h-3.5 text-white translate-x-[2px] hidden" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* 워크스페이스 영역 */}
                <div className="mt-6 mb-2">
                    <div 
                        className="flex items-center justify-between font-semibold mb-[7px] text-[13px] text-[#86868B] hover:text-white cursor-pointer transition-colors duration-300 px-[7px]"
                        onClick={() => setIsWorkspaceOpen(!isWorkspaceOpen)}
                    >
                        <span>워크스페이스</span>
                        <svg className={`w-3.5 h-3.5 transition-transform duration-200 ${isWorkspaceOpen ? 'rotate-0' : '-rotate-90'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                        </svg>
                    </div>
                    {isWorkspaceOpen && (
                        <div className="flex flex-col gap-0">
                            {[
                                "사업 PM",
                                "파이낸싱",
                                "개발관리",
                                "기업마케팅",
                                "상품·디지털",
                                "펀드 운용",
                                "IPR"
                            ].map((item, idx) => (
                                <div key={idx} className="flex items-center justify-between px-[7px] py-[7px] rounded-xl cursor-pointer transition-colors duration-200 outline-none select-none hover:bg-[#151515]">
                                    <div className="flex items-center">
                                        <span className="text-white">
                                            <svg className="w-4.5 h-4.5 mr-[10px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                            </svg>
                                        </span>
                                        <span className="text-[14px] text-white font-light">
                                            {item}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* 이해관계자 영역 */}
                <div className="mt-6 mb-2">
                    <div 
                        className="flex items-center justify-between font-semibold mb-[7px] text-[13px] text-[#86868B] hover:text-white cursor-pointer transition-colors duration-300 px-[7px]"
                        onClick={() => setIsStakeholderOpen(!isStakeholderOpen)}
                    >
                        <span>이해관계자</span>
                        <svg className={`w-3.5 h-3.5 transition-transform duration-200 ${isStakeholderOpen ? 'rotate-0' : '-rotate-90'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                        </svg>
                    </div>
                    {isStakeholderOpen && (
                        <div className="flex flex-col gap-0">
                            {[
                                "IGIS 내부인력",
                                "LP / 대주 / SI",
                                "잠재 임차사",
                                "운영 파트너"
                            ].map((item, idx) => (
                                <div key={idx} className="flex items-center justify-between px-[7px] py-[7px] rounded-xl cursor-pointer transition-colors duration-200 outline-none select-none hover:bg-[#151515]">
                                    <div className="flex items-center">
                                        <span className="text-white">
                                            <svg className="w-4.5 h-4.5 mr-[10px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                            </svg>
                                        </span>
                                        <span className="text-[14px] text-white font-light">
                                            {item}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* IOTA CFT 거번넌스 영역 */}
                <div className="mt-6 mb-2">
                    <div 
                        className="flex items-center justify-between font-semibold mb-[7px] text-[13px] text-[#86868B] hover:text-white cursor-pointer transition-colors duration-300 px-[7px]"
                        onClick={() => setIsGovOpen(!isGovOpen)}
                    >
                        <span>IOTA CFT 거번넌스</span>
                        <svg className={`w-3.5 h-3.5 transition-transform duration-200 ${isGovOpen ? 'rotate-0' : '-rotate-90'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                        </svg>
                    </div>
                    {isGovOpen && (
                        <div className="flex flex-col gap-0">
                            {[
                                "통합 수행체계",
                                "의사결정 원칙",
                                "RACI",
                                "90 Day Roadmap",
                                "회의체 운영 방침",
                                "프로젝트리츠 워킹그룹",
                                "PFV 단일 창구 운영 원칙",
                                "주요 사안 에스컬레이션 라인",
                                "Top 10 리스크 대응 방향"
                            ].map((item, idx) => (
                                <div key={idx} className="flex items-center justify-between px-[7px] py-[7px] rounded-xl cursor-pointer transition-colors duration-200 outline-none select-none hover:bg-[#151515]">
                                    <div className="flex items-center">
                                        <span className="text-white">
                                            <svg className="w-4.5 h-4.5 mr-[10px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                            </svg>
                                        </span>
                                        <span className="text-[14px] text-white font-light">
                                            {item}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Bottom Profile */}
            <div className="pl-[15px] pr-[17px] pt-[10px] pb-3 border-t border-[#3A3A3C] w-full flex items-center justify-between transition-colors duration-300">
                <div className="flex items-center gap-3 hover:bg-[#2C2C2E] p-1.5 -ml-1.5 rounded-lg cursor-pointer transition-colors duration-300">
                    <div className="w-10 h-10 rounded-full bg-[#c3c2b7] text-[#1F1F1E] flex items-center justify-center text-[16px] font-bold tracking-tighter -ml-[2px]">
                        JK
                    </div>
                    <div className="flex flex-col">
                        <span className="font-normal text-[14px] leading-tight mb-0.5 text-white">Jeon Kiyoung</span>
                        <span className="text-[#86868B] text-[12px] leading-none font-normal">설정하기</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
