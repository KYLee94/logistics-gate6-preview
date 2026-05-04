from PIL import Image
import os

try:
    for f in os.listdir('public'):
        if f.endswith('.jpg'):
            file_path = os.path.join('public', f)
            size = os.path.getsize(file_path)
            if size > 90000 and size < 100000:  # ~95543 bytes
                img = Image.open(file_path)
                webp_path = os.path.join('public', '우형석.webp')
                img.save(webp_path, 'webp', quality=85)
                print(f"Converted {file_path} to {webp_path}")
                os.remove(file_path)
                break
except Exception as e:
    print(f"Error: {e}")
