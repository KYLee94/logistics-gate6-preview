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
        
    new_records = []
    
    # Check top 15 rows for missing AUM formats
    for i in range(min(15, len(sheet_df))):
        row_vals = []
        is_aum = False
        for col in sheet_df.columns:
            val = clean_val(sheet_df.iloc[i][col])
            if val:
                row_vals.append(val)
                # Broader AUM matching
                if ('전체' in val and '조' in val) or '조원' in val or ('운용규모' in val and '조' in val):
                    # But make sure it wasn't already caught by 'AUM', '프로젝트펀드', '위탁운용펀드', '운용자산'
                    if not any(k in val for k in ['AUM', '프로젝트펀드', '위탁운용펀드', '운용자산']):
                        is_aum = True
        
        if is_aum and row_vals:
            combined = " ".join(row_vals)
            
            # Check if this combined string already exists in DB
            existing = supabase.table("counterparty_contacts").select("id").eq("counterparty_id", cp_id).eq("name", combined[:255]).execute()
            if not existing.data:
                print(f"Found missing AUM for {inst_name}: {combined}")
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

print(f"\nDone! Inserted {inserted_count} missing AUM records.")
