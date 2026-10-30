#!/bin/bash
# Rebuilds the assets of the 3D tab in public/models/ from the Blender export
# and the Poly Haven (CC0) downloads in ~/Desktop/home-3d.
#
#   scripts/house-3d-assets.sh            # all three steps
#
# Needs node (npx), cwebp and ffmpeg. Output: brick-house.glb (~5.5 MB),
# tex/*.webp (~2.5 MB), sky.hdr (1.2 MB).
set -euo pipefail

HOME3D=${HOME3D:-$HOME/Desktop/home-3d}
OUT=$(cd "$(dirname "$0")/.." && pwd)/public/models
G="npx -y @gltf-transform/cli@4.5.1"
T=$(mktemp -d)
trap 'rm -rf "$T"' EXIT
mkdir -p "$OUT/tex"

# 1. Model. Step by step rather than `optimize`: optimize merges identical
#    materials (losing names the viewer needs), flattens the storey groups the
#    cutaway hides, and drops the metre UVs of untextured surfaces.
$G dedup "$HOME3D/brick/home_brick_ue.glb" "$T/1.glb" --materials false
$G weld "$T/1.glb" "$T/2.glb"
$G prune "$T/2.glb" "$T/3.glb" --keep-attributes true
$G resize "$T/3.glb" "$T/4.glb" --width 1024 --height 1024
$G webp "$T/4.glb" "$T/5.glb"
$G meshopt "$T/5.glb" "$OUT/brick-house.glb" --level high

# 2. Textures, 1k WebP. name, Poly Haven set, ffmpeg filter for the colour map
#    ("-" keeps it as shot, "none" ships no colour map), normal map size.
#    stone and paving are desaturated: the viewer tints them per surface.
SRC="$HOME3D/assets/polyhaven/tex"
while read -r name set filter nor; do
  base="$SRC/$set/$set"
  if [ "$filter" != none ]; then
    [ "$filter" = - ] && filter=null
    ffmpeg -y -loglevel error -i "${base}_diff_2k.jpg" -vf "$filter,scale=1024:1024:flags=lanczos" "$T/d.png"
    cwebp -quiet -q 82 "$T/d.png" -o "$OUT/tex/${name}_diff.webp"
  fi
  cwebp -quiet -q 88 -resize "$nor" "$nor" "${base}_nor_gl_2k.jpg" -o "$OUT/tex/${name}_nor.webp"
  # Roughness is low-frequency: half the resolution looks the same.
  cwebp -quiet -q 80 -resize 512 512 "${base}_rough_2k.jpg" -o "$OUT/tex/${name}_rough.webp"
done <<'SETS'
stone   granite_tile_04         hue=s=0,eq=contrast=0.55:brightness=0.22 1024
paving  concrete_tiles          hue=s=0,eq=contrast=0.6:brightness=0.2   512
oak     oak_veneer_01           -                                        1024
planks  dark_wooden_planks      -                                        1024
floor   laminate_floor_02       -                                        1024
metal   box_profile_metal_sheet none                                     1024
plaster painted_plaster_wall    -                                        512
grass   leafy_grass             hue=h=28:s=1.25,eq=brightness=0.02       512
SETS

# 3. Sky for the lighting: Poly Haven's 1k qwantani_dusk_2_puresky (CC0).
#    Their CDN answers 403 without a User-Agent.
curl -sf -A "Mozilla/5.0 (armenia-home-calculator)" -o "$OUT/sky.hdr" \
  https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/qwantani_dusk_2_puresky_1k.hdr

ls -la "$OUT" "$OUT/tex"
