import pandas as pd
import math
from supabase import create_client
import re
from datetime import datetime

url = None
key = None
with open(".env.local") as f:
    for line in f:
        if line.startswith("VITE_SUPABASE_URL="):
            url = line.strip().split("=")[1].strip("'\"")
        elif line.startswith("VITE_SUPABASE_ANON_KEY="):
            key = line.strip().split("=")[1].strip("'\"")

supabase = create_client(url, key)

file_path = "/Users/jkjeon2025/Library/Mobile Documents/com~apple~CloudDocs/JK x IGIS/기획추진/IFPDP/DB 취합/CM CRM (원드라이브 참고)/Investor List_240826.xlsx"
df = pd.read_excel(file_path, sheet_name=None)

cps_res = supabase.table("counterparties").select("counterparty_id, name").execute()
cp_map = {c["name"]: c["counterparty_id"] for c in cps_res.data}
cp_alias = {
    "농협중앙회": "농업협동조합중앙회"
}

def clean_val(v):
    if pd.isna(v): return ""
    return str(v).strip()

inserted_count = 0

for sheet_name, sheet_df in df.items():
    match = re.match(r'^(\d+)\.\s*(.+)', sheet_name)
    if not match: continue
    inst_name = match.group(2).strip()
    
    db_name = cp_alias.get(inst_name, inst_name)
    cp_id = cp_map.get(db_name)
    if not cp_id:
        for kname, kid in cp_map.items():
            if inst_name in kname or kname in inst_name:
                cp_id = kid
                break
    if not cp_id: continue
        
    print(f"Processing {inst_name} (ID: {cp_id})...")
    
    existing = supabase.table("counterparty_contacts").select("id, name, created_at").eq("counterparty_id", cp_id).execute()
    ids_to_delete = []
    for c in existing.data:
        # Delete only the meeting notes (names with [ or very long or inserted with 미팅 노트)
        # Wait, let's just delete everything that is NOT a short name without brackets (real contacts)
        # But we already did this, so mostly the ones we just inserted are there.
        if 'AUM' in c['name'] or '펀드' in c['name'] or '조원' in c['name'] or '부동산' in c['name'] or len(c['name']) > 15 or '[' in c['name'] or c['name'] == '미팅 노트':
            ids_to_delete.append(c['id'])
    
    if ids_to_delete:
        for i in range(0, len(ids_to_delete), 100):
            supabase.table("counterparty_contacts").delete().in_("id", ids_to_delete[i:i+100]).execute()

    new_records = []
    
    # 1. AUM data
    for i in range(min(10, len(sheet_df))):
        row_vals = []
        is_aum = False
        for col in sheet_df.columns:
            val = clean_val(sheet_df.iloc[i][col])
            if val:
                row_vals.append(val)
                if 'AUM' in val or '프로젝트펀드' in val or '위탁운용펀드' in val:
                    is_aum = True
        if is_aum and row_vals:
            combined = " ".join(row_vals)
            new_records.append({
                "counterparty_id": cp_id,
                "name": combined[:255],
                "title": "",
                "department": "",
                "email": "",
                "mobile": "",
                "metadata": {"full_text": combined},
                "created_at": datetime.utcnow().isoformat()
            })
                
    # 2. History Data
    for i in range(len(sheet_df)):
        row = sheet_df.iloc[i]
        date_val = row.iloc[1] if len(row) > 1 else None
        
        is_date = False
        parsed_date = None
        
        if isinstance(date_val, datetime) or isinstance(date_val, pd.Timestamp):
            is_date = True
            parsed_date = date_val.isoformat()
        elif isinstance(date_val, str):
            m = re.search(r'(\d{4}-\d{2}-\d{2})', date_val)
            if m:
                is_date = True
                parsed_date = m.group(1) + "T00:00:00"
            elif re.match(r'^\d{2}\.\d{2}\.\d{2}', date_val):
                is_date = True
                parsed_date = datetime.utcnow().isoformat()
            
        if is_date:
            attendees = clean_val(row.iloc[2]) if len(row) > 2 else ""
            igis_attendees = clean_val(row.iloc[3]) if len(row) > 3 else ""
            
            # Combine all remaining columns for the content
            remaining_texts = []
            for j in range(4, len(row)):
                c_val = clean_val(row.iloc[j])
                if c_val and c_val != "-":
                    remaining_texts.append(c_val)
            
            if remaining_texts:
                topic = remaining_texts[0]
                contents = "\n".join(remaining_texts[1:]) if len(remaining_texts) > 1 else topic
                
                new_records.append({
                    "counterparty_id": cp_id,
                    "name": topic[:255],
                    "title": attendees[:255],
                    "department": igis_attendees[:255],
                    "email": contents[:255],
                    "mobile": "",
                    "metadata": {"full_text": contents},
                    "created_at": parsed_date or datetime.utcnow().isoformat()
                })

    if new_records:
        supabase.table("counterparty_contacts").insert(new_records).execute()
        inserted_count += len(new_records)

print(f"\nDone! Inserted {inserted_count} total records.")
