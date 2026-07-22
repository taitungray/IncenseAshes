import os
from PIL import Image

path = r'c:\IncenseAshes\assets\app_icon.png'
backup_path = r'c:\IncenseAshes\assets\app_icon_backup.png'

img = Image.open(path)
img.save(backup_path) # save a backup just in case

bbox = (127, 125, 897, 930)
cropped = img.crop(bbox)

w = bbox[2] - bbox[0]
h = bbox[3] - bbox[1]
max_dim = max(w, h)

# Fill background with corner color
bg_color = img.getpixel((0,0))
sq_img = Image.new(img.mode, (max_dim, max_dim), bg_color)
sq_img.paste(cropped, ((max_dim - w) // 2, (max_dim - h) // 2))

final_img = sq_img.resize((1024, 1024), Image.Resampling.LANCZOS)
final_img.save(path)
print("Border removed and saved.")
