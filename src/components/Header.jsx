import React, { useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { termsTextKr, termsTextEn } from './LegalTexts';

export default function Header({ onNavigateToNews, onNavigateToHome, onNavigateToLease, onNavigateToPartnership, currentPage }) {
    const { lang, setLang } = useLanguage();
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [activeSection, setActiveSection] = useState('');
    const [isMegaMenuOpen, setIsMegaMenuOpen] = useState(false);
    const [hoveredIndex, setHoveredIndex] = useState(null);
    const [modalType, setModalType] = useState(null);
    const initialTransform = React.useRef('translateY(0)');

    const menuDataEn = [
        { 
            title: "The Engine", 
            id: "page-2", 
            items: [
                { label: "Data Sovereignty", id: "page-2" },
                { label: "Cross-Functional Shift", id: "page-6" },
                { label: "The Engine of IGIS", id: "page-10" },
                { label: "Global Validation & Advisory", id: "page-11" }
            ] 
        },
        { 
            title: "The Steering Wheel", 
            id: "page-12", 
            items: [
                { label: "Context & Moat", id: "page-12" },
                { label: "Human Layer", id: "page-14" },
                { label: "Value Accelerator", id: "page-15" },
                { label: "Global OS Benchmarks", id: "page-16" },
                { label: "Delegation of Authority", id: "page-17" }
            ] 
        },
        { title: "Inside IFPDP", id: "page-18", items: [] },
        { title: "Execution Plan", id: "page-19", items: [] }
    ];

    const menuDataKr = [
        { 
            title: "The Engine", 
            id: "page-2", 
            items: [
                { label: "Data Sovereignty", id: "page-2" },
                { label: "Cross-Functional Shift", id: "page-6" },
                { label: "The Engine of IGIS", id: "page-10" },
                { label: "Global Validation & Advisory", id: "page-11" }
            ] 
        },
        { 
            title: "The Steering Wheel", 
            id: "page-12", 
            items: [
                { label: "Context & Moat", id: "page-12" },
                { label: "Human Layer", id: "page-14" },
                { label: "Value Accelerator", id: "page-15" },
                { label: "Global OS Benchmarks", id: "page-16" },
                { label: "Delegation of Authority", id: "page-17" }
            ] 
        },
        { title: "Inside IFPDP", id: "page-18", items: [] },
        { title: "Execution Plan", id: "page-19", items: [] }
    ];

    const currentMenuData = lang === 'kr' ? menuDataKr : menuDataEn;

    const [activeHash, setActiveHash] = useState(window.location.hash || '#page-1');

    React.useEffect(() => {
        const handleHashChange = () => setActiveHash(window.location.hash);
        window.addEventListener('hashchange', handleHashChange);
        
        const handleGoto = (e) => {
            if (e.detail && typeof e.detail.slideIndex === 'number') {
                setActiveHash(`#page-${e.detail.slideIndex + 1}`);
            }
        };
        window.addEventListener('appSlideGoto', handleGoto);

        return () => {
            window.removeEventListener('hashchange', handleHashChange);
            window.removeEventListener('appSlideGoto', handleGoto);
        };
    }, []);

    const getActiveNavIndex = () => {
        const pageNum = parseInt(activeHash.replace('#page-', ''), 10) || 1;
        if (pageNum >= 2 && pageNum <= 11) return 0; // The Engine
        if (pageNum >= 12 && pageNum <= 17) return 1; // The Steering Wheel
        if (pageNum === 18) return 2; // Inside IFPDP
        if (pageNum >= 19) return 3; // Execution Plan
        return -1;
    };
    const activeNavIndex = getActiveNavIndex();

    React.useEffect(() => {
        if (mobileMenuOpen || modalType) {
            document.body.style.overflow = 'hidden';
            document.documentElement.style.overflow = 'hidden';
            // Also prevent touchmove on iOS Safari
            document.body.style.touchAction = 'none';
        } else {
            document.body.style.overflow = '';
            document.documentElement.style.overflow = '';
            document.body.style.touchAction = '';
        }

        return () => {
            document.body.style.overflow = '';
            document.documentElement.style.overflow = '';
            document.body.style.touchAction = '';
        };
    }, [mobileMenuOpen, modalType]);


    React.useEffect(() => {
        if (currentPage !== 'home') {
            setActiveSection('news');
            return;
        }

        const checkScroll = () => {
            const sections = ['section2', 'section-green', 'section-scale', 'section-nextgen', 'section-design', 'section-hotel', 'section-iotaone', 'section-iotatwo'];
            const scrollContainer = document.getElementById('scroll-container');
            if (!scrollContainer) return;

            let current = '';
            for (let id of sections) {
                const el = document.getElementById(id);
                if (el) {
                    const rect = el.getBoundingClientRect();
                    // If element top is above the middle of screen, it's active
                    if (rect.top <= window.innerHeight * 0.4) {
                        current = id;
                    }
                }
            }
            if (window.scrollY === 0) {
                current = '';
            }
            if (current !== activeSection) {
                setActiveSection(current);
            }
        };

        const scroller = window;
        if (scroller) {
            scroller.addEventListener('scroll', checkScroll, { passive: true });
            // Small delay to allow initial render
            setTimeout(checkScroll, 100);
            return () => scroller.removeEventListener('scroll', checkScroll);
        }
    }, [currentPage, activeSection]);

    const switchLang = (newLang) => {
        if (lang === newLang) return;

        // Visual blink effect
        const overlay = document.createElement('div');
        overlay.style.position = 'fixed';
        overlay.style.top = '0';
        overlay.style.left = '0';
        overlay.style.width = '100vw';
        overlay.style.height = '100vh';
        overlay.style.backgroundColor = 'black';
        overlay.style.opacity = '0.3';
        overlay.style.zIndex = '999999';
        overlay.style.pointerEvents = 'none';
        overlay.style.transition = 'opacity 0.3s ease-out';
        document.body.appendChild(overlay);

        setTimeout(() => {
            overlay.style.opacity = '0';
            setTimeout(() => {
                document.body.removeChild(overlay);
            }, 300);
        }, 150);

        setLang(newLang);
        setMobileMenuOpen(false);
        // Keep header during programmatic language switch
        window.isNavigating = true;
        clearTimeout(window.navigatingTimeout);
        window.navigatingTimeout = setTimeout(() => {
            window.isNavigating = false;
        }, 1500);
    };

    const handleScrollTo = (e, targetId) => {
        e.preventDefault();
        setMobileMenuOpen(false);

        const isTop = targetId === 'top';
        const newUrl = isTop ? window.location.pathname : `#${targetId}`;
        const currentCheck = isTop ? window.location.pathname : window.location.hash;

        if (targetId.startsWith('page-')) {
            window.location.hash = targetId;
            const pageIndex = parseInt(targetId.replace('page-', ''), 10) - 1;
            if (!isNaN(pageIndex)) {
                window.dispatchEvent(new CustomEvent('appSlideGoto', { detail: { slideIndex: pageIndex } }));
            }
            return;
        }

        if (window.location.hash !== (isTop ? '' : `#${targetId}`)) {
            window.history.pushState(null, '', newUrl);
        }

        // Keep header during programmatic scroll
        window.isNavigating = true;
        const header = document.getElementById('main-header');
        if (header) {
            header.style.transform = "translateY(0)";
        }
        clearTimeout(window.navigatingTimeout);
        window.navigatingTimeout = setTimeout(() => {
            window.isNavigating = false;
        }, 1500);

        if (currentPage !== 'home') {
            if (onNavigateToHome) onNavigateToHome();
            window.isNewsPage = false;
            window.isLeasePage = false;

            // Wait for DOM to render the home page sections before scrolling
            let checkCount = 0;
            const checkInterval = setInterval(() => {
                const target = document.getElementById(targetId === 'top' ? 'scroll-container' : targetId);
                checkCount++;

                if (target || checkCount > 50) {
                    clearInterval(checkInterval);
                    if (targetId === 'top') {
                        window.scrollTo({ top: 0, behavior: 'instant' });
                    } else if (target) {
                        target.scrollIntoView({ behavior: 'instant', block: 'start' });
                    }
                }
            }, 50);
            return;
        }

        if (targetId === 'top') {
            window.scrollTo({ top: 0, behavior: 'instant' });
        } else {
            const target = document.getElementById(targetId);
            if (target) {
                target.scrollIntoView({ behavior: 'instant', block: 'start' });
            }
        }
    };

    const handleNewsClick = (e) => {
        e.preventDefault();
        setMobileMenuOpen(false);
        const newHash = '#news';
        if (window.location.hash !== newHash) {
            window.history.pushState(null, '', newHash);
        }
        if (onNavigateToNews) onNavigateToNews();
    };

    const handleLeaseClick = (e) => {
        e.preventDefault();
        setMobileMenuOpen(false);
        const newHash = '#lease';
        if (window.location.hash !== newHash) {
            window.history.pushState(null, '', newHash);
        }
        if (onNavigateToLease) onNavigateToLease();
    };

    const handlePartnershipClick = (e) => {
        e.preventDefault();
        setMobileMenuOpen(false);
        const newHash = '#partnership';
        if (window.location.hash !== newHash) {
            window.history.pushState(null, '', newHash);
        }
        if (onNavigateToPartnership) onNavigateToPartnership();
    };

    return (
        <>
            <header id="main-header"
                className="fixed top-0 left-0 bg-white text-black z-50 py-[5px] md:py-[15px] transition-transform ease-in-out"
                style={{ transform: initialTransform.current, width: 'calc(100vw - var(--scrollbar-width, 0px))' }}>
                <div className="w-[calc(100%-48px)] md:w-[calc(100%-100px)] max-w-[1600px] mx-auto flex justify-between items-center transition-all duration-300">
                    <a href="#page-1"
                        onClick={(e) => {
                            if (window.location.hash === '#page-1') {
                                // If already on page 1, we still want to trigger any internal resets if necessary,
                                // but for slide continuity simply forcing the hash works perfectly.
                                return;
                            }
                        }}
                        className="text-xl font-bold tracking-normal cursor-pointer hover:opacity-80 transition-opacity">
                        IFPDP
                    </a>
                    <div className="hidden min-[1100px]:flex items-center gap-[30px]">
                        <div
                            className="flex gap-[32px] text-[16px] font-normal text-black tracking-[-0.03em] font-sans"
                            onMouseEnter={() => setIsMegaMenuOpen(true)}
                            onMouseLeave={() => { setIsMegaMenuOpen(false); setHoveredIndex(null); }}
                        >
                            {currentMenuData.map((col, idx) => (
                                <div
                                    key={idx}
                                    className="relative group/menu py-2 cursor-pointer flex items-center"
                                    onMouseEnter={() => setHoveredIndex(idx)}
                                    onClick={(e) => {
                                        setIsMegaMenuOpen(false);
                                        if (col.type === 'news') {
                                            e.preventDefault();
                                            handleNewsClick(e);
                                        } else if (col.type === 'lease' || col.type === 'inquiry') {
                                            e.preventDefault();
                                            handleLeaseClick(e);
                                        } else if (col.type === 'alert') {
                                            e.preventDefault();
                                            alert(col.message);
                                        } else if (col.id) {
                                            e.preventDefault();
                                            handleScrollTo(e, col.id);
                                        }
                                    }}
                                >
                                    <span className={`relative pb-0 after:content-[''] after:absolute after:w-full after:scale-x-0 after:h-[1.5px] after:-bottom-[-2px] after:left-0 after:bg-black after:origin-bottom-left after:transition-transform after:duration-300 group-hover/menu:after:scale-x-100 transition-colors hover:text-black ${activeNavIndex === idx ? 'font-bold' : ''}`}>
                                        {col.title}
                                    </span>
                                </div>
                            ))}

                            {/* Dropdown Mega Menu */}
                            <div
                                className={`absolute left-0 !ml-0 top-[100%] w-full bg-white transition-all duration-300 overflow-hidden ${isMegaMenuOpen ? 'max-h-[600px] opacity-100 shadow-[0_10px_30px_rgba(0,0,0,0.05)] border-t border-gray-100' : 'max-h-0 opacity-0'}`}
                                style={{ zIndex: 40 }}
                            >
                                <div className="w-[calc(100%-48px)] md:w-[calc(100%-100px)] max-w-[1600px] mx-auto pt-10 pb-[40px] flex justify-start gap-[120px]">
                                    {currentMenuData.map((col, idx) => (
                                        <div
                                            key={idx}
                                            className="flex flex-col shrink-0 min-w-max"
                                            onMouseEnter={() => setHoveredIndex(idx)}
                                        >
                                            <h4
                                                className="text-[16px] xl:text-[18px] font-semibold mb-5 tracking-[-0.03em] text-black w-fit cursor-pointer"
                                                onClick={(e) => {
                                                    setIsMegaMenuOpen(false);
                                                    if (col.type === 'news') {
                                                        e.preventDefault();
                                                        handleNewsClick(e);
                                                    } else if (col.type === 'lease' || col.type === 'inquiry') {
                                                        e.preventDefault();
                                                        handleLeaseClick(e);
                                                    } else if (col.type === 'alert') {
                                                        e.preventDefault();
                                                        alert(col.message);
                                                    } else if (col.id) {
                                                        e.preventDefault();
                                                        handleScrollTo(e, col.id);
                                                    }
                                                }}
                                            >
                                                <span className={`relative pb-0 px-1 -mx-1 rounded-sm transition-colors duration-300 after:content-[''] after:absolute after:w-[calc(100%-8px)] after:h-[1.5px] after:-bottom-[-2px] after:left-[4px] after:bg-black after:origin-bottom-left after:transition-transform after:duration-300 ${hoveredIndex === idx ? 'bg-[#fbf167] after:scale-x-100' : 'bg-transparent after:scale-x-0'}`}>
                                                    {col.title}
                                                </span>
                                            </h4>
                                            <ul className="flex flex-col space-y-3">
                                                {col.items.map((item, itemIdx) => {
                                                    const isNews = item.type === 'news';
                                                    const isLease = item.type === 'lease';
                                                    const isPartnership = item.type === 'partnership';
                                                    const isAlert = item.type === 'alert';
                                                    const isDownload = item.type === 'download';

                                                    const clickHandler = (e) => {
                                                        if (isNews) {
                                                            setIsMegaMenuOpen(false);
                                                            handleNewsClick(e);
                                                        } else if (isLease) {
                                                            setIsMegaMenuOpen(false);
                                                            handleLeaseClick(e);
                                                        } else if (isPartnership) {
                                                            setIsMegaMenuOpen(false);
                                                            handlePartnershipClick(e);
                                                        } else if (isAlert) {
                                                            e.preventDefault();
                                                            setIsMegaMenuOpen(false);
                                                            alert(item.message);
                                                        } else if (isDownload) {
                                                            setIsMegaMenuOpen(false);
                                                        } else {
                                                            setIsMegaMenuOpen(false);
                                                            handleScrollTo(e, item.id);
                                                        }
                                                    };

                                                    return (
                                                        <li key={itemIdx}>
                                                            <a
                                                                href={isNews ? "#news" : isLease ? "#lease" : isPartnership ? "#partnership" : isAlert ? "#" : isDownload ? item.url : `#${item.id}`}
                                                                target={isDownload ? "_blank" : undefined}
                                                                onClick={clickHandler}
                                                                className="text-[13px] xl:text-[15px] text-gray-700 font-light tracking-[-0.03em] group/sub inline-block w-fit"
                                                            >
                                                                <span className="relative pb-0 after:content-[''] after:absolute after:w-full after:scale-x-0 after:h-[1px] after:-bottom-[-1px] after:left-0 after:bg-black after:origin-bottom-left after:transition-transform after:duration-300 group-hover/sub:after:scale-x-100 group-hover/sub:text-black transition-colors">
                                                                    {item.label}
                                                                </span>
                                                            </a>
                                                        </li>
                                                    );
                                                })}
                                            </ul>
                                        </div>
                                    ))}

                                    {/* Legal Links (Right aligned) */}
                                    <div className="ml-auto flex flex-col items-end gap-[6px] text-[#888] font-bold text-[12px] md:text-[13px] tracking-tight mt-0">
                                        <button onClick={() => setModalType('disclaimer')} className="cursor-pointer hover:text-black transition-colors">
                                            {lang === 'kr' ? "면책공고" : "Disclaimer"}
                                        </button>
                                        <button onClick={() => setModalType('terms')} className="cursor-pointer hover:text-black transition-colors">
                                            {lang === 'kr' ? "이용약관" : "Terms of Service"}
                                        </button>
                                    </div>

                                </div>
                            </div>
                        </div>
                        <div className="w-px h-4 bg-gray-300"></div>
                        <div className="relative group text-[14px]">
                            <button className="flex items-center space-x-1 font-bold text-gray-800 hover:text-gray-500 focus:outline-none pb-2 -mb-2 relative -top-[1px]">
                                <span className={lang === 'kr' ? 'relative top-[1px]' : ''}>{lang.toUpperCase()}</span>
                                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
                                </svg>
                            </button>
                            <div className="absolute right-0 mt-2 w-16 bg-white border border-gray-100 shadow-lg hidden group-hover:block py-1 z-50 rounded-sm">
                                <button className="block w-full text-left px-3 py-1 hover:bg-gray-50 text-gray-600" onClick={() => switchLang('en')}>EN</button>
                                <button className="block w-full text-left px-3 py-1 hover:bg-gray-50 text-gray-600" onClick={() => switchLang('kr')}><span className="relative top-[1px]">KR</span></button>
                            </div>
                        </div>
                    </div>
                    <div className="min-[1100px]:hidden flex items-center space-x-4">
                        <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="focus:outline-none w-[40px] h-10 flex flex-col justify-center items-end gap-[8px]">
                            <span className="block w-[39px] h-[2px] bg-black"></span>
                            <span className="block w-[39px] h-[2px] bg-black"></span>
                        </button>
                    </div>
                </div>
            </header>

            <div id="mobile-menu"
                className={`fixed top-[74px] md:top-[90px] bottom-0 left-0 w-full bg-white shadow-lg flex-col pt-4 pb-8 space-y-4 z-40 transition-transform overscroll-contain ${mobileMenuOpen ? 'flex' : 'hidden'} min-[1100px]:hidden`}>
                <div className="w-full flex-col flex-1 overflow-y-auto overscroll-contain px-6 py-2 hide-scrollbar flex items-start text-left">
                    {currentMenuData.map((col, idx) => (
                        <div key={idx} className="w-full mb-6">
                            <h4 className="text-[18px] font-bold text-black mb-3 border-b border-gray-100 pb-2">{col.title}</h4>
                            <div className="flex flex-col space-y-3">
                                {col.items.map((item, itemIdx) => {
                                    if (item.type === 'news') {
                                        return (
                                            <a
                                                key={itemIdx}
                                                href="#news"
                                                onClick={(e) => handleNewsClick(e)}
                                                className={`text-[15px] text-gray-600 hover:text-black hover:font-bold transition-all tracking-tight`}
                                            >
                                                {item.label}
                                            </a>
                                        );
                                    } else if (item.type === 'lease') {
                                        return (
                                            <a
                                                key={itemIdx}
                                                href="#lease"
                                                onClick={(e) => handleLeaseClick(e)}
                                                className={`text-[15px] text-gray-600 hover:text-black hover:font-bold transition-all tracking-tight`}
                                            >
                                                {item.label}
                                            </a>
                                        );
                                    } else if (item.type === 'alert') {
                                        return (
                                            <a
                                                key={itemIdx}
                                                href="#"
                                                onClick={(e) => { e.preventDefault(); alert(item.message); setMobileMenuOpen(false); }}
                                                className={`text-[15px] text-gray-600 hover:text-black hover:font-bold transition-all tracking-tight`}
                                            >
                                                {item.label}
                                            </a>
                                        );
                                    } else if (item.type === 'download') {
                                        return (
                                            <a
                                                key={itemIdx}
                                                href={item.url}
                                                target="_blank"
                                                onClick={() => setMobileMenuOpen(false)}
                                                className={`text-[15px] text-gray-600 hover:text-black hover:font-bold transition-all tracking-tight`}
                                            >
                                                {item.label}
                                            </a>
                                        );
                                    } else {
                                        return (
                                            <a
                                                key={itemIdx}
                                                href={`#${item.id}`}
                                                onClick={(e) => handleScrollTo(e, item.id)}
                                                className={`text-[15px] text-gray-600 hover:text-black hover:font-bold transition-all tracking-tight`}
                                            >
                                                {item.label}
                                            </a>
                                        );
                                    }
                                })}
                            </div>
                        </div>
                    ))}

                    <div className="w-full flex flex-col border-t border-gray-100 pt-6 mt-2 mb-4 items-start text-left gap-3">
                        <button onClick={() => { setModalType('disclaimer'); setMobileMenuOpen(false); }} className="text-[15px] font-bold text-gray-500 hover:text-black cursor-pointer transition-colors">
                            {lang === 'kr' ? "면책공고" : "Disclaimer"}
                        </button>
                        <button onClick={() => { setModalType('terms'); setMobileMenuOpen(false); }} className="text-[15px] font-bold text-gray-500 hover:text-black cursor-pointer transition-colors">
                            {lang === 'kr' ? "이용약관" : "Terms of Service"}
                        </button>
                    </div>
                    <div className="flex space-x-8 pt-6 border-t border-gray-200 justify-start w-full mb-8">
                        <button className="text-[20px] font-bold text-gray-800 hover:text-gray-500" onClick={() => switchLang('en')}>EN</button>
                        <button className="text-[20px] font-bold text-gray-800 hover:text-gray-500" onClick={() => switchLang('kr')}><span className="relative top-[1px]">KR</span></button>
                    </div>

                </div>
            </div>

            {/* Modal */}
            {modalType && (
                <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/50 p-4">
                    <div className={`w-full max-w-2xl max-h-[80vh] overflow-y-auto rounded-xl p-6 md:p-8 bg-white text-black shadow-2xl relative text-left`}>
                        <button
                            onClick={() => setModalType(null)}
                            className="absolute top-4 right-4 p-2 opacity-60 hover:opacity-100 transition-opacity cursor-pointer"
                        >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>

                        {/* Rendering Modal Content Based on Type */}
                        {modalType === 'disclaimer' && (
                            lang === 'kr' ? (
                                <div className="font-sans text-[13px] md:text-[14px] leading-relaxed font-light break-keep">
                                    <h3 className="text-[18px] md:text-[20px] font-bold mb-6 font-inter tracking-tight">[면책공고 / Disclaimer]</h3>
                                    <p className="mb-6">
                                        본 <strong>IFPDP (IGIS Fund Production Data Platform) 플랫폼 전략 기획안</strong>은 이지스자산운용 주식회사(이하 “회사”)가 사내 펀드 생산성 향상 및 데이터 아키텍처에 대한 이해를 돕기 위해 관련 정보와 개념적 모델을 근거로 제작한 것이며, 이용 시 다음과 같은 주의사항을 고지합니다.
                                    </p>

                                    <ol className="list-decimal pl-5 space-y-5">
                                        <li className="pl-1">
                                            <strong className="block font-bold mb-1">정보의 목적 및 성격</strong>
                                            본 기획안은 정식 시스템 매뉴얼, 투자설명서, 상품설명서 또는 정식 IM(Information Memorandum) 자료가 아니며, 당사가 지향하는 데이터 통합 플랫폼에 대한 구상과 전략적 방향성을 공유하기 위한 내부 참고용 프레젠테이션입니다.<br />
                                            본 자료에 포함된 데이터 프레임워크나 텍스트는 어떠한 경우에도 외부 투자 권유 또는 법적 구속력이 있는 시스템 청사진으로 이용될 수 없습니다.
                                        </li>
                                        <li className="pl-1">
                                            <strong className="block font-bold mb-1">정보의 정확성 및 완전성</strong>
                                            본 자료에 게재된 아키텍처 도식, 수치, 애니메이션 구현 방식 등은 현재의 전략을 바탕으로 작성된 예시이며, 실제 IFPDP 시스템 개발 및 적용 과정에서 별도의 고지 없이 수시로 조정되거나 변경될 수 있습니다.<br />
                                            회사는 본 자료에 포함된 모델링 정보의 기술적 완전성, 적절성에 대하여 명시적 또는 묵시적으로 어떠한 보증을 하지 않습니다.
                                        </li>
                                        <li className="pl-1">
                                            <strong className="block font-bold mb-1">이용자의 책임</strong>
                                            이용자는 본 자료의 정보를 평가함에 있어 각자의 업무 책임하에 참고 목적으로만 활용해야 하며, 본 자료의 내용에 의존하여 진행한 실무적 의사결정에 대하여 회사와 그 임직원은 여하한 법률적 책임을 부담하지 않습니다.
                                        </li>
                                        <li className="pl-1">
                                            <strong className="block font-bold mb-1">플랫폼 추진 권리</strong>
                                            회사는 개발 로드맵 및 사업 환경 변화에 따라 본 플랫폼의 구조, 일정 등을 언제든지 변경, 취소 또는 중단할 수 있는 권리를 가집니다.
                                        </li>
                                    </ol>
                                </div>
                            ) : (
                                <div className="font-sans text-[13px] md:text-[14px] leading-relaxed font-light break-keep">
                                    <h3 className="text-[18px] md:text-[20px] font-bold mb-6 font-inter tracking-tight">[Disclaimer]</h3>
                                    <p className="mb-6">
                                        This <strong>IFPDP (IGIS Fund Production Data Platform) Platform Strategy Proposal</strong> has been produced by IGIS Asset Management Co., Ltd. (the "Company") based on conceptual models to facilitate an understanding of our data architecture and fund productivity enhancement strategies. Please be advised of the following precautions:
                                    </p>

                                    <ol className="list-decimal pl-5 space-y-5">
                                        <li className="pl-1">
                                            <strong className="block font-bold mb-1">Purpose and Nature of Information</strong>
                                            This proposal is an internal reference presentation intended to share the vision and strategic direction of our data integration platform. It is not an official system manual, prospectus, or Information Memorandum (IM).<br />
                                            Data frameworks or strings included herein shall not be used under any circumstances as external investment solicitations or legally binding system blueprints.
                                        </li>
                                        <li className="pl-1">
                                            <strong className="block font-bold mb-1">Accuracy and Completeness of Information</strong>
                                            The architectural diagrams, numerical data, and animation implementations presented are illustrative examples based on current strategies and are subject to adjustment without prior notice during actual IFPDP system development.<br />
                                            The Company makes no express or implied representations or warranties regarding the technical completeness or suitability of the modeling information contained herein.
                                        </li>
                                        <li className="pl-1">
                                            <strong className="block font-bold mb-1">User's Responsibility</strong>
                                            Users must utilize this information solely for reference under their own professional responsibility. The Company and its employees shall assume no legal liability whatsoever for any practical decisions made relying on this content.
                                        </li>
                                        <li className="pl-1">
                                            <strong className="block font-bold mb-1">Platform Development Rights</strong>
                                            The Company reserves the right to modify, cancel, or suspend the structure and schedule of this platform at any time depending on development roadmaps and business environment changes.
                                        </li>
                                    </ol>
                                </div>
                            )
                        )}

                        {modalType === 'terms' && (
                            <div className="font-sans text-[13px] md:text-[14px] leading-relaxed font-light whitespace-pre-line break-keep">
                                {lang === 'kr' ? termsTextKr : termsTextEn}
                            </div>
                        )}

                        <div className="mt-8 pt-6 border-t border-gray-200/20 text-center">
                            <button
                                onClick={() => setModalType(null)}
                                className={`px-8 py-2.5 rounded-full font-medium transition-colors bg-black text-white hover:bg-black/80 cursor-pointer`}
                            >
                                {lang === 'kr' ? "확인" : "Confirm"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
