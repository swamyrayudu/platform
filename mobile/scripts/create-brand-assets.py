from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

assets = Path(__file__).resolve().parent.parent / 'assets'
assets.mkdir(exist_ok=True)
gold = '#8E651F'
font = ImageFont.truetype('C:/Windows/Fonts/segoeuib.ttf', 235)
for name, transparent in [('icon.png', False), ('adaptive-icon.png', True)]:
    image = Image.new('RGBA', (1024, 1024), (0, 0, 0, 0) if transparent else '#FFFEFB')
    draw = ImageDraw.Draw(image)
    if not transparent:
        draw.rounded_rectangle((96, 96, 928, 928), radius=220, fill='#FCF3DE')
    draw.text((512, 315), 'RSD', anchor='mt', font=font, fill=gold)
    draw.line([(310, 620), (405, 620), (512, 661), (619, 620), (714, 620)], fill=gold, width=22, joint='curve')
    draw.line([(310, 620), (310, 740), (405, 740), (512, 781), (619, 740), (714, 740), (714, 620)], fill=gold, width=22, joint='curve')
    draw.line([(512, 661), (512, 781)], fill=gold, width=15)
    image.save(assets / name)
print('Saved RSD application icons')
