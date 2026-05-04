import pandas as pd
import re

file_path = "/Users/jkjeon2025/Library/Mobile Documents/com~apple~CloudDocs/JK x IGIS/기획추진/IFPDP/DB 취합/CM CRM (원드라이브 참고)/Investor List_240826.xlsx"
df = pd.read_excel(file_path, sheet_name="1. 국민연금공단")

print("All dates found in column 1:")
for i in range(len(df)):
    row = df.iloc[i]
    if len(row) > 1:
        val = str(row.iloc[1]).strip()
        if '-' in val or '.' in val or '202' in val:
            print(val)
