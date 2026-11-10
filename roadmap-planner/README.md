# Brick Roadmap Planner

A simple, dependency-free roadmap planner that turns a photo of a paper roadmap
(white paper "bricks" on a darker surface) into an editable digital board.

**Run it:** open `index.html` in any modern browser. No install or build step.
Everything runs locally in the browser; the photo never leaves your machine.

## Features

- **Photo → bricks.** Upload a photo and the app finds the white paper bricks
  (brightness + low colour tint mask, morphological cleanup, connected
  components). Each brick is cut out of the photo and placed on a grid in the
  same rows and columns as in the photo. A preview shows what was detected.
  The threshold, tint tolerance, "separate touching" strength and minimum
  brick size can be tuned, then **Re-detect**.
- **Try a sample photo** generates a test photo so you can try it without one.
- **Board styling.** Change the background colour, cell width and height, brick
  padding, number of columns and rows, and the brick look (photo cut-out or
  clean white).
- **Grid lines.** Thin grey by default; change their colour and thickness, or hide them.
- **Moving bricks.** Each brick sits in one grid cell. You can drag a brick to
  any cell, or select it and use the arrow keys or the ↑ ← → ↓ buttons to move
  it along the X/Y axis. If you drop it on an occupied cell, that brick and
  every brick directly behind it are pushed along one cell. The push direction
  is configurable: right along the row (default), down the column, or reading
  order (wraps to the next row). The grid grows when it needs more room.
- **Text.** Click a brick to type on it (or use the side panel). The font colour
  defaults to black and can be changed. The font size is **auto-sized** to
  fit the brick by default; turn auto-size off to set it manually.
- **Other:** add, duplicate and delete bricks (double-click an empty cell to add
  one), undo (Ctrl/Cmd+Z), export as PNG, and save/load as JSON. Your board is
  autosaved in the browser.

## Tips for good detection

- Use a background that contrasts with the paper (a wooden table or dark cloth).
- Leave a small gap between bricks; if neighbouring bricks merge into one,
  raise **Separate touching**.
- If shadows or glare are being picked up, raise **Min brick size** or lower
  **Max colour tint**.
