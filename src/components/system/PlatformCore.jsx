import { useState, useEffect } from 'react';
import SystemLeftNav from './SystemLeftNav';
import IotaLeftNav from './IotaLeftNav';
import IotaDashboard from './IotaDashboard';
import PlatformCenter from './PlatformCenter';
import { useTheme } from '../../context/ThemeContext';

export default function PlatformCore({ isPlatform = true, isIotaWorkspaceOverride = false }) {
    const { isLightMode, toggleTheme } = useTheme();
    const [isIotaWorkspace, setIsIotaWorkspace] = useState(isIotaWorkspaceOverride);
    const [iotaMenuId, setIotaMenuId] = useState(1);

    useEffect(() => {
        if (isLightMode) toggleTheme();

        const handleLocationChange = () => {
            if (isIotaWorkspaceOverride) {
                setIsIotaWorkspace(true);
            } else {
                const params = new URLSearchParams(window.location.search);
                setIsIotaWorkspace(params.get('workspace') === 'iota');
            }
        };

        handleLocationChange();
        window.addEventListener('popstate', handleLocationChange);
        return () => window.removeEventListener('popstate', handleLocationChange);
    }, [isLightMode, toggleTheme, isIotaWorkspaceOverride]);

    return (
        <div className="w-full h-screen bg-[#1F1F1E] flex overflow-hidden font-sans text-[#E5E5E5] relative border-none">
            
            {/* 좌측 사이드바 스위칭 로직 */}
            {isIotaWorkspace
                ? <IotaLeftNav onMenuChange={setIotaMenuId} />
                : <SystemLeftNav isCore={true} isPlatform={isPlatform} />}

            <div className="flex-1 flex overflow-hidden">
                <div className="w-full h-full overflow-hidden shrink-0 flex flex-col items-stretch">
                    <div className="w-full h-full flex flex-col items-stretch min-w-[600px]">
                        {isIotaWorkspace
                            ? (iotaMenuId === 1 ? <IotaDashboard /> : <PlatformCenter />)
                            : <PlatformCenter />}
                    </div>
                </div>
            </div>
            
        </div>
    );
}
