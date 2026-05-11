const fs = require('fs');
const filePath = '/Users/jkjeon2025/Documents/GitHub/IGIS Fund Production DP/src/components/system/workspace/WorkspaceActivityLog.jsx';
let content = fs.readFileSync(filePath, 'utf8');

// The original line: <div className="text-[12px] font-bold text-[#fbf167] px-[2px] py-[4px] text-center w-[60px]">
content = content.replace(
    '<div className="text-[12px] font-bold text-[#fbf167] px-[2px] py-[4px] text-center w-[60px]">',
    '<div className="text-[13px] font-bold text-[#86868B] px-[2px] py-[4px] text-center w-[60px]">'
);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Yellow header color fixed');
