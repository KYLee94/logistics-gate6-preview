import React, { useState, useEffect } from 'react';
import { supabase } from '../../../utils/supabaseClient';
import { useAuth } from '../../../context/AuthContext';
import WorkspaceActivityLog from './WorkspaceActivityLog';

export default function WorkspaceMarketing() {
    const { memberInfo } = useAuth();
    const isAuthorized = ['김민지', '고아라', '전기영'].includes(memberInfo?.staff_name);
    
    const [tasks, setTasks] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isAdding, setIsAdding] = useState(false);
    const [sortBy, setSortBy] = useState('마감일');
    const [newTask, setNewTask] = useState({
        task_name: '', company_name: '', related_asset: 'IOTA 공통', status: '아이데이션', priority: '중간', due_date: '', next_action: ''
    });

    const [expandedTaskId, setExpandedTaskId] = useState(null);
    const [projectShowAll, setProjectShowAll] = useState(false);
    const [pipelineShowAll, setPipelineShowAll] = useState(false);

    // Stakeholder States
    const [masterStakeholders, setMasterStakeholders] = useState([]);
    const [companyQuery, setCompanyQuery] = useState('');
    const [showCompanyDropdown, setShowCompanyDropdown] = useState(false);
    const [showNewStakeholderModal, setShowNewStakeholderModal] = useState(false);
    const [newStakeholderRole, setNewStakeholderRole] = useState('');

    useEffect(() => {
        fetchTasks();
        fetchMasterStakeholders();
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
                company_name: companyQuery
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

    const uniqueCompanies = [...new Set(masterStakeholders.map(s => s.company_name).filter(Boolean))];
    const filteredCompanies = uniqueCompanies.filter(c => c.toLowerCase().includes(companyQuery.toLowerCase()));

    const fetchTasks = async () => {
        try {
            const { data, error } = await supabase
                .from('iota_marketing_tasks')
                .select('*')
                .order('created_at', { ascending: false });
            if (error) throw error;
            setTasks(data || []);
        } catch (e) {
            console.error('Failed to fetch tasks:', e);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSaveRow = async () => {
        if (!newTask.task_name) return alert('Task 명을 입력해주세요.');
        try {
            const { error } = await supabase.from('iota_marketing_tasks').insert([newTask]);
            if (error) throw error;
            
            setNewTask({ task_name: '', company_name: '', related_asset: 'IOTA 공통', status: '아이데이션', priority: '중간', due_date: '', next_action: '' });
            setCompanyQuery('');
            setIsAdding(false);
            fetchTasks();
        } catch (e) {
            console.error('Failed to save task:', e);
            alert('저장 중 오류가 발생했습니다.');
        }
    };

    const handleDeleteRow = async (id) => {
        if (!isAuthorized) return alert('삭제 권한이 없습니다.');
        if (!confirm('정말 삭제하시겠습니까?')) return;
        try {
            const { error } = await supabase.from('iota_marketing_tasks').delete().eq('id', id);
            if (error) throw error;
            fetchTasks();
        } catch (e) {
            console.error('Failed to delete task:', e);
            alert('삭제 중 오류가 발생했습니다.');
        }
    };

    const handleAddClick = () => {
        if (!isAuthorized) {
            alert('등록 권한이 없습니다.');
            return;
        }
        setIsAdding(true);
    };

    const linkClass = "text-[#E5E5E5] hover:text-[#fbf167] cursor-pointer transition-colors hover:underline underline-offset-4 decoration-[#fbf167]/50";
    
    // Auto-link function for names
    const parseNames = (text) => {
        if (!text) return text;
        const names = ['김민지', '고아라', '이가현', '정수명', '박성진', '노혜란', '여인모', '이경호', '안지하'];
        let result = text;
        names.forEach(name => {
            const regex = new RegExp(name, 'g');
            result = result.replace(regex, `<span class="${linkClass}">${name}</span>`);
        });
        return <span dangerouslySetInnerHTML={{ __html: result }} />;
    };

    const projects = [{"id": "project-1775907338675", "name": "SK계열사 통합 이전 제안", "company": "SK", "asset": "이오타 서울", "status": "자료 준비", "priority": "상", "dueDate": "2026-04-16", "nextAction": "안지하 이사님 소개로 CHM 1차 미팅"}, {"id": "project-lg-proposal", "name": "LG전자 지주 제안 준비", "company": "LG", "asset": "이오타 서울", "status": "제안 진행", "priority": "상", "dueDate": "2026-04-15", "nextAction": "LG전자 지주 제안안 DC 및 오피스 세부안 준비"}, {"id": "project-semifive-meeting", "name": "Semifive 3차 미팅", "company": "Semifive", "asset": "타임워크 분당", "status": "제안 진행", "priority": "상", "dueDate": "2026-04-15", "nextAction": "인테리어 지원 세부 사항 협의 및 IT팀 미팅"}, {"id": "project-pwc-followup", "name": "PwC 킥오프 자료 준비", "company": "PwC", "asset": "이오타 서울", "status": "자료 준비", "priority": "상", "dueDate": "2026-04-13", "nextAction": "이오타 서울 기업군 및 현대차 새만금 프로젝트 기업 컨택 논의"}, {"id": "project-hyundai-study", "name": "새만금 현대차 프로젝트", "company": "Hyundai Motor", "asset": "현대차 새만금 DC", "status": "아이데이션", "priority": "상", "dueDate": "2026-04-17", "nextAction": "새만금 프로젝트 현대차 프로젝트 관련 스터디"}, {"id": "project-cmc-deck", "name": "EMC 소개 자료 작성", "company": "Corporate Marketing Center 내부", "asset": "-", "status": "자료 준비", "priority": "중", "dueDate": "2026-04-17", "nextAction": "1차본 완성, 보완 작업"}, {"id": "project-iota-study", "name": "IOTA 세일즈 타겟사 리스트 업데이트", "company": "IOTA 타깃사 풀", "asset": "이오타 서울", "status": "자료 준비", "priority": "상", "dueDate": "2026-04-24", "nextAction": "업종별 타깃 기업을 앵커 후보, 전략 후보, nurture 후보로 나누어 정리"}, {"id": "project-timework-video", "name": "타임워크웨스트 마케팅 영상", "company": "Corporate Marketing Center 내부", "asset": "타임워크 신도림", "status": "미팅 후속", "priority": "하", "dueDate": "2026-04-17", "nextAction": "영상 전달본의 메시지 구조와 캡션 정리를 마무리"}, {"id": "project-iota-saleskit-review", "name": "IOTA 세일즈킷 보완 내부 회의", "company": "Corporate Marketing Center 내부", "asset": "이오타 서울", "status": "자료 준비", "priority": "중", "dueDate": "2026-04-24", "nextAction": "현재 세일즈킷 외 오피스 내용 보완 방안 논의"}, {"id": "project-seoripul-saleskit", "name": "서리풀 세일즈킷 목차 초안 작성", "company": "Corporate Marketing Center 내부", "asset": "서리풀", "status": "자료 준비", "priority": "중", "dueDate": "2026-05-01", "nextAction": "서리풀 프로젝트 오피스 세일즈킷 준비"}];
    const pipelines = [{"id": "task-pipe-pwc", "channelName": "PwC삼일회계법인", "matchedProject": "이오타서울, 현대차새만금프로젝트", "bucket": "이번주", "status": "진행 중", "progressDetail": "킥오프 미팅 통한 이오타 서울 임차기업 리스트업 및 현대차 새만금 연계 검토", "managementPlan": "주기적 미팅 및 보상 방안 구조화", "contactPoint": "박성진 부대표 메인"}, {"id": "task-pipe-samsungpb", "channelName": "삼성증권PB", "matchedProject": "타임워크신도림, 분당롯데", "bucket": "이번주", "status": "진행 중", "progressDetail": "타임워크 신도림 계약서 검토 단계, 타임워크 분당 양사 연결 브리핑 진행", "managementPlan": "주기적 미팅 및 신규 기업 물색", "contactPoint": "노혜란 지점장, 여인모 위원"}, {"id": "task-pipe-saramin", "channelName": "사람인", "matchedProject": "타임워크신도림", "bucket": "다음주", "status": "진행 중", "progressDetail": "사람인 사이트 하위 메뉴에 임차 정보 확인 및 임차 제안서 신규 업로드 요청", "managementPlan": "주기적 미팅 및 진행 현황 체크, 실효성 검토", "contactPoint": "이경호 본부장"}, {"id": "task-pipe-rsquare", "channelName": "알스퀘어", "matchedProject": "미정", "bucket": "다음주", "status": "대기", "progressDetail": "알스퀘어 TR DB 구축형 활용 가능 여부 협의", "managementPlan": "1차 미팅 예정", "contactPoint": "미정"}];

    const visibleProjects = projectShowAll ? projects : projects.slice(0, 5);
    const visiblePipelines = pipelineShowAll ? pipelines : pipelines.slice(0, 5);

    const thisWeekTasks = pipelines.filter(t => t.bucket === '이번주');
    const nextWeekTasks = pipelines.filter(t => t.bucket === '다음주');

    const sortedTasks = [...tasks].sort((a, b) => {
        if (sortBy === '마감일') {
            if (!a.due_date) return 1;
            if (!b.due_date) return -1;
            return new Date(a.due_date) - new Date(b.due_date);
        } else {
            const priorityOrder = { '높음': 3, '중간': 2, '낮음': 1 };
            const pA = priorityOrder[a.priority] || 0;
            const pB = priorityOrder[b.priority] || 0;
            if (pA !== pB) return pB - pA;
            if (!a.due_date) return 1;
            if (!b.due_date) return -1;
            return new Date(a.due_date) - new Date(b.due_date);
        }
    });

    return (
                <div className="w-full flex-1 flex flex-col pt-[50px] pb-[60px] max-w-[1200px] mx-auto">
            {/* Header & Team Structure */}
            <div className="w-full flex justify-between items-center mb-[40px] gap-[40px]">
                {/* Header Metadata */}
                <div className="shrink-0 max-w-[400px]">
                    <h1 className="text-[36px] font-bold text-white tracking-tight leading-none font-['Inter'] mb-[12px]">기업마케팅</h1>
                    <p className="text-[15px] text-[#86868B] leading-[24px] break-keep">기업마케팅센터 (CMC) 업무 프로그레스 및 기업마케팅 DB</p>
                </div>
                
                {/* Team Structure */}
                <div className="border border-[#333] rounded-[24px] flex flex-col bg-transparent shrink-0">

                    
                    <div className="flex items-center pl-[20px] pr-[10px] py-[10px]">
                        <div className="w-[80px] shrink-0">
                            <span className="text-[13px] font-bold text-[#86868B]">기업마케팅</span>
                        </div>
                        <div className="flex items-center gap-[12px] w-[130px] shrink-0">
                            <div className="relative w-[30px] h-[30px] shrink-0 rounded-full bg-[#3c3c3c] flex items-center justify-center overflow-hidden ml-[2px]">
                                <img src={`${import.meta.env.BASE_URL}김민지.webp`} alt="김민지" className="w-full h-full object-cover" onError={(e) => { e.target.src = `${import.meta.env.BASE_URL}default_avatar.svg`; }} />
                                <div className="absolute inset-0 rounded-full border border-white/10 pointer-events-none"></div>
                            </div>
                            <div className="flex flex-col text-left">
                                <span className="text-white font-bold text-[13px] leading-tight">김민지</span>
                                <span className="text-[#A1A1AA] text-[12px] mt-[1px] leading-tight">기업마케팅담당</span>
                            </div>
                        </div>
                        <div className="flex flex-wrap gap-x-1.5 gap-y-2 -ml-[6px]">
                            {[{img: '고아라', label: '고아라'}, {img: '권순일', label: '권순일(자문)'}].map(member => (
                                <div key={member.label} className="flex items-center gap-[6px] bg-[#222] border border-[#333] rounded-full pl-[4px] pr-[10px] py-[4px] min-w-[76px]">
                                    <div className="w-[21px] h-[21px] shrink-0 rounded-full bg-[#3c3c3c] overflow-hidden">
                                        <img src={`${import.meta.env.BASE_URL}${member.img}.webp`} alt={member.label} className="w-full h-full object-cover" onError={(e) => { e.target.src = `${import.meta.env.BASE_URL}default_avatar.svg`; }} />
                                    </div>
                                    <span className="text-[#E5E5E5] text-[12px] font-medium leading-none">{member.label}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
            
            <WorkspaceActivityLog workspaceCode="WS_EMC" workspaceLabel="기업마케팅-EMC" />

                        {/* 2. Task 관리 */}
            <div className="w-full mt-[6px] border-t border-[#3c3c3c] pt-[32px]"></div>
            <div className="flex justify-between items-center mb-[10px]">
                <h2 className="text-[18px] font-bold text-white tracking-tight">기업마케팅 주요 테스크 관리</h2>
                <div className="flex gap-2 items-center">
                    <div className="relative">
                        <select 
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value)}
                            className="px-[12px] py-[6px] bg-[#272726] border border-[#3c3c3c] text-[#A1A1AA] text-[13px] rounded-[8px] outline-none focus:border-[#555] appearance-none pr-[30px] cursor-pointer"
                        >
                            <option value="마감일">마감일 순으로 보기</option>
                            <option value="중요도">중요도 순으로 보기</option>
                        </select>
                        <div className="absolute right-[10px] top-1/2 -translate-y-1/2 pointer-events-none text-[#86868B]">
                            <svg width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                        </div>
                    </div>
                    <button 
                        onClick={handleAddClick}
                        className="px-[14px] py-[6px] bg-[#333] hover:bg-[#444] border border-[#444] text-[#E5E5E5] text-[13px] font-bold rounded-[8px] transition-colors cursor-pointer"
                    >
                        + Task 등록하기
                    </button>
                </div>
            </div>
            <div className="w-full flex flex-col gap-[16px] mb-[40px]">
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
                                    placeholder="연결 기업 검색" 
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
                            <select value={newTask.related_asset} onChange={e => setNewTask({...newTask, related_asset: e.target.value})} className="bg-[#1A1A1A] border border-[#444] rounded-[10px] px-3 py-2 text-white text-[14px] outline-none focus:border-[#888]">
                                <option>IOTA 공통</option>
                                <option>IOTA 427</option>
                                <option>IOTA 816</option>
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
                                <button onClick={() => { setIsAdding(false); setCompanyQuery(''); }} className="px-5 py-2 bg-[#3c3c3c]/50 text-[#86868B] border border-[#444] rounded-[10px] text-[14px] font-bold hover:bg-[#3c3c3c] hover:text-white transition-colors cursor-pointer">취소</button>
                                <button onClick={handleSaveRow} className="px-5 py-2 bg-[#059669]/20 text-[#34d399] border border-[#059669]/30 rounded-[10px] text-[14px] font-bold hover:bg-[#059669]/40 transition-colors cursor-pointer">저장</button>
                            </div>
                        </div>
                    </div>
                )}
                
                {isLoading ? (
                    <div className="text-center py-[40px] text-[#86868B]">데이터를 불러오는 중입니다...</div>
                ) : (
                    <div className="flex flex-col gap-[10px]">
                        {(projectShowAll ? sortedTasks : sortedTasks.slice(0, 5)).map((row) => (
                        <div 
                            key={row.id} 
                            onClick={() => setExpandedTaskId(expandedTaskId === row.id ? null : row.id)}
                            className={`relative bg-[#272726] border border-[#3c3c3c] rounded-[24px] px-6 pt-6 pb-4 cursor-pointer transition-all duration-300 group ${expandedTaskId === row.id ? 'hover:bg-[#272726]' : 'hover:bg-[#333]'}`}
                        >
                            <div className="absolute right-[-70px] top-6">
                                <button 
                                    onClick={(e) => { e.stopPropagation(); handleDeleteRow(row.id); }} 
                                    className="px-4 py-2 bg-[#ef4444]/10 text-[#ef4444] border border-[#ef4444]/30 rounded-[12px] text-[14px] font-bold opacity-0 group-hover:opacity-100 transition-all hover:bg-[#ef4444]/20 cursor-pointer"
                                >
                                    삭제
                                </button>
                            </div>
                            <div className="flex justify-between items-start gap-8">
                                <div className="flex-1 flex gap-8">
                                    <div className="w-[430px] shrink-0 flex flex-col gap-[2px] border-r border-[#444]/50 pr-8">
                                        <span className="text-[13px] font-bold text-[#86868B]">Task</span>
                                        <h3 className="text-[21px] font-bold text-white tracking-tight leading-tight">
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
                                        <span className="text-[13px] font-medium text-[#86868B]">연결기업</span>
                                    )}
                                    <span className="text-[15px] font-bold text-[#E5E5E5] px-4 py-2 bg-[#1A1A1A] rounded-[12px] border border-[#333]">
                                        {row.company_name || '내부업무'}
                                    </span>
                                </div>
                            </div>
                            
                            <div className={`overflow-hidden transition-all duration-300 ease-in-out ${expandedTaskId === row.id ? 'max-h-[200px] mt-4 pt-4 border-t border-[#3c3c3c] opacity-100' : 'max-h-0 opacity-0'}`}>
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
                                </div>
                            </div>
                        </div>
                        ))}
                    </div>
                )}
                
                {tasks.length > 6 && (
                    <div className="w-full flex justify-center mt-2">
                        <button 
                            onClick={() => setProjectShowAll(!projectShowAll)}
                            className="text-[14px] font-bold text-[#A1A1AA] hover:text-white bg-[#272726] hover:bg-[#333] border border-[#3c3c3c] rounded-[16px] transition-colors px-6 py-3 cursor-pointer"
                        >
                            {projectShowAll ? '접기' : `더보기 (${tasks.length - 5}개)`}
                        </button>
                    </div>
                )}
            </div>
            {/* 3. Pipeline 관리 */}
            <div className="flex justify-between items-end mb-[12px]">
                <h2 className="text-[18px] font-bold text-white">Pipe line 관리</h2>
                <span className="text-[13px] text-[#86868B]">수기 입력 중심 운영 (컨택 포인트 포함)</span>
            </div>
            <div className="w-full bg-[#272726] border border-[#3c3c3c] rounded-[24px] overflow-hidden mb-[40px]">
                <table className="w-full text-left">
                    <thead>
                        <tr>
                            <th className="px-[20px] py-[16px] text-[13px] font-bold text-[#86868B] border-b border-[#333]">채널명</th>
                            <th className="px-[20px] py-[16px] text-[13px] font-bold text-[#86868B] border-b border-[#333]">상태</th>
                            <th className="px-[20px] py-[16px] text-[13px] font-bold text-[#86868B] border-b border-[#333]">매칭 프로젝트</th>
                            <th className="px-[20px] py-[16px] text-[13px] font-bold text-[#86868B] border-b border-[#333] w-[25%]">진행 내용</th>
                            <th className="px-[20px] py-[16px] text-[13px] font-bold text-[#86868B] border-b border-[#333] w-[20%]">관리 방안</th>
                            <th className="px-[20px] py-[16px] text-[13px] font-bold text-[#86868B] border-b border-[#333]">컨택 포인트</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-[#333]">
                        {visiblePipelines.map((row, idx) => (
                            <tr key={idx} className="hover:bg-[#292928] transition-colors">
                                <td className="px-[20px] py-[16px] text-[15px] font-bold text-white">{row.channelName}</td>
                                <td className="px-[20px] py-[16px]">
                                    <span className={`px-2 py-1 rounded text-[12px] font-bold border ${row.status === '진행 중' ? 'bg-[#059669]/20 text-[#34d399] border-[#059669]/30' : 'bg-[#4b5563]/20 text-[#9ca3af] border-[#4b5563]/30'}`}>
                                        {row.status}
                                    </span>
                                </td>
                                <td className="px-[20px] py-[16px] text-[14px] text-[#A1A1AA]">{row.matchedProject}</td>
                                <td className="px-[20px] py-[16px] text-[14px] text-[#E5E5E5] leading-relaxed">{parseNames(row.progressDetail)}</td>
                                <td className="px-[20px] py-[16px] text-[14px] text-[#A1A1AA] leading-relaxed">{parseNames(row.managementPlan)}</td>
                                <td className="px-[20px] py-[16px] text-[14px] text-[#A1A1AA]">{parseNames(row.contactPoint)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {pipelines.length > 5 && (
                    <div className="w-full border-t border-[#333] p-2 flex justify-center bg-[#222] rounded-b-[23px]">
                        <button 
                            onClick={() => setPipelineShowAll(!pipelineShowAll)}
                            className="text-[13px] font-bold text-[#A1A1AA] hover:text-white transition-colors px-4 py-2 cursor-pointer"
                        >
                            {pipelineShowAll ? '접기' : `더보기 (${pipelines.length - 5}개)`}
                        </button>
                    </div>
                )}
            </div>
            {/* Pipeline 관리 하단 */}
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
                            <div className="absolute right-[12px] top-1/2 -translate-y-1/2 pointer-events-none text-[#86868B]">
                                <svg width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                            </div>
                        </div>

                        <div className="flex items-center gap-[12px] w-full">
                            <button onClick={() => setShowNewStakeholderModal(false)} className="flex-1 py-[10px] rounded-[8px] bg-[#333] hover:bg-[#444] text-white text-[13px] font-medium transition-colors cursor-pointer">취소</button>
                            <button onClick={registerMasterStakeholder} className="flex-1 py-[10px] rounded-[8px] bg-[#2997ff] hover:bg-[#0071e3] text-white text-[13px] font-bold transition-colors cursor-pointer">등록 후 저장</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
