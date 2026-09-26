"""Render a .excalidraw file to a static SVG for the design document.

Handles the element types our generator emits: rectangle, ellipse, diamond, arrow, text.
Usage: python docs/excalidraw_to_svg.py docs/architecture.excalidraw docs/img/architecture.svg
"""
import json
import sys
from html import escape

src, out = sys.argv[1], sys.argv[2]
elements = [e for e in json.load(open(src))["elements"] if not e.get("isDeleted")]
xs = [e["x"] for e in elements] + [e["x"] + e.get("width", 0) for e in elements]
ys = [e["y"] for e in elements] + [e["y"] + e.get("height", 0) for e in elements]
pad = 30
minx, miny = min(xs) - pad, min(ys) - pad
w, h = max(xs) - minx + pad, max(ys) - miny + pad

parts = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{minx} {miny} {w} {h}" '
         f'font-family="Helvetica, Arial, sans-serif">',
         '<defs><marker id="head" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" '
         'orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#1e1e1e"/></marker></defs>']


def style(e):
    fill = e.get("backgroundColor", "transparent")
    fill = "none" if fill == "transparent" else fill
    return f'fill="{fill}" stroke="{e.get("strokeColor", "#1e1e1e")}" stroke-width="{e.get("strokeWidth", 2)}"'


for e in elements:
    x, y, ew, eh = e["x"], e["y"], e.get("width", 0), e.get("height", 0)
    if e["type"] == "rectangle":
        parts.append(f'<rect x="{x}" y="{y}" width="{ew}" height="{eh}" rx="14" {style(e)}/>')
    elif e["type"] == "ellipse":
        parts.append(f'<ellipse cx="{x + ew / 2}" cy="{y + eh / 2}" rx="{ew / 2}" ry="{eh / 2}" {style(e)}/>')
    elif e["type"] == "diamond":
        pts = f"{x + ew / 2},{y} {x + ew},{y + eh / 2} {x + ew / 2},{y + eh} {x},{y + eh / 2}"
        parts.append(f'<polygon points="{pts}" {style(e)}/>')
    elif e["type"] == "arrow":
        pts = " ".join(f"{x + px},{y + py}" for px, py in e["points"])
        parts.append(f'<polyline points="{pts}" fill="none" stroke="{e.get("strokeColor", "#1e1e1e")}" '
                     f'stroke-width="2" marker-end="url(#head)"/>')

for e in elements:  # text last, so it sits on top of shapes and arrows
    if e["type"] != "text":
        continue
    size = e.get("fontSize", 16)
    lines = e["text"].split("\n")
    anchor = {"center": "middle", "right": "end"}.get(e.get("textAlign", "left"), "start")
    tx = e["x"] + (e["width"] / 2 if anchor == "middle" else e["width"] if anchor == "end" else 0)
    for i, line in enumerate(lines):
        ty = e["y"] + size * (i + 1) * 1.2 - size * 0.25
        weight = ' font-weight="bold"' if i == 0 and e.get("containerId") else ""
        parts.append(f'<text x="{tx}" y="{ty}" font-size="{size}" text-anchor="{anchor}" '
                     f'fill="{e.get("strokeColor", "#1e1e1e")}"{weight}>{escape(line)}</text>')

parts.append("</svg>")
open(out, "w").write("\n".join(parts))
print(f"wrote {out} ({len(elements)} elements, {int(w)}x{int(h)})")
