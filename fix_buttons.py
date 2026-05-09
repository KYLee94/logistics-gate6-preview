import os
import re

files = [
    'WorkspacePm.jsx',
    'WorkspaceDevelopment.jsx',
    'WorkspaceFinancing.jsx',
    'WorkspaceMarketing.jsx',
    'WorkspaceDigital.jsx',
    'WorkspaceFund.jsx',
    'WorkspaceIpr.jsx'
]

base_path = 'src/components/system/workspace'

for filename in files:
    filepath = os.path.join(base_path, filename)
    with open(filepath, 'r') as f:
        content = f.read()

    # The current buttons are:
    # <button onClick={(e) => { e.stopPropagation(); handleEditRow(row); }} className="px-3 py-2 h-[60px] bg-[#3b82f6]/10 text-[#3b82f6] border border-[#3b82f6]/30 rounded-[8px] text-[13px] font-bold hover:bg-[#3b82f6]/20 cursor-pointer">
    #     수정
    # </button>
    # <button onClick={(e) => { e.stopPropagation(); setItemToDelete({ id: row.id, message: '정말 삭제하시겠습니까?' }); }} className="px-3 py-2 h-[60px] bg-[#ef4444]/10 text-[#ef4444] border border-[#ef4444]/30 rounded-[8px] text-[13px] font-bold hover:bg-[#ef4444]/20 cursor-pointer">
    #     삭제
    # </button>

    # I will replace them with:
    # <div className="flex flex-col gap-1 w-[46px]">
    #     <button onClick={(e) => { e.stopPropagation(); setItemToDelete({ id: row.id, message: '정말 삭제하시겠습니까?' }); }} className="w-full h-[28px] flex items-center justify-center bg-[#ef4444]/10 text-[#ef4444] border border-[#ef4444]/30 rounded-[6px] text-[12px] font-bold hover:bg-[#ef4444]/20 cursor-pointer">
    #         삭제
    #     </button>
    #     <button onClick={(e) => { e.stopPropagation(); handleEditRow(row); }} className="w-full h-[28px] flex items-center justify-center bg-[#3b82f6]/10 text-[#3b82f6] border border-[#3b82f6]/30 rounded-[6px] text-[12px] font-bold hover:bg-[#3b82f6]/20 cursor-pointer">
    #         수정
    #     </button>
    # </div>
    
    # We can match everything from the edit button to the end of the delete button
    pattern = re.compile(
        r'<button\s+onClick=\{\(e\) => { e\.stopPropagation\(\); handleEditRow\(row\); \}\}\s+className="px-3 py-2 h-\[60px\] bg-\[#3b82f6\]/10 text-\[#3b82f6\] border border-\[#3b82f6\]/30 rounded-\[8px\] text-\[13px\] font-bold hover:bg-\[#3b82f6\]/20 cursor-pointer"\s*>\s*수정\s*</button>\s*<button\s+onClick=\{\(e\) => { e\.stopPropagation\(\); setItemToDelete\({ id: row\.id, message: \'정말 삭제하시겠습니까\?\' }\); \}\}\s+className="px-3 py-2 h-\[60px\] bg-\[#ef4444\]/10 text-\[#ef4444\] border border-\[#ef4444\]/30 rounded-\[8px\] text-\[13px\] font-bold hover:bg-\[#ef4444\]/20 cursor-pointer"\s*>\s*삭제\s*</button>',
        re.DOTALL
    )
    
    replacement = """<div className="flex flex-col gap-1 w-[46px]">
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); setItemToDelete({ id: row.id, message: '정말 삭제하시겠습니까?' }); }} 
                                            className="w-full h-[28px] flex items-center justify-center bg-[#ef4444]/10 text-[#ef4444] border border-[#ef4444]/30 rounded-[6px] text-[12px] font-bold hover:bg-[#ef4444]/20 cursor-pointer"
                                        >
                                            삭제
                                        </button>
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); handleEditRow(row); }} 
                                            className="w-full h-[28px] flex items-center justify-center bg-[#3b82f6]/10 text-[#3b82f6] border border-[#3b82f6]/30 rounded-[6px] text-[12px] font-bold hover:bg-[#3b82f6]/20 cursor-pointer"
                                        >
                                            수정
                                        </button>
                                    </div>"""
                                    
    if "flex flex-col gap-1 w-[46px]" not in content:
        content = re.sub(pattern, replacement, content)
        
        with open(filepath, 'w') as f:
            f.write(content)

