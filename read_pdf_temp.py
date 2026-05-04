import sys

try:
    import PyPDF2
    reader = PyPDF2.PdfReader(sys.argv[1])
    for i, page in enumerate(reader.pages):
        print(f"--- Page {i+1} ---")
        print(page.extract_text())
except ImportError:
    print("PyPDF2 not found. Trying another way or please install PyPDF2: pip install PyPDF2")
except Exception as e:
    print(f"Error: {e}")
