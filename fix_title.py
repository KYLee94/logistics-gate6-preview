import sys

path = 'src/components/system/workspace/WorkspaceFinancing.jsx'
with open(path, 'r') as f:
    content = f.read()

old_str = """            <div id={id} className="mb-12">
                <div className="flex justify-between items-end mb-[24px]">
                    <h2 className="text-[24px] font-bold text-white tracking-tight">{title}</h2>
                    {toggleContent}
                </div>"""

new_str = """            <div id={id} className="mb-12">
                <div className="flex justify-between items-end mb-[12px]">
                    <h2 className="text-[20px] font-bold text-white">{title}</h2>
                    {toggleContent}
                </div>"""

content = content.replace(old_str, new_str)

with open(path, 'w') as f:
    f.write(content)

print("Fixed title")
