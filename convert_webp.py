from PIL import Image

try:
    img = Image.open('public/cft.jpg')
    img.save('src/assets/cft.webp', 'webp', quality=85)
    print("Converted successfully.")
except Exception as e:
    print(f"Error: {e}")
