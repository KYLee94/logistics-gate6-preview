import React, { useState, useEffect } from 'react';
import { supabase } from '../../../utils/supabaseClient';
import { useAuth } from '../../../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import WorkspaceActivityLog from './WorkspaceActivityLog';

const sscScopes = [
    { no: "01", title: "자산 상품화 전략 및 포지셔닝", desc: "자산 포지셔닝, 핵심 Value Proposition, 상품 차별화(USP), 임대·운영 관점 Feasibility 검토.", iota: "City of Well Life, The New Heritage of Seoul, 호텔 Social Sanctuary." },
    { no: "02", title: "공간 프로그램 및 사용자 경험 기획", desc: "공간 구성 원칙, 사용자 시나리오·동선 기준, 공간 프로그램 구조화, 디자인/설계 방향 검토.", iota: "라운지, 웰니스, 갤러리, 오피스/호텔/리테일 통합 경험, 주요 POI." },
    { no: "03", title: "플레이스메이킹", desc: "Place Identity, 지역 맥락 기반 스토리라인, 문화·집객 콘텐츠 전략, 공간 활성화 전략.", iota: "남산 연계, New Heritage 구현, Cultural Programming, Gateway Park." },
    { no: "04", title: "테크 솔루션", desc: "스마트빌딩 전략, 운영 시스템 구조, IoT/DT/Robotics, AI Ready 오피스 전략.", iota: "Building OS 구성, AI Ready Office, 기술 도입 범위와 기대효과 검토." },
    { no: "05", title: "자산 브랜딩 및 커뮤니케이션", desc: "브랜드 컨셉, 네이밍, 핵심 메시지, 브랜드·공간·콘텐츠 연결, 대외 커뮤니케이션.", iota: "Sales Kit 메시지 구조화, 투자자/리징 대응 Narrative." },
    { no: "06", title: "콘텐츠 / 솔루션 파트너십", desc: "전략 파트너 발굴, 콘텐츠/테크 파트너십, 운영사 검토 및 실행 관리.", iota: "디지털 아트 파트너, 웰니스 운영사, 외부 에이전시 협업 구조." },
    { no: "07", title: "멤버십 / 서비스 / 운영 모델", desc: "멤버십 구조, 서비스 프로그램, 운영 기준, 커뮤니티 운영 전략.", iota: "Tenant Membership, 프리미엄 멤버십, 서비스 프로그램." }
];

export default function WorkspaceDigital() {
    const { memberInfo } = useAuth();
    const isAuthorized = ['김현수', '이가현', '정수명', '전기영', '현철호', '신민호'].includes(memberInfo?.staff_name);
    
    const [tasks, setTasks] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isAdding, setIsAdding] = useState(false);
    const [newTask, setNewTask] = useState({
        task_name: '', ssc_theme: '01. 자산 상품화 전략 및 포지셔닝', related_asset: 'IOTA 공통', status: '아이데이션', priority: '중간', due_date: '', next_action: '', notes: ''
    });

    const [expandedTaskId, setExpandedTaskId] = useState(null);
    const [projectShowAll, setProjectShowAll] = useState(false);
    
    const [selectedTheme, setSelectedTheme] = useState(null);
    const [itemToDelete, setItemToDelete] = useState(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [showAuthAlert, setShowAuthAlert] = useState(false);

    // Asset filter and custom assets
    const [assetFilter, setAssetFilter] = useState('ALL');
    const [customAssets, setCustomAssets] = useState([]);
    const [showNewAssetModal, setShowNewAssetModal] = useState(false);
    const [newAssetName, setNewAssetName] = useState('');
    const [isSubmittingAsset, setIsSubmittingAsset] = useState(false);

    useEffect(() => {
        fetchTasks();
        const savedAssets = localStorage.getItem('iota_marketing_custom_assets');
        if (savedAssets) setCustomAssets(JSON.parse(savedAssets));
    }, []);

    const registerNewAsset = () => {
        if (!newAssetName.trim()) return;
        setIsSubmittingAsset(true);
        setTimeout(() => {
            const updated = [...customAssets, newAssetName.trim()];
            setCustomAssets(updated);
            localStorage.setItem('iota_marketing_custom_assets', JSON.stringify(updated));
            setNewTask({...newTask, related_asset: newAssetName.trim()});
            setIsSubmittingAsset(false);
            setShowNewAssetModal(false);
            setNewAssetName('');
        }, 300);
    };

    const fetchTasks = async () => {
        setIsLoading(true);
        try {
            const { data, error } = await supabase
                .from('iota_digital_tasks')
                .select('*')
                .order('created_at', { ascending: false });
            
            if (error) throw error;

            // [자동 동기화 로직] DB가 비어있고, 로컬 스토리지에 백업본이 있다면 자동으로 DB에 업로드합니다.
            const saved = localStorage.getItem('iota_digital_tasks_fallback');
            if ((!data || data.length === 0) && saved) {
                const localTasks = JSON.parse(saved);
                if (localTasks.length > 0) {
                    console.log("Syncing local tasks to newly created Supabase table...");
                    // temp- id를 제거하고 삽입 (DB에서 uuid 자동 생성)
                    const tasksToInsert = localTasks.map(t => {
                        const { id, ...rest } = t;
                        return (id && String(id).startsWith('temp-')) ? rest : t;
                    });
                    
                    const { error: insertError } = await supabase.from('iota_digital_tasks').insert(tasksToInsert);
                    if (!insertError) {
                        localStorage.removeItem('iota_digital_tasks_fallback'); // 동기화 성공 시 백업 삭제
                        
                        // 다시 DB에서 최신 데이터 불러오기
                        const { data: newData } = await supabase.from('iota_digital_tasks').select('*').order('created_at', { ascending: false });
                        setTasks(newData || []);
                        return;
                    }
                }
            }
            
            setTasks(data || []);
        } catch (e) {
            console.error('Failed to fetch tasks, falling back to localStorage:', e);
            const saved = localStorage.getItem('iota_digital_tasks_fallback');
            if (saved) setTasks(JSON.parse(saved));
            else setTasks([]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSaveRow = async () => {
        if (!newTask.task_name) return alert('Task 명을 입력해주세요.');
        const taskToSave = { ...newTask, created_at: new Date().toISOString(), id: `temp-${Date.now()}` };
        
        try {
            const { error } = await supabase.from('iota_digital_tasks').insert([{ ...newTask, created_at: taskToSave.created_at }]);
            if (error) throw error;
            fetchTasks();
        } catch (e) {
            console.error('Failed to save to DB, using localStorage:', e);
            const updated = [taskToSave, ...tasks];
            setTasks(updated);
            localStorage.setItem('iota_digital_tasks_fallback', JSON.stringify(updated));
        } finally {
            setNewTask({ task_name: '', ssc_theme: '01. 자산 상품화 전략 및 포지셔닝', related_asset: 'IOTA 공통', status: '아이데이션', priority: '중간', due_date: '', next_action: '', notes: '' });
            setIsAdding(false);
        }
    };

    const handleDeleteRow = async (id) => {
        setIsDeleting(true);
        try {
            const { error } = await supabase.from('iota_digital_tasks').delete().eq('id', id);
            if (error) throw error;
            fetchTasks();
        } catch (e) {
            console.error('Failed to delete from DB, using localStorage:', e);
            const updated = tasks.filter(t => t.id !== id);
            setTasks(updated);
            localStorage.setItem('iota_digital_tasks_fallback', JSON.stringify(updated));
        } finally {
            setIsDeleting(false);
            setItemToDelete(null);
        }
    };

    const handleAddClick = () => {
        if (!isAuthorized) {
            setShowAuthAlert(true);
            return;
        }

        let defaultTheme = '01. 자산 상품화 전략 및 포지셔닝';
        if (selectedTheme) {
            const matchedScope = sscScopes.find(scope => scope.no === selectedTheme);
            if (matchedScope) {
                defaultTheme = `${matchedScope.no}. ${matchedScope.title}`;
            }
        }

        setNewTask(prev => ({
            ...prev,
            ssc_theme: defaultTheme
        }));

        setIsAdding(true);
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
            await supabase.from('iota_digital_tasks').update({ created_at: current.created_at }).eq('id', current.id);
            await supabase.from('iota_digital_tasks').update({ created_at: prev.created_at }).eq('id', prev.id);
        } catch (e) {
            localStorage.setItem('iota_digital_tasks_fallback', JSON.stringify(newTasks));
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
            await supabase.from('iota_digital_tasks').update({ created_at: current.created_at }).eq('id', current.id);
            await supabase.from('iota_digital_tasks').update({ created_at: next.created_at }).eq('id', next.id);
        } catch (e) {
            localStorage.setItem('iota_digital_tasks_fallback', JSON.stringify(newTasks));
        }
    };

    const safeTasks = Array.isArray(tasks) ? tasks : [];
    const filteredTasks = safeTasks.filter(t => !selectedTheme || (t.ssc_theme && t.ssc_theme.startsWith(selectedTheme)));
    const sortedTasks = [...filteredTasks].sort((a, b) => {
        const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
        const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
        return (isNaN(timeB) ? 0 : timeB) - (isNaN(timeA) ? 0 : timeA);
    });

    const linkClass = "text-[#E5E5E5] hover:text-[#fbf167] cursor-pointer transition-colors hover:underline underline-offset-4 decoration-[#fbf167]/50";
    const parseNames = (text) => {
        if (!text) return text;
        const names = ['김현수', '이가현', '정수명', '전기영', '현철호', '신민호'];
        let result = text;
        names.forEach(name => {
            const regex = new RegExp(name, 'g');
            result = result.replace(regex, `<span class="${linkClass}">${name}</span>`);
        });
        return <span dangerouslySetInnerHTML={{ __html: result }} />;
    };

    const getThemeTitle = (no) => {
        const theme = sscScopes.find(t => t.no === no);
        return theme ? `${theme.no}. ${theme.title}` : no;
    };

    return (
        <div className="w-full flex-1 flex flex-col pt-[50px] pb-[160px] max-w-[1200px] mx-auto">
            {/* Header & Team Structure */}
            <div className="w-full flex justify-between items-center mb-[40px] gap-[40px]">
                {/* Header Metadata */}
                <div className="shrink-0 max-w-[460px]">
                    <h1 className="text-[36px] font-bold text-white tracking-tight leading-none font-['Inter'] mb-[12px]">상품·디지털</h1>
                    <p className="text-[15px] text-[#86868B] leading-[24px] break-keep">상품 차별화 전략·POC, 테넌트 경험 설계, 디지털 인프라(보안·통신·DC)</p>
                </div>
                
                {/* Team Structure */}
                <div className="border border-[#333] rounded-[24px] flex items-center bg-transparent shrink-0 pl-[20px] pr-[10px] py-[10px]">

                    {/* 공간솔루션 */}
                    <div className="w-[80px] shrink-0">
                        <span className="text-[13px] font-bold text-[#86868B]">공간솔루션</span>
                    </div>
                    <div className="flex items-center gap-[12px] w-[106px] shrink-0">
                        <div className="relative w-[30px] h-[30px] shrink-0 rounded-full bg-[#3c3c3c] flex items-center justify-center overflow-hidden ml-[2px]">
                            <img src={`${import.meta.env.BASE_URL}김현수.webp`} alt="김현수" className="w-full h-full object-cover" onError={(e) => { e.target.src = `${import.meta.env.BASE_URL}default_avatar.svg`; }} />
                            <div className="absolute inset-0 rounded-full border border-white/10 pointer-events-none"></div>
                        </div>
                        <div className="flex flex-col text-left">
                            <span className="text-white font-bold text-[13px] leading-tight">김현수</span>
                            <span className="text-[#A1A1AA] text-[12px] mt-[1px] leading-tight">센터장</span>
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-x-1.5 gap-y-2 -ml-[6px]">
                        {["이가현","정수명"].map(name => (
                            <div key={name} className="flex items-center gap-[6px] bg-[#222] border border-[#333] rounded-full pl-[4px] pr-[10px] py-[4px] min-w-[76px]">
                                <div className="w-[21px] h-[21px] shrink-0 rounded-full bg-[#3c3c3c] overflow-hidden">
                                    <img src={`${import.meta.env.BASE_URL}${name}.webp`} alt={name} className="w-full h-full object-cover" onError={(e) => { e.target.src = `${import.meta.env.BASE_URL}default_avatar.svg`; }} />
                                </div>
                                <span className="text-[#E5E5E5] text-[12px] font-medium leading-none">{name}</span>
                            </div>
                        ))}
                    </div>

                    {/* Vertical Separator */}
                    <div className="w-px h-[30px] bg-[#333] mx-[20px]"></div>

                    {/* 디지털사업 */}
                    <div className="w-[80px] shrink-0">
                        <span className="text-[13px] font-bold text-[#86868B]">디지털사업</span>
                    </div>
                    <div className="flex items-center gap-[12px] w-[106px] shrink-0">
                        <div className="relative w-[30px] h-[30px] shrink-0 rounded-full bg-[#3c3c3c] flex items-center justify-center overflow-hidden ml-[2px]">
                            <img src={`${import.meta.env.BASE_URL}현철호.webp`} alt="현철호" className="w-full h-full object-cover" onError={(e) => { e.target.src = `${import.meta.env.BASE_URL}default_avatar.svg`; }} />
                            <div className="absolute inset-0 rounded-full border border-white/10 pointer-events-none"></div>
                        </div>
                        <div className="flex flex-col text-left">
                            <span className="text-white font-bold text-[13px] leading-tight">현철호</span>
                            <span className="text-[#A1A1AA] text-[12px] mt-[1px] leading-tight">그룹장</span>
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-x-1.5 gap-y-2 -ml-[6px]">
                        {["신민호"].map(name => (
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

            <WorkspaceActivityLog workspaceCode="WS_SSC" workspaceLabel="상품·디지털-SSC" />

            {/* SSC 상품·디지털 업무 범위 */}
            <div className="w-full mt-[20px] mb-0 relative">
                <h2 className="text-[22px] font-bold text-white mb-[14px]">SSC 상품·디지털 업무 범위</h2>
                <div className="max-w-none overflow-x-auto hide-scrollbar pb-[20px] w-[calc(50vw-140px+50%)]">
                    <div className="flex gap-[20px] w-max pr-[40px]">
                        {sscScopes.map((item, idx) => {
                            const isSelected = selectedTheme === item.no;
                            return (
                            <div 
                                key={idx} 
                                onClick={() => setSelectedTheme(isSelected ? null : item.no)}
                                className={`w-[300px] shrink-0 bg-[#272727] border ${isSelected ? 'border-[#2997ff]' : 'border-[#3c3c3c] hover:border-[#555]'} rounded-[16px] p-[28px] flex flex-col cursor-pointer transition-colors`}
                            >
                                <span className={`text-[20px] font-bold mb-[12px] ${isSelected ? 'text-[#2997ff] opacity-100' : 'text-[#86868B] opacity-60'}`}>{item.no}</span>
                                <h3 className={`text-[20px] font-bold mb-[16px] break-keep min-h-[56px] transition-colors ${isSelected ? 'text-[#2997ff]' : 'text-white'}`}>{item.title}</h3>
                                <p className="text-[15px] text-[#A1A1AA] leading-[1.6] break-keep mb-[32px] flex-1">{item.desc}</p>
                                <div className="text-[15px] text-[#A1A1AA] leading-[1.6] break-keep mt-auto pt-[20px] border-t border-[#3c3c3c]">
                                    <span className="text-[#2997ff] font-bold block mb-[4px]">IOTA Seoul</span>
                                    {item.iota}
                                </div>
                            </div>
                        )})}
                    </div>
                </div>
            </div>

            {/* 2. 주요 테스크 관리 */}
            <div className="flex justify-between items-center mt-[20px] mb-[10px]">
                <h2 className="text-[18px] font-bold text-white tracking-tight flex items-center">
                    상품·디지털 주요 테스크 관리
                    {selectedTheme && <span className="ml-3 px-2 py-1 bg-[#2997ff]/10 text-[#2997ff] rounded-[6px] text-[13px] font-bold">필터: {getThemeTitle(selectedTheme)}</span>}
                </h2>
                <div className="flex gap-2 items-center">
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
            
            <motion.div layout className="w-full flex flex-col gap-[16px] mb-[40px]">
                {isAdding && (
                    <div className="bg-[#272726] border border-[#3c3c3c] rounded-[24px] p-6 flex flex-col gap-4">
                        <div className="flex gap-4">
                            <input 
                                type="text" 
                                value={newTask.task_name} 
                                onChange={e => setNewTask({...newTask, task_name: e.target.value})} 
                                className="flex-[2] bg-[#1A1A1A] border border-[#444] rounded-[12px] px-4 py-3 text-white text-[16px] font-bold outline-none focus:border-[#888]" 
                                placeholder="Task 입력" 
                            />
                            <select 
                                value={newTask.ssc_theme} 
                                onChange={e => setNewTask({...newTask, ssc_theme: e.target.value})} 
                                className="flex-1 bg-[#1A1A1A] border border-[#444] rounded-[12px] px-4 py-3 text-[#2997ff] font-bold text-[14px] outline-none focus:border-[#888] cursor-pointer"
                            >
                                {sscScopes.map(scope => (
                                    <option key={scope.no} value={`${scope.no}. ${scope.title}`}>[주제선택] {scope.no}. {scope.title}</option>
                                ))}
                            </select>
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
                            placeholder="링크나 비고 입력 (선택사항)" 
                        />
                        <div className="flex flex-wrap gap-4 items-center">
                            <select 
                                value={newTask.related_asset} 
                                onChange={e => setNewTask({...newTask, related_asset: e.target.value})} 
                                className="bg-[#1A1A1A] border border-[#444] rounded-[10px] px-3 py-2 text-white text-[14px] outline-none focus:border-[#888] cursor-pointer"
                            >
                                <option value="IOTA 공통">IOTA 공통</option>
                                <option value="427 PFV">427 PFV</option>
                                <option value="816 PFV">816 PFV</option>
                                <option value="421 Fund">421 Fund</option>
                            </select>
                            <select value={newTask.status} onChange={e => setNewTask({...newTask, status: e.target.value})} className="bg-[#1A1A1A] border border-[#444] rounded-[10px] px-3 py-2 text-white text-[14px] outline-none focus:border-[#888]">
                                {['아이데이션', '자료준비', '제안진행', '미팅후속', '협상', '보류', '완료'].map(s => <option key={s}>{s}</option>)}
                            </select>
                            <select value={newTask.priority} onChange={e => setNewTask({...newTask, priority: e.target.value})} className="bg-[#1A1A1A] border border-[#444] rounded-[10px] px-3 py-2 text-white text-[14px] outline-none focus:border-[#888]">
                                <option>높음</option>
                                <option>중간</option>
                                <option>낮음</option>
                            </select>
                            <input type="date" value={newTask.due_date} onChange={e => setNewTask({...newTask, due_date: e.target.value})} className="bg-[#1A1A1A] border border-[#444] rounded-[10px] px-3 py-2 text-[#A1A1AA] text-[14px] outline-none focus:border-[#888] [color-scheme:dark]" />
                            <div className="flex gap-2 ml-auto">
                                <button onClick={() => setIsAdding(false)} className="px-5 py-2 bg-[#3c3c3c]/50 text-[#86868B] border border-[#444] rounded-[10px] text-[14px] font-bold hover:bg-[#3c3c3c] hover:text-white transition-colors cursor-pointer">취소</button>
                                <button onClick={handleSaveRow} className="px-5 py-2 bg-[#059669]/20 text-[#34d399] border border-[#059669]/30 rounded-[10px] text-[14px] font-bold hover:bg-[#059669]/40 transition-colors cursor-pointer">저장</button>
                            </div>
                        </div>
                    </div>
                )}
                
                {isLoading ? (
                    <motion.div layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-center py-[40px] text-[#86868B]">데이터를 불러오는 중입니다...</motion.div>
                ) : sortedTasks.length === 0 ? (
                    <motion.div layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-center py-[60px] text-[#A1A1AA] bg-[#1a1a1a] rounded-[24px] border border-[#333]">
                        {selectedTheme ? '해당 주제로 등록된 테스크가 없습니다.' : '등록된 테스크가 없습니다.'}
                    </motion.div>
                ) : (
                    <div className="flex flex-col gap-[10px]">
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
                                className={`w-full relative bg-[#272726] border border-[#3c3c3c] rounded-[24px] px-6 pt-[20px] pb-[20px] cursor-pointer transition-colors duration-300 group/row ${(expandedTaskId === 'ALL' || expandedTaskId === row.id) ? 'hover:bg-[#272726]' : 'hover:bg-[#333]'}`}
                            >
                            {/* 삭제 및 정렬 버튼 */}
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
                                        onClick={(e) => { e.stopPropagation(); setItemToDelete({ id: row.id, message: '정말 삭제하시겠습니까?' }); }} 
                                        className="px-3 py-2 h-[60px] bg-[#ef4444]/10 text-[#ef4444] border border-[#ef4444]/30 rounded-[8px] text-[13px] font-bold hover:bg-[#ef4444]/20 cursor-pointer"
                                    >
                                        삭제
                                    </button>
                                </div>
                            )}
                            <div className="flex justify-between items-start gap-8">
                                <div className="flex-1 flex gap-8">
                                    <div className="w-[650px] shrink-0 flex flex-col gap-[2px] border-r border-[#444]/50 pr-8">
                                        <div className="flex items-center gap-2">
                                            <span className="text-[13px] font-bold text-[#86868B]">Task</span>
                                            {row.ssc_theme && (
                                                <span className="px-2 py-[2px] bg-[#2997ff]/10 text-[#2997ff] border border-[#2997ff]/20 rounded-[4px] text-[11px] font-bold whitespace-nowrap overflow-hidden text-ellipsis max-w-[200px]">
                                                    {row.ssc_theme.split('.')[0]} {/* Show just '01' or '02' if we want, or full text. I'll split by dot to keep it short */}
                                                </span>
                                            )}
                                        </div>
                                        <h3 className="text-[21px] font-bold text-white tracking-tight leading-tight mt-1">
                                            {row.task_name}
                                        </h3>
                                    </div>
                                    <div className="flex-1 flex flex-col gap-[2px] pr-4">
                                        <span className="text-[13px] font-bold text-[#86868B]">Next Action</span>
                                        <p className="text-[18px] text-[#bbb9af] leading-relaxed break-keep font-medium mt-1">
                                            {parseNames(row.next_action)}
                                        </p>
                                    </div>
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
                                        <span className={`px-2 py-1 rounded-[6px] text-[13px] font-bold w-max ${row.status === '제안진행' || row.status === '협상' ? 'bg-[#059669]/20 text-[#34d399]' : row.status === '자료준비' || row.status === '아이데이션' ? 'bg-[#d97706]/20 text-[#fbf167]' : row.status === '완료' ? 'bg-[#2563eb]/20 text-[#60a5fa]' : 'bg-[#4b5563]/20 text-[#9ca3af]'}`}>
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
                                    <div className="flex items-center gap-3 ml-auto">
                                        <span className="text-[13px] font-bold text-[#86868B]">주제 연동</span>
                                        <span className="text-[14px] text-[#2997ff] font-medium">{row.ssc_theme}</span>
                                    </div>
                                </div>
                                {row.notes && (
                                <div className="flex items-start gap-4 mt-4 pt-4 border-t border-[#333]/50">
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
            </motion.div>

            {/* Delete Confirmation Modal */}
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

            {/* Auth Alert Modal */}
            {showAuthAlert && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60">
                    <div className="bg-[#222] border border-[#333] rounded-[16px] w-[320px] p-[24px] shadow-2xl flex flex-col items-center">
                        <div className="w-[48px] h-[48px] rounded-full bg-white/10 flex items-center justify-center mb-[16px]">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fbf167" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                        </div>
                        <h3 className="text-[16px] font-bold text-white mb-[8px] text-center">권한 없음</h3>
                        <p className="text-[13px] text-[#86868B] text-center mb-[24px]">상품·디지털 책임 담당자만 등록 가능합니다.</p>
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
