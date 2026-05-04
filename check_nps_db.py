import os
import json
from supabase import create_client

url = None
key = None
with open(".env.local") as f:
    for line in f:
        if line.startswith("VITE_SUPABASE_URL="):
            url = line.strip().split("=")[1].strip("'\"")
        elif line.startswith("VITE_SUPABASE_ANON_KEY="):
            key = line.strip().split("=")[1].strip("'\"")

supabase = create_client(url, key)
res = supabase.table("counterparties").select("counterparty_id").ilike("name", "%국민연금%").execute()
if len(res.data) > 0:
    cp_id = res.data[0]["counterparty_id"]
    contacts = supabase.table("counterparty_contacts").select("name, title, department, email, metadata, created_at").eq("counterparty_id", cp_id).execute()
    print(f"Total contacts for NPS: {len(contacts.data)}")
    for c in contacts.data:
        print(c)
else:
    print("NPS not found in DB")
