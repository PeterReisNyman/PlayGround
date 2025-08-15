#!/usr/bin/env python3
"""
Generate a simple spirograph-style SVG without external dependencies.

Usage:
  python tools/generate_spiro.py > art/svg/spiro.svg
"""

import math
from typing import List, Tuple


def spiro_points(R: float, r: float, p: float, steps: int = 4000) -> List[Tuple[float, float]]:
    pts = []
    # Hypotrochoid parametric equations
    for i in range(steps + 1):
        t = 2 * math.pi * i / steps
        x = (R - r) * math.cos(t) + p * math.cos(((R - r) / r) * t)
        y = (R - r) * math.sin(t) - p * math.sin(((R - r) / r) * t)
        pts.append((x, y))
    return pts


def path_d(pts: List[Tuple[float, float]]) -> str:
    if not pts:
        return ""
    it = iter(pts)
    x0, y0 = next(it)
    cmds = [f"M {x0:.3f},{y0:.3f}"]
    for x, y in it:
        cmds.append(f"L {x:.3f},{y:.3f}")
    return " ".join(cmds)


def make_svg(R=120.0, r=45.0, p=65.0, size=512) -> str:
    pts = spiro_points(R, r, p)
    d = path_d(pts)
    margin = 20
    view = size - 2 * margin
    # center transform
    svg = f"""
<svg xmlns='http://www.w3.org/2000/svg' width='{size}' height='{size}' viewBox='0 0 {size} {size}'>
  <defs>
    <radialGradient id='bg' cx='50%' cy='50%'>
      <stop offset='0%' stop-color='#0b132b'/>
      <stop offset='100%' stop-color='#111827'/>
    </radialGradient>
    <linearGradient id='line' x1='0' y1='0' x2='1' y2='1'>
      <stop offset='0%' stop-color='#80ffdb'/>
      <stop offset='50%' stop-color='#64dfdf'/>
      <stop offset='100%' stop-color='#5390d9'/>
    </linearGradient>
  </defs>
  <rect width='100%' height='100%' fill='url(#bg)'/>
  <g transform='translate({size/2},{size/2}) scale(1,-1)'>
    <path d='{d}' fill='none' stroke='url(#line)' stroke-width='2'/>
  </g>
</svg>
"""
    return svg


if __name__ == "__main__":
    print(make_svg())

