import fs from 'fs';

const content = fs.readFileSync('src/components/system/stakeholder/StakeInternal.jsx', 'utf-8');

// Extract the stakeholderGroups array text
const startIdx = content.indexOf('const stakeholderGroups = [');
const endIdx = content.indexOf('];\n\nexport default function StakeInternal()') + 1;
const groupsText = content.substring(startIdx, endIdx);

// It's just a JS array declaration. Let's make it eval-able.
const jsCode = groupsText.replace('const stakeholderGroups =', 'module.exports =');
fs.writeFileSync('temp_groups.cjs', jsCode);
