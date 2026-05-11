import React, { useState, useEffect } from 'react';
import { supabase } from '../../../utils/supabaseClient';
import { motion, AnimatePresence } from 'framer-motion';

export default function WorkspacePmArchive() {
    const [snapshots, setSnapshots] = useState([]);
    const [selectedSnapshotIds, setSelectedSnapshotIds] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [workspaceFilter, setWorkspaceFilter] = useState(() => {
        const params = new URLSearchParams(window.location.search);
        return params.get('workspace') || 'pm';
    });

    const workspaces = [
        { id: 'pm', name: '사업 PM', icon: <svg className="w-[18px] h-[18px] mr-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg> },
        { id: 'financing', name: '파이낸싱-LFC', icon: <svg className="w-[18px] h-[18px] mr-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> },
        { id: 'development', name: '개발솔루션-DSC', icon: <svg className="w-[18px] h-[18px] mr-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><circle cx="12" cy="12" r="3" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" /></svg> },
        { id: 'marketing', name: '기업마케팅-EMC', icon: <svg className="w-[18px] h-[18px] mr-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" /></svg> },
        { id: 'digital', name: '상품·디지털-SSC', icon: <svg className="w-[18px] h-[18px] mr-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg> },
        { id: 'fund', name: '펀드운용-KAM', icon: <svg className="w-[18px] h-[18px] mr-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg> },
        { id: 'ipr', name: 'IPR-WG', icon: <svg className="w-[18px] h-[18px] mr-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg> }
    ];

    useEffect(() => {
        const fetchSnapshots = async () => {
            setIsLoading(true);
            try {
                const tableMap = {
                    pm: 'iota_pm_tasks',
                    digital: 'iota_digital_tasks',
                    marketing: 'iota_marketing_tasks',
                    fund: 'iota_fund_tasks',
                    development: 'iota_development_tasks',
                    financing: 'iota_financing_tasks',
                    ipr: 'iota_ipr_tasks'
                };
                const tableName = tableMap[workspaceFilter];

                // 병렬 통신(Promise.all)을 통한 로딩 속도 최적화
                const [snapshotRes, liveRes] = await Promise.all([
                    supabase.from('iota_weekly_snapshots').select('*').eq('workspace', workspaceFilter).order('created_at', { ascending: false }),
                    tableName ? supabase.from(tableName).select('*').order('created_at', { ascending: false }) : Promise.resolve({ data: null, error: null })
                ]);
                
                if (snapshotRes.error) throw snapshotRes.error;
                let fetchedData = snapshotRes.data || [];
                
                // Fallback: If no snapshot exists, use the pre-fetched live data
                if (fetchedData.length === 0 && liveRes.data && liveRes.data.length > 0) {
                    fetchedData.push({
                        id: workspaceFilter + '-live-fallback',
                        workspace: workspaceFilter,
                        week_label: '26년 5월 3주',
                        created_at: new Date().toISOString(),
                        snapshot_data: liveRes.data
                    });
                }
                
                // Add dummy 5월 2주 snapshot if we have a current one
                if (fetchedData.length > 0) {
                    const hasWeek2 = fetchedData.some(s => s.week_label === '26년 5월 2주');
                    if (!hasWeek2) {
                        const dummy = {
                            ...fetchedData[0],
                            id: fetchedData[0].id + '-dummy',
                            week_label: '26년 5월 2주',
                            created_at: new Date(new Date(fetchedData[0].created_at).getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
                        };
                        fetchedData.push(dummy);
                    }
                }
                
                // Sort to ensure 5월 2주 comes after 5월 3주
                fetchedData.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

                setSnapshots(fetchedData);
                if (fetchedData.length > 0) {
                    setSelectedSnapshotId(fetchedData[0].id);
                } else {
                    setSelectedSnapshotId(null);
                }
            } catch (e) {
                console.error(e);
                const localData = JSON.parse(localStorage.getItem('iota_weekly_snapshots') || '[]');
                let filteredSnaps = localData.filter(s => s.workspace === workspaceFilter);
                
                // Fallback: If no snapshot exists at all, fetch from the live workspace table
                if (filteredSnaps.length === 0) {
                    const tableMap = {
                        pm: 'iota_pm_tasks',
                        digital: 'iota_digital_tasks',
                        marketing: 'iota_marketing_tasks',
                        fund: 'iota_fund_tasks',
                        development: 'iota_development_tasks',
                        financing: 'iota_financing_tasks',
                        ipr: 'iota_ipr_tasks'
                    };
                    const tableName = tableMap[workspaceFilter];
                    let liveTasks = [];
                    
                    try {
                        const { data } = await supabase.from(tableName).select('*').order('created_at', { ascending: false });
                        if (data && data.length > 0) liveTasks = data;
                    } catch(err) {
                        const localTasks = JSON.parse(localStorage.getItem(tableName) || '[]');
                        if (localTasks && localTasks.length > 0) liveTasks = localTasks;
                    }

                    if (liveTasks.length > 0) {
                        filteredSnaps.push({
                            id: workspaceFilter + '-live-fallback',
                            workspace: workspaceFilter,
                            week_label: '26년 5월 3주',
                            created_at: new Date().toISOString(),
                            snapshot_data: liveTasks
                        });
                    }
                }
                
                if (filteredSnaps.length > 0) {
                    const hasWeek2 = filteredSnaps.some(s => s.week_label === '26년 5월 2주');
                    if (!hasWeek2) {
                        const dummy = {
                            ...filteredSnaps[0],
                            id: filteredSnaps[0].id + '-dummy',
                            week_label: '26년 5월 2주',
                            created_at: new Date(new Date(filteredSnaps[0].created_at).getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
                        };
                        filteredSnaps.push(dummy);
                    }
                }
                
                filteredSnaps.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
                
                setSnapshots(filteredSnaps);
                if (filteredSnaps.length > 0) setSelectedSnapshotIds(filteredSnaps.map(s => s.id));
                else setSelectedSnapshotIds([]);
            } finally {
                setIsLoading(false);
            }
        };
        fetchSnapshots();
    }, [workspaceFilter]);

    

    // Grouping by year and month based on week_label (e.g. "26년 5월 2주")
    const grouped = snapshots.reduce((acc, snap) => {
        const match = snap.week_label.match(/(\d+)년\s+(\d+)월/);
        if (match) {
            const groupKey = `20${match[1]}년 ${match[2]}월`;
            if (!acc[groupKey]) acc[groupKey] = [];
            acc[groupKey].push(snap);
        } else {
            const groupKey = '기타';
            if (!acc[groupKey]) acc[groupKey] = [];
            acc[groupKey].push(snap);
        }
        return acc;
    }, {});

    
    const renderTasks = () => {
        if (selectedSnapshotIds.length === 0) return null;
        
        const selectedSnaps = snapshots.filter(s => selectedSnapshotIds.includes(s.id)).sort((a,b) => new Date(b.created_at) - new Date(a.created_at));

        return selectedSnaps.map(snap => {
            let tasks = snap.snapshot_data || [];
            if (searchQuery) {
                const lowerQ = searchQuery.toLowerCase();
                tasks = tasks.filter(t => 
                    (t.task_name && t.task_name.toLowerCase().includes(lowerQ)) ||
                    (t.company_name && t.company_name.toLowerCase().includes(lowerQ)) ||
                    (t.notes && t.notes.toLowerCase().includes(lowerQ)) ||
                    (t.next_action && t.next_action.toLowerCase().includes(lowerQ))
                );
            }

            if (tasks.length === 0) return null;

            return (
                <div key={snap.id} className="mb-16">
                    <div className="flex justify-between items-end mb-5">
                        <div>
                            
                            <h2 className="text-[32px] font-bold text-white tracking-tight flex items-center gap-3">
                                <span className="text-[#b3b0a6]">{snap.week_label} {snap.week_label === '26년 5월 3주' ? '(26.5.11~5.17)' : snap.week_label === '26년 5월 2주' ? '(26.5.4~5.10)' : ''}</span>
                                <span className="text-[#A1A1AA] text-[24px]">|</span>
                                <span>{workspaces.find(w => w.id === workspaceFilter)?.name}</span>
                            </h2>
                            <div className="text-[#86868B] text-[13px] mt-1">
                                저장 일시: {new Date(snap.created_at).toLocaleString('ko-KR')}
                            </div>
                        </div>
                    </div>
                    {tasks.map(row => (
                        <div key={row.id} className="w-full relative rounded-[24px] px-6 pt-[22px] pb-[14px] bg-[#272726] border border-[#3c3c3c] mb-4">
                            <div className="flex justify-between items-start gap-8">
                                <div className="flex-1 flex gap-8">
                                    <div className="w-[60%] shrink-0 flex flex-col gap-[2px] border-r border-[#444]/50 pr-8">
                                        <div className="flex items-center gap-2">
                                            {row.related_asset && (
                                                <span className="px-[6px] py-[2px] bg-[#333] text-[#A1A1AA] border border-[#444] rounded-[4px] text-[11px] font-bold whitespace-nowrap">
                                                    {row.related_asset}
                                                </span>
                                            )}
                                        </div>
                                        <h3 className="text-[20px] font-bold text-white mt-1 mb-2 tracking-tight leading-tight whitespace-normal">{row.task_name}</h3>
                                        <div className="flex items-center gap-4 text-[13px] font-medium mt-1">
                                            <div className="flex items-center gap-2">
                                                <span className="text-[#86868B]">이해관계자</span>
                                                <span className="text-[#E5E5E5] px-2 py-1 bg-[#222] rounded-[6px] border border-[#333]">{row.company_name}</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-[#86868B]">상태</span>
                                                <span className="text-[#E5E5E5] px-2 py-1 bg-[#222] rounded-[6px] border border-[#333]">{row.status}</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-[#86868B]">목표일</span>
                                                <span className="text-[#E5E5E5] px-2 py-1 bg-[#222] rounded-[6px] border border-[#333]">{row.due_date || '-'}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="w-[40%] pl-4">
                                        <span className="block text-[13px] font-bold text-[#86868B] mb-[6px]">Next Action</span>
                                        <p className="text-[16px] text-[#E5E5E5] leading-relaxed break-keep whitespace-pre-wrap">{row.next_action || '-'}</p>
                                    </div>
                                </div>
                            </div>
                            {row.notes && (
                                <div className="mt-4 pt-4 border-t border-[#3c3c3c]">
                                    <span className="block text-[13px] font-bold text-gray-500 mb-[6px]">상세 메모</span>
                                    <p className="text-[14px] text-[#A1A1AA] leading-relaxed break-keep whitespace-pre-wrap">{row.notes}</p>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            );
        });
    };

    return (
        <div className="flex h-screen w-full bg-[#1A1A1A] font-sans text-white overflow-hidden">
            {/* Left Sidebar */}
            <div className="w-[280px] bg-[#222] border-r border-[#333] flex flex-col h-full shrink-0 print:hidden">
                <div className="p-6 border-b border-[#333]">
                    <h1 className="text-[20px] font-bold tracking-tight text-white mb-4">지난 테스크 타임라인</h1>
                    <div className="flex flex-col gap-[4px]">
                        {workspaces.map(ws => (
                            <button
                                key={ws.id}
                                onClick={() => setWorkspaceFilter(ws.id)}
                                className={`flex items-center text-left px-[14px] py-[10px] rounded-[10px] text-[15px] transition-colors ${workspaceFilter === ws.id ? 'bg-[#3c3c3c] text-white font-bold' : 'text-[#E5E5E5] hover:bg-[#333] font-medium'}`}
                            >
                                {ws.icon}
                                {ws.name}
                            </button>
                        ))}
                    </div>
                </div>
                
                <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6 custom-scrollbar">
                    {isLoading ? (
                        <div className="text-[#86868B] text-[13px]">불러오는 중...</div>
                    ) : snapshots.length === 0 ? (
                        <div className="text-[#86868B] text-[13px]">저장된 스냅샷이 없습니다.</div>
                    ) : (
                        Object.keys(grouped).sort((a,b) => b.localeCompare(a)).map(groupKey => {
                            const groupIds = grouped[groupKey].map(s => s.id);
                            const allSelected = groupIds.length > 0 && groupIds.every(id => selectedSnapshotIds.includes(id));
                            return (
                            <div key={groupKey}>
                                <div className="flex justify-between items-center mb-3">
                                    <h3 className="text-[#86868B] text-[12px] font-bold uppercase">{groupKey}</h3>
                                    <button 
                                        onClick={() => {
                                            if (allSelected) {
                                                const currentWeekSnap = grouped[groupKey].find(s => s.week_label === '26년 5월 3주') || grouped[groupKey][0];
                                                if (currentWeekSnap) {
                                                    setSelectedSnapshotIds(prev => {
                                                        const filtered = prev.filter(id => !groupIds.includes(id));
                                                        return [...filtered, currentWeekSnap.id];
                                                    });
                                                }
                                            } else {
                                                setSelectedSnapshotIds(prev => [...new Set([...prev, ...groupIds])]);
                                            }
                                        }} 
                                        className="text-[#86868B] text-[11px] font-bold hover:text-[#E5E5E5] bg-[#333] hover:bg-[#444] py-1 rounded-[4px] transition-colors w-[76px] text-center"
                                    >
                                        {allSelected ? '전체선택 해제' : '전체선택'}
                                    </button>
                                </div>
                                <div className="flex flex-col gap-1">
                                    {grouped[groupKey].map(snap => (
                                        <button 
                                            key={snap.id}
                                            onClick={() => setSelectedSnapshotIds(prev => prev.includes(snap.id) ? prev.filter(id => id !== snap.id) : [...prev, snap.id])}
                                            className={`w-full text-left px-4 py-[8px] rounded-[8px] transition-all flex justify-between items-center ${selectedSnapshotIds.includes(snap.id) ? 'bg-[#3b82f6]/20 text-[#60a5fa] border border-[#3b82f6]/30 font-bold' : 'text-[#E5E5E5] hover:bg-[#333] border border-transparent'}`}
                                        >
                                            <span className="text-[13px]">{snap.week_label} {snap.week_label === '26년 5월 3주' ? '(26.5.11~5.17)' : snap.week_label === '26년 5월 2주' ? '(26.5.4~5.10)' : ''}</span>
                                            {selectedSnapshotIds.includes(snap.id) && <span className="text-[16px] text-[#60a5fa]">✓</span>}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )
                        })
                    )}
                </div>
            </div>

            {/* Main Viewer Area */}
            <div className="flex-1 flex flex-col h-full overflow-hidden relative bg-[#111] print:w-full print:block">
                <div className="absolute inset-0 bg-gradient-to-b from-[#1a1a1a] to-transparent h-[200px] pointer-events-none z-0 print:hidden"></div>
                
                {selectedSnapshotIds.length > 0 ? (
                    <>
                        <div className="relative z-10 px-12 py-6 border-b border-[#333] bg-[#1a1a1a]/80 backdrop-blur-md">
                            <div className="max-w-[1200px] print:mx-auto">
                                <div className="w-full flex gap-3 print:hidden">
                                    <div className="relative flex-1">
                                        <input 
                                            type="text" 
                                            value={searchQuery}
                                            onChange={e => setSearchQuery(e.target.value)}
                                            placeholder="테스크 내용 검색..." 
                                            className="w-full bg-[#222] border border-[#333] text-white text-[14px] px-4 py-2.5 pl-10 rounded-[12px] outline-none focus:border-[#555] transition-colors"
                                        />
                                        <svg className="w-4 h-4 absolute left-3.5 top-3 text-[#86868B]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                                    </div>
                                    <button 
                                        onClick={() => window.print()}
                                        className="shrink-0 px-5 py-2.5 bg-[#1a1a1a] hover:bg-[#333] border border-[#444] text-[#A1A1AA] hover:text-white text-[13px] font-bold rounded-[12px] transition-colors flex items-center gap-2 shadow-sm"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                                        PDF 저장
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto px-12 py-8 relative z-10 custom-scrollbar">
                            <div className="max-w-[1200px] print:mx-auto">
                                {renderTasks()}
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex items-center justify-center relative z-10">
                        <div className="text-[#86868B] text-[15px] font-medium">좌측에서 열람할 주차를 선택해주세요.</div>
                    </div>
                )}
            </div>
            <style>{`
                @media print {
                    html, body, #root { 
                        display: block !important;
                        height: auto !important;
                        overflow: visible !important;
                        -webkit-print-color-adjust: exact; 
                        print-color-adjust: exact; 
                        background: #ffffff !important; 
                        color: #111827 !important;
                        zoom: 0.76;
                    }
                    /* Remove flex from main wrappers to prevent blank first page */
                    .flex.h-screen { display: block !important; height: auto !important; overflow: visible !important; }
                    .flex-1.flex.flex-col { display: block !important; height: auto !important; overflow: visible !important; }
                    
                    .h-screen { height: auto !important; }
                    .overflow-hidden, .overflow-y-auto, .custom-scrollbar { overflow: visible !important; }
                    .mb-4, .mb-16 { page-break-inside: avoid; margin-bottom: 24px !important; }
                    .bg-\[\#1a1a1a\]\/80, .bg-\[\#111\] { background: transparent !important; }
                    .border-b { border-bottom: 1px solid #e5e7eb !important; }
                    /* Text colors */
                    .text-white { color: #111827 !important; }
                    .text-\[\#86868B\] { color: #4b5563 !important; }
                    .text-\[\#A1A1AA\] { color: #374151 !important; }
                    .text-\[\#b3b0a6\] { color: #111827 !important; }
                    .text-\[\#E5E5E5\] { color: #111827 !important; }
                    /* Box backgrounds and borders */
                    .bg-\[\#272726\] { background: #ffffff !important; border-color: #d1d5db !important; }
                    .bg-\[\#222\] { background: #f3f4f6 !important; border-color: #e5e7eb !important; }
                    .bg-\[\#333\] { background: #e5e7eb !important; border-color: #d1d5db !important; }
                    .border-\[\#3c3c3c\] { border-color: #d1d5db !important; }
                    .border-\[\#333\] { border-color: #e5e7eb !important; }
                    .border-\[\#444\]\/50 { border-color: #d1d5db !important; }
                    /* Layout fixes */
                    .w-\[60\%\] { border-right: 1px solid #e5e7eb !important; padding-right: 24px !important; }
                    .gap-8 { gap: 24px !important; }
                    .px-12 { padding-left: 0 !important; padding-right: 0 !important; }
                    .py-8 { padding-top: 16px !important; padding-bottom: 16px !important; }
                }
                .custom-scrollbar::-webkit-scrollbar {
                    width: 8px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: #333;
                    border-radius: 10px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: #555;
                }
            `}</style>
        </div>
    );
}
