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

    // Extract the a tag exactly as it is now
    const aTagRegex = /(<a href=\{`[^`]+`\}.*?>\s*지난 테스크 보기 ↗\s*<\/a>)/s;
    const match = content.match(aTagRegex);

    if (match) {
        let aTag = match[1];
        
        // Remove from current position (it's right after `<div className="flex gap-2 items-center">\n                    `)
        // The safest way is to just replace the matched string with empty string
        content = content.replace(aTag, '');
        
        // Update its classes: add ml-[18px] mt-[2px], remove mr-[4px]
        aTag = aTag.replace('mr-[4px]', 'ml-[18px] mt-[2px]');
        
        // Find </h2> and insert right after it
        content = content.replace('</h2>', '</h2>\n                    ' + aTag);
        
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`Reverted and adjusted in ${file}`);
    } else {
        console.log(`<a> tag not found in ${file}`);
    }
}
