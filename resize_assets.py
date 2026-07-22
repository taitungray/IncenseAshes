from PIL import Image
import os

source_dir = r"C:\Users\user\.gemini\antigravity-ide\brain\997f81a3-e9dd-4cd3-ba7e-c86bf899f6d4"
target_dir = r"C:\IncenseAshes\screenshots"

os.makedirs(target_dir, exist_ok=True)

app_icon_path = os.path.join(source_dir, "app_icon_1784760366713.png")
gameplay_path = os.path.join(source_dir, "gameplay_screenshot_1784760375467.png")
ui_path = os.path.join(source_dir, "ui_screenshot_1784760384322.png")

# 1. App Icon 512x512
icon_img = Image.open(app_icon_path)
icon_512 = icon_img.resize((512, 512), Image.Resampling.LANCZOS)
icon_512.save(os.path.join(target_dir, "app_icon_512.png"))

# 2. Feature Graphic 1024x500
feat_img = Image.open(gameplay_path)
w, h = feat_img.size
if w != 1024:
    ratio = 1024 / w
    feat_img = feat_img.resize((1024, int(h * ratio)), Image.Resampling.LANCZOS)
    w, h = feat_img.size

left = 0
top = (h - 500) // 2
right = 1024
bottom = top + 500
feat_500 = feat_img.crop((left, top, right, bottom))
feat_500.save(os.path.join(target_dir, "feature_graphic.png"))

# 3. Screenshots (9:16)
def make_screenshot(img_path, out_name):
    img = Image.open(img_path)
    w, h = img.size
    
    target_ratio = 9/16
    
    target_w = int(h * target_ratio)
    left = (w - target_w) // 2
    right = left + target_w
    top = 0
    bottom = h
    
    cropped = img.crop((left, top, right, bottom))
    final = cropped.resize((1080, 1920), Image.Resampling.LANCZOS)
    final.save(os.path.join(target_dir, out_name))

make_screenshot(gameplay_path, "screenshot_1.png")
make_screenshot(ui_path, "screenshot_2.png")

print("Assets resized and saved successfully to " + target_dir)
