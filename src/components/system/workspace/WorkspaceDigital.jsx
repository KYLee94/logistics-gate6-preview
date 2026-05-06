import React from 'react';
import WorkspaceActivityLog from './WorkspaceActivityLog';

export default function WorkspaceDigital() {
    return (
                <div className="w-full flex-1 flex flex-col pt-[50px] pb-[60px] max-w-[1200px] mx-auto">
            {/* Header & Team Structure */}
            <div className="w-full flex justify-between items-center mb-[40px] gap-[40px]">
                {/* Header Metadata */}
                <div className="shrink-0 max-w-[460px]">
                    <h1 className="text-[36px] font-bold text-white tracking-tight leading-none font-['Inter'] mb-[12px]">상품·디지털</h1>
                    <p className="text-[15px] text-[#86868B] leading-[24px] break-keep">상품 차별화 전략·POC, 테넌트 경험 설계, 디지털 인프라(보안·통신·DC)</p>
                </div>
                
                {/* Team Structure */}
                <div className="border border-[#333] rounded-[24px] flex items-center bg-transparent shrink-0 pl-[20px] pr-[10px] py-[10px]">

                    {/* 공간솔루션 */}
                    <div className="w-[80px] shrink-0">
                        <span className="text-[13px] font-bold text-[#86868B]">공간솔루션</span>
                    </div>
                    <div className="flex items-center gap-[12px] w-[106px] shrink-0">
                        <div className="relative w-[30px] h-[30px] shrink-0 rounded-full bg-[#3c3c3c] flex items-center justify-center overflow-hidden ml-[2px]">
                            <img src={`${import.meta.env.BASE_URL}김현수.webp`} alt="김현수" className="w-full h-full object-cover" onError={(e) => { e.target.src = `${import.meta.env.BASE_URL}default_avatar.svg`; }} />
                            <div className="absolute inset-0 rounded-full border border-white/10 pointer-events-none"></div>
                        </div>
                        <div className="flex flex-col text-left">
                            <span className="text-white font-bold text-[13px] leading-tight">김현수</span>
                            <span className="text-[#A1A1AA] text-[12px] mt-[1px] leading-tight">센터장</span>
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-x-1.5 gap-y-2 -ml-[6px]">
                        {["이가현","정수명"].map(name => (
                            <div key={name} className="flex items-center gap-[6px] bg-[#222] border border-[#333] rounded-full pl-[4px] pr-[10px] py-[4px] min-w-[76px]">
                                <div className="w-[21px] h-[21px] shrink-0 rounded-full bg-[#3c3c3c] overflow-hidden">
                                    <img src={`${import.meta.env.BASE_URL}${name}.webp`} alt={name} className="w-full h-full object-cover" onError={(e) => { e.target.src = `${import.meta.env.BASE_URL}default_avatar.svg`; }} />
                                </div>
                                <span className="text-[#E5E5E5] text-[12px] font-medium leading-none">{name}</span>
                            </div>
                        ))}
                    </div>

                    {/* Vertical Separator */}
                    <div className="w-px h-[30px] bg-[#333] mx-[20px]"></div>

                    {/* 디지털사업 */}
                    <div className="w-[80px] shrink-0">
                        <span className="text-[13px] font-bold text-[#86868B]">디지털사업</span>
                    </div>
                    <div className="flex items-center gap-[12px] w-[106px] shrink-0">
                        <div className="relative w-[30px] h-[30px] shrink-0 rounded-full bg-[#3c3c3c] flex items-center justify-center overflow-hidden ml-[2px]">
                            <img src={`${import.meta.env.BASE_URL}현철호.webp`} alt="현철호" className="w-full h-full object-cover" onError={(e) => { e.target.src = `${import.meta.env.BASE_URL}default_avatar.svg`; }} />
                            <div className="absolute inset-0 rounded-full border border-white/10 pointer-events-none"></div>
                        </div>
                        <div className="flex flex-col text-left">
                            <span className="text-white font-bold text-[13px] leading-tight">현철호</span>
                            <span className="text-[#A1A1AA] text-[12px] mt-[1px] leading-tight">그룹장</span>
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-x-1.5 gap-y-2 -ml-[6px]">
                        {["신민호"].map(name => (
                            <div key={name} className="flex items-center gap-[6px] bg-[#222] border border-[#333] rounded-full pl-[4px] pr-[10px] py-[4px] min-w-[76px]">
                                <div className="w-[21px] h-[21px] shrink-0 rounded-full bg-[#3c3c3c] overflow-hidden">
                                    <img src={`${import.meta.env.BASE_URL}${name}.webp`} alt={name} className="w-full h-full object-cover" onError={(e) => { e.target.src = `${import.meta.env.BASE_URL}default_avatar.svg`; }} />
                                </div>
                                <span className="text-[#E5E5E5] text-[12px] font-medium leading-none">{name}</span>
                            </div>
                        ))}
                    </div>

                </div>
            </div>
            <WorkspaceActivityLog workspaceCode="WS_SSC" workspaceLabel="상품·디지털-SSC" />
        </div>
    );
}
