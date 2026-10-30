"""List the static meshes of the Fab packs added to the project, as JSON, so
build_scene.py can pick trees, plants and furniture by size:

  UnrealEditor BrickHouse.uproject -ExecCmds="py <abs>/Scripts/inventory.py"

Writes ~/Desktop/home-3d/brick/inventory.json: per mesh its path, size in
metres (x, y, z), triangle count of LOD 0, LOD count and whether Nanite is on.
The editor quits when done.
"""

import json
import os

import unreal

PACKS = ["/Game/EuropeanHornbeam", "/Game/NorwayMaple", "/Game/CommonHazel", "/Game/PN_mediterraneanPlants_I",
         "/Game/PN_mediterraneanPlants_II", "/Game/50+FreeAssetPack", "/Game/MODERN_LUXURY_SOFA_1"]
OUT = os.path.expanduser("~/Desktop/home-3d/brick/inventory.json")

eal = unreal.EditorAssetLibrary
reg = unreal.AssetRegistryHelpers.get_asset_registry()


def mesh_info(path):
    m = eal.load_asset(path)
    ext = m.get_bounds().box_extent
    sub = unreal.get_editor_subsystem(unreal.StaticMeshEditorSubsystem)
    try:
        nanite = bool(m.get_editor_property("nanite_settings").enabled)
    except Exception:
        nanite = None
    try:
        tris = sub.get_number_triangles(m, 0) if hasattr(sub, "get_number_triangles") else m.get_num_triangles(0)
    except Exception:
        tris = None
    return {"path": path, "size_m": [round(ext.x / 50, 2), round(ext.y / 50, 2), round(ext.z / 50, 2)],
            "tris_lod0": tris, "lods": m.get_num_lods(), "nanite": nanite}


def main():
    out = {}
    for pack in PACKS:
        if not eal.does_directory_exist(pack):
            out[pack] = "missing"
            continue
        meshes = []
        for a in reg.get_assets_by_path(pack, recursive=True):
            if str(a.asset_class_path.asset_name) == "StaticMesh":
                path = f"{a.package_name}.{a.asset_name}"
                try:
                    meshes.append(mesh_info(path))
                except Exception as e:
                    meshes.append({"path": path, "error": str(e)})
        out[pack] = meshes
        unreal.log(f"[inv] {pack}: {len(meshes)} meshes")
    json.dump(out, open(OUT, "w"), indent=1)
    unreal.log(f"[inv] wrote {OUT}")


_t = {"n": 0, "h": None}


def _tick(dt):
    _t["n"] += 1
    if _t["n"] == 30:
        unreal.unregister_slate_post_tick_callback(_t["h"])
        try:
            main()
        except Exception:
            import traceback
            unreal.log_error("[inv] FAILED " + traceback.format_exc())
        unreal.SystemLibrary.quit_editor()


_t["h"] = unreal.register_slate_post_tick_callback(_tick)
