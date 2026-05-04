import pandas as pd
df = pd.read_excel('/Users/jkjeon2025/Library/Mobile Documents/com~apple~CloudDocs/JK x IGIS/기획추진/IFPDP/DB 취합/CM CRM (원드라이브 참고)/Investor List_240826.xlsx', sheet_name='2. 농협중앙회')
def clean_val(v):
    if pd.isna(v): return ""
    return str(v).strip()
for i in range(min(10, len(df))):
    row_vals = []
    is_aum = False
    for col in df.columns:
        val = clean_val(df.iloc[i][col])
        if val:
            row_vals.append(val)
            if 'AUM' in val or '프로젝트펀드' in val or '위탁운용펀드' in val:
                is_aum = True
    if is_aum:
        print(f"AUM ROW FOUND: {' '.join(row_vals)}")
