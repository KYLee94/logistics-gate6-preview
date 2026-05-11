const fs = require('fs');
const filePath = '/Users/jkjeon2025/Documents/GitHub/IGIS Fund Production DP/src/components/system/workspace/WorkspaceArchive.jsx';
let content = fs.readFileSync(filePath, 'utf8');

const oldCSS = `                @media print {
                    :global(html), :global(body), :global(#root), :global(#scroll-container) { 
                        display: block !important;
                        height: auto !important;
                        overflow: visible !important;
                        -webkit-print-color-adjust: exact !important; 
                        print-color-adjust: exact !important; 
                        background-color: #ffffff !important; 
                        color: #111827 !important;
                        zoom: 0.76;
                    }
                    /* Remove flex from main wrappers to prevent blank first page */
                    :global(.flex.h-screen) { display: block !important; height: auto !important; overflow: visible !important; }
                    :global(.flex-1.flex.flex-col) { display: block !important; height: auto !important; overflow: visible !important; }
                    
                    :global(.h-screen) { height: auto !important; }
                    :global(.overflow-hidden), :global(.overflow-y-auto), :global(.custom-scrollbar) { overflow: visible !important; }
                    :global(.mb-4), :global(.mb-16) { page-break-inside: avoid; margin-bottom: 24px !important; }
                    :global(.border-b) { border-bottom: 1px solid #e5e7eb !important; }
                    /* Layout fixes */
                    :global(.w-\\[60\\%\\]) { border-right: 1px solid #e5e7eb !important; padding-right: 24px !important; }
                    :global(.gap-8) { gap: 24px !important; }
                    :global(.px-12) { padding-left: 0 !important; padding-right: 0 !important; }
                    :global(.py-8) { padding-top: 16px !important; padding-bottom: 16px !important; }
                }`;

const newCSS = `                @media print {
                    html, body, #root, #scroll-container { 
                        display: block !important;
                        height: auto !important;
                        overflow: visible !important;
                        -webkit-print-color-adjust: exact !important; 
                        print-color-adjust: exact !important; 
                        background-color: #ffffff !important; 
                        color: #111827 !important;
                        zoom: 0.76;
                    }
                    /* Remove flex from main wrappers to prevent blank first page */
                    .flex.h-screen, .w-full.h-screen.overflow-hidden { display: block !important; height: auto !important; overflow: visible !important; }
                    .flex-1.flex.flex-col { display: block !important; height: auto !important; overflow: visible !important; }
                    
                    .h-screen { height: auto !important; }
                    .overflow-hidden, .overflow-y-auto, .custom-scrollbar { overflow: visible !important; }
                    .mb-4, .mb-16 { page-break-inside: avoid; margin-bottom: 24px !important; }
                    .border-b { border-bottom: 1px solid #e5e7eb !important; }
                    /* Layout fixes */
                    .w-\\[60\\%\\] { border-right: 1px solid #e5e7eb !important; padding-right: 24px !important; }
                    .gap-8 { gap: 24px !important; }
                    .px-12 { padding-left: 0 !important; padding-right: 0 !important; }
                    .py-8 { padding-top: 16px !important; padding-bottom: 16px !important; }
                }`;

content = content.replace(oldCSS, newCSS);

// Also remove "jsx" attribute just to be clean standard react
content = content.replace('<style jsx>{`', '<style>{`');

fs.writeFileSync(filePath, content, 'utf8');
console.log('Archive print pure CSS patched');
