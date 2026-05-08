import glob

files = glob.glob('src/components/system/workspace/*.jsx')

for file in files:
    with open(file, 'r') as f:
        content = f.read()

    # The block we injected:
    #             if (data && data.length === 0) {
    # ...
    #             }
    import re
    
    # We will regex out the block
    new_content = re.sub(r'if \(data && data\.length === 0\) \{.*?localStorage\.removeItem.*?return;\n\s*\}\n\s*\}\n', '', content, flags=re.DOTALL)
    
    # Actually just replace the whole else block back to the original
    table_match = re.search(r"supabase\.from\('([^']+)'\)", content)
    if not table_match:
        continue
    table_name = table_match.group(1)
    
    # Just to be safe, I'll use a precise replace
    start_str = "            } else {\n                if (data && data.length === 0) {"
    end_str = "                }\n                setTasks(data || []);\n            }"
    
    if start_str in content:
        start_idx = content.find(start_str)
        end_idx = content.find(end_str, start_idx) + len(end_str)
        
        original_else = "            } else {\n                setTasks(data || []);\n            }"
        
        content = content[:start_idx] + original_else + content[end_idx:]
        
        with open(file, 'w') as f:
            f.write(content)
        print(f"Reverted {file}")

