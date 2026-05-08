import re

file_path = "src/components/system/workspace/WorkspaceActivityLog.jsx"
with open(file_path, "r") as f:
    content = f.read()

# The current structure has the wrapper at the very top:
# return (
#     <div className="-mx-[7px] p-[6px] border border-[#333] rounded-[30px] mb-[40px]">
#         <div className="w-full flex flex-col mt-0">
#         {/* Log Viewer */}

# Let's extract the header block
header_pattern = r"(\s*\{\/\* Log Viewer \*\/\}\s*<div className=\"flex justify-between items-center mt-\[2px\] mb-\[12px\]\">[\s\S]*?<\/div>\s*<\/div>\s*)"
header_match = re.search(header_pattern, content)
header_block = header_match.group(1)

# Remove the header block from content
content_no_header = content[:header_match.start()] + content[header_match.end():]

# Now, target the top of the return:
target_start = """    return (
        <div className="-mx-[7px] p-[6px] border border-[#333] rounded-[30px] mb-[40px]">
            <div className="w-full flex flex-col mt-0">"""

# Replace with the new top structure
replacement_start = """    return (
        <div className="w-full flex flex-col mt-0">""" + header_block + """
            <div className="-mx-[7px] p-[6px] border border-[#333] rounded-[30px] mb-[40px]">
                <div className="w-full flex flex-col mt-0">"""

content_new = content_no_header.replace(target_start, replacement_start)

# Since we opened a new `<div className="w-full flex flex-col mt-0">` at the very top, we need to add a closing `</div>` at the very end.
# The end currently is:
#             )}
#             </div>
#         </div>
#     );
# }
target_end = """            )}
            </div>
        </div>
    );
}"""

replacement_end = """            )}
                </div>
            </div>
        </div>
    );
}"""

content_final = content_new.replace(target_end, replacement_end)

with open(file_path, "w") as f:
    f.write(content_final)

print("Restructured successfully")
