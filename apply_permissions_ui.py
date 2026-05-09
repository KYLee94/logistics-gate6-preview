import re

def update_file():
    filepath = 'src/components/system/workspace/WorkspaceActivityLog.jsx'
    with open(filepath, 'r') as f:
        content = f.read()

    # 1. Add helper functions before formatDateYYMMDD
    helpers = """
    const hasRestrictedPermissions = (log) => {
        const perms = log.metadata?.permissions;
        if (!perms) return false;
        return (perms.groups && perms.groups.length > 0) || (perms.individuals && perms.individuals.length > 0);
    };

    const getPermissionString = (log) => {
        const perms = log.metadata?.permissions;
        if (!perms) return '';
        const parts = [];
        if (perms.groups && perms.groups.length > 0) parts.push(...perms.groups);
        if (perms.individuals && perms.individuals.length > 0) parts.push(...perms.individuals);
        return parts.join(', ');
    };

    const formatDateYYMMDD"""
    content = content.replace('    const formatDateYYMMDD', helpers)

    # 2. Modify Content snippet in Main Row
    old_content_snippet = """                                    {/* Content */}
                                    <div className="flex-1 min-w-0 pr-0 flex items-center gap-[8px] translate-x-[2px]">
                                        <div 
                                            className="flex-1 min-w-0 text-[14px] text-[#E5E5E5] truncate hover:text-white transition-colors"
                                        >
                                            {log.raw_text ? log.raw_text.split('\\n')[0] : ''}
                                            {log.metadata?.comments?.length > 0 && <span className="text-[#3b82f6] ml-[6px] font-bold text-[13px]">({log.metadata.comments.length})</span>}
                                        </div>
                                    </div>"""
    
    new_content_snippet = """                                    {/* Content */}
                                    <div className="flex-1 min-w-0 pr-0 flex items-center gap-[8px] translate-x-[2px]">
                                        <div 
                                            className="flex-1 min-w-0 text-[14px] text-[#E5E5E5] truncate hover:text-white transition-colors flex items-center gap-[6px]"
                                        >
                                            {hasRestrictedPermissions(log) && (
                                                <div className="group relative flex items-center shrink-0">
                                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#A1A1AA" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                                                    <div className="absolute left-1/2 -translate-x-1/2 bottom-[100%] mb-[8px] hidden group-hover:flex bg-[#222] border border-[#333] px-[8px] py-[4px] rounded-[6px] whitespace-nowrap text-[11px] text-[#E5E5E5] shadow-lg z-[99] pointer-events-none font-medium">
                                                        열람 권한: {getPermissionString(log)}
                                                    </div>
                                                </div>
                                            )}
                                            <span className="truncate">{log.raw_text ? log.raw_text.split('\\n')[0] : ''}</span>
                                            {log.metadata?.comments?.length > 0 && <span className="text-[#3b82f6] ml-[6px] font-bold text-[13px] shrink-0">({log.metadata.comments.length})</span>}
                                        </div>
                                    </div>"""
    content = content.replace(old_content_snippet, new_content_snippet)

    # 3. Modify Expanded Box Pill area
    old_pill_area = """                                    {/* Stakeholder Pill (Floated Right) */}
                                    {log.iota_seoul_log_stakeholders?.[0]?.sh_name && (
                                        <div className="float-right ml-[16px] mb-[12px] flex flex-col items-end gap-[4px]">
                                            <span className="text-[11px] font-bold text-[#86868B] pr-[14px]">이해관계자</span>
                                            <div className="bg-[#2a2a2c] border border-[#444] rounded-full pl-[8px] pr-[12px] py-[4px] flex items-center gap-[6px]">
                                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#A1A1AA" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                                                <span className="text-[12px] font-medium text-[#E5E5E5]">
                                                    {log.iota_seoul_log_stakeholders[0].sh_name.split(' - ')[0]}
                                                </span>
                                            </div>
                                        </div>
                                    )}"""
                                    
    new_pill_area = """                                    {/* Right Floating Badges */}
                                    <div className="float-right ml-[16px] mb-[12px] flex flex-col items-end gap-[12px]">
                                        {hasRestrictedPermissions(log) && (
                                            <div className="flex flex-col items-end gap-[4px]">
                                                <span className="text-[11px] font-bold text-[#86868B] pr-[14px]">열람 권한</span>
                                                <div className="bg-[#1e293b] border border-[#334155] rounded-full pl-[8px] pr-[12px] py-[4px] flex items-center gap-[6px]">
                                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                                                    <span className="text-[12px] font-medium text-[#e2e8f0]">
                                                        제한됨: {getPermissionString(log)}
                                                    </span>
                                                </div>
                                            </div>
                                        )}
                                        
                                        {log.iota_seoul_log_stakeholders?.[0]?.sh_name && (
                                            <div className="flex flex-col items-end gap-[4px]">
                                                <span className="text-[11px] font-bold text-[#86868B] pr-[14px]">이해관계자</span>
                                                <div className="bg-[#2a2a2c] border border-[#444] rounded-full pl-[8px] pr-[12px] py-[4px] flex items-center gap-[6px]">
                                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#A1A1AA" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                                                    <span className="text-[12px] font-medium text-[#E5E5E5]">
                                                        {log.iota_seoul_log_stakeholders[0].sh_name.split(' - ')[0]}
                                                    </span>
                                                </div>
                                            </div>
                                        )}
                                    </div>"""
    content = content.replace(old_pill_area, new_pill_area)

    with open(filepath, 'w') as f:
        f.write(content)

update_file()
