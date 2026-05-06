import React from 'react';
import WorkspaceActivityLog from './WorkspaceActivityLog';

export default function WorkspaceDevelopment() {
    return (
                <div className="w-full flex-1 flex flex-col pt-[50px] pb-[60px] max-w-[1200px] mx-auto">
            {/* Header & Team Structure */}
            <div className="w-full flex justify-between items-center mb-[40px] gap-[40px]">
                {/* Header Metadata */}
                <div className="shrink-0 max-w-[400px]">
                    <h1 className="text-[36px] font-bold text-white tracking-tight leading-none font-['Inter'] mb-[12px]">개발관리</h1>
                    <p className="text-[15px] text-[#86868B] leading-[24px] break-keep">설계·시공·CM·감리 통제, 인허가/명도 대응, 공정·품질·안전 KPI</p>
                </div>
                
                {/* Team Structure */}
                <div className="border border-[#333] rounded-[24px] flex flex-col bg-transparent shrink-0">

                    
                    <div className="flex items-center pl-[20px] pr-[10px] py-[10px]">
                        <div className="w-[76px] shrink-0">
                            <span className="text-[13px] font-bold text-[#86868B]">개발솔루션</span>
                        </div>
                        <div className="flex items-center gap-[12px] w-[112px] shrink-0">
                            <div className="relative w-[30px] h-[30px] shrink-0 rounded-full bg-[#3c3c3c] flex items-center justify-center overflow-hidden ml-[2px]">
                                <img src={`${import.meta.env.BASE_URL}홍장군.webp`} alt="홍장군" className="w-full h-full object-cover" onError={(e) => { e.target.src = `${import.meta.env.BASE_URL}default_avatar.svg`; }} />
                                <div className="absolute inset-0 rounded-full border border-white/10 pointer-events-none"></div>
                            </div>
                            <div className="flex flex-col text-left">
                                <span className="text-white font-bold text-[13px] leading-tight">홍장군</span>
                                <span className="text-[#A1A1AA] text-[12px] mt-[1px] leading-tight">센터장</span>
                            </div>
                        </div>
                        <div className="flex flex-wrap gap-x-1.5 gap-y-2 -ml-[6px]">
                            {["채원","김보성","전승희","김대익","장성진","이정훈","박봉서"].map(name => (
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
            </div>
            
            <WorkspaceActivityLog workspaceCode="WS_DSC" workspaceLabel="개발솔루션-DSC" />

            {/* Top 3 KPI Cards */}
            <div className="flex w-full gap-[24px] mb-[40px]">
                <div className="flex-1 bg-[#292928] border border-[#3c3c3c] rounded-[24px] p-[28px] hover:border-[#555] transition-colors relative overflow-hidden group">
                    <div className="absolute top-0 left-0 w-full h-[4px] bg-[#fbf167]"></div>
                    <h3 className="text-[15px] font-bold text-[#86868B] mb-[12px]">Iota 1 공정률 (현대건설)</h3>
                    <div className="text-[42px] font-black text-white">18<span className="text-[20px] text-[#A1A1AA]">%</span></div>
                    <div className="w-full bg-[#1A1A1A] h-2 rounded-full mt-4"><div className="h-full bg-[#fbf167] rounded-full w-[18%]"></div></div>
                </div>
                <div className="flex-1 bg-[#292928] border border-[#3c3c3c] rounded-[24px] p-[28px] hover:border-[#555] transition-colors relative overflow-hidden group">
                    <div className="absolute top-0 left-0 w-full h-[4px] bg-[#34d399]"></div>
                    <h3 className="text-[15px] font-bold text-[#86868B] mb-[12px]">Iota 2 공정률 (삼성물산)</h3>
                    <div className="text-[42px] font-black text-white">12<span className="text-[20px] text-[#A1A1AA]">%</span></div>
                    <div className="w-full bg-[#1A1A1A] h-2 rounded-full mt-4"><div className="h-full bg-[#34d399] rounded-full w-[12%]"></div></div>
                </div>
                <div className="flex-1 bg-[#292928] border border-[#3c3c3c] rounded-[24px] p-[28px] hover:border-[#555] transition-colors relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-[4px] bg-[#e11d48]"></div>
                    <h3 className="text-[15px] font-bold text-[#86868B] mb-[12px]">누적 공정 지연</h3>
                    <div className="text-[42px] font-black text-white">7<span className="text-[16px] font-normal text-[#A1A1AA] ml-2">일</span></div>
                    <p className="text-[13px] text-[#e11d48] mt-2">인허가 2주 누적 지연 영향</p>
                </div>
            </div>



            {/* Design & Construction Pipeline */}
            <h2 className="text-[18px] font-bold text-white mb-[16px]">주요 변경관리 / 인허가 마일스톤</h2>
            <div className="w-full bg-[#1A1A1A] border border-[#333] rounded-[24px] overflow-hidden mb-[40px]">
                <table className="w-full text-left">
                    <thead className="bg-[#222]">
                        <tr>
                            <th className="px-[20px] py-[16px] text-[13px] font-bold text-[#86868B] border-b border-[#333]">구분</th>
                            <th className="px-[20px] py-[16px] text-[13px] font-bold text-[#86868B] border-b border-[#333]">파트너</th>
                            <th className="px-[20px] py-[16px] text-[13px] font-bold text-[#86868B] border-b border-[#333]">내용</th>
                            <th className="px-[20px] py-[16px] text-[13px] font-bold text-[#86868B] border-b border-[#333]">기한</th>
                            <th className="px-[20px] py-[16px] text-[13px] font-bold text-[#86868B] border-b border-[#333]">Status</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-[#333]">
                        <tr className="hover:bg-[#292928] transition-colors">
                            <td className="px-[20px] py-[16px] text-[13px] font-bold text-white">설계 Alt</td>
                            <td className="px-[20px] py-[16px] text-[14px] text-[#E5E5E5]"><span className="text-[#E5E5E5] hover:text-[#fbf167] cursor-pointer transition-colors hover:underline underline-offset-4 decoration-[#fbf167]/50">Foster + Partners</span></td>
                            <td className="px-[20px] py-[16px] text-[14px] text-[#A1A1AA]">Iota 1 코어 설계 변경 적용건</td>
                            <td className="px-[20px] py-[16px] text-[14px] text-[#A1A1AA]">2026.04</td>
                            <td className="px-[20px] py-[16px]"><span className="px-3 py-1 bg-[#059669]/20 text-[#34d399] rounded text-[13px] border border-[#059669]/30 font-bold">Approved</span></td>
                        </tr>
                        <tr className="hover:bg-[#292928] transition-colors">
                            <td className="px-[20px] py-[16px] text-[13px] font-bold text-white">도급정산</td>
                            <td className="px-[20px] py-[16px] text-[14px] text-[#E5E5E5]"><span className="text-[#E5E5E5] hover:text-[#fbf167] cursor-pointer transition-colors hover:underline underline-offset-4 decoration-[#fbf167]/50">삼성물산</span></td>
                            <td className="px-[20px] py-[16px] text-[14px] text-[#A1A1AA]">Iota 2 도급 변경분 정산 (에스컬레이션 반영)</td>
                            <td className="px-[20px] py-[16px] text-[14px] text-[#A1A1AA]">2026.05</td>
                            <td className="px-[20px] py-[16px]"><span className="px-3 py-1 bg-[#d97706]/20 text-[#fbf167] rounded text-[13px] border border-[#d97706]/30 font-bold">In Review</span></td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    );
}
