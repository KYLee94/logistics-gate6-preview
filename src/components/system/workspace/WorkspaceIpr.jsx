import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../../../utils/supabaseClient';
import WorkspaceActivityLog from './WorkspaceActivityLog';

export default function WorkspaceIpr() {

    const { memberInfo } = useAuth();
    const isAuthorized = ['전기영', '권순일', '윤용택', '정수명', '김성원', '이가현', '박재호', '허재영'].includes(memberInfo?.staff_name);

    // Task Management States
    const [tasks, setTasks] = useState([]);
    const [isLoadingTasks, setIsLoadingTasks] = useState(true);
    const [isAdding, setIsAdding] = useState(false);
    const [newTask, setNewTask] = useState({
        task_name: '', company_name: '', related_asset: 'IOTA 공통', status: '신규', priority: '중간', due_date: new Date().toLocaleDateString('en-CA'), next_action: ''
    });

    const [expandedTaskId, setExpandedTaskId] = useState(null);
    const [projectShowAll, setProjectShowAll] = useState(false);
    const [assetFilter, setAssetFilter] = useState('427 PFV');
    const [customAssets, setCustomAssets] = useState([]);
    const [showNewAssetModal, setShowNewAssetModal] = useState(false);
    const [newAssetName, setNewAssetName] = useState('');
    const [isSubmittingAsset, setIsSubmittingAsset] = useState(false);
    const [isSubmittingTask, setIsSubmittingTask] = useState(false);
    const [editingTaskId, setEditingTaskId] = useState(null);

    // Stakeholder States
    const [masterStakeholders, setMasterStakeholders] = useState([]);
    const [companyQuery, setCompanyQuery] = useState('');
    const [showCompanyDropdown, setShowCompanyDropdown] = useState(false);
    const [showNewStakeholderModal, setShowNewStakeholderModal] = useState(false);
    const [newStakeholderRole, setNewStakeholderRole] = useState('');
    const [itemToDelete, setItemToDelete] = useState(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [showAuthAlert, setShowAuthAlert] = useState(false);

    useEffect(() => {
        fetchTasks();
        fetchMasterStakeholders();
        const saved = localStorage.getItem('iota_shared_custom_assets');
        if (saved) setCustomAssets(JSON.parse(saved));
    }, []);

    const fetchMasterStakeholders = async () => {
        try {
            const { data, error } = await supabase.from('iota_stakeholder_master').select('*');
            if (!error && data) {
                setMasterStakeholders(data);
            }
        } catch (e) {
            console.error('Master stakeholder fetch error:', e);
        }
    };

    const registerMasterStakeholder = async () => {
        try {
            const { error } = await supabase.from('iota_stakeholder_master').insert({
                company_name: companyQuery,
                role_category: newStakeholderRole
            });
            if (!error) {
                await fetchMasterStakeholders();
                setShowNewStakeholderModal(false);
            } else {
                alert('이해관계자 등록 중 오류가 발생했습니다.');
            }
        } catch (e) {
            alert('연결 오류');
        }
    };

    const registerNewAsset = () => {
        if (!newAssetName.trim()) return;
        setIsSubmittingAsset(true);
        setTimeout(() => {
            const updated = [...customAssets, newAssetName.trim()];
            setCustomAssets(updated);
            localStorage.setItem('iota_shared_custom_assets', JSON.stringify(updated));
            setNewTask({...newTask, related_asset: newAssetName.trim()});
            setIsSubmittingAsset(false);
            setShowNewAssetModal(false);
            setNewAssetName('');
        }, 300);
    };

    const uniqueCompanies = [...new Set(masterStakeholders.map(s => s.company_name).filter(Boolean))];
    const filteredCompanies = uniqueCompanies.filter(c => c.toLowerCase().includes(companyQuery.toLowerCase()));

    const fetchTasks = async () => {
        setIsLoadingTasks(true);
        try {
            const { data, error } = await supabase
                .from('iota_ipr_tasks')
                .select('*')
                .order('created_at', { ascending: false });
            if (error) {
                console.warn('Falling back to local storage for tasks:', error);
                const localData = localStorage.getItem('iota_ipr_tasks_fallback');
                if (localData) setTasks(JSON.parse(localData));
                else setTasks([]);
            } else {
                setTasks(data || []);
            }
        } catch (e) {
            console.error('Failed to fetch tasks:', e);
            const localData = localStorage.getItem('iota_ipr_tasks_fallback');
            if (localData) setTasks(JSON.parse(localData));
        } finally {
            setIsLoadingTasks(false);
        }
    };

    const handleEditRow = (row) => {
        setEditingTaskId(row.id);
        setNewTask({
            task_name: row.task_name || '',
            company_name: row.company_name || '',
            related_asset: row.related_asset || 'IOTA 공통',
            status: row.status || '신규',
            priority: row.priority || '중간',
            due_date: row.due_date || '',
            next_action: row.next_action || '',
            notes: row.notes || ''
        });
        setCompanyQuery(row.company_name || '');
        setIsAdding(true);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleSaveRow = async () => {
        if (!newTask.task_name) return alert('Task 명을 입력해주세요.');
        setIsSubmittingTask(true);
        try {
            if (editingTaskId) {
                const { error } = await supabase.from('iota_ipr_tasks').update(newTask).eq('id', editingTaskId);
                if (error) throw error;
            } else {
                const taskToSave = { ...newTask, id: Date.now().toString(), created_at: new Date().toISOString() };
                const { error } = await supabase.from('iota_ipr_tasks').insert([taskToSave]);
                if (error) throw error;
            }
        } catch (e) {
            console.warn('Error saving to Supabase:', e);
            // simple local fallback logic omitted for brevity in update mode, relies on fetchTasks
        }
        
        setNewTask({ task_name: '', company_name: '', related_asset: 'IOTA 공통', status: '신규', priority: '중간', due_date: new Date().toLocaleDateString('en-CA'), next_action: '', notes: '' });
        setCompanyQuery('');
        setIsAdding(false);
        setEditingTaskId(null);
        setIsSubmittingTask(false);
        fetchTasks();
    };

    const handleDeleteRow = async (id) => {
        setIsDeleting(true);
        try {
            const { error } = await supabase.from('iota_ipr_tasks').delete().eq('id', id);
            if (error) throw error;
        } catch (e) {
            console.warn('Deleting from local storage fallback due to error:', e);
            const updated = tasks.filter(t => t.id !== id);
            localStorage.setItem('iota_ipr_tasks_fallback', JSON.stringify(updated));
        } finally {
            fetchTasks();
            setIsDeleting(false);
            setItemToDelete(null);
        }
    };

    const handleAddClick = () => {
        if (!isAuthorized) {
            setShowAuthAlert(true);
            return;
        }
        if (isAdding) {
            setIsAdding(false);
            setEditingTaskId(null);
            setNewTask({ task_name: '', company_name: '', related_asset: 'IOTA 공통', status: '신규', priority: '중간', due_date: new Date().toLocaleDateString('en-CA'), next_action: '', notes: '' });
            setCompanyQuery('');
        } else {
            setIsAdding(true);
        }
    };

    const handleMoveTaskUp = async (index) => {
        if (index === 0) return;
        const current = sortedTasks[index];
        const prev = sortedTasks[index - 1];
        
        const temp = current.created_at;
        current.created_at = prev.created_at;
        prev.created_at = temp;
        
        const newTasks = tasks.map(t => t.id === current.id ? {...t, created_at: current.created_at} : t.id === prev.id ? {...t, created_at: prev.created_at} : t);
        setTasks(newTasks);
        
        try {
            await supabase.from('iota_ipr_tasks').update({ created_at: current.created_at }).eq('id', current.id);
            await supabase.from('iota_ipr_tasks').update({ created_at: prev.created_at }).eq('id', prev.id);
        } catch (e) {
            localStorage.setItem('iota_ipr_tasks_fallback', JSON.stringify(newTasks));
        }
    };

    const handleMoveTaskDown = async (index) => {
        if (index === sortedTasks.length - 1) return;
        const current = sortedTasks[index];
        const next = sortedTasks[index + 1];
        
        const temp = current.created_at;
        current.created_at = next.created_at;
        next.created_at = temp;
        
        const newTasks = tasks.map(t => t.id === current.id ? {...t, created_at: current.created_at} : t.id === next.id ? {...t, created_at: next.created_at} : t);
        setTasks(newTasks);
        
        try {
            await supabase.from('iota_ipr_tasks').update({ created_at: current.created_at }).eq('id', current.id);
            await supabase.from('iota_ipr_tasks').update({ created_at: next.created_at }).eq('id', next.id);
        } catch (e) {
            localStorage.setItem('iota_ipr_tasks_fallback', JSON.stringify(newTasks));
        }
    };

    const isCoreAsset = (asset) => {
        if (!asset || typeof asset !== 'string') return false;
        const lower = asset.toLowerCase();
        return lower.includes('iota') || lower.includes('이오타') || lower.includes('427') || lower.includes('816') || lower.includes('421');
    };

    const safeTasks = Array.isArray(tasks) ? tasks : [];
    const filteredTasks = safeTasks.filter(t => assetFilter === 'ALL' || isCoreAsset(t.related_asset));
    const sortedTasks = [...filteredTasks].sort((a, b) => {
        const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
        const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
        return (isNaN(timeB) ? 0 : timeB) - (isNaN(timeA) ? 0 : timeA);
    });

    const parseNames = (text) => {
        if (!text) return text;
        const names = ['전기영', '권순일', '윤용택', '정수명', '김성원', '이가현', '박재호', '허재영'];
        let result = text;
        names.forEach(name => {
            const regex = new RegExp(name, 'g');
            result = result.replace(regex, `<span class="text-[#E5E5E5] hover:text-[#fbf167] cursor-pointer transition-colors hover:underline underline-offset-4 decoration-[#fbf167]/50">${name}</span>`);
        });
        return <span dangerouslySetInnerHTML={{ __html: result }} />;
    };

    const [activeTab, setActiveTab] = useState(0);

    return (
                <div className="w-full flex-1 flex flex-col pt-[50px] pb-[100px] max-w-[1200px] mx-auto">
            {/* Header & Team Structure */}
            <div className="w-full flex justify-between items-center mb-[40px] gap-[40px]">
                {/* Header Metadata */}
                <div className="shrink-0 max-w-none whitespace-nowrap">
                    <h1 className="text-[36px] font-bold text-white tracking-tight leading-none font-['Inter'] mb-[12px]">IPR Working Group</h1>
                    <p className="text-[15px] text-[#86868B] leading-[24px]">이오타 CFT는 프리츠 TFT와의 인터페이스를 ‘IPR 워킹그룹(IPR-WG)’ 형태로 운영합니다.</p>
                </div>
                
                {/* Team Structure */}
                <div className="border border-[#333] rounded-[24px] flex items-center bg-transparent shrink-0 pl-[20px] pr-[18px] py-[10px]">

                    {/* 투자 */}
                    <div className="w-[40px] shrink-0">
                        <span className="text-[13px] font-bold text-[#86868B]">투자</span>
                    </div>
                    <div className="flex items-center gap-[12px] w-[126px] shrink-0">
                        <div className="relative w-[30px] h-[30px] shrink-0 rounded-full bg-[#3c3c3c] flex items-center justify-center overflow-hidden ml-[2px]">
                            <img src={`${import.meta.env.BASE_URL}권순일.webp`} alt="권순일" className="w-full h-full object-cover" onError={(e) => { e.target.src = `${import.meta.env.BASE_URL}default_avatar.svg`; }} />
                            <div className="absolute inset-0 rounded-full border border-white/10 pointer-events-none"></div>
                        </div>
                        <div className="flex flex-col text-left">
                            <span className="text-white font-bold text-[13px] leading-tight">권순일</span>
                            <span className="text-[#A1A1AA] text-[12px] mt-[1px] leading-tight">사업1파트장</span>
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-x-1.5 gap-y-2 -ml-[6px]">
                        <span className="text-[#A1A1AA] text-[13px] font-medium leading-none ml-[6px]">사업1파트 실무진</span>
                    </div>

                    {/* Vertical Separator */}
                    <div className="w-px h-[30px] bg-[#333] mx-[20px]"></div>

                    {/* 관리 */}
                    <div className="w-[40px] shrink-0">
                        <span className="text-[13px] font-bold text-[#86868B]">관리</span>
                    </div>
                    <div className="flex items-center gap-[12px] w-[120px] shrink-0">
                        <div className="relative w-[30px] h-[30px] shrink-0 rounded-full bg-[#3c3c3c] flex items-center justify-center overflow-hidden ml-[2px]">
                            <img src={`${import.meta.env.BASE_URL}윤용택.webp`} alt="윤용택" className="w-full h-full object-cover" onError={(e) => { e.target.src = `${import.meta.env.BASE_URL}default_avatar.svg`; }} />
                            <div className="absolute inset-0 rounded-full border border-white/10 pointer-events-none"></div>
                        </div>
                        <div className="flex flex-col text-left">
                            <span className="text-white font-bold text-[13px] leading-tight">윤용택</span>
                            <span className="text-[#A1A1AA] text-[12px] mt-[1px] leading-tight">사업3파트</span>
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-x-1.5 gap-y-2 -ml-[6px]">
                        <span className="text-[#A1A1AA] text-[13px] font-medium leading-none ml-[6px]">신규 영입 예정</span>
                    </div>
                </div>
            </div>

            <WorkspaceActivityLog workspaceCode="WS_IPR" workspaceLabel="IPR" />

            {/* 2. Task 관리 */}
            <div className="w-full mt-0"></div>
            <div className="flex justify-between items-center mb-[10px]">
                <h2 className="text-[18px] font-bold text-white tracking-tight">IPR 주요 테스크 관리</h2>
                <div className="flex gap-2 items-center">
                    <div className="flex bg-[#272726] border border-[#3c3c3c] rounded-[8px] overflow-hidden p-[2px]">
                        <button onClick={() => setAssetFilter('427 PFV')} className={`px-[12px] py-[4px] text-[13px] font-bold rounded-[6px] transition-colors ${assetFilter === '427 PFV' ? 'bg-[#3c3c3c] text-white' : 'text-[#86868B] hover:text-[#E5E5E5]'}`}>이오타서울만 보기</button>
                        <button onClick={() => setAssetFilter('ALL')} className={`px-[12px] py-[4px] text-[13px] font-bold rounded-[6px] transition-colors ${assetFilter === 'ALL' ? 'bg-[#3c3c3c] text-white' : 'text-[#86868B] hover:text-[#E5E5E5]'}`}>전체 자산 보기</button>
                    </div>
                    <button 
                        onClick={() => setProjectShowAll(!projectShowAll)}
                        className="w-[80px] py-[6px] bg-[#272726] border border-[#3c3c3c] text-[#86868B] hover:text-[#E5E5E5] hover:bg-[#333] text-[13px] font-medium rounded-[8px] transition-colors cursor-pointer"
                    >
                        {projectShowAll ? '접기' : '전체보기'}
                    </button>
                    <button 
                        onClick={handleAddClick}
                        className="px-[14px] py-[6px] bg-[#3b82f6]/20 text-[#60a5fa] border border-[#3b82f6]/30 text-[13px] font-bold rounded-[8px] transition-all hover:bg-[#3b82f6]/30 cursor-pointer"
                    >
                        {isAdding ? '등록 취소' : '+ Task 등록하기'}
                    </button>
                </div>
            </div>
            <div className="w-full flex flex-col gap-[16px] mb-[50px]">
                {isAdding && (
                    <div className="w-full bg-[#272726] border border-[#3c3c3c] rounded-[24px] p-6 flex flex-col gap-4">
                        <div className="flex gap-4">
                            <input 
                                type="text" 
                                value={newTask.task_name} 
                                onChange={e => setNewTask({...newTask, task_name: e.target.value})} 
                                className="flex-[2] bg-[#1A1A1A] border border-[#444] rounded-[12px] px-4 py-3 text-white text-[16px] font-bold outline-none focus:border-[#888]" 
                                placeholder="Task 입력" 
                            />
                            <div className="relative flex-1">
                                <input 
                                    type="text" 
                                    value={companyQuery} 
                                    onChange={e => {
                                        setCompanyQuery(e.target.value);
                                        setShowCompanyDropdown(true);
                                        setNewTask({...newTask, company_name: e.target.value});
                                    }}
                                    onFocus={() => setShowCompanyDropdown(true)}
                                    onBlur={() => setTimeout(() => setShowCompanyDropdown(false), 200)}
                                    className="w-full bg-[#1A1A1A] border border-[#444] rounded-[12px] px-4 py-3 text-white text-[16px] outline-none focus:border-[#888]" 
                                    placeholder="이해관계자 검색" 
                                />
                                {showCompanyDropdown && companyQuery && (
                                    <div className="absolute top-full left-0 mt-1 w-full max-h-[150px] overflow-y-auto bg-[#2A2A2A] border border-[#444] rounded-[12px] z-50 shadow-xl py-2">
                                        {filteredCompanies.length > 0 ? (
                                            filteredCompanies.map((c, i) => (
                                                <div 
                                                    key={i} 
                                                    className="px-4 py-2 text-[14px] text-white hover:bg-[#3b82f6] cursor-pointer"
                                                    onMouseDown={(e) => {
                                                        e.preventDefault();
                                                        setCompanyQuery(c);
                                                        setNewTask({...newTask, company_name: c});
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
                        </div>
                        <input 
                            type="text" 
                            value={newTask.next_action} 
                            onChange={e => setNewTask({...newTask, next_action: e.target.value})} 
                            className="w-full bg-[#1A1A1A] border border-[#444] rounded-[12px] px-4 py-3 text-white text-[15px] outline-none focus:border-[#888]" 
                            placeholder="다음 액션 준비사항 입력" 
                        />
                        <input 
                            type="text" 
                            value={newTask.notes || ''} 
                            onChange={e => setNewTask({...newTask, notes: e.target.value})} 
                            className="w-full bg-[#1A1A1A] border border-[#444] rounded-[12px] px-4 py-3 text-[#A1A1AA] text-[14px] outline-none focus:border-[#888]" 
                            placeholder="비고 / 링크 입력 (선택사항)" 
                        />
                        <div className="flex flex-wrap gap-4 items-center">
                            <select 
                                value={newTask.related_asset} 
                                onChange={e => {
                                    if (e.target.value === 'ADD_NEW') setShowNewAssetModal(true);
                                    else setNewTask({...newTask, related_asset: e.target.value});
                                }} 
                                className="bg-[#1A1A1A] border border-[#444] rounded-[10px] px-3 py-2 text-white text-[14px] outline-none focus:border-[#888] cursor-pointer"
                            >
                                <option value="IOTA 공통">IOTA 공통</option>
                                <option value="427 PFV">427 PFV</option>
                                <option value="816 PFV">816 PFV</option>
                                <option value="421 Fund">421 Fund</option>
                                {Array.isArray(customAssets) && customAssets.map(a => typeof a === 'string' ? <option key={a} value={a}>{a}</option> : null)}
                                <option value="ADD_NEW" className="text-[#3b82f6] font-bold">+ 자산 신규 추가</option>
                            </select>
                            <select value={newTask.status} onChange={e => setNewTask({...newTask, status: e.target.value})} className="bg-[#1A1A1A] border border-[#444] rounded-[10px] px-3 py-2 text-white text-[14px] outline-none focus:border-[#888]">
                                {['신규', '검토중', '진행중', '보류', '완료'].map(s => <option key={s}>{s}</option>)}
                            </select>
                            <select value={newTask.priority} onChange={e => setNewTask({...newTask, priority: e.target.value})} className="bg-[#1A1A1A] border border-[#444] rounded-[10px] px-3 py-2 text-white text-[14px] outline-none focus:border-[#888]">
                                <option>높음</option>
                                <option>중간</option>
                                <option>낮음</option>
                            </select>
                            <div className="flex items-center gap-2"><span className="text-[#86868B] text-[13px] font-bold shrink-0">목표 마감일</span><input type="date" value={newTask.due_date} onClick={(e) => e.target.showPicker && e.target.showPicker()} onChange={e => setNewTask({...newTask, due_date: e.target.value})} className="bg-[#1A1A1A] border border-[#444] rounded-[10px] px-3 py-2 text-[#A1A1AA] text-[14px] outline-none focus:border-[#888] cursor-pointer [color-scheme:dark]" /></div>
                            <div className="flex gap-2 ml-auto">
                                <button onClick={() => { setIsAdding(false); setEditingTaskId(null); setCompanyQuery(''); setNewTask({ task_name: '', company_name: '', related_asset: 'IOTA 공통', status: '신규', priority: '중간', due_date: new Date().toLocaleDateString('en-CA'), next_action: '', notes: '' }); }} className="px-5 py-2 bg-[#3c3c3c]/50 text-[#86868B] border border-[#444] rounded-[10px] text-[14px] font-bold hover:bg-[#3c3c3c] hover:text-white transition-colors cursor-pointer">취소</button>
                                <button onClick={handleSaveRow} disabled={isSubmittingTask} className="px-5 py-2 bg-[#059669]/20 text-[#34d399] border border-[#059669]/30 rounded-[10px] text-[14px] font-bold hover:bg-[#059669]/40 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">{isSubmittingTask ? '저장 중...' : editingTaskId ? '수정 완료' : '저장'}</button>
                            </div>
                        </div>
                    </div>
                )}
                
                {isLoadingTasks ? (
                    <div className="text-center py-[40px] text-[#86868B]">데이터를 불러오는 중입니다...</div>
                ) : (
                    <div className="flex flex-col gap-[8px]">
                        <AnimatePresence>
                            {(projectShowAll ? sortedTasks : sortedTasks.slice(0, 5)).map((row, index) => (
                            <motion.div 
                                layout
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                                key={row.id} 
                                onClick={() => setExpandedTaskId((expandedTaskId === 'ALL' || expandedTaskId === row.id) ? null : row.id)}
                                className={`w-full relative bg-[#272726] border border-[#3c3c3c] rounded-[24px] px-6 pt-6 pb-4 cursor-pointer transition-colors duration-300 group/row ${(expandedTaskId === 'ALL' || expandedTaskId === row.id) ? 'hover:bg-[#272726]' : 'hover:bg-[#333]'}`}
                            >
                            {isAuthorized && (
                                <div className="absolute right-[-118px] w-[118px] pl-[8px] top-0 bottom-0 flex items-center justify-start gap-2 opacity-0 group-hover/row:opacity-100 transition-opacity">
                                        <div className="flex flex-col gap-1">
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); handleMoveTaskUp(index); }}
                                                disabled={index === 0}
                                                className={`w-7 h-7 flex items-center justify-center rounded-[6px] bg-[#272726] border border-[#3c3c3c] transition-colors ${index === 0 ? 'opacity-30 cursor-not-allowed' : 'hover:bg-[#333] cursor-pointer'}`}
                                            >
                                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#E5E5E5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15"></polyline></svg>
                                            </button>
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); handleMoveTaskDown(index); }}
                                                disabled={index === (projectShowAll ? sortedTasks.length : Math.min(sortedTasks.length, 5)) - 1}
                                                className={`w-7 h-7 flex items-center justify-center rounded-[6px] bg-[#272726] border border-[#3c3c3c] transition-colors ${index === (projectShowAll ? sortedTasks.length : Math.min(sortedTasks.length, 5)) - 1 ? 'opacity-30 cursor-not-allowed' : 'hover:bg-[#333] cursor-pointer'}`}
                                            >
                                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#E5E5E5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                                            </button>
                                        </div>
                                                                        <div className="flex flex-col gap-1 w-[46px]">
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); setItemToDelete({ id: row.id, message: '정말 삭제하시겠습니까?' }); }} 
                                            className="w-full h-[28px] flex items-center justify-center bg-[#ef4444]/10 text-[#ef4444] border border-[#ef4444]/30 rounded-[6px] text-[12px] font-bold hover:bg-[#ef4444]/20 cursor-pointer"
                                        >
                                            삭제
                                        </button>
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); handleEditRow(row); }} 
                                            className="w-full h-[28px] flex items-center justify-center bg-[#3b82f6]/10 text-[#3b82f6] border border-[#3b82f6]/30 rounded-[6px] text-[12px] font-bold hover:bg-[#3b82f6]/20 cursor-pointer"
                                        >
                                            수정
                                        </button>
                                    </div>
                                </div>
                            )}
                            <div className="flex justify-between items-start gap-8">
                                <div className="flex-1 flex gap-8">
                                    <div className="w-[430px] shrink-0 flex flex-col gap-[2px] border-r border-[#444]/50 pr-8">
                                        <span className="text-[13px] font-bold text-[#86868B] relative -top-[1px]">Task {index + 1}</span>
                                        <h3 className={`text-[21px] font-bold ${index < 5 ? 'text-[#e2aa29]' : 'text-white'} tracking-tight leading-tight`}>
                                            {row.task_name}
                                        </h3>
                                    </div>
                                    <div className="flex-1 flex flex-col gap-[2px] pr-4">
                                        <div className="flex items-center gap-2 mb-1 -translate-y-[2px]">
                                            <span className="text-[13px] font-bold text-[#86868B]">Next Action</span>
                                            {row.due_date && <span className="text-[11px] font-medium text-[#A1A1AA] bg-[#2c2c2e] border border-[#3a3a3c] px-[8px] py-[2px] rounded-full tracking-tight">마감일 목표 {row.due_date}</span>}
                                        </div>
                                        <p className="text-[18px] text-[#bbb9af] leading-relaxed break-keep font-medium -translate-y-[6px]">
                                            {parseNames(row.next_action)}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3 shrink-0">
                                    {row.company_name && (
                                        <span className="text-[13px] font-medium text-[#86868B]">이해관계자</span>
                                    )}
                                    <span className={`text-[15px] px-4 py-2 bg-[#1A1A1A] rounded-[12px] border border-[#333] ${row.company_name ? 'font-bold text-[#E5E5E5]' : 'font-normal text-[#86868B]'}`}>
                                        {row.company_name || '내부업무'}
                                    </span>
                                </div>
                            </div>
                            
                            <div className={`overflow-hidden transition-all duration-300 ease-in-out ${(expandedTaskId === 'ALL' || expandedTaskId === row.id) ? 'max-h-[200px] mt-4 pt-4 border-t border-[#3c3c3c] opacity-100' : 'max-h-0 opacity-0'}`}>
                                <div className="flex justify-start items-center gap-12">
                                    <div className="flex items-center gap-3">
                                        <span className="text-[13px] font-bold text-[#86868B]">관련 자산</span>
                                        <span className="text-[16px] text-white font-medium">{row.related_asset}</span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className="text-[13px] font-bold text-[#86868B]">상태</span>
                                        <span className={`px-2 py-1 rounded-[6px] text-[13px] font-bold w-max ${row.status === '진행중' ? 'bg-[#059669]/20 text-[#34d399]' : row.status === '검토중' ? 'bg-[#d97706]/20 text-[#fbf167]' : row.status === '완료' ? 'bg-[#2563eb]/20 text-[#60a5fa]' : 'bg-[#4b5563]/20 text-[#9ca3af]'}`}>
                                            {row.status}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className="text-[13px] font-bold text-[#86868B]">중요도</span>
                                        <span className={`text-[16px] font-bold ${row.priority === '높음' ? 'text-[#ef4444]' : row.priority === '중간' ? 'text-[#3b82f6]' : 'text-[#10b981]'}`}>{row.priority}</span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className="text-[13px] font-bold text-[#86868B]">마감일</span>
                                        <span className="text-[16px] text-[#A1A1AA] font-['Inter'] font-medium">{row.due_date}</span>
                                    </div>
                                </div>
                                {row.notes && (
                                <div className="flex items-start gap-4 mt-4 pt-4 border-t border-[#3c3c3c]/50">
                                    <span className="text-[13px] font-bold text-[#86868B] shrink-0 mt-[2px]">비고/링크</span>
                                    <span className="text-[14px] text-white font-medium break-all">
                                        {row.notes.startsWith('http') ? <a href={row.notes} target="_blank" rel="noreferrer" className="text-[#2997ff] hover:underline">{row.notes}</a> : row.notes}
                                    </span>
                                </div>
                                )}
                                </div>
                            </motion.div>
                            ))}
                        </AnimatePresence>
                    </div>
                )}
            </div>

            
            <div className="w-full border-b border-[#333] mt-[20px] mb-[40px]"></div>

            <div className="pb-[40px]">
            <h2 className="text-[20px] font-bold text-white mb-[16px]">Forward Purchase 구조 설계 5단계</h2>
            
            <div className="flex flex-col gap-[12px]">
                <div className="bg-[#292928] border border-[#3c3c3c] rounded-[16px] p-[24px] flex items-center gap-6">
                    <div className="w-[100px] font-black text-[24px] text-[#bbb9af]">Stage 0</div>
                    <div className="w-px h-[40px] bg-[#444]"></div>
                    <div className="flex-1">
                        <span className="text-[16px] font-bold text-white block mb-1">조기 의향 확인</span>
                        <span className="text-[15px] text-[#A1A1AA]">프리츠 TFT가 이오타 자산을 IPR 편입 후보로 ‘예비등록’</span>
                    </div>
                </div>

                <div className="bg-[#292928] border border-[#3c3c3c] rounded-[16px] p-[24px] flex items-center gap-6">
                    <div className="w-[100px] font-black text-[24px] text-[#fbf167]">Stage 1</div>
                    <div className="w-px h-[40px] bg-[#444]"></div>
                    <div className="flex-1">
                        <span className="text-[16px] font-bold text-[#fbf167] block mb-1">옵션 설계</span>
                        <span className="text-[15px] text-[#A1A1AA]">가격결정 메커니즘(고정/변동), 인도시점, 옵션 수수료 구조</span>
                    </div>
                </div>

                <div className="bg-[#292928] border border-[#3c3c3c] rounded-[16px] p-[24px] flex items-center gap-6">
                    <div className="w-[100px] font-black text-[24px] text-[#bbb9af]">Stage 2</div>
                    <div className="w-px h-[40px] bg-[#444]"></div>
                    <div className="flex-1">
                        <span className="text-[16px] font-bold text-white block mb-1">권순약정 초안</span>
                        <span className="text-[15px] text-[#A1A1AA]">외부 법무자문 선정 → 권순약정·우선매수약정 초안 작성</span>
                    </div>
                </div>

                <div className="bg-[#292928] border border-[#3c3c3c] rounded-[16px] p-[24px] flex items-center gap-6">
                    <div className="w-[100px] font-black text-[24px] text-[#bbb9af]">Stage 3</div>
                    <div className="w-px h-[40px] bg-[#444]"></div>
                    <div className="flex-1">
                        <span className="text-[16px] font-bold text-white block mb-1">외부 검증</span>
                        <span className="text-[15px] text-[#A1A1AA]">회계자문(세무)·감정평가(가격) 병렬 진행, 시나리오별 IRR/Cap Rate 검증</span>
                    </div>
                </div>

                <div className="bg-[#292928] border border-[#3c3c3c] rounded-[16px] p-[24px] flex items-center gap-6">
                    <div className="w-[100px] font-black text-[24px] text-[#bbb9af]">Stage 4</div>
                    <div className="w-px h-[40px] bg-[#444]"></div>
                    <div className="flex-1">
                        <span className="text-[16px] font-bold text-white block mb-1">LP 사전 통지</span>
                        <span className="text-[15px] text-[#A1A1AA]">421호 펀드 LP에 IPR 편입 시나리오 사전 통지·의향 청취</span>
                    </div>
                </div>

                <div className="bg-[#292928] border border-[#3c3c3c] rounded-[16px] p-[24px] flex items-center gap-6">
                    <div className="w-[100px] font-black text-[24px] text-[#bbb9af]">Stage 5</div>
                    <div className="w-px h-[40px] bg-[#444]"></div>
                    <div className="flex-1">
                        <span className="text-[16px] font-bold text-white block mb-1">약정 체결·공시</span>
                        <span className="text-[15px] text-[#A1A1AA]">정식 권순약정 체결 후 운용보고에 반영</span>
                    </div>
                </div>
            </div>

            <div className="mt-[56px] pt-[48px] border-t border-[#333]">
                <h2 className="text-[20px] font-bold text-white mb-[8px]">외부 자문 선정 프로세스</h2>
                <p className="text-[15px] text-[#A1A1AA] leading-[26px] mb-[24px]">
                    법무·회계·감정 3개 분야 모두 <strong className="text-white font-bold">‘이오타 전담’</strong> 자문사를 별도 선정합니다. 부문 전체 자문사 풀과는 분리하여 이해상충을 최소화합니다.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-[16px]">
                    <div className="bg-[#1A1A1A] rounded-[16px] p-[24px] flex flex-col gap-[12px] border border-[#333] hover:border-[#555] transition-colors">
                        <div className="flex items-center gap-[8px]">
                            <div className="w-[8px] h-[8px] rounded-full bg-[#2997FF]"></div>
                            <h3 className="text-[17px] font-bold text-white">법무</h3>
                        </div>
                        <p className="text-[15px] text-[#A1A1AA] leading-[24px]">
                            부동산금융·REITs·M&A 모두 가능한 펌 + 송무 보강 펌의 <strong className="text-[#E5E5E5] font-bold">듀얼 트랙</strong>
                        </p>
                    </div>
                    <div className="bg-[#1A1A1A] rounded-[16px] p-[24px] flex flex-col gap-[12px] border border-[#333] hover:border-[#555] transition-colors">
                        <div className="flex items-center gap-[8px]">
                            <div className="w-[8px] h-[8px] rounded-full bg-[#2997FF]"></div>
                            <h3 className="text-[17px] font-bold text-white">회계</h3>
                        </div>
                        <p className="text-[15px] text-[#A1A1AA] leading-[24px]">
                            빅 4 중 1개사로 세무·검토·자문 분리 계약, <strong className="text-[#E5E5E5] font-bold">감사인은 별도 풀에서 지정</strong>
                        </p>
                    </div>
                    <div className="bg-[#1A1A1A] rounded-[16px] p-[24px] flex flex-col gap-[12px] border border-[#333] hover:border-[#555] transition-colors">
                        <div className="flex items-center gap-[8px]">
                            <div className="w-[8px] h-[8px] rounded-full bg-[#2997FF]"></div>
                            <h3 className="text-[17px] font-bold text-white">감정</h3>
                        </div>
                        <p className="text-[15px] text-[#A1A1AA] leading-[24px]">
                            2개사 병렬 평가, 차이 5% 초과 시 <strong className="text-[#E5E5E5] font-bold">제 3자 평가 트리거</strong>
                        </p>
                    </div>
                </div>
            </div>
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
                                value={newStakeholderRole}
                                onChange={(e) => setNewStakeholderRole(e.target.value)}
                                className="w-full bg-[#1A1A1A] border border-[#333] rounded-[8px] pl-[12px] pr-[30px] py-[10px] text-[13px] text-white outline-none focus:border-[#2997ff] appearance-none cursor-pointer"
                            >
                                <option value="" disabled>이해관계자 분류 선택</option>
                                <option value="SI">SI</option>
                                <option value="잠재임차사">잠재임차사</option>
                                <option value="운영 파트너">운영 파트너</option>
                            </select>
                        </div>

                        <div className="flex items-center gap-[12px] w-full">
                            <button onClick={() => setShowNewStakeholderModal(false)} className="flex-1 py-[10px] rounded-[8px] bg-[#333] hover:bg-[#444] text-white text-[13px] font-medium transition-colors cursor-pointer">취소</button>
                            <button onClick={registerMasterStakeholder} className="flex-1 py-[10px] rounded-[8px] bg-[#2997ff] hover:bg-[#0071e3] text-white text-[13px] font-bold transition-colors cursor-pointer">등록 후 저장</button>
                        </div>
                    </div>
                </div>
            )}
            
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
                                onClick={() => handleDeleteRow(itemToDelete.id)}
                                className="flex-1 py-[10px] rounded-[8px] bg-white hover:bg-gray-200 text-black text-[13px] font-bold transition-colors flex justify-center items-center"
                                disabled={isDeleting}
                            >
                                {isDeleting ? '삭제 중...' : '삭제'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showNewAssetModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60">
                    <div className="bg-[#222] border border-[#333] rounded-[16px] w-[320px] p-[24px] shadow-2xl flex flex-col items-center">
                        <div className="w-[48px] h-[48px] rounded-full bg-white/10 flex items-center justify-center mb-[16px]">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2997ff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="16"></line><line x1="8" y1="12" x2="16" y2="12"></line></svg>
                        </div>
                        <h3 className="text-white text-[16px] font-bold mb-[8px]">신규 자산 등록</h3>
                        <p className="text-[#86868B] text-[13px] text-center mb-[20px]">마케팅 관리가 필요한<br/>새로운 관련 자산을 등록합니다.</p>
                        
                        <div className="w-full flex flex-col gap-[12px] mb-[20px]">
                            <input 
                                type="text"
                                value={newAssetName}
                                onChange={e => setNewAssetName(e.target.value)}
                                placeholder="자산명 (예: 타임워크 신도림)"
                                className="w-full bg-[#1A1A1A] border border-[#444] rounded-[8px] px-[12px] py-[10px] text-white text-[13px] outline-none focus:border-[#888]"
                            />
                        </div>

                        <div className="flex items-center gap-[12px] w-full">
                            <button onClick={() => { setShowNewAssetModal(false); setNewAssetName(''); }} className="flex-1 py-[10px] rounded-[8px] bg-[#333] hover:bg-[#444] text-white text-[13px] font-medium transition-colors">취소</button>
                            <button onClick={registerNewAsset} disabled={isSubmittingAsset} className="flex-1 py-[10px] rounded-[8px] bg-[#2997ff] hover:bg-[#0071e3] text-white text-[13px] font-bold transition-colors">{isSubmittingAsset ? '등록 중...' : '등록 후 저장'}</button>
                        </div>
                    </div>
                </div>
            )}
            {showAuthAlert && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60">
                    <div className="bg-[#222] border border-[#333] rounded-[16px] w-[320px] p-[24px] shadow-2xl flex flex-col items-center">
                        <div className="w-[48px] h-[48px] rounded-full bg-white/10 flex items-center justify-center mb-[16px]">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fbf167" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                        </div>
                        <h3 className="text-[16px] font-bold text-white mb-[8px] text-center">권한 없음</h3>
                        <p className="text-[13px] text-[#86868B] text-center mb-[24px]">권한이 없습니다.</p>
                        <button 
                            type="button"
                            onClick={() => setShowAuthAlert(false)}
                            className="w-full py-[10px] rounded-[8px] bg-white hover:bg-gray-200 text-black text-[13px] font-bold transition-colors"
                        >
                            확인
                        </button>
                    </div>
                </div>
            )}
        </div>
    </div>
    );
}
