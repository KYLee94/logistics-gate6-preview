import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../../utils/supabaseClient';

export default function MarketingPipeline({ memberInfo, masterStakeholders, fetchMasterStakeholders }) {
    const [pipelines, setPipelines] = useState([]);
    const [logs, setLogs] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    const isAllowedEditor = ['김민지', '고아라', '전기영'].includes(memberInfo?.staff_name);

    // States for Adding Pipeline
    const [isAddingPipeline, setIsAddingPipeline] = useState(false);
    const [newPipeline, setNewPipeline] = useState({ channel_name: '', status: '대기', related_asset: 'IOTA 공통', contact_point: '' });
    const [showCompanyDropdown, setShowCompanyDropdown] = useState(false);
    const [showContactDropdown, setShowContactDropdown] = useState(false);

    // States for Expanded Pipeline & Adding Logs
    const [expandedPipelineId, setExpandedPipelineId] = useState(null);
    const [isAddingLog, setIsAddingLog] = useState(false);
    const [newLog, setNewLog] = useState({ progress_detail: '', management_plan: '' });

    const fetchPipelines = async () => {
        try {
            const { data, error } = await supabase.from('iota_marketing_pipelines').select('*').order('created_at', { ascending: false });
            if (error) throw error;
            setPipelines(data || []);
        } catch (e) {
            console.warn('Supabase fetch failed, falling back to localStorage for pipelines', e);
            const local = localStorage.getItem('iota_marketing_pipelines');
            if (local) setPipelines(JSON.parse(local));
        }
    };

    const fetchLogs = async () => {
        try {
            const { data, error } = await supabase.from('iota_marketing_pipeline_logs').select('*').order('created_at', { ascending: false });
            if (error) throw error;
            setLogs(data || []);
        } catch (e) {
            console.warn('Supabase fetch failed, falling back to localStorage for logs', e);
            const local = localStorage.getItem('iota_marketing_pipeline_logs');
            if (local) setLogs(JSON.parse(local));
        }
    };

    useEffect(() => {
        setIsLoading(true);
        Promise.all([fetchPipelines(), fetchLogs()]).then(() => setIsLoading(false));
    }, []);

    const handleAddPipeline = async () => {
        if (!newPipeline.channel_name) {
            alert('채널명을 입력해주세요.');
            return;
        }
        const insertData = { ...newPipeline, created_at: new Date().toISOString() };
        try {
            const { error } = await supabase.from('iota_marketing_pipelines').insert([insertData]);
            if (error) throw error;
            await fetchPipelines();
        } catch (e) {
            const local = [...pipelines, { ...insertData, id: Date.now().toString() }];
            setPipelines(local);
            localStorage.setItem('iota_marketing_pipelines', JSON.stringify(local));
        }
        setIsAddingPipeline(false);
        setNewPipeline({ channel_name: '', status: '대기', related_asset: 'IOTA 공통', contact_point: '' });
    };

    const handleDeletePipeline = async (id) => {
        if (!confirm('정말 삭제하시겠습니까? 관련 로그도 모두 삭제됩니다.')) return;
        try {
            const { error } = await supabase.from('iota_marketing_pipelines').delete().eq('id', id);
            if (error) throw error;
            await fetchPipelines();
        } catch (e) {
            const local = pipelines.filter(p => p.id !== id);
            setPipelines(local);
            localStorage.setItem('iota_marketing_pipelines', JSON.stringify(local));
        }
    };

    const handleAddLog = async (pipelineId) => {
        if (!newLog.progress_detail || !newLog.management_plan) {
            alert('진행내용과 관리방안을 모두 입력해주세요.');
            return;
        }
        const insertData = { pipeline_id: pipelineId, ...newLog, created_at: new Date().toISOString() };
        try {
            const { error } = await supabase.from('iota_marketing_pipeline_logs').insert([insertData]);
            if (error) throw error;
            await fetchLogs();
        } catch (e) {
            const local = [...logs, { ...insertData, id: Date.now().toString() }];
            setLogs(local);
            localStorage.setItem('iota_marketing_pipeline_logs', JSON.stringify(local));
        }
        setIsAddingLog(false);
        setNewLog({ progress_detail: '', management_plan: '' });
    };

    const handleDeleteLog = async (id) => {
        if (!confirm('로그를 삭제하시겠습니까?')) return;
        try {
            const { error } = await supabase.from('iota_marketing_pipeline_logs').delete().eq('id', id);
            if (error) throw error;
            await fetchLogs();
        } catch (e) {
            const local = logs.filter(l => l.id !== id);
            setLogs(local);
            localStorage.setItem('iota_marketing_pipeline_logs', JSON.stringify(local));
        }
    };

    // Dropdown filters
    const uniqueCompanies = [...new Set((masterStakeholders || []).map(s => s.company_name).filter(Boolean))];
    const filteredCompanies = uniqueCompanies.filter(c => c.toLowerCase().includes(newPipeline.channel_name.toLowerCase()));
    
    const uniqueContacts = [...new Set((masterStakeholders || []).map(s => s.contact_name).filter(Boolean))];
    const filteredContacts = uniqueContacts.filter(c => c.toLowerCase().includes(newPipeline.contact_point.toLowerCase()));

    const formatTime = (isoString) => {
        const d = new Date(isoString);
        return d.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    };

    return (
        <div className="w-full">
            <div className="flex justify-between items-end mb-[12px]">
                <h2 className="text-[18px] font-bold text-white">Pipe line 관리</h2>
                <div className="flex items-center gap-4">
                    <span className="text-[13px] text-[#86868B]">수기 입력 중심 운영 (컨택 포인트 포함)</span>
                    {isAllowedEditor && (
                        <button 
                            onClick={() => setIsAddingPipeline(!isAddingPipeline)}
                            className="px-4 py-2 bg-[#3b82f6]/20 text-[#60a5fa] rounded-[8px] text-[13px] font-bold border border-[#3b82f6]/30 hover:bg-[#3b82f6]/30 transition-all"
                        >
                            {isAddingPipeline ? '취소' : '+ 신규 파이프라인'}
                        </button>
                    )}
                </div>
            </div>

            {isAddingPipeline && (
                <div className="mb-6 p-6 bg-[#1A1A1A] border border-[#3c3c3c] rounded-[24px]">
                    <div className="flex flex-col gap-4">
                        <div className="flex gap-4">
                            <div className="flex-1 relative">
                                <label className="block text-[#86868B] text-[13px] font-bold mb-2">채널명 (연결기업 검색)</label>
                                <input 
                                    type="text" 
                                    value={newPipeline.channel_name}
                                    onChange={e => {
                                        setNewPipeline({...newPipeline, channel_name: e.target.value});
                                        setShowCompanyDropdown(true);
                                    }}
                                    onFocus={() => setShowCompanyDropdown(true)}
                                    onBlur={() => setTimeout(() => setShowCompanyDropdown(false), 200)}
                                    className="w-full bg-[#272726] border border-[#444] rounded-[12px] px-4 py-3 text-white text-[15px] outline-none focus:border-[#888]" 
                                    placeholder="기업명 검색" 
                                />
                                {showCompanyDropdown && newPipeline.channel_name && (
                                    <div className="absolute top-full left-0 mt-1 w-full max-h-[150px] overflow-y-auto bg-[#2A2A2A] border border-[#444] rounded-[12px] z-50 shadow-xl py-2">
                                        {filteredCompanies.length > 0 ? (
                                            filteredCompanies.map((c, i) => (
                                                <div 
                                                    key={i} 
                                                    className="px-4 py-2 text-[14px] text-white hover:bg-[#3b82f6] cursor-pointer"
                                                    onMouseDown={(e) => {
                                                        e.preventDefault();
                                                        setNewPipeline({...newPipeline, channel_name: c});
                                                        setShowCompanyDropdown(false);
                                                    }}
                                                >
                                                    {c}
                                                </div>
                                            ))
                                        ) : (
                                            <div className="px-4 py-2 text-[13px] text-[#86868B]">검색 결과가 없습니다.</div>
                                        )}
                                    </div>
                                )}
                            </div>
                            <div className="w-[200px] relative">
                                <label className="block text-[#86868B] text-[13px] font-bold mb-2">컨택포인트 (담당자 검색)</label>
                                <input 
                                    type="text" 
                                    value={newPipeline.contact_point}
                                    onChange={e => {
                                        setNewPipeline({...newPipeline, contact_point: e.target.value});
                                        setShowContactDropdown(true);
                                    }}
                                    onFocus={() => setShowContactDropdown(true)}
                                    onBlur={() => setTimeout(() => setShowContactDropdown(false), 200)}
                                    className="w-full bg-[#272726] border border-[#444] rounded-[12px] px-4 py-3 text-white text-[15px] outline-none focus:border-[#888]" 
                                    placeholder="담당자명 검색" 
                                />
                                {showContactDropdown && newPipeline.contact_point && (
                                    <div className="absolute top-full left-0 mt-1 w-full max-h-[150px] overflow-y-auto bg-[#2A2A2A] border border-[#444] rounded-[12px] z-50 shadow-xl py-2">
                                        {filteredContacts.length > 0 ? (
                                            filteredContacts.map((c, i) => (
                                                <div 
                                                    key={i} 
                                                    className="px-4 py-2 text-[14px] text-white hover:bg-[#3b82f6] cursor-pointer"
                                                    onMouseDown={(e) => {
                                                        e.preventDefault();
                                                        setNewPipeline({...newPipeline, contact_point: c});
                                                        setShowContactDropdown(false);
                                                    }}
                                                >
                                                    {c}
                                                </div>
                                            ))
                                        ) : (
                                            <div className="px-4 py-2 text-[13px] text-[#86868B]">검색 결과가 없습니다.</div>
                                        )}
                                    </div>
                                )}
                            </div>
                            <div className="w-[150px]">
                                <label className="block text-[#86868B] text-[13px] font-bold mb-2">상태</label>
                                <select 
                                    value={newPipeline.status}
                                    onChange={e => setNewPipeline({...newPipeline, status: e.target.value})}
                                    className="w-full bg-[#272726] border border-[#444] rounded-[12px] px-4 py-3 text-white text-[15px] outline-none focus:border-[#888] appearance-none"
                                >
                                    <option>대기</option>
                                    <option>진행중</option>
                                    <option>검토필요</option>
                                    <option>완료</option>
                                    <option>지연</option>
                                </select>
                            </div>
                            <div className="w-[150px]">
                                <label className="block text-[#86868B] text-[13px] font-bold mb-2">관련 자산</label>
                                <select 
                                    value={newPipeline.related_asset}
                                    onChange={e => setNewPipeline({...newPipeline, related_asset: e.target.value})}
                                    className="w-full bg-[#272726] border border-[#444] rounded-[12px] px-4 py-3 text-white text-[15px] outline-none focus:border-[#888] appearance-none"
                                >
                                    <option>IOTA 공통</option>
                                    <option>427 PFV</option>
                                    <option>816 PFV</option>
                                    <option>421 Fund</option>
                                </select>
                            </div>
                        </div>
                        <div className="flex justify-end pt-2 border-t border-[#3c3c3c]">
                            <button onClick={handleAddPipeline} className="px-6 py-2 bg-white text-black font-bold rounded-[8px] hover:bg-[#E5E5E5] transition-all">등록하기</button>
                        </div>
                    </div>
                </div>
            )}

            <div className="flex flex-col gap-[10px]">
                {pipelines.map(pipe => {
                    const pipeLogs = logs.filter(l => l.pipeline_id === pipe.id);
                    const isExpanded = expandedPipelineId === pipe.id;

                    return (
                        <div 
                            key={pipe.id}
                            className={`bg-[#272726] border border-[#3c3c3c] rounded-[24px] p-6 transition-all duration-300 ${isExpanded ? '' : 'hover:bg-[#333] cursor-pointer'}`}
                            onClick={() => !isExpanded && setExpandedPipelineId(pipe.id)}
                        >
                            <div className="flex justify-between items-center gap-8 relative">
                                {isAllowedEditor && (
                                    <div className="absolute right-[-70px] top-1/2 -translate-y-1/2">
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); handleDeletePipeline(pipe.id); }} 
                                            className="px-4 py-2 bg-[#ef4444]/10 text-[#ef4444] border border-[#ef4444]/30 rounded-[12px] text-[14px] font-bold opacity-0 hover:opacity-100 transition-all cursor-pointer"
                                            style={{ opacity: isExpanded ? 1 : undefined }}
                                        >
                                            삭제
                                        </button>
                                    </div>
                                )}
                                
                                <div className="flex-1 flex gap-8 items-center">
                                    {/* 채널명 (부각) */}
                                    <div className="w-[300px] shrink-0 border-r border-[#444]/50 pr-8">
                                        <span className="text-[13px] font-bold text-[#86868B] block mb-1">채널명</span>
                                        <h3 className="text-[26px] font-bold text-white tracking-tight leading-tight">{pipe.channel_name}</h3>
                                    </div>
                                    
                                    {/* 나머지 정보 */}
                                    <div className="flex-1 flex gap-12 items-center">
                                        <div className="flex flex-col gap-1">
                                            <span className="text-[13px] font-bold text-[#86868B]">상태</span>
                                            <span className={`px-2 py-1 rounded-[6px] text-[13px] font-bold w-max ${pipe.status === '진행중' ? 'bg-[#059669]/20 text-[#34d399]' : pipe.status === '검토필요' ? 'bg-[#d97706]/20 text-[#fbf167]' : pipe.status === '완료' ? 'bg-[#2563eb]/20 text-[#60a5fa]' : pipe.status === '지연' ? 'bg-[#ef4444]/20 text-[#f87171]' : 'bg-[#4b5563]/20 text-[#9ca3af]'}`}>
                                                {pipe.status}
                                            </span>
                                        </div>
                                        <div className="flex flex-col gap-1">
                                            <span className="text-[13px] font-bold text-[#86868B]">관련 자산</span>
                                            <span className="text-[16px] font-bold text-white">{pipe.related_asset}</span>
                                        </div>
                                        <div className="flex flex-col gap-1">
                                            <span className="text-[13px] font-bold text-[#86868B]">컨택포인트</span>
                                            <span className="text-[16px] text-[#bbb9af] font-medium">{pipe.contact_point || '-'}</span>
                                        </div>
                                    </div>
                                </div>
                                
                                {isExpanded && (
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); setExpandedPipelineId(null); }}
                                        className="shrink-0 w-[40px] h-[40px] rounded-full bg-[#1A1A1A] flex items-center justify-center border border-[#444] text-[#86868B] hover:text-white transition-all"
                                    >
                                        ✕
                                    </button>
                                )}
                            </div>

                            {isExpanded && (
                                <div className="mt-6 pt-6 border-t border-[#3c3c3c]">
                                    <div className="flex justify-between items-center mb-6">
                                        <h4 className="text-[16px] font-bold text-white">타임라인</h4>
                                        {isAllowedEditor && (
                                            <button 
                                                onClick={() => setIsAddingLog(!isAddingLog)}
                                                className="text-[13px] font-bold text-[#3b82f6] hover:text-[#60a5fa] transition-all"
                                            >
                                                {isAddingLog ? '취소' : '+ 진행내역 추가'}
                                            </button>
                                        )}
                                    </div>

                                    {isAddingLog && (
                                        <div className="mb-6 p-4 bg-[#1A1A1A] rounded-[16px] border border-[#444]">
                                            <div className="flex gap-4 mb-4">
                                                <div className="flex-1">
                                                    <label className="block text-[#86868B] text-[13px] font-bold mb-2">진행내용</label>
                                                    <input 
                                                        type="text" 
                                                        value={newLog.progress_detail}
                                                        onChange={e => setNewLog({...newLog, progress_detail: e.target.value})}
                                                        className="w-full bg-[#272726] border border-[#555] rounded-[8px] px-4 py-2 text-white text-[14px] outline-none focus:border-[#888]" 
                                                        placeholder="진행내용 입력"
                                                    />
                                                </div>
                                                <div className="flex-1">
                                                    <label className="block text-[#86868B] text-[13px] font-bold mb-2">관리방안</label>
                                                    <input 
                                                        type="text" 
                                                        value={newLog.management_plan}
                                                        onChange={e => setNewLog({...newLog, management_plan: e.target.value})}
                                                        className="w-full bg-[#272726] border border-[#555] rounded-[8px] px-4 py-2 text-white text-[14px] outline-none focus:border-[#888]" 
                                                        placeholder="관리방안 입력"
                                                    />
                                                </div>
                                            </div>
                                            <div className="flex justify-end">
                                                <button onClick={() => handleAddLog(pipe.id)} className="px-4 py-1.5 bg-[#3b82f6] text-white font-bold rounded-[6px] text-[13px] hover:bg-[#2563eb]">등록</button>
                                            </div>
                                        </div>
                                    )}

                                    <div className="flex flex-col gap-4">
                                        {pipeLogs.length > 0 ? pipeLogs.map(log => (
                                            <div key={log.id} className="flex gap-6 p-4 bg-[#1e1e1e] rounded-[16px] group relative">
                                                <div className="w-[120px] shrink-0 text-[#86868B] text-[13px] font-medium pt-1">
                                                    {formatTime(log.created_at)}
                                                </div>
                                                <div className="flex-1 flex gap-6">
                                                    <div className="flex-1">
                                                        <span className="block text-[12px] font-bold text-[#86868B] mb-1">진행내용</span>
                                                        <p className="text-[15px] text-[#E5E5E5] leading-relaxed break-keep">{log.progress_detail}</p>
                                                    </div>
                                                    <div className="flex-1">
                                                        <span className="block text-[12px] font-bold text-[#86868B] mb-1">관리방안</span>
                                                        <p className="text-[15px] text-[#E5E5E5] leading-relaxed break-keep">{log.management_plan}</p>
                                                    </div>
                                                </div>
                                                {isAllowedEditor && (
                                                    <button 
                                                        onClick={() => handleDeleteLog(log.id)}
                                                        className="absolute right-4 top-4 text-[#ef4444] opacity-0 group-hover:opacity-100 text-[13px] font-bold hover:underline"
                                                    >
                                                        삭제
                                                    </button>
                                                )}
                                            </div>
                                        )) : (
                                            <div className="text-center py-6 text-[#86868B] text-[14px]">아직 등록된 진행내역이 없습니다.</div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
