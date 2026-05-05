import React, { useState, useEffect } from 'react';
import { supabase } from '../../utils/supabaseClient';

export default function DecisionLog() {
    const [logs, setLogs] = useState([]);
    const [expandedLogs, setExpandedLogs] = useState({});
    const [logsViewMode, setLogsViewMode] = useState('full');
    const [currentPage, setCurrentPage] = useState(1);
    const [logSearchQuery, setLogSearchQuery] = useState('');

    const formatDateYYMMDD = (dateString) => {
        if (!dateString) return '';
        const d = new Date(dateString);
        const yy = String(d.getFullYear()).slice(2);
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        return `${yy}.${mm}.${dd}`;
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

    const fetchLogs = async () => {
        try {
            const { data, error } = await supabase
                .from('iota_seoul_logs')
                .select('*, iota_seoul_log_stakeholders(sh_name)')
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
    }, []);

    const toggleExpand = (id) => {
        setExpandedLogs(prev => ({
            ...prev,
            [id]: !prev[id]
        }));
    };

    const itemsPerPage = logsViewMode === 'summary' ? 5 : 20;
    
    // Filter by search query
    const searchFilteredLogs = logs.filter(log => {
        if (!logSearchQuery) return true;
        const query = logSearchQuery.toLowerCase();
        const rawMatch = (log.raw_text || '').toLowerCase().includes(query);
        const nameMatch = (log.writer_name || '').toLowerCase().includes(query);
        const cellMatch = getCellName(log.writer_name).toLowerCase().includes(query);
        const shMatch = (log.iota_seoul_log_stakeholders?.[0]?.sh_name || '').toLowerCase().includes(query);
        return rawMatch || nameMatch || cellMatch || shMatch;
    });

    const totalPages = Math.ceil(searchFilteredLogs.length / itemsPerPage);
    const displayedLogs = searchFilteredLogs.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    return (
        <div className="w-full flex-1 flex flex-col pt-[77px] pb-[60px] max-w-[1200px] mx-auto">
            {/* Header Metadata */}
            <div className="w-full flex justify-between items-end mb-[36px]">
                <div>
                    <h1 className="text-[36px] font-bold text-white tracking-tight leading-none font-['Inter'] mb-[12px]">의사결정 로그</h1>
                    <p className="text-[15px] text-[#86868B]">사업 진행 간의 주요 협의 및 의사결정 이력을 추적합니다.</p>
                </div>
            </div>

            {/* Log Viewer */}
            <div className="flex justify-between items-center mb-[12px]">
                <h2 className="text-[18px] font-bold text-white tracking-tight">활동내역 전체보기</h2>
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
                        <div className="w-[86px] mr-[16px] text-left">
                            <span className="text-[13px] font-bold text-[#86868B]">프로젝트</span>
                        </div>
                        <div className="flex flex-1 min-w-0 translate-x-[-20px]">
                            <div className="w-[80px] shrink-0 translate-x-[14px]">
                                <span className="text-[13px] font-bold text-[#86868B]">기능셀</span>
                            </div>
                            <div className="w-[110px] shrink-0 translate-x-[4px]">
                                <span className="text-[13px] font-bold text-[#86868B]">등록자</span>
                            </div>
                            <div className="flex-1 min-w-0 translate-x-[-4px]">
                                <span className="text-[13px] font-bold text-[#86868B]">내용</span>
                            </div>
                        </div>
                    </div>
                    {/* Right Section */}
                    <div className="flex gap-[12px] shrink-0 ml-[12px] justify-end">
                        <div className="w-[120px] mr-[4px] text-right">
                            <span className="text-[13px] font-bold text-[#86868B]">이해관계자</span>
                        </div>
                        <div className="w-[60px] text-right">
                            <span className="text-[13px] font-bold text-[#86868B]">등록 목적</span>
                        </div>
                        <div className="w-[60px] text-center">
                            <span className="text-[13px] font-bold text-[#86868B]">진행상태</span>
                        </div>
                        <div className="w-[40px] text-center">
                            <span className="text-[13px] font-bold text-[#86868B]">중요도</span>
                        </div>
                        <div className="w-[60px] text-center">
                            <span className="text-[13px] font-bold text-[#86868B]">등록일</span>
                        </div>
                    </div>
                </div>
                {displayedLogs.map((log, index) => (
                    <div key={log.log_id} className={`relative w-full px-[20px] py-[16px] flex ${expandedLogs[log.log_id] ? 'items-start' : 'items-center'} group transition-colors hover:bg-white/5 last:rounded-b-[24px] ${index !== displayedLogs.length - 1 ? 'border-b border-[#333]' : ''}`}>
                        {/* Left Section */}
                        <div className={`flex ${expandedLogs[log.log_id] ? 'items-start' : 'items-center'} flex-1 min-w-0`}>
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
                                
                                let textColorClass = 'text-[#E5E5E5]'; // IOTA 427 (Lightest)
                                if (projName === 'IOTA 816') textColorClass = 'text-[#A1A1AA]'; // IOTA 816 (Medium)
                                else if (projName === '421 Fund') textColorClass = 'text-[#737373]'; // 421 Fund (Darkest)
                                
                                return (
                                    <div className={`py-[6px] bg-[#222] border border-[#333] rounded-[8px] text-[12px] font-bold ${textColorClass} shrink-0 mr-[16px] w-[86px] text-center`}>
                                        {projName}
                                    </div>
                                );
                            })()}

                            <div className={`flex ${expandedLogs[log.log_id] ? 'items-start pt-[2px]' : 'items-center'} flex-1 min-w-0 translate-x-[-20px]`}>
                                {/* Cell Name */}
                                <div className={`w-[80px] shrink-0 translate-x-[14px] ${expandedLogs[log.log_id] ? 'pt-[4px]' : ''}`}>
                                    <span className="text-[13px] font-medium text-[#86868B]">{getCellName(log.writer_name)}</span>
                                </div>

                                {/* Avatar & Name */}
                                <div className="flex items-center gap-[8px] w-[110px] shrink-0 translate-x-[4px]">
                                    <div className="w-[28px] h-[28px] rounded-full bg-[#333] overflow-hidden">
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
                                <div className={`flex-1 min-w-0 pr-0 flex ${expandedLogs[log.log_id] ? 'items-start' : 'items-center'} gap-[8px] translate-x-[-4px]`}>
                                    <div className={`flex-1 min-w-0 text-[14px] text-[#E5E5E5] transition-all duration-300 ${expandedLogs[log.log_id] ? 'leading-relaxed' : 'truncate'}`}>
                                        {log.raw_text}
                                    </div>
                                    {log.raw_text && log.raw_text.length > 40 && (
                                        <button 
                                            type="button"
                                            onClick={(e) => { e.stopPropagation(); toggleExpand(log.log_id); }}
                                            className={`text-[12px] text-[#2997ff] hover:underline cursor-pointer font-medium shrink-0 ${expandedLogs[log.log_id] ? 'pt-[2px]' : ''}`}
                                        >
                                            {expandedLogs[log.log_id] ? '[접기]' : '[펼쳐보기]'}
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Right Section */}
                        <div className={`flex ${expandedLogs[log.log_id] ? 'items-start pt-[4px]' : 'items-center'} gap-[12px] shrink-0 ml-[12px] justify-end`}>
                            {/* Stakeholder Info */}
                            <div className={`shrink-0 flex justify-end w-[120px] mr-[4px]`}>
                                {log.iota_seoul_log_stakeholders?.[0]?.sh_name && (
                                    <span className={`text-[13px] text-[#A1A1AA] text-right ${expandedLogs[log.log_id] ? 'break-words whitespace-pre-wrap' : 'truncate'}`} title={log.iota_seoul_log_stakeholders[0].sh_name}>
                                        {log.iota_seoul_log_stakeholders[0].sh_name}
                                    </span>
                                )}
                            </div>
                            <div className="h-[24px] flex items-center w-[60px] justify-end"><span className="text-[13px] text-[#A1A1AA] truncate">{log.metadata?.triage_type || '공유'}</span></div>
                            <div className="h-[24px] flex items-center w-[60px] justify-center"><span className="text-[13px] text-[#E5E5E5]">{log.metadata?.issue_status || '진행중'}</span></div>
                            <div className="h-[24px] flex items-center w-[40px] justify-center">
                                <span className={`text-[13px] font-bold ${log.metadata?.priority === '높음' ? 'text-[#FF453A]' : (log.metadata?.priority === '낮음' ? 'text-[#86868B]' : 'text-[#3b82f6]')}`}>
                                    {log.metadata?.priority || '중간'}
                                </span>
                            </div>
                            <div className="h-[24px] flex items-center w-[60px] justify-center"><span className="text-[13px] text-[#86868B] font-['Inter']">{formatDateYYMMDD(log.work_date)}</span></div>
                        </div>
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
        </div>
    );
}
