import React, { useEffect, useState, useRef, useCallback } from 'react';
import VirtualMouse from './VirtualMouse';

const linesData = [
    { type: 'p', text: "현재 시스템에 등록된 올해 이지스 리얼에셋 부문(투자 파트) 파이프라인을 분석한 결과입니다.", mb: 'mb-6' },
    { type: 'p', text: "현재 검토 중인 실물 사업 중 가장 규모가 큰 프로젝트는 '더케이트윈타워' (신규 오피스 매입 건)입니다.\n요청하신 연면적과 사업비(AUM), 그리고 현재 진행 중인 핵심 전략 현황은 다음과 같습니다.", keyword: "'더케이트윈타워'", mb: 'mb-6' },
    { type: 'ul_container_start', text: "" },
    { type: 'ul', text: "🏢 연면적 기준: 약 25,000평 (현재 검토 풀 내 최대 규모)" },
    { type: 'ul', text: "💰 사업비(AUM) 기준: 약 9,500억 원 (예상 매입 보수 약 40억 원)" },
    { type: 'ul_container_end', text: "" },
    { type: 'title', text: "[핵심 전략 및 진행 현황 (Context Graph)]" },
    { type: 'p', text: "담당 부서 및 인력: 남태훈 PM 총괄 하에, 정영진, 장민호 매니저가 실무를 전담하여 6월 중순 입찰(주관사: 메리츠증권, CBRE, CW)을 준비하고 있습니다.", mb: 'mb-6' },
    { type: 'title', text: "투자 전략 (Value-add):" },
    { type: 'p', text: "단순 매입이 아닌 대규모 리모델링 및 증축을 통한 밸류애드(Value-add) 전략을 취하고 있습니다.", mb: 'mb-6' },
    { type: 'title', text: "시나리오 검토: 현재 수익성 극대화를 위해" },
    { type: 'p', text: "① 더케이트윈타워 단독 개발안과 주변 부지를 연계하는\n② 일본대사관 부지 통합 개발안 두 가지 시나리오의 타당성을 동시에 비교 분석 중입니다.", mb: 'mb-6', pl: true },
    { type: 'gray', text: "자세한 데이터 및 다른 자산과의 비교가 필요하신가요? 아래 링크를 통해 원하시는 업무 화면으로 바로 이동하실 수 있습니다." }
];

export default function SystemFullChat({ onShowContent }) {
    const [mounted, setMounted] = useState(false);
    const [visibleChars, setVisibleChars] = useState(0);

    const [mouseVisible, setMouseVisible] = useState(false);
    const [mousePos, setMousePos] = useState({ top: '80%', left: '120%', transform: 'scale(1)' });
    const [buttonActive, setButtonActive] = useState(false);
    const [hasTriggeredClick, setHasTriggeredClick] = useState(false);
    const btnRef = useRef(null);
    const scrollContainerRef = useRef(null);

    const totalHtmlLength = linesData.reduce((acc, curr) => acc + curr.text.length, 0);

    useEffect(() => {
        setMounted(true);
        const interval = setInterval(() => {
            setVisibleChars(prev => {
                if (prev >= totalHtmlLength) {
                    clearInterval(interval);
                    return prev;
                }
                return prev + 4; // Speed slightly up
            });
        }, 15);
        
        return () => clearInterval(interval);
    }, [totalHtmlLength]);

    const isTypingComplete = visibleChars >= totalHtmlLength;

    useEffect(() => {
        if (!scrollContainerRef.current) return;
        
        // Windows OS Scaling 및 Layout 연산 지연을 우회하는 강력한 바닥초점(Auto-anchor) 전략
        const scrollToBottom = () => {
            if (scrollContainerRef.current) {
                // scrollTop을 강제로 99999등 비정상적으로 큰 값으로 밀어버리는 대신, 안전하게 scrollHeight를 2배로 강제 할당하여 윈도우 스크롤 버퍼 오차 극복
                scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight * 2;
            }
        };

        // 타이핑 시 즉각 반영 + 타이핑이 끝났을때 추가 등장하는 버튼들(트랜지션)의 위치까지 고려해 짧은 딜레이로 한번 더 꽂아줌
        scrollToBottom();
        requestAnimationFrame(scrollToBottom);
        if (isTypingComplete) {
            setTimeout(scrollToBottom, 100);
            setTimeout(scrollToBottom, 400);
        }
        
    }, [visibleChars, isTypingComplete]);

    const handleScreenClick = useCallback(() => {
        if (isTypingComplete && !hasTriggeredClick) {
            if (!btnRef.current) return;
            setHasTriggeredClick(true);
            
            const rect = btnRef.current.getBoundingClientRect();
            
            setMouseVisible(true);
            setMousePos({ 
                top: `${rect.top + rect.height / 2 - 3}px`, 
                left: `${rect.left + rect.width / 2 - 6}px`, 
                transform: 'scale(1)' 
            });

            setTimeout(() => {
                setButtonActive(true);
                setMousePos(prev => ({ ...prev, transform: 'scale(0.85)' }));
            }, 1500);

            setTimeout(() => {
                setButtonActive(false);
                setMousePos(prev => ({ ...prev, transform: 'scale(1)' }));
            }, 1700);

            setTimeout(() => {
                onShowContent();
            }, 2100);
        }
    }, [hasTriggeredClick, isTypingComplete, onShowContent]);

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'ArrowRight' || e.key === 'Enter') {
                handleScreenClick();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleScreenClick]);

    let remainingChars = visibleChars;
    const renderContent = [];
    let ulChildren = [];

    const flushUl = () => {
        if (ulChildren.length > 0) {
            renderContent.push(<div key={`ul_${renderContent.length}`} className="mb-6 space-y-2 bg-transparent p-0 rounded-2xl border-none shadow-none">{ulChildren}</div>);
            ulChildren = [];
        }
    };

    for (let i = 0; i < linesData.length; i++) {
        const item = linesData[i];
        
        if (item.type === 'ul_container_start') continue;
        if (item.type === 'ul_container_end') {
            flushUl();
            continue;
        }

        if (remainingChars <= 0) break;
        
        const textToRender = item.text.slice(0, remainingChars);
        remainingChars -= item.text.length;

        let node = null;
        if (item.type === 'ul') {
            node = <p key={i}>{textToRender}</p>;
            ulChildren.push(node);
            node = null; // Don't push directly
        } else if (item.type === 'title') {
            node = <p key={i} className="mb-2 text-[#A1A1AA] font-semibold">{textToRender}</p>;
        } else if (item.type === 'gray') {
            node = <p key={i} className="mb-8 text-[#888888] whitespace-pre-wrap leading-relaxed">{textToRender}</p>;
        } else if (item.type === 'p') {
            const mb = item.mb || 'mb-6';
            const plClass = item.pl ? 'space-y-1 pl-0.5' : '';
            if (item.keyword) {
                 const idx = item.text.indexOf(item.keyword);
                 if (textToRender.length <= idx) {
                     node = <p key={i} className={`${mb} ${plClass} whitespace-pre-wrap`}>{textToRender}</p>;
                 } else {
                     const left = textToRender.slice(0, idx);
                     const keywordPart = textToRender.slice(idx, idx + item.keyword.length);
                     const right = textToRender.slice(idx + item.keyword.length);
                     node = (
                         <p key={i} className={`${mb} ${plClass} whitespace-pre-wrap`}>
                            {left}
                            {keywordPart.length > 0 && <strong className="font-semibold text-white">{keywordPart}</strong>}
                            {right}
                         </p>
                     );
                 }
            } else {
                 node = <p key={i} className={`${mb} ${plClass} whitespace-pre-wrap`}>{textToRender}</p>;
            }
        }

        if (node) {
            flushUl(); 
            renderContent.push(node);
        }
    }
    flushUl();


    return (
        <div className={`flex-1 flex flex-col h-full bg-[#1F1F1E] relative transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] overflow-hidden ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`} onClick={handleScreenClick}>
            <VirtualMouse isVisible={mouseVisible} style={mousePos} />

            {/* Scrollable Chat Area */}
            <div ref={scrollContainerRef} className="flex-1 overflow-y-auto w-full hide-scrollbar flex flex-col items-center pt-10 pb-[180px] scroll-smooth">
                <div className="w-full max-w-[850px] flex flex-col px-6">
                    
                    {/* User Message */}
                    <div className="flex justify-end mb-16 animate-fade-in-up">
                        <div className="bg-[#0A0A0A] border-none rounded-[16px] rounded-tr-[4px] px-6 py-5 max-w-[85%] text-[16px] leading-[1.6] text-[#E5E5E5] shadow-sm">
                            <span className="font-normal text-[#c3c2b7]">
                                올해 이지스 리얼에셋 부문에서 가장 큰 실물 사업이 뭐야?<br />
                                <div className="text-right mt-1 opacity-80">연면적 기준으로.</div>
                            </span>
                        </div>
                    </div>

                    {/* AI Message Frame */}
                    <div className="flex flex-col text-[16px] leading-[1.8] text-[#c3c2b7] font-normal break-keep tracking-tight w-full pr-12 min-h-[400px]">
                        
                        {renderContent}
                        
                        {/* Blinking Cursor (only when typing) */}
                        {!isTypingComplete && (
                            <span className="inline-block w-2.5 h-4 ml-1 bg-[#A1A1AA] animate-pulse relative top-0.5"></span>
                        )}

                        {/* Action Buttons (Fades in after typing is complete) */}
                        <div className={`flex gap-4 items-start pb-10 transition-all duration-700 transform ${isTypingComplete ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'}`}>
                            <button 
                                ref={btnRef}
                                onClick={(e) => { e.stopPropagation(); onShowContent(); }} 
                                className={`px-6 py-4 text-[#c3c2b7] border hover:bg-[#333] hover:text-white text-[14px] font-medium rounded-2xl transition-all whitespace-nowrap outline-none cursor-pointer shadow-sm ${buttonActive ? 'bg-[#333] scale-95 border-white/20' : 'bg-[#262626] border-[#3A3A3A]'}`}
                            >
                                더케이트윈타워 딜 상세 보기
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); alert("진행 중인 파이프라인 목록 데모"); }} className="px-6 py-4 bg-[#262626] text-[#c3c2b7] border border-[#3A3A3A] hover:bg-[#333] hover:text-white text-[14px] font-medium rounded-2xl whitespace-nowrap outline-none cursor-pointer shadow-sm">
                                진행 중인 신규 자산 파이프라인 모두 보기
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Bottom Input Area */}
            <div className="absolute bottom-0 w-full flex justify-center pb-8 bg-gradient-to-t from-[#1F1F1E] via-[#1F1F1E] to-transparent pt-12 pointer-events-none">
                <div className="w-full max-w-[850px] h-[120px] bg-[#2C2C2A] rounded-[24px] flex flex-col relative px-5 pt-5 pb-4 border border-[#3A3A3A] shadow-2xl pointer-events-auto">
                    <textarea 
                        placeholder="추가 입력사항..." 
                        className="w-full bg-transparent text-[16px] text-[#E5E5E5] focus:outline-none placeholder-[#737373] font-normal resize-none h-[50px] ml-1"
                        defaultValue=""
                    ></textarea>
                    
                    <div className="absolute bottom-4 left-5">
                        <button className="text-[#737373] hover:text-[#E5E5E5] p-1 flex items-center justify-center cursor-pointer">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 4v16m8-8H4" /></svg>
                        </button>
                    </div>

                    <div className="absolute bottom-4 right-5">
                        <button className="w-[36px] h-[36px] rounded-full bg-[#5E5E5B] hover:bg-[#72726D] flex items-center justify-center shadow-sm outline-none cursor-pointer">
                            <svg className="w-4 h-4 text-white ml-0.5" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M13 5l7 7-7 7" />
                            </svg>
                        </button>
                    </div>
                </div>
                {/* 하단 캡션 */}
                <div className="absolute bottom-2 text-[#737373] text-[11px] font-normal w-full text-center tracking-tight">
                    응답 결과 및 정량 수치는 해당 부서 담당 매니저와 꼭 확인해 주세요.
                </div>
            </div>
            
        </div>
    );
}
