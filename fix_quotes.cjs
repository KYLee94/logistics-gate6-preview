const fs = require('fs');
const filePath = '/Users/jkjeon2025/Documents/GitHub/IGIS Fund Production DP/src/components/system/workspace/WorkspaceActivityLog.jsx';
let content = fs.readFileSync(filePath, 'utf8');

// Replace the literal string with quotes to just the word
content = content.replace(
    "<div className=\"text-[13px] font-bold text-[#86868B] px-[2px] py-[4px] text-center w-[60px]\">\n                                    '기능셀'\n                                </div>",
    "<div className=\"text-[13px] font-bold text-[#86868B] px-[2px] py-[4px] text-center w-[60px]\">\n                                    기능셀\n                                </div>"
);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Quotes removed');
