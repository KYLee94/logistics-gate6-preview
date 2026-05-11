const fs = require('fs');
const filePath = '/Users/jkjeon2025/Documents/GitHub/IGIS Fund Production DP/src/components/system/workspace/WorkspaceActivityLog.jsx';
let content = fs.readFileSync(filePath, 'utf8');

// The original line: {filterCell ? filterCell.replace(/-(LFC|DSC|EMC|SSC|KAM)$/, '') : '기능셀'}
content = content.replace(
    "{filterCell ? filterCell.replace(/-(LFC|DSC|EMC|SSC|KAM)$/, '') : '기능셀'}",
    "'기능셀'"
);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Header text unified to 기능셀');
