const fs = require('fs');
const filePath = '/Users/jkjeon2025/Documents/GitHub/IGIS Fund Production DP/src/components/system/workspace/WorkspaceFinancing.jsx';
let content = fs.readFileSync(filePath, 'utf8');

const target = `<h2 id="task-management" className="text-[18px] font-bold text-white tracking-tight flex items-center">
                        <span className="mt-[2px]">파이낸싱 주요 테스크 관리</span>
                        <span className="bg-[#333] text-[#b3b0a6] px-[8px] py-[3px] rounded-[6px] ml-[8px] font-bold text-[14px]">{getCurrentWeekInfo().weekLabel}</span>
                    </h2>`;

const replacement = `<h2 id="task-management" className="text-[18px] font-bold text-white tracking-tight flex items-center">
                        <span className="mt-[2px]">파이낸싱 주요 테스크 관리</span>
                        <span className="bg-[#333] text-[#b3b0a6] px-[8px] py-[3px] rounded-[6px] ml-[8px] font-bold text-[14px]">{getCurrentWeekInfo().weekLabel}</span>
                    </h2>
                    <a href={\`\${import.meta.env.BASE_URL}platform/iotaseoul/workspace/archive?workspace=financing\`} target="_blank" rel="noopener noreferrer" className="text-[#86868B] hover:text-[#3b82f6] text-[13px] font-bold ml-[18px] mt-[2px] transition-colors flex items-center gap-1 cursor-pointer">
                        지난 테스크 보기
                        <svg className="w-[14px] h-[14px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                    </a>`;

if (content.includes(target)) {
    content = content.replace(target, replacement);
    fs.writeFileSync(filePath, content, 'utf8');
    console.log("Updated WorkspaceFinancing.jsx");
} else {
    console.log("Could not find target in WorkspaceFinancing.jsx");
}
