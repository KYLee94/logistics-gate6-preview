const fs = require('fs');
const path = 'src/components/system/stakeholder/StakeInternal.jsx';
let content = fs.readFileSync(path, 'utf8');

// The marker where we start adding 'IOTA CFT'
const startIdx = content.indexOf("groupTitle: '파이낸싱'");

// Replace roles arrays after startIdx
let newContent = content.substring(0, startIdx) + content.substring(startIdx).replace(/roles:\s*\[(.*?)\]/g, (match, p1) => {
    // p1 contains the items like "'Loan Finance센터', 'IOTA CFT'"
    if (!p1.includes("'IOTA CFT'")) {
        // add 'IOTA CFT'
        if (p1.trim() === '') {
            return `roles: ['IOTA CFT']`;
        }
        return `roles: [${p1}, 'IOTA CFT']`;
    }
    return match;
});

// Remove the new group and add 전기영 to 기획추진
// We need to replace the 기획추진 members and remove 플랫폼 개발 및 운영

// Find 기획추진 group
const pmGroupStr = `                    {
                        groupTitle: '기획추진',
                        members: [
                            {
                                name: '이시정',
                                photo: '이시정',
                                roles: ['기획추진센터/리더', 'People Architecture TF', 'IOTA CFT'],
                                responsibility: '',
                                email: 'sjlee@igisam.com',
                                phone: '010-8852-9482',
                            },
                            {
                                name: '이관용',
                                photo: '이관용',
                                roles: ['기획추진센터', 'IOTA CFT'],
                                responsibility: '',
                                email: 'kylee@igisam.com',
                                phone: '010-2927-3685',
                            },
                            {
                                name: '전기영',
                                photo: '전기영',
                                roles: ['플랫폼 기획/개발 총괄', 'IOTA CFT'],
                                responsibility: '',
                                email: 'jkjeon2025@igisam.com',
                                phone: '',
                            },
                        ]
                    },
];`;

newContent = newContent.replace(/\{\s*groupTitle:\s*'기획추진'[\s\S]*?\];/g, pmGroupStr);

fs.writeFileSync(path, newContent, 'utf8');
