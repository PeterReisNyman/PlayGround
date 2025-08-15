Art Collection

Contents
- ASCII art (art/ascii)
  - flower.txt, mountain.txt, spiral.txt, fox.txt, cat.txt, wave.txt
- SVG artworks (art/svg)
  - sunburst.svg, waves.svg, geometry.svg, spiro.svg, mandala.svg
- Generative canvas sketch (art/generative)
  - index.html (Generative Constellations)
 - Live ASCII Camera Studio (art/ascii_cam)
   - index.html (Webcam to ASCII, presets, trails, recording)

How to view
- ASCII: open the .txt files in any text viewer.
- SVG: open the .svg files in a browser or an image viewer that supports SVG.
- Generative: open art/generative/index.html in a browser.

Mega Art
- A consolidated view is generated at art/mega via the script tools/make_mega_art.py
- Outputs:
  - art/mega/mega_ascii.txt (all ASCII pieces combined with headers)
  - art/mega/mega.svg (grid of all SVGs with labels)
  - art/mega/index.html (simple page to view both)
- To regenerate: run `python3 tools/make_mega_art.py` and open art/mega/index.html

Notes
- Everything is standalone; no build steps required.
