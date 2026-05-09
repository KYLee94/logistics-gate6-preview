import os
import re

filepath = 'src/components/system/workspace/WorkspaceActivityLog.jsx'
with open(filepath, 'r') as f:
    content = f.read()

# 1. Insert checkUserAccess function before `const filteredLogs`
check_func = """    const checkUserAccess = (log) => {
        const perms = log.metadata?.permissions;
        if (!perms) return true;
        
        const hasGroups = perms.groups && perms.groups.length > 0;
        const hasIndivs = perms.individuals && perms.individuals.length > 0;
        
        if (!hasGroups && !hasIndivs) return true;

        const myEmail = memberInfo?.email;
        const myName = memberInfo?.staff_name || memberInfo?.name;
        const isAuthor = log.writer_staff_id === myEmail || log.writer_name === myName;
        
        if (isAuthor) return true;
        
        if (hasIndivs && perms.individuals.includes(myName)) return true;
        
        if (hasGroups) {
            const myStakeholderRecords = masterStakeholders.filter(s => s.contact_name === myName);
            const myRoles = myStakeholderRecords.map(s => s.role_category).filter(Boolean);
            
            for (const group of perms.groups) {
                if (group === "각 워크스페이스" && myStakeholderRecords.length > 0) return true;
                if (myRoles.includes(group)) return true;
                
                if (group === "PO" && myName === "이철승") return true;
                if (group === "Sub-PO" && ["윤관식", "정조민", "우형석"].includes(myName)) return true;
            }
        }
        
        return false;
    };

    const filteredLogs = """
content = content.replace("    const filteredLogs = ", check_func)

# 2. Remove the access permission check from filteredLogs
content = re.sub(r'\s*// --- Access Permission Check ---.*?// --- End Access Permission Check ---', '', content, flags=re.DOTALL)

# 3. Update the Title rendering
content = content.replace(
    '''<span className="truncate">{log.raw_text ? log.raw_text.split('\\n')[0] : ''}</span>''',
    '''<span className="truncate">{log.summary || (log.raw_text ? log.raw_text.split('\\n')[0] : '')}</span>'''
)

# 4. Hide content and comments if no access
old_content_render = """                                    ) : (
                                        <div className={`whitespace-pre-wrap break-words text-[15px] leading-relaxed ${commentingLogId === log.log_id ? 'text-[#86868B] opacity-70' : 'text-[#E5E5E5]'}`}>
                                            {renderLogTextWithMentions(log.raw_text)}
                                        </div>
                                    )}
                                    <div className="clear-both mb-[16px]"></div>"""

new_content_render = """                                    ) : (
                                        checkUserAccess(log) ? (
                                            <div className={`whitespace-pre-wrap break-words text-[15px] leading-relaxed ${commentingLogId === log.log_id ? 'text-[#86868B] opacity-70' : 'text-[#E5E5E5]'}`}>
                                                {renderLogTextWithMentions(log.raw_text)}
                                            </div>
                                        ) : (
                                            <div className="text-[#86868B] text-[14px] italic py-[20px] text-center border border-[#333] rounded-[8px] bg-[#1a1a1a]">
                                                🔒 열람 권한이 없습니다.
                                            </div>
                                        )
                                    )}
                                    <div className="clear-both mb-[16px]"></div>"""

content = content.replace(old_content_render, new_content_render)

# Hide comments
content = content.replace(
    '''{log.metadata?.comments && log.metadata.comments.length > 0 && (''',
    '''{checkUserAccess(log) && log.metadata?.comments && log.metadata.comments.length > 0 && ('''
)

# Hide action buttons (reply/edit)
content = content.replace(
    '''                                        <div className="flex items-center gap-[8px] mt-[12px] pt-[12px] border-t border-[#333]">''',
    '''                                        {checkUserAccess(log) && (
                                            <div className="flex items-center gap-[8px] mt-[12px] pt-[12px] border-t border-[#333]">'''
)

action_buttons_close = """                                                </button>
                                            )}
                                        </div>"""
action_buttons_close_new = """                                                </button>
                                            )}
                                        </div>
                                        )}"""
content = content.replace(action_buttons_close, action_buttons_close_new)

with open(filepath, 'w') as f:
    f.write(content)

