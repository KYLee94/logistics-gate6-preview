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

res = supabase.table('counterparty_contacts').select('id, name, created_at').eq('counterparty_id', 'CP-0162').execute()

for c in res.data:
    if any(k in c['name'] for k in ['AUM', '프로젝트펀드', '위탁운용펀드']):
        print(f"ID: {c['id']} | Created: {c['created_at']} | Name: {c['name']}")
