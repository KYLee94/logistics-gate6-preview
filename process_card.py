import sys

with open('temp_card.jsx', 'r') as f:
    lines = f.readlines()

new_lines = []
skip = False
for i, line in enumerate(lines):
    if "{/* Dashboard Metrics Cards */}" in line:
        skip = True
    
    if skip and "{/* Visual Tranche Bar */}" in line:
        skip = False

    if not skip:
        new_lines.append(line)

with open('temp_card_processed.jsx', 'w') as f:
    f.writelines(new_lines)

print("Processed card")
