import React, { useState, useEffect } from 'react';
import { supabase } from '../../utils/supabaseClient';
import { useAuth } from '../../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';

const WORKSPACE_CONFIG = [
    { id: 'pm', name: '사업 PM', path: 'platform/iotaseoul/workspace/pm', table: 'iota_pm_tasks', color: 'bg-[#ff9f0a]' },
    { id: 'financing', name: '파이낸싱', path: 'platform/iotaseoul/workspace/financing', table: 'iota_financing_tasks', color: 'bg-[#30d158]' },
    { id: 'development', name: '개발솔루션', path: 'platform/iotaseoul/workspace/development', table: 'iota_development_tasks', color: 'bg-[#0a84ff]' },
    { id: 'marketing', name: '기업마케팅', path: 'platform/iotaseoul/workspace/marketing', table: 'iota_marketing_tasks', color: 'bg-[#64d2ff]' },
    { id: 'digital', name: '상품·디지털', path: 'platform/iotaseoul/workspace/digital', table: 'iota_digital_tasks', color: 'bg-[#ffd60a]' },
    { id: 'fund', name: '펀드운용', path: 'platform/iotaseoul/workspace/fund', table: 'iota_fund_tasks', color: 'bg-[#bf5af2]' },
    { id: 'ipr', name: 'IPR', path: 'platform/iotaseoul/workspace/ipr', table: 'iota_ipr_tasks', color: 'bg-[#ff453a]' }
];

export default function DecisionLog() {
    const { memberInfo } = useAuth();
    const [logs, setLogs] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [expandedLogs, setExpandedLogs] = useState({});
    const [logsViewMode, setLogsViewMode] = useState('full');
    const [currentPage, setCurrentPage] = useState(1);
    const [logSearchQuery, setLogSearchQuery] = useState('');
    
    // Focus Tasks states
    const [focusTasks, setFocusTasks] = useState({});
    const [isLoadingFocus, setIsLoadingFocus] = useState(true);
    const [activeWorkspaceTab, setActiveWorkspaceTab] = useState('pm');
    const [expandedFocusTaskId, setExpandedFocusTaskId] = useState(null);
    
    // Header Filter states
    const [filterStakeholder, setFilterStakeholder] = useState('');
    const [filterCell, setFilterCell] = useState('');
    const [filterPurpose, setFilterPurpose] = useState('');
    const [filterStatus, setFilterStatus] = useState('');
    const [filterPriority, setFilterPriority] = useState('');

    // Delete states
    const [logToDelete, setLogToDelete] = useState(null);
    const [commentToDelete, setCommentToDelete] = useState(null); // { logId, commentId }
    const [isDeleting, setIsDeleting] = useState(false);
    const [showMeetingsInfo, setShowMeetingsInfo] = useState(false);
    const [showMyLogsOnly, setShowMyLogsOnly] = useState(false);
    const [masterStakeholders, setMasterStakeholders] = useState([]);
    const [showAllCrossFunctional, setShowAllCrossFunctional] = useState(false);
    const [activeCadenceTab, setActiveCadenceTab] = useState('internal');
    const [expandedCadenceRow, setExpandedCadenceRow] = useState(null);

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

    const internalMeetings = [
        { meeting: 'Iota 임원 보고회', period: '월 1회 (3주차)', leader: '부문대표(이철승)', attendees: '부대표진·CFT 총괄·셀 리드 5인', output: '월간 사업보고서, T1 의사결정 사안 통과' },
        { meeting: 'CFT 운영위', period: '격주 (수)', leader: 'CFT 총괄(부문대표 겸직)', attendees: 'PM·5개 셀 리드·KAM 1파트', output: 'UW 범위 외 의사결정, 변경관리 승인' },
        { meeting: '주간 PM Stand-up', period: '주 1회 (월)', leader: 'PM(강순용)', attendees: '5개 셀 실무 책임자', output: '주간 진척, Top10 리스크, 7일 액션' },
        { meeting: 'LP 정기보고 미팅', period: '분기 1회', leader: 'KAM 1파트(김행단)', attendees: 'PM·LFC·운용지원·외부 LP', output: '분기보고서, Q&A 로그' },
        { meeting: '대주단 보고', period: '월/분기', leader: 'LFC(박준호)', attendees: 'PM·KAM·외부 대주단', output: 'Covenants 모니터링 보드, 차주 통지' },
        { meeting: 'IPR WG', period: '격주 (목)', leader: '프리츠 TFT (권순일)', attendees: 'CFT 총괄·PM·외부자문(법무·회계·감정)', output: 'Forward Purchase 구조설계서, 약정 초안' },
        { meeting: '분기 회고(Retro)', period: '분기 말', leader: 'CFT 총괄', attendees: '전 셀 리드·실무 핵심 인력', output: 'KPI/OKR 리뷰, 원인분석, 차분기 OKR' }
    ];

    const externalMeetings = [
        { meeting: '이오타 1 (현대건설)', period: '격주 (수)', leader: '부문대표(이철승)', attendees: '현대건설 및 금융주관사들', output: '' },
        { meeting: '이오타 2 (삼성물산)', period: '격주 (수)', leader: '부문대표(이철승)', attendees: '삼성물산 및 금융주관사들', output: '' },
        { meeting: '통합PF (NH투자증권)', period: '격주 (수)', leader: '부문대표(이철승)', attendees: 'NH투자증권', output: '' }
    ];

    const triggers = [
        { condition: 'UW 범위 외 일정/예산 변경이 식별된 경우', action: 'CFT 운영위 임시 소집' },
        { condition: '대주단 Covenants 위반 가능성 식별', action: 'LFC 주재 긴급 라운드' },
        { condition: '핵심 임차인 협상 결렬 또는 LOI 철회', action: 'EMC 주재 임시 LM 회의' },
        { condition: '규제·인허가·소송 이슈 발생', action: 'CFT 총괄 직속 비상 회의' },
        { condition: 'LP 임시 출자·임시 분배 요청', action: 'KAM 1파트 주재 펀드 회의' }
    ];

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
            '박준호': '파이낸싱-LFC', '강석민': '파이낸싱-LFC', '정리훈': '파이낸싱-LFC', '손유정': '파이낸싱-LFC', '김지우': '파이낸싱-LFC', '박현승': '파이낸싱-LFC', '이성민A': '파이낸싱-LFC', '한승환': '파이낸싱-LFC',
            '홍장군': '개발솔루션-DSC', '채원': '개발솔루션-DSC', '김보성': '개발솔루션-DSC', '전승희': '개발솔루션-DSC', '김대익': '개발솔루션-DSC', '장성진': '개발솔루션-DSC', '이정훈': '개발솔루션-DSC', '박봉서': '개발솔루션-DSC', '김형주': '개발솔루션-DSC',
            '김민지': '기업마케팅-EMC', '고아라': '기업마케팅-EMC',
            '김현수': '상품·디지털-SSC', '현철호': '상품·디지털-SSC', '신민호': '상품·디지털-SSC', '이가현': '상품·디지털-SSC', '정수명': '상품·디지털-SSC',
            '김행단': '펀드운용-KAM', '윤용택': 'IPR'
        };
        return cells[name] || '기타';
    };

    const getLogCell = (log) => {
        if (log.metadata?.workspace_label) {
            const lbl = log.metadata.workspace_label;
            if (lbl.includes('사업 PM') || lbl.includes('사업PM')) return '사업PM';
            if (lbl.includes('파이낸싱')) return '파이낸싱-LFC';
            if (lbl.includes('개발솔루션')) return '개발솔루션-DSC';
            if (lbl.includes('기업마케팅')) return '기업마케팅-EMC';
            if (lbl.includes('상품·디지털') || lbl.includes('상품/디지털')) return '상품·디지털-SSC';
            if (lbl.includes('펀드운용')) return '펀드운용-KAM';
            if (lbl.includes('IPR')) return 'IPR';
        }
        return getCellName(log.writer_name);
    };

    const fetchMasterStakeholders = async () => {
        try {
            const { data, error } = await supabase.from('iota_stakeholder_master').select('*');
            if (!error && data) {
                setMasterStakeholders(data);
            }
        } catch (e) {
            console.error(e);
        }
    };

    const fetchLogs = async () => {
        setIsLoading(true);
        try {
            const { data, error } = await supabase
                .from('iota_seoul_logs')
                .select('*, iota_seoul_log_stakeholders(sh_name, role_category)')
                .order('work_date', { ascending: false })
                .order('created_at', { ascending: false });
            
            if (error) throw error;
            
            const validLogs = (data || []).filter(log => getCellName(log.writer_name) !== '기타');
            setLogs(validLogs);
        } catch (e) {
            console.error('Error fetching logs:', e);
        } finally {
            setIsLoading(false);
        }
    };

    const hasRestrictedPermissions = (log) => {
        const perms = log.metadata?.permissions;
        if (!perms) return false;
        return (perms.groups && perms.groups.length > 0) || (perms.individuals && perms.individuals.length > 0);
    };

    const getPermissionString = (log) => {
        const perms = log.metadata?.permissions;
        if (!perms) return '';
        const parts = [];
        if (perms.groups && perms.groups.length > 0) parts.push(...perms.groups);
        if (perms.individuals && perms.individuals.length > 0) parts.push(...perms.individuals);
        return parts.join(', ');
    };

    const getShortPermissionString = (log) => {
        const perms = log.metadata?.permissions;
        if (!perms) return '';
        const parts = [];
        if (perms.groups && perms.groups.length > 0) parts.push(...perms.groups);
        if (perms.individuals && perms.individuals.length > 0) parts.push(...perms.individuals);
        
        if (parts.length === 0) return '';
        if (parts.length === 1) return parts[0];
        return `${parts[0]} 외 ${parts.length - 1}`;
    };

    const checkUserAccess = (log) => {
        const perms = log.metadata?.permissions;
        if (!perms) return true;
        
        const hasGroups = perms.groups && perms.groups.length > 0;
        const hasIndivs = perms.individuals && perms.individuals.length > 0;
        
        if (!hasGroups && !hasIndivs) return true;

        const myEmail = memberInfo?.email;
        const myName = memberInfo?.staff_name || memberInfo?.name;
        const isAuthor = log.writer_staff_id === myEmail || log.writer_name === myName;
        
        if (isAuthor) return true;
        
        if (hasIndivs && perms.individuals.includes(myName)) return true;
        
        if (hasGroups) {
            const myStakeholderRecords = masterStakeholders.filter(s => s.contact_name === myName);
            const myRoles = myStakeholderRecords.map(s => s.role_category).filter(Boolean);
            
            for (const group of perms.groups) {
                if (group === "각 워크스페이스" && myStakeholderRecords.length > 0) return true;
                if (myRoles.includes(group)) return true;
                
                if (group === "PO" && myName === "이철승") return true;
                if (group === "Sub-PO" && ["윤관식", "정조민", "우형석"].includes(myName)) return true;
            }
        }
        
        return false;
    };

    useEffect(() => {
        const fetchFocusTasks = async () => {
            setIsLoadingFocus(true);
            try {
                const results = {};
                const priorityWeight = { '높음': 3, '중간': 2, '낮음': 1 };
                
                await Promise.all(WORKSPACE_CONFIG.map(async (ws) => {
                    const { data, error } = await supabase
                        .from(ws.table)
                        .select('*')
                        .order('created_at', { ascending: false })
                        .limit(20);
                        
                    if (!error && data) {
                        const isCoreAsset = (asset) => {
                            if (!asset || typeof asset !== 'string') return false;
                            const lower = asset.toLowerCase();
                            return lower.includes('iota') || lower.includes('이오타') || lower.includes('427') || lower.includes('816') || lower.includes('421') || lower.includes('공통');
                        };
                        const filteredData = data.filter(t => isCoreAsset(t.related_asset)).slice(0, 3);
                        results[ws.id] = filteredData;
                    } else {
                        results[ws.id] = [];
                    }
                }));
                
                setFocusTasks(results);
            } catch (err) {
                console.error("Error fetching focus tasks:", err);
            } finally {
                setIsLoadingFocus(false);
            }
        };

        fetchFocusTasks();
        fetchLogs();
        fetchMasterStakeholders();
        
        const handleRefetch = () => {
            fetchLogs();
            fetchMasterStakeholders();
        };
        window.addEventListener('refetch-data', handleRefetch);
        
        return () => window.removeEventListener('refetch-data', handleRefetch);
    }, []);

    const toggleExpand = (id) => {
        setExpandedLogs(prev => ({
            ...prev,
            [id]: !prev[id]
        }));
    };

    const handleDeleteClick = (log) => {
        setLogToDelete(log);
    };

    const confirmDelete = async () => {
        if (!logToDelete) return;
        setIsDeleting(true);
        try {
            const { error: stakeholdersError } = await supabase
                .from('iota_seoul_log_stakeholders')
                .delete()
                .eq('log_id', logToDelete.log_id);

            if (stakeholdersError) {
                console.error('Error deleting stakeholders:', stakeholdersError);
                throw stakeholdersError;
            }

            const { error } = await supabase
                .from('iota_seoul_logs')
                .delete()
                .eq('log_id', logToDelete.log_id);

            if (error) throw error;
            
            setLogs(logs.filter(l => l.log_id !== logToDelete.log_id));
            setLogToDelete(null);
        } catch (err) {
            console.error('Delete error:', err);
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
        } catch (e) {
            console.error('Error saving edit:', e);
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
        setIsDeleting(true);
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
        } finally {
            setIsDeleting(false);
            setCommentToDelete(null);
        }
    };

    const itemsPerPage = logsViewMode === 'summary' ? 5 : 15;
    
    // Filter by search query and dropdowns
    const searchFilteredLogs = logs.filter(log => {
        if (showMyLogsOnly && log.writer_staff_id !== memberInfo?.email) return false;
        if (filterStakeholder && log.iota_seoul_log_stakeholders?.[0]?.role_category !== filterStakeholder) return false;
        if (filterCell && getLogCell(log) !== filterCell) return false;
        if (filterPurpose && (log.metadata?.triage_type || '공유') !== filterPurpose) return false;
        if (filterStatus && (log.metadata?.issue_status || '진행중') !== filterStatus) return false;
        if (filterPriority && (log.metadata?.priority || '중간') !== filterPriority) return false;

        if (!logSearchQuery) return true;
        const query = logSearchQuery.toLowerCase();
        const rawMatch = (log.raw_text || '').toLowerCase().includes(query);
        const nameMatch = (log.writer_name || '').toLowerCase().includes(query);
        const cellMatch = getLogCell(log).toLowerCase().includes(query);
        const shMatch = (log.iota_seoul_log_stakeholders?.[0]?.sh_name || '').toLowerCase().includes(query);
        return rawMatch || nameMatch || cellMatch || shMatch;
    });

    const totalPages = Math.ceil(searchFilteredLogs.length / itemsPerPage);
    const displayedLogs = searchFilteredLogs.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);


    const workspaces = [
        { id: 'ws1', label: '사업 PM', cell: '사업PM', icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg> },
        { id: 'ws2', label: '파이낸싱-LFC', cell: '파이낸싱-LFC', icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> },
        { id: 'ws3', label: '개발솔루션-DSC', cell: '개발솔루션-DSC', icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><circle cx="12" cy="12" r="3" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" /></svg> },
        { id: 'ws4', label: '기업마케팅-EMC', cell: '기업마케팅-EMC', icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" /></svg> },
        { id: 'ws5', label: '상품·디지털-SSC', cell: '상품·디지털-SSC', icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg> },
        { id: 'ws6', label: '펀드운용-KAM', cell: '펀드운용-KAM', icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg> },
        { id: 'ws7', label: 'IPR-WG', cell: 'IPR', icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg> },
        { id: 'ws8', label: '기획추진', cell: '기획추진', icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" strokeWidth="1.5"></circle><circle cx="12" cy="12" r="6" strokeWidth="1.5"></circle><circle cx="12" cy="12" r="2" strokeWidth="1.5"></circle></svg> }
    ];

    const activeStatus = ['신규', '검토중', '진행중'];
    const activeLogs = logs.filter(l => activeStatus.includes(l.metadata?.issue_status || '진행중'));
    const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
    
    // Group active logs by cell
    const issuesByWorkspace = workspaces.map(ws => {
        const cellLogs = activeLogs.filter(l => getLogCell(l) === ws.cell);
        const totalCount = cellLogs.length;
        const recentLogs = cellLogs.filter(l => new Date(l.work_date || l.created_at) >= twoWeeksAgo);
        const recentCount = recentLogs.length;
        const wsLogs = recentLogs.slice(0, 3);
        
        return { ...ws, logs: wsLogs, recentCount, totalCount };
    });

    const today = new Date();
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    const formattedDate = `${today.getFullYear()}년 ${today.getMonth() + 1}월 ${today.getDate()}일 (${days[today.getDay()]})`;

    const CELL_REPRESENTATIVES = {
        '사업PM': '권순일/강순용',
        '기업마케팅': '김민지'
    };

    const crossFunctionalLogs = logs.filter(log => {
        const logDate = new Date(log.work_date || log.created_at);
        if (logDate < twoWeeksAgo) return false;
        if (!log.metadata?.workspace_label) return false; // Only workspace logs

        const writerCell = getCellName(log.writer_name);
        const targetCell = getLogCell(log);
        
        const normWriter = writerCell.replace(/-(LFC|DSC|EMC|SSC|KAM)$/, '');
        const normTarget = targetCell.replace(/-(LFC|DSC|EMC|SSC|KAM)$/, '');

        if (normWriter === '기타') return false;

        return normWriter !== normTarget;
    });

    return (
        <div className="w-full flex-1 flex flex-col pt-[50px] pb-[60px] max-w-[1200px] mx-auto">
            {/* Header Metadata */}
            <div className="w-full flex justify-between items-start mb-[32px]">
                <div>
                    <h1 className="text-[36px] font-bold text-white tracking-tight leading-none font-['Inter'] mb-[8px]">전체 업무 현황</h1>
                    <p className="text-[16px] text-[#86868B] leading-[26px]">IOTA CFT의 전체 업무 현황을 한 화면에서 모아 봅니다.</p>
                </div>
                <div className="text-[15px] font-bold text-[#86868B] tracking-tight bg-[#222] px-[16px] py-[8px] rounded-full shrink-0 flex items-center shadow-sm">
                    {formattedDate}
                </div>
            </div>

            {/* This Week's Focus */}
            <div className="w-full mb-[44px]">
                {/* Header with Title and Nav Links */}
                <div className="flex items-center gap-[16px] mb-[10px]">
                    <h2 className="text-[20px] font-bold text-white tracking-tight shrink-0">이번주 포커스</h2>
                    <div className="flex items-center gap-[8px] overflow-x-auto scrollbar-hide">
                        {WORKSPACE_CONFIG.map(ws => (
                            <button
                                key={ws.id}
                                onClick={() => {
                                    setActiveWorkspaceTab(ws.id);
                                    const container = document.getElementById('focus-scroll-container');
                                    const card = document.getElementById(`focus-card-${ws.id}`);
                                    if (container && card) {
                                        container.scrollTo({ left: card.offsetLeft - container.offsetLeft, behavior: 'smooth' });
                                    }
                                }}
                                className={`px-[12px] py-[6px] rounded-full text-[13px] font-bold whitespace-nowrap transition-colors ${
                                    activeWorkspaceTab === ws.id
                                        ? 'text-white border-[1px] border-transparent [background:linear-gradient(#1F1F1E,#1F1F1E)_padding-box,linear-gradient(to_bottom_right,#d6efe9,#82afb9,#4c6e86)_border-box]'
                                        : 'bg-transparent border border-[#333] text-[#86868B] hover:text-white hover:border-[#555]'
                                }`}
                            >
                                {ws.name}
                            </button>
                        ))}
                    </div>
                </div>

                {isLoadingFocus ? (
                    <div className="w-full h-[300px] flex items-center justify-center border border-[#333] rounded-[24px]">
                        <span className="text-[#86868B] text-[15px]">데이터를 불러오는 중입니다...</span>
                    </div>
                ) : (
                    <div className="-ml-[7px] -mr-[calc(50vw-50%)] p-[6px] border-y border-l border-[#333] rounded-l-[30px]">
                        <div 
                            id="focus-scroll-container" 
                            className="w-full flex gap-[6px] overflow-x-auto snap-x pr-[40px] custom-thin-scrollbar rounded-l-[24px]"
                            onScroll={(e) => {
                                const container = e.target;
                                const scrollLeft = container.scrollLeft;
                                let activeId = WORKSPACE_CONFIG[0].id;
                                let minDiff = Infinity;
                                
                                WORKSPACE_CONFIG.forEach(ws => {
                                    const card = document.getElementById(`focus-card-${ws.id}`);
                                    if (card) {
                                        const diff = Math.abs((card.offsetLeft - container.offsetLeft) - scrollLeft);
                                        if (diff < minDiff) {
                                            minDiff = diff;
                                            activeId = ws.id;
                                        }
                                    }
                                });
                                setActiveWorkspaceTab(activeId);
                            }}
                        >
                        {WORKSPACE_CONFIG.map(ws => {
                            const tasks = focusTasks[ws.id] || [];
                            return (
                                <div 
                                    key={ws.id}
                                    id={`focus-card-${ws.id}`}
                                    className={`min-w-[480px] max-w-[480px] shrink-0 rounded-[24px] px-[24px] pt-[16px] pb-[26px] snap-start flex flex-col gap-[16px] min-h-[380px] transition-colors ${
                                        activeWorkspaceTab === ws.id
                                            ? 'border-[2px] border-transparent [background:linear-gradient(#272727,#272727)_padding-box,linear-gradient(to_bottom_right,#d6efe9,#82afb9,#4c6e86)_border-box]'
                                            : 'bg-[#272727] border border-[#3c3c3c]'
                                    }`}
                                >
                                    {/* Card Title */}
                                    <h3 className="text-[18px] font-bold text-white mb-[0]">{ws.name}</h3>

                                    {tasks.length === 0 ? (
                                        <div className="text-[#86868B] text-[14px] mt-[10px]">진행 중인 주요 테스크가 없습니다.</div>
                                    ) : (
                                        tasks.map((task, idx) => (
                                            <div key={task.id} className="flex flex-col gap-[4px] mt-[8px]">
                                                <div className="w-[calc(100%+48px)] h-[1px] bg-[#333] ml-[-24px] -mt-[10px] mb-[10px]"></div>
                                                <div className="flex justify-between items-center mb-[2px]">
                                                    <span className="text-[13px] font-bold text-[#86868B]">Task {idx + 1}</span>
                                                    <span className="text-[12px] font-medium text-[#555] opacity-60">목표 마감일 {task.due_date || '미정'}</span>
                                                </div>
                                                <div 
                                                    className="cursor-pointer group overflow-hidden flex flex-col gap-[8px]"
                                                    onClick={() => {
                                                        localStorage.setItem('iota_target_task_id', task.id);
                                                        const base = import.meta.env.BASE_URL.endsWith('/') ? import.meta.env.BASE_URL.slice(0, -1) : import.meta.env.BASE_URL;
                                                        window.location.href = `${base}/${ws.path}#task-management`;
                                                    }}
                                                >
                                                    <h4 className="text-[20px] font-bold text-[#e2aa29] leading-none group-hover:text-[#fbf167] transition-colors truncate block w-full pt-[2px]">
                                                        {task.task_name}
                                                    </h4>
                                                    <div className="flex items-center gap-[6px]">
                                                        <span className="text-[15px] font-medium text-[#555] opacity-80 shrink-0">다음 액션</span>
                                                        <p className="text-[15px] text-[#86868B] truncate w-full leading-none group-hover:text-[#A1A1AA] transition-colors">
                                                            {task.next_action || '작성된 내용이 없습니다.'}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            );
                        })}
                        {/* Spacer to allow the last card to snap to the left edge */}
                        <div className="min-w-[calc(100vw-480px)] shrink-0 flex items-center justify-start px-[40px] select-none pointer-events-none box-border">
                            <div className="text-white opacity-[0.04] font-bold leading-[0.9] tracking-tighter w-full" style={{ fontSize: 'clamp(30px, 5vw, 100px)' }}>
                                IOTA Seoul<br />Cross Functional<br />Team
                            </div>
                        </div>
                        </div>
                    </div>
                )}
            </div>

                        {/* Workspace Issues Overview */}
            <div className="w-full flex flex-col gap-[12px] mb-[16px] -mt-[4px]">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-[16px]">
                        <h3 className="text-[20px] font-bold text-white tracking-tight mt-[4px]">지금 사람들이 모여 논의하는 주제</h3>
                        <p className="text-[14px] text-[#A1A1AA] font-medium">최근 2주간 타 기능셀의 협업게시판에 등록된 크로스펑셔널(Cross-functional) 업무 내역입니다.</p>
                    </div>
                    {crossFunctionalLogs.length > 6 && (
                        <button 
                            onClick={() => setShowAllCrossFunctional(!showAllCrossFunctional)}
                            className="px-[12px] py-[6px] text-[13px] font-bold text-[#86868B] hover:text-white border border-[#3c3c3c] hover:border-[#555] rounded-[8px] transition-colors"
                        >
                            {showAllCrossFunctional ? '간략히 보기' : '전체보기'}
                        </button>
                    )}
                </div>

                {crossFunctionalLogs.length === 0 ? (
                    <div className="w-full py-[60px] flex items-center justify-center border border-[#333] rounded-[24px] bg-[#222]">
                        <span className="text-[#86868B] text-[14px]">최근 2주간 크로스펑셔널 협업 내역이 없습니다.</span>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-[8px] items-start">
                        {(showAllCrossFunctional ? crossFunctionalLogs : crossFunctionalLogs.slice(0, 6)).map(log => {
                            const normWriter = getCellName(log.writer_name).replace(/-(LFC|DSC|EMC|SSC|KAM)$/, '');
                            const normTarget = getLogCell(log).replace(/-(LFC|DSC|EMC|SSC|KAM)$/, '');
                            const targetRep = CELL_REPRESENTATIVES[normTarget];
                            const isRestricted = hasRestrictedPermissions(log);
                            
                            return (
                                <div key={log.log_id} className="bg-[#292928] border border-[#3c3c3c] hover:border-[#82afb9]/50 rounded-[24px] p-[16px] px-[20px] transition-all cursor-pointer group flex flex-col h-auto" onClick={() => toggleExpand(log.log_id)}>
                                    <div className="flex items-start gap-[20px]">
                                        {/* Sender -> Target Box */}
                                        <div className="shrink-0 bg-[#222] rounded-[16px] px-[12px] py-[12px] border border-[#333] flex items-center justify-between w-[166px]">
                                            <div className="flex flex-col items-center justify-center flex-1 w-0">
                                                <span className="text-[11px] font-bold text-[#A1A1AA] mb-[4px] truncate w-full text-center">{normWriter}</span>
                                                <div className="flex items-center gap-[4px] justify-center w-full min-w-0">
                                                    <div className="w-[20px] h-[20px] rounded-full bg-[#333] overflow-hidden border border-[#444] shrink-0">
                                                        <img src={`${import.meta.env.BASE_URL}${log.writer_name}.webp`} alt={log.writer_name} className="w-full h-full object-cover" onError={(e) => { e.target.src = `${import.meta.env.BASE_URL}default_avatar.svg`; }} />
                                                    </div>
                                                    <span className="text-[13px] font-bold text-white truncate">{log.writer_name}</span>
                                                </div>
                                            </div>
                                            
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#82afb9" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mx-[4px]"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>

                                            <div className="flex flex-col items-center justify-center flex-1 w-0">
                                                {targetRep ? (
                                                    <React.Fragment>
                                                        <span className="text-[11px] font-bold text-[#82afb9] mb-[4px] truncate w-full text-center">{normTarget}</span>
                                                        <div className="flex items-center gap-[4px] justify-center w-full min-w-0">
                                                            <div className="w-[20px] h-[20px] rounded-full bg-[#333] overflow-hidden border border-[#444] shrink-0">
                                                                <img src={`${import.meta.env.BASE_URL}${targetRep.split('/')[0].trim()}.webp`} alt={targetRep.split('/')[0].trim()} className="w-full h-full object-cover" onError={(e) => { e.target.src = `${import.meta.env.BASE_URL}default_avatar.svg`; }} />
                                                            </div>
                                                            <span className="text-[13px] font-bold text-white truncate">{targetRep.split('/')[0].trim()}</span>
                                                        </div>
                                                    </React.Fragment>
                                                ) : (
                                                    <span className="text-[13px] font-bold text-[#82afb9] truncate w-full text-center">{normTarget}</span>
                                                )}
                                            </div>
                                        </div>

                                        {/* Title and Metadata on the right */}
                                        <div className="flex-1 flex flex-col pt-[4px]">
                                            <div className="text-[15px] font-bold text-[#E5E5E5] line-clamp-2 leading-snug group-hover:text-white transition-colors mb-[12px]">
                                                {log.summary || (log.raw_text ? log.raw_text.split('\n')[0] : '')}
                                            </div>
                                            
                                            <div className="flex items-center justify-between w-full mt-auto">
                                                <div className="flex items-center gap-[10px]">
                                                    <span className="text-[12px] text-[#555] font-medium">{formatDateYYMMDD(log.work_date || log.created_at)}</span>
                                                    {isRestricted && (
                                                        <span className="text-[11px] font-bold text-[#ef4444] bg-[#ef4444]/10 px-[6px] py-[2px] rounded-[4px] border border-[#ef4444]/20">
                                                            🔒 {getShortPermissionString(log)}
                                                        </span>
                                                    )}
                                                </div>
                                                <span className="text-[12px] text-[#2997ff] font-medium opacity-0 group-hover:opacity-100 transition-opacity">자세히 보기</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Expanded Box for Cross Functional */}
                                    <AnimatePresence>
                                        {expandedLogs[log.log_id] && (
                                            <motion.div 
                                                className="w-full flex overflow-hidden mt-[16px] cursor-auto"
                                                onClick={(e) => e.stopPropagation()}
                                                initial={{ height: 0, opacity: 0 }}
                                                animate={{ height: 'auto', opacity: 1 }}
                                                exit={{ height: 0, opacity: 0 }}
                                                transition={{ duration: 0.2, ease: "easeInOut" }}
                                            >
                                                <div className="bg-[#222] border border-[#333] rounded-[12px] p-[16px] flex-1 relative w-full">
                                                    {/* Right Floating Badges */}
                                                    <div className="float-right ml-[16px] mb-[12px] flex flex-col items-end gap-[12px]">
                                                        {isRestricted && (
                                                            <div className="flex flex-col items-end gap-[4px]">
                                                                <span className="text-[11px] font-bold text-[#86868B] pr-[14px]">열람 권한</span>
                                                                <div className="bg-[#1e293b] border border-[#334155] rounded-full pl-[8px] pr-[12px] py-[4px] flex items-center gap-[6px]">
                                                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                                                                    <span className="text-[12px] font-medium text-[#e2e8f0]">제한됨</span>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Original Text */}
                                                    {checkUserAccess(log) ? (
                                                        <div className="whitespace-pre-wrap break-words text-[14px] leading-relaxed text-[#E5E5E5]">
                                                            {renderLogTextWithMentions(log.raw_text)}
                                                        </div>
                                                    ) : (
                                                        <div className="text-[#86868B] text-[14px] italic py-[20px] text-center border border-[#333] rounded-[8px] bg-[#222]">
                                                            🔒 열람 권한이 없습니다.
                                                        </div>
                                                    )}
                                                    <div className="clear-both mb-[16px]"></div>
                                                    
                                                    {/* Comments List */}
                                                    {checkUserAccess(log) && log.metadata?.comments && log.metadata.comments.length > 0 && (
                                                        <div className="flex flex-col gap-[8px] mb-[16px] border-t border-[#333] pt-[12px]">
                                                            {log.metadata.comments.map(comment => (
                                                                <div key={comment.id} className="bg-[#292928] rounded-[8px] p-[12px] flex justify-between group/comment">
                                                                    <div className="flex-1 min-w-0 pr-[16px]">
                                                                        <div className="flex items-center gap-[8px] mb-[4px]">
                                                                            <div className="w-[24px] h-[24px] rounded-full bg-[#333] overflow-hidden border border-[#444] shrink-0">
                                                                                <img 
                                                                                    src={`${import.meta.env.BASE_URL}${comment.author}.webp`} 
                                                                                    alt={comment.author} 
                                                                                    className="w-full h-full object-cover"
                                                                                    onError={(e) => { e.target.src = `${import.meta.env.BASE_URL}default_avatar.svg`; }}
                                                                                />
                                                                            </div>
                                                                            <span className="text-[13px] font-bold text-[#E5E5E5]">{comment.author}</span>
                                                                        </div>
                                                                        <div className="text-[13px] text-[#A1A1AA] whitespace-pre-wrap break-words ml-[32px]">{comment.text}</div>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* 주요 회의체 히스토리 */}
            <div className="w-full flex flex-col mt-[22px] mb-[10px]">
                <div className="flex items-center justify-between mb-[8px]">
                    <h3 className="text-[20px] font-bold text-white tracking-tight">주요 회의체 히스토리</h3>
                    
                    {/* Segmented Control */}
                    <div className="flex items-center bg-[#222] border border-[#333] rounded-[8px] p-[4px]">
                        <button
                            onClick={() => setActiveCadenceTab('internal')}
                            className={`px-[16px] py-[6px] text-[13px] font-bold rounded-[6px] transition-colors cursor-pointer ${activeCadenceTab === 'internal' ? 'bg-[#3c3c3c] text-white' : 'text-[#86868B] hover:text-white'}`}
                        >
                            이지스 내부
                        </button>
                        <button
                            onClick={() => setActiveCadenceTab('external')}
                            className={`px-[16px] py-[6px] text-[13px] font-bold rounded-[6px] transition-colors cursor-pointer ${activeCadenceTab === 'external' ? 'bg-[#3c3c3c] text-white' : 'text-[#86868B] hover:text-white'}`}
                        >
                            이지스 외부
                        </button>
                    </div>
                </div>
                
                <div className="w-full border border-[#3c3c3c] bg-[#272726] rounded-[16px] overflow-hidden">
                    <table className="w-full text-left table-fixed">
                        <thead className="bg-transparent">
                            <tr>
                                <th className="pl-[22px] pr-[12px] py-[12px] text-[14px] font-bold text-[#86868B] border-b border-[#3c3c3c] w-[210px]">회의체</th>
                                <th className="pl-[22px] pr-[12px] py-[12px] text-[14px] font-bold text-[#86868B] border-b border-[#3c3c3c] w-[130px]">주기</th>
                                <th className="pl-[22px] pr-[12px] py-[12px] text-[14px] font-bold text-[#86868B] border-b border-[#3c3c3c] w-[160px]">주재자</th>
                                <th className="pl-[42px] pr-[12px] py-[12px] text-[14px] font-bold text-[#86868B] border-b border-[#3c3c3c] w-[280px]">주요 참석자</th>
                                <th className="pl-[22px] pr-[12px] py-[12px] text-[14px] font-bold text-[#86868B] border-b border-[#3c3c3c]">핵심 산출물</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[#3c3c3c]">
                            {(activeCadenceTab === 'internal' ? internalMeetings : externalMeetings).map((row, idx) => {
                                const rowId = `${activeCadenceTab}-${idx}`;
                                const isExpanded = expandedCadenceRow === rowId;
                                return (
                                    <React.Fragment key={idx}>
                                        <tr className="hover:bg-[#333] transition-colors group cursor-pointer" onClick={() => setExpandedCadenceRow(isExpanded ? null : rowId)}>
                                            <td className="pl-[22px] pr-[12px] py-[12px] text-[17px] text-[#E5E5E5] group-hover:text-white transition-colors text-left font-semibold whitespace-pre-wrap">{row.meeting}</td>
                                            <td className="pl-[22px] pr-[12px] py-[12px] text-[13px] transition-colors"><span className="inline-block px-[10px] py-[4px] rounded-[6px] bg-[#333] text-[#c3c2b7] group-hover:bg-[#444] group-hover:text-white transition-colors whitespace-nowrap">{row.period}</span></td>
                                            <td className="pl-[22px] pr-[12px] py-[12px] text-[13px] font-bold text-white whitespace-nowrap transition-colors">{row.leader}</td>
                                            <td className="pl-[42px] pr-[12px] py-[12px] text-[13px] text-[#c3c2b7] text-left group-hover:text-[#E5E5E5] transition-colors">{row.attendees}</td>
                                            <td className="pl-[22px] pr-[12px] py-[12px] text-[13px] text-[#c3c2b7] text-left group-hover:text-[#E5E5E5] transition-colors">{row.output}</td>
                                        </tr>
                                        {isExpanded && (
                                            <tr className="bg-[#1f1f1e] animate-fade-in">
                                                <td colSpan="5" className="pl-[22px] pr-[12px] py-[16px] text-[#ff453a] text-[14px] font-bold border-t border-[#3c3c3c]">
                                                    최초 회의 개최 후 등록 예정입니다.
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Log Viewer */}
            <div id="log-viewer-header" className="flex justify-between items-center mt-[26px] mb-[12px] scroll-mt-[80px]">
                <h2 className="text-[18px] font-bold text-white tracking-tight translate-y-[2px] mt-[4px]">CFT 협업 활동 전체보기</h2>
                <div className="flex items-center gap-[12px]">
                    

                    {/* My Logs Toggle */}
                    <button 
                        onClick={() => { setShowMyLogsOnly(!showMyLogsOnly); setCurrentPage(1); }}
                        className={`flex items-center px-[12px] py-[6px] rounded-[8px] text-[12px] font-bold border cursor-pointer transition-colors ${showMyLogsOnly ? 'bg-[#2997ff]/10 text-[#2997ff] border-[#2997ff]/30' : 'bg-transparent text-[#86868B] border-[#333] hover:text-[#E5E5E5] hover:border-[#444]'}`}
                    >
                        내 활동내역만 보기
                    </button>

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
                </div>
            </div>
            <div className="w-full border border-[#3c3c3c] rounded-[24px] mb-[30px] flex flex-col bg-[#252525]">
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
                        <div className="w-[110px] mr-[4px] text-center flex items-center justify-center">
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
                    <div key={log.log_id} className="relative w-full px-[20px] py-[16px] flex flex-col group transition-colors hover:bg-white/5 last:rounded-b-[24px] border-b border-[#3c3c3c]">
                        {/* Main Row */}
                        <div 
                            className="w-full flex items-center justify-between cursor-pointer"
                            onClick={() => toggleExpand(log.log_id)}
                        >
                            {/* Left Section */}
                            <div className="flex items-center flex-1 min-w-0">
                                {/* Project Button */}
                                {(() => {
                                    let projName = '427 PFV';
                                    if (log.metadata?.project_name) {
                                        let name = log.metadata.project_name;
                                        if (name === 'IOTA 427') name = '427 PFV';
                                        if (name === 'IOTA 816') name = '816 PFV';
                                        projName = name;
                                    } else {
                                        const text = log.metadata?.workspace_label || log.metadata?.source_project_text || '';
                                        if (text.includes('816') || text.includes('서울 2') || text.includes('IOTA 2') || text.includes('Two')) projName = '816 PFV';
                                        else if (text.includes('421')) projName = '421 Fund';
                                    }
                                    
                                    let textColorClass = 'text-[#E5E5E5] border-[#444]'; // 427 PFV (Lightest)
                                    if (projName === '816 PFV') textColorClass = 'text-[#A1A1AA] border-[#333]'; // 816 PFV (Medium)
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
                                            {getLogCell(log).replace(/-(LFC|DSC|EMC|SSC|KAM)$/, '')}
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
                                            className="flex-1 min-w-0 text-[14px] text-[#E5E5E5] hover:text-white transition-colors flex items-center gap-[6px]"
                                        >
                                            {hasRestrictedPermissions(log) && (
                                                <div className="group relative flex items-center gap-[4px] shrink-0 cursor-default">
                                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                                                    <span className="text-[#ef4444] text-[12px] font-bold">[{getShortPermissionString(log)}]</span>
                                                    <div className="absolute left-0 bottom-[100%] mb-[8px] hidden group-hover:flex bg-[#222] border border-[#333] px-[10px] py-[6px] rounded-[6px] whitespace-nowrap text-[12px] text-[#E5E5E5] shadow-xl z-[99] pointer-events-none font-medium">
                                                        🔒 열람 권한: {getPermissionString(log)}
                                                    </div>
                                                </div>
                                            )}
                                            <span className="truncate">{log.summary || (log.raw_text ? log.raw_text.split('\n')[0] : '')}</span>
                                            {log.metadata?.comments?.length > 0 && <span className="text-[#3b82f6] ml-[6px] font-bold text-[13px] shrink-0">({log.metadata.comments.length})</span>}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Right Section */}
                            <div className="flex items-center gap-[12px] shrink-0 ml-[12px] justify-end">
                                {/* Stakeholder Info */}
                                <div className="shrink-0 flex justify-center w-[110px] mr-[4px]">
                                    {log.iota_seoul_log_stakeholders?.[0]?.sh_name && (
                                        <span className="text-[13px] text-[#A1A1AA] text-center truncate" title={log.iota_seoul_log_stakeholders[0].sh_name.split(' - ')[0]}>
                                            {log.iota_seoul_log_stakeholders[0].sh_name.split(' - ')[0]}
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
                                
                                {/* Delete Button */}
                                {(memberInfo?.email === log.writer_staff_id || memberInfo?.name === log.writer_name) && (
                                    <button 
                                        type="button"
                                        onClick={(e) => { e.stopPropagation(); handleDeleteClick(log); }}
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
                                    className="bg-[#1c1c1e] border border-[#333] rounded-[12px] p-[16px] flex-1 relative"
                                    style={{ marginLeft: '166px', marginRight: '72px' }}
                                >
                                    {/* Right Floating Badges */}
                                    <div className="float-right ml-[16px] mb-[12px] flex flex-col items-end gap-[12px]">
                                        {hasRestrictedPermissions(log) && (
                                            <div className="flex flex-col items-end gap-[4px]">
                                                <span className="text-[11px] font-bold text-[#86868B] pr-[14px]">열람 권한</span>
                                                <div className="bg-[#1e293b] border border-[#334155] rounded-full pl-[8px] pr-[12px] py-[4px] flex items-center gap-[6px]">
                                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                                                    <span className="text-[12px] font-medium text-[#e2e8f0]">
                                                        제한됨: {getPermissionString(log)}
                                                    </span>
                                                </div>
                                            </div>
                                        )}
                                        
                                        {log.iota_seoul_log_stakeholders?.[0]?.sh_name && (
                                            <div className="flex flex-col items-end gap-[4px]">
                                                <span className="text-[11px] font-bold text-[#86868B] pr-[14px]">이해관계자</span>
                                                <div className="bg-[#2a2a2c] border border-[#444] rounded-full pl-[8px] pr-[12px] py-[4px] flex items-center gap-[6px]">
                                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#A1A1AA" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                                                    <span className="text-[12px] font-medium text-[#E5E5E5]">
                                                        {log.iota_seoul_log_stakeholders[0].sh_name.split(' - ')[0]}
                                                    </span>
                                                </div>
                                            </div>
                                        )}
                                    </div>
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
                                        checkUserAccess(log) ? (
                                            <div className={`whitespace-pre-wrap break-words text-[15px] leading-relaxed ${commentingLogId === log.log_id ? 'text-[#86868B] opacity-70' : 'text-[#E5E5E5]'}`}>
                                                {renderLogTextWithMentions(log.raw_text)}
                                            </div>
                                        ) : (
                                            <div className="text-[#86868B] text-[14px] italic py-[20px] text-center border border-[#333] rounded-[8px] bg-[#1a1a1a]">
                                                🔒 열람 권한이 없습니다.
                                            </div>
                                        )
                                    )}
                                    <div className="clear-both mb-[16px]"></div>
                                    
                                    {/* Comments List */}
                                    {checkUserAccess(log) && log.metadata?.comments && log.metadata.comments.length > 0 && (
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
                                                            onClick={(e) => { e.stopPropagation(); setCommentToDelete({ logId: log.log_id, commentId: comment.id }); }}
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
                                    {checkUserAccess(log) && commentingLogId === log.log_id && (
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
                                    
                                    <div className="mt-[12px] flex items-end justify-between">
                                        <div className="text-[12px] text-[#555] font-medium">
                                            수정일자: {log.updated_at ? new Date(log.updated_at).toLocaleString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : new Date(log.created_at || log.work_date).toLocaleString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                        </div>
                                        {checkUserAccess(log) && (
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
                                        )}
                                    </div>
                                </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                ))}
                {isLoading ? (
                    <div className="py-[60px] flex flex-col items-center justify-center text-[14px] text-[#86868B]">
                        <div className="w-[24px] h-[24px] border-2 border-[#86868B]/30 border-t-[#86868B] rounded-full animate-spin mb-[12px]" />
                        데이터를 불러오는 중입니다...
                    </div>
                ) : displayedLogs.length === 0 && (
                    <div className="py-[60px] text-center text-[14px] text-[#86868B]">등록된 업무가 없습니다.</div>
                )}

                {logsViewMode === 'full' && totalPages > 1 && (
                    <div className="w-full py-3 flex justify-center items-center gap-[12px]">
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
            {(logToDelete || commentToDelete) && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60">
                    <div className="bg-[#222] border border-[#333] rounded-[16px] w-[320px] p-[24px] shadow-2xl flex flex-col items-center">
                        <div className="w-[48px] h-[48px] rounded-full bg-white/10 flex items-center justify-center mb-[16px]">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"></path><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                        </div>
                        <h3 className="text-[16px] font-bold text-white mb-[8px] text-center">{logToDelete ? '해당 업무를 삭제하시겠습니까?' : '댓글을 삭제하시겠습니까?'}</h3>
                        <p className="text-[13px] text-[#86868B] text-center mb-[24px]">이 작업은 되돌릴 수 없습니다.</p>
                        <div className="flex items-center gap-[12px] w-full">
                            <button 
                                type="button"
                                onClick={() => { setLogToDelete(null); setCommentToDelete(null); }}
                                className="flex-1 py-[10px] rounded-[8px] bg-[#333] hover:bg-[#444] text-white text-[13px] font-medium transition-colors"
                                disabled={isDeleting}
                            >
                                취소
                            </button>
                            <button 
                                type="button"
                                onClick={() => {
                                    if (logToDelete) confirmDelete();
                                    else if (commentToDelete) handleDeleteComment(commentToDelete.logId, commentToDelete.commentId);
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
