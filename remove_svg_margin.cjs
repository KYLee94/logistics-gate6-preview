const fs = require('fs');
const path = require('path');

const dir = '/Users/jkjeon2025/Documents/GitHub/IGIS Fund Production DP/src/components/system/workspace';
const files = [
    'WorkspacePm.jsx',
    'WorkspaceDigital.jsx',
    'WorkspaceMarketing.jsx',
    'WorkspaceFund.jsx',
    'WorkspaceDevelopment.jsx',
    'WorkspaceFinancing.jsx',
    'WorkspaceIpr.jsx'
];

for (const file of files) {
    const filePath = path.join(dir, file);
    let content = fs.readFileSync(filePath, 'utf8');

    // Replace ml-[2px] inside the svg we just inserted
    if (content.includes('className="w-[14px] h-[14px] ml-[2px]"')) {
        content = content.replace('className="w-[14px] h-[14px] ml-[2px]"', 'className="w-[14px] h-[14px]"');
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`Removed ml-[2px] in ${file}`);
    }
}
