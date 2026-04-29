import { useState } from 'react';

const menuItems = [
    {
        id: 1,
        label: '전체 현황',
        path: 'platform/iotaseoul/dashboard',
        
        icon: (
            <svg className="w-4.5 h-4.5 mr-[10px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
        ),
    },
    {
        id: 2,
        label: 'Vehicle 통합',
        path: 'platform/iotaseoul/vehicle-integrated',
        icon: (
            <svg className="w-4.5 h-4.5 mr-[10px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
        ),
    },
    {
        id: 3,
        label: 'IOTA One 427',
        path: 'platform/iotaseoul/iota-one-427',
        icon: (
            <svg className="w-4.5 h-4.5 mr-[10px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
        ),
    },
    {
        id: 4,
        label: 'IOTA Two 816',
        path: 'platform/iotaseoul/iota-two-816',
        icon: (
            <svg className="w-4.5 h-4.5 mr-[10px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3 21h18M5 21V5a2 2 0 012-2h10a2 2 0 012 2v16M9 9h6M9 13h6M9 17h6" />
            </svg>
        ),
    },
    {
        id: 5,
        label: '421 Fund',
        path: 'platform/iotaseoul/421-fund',
        icon: (
            <svg className="w-4.5 h-4.5 mr-[10px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
        ),
    },
    {
        id: 6,
        label: 'Project REITs',
        path: 'platform/iotaseoul/project-reits',
        icon: (
            <svg className="w-4.5 h-4.5 mr-[10px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
            </svg>
        ),
    },
    {
        id: 7,
        label: '의사결정 로그',
        path: 'platform/iotaseoul/decision-log',
        icon: (
            <svg className="w-4.5 h-4.5 mr-[10px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
        ),
    },
];

const workspaceItems = [
    {
        label: '사업 PM',
        path: 'platform/iotaseoul/workspace/pm',
        icon: <svg className="w-4.5 h-4.5 mr-[10px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
    },
    {
        label: '파이낸싱',
        path: 'platform/iotaseoul/workspace/financing',
        icon: <svg className="w-4.5 h-4.5 mr-[10px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
    },
    {
        label: '개발관리',
        path: 'platform/iotaseoul/workspace/development',
        icon: <svg className="w-4.5 h-4.5 mr-[10px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><circle cx="12" cy="12" r="3" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" /></svg>
    },
    {
        label: '기업마케팅',
        path: 'platform/iotaseoul/workspace/marketing',
        icon: <svg className="w-4.5 h-4.5 mr-[10px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" /></svg>
    },
    {
        label: '상품·디지털',
        path: 'platform/iotaseoul/workspace/digital',
        icon: <svg className="w-4.5 h-4.5 mr-[10px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
    },
    {
        label: '펀드 운용',
        path: 'platform/iotaseoul/workspace/fund',
        icon: <svg className="w-4.5 h-4.5 mr-[10px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
    },
    {
        label: 'IPR',
        path: 'platform/iotaseoul/workspace/ipr',
        icon: <svg className="w-4.5 h-4.5 mr-[10px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
    }
];

export default function IotaLeftNav({ onMenuChange, currentPath = '' }) {
    
    
    const handleNavigation = (path) => {
        const base = import.meta.env.BASE_URL.endsWith('/') ? import.meta.env.BASE_URL.slice(0, -1) : import.meta.env.BASE_URL;
        window.history.pushState(null, '', `${base}/${path}`);
        window.dispatchEvent(new Event('popstate'));
        onMenuChange?.(path);
    };
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
                        const isActive = currentPath === item.path;
                        return (
                            <div
                                key={item.id}
                                onClick={() => handleNavigation(item.path)}
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
                            {workspaceItems.map((item, idx) => {
                                const isActive = currentPath === item.path;
                                return (
                                <div key={idx} onClick={() => handleNavigation(item.path)} className={`flex items-center justify-between py-[7px] rounded-xl cursor-pointer transition-colors duration-200 outline-none select-none ${isActive ? 'bg-[#151515] px-[9px] -mx-[2px]' : 'px-[7px] hover:bg-[#151515]'}`}>
                                    <div className="flex items-center">
                                        <span className="text-white">
                                            {item.icon}
                                        </span>
                                        <span className={`text-[14px] text-white ${isActive ? 'font-medium' : 'font-light'}`}>
                                            {item.label}
                                        </span>
                                    </div>
                                </div>
                            );
                            })}
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
                            {[{ label: 'IGIS 내부인력', path: 'platform/iotaseoul/stakeholder/internal' },
                                { label: 'LP / 대주 / SI', path: 'platform/iotaseoul/stakeholder/lp' },
                                { label: '잠재 임차사', path: 'platform/iotaseoul/stakeholder/tenant' },
                                { label: '운영 파트너', path: 'platform/iotaseoul/stakeholder/partner' }].map((item, idx) => {
                                const isActive = currentPath === item.path;
                                return (
                                <div key={idx} onClick={() => handleNavigation(item.path)} className={`flex items-center justify-between py-[7px] rounded-xl cursor-pointer transition-colors duration-200 outline-none select-none ${isActive ? 'bg-[#151515] px-[9px] -mx-[2px]' : 'px-[7px] hover:bg-[#151515]'}`}>
                                    <div className="flex items-center">
                                        {/* 아이콘 제거, 텍스트 왼쪽 정렬 */}
                                        <span className={`text-[14px] text-white ${isActive ? 'font-medium' : 'font-light'}`}>
                                            {item.label}
                                        </span>
                                    </div>
                                </div>
                            );
                            })}
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
                            {[{ label: '통합 수행체계', path: 'platform/iotaseoul/governance/system' },
                                { label: '의사결정 원칙', path: 'platform/iotaseoul/governance/principles' },
                                { label: 'RACI', path: 'platform/iotaseoul/governance/raci' },
                                { label: '90 Day Roadmap', path: 'platform/iotaseoul/governance/roadmap' },
                                { label: '회의체 운영 방침', path: 'platform/iotaseoul/governance/meetings' },
                                { label: '프로젝트리츠 워킹그룹', path: 'platform/iotaseoul/governance/working-group' },
                                { label: 'PFV 단일 창구 운영 원칙', path: 'platform/iotaseoul/governance/pfv-rules' },
                                { label: '주요 사안 에스컬레이션 라인', path: 'platform/iotaseoul/governance/escalation' },
                                { label: 'Top 10 리스크 대응 방향', path: 'platform/iotaseoul/governance/risk-top10' }].map((item, idx) => {
                                const isActive = currentPath === item.path;
                                return (
                                <div key={idx} onClick={() => handleNavigation(item.path)} className={`flex items-center justify-between py-[7px] rounded-xl cursor-pointer transition-colors duration-200 outline-none select-none ${isActive ? 'bg-[#151515] px-[9px] -mx-[2px]' : 'px-[7px] hover:bg-[#151515]'}`}>
                                    <div className="flex items-center">
                                        {/* 아이콘 제거, 텍스트 왼쪽 정렬 */}
                                        <span className={`text-[14px] text-white ${isActive ? 'font-medium' : 'font-light'}`}>
                                            {item.label}
                                        </span>
                                    </div>
                                </div>
                            );
                            })}
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
