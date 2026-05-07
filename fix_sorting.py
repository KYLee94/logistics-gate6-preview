import sys

path = 'src/components/system/workspace/WorkspaceMarketing.jsx'
with open(path, 'r') as f:
    content = f.read()

# 1. Add state for sortBy
if 'const [sortBy, setSortBy] = useState(\'마감일\');' not in content:
    content = content.replace(
        "const [isAdding, setIsAdding] = useState(false);",
        "const [isAdding, setIsAdding] = useState(false);\n    const [sortBy, setSortBy] = useState('마감일');"
    )

# 2. Add sortedTasks logic before return
sorted_logic = """    const sortedTasks = [...tasks].sort((a, b) => {
        if (sortBy === '마감일') {
            if (!a.due_date) return 1;
            if (!b.due_date) return -1;
            return new Date(a.due_date) - new Date(b.due_date);
        } else {
            const priorityOrder = { '높음': 3, '중간': 2, '낮음': 1 };
            const pA = priorityOrder[a.priority] || 0;
            const pB = priorityOrder[b.priority] || 0;
            if (pA !== pB) return pB - pA;
            if (!a.due_date) return 1;
            if (!b.due_date) return -1;
            return new Date(a.due_date) - new Date(b.due_date);
        }
    });

    return ("""

content = content.replace("    return (", sorted_logic)

# 3. Replace tasks.map with sortedTasks.map
content = content.replace("tasks.map((row) => (", "sortedTasks.map((row) => (")

# 4. Replace the header UI to include select box
old_header_ui = """            <div className="flex justify-between items-center mb-[14px]">
                <h2 className="text-[18px] font-bold text-white tracking-tight">기업마케팅 주요 테스크 관리</h2>
                <button 
                    onClick={handleAddClick}
                    className="px-[14px] py-[6px] bg-[#333] hover:bg-[#444] border border-[#444] text-[#E5E5E5] text-[13px] font-bold rounded-[8px] transition-colors cursor-pointer"
                >
                    + Task 등록하기
                </button>
            </div>"""

new_header_ui = """            <div className="flex justify-between items-center mb-[14px]">
                <h2 className="text-[18px] font-bold text-white tracking-tight">기업마케팅 주요 테스크 관리</h2>
                <div className="flex gap-2 items-center">
                    <div className="relative">
                        <select 
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value)}
                            className="px-[12px] py-[6px] bg-[#272726] border border-[#3c3c3c] text-[#A1A1AA] text-[13px] rounded-[8px] outline-none focus:border-[#555] appearance-none pr-[30px] cursor-pointer"
                        >
                            <option value="마감일">마감일 순으로 보기</option>
                            <option value="중요도">중요도 순으로 보기</option>
                        </select>
                        <div className="absolute right-[10px] top-1/2 -translate-y-1/2 pointer-events-none text-[#86868B]">
                            <svg width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                        </div>
                    </div>
                    <button 
                        onClick={handleAddClick}
                        className="px-[14px] py-[6px] bg-[#333] hover:bg-[#444] border border-[#444] text-[#E5E5E5] text-[13px] font-bold rounded-[8px] transition-colors cursor-pointer"
                    >
                        + Task 등록하기
                    </button>
                </div>
            </div>"""

content = content.replace(old_header_ui, new_header_ui)

with open(path, 'w') as f:
    f.write(content)

print("Added sorting functionality!")
