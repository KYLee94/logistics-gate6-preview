import React, { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';
import openclawImg from '../assets/openclaw.jpg';

export default function Section2({ isActive }) {
    const { lang } = useLanguage();
    const [step, setStep] = useState(0);

    useEffect(() => {
        if (!isActive) {
            setStep(0);
            return;
        }
        
        // Cinematic Sequencing
        const t1 = setTimeout(() => setStep(1), 500);  
        const t2 = setTimeout(() => setStep(2), 1500); 
        const t3 = setTimeout(() => setStep(3), 2500); 
        const t4 = setTimeout(() => setStep(4), 4200); 
        const t5 = setTimeout(() => setStep(5), 5200); 

        return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4); clearTimeout(t5); };
    }, [isActive]);

    return (
        <section className="section w-full h-full bg-white overflow-y-auto relative px-4 flex flex-col">
            <div className="w-full flex flex-col items-center justify-center py-24 md:py-32 my-auto">
                
                <div className="flex flex-col items-start justify-center text-left max-w-[1100px] w-full gap-0 relative border-l-0 pl-0 -translate-y-[20px] md:-translate-y-[30px]">
                    
                    {/* Line 1 */}
                    <div className={`transition-all duration-[1200ms] ease-[cubic-bezier(0.19,1,0.22,1)] mb-[20px] ${step >= 1 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
                        <p className="text-[28px] md:text-[38px] font-bold text-[#666] tracking-tight leading-[1.2]">
                            {lang === 'kr' ? "바깥 세상의 지식만 묻고 답하는 평범한 AI를 넘어," : "Beyond ordinary AI answering worldly knowledge,"}
                        </p>
                    </div>

                    {/* Line 2 */}
                    <div className={`transition-all duration-[1200ms] ease-[cubic-bezier(0.19,1,0.22,1)] mb-[20px] ${step >= 2 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
                        <p className="text-[34px] md:text-[48px] font-bold text-[#1d1d1f] tracking-tight leading-[1.15] break-keep">
                            {lang === 'kr' ? "내 PC 안의 수많은 파일들을 통째로 꿰뚫어 보고 분석하는" : "an AI that penetrates and analyzes all files and documents in your PC,"}
                        </p>
                    </div>

                    {/* Line 3 */}
                    <div className={`transition-all duration-[1200ms] ease-[cubic-bezier(0.19,1,0.22,1)] ${step >= 3 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
                        <p className="text-[34px] md:text-[48px] font-bold text-[#1d1d1f] tracking-tight leading-[1.3] break-keep">
                            <span className="text-[#297cf6]">{lang === 'kr' ? "나만의 전용 AI" : "your own dedicated AI"}</span>
                            {lang === 'kr' ? "가 쏟아낼 압도적인 결과물들을" : " and the overwhelming results it could produce –"}
                            <br />
                            {lang === 'kr' ? "상상해 보신 적 있습니까?" : "have you ever imagined it?"}
                        </p>
                    </div>

                    {/* Sub Text 1 */}
                    <div className={`transition-all duration-[1500ms] ease-[cubic-bezier(0.19,1,0.22,1)] mt-16 md:mt-24 mb-[20px] ${step >= 4 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
                        <p className="text-[20px] md:text-[24px] font-medium text-[#555] tracking-tight border-l-[3px] border-[#297cf6] pl-4 leading-[1.4]">
                            {lang === 'kr' ? "그런 AI들이 이미 개인들에게 사용되어지고 있습니다." : "Such AIs are actually already being utilized by individuals today."}
                        </p>
                    </div>

                    {/* OpenClaw Reveal Box */}
                    <div className={`transition-all duration-[1500ms] ease-[cubic-bezier(0.19,1,0.22,1)] mt-6 w-full ${step >= 5 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
                        <div className="flex flex-col md:flex-row items-start md:items-center gap-6 bg-[#f8f9fa] border border-[#e2e8f0] rounded-2xl p-6 md:px-8 md:py-6 w-full max-w-[950px] shadow-sm hover:shadow-md transition-shadow duration-500">
                            <img src={openclawImg} alt="OpenClaw Logo" className="h-[40px] md:h-[50px] object-contain mix-blend-multiply opacity-90 shrink-0" />
                            <p className="text-[17px] md:text-[19px] text-[#444] leading-[1.6] break-keep font-medium">
                                {lang === 'kr' ? 
                                "오픈클로(OpenClaw)는 내 PC에 직접 설치되어, 로컬 하드디스크의 엑셀, 문서 등 수많은 데이터를 클라우드 유출 없이 스스로 읽고 융합하여 업무를 자율적으로 자동화해 주는 강력한 '로컬 AI 에이전트(Autonomous AI Agent)' 프로덕트입니다." : 
                                "OpenClaw is a powerful autonomous AI agent installed directly on your PC. It securely reads local data like Excel files and documents without cloud leakage to independently automate workflows."}
                            </p>
                        </div>
                    </div>

                </div>
            </div>
        </section>
    );
}
