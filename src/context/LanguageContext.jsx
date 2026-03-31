import React, { createContext, useContext, useState, useEffect } from 'react';

const LanguageContext = createContext();

export function LanguageProvider({ children }) {
    const [lang, setLang] = useState(() => {
        // 1. URL 파라미터 확인 (?lang=en 또는 #page-11?lang=en 지원)
        const params = new URLSearchParams(window.location.search);
        if (params.get('lang') === 'en' || window.location.hash.includes('lang=en')) return 'en';
        if (params.get('lang') === 'kr' || window.location.hash.includes('lang=kr')) return 'kr';
        
        // 2. 브라우저 언어 자동 감지 (한국어가 아니면 자동으로 영문 적용)
        if (typeof navigator !== 'undefined' && navigator.language) {
            if (!navigator.language.toLowerCase().startsWith('ko')) {
                return 'en';
            }
        }
        return 'kr'; // 기본값
    });

    // Utility to toggle font styles globally or optionally use state in components
    useEffect(() => {
        document.documentElement.lang = lang;

        const krTargetTexts = document.querySelectorAll(".kr-target-text");
        const enOnlyTexts = document.querySelectorAll(".en-only-text");
        const dualTexts = document.querySelectorAll("[data-en][data-kr]");

        dualTexts.forEach(el => {
            el.innerHTML = el.getAttribute(`data-${lang}`);
        });

        if (lang === 'kr') {
            krTargetTexts.forEach(el => {
                el.classList.add('font-normal');
                el.classList.remove('font-light');
            });
            enOnlyTexts.forEach(el => {
                el.style.display = 'none';
            });
        } else {
            krTargetTexts.forEach(el => {
                el.classList.add('font-light');
                el.classList.remove('font-normal');
            });
            enOnlyTexts.forEach(el => {
                el.style.display = 'block';
            });
        }
    }, [lang]);

    return (
        <LanguageContext.Provider value={{ lang, setLang }}>
            {children}
        </LanguageContext.Provider>
    );
}

export function useLanguage() {
    return useContext(LanguageContext);
}
