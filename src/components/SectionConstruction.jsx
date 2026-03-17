import React from 'react';
import { useLanguage } from '../context/LanguageContext';

export default function SectionConstruction() {
    const { lang } = useLanguage();

    return (
        <section className="section w-full h-auto bg-black" id="section-construction">

            {/* Desktop / Large Screens Layout (lg and above) */}
            <div className="hidden lg:block relative w-full h-[100vh] min-h-[900px] max-h-[1400px]">
                {/* Background Image */}
                <div
                    className="absolute inset-0 w-full h-full bg-cover bg-left md:bg-center"
                    style={{ backgroundImage: "url('./img/samsung_cnt.jpg')" }}
                ></div>

                {/* Image Source */}
                <div className="absolute bottom-6 right-8 md:right-[5%] xl:right-[10%] z-20 text-[10px] text-gray-500/80 font-light tracking-tight pointer-events-none">
                    {lang === 'kr' ? "사우디 Tadawul Tower(삼성물산 시공)" : "Saudi Tadawul Tower (Constructed by Samsung C&T)"}
                </div>

                {/* Text Overlay Box (Right side) */}
                <div className="absolute right-0 top-0 bottom-0 w-[55%] flex flex-col justify-center pr-[5%] xl:pr-[10%] pl-8 z-10">
                    <div className="w-full max-w-[800px] bs-fade-up delay-100">
                        <h2 className="text-[36px] xl:text-[46px] font-bold text-black tracking-[-0.03em] leading-tight mb-6 font-inter break-keep">
                            Global Top-Tier<br />Construction Company
                        </h2>

                        {lang === 'kr' ? (
                            <>
                                <h3 className="text-[18px] xl:text-[22px] font-bold text-black tracking-[-0.01em] mb-6 break-keep">
                                    국내 최상위 시공사 현대건설과 삼성물산의 시공
                                </h3>
                                <div className="text-[14px] xl:text-[17px] font-semibold text-gray-900 leading-[1.57] tracking-[-0.02em] break-keep mb-10 w-[90%]">
                                    <p className="mb-4">
                                        세계적인 랜드마크 프로젝트를 성공적으로 수행해 온 국내 최고 건설사인 현대건설과 삼성물산의 참여는, IOTA 서울을 단순한 오피스 복합시설을 넘어서는 상징적 자산으로 격상시킵니다.
                                    </p>
                                    <p>
                                        한국 건설 기술과 엔지니어링의 정점을 상징하는 자산으로, 세계적 건축가의 비전을 실현할 수 있는 검증된 파트너십을 기반으로 최고 수준의 품질, 안전성, 정밀도를 보장하며 진정한 트로피 빌딩을 구현합니다.
                                    </p>
                                </div>
                            </>
                        ) : (
                            <>
                                <h3 className="text-[18px] xl:text-[22px] font-bold text-black tracking-[-0.02em] mb-6 font-inter leading-snug">
                                    Construction by Korea's Top-ranked Contractor :<br />Hyundai E&C, Samsung C&T
                                </h3>
                                <div className="text-[14px] xl:text-[17px] font-light text-gray-900 leading-[1.57] tracking-[-0.01em] font-inter mb-10 w-[90%]">
                                    <p className="mb-4">
                                        The involvement of Korea's two most prestigious construction firms — Hyundai Engineering & Construction and Samsung Construction & Trading — both renowned for delivering landmark projects worldwide, positions IOTA Seoul as more than just an office complex.
                                    </p>
                                    <p className="mb-4">
                                        It stands as a symbolic asset representing the pinnacle of Korean engineering and construction excellence.
                                    </p>
                                    <p>
                                        As trusted partners capable of realizing the vision of world-class architects, Hyundai E&C and Samsung C&T ensure unmatched quality, safety, and precision, bringing to life a truly iconic trophy building that redefines Seoul's skyline.
                                    </p>
                                </div>
                            </>
                        )}

                        {/* overlay image layer */}
                        <div className="w-full mt-2 bs-fade-up delay-300">
                            <img src="./img/hyundai&samsung.png" width="1201" height="614" alt="Hyundai & Samsung Logos and Ranking" className="w-[100%] max-w-[700px] h-auto object-contain block" />
                        </div>
                    </div>
                </div>
            </div>


            {/* Mobile / Tablet Layout (below lg) */}
            <div className="block lg:hidden w-full flex flex-col pb-[100px] bg-white">
                {/* Image Section */}
                <div className="w-full h-[55vh] min-h-[400px] relative shrink-0">
                    <img src="./img/samsung_cnt.jpg" width="3000" height="1984" alt="Construction Background" className="absolute inset-0 w-full h-full object-cover object-bottom" />

                    {/* Image Source */}
                    <div className="absolute bottom-3 right-4 z-20 text-[10px] text-gray-500/80 font-light tracking-tight pointer-events-none">
                        {lang === 'kr' ? "사우디 Tadawul Tower(삼성물산 시공)" : "Saudi Tadawul Tower (Constructed by Samsung C&T)"}
                    </div>
                </div>

                {/* Text Section */}
                <div className="w-full px-6 pt-[60px] flex flex-col bs-fade-up bg-white">
                    <div className="w-full max-w-[1000px] mx-auto text-center md:text-left">
                        <h2 className="text-[32px] md:text-[42px] font-bold text-black tracking-[-0.03em] leading-tight mb-6 font-inter break-keep">
                            Global Top-Tier<br />Construction Company
                        </h2>

                        {lang === 'kr' ? (
                            <>
                                <h3 className="text-[17px] md:text-[20px] font-bold text-black tracking-[-0.01em] mb-6 break-keep">
                                    국내 최상위 시공사 현대건설과 삼성물산의 시공
                                </h3>
                                <div className="text-[17px] md:text-[19px] font-light text-black leading-[1.57] tracking-[-0.02em] break-keep mb-10 text-left">
                                    <p className="mb-4">
                                        세계적인 랜드마크 프로젝트를 성공적으로 수행해 온 국내 최고 건설사인 현대건설과 삼성물산의 참여는, IOTA 서울을 단순한 오피스 복합시설을 넘어서는 상징적 자산으로 격상시킵니다.
                                    </p>
                                    <p>
                                        한국 건설 기술과 엔지니어링의 정점을 상징하는 자산으로, 세계적 건축가의 비전을 실현할 수 있는 검증된 파트너십을 기반으로 최고 수준의 품질, 안전성, 정밀도를 보장하며 진정한 트로피 빌딩을 구현합니다.
                                    </p>
                                </div>
                            </>
                        ) : (
                            <>
                                <h3 className="text-[17px] md:text-[20px] font-bold text-black tracking-[-0.02em] mb-6 font-inter leading-snug">
                                    Construction by Korea's Top-ranked Contractor :<br />Hyundai E&C, Samsung C&T
                                </h3>
                                <div className="text-[17px] md:text-[19px] font-light text-black leading-[1.57] tracking-[-0.02em] font-inter mb-10 text-left">
                                    <p className="mb-4">
                                        The involvement of Korea's two most prestigious construction firms — Hyundai Engineering & Construction and Samsung Construction & Trading — both renowned for delivering landmark projects worldwide, positions IOTA Seoul as more than just an office complex.
                                    </p>
                                    <p className="mb-4">
                                        It stands as a symbolic asset representing the pinnacle of Korean engineering and construction excellence.
                                    </p>
                                    <p>
                                        As trusted partners capable of realizing the vision of world-class architects, Hyundai E&C and Samsung C&T ensure unmatched quality, safety, and precision, bringing to life a truly iconic trophy building that redefines Seoul's skyline.
                                    </p>
                                </div>
                            </>
                        )}

                        {/* overlay image layer */}
                        <div className="w-full mx-auto mt-4 bs-fade-up">
                            <img src="./img/hyundai&samsung.png" width="1201" height="614" alt="Hyundai & Samsung Logos and Ranking" className="w-full h-auto object-contain block mx-auto" />
                        </div>
                    </div>
                </div>
            </div>



        </section>
    );
}
