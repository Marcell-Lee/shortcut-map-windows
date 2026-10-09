from pathlib import Path

from PIL import Image, ImageDraw


size = 256
canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
draw = ImageDraw.Draw(canvas)
draw.rounded_rectangle((12, 12, 244, 244), radius=55, fill="#1f2e42")
draw.rounded_rectangle((39, 66, 217, 189), radius=18, outline="#f6f8fb", width=9)

for row, count in enumerate((6, 6, 5)):
    offset = 57 + (8 if row == 2 else 0)
    top = 86 + row * 30
    for column in range(count):
        left = offset + column * 27
        color = "#65c997" if row == 1 and column == 3 else "#f6f8fb"
        draw.rounded_rectangle((left, top, left + 19, top + 18), radius=4, fill=color)

assets = Path(__file__).resolve().parent.parent / "assets"
assets.mkdir(exist_ok=True)
canvas.save(assets / "shortcut-map.ico", sizes=[(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])
