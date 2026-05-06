import React, { useState, useEffect } from 'react';
import { supabase } from '../../../utils/supabaseClient';
import { useAuth } from '../../../context/AuthContext';
import LogWriteBox from '../LogWriteBox';

export default function WorkspacePm() {
    const { memberInfo } = useAuth();
    
    
    // Logs State
    const [logs, setLogs] = useState([]);
    const [logsViewMode, setLogsViewMode] = useState('summary');
    const [currentPage, setCurrentPage] = useState(1);
    const [expandedLogs, setExpandedLogs] = useState({});
    const [expandedDecisions, setExpandedDecisions] = useState({});
    const [logSearchQuery, setLogSearchQuery] = useState('');
    const [masterStakeholders, setMasterStakeholders] = useState([]);
    
    // Delete states
    const [logToDelete, setLogToDelete] = useState(null);
    const [isDeleting, setIsDeleting] = useState(false);
    
    
    // Filter states
    const [filterStakeholder, setFilterStakeholder] = useState('');
    const [filterCell, setFilterCell] = useState('');
    const [filterPurpose, setFilterPurpose] = useState('');
    const [filterStatus, setFilterStatus] = useState('');
    const [filterPriority, setFilterPriority] = useState('');
    
    // Edit states
    const [editingLogId, setEditingLogId] = useState(null);
    const [editingContent, setEditingContent] = useState('');
    const [isSavingEdit, setIsSavingEdit] = useState(false);


    const renderLogTextWithMentions = (text) => {
        if (!text) return null;
        if (!masterStakeholders || masterStakeholders.length === 0) return text;
        const names = Array.from(new Set(masterStakeholders.map(s => s.contact_name).filter(Boolean)));
        if (names.length === 0) return text;

        const escapedNames = names.map(n => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
        const regex = new RegExp(`(${escapedNames.join('|')})`, 'g');
        const parts = text.split(regex);

        return parts.map((part, i) => {
            if (names.includes(part)) {
                return <span key={i} className="text-[#82afb9] font-bold">{part}</span>;
            }
            return part;
        });
    };


    const [kpiData, setKpiData] = useState({
        progress_percent: 18.0,
        budget_variance: 1.2,
        schedule_slippage_days: 7,
        covenant_status: '정상',
        covenant_ltv: 45.5,
        covenant_dscr: 1.25
    });

    const fetchMasterStakeholders = async () => {
        const { data, error } = await supabase
            .from('iota_stakeholder_master')
            .select('*')
            .limit(5000);
        if (data && !error) {
            setMasterStakeholders(data);
        }
    };

    const fetchLogs = async () => {
        try {
            const { data, error } = await supabase
                .from('iota_seoul_logs')
                .select('*, iota_seoul_log_stakeholders(sh_name, role_category)')
                .order('work_date', { ascending: false })
                .order('created_at', { ascending: false });
            if (error) throw error;
            
            // Filter out non-members ('기타')
            const validLogs = (data || []).filter(log => getCellName(log.writer_name) !== '기타');
            setLogs(validLogs);
        } catch (e) {
            console.error('Error fetching logs:', e);
        }
    };

    useEffect(() => {
        fetchLogs();
        const fetchKpis = async () => {
            const { data, error } = await supabase
                .from('iota_workspace_kpis')
                .select('*')
                .eq('project_id', 'IOTA_SEOUL')
                .single();
                
            if (data && !error) {
                setKpiData(data);
            }
        };
        fetchKpis();

        fetchMasterStakeholders();
    }, []);

    const handleDelete = async (logId) => {
        setIsDeleting(true);
        try {
            await supabase.from('iota_seoul_log_links').delete().eq('log_id', logId);
            await supabase.from('iota_seoul_log_stakeholders').delete().eq('log_id', logId);
            const { error } = await supabase.from('iota_seoul_logs').delete().eq('log_id', logId);
            if (error) throw error;
            
            setLogs(prev => prev.filter(l => l.log_id !== logId));
            setLogToDelete(null);
        } catch (error) {
            console.error('Error deleting log:', error);
            alert('삭제 중 오류가 발생했습니다.');
        } finally {
            setIsDeleting(false);
        }
    };

    const handleSaveEdit = async (logId) => {
        if (!editingContent.trim()) return;
        setIsSavingEdit(true);
        try {
            const { error } = await supabase
                .from('iota_seoul_logs')
                .update({ raw_text: editingContent, updated_at: new Date().toISOString() })
                .eq('log_id', logId);
            
            if (error) throw error;
            
            setLogs(prev => prev.map(l => l.log_id === logId ? { ...l, raw_text: editingContent, updated_at: new Date().toISOString() } : l));
            setEditingLogId(null);
            setEditingContent('');
        } catch (err) {
            console.error('Error updating log:', err);
            alert('수정 중 오류가 발생했습니다.');
        } finally {
            setIsSavingEdit(false);
        }
    };

    const getCellName = (name) => {
        const cells = {
            '전기영': '기획추진', '이시정': '기획추진', '이관용': '기획추진',
            '이철승': 'CFT 총괄', '윤관식': 'CFT 총괄', '정조민': 'CFT 총괄', '우형석': 'CFT 총괄',
            '권순일': '사업PM', '강순용': '사업PM', '윤주형': '사업PM', '김제익': '사업PM', '류홍': '사업PM', '박만진': '사업PM', '박일훈': '사업PM', '이정원': '사업PM', '전무경': '사업PM', '한찬호': '사업PM', '박석제': '사업PM', '박채현': '사업PM', '소현준': '사업PM', '이수정': '사업PM', '조영비': '사업PM', '한수정': '사업PM',
            '박준호': '파이낸싱', '강석민': '파이낸싱', '정리훈': '파이낸싱', '손유정': '파이낸싱', '김지우': '파이낸싱', '박현승': '파이낸싱', '이성민A': '파이낸싱', '한승환': '파이낸싱',
            '홍장군': '개발관리', '채원': '개발관리', '김보성': '개발관리', '전승희': '개발관리', '김대익': '개발관리', '장성진': '개발관리', '이정훈': '개발관리', '박봉서': '개발관리',
            '김민지': '기업마케팅', '고아라': '기업마케팅', '이가현': '기업마케팅', '정수명': '기업마케팅',
            '김현수': '상품·디지털', '현철호': '상품·디지털', '신민호': '상품·디지털',
            '김행단': '펀드운용', '윤용택': 'IPR'
        };
        return cells[name] || '기타';
    };

    const formatDateYYMMDD = (dateStr) => {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        const yy = String(d.getFullYear()).slice(2);
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        return `${yy}.${mm}.${dd}`;
    };

    const toggleExpand = (id) => {
        setExpandedLogs(prev => ({ ...prev, [id]: !prev[id] }));
    };

    const toggleDecisionExpand = (id) => {
        setExpandedDecisions(prev => ({ ...prev, [id]: !prev[id] }));
    };

    const logsPerPage = logsViewMode === 'summary' ? 5 : 20;
    const filteredLogs = logs.filter(log => {
        const cell = getCellName(log.writer_name);
        const isAllowedCell = cell === '사업PM' || cell === '기획추진' || cell === '전략자문';
        if (!isAllowedCell) return false;

        if (filterStakeholder && log.iota_seoul_log_stakeholders?.[0]?.role_category !== filterStakeholder) return false;
        if (filterCell && cell !== filterCell) return false;
        if (filterPurpose && (log.metadata?.triage_type || '공유') !== filterPurpose) return false;
        if (filterStatus && (log.metadata?.issue_status || '진행중') !== filterStatus) return false;
        if (filterPriority && (log.metadata?.priority || '중간') !== filterPriority) return false;

        if (!logSearchQuery) return true;
        const query = logSearchQuery.toLowerCase();
        return (
            log.raw_text?.toLowerCase().includes(query) ||
            log.writer_name?.toLowerCase().includes(query) ||
            log.metadata?.workspace_label?.toLowerCase().includes(query) ||
            log.metadata?.iota_matches?.[0]?.label?.toLowerCase().includes(query)
        );
    });
    const totalPages = Math.max(1, Math.ceil(filteredLogs.length / logsPerPage));
    const displayedLogs = filteredLogs.slice((currentPage - 1) * logsPerPage, currentPage * logsPerPage);

    const iconChevronGray = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' fill='none' stroke='%23A1A1AA' stroke-width='2' stroke-linecap='round' stroke-linejoin='round' viewBox='0 0 24 24'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`;
    const iconChevronDark = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' fill='none' stroke='%23666' stroke-width='2' stroke-linecap='round' stroke-linejoin='round' viewBox='0 0 24 24'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`;


    return (
        <div className="w-full flex-1 flex flex-col pt-[60px] pb-[60px] max-w-[1200px] mx-auto">
            {/* Header Metadata */}
            <div className="w-full flex justify-between items-end mb-[24px]">
                <div>
                    <h1 className="text-[36px] font-bold text-white tracking-tight leading-none font-['Inter'] mb-[8px]">사업 PM</h1>
                    <p className="text-[16px] text-[#86868B] leading-[26px]">전체 사업 일정 및 예산 통제, 변경관리 결정, PFV 외부 단일창구</p>
                </div>
            </div>
            
            {/* PM Team Structure */}
            <div className="w-full border border-[#333] rounded-[24px] -mt-[4px] mb-[40px] flex flex-col">
                {/* 사업1파트 */}
                <div className="flex items-center px-[24px] py-[16px]">
                    <div className="w-[100px] shrink-0">
                        <span className="text-[13px] font-bold text-[#86868B]">Co-PM 전략</span>
                    </div>
                    <div className="flex items-center gap-[12px] w-[180px] shrink-0">
                        <div className="relative w-[40px] h-[40px] shrink-0 rounded-full bg-[#3c3c3c] flex items-center justify-center overflow-hidden">
                            <img src={`${import.meta.env.BASE_URL}권순일.webp`} alt="권순일" className="w-full h-full object-cover" onError={(e) => { e.target.src = `${import.meta.env.BASE_URL}default_avatar.svg`; }} />
                            <div className="absolute inset-0 rounded-full border border-white/10 pointer-events-none"></div>
                        </div>
                        <div className="flex flex-col text-left">
                            <span className="text-white font-bold text-[15px] leading-tight">권순일</span>
                            <span className="text-[#A1A1AA] text-[13px] mt-[2px] leading-tight">사업1파트장</span>
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-x-3 gap-y-2 -ml-[10px]">
                        {['윤주형', '김제익', '류홍', '박만진', '박일훈', '이정원', '전무경'].map(name => (
                            <div key={name} className="flex items-center gap-[6px] bg-[#222] border border-[#333] rounded-full pl-[4px] pr-[10px] py-[4px] min-w-[76px]">
                                <div className="w-[20px] h-[20px] shrink-0 rounded-full bg-[#3c3c3c] overflow-hidden">
                                    <img src={`${import.meta.env.BASE_URL}${name}.webp`} alt={name} className="w-full h-full object-cover" onError={(e) => { e.target.src = `${import.meta.env.BASE_URL}default_avatar.svg`; }} />
                                </div>
                                <span className="text-[#E5E5E5] text-[12px] font-medium leading-none">{name}</span>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="w-full h-px bg-[#333]"></div>

                {/* 사업2파트 */}
                <div className="flex items-center px-[24px] py-[16px]">
                    <div className="w-[100px] shrink-0">
                        <span className="text-[13px] font-bold text-[#86868B]">Co-PM 사업</span>
                    </div>
                    <div className="flex items-center gap-[12px] w-[180px] shrink-0">
                        <div className="relative w-[40px] h-[40px] shrink-0 rounded-full bg-[#3c3c3c] flex items-center justify-center overflow-hidden">
                            <img src={`${import.meta.env.BASE_URL}강순용.webp`} alt="강순용" className="w-full h-full object-cover" onError={(e) => { e.target.src = `${import.meta.env.BASE_URL}default_avatar.svg`; }} />
                            <div className="absolute inset-0 rounded-full border border-white/10 pointer-events-none"></div>
                        </div>
                        <div className="flex flex-col text-left">
                            <span className="text-white font-bold text-[15px] leading-tight">강순용</span>
                            <span className="text-[#A1A1AA] text-[13px] mt-[2px] leading-tight">사업2파트장</span>
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-x-3 gap-y-2 -ml-[10px]">
                        {['한찬호', '박석제', '박채현', '소현준', '이수정', '조영비', '한수정'].map(name => (
                            <div key={name} className="flex items-center gap-[6px] bg-[#222] border border-[#333] rounded-full pl-[4px] pr-[10px] py-[4px] min-w-[76px]">
                                <div className="w-[20px] h-[20px] shrink-0 rounded-full bg-[#3c3c3c] overflow-hidden">
                                    <img src={`${import.meta.env.BASE_URL}${name}.webp`} alt={name} className="w-full h-full object-cover" onError={(e) => { e.target.src = `${import.meta.env.BASE_URL}default_avatar.svg`; }} />
                                </div>
                                <span className="text-[#E5E5E5] text-[12px] font-medium leading-none">{name}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* KPI Summary Cards */}
            <div className="grid grid-cols-5 gap-[10px] mb-[40px]">
                <div className="bg-[#262626] border border-[#333] rounded-[24px] p-[24px]">
                    <div className="text-[#86868B] text-[13px] font-medium mb-[8px]">공정 진척도</div>
                    <div className="flex items-baseline gap-[4px]">
                        <span className="text-[28px] font-bold text-white">{kpiData.progress_percent}%</span>
                        <span className="text-[13px] text-[#34d399] font-medium">▲ 0.5%</span>
                    </div>
                </div>
                <div className="bg-[#262626] border border-[#333] rounded-[24px] p-[24px]">
                    <div className="text-[#86868B] text-[13px] font-medium mb-[8px]">예산 대비 집행</div>
                    <div className="flex items-baseline gap-[4px]">
                        <span className="text-[28px] font-bold text-white">{kpiData.budget_variance}%</span>
                        <span className="text-[13px] text-[#FF453A] font-medium">▼ 0.2%</span>
                    </div>
                </div>
                <div className="bg-[#262626] border border-[#333] rounded-[24px] p-[24px]">
                    <div className="text-[#86868B] text-[13px] font-medium mb-[8px]">Schedule Slippage</div>
                    <div className="flex items-baseline gap-[4px]">
                        <span className="text-[28px] font-bold text-[#FF453A]">{kpiData.schedule_slippage_days} days</span>
                    </div>
                </div>
                <div className="bg-[#262626] border border-[#333] rounded-[24px] p-[24px]">
                    <div className="text-[#86868B] text-[13px] font-medium mb-[8px]">Covenant (LTV)</div>
                    <div className="flex items-baseline gap-[4px]">
                        <span className="text-[28px] font-bold text-white">{kpiData.covenant_ltv}%</span>
                        <span className="text-[13px] text-[#34d399] font-medium">Safe</span>
                    </div>
                </div>
                <div className="bg-[#262626] border border-[#333] rounded-[24px] p-[24px]">
                    <div className="text-[#86868B] text-[13px] font-medium mb-[8px]">Covenant (DSCR)</div>
                    <div className="flex items-baseline gap-[4px]">
                        <span className="text-[28px] font-bold text-white">{kpiData.covenant_dscr}x</span>
                        <span className="text-[13px] text-[#34d399] font-medium">Safe</span>
                    </div>
                </div>
            </div>

            {/* Task Input Form */}
            <LogWriteBox 
                memberInfo={memberInfo}
                masterStakeholders={masterStakeholders}
                fetchLogs={fetchLogs}
                fetchMasterStakeholders={fetchMasterStakeholders}
                workspaceCode="WS_PM"
                workspaceLabel="사업 PM"
            />
            {/* Log Viewer */}
            <div className="flex justify-between items-center mb-[12px]">
                <h2 className="text-[18px] font-bold text-white tracking-tight">최근 등록된 업무</h2>
                <div className="flex items-center gap-[12px]">
                    {/* Search Box */}
                    <div className="relative">
                        <div className="absolute inset-y-0 left-[12px] flex items-center pointer-events-none">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#86868B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                        </div>
                        <input 
                            type="text" 
                            placeholder="검색어 입력..." 
                            value={logSearchQuery}
                            onChange={(e) => setLogSearchQuery(e.target.value)}
                            className="bg-[#222] border border-[#333] hover:border-[#444] rounded-[8px] pl-[32px] pr-[12px] py-[6px] text-[12px] text-white w-[180px] focus:outline-none focus:border-[#2997ff] transition-all"
                        />
                    </div>
                    <button 
                        type="button"
                        onClick={() => { setLogsViewMode(prev => prev === 'summary' ? 'full' : 'summary'); setCurrentPage(1); }} 
                        className="px-[12px] py-[6px] rounded-[8px] bg-[#222] border border-[#333] text-[12px] text-[#A1A1AA] hover:text-white hover:border-[#444] transition-all font-medium"
                    >
                        {logsViewMode === 'summary' ? '전체보기' : '간략히 보기'}
                    </button>
                </div>
            </div>
            <div className="w-full border border-[#333] rounded-[24px] mb-[40px] flex flex-col bg-transparent">
                {/* Header Row */}
                <div className="w-full px-[20px] py-[12px] flex items-center border-b border-[#333] bg-[#222]/50 rounded-t-[24px]">
                    {/* Left Section */}
                    <div className="flex flex-1 min-w-0">
                        <div className="w-[86px] mr-[16px] text-center">
                            <span className="text-[13px] font-bold text-[#86868B]">프로젝트</span>
                        </div>
                        <div className="flex flex-1 min-w-0 translate-x-[-20px]">
                            <div className="w-[80px] shrink-0 translate-x-[4px] flex justify-center">
                                <select 
                                    value={filterCell}
                                    onChange={e => { setFilterCell(e.target.value); setCurrentPage(1); }}
                                    className={`bg-white/5 border border-transparent text-[12px] font-bold cursor-pointer appearance-none focus:outline-none w-[60px] hover:text-white hover:bg-white/10 rounded-[8px] px-[2px] py-[4px] transition-colors ${filterCell ? 'text-[#fbf167]' : 'text-[#A1A1AA]'}`}
                                    style={{ textAlignLast: 'center' }}
                                >
                                    <option value="" className="bg-[#222] text-[#E5E5E5]">기능셀</option>
                                    {Array.from(new Set(logs.map(log => getCellName(log.writer_name)))).filter(Boolean).map(val => (
                                        <option key={val} value={val} className="bg-[#222] text-[#E5E5E5]">{val}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="w-[110px] shrink-0 translate-x-[10px] flex items-center">
                                <span className="text-[13px] font-bold text-[#86868B] pl-[20px]">등록자</span>
                            </div>
                            <div className="flex-1 min-w-0 translate-x-[2px] flex items-center">
                                <span className="text-[13px] font-bold text-[#86868B] px-[4px]">내용</span>
                            </div>
                        </div>
                    </div>
                    {/* Right Section */}
                    <div className="flex gap-[12px] shrink-0 ml-[12px] justify-end items-center">
                        <div className="w-[110px] mr-[4px] text-right flex items-center justify-end">
                            <select 
                                value={filterStakeholder}
                                onChange={e => { setFilterStakeholder(e.target.value); setCurrentPage(1); }}
                                className={`bg-white/5 border border-transparent text-[12px] font-bold cursor-pointer appearance-none focus:outline-none w-[76px] hover:text-white hover:bg-white/10 rounded-[8px] px-[2px] py-[4px] transition-colors ${filterStakeholder ? 'text-[#fbf167]' : 'text-[#A1A1AA]'}`}
                                style={{ textAlignLast: 'center' }}
                            >
                                <option value="" className="bg-[#222] text-[#E5E5E5]">이해관계자</option>
                                {['투자자', '대주', 'SI', '잠재임차자', '운영 파트너', 'IGIS 내부인력'].map(val => (
                                    <option key={val} value={val} className="bg-[#222] text-[#E5E5E5]">{val}</option>
                                ))}
                            </select>
                        </div>
                        <div className="w-[60px] flex items-center justify-center translate-x-[6px]">
                            <select 
                                value={filterPurpose}
                                onChange={e => { setFilterPurpose(e.target.value); setCurrentPage(1); }}
                                className={`bg-white/5 border border-transparent text-[12px] font-bold cursor-pointer appearance-none focus:outline-none w-[44px] hover:text-white hover:bg-white/10 rounded-[8px] px-[2px] py-[4px] transition-colors ${filterPurpose ? 'text-[#fbf167]' : 'text-[#A1A1AA]'}`}
                                style={{ textAlignLast: 'center' }}
                            >
                                <option value="" className="bg-[#222] text-[#E5E5E5]">목적</option>
                                {['공유', '협업', '리스크 판단', '의사결정'].map(val => (
                                    <option key={val} value={val} className="bg-[#222] text-[#E5E5E5]">{val}</option>
                                ))}
                            </select>
                        </div>
                        <div className="w-[60px] flex items-center justify-center">
                            <select 
                                value={filterStatus}
                                onChange={e => { setFilterStatus(e.target.value); setCurrentPage(1); }}
                                className={`bg-white/5 border border-transparent text-[12px] font-bold cursor-pointer appearance-none focus:outline-none w-[54px] hover:text-white hover:bg-white/10 rounded-[8px] px-[2px] py-[4px] transition-colors ${filterStatus ? 'text-[#fbf167]' : 'text-[#A1A1AA]'}`}
                                style={{ textAlignLast: 'center' }}
                            >
                                <option value="" className="bg-[#222] text-[#E5E5E5]">진행상태</option>
                                {['신규', '검토중', '진행중', '보류', '완료'].map(val => (
                                    <option key={val} value={val} className="bg-[#222] text-[#E5E5E5]">{val}</option>
                                ))}
                            </select>
                        </div>
                        <div className="w-[40px] flex items-center justify-center">
                            <select 
                                value={filterPriority}
                                onChange={e => { setFilterPriority(e.target.value); setCurrentPage(1); }}
                                className={`bg-white/5 border border-transparent text-[12px] font-bold cursor-pointer appearance-none focus:outline-none w-[50px] hover:text-white hover:bg-white/10 rounded-[8px] px-[2px] py-[4px] transition-colors ${filterPriority ? 'text-[#fbf167]' : 'text-[#A1A1AA]'}`}
                                style={{ textAlignLast: 'center' }}
                            >
                                <option value="" className="bg-[#222] text-[#E5E5E5]">중요도</option>
                                {['높음', '중간', '낮음'].map(val => (
                                    <option key={val} value={val} className="bg-[#222] text-[#E5E5E5]">{val}</option>
                                ))}
                            </select>
                        </div>
                        <div className="w-[60px] text-center flex items-center justify-center">
                            <span className="text-[13px] font-bold text-[#86868B] px-[4px]">등록일</span>
                        </div>
                    </div>
                </div>
                {displayedLogs.map((log, index) => (
                    <div key={log.log_id} className={`relative w-full px-[20px] py-[16px] flex flex-col group transition-colors hover:bg-white/5 last:rounded-b-[24px] ${index !== displayedLogs.length - 1 ? 'border-b border-[#333]' : ''}`}>
                        {/* Main Row */}
                        <div className="w-full flex items-center justify-between">
                            {/* Left Section */}
                            <div className="flex items-center flex-1 min-w-0">
                                {/* Project Button */}
                                {(() => {
                                    let projName = 'IOTA 427';
                                    if (log.metadata?.project_name) {
                                        projName = log.metadata.project_name;
                                    } else {
                                        const text = log.metadata?.workspace_label || log.metadata?.source_project_text || '';
                                        if (text.includes('816') || text.includes('서울 2') || text.includes('IOTA 2') || text.includes('Two')) projName = 'IOTA 816';
                                        else if (text.includes('421')) projName = '421 Fund';
                                    }
                                    
                                    let textColorClass = 'text-[#E5E5E5] border-[#444]'; // IOTA 427 (Lightest)
                                    if (projName === 'IOTA 816') textColorClass = 'text-[#A1A1AA] border-[#333]'; // IOTA 816 (Medium)
                                    else if (projName === '421 Fund') textColorClass = 'text-[#737373] border-[#222]'; // 421 Fund (Darkest)
                                    else if (projName === 'IOTA 공통') textColorClass = 'text-[#A1A1AA] border-[#333]';
                                    
                                    return (
                                        <div className={`py-[6px] border rounded-[8px] text-[12px] font-bold ${textColorClass} shrink-0 mr-[16px] w-[86px] text-center bg-transparent`}>
                                            {projName}
                                        </div>
                                    );
                                })()}

                                <div className="flex items-center flex-1 min-w-0 translate-x-[-20px]">
                                    {/* Cell Name */}
                                    <div className="w-[80px] shrink-0 translate-x-[4px] flex justify-center">
                                        <span className="text-[13px] font-medium text-[#86868B]">{getCellName(log.writer_name)}</span>
                                    </div>

                                    {/* Avatar & Name */}
                                    <div className="flex items-center gap-[8px] w-[110px] shrink-0 translate-x-[10px]">
                                        <div className="w-[28px] h-[28px] rounded-full bg-[#333] overflow-hidden border border-[#444]">
                                            <img 
                                                src={`${import.meta.env.BASE_URL}${log.writer_name}.webp`} 
                                                alt={log.writer_name} 
                                                className="w-full h-full object-cover"
                                                onError={(e) => { e.target.src = `${import.meta.env.BASE_URL}default_avatar.svg`; }}
                                            />
                                        </div>
                                        <span className="text-[14px] font-bold text-white">{log.writer_name}</span>
                                    </div>

                                    {/* Content */}
                                    <div className="flex-1 min-w-0 pr-0 flex items-center gap-[8px] translate-x-[2px]">
                                        <div className="flex-1 min-w-0 text-[14px] text-[#E5E5E5] truncate">
                                            {log.raw_text ? log.raw_text.split('\n')[0] : ''}
                                        </div>
                                        {log.raw_text && log.raw_text.length > 40 && (
                                            <button 
                                                type="button"
                                                onClick={(e) => { e.stopPropagation(); toggleExpand(log.log_id); }}
                                                className="bg-white/5 border border-[#333] hover:border-[#555] rounded-[6px] pl-[6px] pr-[5px] h-[23px] transition-colors text-[#86868B] hover:text-[#E5E5E5] cursor-pointer shrink-0 ml-[8px] w-[73px] flex items-center justify-center gap-[4px]"
                                            >
                                                <span className="text-[12px] font-medium leading-none">{expandedLogs[log.log_id] ? '접기' : '펼쳐보기'}</span>
                                                <svg 
                                                    width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                                                    className={`transition-transform duration-200 ${expandedLogs[log.log_id] ? 'rotate-180' : ''}`}
                                                >
                                                    <polyline points="6 9 12 15 18 9"></polyline>
                                                </svg>
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Right Section */}
                            <div className="flex items-center gap-[12px] shrink-0 ml-[12px] justify-end">
                                {/* Stakeholder Info */}
                                <div className="shrink-0 flex justify-end w-[110px] mr-[4px]">
                                    {log.iota_seoul_log_stakeholders?.[0]?.sh_name && (
                                        <span className="text-[13px] text-[#A1A1AA] text-right truncate" title={log.iota_seoul_log_stakeholders[0].sh_name}>
                                            {log.iota_seoul_log_stakeholders[0].sh_name}
                                        </span>
                                    )}
                                </div>
                                <div className="h-[24px] flex items-center w-[60px] justify-center translate-x-[6px]"><span className="text-[13px] text-[#A1A1AA] truncate">{log.metadata?.triage_type || '공유'}</span></div>
                                <div className="h-[24px] flex items-center w-[60px] justify-center"><span className="text-[13px] text-[#E5E5E5]">{log.metadata?.issue_status || '진행중'}</span></div>
                                <div className="h-[24px] flex items-center w-[40px] justify-center">
                                    <span className={`text-[13px] font-bold ${log.metadata?.priority === '높음' ? 'text-[#FF453A]' : (log.metadata?.priority === '낮음' ? 'text-[#86868B]' : 'text-[#3b82f6]')}`}>
                                        {log.metadata?.priority || '중간'}
                                    </span>
                                </div>
                                <div className="relative flex flex-col items-center w-[60px] shrink-0 justify-center">
                                    <span className="text-[13px] text-[#86868B] font-['Inter'] leading-tight">
                                        {formatDateYYMMDD(log.work_date)}
                                    </span>
                                    {expandedLogs[log.log_id] && log.created_at && (
                                        <span className="absolute top-[100%] text-[11px] text-[#555] font-['Inter'] leading-tight mt-[2px] whitespace-nowrap">
                                            {new Date(log.created_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    )}
                                </div>
                                
                                {/* Delete Button (Absolute positioned outside content flow) */}
                                {log.writer_staff_id === memberInfo?.email && (
                                    <button 
                                        type="button"
                                        onClick={(e) => { e.stopPropagation(); setLogToDelete(log); }}
                                        className="absolute right-[-24px] top-1/2 -translate-y-1/2 w-[24px] h-[24px] bg-black rounded-none flex items-center justify-center transition-opacity opacity-100 border border-[#333] shadow-none cursor-pointer hover:bg-[#222]"
                                        title="삭제"
                                    >
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Expanded Box */}
                        {expandedLogs[log.log_id] && (
                            <div className="w-full flex mt-[14px]">
                                <div 
                                    className="bg-[#1c1c1e] border border-[#333] rounded-[12px] p-[16px] flex-1"
                                    style={{ marginLeft: '166px', marginRight: '72px' }}
                                >
                                    {/* Stakeholder Pill (Floated Right) */}
                                    {log.iota_seoul_log_stakeholders?.[0]?.sh_name && (
                                        <div className="float-right ml-[16px] mb-[12px] flex flex-col items-end gap-[4px]">
                                            <span className="text-[11px] font-bold text-[#86868B] pr-[14px]">이해관계자</span>
                                            <div className="bg-[#2a2a2c] border border-[#444] rounded-full pl-[8px] pr-[12px] py-[4px] flex items-center gap-[6px]">
                                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#A1A1AA" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                                                <span className="text-[12px] font-medium text-[#E5E5E5]">
                                                    {log.iota_seoul_log_stakeholders[0].sh_name}
                                                </span>
                                            </div>
                                        </div>
                                    )}
                                    
                                    {editingLogId === log.log_id ? (
                                        <div className="w-full">
                                            <textarea
                                                value={editingContent}
                                                onChange={(e) => setEditingContent(e.target.value)}
                                                className="w-full bg-[#2a2a2c] border border-[#444] rounded-[8px] p-[12px] text-[15px] text-[#E5E5E5] leading-relaxed resize-y focus:outline-none focus:border-[#2997ff] min-h-[180px]"
                                            />
                                            <div className="flex justify-end gap-[8px] mt-[12px]">
                                                <button
                                                    onClick={() => setEditingLogId(null)}
                                                    className="px-[12px] py-[6px] bg-transparent border border-[#444] rounded-[6px] text-[12px] text-[#A1A1AA] hover:text-[#E5E5E5] transition-colors"
                                                >
                                                    취소
                                                </button>
                                                <button
                                                    onClick={() => handleSaveEdit(log.log_id)}
                                                    disabled={isSavingEdit}
                                                    className="px-[12px] py-[6px] bg-[#2997ff] hover:bg-[#0071e3] border border-transparent rounded-[6px] text-[12px] text-white font-bold transition-colors disabled:opacity-50"
                                                >
                                                    {isSavingEdit ? '저장 중...' : '저장'}
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="whitespace-pre-wrap break-words text-[15px] text-[#E5E5E5] leading-relaxed">
                                            {renderLogTextWithMentions(log.raw_text)}
                                        </div>
                                    )}
                                    <div className="clear-both"></div>
                                    
                                    <div className="mt-[14px] flex items-end justify-between">
                                        <div className="text-[12px] text-[#555] font-medium">
                                            수정일자: {log.updated_at ? new Date(log.updated_at).toLocaleString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : new Date(log.created_at || log.work_date).toLocaleString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                        </div>
                                        {!editingLogId && (memberInfo?.email === log.writer_staff_id || memberInfo?.name === log.writer_name) && (
                                            <button
                                                type="button"
                                                onClick={(e) => { 
                                                    e.stopPropagation(); 
                                                    setEditingLogId(log.log_id);
                                                    setEditingContent(log.raw_text);
                                                }}
                                                className="px-[12px] py-[6px] bg-[#222] hover:bg-[#333] border border-[#333] hover:border-[#444] rounded-[6px] text-[12px] text-[#A1A1AA] hover:text-[#E5E5E5] font-medium transition-all"
                                            >
                                                수정하기
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                ))}
                {displayedLogs.length === 0 && (
                    <div className="py-[60px] text-center text-[14px] text-[#86868B]">등록된 업무가 없습니다.</div>
                )}

                {logsViewMode === 'full' && totalPages > 1 && (
                    <div className="w-full py-[24px] flex justify-center items-center gap-[12px]">
                        <button 
                            disabled={currentPage === 1}
                            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                            className="px-[12px] py-[6px] rounded bg-[#222] border border-[#333] text-[#E5E5E5] text-[13px] hover:bg-[#333] disabled:opacity-50 transition-colors"
                        >이전</button>
                        <span className="text-[13px] text-[#A1A1AA] font-bold">{currentPage} / {totalPages}</span>
                        <button 
                            disabled={currentPage === totalPages}
                            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                            className="px-[12px] py-[6px] rounded bg-[#222] border border-[#333] text-[#E5E5E5] text-[13px] hover:bg-[#333] disabled:opacity-50 transition-colors"
                        >다음</button>
                    </div>
                )}
            </div>

            {/* Top 10 Risks Board */}
            <h2 className="text-[18px] font-bold text-white mb-[12px]">Top 10 리스크 모니터링</h2>
            <div className="w-full bg-[#1A1A1A] border border-[#333] rounded-[24px] overflow-hidden mb-[40px]">
                <table className="w-full text-left">
                    <thead className="bg-[#222]">
                        <tr>
                            <th className="px-[20px] py-[16px] text-[13px] font-bold text-[#86868B] border-b border-[#333]">Risk</th>
                            <th className="px-[20px] py-[16px] text-[13px] font-bold text-[#86868B] border-b border-[#333]">담당 셀 (Owner)</th>
                            <th className="px-[20px] py-[16px] text-[13px] font-bold text-[#86868B] border-b border-[#333]">Trigger</th>
                            <th className="px-[20px] py-[16px] text-[13px] font-bold text-[#86868B] border-b border-[#333]">Status</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-[#333]">
                        <tr className="hover:bg-[#292928] transition-colors">
                            <td className="px-[20px] py-[16px] text-[15px] font-bold text-white">공정 지연 (시공·인허가 복합)</td>
                            <td className="px-[20px] py-[16px] text-[14px] text-[#E5E5E5]">개발관리 (<span className="text-[#E5E5E5] hover:text-[#fbf167] cursor-pointer transition-colors hover:underline underline-offset-4 decoration-[#fbf167]/50">홍장군</span>)</td>
                            <td className="px-[20px] py-[16px] text-[14px] text-[#A1A1AA]">2주 누적 지연</td>
                            <td className="px-[20px] py-[16px]"><span className="px-3 py-1 bg-[#d97706]/20 text-[#fbf167] rounded text-[13px] border border-[#d97706]/30 font-bold">Amber</span></td>
                        </tr>
                        <tr className="hover:bg-[#292928] transition-colors">
                            <td className="px-[20px] py-[16px] text-[15px] font-bold text-white">사업비 UW 범위 외 증가</td>
                            <td className="px-[20px] py-[16px] text-[14px] text-[#E5E5E5]">PM (<span className="text-[#E5E5E5] hover:text-[#fbf167] cursor-pointer transition-colors hover:underline underline-offset-4 decoration-[#fbf167]/50">강순용</span>)</td>
                            <td className="px-[20px] py-[16px] text-[14px] text-[#A1A1AA]">UW +5% 누적</td>
                            <td className="px-[20px] py-[16px]"><span className="px-3 py-1 bg-[#d97706]/20 text-[#fbf167] rounded text-[13px] border border-[#d97706]/30 font-bold">Amber</span></td>
                        </tr>
                        <tr className="hover:bg-[#292928] transition-colors">
                            <td className="px-[20px] py-[16px] text-[15px] font-bold text-white">대주단 Covenants 위반</td>
                            <td className="px-[20px] py-[16px] text-[14px] text-[#E5E5E5]">LFC (<span className="text-[#E5E5E5] hover:text-[#fbf167] cursor-pointer transition-colors hover:underline underline-offset-4 decoration-[#fbf167]/50">박준호</span>)</td>
                            <td className="px-[20px] py-[16px] text-[14px] text-[#A1A1AA]">DSCR/LTV 임계점</td>
                            <td className="px-[20px] py-[16px]"><span className="px-3 py-1 bg-[#059669]/20 text-[#34d399] rounded text-[13px] border border-[#059669]/30 font-bold">Green</span></td>
                        </tr>
                    </tbody>
                </table>
            </div>

            {/* Decision Log */}
            <h2 className="text-[18px] font-bold text-white mb-[12px]">최근 의사결정 로그 (Change Order)</h2>
            <div className="flex flex-col gap-3">
                {[
                    {
                        id: 'd1',
                        date: '2026-04-10',
                        created_at: '2026-04-10T14:30:00',
                        project: 'Iota 1',
                        title: 'Foster+Partners 설계 Alt B 채택 (UW 내)',
                        raw_text: 'Foster+Partners 설계 Alt B 채택 (UW 내)\n\n주요 안건:\n- 외부 입면 디자인은 B안이 가장 효율적이라는 판단\n- 예상 공사비 한도(UW) 내에서 구현 가능함\n- 강순용 전무님 승인 완료',
                        sh_name: '이지스자산운용 - 강순용',
                        status: 'Approved',
                        statusColor: 'text-[#34d399]'
                    },
                    {
                        id: 'd2',
                        date: '2026-04-01',
                        created_at: '2026-04-01T09:15:00',
                        project: 'Iota 2',
                        title: '삼성물산 도급 변경분 정산안 합의',
                        raw_text: '삼성물산 도급 변경분 정산안 합의\n\n세부 내역:\n- 물가상승분(Escalation) 반영한 최종 도급액 합의\n- 당초 예산 대비 2% 증가분은 예비비에서 충당\n- 윤관식 대표님 최종 결재 대기 중',
                        sh_name: '삼성물산 - 윤관식',
                        status: 'In Review',
                        statusColor: 'text-[#fbf167]'
                    }
                ].map((log) => (
                    <div key={log.id} className="relative bg-[#292928] border border-[#3c3c3c] rounded-[16px] p-[20px] flex flex-col hover:border-[#555] transition-colors">
                        <div className="flex items-center w-full">
                            <div className="relative flex flex-col justify-center w-[120px] shrink-0">
                                <span className="text-[13px] text-[#86868B] font-medium leading-tight">{log.date}</span>
                                {expandedDecisions[log.id] && log.created_at && (
                                    <span className="absolute top-[100%] left-0 text-[11px] text-[#555] font-['Inter'] leading-tight mt-[2px] whitespace-nowrap">
                                        {new Date(log.created_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                )}
                            </div>
                            <div className="w-[100px] shrink-0"><span className="text-[12px] px-2 py-0.5 bg-[#222] border border-[#333] text-[#A1A1AA] rounded">{log.project}</span></div>
                            <div className="flex-1 px-4 border-l border-[#333] flex items-center gap-[8px]">
                                <span className="text-[15px] font-bold text-white truncate">{log.raw_text ? log.raw_text.split('\n')[0] : ''}</span>
                                <button 
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); toggleDecisionExpand(log.id); }}
                                    className="text-[12px] text-[#2997ff] hover:underline cursor-pointer font-medium shrink-0 ml-[4px]"
                                >
                                    {expandedDecisions[log.id] ? '[접기]' : '[펼쳐보기]'}
                                </button>
                            </div>
                            <div className="w-[100px] text-right shrink-0">
                                <span className={`text-[13px] ${log.statusColor} font-bold`}>{log.status}</span>
                            </div>
                        </div>

                        {/* Expanded Box */}
                        {expandedDecisions[log.id] && (
                            <div className="w-full flex mt-[14px]">
                                <div 
                                    className="bg-[#1c1c1e] border border-[#333] rounded-[12px] p-[16px] flex-1"
                                    style={{ marginLeft: '220px', marginRight: '0px' }}
                                >
                                    {/* Stakeholder Pill (Floated Right) */}
                                    {log.sh_name && (
                                        <div className="float-right ml-[16px] mb-[12px] flex flex-col items-end gap-[4px]">
                                            <span className="text-[11px] font-bold text-[#86868B] pr-[14px]">이해관계자</span>
                                            <div className="bg-[#2a2a2c] border border-[#444] rounded-full pl-[8px] pr-[12px] py-[4px] flex items-center gap-[6px]">
                                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#A1A1AA" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                                                <span className="text-[12px] font-medium text-[#E5E5E5]">
                                                    {log.sh_name}
                                                </span>
                                            </div>
                                        </div>
                                    )}
                                    
                                    <div className="whitespace-pre-wrap break-words text-[14px] text-[#E5E5E5] leading-relaxed">
                                        {renderLogTextWithMentions(log.raw_text)}
                                    </div>
                                    <div className="clear-both"></div>
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* Delete Confirmation Modal */}
            {logToDelete && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60">
                    <div className="bg-[#222] border border-[#333] rounded-[16px] w-[320px] p-[24px] shadow-2xl flex flex-col items-center">
                        <div className="w-[48px] h-[48px] rounded-full bg-white/10 flex items-center justify-center mb-[16px]">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"></path><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                        </div>
                        <h3 className="text-[16px] font-bold text-white mb-[8px]">해당 업무를 삭제하시겠습니까?</h3>
                        <p className="text-[13px] text-[#86868B] text-center mb-[24px]">이 작업은 되돌릴 수 없습니다.</p>
                        <div className="flex items-center gap-[12px] w-full">
                            <button 
                                type="button"
                                onClick={() => setLogToDelete(null)}
                                className="flex-1 py-[10px] rounded-[8px] bg-[#333] hover:bg-[#444] text-white text-[13px] font-medium transition-colors"
                                disabled={isDeleting}
                            >
                                취소
                            </button>
                            <button 
                                type="button"
                                onClick={() => handleDelete(logToDelete.log_id)}
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