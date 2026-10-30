"""Download the Poly Haven (CC0) assets build_brick.py renders with.

  python3 tools/render/blender/fetch_polyhaven.py

Textures at 2k (diffuse, GL normal, roughness), models as glTF at 1k, one
HDRI at 4k, into <HOME3D>/assets/polyhaven/{tex,<model>,hdri} (HOME3D defaults
to ~/Desktop/home-3d, as in build_brick.py). Already present files are skipped.
"""

import json
import os
import urllib.request

ROOT = os.path.join(os.environ.get("HOME3D", os.path.expanduser("~/Desktop/home-3d")), "assets", "polyhaven")
TEXTURES = ["beige_wall_002", "dark_wooden_planks", "box_profile_metal_sheet", "oak_veneer_01", "concrete_tiles",
            "laminate_floor_03", "poly_wool_herringbone", "rough_linen", "knitted_fleece", "cotton_jersey",
            "leafy_grass", "laminate_floor_02", "painted_plaster_wall"]
MODELS = ["island_tree_01", "tree_small_02", "jacaranda_tree", "pine_tree_01", "fir_tree_01", "fern_02",
          "wild_rooibos_bush", "grass_bermuda_01",
          # furniture and decor placed by build_brick.py
          "mid_century_lounge_chair", "modern_arm_chair_01", "modern_ceiling_lamp_01", "modern_coffee_table_01",
          "modern_wooden_cabinet", "outdoor_table_chair_set_01", "potted_plant_01", "potted_plant_02",
          "potted_plant_04", "book_encyclopedia_set_01", "ceramic_vase_01",
          "ceramic_vase_02", "ceramic_vase_03", "standing_picture_frame_01", "wooden_bowl_01", "side_table_01"]
HDRI = "kloppenheim_06_puresky"


def get(url, path):
    if os.path.exists(path) and os.path.getsize(path) > 0:
        return
    os.makedirs(os.path.dirname(path), exist_ok=True)
    req = urllib.request.Request(url, headers={"User-Agent": "home-3d-builder"})
    with urllib.request.urlopen(req) as r, open(path, "wb") as fh:
        fh.write(r.read())


def files(asset):
    req = urllib.request.Request(f"https://api.polyhaven.com/files/{asset}", headers={"User-Agent": "home-3d-builder"})
    return json.load(urllib.request.urlopen(req))


for t in TEXTURES:
    f = files(t)
    for kind, key in (("Diffuse", "diff"), ("nor_gl", "nor_gl"), ("Rough", "rough")):
        get(f[kind]["2k"]["jpg"]["url"], os.path.join(ROOT, "tex", t, f"{t}_{key}_2k.jpg"))
    print("tex", t)
for m in MODELS:
    g = files(m)["gltf"]["1k"]["gltf"]
    get(g["url"], os.path.join(ROOT, m, f"{m}_1k.gltf"))
    for rel, inc in g["include"].items():
        get(inc["url"], os.path.join(ROOT, m, rel))
    print("model", m)
h = files(HDRI)["hdri"]["4k"]["hdr"]["url"]
get(h, os.path.join(ROOT, "hdri", f"{HDRI}_4k.hdr"))
print("hdri", HDRI)
