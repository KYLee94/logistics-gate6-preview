const fs = require('fs');
const filePath = '/Users/jkjeon2025/Documents/GitHub/IGIS Fund Production DP/src/components/system/workspace/WorkspaceArchive.jsx';
let content = fs.readFileSync(filePath, 'utf8');

// 1. Update Zoom scale
content = content.replace('zoom: 0.84;', 'zoom: 0.79;');

// 2. Center alignment
// Find `<div className="max-w-[1200px]">` and add `print:mx-auto`
content = content.replaceAll(
    '<div className="max-w-[1200px]">',
    '<div className="max-w-[1200px] print:mx-auto">'
);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Archive zoom 79% and center alignment patched');
