#!/usr/bin/env python3
"""
Generate Android launcher icons and splash screens from official CampusOS brand assets.
"""
import os
from PIL import Image, ImageDraw

PROJECT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
SOURCE_ICON = os.path.join(PROJECT_DIR, "frontend", "public", "icons", "icon-512x512.png")
RES_DIR = os.path.join(PROJECT_DIR, "frontend", "android", "app", "src", "main", "res")

ICON_SIZES = {
    "mipmap-mdpi": (48, 48),
    "mipmap-hdpi": (72, 72),
    "mipmap-xhdpi": (96, 96),
    "mipmap-xxhdpi": (144, 144),
    "mipmap-xxxhdpi": (192, 192),
}

FOREGROUND_SIZES = {
    "mipmap-mdpi": (108, 108),
    "mipmap-hdpi": (162, 162),
    "mipmap-xhdpi": (216, 216),
    "mipmap-xxhdpi": (324, 324),
    "mipmap-xxxhdpi": (432, 432),
}

SPLASH_SIZES = {
    "drawable": (480, 800),
    "drawable-port-mdpi": (320, 480),
    "drawable-port-hdpi": (480, 800),
    "drawable-port-xhdpi": (720, 1280),
    "drawable-port-xxhdpi": (960, 1600),
    "drawable-port-xxxhdpi": (1280, 1920),
    "drawable-land-mdpi": (480, 320),
    "drawable-land-hdpi": (800, 480),
    "drawable-land-xhdpi": (1280, 720),
    "drawable-land-xxhdpi": (1600, 960),
    "drawable-land-xxxhdpi": (1920, 1280),
}

BRAND_BG = (16, 20, 28, 255)  # #10141c brand surface dark

def create_circular_icon(img):
    w, h = img.size
    mask = Image.new("L", (w, h), 0)
    draw = ImageDraw.Draw(mask)
    draw.ellipse((0, 0, w - 1, h - 1), fill=255)
    output = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    output.paste(img, (0, 0), mask=mask)
    return output

def main():
    if not os.path.exists(SOURCE_ICON):
        print(f"Error: Source icon not found at {SOURCE_ICON}")
        return

    base_img = Image.open(SOURCE_ICON).convert("RGBA")

    # 1. Launcher and Round icons
    for folder, size in ICON_SIZES.items():
        folder_path = os.path.join(RES_DIR, folder)
        os.makedirs(folder_path, exist_ok=True)

        # Standard icon
        icon_img = base_img.resize(size, Image.Resampling.LANCZOS)
        icon_path = os.path.join(folder_path, "ic_launcher.png")
        icon_img.save(icon_path, "PNG")

        # Round icon
        round_img = create_circular_icon(icon_img)
        round_path = os.path.join(folder_path, "ic_launcher_round.png")
        round_img.save(round_path, "PNG")

    # 2. Foreground icons
    for folder, size in FOREGROUND_SIZES.items():
        folder_path = os.path.join(RES_DIR, folder)
        fg_canvas = Image.new("RGBA", size, (0, 0, 0, 0))
        # Place logo in center with ~60% size for Android adaptive icon safe zone
        icon_dim = int(size[0] * 0.6)
        scaled_logo = base_img.resize((icon_dim, icon_dim), Image.Resampling.LANCZOS)
        pos = ((size[0] - icon_dim) // 2, (size[1] - icon_dim) // 2)
        fg_canvas.paste(scaled_logo, pos, mask=scaled_logo)
        fg_path = os.path.join(folder_path, "ic_launcher_foreground.png")
        fg_canvas.save(fg_path, "PNG")

    # 3. Splash screens
    for folder, size in SPLASH_SIZES.items():
        folder_path = os.path.join(RES_DIR, folder)
        os.makedirs(folder_path, exist_ok=True)
        splash_canvas = Image.new("RGBA", size, BRAND_BG)
        # Center the logo in splash
        logo_dim = min(int(min(size) * 0.38), 300)
        scaled_logo = base_img.resize((logo_dim, logo_dim), Image.Resampling.LANCZOS)
        pos = ((size[0] - logo_dim) // 2, (size[1] - logo_dim) // 2)
        splash_canvas.paste(scaled_logo, pos, mask=scaled_logo)
        splash_path = os.path.join(folder_path, "splash.png")
        splash_canvas.save(splash_path, "PNG")

    # 4. Update ic_launcher_background.xml
    bg_xml_path = os.path.join(RES_DIR, "values", "ic_launcher_background.xml")
    if os.path.exists(bg_xml_path):
        with open(bg_xml_path, "w") as f:
            f.write('<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#10141c</color>\n</resources>\n')

    print("Successfully generated all Android launcher icons and splash screens!")

if __name__ == "__main__":
    main()
