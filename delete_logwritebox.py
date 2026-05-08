import re

file_path = "src/components/system/DecisionLog.jsx"
with open(file_path, "r") as f:
    content = f.read()

# Remove import
content = re.sub(r"import LogWriteBox from '\./LogWriteBox';\n?", "", content)

# Remove LogWriteBox component usage
component_pattern = r"\s*<LogWriteBox\s+memberInfo=\{memberInfo\}\s+masterStakeholders=\{masterStakeholders\}\s+fetchLogs=\{fetchLogs\}\s+fetchMasterStakeholders=\{fetchMasterStakeholders\}\s+workspaceCode=\"WS_DECISION\"\s+workspaceLabel=\"전체 업무 현황\"\s+defaultExpanded=\{false\}\s*\/>"
content = re.sub(component_pattern, "", content)

with open(file_path, "w") as f:
    f.write(content)

print("Removed LogWriteBox from DecisionLog.jsx")
