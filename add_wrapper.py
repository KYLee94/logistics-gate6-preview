import re

file_path = "src/components/system/workspace/WorkspaceActivityLog.jsx"
with open(file_path, "r") as f:
    content = f.read()

# 1. Add outer wrapper
target_start = """    return (
        <div className="w-full flex flex-col mt-0">"""
replacement_start = """    return (
        <div className="-mx-[7px] p-[6px] border border-[#333] rounded-[30px] mb-[40px]">
            <div className="w-full flex flex-col mt-0">"""

content = content.replace(target_start, replacement_start)

# 2. Close outer wrapper before modals
# Wait, where does the main container close?
# The modals are outside the main flow or at the bottom.
# It's better to just wrap the whole thing or close it before modals. 
# Modals are absolutely positioned so they can be inside the wrapper without affecting layout.
target_end = """            )}
        </div>
    );
}"""
replacement_end = """            )}
            </div>
        </div>
    );
}"""

content = content.replace(target_end, replacement_end)

# 3. Remove mb-[40px] from the table
target_table = """            <div className="w-full border border-[#3c3c3c] rounded-[24px] mb-[40px] flex flex-col bg-[#252525]">"""
replacement_table = """            <div className="w-full border border-[#3c3c3c] rounded-[24px] flex flex-col bg-[#252525]">"""

content = content.replace(target_table, replacement_table)

with open(file_path, "w") as f:
    f.write(content)
