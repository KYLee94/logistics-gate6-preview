const fs = require('fs');
const filePath = '/Users/jkjeon2025/Documents/GitHub/IGIS Fund Production DP/src/components/system/workspace/WorkspaceActivityLog.jsx';
let content = fs.readFileSync(filePath, 'utf8');

const headerTarget = `                            <div className="w-[80px] shrink-0 translate-x-[4px] flex justify-center">
                                <div className="text-[12px] font-bold text-[#fbf167] px-[2px] py-[4px] text-center w-[60px]">
                                    {filterCell ? filterCell.replace(/-(LFC|DSC|EMC|SSC|KAM)$/, '') : '기능셀'}
                                </div>
                            </div>`;

const dataTarget = `                                    {/* Cell Name */}
                                    <div className="w-[80px] shrink-0 translate-x-[4px] flex justify-center">
                                        <span className="text-[13px] font-medium text-[#86868B]">
                                            {getLogCell(log).replace(/-(LFC|DSC|EMC|SSC|KAM)$/, '')}
                                        </span>
                                    </div>`;

content = content.replace(headerTarget, '');
content = content.replace(dataTarget, '');

fs.writeFileSync(filePath, content, 'utf8');
console.log('Column removed');
