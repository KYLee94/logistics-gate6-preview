import React, { useState, useEffect } from 'react';
import { supabase } from '../../utils/supabaseClient';
import { motion, AnimatePresence } from 'framer-motion';

export default function LogWriteBox({ memberInfo, masterStakeholders, fetchLogs, fetchMasterStakeholders, workspaceCode, workspaceLabel, defaultExpanded = false }) {
    // Form States
    const [projectId, setProjectId] = useState('IOTA_COMMON');
    const [triageType, setTriageType] = useState('공유');
    const [issueStatus, setIssueStatus] = useState('검토중');
    const [priority, setPriority] = useState('중간');
    const [stakeholderCat, setStakeholderCat] = useState('');
    const [workDate, setWorkDate] = useState(new Date().toISOString().slice(0, 10));
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [isExpanded, setIsExpanded] = useState(defaultExpanded);
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    // Stakeholder Search States
    const [companyQuery, setCompanyQuery] = useState('');
    const [contactQuery, setContactQuery] = useState('');
    const [showCompanyDropdown, setShowCompanyDropdown] = useState(false);
    const [showContactDropdown, setShowContactDropdown] = useState(false);
    
    // Modal states
    const [showNewStakeholderModal, setShowNewStakeholderModal] = useState(false);
    const [showCompanyWarningModal, setShowCompanyWarningModal] = useState(false);
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    

    // Mention states
    const [showMentionDropdown, setShowMentionDropdown] = useState(false);
    const [mentionQuery, setMentionQuery] = useState('');
    const [mentionCursorIndex, setMentionCursorIndex] = useState(0);
    const [mentionPosition, setMentionPosition] = useState({ top: 0, left: 0 });
    const [mentionedNames, setMentionedNames] = useState([]);

    // Permission states
    const [visibilityGroups, setVisibilityGroups] = useState([]);
    const [visibilityIndividuals, setVisibilityIndividuals] = useState([]);
    const [showVisibilityModal, setShowVisibilityModal] = useState(false);
    const [showPublicWarningModal, setShowPublicWarningModal] = useState(false);
    const [visibilitySearchQuery, setVisibilitySearchQuery] = useState('');
    const visibilityGroupOptions = ["PO", "Sub-PO", "CFT 책임인력", "기획추진", "사업PM", "파이낸싱-LFC", "개발관리", "기업마케팅", "상품·디지털", "펀드운용", "IPR-WG"];
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

    const formatDisplayDate = (dateString) => {
        if (!dateString) return '';
        const d = new Date(dateString);
        const days = ['일', '월', '화', '수', '목', '금', '토'];
        return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 (${days[d.getDay()]})`;
    };

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
        
        const mentionMatch = textBeforeCursor.match(/@([^\s@]*)$/);

        if (mentionMatch) {
            setShowMentionDropdown(true);
            setMentionQuery(mentionMatch[1]);
            setMentionCursorIndex(mentionMatch.index);
            
            const coords = getCaretCoordinates(e.target, cursorPosition);
            setMentionPosition({ 
                top: coords.top + 20 + 24, 
                left: coords.left + 20     
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
            const textarea = document.getElementById(`log-textarea-${workspaceCode}`);
            if (textarea) {
                textarea.focus();
                const newPos = mentionCursorIndex + name.length + 1;
                textarea.setSelectionRange(newPos, newPos);
            }
        }, 0);
    };

    const renderHighlightedText = () => {
        if (!content) {
            return <span className="text-[#bbb9af]">진행 이력, 협업 요청, 리스크 판단 필요사항, 의사결정 필요항목을 입력하세요. (@를 입력하여 담당자를 멘션할 수 있습니다)</span>;
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
        if (!stakeholderCat) return alert('이해관계자 분류를 선택해주세요.');
        setIsSubmitting(true);
        try {
            const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 10000));
            const insertPromise = supabase.from('iota_stakeholder_master').insert({
                company_name: companyQuery,
                contact_name: contactQuery || null,
                role_category: stakeholderCat || null
            });

            const result = await Promise.race([insertPromise, timeoutPromise]);
            const masterError = result.error;

            if (masterError && masterError.code !== '23505') {
                console.error('Master insert error:', masterError);
                alert('이해관계자 등록 중 오류가 발생했습니다.');
            } else {
                if(fetchMasterStakeholders) await fetchMasterStakeholders();
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
                summary: title,
                input_status: 'submitted',
                source_system: workspaceCode === 'WS_PM' ? 'workspace_pm_form' : 'decision_log_form',
                metadata: {
                    workspace_code: workspaceCode,
                    workspace_label: workspaceLabel,
                    project_name: projectId === 'IOTA_COMMON' ? 'IOTA 공통' : projectId === 'P00030' ? '427 PFV' : projectId === 'P00037' ? '816 PFV' : '421 Fund',
                    triage_type: triageType,
                    issue_status: issueStatus,
                    priority: priority,
                    permissions: {
                        groups: visibilityGroups,
                        individuals: visibilityIndividuals.map(i => i.contact_name)
                    }
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
                        if(fetchMasterStakeholders) fetchMasterStakeholders();
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
            setTitle('');
            setContent('');
            setCompanyQuery('');
            setContactQuery('');
            setVisibilityGroups([]);
            setVisibilityIndividuals([]);
            if(fetchLogs) fetchLogs();
            setShowSuccessModal(true);
            setIsExpanded(false);
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

    const handlePreSubmit = (e) => {
        if (e && e.preventDefault) e.preventDefault();
        if (!title.trim() || !content.trim()) return;
        if (visibilityGroups.length === 0 && visibilityIndividuals.length === 0) {
            setShowPublicWarningModal(true);
        } else {
            handleSubmit(e);
        }
    };

    const handleSubmit = async (e) => {
        if (e && e.preventDefault) e.preventDefault();
        if (!title.trim() || !content.trim()) return;

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

    const getParticle = (word) => {
        if (!word) return '와';
        const lastChar = word.charAt(word.length - 1);
        if (/[a-zA-Z]/.test(lastChar)) {
            const upperChar = lastChar.toUpperCase();
            if (['L', 'M', 'N', 'R'].includes(upperChar)) return '과';
            return '와';
        }
        const code = lastChar.charCodeAt(0);
        if (code >= 0xAC00 && code <= 0xD7A3) {
            return (code - 0xAC00) % 28 > 0 ? '과' : '와';
        }
        return '와';
    };
    

    const getCellName = (name) => {
        if (!masterStakeholders || masterStakeholders.length === 0) return '';
        const stakeholder = masterStakeholders.find(s => s.contact_name === name);
        if (stakeholder && stakeholder.role_category && stakeholder.role_category !== 'IGIS 내부인력') {
            return stakeholder.role_category;
        }
        return '';
    };

    const displayLabel = workspaceLabel ? workspaceLabel.split('-')[0].trim() : '';

    const collapsedText = displayLabel ? `${displayLabel}${getParticle(displayLabel)} 협업 및 논의가 필요한 사항, 또는 공유할 내용을 등록하세요.` : '주요 공유사항, 협업 및 논의가 필요한 내용을 등록하세요.';

    return (
        <div className="w-full rounded-[24px] p-[1px] bg-gradient-to-br from-[#d6efe9] via-[#82afb9] to-[#4c6e86] mb-[11px]">
            <div className="w-full h-full bg-[#262626] rounded-[23px] overflow-hidden">
                {/* Header */}
                <div 
                    className={`w-full px-[20px] py-[10px] border-b border-[#333] flex items-center gap-[12px] ${!isExpanded ? 'cursor-pointer hover:bg-[#2a2a2a] transition-colors' : ''}`}
                    onClick={() => {
                        if (!isExpanded) setIsExpanded(true);
                    }}
                >
                    <div className="relative w-[40px] h-[40px] shrink-0 rounded-full bg-[#3c3c3c] flex items-center justify-center overflow-hidden border border-white/10">
                        <img src={`${import.meta.env.BASE_URL}${memberInfo?.staff_name || 'default'}.webp`} alt="User" className="w-full h-full object-cover" onError={(e) => { e.target.src = `${import.meta.env.BASE_URL}default_avatar.svg`; }} />
                    </div>

                    {!isExpanded ? (
                        <>
                            <div className="pl-[8px]">
                                <span className="text-[#bcdbdb] font-bold text-[16px]">{collapsedText}</span>
                            </div>
                            <div className="rounded-[8px] p-[1px] bg-gradient-to-br from-[#d6efe9] via-[#82afb9] to-[#4c6e86] ml-[14px]">
                                <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); setIsExpanded(true); }}
                                    className="flex items-center px-[12px] py-[6px] rounded-[7px] text-[12px] font-bold cursor-pointer transition-colors bg-[#222] text-[#E5E5E5] hover:bg-[#333]"
                                >
                                    글작성하기
                                </button>
                            </div>
                        </>
                    ) : (
                        <>
                            <select value={projectId} onChange={(e) => setProjectId(e.target.value)} className="bg-transparent border border-[#333] rounded-[16px] px-[16px] py-[8px] ml-[-2px] text-white font-semibold text-[14px] outline-none cursor-pointer appearance-none pr-[32px] relative" style={{ backgroundImage: iconChevronGray, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center' }}>
                        <option value="IOTA_COMMON">IOTA 공통</option>
                        <option value="P00030">427 PFV</option>
                        <option value="P00037">816 PFV</option>
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
                            <option value="SI">SI</option>
                            <option value="잠재임차사">잠재임차사</option>
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
                    <div className="w-px h-[14px] bg-[#333] mx-[4px]"></div>
                            <div className="rounded-[8px] p-[1px] bg-gradient-to-br from-[#d6efe9] via-[#82afb9] to-[#4c6e86]">
                                <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); setIsExpanded(false); }}
                                    className="flex items-center px-[12px] py-[6px] rounded-[7px] text-[12px] font-bold cursor-pointer transition-colors bg-[#222] text-[#E5E5E5] hover:bg-[#333]"
                                >
                                    접기
                                </button>
                            </div>
                        </>
                    )}
                </div>

                
                <AnimatePresence>
                    {isExpanded && (
                        <motion.div
                            initial={false}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2, ease: "easeInOut" }}
                            className="overflow-hidden w-full flex flex-col"
                        >
{/* Text Area */}
                <div className="w-full px-[20px] pt-[20px] pb-[24px] relative bg-transparent">
                    <input
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="제목을 입력하세요"
                        className="w-full bg-transparent text-[#E5E5E5] text-[16px] font-bold outline-none mb-[12px] border-b border-[#333] pb-[12px]"
                        required
                    />
                    
                    {/* Background Div for Highlights */}
                    <div 
                        id={`highlight-bg-${workspaceCode}`}
                        className="absolute top-[20px] left-[20px] right-[20px] bottom-[24px] pointer-events-none whitespace-pre-wrap break-words text-[15px] leading-relaxed overflow-hidden font-sans"
                        aria-hidden="true"
                    >
                        {renderHighlightedText()}
                    </div>

                    {/* Actual Textarea */}
                    <textarea
                        id={`log-textarea-${workspaceCode}`}
                        value={content}
                        onChange={handleContentChange}
                        onScroll={(e) => {
                            const bg = document.getElementById(`highlight-bg-${workspaceCode}`);
                            if (bg) bg.scrollTop = e.target.scrollTop;
                        }}
                        className="w-full bg-transparent text-transparent caret-white outline-none resize-y min-h-[120px] leading-relaxed text-[15px] relative z-10 font-sans"
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
                    {(visibilityGroups.length > 0 || visibilityIndividuals.length > 0) && (
                        <div className="flex items-center mr-2">
                            <span className="text-red-500 font-bold text-[13px]">
                                {visibilityGroups.join(', ')}
                                {visibilityGroups.length > 0 && visibilityIndividuals.length > 0 && ', '}
                                {visibilityIndividuals.map(i => i.contact_name).join(', ')}
                            </span>
                        </div>
                    )}
                    <button 
                        type="button"
                        onClick={() => setShowVisibilityModal(true)}
                        className="px-[16px] py-[10px] rounded-[10px] border border-red-500/50 text-red-500 font-bold text-[13px] hover:bg-red-500/10 hover:border-red-500 hover:text-red-400 transition-colors cursor-pointer mr-2"
                    >
                        열람권한
                    </button>
                    <button 
                        type="button"
                        onClick={handlePreSubmit}
                        disabled={isSubmitting}
                        className={`px-[32px] py-[10px] rounded-[10px] border border-[#444] text-[#E5E5E5] font-bold text-[13px] transition-all duration-200 ${isSubmitting ? 'opacity-50 cursor-not-allowed' : 'hover:bg-[#333] hover:border-[#555] cursor-pointer'}`}
                    >
                        {isSubmitting ? '저장 중...' : '작성하기'}
                    </button>
                </div>
            
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Modals */}

            {/* Permission Modal */}
            {showVisibilityModal && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowVisibilityModal(false)}></div>
                    <div className="relative bg-[#262626] rounded-[24px] border border-[#333] w-full max-w-[500px] overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
                        <div className="p-6 border-b border-[#333] shrink-0">
                            <h3 className="text-[20px] font-bold text-white mb-2">열람 권한 설정</h3>
                            <p className="text-[#86868B] text-[14px]">이 게시물을 볼 수 있는 그룹과 특정 인원을 지정합니다.</p>
                        </div>
                        
                        <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
                            <div className="mb-6">
                                <h4 className="text-[14px] font-bold text-[#A1A1AA] mb-3">1. 그룹 선택 (다중 선택 가능)</h4>
                                <div className="flex flex-wrap gap-2">
                                    {visibilityGroupOptions.map(opt => {
                                        const isSelected = visibilityGroups.includes(opt);
                                        return (
                                            <button 
                                                key={opt}
                                                type="button"
                                                onClick={() => {
                                                    if (isSelected) setVisibilityGroups(visibilityGroups.filter(g => g !== opt));
                                                    else setVisibilityGroups([...visibilityGroups, opt]);
                                                }}
                                                className={`px-4 py-2 rounded-[10px] text-[13px] font-bold transition-colors cursor-pointer ${isSelected ? 'bg-[#2997ff] text-white border border-[#2997ff]' : 'bg-[#1a1a1a] text-[#86868B] border border-[#444] hover:border-[#666]'}`}
                                            >
                                                {opt}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                            
                            <div className="mb-4">
                                <h4 className="text-[14px] font-bold text-[#A1A1AA] mb-3">2. 특정 인원 추가</h4>
                                <input 
                                    type="text" 
                                    placeholder="이름을 검색하세요" 
                                    value={visibilitySearchQuery}
                                    onChange={(e) => setVisibilitySearchQuery(e.target.value)}
                                    className="w-full bg-[#1A1A1A] border border-[#444] rounded-[10px] px-4 py-2.5 text-white text-[14px] outline-none focus:border-[#888]"
                                />
                                {visibilitySearchQuery && (
                                    <div className="mt-2 bg-[#1A1A1A] border border-[#444] rounded-[10px] overflow-hidden max-h-[150px] overflow-y-auto">
                                        {Array.from(new Set(masterStakeholders.map(s => s.contact_name).filter(Boolean)))
                                            .filter(n => n.toLowerCase().includes(visibilitySearchQuery.toLowerCase()))
                                            .map(name => {
                                                const stakeholder = masterStakeholders.find(s => s.contact_name === name);
                                                const isAdded = visibilityIndividuals.some(i => i.contact_name === name);
                                                return (
                                                    <div 
                                                        key={name}
                                                        onClick={() => {
                                                            if (!isAdded) {
                                                                setVisibilityIndividuals([...visibilityIndividuals, stakeholder]);
                                                            }
                                                            setVisibilitySearchQuery('');
                                                        }}
                                                        className="px-4 py-2 hover:bg-[#333] cursor-pointer flex items-center justify-between transition-colors text-[13px]"
                                                    >
                                                        <span className="text-white">{name} {getCellName(name) ? `(${getCellName(name)})` : (stakeholder?.role_category ? `(${stakeholder.role_category})` : '')}</span>
                                                        {isAdded && <span className="text-[#34d399] text-[12px]">추가됨</span>}
                                                    </div>
                                                );
                                            })}
                                    </div>
                                )}
                            </div>

                            {visibilityIndividuals.length > 0 && (
                                <div className="flex flex-wrap gap-2 mb-2">
                                    {visibilityIndividuals.map(ind => (
                                        <div key={ind.contact_name} className="flex items-center gap-1 bg-[#1A1A1A] border border-[#444] rounded-[6px] px-3 py-1 text-[13px] text-white">
                                            <span>{ind.contact_name}</span>
                                            <button 
                                                onClick={() => setVisibilityIndividuals(visibilityIndividuals.filter(i => i.contact_name !== ind.contact_name))}
                                                className="text-[#666] hover:text-[#ff453a] ml-1 cursor-pointer"
                                            >×</button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="p-6 border-t border-[#333] bg-[#222] shrink-0">
                            <div className="bg-[#1A1A1A] border border-[#444] rounded-[10px] p-4 mb-4">
                                <p className="text-[#e2aa29] text-[13px] font-bold">
                                    {visibilityGroups.length === 0 && visibilityIndividuals.length === 0 ? 
                                        "이 게시물은 전체 공개로 모든 인원이 열람할 수 있습니다." : 
                                        `이 게시물은 ${[...visibilityGroups, ...visibilityIndividuals.map(i => i.contact_name)].join(', ')}만 열람할 수 있습니다.`}
                                </p>
                            </div>
                            <button 
                                onClick={() => setShowVisibilityModal(false)}
                                className="w-full py-[12px] bg-[#2997ff] text-white font-bold rounded-[12px] text-[15px] hover:bg-[#0071e3] transition-colors cursor-pointer"
                            >
                                확인
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Public Warning Modal */}
            {showPublicWarningModal && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowPublicWarningModal(false)}></div>
                    <div className="relative bg-[#262626] rounded-[24px] border border-[#333] w-full max-w-[400px] overflow-hidden shadow-2xl">
                        <div className="p-6 text-center">
                            <div className="w-[48px] h-[48px] bg-[#3c3c3c] rounded-full flex items-center justify-center mx-auto mb-4">
                                <span className="text-[24px]">👀</span>
                            </div>
                            <h3 className="text-[18px] font-bold text-white mb-2">전체 공개 게시물</h3>
                            <p className="text-[#86868B] text-[14px] leading-relaxed mb-6">
                                열람 권한이 설정되지 않았습니다.<br/>
                                이 게시물은 시스템의 모든 인원이<br/>열람할 수 있는 <strong className="text-[#34d399]">전체 공개글</strong>로 게시됩니다.
                            </p>
                            <div className="flex gap-3">
                                <button 
                                    onClick={() => setShowPublicWarningModal(false)}
                                    className="flex-1 py-[12px] bg-[#3c3c3c]/50 text-[#86868B] font-bold rounded-[12px] text-[14px] border border-[#444] hover:bg-[#3c3c3c] hover:text-white transition-colors cursor-pointer"
                                >
                                    취소
                                </button>
                                <button 
                                    onClick={(e) => {
                                        setShowPublicWarningModal(false);
                                        handleSubmit(e);
                                    }}
                                    className="flex-1 py-[12px] bg-[#2997ff] text-white font-bold rounded-[12px] text-[14px] hover:bg-[#0071e3] transition-colors cursor-pointer"
                                >
                                    네, 작성할게요
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {showNewStakeholderModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60">
                    <div className="bg-[#222] border border-[#333] rounded-[16px] w-[320px] p-[24px] shadow-2xl flex flex-col items-center">
                        <div className="w-[48px] h-[48px] rounded-full bg-white/10 flex items-center justify-center mb-[16px]">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2997ff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="16"></line><line x1="8" y1="12" x2="16" y2="12"></line></svg>
                        </div>
                        <h3 className="text-[16px] font-bold text-white mb-[8px]">신규 이해관계자 등록</h3>
                        <p className="text-[13px] text-[#86868B] text-center mb-[20px]">입력하신 정보가 마스터 데이터에 없습니다.<br/>신규 등록 후 로그를 저장하시겠습니까?</p>
                        
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
                            <button onClick={registerMasterStakeholder} disabled={isSubmitting} className="flex-1 py-[10px] rounded-[8px] bg-[#2997ff] hover:bg-[#0071e3] text-white text-[13px] font-bold transition-colors">{isSubmitting ? '등록 중...' : '등록 후 저장'}</button>
                        </div>
                    </div>
                </div>
            )}

            {showCompanyWarningModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60">
                    <div className="bg-[#222] border border-[#333] rounded-[16px] w-[320px] p-[24px] shadow-2xl flex flex-col items-center">
                        <div className="w-[48px] h-[48px] rounded-full bg-white/10 flex items-center justify-center mb-[16px]">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#FF453A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                        </div>
                        <h3 className="text-[16px] font-bold text-white mb-[8px]">회사명 입력 필요</h3>
                        <p className="text-[13px] text-[#86868B] text-center mb-[24px]">담당자만 입력되었습니다.<br/>데이터 무결성을 위해 <strong className="text-[#E5E5E5]">회사명</strong>을<br/>먼저 입력하거나 선택해 주세요.</p>
                        <div className="flex items-center justify-center w-full">
                            <button onClick={() => setShowCompanyWarningModal(false)} className="w-full py-[10px] rounded-[8px] bg-[#333] hover:bg-[#444] text-white text-[13px] font-bold transition-colors">확인</button>
                        </div>
                    </div>
                </div>
            )}

            {showSuccessModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60">
                    <div className="bg-[#222] border border-[#333] rounded-[16px] w-[320px] p-[24px] shadow-2xl flex flex-col items-center">
                        <div className="w-[48px] h-[48px] rounded-full bg-white/10 flex items-center justify-center mb-[16px]">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                        </div>
                        <h3 className="text-[16px] font-bold text-white mb-[8px]">등록 완료</h3>
                        <p className="text-[13px] text-[#86868B] text-center mb-[24px]">성공적으로 저장되었습니다.</p>
                        <div className="flex items-center justify-center w-full">
                            <button onClick={() => setShowSuccessModal(false)} className="w-full py-[10px] rounded-[8px] bg-[#34d399] hover:bg-[#10b981] text-black text-[13px] font-bold transition-colors">확인</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
