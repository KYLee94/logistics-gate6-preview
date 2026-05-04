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
df_dict = pd.read_excel(file_path, sheet_name=None, header=None)

cps_res = supabase.table("counterparties").select("counterparty_id, name").execute()
cp_map = {c["name"]: c["counterparty_id"] for c in cps_res.data}
cp_alias = {
    "농협중앙회": "농업협동조합중앙회"
}

def clean_val(v):
    if pd.isna(v): return ""
    return str(v).strip()

inserted_count = 0

for sheet_name, sheet_df in df_dict.items():
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
        
    print(f"Processing AUM for {inst_name} (ID: {cp_id})...")
    
    existing = supabase.table("counterparty_contacts").select("id, name").eq("counterparty_id", cp_id).execute()
    ids_to_delete = []
    for c in existing.data:
        # Delete old AUM records to avoid duplicates
        if 'AUM' in c['name'] or '프로젝트펀드' in c['name'] or '위탁운용펀드' in c['name'] or '모펀드기준' in c['name'] or '조원' in c['name']:
            if not c['name'].startswith('-') and '[' not in c['name'] and '회의록' not in c['name']:
                ids_to_delete.append(c['id'])
    
    if ids_to_delete:
        for i in range(0, len(ids_to_delete), 100):
            supabase.table("counterparty_contacts").delete().in_("id", ids_to_delete[i:i+100]).execute()

    new_records = []
    
    # Check top 15 rows for AUM
    for i in range(min(15, len(sheet_df))):
        row_vals = []
        is_aum = False
        for col in sheet_df.columns:
            val = clean_val(sheet_df.iloc[i][col])
            if val:
                row_vals.append(val)
                if 'AUM' in val or '프로젝트펀드' in val or '위탁운용펀드' in val or '운용자산' in val:
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

    if new_records:
        supabase.table("counterparty_contacts").insert(new_records).execute()
        inserted_count += len(new_records)

print(f"\nDone! Inserted {inserted_count} AUM records.")
