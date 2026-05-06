import React, { useState, useEffect } from 'react';
import { supabase } from '../../../utils/supabaseClient';
import { useAuth } from '../../../context/AuthContext';

export default function WorkspacePm() {
    const { memberInfo } = useAuth();
    
    // Form States
    const [projectId, setProjectId] = useState('IOTA_COMMON');
    const [triageType, setTriageType] = useState('공유');
    const [issueStatus, setIssueStatus] = useState('검토중');
    const [priority, setPriority] = useState('중간');
    const [stakeholderCat, setStakeholderCat] = useState('');
    const [workDate, setWorkDate] = useState(new Date().toISOString().slice(0, 10));
    const [content, setContent] = useState('');
    const [stakeholderName, setStakeholderName] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    // Logs State
    const [logs, setLogs] = useState([]);
    const [logsViewMode, setLogsViewMode] = useState('summary');
    const [currentPage, setCurrentPage] = useState(1);
    const [expandedLogs, setExpandedLogs] = useState({});
    const [logSearchQuery, setLogSearchQuery] = useState('');
    const [masterStakeholders, setMasterStakeholders] = useState([]);
    const [companyQuery, setCompanyQuery] = useState('');
    const [contactQuery, setContactQuery] = useState('');
    const [showCompanyDropdown, setShowCompanyDropdown] = useState(false);
    const [showContactDropdown, setShowContactDropdown] = useState(false);
    
    // Delete states
    const [logToDelete, setLogToDelete] = useState(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [showNewStakeholderModal, setShowNewStakeholderModal] = useState(false);
    const [showCompanyWarningModal, setShowCompanyWarningModal] = useState(false);
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    
    // Mention states
    const [showMentionDropdown, setShowMentionDropdown] = useState(false);
    const [mentionQuery, setMentionQuery] = useState('');
    const [mentionCursorIndex, setMentionCursorIndex] = useState(0);
    const [mentionPosition, setMentionPosition] = useState({ top: 0, left: 0 });
    const [mentionedNames, setMentionedNames] = useState([]);

    const formatDisplayDate = (dateString) => {
        if (!dateString) return '';
        const d = new Date(dateString);
        const days = ['일', '월', '화', '수', '목', '금', '토'];
        return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 (${days[d.getDay()]})`;
    };

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

    const handleSubmit = async (e) => {
        if (e && e.preventDefault) e.preventDefault();
        if (!content.trim()) return;

        if (!companyQuery && contactQuery) {
            setShowCompanyWarningModal(true);
            return;
        }

        if (companyQuery || contactQuery) {
            const existing = masterStakeholders.find(s => 
                (companyQuery ? s.company_name === companyQuery : true) && 
                (contactQuery ? s.contact_name === contactQuery : true)
            );
            if (!existing) {
                setShowNewStakeholderModal(true);
                return;
            }
        }
        await processSubmit();
    };

    const mentionCandidates = Array.from(new Set(masterStakeholders.map(s => s.contact_name).filter(Boolean)));
    const filteredMentions = mentionCandidates.filter(name => name.toLowerCase().includes(mentionQuery.toLowerCase())).slice(0, 5);

    const getCaretCoordinates = (element, position) => {
        const div = document.createElement('div');
        const style = window.getComputedStyle(element);
        for (const prop of style) {
            div.style[prop] = style[prop];
        }
        div.style.position = 'absolute';
        div.style.visibility = 'hidden';
        div.style.whiteSpace = 'pre-wrap';
        div.style.wordWrap = 'break-word';
        div.textContent = element.value.substring(0, position);
        const span = document.createElement('span');
        span.textContent = element.value.substring(position) || '.';
        div.appendChild(span);
        document.body.appendChild(div);
        const coordinates = {
            top: span.offsetTop - element.scrollTop,
            left: span.offsetLeft
        };
        document.body.removeChild(div);
        return coordinates;
    };

    const handleContentChange = (e) => {
        const text = e.target.value;
        setContent(text);

        const cursorPosition = e.target.selectionStart;
        const textBeforeCursor = text.slice(0, cursorPosition);
        
        // Match '@' followed by non-whitespace characters up to the cursor
        const mentionMatch = textBeforeCursor.match(/@([^\s@]*)$/);

        if (mentionMatch) {
            setShowMentionDropdown(true);
            setMentionQuery(mentionMatch[1]);
            setMentionCursorIndex(mentionMatch.index);
            
            const coords = getCaretCoordinates(e.target, cursorPosition);
            setMentionPosition({ 
                top: coords.top + 20 + 24, // 20px wrapper padding + 24px line height offset
                left: coords.left + 20     // 20px wrapper padding
            });
        } else {
            setShowMentionDropdown(false);
        }
    };

    const handleMentionSelect = (name) => {
        const textBeforeMention = content.slice(0, mentionCursorIndex);
        const textAfterCursor = content.slice(mentionCursorIndex + mentionQuery.length + 1);
        
        const newText = textBeforeMention + `${name} ` + textAfterCursor;
        setContent(newText);
        setShowMentionDropdown(false);
        
        if (!mentionedNames.includes(name)) {
            setMentionedNames(prev => [...prev, name]);
        }
        
        setTimeout(() => {
            const textarea = document.getElementById('pm-textarea');
            if (textarea) {
                textarea.focus();
                const newPos = mentionCursorIndex + name.length + 1;
                textarea.setSelectionRange(newPos, newPos);
            }
        }, 0);
    };

    const renderHighlightedText = () => {
        if (!content) {
            return <span className="text-[#555]">진행 이력, 협업 요청, 리스크 판단 필요사항, 의사결정 필요항목을 입력하세요. (@를 입력하여 담당자를 멘션할 수 있습니다)</span>;
        }

        if (mentionedNames.length === 0) {
            return <span className="text-[#E5E5E5]">{content}{content.endsWith('\n') ? <br/> : null}</span>;
        }

        const escapedNames = mentionedNames.map(n => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
        const regex = new RegExp(`(${escapedNames.join('|')})`, 'g');
        const parts = content.split(regex);

        return (
            <>
                {parts.map((part, i) => {
                    if (mentionedNames.includes(part)) {
                        return <span key={i} className="text-[#82afb9] font-bold">{part}</span>;
                    }
                    return <span key={i} className="text-[#E5E5E5]">{part}</span>;
                })}
                {content.endsWith('\n') ? <br /> : null}
            </>
        );
    };

    const registerMasterStakeholder = async () => {
        setIsSubmitting(true);
        try {
            // Add a 10-second timeout to prevent UI freezing on network issues
            const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 10000));
            const insertPromise = supabase.from('iota_stakeholder_master').insert({
                company_name: companyQuery,
                contact_name: contactQuery || null,
                role_category: stakeholderCat || null
            });

            // Use Promise.race to race the insert against the timeout
            const result = await Promise.race([insertPromise, timeoutPromise]);
            const masterError = result.error;

            if (masterError && masterError.code !== '23505') {
                console.error('Master insert error:', masterError);
                alert('이해관계자 등록 중 오류가 발생했습니다.');
            } else {
                await fetchMasterStakeholders();
                setShowNewStakeholderModal(false);
            }
        } catch (err) {
            console.error('Master insert exception:', err);
            alert('데이터베이스 연결 지연이 발생했습니다. 새로고침 후 다시 시도해주세요.');
            setShowNewStakeholderModal(false);
        } finally {
            setIsSubmitting(false);
        }
    };

    const processSubmit = async () => {
        setIsSubmitting(true);
        setShowNewStakeholderModal(false);

        try {
            const logId = `iota_issue_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
            const writerId = memberInfo?.email || 'unknown';
            const writerName = memberInfo?.staff_name || '익명';

            // 1. Insert into iota_seoul_logs
            const { error: logError } = await supabase.from('iota_seoul_logs').insert({
                log_id: logId,
                writer_staff_id: writerId,
                writer_name: writerName,
                work_date: workDate,
                raw_text: content,
                summary: content.slice(0, 160),
                input_status: 'submitted',
                source_system: 'workspace_pm_form',
                metadata: {
                    workspace_code: 'WS_PM',
                    workspace_label: '사업 PM',
                    project_name: projectId === 'IOTA_COMMON' ? 'IOTA 공통' : projectId === 'P00030' ? 'IOTA 427' : projectId === 'P00037' ? 'IOTA 816' : '421 Fund',
                    triage_type: triageType,
                    issue_status: issueStatus,
                    priority: priority
                }
            });
            if (logError) throw logError;

            // 2. Insert into iota_seoul_log_links
            const { error: linkError } = await supabase.from('iota_seoul_log_links').insert({
                link_id: `link_${logId}`,
                log_id: logId,
                proj_id: projectId,
                relation_type: 'direct_input'
            });
            if (linkError) throw linkError;

            // 3. Update master DB if new
            if (companyQuery) {
                const existing = masterStakeholders.find(s => s.company_name === companyQuery && (s.contact_name || '') === (contactQuery || ''));
                if (!existing) {
                    const { error: masterError } = await supabase.from('iota_stakeholder_master').insert({
                        company_name: companyQuery,
                        contact_name: contactQuery || null,
                        role_category: stakeholderCat || null
                    });
                    if (masterError && masterError.code !== '23505') {
                        console.error('Master insert error:', masterError);
                    } else {
                        fetchMasterStakeholders(); // refresh immediately
                    }
                }
            }

            // 4. Insert into iota_seoul_log_stakeholders
            if (stakeholderCat || companyQuery || contactQuery) {
                const combinedName = [companyQuery, contactQuery].filter(Boolean).join(' - ');
                const { error: shError } = await supabase.from('iota_seoul_log_stakeholders').insert({
                    sh_id: `sh_${logId}`,
                    log_id: logId,
                    sh_name: combinedName || null,
                    role_category: stakeholderCat
                });
                if (shError) throw shError;
            }

            // Success, reset form
            setContent('');
            setCompanyQuery('');
            setContactQuery('');
            fetchLogs();
            setShowSuccessModal(true);
            setTimeout(() => {
                setShowSuccessModal(false);
            }, 2000);
        } catch (error) {
            console.error('Error saving log:', error);
            alert('저장 중 오류가 발생했습니다.');
        } finally {
            setIsSubmitting(false);
        }
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

    const logsPerPage = logsViewMode === 'summary' ? 5 : 20;
    const filteredLogs = logs.filter(log => {
        const cell = getCellName(log.writer_name);
        const isAllowedCell = cell === '사업PM' || cell === '기획추진' || cell === '전략자문';
        if (!isAllowedCell) return false;

        const query = (logSearchQuery || '').toLowerCase();
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

    const uniqueCompanies = [...new Set(masterStakeholders.map(s => s.company_name).filter(Boolean))];
    const filteredCompanies = uniqueCompanies.filter(c => c.toLowerCase().includes(companyQuery.toLowerCase()));
    
    let availableContacts = [];
    if (companyQuery) {
        availableContacts = [...new Set(masterStakeholders.filter(s => s.company_name === companyQuery).map(s => s.contact_name).filter(Boolean))];
    } else {
        availableContacts = [...new Set(masterStakeholders.map(s => s.contact_name).filter(Boolean))];
    }
    const filteredContacts = availableContacts.filter(c => c.toLowerCase().includes(contactQuery.toLowerCase()));

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
            <div className="w-full rounded-[24px] p-[1px] bg-gradient-to-br from-[#d6efe9] via-[#82afb9] to-[#4c6e86] mb-[40px]">
                <div className="w-full h-full bg-[#262626] rounded-[23px] overflow-hidden">
                    {/* Header */}
                    <div className="w-full px-[20px] py-[10px] border-b border-[#333] flex items-center gap-[12px]">
                        <div className="relative w-[40px] h-[40px] shrink-0 rounded-full bg-[#3c3c3c] flex items-center justify-center overflow-hidden border border-white/10">
                            <img src={`${import.meta.env.BASE_URL}${memberInfo?.staff_name || 'default'}.webp`} alt="User" className="w-full h-full object-cover" onError={(e) => { e.target.src = `${import.meta.env.BASE_URL}default_avatar.svg`; }} />
                        </div>

                        <select value={projectId} onChange={(e) => setProjectId(e.target.value)} className="bg-transparent border border-[#333] rounded-[16px] px-[16px] py-[8px] ml-[-2px] text-white font-semibold text-[14px] outline-none cursor-pointer appearance-none pr-[32px] relative" style={{ backgroundImage: iconChevronGray, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center' }}>
                            <option value="IOTA_COMMON">IOTA 공통</option>
                            <option value="P00030">IOTA 427</option>
                            <option value="P00037">IOTA 816</option>
                            <option value="112614">421 Fund</option>
                        </select>

                        <div className="w-px h-[14px] bg-[#333] mx-[2px]"></div>

                        <label className="relative flex items-center gap-[8px] cursor-pointer group">
                            <span className="text-[#86868B] text-[14px] font-medium shrink-0 group-hover:text-white transition-colors">활용목적</span>
                            <div className="inline-flex items-center text-[#E5E5E5] text-[14px] pr-[16px] group-hover:text-white transition-colors" style={{ backgroundImage: iconChevronDark, backgroundRepeat: 'no-repeat', backgroundPosition: 'right center' }}>
                                {triageType}
                            </div>
                            <select value={triageType} onChange={(e) => setTriageType(e.target.value)} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer appearance-none">
                                <option value="공유">공유</option>
                                <option value="협업">협업</option>
                                <option value="리스크 판단">리스크 판단</option>
                                <option value="의사결정">의사결정</option>
                            </select>
                        </label>

                        <div className="w-px h-[14px] bg-[#333] mx-[2px]"></div>

                        <label className="relative flex items-center gap-[8px] cursor-pointer group">
                            <span className="text-[#86868B] text-[14px] font-medium shrink-0 group-hover:text-white transition-colors">진행상태</span>
                            <div className="inline-flex items-center text-[#E5E5E5] text-[14px] pr-[16px] group-hover:text-white transition-colors" style={{ backgroundImage: iconChevronDark, backgroundRepeat: 'no-repeat', backgroundPosition: 'right center' }}>
                                {issueStatus}
                            </div>
                            <select value={issueStatus} onChange={(e) => setIssueStatus(e.target.value)} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer appearance-none">
                                <option value="신규">신규</option>
                                <option value="검토중">검토중</option>
                                <option value="진행중">진행중</option>
                                <option value="보류">보류</option>
                                <option value="완료">완료</option>
                            </select>
                        </label>

                        <div className="w-px h-[14px] bg-[#333] mx-[2px]"></div>

                        <label className="relative flex items-center gap-[8px] cursor-pointer group">
                            <span className="text-[#86868B] text-[14px] font-medium shrink-0 group-hover:text-white transition-colors">중요도</span>
                            <div className={`inline-flex items-center text-[14px] font-bold pr-[16px] ${priority === '높음' ? 'text-[#FF453A]' : priority === '중간' ? 'text-[#3b82f6]' : 'text-[#34d399]'} group-hover:opacity-80 transition-colors`} style={{ backgroundImage: iconChevronDark, backgroundRepeat: 'no-repeat', backgroundPosition: 'right center' }}>
                                {priority}
                            </div>
                            <select value={priority} onChange={(e) => setPriority(e.target.value)} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer appearance-none">
                                <option value="높음">높음</option>
                                <option value="중간">중간</option>
                                <option value="낮음">낮음</option>
                            </select>
                        </label>

                        <div className="w-px h-[14px] bg-[#333] mx-[2px]"></div>

                        <label className="relative flex items-center gap-[8px] cursor-pointer group">
                            <span className="text-[#86868B] text-[14px] font-medium shrink-0 group-hover:text-white transition-colors">이해관계자 분류</span>
                            <div className="inline-flex items-center text-[#E5E5E5] text-[14px] pr-[16px] group-hover:text-white transition-colors" style={{ backgroundImage: iconChevronDark, backgroundRepeat: 'no-repeat', backgroundPosition: 'right center' }}>
                                {stakeholderCat || '선택 안 함'}
                            </div>
                            <select value={stakeholderCat} onChange={(e) => setStakeholderCat(e.target.value)} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer appearance-none">
                                <option value="">선택 안 함</option>
                                <option value="투자자">투자자</option>
                                <option value="대주">대주</option>
                                <option value="SI">SI</option>
                                <option value="잠재임차자">잠재임차자</option>
                                <option value="운영 파트너">운영 파트너</option>
                                <option value="IGIS 내부인력">IGIS 내부인력</option>
                            </select>
                        </label>

                        <div className="flex-1"></div>

                        {/* Date Picker */}
                        <label 
                            className="relative inline-flex items-center gap-[8px] cursor-pointer group"
                            onClick={(e) => { const input = e.currentTarget.querySelector('input'); if (input && input.showPicker) input.showPicker(); }}
                        >
                            <span className="text-[#E5E5E5] text-[14px] font-medium tracking-wide group-hover:text-white transition-colors">{formatDisplayDate(workDate)}</span>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#A1A1AA" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="group-hover:stroke-white transition-colors pointer-events-none">
                                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                                <line x1="16" y1="2" x2="16" y2="6"></line>
                                <line x1="8" y1="2" x2="8" y2="6"></line>
                                <line x1="3" y1="10" x2="21" y2="10"></line>
                            </svg>
                            <input 
                                type="date" 
                                value={workDate}
                                onChange={(e) => setWorkDate(e.target.value)}
                                onClick={(e) => { if (e.target.showPicker) e.target.showPicker(); }}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                            />
                        </label>
                    </div>

                    {/* Text Area */}
                    <div className="w-full px-[20px] pt-[20px] pb-[24px] relative bg-transparent">
                        
                        {/* Background Div for Highlights */}
                        <div 
                            id="pm-highlight-bg"
                            className="absolute top-[20px] left-[20px] right-[20px] bottom-[24px] pointer-events-none whitespace-pre-wrap break-words text-[15px] leading-relaxed overflow-hidden font-sans"
                            aria-hidden="true"
                        >
                            {renderHighlightedText()}
                        </div>

                        {/* Actual Textarea */}
                        <textarea
                            id="pm-textarea"
                            value={content}
                            onChange={handleContentChange}
                            onScroll={(e) => {
                                const bg = document.getElementById('pm-highlight-bg');
                                if (bg) bg.scrollTop = e.target.scrollTop;
                            }}
                            className="w-full bg-transparent text-transparent caret-white outline-none resize-y min-h-[140px] leading-relaxed text-[15px] relative z-10 font-sans"
                            style={{ caretColor: '#E5E5E5' }}
                            required
                        ></textarea>
                        
                        {/* Mention Dropdown */}
                        {showMentionDropdown && filteredMentions.length > 0 && (
                            <div 
                                className="absolute bg-[#222] border border-[#333] rounded-[8px] py-[6px] w-[180px] max-h-[150px] overflow-y-auto z-50 shadow-xl"
                                style={{ top: `${mentionPosition.top}px`, left: `${mentionPosition.left}px` }}
                            >
                                {filteredMentions.map((name, i) => (
                                    <div 
                                        key={i} 
                                        className="px-[12px] py-[8px] text-[13px] text-[#E5E5E5] hover:bg-[#333] cursor-pointer truncate"
                                        onClick={() => handleMentionSelect(name)}
                                    >
                                        <span className="text-[#86868B] mr-2">@</span>{name}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="w-full pl-[20px] pr-[12px] py-[10px] border-t border-[#333] flex justify-between items-center">
                        <div className="flex items-center gap-[12px] flex-1">
                            <span className="text-[#86868B] text-[14px] font-medium shrink-0">이해관계자</span>
                            
                            {/* Company Search Box */}
                            <div className="relative">
                                <div className="absolute inset-y-0 left-[10px] flex items-center pointer-events-none">
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#86868B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                                </div>
                                <input 
                                    type="text"
                                    value={companyQuery}
                                    onChange={(e) => { setCompanyQuery(e.target.value); setShowCompanyDropdown(true); }}
                                    onFocus={() => setShowCompanyDropdown(true)}
                                    onBlur={() => setTimeout(() => setShowCompanyDropdown(false), 200)}
                                    onKeyDown={(e) => { 
                                        if (e.nativeEvent.isComposing) return;
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            if (!companyQuery && contactQuery) {
                                                setShowCompanyWarningModal(true);
                                                return;
                                            }
                                            const existing = masterStakeholders.find(s => s.company_name === companyQuery && (contactQuery ? s.contact_name === contactQuery : true));
                                            if (!existing && companyQuery) setShowNewStakeholderModal(true);
                                        }
                                    }}
                                    placeholder="회사명 검색/입력"
                                    className="bg-[#222] border border-[#333] hover:border-[#444] rounded-[8px] pl-[28px] pr-[12px] py-[6px] text-[13px] text-white w-[160px] focus:outline-none focus:border-[#2997ff] transition-all"
                                />
                                {showCompanyDropdown && filteredCompanies.length > 0 && (
                                    <div className="absolute bottom-[40px] left-[0] bg-[#222] border border-[#333] rounded-[8px] py-[6px] w-[200px] max-h-[200px] overflow-y-auto z-50 shadow-xl">
                                        {filteredCompanies.map((name, i) => (
                                            <div 
                                                key={i} 
                                                className="px-[12px] py-[8px] text-[13px] text-[#E5E5E5] hover:bg-[#333] cursor-pointer truncate"
                                                onClick={() => {
                                                    setCompanyQuery(name);
                                                    setShowCompanyDropdown(false);
                                                    setContactQuery('');
                                                }}
                                            >
                                                {name}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Contact Search Box */}
                            <div className="relative">
                                <input 
                                    type="text"
                                    value={contactQuery}
                                    onChange={(e) => { setContactQuery(e.target.value); setShowContactDropdown(true); }}
                                    onFocus={() => setShowContactDropdown(true)}
                                    onBlur={() => setTimeout(() => setShowContactDropdown(false), 200)}
                                    onKeyDown={(e) => { 
                                        if (e.nativeEvent.isComposing) return;
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            if (!companyQuery) {
                                                setShowCompanyWarningModal(true);
                                                return;
                                            }
                                            const existing = masterStakeholders.find(s => (companyQuery ? s.company_name === companyQuery : true) && s.contact_name === contactQuery);
                                            if (!existing && contactQuery) setShowNewStakeholderModal(true);
                                        }
                                    }}
                                    placeholder="담당자명 검색/입력"
                                    className="bg-[#222] border border-[#333] hover:border-[#444] rounded-[8px] px-[12px] py-[6px] text-[13px] text-white w-[160px] focus:outline-none focus:border-[#2997ff] transition-all"
                                />
                                {showContactDropdown && filteredContacts.length > 0 && (
                                    <div className="absolute bottom-[40px] left-[0] bg-[#222] border border-[#333] rounded-[8px] py-[6px] w-[200px] max-h-[200px] overflow-y-auto z-50 shadow-xl">
                                        {filteredContacts.map((name, i) => (
                                            <div 
                                                key={i} 
                                                className="px-[12px] py-[8px] text-[13px] text-[#E5E5E5] hover:bg-[#333] cursor-pointer truncate"
                                                onClick={() => {
                                                    setContactQuery(name);
                                                    setShowContactDropdown(false);
                                                    if (!companyQuery) {
                                                        const found = masterStakeholders.find(s => s.contact_name === name);
                                                        if (found && found.company_name) {
                                                            setCompanyQuery(found.company_name);
                                                        }
                                                    }
                                                }}
                                            >
                                                {name}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                        <button 
                            type="button"
                            onClick={handleSubmit}
                            disabled={isSubmitting}
                            className={`px-[32px] py-[10px] rounded-[10px] border border-[#444] text-[#E5E5E5] font-bold text-[13px] transition-all duration-200 ${isSubmitting ? 'opacity-50 cursor-not-allowed' : 'hover:bg-[#333] hover:border-[#555] cursor-pointer'}`}
                        >
                            {isSubmitting ? '저장 중...' : '작성하기'}
                        </button>
                    </div>
                </div>
            </div>

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
                {displayedLogs.map((log, index) => (
                    <div key={log.log_id} className={`relative w-full px-[20px] py-[16px] flex flex-col group transition-colors hover:bg-white/5 first:rounded-t-[24px] last:rounded-b-[24px] ${index !== displayedLogs.length - 1 ? 'border-b border-[#333]' : ''}`}>
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
                                    
                                    let textColorClass = 'text-[#E5E5E5]'; // IOTA 427 (Lightest)
                                    if (projName === 'IOTA 816') textColorClass = 'text-[#A1A1AA]'; // IOTA 816 (Medium)
                                    else if (projName === '421 Fund') textColorClass = 'text-[#737373]'; // 421 Fund (Darkest)
                                    
                                    return (
                                        <div className={`py-[6px] bg-[#222] border border-[#333] rounded-[8px] text-[12px] font-bold ${textColorClass} shrink-0 mr-[16px] w-[86px] text-center`}>
                                            {projName}
                                        </div>
                                    );
                                })()}

                                <div className="flex items-center flex-1 min-w-0 translate-x-[-20px]">
                                    {/* Cell Name */}
                                    <div className="w-[80px] shrink-0 translate-x-[14px]">
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
                                    <div className="flex-1 min-w-0 pr-0 flex items-center gap-[8px] translate-x-[-4px]">
                                        <div className="flex-1 min-w-0 text-[14px] text-[#E5E5E5] truncate">
                                            {log.raw_text}
                                        </div>
                                        {log.raw_text && log.raw_text.length > 40 && (
                                            <button 
                                                type="button"
                                                onClick={(e) => { e.stopPropagation(); toggleExpand(log.log_id); }}
                                                className="text-[12px] text-[#2997ff] hover:underline cursor-pointer font-medium shrink-0 ml-[4px]"
                                            >
                                                {expandedLogs[log.log_id] ? '[접기]' : '[펼쳐보기]'}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Right Section */}
                            <div className="flex items-center gap-[12px] shrink-0 ml-[12px] justify-end">
                                <span className="text-[13px] text-[#A1A1AA] w-[60px] text-right truncate shrink-0">{log.metadata?.triage_type || '공유'}</span>
                                <span className="text-[13px] text-[#E5E5E5] w-[60px] text-center shrink-0">{log.metadata?.issue_status || '진행중'}</span>
                                <span className={`text-[13px] font-bold w-[40px] text-center shrink-0 ${log.metadata?.priority === '높음' ? 'text-[#FF453A]' : (log.metadata?.priority === '낮음' ? 'text-[#86868B]' : 'text-[#3b82f6]')}`}>
                                    {log.metadata?.priority || '중간'}
                                </span>
                                <span className="text-[13px] text-[#86868B] w-[60px] text-right font-['Inter'] shrink-0">{formatDateYYMMDD(log.work_date)}</span>
                                
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
                                            <span className="text-[11px] font-bold text-[#86868B] pr-[4px]">이해관계자</span>
                                            <div className="bg-[#2a2a2c] border border-[#444] rounded-full pl-[8px] pr-[12px] py-[4px] flex items-center gap-[6px]">
                                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#A1A1AA" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                                                <span className="text-[12px] font-medium text-[#E5E5E5]">
                                                    {log.iota_seoul_log_stakeholders[0].sh_name}
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
                <div className="bg-[#292928] border border-[#3c3c3c] rounded-[16px] p-[20px] flex items-center hover:border-[#555] transition-colors">
                    <div className="w-[120px]"><span className="text-[13px] text-[#86868B] font-medium">2026-04-10</span></div>
                    <div className="w-[100px]"><span className="text-[12px] px-2 py-0.5 bg-[#222] border border-[#333] text-[#A1A1AA] rounded">Iota 1</span></div>
                    <div className="flex-1 px-4 border-l border-[#333]">
                        <span className="text-[15px] font-bold text-white">Foster+Partners 설계 Alt B 채택 (UW 내)</span>
                    </div>
                    <div className="w-[120px] text-right">
                        <span className="text-[13px] text-[#666]">결정: <span className="text-[#E5E5E5] hover:text-[#fbf167] cursor-pointer transition-colors hover:underline underline-offset-4 decoration-[#fbf167]/50">강순용</span></span>
                    </div>
                    <div className="w-[100px] text-right">
                        <span className="text-[13px] text-[#34d399] font-bold">Approved</span>
                    </div>
                </div>
                <div className="bg-[#292928] border border-[#3c3c3c] rounded-[16px] p-[20px] flex items-center hover:border-[#555] transition-colors">
                    <div className="w-[120px]"><span className="text-[13px] text-[#86868B] font-medium">2026-04-01</span></div>
                    <div className="w-[100px]"><span className="text-[12px] px-2 py-0.5 bg-[#222] border border-[#333] text-[#A1A1AA] rounded">Iota 2</span></div>
                    <div className="flex-1 px-4 border-l border-[#333]">
                        <span className="text-[15px] font-bold text-white">삼성물산 도급 변경분 정산안 합의</span>
                    </div>
                    <div className="w-[120px] text-right">
                        <span className="text-[13px] text-[#666]">결정: <span className="text-[#E5E5E5] hover:text-[#fbf167] cursor-pointer transition-colors hover:underline underline-offset-4 decoration-[#fbf167]/50">강순용</span></span>
                    </div>
                    <div className="w-[100px] text-right">
                        <span className="text-[13px] text-[#fbf167] font-bold">In Review</span>
                    </div>
                </div>
            </div>

            {/* New Stakeholder Confirmation Modal */}
            {showNewStakeholderModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60">
                    <div className="bg-[#222] border border-[#333] rounded-[16px] w-[360px] p-[24px] shadow-2xl flex flex-col items-center">
                        <div className="w-[48px] h-[48px] rounded-full bg-white/10 flex items-center justify-center mb-[16px]">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="8.5" cy="7" r="4"></circle><line x1="20" y1="8" x2="20" y2="14"></line><line x1="23" y1="11" x2="17" y2="11"></line></svg>
                        </div>
                        <h3 className="text-[16px] font-bold text-white mb-[8px]">새로운 이해관계자입니다</h3>
                        <p className="text-[13px] text-[#86868B] text-center mb-[24px]">
                            <strong className="text-[#E5E5E5]">{[companyQuery, contactQuery].filter(Boolean).join(' - ')}</strong> 항목이 기존 마스터 DB에 없습니다.<br/>마스터 DB에 새로운 이해관계자로 등록하시겠습니까?
                        </p>
                        <div className="flex items-center gap-[12px] w-full">
                            <button 
                                type="button"
                                onClick={() => setShowNewStakeholderModal(false)}
                                className="flex-1 py-[10px] rounded-[8px] bg-[#333] hover:bg-[#444] text-white text-[13px] font-medium transition-colors"
                                disabled={isSubmitting}
                            >
                                취소
                            </button>
                            <button 
                                type="button"
                                onClick={() => registerMasterStakeholder()}
                                className="flex-1 py-[10px] rounded-[8px] bg-[#2997ff] hover:bg-[#007aff] text-white text-[13px] font-bold transition-colors flex justify-center items-center"
                                disabled={isSubmitting}
                            >
                                {isSubmitting ? '등록 중...' : '마스터 DB에 등록'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

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

            {/* Company Warning Modal */}
            {showCompanyWarningModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60">
                    <div className="bg-[#222] border border-[#333] rounded-[16px] w-[320px] p-[24px] shadow-2xl flex flex-col items-center">
                        <div className="w-[48px] h-[48px] rounded-full bg-white/10 flex items-center justify-center mb-[16px]">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#FF453A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                        </div>
                        <h3 className="text-[16px] font-bold text-white mb-[8px]">회사명 입력 필요</h3>
                        <p className="text-[13px] text-[#86868B] text-center mb-[24px]">
                            담당자만 입력되었습니다.<br/>데이터 무결성을 위해 <strong className="text-[#E5E5E5]">회사명</strong>을<br/>먼저 입력하거나 선택해 주세요.
                        </p>
                        <div className="flex items-center justify-center w-full">
                            <button 
                                type="button"
                                onClick={() => setShowCompanyWarningModal(false)}
                                className="w-full py-[10px] rounded-[8px] bg-[#333] hover:bg-[#444] text-white text-[13px] font-bold transition-colors"
                            >
                                확인
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Success Modal */}
            {showSuccessModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60">
                    <div className="bg-[#222] border border-[#333] rounded-[16px] w-[320px] p-[24px] shadow-2xl flex flex-col items-center">
                        <div className="w-[48px] h-[48px] rounded-full bg-white/10 flex items-center justify-center mb-[16px]">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                        </div>
                        <h3 className="text-[16px] font-bold text-white mb-[8px]">등록 완료</h3>
                        <p className="text-[13px] text-[#86868B] text-center mb-[24px]">성공적으로 저장되었습니다.</p>
                        <div className="flex items-center justify-center w-full">
                            <button 
                                type="button"
                                onClick={() => setShowSuccessModal(false)}
                                className="w-full py-[10px] rounded-[8px] bg-[#34d399] hover:bg-[#10b981] text-black text-[13px] font-bold transition-colors"
                            >
                                확인
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}