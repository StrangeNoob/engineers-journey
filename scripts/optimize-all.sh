#!/usr/bin/env bash
# Batch-optimize every raw Middle-earth asset into public/assets/models/.
# Format per line: "<srcRelPath>|<outName>|<ratio>|<tex>"
set -euo pipefail
SRC="../new_portfolio/designs/assets/gen/middle-earth"
OUT="public/assets/models"
OPT="scripts/optimize-glb.sh"
[ -d "$SRC" ] || { echo "error: source dir not found: $SRC" >&2; exit 1; }
mkdir -p "$OUT"
items=(
  "buildings/argonath.glb|argonath|0.4|1024"
  "buildings/bree-inn.glb|bree-inn|0.4|1024"
  "buildings/bywater-mill.glb|bywater-mill|0.4|1024"
  "buildings/edoras-hall.glb|edoras-hall|0.4|1024"
  "buildings/isengard-tower.glb|isengard-tower|0.4|1024"
  "buildings/minas-tirith.glb|minas-tirith|0.4|1024"
  "environment/mallorn-tree-1.glb|mallorn-tree-1|0.2|1024"
  "environment/mallorn-tree-2.glb|mallorn-tree-2|0.2|1024"
  "environment/mallorn-tree-3.glb|mallorn-tree-3|0.2|1024"
  "environment/grass-tuft.glb|grass-tuft|0.2|512"
  "environment/mountain-backdrop.glb|mountain-backdrop|0.2|1024"
  "environment/mountain-backdrop_square.glb|mountain-backdrop-square|0.2|1024"
  "environment/stream-straight.glb|stream-straight|0.1|512"
  "environment/stream-curve.glb|stream-curve|0.1|512"
  "environment/the-fountain.glb|the-fountain|0.15|1024"
  "environment/well.glb|well|0.15|1024"
  "environment/roads/stone-road-crossing.glb|road-crossing|0.05|512"
  "environment/roads/stone-road-fork.glb|road-fork|0.05|512"
  "environment/roads/stone-road-end.glb|road-end|0.05|512"
  "environment/covered-wagon.glb|covered-wagon|0.15|1024"
  "environment/campfire-rest-point.glb|campfire|0.15|1024"
  "environment/market-stall.glb|market-stall|0.15|1024"
  "environment/signpost.glb|signpost|0.15|512"
  "environment/route-marker-red.glb|route-marker|0.15|512"
  "environment/portfolio-scroll.glb|portfolio-scroll|0.2|512"
)
for it in "${items[@]}"; do
  IFS='|' read -r src out ratio tex <<<"$it"
  [ -f "$OUT/$out.glb" ] && { echo "skip $out (exists)"; continue; }
  [ -f "$SRC/$src" ] || { echo "error: missing source: $SRC/$src" >&2; exit 1; }
  bash "$OPT" "$SRC/$src" "$OUT/$out.glb" "$ratio" "$tex"
done
echo "=== done. sizes: ==="
ls -la "$OUT"/*.glb | awk '{printf "%7.2f MB  %s\n",$5/1048576,$9}'
