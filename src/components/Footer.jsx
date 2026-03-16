import React, { useState } from 'react';
import { useLanguage } from '../context/LanguageContext';

export default function Footer({ className = "mt-[100px]", variant = "dark" }) {
    const { lang } = useLanguage();
    const [modalType, setModalType] = useState(null); // 'disclaimer', 'terms', 'privacy', or null

    const isLight = variant === "light";
    const bgColor = isLight ? "bg-white" : "bg-[#2a3134]";
    const textColor = isLight ? "text-[#777]" : "text-white/50";
    const brandColor = isLight ? "text-[#333]" : "text-white/70";
    const copyrightColor = isLight ? "text-[#999]" : "text-white/30";
    const disclaimerColor = isLight ? "text-[#999]" : "text-white/40";
    const modalBgColor = isLight ? "bg-white text-black" : "bg-[#2a3134] text-white";

    const privacyTextKr = `[IOTA SEOUL] 개인정보 처리방침 (Updated 2026.03.11)

1. 개인정보의 수집 및 이용 목적
IOTA SEOUL(이하 "본 서비스")은 다음의 목적을 위해 최소한의 개인정보를 처리합니다.
- 파트너십 제안 접수 및 응대: 신규 서비스, 리테일, 웰니스 프로그램 제휴 등 제안 검토 및 회신
- 임대차 문의 응대: 오피스/리테일 임대차 관련 상담, 제안서 발송 및 의사소통 경로 확보
- 비전북(Vision Book) 제공: 디지털 비전북 다운로드 링크 제공 및 권한 관리

2. 수집하는 개인정보 항목 및 방법
[파트너십 문의] 필수: 회사명, 파트너십 유형, 성명(담당자), 연락처, 이메일, 제안 요약
[자동 수집] 필수: IP 주소, 쿠키, 방문 기록, 기기 정보
- 수집방법: 웹사이트 내 전용 입력 폼(Form)

3. 개인정보의 국외 이전
본 서비스는 글로벌 웹 호스팅 인프라(GitHub Pages)를 활용함에 따라, 수집된 정보가 보안이 강화된 해외 서버(미국, GitHub 및 Google Cloud)에 저장될 수 있음을 고지합니다. 이는 안정적인 서비스 제공 및 데이터 백업을 위한 조치입니다.

4. 개인정보의 처리 위탁
- 수탁업체: GitHub, Inc. / Google / emailjs
- 위탁 업무: 데이터 저장, 웹사이트 호스팅, 방문자 통계 분석 및 데이터베이스 관리

5. 개인정보의 보유 및 이용기간
- 문의 정보: 상담 종료 후 1년 (단, 향후 관련 업무 파트너십 추진을 위해 보관 동의 시 동의 철회 시까지 보관)
- 웹사이트 방문 기록: 통신비밀보호법에 의거하여 3개월

6. 개인정보의 파기절차 및 방법
이용 목적이 달성된 개인정보는 즉시 파기함을 원칙으로 합니다. 전자적 파일은 복원이 불가능한 기술적 방법으로 영구 삭제하며, 출력물은 파쇄 또는 소각 처리합니다.

7. 데이터 보안 및 관리 대책
모든 데이터는 HTTPS(SSL) 암호화 구간을 통해 전송되어 탈취를 방지합니다. 관리적 조치로서 접근 권한을 제한합니다.

8. 개인정보 보호책임자 및 담당부서
- 이메일: IOTATF_Team@igisam.com`;

    const privacyTextEn = `[IOTA SEOUL] Privacy Policy (Updated Mar 11, 2026)

1. Purpose of Collection and Use of Personal Information
IOTA SEOUL processes the minimum personal information necessary for the following purposes:
- Partnership Proposal Review & Response
- Vision Book Download & Lease Inquiry
- General Communication

2. Items and Methods of Personal Information Collection
[Partnership Inquiry] Req: Company Name, Type of Partnership, Name, Contact, Email, Proposal Summary
[Auto] Req: IP, Cookies, Device Info
- Method: Website Inquiry Forms

3. Cross-Border Data Transfer
Due to global hosting, data may be securely stored in overseas servers.

4. Consignment of Personal Information Processing
- Consignee: GitHub, Inc. / Google / emailjs
- Task: Database storage, hoisting, analytics.

5. Retention Period
- Inquiry details: 1 year after consultation ends.
- Traffic data: 3 months under the Protection of Communications Secrets Act.

6. Destruction Procedure
Information is destroyed permanently via irreversible technical methods immediately after its purpose is fulfilled.

7. Data Security
All data is encrypted via HTTPS(SSL).

8. Privacy Officer
- Email: IOTATF_Team@igisam.com`;

    const termsTextKr = `[IOTA SEOUL] 이용약관

1. 목적
본 약관은 이지스자산운용 주식회사(이하 "회사")가 제공하는 IOTA SEOUL 웹사이트(이하 "서비스")의 이용과 관련하여 회사와 이용자의 권리, 의무 및 책임사항, 기타 필요한 사항을 규정함을 목적으로 합니다.

2. 약관의 효력 및 변경
① 본 약관은 서비스를 이용하고자 하는 모든 이용자에게 효력을 발생합니다.
② 회사는 필요한 경우 관련 법령을 위배하지 않는 범위 내에서 본 약관을 개정할 수 있으며, 개정된 약관은 서비스 내에 공지함으로써 효력이 발생합니다.

3. 서비스의 제공 및 변경
① 회사는 이용자에게 프로젝트의 정보 제공, 파트너십 문의 및 임대차 문의 등의 서비스를 제공합니다.
② 회사는 운영상, 기술상의 필요에 따라 제공하고 있는 서비스의 전부 또는 일부를 변경하거나 중단할 수 있습니다.

4. 이용자의 의무
① 이용자는 본 약관 및 관련 법령, 회사가 고지하는 주의사항을 준수하여야 합니다.
② 이용자는 서비스를 이용하여 얻은 정보를 회사의 사전 승낙 없이 복제, 유통, 상업적 이용할 수 없습니다.

5. 지식재산권
서비스 내에 게시된 모든 정보, 이미지, 디자인 및 텍스트 등에 대한 저작권 및 지식재산권은 회사에 귀속됩니다.

6. 면책조항
① 회사는 천재지변, 서비스 점검, 통신 장애 등 불가항력적인 사유로 서비스를 제공할 수 없는 경우에는 서비스 제공에 대한 책임이 면제됩니다.
② 회사는 이용자가 서비스를 이용하여 기대하는 수익을 상실한 것에 대하여 책임을 지지 않으며, 서비스 내의 정보에 의존하여 얻은 불이익에 대하여 책임을 지지 않습니다.

7. 준거법 및 재판관할
본 약관의 해석 및 회사와 이용자 간의 분쟁에 대하여는 대한민국의 법률을 적용하며, 분쟁이 발생할 경우 서울중앙지방법원을 관할법원으로 합니다.`;

    const termsTextEn = `[IOTA SEOUL] Terms of Service

1. Purpose
These terms and conditions aim to stipulate the rights, obligations, and responsibilities of IGIS Asset Management Co., Ltd. (the "Company") and the users in connection with the use of the IOTA SEOUL website (the "Service") provided by the Company.

2. Effect and Amendment of Terms
① These terms shall be effective for all users who wish to use the Service.
② The Company may amend these terms within the scope not violating relevant laws if necessary, and the amended terms will take effect when announced within the Service.

3. Provision and Modification of Service
① The Company provides users with services such as project information, partnership inquiries, and lease inquiries.
② The Company may change or suspend all or part of the Service provided according to operational or technical needs.

4. Obligations of Users
① Users must comply with these terms, related laws, and the precautions notified by the Company.
② Users may not copy, distribute, or commercially use the information obtained through the Service without the Company's prior consent.

5. Intellectual Property Rights
Copyrights and intellectual property rights for all information, images, designs, and texts posted within the Service belong to the Company.

6. Disclaimer
① The Company shall be exempted from liability for service provision if it cannot provide the Service due to force majeure events such as natural disasters, service inspections, or communication failures.
② The Company shall not be held liable for any loss of expected revenue by a user utilizing the Service or any disadvantages obtained by relying on the information within the Service.

7. Governing Law and Jurisdiction
The interpretation of these terms and any disputes between the Company and users shall be governed by the laws of the Republic of Korea, and any such disputes shall be subject to the exclusive jurisdiction of the Seoul Central District Court.`;


    return (
        <div className={`w-full ${bgColor} pt-8 md:pt-12 pb-8 md:pb-12 flex flex-col items-center ${className}`}>
            <footer className={`w-full text-center ${textColor} text-[12px] md:text-[14px] font-inter font-light tracking-[-0.02em] px-4 leading-[1.6] flex flex-col gap-[6px]`}>
                <span className={`block font-bold ${brandColor} tracking-[-0.02em] text-[13px] md:text-[15px]`}>IOTA SEOUL</span>

                {/* Legal Links */}
                <div className={`text-[12px] md:text-[13px] ${disclaimerColor} flex items-center justify-center flex-wrap gap-2 md:gap-3`}>
                    <button
                        onClick={() => setModalType('terms')}
                        className="hover:text-current hover:opacity-80 transition-colors font-bold cursor-pointer text-[#888]"
                    >
                        {lang === 'kr' ? "이용약관" : "Terms of Service"}
                    </button>
                    <span className="opacity-40">|</span>
                    <button
                        onClick={() => setModalType('privacy')}
                        className="hover:text-current hover:opacity-80 transition-colors font-bold cursor-pointer text-[#888]"
                    >
                        {lang === 'kr' ? "개인정보 처리방침" : "Privacy Policy"}
                    </button>
                    <span className="opacity-40">|</span>
                    <button
                        onClick={() => setModalType('disclaimer')}
                        className="hover:text-current hover:opacity-80 transition-colors font-bold cursor-pointer text-[#888]"
                    >
                        {lang === 'kr' ? "면책공고" : "Disclaimer"}
                    </button>
                </div>

                {/* Disclaimer Text */}
                <span className={`block text-[12px] md:text-[13px] ${disclaimerColor} break-keep`}>
                    {lang === 'kr'
                        ? "본 디지털 비전북에 포함된 모든 이미지, 설계 제원 및 프로젝트 상세 계획은 이해를 돕기 위해 제작된 것으로 실제와 다를 수 있습니다."
                        : "All images, design specifications, and detailed project plans included in this digital vision book are intended for illustrative purposes only and may differ from the actual implementation."}
                </span>

                <span className={`block ${copyrightColor} text-[11px] md:text-[13px]`}>© 2026 IOTA SEOUL & IGIS Asset Management. All rights reserved.</span>
            </footer>

            {/* Modal */}
            {modalType && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className={`w-full max-w-2xl max-h-[80vh] overflow-y-auto rounded-xl p-6 md:p-8 ${modalBgColor} shadow-2xl relative text-left`}>
                        <button
                            onClick={() => setModalType(null)}
                            className="absolute top-4 right-4 p-2 opacity-60 hover:opacity-100 transition-opacity"
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
                                className={`px-8 py-2.5 rounded-full font-medium transition-colors ${isLight ? 'bg-black text-white hover:bg-black/80' : 'bg-white text-black hover:bg-white/80'}`}
                            >
                                {lang === 'kr' ? "확인" : "Confirm"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
