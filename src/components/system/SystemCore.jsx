import React from 'react';
import SystemLeftNav from './SystemLeftNav';
import SystemCenter from './SystemCenter';
import SystemRightRAG from './SystemRightRAG';
import { useTheme } from '../../context/ThemeContext';
import { useEffect } from 'react';
export default function SystemCore() {
    const { isLightMode, toggleTheme } = useTheme();
    useEffect(() => {
        if (isLightMode) toggleTheme();
    }, [isLightMode, toggleTheme]);

    return (
        <div className="w-full h-screen bg-[#1F1F1E] flex overflow-hidden font-sans text-[#E5E5E5] relative border-none">
            
            {/* 좌측 사이드바 고정 유지 */}
            <SystemLeftNav isCore={true} />

            {/* Stage 2 Layout (상세페이지 고정) */}
            <div className="flex-1 flex overflow-hidden">
                {/* 컨텐츠 박스 (SystemCenter) */}
                <div className="w-[calc(100%-520px)] h-full overflow-hidden shrink-0 flex flex-col items-stretch opacity-100">
                    <div className="w-full h-full flex flex-col items-stretch min-w-[600px] opacity-100">
                        <SystemCenter />
                    </div>
                </div>

                {/* 채팅/RAG 박스 */}
                <div className="w-[520px] h-full flex flex-col shrink-0 border-l border-[#2C2C2E]">
                    <SystemRightRAG />
                </div>
            </div>
            
        </div>
    );
}
