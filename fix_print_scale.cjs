const fs = require('fs');
const filePath = '/Users/jkjeon2025/Documents/GitHub/IGIS Fund Production DP/src/components/system/workspace/WorkspaceArchive.jsx';
let content = fs.readFileSync(filePath, 'utf8');

const oldPrintCSS = `                @media print {
                    body { 
                        -webkit-print-color-adjust: exact; 
                        print-color-adjust: exact; 
                        background: #ffffff !important; 
                        color: #111827 !important;
                    }
                    .h-screen { height: auto !important; }
                    .overflow-hidden, .overflow-y-auto, .custom-scrollbar { overflow: visible !important; }`;

const newPrintCSS = `                @media print {
                    html, body, #root { 
                        display: block !important;
                        height: auto !important;
                        overflow: visible !important;
                        -webkit-print-color-adjust: exact; 
                        print-color-adjust: exact; 
                        background: #ffffff !important; 
                        color: #111827 !important;
                        zoom: 0.70;
                    }
                    /* Remove flex from main wrappers to prevent blank first page */
                    .flex.h-screen { display: block !important; height: auto !important; overflow: visible !important; }
                    .flex-1.flex.flex-col { display: block !important; height: auto !important; overflow: visible !important; }
                    
                    .h-screen { height: auto !important; }
                    .overflow-hidden, .overflow-y-auto, .custom-scrollbar { overflow: visible !important; }`;

content = content.replace(oldPrintCSS, newPrintCSS);

// Also remove absolute inset-0 from gradient in print to prevent overlay issues
content = content.replace(
    '<div className="absolute inset-0 bg-gradient-to-b from-[#1a1a1a] to-transparent h-[200px] pointer-events-none z-0"></div>',
    '<div className="absolute inset-0 bg-gradient-to-b from-[#1a1a1a] to-transparent h-[200px] pointer-events-none z-0 print:hidden"></div>'
);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Archive print layout fixed');
