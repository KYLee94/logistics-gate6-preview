import os
import sys
from PIL import Image

sys.path.append('/Users/jkjeon2025/Library/Python/3.9/lib/python/site-packages')

public_dir = 'public'

for filename in os.listdir(public_dir):
    if filename.endswith('.jpg') and not filename.startswith('iota'): # Assuming those are person photos
        filepath = os.path.join(public_dir, filename)
        webp_filename = os.path.splitext(filename)[0] + '.webp'
        webp_filepath = os.path.join(public_dir, webp_filename)
        
        try:
            with Image.open(filepath) as img:
                # Optionally resize if too big (e.g., > 800px)
                img.thumbnail((800, 800))
                # Convert to webp
                img.save(webp_filepath, 'webp', quality=85)
                print(f"Converted {filename} to {webp_filename}")
            # Delete original to save space
            os.remove(filepath)
        except Exception as e:
            print(f"Failed to convert {filename}: {e}")
