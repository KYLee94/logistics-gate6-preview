import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../utils/supabaseClient';

const menuItems = [
    {
        id: 1,
        label: '홈',
        path: 'platform/iotaseoul/dashboard',
        
        icon: (
            <svg className="w-4.5 h-4.5 mr-[10px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
        ),
    },
    {
        id: 7,
        label: '전체 업무 현황',
        path: 'platform/iotaseoul/workflow',
        icon: (
            <svg className="w-4.5 h-4.5 mr-[10px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
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
        subItems: [
            {
                id: 'integrated',
                label: 'Vehicle 통합구조',
                path: 'platform/iotaseoul/vehicle-integrated'
            },
            {
                id: 3,
                label: 'IOTA One 427',
                path: 'platform/iotaseoul/iota-one-427'
            },
            {
                id: 4,
                label: 'IOTA Two 816',
                path: 'platform/iotaseoul/iota-two-816'
            },
            {
                id: 5,
                label: '421 Fund',
                path: 'platform/iotaseoul/421-fund'
            },
            {
                id: 'vision-book',
                label: 'IOTA Seoul Vision Book',
                path: 'external/vision-book',
                externalUrl: 'https://iotaseoul.site/'
            }
        ]
    },
    {
        id: 6,
        label: 'Iota Project REITs',
        path: 'platform/iotaseoul/project-reits',
        icon: (
            <svg className="w-4.5 h-4.5 mr-[10px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
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
        label: '파이낸싱-LFC',
        path: 'platform/iotaseoul/workspace/financing',
        icon: <svg className="w-4.5 h-4.5 mr-[10px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
    },
    {
        label: '개발솔루션-DSC',
        path: 'platform/iotaseoul/workspace/development',
        icon: <svg className="w-4.5 h-4.5 mr-[10px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><circle cx="12" cy="12" r="3" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" /></svg>
    },
    {
        label: '기업마케팅-EMC',
        path: 'platform/iotaseoul/workspace/marketing',
        icon: <svg className="w-4.5 h-4.5 mr-[10px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" /></svg>
    },
    {
        label: '상품·디지털-SSC',
        path: 'platform/iotaseoul/workspace/digital',
        icon: <svg className="w-4.5 h-4.5 mr-[10px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
    },
    {
        label: '펀드운용-KAM',
        path: 'platform/iotaseoul/workspace/fund',
        icon: <svg className="w-4.5 h-4.5 mr-[10px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
    },
    {
        label: 'IPR-WG',
        path: 'platform/iotaseoul/workspace/ipr',
        icon: <svg className="w-4.5 h-4.5 mr-[10px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
    },
    {
        label: '물류센터 워크 플랫폼',
        path: 'platform/iotaseoul/workspace/logistics',
        icon: <svg className="w-4.5 h-4.5 mr-[10px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3 7h18M5 7v10a2 2 0 002 2h10a2 2 0 002-2V7M8 11h8M8 15h5M9 7V5a2 2 0 012-2h2a2 2 0 012 2v2" /></svg>
    }
];

const LOGISTICS_ADMIN_NAMES = new Set(['이시정', '전기영', '이관용']);
const logisticsNavIconClass = 'w-4.5 h-4.5 mr-[10px]';
const logisticsNavItems = [
    {
        label: '워크 플랫폼',
        path: 'platform/iotaseoul/workspace/logistics',
        icon: <svg className={logisticsNavIconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3 7h18M5 7v10a2 2 0 002 2h10a2 2 0 002-2V7M8 11h8M8 15h5M9 7V5a2 2 0 012-2h2a2 2 0 012 2v2" /></svg>,
    },
    {
        label: 'Dashboard Home',
        path: 'platform/iotaseoul/workspace/logistics/dashboard/home',
        icon: <svg className={logisticsNavIconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3 12l9-9 9 9M5 10v10h14V10M9 20v-6h6v6" /></svg>,
    },
    {
        label: 'Asset',
        path: 'platform/iotaseoul/workspace/logistics/dashboard/asset',
        icon: <svg className={logisticsNavIconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 21V7l8-4 8 4v14M8 21v-5h8v5M8 10h.01M12 10h.01M16 10h.01" /></svg>,
    },
    {
        label: 'Company',
        path: 'platform/iotaseoul/workspace/logistics/dashboard/company',
        icon: <svg className={logisticsNavIconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3 21h18M5 21V5a2 2 0 012-2h5v18M12 8h5a2 2 0 012 2v11M8 7h.01M8 11h.01M8 15h.01M16 12h.01M16 16h.01" /></svg>,
    },
    {
        label: 'Analysis Tools',
        path: 'platform/iotaseoul/workspace/logistics/dashboard/tools',
        adminOnly: true,
        icon: <svg className={logisticsNavIconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 19V5m0 14h16M8 16V9m4 7V6m4 10v-4" /></svg>,
    },
    {
        label: 'Data Playground',
        path: 'platform/iotaseoul/workspace/logistics/dashboard/playground',
        adminOnly: true,
        icon: <svg className={logisticsNavIconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 7c0 1.657 3.582 3 8 3s8-1.343 8-3M4 7c0-1.657 3.582-3 8-3s8 1.343 8 3M4 7v10c0 1.657 3.582 3 8 3s8-1.343 8-3V7M4 12c0 1.657 3.582 3 8 3s8-1.343 8-3" /></svg>,
    },
    {
        label: 'Data Quality',
        path: 'platform/iotaseoul/workspace/logistics/dashboard/quality',
        adminOnly: true,
        icon: <svg className={logisticsNavIconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12l2 2 4-4M12 3l7 4v5c0 4.5-2.8 8.2-7 9-4.2-.8-7-4.5-7-9V7l7-4z" /></svg>,
    },
];

export default function IotaLeftNav({ currentPath = '' }) {
    
    
    const handleNavigation = (path) => {
        const base = import.meta.env.BASE_URL.endsWith('/') ? import.meta.env.BASE_URL.slice(0, -1) : import.meta.env.BASE_URL;
        window.location.href = `${base}/${path}`;
    };
    const { user, memberInfo, signOut } = useAuth();
    const [showProfileMenu, setShowProfileMenu] = useState(false);
    const [showContactModal, setShowContactModal] = useState(false);
    const [showPasswordModal, setShowPasswordModal] = useState(false);
    const [newPassword, setNewPassword] = useState('');
    const [isCollapsed, setIsCollapsed] = useState(() => {
        const saved = sessionStorage.getItem('iotaLeftNavCollapsed');
        return saved !== null ? saved === 'true' : false;
    });
    const [isWorkspaceOpen, setIsWorkspaceOpen] = useState(() => {
        const saved = sessionStorage.getItem('isWorkspaceOpen');
        return saved !== null ? saved === 'true' : true;
    });

    const handlePasswordChange = async () => {
        try {
            const { error } = await supabase.auth.updateUser({ password: newPassword });
            if (error) throw error;
            alert('비밀번호가 성공적으로 변경되었습니다.');
            setShowPasswordModal(false);
            setNewPassword('');
        } catch (error) {
            alert('비밀번호 변경 실패: ' + error.message);
        }
    };
    const [isStakeholderOpen, setIsStakeholderOpen] = useState(() => {
        const saved = sessionStorage.getItem('isStakeholderOpen');
        return saved !== null ? saved === 'true' : true;
    });
    const [isGovOpen, setIsGovOpen] = useState(() => {
        const saved = sessionStorage.getItem('isGovOpen');
        return saved !== null ? saved === 'true' : true;
    });
    const [isVehicleOpen, setIsVehicleOpen] = useState(() => {
        const isVehiclePath = currentPath === 'platform/iotaseoul/vehicle-integrated' ||
                              currentPath === 'platform/iotaseoul/iota-one-427' ||
                              currentPath === 'platform/iotaseoul/iota-two-816' ||
                              currentPath === 'platform/iotaseoul/421-fund';
        if (isVehiclePath) return true;
        const saved = sessionStorage.getItem('isVehicleOpen');
        return saved !== null ? saved === 'true' : false;
    });

    useEffect(() => { sessionStorage.setItem('iotaLeftNavCollapsed', isCollapsed); }, [isCollapsed]);
    useEffect(() => { sessionStorage.setItem('isWorkspaceOpen', isWorkspaceOpen); }, [isWorkspaceOpen]);
    useEffect(() => { sessionStorage.setItem('isStakeholderOpen', isStakeholderOpen); }, [isStakeholderOpen]);
    useEffect(() => { sessionStorage.setItem('isGovOpen', isGovOpen); }, [isGovOpen]);
    useEffect(() => { sessionStorage.setItem('isVehicleOpen', isVehicleOpen); }, [isVehicleOpen]);

    useEffect(() => {
        if (
            currentPath === 'platform/iotaseoul/vehicle-integrated' ||
            currentPath === 'platform/iotaseoul/iota-one-427' ||
            currentPath === 'platform/iotaseoul/iota-two-816' ||
            currentPath === 'platform/iotaseoul/421-fund'
        ) {
            setIsVehicleOpen(true);
        }
    }, [currentPath]);

    const isLogisticsPath = currentPath.startsWith('platform/iotaseoul/workspace/logistics');
    const isLogisticsAdmin = LOGISTICS_ADMIN_NAMES.has(memberInfo?.staff_name || memberInfo?.name);

    if (isLogisticsPath) {
        const visibleLogisticsItems = logisticsNavItems.filter((item) => !item.adminOnly || isLogisticsAdmin);
        return (
            <div className={`${isCollapsed ? 'w-[72px]' : 'w-[275px]'} h-full bg-transparent border-r border-[#2C2C2E] flex flex-col flex-shrink-0 text-[14px] font-sans text-white transition-[width,background-color,border-color] duration-300`}>
                <div className={`w-full flex items-center ${isCollapsed ? 'justify-center px-[10px]' : 'justify-between px-[15px]'} pt-[14px] pb-4`}>
                    {!isCollapsed ? <span className="font-bold text-[20px] tracking-tight font-inter ml-[5px] text-white">Logistics</span> : null}
                    <button type="button" onClick={() => setIsCollapsed((value) => !value)} title={isCollapsed ? '사이드바 펼치기' : '사이드바 접기'} className="text-[#86868B] hover:text-white pb-1 transition-colors cursor-pointer mt-[4px]">
                        <svg className={`w-[22px] h-[18px] transition-transform ${isCollapsed ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.8">
                            <rect x="2" y="4" width="20" height="16" rx="3" ry="3" />
                            <line x1="8" y1="4" x2="8" y2="20" />
                        </svg>
                    </button>
                </div>

                <div className={`flex-1 overflow-y-auto pb-5 hide-scrollbar flex flex-col ${isCollapsed ? 'px-[9px]' : 'px-[11px]'}`}>
                    {!isCollapsed ? (
                        <div className="mb-3 px-[7px] text-[11px] font-semibold uppercase tracking-[0.14em] text-[#86868B]">
                            Logistics Platform
                        </div>
                    ) : null}
                    <div className="flex flex-col gap-0">
                        {visibleLogisticsItems.map((item) => {
                            const isActive = currentPath === item.path || currentPath.startsWith(`${item.path}/`);
                            return (
                                <div key={item.path} title={isCollapsed ? item.label : undefined} onClick={() => handleNavigation(item.path)} className={`flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'} py-[7px] rounded-xl cursor-pointer transition-colors duration-200 outline-none select-none ${isActive ? 'bg-[#151515] px-[9px] -mx-[2px]' : 'px-[7px] hover:bg-[#151515]'}`}>
                                    <div className={`flex items-center ${isCollapsed ? 'justify-center' : ''}`}>
                                        <span className={`text-white ${isCollapsed ? '[&>svg]:mr-0' : ''}`}>{item.icon}</span>
                                        {!isCollapsed ? <span className="text-[14px] text-white font-light">{item.label}</span> : null}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                <div className="relative border-t border-[#2C2C2E] p-3">
                    <button type="button" onClick={() => setShowProfileMenu((value) => !value)} className={`w-full flex items-center ${isCollapsed ? 'justify-center' : 'justify-start'} rounded-xl px-2 py-2 hover:bg-[#151515]`}>
                        <div className="w-8 h-8 rounded-full bg-[#3c3c3c] overflow-hidden shrink-0">
                            <img src={`${import.meta.env.BASE_URL}${(memberInfo?.staff_name || '').replace(/\s/g, '')}.webp`} alt={memberInfo?.staff_name || '사용자'} className="w-full h-full object-cover" onError={(e) => { e.currentTarget.src = `${import.meta.env.BASE_URL}default_avatar.svg`; }} />
                        </div>
                        {!isCollapsed ? (
                            <div className="ml-3 min-w-0 text-left">
                                <div className="truncate text-[13px] font-semibold text-white">{memberInfo?.staff_name || '로그인 사용자'}</div>
                                <div className="truncate text-[11px] text-[#86868B]">{memberInfo?.organization || memberInfo?.department || '조직 미확인'}</div>
                            </div>
                        ) : null}
                    </button>
                    {showProfileMenu ? (
                        <>
                            <div className="fixed inset-0 z-40" onClick={() => setShowProfileMenu(false)} />
                            <div className="absolute bottom-full left-3 right-3 z-50 mb-2 rounded-[16px] border border-[#3A3A3C] bg-[#2C2C2E] py-2 shadow-lg">
                                <button onClick={async () => { setShowProfileMenu(false); await signOut(); }} className="flex w-full cursor-pointer items-center gap-3 px-4 py-2.5 text-left text-[14px] font-medium text-[#FF453A] transition-colors hover:bg-red-500/10">
                                    로그아웃
                                </button>
                            </div>
                        </>
                    ) : null}
                </div>
            </div>
        );
    }

    return (
        <div className={`${isCollapsed ? 'w-[72px]' : 'w-[275px]'} h-full bg-transparent border-r border-[#2C2C2E] flex flex-col flex-shrink-0 text-[14px] font-sans text-white transition-[width,background-color,border-color] duration-300`}>

            {/* Header */}
            <div className={`w-full flex items-center ${isCollapsed ? 'justify-center px-[10px]' : 'justify-between px-[15px]'} pt-[14px] pb-4`}>
                {!isCollapsed ? <span className="font-bold text-[20px] tracking-tight font-inter ml-[5px] text-white">
                    IOTA Seoul
                </span> : null}
                <button type="button" onClick={() => setIsCollapsed((value) => !value)} title={isCollapsed ? '사이드바 펼치기' : '사이드바 접기'} className="text-[#86868B] hover:text-white pb-1 transition-colors cursor-pointer mt-[4px]">
                    <svg className={`w-[22px] h-[18px] transition-transform ${isCollapsed ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.8">
                        <rect x="2" y="4" width="20" height="16" rx="3" ry="3" />
                        <line x1="8" y1="4" x2="8" y2="20" />
                    </svg>
                </button>
            </div>

            {/* Main Menu */}
            <div className={`flex-1 overflow-y-auto pb-5 hide-scrollbar flex flex-col ${isCollapsed ? 'px-[9px]' : 'px-[11px]'}`}>

                <div className="flex flex-col gap-0">
                    {menuItems.map((item) => {
                        const isActive = currentPath === item.path;
                        const hasSubItems = item.subItems && item.subItems.length > 0;
                        const isExpanded = item.id === 2 ? isVehicleOpen : false;

                        return (
                            <div key={item.id} className="flex flex-col">
                                <div
                                    onClick={() => {
                                        if (item.id === 2) {
                                            setIsVehicleOpen(!isVehicleOpen);
                                        } else {
                                            handleNavigation(item.path);
                                        }
                                    }}
                                    title={isCollapsed ? item.label : undefined}
                                    className={`flex items-center ${isCollapsed ? 'justify-center px-[7px]' : 'justify-between'} py-[7px] rounded-xl cursor-pointer transition-colors duration-200 outline-none select-none ${isActive ? 'bg-[#151515] px-[9px] -mx-[2px]' : 'px-[7px] hover:bg-[#151515]'}`}
                                >
                                    <div className={`flex items-center ${isCollapsed ? 'justify-center' : ''}`}>
                                        <span className={`text-white ${isCollapsed ? '[&>svg]:mr-0' : ''}`}>
                                            {item.icon}
                                        </span>
                                        {!isCollapsed ? <span className="text-[14px] text-white font-light">
                                            {item.label}
                                        </span> : null}
                                    </div>
                                    {!isCollapsed ? <div className="flex items-center gap-2">
                                        {item.badge && (
                                            <div className="bg-[#f87171]/20 text-[#f87171] text-[10px] px-2 py-0.5 rounded-full">
                                                {item.badge}
                                            </div>
                                        )}
                                        {hasSubItems ? (
                                            <div 
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    if (item.id === 2) {
                                                        setIsVehicleOpen(!isVehicleOpen);
                                                    }
                                                }}
                                                className="p-1 -mr-1 hover:bg-white/10 rounded-md transition-colors flex items-center justify-center cursor-pointer"
                                            >
                                                <svg className={`w-3.5 h-3.5 text-[#86868B] transition-transform duration-200 ${isExpanded ? 'rotate-0' : '-rotate-90'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                                                </svg>
                                            </div>
                                        ) : (
                                            <svg className="w-3.5 h-3.5 text-white translate-x-[2px] hidden" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7-7" /></svg>
                                        )}
                                    </div> : null}
                                </div>
                                {hasSubItems && isExpanded && !isCollapsed && (
                                    <div className="flex flex-col gap-0 mt-[2px] mb-[2px] pl-[28px]">
                                        {item.subItems.map(sub => {
                                            const isSubActive = currentPath === sub.path;
                                            return (
                                                <div
                                                    key={sub.id}
                                                    onClick={(e) => { 
                                                        e.stopPropagation(); 
                                                        if (sub.externalUrl) {
                                                            window.open(sub.externalUrl, '_blank');
                                                        } else {
                                                            handleNavigation(sub.path); 
                                                        }
                                                    }}
                                                    className={`group flex items-center justify-between py-[4px] rounded-xl cursor-pointer transition-colors duration-200 outline-none select-none ${isSubActive ? 'bg-[#151515] px-[9px] -mx-[2px]' : 'px-[7px] hover:bg-[#151515]'}`}
                                                >
                                                    <div className="flex items-center gap-[6px]">
                                                        <span className={`text-[14px] font-light transition-colors ${isSubActive ? 'text-white' : 'text-[#A1A1AA] group-hover:text-white'}`}>
                                                            {sub.label}
                                                        </span>
                                                        {sub.externalUrl && (
                                                            <svg className={`w-3.5 h-3.5 transition-colors ${isSubActive ? 'text-[#888]' : 'text-[#666] group-hover:text-[#888]'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                                            </svg>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* 워크스페이스 영역 */}
                <div className={`${isCollapsed ? 'mt-3 mb-2' : 'mt-6 mb-2'}`}>
                    <div 
                        className={`flex items-center justify-between font-semibold mb-[7px] text-[13px] text-[#86868B] hover:text-white cursor-pointer transition-colors duration-300 px-[7px] ${isCollapsed ? 'hidden' : ''}`}
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
                                const isActive = currentPath === item.path || currentPath.startsWith(`${item.path}/`);
                                return (
                                <div key={idx} title={isCollapsed ? item.label : undefined} onClick={() => handleNavigation(item.path)} className={`flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'} py-[7px] rounded-xl cursor-pointer transition-colors duration-200 outline-none select-none ${isActive ? 'bg-[#151515] px-[9px] -mx-[2px]' : 'px-[7px] hover:bg-[#151515]'}`}>
                                    <div className={`flex items-center ${isCollapsed ? 'justify-center' : ''}`}>
                                        <span className={`text-white ${isCollapsed ? '[&>svg]:mr-0' : ''}`}>
                                            {item.icon}
                                        </span>
                                        {!isCollapsed ? <span className="text-[14px] text-white font-light">
                                            {item.label}
                                        </span> : null}
                                    </div>
                                </div>
                            );
                            })}
                        </div>
                    )}
                </div>

                {/* 이해관계자 영역 */}
                <div className={`${isCollapsed ? 'hidden' : 'mt-6 mb-2'}`}>
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
                                { label: '잠재 임차사 (TBD)', path: 'platform/iotaseoul/stakeholder/tenant' },
                                { label: '운영 파트너 (TBD)', path: 'platform/iotaseoul/stakeholder/partner' }].map((item, idx) => {
                                const isActive = currentPath === item.path;
                                return (
                                <div key={idx} onClick={() => handleNavigation(item.path)} className={`flex items-center justify-between py-[7px] rounded-xl cursor-pointer transition-colors duration-200 outline-none select-none ${isActive ? 'bg-[#151515] px-[9px] -mx-[2px]' : 'px-[7px] hover:bg-[#151515]'}`}>
                                    <div className="flex items-center">
                                        {/* 아이콘 제거, 텍스트 왼쪽 정렬 */}
                                        <span className={`text-[14px] font-light ${item.label.includes('TBD') ? 'text-[#666]' : 'text-white'}`}>
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
                <div className={`${isCollapsed ? 'hidden' : 'mt-6 mb-2'}`}>
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
                                { label: '의사결정 및 평가 체계', path: 'platform/iotaseoul/governance/principles' },
                                { label: '90 Day Roadmap', path: 'platform/iotaseoul/governance/roadmap' },
                                { label: 'RACI', path: 'platform/iotaseoul/governance/raci' },
                                { label: '회의체 운영 방침', path: 'platform/iotaseoul/governance/meetings' },
                                { label: '펀드 운용 R&R', path: 'platform/iotaseoul/governance/fund-rnr' },
                                { label: '프로젝트리츠 워킹그룹', path: 'platform/iotaseoul/governance/working-group' },
                                { label: '대외 소통 정책', path: 'platform/iotaseoul/governance/external-comm' },
                                { label: 'Top 10 리스크 대응 방향', path: 'platform/iotaseoul/governance/risk-top10' }].map((item, idx) => {
                                const isActive = currentPath === item.path;
                                return (
                                <div key={idx} onClick={() => handleNavigation(item.path)} className={`flex items-center justify-between py-[7px] rounded-xl cursor-pointer transition-colors duration-200 outline-none select-none ${isActive ? 'bg-[#151515] px-[9px] -mx-[2px]' : 'px-[7px] hover:bg-[#151515]'}`}>
                                    <div className="flex items-center">
                                        {/* 아이콘 제거, 텍스트 왼쪽 정렬 */}
                                        <span className="text-[14px] text-white font-light">
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
            <div className="relative">
                {/* Popover Menu */}
                {showProfileMenu && (
                    <>
                        <div className="fixed inset-0 z-40" onClick={() => setShowProfileMenu(false)}></div>
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-[258px] bg-[#2C2C2E] border border-[#3A3A3C] rounded-[16px] shadow-lg py-2 z-50">
                            <button onClick={() => { setShowProfileMenu(false); setShowPasswordModal(true); }} className="w-full text-left px-4 py-2.5 text-[14px] font-medium text-[#E5E5E5] hover:bg-[#3A3A3C] transition-colors flex items-center gap-3 cursor-pointer">
                                <svg className="w-4 h-4 text-[#A1A1AA]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" /></svg>
                                비밀번호 변경
                            </button>
                            <button onClick={() => { setShowProfileMenu(false); setShowContactModal(true); }} className="w-full text-left px-4 py-2.5 text-[14px] font-medium text-[#E5E5E5] hover:bg-[#3A3A3C] transition-colors flex items-center gap-3 cursor-pointer">
                                <svg className="w-4 h-4 text-[#A1A1AA]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                                플랫폼 이용 문의
                            </button>
                            <div className="my-1 border-t border-white/5"></div>
                            <button onClick={async () => { setShowProfileMenu(false); await signOut(); }} className="w-full text-left px-4 py-2.5 text-[14px] font-medium text-[#FF453A] hover:bg-red-500/10 transition-colors flex items-center gap-3 cursor-pointer">
                                <svg className="w-4 h-4 text-[#FF453A]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                                로그아웃
                            </button>
                        </div>
                    </>
                )}

                <div 
                    onClick={() => setShowProfileMenu(!showProfileMenu)}
                    className={`${isCollapsed ? 'justify-center px-[10px]' : 'justify-between pl-[15px] pr-[17px]'} pt-[10px] pb-3 border-t border-[#3A3A3C] w-full flex items-center transition-colors duration-300 cursor-pointer hover:bg-white/5`}
                >
                    <div className={`flex items-center gap-3 p-1.5 rounded-lg transition-colors duration-300 ${isCollapsed ? '' : '-ml-1.5'}`}>
                        <div className="w-10 h-10 rounded-full overflow-hidden flex items-center justify-center bg-[#2C2C2E] -ml-[2px] border border-white/10">
                            {memberInfo?.staff_name ? (
                                <img 
                                    src={`${import.meta.env.BASE_URL}${memberInfo.staff_name}.webp`} 
                                    alt={`${memberInfo.staff_name} 프로필`} 
                                    className="w-full h-full object-cover"
                                    onError={(e) => { 
                                        const target = e.currentTarget;
                                        const avatar = target.parentElement;
                                        target.style.display = 'none';
                                        if (!avatar) return;
                                        avatar.textContent = memberInfo.staff_name.substring(0, 2);
                                        avatar.className = 'w-10 h-10 rounded-full bg-[#c3c2b7] text-[#1F1F1E] flex items-center justify-center text-[15px] font-bold tracking-tighter -ml-[2px]';
                                    }}
                                />
                            ) : (
                                <span className="text-[#1F1F1E] font-bold">U</span>
                            )}
                        </div>
                        {!isCollapsed ? <div className="flex flex-col max-w-[130px]">
                            <span className="font-semibold text-[14px] leading-tight mb-0.5 text-white tracking-tight truncate">
                                {memberInfo?.staff_name ? `${memberInfo.staff_name} ${memberInfo.role_code === 'master' ? '마스터' : memberInfo.role_code === 'director' ? '책임' : '매니저'}` : '로그인 필요'}
                            </span>
                            <span className="text-[#86868B] text-[12px] leading-none font-normal truncate">
                                {user?.email || '권한 없음'}
                            </span>
                        </div> : null}
                    </div>

                    {!isCollapsed ? <div className="flex items-center">
                        <button 
                            type="button"
                            className="text-[#86868B] transition-colors p-1 pointer-events-none"
                        >
                            <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 5l7 7-7 7" /></svg>
                        </button>
                    </div> : null}
                </div>
            </div>

            {/* Modals */}
            {showContactModal && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm transition-opacity">
                    <div className="bg-[#1C1C1E] w-[400px] rounded-[24px] p-8 shadow-2xl flex flex-col items-center">
                        <div className="w-12 h-12 rounded-full bg-[#2C2C2E] flex items-center justify-center mb-5">
                            <svg className="w-6 h-6 text-white" fill="none" strokeWidth="2" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                            </svg>
                        </div>
                        <h3 className="text-[22px] font-bold text-white mb-2 tracking-tight">플랫폼 이용 문의</h3>
                        <p className="text-[15px] font-medium text-[#A1A1AA] text-center leading-relaxed mb-8">
                            ***@igisam.com<br/>010-****-****<br/>전기영 매니저에게 연락해주세요.
                        </p>
                        <button onClick={() => setShowContactModal(false)} className="w-full py-3.5 rounded-[16px] bg-[#2C2C2E] text-white font-semibold text-[16px] hover:bg-[#3A3A3C] transition-colors cursor-pointer">
                            닫기
                        </button>
                    </div>
                </div>
            )}

            {showPasswordModal && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm transition-opacity">
                    <div className="bg-[#1C1C1E] w-[400px] rounded-[24px] p-8 shadow-2xl flex flex-col items-center">
                        <div className="w-12 h-12 rounded-full bg-[#2C2C2E] flex items-center justify-center mb-5">
                            <svg className="w-6 h-6 text-white" fill="none" strokeWidth="2" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                            </svg>
                        </div>
                        <h3 className="text-[22px] font-bold text-white mb-2 tracking-tight">비밀번호 변경</h3>
                        <p className="text-[15px] font-medium text-[#A1A1AA] text-center leading-relaxed mb-6">
                            새로운 비밀번호를 입력해주세요.
                        </p>
                        <input 
                            type="password" 
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            placeholder="새 비밀번호"
                            className="w-full h-[52px] bg-[#1C1C1E] border border-[#333333] rounded-[16px] px-5 text-[17px] text-white placeholder:text-[#86868B] focus:outline-none focus:border-[#0071E3] focus:ring-1 focus:ring-[#0071E3] transition-all mb-4"
                        />
                        <div className="flex w-full gap-3">
                            <button onClick={() => setShowPasswordModal(false)} className="flex-1 py-3.5 rounded-[16px] bg-[#2C2C2E] text-white font-semibold text-[16px] hover:bg-[#3A3A3C] transition-colors cursor-pointer">
                                취소
                            </button>
                            <button onClick={handlePasswordChange} disabled={!newPassword} className="flex-1 py-3.5 rounded-[16px] bg-[#0071E3] text-white font-semibold text-[16px] hover:bg-[#0077ED] transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">
                                변경하기
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
