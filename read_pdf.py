import PyPDF2
import sys

file_path = "/Users/jkjeon2025/Downloads/IOTA_CFT_Work_Platform_POC_무엇이_있어야_작동하는가.pdf"

try:
    with open(file_path, "rb") as file:
        reader = PyPDF2.PdfReader(file)
        text = ""
        for i, page in enumerate(reader.pages):
            text += f"\n--- Page {i+1} ---\n"
            text += page.extract_text()
        print(text)
except Exception as e:
    print(f"Error reading PDF: {e}")
