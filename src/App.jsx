import React from 'react';
import Header from './components/Header';
import MainLayout from './components/MainLayout';
import { useAnimations } from './hooks/useAnimations';
import { useLanguage } from './context/LanguageContext';

export default function App() {
  const [currentPage, setCurrentPage] = React.useState('home');

  useAnimations(currentPage);

  React.useEffect(() => {
    window.isNewsPage = false;
    window.isLeasePage = false;
  }, [currentPage]);

  const { lang } = useLanguage();

  React.useEffect(() => {
    const applyLanguage = () => {
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
    };
    setTimeout(applyLanguage, 50);
  }, [currentPage, lang]);

  return (
    <>
      {/* Global Mobile Blocker */}
      <div className="flex lg:hidden fixed inset-0 z-[99999] bg-white items-center justify-center p-6 text-center">
        <div className="flex flex-col items-center opacity-80">
            <svg className="w-12 h-12 mb-5 text-[#1d1d1f]" fill="none" strokeWidth="1.5" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0V12a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 12V5.25" />
            </svg>
            <p className="text-[16px] md:text-[18px] font-medium text-[#1d1d1f] tracking-tight leading-[1.6]">
                {lang === 'kr' ? '큰 화면의 PC 모니터에서 확인해주세요.' : 'Please view this on a larger PC monitor.'}
            </p>
        </div>
      </div>

      <div className="hidden lg:block scroll-container font-sans" id="scroll-container">
        <Header
          onNavigateToHome={() => setCurrentPage('home')}
          currentPage={currentPage}
        />

        {currentPage === 'home' && <MainLayout />}
      </div>
    </>
  );
}
