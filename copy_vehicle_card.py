import sys
import re

source = 'src/components/system/VehicleIntegrated.jsx'
target = 'src/components/system/workspace/WorkspaceFinancing.jsx'

with open(source, 'r') as f:
    source_content = f.read()

# Extract VehicleDetailCard
start_str = "    const VehicleDetailCard = ({ id, vehicleId, title, totalAmountStr, data, toggleContent }) => {"
# Find the end of VehicleDetailCard
card_start_idx = source_content.find(start_str)
# It ends right before "    // Return the full page UI"
card_end_idx = source_content.find("    // Return the full page UI", card_start_idx)

vehicle_card_code = source_content[card_start_idx:card_end_idx]

with open(target, 'r') as f:
    target_content = f.read()

# Insert VehicleDetailCard before "    const [phase816, setPhase816] = useState('refi');" or similar if exists.
# Wait, let's insert it before "    const getTotal = (v, p = 'Current') => {"
insert_idx = target_content.find("    const getTotal = (v, p = 'Current') => {")

new_target_content = target_content[:insert_idx] + vehicle_card_code + "\n" + target_content[insert_idx:]

with open(target, 'w') as f:
    f.write(new_target_content)

print("Copied VehicleDetailCard")
