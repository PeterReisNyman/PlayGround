from __future__ import annotations

from pathlib import Path
import html


ASCII_DIR = Path("art/ascii")
SVG_DIR = Path("art/svg")
OUT_DIR = Path("art/mega")


def build_mega_ascii() -> str:
    parts: list[str] = []
    if not ASCII_DIR.exists():
        return ""
    for p in sorted(ASCII_DIR.glob("*.txt")):
        title = f"== {p.stem} =="
        parts.append(title)
        parts.append("".join(["-" for _ in range(len(title))]))
        parts.append(p.read_text(encoding="utf-8"))
        parts.append("")
    mega = "\n".join(parts).rstrip() + "\n"
    (OUT_DIR / "mega_ascii.txt").write_text(mega, encoding="utf-8")
    return mega


def build_mega_svg() -> str:
    files = sorted(SVG_DIR.glob("*.svg")) if SVG_DIR.exists() else []
    if not files:
        svg = (
            "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"800\" height=\"200\">"
            "<text x=\"20\" y=\"100\" font-size=\"24\">No SVGs found</text>"
            "</svg>"
        )
        (OUT_DIR / "mega.svg").write_text(svg, encoding="utf-8")
        return svg

    cols = 3
    cell_w, cell_h = 420, 460
    pad = 16
    rows = (len(files) + cols - 1) // cols
    width = cols * cell_w
    height = rows * cell_h

    lines: list[str] = []
    lines.append(
        f"<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"{width}\" height=\"{height}\" shape-rendering=\"geometricPrecision\">"
    )
    lines.append("<style> text{font-family: system-ui, sans-serif;} </style>")

    for idx, p in enumerate(files):
        r, c = divmod(idx, cols)
        x = c * cell_w
        y = r * cell_h
        label = html.escape(p.stem)
        href = p.as_posix()
        img_h = cell_h - 2 * pad - 36
        lines.append(
            f"<g transform=\"translate({x},{y})\">"
            f"<rect x=\"0\" y=\"0\" width=\"{cell_w}\" height=\"{cell_h}\" fill=\"#f8f9fa\" stroke=\"#e5e7eb\"/>"
            f"<image href=\"{href}\" x=\"{pad}\" y=\"{pad}\" width=\"{cell_w-2*pad}\" height=\"{img_h}\" preserveAspectRatio=\"xMidYMid meet\"/>"
            f"<text x=\"{cell_w/2}\" y=\"{cell_h-10}\" text-anchor=\"middle\" font-size=\"14\">{label}</text>"
            f"</g>"
        )

    lines.append("</svg>")
    svg_out = "".join(lines)
    (OUT_DIR / "mega.svg").write_text(svg_out, encoding="utf-8")
    return svg_out


def build_mega_html(mega_ascii: str):
    svg_rel = "mega.svg"
    html_out = f"""
<!doctype html>
<html>
  <head>
    <meta charset=\"utf-8\" />
    <meta name=\"viewport\" content=\"width=device-width,initial-scale=1\" />
    <title>Mega Art</title>
    <style>
      body {{ font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; margin: 0; padding: 24px; background: #fff; color: #111; }}
      h1 {{ margin: 0 0 16px; }}
      .grid {{ display: grid; grid-template-columns: 1fr; gap: 24px; }}
      .panel {{ border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; }}
      .panel h2 {{ margin: 0; padding: 12px 16px; background: #f3f4f6; font-size: 16px; }}
      .panel .content {{ padding: 16px; }}
      pre {{ margin: 0; white-space: pre; overflow: auto; max-height: 70vh; }}
      .svg-wrap {{ width: 100%; overflow: auto; }}
      .svg-wrap img, .svg-wrap object, .svg-wrap svg {{ max-width: 100%; height: auto; display: block; }}
    </style>
  </head>
  <body>
    <h1>Mega Art</h1>
    <div class=\"grid\">
      <div class=\"panel\">
        <h2>ASCII Mega</h2>
        <div class=\"content\">
          <pre>{html.escape(mega_ascii)}</pre>
        </div>
      </div>
      <div class=\"panel\">
        <h2>SVG Mega</h2>
        <div class=\"content svg-wrap\">
          <object type=\"image/svg+xml\" data=\"{svg_rel}\"></object>
        </div>
      </div>
    </div>
  </body>
  </html>
"""
    (OUT_DIR / "index.html").write_text(html_out, encoding="utf-8")


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    mega_ascii = build_mega_ascii()
    build_mega_svg()
    build_mega_html(mega_ascii)


if __name__ == "__main__":
    main()
