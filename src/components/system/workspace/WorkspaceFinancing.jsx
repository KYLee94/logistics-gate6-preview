import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import WorkspaceActivityLog from './WorkspaceActivityLog';
import { supabase } from '../../../utils/supabaseClient';
import { fetchWithRetry } from '../../../utils/fetchWithRetry';

export default function WorkspaceFinancing() {

    const { memberInfo } = useAuth();
    const isAuthorized = ['전기영', '박준호', '윤상준', '이희재', '강상구', '김지혜', '박세진', '김수종', '김민지'].includes(memberInfo?.staff_name);

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
                .from('iota_financing_tasks')
                .select('*')
                .order('created_at', { ascending: false });
            if (error) {
                console.warn('Falling back to local storage for tasks:', error);
                const localData = localStorage.getItem('iota_financing_tasks_fallback');
                if (localData) setTasks(JSON.parse(localData));
                else setTasks([]);
            } else {
                setTasks(data || []);
            }
        } catch (e) {
            console.error('Failed to fetch tasks:', e);
            const localData = localStorage.getItem('iota_financing_tasks_fallback');
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
            next_action: row.next_action || ''
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
                const { error } = await supabase.from('iota_financing_tasks').update(newTask).eq('id', editingTaskId);
                if (error) throw error;
            } else {
                const taskToSave = { ...newTask, id: Date.now().toString(), created_at: new Date().toISOString() };
                const { error } = await supabase.from('iota_financing_tasks').insert([taskToSave]);
                if (error) throw error;
            }
        } catch (e) {
            console.warn('Error saving to Supabase:', e);
            // simple local fallback logic omitted for brevity in update mode, relies on fetchTasks
        }
        
        setNewTask({ task_name: '', company_name: '', related_asset: 'IOTA 공통', status: '신규', priority: '중간', due_date: new Date().toLocaleDateString('en-CA'), next_action: '' });
        setCompanyQuery('');
        setIsAdding(false);
        setEditingTaskId(null);
        setIsSubmittingTask(false);
        fetchTasks();
    };

    const handleDeleteRow = async (id) => {
        setIsDeleting(true);
        try {
            const { error } = await supabase.from('iota_financing_tasks').delete().eq('id', id);
            if (error) throw error;
        } catch (e) {
            console.warn('Deleting from local storage fallback due to error:', e);
            const updated = tasks.filter(t => t.id !== id);
            localStorage.setItem('iota_financing_tasks_fallback', JSON.stringify(updated));
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
            setNewTask({ task_name: '', company_name: '', related_asset: 'IOTA 공통', status: '신규', priority: '중간', due_date: new Date().toLocaleDateString('en-CA'), next_action: '' });
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
            await supabase.from('iota_financing_tasks').update({ created_at: current.created_at }).eq('id', current.id);
            await supabase.from('iota_financing_tasks').update({ created_at: prev.created_at }).eq('id', prev.id);
        } catch (e) {
            localStorage.setItem('iota_financing_tasks_fallback', JSON.stringify(newTasks));
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
            await supabase.from('iota_financing_tasks').update({ created_at: current.created_at }).eq('id', current.id);
            await supabase.from('iota_financing_tasks').update({ created_at: next.created_at }).eq('id', next.id);
        } catch (e) {
            localStorage.setItem('iota_financing_tasks_fallback', JSON.stringify(newTasks));
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
        const names = ['전기영', '박준호', '윤상준', '이희재', '강상구', '김지혜', '박세진', '김수종', '김민지'];
        let result = text;
        names.forEach(name => {
            const regex = new RegExp(name, 'g');
            result = result.replace(regex, `<span class="text-[#E5E5E5] hover:text-[#fbf167] cursor-pointer transition-colors hover:underline underline-offset-4 decoration-[#fbf167]/50">${name}</span>`);
        });
        return <span dangerouslySetInnerHTML={{ __html: result }} />;
    };

    const [iotaData, setIotaData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [marketNews, setMarketNews] = useState(null);
    const [selectedLender, setSelectedLender] = useState('전체 대주');
    const [newsLoading, setNewsLoading] = useState(false);
    
    const handleInstClick = () => {};
    const navigateTo = (path) => {
        const base = import.meta.env.BASE_URL;
        const url = base.endsWith('/') ? `${base}${path}` : `${base}/${path}`;
        window.history.pushState(null, '', url);
        window.dispatchEvent(new PopStateEvent('popstate'));
    };

    const fetchMarketNews = async () => {
        setNewsLoading(true);
        try {
            // 외부 무료 프록시 서버 장애로 인해, 기존처럼 빠르고 안정적인 로컬 JSON 로드 방식으로 복원합니다.
            // (대신 실시간 갱신 느낌을 주도록 1초 딜레이를 추가합니다)
            await new Promise(resolve => setTimeout(resolve, 1000));
            const res = await fetch(`${import.meta.env.BASE_URL}data/lfc-market-news.json?t=${new Date().getTime()}`);
            if (res.ok) {
                const data = await res.json();
                setMarketNews(data);
            }
        } catch (e) {
            console.error("Failed to load market news", e);
        } finally {
            setNewsLoading(false);
        }
    };

    useEffect(() => {
        fetchMarketNews();
    }, []);
    
    const [selectedPfPlan, setSelectedPfPlan] = useState(null);
    
    const pfPlanData = [
        { id: "pf-plan-01", step: "01", name: "통합 PF 구조 확정", work: "427 본PF와 816 후속 PF를 통합 관점에서 연결", materials: "통합 자금구조표, 상환재원 표", counterparty: "주관기관 후보", target: "", next: "최종 엑셀 수령 후 구조표와 tranche sizing 연결" },
        { id: "pf-plan-02", step: "02", name: "Tranche sizing", work: "Senior, 중순위, 후순위, 주주대여금의 역할 구분", materials: "Capital stack, 대주별 조건표", counterparty: "대주단 / 증권사", target: "", next: "금액은 최종 엑셀 수령 후 반영" },
        { id: "pf-plan-03", step: "03", name: "주관·참여기관 협의", work: "대주단과의 구체적인 조건 협의", materials: "협의 메모, term sheet", counterparty: "KB, NH, 신한 등", target: "", next: "" },
        { id: "pf-plan-04", step: "04", name: "Term sheet 정리", work: "금융조건의 서면화 및 최종 조율", materials: "대출 조건표, 약정 주요 조건", counterparty: "대주단", target: "", next: "" },
        { id: "pf-plan-05", step: "05", name: "심의·승인 패키지", work: "대주단 내부 심의용 자료 작성", materials: "IM, 리스크심의, 사업계획, 모델", counterparty: "내부 심의 / 대주 심사", target: "", next: "" },
        { id: "pf-plan-06", step: "06", name: "약정서·담보 패키지", work: "대출약정서 및 제반 담보 계약 체결", materials: "약정서, 담보계약, 책임준공 관련 문서", counterparty: "법무 / 대주단 / 시공사", target: "", next: "" },
        { id: "pf-plan-07", step: "07", name: "기표 및 기존 대출 상환", work: "자금 집행 및 브릿지론 상환", materials: "기표 일정, 상환계획, 자금집행표", counterparty: "대리금융기관 / 대주단", target: "", next: "" }
    ];


    useEffect(() => {
        const controller = new AbortController();

        const fetchData = async () => {
            try {
                const { data, error } = await fetchWithRetry(
                    () => supabase.from('iota_capital_stack').select('*').abortSignal(controller.signal),
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
                        427: { Bridge: {}, Refinancing: {} },
                        421: { Current: {} },
                        816: { Bridge: {}, Refinancing: {} }
                    };

                    data.forEach(item => {
                        const v = parseInt(item.vehicle_name);
                        const p = item.phase;
                        let tranche = item.tranche_name;
                        let type = item.tranche_type;
                        let sortOrder = 0;
                        let originalTranche = tranche;

                        if ((v === 427 || v === 816) && (tranche === '1종 종류주 등' || tranche === '보통주' || tranche === '주주대여금' || tranche.includes('종류주'))) {
                            tranche = 'Equity';
                            type = 'Equity';
                            if (originalTranche === '주주대여금') {
                                sortOrder = 1;
                            }
                        }
                        if ((v === 427 || v === 816) && tranche === 'Tr.A-2') {
                            tranche = 'Tr.A-1';
                            sortOrder = 1;
                        }

                        if (v === 427 && tranche === 'Tr.B-2') {
                            tranche = 'Tr.B-1';
                            sortOrder = 1;
                        }

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

                    [427, 421, 816].forEach(v => {
                        Object.keys(grouped[v]).forEach(p => {
                            Object.keys(grouped[v][p]).forEach(t => {
                                const arr = grouped[v][p][t];
                                arr.sort((a,b) => {
                                    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
                                    return b.rawAmount - a.rawAmount;
                                });

                                if ((v === 427 || v === 816) && t === 'Equity') {
                                    let hasSubheader = false;
                                    for (let i = 0; i < arr.length; i++) {
                                        if (arr[i].originalTranche === '주주대여금' && !hasSubheader) {
                                            arr.splice(i, 0, { isSubHeader: true, name: '주주대여금' });
                                            hasSubheader = true;
                                            i++; 
                                        }
                                    }
                                }
                                
                                if ((v === 427 || v === 816) && t === 'Tr.A-1') {
                                    let hasSubheader = false;
                                    for (let i = 0; i < arr.length; i++) {
                                        if (arr[i].originalTranche === 'Tr.A-2' && !hasSubheader) {
                                            arr.splice(i, 0, { isSubHeader: true, name: 'Tr.A-2' });
                                            hasSubheader = true;
                                            i++; 
                                        }
                                    }
                                }

                                if (v === 427 && t === 'Tr.B-1') {
                                    let hasSubheader = false;
                                    for (let i = 0; i < arr.length; i++) {
                                        if (arr[i].originalTranche === 'Tr.B-2' && !hasSubheader) {
                                            arr.splice(i, 0, { isSubHeader: true, name: 'Tr.B-2' });
                                            hasSubheader = true;
                                            i++; 
                                        }
                                    }
                                }

                                let idx = 1;
                                arr.forEach(item => {
                                    if (!item.isSubHeader) {
                                        item.displayIndex = idx++;
                                    }
                                });
                            });
                        });
                    });

                    setIotaData(grouped);
                }
            } catch (error) {
                if (controller.signal.aborted) return;
                console.error("Unhandled Exception:", error);
                setIotaData({ error: error.message || "오류" });
            } finally {
                if (!controller.signal.aborted) {
                    setLoading(false);
                }
            }
        };
        fetchData();

        return () => {
            controller.abort();
        };
    }, []);

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
            <div id={id} className="mb-[38px]">
                <div className="flex justify-between items-end mb-[12px]">
                    <h2 className="text-[20px] font-bold text-white">{title}</h2>
                    {toggleContent}
                </div>

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

    const getTotal = (v, p = 'Current') => {
        let sum = 0;
        if (iotaData && iotaData[v] && iotaData[v][p]) {
            Object.values(iotaData[v][p]).forEach(trancheArray => {
                sum += trancheArray.reduce((a, b) => a + (parseFloat(b.rawAmount) || 0), 0);
            });
        }
        return sum;
    };

    const getTypeTotal = (v, p = 'Current', typeStr) => {
        let sum = 0;
        if (iotaData && iotaData[v] && iotaData[v][p]) {
            Object.values(iotaData[v][p]).forEach(trancheArray => {
                trancheArray.forEach(item => {
                    if (item.type === typeStr && !item.isSubHeader) sum += (parseFloat(item.rawAmount) || 0);
                });
            });
        }
        return sum;
    };

    const displayTotal427 = getTotal(427, 'Refinancing');
    const displayTotal816 = getTotal(816, 'Refinancing');
    const total421 = getTotal(421);
    
    const grandTotal = displayTotal427 + total421 + displayTotal816;

    const formatAmount = (rawAmt) => {
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

    return (
                <div className="w-full flex-1 flex flex-col pt-[50px] pb-[60px] max-w-[1200px] mx-auto">
            {/* Header & Team Structure */}
            <div className="w-full flex justify-between items-center mb-[40px] gap-[40px]">
                {/* Header Metadata */}
                <div className="shrink-0 max-w-[350px]">
                    <h1 className="text-[36px] font-bold text-white tracking-tight leading-none font-['Inter'] mb-[12px]">파이낸싱</h1>
                    <p className="text-[15px] text-[#86868B] leading-[24px] break-keep">IOTA Seoul Capital Stack 및 대주단 파이프라인 관리</p>
                </div>
                
                {/* Team Structure */}
                <div className="border border-[#333] rounded-[24px] flex flex-col bg-transparent shrink-0">

                    
                    <div className="flex items-center pl-[20px] pr-[10px] py-[10px]">
                        <div className="w-[70px] shrink-0">
                            <span className="text-[13px] font-bold text-[#86868B]">파이낸싱</span>
                        </div>
                        <div className="flex items-center gap-[12px] w-[130px] shrink-0">
                            <div className="relative w-[30px] h-[30px] shrink-0 rounded-full bg-[#3c3c3c] flex items-center justify-center overflow-hidden ml-[2px]">
                                <img src={`${import.meta.env.BASE_URL}박준호.webp`} alt="박준호" className="w-full h-full object-cover" onError={(e) => { e.target.src = `${import.meta.env.BASE_URL}default_avatar.svg`; }} />
                                <div className="absolute inset-0 rounded-full border border-white/10 pointer-events-none"></div>
                            </div>
                            <div className="flex flex-col text-left">
                                <span className="text-white font-bold text-[13px] leading-tight">박준호</span>
                                <span className="text-[#A1A1AA] text-[12px] mt-[1px] leading-tight">LFC 센터장</span>
                            </div>
                        </div>
                        <div className="flex flex-wrap gap-x-1.5 gap-y-2 -ml-[6px]">
                            {["강석민","정리훈","손유정","김지우","박현승","이성민A","한승환"].map(name => (
                                <div key={name} className="flex items-center gap-[6px] bg-[#222] border border-[#333] rounded-full pl-[4px] pr-[10px] py-[4px] min-w-[76px]">
                                    <div className="w-[21px] h-[21px] shrink-0 rounded-full bg-[#3c3c3c] overflow-hidden">
                                        <img src={`${import.meta.env.BASE_URL}${name}.webp`} alt={name} className="w-full h-full object-cover" onError={(e) => { e.target.src = `${import.meta.env.BASE_URL}default_avatar.svg`; }} />
                                    </div>
                                    <span className="text-[#E5E5E5] text-[12px] font-medium leading-none">{name}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            <WorkspaceActivityLog workspaceCode="WS_LFC" workspaceLabel="파이낸싱-LFC" />

            {/* 2. Task 관리 */}
            <div className="w-full mt-0"></div>
            <div className="flex justify-between items-center mb-[10px]">
                <h2 className="text-[18px] font-bold text-white tracking-tight">파이낸싱 주요 테스크 관리</h2>
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
                                <button onClick={() => { setIsAdding(false); setEditingTaskId(null); setCompanyQuery(''); setNewTask({ task_name: '', company_name: '', related_asset: 'IOTA 공통', status: '신규', priority: '중간', due_date: new Date().toLocaleDateString('en-CA'), next_action: '' }); }} className="px-5 py-2 bg-[#3c3c3c]/50 text-[#86868B] border border-[#444] rounded-[10px] text-[14px] font-bold hover:bg-[#3c3c3c] hover:text-white transition-colors cursor-pointer">취소</button>
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
                                                                        <button 
                                        onClick={(e) => { e.stopPropagation(); handleEditRow(row); }} 
                                        className="px-3 py-2 h-[60px] bg-[#3b82f6]/10 text-[#3b82f6] border border-[#3b82f6]/30 rounded-[8px] text-[13px] font-bold hover:bg-[#3b82f6]/20 cursor-pointer"
                                    >
                                        수정
                                    </button>
<button 
                                        onClick={(e) => { e.stopPropagation(); setItemToDelete({ id: row.id, message: '정말 삭제하시겠습니까?' }); }} 
                                        className="px-3 py-2 h-[60px] bg-[#ef4444]/10 text-[#ef4444] border border-[#ef4444]/30 rounded-[8px] text-[13px] font-bold hover:bg-[#ef4444]/20 cursor-pointer"
                                    >
                                        삭제
                                    </button>
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
                                        <span className="text-[13px] font-bold text-[#86868B]">Next Action</span>
                                        <p className="text-[18px] text-[#bbb9af] leading-relaxed break-keep font-medium">
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
                                </div>
                            </motion.div>
                            ))}
                        </AnimatePresence>
                    </div>
                )}
            </div>


            {!loading && iotaData && !iotaData.error && (
                <div className="w-full mt-[18px] border-t border-[#3c3c3c] pt-[44px]">
                    <h2 className="text-[20px] font-bold text-white mb-[12px]">통합 Vehicle 파이낸싱 구조</h2>
                    <div className="p-6 bg-[#262626] border border-[#3c3c3c] rounded-[24px] flex gap-8 items-start">
                        <div className="w-[280px] shrink-0 flex flex-col">
                            <div className="text-[13px] font-bold text-[#86868B] uppercase mb-[10px]">Total Project Volume</div>
                            <div className="text-[32px] font-bold text-white leading-none tracking-tight pt-[6px]">{formatAmount(grandTotal)}</div>
                        </div>
                        
                        <div className="flex-1 flex flex-col">
                            <div className="flex gap-4 w-full">
                                {/* 427 PFV Box */}
                                <div className="flex-1 px-[20px] py-[16px] bg-[#151515] border border-transparent rounded-[16px] flex flex-col justify-between cursor-default transition-all">
                                    <span className="text-[14px] font-bold text-white tracking-tight mb-[12px]">427 PFV</span>
                                    <div className="flex flex-col gap-[6px]">
                                        <div className="flex justify-between items-center text-[13px]">
                                            <span className="text-[#86868B]">Equity</span>
                                            <span className="text-[#E5E5E5] font-semibold">{formatAmount(getTypeTotal(427, 'Refinancing', 'Equity'))}</span>
                                        </div>
                                        <div className="flex justify-between items-center text-[13px]">
                                            <span className="text-[#86868B]">Loan</span>
                                            <span className="text-[#E5E5E5] font-semibold">{formatAmount(getTypeTotal(427, 'Refinancing', 'Loan'))}</span>
                                        </div>
                                        <div className="border-t border-[#333] pt-[10px] mt-[6px] flex justify-between items-end">
                                            <span className="text-[13px] text-[#86868B] font-medium leading-none mb-[2px]">Total</span>
                                            <span className="text-[20px] font-bold text-white tracking-tight leading-none">{formatAmount(displayTotal427)}</span>
                                        </div>
                                    </div>
                                </div>
                                
                                {/* 816 PFV Box */}
                                <div className="flex-1 px-[20px] py-[16px] bg-[#151515] border border-transparent rounded-[16px] flex flex-col justify-between cursor-default transition-all">
                                    <span className="text-[14px] font-bold text-white tracking-tight mb-[12px]">816 PFV</span>
                                    <div className="flex flex-col gap-[6px]">
                                        <div className="flex justify-between items-center text-[13px]">
                                            <span className="text-[#86868B]">Equity</span>
                                            <span className="text-[#E5E5E5] font-semibold">{formatAmount(getTypeTotal(816, 'Refinancing', 'Equity'))}</span>
                                        </div>
                                        <div className="flex justify-between items-center text-[13px]">
                                            <span className="text-[#86868B]">Loan</span>
                                            <span className="text-[#E5E5E5] font-semibold">{formatAmount(getTypeTotal(816, 'Refinancing', 'Loan'))}</span>
                                        </div>
                                        <div className="border-t border-[#333] pt-[10px] mt-[6px] flex justify-between items-end">
                                            <span className="text-[13px] text-[#86868B] font-medium leading-none mb-[2px]">Total</span>
                                            <span className="text-[20px] font-bold text-white tracking-tight leading-none">{formatAmount(displayTotal816)}</span>
                                        </div>
                                    </div>
                                </div>
                                
                                {/* 421 Fund Box */}
                                <div className="flex-1 px-[20px] py-[16px] bg-[#151515] border border-transparent rounded-[16px] flex flex-col justify-between cursor-default transition-all">
                                    <span className="text-[14px] font-bold text-white tracking-tight mb-[12px]">421호 펀드</span>
                                    <div className="flex flex-col justify-end h-full">
                                        <div className="border-t border-[#333] pt-[10px] mt-auto flex justify-between items-end">
                                            <span className="text-[13px] text-[#86868B] font-medium leading-none mb-[2px]">Total</span>
                                            <span className="text-[20px] font-bold text-white tracking-tight leading-none">{formatAmount(total421)}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* IOTA One, Two Details */}
                    <div className="w-full mt-[42px] flex flex-col gap-0">
                        <VehicleDetailCard 
                            id="section-427" 
                            vehicleId="427"
                            title="IOTA One (427 PFV) 파이낸싱 구조" 
                            totalAmountStr={formatAmount(displayTotal427)} 
                            data={iotaData[427]['Refinancing']} 
                            toggleContent={null}
                        />
                        <VehicleDetailCard 
                            id="section-816" 
                            vehicleId="816"
                            title="IOTA Two (816 PFV) 파이낸싱 구조" 
                            totalAmountStr={formatAmount(displayTotal816)} 
                            data={iotaData[816]['Refinancing']} 
                            toggleContent={null}
                        />
                    </div>

                    <div className="w-full h-[14px]"></div>

                    {/* 월별 이자 발생 시계열 */}
                    <div className="w-full mb-[40px]">
                        <h2 className="text-[20px] font-bold text-white mb-[12px] uppercase tracking-tight">월별 이자 발생 시계열</h2>
                        <div className="w-full bg-[#1A1A1A] border border-[#333] rounded-[24px] p-[32px] h-[320px] relative overflow-hidden flex items-end justify-between px-[60px]">
                            {/* Dummy Y-axis labels */}
                            <div className="absolute left-[20px] top-[24px] bottom-[40px] flex flex-col justify-between text-[11px] text-[#666] font-['Inter'] pointer-events-none">
                                <span>300억</span>
                                <span>150억</span>
                                <span>0</span>
                            </div>
                            
                            {/* Dummy Bar Chart */}
                            {[...Array(12)].map((_, i) => {
                                const isProjected = i >= 3;
                                const trA = isProjected ? 0 : 80 + Math.random() * 20;
                                const trB = isProjected ? 0 : 30 + Math.random() * 10;
                                const trC = isProjected ? 0 : 15 + Math.random() * 5;
                                const totalH = trA + trB + trC;
                                
                                return (
                                    <div key={i} className="flex flex-col items-center gap-[12px] h-full justify-end w-[40px] group">
                                        <div className={`w-full flex flex-col justify-end gap-[1px] ${isProjected ? 'opacity-20' : ''} transition-opacity cursor-crosshair`} style={{height: '220px'}}>
                                            {isProjected ? (
                                                <div className="w-full h-[20px] bg-[#333] rounded-t-[4px]" title={`${i+1}월 - 입력 대기`}></div>
                                            ) : (
                                                <>
                                                    <div className="w-full bg-[#b889d9] rounded-t-[4px]" style={{height: `${trC}%`}} title={`Tr.C 이자: ${trC.toFixed(0)}억`}></div>
                                                    <div className="w-full bg-[#3aaab3]" style={{height: `${trB}%`}} title={`Tr.B 이자: ${trB.toFixed(0)}억`}></div>
                                                    <div className="w-full bg-[#5da0e7]" style={{height: `${trA}%`}} title={`Tr.A 이자: ${trA.toFixed(0)}억`}></div>
                                                </>
                                            )}
                                        </div>
                                        <span className="text-[12px] text-[#86868B] font-['Inter'] font-medium tracking-tighter">{`${26 + Math.floor((i + 3) / 12)}-${String(((i + 3) % 12) + 1).padStart(2, '0')}`}</span>
                                    </div>
                                );
                            })}
                        </div>
                        <p className="text-[12px] text-[#666] mt-[12px] ml-[8px] transform -translate-y-[1px]">금리·실행일·만기 입력 시 월별 발생액이 표시됩니다. (현재 UI 예시용 데이터 적용)</p>
                    </div>

                    {/* 본 PF 계획(통합 PF) */}
                    <div className="w-full mb-[40px]">
                        <h2 className="text-[20px] font-bold text-white mb-[12px] uppercase tracking-tight">본 PF 계획(통합 PF)</h2>
                        
                        <div className="w-full bg-[#1A1A1A] border border-[#3c3c3c] rounded-[24px] overflow-hidden p-[32px]">
                            <div className="flex justify-between items-center mb-[24px]">
                                <strong className="text-white text-[16px] font-bold tracking-tight">본 PF 전환 준비사항</strong>
                                <span className="text-[#86868B] text-[13px] font-bold">통합 기준</span>
                            </div>
                            
                            {/* Stepper Rail */}
                            <div className="flex gap-[12px] overflow-x-auto pb-[20px] mb-[12px] custom-scrollbar" style={{ WebkitOverflowScrolling: 'touch' }}>
                                {pfPlanData.map((item, idx) => (
                                    <div 
                                        key={idx} 
                                        onClick={() => setSelectedPfPlan(item)}
                                        className={`flex-shrink-0 w-[180px] h-[90px] border ${idx === 1 ? 'border-[#86868B] bg-[#222]' : 'border-[#333] bg-[#151515] hover:bg-[#1f1f1f]'} rounded-[12px] p-[16px] flex flex-col justify-between cursor-pointer transition-colors`}
                                    >
                                        <div className="text-[11px] font-bold text-[#86868B] font-['Inter']">STEP {item.step}</div>
                                        <div className="text-[14px] font-bold text-white leading-tight break-keep">{item.name}</div>
                                    </div>
                                ))}
                            </div>
                            
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr>
                                        <th className="px-[12px] py-[16px] text-[#86868B] font-bold text-[13px] border-b border-[#3c3c3c]">단계</th>
                                        <th className="px-[12px] py-[16px] text-[#86868B] font-bold text-[13px] border-b border-[#3c3c3c]">업무</th>
                                        <th className="px-[12px] py-[16px] text-[#86868B] font-bold text-[13px] border-b border-[#3c3c3c]">필요 자료</th>
                                        <th className="px-[12px] py-[16px] text-[#86868B] font-bold text-[13px] border-b border-[#3c3c3c]">카운터파티</th>
                                        <th className="px-[12px] py-[16px] text-[#86868B] font-bold text-[13px] border-b border-[#3c3c3c]">목표 일정</th>
                                        <th className="px-[12px] py-[16px] text-[#86868B] font-bold text-[13px] border-b border-[#3c3c3c] text-center w-[80px]">상세</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {pfPlanData.map((item, idx) => (
                                        <tr key={idx} className="border-b border-[#333] last:border-b-0 hover:bg-[#252525] transition-colors cursor-pointer group" onClick={() => setSelectedPfPlan(item)}>
                                            <td className="px-[12px] py-[16px] text-[#E5E5E5] font-['Inter'] text-[14px]">{item.step}</td>
                                            <td className="px-[12px] py-[16px] text-white font-bold text-[14px]">{item.name}</td>
                                            <td className="px-[12px] py-[16px] text-[#A1A1AA] text-[13px]">{item.materials}</td>
                                            <td className="px-[12px] py-[16px] text-[#A1A1AA] text-[13px]">{item.counterparty}</td>
                                            <td className="px-[12px] py-[16px] text-[#A1A1AA] text-[13px] font-['Inter']">{item.target}</td>
                                            <td className="px-[12px] py-[16px] text-center">
                                                <button className="px-[14px] py-[6px] border border-[#444] text-[#A1A1AA] rounded-full text-[12px] group-hover:bg-[#333] group-hover:text-white transition-colors" onClick={(e) => { e.stopPropagation(); setSelectedPfPlan(item); }}>상세</button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* 시장 이슈 모니터링 */}
                    <div className="w-full mb-[30px]">
                        <div className="flex justify-between items-end mb-[12px]">
                            <h2 className="text-[20px] font-bold text-white uppercase tracking-tight">시장 이슈 모니터링</h2>
                            <button 
                                onClick={fetchMarketNews}
                                disabled={newsLoading}
                                className="px-[16px] py-[8px] bg-transparent border border-[#444] text-[#E5E5E5] rounded-[10px] text-[13px] font-bold hover:bg-[#333] transition-colors disabled:opacity-50 flex items-center gap-[6px]"
                            >
                                {newsLoading ? (
                                    <svg className="animate-spin h-3 w-3 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                ) : (
                                    <svg className="w-[12px] h-[12px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
                                )}
                                뉴스 업데이트
                            </button>
                        </div>
                        
                        <div className="w-full bg-[#1A1A1A] border border-[#3c3c3c] rounded-[24px] p-[32px] flex flex-col">
                            {marketNews ? (
                                <div className="flex flex-col w-full divide-y divide-[#333]">
                                    {marketNews.items.map((group, idx) => (
                                        <div key={idx} className="flex items-start py-[24px] first:pt-0 last:pb-0">
                                            {/* Left side: Lender & Relation */}
                                            <div className="w-[300px] shrink-0 flex flex-col gap-[4px] pr-[20px]">
                                                <span className="text-white font-bold text-[16px]">{group.lender}</span>
                                                <span className="text-[#86868B] text-[14px] leading-snug break-keep">{group.relation}</span>
                                            </div>
                                            
                                            {/* Right side: 3 Articles */}
                                            <div className="flex-1 flex flex-col gap-[14px]">
                                                {group.articles.slice(0, 3).map((article, aIdx) => (
                                                    <a key={aIdx} href={article.url} target="_blank" rel="noreferrer" className="text-[#E5E5E5] text-[15px] hover:text-[#0a84ff] transition-colors leading-none truncate">
                                                        {article.title}
                                                    </a>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="w-full h-[200px] flex items-center justify-center text-[#666] text-[15px]">
                                    데이터를 불러오는 중입니다...
                                </div>
                            )}
                        </div>
                    </div>

                </div>
            )}
            {/* PF Plan Modal */}
            {selectedPfPlan && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setSelectedPfPlan(null)}>
                    <div className="bg-[#151515] border border-[#333] rounded-[24px] w-full max-w-[480px] overflow-hidden shadow-2xl flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
                        <div className="p-[24px] border-b border-[#333] flex justify-between items-start">
                            <div>
                                <h3 className="text-[20px] font-bold text-white tracking-tight mb-[4px]">본 PF 계획 · STEP {selectedPfPlan.step}</h3>
                                <div className="text-[14px] text-[#86868B]">{selectedPfPlan.name}</div>
                            </div>
                            <button 
                                className="w-[32px] h-[32px] rounded-full border border-[#444] text-[#86868B] hover:text-white hover:bg-[#333] flex items-center justify-center transition-colors"
                                onClick={() => setSelectedPfPlan(null)}
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                            </button>
                        </div>
                        <div className="p-[24px] overflow-y-auto flex flex-col gap-[16px]">
                            <div className="bg-[#1A1A1A] border border-[#333] rounded-[16px] p-[20px]">
                                <h4 className="text-[14px] font-bold text-white mb-[16px]">업무 정의</h4>
                                <div className="flex flex-col gap-[12px]">
                                    <div className="flex text-[13px]"><span className="text-[#86868B] w-[80px] shrink-0 font-medium">단계</span><span className="text-[#E5E5E5] font-['Inter']">{selectedPfPlan.step}</span></div>
                                    <div className="flex text-[13px]"><span className="text-[#86868B] w-[80px] shrink-0 font-medium">업무</span><span className="text-[#E5E5E5]">{selectedPfPlan.work || "-"}</span></div>
                                    <div className="flex text-[13px]"><span className="text-[#86868B] w-[80px] shrink-0 font-medium">필요 자료</span><span className="text-[#E5E5E5]">{selectedPfPlan.materials || "-"}</span></div>
                                    <div className="flex text-[13px]"><span className="text-[#86868B] w-[80px] shrink-0 font-medium">카운터파티</span><span className="text-[#E5E5E5]">{selectedPfPlan.counterparty || "-"}</span></div>
                                    <div className="flex text-[13px]"><span className="text-[#86868B] w-[80px] shrink-0 font-medium">목표 일정</span><span className="text-[#E5E5E5]">{selectedPfPlan.target || "-"}</span></div>
                                </div>
                            </div>
                            {selectedPfPlan.next && (
                                <div className="bg-[#1A1A1A] border border-[#333] rounded-[16px] p-[20px]">
                                    <h4 className="text-[14px] font-bold text-white mb-[8px]">다음 액션</h4>
                                    <p className="text-[13px] text-[#E5E5E5] leading-relaxed">{selectedPfPlan.next}</p>
                                </div>
                            )}
                            <div className="bg-[#1A1A1A] border border-[#333] rounded-[16px] p-[20px]">
                                <h4 className="text-[14px] font-bold text-white mb-[8px]">LFC 관리 포인트</h4>
                                <p className="text-[13px] text-[#E5E5E5] leading-relaxed">본 PF 계획은 통합 PF 기준의 준비 업무만 이 컴포넌트에서 관리하고, 세부 협의 이력은 상단 LFC 업무 로그에 남기는 구조입니다.</p>
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