import pandas as pd
import re

file_path = "/Users/jkjeon2025/Library/Mobile 시Documents/com~apple~CloudDocs/JK x IGIS/기획추진/IFPDP/DB 취합/CM CRM (원드라이브 참고)/Investor List_240826.xlsx"
df = pd.read_excel(file_path.replace('시', ''), sheet_name="1. 국민연금공단")

# Print headers
print("Columns:", df.columns.tolist())

# Print any row that looks like a date in the second column (index 1) or any column
for i in range(len(df)):
    row = df.iloc[i]
    for j, val in enumerate(row):
        val_str = str(val)
        if re.search(r'\d{4}-\d{2}-\d{2}', val_str) or '2026' in val_str:
            print(f"Row {i}, Col {j} ({df.columns[j]}): {val}")
            print(row.to_dict())
            print("-" * 50)
            break
