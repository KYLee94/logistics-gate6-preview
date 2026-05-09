import os

files = [
    'WorkspacePm.jsx',
    'WorkspaceDevelopment.jsx',
    'WorkspaceFinancing.jsx',
    'WorkspaceMarketing.jsx',
    'WorkspaceFund.jsx',
    'WorkspaceIpr.jsx'
]

base_path = 'src/components/system/workspace'

for filename in files:
    filepath = os.path.join(base_path, filename)
    with open(filepath, 'r') as f:
        content = f.read()

    target = """                        <input 
                            type="text" 
                            value={newTask.next_action} 
                            onChange={e => setNewTask({...newTask, next_action: e.target.value})} 
                            className="w-full bg-[#1A1A1A] border border-[#444] rounded-[12px] px-4 py-3 text-white text-[15px] outline-none focus:border-[#888]" 
                            placeholder="다음 액션 준비사항 입력" 
                        />"""

    replacement = """                        <input 
                            type="text" 
                            value={newTask.next_action} 
                            onChange={e => setNewTask({...newTask, next_action: e.target.value})} 
                            className="w-full bg-[#1A1A1A] border border-[#444] rounded-[12px] px-4 py-3 text-white text-[15px] outline-none focus:border-[#888]" 
                            placeholder="다음 액션 준비사항 입력" 
                        />
                        <input 
                            type="text" 
                            value={newTask.notes || ''} 
                            onChange={e => setNewTask({...newTask, notes: e.target.value})} 
                            className="w-full bg-[#1A1A1A] border border-[#444] rounded-[12px] px-4 py-3 text-[#A1A1AA] text-[14px] outline-none focus:border-[#888]" 
                            placeholder="비고 / 링크 입력 (선택사항)" 
                        />"""
                        
    content = content.replace(target, replacement)
    
    with open(filepath, 'w') as f:
        f.write(content)

