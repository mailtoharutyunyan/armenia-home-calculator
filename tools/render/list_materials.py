"""Print, as Markdown, every material slot, texture and model the renders use,
read from the scripts themselves, for docs/RENDERING.md:

  python3 tools/render/list_materials.py

Sources: PBR / FLAT / PLANT_MODELS / TUFTS in unreal/Scripts/build_scene.py (what
Unreal draws), MATERIALS and asset(...) calls in blender/build_brick.py (every
slot in the model and the Poly Haven models placed in it).
"""

import ast
import os
import re

HERE = os.path.dirname(os.path.abspath(__file__))
UE = os.path.join(HERE, "unreal", "Scripts", "build_scene.py")
BL = os.path.join(HERE, "blender", "build_brick.py")


def tables(path, names):
    out = {}
    for node in ast.parse(open(path).read()).body:
        if isinstance(node, ast.Assign) and isinstance(node.targets[0], ast.Name) and node.targets[0].id in names:
            out[node.targets[0].id] = eval(compile(ast.Expression(node.value), path, "eval"))
    return out


def source(tex):
    if tex.startswith("acg:"):
        return f"[{tex[4:]}](https://ambientcg.com/view?id={tex[4:]}) (ambientCG)"
    return f"[{tex}](https://polyhaven.com/a/{tex}) (Poly Haven)"


def main():
    ue = tables(UE, ("PBR", "FLAT", "PLANT_MODELS"))
    bl = tables(BL, ("MATERIALS",))
    pbr, flat = ue["PBR"], ue["FLAT"]

    print("| Слот | Текстура | Плотность, м на повтор | Tint | Roughness × | Доп. параметры M_PBR3 |")
    print("|---|---|---|---|---|---|")
    for slot, (tex, tiling, tint, rscale, metal, *rest) in pbr.items():
        extra = ", ".join(f"{k} {v}" for k, v in (rest[0] if rest else {}).items()) or "—"
        print(f"| `{slot}` | {source(tex)} | {1 / tiling:.2f} | {tuple(round(c, 2) for c in tint)} | {rscale} | {extra} |")

    print("\n| Слот | Мастер | Цвет (линейный) | Roughness | Metallic |")
    print("|---|---|---|---|---|")
    for slot, (master, col, rough, metal) in flat.items():
        print(f"| `{slot}` | `{master}` | {col} | {rough} | {metal} |")

    rest = [s for s in bl["MATERIALS"] if s not in pbr and s not in flat]
    print("\nОстальные слоты модели идут в Unreal с цветом из glTF (без текстуры): "
          + ", ".join(f"`{s}`" for s in rest) + ".")

    models = sorted(set(re.findall(r'asset\("([a-z0-9_]+)"', open(BL).read())))
    plants = sorted({n for names, _ in ue["PLANT_MODELS"].values() for n in names} | set(tables(UE, ("TUFTS",))["TUFTS"]))
    print("\nМодели Poly Haven (CC0, glTF 1k):")
    print("- мебель и декор: " + ", ".join(f"[{m}](https://polyhaven.com/a/{m})" for m in models))
    print("\nРастения на участке (Fab: Megascans Common Hazel, Mediterranean Plant Pack I/II): "
          + ", ".join(f"`{m}`" for m in plants))
    print("\nДеревья и мебель Fab в props.json: см. `fab(...)` в build_brick.py.")


if __name__ == "__main__":
    main()
