import React from 'react';
import { useLanguage } from '../../context/LanguageContext';

export default function LeftNav() {
    const { lang } = useLanguage();

    const navItems = [
        { id: 'hq', labelKr: '종합현황 (HQ)', labelEn: 'Headquarters', icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1v1H9V7zm5 0h1v1h-1V7zm-5 4h1v1H9v-1zm5 0h1v1h-1v-1zm-5 4h1v1H9v-1zm5 0h1v1h-1v-1z' },
        { id: 'pipeline', labelKr: '파이프라인', labelEn: 'Pipeline', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
        { id: 'asset', labelKr: '단일 자산 코어', labelEn: 'Asset Core', icon: 'M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4', isActive: true },
        { id: 'compliance', labelKr: '내부 통제', labelEn: 'Compliance', icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z' },
        { id: 'minutes', labelKr: '회의록', labelEn: 'Meeting Minutes', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' }
    ];

    return (
        <div className="w-[80px] md:w-[240px] h-full bg-[#fbfbfd] border-r border-gray-200 flex flex-col items-center md:items-start py-8 flex-shrink-0">
            {/* Logo Area */}
            <div className="w-full px-6 flex justify-center md:justify-start mb-12">
                <div className="w-8 h-8 rounded-full bg-black flex items-center justify-center">
                    <span className="text-white font-bold text-xs">IGIS</span>
                </div>
            </div>

            {/* Nav Items */}
            <div className="w-full flex-1 px-4 flex flex-col gap-2">
                {navItems.map((item) => (
                    <div 
                        key={item.id} 
                        className={`w-full group flex items-center justify-center md:justify-start px-3 py-3 rounded-xl transition-all duration-300 cursor-pointer ${item.isActive ? 'bg-black text-white shadow-sm' : 'text-gray-500 hover:bg-gray-100 hover:text-black'}`}
                    >
                        <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
                            <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
                        </svg>
                        <span className={`hidden md:block ml-4 text-[13px] tracking-tight font-medium ${item.isActive ? 'text-white' : 'text-gray-600 group-hover:text-black'}`}>
                            {lang === 'kr' ? item.labelKr : item.labelEn}
                        </span>
                    </div>
                ))}
            </div>

            {/* Bottom Admin */}
            <div className="w-full px-4 pt-6 border-t border-gray-200">
                <div className="w-full flex items-center justify-center md:justify-start px-3 py-2 cursor-pointer group">
                    <div className="w-6 h-6 rounded-full bg-gray-300 overflow-hidden flex items-center justify-center">
                        <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" /></svg>
                    </div>
                    <span className="hidden md:block ml-3 text-[12px] text-gray-500 font-medium tracking-tight group-hover:text-black">
                        Admin
                    </span>
                </div>
            </div>
        </div>
    );
}
