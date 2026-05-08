import re

file_path = "src/components/system/workspace/WorkspaceActivityLog.jsx"
with open(file_path, "r") as f:
    content = f.read()

# Extract LogWriteBox block
logwrite_pattern = r"(\s*\{\/\* Task Input Form \*\/\}\s*<LogWriteBox[\s\S]*?workspaceLabel=\{workspaceLabel\}\s*\/>\s*)"
logwrite_match = re.search(logwrite_pattern, content)
if logwrite_match:
    logwrite_block = logwrite_match.group(1)
else:
    print("LogWriteBox block not found")
    exit(1)

# Extract Header block
header_pattern = r"(\s*\{\/\* Log Viewer \*\/\}\s*<div className=\"flex justify-between items-center mt-\[2px\] mb-\[12px\]\">[\s\S]*?<\/div>\s*<\/div>\s*)"
header_match = re.search(header_pattern, content)
if header_match:
    header_block = header_match.group(1)
else:
    print("Header block not found")
    exit(1)

# Ensure they are adjacent or simply remove both and insert in correct order
# Let's find the combined block
combined_pattern = logwrite_pattern + header_pattern
combined_match = re.search(combined_pattern, content)

if combined_match:
    swapped_content = content[:combined_match.start()] + header_block + logwrite_block + content[combined_match.end():]
    with open(file_path, "w") as f:
        f.write(swapped_content)
    print("Successfully swapped")
else:
    print("Could not find combined pattern")
