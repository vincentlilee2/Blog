#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""生成记忆花园 MemoryGarden 品牌 og 图：600x315（微信卡片）+ 512x512（备用）"""
from PIL import Image, ImageDraw, ImageFont, ImageFilter

FONT_DIR = "/System/Library/Fonts"
FONT_SANS = f"{FONT_DIR}/Hiragino Sans GB.ttc"
FONT_SONG = f"{FONT_DIR}/Supplemental/Songti.ttc"
OUT_DIR = "/Users/vncent/MyCenter/Blog/public/media/images"

GOLD = (201, 169, 97, 255)       # #c9a961
GOLD_SOFT = (168, 138, 76, 255)  # 暗金
CREAM = (238, 231, 214, 255)     # 米白
DEEP1 = (15, 36, 26, 255)        # 深绿
DEEP2 = (9, 24, 17, 255)


def vertical_gradient(w, h, top, bottom):
    img = Image.new("RGB", (w, h))
    px = img.load()
    for y in range(h):
        t = y / (h - 1)
        r = int(top[0] + (bottom[0] - top[0]) * t)
        g = int(top[1] + (bottom[1] - top[1]) * t)
        b = int(top[2] + (bottom[2] - top[2]) * t)
        for x in range(w):
            px[x, y] = (r, g, b)
    return img


def add_halo(img, cx, cy, radius, color, alpha=26, blur=40):
    """在中心画一个柔光圆环光晕"""
    layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    d.ellipse([cx - radius, cy - radius, cx + radius, cy + radius],
              outline=(*color[:3], alpha), width=2)
    layer = layer.filter(ImageFilter.GaussianBlur(blur))
    img.paste(Image.alpha_composite(img.convert("RGBA"), layer).convert("RGB"), (0, 0))


def add_text_center(d, cx, y, text, font, fill, letter_spacing=0):
    """逐字绘制以支持字间距"""
    widths = [d.textlength(ch, font=font) for ch in text]
    total = sum(widths) + letter_spacing * (len(text) - 1)
    x = cx - total / 2
    for ch, w in zip(text, widths):
        d.text((x, y), ch, font=font, fill=fill)
        x += w + letter_spacing


def add_text_center_upper(d, cx, y, text, font, fill, letter_spacing=0):
    """大写字母逐字绘制，模拟宽字距"""
    widths = [d.textlength(ch, font=font) for ch in text]
    total = sum(widths) + letter_spacing * (len(text) - 1)
    x = cx - total / 2
    for ch, w in zip(text, widths):
        d.text((x, y), ch, font=font, fill=fill)
        x += w + letter_spacing


def make_og():
    W, H = 600, 315
    img = vertical_gradient(W, H, DEEP1, DEEP2)
    d = ImageDraw.Draw(img)

    # 装饰：上方小圆环 + 下方细金线
    add_halo(img, W // 2, 128, 95, GOLD, alpha=30, blur=36)
    d.ellipse([W // 2 - 78, 50, W // 2 + 78, 206], outline=(*GOLD[:3], 70), width=2)
    d.ellipse([W // 2 - 64, 64, W // 2 + 64, 192], outline=(*GOLD[:3], 45), width=1)

    f_top = ImageFont.truetype(FONT_SANS, 15)
    f_name = ImageFont.truetype(FONT_SONG, 54)
    f_sub = ImageFont.truetype(FONT_SANS, 17)

    add_text_center_upper(d, W // 2, 84, "MEMORY  GARDEN", f_top, (GOLD_SOFT[0], GOLD_SOFT[1], GOLD_SOFT[2], 255), letter_spacing=6)
    add_text_center(d, W // 2, 130, "记忆花园", f_name, GOLD, letter_spacing=10)
    add_text_center(d, W // 2, 218, "让记忆，开花结果", f_sub, CREAM, letter_spacing=4)

    # 底部金线
    d.line([W // 2 - 60, 262, W // 2 + 60, 262], fill=(*GOLD[:3], 160), width=1)
    d.ellipse([W // 2 - 3, 259, W // 2 + 3, 265], fill=(*GOLD[:3], 255))

    img.save(f"{OUT_DIR}/card-og.png")
    print("saved card-og.png", img.size)


def make_logo():
    S = 512
    img = vertical_gradient(S, S, DEEP1, DEEP2)
    d = ImageDraw.Draw(img)
    add_halo(img, S // 2, S // 2 - 20, 150, GOLD, alpha=34, blur=60)

    # 双圆环
    d.ellipse([S // 2 - 128, S // 2 - 148, S // 2 + 128, S // 2 + 108], outline=(*GOLD[:3], 90), width=3)
    d.ellipse([S // 2 - 108, S // 2 - 128, S // 2 + 108, S // 2 + 88], outline=(*GOLD[:3], 55), width=1)

    # 圆内大字母 V（金色）
    f_v = ImageFont.truetype(FONT_SONG, 120)
    vw = d.textlength("V", font=f_v)
    d.text((S // 2 - vw / 2, S // 2 - 118), "V", font=f_v, fill=GOLD)

    f_cn = ImageFont.truetype(FONT_SONG, 40)
    add_text_center(d, S // 2, S // 2 + 40, "记忆花园", f_cn, GOLD, letter_spacing=12)

    f_en = ImageFont.truetype(FONT_SANS, 20)
    add_text_center_upper(d, S // 2, S // 2 + 120, "MEMORY  GARDEN", f_en, (GOLD_SOFT[0], GOLD_SOFT[1], GOLD_SOFT[2], 255), letter_spacing=8)

    img.save(f"{OUT_DIR}/card-logo.png")
    print("saved card-logo.png", img.size)


def make_og_square():
    """方形 600x600 微信聊天卡片缩略图（微信对横图显示不佳，方形最稳）"""
    S = 600
    img = vertical_gradient(S, S, DEEP1, DEEP2)
    d = ImageDraw.Draw(img)

    add_halo(img, S // 2, 290, 160, GOLD, alpha=34, blur=60)
    d.ellipse([S // 2 - 150, 140, S // 2 + 150, 440], outline=(*GOLD[:3], 90), width=3)
    d.ellipse([S // 2 - 126, 164, S // 2 + 126, 416], outline=(*GOLD[:3], 55), width=1)

    # 圆内大 V
    f_v = ImageFont.truetype(FONT_SONG, 130)
    vw = d.textlength("V", font=f_v)
    d.text((S // 2 - vw / 2, 168), "V", font=f_v, fill=GOLD)

    f_top = ImageFont.truetype(FONT_SANS, 17)
    f_name = ImageFont.truetype(FONT_SONG, 52)
    f_sub = ImageFont.truetype(FONT_SANS, 22)
    f_tail = ImageFont.truetype(FONT_SANS, 16)

    add_text_center_upper(d, S // 2, 455, "MEMORY  GARDEN", f_top, (GOLD_SOFT[0], GOLD_SOFT[1], GOLD_SOFT[2], 255), letter_spacing=8)
    add_text_center(d, S // 2, 488, "记忆花园", f_name, GOLD, letter_spacing=12)
    add_text_center(d, S // 2, 548, "电子名片 · Vincent", f_sub, CREAM, letter_spacing=3)

    img.save(f"{OUT_DIR}/card-og-square.png")
    print("saved card-og-square.png", img.size)


if __name__ == "__main__":
    make_og()
    make_logo()
    make_og_square()
