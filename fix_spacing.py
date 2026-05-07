import sys

path = 'src/components/system/workspace/WorkspaceFinancing.jsx'
with open(path, 'r') as f:
    content = f.read()

# 1 & 2
content = content.replace(
    '<div className="w-full mt-[32px] flex flex-col gap-[10px]">',
    '<div className="w-full mt-[42px] flex flex-col gap-0">'
)

# 3
content = content.replace(
    '<div className="w-full h-[44px]"></div>',
    '<div className="w-full h-[14px]"></div>'
)

with open(path, 'w') as f:
    f.write(content)

print("Spacing fixed")
