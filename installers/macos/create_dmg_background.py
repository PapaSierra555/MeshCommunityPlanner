#!/usr/bin/env python3
"""Generate background PNG for the macOS DMG installer window.

Output: installers/macos/dmg_background.png (600x400, 72 dpi)
Called automatically by build_dmg.sh before create-dmg runs.
Requires Pillow — auto-installs if missing.
"""

import subprocess
import sys

try:
    from PIL import Image, ImageDraw, ImageFont
except ImportError:
    subprocess.check_call([sys.executable, "-m", "pip", "install", "pillow", "-q"])
    from PIL import Image, ImageDraw, ImageFont

from pathlib import Path

W, H = 600, 400

# ── Colours ──────────────────────────────────────────────────────────────────
BG       = (15,  25,  40)   # dark navy
HEADER   = ( 8,  15,  28)   # near-black header bar
TEAL     = ( 0, 188, 212)   # brand teal
ARROW    = (55,  85, 110)   # muted blue-grey arrow
HINT     = (110, 130, 150)  # subdued hint text
BOX_BG   = (22,  38,  58)   # instruction box fill
BOX_EDGE = ( 0, 150, 170)   # instruction box border
WARN     = (255, 200,  55)  # amber warning line
BODY     = (200, 212, 224)  # body text


def _font(size: int) -> ImageFont.FreeTypeFont:
    candidates = [
        "/System/Library/Fonts/Helvetica.ttc",
        "/System/Library/Fonts/SFNSText.ttf",
        "/Library/Fonts/Arial.ttf",
    ]
    for path in candidates:
        try:
            return ImageFont.truetype(path, size)
        except Exception:
            pass
    return ImageFont.load_default()


def main() -> None:
    img = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(img)

    f16 = _font(16)
    f13 = _font(13)
    f11 = _font(11)

    # ── Header bar ───────────────────────────────────────────────────────────
    d.rectangle([0, 0, W, 32], fill=HEADER)
    d.text((W // 2, 16), "Mesh Community Planner", fill=TEAL, font=f16, anchor="mm")

    # ── Drag hint above icons ─────────────────────────────────────────────────
    d.text((W // 2, 90), "Drag to Applications to install", fill=HINT, font=f13, anchor="mm")

    # ── Arrow between icon positions (140,145) → (460,145) ───────────────────
    ax1, ax2, ay = 228, 372, 145
    d.line([(ax1, ay), (ax2 - 14, ay)], fill=ARROW, width=2)
    d.polygon(
        [(ax2 - 14, ay - 6), (ax2, ay), (ax2 - 14, ay + 6)],
        fill=ARROW,
    )

    # ── Instruction box ───────────────────────────────────────────────────────
    bx1, by1, bx2, by2 = 18, 238, W - 18, H - 12
    d.rectangle([bx1, by1, bx2, by2], fill=BOX_BG, outline=BOX_EDGE, width=1)

    d.text(
        (bx1 + 14, by1 + 16),
        "First time on macOS? Gatekeeper will block the app.",
        fill=WARN,
        font=f13,
        anchor="lm",
    )

    steps = [
        "After dragging to Applications:",
        "  1.  Right-click MeshCommunityPlanner  ->  Open",
        "  2.  Click Open in the security dialog",
        "Or open Terminal and run:",
        "     xattr -cr /Applications/MeshCommunityPlanner.app",
    ]
    y = by1 + 42
    for line in steps:
        d.text((bx1 + 14, y), line, fill=BODY, font=f11, anchor="lm")
        y += 19

    out = Path(__file__).parent / "dmg_background.png"
    img.save(str(out), "PNG")
    print(f"[INFO] DMG background saved: {out}")


if __name__ == "__main__":
    main()
