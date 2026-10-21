#!/usr/bin/env bash
# Render charts/chart.html variants to images/*.png at 2x (needs the local server on :6001)
CHROME="/c/Program Files/Google/Chrome/Application/chrome.exe"
OUT="$(cd "$(dirname "$0")/.." && pwd -W)/images"
mkdir -p "$OUT"
for v in for against; do
  for r in "" "&reveal"; do
    name="$v${r:+_reveal}"
    "$CHROME" --headless=new --disable-gpu --disk-cache-size=1 --user-data-dir="$(cd "$(dirname "$0")" && pwd -W)/.chrome-render" --hide-scrollbars --force-device-scale-factor=2 \
      --window-size=720,1100 --virtual-time-budget=6000 \
      --screenshot="$OUT/$name.png" "http://localhost:6001/charts/chart.html?v=$v$r&t=$(date +%s%N)" 2>/dev/null
    python - "$OUT/$name.png" <<'PY'
import sys, numpy as np
from PIL import Image
p = sys.argv[1]; im = Image.open(p).convert("RGB"); a = np.asarray(im)
rows = np.where((a < 245).any(axis=(1, 2)))[0]
im.crop((0, 0, min(im.width, 1440), min(im.height, rows.max() + 36))).save(p)
PY
    echo "$name"
  done
done
