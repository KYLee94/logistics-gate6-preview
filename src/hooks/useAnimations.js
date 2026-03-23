import { useEffect } from 'react';

export function useAnimations(currentPage) {
    useEffect(() => {
        const header = document.getElementById("main-header");
        const scrollContainer = document.getElementById("scroll-container");
        const scrollArrow = document.getElementById("scroll-arrow");
        let lastScrollTop = 0;
        let scrollHideThreshold = 0;

        if (scrollArrow) {
            setTimeout(() => {
                scrollArrow.classList.remove('opacity-0');
            }, 2000);
        }

        const updateScrollbarWidth = () => {
            if (scrollContainer) {
                const scrollbarWidth = window.innerWidth - scrollContainer.clientWidth;
                document.documentElement.style.setProperty('--scrollbar-width', `${scrollbarWidth}px`);
            }
        };
        updateScrollbarWidth();
        window.addEventListener('resize', updateScrollbarWidth);

        const handleScroll = () => {
            if (!scrollContainer || !header) return;
            let st = window.scrollY || document.documentElement.scrollTop;

            // Header visibility
            if (window.isNewsPage || window.isLeasePage) {
                header.style.transform = "translateY(0)";
                header.style.transitionDuration = "200ms";
            } else if (window.isNavigating) {
                lastScrollTop = st;
                scrollHideThreshold = st + 150;
            } else {
                header.style.transform = "translateY(0)";
                lastScrollTop = st;
            }

            // Reliable Scroll Tracking for SYBD
            const sArea = document.getElementById('sybd-scroll-area');
            const step1 = document.getElementById('sybd-step-1');
            const step2 = document.getElementById('sybd-step-2');
            const img3 = document.getElementById('sybd-img-3');
            const img4 = document.getElementById('sybd-img-4');

            if (sArea) {
                const rect = sArea.getBoundingClientRect();
                if (rect.top < - (window.innerHeight * 0.5)) {
                    if (step1 && !step1.classList.contains('up-out')) {
                        step1.classList.remove('active');
                        step1.classList.add('up-out');
                    }
                    if (step2 && !step2.classList.contains('active')) {
                        step2.classList.remove('down-in');
                        step2.classList.add('active');
                        step2.style.pointerEvents = 'auto';
                    }
                    if (img4) img4.style.opacity = '1';
                    if (img3) img3.style.opacity = '0';
                } else {
                    if (step1 && !step1.classList.contains('active')) {
                        step1.classList.remove('up-out');
                        step1.classList.add('active');
                    }
                    if (step2 && !step2.classList.contains('down-in')) {
                        step2.classList.remove('active');
                        step2.classList.add('down-in');
                        step2.style.pointerEvents = 'none';
                    }
                    if (img4) img4.style.opacity = '0';
                    if (img3) img3.style.opacity = '1';
                }
            }

            // Reliable Scroll Tracking for Green Section
            const greenArea = document.getElementById('green-scroll-area');
            const greenImg2 = document.getElementById('green-img-2');

            if (greenArea && greenImg2) {
                const rect = greenArea.getBoundingClientRect();
                if (rect.top < (window.innerHeight * 0.5)) {
                    greenImg2.style.opacity = '1';
                } else {
                    greenImg2.style.opacity = '0';
                }
            }

            // Reliable Scroll Tracking for AI Ready Section
            const applyAiScroll = (areaId, img2Id, img3Id) => {
                const area = document.getElementById(areaId);
                const img2 = document.getElementById(img2Id);
                const img3 = document.getElementById(img3Id);

                if (area && img2 && img3) {
                    const rect = area.getBoundingClientRect();
                    const totalScrollLength = rect.height - window.innerHeight;

                    if (rect.top <= 0 && rect.top >= -totalScrollLength) {
                        const scrollProgress = Math.abs(rect.top) / totalScrollLength;
                        // image 1 -> image 2 -> image 3
                        if (scrollProgress > 0.25) {
                            img2.style.opacity = '1';
                        } else {
                            img2.style.opacity = '0';
                        }
                        if (scrollProgress > 0.6) {
                            img3.style.opacity = '1';
                        } else {
                            img3.style.opacity = '0';
                        }
                    } else if (rect.top > 0) {
                        img2.style.opacity = '0';
                        img3.style.opacity = '0';
                    } else if (rect.top < -totalScrollLength) {
                        img2.style.opacity = '1';
                        img3.style.opacity = '1';
                    }
                }
            };

            applyAiScroll('ai-scroll-area', 'ai-img-2', 'ai-img-3');
            applyAiScroll('ai-scroll-area-m', 'ai-img-m-2', 'ai-img-m-3');
        };

        window.addEventListener("scroll", handleScroll, { passive: true });

        let observer = null;
        let observerTimeout = setTimeout(() => {
            observer = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) entry.target.classList.add('active');
                });
            }, { threshold: 0.1 });

            const targets = document.querySelectorAll("#section3, #section4, #section6, .bs-fade-up, .bs-draw-line, .curtain-container, .bs-scale-up, .bs-slide-left, .bs-slide-right, .bs-bounce-up");
            targets.forEach(el => observer.observe(el));

            // Run handleScroll once manually to trigger immediate classes if needed
            handleScroll();
        }, 150);

        return () => {
            window.removeEventListener('resize', updateScrollbarWidth);
            if (scrollContainer) {
                scrollContainer.removeEventListener('scroll', handleScroll);
            }
            clearTimeout(observerTimeout);
            if (observer) observer.disconnect();
        };
    }, [currentPage]);
}
