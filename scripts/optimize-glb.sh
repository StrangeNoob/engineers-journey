#!/usr/bin/env bash
# Optimize a raw Meshy GLB for web: weld → simplify → resize texture → Draco.
# Usage: optimize-glb.sh <input.glb> <output.glb> [ratio] [texsize]
#   ratio   target fraction of verts to keep (default 0.02; organic meshes floor higher)
#   texsize max texture dimension (default 1024)
set -euo pipefail
IN="${1:?input.glb}"; OUT="${2:?output.glb}"; RATIO="${3:-0.02}"; TEX="${4:-1024}"
GT() { npx --yes @gltf-transform/cli@4.4.0 "$@"; }
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

before=$(stat -f%z "$IN")
GT weld     "$IN"        "$TMP/a.glb"                                  >/dev/null 2>&1
GT simplify "$TMP/a.glb" "$TMP/b.glb" --ratio "$RATIO" --error 0.02 --lock-border false >/dev/null 2>&1
GT resize   "$TMP/b.glb" "$TMP/c.glb" --width "$TEX" --height "$TEX"   >/dev/null 2>&1
GT draco    "$TMP/c.glb" "$OUT"                                        >/dev/null 2>&1
after=$(stat -f%z "$OUT")

tris=$(python3 -c "
import struct,json
d=open('$OUT','rb').read();off=12;js=None
while off<len(d):
 cl,ct=struct.unpack('<II',d[off:off+8])
 if ct==0x4E4F534A: js=json.loads(d[off+8:off+8+cl])
 off+=8+cl
print(sum(js['accessors'][p['indices']]['count']//3 for m in js['meshes'] for p in m['primitives'] if 'indices' in p))
")
printf '%-34s %6.1f MB -> %5.2f MB  (%s tris)\n' "$(basename "$OUT")" "$(echo "$before/1048576"|bc -l)" "$(echo "$after/1048576"|bc -l)" "$tris"
