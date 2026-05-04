from PIL import Image
import numpy as np

try:
    img = Image.open('src/assets/cft.webp').convert('RGBA')
    data = np.array(img)
    
    # Target background color
    target = np.array([30, 30, 30])
    # Calculate distance from target color
    diff = np.abs(data[:,:,:3] - target)
    mask = np.all(diff < 15, axis=2) # Tolerance of 15
    
    # Make those pixels transparent
    data[mask, 3] = 0
    
    transparent_img = Image.fromarray(data)
    transparent_img.save('src/assets/cft.webp', 'webp', quality=90, lossless=False)
    print("Made background transparent successfully.")
except Exception as e:
    print(f"Error: {e}")
