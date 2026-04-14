import React, { useState, useEffect, useRef } from 'react';
import VirtualMouse from './VirtualMouse';

export default function SystemBridge({ onTypingComplete }) {
    const arrowRef = useRef(null);
    const [typedText, setTypedText] = useState('');
    const fullText = "올해 이지스 리얼에셋 부문에서 가장 큰 실물 사업이 뭐야? 연면적 기준으로.";
    const [step, setStep] = useState(0); 
    // step 0: init
    // step 1: typing
    // step 2: typed, waiting
    // step 3: ghost mouse moving

    const [mounted, setMounted] = useState(false);
    useEffect(() => { setMounted(true); }, []);

    // Ghost Mouse State
    const [mouseVisible, setMouseVisible] = useState(false);
    const [mousePos, setMousePos] = useState({ top: '80%', left: '120%', transform: 'scale(1)' });
    const [buttonActive, setButtonActive] = useState(false);

    const handleScreenClick = () => {
        if (step === 0 && typedText.length === 0) {
            setStep(1);
        } else if (step === 2) {
            setStep(3);
        }
    };

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'ArrowRight' || e.key === 'Enter') {
                handleScreenClick();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [step, typedText]);

    useEffect(() => {
        if (step === 1) {
            let i = 0;
            const interval = setInterval(() => {
                setTypedText(fullText.slice(0, i + 1));
                i++;
                if (i >= fullText.length) {
                    setStep(2);
                }
            }, 30); // Fast, realistic typing speed
            return () => clearInterval(interval);
        }
    }, [step, fullText]);

    useEffect(() => {
        if (step === 3) {
            if (arrowRef.current) {
                const rect = arrowRef.current.getBoundingClientRect();
                setMouseVisible(true);
                setMousePos({ 
                    top: `${rect.top + rect.height / 2 - 3}px`, 
                    left: `${rect.left + rect.width / 2 - 6}px`, 
                    transform: 'scale(1)' 
                });
            }

            // Click action
            setTimeout(() => {
                setButtonActive(true);
                setMousePos(prev => ({ ...prev, transform: 'scale(0.85)' }));
            }, 1500); // travel time 1.5s

            // Release
            setTimeout(() => {
                setButtonActive(false);
                setMousePos(prev => ({ ...prev, transform: 'scale(1)' }));
            }, 1700); // 200ms hold

            // Navigate (400ms wait after release)
            setTimeout(() => {
                onTypingComplete();
            }, 2100);
        }
    }, [step, onTypingComplete]);

    return (
        <div className={`flex-1 flex flex-col items-center justify-center bg-white dark:bg-[#1F1F1E] h-full cursor-default relative overflow-hidden transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`} onClick={handleScreenClick}>
            
            <VirtualMouse isVisible={mouseVisible} style={mousePos} />

            {/* Wrapper element to shift content up by 150px */}
            <div className="flex flex-col items-center -mt-[150px]">
                {/* 문장 양 옆 쌍따옴표 추가, 하단 5px 여백 제거 (mb-[30px] -> mb-[25px]) */}
                <h2 className="text-[38px] text-[#1D1D1F] dark:text-[#A1A1AA] font-normal mb-[25px] tracking-tight font-sans transition-colors duration-300">"전기영님 또 오셨네요."</h2>

                {/* Same styling as SystemRightRAG comment box but larger width */}
                <div className="w-[700px] h-[140px] bg-white dark:bg-[#2C2C2A] rounded-[18px] flex flex-col relative px-5 pt-5 pb-4 border border-gray-200 dark:border-[#3A3A3A] cursor-text shadow-lg transition-colors duration-300">
                    <textarea 
                        placeholder="오늘은 어떤 도움이 필요하세요?" 
                        className="w-full bg-transparent text-[16px] text-[#111] dark:text-[#E5E5E5] focus:outline-none placeholder-gray-400 dark:placeholder-[#888888] font-normal resize-none h-[64px] transition-colors duration-300"
                        value={typedText}
                        readOnly
                    ></textarea>
                    
                    <div className="absolute bottom-4 left-5">
                        <button className="text-gray-400 dark:text-[#888888] hover:text-[#111] dark:hover:text-[#E5E5E5] p-1 flex items-center justify-center transition-colors">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 4v16m8-8H4" /></svg>
                        </button>
                    </div>

                    <div className="absolute bottom-4 right-5">
                        <button 
                            ref={arrowRef}
                            onClick={(e) => { 
                                e.stopPropagation(); 
                                if (step === 2) {
                                    setStep(3);
                                }
                            }}
                            className={`w-[34px] h-[34px] rounded-full flex items-center justify-center transition-colors shadow-sm outline-none cursor-pointer ${typedText.length > 0 ? 'bg-[#111] text-white dark:bg-[#E5E5E5] dark:text-black hover:bg-[#333] dark:hover:bg-white' : 'bg-gray-200 text-gray-500 dark:bg-[#5E5E5B] dark:text-white dark:hover:bg-[#72726D]'} ${buttonActive ? 'scale-90 bg-[#333] dark:bg-white' : ''}`}>
                            <svg className="w-4 h-4 ml-0.5" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M13 5l7 7-7 7" />
                            </svg>
                        </button>
                    </div>
                </div>
            </div>

        </div>
    );
}
