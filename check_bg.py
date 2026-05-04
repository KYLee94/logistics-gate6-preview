from PIL import Image

try:
    img = Image.open('src/assets/cft.webp').convert('RGB')
    # Get pixel at top-left corner
    bg_color = img.getpixel((0, 0))
    print(f"Top-left pixel color: {bg_color}")
except Exception as e:
    print(f"Error: {e}")
