const fs = require('fs');
const filePath = '/Users/jkjeon2025/Documents/GitHub/IGIS Fund Production DP/src/components/system/workspace/WorkspaceArchive.jsx';
let content = fs.readFileSync(filePath, 'utf8');

// Replace workspaces array
const workspacesTargetRegex = /const workspaces = \[\s*\{\s*id:\s*'pm',\s*name:\s*'사업 PM'\s*\},[\s\S]*?\];/;
const workspacesReplacement = `const workspaces = [
        { id: 'pm', name: '사업 PM', icon: <svg className="w-[18px] h-[18px] mr-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg> },
        { id: 'financing', name: '파이낸싱-LFC', icon: <svg className="w-[18px] h-[18px] mr-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> },
        { id: 'development', name: '개발솔루션-DSC', icon: <svg className="w-[18px] h-[18px] mr-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><circle cx="12" cy="12" r="3" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" /></svg> },
        { id: 'marketing', name: '기업마케팅-EMC', icon: <svg className="w-[18px] h-[18px] mr-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" /></svg> },
        { id: 'digital', name: '상품·디지털-SSC', icon: <svg className="w-[18px] h-[18px] mr-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg> },
        { id: 'fund', name: '펀드운용-KAM', icon: <svg className="w-[18px] h-[18px] mr-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg> },
        { id: 'ipr', name: 'IPR-WG', icon: <svg className="w-[18px] h-[18px] mr-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg> }
    ];`;

if (workspacesTargetRegex.test(content)) {
    content = content.replace(workspacesTargetRegex, workspacesReplacement);
    console.log('Workspaces array replaced.');
} else {
    console.log('Failed to find workspaces array.');
}

// Replace rendering code
const renderTargetRegex = /<button\s+key=\{ws\.id\}\s+onClick=\{[^}]+\}\s+className=\{`text-left px-3 py-\[6px\] rounded-\[8px\] text-\[14px\] font-bold transition-colors \${workspaceFilter === ws\.id \? 'bg-\[#3c3c3c\] text-white' : 'text-\[#86868B\] hover:text-\[#E5E5E5\] hover:bg-\[#333\]'}`\}\s+>\s+\{ws\.name\}\s+<\/button>/;

const renderReplacement = `<button
                                key={ws.id}
                                onClick={() => setWorkspaceFilter(ws.id)}
                                className={\`flex items-center text-left px-[14px] py-[10px] rounded-[10px] text-[15px] transition-colors \${workspaceFilter === ws.id ? 'bg-[#3c3c3c] text-white font-bold' : 'text-[#E5E5E5] hover:bg-[#333] font-medium'}\`}
                            >
                                {ws.icon}
                                {ws.name}
                            </button>`;

if (renderTargetRegex.test(content)) {
    content = content.replace(renderTargetRegex, renderReplacement);
    console.log('Rendering code replaced.');
} else {
    console.log('Failed to find rendering code.');
}

fs.writeFileSync(filePath, content, 'utf8');

