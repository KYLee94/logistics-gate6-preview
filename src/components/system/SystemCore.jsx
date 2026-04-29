import { useState, useEffect } from 'react';
import SystemLeftNav from './SystemLeftNav';
import IotaLeftNav from './IotaLeftNav';
import SystemCenter from './SystemCenter';
import IotaDashboard from './IotaDashboard';
import SystemRightRAG from './SystemRightRAG';
import { useTheme } from '../../context/ThemeContext';

export default function SystemCore({ isPlatform = false, isIotaWorkspaceOverride = false }) {
    const { isLightMode, toggleTheme } = useTheme();
    const [isIotaWorkspace, setIsIotaWorkspace] = useState(isIotaWorkspaceOverride);
    const [iotaMenuId, setIotaMenuId] = useState(1);

    useEffect(() => {
        if (isLightMode) toggleTheme();

        const handleLocationChange = () => {
            if (isIotaWorkspaceOverride) {
                setIsIotaWorkspace(true);
                return;
            }
            const params = new URLSearchParams(window.location.search);
            const pathname = window.location.pathname;
            const isIota = params.get('workspace') === 'iota' || pathname.includes('iotaseoul');
            setIsIotaWorkspace(isIota);
        };

        handleLocationChange();
        window.addEventListener('popstate', handleLocationChange);
        return () => window.removeEventListener('popstate', handleLocationChange);
    }, [isLightMode, toggleTheme]);

    return (
        <div className="w-full h-screen bg-[#1F1F1E] flex overflow-hidden font-sans text-[#E5E5E5] relative border-none">
            
            {/* 좌측 사이드바 스위칭 로직 */}
            {isIotaWorkspace
                ? <IotaLeftNav onMenuChange={setIotaMenuId} />
                : <SystemLeftNav isCore={true} isPlatform={isPlatform} />}

            {/* Stage 2 Layout (상세페이지 고정) */}
            <div className="flex-1 flex overflow-hidden">
                {/* 컨텐츠 박스 */}
                <div className="w-[calc(100%-510px)] h-full overflow-hidden shrink-0 flex flex-col items-stretch">
                    <div className="w-full h-full flex flex-col items-stretch min-w-[600px]">
                        {isIotaWorkspace
                            ? (iotaMenuId === 1 ? <IotaDashboard /> : <SystemCenter />)
                            : <SystemCenter />}
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
