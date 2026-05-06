import React, { useState, useEffect } from 'react';
import { supabase } from '../../../utils/supabaseClient';
import { useAuth } from '../../../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import LogWriteBox from '../LogWriteBox';

export default function WorkspaceActivityLog({ workspaceCode, workspaceLabel }) {
    const { memberInfo } = useAuth();
    
    // Logs State
    const [logs, setLogs] = useState([]);
    const [logsViewMode, setLogsViewMode] = useState('summary');
    const [currentPage, setCurrentPage] = useState(1);
    const [expandedLogs, setExpandedLogs] = useState({});
    const [logSearchQuery, setLogSearchQuery] = useState('');
    const [masterStakeholders, setMasterStakeholders] = useState([]);
    
    // Delete states
    const [logToDelete, setLogToDelete] = useState(null);
    const [isDeleting, setIsDeleting] = useState(false);
    
    // Filter states
    const [filterStakeholder, setFilterStakeholder] = useState('');
    const [filterCell, setFilterCell] = useState(() => {
        if (workspaceLabel === '사업 PM') return '사업PM';
        return workspaceLabel || '';
    });
    const [filterPurpose, setFilterPurpose] = useState('');
    const [filterStatus, setFilterStatus] = useState('');
    const [filterPriority, setFilterPriority] = useState('');
    
    // Edit states
    const [editingLogId, setEditingLogId] = useState(null);
    const [editingContent, setEditingContent] = useState('');
    const [isSavingEdit, setIsSavingEdit] = useState(false);

    // Comment states
    const [commentingLogId, setCommentingLogId] = useState(null);
    const [commentContent, setCommentContent] = useState('');
    const [isSavingComment, setIsSavingComment] = useState(false);

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

    const handleSaveComment = async (logId) => {
        if (!commentContent.trim()) return;
        setIsSavingComment(true);
        try {
            const log = logs.find(l => l.log_id === logId);
            const metadata = log.metadata || {};
            const comments = metadata.comments || [];
            
            const newComment = {
                id: Date.now().toString(),
                author: memberInfo?.staff_name || memberInfo?.name || '익명',
                author_email: memberInfo?.email || 'unknown',
                text: commentContent,
                created_at: new Date().toISOString()
            };
            
            const updatedMetadata = { ...metadata, comments: [...comments, newComment] };
            
            const { error } = await supabase
                .from('iota_seoul_logs')
                .update({ metadata: updatedMetadata })
                .eq('log_id', logId);
                
            if (error) throw error;
            
            setLogs(prev => prev.map(l => l.log_id === logId ? { ...l, metadata: updatedMetadata } : l));
            setCommentingLogId(null);
            setCommentContent('');
        } catch (e) {
            console.error('Error saving comment:', e);
            alert('댓글 저장 중 오류가 발생했습니다.');
        } finally {
            setIsSavingComment(false);
        }
    };

    const handleDeleteComment = async (logId, commentId) => {
        if (!confirm('댓글을 삭제하시겠습니까?')) return;
        try {
            const log = logs.find(l => l.log_id === logId);
            const metadata = log.metadata || {};
            const comments = (metadata.comments || []).filter(c => c.id !== commentId);
            
            const updatedMetadata = { ...metadata, comments };
            
            const { error } = await supabase
                .from('iota_seoul_logs')
                .update({ metadata: updatedMetadata })
                .eq('log_id', logId);
                
            if (error) throw error;
            
            setLogs(prev => prev.map(l => l.log_id === logId ? { ...l, metadata: updatedMetadata } : l));
        } catch (e) {
            console.error('Error deleting comment:', e);
            alert('댓글 삭제 중 오류가 발생했습니다.');
        }
    };

    const getCellName = (name) => {
        const cells = {
            '전기영': '기획추진', '이시정': '기획추진', '이관용': '기획추진',
            '이철승': 'CFT 총괄', '윤관식': 'CFT 총괄', '정조민': 'CFT 총괄', '우형석': 'CFT 총괄',
            '권순일': '사업PM', '강순용': '사업PM', '윤주형': '사업PM', '김제익': '사업PM', '류홍': '사업PM', '박만진': '사업PM', '박일훈': '사업PM', '이정원': '사업PM', '전무경': '사업PM', '한찬호': '사업PM', '박석제': '사업PM', '박채현': '사업PM', '소현준': '사업PM', '이수정': '사업PM', '조영비': '사업PM', '한수정': '사업PM',
            '박준호': '파이낸싱-LFC', '강석민': '파이낸싱-LFC', '정리훈': '파이낸싱-LFC', '손유정': '파이낸싱-LFC', '김지우': '파이낸싱-LFC', '박현승': '파이낸싱-LFC', '이성민A': '파이낸싱-LFC', '한승환': '파이낸싱-LFC',
            '홍장군': '개발솔루션-DSC', '채원': '개발솔루션-DSC', '김보성': '개발솔루션-DSC', '전승희': '개발솔루션-DSC', '김대익': '개발솔루션-DSC', '장성진': '개발솔루션-DSC', '이정훈': '개발솔루션-DSC', '박봉서': '개발솔루션-DSC',
            '김민지': '기업마케팅-EMC', '고아라': '기업마케팅-EMC', '이가현': '기업마케팅-EMC', '정수명': '기업마케팅-EMC',
            '김현수': '상품·디지털-SSC', '현철호': '상품·디지털-SSC', '신민호': '상품·디지털-SSC',
            '김행단': '펀드운용-KAM', '윤용택': 'IPR'
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

    const logsPerPage = logsViewMode === 'summary' ? 5 : 20;
    const filteredLogs = logs.filter(log => {
        const cell = getCellName(log.writer_name);
        
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

    return (
        <div className="w-full flex flex-col mt-0">
            {/* Task Input Form */}
            <LogWriteBox 
                memberInfo={memberInfo}
                masterStakeholders={masterStakeholders}
                fetchLogs={fetchLogs}
                fetchMasterStakeholders={fetchMasterStakeholders}
                workspaceCode={workspaceCode}
                workspaceLabel={workspaceLabel}
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
            <div className="w-full border border-[#3c3c3c] rounded-[24px] mb-[40px] flex flex-col bg-[#252525]">
                {/* Header Row */}
                <div className="w-full px-[20px] py-[12px] flex items-center border-b border-[#3c3c3c] bg-transparent rounded-t-[24px]">
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
                                    {['사업PM', '파이낸싱-LFC', '개발솔루션-DSC', '기업마케팅-EMC', '상품·디지털-SSC', '펀드운용-KAM', 'IPR', '기획추진', 'CFT 총괄'].map(val => (
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
                                className={`bg-white/5 border border-transparent text-[12px] font-bold cursor-pointer appearance-none focus:outline-none w-[76px] hover:text-white hover:bg-white/10 rounded-[8px] px-[2px] py-[4px] transition-colors translate-x-[-26px] ${filterStakeholder ? 'text-[#fbf167]' : 'text-[#A1A1AA]'}`}
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
                    <div key={log.log_id} className={`relative w-full px-[20px] py-[16px] flex flex-col group transition-colors hover:bg-white/5 last:rounded-b-[24px] ${index !== displayedLogs.length - 1 ? 'border-b border-[#3c3c3c]' : ''}`}>
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
                                        <span className="text-[13px] font-medium text-[#86868B]">
                                            {getCellName(log.writer_name).replace(/-(LFC|DSC|EMC|SSC|KAM)$/, '')}
                                        </span>
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
                                        <div 
                                            className="flex-1 min-w-0 text-[14px] text-[#E5E5E5] truncate cursor-pointer hover:text-white transition-colors"
                                            onClick={(e) => { e.stopPropagation(); toggleExpand(log.log_id); }}
                                        >
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
                        <AnimatePresence>
                            {expandedLogs[log.log_id] && (
                                <motion.div 
                                    className="w-full flex overflow-hidden"
                                    initial={{ height: 0, opacity: 0, marginTop: 0 }}
                                    animate={{ height: 'auto', opacity: 1, marginTop: 14 }}
                                    exit={{ height: 0, opacity: 0, marginTop: 0 }}
                                    transition={{ duration: 0.2, ease: "easeInOut" }}
                                >
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
                                    
                                    {/* Original Text */}
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
                                                    className="px-[12px] py-[6px] bg-transparent border border-[#444] rounded-[6px] text-[12px] text-[#A1A1AA] hover:text-[#E5E5E5] transition-colors cursor-pointer"
                                                >
                                                    취소
                                                </button>
                                                <button
                                                    onClick={() => handleSaveEdit(log.log_id)}
                                                    disabled={isSavingEdit}
                                                    className="px-[12px] py-[6px] bg-[#2997ff] hover:bg-[#0071e3] border border-transparent rounded-[6px] text-[12px] text-white font-bold transition-colors disabled:opacity-50 cursor-pointer"
                                                >
                                                    {isSavingEdit ? '저장 중...' : '저장'}
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className={`whitespace-pre-wrap break-words text-[15px] leading-relaxed ${commentingLogId === log.log_id ? 'text-[#86868B] opacity-70' : 'text-[#E5E5E5]'}`}>
                                            {renderLogTextWithMentions(log.raw_text)}
                                        </div>
                                    )}
                                    <div className="clear-both mb-[16px]"></div>
                                    
                                    {/* Comments List */}
                                    {log.metadata?.comments && log.metadata.comments.length > 0 && (
                                        <div className="flex flex-col gap-[8px] mb-[16px] border-t border-[#333] pt-[12px]">
                                            {log.metadata.comments.map(comment => (
                                                <div key={comment.id} className="bg-[#222] rounded-[8px] p-[12px] flex justify-between group">
                                                    <div className="flex-1 min-w-0 pr-[16px]">
                                                        <div className="flex items-center gap-[8px] mb-[4px]">
                                                            <div className="w-[28px] h-[28px] rounded-full bg-[#333] overflow-hidden border border-[#444] shrink-0">
                                                                <img 
                                                                    src={`${import.meta.env.BASE_URL}${comment.author}.webp`} 
                                                                    alt={comment.author} 
                                                                    className="w-full h-full object-cover"
                                                                    onError={(e) => { e.target.src = `${import.meta.env.BASE_URL}default_avatar.svg`; }}
                                                                />
                                                            </div>
                                                            <span className="text-[13px] font-bold text-[#E5E5E5]">{comment.author}</span>
                                                            <span className="text-[11px] text-[#86868B]">
                                                                {new Date(comment.created_at).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                                            </span>
                                                        </div>
                                                        <div className="text-[13px] text-[#A1A1AA] whitespace-pre-wrap break-words ml-[36px]">{comment.text}</div>
                                                    </div>
                                                    {comment.author_email === memberInfo?.email && (
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); handleDeleteComment(log.log_id, comment.id); }}
                                                            className="text-[12px] text-[#FF453A] opacity-0 group-hover:opacity-100 transition-opacity hover:underline cursor-pointer"
                                                        >
                                                            삭제
                                                        </button>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* Commenting Box */}
                                    {commentingLogId === log.log_id && (
                                        <div className="w-full mt-[16px]">
                                            <textarea
                                                value={commentContent}
                                                onChange={(e) => setCommentContent(e.target.value)}
                                                placeholder="댓글을 입력하세요..."
                                                className="w-full bg-[#2a2a2c] border border-[#444] rounded-[8px] p-[12px] text-[14px] text-[#E5E5E5] leading-relaxed resize-y focus:outline-none focus:border-[#2997ff] min-h-[90px]"
                                            />
                                            <div className="flex justify-end gap-[8px] mt-[8px]">
                                                <button
                                                    onClick={() => setCommentingLogId(null)}
                                                    className="px-[12px] py-[6px] bg-transparent border border-[#444] rounded-[6px] text-[12px] text-[#A1A1AA] hover:text-[#E5E5E5] transition-colors cursor-pointer"
                                                >
                                                    취소
                                                </button>
                                                <button
                                                    onClick={() => handleSaveComment(log.log_id)}
                                                    disabled={isSavingComment}
                                                    className="px-[12px] py-[6px] bg-[#2997ff] hover:bg-[#0071e3] border border-transparent rounded-[6px] text-[12px] text-white font-bold transition-colors disabled:opacity-50 cursor-pointer"
                                                >
                                                    {isSavingComment ? '저장 중...' : '등록'}
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                    
                                    <div className="mt-[14px] flex items-end justify-between">
                                        <div className="text-[12px] text-[#555] font-medium">
                                            수정일자: {log.updated_at ? new Date(log.updated_at).toLocaleString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : new Date(log.created_at || log.work_date).toLocaleString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                        </div>
                                        <div className="flex items-center gap-[8px]">
                                            {!editingLogId && (
                                                <button
                                                    type="button"
                                                    onClick={(e) => { 
                                                        e.stopPropagation(); 
                                                        setCommentingLogId(log.log_id);
                                                        setCommentContent('');
                                                        setEditingLogId(null);
                                                    }}
                                                    className="px-[12px] py-[6px] bg-[#222] hover:bg-[#333] border border-[#333] hover:border-[#444] rounded-[6px] text-[12px] text-[#A1A1AA] hover:text-[#E5E5E5] font-medium transition-all flex items-center gap-[6px] cursor-pointer"
                                                >
                                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
                                                    댓글
                                                </button>
                                            )}
                                            {!editingLogId && (memberInfo?.email === log.writer_staff_id || memberInfo?.name === log.writer_name) && (
                                                <button
                                                    type="button"
                                                    onClick={(e) => { 
                                                        e.stopPropagation(); 
                                                        setEditingLogId(log.log_id);
                                                        setEditingContent(log.raw_text);
                                                        setCommentingLogId(null);
                                                    }}
                                                    className="px-[12px] py-[6px] bg-[#222] hover:bg-[#333] border border-[#333] hover:border-[#444] rounded-[6px] text-[12px] text-[#A1A1AA] hover:text-[#E5E5E5] font-medium transition-all cursor-pointer"
                                                >
                                                    수정하기
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
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
