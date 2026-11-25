"""Draws the toolbar icons (three coloured tab-group bars) without any image library."""
import struct, sys, zlib
from pathlib import Path

BARS = [(26, 115, 232), (30, 142, 62), (249, 171, 0)]  # blue, green, yellow

def pixel(x, y, n):
    u, v = (x + 0.5) / n, (y + 0.5) / n
    for i, colour in enumerate(BARS):
        top = 0.12 + i * 0.28
        left = 0.10 + (0.12 if i == 1 else 0)
        if top <= v <= top + 0.20 and left <= u <= 0.90:
            return (*colour, 255)
    return (0, 0, 0, 0)

def png(n):
    rows = b"".join(b"\x00" + b"".join(bytes(pixel(x, y, n)) for x in range(n)) for y in range(n))
    chunk = lambda t, d: struct.pack(">I", len(d)) + t + d + struct.pack(">I", zlib.crc32(t + d))
    return (b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", n, n, 8, 6, 0, 0, 0))
            + chunk(b"IDAT", zlib.compress(rows, 9)) + chunk(b"IEND", b""))

out = Path(sys.argv[1] if len(sys.argv) > 1 else "icons")
for n in (16, 32, 48, 128):
    (out / f"icon{n}.png").write_bytes(png(n))
