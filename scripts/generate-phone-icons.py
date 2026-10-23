#!/usr/bin/env python3
"""Writes the home-screen icons the phone companion (WS6) adds to public/icons/.

    python3 scripts/generate-phone-icons.py          # write the files
    python3 scripts/generate-phone-icons.py --check  # exit 1 if a file is missing or would change

Needs Pillow (a developer tool; the app and its build do not use it). The PNGs are committed, so
nothing runs this at build time.

  apple-touch-icon-152x152.png, apple-touch-icon-167x167.png
      iPad home-screen sizes, downscaled from the full-bleed maskable icon. iOS rounds the corners
      itself, so these have NO transparent corners (a transparent corner turns black on iOS).
  shortcut-bite-96x96.png, shortcut-urge-96x96.png
      The two Android long-press shortcuts. Plain geometry on the brand's deep green: a solid disc
      for "I bit", a ring for "I feel an urge". Neutral shapes on purpose: DESIGN.md and the owner
      forbid drawing the habit (no hand, mouth, face or figure), so the icons say nothing about it.
      Android masks shortcut icons to a circle, so the shape stays inside the middle 60 percent.
"""
import sys
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
ICONS = ROOT / "public" / "icons"
DEEP = (11, 42, 30)      # public/icons/maskable-512x512.png background
LIME = (198, 242, 78)    # the lens ring
SUPER = 8                # draw at 8x and downscale: smooth edges without a vector library


def downscale_maskable(size: int) -> Image.Image:
    src = Image.open(ICONS / "maskable-512x512.png").convert("RGB")  # full-bleed square, no alpha
    return src.resize((size, size), Image.LANCZOS)


def shortcut(kind: str, size: int = 96) -> Image.Image:
    big = size * SUPER
    img = Image.new("RGB", (big, big), DEEP)
    d = ImageDraw.Draw(img)
    c = big / 2
    r = big * 0.27  # outer radius: 54 percent of the width, inside Android's circular mask
    box = [c - r, c - r, c + r, c + r]
    if kind == "bite":
        d.ellipse(box, fill=LIME)
    else:
        d.ellipse(box, outline=LIME, width=int(big * 0.075))
    return img.resize((size, size), Image.LANCZOS)


def outputs():
    yield "apple-touch-icon-152x152.png", downscale_maskable(152)
    yield "apple-touch-icon-167x167.png", downscale_maskable(167)
    yield "shortcut-bite-96x96.png", shortcut("bite")
    yield "shortcut-urge-96x96.png", shortcut("urge")


def main() -> int:
    check = "--check" in sys.argv
    bad = 0
    for name, img in outputs():
        path = ICONS / name
        if check:
            if not path.exists() or Image.open(path).convert("RGB").tobytes() != img.tobytes():
                print(f"differs or missing: {path.relative_to(ROOT)}")
                bad += 1
        else:
            img.save(path, optimize=True)
            print(f"wrote {path.relative_to(ROOT)}")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
