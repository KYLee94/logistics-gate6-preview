import pandas as pd
import re
from datetime import datetime

file_path = "/Users/jkjeon2025/Library/Mobile Documents/com~apple~CloudDocs/JK x IGIS/기획추진/IFPDP/DB 취합/CM CRM (원드라이브 참고)/Investor List_240826.xlsx"
df = pd.read_excel(file_path, sheet_name="1. 국민연금공단")

def clean_val(v):
    if pd.isna(v): return ""
    return str(v).strip()

new_records = []
for i in range(len(df)):
    row = df.iloc[i]
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
        
        remaining_texts = []
        for j in range(4, len(row)):
            c_val = clean_val(row.iloc[j])
            if c_val and c_val != "-":
                remaining_texts.append(c_val)
        
        if remaining_texts:
            topic = remaining_texts[0]
            contents = "\n".join(remaining_texts[1:]) if len(remaining_texts) > 1 else topic
            
            new_records.append({
                "name": topic[:50],
                "title": attendees,
                "department": igis_attendees,
                "created_at": parsed_date,
                "contents_len": len(contents)
            })

print(f"Total dates found: {len(new_records)}")
for r in new_records[:5]:
    print(r)
