import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import WorkspaceActivityLog from './WorkspaceActivityLog';
import { supabase } from '../../../utils/supabaseClient';
import { fetchWithRetry } from '../../../utils/fetchWithRetry';

export default function WorkspaceFund() {

    const { memberInfo } = useAuth();
    const isAuthorized = ['전기영', '김행단', '이동명', '최선영'].includes(memberInfo?.staff_name);

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
                .from('iota_fund_tasks')
                .select('*')
                .order('created_at', { ascending: false });
            if (error) {
                console.warn('Falling back to local storage for tasks:', error);
                const localData = localStorage.getItem('iota_fund_tasks_fallback');
                if (localData) setTasks(JSON.parse(localData));
                else setTasks([]);
            } else {
                setTasks(data || []);
            }
        } catch (e) {
            console.error('Failed to fetch tasks:', e);
            const localData = localStorage.getItem('iota_fund_tasks_fallback');
            if (localData) setTasks(JSON.parse(localData));
        } finally {
            setIsLoadingTasks(false);
        }
    };

    useEffect(() => {
        if (!isLoadingTasks && tasks.length > 0) {
            const targetTaskId = localStorage.getItem('iota_target_task_id');
            if (targetTaskId) {
                const targetTask = tasks.find(t => t.id === targetTaskId);
                if (targetTask) {
                    setProjectShowAll(true);
                    setExpandedTaskId(targetTaskId);
                    setTimeout(() => {
                        const el = document.getElementById(`task-${targetTaskId}`);
                        if (el) {
                            el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        }
                        localStorage.removeItem('iota_target_task_id');
                    }, 500);
                }
            }
        }
    }, [isLoadingTasks, tasks]);

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
        document.getElementById('task-management')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    const handleSaveRow = async () => {
        if (!newTask.task_name) return alert('Task 명을 입력해주세요.');
        setIsSubmittingTask(true);
        try {
            if (editingTaskId) {
                const { error } = await supabase.from('iota_fund_tasks').update(newTask).eq('id', editingTaskId);
                if (error) throw error;
            } else {
                const taskToSave = { ...newTask, id: Date.now().toString(), created_at: new Date().toISOString() };
                const { error } = await supabase.from('iota_fund_tasks').insert([taskToSave]);
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
            const { error } = await supabase.from('iota_fund_tasks').delete().eq('id', id);
            if (error) throw error;
        } catch (e) {
            console.warn('Deleting from local storage fallback due to error:', e);
            const updated = tasks.filter(t => t.id !== id);
            localStorage.setItem('iota_fund_tasks_fallback', JSON.stringify(updated));
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
            await supabase.from('iota_fund_tasks').update({ created_at: current.created_at }).eq('id', current.id);
            await supabase.from('iota_fund_tasks').update({ created_at: prev.created_at }).eq('id', prev.id);
        } catch (e) {
            localStorage.setItem('iota_fund_tasks_fallback', JSON.stringify(newTasks));
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
            await supabase.from('iota_fund_tasks').update({ created_at: current.created_at }).eq('id', current.id);
            await supabase.from('iota_fund_tasks').update({ created_at: next.created_at }).eq('id', next.id);
        } catch (e) {
            localStorage.setItem('iota_fund_tasks_fallback', JSON.stringify(newTasks));
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
        const names = ['전기영', '김행단', '이동명', '최선영'];
        let result = text;
        names.forEach(name => {
            const regex = new RegExp(name, 'g');
            result = result.replace(regex, `<span class="text-[#E5E5E5] hover:text-[#fbf167] cursor-pointer transition-colors hover:underline underline-offset-4 decoration-[#fbf167]/50">${name}</span>`);
        });
        return <span dangerouslySetInnerHTML={{ __html: result }} />;
    };

    const [iotaData, setIotaData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [selectedInst, setSelectedInst] = useState(null);
    const [showAllLps, setShowAllLps] = useState(false);

    useEffect(() => {
        const controller = new AbortController();

        const fetchData = async () => {
            try {
                const { data, error } = await fetchWithRetry(
                    () => supabase.from('iota_capital_stack').select('*').eq('vehicle_name', '421').abortSignal(controller.signal),
                    3, 
                    500, 
                    controller.signal
                );
                if (controller.signal.aborted) return;

                if (error) {
                    console.error("Supabase API Error:", error);
                    setIotaData({ error: error.message });
                    return;
                }
                if (data) {
                    const grouped = {
                        421: { Current: {} }
                    };

                    data.forEach(item => {
                        const v = parseInt(item.vehicle_name);
                        const p = item.phase;
                        let tranche = item.tranche_name;
                        let type = item.tranche_type;
                        let sortOrder = 0;
                        let originalTranche = tranche;

                        if (grouped[v] && grouped[v][p]) {
                            if (!grouped[v][p][tranche]) {
                                grouped[v][p][tranche] = [];
                            }
                            grouped[v][p][tranche].push({
                                name: item.institution_name,
                                amount: item.amount_krw_100m.toLocaleString(),
                                rawAmount: item.amount_krw_100m,
                                type: type,
                                originalTranche: originalTranche,
                                sortOrder: sortOrder
                            });
                        }
                    });

                    Object.keys(grouped[421].Current).forEach(t => {
                        const arr = grouped[421].Current[t];
                        arr.sort((a,b) => {
                            if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
                            return b.rawAmount - a.rawAmount;
                        });
                        let idx = 1;
                        arr.forEach(item => {
                            if (!item.isSubHeader) {
                                item.displayIndex = idx++;
                            }
                        });
                    });

                    setIotaData(grouped);
                }
            } catch (error) {
                if (controller.signal.aborted) return;
                console.error("Unhandled Exception:", error);
            } finally {
                if (!controller.signal.aborted) setLoading(false);
            }
        };
        fetchData();
        return () => controller.abort();
    }, []);

    const navigateTo = (path) => {
        const base = import.meta.env.BASE_URL;
        const url = base.endsWith('/') ? `${base}${path}` : `${base}/${path}`;
        window.history.pushState(null, '', url);
        window.dispatchEvent(new PopStateEvent('popstate'));
    };

    const handleInstClick = (instName, tranche, amount) => {
        setSelectedInst({ name: instName, tranche, amount });
    };

    const formatAmount = (rawAmt) => {
        const amt = Math.round(rawAmt); // 소수점 반올림
        const jo = Math.floor(amt / 10000);
        const uk = amt % 10000;
        let formattedUk = uk.toLocaleString('ko-KR');
        if (jo > 0) {
            if (uk === 0) return `${jo}조원`;
            return `${jo}조 ${formattedUk}억원`;
        }
        return `${formattedUk}억원`;
    };

    const getTotal = (v, p = 'Current') => {
        let sum = 0;
        if (iotaData[v] && iotaData[v][p]) {
            Object.values(iotaData[v][p]).forEach(trancheArray => {
                sum += trancheArray.reduce((a, b) => a + (parseFloat(b.rawAmount) || 0), 0);
            });
        }
        return sum;
    };

    const VehicleDetailCard = ({ id, vehicleId, title, totalAmountStr, data, toggleContent }) => {
        const [hoveredBarTranche, setHoveredBarTranche] = useState(null);
        let totalEquity = 0;
        let totalLoan = 0;
        
        Object.values(data).forEach(trancheArray => {
            trancheArray.forEach(item => {
                if (item.isSubHeader) return;
                if (item.type === 'Equity') totalEquity += (item.rawAmount || 0);
                else totalLoan += (item.rawAmount || 0);
            });
        });
        
        const totalSum = totalEquity + totalLoan;
        const tranches = Object.keys(data);
        const sortedTranches = tranches.sort((a, b) => {
            if (a.includes('Tr.') && b.includes('Tr.')) return a.localeCompare(b);
            if (a.includes('Tr.')) return 1;
            if (b.includes('Tr.')) return -1;
            return a.localeCompare(b);
        });

        // Ensure we have formatAmount
        const amtFmt = (rawAmt) => {
            const amt = Math.round(rawAmt);
            const jo = Math.floor(amt / 10000);
            const uk = amt % 10000;
            let formattedUk = uk.toLocaleString('ko-KR');
            if (jo > 0) {
                if (uk === 0) return `${jo}조원`;
                return `${jo}조 ${formattedUk}억원`;
            }
            return `${formattedUk}억원`;
        };

        const getTrancheColor = (trancheName) => {
            if (trancheName.includes('Equity') || trancheName.includes('보통주') || (trancheName.includes('종류주') && !trancheName.includes('수익증권')) || trancheName.includes('주주대여금')) return 'text-white';
            if (trancheName.includes('Tr.A') || trancheName.includes('Tr. A') || trancheName.includes('A종')) return 'text-[#5da0e7]';
            if (trancheName.includes('Tr.B') || trancheName.includes('Tr. B') || trancheName.includes('B종')) return 'text-[#3aaab3]';
            if (trancheName.includes('Tr.C') || trancheName.includes('Tr. C') || trancheName.includes('C종')) return 'text-[#b889d9]';
            if (trancheName.includes('Tr.D') || trancheName.includes('Tr. D') || trancheName.includes('D종')) return 'text-[#cd879c]';
            return 'text-white';
        };

        const getTrancheHoverColor = (trancheName) => {
            if (trancheName.includes('Equity') || trancheName.includes('보통주') || (trancheName.includes('종류주') && !trancheName.includes('수익증권')) || trancheName.includes('주주대여금')) return 'group-hover:text-[#eab308]';
            if (trancheName.includes('Tr.A') || trancheName.includes('Tr. A') || trancheName.includes('A종')) return 'group-hover:text-[#5da0e7]';
            if (trancheName.includes('Tr.B') || trancheName.includes('Tr. B') || trancheName.includes('B종')) return 'group-hover:text-[#3aaab3]';
            if (trancheName.includes('Tr.C') || trancheName.includes('Tr. C') || trancheName.includes('C종')) return 'group-hover:text-[#b889d9]';
            if (trancheName.includes('Tr.D') || trancheName.includes('Tr. D') || trancheName.includes('D종')) return 'group-hover:text-[#cd879c]';
            return 'group-hover:text-white';
        };

        const getTrancheBgColor = (trancheName) => {
            if (trancheName.includes('Equity') || trancheName.includes('보통주') || (trancheName.includes('종류주') && !trancheName.includes('수익증권'))) return 'bg-black';
            if (trancheName.includes('주주대여금') || trancheName.includes('주주대여')) return 'bg-[#254266]';
            if (trancheName.includes('Tr.A-2')) return 'bg-[#315780]';
            if (trancheName.includes('Tr.A-1')) return 'bg-[#4572a1]';
            if (trancheName.includes('Tr.A') || trancheName.includes('Tr. A') || trancheName.includes('A종')) return 'bg-[#4572a1]';
            if (trancheName.includes('Tr.B-2')) return 'bg-[#18464a]';
            if (trancheName.includes('Tr.B-1')) return 'bg-[#2c777d]';
            if (trancheName.includes('Tr.B') || trancheName.includes('Tr. B') || trancheName.includes('B종')) return 'bg-[#2c777d]';
            if (trancheName.includes('Tr.C') || trancheName.includes('Tr. C') || trancheName.includes('C종')) return 'bg-[#85609e]';
            if (trancheName.includes('Tr.D') || trancheName.includes('Tr. D') || trancheName.includes('D종')) return 'bg-[#966171]';
            return 'bg-[#444]';
        };

        const gfa = vehicleId === '427' ? '102,540평' : '36,537평';
        const officeArea = vehicleId === '427' ? '34,470평' : '15,529평';
        const retailArea = vehicleId === '427' ? '1,569평' : '1,022평';
        const hotelArea = vehicleId === '427' ? '5,121평' : '-평';

        return (
            <div id={id} className="mb-[28px]">
                <div className="flex justify-between items-end mb-[12px]">
                    <h2 className="text-[24px] font-bold text-white tracking-tight">{title}</h2>
                    {toggleContent}
                </div>

                {/* Dashboard Metrics Cards */}
                {vehicleId !== '421' && (
                <div className="w-full flex gap-[20px] mb-[20px]">
                    <div className="w-[390px] h-[274px] flex flex-col gap-[20px]">
                        <div className="w-full flex-1 bg-[#292928] border border-[#3c3c3c] rounded-[32px] pr-6 flex flex-row items-center transition-colors duration-300">
                            <div className="w-[114px] flex flex-col justify-between border-r border-[#444]/50 h-[54px] pl-[24px]">
                                <span className="text-[14px] font-bold text-[#86868B] font-['Inter'] whitespace-nowrap">공급 예정</span>
                                <span className="text-[28px] font-bold text-white tracking-tight leading-none mt-[-2px] whitespace-nowrap">2032</span>
                            </div>
                            <div className="w-[100px] flex flex-col justify-between border-r border-[#444]/50 h-[54px] pl-[18px]">
                                <span className="text-[14px] font-bold text-[#86868B] font-['Inter'] whitespace-nowrap">Brand</span>
                                <img src={`${import.meta.env.BASE_URL}iota-logo.png`} alt="IOTA" className="h-[22px] object-contain object-left mt-0 opacity-100 mb-[4px]" />
                            </div>
                            <div className="flex-1 flex flex-col justify-between h-[54px] pl-[20px] overflow-hidden">
                                <span className="text-[14px] font-bold text-[#86868B] font-['Inter'] whitespace-nowrap">연면적</span>
                                <span className="text-[28px] font-bold text-white tracking-tight leading-none mt-[-2px] whitespace-nowrap">{gfa}</span>
                            </div>
                        </div>

                        <div className="w-full flex-1 bg-[#292928] border border-[#3c3c3c] rounded-[32px] px-6 pb-[8px] flex flex-row items-center transition-colors duration-300">
                            <div className="flex-[1.4] flex flex-col justify-center border-r border-[#444]/50 h-[74px] pr-5">
                                <span className="text-[14px] font-bold text-[#86868B] mb-[10px] font-['Inter']">개발기간</span>
                                <div className="flex items-center justify-start gap-[10px] mb-[4px]">
                                    <span className="text-[28px] font-bold text-[#A1A1AA] tracking-tighter leading-none">67M</span>
                                    <span className="text-[20px] text-[#666] leading-none mb-1 font-bold">→</span>
                                    <span className="text-[28px] font-bold text-white tracking-tighter leading-none">116M</span>
                                </div>
                                <div className="flex justify-start gap-[24px] w-full">
                                    <span className="text-[11px] text-[#666] font-['Inter'] leading-none">UW 2022.12</span>
                                    <span className="text-[11px] text-[#A1A1AA] font-['Inter'] leading-none">As-is 2026.03</span>
                                </div>
                            </div>
                            <div className="flex-[1] flex flex-col justify-center pl-6 h-[74px]">
                                <span className="text-[14px] font-bold text-[#86868B] mb-[10px] font-['Inter']">전용면적</span>
                                <div className="flex flex-col gap-[6px]">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[14px] text-[#86868B] leading-none">업무</span>
                                        <span className="text-[16px] font-bold text-white leading-none">{officeArea}</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-[14px] text-[#86868B] leading-none">리테일</span>
                                        <span className="text-[16px] font-bold text-white leading-none">{retailArea}</span>
                                    </div>
                                    {vehicleId !== '816' && (
                                    <div className="flex items-center justify-between">
                                        <span className="text-[14px] text-[#86868B] leading-none">호텔</span>
                                        <span className="text-[16px] font-bold text-white leading-none">{hotelArea}</span>
                                    </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex-1 h-[274px] bg-[#292928] border border-[#3c3c3c] rounded-[32px] overflow-hidden relative flex flex-col transition-colors duration-300">
                        <div className="absolute top-1/2 left-0 right-0 h-px bg-[#3C3C3C] z-0" />
                        <div className="absolute top-[0px] bottom-[0px] left-1/2 w-px bg-[#3C3C3C] z-0" />
                        
                        <div className="grid grid-cols-2 grid-rows-2 w-full h-full relative z-10">
                            <div className="relative flex flex-col justify-end px-[32px] pb-[32px]">
                                <span className="absolute top-[20px] left-[20px] text-[15px] font-bold text-[#86868B] font-['Inter'] tracking-tight">원가</span>
                                <div className="flex items-end justify-end gap-3 w-full">
                                    <div className="flex flex-col items-end">
                                        <span className="text-[11px] text-[#666] mb-0 leading-none font-['Inter']">UW 2022.12</span>
                                        <span className="text-[13px] text-[#86868B] mb-[6px]">4,380 만원/평</span>
                                        <span className="text-[28px] font-bold text-[#A1A1AA] tracking-tighter leading-none">1조 6,000억</span>
                                    </div>
                                    <span className="text-[20px] text-[#666] mb-[1px] font-bold mr-[-2px]">→</span>
                                    <div className="flex flex-col items-end w-[138px] whitespace-nowrap">
                                        <span className="text-[11px] text-white mb-0 leading-none font-medium font-['Inter'] whitespace-nowrap">As-is 2026.03</span>
                                        <span className="text-[13px] text-white mb-[6px] whitespace-nowrap">6,053 만원/평</span>
                                        <span className="text-[28px] font-bold text-[#bbb9af] tracking-tighter leading-none whitespace-nowrap">2조 1,964억</span>
                                    </div>
                                </div>
                            </div>
                            
                            <div className="relative flex flex-col justify-end px-[32px] pb-[32px]">
                                <span className="absolute top-[20px] left-[20px] text-[15px] font-bold text-[#86868B] font-['Inter'] tracking-tight">매각 목표</span>
                                <div className="flex items-end justify-end gap-3 w-full">
                                    <div className="flex flex-col items-end">
                                        <span className="text-[11px] text-[#666] mb-0 leading-none font-['Inter']">UW 2022.12</span>
                                        <span className="text-[13px] text-[#86868B] mb-[6px]">4,600 만원/평</span>
                                        <span className="text-[28px] font-bold text-[#A1A1AA] tracking-tighter leading-none">1조 8,070억</span>
                                    </div>
                                    <span className="text-[20px] text-[#666] mb-[1px] font-bold mr-[-2px]">→</span>
                                    <div className="flex flex-col items-end w-[138px] whitespace-nowrap">
                                        <span className="text-[11px] text-white mb-0 leading-none font-medium font-['Inter'] whitespace-nowrap">As-is 2026.03</span>
                                        <span className="text-[13px] text-white mb-[6px] whitespace-nowrap"><span className="text-[#86868B] font-['Inter'] mr-1 tracking-tight">Target</span>6,500 만원/평</span>
                                        <span className="text-[28px] font-bold text-[#bbb9af] tracking-tighter leading-none whitespace-nowrap">2조 3,749억</span>
                                    </div>
                                </div>
                            </div>

                            <div className="relative flex flex-col justify-end px-[32px] pb-[34px]">
                                <span className="absolute top-[20px] left-[20px] text-[15px] font-bold text-[#86868B] font-['Inter'] tracking-tight">수익률 목표</span>
                                <div className="flex items-end justify-end gap-3 w-full">
                                    <div className="flex flex-col items-end">
                                        <span className="text-[11px] text-[#666] mb-0 leading-none font-['Inter']">UW 2022.12</span>
                                        <span className="text-[13px] text-[#86868B] mb-[6px] font-['Inter']">EM x1.75</span>
                                        <span className="text-[28px] font-bold text-[#A1A1AA] tracking-tighter leading-none font-['Inter']">IRR 10.5%</span>
                                    </div>
                                    <span className="text-[20px] text-[#666] mb-[1px] font-bold mr-[-2px]">→</span>
                                    <div className="flex flex-col items-end w-[138px] whitespace-nowrap">
                                        <span className="text-[11px] text-white mb-0 leading-none font-medium font-['Inter'] whitespace-nowrap">As-is 2026.03</span>
                                        <span className="text-[13px] text-white mb-[6px] font-['Inter'] whitespace-nowrap"><span className="text-[#86868B] mr-1 tracking-tight">Target</span>EM x1.73</span>
                                        <span className="text-[28px] font-bold text-[#bbb9af] tracking-tighter leading-none font-['Inter'] whitespace-nowrap">IRR 10.5%</span>
                                    </div>
                                </div>
                            </div>

                            <div className="relative flex flex-col justify-end px-[32px] pb-[34px]">
                                <span className="absolute top-[20px] left-[20px] text-[15px] font-bold text-[#86868B] font-['Inter'] tracking-tight">E.NOC 목표</span>
                                <div className="flex items-end justify-end gap-3 w-full">
                                    <div className="flex flex-col items-end">
                                        <span className="text-[11px] text-[#666] mb-0 leading-none font-['Inter']">UW 2022.12</span>
                                        <span className="text-[13px] text-[#86868B] mb-[6px]">2027년 기준</span>
                                        <span className="text-[28px] font-bold text-[#A1A1AA] tracking-tighter leading-none">37.5만원</span>
                                    </div>
                                    <span className="text-[20px] text-[#666] mb-[1px] font-bold mr-[-2px]">→</span>
                                    <div className="flex flex-col items-end w-[138px] whitespace-nowrap">
                                        <span className="text-[11px] text-white mb-0 leading-none font-medium font-['Inter'] whitespace-nowrap">As-is 2026.03</span>
                                        <span className="text-[13px] text-white mb-[6px] whitespace-nowrap">2032년 기준</span>
                                        <span className="text-[28px] font-bold text-[#bbb9af] tracking-tighter leading-none whitespace-nowrap">64.3만원</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                )}

                {/* Visual Tranche Bar */}
                <div className="w-full mb-[20px]">
                    {(() => {
                        const allItems = Object.values(data).flat();
                        const barGroups = {};
                        allItems.forEach(item => {
                            if (item.isSubHeader) return;
                            let bT = item.originalTranche || item.type;
                            if (vehicleId !== '421') {
                                if (bT === '보통주' || bT === '1종 종류주 등' || (bT.includes('종류주') && !bT.includes('수익증권')) || bT === 'Equity') bT = 'Equity';
                                if (bT === '주주대여금' || bT === '주주대여') bT = '주주대여';
                            }
                            if (!barGroups[bT]) barGroups[bT] = 0;
                            barGroups[bT] += (item.rawAmount || 0);
                        });
                        
                        const order = {'Equity':1, '주주대여':2, 'Tr.A':3, 'Tr.A-1':3.1, 'Tr.A-2':3.2, 'Tr.B':4, 'Tr.B-1':4.1, 'Tr.B-2':4.2, 'Tr.C':5, 'Tr.D':6, 'A종 수익증권':3, 'B종 수익증권':4, 'C종 수익증권':5};
                        const sortedBarKeys = Object.keys(barGroups).sort((a,b) => (order[a] || 99) - (order[b] || 99));

                        return (
                            <div className="w-full h-[60px] relative rounded-[20px] bg-[#292928] select-none">
                                {/* Colored Bar Layer */}
                                <div className="absolute inset-0 flex w-full h-full rounded-[20px] overflow-hidden">
                                    {sortedBarKeys.map(tName => {
                                        const tSum = barGroups[tName];
                                        if (tSum === 0) return null;
                                        const exactPct = totalSum > 0 ? ((tSum / totalSum) * 100).toFixed(6) : 0;
                                        return (
                                            <div 
                                                key={`bg-${tName}`} 
                                                className={`h-full transition-opacity duration-300 ${getTrancheBgColor(tName)} ${hoveredBarTranche && hoveredBarTranche !== tName ? 'opacity-40' : ''}`} 
                                                style={{ width: `${exactPct}%` }}
                                            />
                                        );
                                    })}
                                </div>
                                {/* Text Overlay & Interaction Layer */}
                                <div className="absolute inset-0 flex w-full h-full">
                                    {sortedBarKeys.map(tName => {
                                        const tSum = barGroups[tName];
                                        if (tSum === 0) return null;
                                        const pct = totalSum > 0 ? ((tSum / totalSum) * 100).toFixed(1) : 0;
                                        const exactPct = totalSum > 0 ? ((tSum / totalSum) * 100).toFixed(6) : 0;
                                        return (
                                            <div 
                                                key={`text-${tName}`} 
                                                className="h-full flex flex-col items-center justify-center relative cursor-pointer" 
                                                style={{ width: `${exactPct}%` }}
                                                onMouseEnter={() => setHoveredBarTranche(tName)}
                                                onMouseLeave={() => setHoveredBarTranche(null)}
                                            >
                                                <span className="text-white font-bold text-[13px] leading-none mb-[4px] whitespace-nowrap z-10 drop-shadow-md">{tName}</span>
                                                <span className="text-white font-bold text-[14px] leading-none whitespace-nowrap z-10 drop-shadow-md">{pct}%</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })()}
                </div>

                {/* Investment Structure Box */}
                <div className="w-full bg-[#292928] border border-[#3c3c3c] rounded-[32px] pt-[20px] flex flex-col overflow-hidden">
                    <div className="flex justify-between items-center w-full pb-[16px] border-b border-[#444]/50 pl-[26px] pr-[32px]">
                        <div className="flex items-center gap-[16px] overflow-x-auto hide-scrollbar">
                            {vehicleId === '421' ? (
                                (() => {
                                    const sumA = data['A종 수익증권']?.reduce((a,b)=>a+(b.rawAmount||0),0) || 0;
                                    const sumB = data['B종 수익증권']?.reduce((a,b)=>a+(b.rawAmount||0),0) || 0;
                                    const sumC = data['C종 수익증권']?.reduce((a,b)=>a+(b.rawAmount||0),0) || 0;
                                    const total = sumA + sumB + sumC;
                                    return (
                                        <>
                                            {sumA > 0 && (
                                            <div className="flex items-baseline gap-[4px] shrink-0">
                                                <span className={`${getTrancheColor('A종')} font-bold text-[14px] mr-[2px]`}>A종 수익증권</span>
                                                <span className="text-white font-bold text-[14px]">{amtFmt(sumA)}</span>
                                                <span className="text-[#86868B] text-[13px] tracking-tight mr-[4px]">({total > 0 ? ((sumA/total)*100).toFixed(1) : 0}%)</span>
                                            </div>
                                            )}
                                            {sumB > 0 && (
                                            <div className="flex items-baseline gap-[4px] shrink-0">
                                                <span className={`${getTrancheColor('B종')} font-bold text-[14px] mr-[2px]`}>B종 수익증권</span>
                                                <span className="text-white font-bold text-[14px]">{amtFmt(sumB)}</span>
                                                <span className="text-[#86868B] text-[13px] tracking-tight mr-[4px]">({total > 0 ? ((sumB/total)*100).toFixed(1) : 0}%)</span>
                                            </div>
                                            )}
                                            {sumC > 0 && (
                                            <div className="flex items-baseline gap-[4px] shrink-0">
                                                <span className={`${getTrancheColor('C종')} font-bold text-[14px] mr-[2px]`}>C종 수익증권</span>
                                                <span className="text-white font-bold text-[14px]">{amtFmt(sumC)}</span>
                                                <span className="text-[#86868B] text-[13px] tracking-tight mr-[4px]">({total > 0 ? ((sumC/total)*100).toFixed(1) : 0}%)</span>
                                            </div>
                                            )}
                                        </>
                                    );
                                })()
                            ) : (
                                <>
                                    <div className="flex items-center gap-[6px] shrink-0">
                                        <span className={`${getTrancheColor('Equity')} font-bold text-[16px]`}>Equity</span>
                                        <span className="text-[#eab308] font-bold text-[16px]">{amtFmt(totalEquity)}</span>
                                    </div>
                                    <div className="flex items-center gap-[6px] shrink-0">
                                        <span className="text-white font-bold text-[16px]">Loan</span>
                                        <span className="text-[#eab308] font-bold text-[16px]">{amtFmt(totalLoan)}</span>
                                    </div>
                                    
                                    <div className="w-[1px] h-[12px] bg-[#444]/50 mx-[4px] shrink-0"></div>
                                    
                                    <div className="flex items-baseline gap-[8px] shrink-0">
                                        {(() => {
                                            const loanGroups = {};
                                            Object.values(data).flat().forEach(item => {
                                                if (item.isSubHeader) return;
                                                if (item.type === 'Equity') return;
                                                let orig = item.originalTranche || item.type;
                                                if (orig === 'Tr.A-1' || orig === 'Tr.A-2') orig = 'Tr.A';
                                                if (orig === 'Tr.B-1' || orig === 'Tr.B-2') orig = 'Tr.B';
                                                if (!loanGroups[orig]) loanGroups[orig] = 0;
                                                loanGroups[orig] += (item.rawAmount || 0);
                                            });
                                            const order = {'Tr.A':1, 'Tr.B':4, 'Tr.C':5, 'Tr.D':6};
                                            const loanKeys = Object.keys(loanGroups).sort((a,b) => (order[a] || 99) - (order[b] || 99));

                                            return loanKeys.map(origTranche => {
                                                const lSum = loanGroups[origTranche];
                                                const pct = totalLoan > 0 ? ((lSum / totalLoan) * 100).toFixed(1) : 0;
                                                return (
                                                    <div key={origTranche} className="flex items-baseline gap-[4px]">
                                                        <span className={`${getTrancheColor(origTranche)} font-bold text-[14px] mr-[2px]`}>{origTranche}</span>
                                                        <span className="text-white font-bold text-[14px]">{amtFmt(lSum)}</span>
                                                        <span className="text-[#86868B] text-[13px] tracking-tight mr-[4px]">({pct}%)</span>
                                                    </div>
                                                );
                                            });
                                        })()}
                                    </div>
                                </>
                            )}
                        </div>
                        <div 
                            className="text-[14px] text-[#86868B] shrink-0 cursor-pointer hover:text-[#E5E5E5] transition-colors font-medium flex items-center group ml-4 translate-x-[6px]"
                            onClick={() => {
                                if (vehicleId) {
                                    navigateTo('platform/iotaseoul/stakeholder/lp');
                                    setTimeout(() => {
                                        window.location.hash = `#${vehicleId}`;
                                    }, 100);
                                }
                            }}
                        >
                            <span>{vehicleId === '421' ? '수익자 자세히보기' : '자세히보기'}</span>
                            <svg className="w-[12px] h-[12px] ml-1 text-[#666] group-hover:text-[#A1A1AA] transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7" />
                            </svg>
                        </div>
                    </div>

                    <div className="flex w-full divide-x divide-[#444]/50">
                        {sortedTranches.map(trancheName => {
                            const items = data[trancheName];
                            if (items.length === 0) return null;
                            const tSum = items.reduce((a, b) => a + (b.rawAmount || 0), 0);
                            const isHighlighted = 
                                hoveredBarTranche === trancheName || 
                                (hoveredBarTranche === '주주대여' && trancheName === 'Equity') ||
                                (hoveredBarTranche === 'Tr.A-2' && trancheName === 'Tr.A-1') ||
                                (hoveredBarTranche === 'Tr.B-2' && trancheName === 'Tr.B-1');
                                    // Calculate header sum (exclude Tr.A-2 from Tr.A-1 header sum)
                                    let headerSum = tSum;
                                    if (trancheName === 'Tr.A-1') {
                                        headerSum = items.filter(it => it.originalTranche !== 'Tr.A-2').reduce((a, b) => a + (b.rawAmount || 0), 0);
                                    }
                                    if (trancheName === 'Tr.B-1') {
                                        headerSum = items.filter(it => it.originalTranche !== 'Tr.B-2').reduce((a, b) => a + (b.rawAmount || 0), 0);
                                    }
                                    
                                    return (
                                        <div key={trancheName} className={`flex-1 min-w-0 flex flex-col pb-[32px] pl-[26px] pr-0 transition-colors duration-300 ${isHighlighted ? 'bg-[#383838]' : ''}`}>
                                            <div className="flex-1 overflow-y-auto custom-scrollbar max-h-[380px] pr-[22px]">
                                                <div className={`flex justify-between items-center w-full sticky top-0 z-10 pt-[20px] pb-[16px] transition-colors duration-300 ${isHighlighted ? 'bg-[#383838]' : 'bg-[#2A2A2A]'}`}>
                                                    <span className={`${getTrancheColor(trancheName)} font-bold text-[15px]`}>{trancheName}</span>
                                                    <span className="text-white font-bold text-[16px]">{headerSum.toLocaleString()}<span className="ml-[2px]">억</span></span>
                                                </div>
                                                {items.map((item, i) => {
                                                    if (item.isSubHeader) {
                                                        const isTargetSub = item.name === 'Tr.A-2' || item.name === 'Tr.B-2';
                                                        const subSum = isTargetSub ? items.filter(it => it.originalTranche === item.name).reduce((a,b) => a + (b.rawAmount || 0), 0) : 0;
                                                        
                                                        return (
                                                            <div key={i} className={`mt-[16px] mb-[12px] border-b border-[#444]/50 pb-2 ${isTargetSub ? 'flex justify-between items-end' : ''}`}>
                                                                <span className={`${isTargetSub ? getTrancheColor(item.name) : 'text-[#86868B]'} font-bold ${isTargetSub ? 'text-[15px]' : 'text-[13px]'}`}>{item.name}</span>
                                                                {isTargetSub && <span className="text-white font-bold text-[16px]">{subSum.toLocaleString()}<span className="ml-[2px]">억</span></span>}
                                                            </div>
                                                        );
                                                    }
                                                    return (
                                                        <div key={i} className="flex justify-between items-center w-full mb-[12px] group cursor-pointer" onClick={() => handleInstClick(item.name, trancheName, item.amount)}>
                                                            <span className={`text-[#E5E5E5] text-[14.5px] transition-colors duration-200 ${getTrancheHoverColor(trancheName)} break-keep mr-2 truncate`}>
                                                                {item.displayIndex}. {item.name}
                                                            </span>
                                                            <span className={`text-[#E5E5E5] text-[14.5px] transition-colors duration-200 ${getTrancheHoverColor(trancheName)} shrink-0`}>
                                                                {Number(item.rawAmount).toLocaleString()}<span className="ml-[2px]">억</span>
                                                            </span>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        );
    };


    return (
        <div className="w-full flex-1 flex flex-col pt-[50px] pb-[160px] max-w-[1200px] mx-auto">
            {/* Header & Team Structure */}
            <div className="w-full flex justify-between items-center mb-[40px] gap-[40px]">
                {/* Header Metadata */}
                <div className="shrink-0 max-w-[300px]">
                    <h1 className="text-[36px] font-bold text-white tracking-tight leading-none font-['Inter'] mb-[12px]">펀드운용</h1>
                    <p className="text-[15px] text-[#86868B] leading-[24px]">펀드(421) 운용 및 투자자 소통채널</p>
                </div>
                
                {/* Team Structure */}
                <div className="border border-[#333] rounded-[24px] flex flex-col bg-transparent shrink-0">
                    <div className="flex items-center pl-[20px] pr-[16px] py-[10px]">
                        <div className="w-[50px] shrink-0">
                            <span className="text-[13px] font-bold text-[#86868B]">KAM</span>
                        </div>
                        <div className="flex items-center gap-[12px] w-[96px] shrink-0">
                            <div className="relative w-[30px] h-[30px] shrink-0 rounded-full bg-[#3c3c3c] flex items-center justify-center overflow-hidden ml-[2px]">
                                <img src={`${import.meta.env.BASE_URL}김행단.webp`} alt="김행단" className="w-full h-full object-cover" onError={(e) => { e.target.src = `${import.meta.env.BASE_URL}default_avatar.svg`; }} />
                                <div className="absolute inset-0 rounded-full border border-white/10 pointer-events-none"></div>
                            </div>
                            <div className="flex flex-col text-left">
                                <span className="text-white font-bold text-[13px] leading-tight">김행단</span>
                                <span className="text-[#A1A1AA] text-[12px] mt-[1px] leading-tight">그룹장</span>
                            </div>
                        </div>
                        <div className="flex items-center ml-2">
                            <span className="text-[13px] font-medium text-[#86868B]">KAM 1파트 실무진</span>
                        </div>
                    </div>
                </div>
            </div>
{/* 2. Task 관리 */}
            <div className="w-full mt-0"></div>
            <div className="flex justify-between items-center mb-[10px]">
                <h2 id="task-management" className="text-[18px] font-bold text-white tracking-tight">펀드운용 주요 테스크 관리</h2>
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
            <div className="-mx-[7px] p-[6px] border border-[#333] rounded-[30px] mb-[34px]">
                <div className="w-full flex flex-col gap-[16px]">
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
                                id={`task-${row.id}`} 
                                onClick={() => setExpandedTaskId((expandedTaskId === 'ALL' || expandedTaskId === row.id) ? null : row.id)}
                                className={`scroll-mt-[100px] w-full relative rounded-[24px] px-6 pt-[22px] pb-[14px] cursor-pointer transition-all duration-300 group/row ${(expandedTaskId === 'ALL' || expandedTaskId === row.id) ? 'border-[2px] border-transparent [background:linear-gradient(#272726,#272726)_padding-box,linear-gradient(to_bottom_right,#d6efe9,#82afb9,#4c6e86)_border-box]' : 'bg-[#272726] border border-[#3c3c3c] hover:bg-[#333]'}`}
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
            </div>

            <div className="w-full mt-[10px]"></div>
            <WorkspaceActivityLog workspaceCode="WS_KAM" workspaceLabel="펀드운용-KAM" />



            <div className="mt-[10px]">
                {loading || !iotaData || iotaData.error || !iotaData[421] ? (
                    <div className="flex justify-center items-center py-20">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
                    </div>
                ) : (
                    <>
            <div className="w-full mb-[50px]">
                <div className="flex justify-between items-end mb-[12px]">
                    <h2 className="text-[24px] font-bold text-white tracking-tight">수익자 지분 구조</h2>
                    <button 
                        onClick={() => setShowAllLps(!showAllLps)}
                        className="px-[12px] py-[6px] rounded-[10px] border border-[#333] bg-transparent text-[12px] text-[#2997ff] hover:bg-[#2997ff]/10 transition-colors font-medium cursor-pointer tracking-tight flex items-center gap-2"
                    >
                        {showAllLps ? '주요 LP만 보기' : '전체 수익자 명부 보기'}
                    </button>
                </div>

                {!showAllLps ? (
                    <div className="w-full flex gap-[15px]">
                        <div 
                            className="flex-1 bg-[#292928] border border-[#3c3c3c] rounded-[32px] p-6 flex flex-col justify-between transition-colors duration-300 cursor-pointer hover:bg-[#3c3c3c]"
                            onClick={() => handleInstClick('삼성물산', 'C종 수익증권', '800')}
                        >
                            <div>
                                <div className="text-[#86868B] text-[13px] font-bold mb-1">Anchor LP (C종)</div>
                                <div className="text-[20px] font-bold text-white tracking-tight">삼성물산</div>
                            </div>
                            <div className="mt-4 flex items-end justify-between">
                                <div className="text-[14px] text-[#A1A1AA]">투자금 <span className="font-['Inter'] text-white ml-1">800</span><span className="text-[12px] ml-[2px]">억</span></div>
                                <div className="text-[24px] font-bold text-[#cd879c] font-['Inter'] tracking-tight translate-y-[5px]">25.9%</div>
                            </div>
                        </div>
                        <div 
                            className="flex-1 bg-[#292928] border border-[#3c3c3c] rounded-[32px] p-6 flex flex-col justify-between transition-colors duration-300 cursor-pointer hover:bg-[#3c3c3c]"
                            onClick={() => handleInstClick('NH투자증권', 'C종 수익증권', '500')}
                        >
                            <div>
                                <div className="text-[#86868B] text-[13px] font-bold mb-1">Anchor LP (C종)</div>
                                <div className="text-[20px] font-bold text-white tracking-tight">NH투자증권</div>
                            </div>
                            <div className="mt-4 flex items-end justify-between">
                                <div className="text-[14px] text-[#A1A1AA]">투자금 <span className="font-['Inter'] text-white ml-1">500</span><span className="text-[12px] ml-[2px]">억</span></div>
                                <div className="text-[24px] font-bold text-[#cd879c] font-['Inter'] tracking-tight translate-y-[5px]">16.2%</div>
                            </div>
                        </div>
                        <div 
                            className="flex-1 bg-[#292928] border border-[#3c3c3c] rounded-[32px] p-6 flex flex-col justify-between transition-colors duration-300 cursor-pointer hover:bg-[#3c3c3c]"
                            onClick={() => handleInstClick('이지스자산운용(주)', 'GP / Anchor LP (합산)', '424.5')}
                        >
                            <div>
                                <div className="text-[#86868B] text-[13px] font-bold mb-1">GP / Anchor LP (합산)</div>
                                <div className="text-[20px] font-bold text-white tracking-tight">이지스자산운용(주)</div>
                            </div>
                            <div className="mt-4 flex items-end justify-between">
                                <div className="text-[14px] text-[#A1A1AA]">투자금 <span className="font-['Inter'] text-white ml-1">424.5</span><span className="text-[12px] ml-[2px]">억</span></div>
                                <div className="text-[24px] font-bold text-[#5da0e7] font-['Inter'] tracking-tight translate-y-[5px]">13.7%</div>
                            </div>
                        </div>
                        <div 
                            className="flex-1 bg-[#292928] border border-[#3c3c3c] rounded-[32px] p-6 flex flex-col justify-between transition-colors duration-300 cursor-pointer hover:bg-[#3c3c3c]"
                            onClick={() => handleInstClick('디에스클러스터(주)', 'C종 수익증권', '250')}
                        >
                            <div>
                                <div className="text-[#86868B] text-[13px] font-bold mb-1">Major LP (C종)</div>
                                <div className="text-[20px] font-bold text-white tracking-tight">디에스클러스터(주)</div>
                            </div>
                            <div className="mt-4 flex items-end justify-between">
                                <div className="text-[14px] text-[#A1A1AA]">투자금 <span className="font-['Inter'] text-white ml-1">250</span><span className="text-[12px] ml-[2px]">억</span></div>
                                <div className="text-[24px] font-bold text-[#cd879c] font-['Inter'] tracking-tight translate-y-[5px]">8.1%</div>
                            </div>
                        </div>
                        <div 
                            className="flex-1 bg-[#292928] border border-[#3c3c3c] rounded-[32px] p-6 flex flex-col justify-between transition-colors duration-300 cursor-pointer hover:bg-[#3c3c3c]"
                            onClick={() => handleInstClick('(주)케이티에스테이트', 'B종 수익증권', '210')}
                        >
                            <div>
                                <div className="text-[#86868B] text-[13px] font-bold mb-1">Major LP (B종)</div>
                                <div className="text-[20px] font-bold text-white tracking-tight">(주)케이티에스테이트</div>
                            </div>
                            <div className="mt-4 flex items-end justify-between">
                                <div className="text-[14px] text-[#A1A1AA]">투자금 <span className="font-['Inter'] text-white ml-1">210</span><span className="text-[12px] ml-[2px]">억</span></div>
                                <div className="text-[24px] font-bold text-[#3aaab3] font-['Inter'] tracking-tight translate-y-[4px]">6.8%</div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="w-full">
                        <table className="w-full text-left border-collapse border-y-[2px] border-t-[#666] border-b-[#444]">
                            <thead>
                                <tr className="border-b border-[#444] bg-[#1c1c1e]">
                                    <th className="py-2 px-4 text-[#86868B] font-bold text-[13px] text-center w-[140px] border-r border-[#444]">구분</th>
                                    <th className="py-2 px-4 text-[#86868B] font-bold text-[13px] text-center border-r border-[#444]">수익자</th>
                                    <th className="py-2 px-4 text-[#86868B] font-bold text-[13px] text-right border-r border-[#444] w-[150px]">투자금액(백만원)</th>
                                    <th className="py-2 px-4 text-[#86868B] font-bold text-[13px] text-right border-r border-[#444] w-[120px]">지분율(종별)</th>
                                    <th className="py-2 px-4 text-[#86868B] font-bold text-[13px] text-right w-[120px]">지분율(전체)</th>
                                </tr>
                            </thead>
                            <tbody className="text-[13px] text-[#E5E5E5]">
                                {/* A종 */}
                                <tr className="border-b border-[#444]">
                                    <td rowSpan="7" className="py-2 px-4 text-center font-bold text-white border-r border-[#444] bg-[#1a1a1c]">A종 수익증권</td>
                                    <td className="py-2 px-4 border-r border-[#444] bg-[#5da0e7]/20 text-[#5da0e7] font-bold">이지스자산운용(주)</td>
                                    <td className="py-2 px-4 text-right font-bold text-[#5da0e7] font-[Inter] tracking-tight border-r border-[#444] bg-[#5da0e7]/20">19,000</td>
                                    <td className="py-2 px-4 text-right font-[Inter] tracking-tight border-r border-[#444] bg-[#5da0e7]/20 text-[#5da0e7]">30.60%</td>
                                    <td className="py-2 px-4 text-right font-bold text-[#5da0e7] font-[Inter] tracking-tight bg-[#5da0e7]/20">6.10%</td>
                                </tr>
                                <tr className="border-b border-[#444]">
                                    <td className="py-2 px-4 border-r border-[#444]">한중건설(주)</td>
                                    <td className="py-2 px-4 text-right font-[Inter] tracking-tight border-r border-[#444]">13,000</td>
                                    <td className="py-2 px-4 text-right font-[Inter] tracking-tight border-r border-[#444]">21.00%</td>
                                    <td className="py-2 px-4 text-right font-[Inter] tracking-tight">4.20%</td>
                                </tr>
                                <tr className="border-b border-[#444]">
                                    <td className="py-2 px-4 border-r border-[#444]">에셀유한회사</td>
                                    <td className="py-2 px-4 text-right font-[Inter] tracking-tight border-r border-[#444]">10,000</td>
                                    <td className="py-2 px-4 text-right font-[Inter] tracking-tight border-r border-[#444]">16.10%</td>
                                    <td className="py-2 px-4 text-right font-[Inter] tracking-tight">3.20%</td>
                                </tr>
                                <tr className="border-b border-[#444]">
                                    <td className="py-2 px-4 border-r border-[#444]">구봉산업(주)</td>
                                    <td className="py-2 px-4 text-right font-[Inter] tracking-tight border-r border-[#444]">10,000</td>
                                    <td className="py-2 px-4 text-right font-[Inter] tracking-tight border-r border-[#444]">16.10%</td>
                                    <td className="py-2 px-4 text-right font-[Inter] tracking-tight">3.20%</td>
                                </tr>
                                <tr className="border-b border-[#444]">
                                    <td className="py-2 px-4 border-r border-[#444]">(주)데피니트파트너스</td>
                                    <td className="py-2 px-4 text-right font-[Inter] tracking-tight border-r border-[#444]">6,000</td>
                                    <td className="py-2 px-4 text-right font-[Inter] tracking-tight border-r border-[#444]">9.70%</td>
                                    <td className="py-2 px-4 text-right font-[Inter] tracking-tight">1.90%</td>
                                </tr>
                                <tr className="border-b border-[#444]">
                                    <td className="py-2 px-4 border-r border-[#444]">(주)게우트플래닝</td>
                                    <td className="py-2 px-4 text-right font-[Inter] tracking-tight border-r border-[#444]">4,000</td>
                                    <td className="py-2 px-4 text-right font-[Inter] tracking-tight border-r border-[#444]">6.50%</td>
                                    <td className="py-2 px-4 text-right font-[Inter] tracking-tight">1.30%</td>
                                </tr>
                                <tr className="border-b border-[#444] bg-[#1c1c1e]/50">
                                    <td className="py-2 px-4 font-bold text-center text-[#86868B] border-r border-[#444]">소계</td>
                                    <td className="py-2 px-4 text-right font-bold text-[#A1A1AA] font-[Inter] tracking-tight border-r border-[#444]">62,000</td>
                                    <td className="py-2 px-4 text-right font-bold text-[#A1A1AA] font-[Inter] tracking-tight border-r border-[#444]">100.00%</td>
                                    <td className="py-2 px-4 text-right font-bold text-[#A1A1AA] font-[Inter] tracking-tight">20.10%</td>
                                </tr>

                                {/* B종 */}
                                <tr className="border-b border-[#444]">
                                    <td rowSpan="11" className="py-2 px-4 text-center font-bold text-white border-r border-[#444] bg-[#1a1a1c]">B종 수익증권</td>
                                    <td className="py-2 px-4 border-r border-[#444] bg-[#5da0e7]/20 text-[#5da0e7] font-bold">이지스자산운용(주)</td>
                                    <td className="py-2 px-4 text-right font-bold text-[#5da0e7] font-[Inter] tracking-tight border-r border-[#444] bg-[#5da0e7]/20">13,450</td>
                                    <td className="py-2 px-4 text-right font-[Inter] tracking-tight border-r border-[#444] bg-[#5da0e7]/20 text-[#5da0e7]">21.70%</td>
                                    <td className="py-2 px-4 text-right font-bold text-[#5da0e7] font-[Inter] tracking-tight bg-[#5da0e7]/20">4.40%</td>
                                </tr>
                                <tr className="border-b border-[#444]">
                                    <td className="py-2 px-4 border-r border-[#444]">안다인베스트먼트파트너스</td>
                                    <td className="py-2 px-4 text-right font-[Inter] tracking-tight border-r border-[#444]">9,500</td>
                                    <td className="py-2 px-4 text-right font-[Inter] tracking-tight border-r border-[#444]">15.30%</td>
                                    <td className="py-2 px-4 text-right font-[Inter] tracking-tight">3.10%</td>
                                </tr>
                                <tr className="border-b border-[#444]">
                                    <td className="py-2 px-4 border-r border-[#444]">에셀유한회사</td>
                                    <td className="py-2 px-4 text-right font-[Inter] tracking-tight border-r border-[#444]">5,350</td>
                                    <td className="py-2 px-4 text-right font-[Inter] tracking-tight border-r border-[#444]">8.60%</td>
                                    <td className="py-2 px-4 text-right font-[Inter] tracking-tight">1.70%</td>
                                </tr>
                                <tr className="border-b border-[#444]">
                                    <td className="py-2 px-4 border-r border-[#444]">구봉산업(주)</td>
                                    <td className="py-2 px-4 text-right font-[Inter] tracking-tight border-r border-[#444]">5,000</td>
                                    <td className="py-2 px-4 text-right font-[Inter] tracking-tight border-r border-[#444]">8.10%</td>
                                    <td className="py-2 px-4 text-right font-[Inter] tracking-tight">1.60%</td>
                                </tr>
                                <tr className="border-b border-[#444]">
                                    <td className="py-2 px-4 border-r border-[#444]">(주)에스제이더블유인터내셔널</td>
                                    <td className="py-2 px-4 text-right font-[Inter] tracking-tight border-r border-[#444]">3,000</td>
                                    <td className="py-2 px-4 text-right font-[Inter] tracking-tight border-r border-[#444]">4.80%</td>
                                    <td className="py-2 px-4 text-right font-[Inter] tracking-tight">1.00%</td>
                                </tr>
                                <tr className="border-b border-[#444]">
                                    <td className="py-2 px-4 border-r border-[#444] bg-[#3aaab3]/20 text-[#3aaab3] font-bold">(주)케이티에스테이트</td>
                                    <td className="py-2 px-4 text-right font-bold text-[#3aaab3] font-[Inter] tracking-tight border-r border-[#444] bg-[#3aaab3]/20">21,000</td>
                                    <td className="py-2 px-4 text-right font-[Inter] tracking-tight border-r border-[#444] bg-[#3aaab3]/20 text-[#3aaab3]">33.90%</td>
                                    <td className="py-2 px-4 text-right font-bold text-[#3aaab3] font-[Inter] tracking-tight bg-[#3aaab3]/20">6.80%</td>
                                </tr>
                                <tr className="border-b border-[#444]">
                                    <td className="py-2 px-4 border-r border-[#444]">주식회사안다자산운용</td>
                                    <td className="py-2 px-4 text-right font-[Inter] tracking-tight border-r border-[#444]">1,500</td>
                                    <td className="py-2 px-4 text-right font-[Inter] tracking-tight border-r border-[#444]">2.40%</td>
                                    <td className="py-2 px-4 text-right font-[Inter] tracking-tight">0.50%</td>
                                </tr>
                                <tr className="border-b border-[#444]">
                                    <td className="py-2 px-4 border-r border-[#444]">이노베스트 코리아</td>
                                    <td className="py-2 px-4 text-right font-[Inter] tracking-tight border-r border-[#444]">1,200</td>
                                    <td className="py-2 px-4 text-right font-[Inter] tracking-tight border-r border-[#444]">1.90%</td>
                                    <td className="py-2 px-4 text-right font-[Inter] tracking-tight">0.40%</td>
                                </tr>
                                <tr className="border-b border-[#444]">
                                    <td className="py-2 px-4 border-r border-[#444]">(주)데피니트파트너스</td>
                                    <td className="py-2 px-4 text-right font-[Inter] tracking-tight border-r border-[#444]">1,000</td>
                                    <td className="py-2 px-4 text-right font-[Inter] tracking-tight border-r border-[#444]">1.60%</td>
                                    <td className="py-2 px-4 text-right font-[Inter] tracking-tight">0.30%</td>
                                </tr>
                                <tr className="border-b border-[#444]">
                                    <td className="py-2 px-4 border-r border-[#444]">(주)디와이시스템</td>
                                    <td className="py-2 px-4 text-right font-[Inter] tracking-tight border-r border-[#444]">1,000</td>
                                    <td className="py-2 px-4 text-right font-[Inter] tracking-tight border-r border-[#444]">1.60%</td>
                                    <td className="py-2 px-4 text-right font-[Inter] tracking-tight">0.30%</td>
                                </tr>
                                <tr className="border-b border-[#444] bg-[#1c1c1e]/50">
                                    <td className="py-2 px-4 font-bold text-center text-[#86868B] border-r border-[#444]">소계</td>
                                    <td className="py-2 px-4 text-right font-bold text-[#A1A1AA] font-[Inter] tracking-tight border-r border-[#444]">62,000</td>
                                    <td className="py-2 px-4 text-right font-bold text-[#A1A1AA] font-[Inter] tracking-tight border-r border-[#444]">100.00%</td>
                                    <td className="py-2 px-4 text-right font-bold text-[#A1A1AA] font-[Inter] tracking-tight">20.10%</td>
                                </tr>

                                {/* C종 */}
                                <tr className="border-b border-[#444]">
                                    <td rowSpan="6" className="py-2 px-4 text-center font-bold text-white border-r border-[#444] bg-[#1a1a1c]">C종 수익증권</td>
                                    <td className="py-2 px-4 border-r border-[#444] bg-[#5da0e7]/20 text-[#5da0e7] font-bold">이지스자산운용(주)</td>
                                    <td className="py-2 px-4 text-right font-bold text-[#5da0e7] font-[Inter] tracking-tight border-r border-[#444] bg-[#5da0e7]/20">10,000</td>
                                    <td className="py-2 px-4 text-right font-[Inter] tracking-tight border-r border-[#444] bg-[#5da0e7]/20 text-[#5da0e7]">5.40%</td>
                                    <td className="py-2 px-4 text-right font-bold text-[#5da0e7] font-[Inter] tracking-tight bg-[#5da0e7]/20">3.20%</td>
                                </tr>
                                <tr className="border-b border-[#444]">
                                    <td className="py-2 px-4 border-r border-[#444] bg-[#cd879c]/20 text-[#cd879c] font-bold">삼성물산</td>
                                    <td className="py-2 px-4 text-right font-bold text-[#cd879c] font-[Inter] tracking-tight border-r border-[#444] bg-[#cd879c]/20">80,000</td>
                                    <td className="py-2 px-4 text-right font-[Inter] tracking-tight border-r border-[#444] bg-[#cd879c]/20 text-[#cd879c]">43.20%</td>
                                    <td className="py-2 px-4 text-right font-bold text-[#cd879c] font-[Inter] tracking-tight bg-[#cd879c]/20">25.90%</td>
                                </tr>
                                <tr className="border-b border-[#444]">
                                    <td className="py-2 px-4 border-r border-[#444] bg-[#cd879c]/20 text-[#cd879c] font-bold">디에스클러스터 주식회사</td>
                                    <td className="py-2 px-4 text-right font-bold text-[#cd879c] font-[Inter] tracking-tight border-r border-[#444] bg-[#cd879c]/20">25,000</td>
                                    <td className="py-2 px-4 text-right font-[Inter] tracking-tight border-r border-[#444] bg-[#cd879c]/20 text-[#cd879c]">13.50%</td>
                                    <td className="py-2 px-4 text-right font-bold text-[#cd879c] font-[Inter] tracking-tight bg-[#cd879c]/20">8.10%</td>
                                </tr>
                                <tr className="border-b border-[#444]">
                                    <td className="py-2 px-4 border-r border-[#444] bg-[#cd879c]/20 text-[#cd879c] font-bold">NH투자증권</td>
                                    <td className="py-2 px-4 text-right font-bold text-[#cd879c] font-[Inter] tracking-tight border-r border-[#444] bg-[#cd879c]/20">50,000</td>
                                    <td className="py-2 px-4 text-right font-[Inter] tracking-tight border-r border-[#444] bg-[#cd879c]/20 text-[#cd879c]">27.00%</td>
                                    <td className="py-2 px-4 text-right font-bold text-[#cd879c] font-[Inter] tracking-tight bg-[#cd879c]/20">16.20%</td>
                                </tr>
                                <tr className="border-b border-[#444]">
                                    <td className="py-2 px-4 border-r border-[#444]">현대캐피탈</td>
                                    <td className="py-2 px-4 text-right font-[Inter] tracking-tight border-r border-[#444]">20,000</td>
                                    <td className="py-2 px-4 text-right font-[Inter] tracking-tight border-r border-[#444]">10.80%</td>
                                    <td className="py-2 px-4 text-right font-[Inter] tracking-tight">6.50%</td>
                                </tr>
                                <tr className="border-b border-[#444] bg-[#1c1c1e]/50">
                                    <td className="py-2 px-4 font-bold text-center text-[#86868B] border-r border-[#444]">소계</td>
                                    <td className="py-2 px-4 text-right font-bold text-[#A1A1AA] font-[Inter] tracking-tight border-r border-[#444]">185,000</td>
                                    <td className="py-2 px-4 text-right font-bold text-[#A1A1AA] font-[Inter] tracking-tight border-r border-[#444]">100.00%</td>
                                    <td className="py-2 px-4 text-right font-bold text-[#A1A1AA] font-[Inter] tracking-tight">59.90%</td>
                                </tr>

                                {/* Total */}
                                <tr className="bg-[#2A2A2A]">
                                    <td colSpan="2" className="py-2 px-4 text-center font-bold text-white border-r border-[#444]">합계</td>
                                    <td className="py-2 px-4 text-right font-bold text-[#0A84FF] text-[14.5px] font-[Inter] tracking-tight border-r border-[#444]">309,000</td>
                                    <td className="py-2 px-4 text-right font-bold text-[#0A84FF] text-[14.5px] font-[Inter] tracking-tight border-r border-[#444]">100.00%</td>
                                    <td className="py-2 px-4 text-right font-bold text-[#0A84FF] text-[14.5px] font-[Inter] tracking-tight">100.00%</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
                    <VehicleDetailCard 
                        id="section-421" 
                        vehicleId="421"
                        title="3. 421호 펀드" 
                        totalAmountStr={formatAmount(getTotal(421))} 
                        data={iotaData[421]?.Current || {}} 
                        toggleContent={
                            <button 
                                onClick={() => navigateTo('platform/iotaseoul/421-fund')}
                                className="px-[12px] py-[6px] rounded-[10px] border border-[#333] bg-transparent text-[12px] text-[#2997ff] hover:bg-[#2997ff]/10 transition-colors font-medium cursor-pointer tracking-tight"
                            >
                                펀드 구조 및 지분율 자세히보기
                            </button>
                        }
                    />
                    </>
                )}
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
    );
}
