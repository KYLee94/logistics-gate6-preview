const fs = require('fs');
const path = require('path');

const iotaTwoPath = path.join(__dirname, 'src/components/system/IotaTwo816.jsx');
let content = fs.readFileSync(iotaTwoPath, 'utf8');

// 1. Add imports
content = content.replace(
    "import React, { useRef, useEffect } from 'react';",
    "import React, { useRef, useEffect, useState } from 'react';\nimport { supabase } from '../../utils/supabaseClient';"
);

// 2. Add state and fetch logic
const hookInject = `    const scrollRef = useRef(null);

    const [marketingData, setMarketingData] = useState([]);
    const [ecoSpecs, setEcoSpecs] = useState([]);
    const [buildingSpecs, setBuildingSpecs] = useState([]);
    const [researchInsights, setResearchInsights] = useState([]);
    const [comparisonData, setComparisonData] = useState([]);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [marketingRes, specsRes, researchRes, comparisonRes] = await Promise.all([
                    supabase.from('iota_marketing_history').select('*').order('created_at', { ascending: true }),
                    supabase.from('iota_building_specs').select('*').order('created_at', { ascending: true }),
                    supabase.from('iota_research_insights').select('*').order('created_at', { ascending: true }),
                    supabase.from('iota_building_comparison').select('*').order('created_at', { ascending: true })
                ]);

                if (marketingRes.data) setMarketingData(marketingRes.data);
                if (specsRes.data) {
                    setEcoSpecs(specsRes.data.filter(s => s.category === 'eco'));
                    setBuildingSpecs(specsRes.data.filter(s => s.category === 'spec'));
                }
                if (researchRes.data) setResearchInsights(researchRes.data);
                if (comparisonRes.data) setComparisonData(comparisonRes.data);
            } catch (err) {
                console.error("Error fetching IotaTwo816 data:", err);
            }
        };

        fetchData();
    }, []);

    const handleScroll = () => {`;

content = content.replace(/    const scrollRef = useRef\(null\);\s+const handleScroll = \(\) => {/g, hookInject);

// 3. Replace from Corporate Sales Box to the end
const corporateIndex = content.indexOf('{/* Corporate Sales & Partnership Box */}');
const corporateEnd = content.slice(0, corporateIndex);

const newBottom = `                {/* Corporate Sales & Partnership Box */}
                <div className="w-full bg-[#292928] border border-[#3c3c3c] rounded-[32px] flex flex-col mb-[20px] overflow-hidden">
                    {/* Header & Body */}
                    <div className="pl-[30px] pr-[32px] pt-[28px] pb-[27px] flex flex-col relative w-full">
                        {/* Title Row */}
                        <div className="flex items-center justify-between w-full mb-[14px]">
                            <span className="text-[14px] font-bold text-[#86868B] tracking-tight">기업 세일즈 & 파트너십</span>
                            <div className="text-[15px] text-[#86868B] cursor-pointer hover:text-[#E5E5E5] transition-colors font-medium flex items-center group tracking-tight">
                                <span>히스토리 전체보기</span>
                                <svg className="w-[12px] h-[12px] ml-[4px] text-[#666] group-hover:text-[#A1A1AA] transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7" />
                                </svg>
                            </div>
                        </div>
                        
                        {/* Content Rows */}
                        <div className="flex flex-col gap-[8px]">
                            {/* Row 1 */}
                            <div className="text-[15px] leading-[22px]">
                                <span className="text-[#86868B] font-medium mr-[6px] tracking-tight">[접촉 준비]</span>
                                <a href="#" className="text-[#c3c2b7] font-medium tracking-tight hover:text-[#fbf167] cursor-pointer transition-colors">
                                    IOTA 서울 SK 계열사 통합 이전 관련 (약 0000명 0개층 사용) 접촉 준비 
                                </a>
                                <span className="text-[#666] mx-[8px]">ㅣ</span> 
                                <a href="#" className="text-[#E5E5E5] font-medium tracking-tight hover:text-[#fbf167] cursor-pointer transition-colors">SK솔루션</a>
                                <span className="text-[#666] mx-[8px]">ㅣ</span> 
                                <a href="#" className="text-[#E5E5E5] font-medium tracking-tight hover:text-[#fbf167] cursor-pointer transition-colors">OO 사업실 OOO 본부장</a>
                            </div>
                            
                            {/* Row 2 */}
                            <div className="text-[15px] leading-[22px]">
                                <span className="text-[#86868B] font-medium mr-[6px] tracking-tight">[제안 및 검토]</span>
                                <a href="#" className="text-[#c3c2b7] font-medium tracking-tight hover:text-[#fbf167] cursor-pointer transition-colors">
                                    LG전자 이오타 임차, 프로젝트 내 설비 + 데이터센터 설비 협업 사업건 제안 및 상호 협의 진행중 
                                </a>
                                <span className="text-[#666] mx-[8px]">ㅣ</span> 
                                <a href="#" className="text-[#E5E5E5] font-medium tracking-tight hover:text-[#fbf167] cursor-pointer transition-colors">LG전자</a>
                                <span className="text-[#666] mx-[8px]">ㅣ</span> 
                                <a href="#" className="text-[#E5E5E5] font-medium tracking-tight hover:text-[#fbf167] cursor-pointer transition-colors">한국 영업본부 데이터사업실 CSO OOO</a>
                            </div>
                            
                            {/* Row 3 */}
                            <div className="text-[15px] leading-[22px]">
                                <span className="text-[#86868B] font-medium mr-[6px] tracking-tight">[제안 및 검토]</span>
                                <a href="#" className="text-[#c3c2b7] font-medium tracking-tight hover:text-[#fbf167] cursor-pointer transition-colors">
                                    법무법인 화우 임차 제안(약 1천명 이오타2 7개층 사용) 및 협의 진행중 
                                </a>
                                <span className="text-[#666] mx-[8px]">ㅣ</span> 
                                <a href="#" className="text-[#E5E5E5] font-medium tracking-tight hover:text-[#fbf167] cursor-pointer transition-colors">법무법인화우</a>
                                <span className="text-[#666] mx-[8px]">ㅣ</span> 
                                <a href="#" className="text-[#E5E5E5] font-medium tracking-tight hover:text-[#fbf167] cursor-pointer transition-colors">한영익 팀장</a>
                            </div>
                        </div>
                    </div>

                    {/* Footer Section */}
                    <div className="w-full h-[54px] border-t border-[#444]/50 flex items-center pl-[30px] gap-[24px] shrink-0">
                        <div className="flex items-center gap-[12px]">
                            <span className="text-[13px] font-bold text-[#86868B]">기업세일즈 담당</span>
                            <a href="#" className="text-[14px] font-bold text-[#E5E5E5] hover:text-[#fbf167] cursor-pointer transition-colors">기업마케팅센터</a>
                        </div>
                        <div className="w-[1px] h-[14px] bg-[#555]"></div>
                        <div className="flex items-center gap-[12px]">
                            <span className="text-[13px] font-bold text-[#86868B]">Partnership</span>
                            <a href="#" className="text-[14px] font-bold text-[#E5E5E5] hover:text-[#fbf167] cursor-pointer transition-colors">PwC</a>
                        </div>
                    </div>
                </div>

                {/* Marketing & Placemaking Box */}
                <div className="w-full bg-[#292928] border border-[#3c3c3c] rounded-[32px] flex flex-row mb-[20px] overflow-hidden">
                    
                    {/* Left Column Strategy: Marketing */}
                    <div className="flex-1 border-r border-[#444]/50 flex flex-col">
                        {/* Body */}
                        <div className="pl-[30px] pr-[32px] pt-[28px] pb-[27px] flex flex-col flex-1">
                            {/* Title */}
                            <div className="flex items-center justify-between w-full mb-[14px]">
                                <span className="text-[14px] font-bold text-[#86868B] tracking-tight">Marketing</span>
                                <div className="text-[15px] text-[#86868B] cursor-pointer hover:text-[#E5E5E5] transition-colors font-medium flex items-center group tracking-tight -mr-[9px]">
                                    <span>마케팅 내역 전체보기</span>
                                    <svg className="w-[12px] h-[12px] ml-[4px] text-[#666] group-hover:text-[#A1A1AA] transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7" />
                                    </svg>
                                </div>
                            </div>
                            {/* Content */}
                            <div className="flex flex-col gap-[8px]">
                                {marketingData.length > 0 ? marketingData.map(item => (
                                    <div key={item.id} className="text-[15px] leading-[22px]">
                                        <span className="text-[#86868B] font-medium mr-[6px] tracking-tight">{item.type}</span>
                                        <a href={item.url} className="text-[#c3c2b7] font-medium tracking-tight hover:text-[#fbf167] cursor-pointer transition-colors">{item.title}</a>
                                    </div>
                                )) : (
                                    <div className="text-[15px] leading-[22px] text-[#86868B]">마케팅 내역을 불러오는 중...</div>
                                )}
                            </div>
                        </div>
                        {/* Footer */}
                        <div className="w-full h-[54px] border-t border-[#444]/50 flex items-center pl-[30px] shrink-0">
                            <span className="text-[13px] font-bold text-[#86868B] mr-[12px]">마케팅 담당</span>
                            <a href="#" className="text-[14px] font-bold text-[#E5E5E5] hover:text-[#fbf167] cursor-pointer transition-colors">기업마케팅센터</a>
                            <span className="text-[#666] mx-[8px]">ㅣ</span>
                            <a href="#" className="text-[14px] font-bold text-[#E5E5E5] hover:text-[#fbf167] cursor-pointer transition-colors">PR팀</a>
                        </div>
                    </div>

                    {/* Right Column Strategy: Placemaking */}
                    <div className="flex-1 flex flex-col">
                        {/* Body */}
                        <div className="pl-[30px] pr-[32px] pt-[28px] pb-[27px] flex flex-col flex-1 relative">
                            {/* Title */}
                            <div className="flex items-center justify-between w-full mb-[14px]">
                                <span className="text-[14px] font-bold text-[#86868B] tracking-tight">Placemaking</span>
                                <div className="text-[15px] text-[#86868B] cursor-pointer hover:text-[#E5E5E5] transition-colors font-medium flex items-center group tracking-tight">
                                    <span>히스토리 전체보기</span>
                                    <svg className="w-[12px] h-[12px] ml-[4px] text-[#666] group-hover:text-[#A1A1AA] transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7" />
                                    </svg>
                                </div>
                            </div>
                            {/* Content Centered "TBD" */}
                            <div className="flex-1 flex items-center justify-center -mt-[14px]">
                                <span className="text-[#86868B] font-bold text-[24px]">TBD</span>
                            </div>
                        </div>
                        {/* Footer */}
                        <div className="w-full h-[54px] border-t border-[#444]/50 flex items-center pl-[30px] shrink-0">
                            <span className="text-[13px] font-bold text-[#86868B] mr-[12px]">플레이스메이킹 담당</span>
                            <span className="text-[14px] font-bold text-[#86868B]">TBD</span>
                        </div>
                    </div>

                </div>

                {/* Retail Box */}
                <div className="w-full bg-[#292928] border border-[#3c3c3c] rounded-[32px] flex flex-col mb-[20px] overflow-hidden">
                    {/* Header & Body */}
                    <div className="pl-[30px] pr-[32px] py-[24px] h-[106px] flex flex-col relative w-full items-center justify-center">
                        <div className="absolute top-[28px] left-[30px]">
                            <span className="text-[14px] font-bold text-[#86868B] tracking-tight">Retail</span>
                        </div>
                        <span className="text-[#86868B] font-bold text-[24px]">TBD</span>
                    </div>

                    {/* Footer Section */}
                    <div className="w-full h-[54px] border-t border-[#444]/50 flex items-center pl-[30px] gap-[12px] shrink-0">
                        <span className="text-[13px] font-bold text-[#86868B]">리테일 담당</span>
                        <span className="text-[14px] font-bold text-[#86868B]">TBD</span>
                    </div>
                </div>

                {/* Eco & Spec Box */}
                <div className="w-full bg-[#292928] border border-[#3c3c3c] rounded-[32px] flex flex-col mb-0 overflow-hidden">
                    
                    {/* Top Body Row (2 Columns) */}
                    <div className="flex flex-row w-full flex-1">
                        {/* Left Column Strategy: 친환경 인증 */}
                        <div className="w-[380px] flex flex-col shrink-0">
                            {/* Body */}
                            <div className="pl-[30px] pr-[32px] pt-[28px] pb-[27px] flex flex-col flex-1 relative">
                                {/* Title */}
                                <div className="flex items-center justify-between w-full mb-[14px]">
                                    <span className="text-[14px] font-bold text-[#86868B] tracking-tight">친환경 인증</span>
                                </div>
                                {/* Content */}
                                <div className="flex flex-col gap-[8px]">
                                    {ecoSpecs.map(item => (
                                        <div key={item.id} className="text-[15px] leading-[22px]">
                                            <span className="text-[#86868B] font-medium mr-[6px] tracking-tight">{item.label}</span>
                                            <a href="#" className="text-[#c3c2b7] font-medium tracking-tight hover:text-[#fbf167] cursor-pointer transition-colors group/link inline-block">
                                                {item.highlight ? <span className="font-bold text-[#E5E5E5] group-hover/link:text-[#fbf167] transition-colors">{item.highlight} </span> : null}
                                                {item.value}
                                            </a>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Right Column Strategy: 빌딩 상세 SPEC */}
                        <div className="flex-1 flex flex-col">
                            {/* Body */}
                            <div className="pr-[32px] pt-[28px] pb-[27px] flex flex-col flex-1 relative">
                                {/* Title */}
                                <div className="pl-[30px] flex items-center justify-between w-full mb-[14px]">
                                    <span className="text-[14px] font-bold text-[#86868B] tracking-tight">빌딩 상세 SPEC</span>
                                    <div className="text-[15px] text-[#86868B] cursor-pointer hover:text-[#E5E5E5] transition-colors font-medium flex items-center group tracking-tight -mr-[9px]">
                                        <span>빌딩 SPEC 전체보기</span>
                                        <svg className="w-[12px] h-[12px] ml-[4px] text-[#666] group-hover:text-[#A1A1AA] transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7" />
                                        </svg>
                                    </div>
                                </div>
                                {/* Content */}
                                <div className="pl-[30px] border-l border-[#444]/50 flex flex-col gap-[8px]">
                                    {buildingSpecs.map(item => (
                                        <div key={item.id} className="text-[15px] leading-[22px]">
                                            <span className="text-[#86868B] font-medium mr-[6px] tracking-tight">{item.label}</span>
                                            <a href="#" className="text-[#c3c2b7] font-medium tracking-tight hover:text-[#fbf167] cursor-pointer transition-colors">
                                                {item.value}
                                            </a>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    {/* Unified Footer Section */}
                    <div className="w-full h-[54px] border-t border-[#444]/50 flex items-center pl-[30px] gap-[24px] shrink-0">
                        <div className="flex items-center gap-[12px]">
                            <span className="text-[13px] font-bold text-[#86868B]">담당</span>
                            <div className="flex items-center gap-[8px]">
                                <a href="#" className="text-[14px] font-bold text-[#E5E5E5] hover:text-[#fbf167] cursor-pointer transition-colors">이수정</a>
                                <a href="#" className="text-[14px] font-bold text-[#E5E5E5] hover:text-[#fbf167] cursor-pointer transition-colors">김대익</a>
                            </div>
                        </div>
                        <div className="w-[1px] h-[14px] bg-[#555]"></div>
                        <div className="flex items-center gap-[12px]">
                            <span className="text-[13px] font-bold text-[#86868B]">Partnership</span>
                            <div className="flex items-center gap-[8px]">
                                <a href="#" className="text-[14px] font-bold text-[#E5E5E5] hover:text-[#fbf167] cursor-pointer transition-colors">dA</a>
                                <a href="#" className="text-[14px] font-bold text-[#E5E5E5] hover:text-[#fbf167] cursor-pointer transition-colors">어패스리질리언스</a>
                            </div>
                        </div>
                    </div>

                </div>

                {/* Section Divider */}
                <div className="w-full h-[1px] bg-[#444]/50 my-[60px]"></div>

                {/* Research & Insight Box */}
                <div className="w-full bg-[#232323] border border-[#3c3c3c] rounded-[32px] mb-[80px] overflow-hidden relative">
                    <div className="pl-[30px] pr-[32px] pt-[28px] pb-[32px] flex flex-col w-full">
                        {/* Title Row */}
                        <div className="flex items-center justify-between w-full mb-[24px]">
                            <span className="text-[14px] font-bold text-[#86868B] tracking-tight">Research & Insight</span>
                        </div>

                        {/* Circular Action Button */}
                        <div className="absolute top-[20px] right-[24px] w-[46px] h-[46px] rounded-full border border-[#555] flex items-center justify-center cursor-pointer hover:bg-[#444] transition-colors group z-10 shadow-sm">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#E5E5E5" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="group-hover:scale-110 transition-transform">
                                <line x1="12" y1="5" x2="12" y2="19"></line>
                                <line x1="5" y1="12" x2="19" y2="12"></line>
                            </svg>
                        </div>

                        {/* Text List */}
                        <div className="flex flex-col w-full">
                            {researchInsights.map((item, index) => (
                                <div key={item.id} className={\`w-full \${index === 0 ? 'pb-[20px]' : index === researchInsights.length - 1 ? 'pt-[20px] pb-[4px] border-t border-[#444]/50' : 'py-[20px] border-t border-[#444]/50'}\`}>
                                    <a href={item.url} className="text-[20px] font-medium text-[#E5E5E5] hover:text-[#fbf167] transition-colors cursor-pointer flex items-center tracking-tight">
                                        <span className={\`mr-[14px] text-[22px] grayscale opacity-70 \${item.is_bright ? 'brightness-125' : ''}\`}>{item.icon}</span>
                                        {item.title}
                                    </a>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Compare Title */}
                <div className="w-full text-left mb-[16px] pl-[4px]">
                    <span className="text-[20px] font-bold text-[#1D1D1F] dark:text-[#E5E5E5] tracking-tight">서울 3대권역 프라임빌딩 자산 비교하기</span>
                </div>

                {/* Compare Boxes List */}
                {comparisonData.map((data) => (
                    <div key={data.id} className="w-full flex flex-row gap-[16px] mb-[20px]">
                    
                    {/* Image Box */}
                    <div className="w-[430px] h-[360px] rounded-[32px] overflow-hidden relative shrink-0 border border-[#3c3c3c]/50">
                        <img src={\`\${import.meta.env.BASE_URL}\${(data.image || '').replace(/^\\//, '')}\`} alt={data.title} className="w-full h-full object-cover opacity-90 transition-opacity hover:opacity-100" />
                        
                        {/* Top Right '+' Button */}
                        <div className="absolute top-[17px] right-[17px] w-[46px] h-[46px] rounded-full bg-black/20 border border-white/60 flex items-center justify-center cursor-pointer hover:bg-black/30 transition-colors z-10 shadow-sm">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="12" y1="4" x2="12" y2="20"></line>
                                <line x1="4" y1="12" x2="20" y2="12"></line>
                            </svg>
                        </div>
                    </div>

                    {/* Data Box */}
                    <div className="flex-1 bg-[#292928] border border-[#3c3c3c] rounded-[32px] overflow-hidden px-[32px] pt-[24px] pb-[32px] flex flex-col h-[360px]">
                        
                        {/* Header */}
                        <div className="flex items-center justify-between w-full pb-[24px]">
                            <span className="text-[26px] font-bold text-[#E5E5E5] tracking-tight">{data.title}</span>
                            <div className="flex items-center text-[#86868B] cursor-pointer hover:text-[#fbf167] transition-colors group">
                                <span className="text-[13px] font-medium tracking-tight">IOTA Soul 2 816과 비교하기</span>
                                <svg className="w-[12px] h-[12px] ml-[4px] text-[#666] group-hover:text-[#fbf167] transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7" />
                                </svg>
                            </div>
                        </div>

                        {/* Layout Split */}
                        <div className="flex flex-row w-full flex-1 min-h-0">
                            
                            {/* Cols 1 & 2 */}
                            <div className="flex flex-row flex-[1.7] border-r border-[#444]/50">
                                {/* Col 1 */}
                                <div className="flex flex-col flex-[0.85] border-r border-[#444]/50">
                                    <div className="flex items-center w-full h-[44px] pr-[30px]">
                                        <span className="w-[85px] shrink-0 text-[15px] font-bold text-[#86868B]">권역</span>
                                        <span className="text-[16px] text-[#E5E5E5] font-medium truncate">{data.region}</span>
                                    </div>
                                    <div className="flex items-center w-full h-[44px] pr-[30px] border-t border-[#444]/50">
                                        <span className="w-[85px] shrink-0 text-[15px] font-bold text-[#86868B]">준공년도</span>
                                        <span className="text-[16px] text-[#E5E5E5] font-medium truncate">{data.year}</span>
                                    </div>
                                    <div className="flex items-center w-full h-[44px] pr-[30px] border-t border-[#444]/50">
                                        <span className="w-[85px] shrink-0 text-[15px] font-bold text-[#86868B]">연면적</span>
                                        <span className="text-[16px] text-[#E5E5E5] font-medium tracking-tight truncate">{data.gfa}</span>
                                    </div>
                                    <div className="flex items-center w-full h-[44px] pr-[30px] border-t border-[#444]/50">
                                        <span className="w-[85px] shrink-0 text-[15px] font-bold text-[#86868B]">오피스면적</span>
                                        <span className="text-[16px] text-[#E5E5E5] font-medium tracking-tight truncate">{data.office_area}</span>
                                    </div>
                                    <div className="flex items-center w-full h-[44px] pr-[30px] border-t border-[#444]/50">
                                        <span className="w-[85px] shrink-0 text-[15px] font-bold text-[#86868B]">리테일면적</span>
                                        <span className="text-[16px] text-[#E5E5E5] font-medium tracking-tight truncate">{data.retail_area}</span>
                                    </div>
                                    <div className="flex items-center w-full h-[44px] pr-[30px] border-t border-[#444]/50">
                                        <span className="w-[85px] shrink-0 text-[15px] font-bold text-[#86868B]">기준층면적</span>
                                        <span className="text-[16px] text-[#E5E5E5] font-medium tracking-tight truncate">{data.floor_area}</span>
                                    </div>
                                </div>
                                
                                {/* Col 2 */}
                                <div className="flex flex-col flex-[1.15]">
                                    <div className="flex items-center w-full h-[44px] pl-[26px] pr-[16px]">
                                        <span className="w-[75px] shrink-0 text-[15px] font-bold text-[#86868B]">규모</span>
                                        <span className="text-[16px] text-[#E5E5E5] font-medium truncate">{data.scale}</span>
                                    </div>
                                    <div className="flex items-center w-full h-[44px] pl-[26px] pr-[16px] border-t border-[#444]/50">
                                        <span className="w-[75px] shrink-0 text-[15px] font-bold text-[#86868B]">천정고</span>
                                        <span className="text-[16px] text-[#E5E5E5] font-medium truncate">{data.ceiling_height}</span>
                                    </div>
                                    <div className="flex items-center w-full h-[44px] pl-[26px] pr-[16px] border-t border-[#444]/50">
                                        <span className="w-[75px] shrink-0 text-[15px] font-bold text-[#86868B]">주차대수</span>
                                        <span className="text-[16px] text-[#E5E5E5] font-medium truncate">{data.parking}</span>
                                    </div>
                                    <div className="flex items-center w-full h-[44px] pl-[26px] pr-[16px] border-t border-[#444]/50">
                                        <span className="w-[75px] shrink-0 text-[15px] font-bold text-[#86868B]">시공사</span>
                                        <span className="text-[16px] text-[#E5E5E5] font-medium tracking-tight truncate">{data.constructor}</span>
                                    </div>
                                    <div className="flex items-center w-full h-[44px] pl-[26px] pr-[16px] border-t border-[#444]/50">
                                        <span className="w-[75px] shrink-0 text-[15px] font-bold text-[#86868B]">설계사</span>
                                        <span className="text-[16px] text-[#E5E5E5] font-medium truncate">{data.architect}</span>
                                    </div>
                                    <div className="flex items-center w-full h-[44px] pl-[26px] pr-[16px] border-t border-[#444]/50">
                                        <span className="w-[75px] shrink-0 text-[15px] font-bold text-[#86868B]">리스스팬</span>
                                        <span className="text-[16px] text-[#E5E5E5] font-medium truncate">{data.lease_span}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Financials Col 3 */}
                            <div className="flex flex-col flex-1 pl-[24px]">
                                <div className="flex flex-col w-full">
                                    <div className="flex justify-between items-center w-full h-[44px]">
                                        <span className="text-[14px] font-bold text-[#86868B]">월 GI</span>
                                        <span className="text-[24px] font-bold text-white tracking-tight">{data.monthly_gi}</span>
                                    </div>
                                    <div className="flex justify-between items-center w-full h-[44px]">
                                        <span className="text-[14px] font-bold text-[#86868B]">연 GI</span>
                                        <span className="text-[24px] font-bold text-white tracking-tight">{data.yearly_gi}</span>
                                    </div>
                                    <div className="flex justify-between items-center w-full h-[44px]">
                                        <span className="text-[14px] font-bold text-[#86868B]">연 NOI <span className="font-normal text-[11px]">(85%)</span></span>
                                        <span className="text-[24px] font-bold text-white tracking-tight">{data.yearly_noi}</span>
                                    </div>
                                </div>
                                <div className="flex flex-col mt-[26px]">
                                    <div className="flex justify-between items-center w-full h-[44px]">
                                        <span className="text-[14px] font-bold text-[#86868B]">E.NOC <span className="font-normal text-[11px] pl-[2px]">(2026)</span></span>
                                        <span className="text-[24px] font-bold text-white tracking-tight">{data.enoc_2026}</span>
                                    </div>
                                    <div className="flex justify-between items-center w-full h-[44px]">
                                        <span className="text-[14px] font-bold text-[#86868B]">E.NOC <span className="font-bold text-white text-[11px] pl-[2px]">(2032 예측)</span></span>
                                        <span className="text-[24px] font-bold text-white tracking-tight">{data.enoc_2032}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                    </div>
                </div>
                ))}
                
                <div className="h-[200px] shrink-0 w-full"></div>
            </div>
        </div>
    );
}
`;

fs.writeFileSync(iotaTwoPath, corporateEnd + newBottom);

console.log('Update complete!');
