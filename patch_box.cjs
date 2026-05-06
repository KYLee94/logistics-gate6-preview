const fs = require('fs');
const path = 'src/components/system/LogWriteBox.jsx';
let content = fs.readFileSync(path, 'utf8');

// 1. Add import for framer-motion
if (!content.includes('framer-motion')) {
    content = content.replace(
        "import { supabase } from '../../utils/supabaseClient';",
        "import { supabase } from '../../utils/supabaseClient';\nimport { motion, AnimatePresence } from 'framer-motion';"
    );
}

// 2. Add isExpanded state
if (!content.includes('const [isExpanded')) {
    content = content.replace(
        "const [content, setContent] = useState('');",
        "const [content, setContent] = useState('');\n    const [isExpanded, setIsExpanded] = useState(false);"
    );
}

// 3. Add 펼쳐보기 button
const datePickerStr = `className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"\n                        />\n                    </label>`;
if (!content.includes('isExpanded ? \'접기\' : \'펼쳐보기\'')) {
    const newButtonStr = `className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"\n                        />\n                    </label>\n                    <div className="w-px h-[14px] bg-[#333] mx-[4px]"></div>\n                    <button \n                        type="button"\n                        onClick={() => setIsExpanded(!isExpanded)}\n                        className="flex items-center gap-[4px] px-[8px] py-[4px] bg-transparent hover:bg-white/5 rounded-[6px] transition-colors cursor-pointer"\n                    >\n                        <span className="text-[12px] font-medium text-[#86868B]">{isExpanded ? '접기' : '펼쳐보기'}</span>\n                        <svg \n                            width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#86868B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"\n                            className={\`transition-transform duration-200 \${isExpanded ? 'rotate-180' : ''}\`}\n                        >\n                            <polyline points="6 9 12 15 18 9"></polyline>\n                        </svg>\n                    </button>`;
    content = content.replace(datePickerStr, newButtonStr);
}

// 4. Wrap body with AnimatePresence
const textAreaStart = content.indexOf('{/* Text Area */}');
const modalsStart = content.indexOf('{/* Modals */}');

if (textAreaStart > -1 && modalsStart > -1 && !content.includes('<AnimatePresence>')) {
    // find the last </div> before modalsStart which belongs to the bg-[#262626] container
    const beforeModals = content.substring(0, modalsStart);
    const lastDivIndex = beforeModals.lastIndexOf('</div>'); // this closes bg-[#262626] container
    
    // We need to wrap from textAreaStart to lastDivIndex
    const bodyStr = content.substring(textAreaStart, lastDivIndex);
    
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
            
    content = content.substring(0, textAreaStart) + wrappedBody + content.substring(lastDivIndex);
}

fs.writeFileSync(path, content, 'utf8');
