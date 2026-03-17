import React from 'react';
import { useLanguage } from '../context/LanguageContext';

export default function SectionHotel() {
    const { lang } = useLanguage();

    return (
        <section className="section w-full h-auto bg-white pt-[100px] md:pt-[150px] pb-[100px] md:pb-[150px]" id="section-hotel">
            <div className="w-[calc(100%-48px)] md:w-[calc(100%-100px)] max-w-[1600px] mx-auto">
                <div className="flex flex-col-reverse md:flex-row justify-between items-start md:items-end mb-10 md:mb-14 gap-8 md:gap-0">
                    <div className="flex-1 w-full max-w-[1100px] bs-fade-up">
                        <h2 className="text-[38px] md:text-[52px] font-inter font-thin text-black tracking-[-0.03em] leading-tight mb-8 break-keep">
                            Upper Luxury Hospitality Meets the Workplace
                        </h2>

                        {lang === 'kr' ? (
                            <>
                                <h3 className="text-[19px] md:text-[22px] font-bold text-[#8a5d4a] tracking-[-0.01em] mb-4 break-keep">
                                    세계에서 가장 럭셔리한 호텔 브랜드 '리츠칼튼 서울' 입점
                                </h3>
                                <div className="text-[16px] md:text-[18px] xl:text-[19px] font-semibold text-black leading-[1.57] tracking-[-0.02em] break-keep">
                                    <p>
                                        이오타서울 오피스 입주사와 임직원들은 호텔 컨시어지 서비스를 기반으로 웰니스 라운지, 프라이빗 비즈니스 라운지, 예약형 회의실, 리프레시 공간 등<br className="hidden xl:block" />리츠칼튼의 서비스 노하우가 녹아든 어메니티를 일상적으로 누리게 됩니다.
                                    </p>
                                </div>
                            </>
                        ) : (
                            <>
                                <h3 className="text-[19px] md:text-[22px] font-bold text-[#8a5d4a] tracking-[-0.01em] mb-4 font-inter">
                                    Grand Opening is IOTA : The Ritz-Carlton - where World-Class Luxury Arrives
                                </h3>
                                <div className="text-[16px] md:text-[18px] xl:text-[19px] font-light text-black leading-[1.57] tracking-[-0.02em] font-inter">
                                    <p>
                                        Tenants and their employees will enjoy daily access to amenities infused with The Ritz-Carlton's signature service philosophy—including hotel-style concierge services,<br className="hidden xl:block" />a wellness lounge, private business lounges, reservable meeting rooms, and refresh zones.
                                    </p>
                                </div>
                            </>
                        )}
                    </div>

                    {/* Logo Area */}
                    <div className="w-full md:w-auto flex justify-center md:justify-end bs-fade-up delay-200">
                        <img src="./img/logo_ritzcarlton.png" width="432" height="304" alt="The Ritz-Carlton Logo" className="w-[120px] md:w-[160px] object-contain" />
                    </div>
                </div>

                {/* Main Image Area */}
                <div className="w-full relative overflow-hidden group bs-fade-up delay-300">
                    <img
                        src="./img/ritzcarlton01.jpg"
                        alt="The Ritz-Carlton Residence"
                        width="2500" height="1090"
                        className="w-full aspect-square md:aspect-auto md:h-auto object-cover block transform transition-transform duration-[2s] group-hover:scale-105"
                    />
                    <div className="absolute bottom-2 right-4 md:bottom-4 md:right-4 z-10 text-[6px] md:text-[10px] text-white/90 font-inter tracking-[0.1em] text-right font-light drop-shadow-md">
                        THE RITZ-CARLTON, FUKUOKA (ritzcarlton.com)
                    </div>
                </div>

                {/* Second Image Area */}
                <div className="w-full mt-[80px] md:mt-[120px] relative group bs-fade-up">
                    <div className="w-full overflow-hidden">
                        <img
                            src="./img/ritzcarlton02.jpg"
                            alt="The Ritz-Carlton Philadelphia"
                            width="3000" height="1202"
                            className="w-full aspect-square md:aspect-auto md:h-auto object-cover block transform transition-transform duration-[2s] group-hover:scale-[1.03]"
                        />
                    </div>
                    <div className="text-right mt-3 text-[9px] md:text-[11px] text-gray-500 font-inter tracking-[0.05em] font-light">
                        THE RITZ-CARLTON, PHILADELPHIA (ritzcarlton.com)
                    </div>
                </div>

                {/* Second Text Area */}
                <div className="w-full mt-16 md:mt-20 flex flex-col items-center bs-fade-up">
                    <img src="./img/logo_ritzcarlton.png" width="432" height="304" alt="The Ritz-Carlton Logo" className="w-[120px] md:w-[160px] mb-12 md:mb-16 object-contain" />

                    <div className="w-full flex flex-col lg:flex-row justify-between items-start gap-8 md:gap-16">
                        {lang === 'kr' ? (
                            <>
                                {/* Left: Title */}
                                <div className="w-full lg:w-[32%] shrink-0">
                                    <h3 className="text-[20px] md:text-[24px] font-bold text-gray-800 tracking-[-0.03em] leading-tight break-keep">
                                        리츠칼튼 서울,<br />
                                        도시의 정점을 정의하는 호텔
                                    </h3>
                                </div>
                                {/* Right: Description */}
                                <div className="w-full lg:w-[68%] text-[19px] md:text-[21px] font-semibold text-black leading-[1.57] tracking-[-0.02em] break-keep">
                                    <p className="mb-5">
                                        IOTA 서울에 입점하는 리츠칼튼 서울은 세계 최고의 럭셔리 호텔 브랜드로서 130여 년 간의 유산과 정교한 서비스 문화를 바탕으로, 서울의 새로운 도심 아이콘으로 자리할 것입니다.<br />
                                        리츠칼튼은 "삶의 가장 의미 있는 여정을 영감으로 이끈다"는 브랜드 비전 아래, 탁월한 서비스 표준(Gold Standards)과 글로벌 네트워크를 통해 IOTA 서울을 단순한 호텔 그 이상으로 격상시킵니다.
                                    </p>
                                    <p>
                                        IOTA 서울의 리츠칼튼은 비즈니스와 라이프스타일, 로컬 문화와 글로벌 에스프리트가 교차하는 도시의 정점에서, 서울을 대표하는 럭셔리 경험의 기준점을 제시합니다.
                                    </p>
                                </div>
                            </>
                        ) : (
                            <>
                                {/* Left: Title */}
                                <div className="w-full lg:w-[32%] shrink-0">
                                    <h3 className="text-[20px] md:text-[24px] font-bold text-gray-800 tracking-[-0.01em] leading-tight font-inter">
                                        The Ritz-Carlton Seoul,<br />
                                        Defining the Pinnacle of Urban Luxury
                                    </h3>
                                </div>
                                {/* Right: Description */}
                                <div className="w-full lg:w-[68%] text-[19px] md:text-[21px] font-light text-black leading-[1.57] tracking-[-0.02em] font-inter">
                                    <p className="mb-5">
                                        Located within IOTA Seoul, The Ritz-Carlton Seoul embodies over a century of heritage and the legendary service culture that has defined <strong className="font-semibold">the world's most respected luxury hospitality brand</strong>. Guided by its vision to "Inspire Life's Most Meaningful Journeys," The Ritz-Carlton transforms IOTA Seoul into more than a hotel — a symbolic urban landmark representing Korean craftsmanship and global excellence.
                                    </p>
                                    <p>
                                        At the intersection of business and culture, The Ritz-Carlton Seoul sets a new benchmark for refined urban living and defines the pinnacle of luxury in the heart of the city.
                                    </p>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </section>
    );
}
