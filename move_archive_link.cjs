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

    // regex to capture the <a> tag
    // It looks like: <a href={`...`} ... >\n  지난 테스크 보기 ↗\n</a>
    const aTagRegex = /(<a href=\{`[^`]+`\}.*?>\s*지난 테스크 보기 ↗\s*<\/a>)/s;
    const match = content.match(aTagRegex);

    if (match) {
        let aTag = match[1];
        
        // Remove aTag from content
        content = content.replace(aTag, '');
        
        // Adjust classes of aTag
        aTag = aTag.replace('ml-[8px]', 'mr-[4px]');
        aTag = aTag.replace('mt-[2px]', '');
        
        // Find <div className="flex gap-2 items-center">
        // It might be slightly different in each file, but mostly "flex gap-2 items-center" or similar
        // Let's use string replacement
        const targetStr = '<div className="flex gap-2 items-center">';
        if (content.includes(targetStr)) {
            content = content.replace(targetStr, targetStr + '\n                    ' + aTag);
            fs.writeFileSync(filePath, content, 'utf8');
            console.log(`Moved in ${file}`);
        } else {
            console.log(`Target container not found in ${file}`);
        }
    } else {
        console.log(`<a> tag not found in ${file}`);
    }
}
