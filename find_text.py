import pandas as pd
file_path = "/Users/jkjeon2025/Library/Mobile Documents/com~apple~CloudDocs/JK x IGIS/기획추진/IFPDP/DB 취합/CM CRM (원드라이브 참고)/Investor List_240826.xlsx"
df_dict = pd.read_excel(file_path, sheet_name=None)
for sheet_name, df in df_dict.items():
    for i in range(len(df)):
        row = df.iloc[i]
        row_str = " ".join([str(val) for val in row if pd.notna(val)])
        if "원그로브로" in row_str or "전주사무소" in row_str:
            print(f"FOUND IN {sheet_name}: {row.to_dict()}")
