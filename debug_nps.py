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
res = supabase.table("counterparties").select("counterparty_id, name").ilike("name", "%국민연금%").execute()
if len(res.data) > 0:
    for cp in res.data:
        print(f"CP: {cp['name']} ({cp['counterparty_id']})")
        contacts = supabase.table("counterparty_contacts").select("name, title, department, email, metadata, created_at").eq("counterparty_id", cp['counterparty_id']).execute()
        print(f"Total contacts: {len(contacts.data)}")
        for c in contacts.data:
            print(c)
else:
    print("NPS not found in DB")
