import React, { useState, useEffect } from 'react';
import SystemLeftNav from './SystemLeftNav';
import IotaLeftNav from './IotaLeftNav';
import SystemCenter from './SystemCenter';
import SystemRightRAG from './SystemRightRAG';
import { useTheme } from '../../context/ThemeContext';

export default function SystemCore({ isPlatform = false }) {
    const { isLightMode, toggleTheme } = useTheme();
    const [isIotaWorkspace, setIsIotaWorkspace] = useState(false);

    useEffect(() => {
        if (isLightMode) toggleTheme();

        const handleLocationChange = () => {
            const params = new URLSearchParams(window.location.search);
            setIsIotaWorkspace(params.get('workspace') === 'iota');
        };

        handleLocationChange();
        window.addEventListener('popstate', handleLocationChange);
        return () => window.removeEventListener('popstate', handleLocationChange);
    }, [isLightMode, toggleTheme]);

    return (
        <div className="w-full h-screen bg-[#1F1F1E] flex overflow-hidden font-sans text-[#E5E5E5] relative border-none">
            
            {/* 좌측 사이드바 스위칭 로직 */}
            {isIotaWorkspace ? <IotaLeftNav isCore={true} isPlatform={isPlatform} /> : <SystemLeftNav isCore={true} isPlatform={isPlatform} />}

            {/* Stage 2 Layout (상세페이지 고정) */}
            <div className="flex-1 flex overflow-hidden">
                {/* 컨텐츠 박스 (SystemCenter) */}
                <div className="w-[calc(100%-510px)] h-full overflow-hidden shrink-0 flex flex-col items-stretch opacity-100">
                    <div className="w-full h-full flex flex-col items-stretch min-w-[600px] opacity-100">
                        <SystemCenter />
                    </div>
                </div>

                {/* 채팅/RAG 박스 */}
                <div className="w-[510px] h-full flex flex-col shrink-0 border-l border-[#2C2C2E]">
                    <SystemRightRAG />
                </div>
            </div>
            
        </div>
    );
}
