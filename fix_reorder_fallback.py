import glob

files = glob.glob('src/components/system/workspace/*.jsx')

for file in files:
    with open(file, 'r') as f:
        content = f.read()

    # Find the table name to use in fallback key
    import re
    # We look for something like supabase.from('iota_pm_tasks')
    table_match = re.search(r"supabase\.from\('([^']+)'\)", content)
    if not table_match:
        continue
    
    table_name = table_match.group(1)
    
    # Let's just blindly replace the try/catch blocks in handleMoveTaskUp and handleMoveTaskDown
    
    old_up_try = f"""        try {{
            await supabase.from('{table_name}').update({{ created_at: current.created_at }}).eq('id', current.id);
            await supabase.from('{table_name}').update({{ created_at: prev.created_at }}).eq('id', prev.id);
        }} catch (e) {{
            localStorage.setItem('{table_name}_fallback', JSON.stringify(newTasks));
        }}"""

    new_up_try = f"""        try {{
            const {{ error: e1 }} = await supabase.from('{table_name}').update({{ created_at: current.created_at }}).eq('id', current.id);
            if (e1) throw e1;
            const {{ error: e2 }} = await supabase.from('{table_name}').update({{ created_at: prev.created_at }}).eq('id', prev.id);
            if (e2) throw e2;
        }} catch (e) {{
            localStorage.setItem('{table_name}_fallback', JSON.stringify(newTasks));
        }}"""
        
    old_down_try = f"""        try {{
            await supabase.from('{table_name}').update({{ created_at: current.created_at }}).eq('id', current.id);
            await supabase.from('{table_name}').update({{ created_at: next.created_at }}).eq('id', next.id);
        }} catch (e) {{
            localStorage.setItem('{table_name}_fallback', JSON.stringify(newTasks));
        }}"""

    new_down_try = f"""        try {{
            const {{ error: e1 }} = await supabase.from('{table_name}').update({{ created_at: current.created_at }}).eq('id', current.id);
            if (e1) throw e1;
            const {{ error: e2 }} = await supabase.from('{table_name}').update({{ created_at: next.created_at }}).eq('id', next.id);
            if (e2) throw e2;
        }} catch (e) {{
            localStorage.setItem('{table_name}_fallback', JSON.stringify(newTasks));
        }}"""

    if old_up_try in content:
        content = content.replace(old_up_try, new_up_try)
    if old_down_try in content:
        content = content.replace(old_down_try, new_down_try)
        
    with open(file, 'w') as f:
        f.write(content)
        
    print(f"Patched {file}")

