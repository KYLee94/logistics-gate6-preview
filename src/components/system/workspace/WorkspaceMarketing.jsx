import React, { useState } from 'react';

export default function WorkspaceMarketing() {
    const [projectShowAll, setProjectShowAll] = useState(false);
    const [pipelineShowAll, setPipelineShowAll] = useState(false);

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
            
            {/* 1. 주간 플래닝 칸반 */}
            <h2 className="text-[18px] font-bold text-white mb-[16px]">주간 플래닝 보드 (Weekly Sprints)</h2>
            <div className="grid grid-cols-2 gap-[24px] mb-[40px]">
                {/* 이번 주 */}
                <div className="bg-[#1A1A1A] border border-[#333] rounded-[24px] p-[24px] flex flex-col relative overflow-hidden group">
                    <div className="absolute top-0 left-0 w-full h-[4px] bg-[#e11d48]"></div>
                    <div className="flex justify-between items-center mb-[20px] pb-3 border-b border-[#333]">
                        <span className="text-[16px] font-bold text-white">당주 추진 액션</span>
                        <span className="px-3 py-1 bg-[#e11d48]/20 text-[#e11d48] rounded-[8px] text-[13px] font-bold">{thisWeekTasks.length} Tasks</span>
                    </div>
                    <div className="flex flex-col gap-3">
                        {thisWeekTasks.map((task, idx) => (
                            <div key={idx} className="bg-[#292928] border border-[#3c3c3c] p-4 rounded-[16px] hover:border-[#555] cursor-pointer transition-colors">
                                <span className="text-[13px] text-[#86868B] font-medium block mb-2">{task.channelName}</span>
                                <span className="text-[15px] text-white font-medium leading-relaxed">{parseNames(task.progressDetail)}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* 다음 주 */}
                <div className="bg-[#1A1A1A] border border-[#333] rounded-[24px] p-[24px] flex flex-col relative overflow-hidden group">
                    <div className="absolute top-0 left-0 w-full h-[4px] bg-[#fbf167]"></div>
                    <div className="flex justify-between items-center mb-[20px] pb-3 border-b border-[#333]">
                        <span className="text-[16px] font-bold text-white">차주 예정 사항</span>
                        <span className="px-3 py-1 bg-[#d97706]/20 text-[#fbf167] rounded-[8px] text-[13px] font-bold">{nextWeekTasks.length} Tasks</span>
                    </div>
                    <div className="flex flex-col gap-3">
                        {nextWeekTasks.map((task, idx) => (
                            <div key={idx} className="bg-[#222] border border-[#333] p-4 rounded-[16px]">
                                <span className="text-[13px] text-[#666] font-medium block mb-2">{task.channelName}</span>
                                <span className="text-[15px] text-[#A1A1AA] font-medium leading-relaxed">{parseNames(task.progressDetail)}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* 2. Task 관리 */}
            <div className="flex justify-between items-end mb-[24px]">
                <h2 className="text-[18px] font-bold text-white">Task 관리</h2>
                <span className="text-[13px] text-[#86868B]">큰 업무 단위 (마감일 및 다음 액션 관리)</span>
            </div>
            <div className="w-full bg-[#1A1A1A] border border-[#333] rounded-[24px] overflow-hidden mb-[40px]">
                <table className="w-full text-left">
                    <thead className="bg-[#222]">
                        <tr>
                            <th className="px-[20px] py-[16px] text-[13px] font-bold text-[#86868B] border-b border-[#333]">Task 명</th>
                            <th className="px-[20px] py-[16px] text-[13px] font-bold text-[#86868B] border-b border-[#333]">연결 기업</th>
                            <th className="px-[20px] py-[16px] text-[13px] font-bold text-[#86868B] border-b border-[#333]">관련 자산</th>
                            <th className="px-[20px] py-[16px] text-[13px] font-bold text-[#86868B] border-b border-[#333]">상태</th>
                            <th className="px-[20px] py-[16px] text-[13px] font-bold text-[#86868B] border-b border-[#333]">마감일</th>
                            <th className="px-[20px] py-[16px] text-[13px] font-bold text-[#86868B] border-b border-[#333]">다음 액션</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-[#333]">
                        {visibleProjects.map((row, idx) => (
                            <tr key={idx} className="hover:bg-[#292928] transition-colors">
                                <td className="px-[20px] py-[16px] text-[15px] font-bold text-white">{row.name}</td>
                                <td className="px-[20px] py-[16px] text-[14px] text-[#A1A1AA]">{row.company}</td>
                                <td className="px-[20px] py-[16px] text-[14px] text-[#A1A1AA]">{row.asset}</td>
                                <td className="px-[20px] py-[16px]">
                                    <span className={`px-2 py-1 rounded text-[12px] font-bold border ${row.status === '제안 진행' ? 'bg-[#059669]/20 text-[#34d399] border-[#059669]/30' : row.status === '자료 준비' ? 'bg-[#d97706]/20 text-[#fbf167] border-[#d97706]/30' : 'bg-[#4b5563]/20 text-[#9ca3af] border-[#4b5563]/30'}`}>
                                        {row.status}
                                    </span>
                                </td>
                                <td className="px-[20px] py-[16px] text-[14px] text-[#A1A1AA]">{row.dueDate}</td>
                                <td className="px-[20px] py-[16px] text-[14px] text-[#E5E5E5]">{parseNames(row.nextAction)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {projects.length > 5 && (
                    <div className="w-full border-t border-[#333] p-2 flex justify-center bg-[#222]">
                        <button 
                            onClick={() => setProjectShowAll(!projectShowAll)}
                            className="text-[13px] font-bold text-[#A1A1AA] hover:text-white transition-colors px-4 py-2"
                        >
                            {projectShowAll ? '접기' : `더보기 (${projects.length - 5}개)`}
                        </button>
                    </div>
                )}
            </div>

            {/* 3. Pipeline 관리 */}
            <div className="flex justify-between items-end mb-[24px]">
                <h2 className="text-[18px] font-bold text-white">Pipe line 관리</h2>
                <span className="text-[13px] text-[#86868B]">수기 입력 중심 운영 (컨택 포인트 포함)</span>
            </div>
            <div className="w-full bg-[#1A1A1A] border border-[#333] rounded-[24px] overflow-hidden mb-[40px]">
                <table className="w-full text-left">
                    <thead className="bg-[#222]">
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
                    <div className="w-full border-t border-[#333] p-2 flex justify-center bg-[#222]">
                        <button 
                            onClick={() => setPipelineShowAll(!pipelineShowAll)}
                            className="text-[13px] font-bold text-[#A1A1AA] hover:text-white transition-colors px-4 py-2"
                        >
                            {pipelineShowAll ? '접기' : `더보기 (${pipelines.length - 5}개)`}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
