const fs = require('fs');

function patchFile(path) {
    let content = fs.readFileSync(path, 'utf8');

    // Add framer-motion import if not present
    if (!content.includes('import { motion, AnimatePresence } from \'framer-motion\';')) {
        content = content.replace(
            "import { useAuth } from '../../context/AuthContext';",
            "import { useAuth } from '../../context/AuthContext';\nimport { motion, AnimatePresence } from 'framer-motion';"
        );
        content = content.replace(
            "import { useAuth } from '../../../context/AuthContext';",
            "import { useAuth } from '../../../context/AuthContext';\nimport { motion, AnimatePresence } from 'framer-motion';"
        );
    }

    // Replace Expanded Box wrapper
    // Find:
    // {/* Expanded Box */}
    // {expandedLogs[log.log_id] && (
    //     <div className="w-full flex mt-[14px]">

    const originalStr1 = `{/* Expanded Box */}\n                        {expandedLogs[log.log_id] && (\n                            <div className="w-full flex mt-[14px]">`;
    
    // In WorkspaceActivityLog, it's exactly the same.
    const newStr1 = `{/* Expanded Box */}\n                        <AnimatePresence>\n                            {expandedLogs[log.log_id] && (\n                                <motion.div \n                                    className="w-full flex overflow-hidden"\n                                    initial={{ height: 0, opacity: 0, marginTop: 0 }}\n                                    animate={{ height: 'auto', opacity: 1, marginTop: 14 }}\n                                    exit={{ height: 0, opacity: 0, marginTop: 0 }}\n                                    transition={{ duration: 0.2, ease: "easeInOut" }}\n                                >`;

    if (content.includes(originalStr1)) {
        content = content.replace(originalStr1, newStr1);
        
        // Also need to find the matching closing tag for this div and replace with </motion.div>} </AnimatePresence>
        // In the structure, the div closes after the inner div (which has bg-[#1c1c1e])
        // Let's replace the first closing div of that block.
        // It's followed by:
        //             </div>
        //         )}
        //     </div>
        // ))}

        // The easiest way is regex or exactly matching the end of the block.
        // Let's look at the end of the block.
        const originalEndStr = `                                </div>\n                            </div>\n                        )}`;
        const newEndStr =      `                                </div>\n                                </motion.div>\n                            )}\n                        </AnimatePresence>`;
        content = content.replace(originalEndStr, newEndStr);
    }

    fs.writeFileSync(path, content, 'utf8');
}

patchFile('src/components/system/DecisionLog.jsx');
patchFile('src/components/system/workspace/WorkspaceActivityLog.jsx');
