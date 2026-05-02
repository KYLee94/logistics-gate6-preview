import React, { useState } from 'react';


const stakeholderGroups = [
                    {
                        groupTitle: 'CFT 총괄',
                        members: [
                            {
                                name: '이철승',
                                photo: '이철승',
                                roles: ['리얼에셋부문/부문대표', '사업&개발/부문대표', '기업마케팅센터/부문대표', 'IOTA CFT/TF장', 'SMP/SMP'],
                                responsibility: 'CFT 총괄 책임인력',
                                email: 'ethan.lee@igisam.com',
                                phone: '010-3186-0868',
                            },
                        ]
                    },
                    {
                        groupTitle: '사업PM',
                        members: [
                            {
                                name: '권순일',
                                photo: '권순일',
                                roles: ['사업그룹1파트/파트장+', 'IOTA CFT', '개발PFV TF/TF장'],
                                responsibility: '사업PM 책임인력',
                                email: 'ksoonil@igisam.com',
                                phone: '010-8567-6907',
                            },
                            {
                                name: '강순용',
                                photo: '강순용',
                                roles: ['사업그룹2파트/파트장+', 'IOTA CFT'],
                                responsibility: '사업PM 책임인력',
                                email: 'sykang@igisam.com',
                                phone: '010-8274-4638',
                            },
                            {
                                name: '윤주형',
                                photo: '윤주형',
                                roles: ['사업그룹1파트/Sr.Manager', 'IOTA CFT'],
                                email: 'jh.yoon@igisam.com',
                                phone: '010-5210-1418',
                            },
                            {
                                name: '김제익',
                                photo: '김제익',
                                roles: ['사업그룹1파트', 'IOTA CFT'],
                                email: 'jake.kim@igisam.com',
                                phone: '010-5055-8197',
                            },
                            {
                                name: '류홍',
                                photo: '류홍',
                                roles: ['사업그룹1파트', 'IOTA CFT'],
                                email: 'ryuhong0526@igisam.com',
                                phone: '010-9081-7818',
                            },
                            {
                                name: '박만진',
                                photo: '박만진',
                                roles: ['사업그룹1파트', 'IOTA CFT'],
                                email: 'jacob.park@igisam.com',
                                phone: '010-4343-7438',
                            },
                            {
                                name: '박일훈',
                                photo: '박일훈',
                                roles: ['사업그룹1파트', 'IOTA CFT'],
                                email: 'ilhoon.park@igisam.com',
                                phone: '010-7573-6985',
                            },
                            {
                                name: '이정원',
                                photo: '이정원',
                                roles: ['사업그룹1파트+', 'IOTA CFT'],
                                email: 'garden.lee@igisam.com',
                                phone: '010-3161-2931',
                            },
                            {
                                name: '전무경',
                                photo: '전무경',
                                roles: ['사업그룹1파트', 'IOTA CFT'],
                                email: 'mooj@igisam.com',
                                phone: '010-2464-3709',
                            },
                            {
                                name: '한찬호',
                                photo: '한찬호',
                                roles: ['사업그룹2파트/Sr.Manager+', 'IOTA CFT'],
                                email: 'chanho.han@igisam.com',
                                phone: '010-4818-2108',
                            },
                            {
                                name: '박석제',
                                photo: '박석제',
                                roles: ['사업그룹2파트', 'IOTA CFT'],
                                email: 'seokje.park@igisam.com',
                                phone: '010-3319-9395',
                            },
                            {
                                name: '박채현',
                                photo: '박채현',
                                roles: ['사업그룹2파트', 'IOTA CFT'],
                                email: 'p.chhyn@igisam.com',
                                phone: '010-5095-1915',
                            },
                            {
                                name: '소현준',
                                photo: '소현준',
                                roles: ['사업그룹2파트', 'IOTA CFT'],
                                email: 'hyunjoon.so@igisam.com',
                                phone: '010-3857-6793',
                            },
                            {
                                name: '이수정',
                                photo: '이수정',
                                roles: ['사업그룹2파트', 'IOTA CFT'],
                                email: 'sjl1747@igisam.com',
                                phone: '010-9222-1747',
                            },
                            {
                                name: '조영비',
                                photo: '조영비',
                                roles: ['사업그룹2파트', 'IOTA CFT'],
                                email: 'youngbi@igisam.com',
                                phone: '010-2059-6511',
                            },
                            {
                                name: '한수정',
                                photo: '한수정',
                                roles: ['사업그룹2파트', 'IOTA CFT'],
                                email: 'soojeong.han@igisam.com',
                                phone: '010-7609-5868',
                            },
                        ]
                    },
                    {
                        groupTitle: '파이낸싱',
                        members: [
                            {
                                name: '박준호',
                                photo: '박준호',
                                roles: ['LFC 센터장'],
                                responsibility: '파이낸싱 책임인력',
                                email: 'jhpark@igisam.com',
                                phone: '010-0000-0000',
                            },
                            {
                                name: '강석민',
                                photo: '강석민',
                                roles: ['LFC 실무진'],
                                email: 'smkang@igisam.com',
                                phone: '010-0000-0000',
                            },
                            {
                                name: '정리훈',
                                photo: '정리훈',
                                roles: ['LFC 실무진'],
                                email: 'rhjung@igisam.com',
                                phone: '010-0000-0000',
                            },
                            {
                                name: '손유정',
                                photo: '손유정',
                                roles: ['LFC 실무진'],
                                email: 'yjson@igisam.com',
                                phone: '010-0000-0000',
                            },
                            {
                                name: '김지우',
                                photo: '김지우',
                                roles: ['LFC 실무진'],
                                email: 'jwkim@igisam.com',
                                phone: '010-0000-0000',
                            },
                            {
                                name: '박현승',
                                photo: '박현승',
                                roles: ['LFC 실무진'],
                                email: 'hspark@igisam.com',
                                phone: '010-0000-0000',
                            },
                            {
                                name: '이성민',
                                photo: '이성민',
                                roles: ['LFC 실무진'],
                                email: 'smlee@igisam.com',
                                phone: '010-0000-0000',
                            },
                            {
                                name: '한승환',
                                photo: '한승환',
                                roles: ['LFC 실무진'],
                                email: 'shhan@igisam.com',
                                phone: '010-0000-0000',
                            },
                        ]
                    },
                    {
                        groupTitle: '개발관리',
                        members: [
                            {
                                name: '홍장군',
                                photo: '홍장군',
                                roles: ['개발솔루션센터/센터장+'],
                                responsibility: '개발관리 책임인력',
                                email: 'jghong@igisam.com',
                                phone: '010-6229-8919',
                            },
                            {
                                name: '채원',
                                photo: '채원',
                                roles: ['개발솔루션센터/담당+'],
                                email: 'won.chae@igisam.com',
                                phone: '010-7222-7469',
                            },
                            {
                                name: '김보성',
                                photo: '김보성',
                                roles: ['개발솔루션센터'],
                                email: 'kbs1208@igisam.com',
                                phone: '010-2369-2069',
                            },
                            {
                                name: '전승희',
                                photo: '전승희',
                                roles: ['개발솔루션센터'],
                                email: 'shjeon@igisam.com',
                                phone: '010-3804-6529',
                            },
                            {
                                name: '김대익',
                                photo: '김대익',
                                roles: ['개발솔루션센터'],
                                email: 'dikim@igisam.com',
                                phone: '010-9251-3466',
                            },
                            {
                                name: '장성진',
                                photo: '장성진',
                                roles: ['개발솔루션센터'],
                                email: 'jang.sj@igisam.com',
                                phone: '010-9680-3293',
                            },
                            {
                                name: '이정훈',
                                photo: '이정훈',
                                roles: ['개발솔루션센터/담당'],
                                email: '2019jhlee@igisam.com',
                                phone: '010-4175-5799',
                            },
                            {
                                name: '박봉서',
                                photo: '박봉서',
                                roles: ['개발솔루션센터/담당'],
                                email: 'okbong21@igisam.com',
                                phone: '010-3370-3594',
                            },
                        ]
                    },
                    {
                        groupTitle: '기업마케팅',
                        members: [
                            {
                                name: '김민지',
                                photo: '김민지',
                                roles: ['기업마케팅담당'],
                                responsibility: '기업마케팅 책임인력',
                                email: 'mjkim@igisam.com',
                                phone: '010-0000-0000',
                            },
                            {
                                name: '고아라',
                                photo: '고아라',
                                roles: ['EMC 실무진'],
                                email: 'arkoh@igisam.com',
                                phone: '010-0000-0000',
                            },
                            {
                                name: '이가현',
                                photo: '이가현',
                                roles: ['SSC 실무진'],
                                email: 'ghlee@igisam.com',
                                phone: '010-0000-0000',
                            },
                            {
                                name: '정수명',
                                photo: '정수명',
                                roles: ['SSC 실무진'],
                                email: 'smjung@igisam.com',
                                phone: '010-0000-0000',
                            },
                        ]
                    },
                    {
                        groupTitle: '상품·디지털',
                        members: [
                            {
                                name: '김현수',
                                photo: '김현수',
                                roles: ['공간솔루션센터장'],
                                responsibility: '상품·디지털 책임인력',
                                email: 'hskim@igisam.com',
                                phone: '010-0000-0000',
                            },
                            {
                                name: '현철호',
                                photo: '현철호',
                                roles: ['디지털사업그룹/그룹장', '솔루션파트/그룹장', 'IOTA CFT'],
                                responsibility: '상품·디지털 책임인력',
                                email: 'chyun@igisam.com',
                                phone: '010-3368-1331',
                            },
                            {
                                name: '신민호',
                                photo: '신민호',
                                roles: ['솔루션파트/Sr.Manager'],
                                email: 'rossshin@igisam.com',
                                phone: '010-6593-2239',
                            },
                        ]
                    },
                    {
                        groupTitle: '펀드운용',
                        members: [
                            {
                                name: '김행단',
                                photo: '김행단',
                                roles: ['KAM그룹장'],
                                responsibility: '펀드운용 책임인력',
                                email: 'hdkim@igisam.com',
                                phone: '010-0000-0000',
                            },
                        ]
                    },
                    {
                        groupTitle: 'IPR',
                        members: [
                            {
                                name: '윤용택',
                                photo: '윤용택',
                                roles: ['(관리) 사업3파트'],
                                responsibility: 'IPR 책임인력',
                                email: 'ytyoon@igisam.com',
                                phone: '010-0000-0000',
                            },
                        ]
                    },
];

export default function StakeInternal() {
    const [hoveredRow, setHoveredRow] = useState(null);
    const [hoveredImage, setHoveredImage] = useState(null);
    const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
    const [noImageNames, setNoImageNames] = useState(new Set());
    const [searchQuery, setSearchQuery] = useState('');
    const [activeSearch, setActiveSearch] = useState('');
    const [isTableCollapsed, setIsTableCollapsed] = useState(false);

    const handleImageError = (name) => {
        setNoImageNames(prev => {
            const next = new Set(prev);
            next.add(name);
            return next;
        });
    };

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
                     onMouseEnter={() => { if(!noImageNames.has(cleanName)) setHoveredImage(cleanName) }}
                     onMouseLeave={() => setHoveredImage(null)}
                >
                    <div className="w-[20px] h-[20px] shrink-0 rounded-full bg-[#3c3c3c] overflow-hidden">
                        <img src={`${import.meta.env.BASE_URL}${cleanName}.webp`} alt={name} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" onError={(e) => { e.target.src = `${import.meta.env.BASE_URL}default_avatar.svg`; handleImageError(cleanName); }} />
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
             onMouseEnter={() => { if(!noImageNames.has(cleanName)) setHoveredImage(cleanName) }}
             onMouseLeave={() => setHoveredImage(null)}
        >
            <div className="relative w-[36px] h-[36px] shrink-0 rounded-full bg-[#3c3c3c] flex items-center justify-center overflow-hidden">
                <img src={`${import.meta.env.BASE_URL}${cleanName}.webp`} alt={name} className="w-full h-full object-cover" onError={(e) => { e.target.src = `${import.meta.env.BASE_URL}default_avatar.svg`; handleImageError(cleanName); }} />
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
        <div className="w-full flex-1 flex flex-col pt-[77px] pb-[100px] max-w-[1112px] mx-auto" onMouseMove={handleMouseMove}>
            <div className="flex items-center justify-between mb-[12px]">
                <h1 className="text-[36px] font-bold text-white tracking-tight leading-none font-['Inter']">IGIS 내부인력</h1>
                <form onSubmit={(e) => { 
                    e.preventDefault(); 
                    setActiveSearch(searchQuery); 
                    if (searchQuery.trim() !== '') setIsTableCollapsed(true);
                    else setIsTableCollapsed(false);
                }} className="relative">
                    <div className="absolute inset-y-0 left-[14px] flex items-center pointer-events-none">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#86868B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                    </div>
                    <input 
                        type="text" 
                        placeholder="이름, 직무, 활동 등 자유롭게 검색하세요" 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="bg-[#272726] border border-[#545451] hover:border-[#666] rounded-[12px] pl-[36px] pr-[16px] py-[8px] text-[13px] text-white w-[280px] focus:outline-none focus:border-[#2997ff] transition-colors" 
                    />
                    <button type="submit" className="hidden"></button>
                </form>
            </div>
            <p className="text-[15px] text-[#86868B] mb-[36px]">이오타서울 통합 업무수행 조직(CFT)의 핵심 책임/실무 인력 명단입니다.</p>
            
            <div className="flex items-center justify-between mb-[16px]">
                <h2 className="text-[18px] font-bold text-white tracking-tight">조직도 요약표</h2>
                <button 
                    onClick={() => setIsTableCollapsed(!isTableCollapsed)}
                    className="text-[13px] text-[#86868B] hover:text-white transition-colors flex items-center gap-[4px]"
                >
                    {isTableCollapsed ? '표 펼치기 ↓' : '표 접기 ↑'}
                </button>
            </div>
            
            {!isTableCollapsed && (
                <div className="w-full border border-[#333] rounded-[24px] overflow-hidden transition-all">
                    <table className="w-full text-left bg-transparent border-collapse table-fixed">
                    <thead>
                        <tr>
                            <th className="px-[24px] py-[16px] text-[13px] font-normal text-[#86868B] border-b border-[#333] border-r border-[#333] w-[140px] bg-transparent">기능셀</th>
                            <th className="px-[14px] py-[16px] text-[13px] font-normal text-[#86868B] border-b border-[#333]  w-[190px] bg-transparent">책임인력</th>
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
            )}

            {/* Profiles & Activity Logs Section */}
            <div className="w-full mt-[80px] flex flex-col gap-[60px]">
                {/* Dummy Data Array */}
                {(activeSearch.trim() === '' ? stakeholderGroups : stakeholderGroups.map(group => {
                    const searchLower = activeSearch.toLowerCase();
                    const filteredMembers = group.members.filter(m => 
                        m.name.toLowerCase().includes(searchLower) ||
                        m.roles.some(r => r.toLowerCase().includes(searchLower)) ||
                        (m.responsibility && m.responsibility.toLowerCase().includes(searchLower)) ||
                        m.email.toLowerCase().includes(searchLower)
                    );
                    return { ...group, members: filteredMembers };
                }).filter(group => group.members.length > 0)).map((group, gIdx) => (
                    <div key={gIdx} className="w-full flex flex-col gap-[32px]">
                        {/* Group Header */}
                        <h2 className="text-[20px] font-bold text-white tracking-tight">{group.groupTitle}</h2>
                        
                        {/* Members List */}
                        <div className="w-full flex flex-col gap-[46px]">
                            {group.members.map((member, mIdx) => (
                                <div key={mIdx} className="w-full flex items-start gap-[40px]">
                                    {/* 1. Photo */}
                                    <div className="w-[120px] h-[120px] shrink-0 rounded-full bg-[#3c3c3c] overflow-hidden relative shadow-lg mt-[4px]">
                                        <img src={`${import.meta.env.BASE_URL}${member.photo}.webp`} alt={member.name} className="w-full h-full object-cover" onError={(e) => { e.target.src = `${import.meta.env.BASE_URL}default_avatar.svg`; }} />
                                        <div className="absolute inset-0 rounded-full border border-white/10 pointer-events-none"></div>
                                    </div>
                                    
                                    {/* 2. Name & Roles */}
                                    <div className="w-[156px] shrink-0 flex flex-col">
                                        <div className="flex items-center h-[24px] mb-[6px]">
                                            <span className="text-[15px] font-bold text-white leading-none">{member.name}</span>
                                        </div>
                                        <div className="flex flex-col gap-[4px] pt-[4px]">
                                            {member.roles.map((role, rIdx) => (
                                                <span key={rIdx} className="text-[13px] text-[#bbb9af] leading-tight tracking-tight">{role}</span>
                                            ))}
                                            {member.responsibility && (
                                                <span className="text-[13px] text-[#2997ff] leading-tight tracking-tight">{member.responsibility}</span>
                                            )}
                                        </div>
                                        <div className="flex flex-col gap-[2px] mt-[12px]">
                                            <span className="text-[12px] text-[#666] tracking-tight">{member.email}</span>
                                            <span className="text-[12px] text-[#666] tracking-tight">{member.phone}</span>
                                        </div>
                                    </div>
                                    
                                    {/* 3. Activity Logs */}
                                    <div className="flex-1 flex flex-col">
                                        {/* Table Header */}
                                        <div className="grid grid-cols-[1fr_80px_70px_60px_160px_80px] gap-[16px] h-[24px] items-center mb-[6px] mr-[4px]">
                                            <span className="text-[12px] text-[#86868B] tracking-tight leading-none">활동로그</span>
                                            <span className="text-[12px] text-[#86868B] tracking-tight leading-none">프로젝트</span>
                                            <span className="text-[12px] text-[#86868B] tracking-tight leading-none">활용목적</span>
                                            <span className="text-[12px] text-[#86868B] tracking-tight leading-none">상태</span>
                                            <span className="text-[12px] text-[#86868B] tracking-tight leading-none">이해관계</span>
                                            <span className="text-[12px] text-[#86868B] tracking-tight leading-none">날짜</span>
                                        </div>
                                        
                                        {/* Table Rows (Dummy Data) */}
                                        {[
                                            { log: '816 관련 소노인터내셔널 협업 미팅', project: 'IOTA2 816', purpose: '리스크판단', status: '진행중', stakeholder: '소노인터내셔널 서준혁 회장', date: '2026.05.02' },
                                            { log: "중순위 대주 '한투리얼에셋자산운용' 재...", project: '421 Fund', purpose: '협업', status: '완료', stakeholder: '한투리얼에셋 서준혁 회장', date: '2026.05.01' },
                                            { log: '816 투자자 협의(kt estate IR day 후..', project: 'IOTA1 427', purpose: '의사결정', status: '검토중', stakeholder: 'KT estate 서준혁 회장', date: '2026.04.30' },
                                            { log: 'LG전자 지주 제안 관련 미팅', project: 'IOTA1 427', purpose: '협업', status: '진행중', stakeholder: 'LG전자 서준혁 회장', date: '2026.04.30' },
                                            { log: '427 호텔 및 남대문교회 진행사항 보고', project: 'IOTA2 427', purpose: '리스크판단', status: '진행중', stakeholder: '현대건설 서준혁 회장', date: '2026.04.28' },
                                        ].map((row, rIdx) => (
                                            <div key={rIdx} className="grid grid-cols-[1fr_80px_70px_60px_160px_80px] gap-[16px] py-[4px] group cursor-pointer hover:bg-white/5 transition-colors -ml-[8px] pl-[8px] mr-[4px] rounded-[8px] items-center">
                                                <span className="text-[13px] text-[#E5E5E5] group-hover:text-[#bbb9af] transition-colors tracking-tight truncate leading-tight">{row.log}</span>
                                                <span className="text-[13px] text-[#E5E5E5] group-hover:text-[#bbb9af] transition-colors tracking-tight truncate leading-tight">{row.project}</span>
                                                <span className="text-[13px] text-[#E5E5E5] group-hover:text-[#bbb9af] transition-colors tracking-tight truncate leading-tight">{row.purpose}</span>
                                                <span className="text-[13px] text-[#E5E5E5] group-hover:text-[#bbb9af] transition-colors tracking-tight truncate leading-tight">{row.status}</span>
                                                <span className="text-[13px] text-[#E5E5E5] group-hover:text-[#bbb9af] transition-colors tracking-tight truncate leading-tight">{row.stakeholder}</span>
                                                <span className="text-[13px] text-[#E5E5E5] group-hover:text-[#bbb9af] transition-colors tracking-tight truncate leading-tight">{row.date}</span>
                                            </div>
                                        ))}
                                        
                                        {/* View All Button */}
                                        <div className="mt-[8px] flex">
                                            <button className="px-[12px] py-[6px] rounded-[10px] border border-[#333] bg-transparent text-[12px] text-[#2997ff] hover:bg-[#2997ff]/10 transition-colors font-medium cursor-pointer tracking-tight">
                                                전체 활동로그 보기
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
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
                    <img src={`${import.meta.env.BASE_URL}${hoveredImage}.webp`} alt="preview" className="w-full h-full object-cover" onError={(e) => { e.target.src = `${import.meta.env.BASE_URL}default_avatar.svg`; }} />
                </div>
            )}
        </div>
    );
}
