import sys

path = 'src/components/system/workspace/WorkspaceFinancing.jsx'
with open(path, 'r') as f:
    content = f.read()

insert_idx = content.find("    const navigateTo = (path) => {")

new_content = content[:insert_idx] + "    const handleInstClick = () => {};\n" + content[insert_idx:]

with open(path, 'w') as f:
    f.write(new_content)

print("Inserted handleInstClick")
