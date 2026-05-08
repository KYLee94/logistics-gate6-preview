import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../../utils/supabaseClient';

const MOCK_PIPELINES = [
    {"id": "task-pipe-pwc", "channel_name": "PwC삼일회계법인", "related_asset": "이오타서울, 현대차새만금프로젝트", "status": "진행중", "contact_point": "박성진 부대표 메인", "created_at": "2026-05-08T00:00:00Z"},
    {"id": "task-pipe-samsungpb", "channel_name": "삼성증권PB", "related_asset": "타임워크신도림, 분당롯데", "status": "진행중", "contact_point": "노혜란 지점장, 여인모 위원", "created_at": "2026-05-08T00:00:00Z"},
    {"id": "task-pipe-saramin", "channel_name": "사람인", "related_asset": "타임워크신도림", "status": "진행중", "contact_point": "이경호 본부장", "created_at": "2026-05-08T00:00:00Z"},
    {"id": "task-pipe-rsquare", "channel_name": "알스퀘어", "related_asset": "미정", "status": "대기", "contact_point": "미정", "created_at": "2026-05-08T00:00:00Z"}
];

const MOCK_LOGS = [
    {"id": "log-1", "pipeline_id": "task-pipe-pwc", "progress_detail": "킥오프 미팅 통한 이오타 서울 임차기업 리스트업 및 현대차 새만금 연계 검토", "management_plan": "주기적 미팅 및 보상 방안 구조화", "created_at": "2026-05-08T00:00:00Z"},
    {"id": "log-2", "pipeline_id": "task-pipe-samsungpb", "progress_detail": "타임워크 신도림 계약서 검토 단계, 타임워크 분당 양사 연결 브리핑 진행", "management_plan": "주기적 미팅 및 신규 기업 물색", "created_at": "2026-05-08T00:00:00Z"},
    {"id": "log-3", "pipeline_id": "task-pipe-saramin", "progress_detail": "사람인 사이트 하위 메뉴에 임차 정보 확인 및 임차 제안서 신규 업로드 요청", "management_plan": "주기적 미팅 및 진행 현황 체크, 실효성 검토", "created_at": "2026-05-08T00:00:00Z"},
    {"id": "log-4", "pipeline_id": "task-pipe-rsquare", "progress_detail": "알스퀘어 TR DB 구축형 활용 가능 여부 협의", "management_plan": "1차 미팅 예정", "created_at": "2026-05-08T00:00:00Z"}
];

export default function MarketingPipeline({ memberInfo, masterStakeholders, fetchMasterStakeholders }) {
    const [pipelines, setPipelines] = useState([]);
    const [logs, setLogs] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    const isAllowedEditor = ['김민지', '고아라', '전기영'].includes(memberInfo?.staff_name);

    // States for Adding Pipeline
    const [isAddingPipeline, setIsAddingPipeline] = useState(false);
    const [newPipeline, setNewPipeline] = useState({ channel_name: '', status: '대기', related_asset: 'IOTA 공통', contact_point: '', progress_detail: '', management_plan: '' });
    const [showCompanyDropdown, setShowCompanyDropdown] = useState(false);
    const [showContactDropdown, setShowContactDropdown] = useState(false);

    // States for Expanded Pipeline & Adding Logs
    const [expandedPipelineId, setExpandedPipelineId] = useState(null);
    const [isAddingLog, setIsAddingLog] = useState(false);
    const [newLog, setNewLog] = useState({ progress_detail: '', management_plan: '' });
    const [showNewStakeholderModal, setShowNewStakeholderModal] = useState(false);
    const [stakeholderCat, setStakeholderCat] = useState('');
    const [isSubmittingStakeholder, setIsSubmittingStakeholder] = useState(false);
    const [itemToDelete, setItemToDelete] = useState(null); // { type: 'pipeline' | 'log', id: string, message: string }
    const [isDeleting, setIsDeleting] = useState(false);

    const fetchPipelines = async () => {
        try {
            const { data, error } = await supabase.from('iota_marketing_pipelines').select('*').order('created_at', { ascending: false });
            if (error) throw error;
            setPipelines(data || []);
        } catch (e) {
            console.warn('Supabase fetch failed, falling back to localStorage for pipelines', e);
            const local = localStorage.getItem('iota_marketing_pipelines');
            if (local) setPipelines(JSON.parse(local));
            else {
                setPipelines(MOCK_PIPELINES);
                localStorage.setItem('iota_marketing_pipelines', JSON.stringify(MOCK_PIPELINES));
            }
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
            else {
                setLogs(MOCK_LOGS);
                localStorage.setItem('iota_marketing_pipeline_logs', JSON.stringify(MOCK_LOGS));
            }
        }
    };

    useEffect(() => {
        setIsLoading(true);
        Promise.all([fetchPipelines(), fetchLogs()]).then(() => setIsLoading(false));
    }, []);

    const submitPipeline = async () => {
        const insertData = { 
            channel_name: newPipeline.channel_name, 
            status: newPipeline.status, 
            related_asset: newPipeline.related_asset, 
            contact_point: newPipeline.contact_point, 
            created_at: new Date().toISOString() 
        };
        const fallbackPipelineId = `task-pipe-${Date.now()}`;
        
        try {
            const { data, error } = await supabase.from('iota_marketing_pipelines').insert([insertData]).select('*');
            if (error) {
                alert('파이프라인 등록 중 DB 오류 발생: ' + error.message);
                throw error;
            }
            
            const pId = data && data[0] ? data[0].id : fallbackPipelineId;
            
            if (newPipeline.progress_detail || newPipeline.management_plan) {
                const { error: logError } = await supabase.from('iota_marketing_pipeline_logs').insert([{
                    pipeline_id: pId,
                    progress_detail: newPipeline.progress_detail,
                    management_plan: newPipeline.management_plan,
                    created_at: new Date().toISOString()
                }]);
                if (logError) {
                    alert('로그 등록 중 DB 오류 발생: ' + logError.message);
                    throw logError;
                }
            }
            await fetchPipelines();
            await fetchLogs();
        } catch (e) {
            insertData.id = fallbackPipelineId;
            const localPipes = [...pipelines, insertData];
            setPipelines(localPipes);
            localStorage.setItem('iota_marketing_pipelines', JSON.stringify(localPipes));
            
            if (newPipeline.progress_detail || newPipeline.management_plan) {
                const logData = {
                    id: `log-${Date.now()}`,
                    pipeline_id: fallbackPipelineId,
                    progress_detail: newPipeline.progress_detail,
                    management_plan: newPipeline.management_plan,
                    created_at: new Date().toISOString()
                };
                const localLogs = [...logs, logData];
                setLogs(localLogs);
                localStorage.setItem('iota_marketing_pipeline_logs', JSON.stringify(localLogs));
            }
        }
        setIsAddingPipeline(false);
        setNewPipeline({ channel_name: '', status: '대기', related_asset: 'IOTA 공통', contact_point: '', progress_detail: '', management_plan: '' });
    };

    const registerMasterStakeholder = async () => {
        if (!stakeholderCat) return alert('이해관계자 분류를 선택해주세요.');
        setIsSubmittingStakeholder(true);
        try {
            const { error } = await supabase.from('iota_stakeholder_master').insert({
                company_name: newPipeline.channel_name,
                contact_name: newPipeline.contact_point || null,
                role_category: stakeholderCat || null
            });
            if (error && error.code !== '23505') {
                alert('이해관계자 등록 중 오류가 발생했습니다.');
            } else {
                if (fetchMasterStakeholders) await fetchMasterStakeholders();
                setShowNewStakeholderModal(false);
                await submitPipeline();
            }
        } catch (err) {
            alert('데이터베이스 연결 오류');
            setShowNewStakeholderModal(false);
        } finally {
            setIsSubmittingStakeholder(false);
        }
    };

    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleAddPipeline = async () => {
        if (!newPipeline.channel_name) return alert('채널명(기업명)을 입력해주세요.');
        if (!newPipeline.contact_point) return alert('컨택포인트(담당자)를 입력해주세요.');
        if (!newPipeline.progress_detail) return alert('진행 상세 내용을 입력해주세요.');
        if (!newPipeline.management_plan) return alert('향후 관리 및 대응 방안을 입력해주세요.');

        const existingCompany = (masterStakeholders || []).find(s => s.company_name === newPipeline.channel_name);
        const existingContact = newPipeline.contact_point ? (masterStakeholders || []).find(s => s.contact_name === newPipeline.contact_point) : true;

        if (!existingCompany || !existingContact) {
            setShowNewStakeholderModal(true);
            return;
        }

        setIsSubmitting(true);
        try {
            await submitPipeline();
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDeletePipeline = async (id) => {
        setIsDeleting(true);
        try {
            const { error } = await supabase.from('iota_marketing_pipelines').delete().eq('id', id);
            if (error) throw error;
            await fetchPipelines();
        } catch (e) {
            const local = pipelines.filter(p => p.id !== id);
            setPipelines(local);
            localStorage.setItem('iota_marketing_pipelines', JSON.stringify(local));
        } finally {
            setIsDeleting(false);
            setItemToDelete(null);
        }
    };

    const handleMovePipelineUp = async (index) => {
        if (index === 0) return;
        const current = pipelines[index];
        const prev = pipelines[index - 1];
        
        const temp = current.created_at;
        current.created_at = prev.created_at;
        prev.created_at = temp;
        
        const newPipelines = [...pipelines];
        newPipelines[index] = prev;
        newPipelines[index - 1] = current;
        setPipelines(newPipelines);
        
        try {
            await supabase.from('iota_marketing_pipelines').update({ created_at: current.created_at }).eq('id', current.id);
            await supabase.from('iota_marketing_pipelines').update({ created_at: prev.created_at }).eq('id', prev.id);
        } catch (e) {
            localStorage.setItem('iota_marketing_pipelines', JSON.stringify(newPipelines));
        }
    };

    const handleMovePipelineDown = async (index) => {
        if (index === pipelines.length - 1) return;
        const current = pipelines[index];
        const next = pipelines[index + 1];
        
        const temp = current.created_at;
        current.created_at = next.created_at;
        next.created_at = temp;
        
        const newPipelines = [...pipelines];
        newPipelines[index] = next;
        newPipelines[index + 1] = current;
        setPipelines(newPipelines);
        
        try {
            await supabase.from('iota_marketing_pipelines').update({ created_at: current.created_at }).eq('id', current.id);
            await supabase.from('iota_marketing_pipelines').update({ created_at: next.created_at }).eq('id', next.id);
        } catch (e) {
            localStorage.setItem('iota_marketing_pipelines', JSON.stringify(newPipelines));
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
            if (error) {
                alert('로그 추가 중 DB 오류 발생: ' + error.message);
                throw error;
            }
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
        setIsDeleting(true);
        try {
            const { error } = await supabase.from('iota_marketing_pipeline_logs').delete().eq('id', id);
            if (error) throw error;
            await fetchLogs();
        } catch (e) {
            const local = logs.filter(l => l.id !== id);
            setLogs(local);
            localStorage.setItem('iota_marketing_pipeline_logs', JSON.stringify(local));
        } finally {
            setIsDeleting(false);
            setItemToDelete(null);
        }
    };

    // Dropdown filters
    const uniqueCompanies = [...new Set((masterStakeholders || []).map(s => s.company_name).filter(Boolean))];
    const filteredCompanies = uniqueCompanies.filter(c => c.toLowerCase().includes(newPipeline.channel_name.toLowerCase()));
    
    let availableContacts = [];
    if (newPipeline.channel_name) {
        availableContacts = [...new Set((masterStakeholders || []).filter(s => s.company_name === newPipeline.channel_name).map(s => s.contact_name).filter(Boolean))];
    } else {
        availableContacts = [...new Set((masterStakeholders || []).map(s => s.contact_name).filter(Boolean))];
    }
    const filteredContacts = availableContacts.filter(c => c.toLowerCase().includes(newPipeline.contact_point.toLowerCase()));

    const formatTime = (isoString) => {
        const d = new Date(isoString);
        return d.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    };

    return (
        <div className="w-full">
            <div className="flex justify-between items-end mb-[12px]">
                <h2 className="text-[18px] font-bold text-white">Pipe line 관리</h2>
                <div className="flex items-center gap-4">
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
                                    onKeyDown={e => { 
                                        if(e.key === 'Enter') {
                                            e.preventDefault();
                                            if (!newPipeline.channel_name) return;
                                            const existing = masterStakeholders?.find(s => s.company_name === newPipeline.channel_name);
                                            if (!existing) {
                                                setShowNewStakeholderModal(true);
                                            }
                                            setShowCompanyDropdown(false);
                                        } 
                                    }}
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
                                            <div className="px-4 py-2">
                                                <span className="text-[#A1A1AA] text-[13px] block mb-2">검색 결과가 없습니다.</span>
                                                <button 
                                                    type="button"
                                                    onMouseDown={(e) => { e.preventDefault(); setShowNewStakeholderModal(true); setShowCompanyDropdown(false); }}
                                                    className="w-full px-3 py-2 bg-[#3b82f6] hover:bg-[#2563eb] text-white text-[13px] rounded-[8px] transition-colors"
                                                >
                                                    + 신규 등록
                                                </button>
                                            </div>
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
                                    onKeyDown={e => { 
                                        if(e.key === 'Enter') {
                                            e.preventDefault();
                                            if (!newPipeline.contact_point) return;
                                            const existingContact = masterStakeholders?.find(s => s.contact_name === newPipeline.contact_point);
                                            if (!existingContact) {
                                                setShowNewStakeholderModal(true);
                                            }
                                            setShowContactDropdown(false);
                                        } 
                                    }}
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
                                            <div className="px-4 py-2">
                                                <span className="text-[#A1A1AA] text-[13px] block mb-2">검색 결과가 없습니다.</span>
                                                <button 
                                                    type="button"
                                                    onMouseDown={(e) => { e.preventDefault(); setShowNewStakeholderModal(true); setShowContactDropdown(false); }}
                                                    className="w-full px-3 py-2 bg-[#3b82f6] hover:bg-[#2563eb] text-white text-[13px] rounded-[8px] transition-colors"
                                                >
                                                    + 신규 등록
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                            <div className="w-[150px]">
                                <label className="block text-[#86868B] text-[13px] font-bold mb-2">상태</label>
                                <select 
                                    value={newPipeline.status}
                                    onChange={e => setNewPipeline({...newPipeline, status: e.target.value})}
                                    className="w-full bg-[#272726] border border-[#444] rounded-[12px] px-4 py-3 text-white text-[15px] outline-none focus:border-[#888] appearance-none cursor-pointer"
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
                                    className="w-full bg-[#272726] border border-[#444] rounded-[12px] px-4 py-3 text-white text-[15px] outline-none focus:border-[#888] appearance-none cursor-pointer"
                                >
                                    <option>IOTA 공통</option>
                                    <option>427 PFV</option>
                                    <option>816 PFV</option>
                                    <option>421 Fund</option>
                                </select>
                            </div>
                        </div>
                        <div className="flex gap-4">
                            <div className="flex-1">
                                <label className="block text-[#86868B] text-[13px] font-bold mb-2">초기 진행내용 (필수)</label>
                                <input 
                                    type="text" 
                                    value={newPipeline.progress_detail}
                                    onChange={e => setNewPipeline({...newPipeline, progress_detail: e.target.value})}
                                    className="w-full bg-[#272726] border border-[#444] rounded-[12px] px-4 py-3 text-white text-[15px] outline-none focus:border-[#888]" 
                                    placeholder="진행내용 요약" 
                                />
                            </div>
                            <div className="flex-1">
                                <label className="block text-[#86868B] text-[13px] font-bold mb-2">초기 관리방안 (필수)</label>
                                <input 
                                    type="text" 
                                    value={newPipeline.management_plan}
                                    onChange={e => setNewPipeline({...newPipeline, management_plan: e.target.value})}
                                    onKeyDown={e => { if(e.key === 'Enter') handleAddPipeline() }}
                                    className="w-full bg-[#272726] border border-[#444] rounded-[12px] px-4 py-3 text-white text-[15px] outline-none focus:border-[#888]" 
                                    placeholder="관리방안 및 향후 계획" 
                                />
                            </div>
                        </div>
                        <div className="flex justify-end pt-2 border-t border-[#3c3c3c]">
                            <button 
                                onClick={handleAddPipeline} 
                                disabled={isSubmitting}
                                className={`px-6 py-2 bg-white text-black font-bold rounded-[8px] transition-all ${isSubmitting ? 'opacity-50 cursor-not-allowed' : 'hover:bg-[#E5E5E5]'}`}
                            >
                                {isSubmitting ? '등록 중...' : '등록하기'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="flex flex-col gap-[10px]">
                {pipelines.map((pipe, index) => {
                    const pipeLogs = logs.filter(l => l.pipeline_id === pipe.id);
                    const isExpanded = expandedPipelineId === pipe.id;

                    return (
                        <div 
                            key={pipe.id}
                            className={`w-full relative bg-[#272726] border border-[#3c3c3c] rounded-[24px] p-6 transition-all duration-300 group/row ${isExpanded ? '' : 'hover:bg-[#333] cursor-pointer'}`}
                            onClick={() => !isExpanded && setExpandedPipelineId(pipe.id)}
                        >
                            {/* 삭제 및 정렬 버튼 (우측 바깥 영역) */}
                            {isAllowedEditor && (
                                <div className="absolute right-[-118px] w-[118px] pl-[8px] top-0 bottom-0 flex items-center justify-start gap-2 opacity-0 group-hover/row:opacity-100 transition-opacity">
                                    <div className="flex flex-col gap-1">
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); handleMovePipelineUp(index); }}
                                            disabled={index === 0}
                                            className={`w-7 h-7 flex items-center justify-center rounded-[6px] bg-[#272726] border border-[#3c3c3c] transition-colors ${index === 0 ? 'opacity-30 cursor-not-allowed' : 'hover:bg-[#333] cursor-pointer'}`}
                                        >
                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#E5E5E5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15"></polyline></svg>
                                        </button>
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); handleMovePipelineDown(index); }}
                                            disabled={index === pipelines.length - 1}
                                            className={`w-7 h-7 flex items-center justify-center rounded-[6px] bg-[#272726] border border-[#3c3c3c] transition-colors ${index === pipelines.length - 1 ? 'opacity-30 cursor-not-allowed' : 'hover:bg-[#333] cursor-pointer'}`}
                                        >
                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#E5E5E5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                                        </button>
                                    </div>
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); setItemToDelete({ type: 'pipeline', id: pipe.id, message: '정말 삭제하시겠습니까? 관련 로그도 모두 삭제됩니다.' }); }} 
                                        className="px-3 py-2 h-[60px] bg-[#ef4444]/10 text-[#ef4444] border border-[#ef4444]/30 rounded-[8px] text-[13px] font-bold hover:bg-[#ef4444]/20 cursor-pointer"
                                    >
                                        삭제
                                    </button>
                                </div>
                            )}

                            <div className="flex justify-between items-center gap-8 relative">
                                <div className="flex-1 flex gap-8 items-center">
                                    {/* 채널명 (부각) */}
                                    <div className="w-[300px] shrink-0 border-r border-[#444]/50 pr-8">
                                        <span className="text-[13px] font-bold text-[#86868B] block mb-1">채널명</span>
                                        <h3 className="text-[26px] font-bold text-white tracking-tight leading-tight">{pipe.channel_name}</h3>
                                    </div>
                                    
                                    {/* 나머지 정보 */}
                                    <div className="flex-1 flex flex-col justify-center gap-4">
                                        <div className="flex gap-12 items-center">
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
                                        
                                        {/* 최근 진행내용 및 관리방안 */}
                                        {pipeLogs.length > 0 && !isExpanded && (
                                            <div className="flex gap-8 mt-1 border-t border-[#444]/30 pt-3">
                                                <div className="flex-1">
                                                    <span className="text-[12px] font-bold text-[#86868B] block mb-1">최근 진행내용</span>
                                                    <p className="text-[14px] text-[#E5E5E5] line-clamp-1">{pipeLogs[0].progress_detail || '-'}</p>
                                                </div>
                                                <div className="flex-1">
                                                    <span className="text-[12px] font-bold text-[#86868B] block mb-1">최근 관리방안</span>
                                                    <p className="text-[14px] text-[#E5E5E5] line-clamp-1">{pipeLogs[0].management_plan || '-'}</p>
                                                </div>
                                            </div>
                                        )}
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
                                                        onClick={() => setItemToDelete({ type: 'log', id: log.id, message: '로그를 삭제하시겠습니까?' })}
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

            {showNewStakeholderModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60">
                    <div className="bg-[#222] border border-[#333] rounded-[16px] w-[320px] p-[24px] shadow-2xl flex flex-col items-center">
                        <div className="w-[48px] h-[48px] rounded-full bg-white/10 flex items-center justify-center mb-[16px]">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2997ff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="16"></line><line x1="8" y1="12" x2="16" y2="12"></line></svg>
                        </div>
                        <h3 className="text-[16px] font-bold text-white mb-[8px]">신규 이해관계자 등록</h3>
                        <p className="text-[13px] text-[#86868B] text-center mb-[20px]">입력하신 정보(회사 또는 담당자)가 마스터 데이터에 없습니다.<br/>신규 등록 후 파이프라인을 저장하시겠습니까?</p>
                        
                        <div className="w-full mb-[24px] relative">
                            <select 
                                value={stakeholderCat}
                                onChange={(e) => setStakeholderCat(e.target.value)}
                                className="w-full bg-[#1A1A1A] border border-[#333] rounded-[8px] pl-[12px] pr-[30px] py-[10px] text-[13px] text-white outline-none focus:border-[#2997ff] appearance-none cursor-pointer"
                            >
                                <option value="" disabled>이해관계자 분류 선택</option>
                                <option value="SI">SI</option>
                                <option value="잠재임차사">잠재임차사</option>
                                <option value="운영 파트너">운영 파트너</option>
                            </select>
                            <div className="absolute right-[12px] top-1/2 -translate-y-1/2 pointer-events-none text-[#86868B]">
                                <svg width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                            </div>
                        </div>

                        <div className="flex items-center gap-[12px] w-full">
                            <button onClick={() => setShowNewStakeholderModal(false)} className="flex-1 py-[10px] rounded-[8px] bg-[#333] hover:bg-[#444] text-white text-[13px] font-medium transition-colors">취소</button>
                            <button onClick={registerMasterStakeholder} disabled={isSubmittingStakeholder} className="flex-1 py-[10px] rounded-[8px] bg-[#2997ff] hover:bg-[#0071e3] text-white text-[13px] font-bold transition-colors">{isSubmittingStakeholder ? '등록 중...' : '등록 후 저장'}</button>
                        </div>
                    </div>
                </div>
            )}
            {/* Delete Confirmation Modal */}
            {itemToDelete && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60">
                    <div className="bg-[#222] border border-[#333] rounded-[16px] w-[320px] p-[24px] shadow-2xl flex flex-col items-center">
                        <div className="w-[48px] h-[48px] rounded-full bg-white/10 flex items-center justify-center mb-[16px]">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"></path><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                        </div>
                        <h3 className="text-[16px] font-bold text-white mb-[8px] text-center">{itemToDelete.message}</h3>
                        <p className="text-[13px] text-[#86868B] text-center mb-[24px]">이 작업은 되돌릴 수 없습니다.</p>
                        <div className="flex items-center gap-[12px] w-full">
                            <button 
                                type="button"
                                onClick={() => setItemToDelete(null)}
                                className="flex-1 py-[10px] rounded-[8px] bg-[#333] hover:bg-[#444] text-white text-[13px] font-medium transition-colors"
                                disabled={isDeleting}
                            >
                                취소
                            </button>
                            <button 
                                type="button"
                                onClick={() => {
                                    if (itemToDelete.type === 'pipeline') {
                                        handleDeletePipeline(itemToDelete.id);
                                    } else if (itemToDelete.type === 'log') {
                                        handleDeleteLog(itemToDelete.id);
                                    }
                                }}
                                className="flex-1 py-[10px] rounded-[8px] bg-white hover:bg-gray-200 text-black text-[13px] font-bold transition-colors flex justify-center items-center"
                                disabled={isDeleting}
                            >
                                {isDeleting ? '삭제 중...' : '삭제'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
