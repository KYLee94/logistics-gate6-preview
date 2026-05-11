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

    // Find the link with gap-1 and replace with gap-[3px]
    if (content.includes('flex items-center gap-1 cursor-pointer')) {
        content = content.replace('flex items-center gap-1 cursor-pointer', 'flex items-center gap-[3px] cursor-pointer');
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`Updated gap in ${file}`);
    }
}
