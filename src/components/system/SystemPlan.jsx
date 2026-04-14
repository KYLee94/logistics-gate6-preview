import React, { useState, useEffect } from 'react';
import SystemLeftNav from './SystemLeftNav';
import SystemCenter from './SystemCenter';
import SystemRightRAG from './SystemRightRAG';
import SystemBridge from './SystemBridge';
import SystemCollapsedNav from './SystemCollapsedNav';
import SystemFullChat from './SystemFullChat';

// Stage 2 모달 삭제. Flex Layout 이동으로 처리합니다.

export default function SystemPlan({ externalStage, onNext }) {
    const stage = externalStage;

    return (
        <div className="w-full h-screen bg-white dark:bg-[#1F1F1E] flex overflow-hidden font-sans text-[#1D1D1F] dark:text-[#E5E5E5] relative border-none transition-colors duration-300">
            
            {/* 좌측 사이드바 고정 유지 */}
            <SystemLeftNav />

            {/* Stage 0 */}
            {stage === 0 && <SystemBridge onTypingComplete={onNext} />}

            {/* Stage 1 & 2 Layout Shift */}
            {stage > 0 && (
                <div className="flex-1 flex overflow-hidden">
                    {/* 컨텐츠 박스 (SystemCenter) : stage 2가 되면 width가 생기며 좌측에서 슬라이드 등장 */}
                    <div className={`transition-all duration-[1200ms] ease-[cubic-bezier(0.16,1,0.3,1)] overflow-hidden shrink-0 flex flex-col items-stretch ${stage === 2 ? 'w-[calc(100%-520px)] opacity-100' : 'w-0 opacity-0'}`}>
                        <div className={`w-full flex-1 flex flex-col items-stretch min-w-[600px] transition-opacity duration-1000 ${stage === 2 ? 'delay-300 opacity-100' : 'opacity-0'}`}>
                            {stage === 2 && <SystemCenter />}
                        </div>
                    </div>

                    {/* 채팅/RAG 박스 : stage 2가 되면 우측 520px로 압축 */}
                    <div className={`transition-all duration-[1200ms] ease-[cubic-bezier(0.16,1,0.3,1)] h-full flex flex-col shrink-0 ${stage === 2 ? 'w-[520px] border-l border-gray-200 dark:border-[#2C2C2E]' : 'w-full border-transparent'}`}>
                        {stage === 2 ? <SystemRightRAG /> : <SystemFullChat onShowContent={onNext} />}
                    </div>
                </div>
            )}
            
        </div>
    );
}
