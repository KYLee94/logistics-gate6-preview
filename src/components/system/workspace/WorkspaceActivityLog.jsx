import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../../utils/supabaseClient';
import { useAuth } from '../../../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import LogWriteBox from '../LogWriteBox';
import logisticsPermissionData from './logisticsPermissionData.json';

const MotionDiv = motion.div;
const LOGISTICS_MASTER_STAKEHOLDERS = (logisticsPermissionData.users || []).map((user) => ({
    company_name: user.organization || 'IGIS',
    contact_name: user.name,
    role_category: user.organization || 'IGIS 내부인력',
    email: user.email,
})).filter((item) => item.contact_name);
const LOGISTICS_NAME_BY_EMAIL = new Map((logisticsPermissionData.users || [])
    .filter((user) => user.email && user.name)
    .map((user) => [String(user.email).toLowerCase(), user.name]));

function cleanStakeholderText(value) {
    return String(value || '').trim();
}

function stakeholderKey(companyName, contactName) {
    return `${cleanStakeholderText(companyName).replace(/\s+/gu, '').toLowerCase()}|${cleanStakeholderText(contactName).replace(/\s+/gu, '').toLowerCase()}`;
}

function splitStakeholderName(value) {
    const parts = cleanStakeholderText(value).split(' - ').map((part) => part.trim()).filter(Boolean);
    return {
        company_name: parts[0] || '',
        contact_name: parts.slice(1).join(' - '),
    };
}

function normalizeStakeholderRow(row = {}) {
    const parsed = splitStakeholderName(row.stakeholder_name || row.sh_name);
    return {
        ...row,
        company_name: cleanStakeholderText(row.company_name || parsed.company_name),
        contact_name: cleanStakeholderText(row.contact_name || parsed.contact_name),
        role_category: cleanStakeholderText(row.role_category),
    };
}

function stakeholderRowsFromLogs(rows = []) {
    return (rows || []).flatMap((row) => (
        row.iota_seoul_log_stakeholders || []
    ).map((stakeholder) => normalizeStakeholderRow(stakeholder)));
}

function mergeStakeholderRows(...rowGroups) {
    const unique = new Map();
    rowGroups.flat().map(normalizeStakeholderRow).forEach((row) => {
        if (!row.company_name && !row.contact_name) return;
        const key = stakeholderKey(row.company_name, row.contact_name);
        if (!unique.has(key)) unique.set(key, row);
    });
    return [...unique.values()].sort((a, b) => (
        `${a.company_name || ''} ${a.contact_name || ''}`.localeCompare(`${b.company_name || ''} ${b.contact_name || ''}`, 'ko-KR')
    ));
}

function resolveLogisticsDisplayName(name, email) {
    const normalizedEmail = cleanStakeholderText(email || name).toLowerCase();
    const normalizedName = cleanStakeholderText(name);
    if (normalizedEmail && LOGISTICS_NAME_BY_EMAIL.has(normalizedEmail)) {
        return LOGISTICS_NAME_BY_EMAIL.get(normalizedEmail);
    }
    if (normalizedName.includes('@')) {
        return LOGISTICS_NAME_BY_EMAIL.get(normalizedName.toLowerCase()) || normalizedName;
    }
    return normalizedName || cleanStakeholderText(email) || '익명';
}

export default function WorkspaceActivityLog({ workspaceCode, workspaceLabel, assetOptions = [] }) {
    const { memberInfo } = useAuth();
    const isLogisticsMode = workspaceCode === 'WS_LOGISTICS';
    
    // Logs State
    const [isLoading, setIsLoading] = useState(true);
    const [logs, setLogs] = useState([]);
    const [logsViewMode, setLogsViewMode] = useState('summary');
    const [currentPage, setCurrentPage] = useState(1);
    const [expandedLogs, setExpandedLogs] = useState({});
    const [logSearchQuery, setLogSearchQuery] = useState('');
    const [masterStakeholders, setMasterStakeholders] = useState([]);
    const effectiveMasterStakeholders = useMemo(() => (
        isLogisticsMode
            ? mergeStakeholderRows(masterStakeholders, LOGISTICS_MASTER_STAKEHOLDERS, stakeholderRowsFromLogs(logs))
            : masterStakeholders
    ), [isLogisticsMode, logs, masterStakeholders]);
    
    // Delete states
    const [logToDelete, setLogToDelete] = useState(null);
    const [commentToDelete, setCommentToDelete] = useState(null); // { logId, commentId }
    const [isDeleting, setIsDeleting] = useState(false);
    
    // Filter states
    const [filterStakeholder, setFilterStakeholder] = useState('');
    const [filterCell, setFilterCell] = useState(() => {
        if (workspaceCode === 'WS_LOGISTICS') return '';
        if (workspaceLabel === '사업 PM') return '사업PM';
        return workspaceLabel || '';
    });
    const [filterPurpose, setFilterPurpose] = useState('');
    const [filterStatus, setFilterStatus] = useState('');
    const [filterPriority, setFilterPriority] = useState('');
    
    // Edit states
    const [editingLogId, setEditingLogId] = useState(null);

    // Comment states
    const [commentingLogId, setCommentingLogId] = useState(null);
    const [commentContent, setCommentContent] = useState('');
    const [isSavingComment, setIsSavingComment] = useState(false);

    const toLogisticsBoardLog = (row) => {
        const writerEmail = cleanStakeholderText(row.created_by_email).toLowerCase();
        const writerName = resolveLogisticsDisplayName(row.created_by_name, writerEmail);
        const comments = Array.isArray(row.comments)
            ? row.comments.map((comment) => ({
                ...comment,
                author: resolveLogisticsDisplayName(comment.author, comment.author_email),
            }))
            : [];
        return {
            log_id: row.log_id,
            work_date: row.work_date,
            raw_text: row.content,
            summary: row.title,
            writer_staff_id: writerEmail,
            writer_name: writerName,
            created_at: row.created_at,
            updated_at: row.updated_at,
            metadata: {
                ...(row.metadata || {}),
                project_name: row.related_asset_name,
                asset_name: row.related_asset_name,
                asset_id: row.related_asset_id,
                triage_type: row.triage_type,
                issue_status: row.issue_status,
                priority: row.priority,
                comments,
                permissions: {
                    groups: row.visibility_groups || [],
                    individuals: row.visibility_individuals || [],
                },
            },
            iota_seoul_log_stakeholders: row.stakeholder_name
                ? [{ sh_name: row.stakeholder_name, role_category: row.stakeholder_category }]
                : [],
        };
    };

    const handleSavedLog = (row) => {
        if (!row) return;
        const nextLog = toLogisticsBoardLog(row);
        setLogs(prev => [nextLog, ...prev.filter(log => log.log_id !== nextLog.log_id)]);
        setCurrentPage(1);
        setLogSearchQuery('');
        setFilterStakeholder('');
        setFilterCell('');
        setFilterPurpose('');
        setFilterStatus('');
        setFilterPriority('');
    };

    const renderLogTextWithMentions = (text) => {
        if (!text) return null;
        if (!effectiveMasterStakeholders || effectiveMasterStakeholders.length === 0) return text;
        const names = Array.from(new Set(effectiveMasterStakeholders.map(s => s.contact_name).filter(Boolean)));
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
        try {
            const { data, error } = await supabase
                .from('iota_stakeholder_master')
                .select('*')
                .limit(5000);
            if (data && !error) {
                setMasterStakeholders(isLogisticsMode ? mergeStakeholderRows(data, LOGISTICS_MASTER_STAKEHOLDERS) : data);
                return;
            }
        } catch (error) {
            console.error('Master stakeholder fetch error:', error);
        }
        if (isLogisticsMode) setMasterStakeholders(LOGISTICS_MASTER_STAKEHOLDERS);
    };

    const fetchLogs = async () => {
        setIsLoading(true);
        try {
            if (isLogisticsMode) {
                const { data, error } = await supabase.functions.invoke('ll-dashboard-api', {
                    body: { action: 'work-platform/board-posts/list', payload: { workspace: 'logistics' } },
                });
                if (error) throw error;
                if (!data?.ok) throw new Error(data?.message || '협업게시판 목록을 불러오지 못했습니다.');
                setLogs(Array.isArray(data?.data) ? data.data.map(toLogisticsBoardLog) : []);
                return;
            }
            const { data, error } = await supabase
                .from('iota_seoul_logs')
                .select('*, iota_seoul_log_stakeholders(sh_name, role_category)')
                .order('work_date', { ascending: false })
                .order('created_at', { ascending: false });
            if (error) throw error;
            
            setLogs(data || []);
        } catch (e) {
            console.error('Error fetching logs:', e);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchLogs();
        fetchMasterStakeholders();
    }, []);

    const handleDelete = async (logId) => {
        setIsDeleting(true);
        try {
            if (isLogisticsMode) {
                const { data, error } = await supabase.functions.invoke('ll-dashboard-api', {
                    body: { action: 'work-platform/board-posts/delete', payload: { log_id: logId } },
                });
                if (error) throw error;
                if (!data?.ok) throw new Error(data?.message || '협업게시판 글 삭제에 실패했습니다.');
                setLogs(prev => prev.filter(l => l.log_id !== logId));
                setLogToDelete(null);
                return;
            }
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

    const handleSaveComment = async (logId) => {
        if (!commentContent.trim()) return;
        setIsSavingComment(true);
        try {
            if (isLogisticsMode) {
                const { data, error } = await supabase.functions.invoke('ll-dashboard-api', {
                    body: { action: 'work-platform/board-posts/comment', payload: { log_id: logId, text: commentContent } },
                });
                if (error) throw error;
                if (!data?.ok) throw new Error(data?.message || '댓글 저장에 실패했습니다.');
                const next = data?.data ? toLogisticsBoardLog(data.data) : null;
                setLogs(prev => prev.map(l => l.log_id === logId && next ? next : l));
                setCommentingLogId(null);
                setCommentContent('');
                return;
            }
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
            if (isLogisticsMode) {
                const { data, error } = await supabase.functions.invoke('ll-dashboard-api', {
                    body: { action: 'work-platform/board-posts/comment-delete', payload: { log_id: logId, comment_id: commentId } },
                });
                if (error) throw error;
                if (!data?.ok) throw new Error(data?.message || '댓글 삭제에 실패했습니다.');
                const next = data?.data ? toLogisticsBoardLog(data.data) : null;
                setLogs(prev => prev.map(l => l.log_id === logId && next ? next : l));
                return;
            }
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

    const getCellName = (name) => {
        if (!effectiveMasterStakeholders || effectiveMasterStakeholders.length === 0) return '기타';
        const stakeholder = effectiveMasterStakeholders.find(s => s.contact_name === name);
        if (stakeholder && stakeholder.role_category && stakeholder.role_category !== 'IGIS 내부인력') {
            return stakeholder.role_category;
        }
        return '기타';
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
            const myStakeholderRecords = effectiveMasterStakeholders.filter(s => s.contact_name === myName);
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

    const filteredLogs = logs.filter(log => {
        // Filter out non-members
        if (!isLogisticsMode && getCellName(log.writer_name) === '기타') return false;

        const cell = getLogCell(log);
        
        if (filterStakeholder && log.iota_seoul_log_stakeholders?.[0]?.role_category !== filterStakeholder) return false;
        if (filterCell && workspaceCode !== 'WS_LOGISTICS' && cell !== filterCell) return false;
        if (filterCell && workspaceCode === 'WS_LOGISTICS') {
            const assetText = [
                log.metadata?.project_name,
                log.metadata?.asset_name,
                log.metadata?.related_asset_name,
                log.metadata?.workspace_label,
                log.metadata?.source_project_text,
                log.raw_text,
                log.summary,
            ].join(' ');
            if (!assetText.includes(filterCell)) return false;
        }
        if (filterPurpose && (log.metadata?.triage_type || '공유') !== filterPurpose) return false;
        if (filterStatus && (log.metadata?.issue_status || '진행중') !== filterStatus) return false;
        if (filterPriority && (log.metadata?.priority || '중간') !== filterPriority) return false;

        if (!logSearchQuery) return true;
        const query = logSearchQuery.toLowerCase();
        return (
            log.raw_text?.toLowerCase().includes(query) ||
            log.summary?.toLowerCase().includes(query) ||
            log.writer_name?.toLowerCase().includes(query) ||
            log.metadata?.project_name?.toLowerCase().includes(query) ||
            log.metadata?.asset_name?.toLowerCase().includes(query) ||
            log.iota_seoul_log_stakeholders?.[0]?.sh_name?.toLowerCase().includes(query) ||
            log.metadata?.workspace_label?.toLowerCase().includes(query) ||
            log.metadata?.iota_matches?.[0]?.label?.toLowerCase().includes(query)
        );
    });
    const totalPages = Math.max(1, Math.ceil(filteredLogs.length / logsPerPage));
    const displayedLogs = filteredLogs.slice((currentPage - 1) * logsPerPage, currentPage * logsPerPage);

    return (
        <div className="w-full flex flex-col mt-0">
            {/* Log Viewer */}
            <div className="flex justify-between items-center mt-[-14px] mb-[12px]">
                <h2 className="text-[18px] font-bold text-white tracking-tight translate-y-[6px]">{isLogisticsMode ? '협업게시판' : `${workspaceLabel ? workspaceLabel.split('-')[0].trim() : ''} 협업게시판`}</h2>
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
            
            
            <div className="-mx-[7px] p-[6px] border border-[#333] rounded-[30px] mb-[40px]">
                <div className="w-full flex flex-col mt-0">{/* Task Input Form */}
            <LogWriteBox 
                memberInfo={memberInfo}
                masterStakeholders={effectiveMasterStakeholders}
                fetchLogs={fetchLogs}
                onSavedLog={handleSavedLog}
                fetchMasterStakeholders={fetchMasterStakeholders}
                workspaceCode={workspaceCode}
                workspaceLabel={workspaceLabel}
                projectOptions={assetOptions.map((asset) => ({ id: asset.assetId || asset.assetCode || asset.assetName, label: asset.assetName, metadata: asset }))}
            />
            <div className="w-full border border-[#3c3c3c] rounded-[24px] flex flex-col bg-[#252525]">
                {/* Header Row */}
                <div className="w-full px-[20px] py-[12px] flex items-center border-b border-[#3c3c3c] bg-transparent rounded-t-[24px]">
                    {/* Left Section */}
                    <div className="flex flex-1 min-w-0">
                        <div className="w-[190px] mr-[12px] text-center">
                            {workspaceCode === 'WS_LOGISTICS' ? (
                                <select
                                    value={filterCell}
                                    onChange={e => { setFilterCell(e.target.value); setCurrentPage(1); }}
                                    className={`bg-white/5 border border-transparent text-[12px] font-bold cursor-pointer appearance-none focus:outline-none w-[184px] hover:text-white hover:bg-white/10 rounded-[8px] px-[8px] py-[4px] transition-colors ${filterCell ? 'text-[#fbf167]' : 'text-[#A1A1AA]'}`}
                                    style={{ textAlignLast: 'center' }}
                                >
                                    <option value="" className="bg-[#222] text-[#E5E5E5]">담당 자산</option>
                                    {assetOptions.map((asset) => (
                                        <option key={asset.assetId || asset.assetCode || asset.assetName} value={asset.assetName} className="bg-[#222] text-[#E5E5E5]">{asset.assetName}</option>
                                    ))}
                                </select>
                            ) : (
                                <span className="text-[13px] font-bold text-[#86868B]">프로젝트</span>
                            )}
                        </div>
                            <div className="flex flex-1 min-w-0">
                            <div className="w-[80px] shrink-0 translate-x-[4px] flex justify-center">
                                <div className="text-[13px] font-bold text-[#86868B] px-[2px] py-[4px] text-center w-[60px]">
                                    기능셀
                                </div>
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
                    <div key={log.log_id} className={`relative w-full px-[20px] py-[16px] flex flex-col group transition-colors hover:bg-white/5 last:rounded-b-[24px] ${index !== displayedLogs.length - 1 ? 'border-b border-[#3c3c3c]' : ''}`}>
                        {/* Main Row */}
                        <div 
                            className="w-full flex items-center justify-between cursor-pointer"
                            onClick={() => toggleExpand(log.log_id)}
                        >
                            {/* Left Section */}
                            <div className="flex items-center flex-1 min-w-0">
                                {/* Project Button */}
                                {(() => {
                                    let projName = workspaceCode === 'WS_LOGISTICS' ? '담당 자산' : '427 PFV';
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
                                    
                                    if (workspaceCode === 'WS_LOGISTICS') {
                                        const sourceText = [log.metadata?.project_name, log.metadata?.asset_name, log.metadata?.source_project_text, log.raw_text, log.summary].join(' ');
                                        const matchedAsset = assetOptions.find((asset) => sourceText.includes(asset.assetName));
                                        projName = matchedAsset?.assetName || projName;
                                    }
                                    
                                    let textColorClass = 'text-[#E5E5E5] border-[#444]'; // 427 PFV (Lightest)
                                    if (projName === '816 PFV') textColorClass = 'text-[#A1A1AA] border-[#333]'; // 816 PFV (Medium)
                                    else if (projName === '421 Fund') textColorClass = 'text-[#737373] border-[#222]'; // 421 Fund (Darkest)
                                    else if (projName === 'IOTA 공통') textColorClass = 'text-[#A1A1AA] border-[#333]';
                                    
                                    return (
                                        <div className={`py-[6px] border rounded-[8px] text-[12px] font-bold ${textColorClass} shrink-0 mr-[12px] ${workspaceCode === 'WS_LOGISTICS' ? 'w-[190px] truncate px-3' : 'w-[86px]'} text-center bg-transparent`} title={projName}>
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
                                    {checkUserAccess(log) && log.iota_seoul_log_stakeholders?.[0]?.sh_name && (
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
                                <MotionDiv 
                                    className="w-full flex overflow-hidden"
                                    initial={{ height: 0, opacity: 0, marginTop: 0 }}
                                    animate={{ height: 'auto', opacity: 1, marginTop: 14 }}
                                    exit={{ height: 0, opacity: 0, marginTop: 0 }}
                                    transition={{ duration: 0.2, ease: "easeInOut" }}
                                >
                                <div 
                                    className="rounded-[12px] p-[1px] bg-gradient-to-br from-[#d6efe9] via-[#82afb9] to-[#4c6e86] flex-1"
                                    style={{ marginLeft: '166px', marginRight: '72px' }}
                                >
                                    <div className="bg-[#1c1c1e] rounded-[11px] p-[16px] w-full h-full">
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
                                        
                                        {checkUserAccess(log) && log.iota_seoul_log_stakeholders?.[0]?.sh_name && (
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
                                    {checkUserAccess(log) ? (
                                            <div className={`whitespace-pre-wrap break-words text-[15px] leading-relaxed ${commentingLogId === log.log_id ? 'text-[#86868B] opacity-70' : 'text-[#E5E5E5]'}`}>
                                                {renderLogTextWithMentions(log.raw_text)}
                                            </div>
                                        ) : (
                                            <div className="text-[#86868B] text-[14px] italic py-[20px] text-center border border-[#333] rounded-[8px] bg-[#1a1a1a]">
                                                🔒 열람 권한이 없습니다.
                                            </div>
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
                                </div>
                                </MotionDiv>
                            )}
                        </AnimatePresence>
                    </div>
                ))}
                {displayedLogs.length === 0 && (
                    <div className="py-[60px] text-center text-[14px] text-[#86868B]">
                        {isLoading ? '데이터를 불러오는 중입니다...' : '등록된 업무가 없습니다.'}
                    </div>
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

            {/* Edit Modal */}
            {editingLogId && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-[40px]">
                    <div className="w-full max-w-[1000px] max-h-[90vh] overflow-y-auto rounded-[24px]">
                        <LogWriteBox 
                            memberInfo={memberInfo}
                            masterStakeholders={effectiveMasterStakeholders}
                            fetchLogs={fetchLogs}
                            onSavedLog={handleSavedLog}
                            fetchMasterStakeholders={fetchMasterStakeholders}
                            workspaceCode={workspaceCode}
                            workspaceLabel={workspaceLabel}
                            projectOptions={assetOptions.map((asset) => ({ id: asset.assetId || asset.assetCode || asset.assetName, label: asset.assetName, metadata: asset }))}
                            editMode={true}
                            initialData={logs.find(l => l.log_id === editingLogId)}
                            onCancel={() => setEditingLogId(null)}
                            onSuccess={() => setEditingLogId(null)}
                        />
                    </div>
                </div>
            )}

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
                                    if (logToDelete) handleDelete(logToDelete.log_id);
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
            </div>
        </div>
    );
}
