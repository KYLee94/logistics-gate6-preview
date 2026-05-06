const fs = require('fs');

// --- 1. Patch LogWriteBox.jsx ---
const boxPath = 'src/components/system/LogWriteBox.jsx';
let boxContent = fs.readFileSync(boxPath, 'utf8');

if (!boxContent.includes('framer-motion')) {
    boxContent = boxContent.replace(
        "import { supabase } from '../../utils/supabaseClient';",
        "import { supabase } from '../../utils/supabaseClient';\nimport { motion, AnimatePresence } from 'framer-motion';"
    );
}

if (!boxContent.includes('const [isExpanded')) {
    boxContent = boxContent.replace(
        "const [content, setContent] = useState('');",
        "const [content, setContent] = useState('');\n    const [isExpanded, setIsExpanded] = useState(false);"
    );
}

// Add '글작성하기' button in the header
const datePickerStr = `className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"\n                        />\n                    </label>`;
if (!boxContent.includes("isExpanded ? '접기' : '글작성하기'")) {
    const newButtonStr = `className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"\n                        />\n                    </label>\n                    <div className="w-px h-[14px] bg-[#333] mx-[4px]"></div>\n                    <div className="rounded-[8px] p-[1px] bg-gradient-to-br from-[#d6efe9] via-[#82afb9] to-[#4c6e86]">\n                        <button\n                            type="button"\n                            onClick={() => setIsExpanded(!isExpanded)}\n                            className="flex items-center px-[12px] py-[6px] rounded-[7px] text-[12px] font-bold cursor-pointer transition-colors bg-[#222] text-[#E5E5E5] hover:bg-[#333]"\n                        >\n                            {isExpanded ? '접기' : '글작성하기'}\n                        </button>\n                    </div>`;
    boxContent = boxContent.replace(datePickerStr, newButtonStr);
}

// Wrap body with AnimatePresence
const textAreaStart = boxContent.indexOf('{/* Text Area */}');
const modalsStart = boxContent.indexOf('{/* Modals */}');

if (textAreaStart > -1 && modalsStart > -1 && !boxContent.includes('<AnimatePresence>')) {
    const beforeModals = boxContent.substring(0, modalsStart);
    const lastDivIndex = beforeModals.lastIndexOf('</div>'); 
    
    const bodyStr = boxContent.substring(textAreaStart, lastDivIndex);
    
    const wrappedBody = `
                <AnimatePresence>
                    {isExpanded && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2, ease: "easeInOut" }}
                            className="overflow-hidden w-full flex flex-col"
                        >
${bodyStr}
                        </motion.div>
                    )}
                </AnimatePresence>
            `;
            
    boxContent = boxContent.substring(0, textAreaStart) + wrappedBody + boxContent.substring(lastDivIndex);
}
// Automatically close after successful submit
boxContent = boxContent.replace(
    "setShowSuccessModal(true);",
    "setShowSuccessModal(true);\n            setIsExpanded(false);"
);

fs.writeFileSync(boxPath, boxContent, 'utf8');

// --- 2. Patch DecisionLog.jsx ---
const dlPath = 'src/components/system/DecisionLog.jsx';
let dlContent = fs.readFileSync(dlPath, 'utf8');

// Remove showWriteBox state
dlContent = dlContent.replace(/const \[showWriteBox, setShowWriteBox\] = useState\(false\);\n/, '');

// Remove AnimatePresence around LogWriteBox and make it unconditional
const animateRegex = /<AnimatePresence>\s*\{showWriteBox && \(\s*<motion\.div[^>]*>\s*<LogWriteBox([\s\S]*?)\/>\s*<\/motion\.div>\s*\)\}\s*<\/AnimatePresence>/;
const match = dlContent.match(animateRegex);
if (match) {
    dlContent = dlContent.replace(animateRegex, `<div className="w-full mb-[20px]">\n                <LogWriteBox${match[1]}/>\n            </div>`);
}

// Remove 글작성하기 button from DecisionLog header
const dlButtonRegex = /\{\/\* Write Log Toggle \*\/\}\s*<div className="rounded-\[8px\] p-\[1px\] bg-gradient-to-br from-\[#d6efe9\] via-\[#82afb9\] to-\[#4c6e86\]">\s*<button\s*onClick=\{[^}]+\}\s*className="[^"]+"\s*>\s*글작성하기\s*<\/button>\s*<\/div>/;
dlContent = dlContent.replace(dlButtonRegex, '');

fs.writeFileSync(dlPath, dlContent, 'utf8');

