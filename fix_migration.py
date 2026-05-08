import glob
import re

files = glob.glob('src/components/system/workspace/*.jsx')

for file in files:
    with open(file, 'r') as f:
        content = f.read()

    table_match = re.search(r"supabase\s*\n*\s*\.from\('([^']+)'\)", content)
    if not table_match:
        # try without newline
        table_match = re.search(r"supabase\.from\('([^']+)'\)", content)
        if not table_match:
            continue
            
    table_name = table_match.group(1)
    
    old_code = """            } else {
                setTasks(data || []);
            }"""
            
    new_code = f"""            }} else {{
                if (data && data.length === 0) {{
                    const localData = localStorage.getItem('{table_name}_fallback');
                    if (localData) {{
                        const parsed = JSON.parse(localData);
                        if (parsed.length > 0) {{
                            setTasks(parsed);
                            for (const t of parsed) {{
                                await supabase.from('{table_name}').insert([t]);
                            }}
                            localStorage.removeItem('{table_name}_fallback');
                            return;
                        }}
                    }}
                }}
                setTasks(data || []);
            }}"""
            
    if old_code in content:
        content = content.replace(old_code, new_code)
        with open(file, 'w') as f:
            f.write(content)
        print(f"Patched {file}")

