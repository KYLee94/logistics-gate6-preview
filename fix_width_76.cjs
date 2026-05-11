const fs = require('fs');
const filePath = '/Users/jkjeon2025/Documents/GitHub/IGIS Fund Production DP/src/components/system/workspace/WorkspaceArchive.jsx';
let content = fs.readFileSync(filePath, 'utf8');

// 1. Zoom 79% to 76%
content = content.replace('zoom: 0.79;', 'zoom: 0.76;');

// 2. Next Action width increase (+5%)
// Change JSX left side
content = content.replace(
    '<div className="w-[65%] shrink-0 flex flex-col gap-[2px] border-r border-[#444]/50 pr-8">',
    '<div className="w-[60%] shrink-0 flex flex-col gap-[2px] border-r border-[#444]/50 pr-8">'
);

// Change JSX right side (Next Action)
content = content.replace(
    '<div className="w-[35%] pl-4">',
    '<div className="w-[40%] pl-4">'
);

// Change print CSS left side rule
content = content.replace(
    '.w-\\[65\\%\\] { border-right: 1px solid #e5e7eb !important; padding-right: 24px !important; }',
    '.w-\\[60\\%\\] { border-right: 1px solid #e5e7eb !important; padding-right: 24px !important; }'
);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Archive zoom 76% and next action width 40% patched');
