import React, { useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { privacyTextKr, privacyTextEn, termsTextKr, termsTextEn } from './LegalTexts';

export default function Header({ onNavigateToNews, onNavigateToHome, onNavigateToLease, onNavigateToPartnership, currentPage }) {
    const { lang, setLang } = useLanguage();
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [activeSection, setActiveSection] = useState('');
    const [isMegaMenuOpen, setIsMegaMenuOpen] = useState(false);
    const [hoveredIndex, setHoveredIndex] = useState(null);
    const [modalType, setModalType] = useState(null);
    const initialTransform = React.useRef((currentPage !== 'home') ? 'translateY(0)' : 'translateY(-100%)');

    const menuDataEn = [
        {
            title: "New Heart of Seoul",
            id: "section2",
            items: [
                { label: "Build with Foster + Partners", id: "section-foster" },
                { label: "Property Overview", id: "section3" },
                { label: "Brand Guidelines", id: "section4" },
                { label: "SYBD", id: "section5" },
                { label: "Green", id: "section-green" },
                { label: "Unmatched Scale", id: "section-scale" }
            ]
        },
        {
            title: "Next-Gen Workplace",
            id: "section-nextgen",
            items: [
                { label: "New Office Standard for the AI Era", id: "section-nextgen-standard" },
                { label: "Air Quality Management", id: "section-airquality" },
                { label: "Seamless User Experience", id: "section-smartinterface" },
                { label: "Net-Zero Ready", id: "section-netzero" },
                { label: "Privacy-Focused Restroom", id: "section-restroom" },
                { label: "Korea's Largest Elevator", id: "section-elevator" },
                { label: "AI-Driven Building HVAC", id: "section-hvac" }
            ]
        },
        {
            title: "Design & Service",
            id: "section-design",
            items: [
                { label: "Architectural Legends", id: "section-design" },
                { label: "Global Top-Tier Construction Company", id: "section-construction" },
                { label: "Upper Luxury Hospitality", id: "section-hotel" }
            ]
        },
        {
            title: "IOTA Details",
            id: "section-iotaone",
            items: [
                { label: "IOTA Seoul One", id: "section-iotaone" },
                { label: "IOTA Seoul Two", id: "section-iotatwo" },
                { label: "Partnership", id: "section-partnership" }
            ]
        },
        {
            title: "News",
            type: "news",
            items: [
                { label: "News & Insights", id: "news", type: "news" }
            ]
        },
        {
            title: "Inquiry",
            type: "inquiry",
            items: [
                { label: "Leasing Inquiry", id: "lease", type: "lease" },
                { label: "Partnership Inquiry", id: "partnership", type: "partnership" }
            ]
        }
    ];

    const menuDataKr = [
        {
            title: "New Heart of Seoul",
            id: "section2",
            items: [
                { label: "포스터 앤 파트너스 설계", id: "section-foster" },
                { label: "건축 개요", id: "section3" },
                { label: "브랜드 아이덴티티", id: "section4" },
                { label: "글로벌 업무지구", id: "section5" },
                { label: "도심 속 자연", id: "section-green" },
                { label: "압도적인 스케일", id: "section-scale" }
            ]
        },
        {
            title: "Next-Gen Workplace",
            id: "section-nextgen",
            items: [
                { label: "AI 시대의 새로운 오피스 표준", id: "section-nextgen-standard" },
                { label: "초정밀 공기질 관리 시스템", id: "section-airquality" },
                { label: "심리스 디지털 사용자 경험", id: "section-smartinterface" },
                { label: "넷제로 친환경 빌딩", id: "section-netzero" },
                { label: "프라이버시 집중형 화장실", id: "section-restroom" },
                { label: "국내 최고 사양 엘리베이터", id: "section-elevator" },
                { label: "입주사 맞춤형 공조 시스템", id: "section-hvac" }
            ]
        },
        {
            title: "Design & Service",
            id: "section-design",
            items: [
                { label: "세계적인 건축 거장의 만남", id: "section-design" },
                { label: "글로벌 탑티어 건설사 참여", id: "section-construction" },
                { label: "최상위 럭셔리 호스피탈리티", id: "section-hotel" }
            ]
        },
        {
            title: "IOTA Details",
            id: "section-iotaone",
            items: [
                { label: "IOTA Seoul One", id: "section-iotaone" },
                { label: "IOTA Seoul Two", id: "section-iotatwo" },
                { label: "Partnership", id: "section-partnership" }
            ]
        },
        {
            title: "News",
            type: "news",
            items: [
                { label: "News & Insights", id: "news", type: "news" }
            ]
        },
        {
            title: "Inquiry",
            type: "inquiry",
            items: [
                { label: "임대차 문의", id: "lease", type: "lease" },
                { label: "파트너십 문의", id: "partnership", type: "partnership" }
            ]
        }
    ];

    const currentMenuData = lang === 'kr' ? menuDataKr : menuDataEn;

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
                className="fixed top-0 left-0 bg-white text-black z-50 py-[25px] md:py-[35px] transition-transform ease-in-out"
                style={{ transform: initialTransform.current, width: 'calc(100vw - var(--scrollbar-width, 0px))' }}>
                <div className="w-[calc(100%-48px)] md:w-[calc(100%-100px)] max-w-[1600px] mx-auto flex justify-between items-center transition-all duration-300">
                    <a href="#"
                        onClick={(e) => handleScrollTo(e, 'top')}
                        className="text-xl font-bold tracking-normal cursor-pointer hover:opacity-80 transition-opacity">
                        IOTA Seoul
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
                                    <span className="relative pb-0 after:content-[''] after:absolute after:w-full after:scale-x-0 after:h-[1.5px] after:-bottom-[-2px] after:left-0 after:bg-black after:origin-bottom-left after:transition-transform after:duration-300 group-hover/menu:after:scale-x-100 transition-colors hover:text-black">
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
                                        <button onClick={() => setModalType('privacy')} className="cursor-pointer hover:text-black transition-colors">
                                            {lang === 'kr' ? "개인정보 처리방침" : "Privacy Policy"}
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
                className={`fixed top-[74px] md:top-[90px] left-0 w-full bg-white shadow-lg flex-col py-6 space-y-4 z-40 transition-transform ${mobileMenuOpen ? 'flex' : 'hidden'} min-[1100px]:hidden text-center justify-center items-center`}>
                <div className="w-full flex-col h-[70vh] overflow-y-auto px-6 py-4 hide-scrollbar flex items-start text-left">
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
                </div>
                <div className="w-full flex-col px-6 border-t border-gray-100 pt-6 mb-4 flex items-start text-left gap-3 shrink-0">
                    <button onClick={() => { setModalType('disclaimer'); setMobileMenuOpen(false); }} className="text-[15px] font-bold text-gray-500 hover:text-black cursor-pointer transition-colors">
                        {lang === 'kr' ? "면책공고" : "Disclaimer"}
                    </button>
                    <button onClick={() => { setModalType('privacy'); setMobileMenuOpen(false); }} className="text-[15px] font-bold text-gray-500 hover:text-black cursor-pointer transition-colors">
                        {lang === 'kr' ? "개인정보 처리방침" : "Privacy Policy"}
                    </button>
                    <button onClick={() => { setModalType('terms'); setMobileMenuOpen(false); }} className="text-[15px] font-bold text-gray-500 hover:text-black cursor-pointer transition-colors">
                        {lang === 'kr' ? "이용약관" : "Terms of Service"}
                    </button>
                </div>
                <div className="flex space-x-8 pt-6 border-t border-gray-200 justify-center w-full shrink-0">
                    <button className="text-[20px] font-bold text-gray-800 hover:text-gray-500" onClick={() => switchLang('en')}>EN</button>
                    <button className="text-[20px] font-bold text-gray-800 hover:text-gray-500" onClick={() => switchLang('kr')}><span className="relative top-[1px]">KR</span></button>
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
                                        본 <strong>디지털 비전북(iotaseoul.site)</strong>은 이지스자산운용 주식회사(이하 “회사”)가 프로젝트에 대한 이해를 돕기 위해 관련 정보와 공개된 자료를 근거로 제작한 것이며, 이용 시 다음과 같은 주의사항을 고지합니다.
                                    </p>

                                    <ol className="list-decimal pl-5 space-y-5">
                                        <li className="pl-1">
                                            <strong className="block font-bold mb-1">정보의 목적 및 성격</strong>
                                            본 디지털 비전북은 투자설명서, 상품설명서 또는 정식 IM(Information Memorandum) 자료가 아니며, 프로젝트에 대한 단순 참고용 정보 제공을 목적으로 합니다.<br />
                                            본 자료는 이용자의 투자 의사결정을 위한 근거 자료로 작성된 것이 아니며, 어떠한 경우에도 투자 권유나 자문의 용도로 이용될 수 없습니다.
                                        </li>
                                        <li className="pl-1">
                                            <strong className="block font-bold mb-1">정보의 정확성 및 완전성</strong>
                                            본 자료에 게재된 조감도, 설계 제원, 수치 및 상세 계획(IOTA Details)은 현재의 사업 계획을 바탕으로 작성된 예시이며, 실제 시공 시 인허가 조건 및 사업 환경의 변화에 따라 별도의 고지 없이 수시로 변경될 수 있습니다.<br />
                                            회사는 본 자료에 포함된 정보의 정확성, 완전성, 적절성에 대하여 명시적 또는 묵시적으로 어떠한 의견 표명이나 보증을 하지 않습니다.
                                        </li>
                                        <li className="pl-1">
                                            <strong className="block font-bold mb-1">이용자의 책임 및 전문적 조언</strong>
                                            이용자는 본 자료의 정보를 평가함에 있어 각자의 책임하에 전문적인 조언을 구하고 스스로의 판단에 의존해야 합니다.<br />
                                            본 자료에 포함되거나 추가로 제공된 정보를 활용하여 내린 결정에 대하여 회사와 그 임직원은 여하한 법률적 책임을 부담하지 않습니다.
                                        </li>
                                        <li className="pl-1">
                                            <strong className="block font-bold mb-1">사업 절차의 권리 및 취소</strong>
                                            회사는 프로젝트 진행 상황에 따라 사업의 절차, 구조, 일정 등을 언제든지 변경, 취소 또는 중단할 수 있는 권리를 가집니다.<br />
                                            이와 관련하여 회사는 잠재적 투자자나 이용자에게 어떠한 법적 의무를 부담하지 않으며, 이용자는 이에 대해 이의를 제기할 수 없습니다.
                                        </li>
                                        <li className="pl-1">
                                            <strong className="block font-bold mb-1">기타 법적 고지</strong>
                                            본 디지털 비전북 및 그에 포함된 정보는 회사의 내부 검토 과정을 거쳐 공식적으로 등록된 법적 문서가 아닙니다.<br />
                                            본 자료는 금융투자회사의 영업 및 업무에 관한 규정에 따른 투자광고에 해당하지 않습니다.
                                        </li>
                                    </ol>
                                </div>
                            ) : (
                                <div className="font-sans text-[13px] md:text-[14px] leading-relaxed font-light break-keep">
                                    <h3 className="text-[18px] md:text-[20px] font-bold mb-6 font-inter tracking-tight">[Disclaimer]</h3>
                                    <p className="mb-6">
                                        This <strong>Digital Vision Book (iotaseoul.site)</strong> has been produced by IGIS Asset Management Co., Ltd. (hereinafter referred to as the "Company") based on relevant information and publicly available data to facilitate an understanding of the project. Please be advised of the following precautions when using this material:
                                    </p>

                                    <ol className="list-decimal pl-5 space-y-5">
                                        <li className="pl-1">
                                            <strong className="block font-bold mb-1">Purpose and Nature of Information</strong>
                                            This digital vision book is not a prospectus, product description, or formal Information Memorandum (IM), and its purpose is solely to provide information for general reference regarding the project.<br />
                                            This material is not prepared as a basis for users' investment decisions and may not be used for investment solicitation or advisory purposes under any circumstances.
                                        </li>
                                        <li className="pl-1">
                                            <strong className="block font-bold mb-1">Accuracy and Completeness of Information</strong>
                                            The renderings, design specifications, numerical data, and detailed plans (IOTA Details) presented in this material are examples based on current business plans and are subject to change without prior notice depending on licensing conditions and changes in the business environment during actual construction.<br />
                                            The Company makes no express or implied representations or warranties regarding the accuracy, completeness, or suitability of the information contained herein.
                                        </li>
                                        <li className="pl-1">
                                            <strong className="block font-bold mb-1">User's Responsibility and Professional Advice</strong>
                                            Users must seek their own independent professional advice and rely on their own judgment when evaluating the information contained in this material.<br />
                                            The Company and its employees shall assume no legal liability whatsoever for any decisions made based on or utilizing the information provided in or in connection with this material.
                                        </li>
                                        <li className="pl-1">
                                            <strong className="block font-bold mb-1">Rights and Cancellation of Business Procedures</strong>
                                            The Company reserves the right to modify, cancel, or suspend the procedures, structure, and schedule of the business at any time depending on the progress of the project.<br />
                                            The Company owes no legal obligations to potential investors or users in this regard, and users may not raise any objections.
                                        </li>
                                        <li className="pl-1">
                                            <strong className="block font-bold mb-1">Other Legal Notices</strong>
                                            This digital vision book and the information contained herein are not officially registered legal documents that have undergone the Company's internal review process.<br />
                                            This material does not constitute an investment advertisement in accordance with the regulations concerning the business and operations of financial investment companies.
                                        </li>
                                    </ol>
                                </div>
                            )
                        )}

                        {(modalType === 'privacy' || modalType === 'terms') && (
                            <div className="font-sans text-[13px] md:text-[14px] leading-relaxed font-light whitespace-pre-line break-keep">
                                {lang === 'kr'
                                    ? (modalType === 'privacy' ? privacyTextKr : termsTextKr)
                                    : (modalType === 'privacy' ? privacyTextEn : termsTextEn)}
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
