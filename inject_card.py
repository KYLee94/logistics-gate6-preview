import sys

path = 'src/components/system/workspace/WorkspaceFinancing.jsx'
with open(path, 'r') as f:
    content = f.read()

with open('temp_card_processed.jsx', 'r') as f:
    card_content = f.read()

insert_idx = content.find("    const getTotal = (v, p = 'Current') => {")
new_content = content[:insert_idx] + card_content + "\n" + content[insert_idx:]

with open(path, 'w') as f:
    f.write(new_content)

print("Injected VehicleDetailCard")
