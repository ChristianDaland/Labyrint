"""Tegner app-ikonene (gyllent egg på brun bakgrunn) til public/ikoner/.

    uv run --with pillow python verktoy/lag-ikoner.py
"""
import math
from pathlib import Path

from PIL import Image, ImageFilter

OUT = Path(__file__).resolve().parent.parent / "public" / "ikoner"
BG = (59, 42, 30)  # samme brunfarge som rommet
STOPS = [(0.0, (255, 246, 201)), (0.12, (247, 212, 106)), (0.55, (217, 154, 30)), (1.0, (154, 101, 16))]


def gradient(t):
    t = max(0.0, min(1.0, t))
    for (t0, c0), (t1, c1) in zip(STOPS, STOPS[1:]):
        if t <= t1:
            k = (t - t0) / (t1 - t0)
            return tuple(round(a + (b - a) * k) for a, b in zip(c0, c1))
    return STOPS[-1][1]


def icon(size, egg_scale):
    """Egg i midten. egg_scale = eggets høyde som andel av ikonet (mindre for «maskable», som beskjæres)."""
    s = size * 4  # tegnes stort og skaleres ned for glatte kanter
    img = Image.new("RGB", (s, s), BG)
    glow = Image.new("L", (s, s), 0)
    px, gp = img.load(), glow.load()
    h = s * egg_scale / 2  # halv høyde
    w = h * 0.78  # halv bredde
    cx, cy = s / 2, s / 2 + h * 0.03
    hx, hy = cx - w * 0.3, cy - h * 0.4  # lyspunktet
    for y in range(int(cy - h), int(cy + h) + 1):
        v = (y - cy) / h
        if abs(v) > 1:
            continue
        half = w * math.sqrt(1 - v * v) * (1 + 0.12 * v)  # litt bredere nederst, som et egg
        for x in range(int(cx - half), int(cx + half) + 1):
            d = math.hypot((x - hx) / (w * 1.6), (y - hy) / (h * 1.6))
            px[x, y] = gradient(d)
    # Myk glød rundt egget
    for y in range(0, s, 2):
        for x in range(0, s, 2):
            r = math.hypot((x - cx) / (w * 1.5), (y - cy) / (h * 1.35))
            if r < 1.4:
                gp[x, y] = gp[x + 1 if x + 1 < s else x, y] = int(max(0, 1.4 - r) / 1.4 * 110)
    glow = glow.filter(ImageFilter.GaussianBlur(s * 0.03))
    halo = Image.new("RGB", (s, s), (242, 193, 78))
    base = Image.composite(halo, Image.new("RGB", (s, s), BG), glow)
    # Legg egget oppå gløden
    mask = Image.new("L", (s, s), 0)
    mp = mask.load()
    for y in range(s):
        for x in range(s):
            if px[x, y] != BG:
                mp[x, y] = 255
    base.paste(img, (0, 0), mask)
    return base.resize((size, size), Image.LANCZOS)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    for name, size, scale in [("ikon-180.png", 180, 0.62), ("ikon-192.png", 192, 0.62),
                              ("ikon-512.png", 512, 0.62), ("ikon-maskable-512.png", 512, 0.48)]:
        icon(size, scale).save(OUT / name, optimize=True)
        print("laget", name)


if __name__ == "__main__":
    main()
