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

print("Fetching all contacts (handling pagination)...")
all_contacts = []
start = 0
limit = 1000

while True:
    res = supabase.table("counterparty_contacts").select("id, counterparty_id, name").range(start, start + limit - 1).execute()
    data = res.data
    if not data:
        break
    all_contacts.extend(data)
    if len(data) < limit:
        break
    start += limit

print(f"Total contacts fetched: {len(all_contacts)}")

seen = set()
duplicates = []

for c in all_contacts:
    if not c['name']: continue
    
    # AUM/Fund records are identified by having these keywords
    if any(k in c['name'] for k in ['AUM', '프로젝트펀드', '위탁운용펀드', '모펀드기준', '조원', '운용자산']):
        # Ignore things that are clearly notes or logs
        if c['name'].startswith('-') or '회의록' in c['name']:
            continue
            
        # Create a unique key for the contact
        identifier = (c['counterparty_id'], c['name'].strip())
        
        if identifier in seen:
            duplicates.append(c['id'])
        else:
            seen.add(identifier)

print(f"Found {len(duplicates)} duplicates. Deleting...")

if duplicates:
    for i in range(0, len(duplicates), 100):
        chunk = duplicates[i:i+100]
        supabase.table("counterparty_contacts").delete().in_("id", chunk).execute()
    print("Duplicates deleted successfully.")
else:
    print("No duplicates found.")

