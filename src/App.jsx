import React from 'react';
import { useAnimations } from './hooks/useAnimations';
import { useLanguage } from './context/LanguageContext';
import { useAuth } from './context/AuthContext';
import AuthSetup from './components/system/AuthSetup';
import PlatformCore from './components/system/PlatformCore';
import {
    LOGISTICS_DATA_PLATFORM_HOME,
    LOGISTICS_INTERNAL_BASE,
    normalizeLogisticsPath,
    publicLogisticsPath,
} from './components/system/workspace/logisticsRoutes';

// BASE_URL: '/' in dev, '/IGIS-Fund-Production-DP/' in GitHub Pages production
const BASE = import.meta.env.BASE_URL;
const LOGISTICS_DEFAULT_PATH = LOGISTICS_DATA_PLATFORM_HOME;

const normalizeGate6Page = (path) => {
    const normalized = normalizeLogisticsPath(path || LOGISTICS_DEFAULT_PATH);
    if (normalized === 'auth-setup') return normalized;
    if (!normalized.startsWith('platform/iotaseoul')) return LOGISTICS_DEFAULT_PATH;
    const isLegacyIotaPage = normalized.startsWith('platform/iotaseoul')
        && !normalized.startsWith(LOGISTICS_INTERNAL_BASE);
    return isLegacyIotaPage ? LOGISTICS_DEFAULT_PATH : normalized;
};

const getPage = () => {
    const base = BASE.endsWith('/') ? BASE.slice(0, -1) : BASE;
    const redirectedPath = new URLSearchParams(window.location.search).get('p');
    let path = redirectedPath
        ? redirectedPath.replace(/~and~/g, '&').replace(/^\//, '')
        : window.location.pathname.replace(base, '').replace(/^\//, '');
    if (path.endsWith('/')) path = path.slice(0, -1);
    return normalizeGate6Page(path);
};

const toUrl = (page) => {
    const base = BASE.endsWith('/') ? BASE : `${BASE}/`;
    if (normalizeLogisticsPath(page).startsWith(LOGISTICS_INTERNAL_BASE)) {
        return `${base}${publicLogisticsPath(page)}`;
    }
    return page === 'home' ? base : `${base}${page}`;
};

export default function App() {
  const [currentPage, setCurrentPage] = React.useState(() => getPage());

  // Handle URL syncing and global left/right key navigation sequences
  React.useEffect(() => {
      const handlePopState = () => {
          setCurrentPage(getPage());
      };

      const handleGlobalKeyDown = (e) => {
          if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

          const flow = ['home', 'system-plan', 'system-bridge', 'system-chat', 'system-detail', 'action-plan', 'system-core'];
          const currentIndex = flow.indexOf(currentPage);
          
          if (e.key === 'ArrowLeft' && currentIndex > 0) {
              // system-plan(로그인 화면)에서는 왼쪽 버튼으로 메인 홈으로 튕기지 않도록 방어
              if (currentPage === 'system-plan') return;
              const prev = flow[currentIndex - 1];
              window.history.pushState(null, '', toUrl(prev));
              setCurrentPage(prev);
          }
      };

      window.addEventListener('popstate', handlePopState);
      window.addEventListener('keydown', handleGlobalKeyDown);
      return () => {
          window.removeEventListener('popstate', handlePopState);
          window.removeEventListener('keydown', handleGlobalKeyDown);
      };
  }, [currentPage]);

  const navigateTo = React.useCallback((page) => {
      const normalizedPage = normalizeGate6Page(page);
      window.history.pushState(null, '', toUrl(normalizedPage));
      setCurrentPage(normalizedPage);
      window.dispatchEvent(new CustomEvent('logistics-data-refresh', { detail: { path: normalizedPage } }));
  }, []);

  useAnimations(currentPage);

  React.useEffect(() => {
    window.isNewsPage = false;
    window.isLeasePage = false;
  }, [currentPage]);

  React.useEffect(() => {
      const normalized = normalizeLogisticsPath(currentPage);
      if (!normalized.startsWith(LOGISTICS_INTERNAL_BASE)) return;
      const targetUrl = toUrl(normalized);
      const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      if (currentUrl !== targetUrl) {
          window.history.replaceState(window.history.state || null, '', targetUrl);
      }
  }, [currentPage]);

  const { lang } = useLanguage();
  const { user, loading, recoveryMode } = useAuth();
  const isAuthSetupMaintenance = () => {
      try {
          return window.sessionStorage.getItem('logisticsAuthSetupMode') === 'password-change';
      } catch {
          return false;
      }
  };
  const shouldShowAuthSetup = currentPage === 'auth-setup'
      || (!loading && !user && currentPage.startsWith('platform/iotaseoul') && !recoveryMode);
  const isAuthResolving = loading && currentPage.startsWith('platform/iotaseoul');
  const renderedPage = isAuthResolving ? 'auth-resolving' : shouldShowAuthSetup ? 'auth-setup' : currentPage;
  const isFullscreenPage = renderedPage === 'auth-setup'
      || renderedPage === 'auth-resolving'
      || renderedPage.startsWith('platform/iotaseoul');
  const hideMobileBlocker = renderedPage === 'auth-setup'
      || renderedPage === 'auth-resolving'
      || renderedPage.startsWith('platform/iotaseoul');

  // Protect platform routes
  React.useEffect(() => {
      if (recoveryMode && currentPage !== 'auth-setup') {
          navigateTo('auth-setup');
          return;
      }

      if (!loading && !user && currentPage.startsWith('platform/iotaseoul') && !recoveryMode) {
          window.sessionStorage.setItem('logisticsPostLoginPath', currentPage);
          navigateTo('auth-setup');
          return;
      }

      if (!loading && user && currentPage === 'auth-setup' && !recoveryMode && !isAuthSetupMaintenance()) {
          const nextPath = window.sessionStorage.getItem('logisticsPostLoginPath') || LOGISTICS_DEFAULT_PATH;
          window.sessionStorage.removeItem('logisticsPostLoginPath');
          navigateTo(nextPath);
      }
  }, [user, loading, currentPage, recoveryMode, navigateTo]);

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
      <div className={`fixed inset-0 z-[99999] bg-white items-center justify-center p-6 text-center ${hideMobileBlocker ? 'hidden' : 'flex lg:hidden'}`}>
        <div className="flex flex-col items-center opacity-80">
            <svg className="w-12 h-12 mb-5 text-[#1d1d1f]" fill="none" strokeWidth="1.5" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0V12a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 12V5.25" />
            </svg>
            <p className="text-[16px] md:text-[18px] font-medium text-[#1d1d1f] tracking-tight leading-[1.6]">
                {lang === 'kr' ? '큰 화면의 PC 모니터에서 확인해주세요.' : 'Please view this on a larger PC monitor.'}
            </p>
        </div>
      </div>

      <div className={isFullscreenPage ? "w-full h-screen overflow-hidden" : "hidden lg:block scroll-container font-sans"} id="scroll-container">
        {renderedPage === 'auth-resolving' && (
          <div
            data-testid="logistics-auth-resolving"
            aria-label="로그인 확인 중"
            className="h-full w-full bg-[#1F1F1E]"
          />
        )}
        {renderedPage === 'auth-setup' && <AuthSetup onLogin={() => navigateTo(window.sessionStorage.getItem('logisticsPostLoginPath') || LOGISTICS_DEFAULT_PATH)} />}
        {renderedPage.startsWith('platform/iotaseoul') && <PlatformCore isPlatform={true} isIotaWorkspaceOverride={true} currentPath={renderedPage} />}
      </div>
    </>
  );
}
