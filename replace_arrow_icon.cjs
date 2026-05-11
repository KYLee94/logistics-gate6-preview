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

const replacement = `지난 테스크 보기
                        <svg className="w-[14px] h-[14px] ml-[2px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>`;

for (const file of files) {
    const filePath = path.join(dir, file);
    let content = fs.readFileSync(filePath, 'utf8');

    // Find "지난 테스크 보기 ↗" and replace it
    if (content.includes('지난 테스크 보기 ↗')) {
        content = content.replace('지난 테스크 보기 ↗', replacement);
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`Replaced icon in ${file}`);
    } else {
        console.log(`Not found in ${file}`);
    }
}
