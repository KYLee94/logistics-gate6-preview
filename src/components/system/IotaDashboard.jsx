export default function IotaDashboard() {
    return (
        <div className="flex-1 h-full bg-transparent flex flex-col relative font-sans text-[#E5E5E5] overflow-hidden">
            <div className="relative z-[100] w-full h-[46px] flex items-end justify-between shrink-0 bg-[#1A1A1A]">
                <div className="flex h-full items-end pl-0">
                    <div className="flex items-center justify-between pl-6 pr-3 h-full cursor-pointer text-[#E5E5E5] bg-[#1F1F1E] relative">
                        <span className="text-[13px] font-medium tracking-wide mr-8">사업 개요</span>
                    </div>
                </div>
                <div className="px-5 h-full flex items-center bg-[#1A1A1A]">
                    <div className="text-[#86868B] hover:text-[#E5E5E5] cursor-pointer tracking-[3px] font-black text-[13px] transition-colors duration-300 pb-[2px] translate-y-[1px] translate-x-0.5">···</div>
                </div>
            </div>
            <div className="flex-1 w-full overflow-y-auto hide-scrollbar" />
        </div>
    );
}
