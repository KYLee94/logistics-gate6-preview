const fs = require('fs');

// Patch DecisionLog.jsx
let dlPath = 'src/components/system/DecisionLog.jsx';
let dlContent = fs.readFileSync(dlPath, 'utf8');

dlContent = dlContent.replace(
    /workspaceLabel="의사결정 로그"\n\s*\/>/,
    'workspaceLabel="의사결정 로그"\n                            defaultExpanded={true}\n                        />'
);

fs.writeFileSync(dlPath, dlContent, 'utf8');
