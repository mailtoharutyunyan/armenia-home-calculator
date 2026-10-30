"""Build the brick house scene in Unreal Engine 5 for photoreal stills.

Run inside the editor (Tools > Execute Python Script) or headless:
  UnrealEditor BrickHouse.uproject -ExecutePythonScript=Scripts/build_scene.py

Inputs (all local, made by ~/Desktop/home-3d/build_brick.py --ue):
  brick/home_brick_ue.glb   house + hardscape, one material slot per surface
  brick/cameras.json        shots, metres, Z up, X along the facade, Y to the back
  brick/lights.json         interior and soffit lights (2900 K)
  brick/plants.json         planting positions and the 25 x 20 m plot
  assets/polyhaven/...      CC0 textures, HDRIs and plant models

Everything this script makes lives under /Game/Brick and in /Game/Maps/House.
"""

import json
import math
import os

import unreal

HOME = os.path.expanduser("~/Desktop/home-3d")
BRICK = os.path.join(HOME, "brick")
PH = os.path.join(HOME, "assets", "polyhaven")
ROOT = "/Game/Brick"
MAP = "/Game/Maps/House"

tools = unreal.AssetToolsHelpers.get_asset_tools()
mel = unreal.MaterialEditingLibrary
eal = unreal.EditorAssetLibrary
actors = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
levels = unreal.get_editor_subsystem(unreal.LevelEditorSubsystem)


def log(*a):
    unreal.log("[brick] " + " ".join(str(x) for x in a))


# --------------------------------------------------------------------------- import

def import_files(files, dest):
    tasks = []
    for f in files:
        t = unreal.AssetImportTask()
        t.filename = f
        t.destination_path = dest
        t.automated = True
        t.replace_existing = True
        t.save = True
        tasks.append(t)
    tools.import_asset_tasks(tasks)
    out = []
    for t in tasks:
        out += [eal.load_asset(p) for p in t.imported_object_paths]
    return out


ACG = os.path.join(HOME, "assets", "ambientcg")
ACG_MAPS = {"diff": "Color", "nor_gl": "NormalGL", "rough": "Roughness"}


def texture(name, kind):
    """A CC0 texture (diff / nor_gl / rough), imported once: Poly Haven by
    name, ambientCG as "acg:<AssetId>"."""
    asset = name.replace("acg:", "acg_")
    path = f"{ROOT}/Tex/{asset}_{kind}"
    if eal.does_asset_exist(path):
        return eal.load_asset(path)
    if name.startswith("acg:"):
        aid = name[4:]
        src = os.path.join(ACG, aid, f"{aid}_2K-JPG_{ACG_MAPS[kind]}.jpg")
        # import under the asset name the cache above looks for
        tmp = os.path.join(ACG, aid, f"{asset}_{kind}.jpg")
        if not os.path.exists(tmp):
            import shutil
            shutil.copyfile(src, tmp)
        src = tmp
    else:
        src = os.path.join(PH, "tex", name, f"{name}_{kind}_2k.jpg")
    tex = import_files([src], f"{ROOT}/Tex")[0]
    if kind != "diff":
        tex.set_editor_property("srgb", False)
    if kind == "nor_gl":
        tex.set_editor_property("compression_settings", unreal.TextureCompressionSettings.TC_NORMALMAP)
    eal.save_loaded_asset(tex)
    return tex


# --------------------------------------------------------------------------- materials

def link(a, a_out, b, names):
    """Connect a's output to the first of b's input names the engine knows."""
    known = []
    try:  # the engine's own pin names, when this version can list them
        known = [str(n) for n in mel.get_material_expression_input_names(b)]
    except Exception:
        pass
    for n in names + [k for k in known if k not in names][:1]:
        if mel.connect_material_expressions(a, a_out, b, n):
            return
    raise RuntimeError(f"no input {names} on {b.get_class().get_name()}, it has {known}")


def master_pbr():
    """M_PBR3: base colour x tint, normal, roughness; UVs are metres, scaled by
    Tiling. On top of the texture:
      Desat           0..1 grey the texture out, so the tint sets the colour
      JointSize       panel size (u, v) in metres, JointHalfWidth > 0 draws
                      the joints, darkened by JointDarken and fully rough
      PanelVariation  +- tone per panel, as cut stone slabs differ
    Defaults leave the plain texture (v2 behaviour)."""
    # v2: every sampler carries a default texture of its own type (colour,
    # normal map, linear); with the engine default texture the material did
    # not compile and Unreal drew its checkerboard instead.
    path = f"{ROOT}/Materials/M_PBR3"
    if eal.does_asset_exist(path):
        return eal.load_asset(path)
    m = tools.create_asset("M_PBR3", f"{ROOT}/Materials", unreal.Material, unreal.MaterialFactoryNew())
    E = lambda cls, x, y: mel.create_material_expression(m, cls, x, y)

    def param(cls, name, value, x, y):
        e = E(cls, x, y)
        e.set_editor_property("parameter_name", name)
        e.set_editor_property("default_value", value)
        return e

    def op(cls, a, b, x, y, a_out="", b_out="", const_b=None):
        e = E(cls, x, y)
        link(a, a_out, e, ["A"])
        if b is not None:
            link(b, b_out, e, ["B"])
        elif const_b is not None:
            e.set_editor_property("const_b", const_b)
        return e

    def mask(src, x, y, *ch):
        e = E(unreal.MaterialExpressionComponentMask, x, y)
        for c in "rgba":
            e.set_editor_property(c, c in ch)
        link(src, "", e, ["", "Input"])
        return e

    def one(cls, src, x, y):
        e = E(cls, x, y)
        link(src, "", e, ["", "Input"])
        return e

    defaults = {k: texture("concrete_tile_facade", k) for k in ("diff", "nor_gl", "rough")}
    uv = E(unreal.MaterialExpressionTextureCoordinate, -2200, 0)
    tiling = param(unreal.MaterialExpressionScalarParameter, "Tiling", 1.0, -2200, 120)
    mul = op(unreal.MaterialExpressionMultiply, uv, tiling, -2000, 40)

    def sampler(name, y, stype, default):
        s = E(unreal.MaterialExpressionTextureSampleParameter2D, -1700, y)
        s.set_editor_property("parameter_name", name)
        s.set_editor_property("texture", default)
        s.set_editor_property("sampler_type", stype)
        link(mul, "", s, ["UVs"])
        return s

    base = sampler("BaseColor", -300, unreal.MaterialSamplerType.SAMPLERTYPE_COLOR, defaults["diff"])
    nrm = sampler("Normal", 0, unreal.MaterialSamplerType.SAMPLERTYPE_NORMAL, defaults["nor_gl"])
    rough = sampler("Roughness", 300, unreal.MaterialSamplerType.SAMPLERTYPE_LINEAR_COLOR, defaults["rough"])

    # colour: desaturate, tint, per-panel tone
    desat = E(unreal.MaterialExpressionDesaturation, -1400, -300)
    link(base, "RGB", desat, ["", "Input"])
    link(param(unreal.MaterialExpressionScalarParameter, "Desat", 0.0, -1600, -420), "", desat, ["Fraction"])
    tint = param(unreal.MaterialExpressionVectorParameter, "Tint", unreal.LinearColor(1, 1, 1, 1), -1400, -450)
    tinted = op(unreal.MaterialExpressionMultiply, desat, tint, -1200, -350)

    # joints: distance in metres to the nearest panel edge along u and v
    size = mask(param(unreal.MaterialExpressionVectorParameter, "JointSize", unreal.LinearColor(1, 1, 0, 0),
                      -2200, 600), -2000, 600, "r", "g")
    q = op(unreal.MaterialExpressionDivide, uv, size, -1800, 600)
    f = one(unreal.MaterialExpressionFrac, q, -1600, 600)
    near = op(unreal.MaterialExpressionMin, f, one(unreal.MaterialExpressionOneMinus, f, -1600, 700), -1400, 600)
    dist = op(unreal.MaterialExpressionMultiply, near, size, -1200, 600)
    edge = op(unreal.MaterialExpressionMin, mask(dist, -1000, 560, "r"), mask(dist, -1000, 660, "g"), -800, 600)
    half = op(unreal.MaterialExpressionMax, param(unreal.MaterialExpressionScalarParameter, "JointHalfWidth", 0.0,
                                                  -1000, 760), None, -800, 760, const_b=0.00001)
    joint = one(unreal.MaterialExpressionSaturate,
                one(unreal.MaterialExpressionOneMinus, op(unreal.MaterialExpressionDivide, edge, half, -600, 650),
                    -450, 650), -300, 650)

    # per-panel tone: value noise of the panel index, 1 +- PanelVariation
    cell = one(unreal.MaterialExpressionFloor, q, -1600, 900)
    pos = E(unreal.MaterialExpressionAppendVector, -1400, 900)
    link(cell, "", pos, ["A"])
    zero = E(unreal.MaterialExpressionConstant, -1600, 1000)
    link(zero, "", pos, ["B"])
    noise = E(unreal.MaterialExpressionNoise, -1200, 900)
    link(pos, "", noise, ["Position", ""])
    for k, v in (("scale", 0.37), ("output_min", 0.0), ("output_max", 1.0), ("levels", 1), ("quality", 1)):
        noise.set_editor_property(k, v)
    spread = op(unreal.MaterialExpressionSubtract, op(unreal.MaterialExpressionMultiply, noise, None, -1000, 900,
                                                      const_b=2.0), None, -850, 900, const_b=1.0)
    var = op(unreal.MaterialExpressionMultiply, spread,
             param(unreal.MaterialExpressionScalarParameter, "PanelVariation", 0.0, -850, 1000), -700, 900)
    tone = op(unreal.MaterialExpressionAdd, var, None, -550, 900, const_b=1.0)
    toned = op(unreal.MaterialExpressionMultiply, tinted, tone, -1000, -250)

    dark = op(unreal.MaterialExpressionMultiply, toned,
              param(unreal.MaterialExpressionScalarParameter, "JointDarken", 0.5, -1000, -100), -800, -150)
    colour = E(unreal.MaterialExpressionLinearInterpolate, -600, -250)
    link(toned, "", colour, ["A"])
    link(dark, "", colour, ["B"])
    link(joint, "", colour, ["Alpha"])

    rmul = param(unreal.MaterialExpressionScalarParameter, "RoughnessScale", 1.0, -1400, 420)
    rr = op(unreal.MaterialExpressionMultiply, rough, rmul, -1200, 320, a_out="R")
    rfinal = E(unreal.MaterialExpressionLinearInterpolate, -600, 320)
    link(rr, "", rfinal, ["A"])
    rfinal.set_editor_property("const_b", 1.0)
    link(joint, "", rfinal, ["Alpha"])
    metal = param(unreal.MaterialExpressionScalarParameter, "Metallic", 0.0, -400, 500)
    mel.connect_material_property(colour, "", unreal.MaterialProperty.MP_BASE_COLOR)
    mel.connect_material_property(nrm, "RGB", unreal.MaterialProperty.MP_NORMAL)
    mel.connect_material_property(rfinal, "", unreal.MaterialProperty.MP_ROUGHNESS)
    mel.connect_material_property(metal, "", unreal.MaterialProperty.MP_METALLIC)
    mel.recompile_material(m)
    eal.save_loaded_asset(m)
    return m


def master_flat(name, translucent=False, emissive=False):
    """Untextured masters: glass, water, glowing lamp shades, plain paint."""
    path = f"{ROOT}/Materials/{name}"
    if eal.does_asset_exist(path):
        return eal.load_asset(path)
    m = tools.create_asset(name, f"{ROOT}/Materials", unreal.Material, unreal.MaterialFactoryNew())
    col = mel.create_material_expression(m, unreal.MaterialExpressionVectorParameter, -500, 0)
    col.set_editor_property("parameter_name", "Color")
    rough = mel.create_material_expression(m, unreal.MaterialExpressionScalarParameter, -500, 200)
    rough.set_editor_property("parameter_name", "Roughness")
    rough.set_editor_property("default_value", 0.5)
    metal = mel.create_material_expression(m, unreal.MaterialExpressionScalarParameter, -500, 300)
    metal.set_editor_property("parameter_name", "Metallic")
    mel.connect_material_property(col, "", unreal.MaterialProperty.MP_BASE_COLOR)
    mel.connect_material_property(rough, "", unreal.MaterialProperty.MP_ROUGHNESS)
    mel.connect_material_property(metal, "", unreal.MaterialProperty.MP_METALLIC)
    if translucent:
        m.set_editor_property("blend_mode", unreal.BlendMode.BLEND_TRANSLUCENT)
        op = mel.create_material_expression(m, unreal.MaterialExpressionScalarParameter, -500, 400)
        op.set_editor_property("parameter_name", "Opacity")
        op.set_editor_property("default_value", 0.12)
        mel.connect_material_property(op, "", unreal.MaterialProperty.MP_OPACITY)
        spec = mel.create_material_expression(m, unreal.MaterialExpressionConstant, -500, 500)
        spec.set_editor_property("r", 1.0)
        mel.connect_material_property(spec, "", unreal.MaterialProperty.MP_SPECULAR)
    if name == "M_Sheer":  # voile: light passes, both sides lit, no glassy sheen
        m.set_editor_property("blend_mode", unreal.BlendMode.BLEND_TRANSLUCENT)
        m.set_editor_property("two_sided", True)
        op = mel.create_material_expression(m, unreal.MaterialExpressionScalarParameter, -500, 400)
        op.set_editor_property("parameter_name", "Opacity")
        op.set_editor_property("default_value", 0.55)
        mel.connect_material_property(op, "", unreal.MaterialProperty.MP_OPACITY)
    if emissive:
        e = mel.create_material_expression(m, unreal.MaterialExpressionScalarParameter, -700, 100)
        e.set_editor_property("parameter_name", "Glow")
        e.set_editor_property("default_value", 20.0)
        em = mel.create_material_expression(m, unreal.MaterialExpressionMultiply, -300, 100)
        mel.connect_material_expressions(col, "", em, "A")
        mel.connect_material_expressions(e, "", em, "B")
        mel.connect_material_property(em, "", unreal.MaterialProperty.MP_EMISSIVE_COLOR)
    mel.recompile_material(m)
    eal.save_loaded_asset(m)
    return m


# slot name -> (texture set or None, tiling per metre, tint, roughness scale, metallic[, M_PBR3 extras])
# Texture sets are Poly Haven CC0; their real size sets the tiling (1 / metres per tile).
PBR = {
    # light beige stone render, as on the project's renders
    # ambientCG CC0: beige travertine, dark wood siding, warm wood soffit
    # 1200 x 600 mm slabs with 8 mm joints, as on the drawings' facade
    "Facade_Travertine": ("acg:Travertine009", 1 / 1.5, (1.0, 0.97, 0.9), 1.0, 0,
                          {"JointSize": (1.2, 0.6), "JointHalfWidth": 0.004, "JointDarken": 0.3,
                           "PanelVariation": 0.07}),
    "Facade_Plinth": ("acg:Travertine009", 1 / 1.5, (0.8, 0.77, 0.72), 1.0, 0,
                      {"JointSize": (1.2, 0.45), "JointHalfWidth": 0.004, "JointDarken": 0.3,
                       "PanelVariation": 0.07}),
    "Facade_WoodPanel": ("acg:WoodSiding008", 1 / 2.0, (1.0, 0.95, 0.9), 1.0, 0),
    "Soffit_Wood": ("acg:WoodFloor064", 1 / 2.0, (1.0, 0.92, 0.82), 0.9, 0),
    "Pergola_Wood": ("dark_wooden_planks", 1 / 2.0, (0.7, 0.58, 0.48), 1.0, 0),
    "Fence_Render": ("acg:Plaster001", 1 / 2.0, (0.9, 0.87, 0.82), 1.0, 0),
    "Wall_Paint": ("painted_plaster_wall", 1 / 2.0, (1.0, 0.98, 0.95), 1.0, 0),
    "Ceiling_Paint": ("painted_plaster_wall", 1 / 2.0, (1.0, 1.0, 0.98), 1.0, 0),
    # warm oak planks, low roughness so the sun glints on them (mean 0.52 x 0.6)
    "Floor_Oak": ("laminate_floor_03", 1 / 2.0, (1.0, 0.95, 0.9), 0.6, 0),
    "Stair_Wood": ("oak_veneer_01", 1 / 1.5, (0.9, 0.75, 0.58), 0.8, 0),
    "Paving": ("granite_tile_04", 1 / 2.0, (0.95, 0.95, 0.95), 1.0, 0),
    "Paving_Terrace": ("granite_tile_04", 1 / 2.0, (1.0, 0.98, 0.95), 1.0, 0),
    "Paving_Drive": ("concrete_tiles", 1 / 2.0, (0.85, 0.85, 0.85), 1.0, 0),
    "Lawn": ("acg:Grass004", 1 / 1.5, (0.95, 1.0, 0.9), 1.0, 0),
    "Door_Entrance": ("dark_wooden_planks", 1 / 2.0, (0.55, 0.42, 0.32), 0.8, 0),
    "Concrete": ("grey_plaster", 1 / 2.0, (0.72, 0.70, 0.66), 1.0, 0),
    "Pool_Shell": ("granite_tile_04", 1 / 1.0, (0.75, 0.85, 0.9), 0.6, 0),
    "Floor_Stone": ("granite_tile_04", 1 / 2.0, (1.0, 0.98, 0.94), 0.6, 0),
    "Floor_Tile": ("granite_tile_04", 1 / 1.2, (1.0, 1.0, 1.0), 0.5, 0),
    # fabrics: weave in the normal map; greyed textures take the tint as colour
    # (tints set from each texture's mean luminance to the wanted albedo)
    "Fabric_Sofa": ("poly_wool_herringbone", 1 / 0.5, (1.05, 1.0, 0.95), 1.0, 0),
    "Fabric_Accent": ("poly_wool_herringbone", 1 / 0.5, (0.8, 0.95, 0.85), 1.0, 0),
    "Fabric_Bedding": ("rough_linen", 1 / 0.6, (1.85, 1.82, 1.75), 1.0, 0, {"Desat": 1.0}),
    "Curtain_Linen": ("rough_linen", 1 / 0.6, (0.76, 0.71, 0.63), 1.0, 0, {"Desat": 1.0}),
    "Rug_Wool": ("knitted_fleece", 1 / 0.6, (6.0, 5.5, 4.8), 1.2, 0, {"Desat": 1.0}),
    "Fabric_Throw": ("cotton_jersey", 1 / 0.4, (1.0, 0.97, 0.92), 1.0, 0),
    "Fabric_Cushion": ("cotton_jersey", 1 / 0.4, (1.15, 0.65, 0.45), 1.0, 0),
}
FLAT = {
    "Glass": ("M_Glass", (0.02, 0.03, 0.03), 0.02, 0),
    "Water": ("M_Glass", (0.05, 0.25, 0.3), 0.02, 0),
    "Window_Frame": ("M_Flat", (0.03, 0.03, 0.035), 0.35, 0.6),
    "Fascia_Metal": ("M_Flat", (0.035, 0.035, 0.04), 0.4, 0.6),
    "Metal_Dark": ("M_Flat", (0.03, 0.03, 0.035), 0.4, 0.6),
    "Railing_Steel": ("M_Flat", (0.04, 0.04, 0.045), 0.35, 0.6),
    "Light_Emissive": ("M_Glow", (1.0, 0.78, 0.55), 0.5, 0),
    "Curtain_Sheer": ("M_Sheer", (0.85, 0.84, 0.82), 0.9, 0),
    "Soil": ("M_Flat", (0.05, 0.035, 0.025), 1.0, 0),
    # dark grey standing seam, as on the project's renders
    "Roof_MetalSeam": ("M_Flat", (0.045, 0.047, 0.05), 0.45, 0.7),
}


def instance(name):
    """An existing material instance, or a new one: re-runs update in place
    instead of asking the editor to overwrite."""
    path = f"{ROOT}/Materials/{name}"
    if eal.does_asset_exist(path):
        return eal.load_asset(path)
    return tools.create_asset(name, f"{ROOT}/Materials", unreal.MaterialInstanceConstant,
                              unreal.MaterialInstanceConstantFactoryNew())


def material_for(slot, cache={}):
    if slot in cache:
        return cache[slot]
    mi = None
    if slot in PBR:
        tex, tiling, tint, rscale, metallic, *rest = PBR[slot]
        extra = {"Desat": 0.0, "JointSize": (1.0, 1.0), "JointHalfWidth": 0.0, "JointDarken": 0.5,
                 "PanelVariation": 0.0, **(rest[0] if rest else {})}
        mi = instance(f"MI_{slot}")
        mel.set_material_instance_parent(mi, master_pbr())
        mel.set_material_instance_texture_parameter_value(mi, "BaseColor", texture(tex, "diff"))
        mel.set_material_instance_texture_parameter_value(mi, "Normal", texture(tex, "nor_gl"))
        mel.set_material_instance_texture_parameter_value(mi, "Roughness", texture(tex, "rough"))
        mel.set_material_instance_scalar_parameter_value(mi, "Tiling", tiling)
        mel.set_material_instance_scalar_parameter_value(mi, "RoughnessScale", rscale)
        mel.set_material_instance_scalar_parameter_value(mi, "Metallic", metallic)
        mel.set_material_instance_vector_parameter_value(mi, "Tint", unreal.LinearColor(*tint, 1))
        for k, v in extra.items():  # every MI sets all of them: re-runs reset old values
            if isinstance(v, tuple):
                mel.set_material_instance_vector_parameter_value(mi, k, unreal.LinearColor(*v, 0, 0))
            else:
                mel.set_material_instance_scalar_parameter_value(mi, k, v)
    elif slot in FLAT:
        master, col, rough, metal = FLAT[slot]
        parent = master_flat(master, translucent=master == "M_Glass", emissive=master == "M_Glow")
        mi = instance(f"MI_{slot}")
        mel.set_material_instance_parent(mi, parent)
        mel.set_material_instance_vector_parameter_value(mi, "Color", unreal.LinearColor(*col, 1))
        mel.set_material_instance_scalar_parameter_value(mi, "Roughness", rough)
        mel.set_material_instance_scalar_parameter_value(mi, "Metallic", metal)
    if mi:
        eal.save_loaded_asset(mi)
    cache[slot] = mi
    return mi


# --------------------------------------------------------------------------- frame

class Frame:
    """Our metres (X along the facade, Y to the back, Z up) to Unreal centimetres.

    The glTF importer's axis convention is checked against the plot's lawn,
    whose corners are known in both frames, instead of being assumed."""

    def __init__(self, plot_min, plot_max, lawn_bounds):
        lo, hi = lawn_bounds
        best = None
        for swap in (False, True):
            for sx in (1, -1):
                for sy in (1, -1):
                    pts = [self._map(x, y, swap, sx, sy) for x in (plot_min[0], plot_max[0]) for y in (plot_min[1], plot_max[1])]
                    err = abs(min(p[0] for p in pts) - lo.x) + abs(max(p[0] for p in pts) - hi.x) + \
                        abs(min(p[1] for p in pts) - lo.y) + abs(max(p[1] for p in pts) - hi.y)
                    if best is None or err < best[0]:
                        best = (err, swap, sx, sy)
        self.err, self.swap, self.sx, self.sy = best
        log("frame", "swap" if self.swap else "keep", self.sx, self.sy, "error cm", round(self.err, 1))

    @staticmethod
    def _map(x, y, swap, sx, sy):
        a, b = (y, x) if swap else (x, y)
        return (sx * a * 100, sy * b * 100)

    def v(self, p):
        x, y = self._map(p[0], p[1], self.swap, self.sx, self.sy)
        return unreal.Vector(x, y, p[2] * 100)


# --------------------------------------------------------------------------- scene

def new_level():
    """Open the House map empty: an existing one is cleared, not deleted
    (deleting the open map fails). One plain level file, no World Partition."""
    if eal.does_asset_exist(MAP):
        levels.load_level(MAP)
        for a in actors.get_all_level_actors():
            actors.destroy_actor(a)
    else:
        try:
            levels.new_level(MAP, False)
        except TypeError:
            levels.new_level(MAP)
    world = unreal.get_editor_subsystem(unreal.UnrealEditorSubsystem).get_editor_world()
    log("building into", world.get_path_name())


def set_any(obj, names, value):
    """Set a property under the first of its spellings the object has
    (Blueprint variables keep their display names)."""
    for n in names:
        try:
            obj.set_editor_property(n, value)
            return
        except Exception:
            pass
    log("no property", names, "on", obj.get_name())


def spawn(cls, loc=(0, 0, 0), rot=(0, 0, 0)):
    """rot is (pitch, yaw, roll); unreal.Rotator's positional order is roll, pitch, yaw."""
    pitch, yaw, roll = rot
    a = actors.spawn_actor_from_class(cls, unreal.Vector(*loc), unreal.Rotator(roll=roll, pitch=pitch, yaw=yaw))
    root = a.get_editor_property("root_component")
    if root and isinstance(a, unreal.Light):
        # no baked lighting in this project: lights are movable
        root.set_editor_property("mobility", unreal.ComponentMobility.MOVABLE)
    return a


def import_house():
    """The glb as a scene: Interchange keeps every node's transform. A
    previous import is deleted first: re-importing meshes still being built
    asynchronously crashes the editor (StaticMeshBuild AsyncTask assert)."""
    if eal.does_directory_exist(f"{ROOT}/House"):
        eal.delete_directory(f"{ROOT}/House")
    before = set(a.get_name() for a in actors.get_all_level_actors())
    mgr = unreal.InterchangeManager.get_interchange_manager_scripted()
    src = unreal.InterchangeManager.create_source_data(os.path.join(BRICK, "home_brick_ue.glb"))
    params = unreal.ImportAssetParameters()
    params.is_automated = True
    mgr.import_scene(f"{ROOT}/House", src, params)
    house = [a for a in actors.get_all_level_actors() if a.get_name() not in before]
    log("house actors", len(house))
    return house


def retexture(house):
    """Every static mesh slot named after a surface gets its real material."""
    done = set()
    assigned, missing = set(), set()
    for a in house:
        for comp in a.get_components_by_class(unreal.StaticMeshComponent):
            mesh = comp.static_mesh
            if not mesh or mesh.get_path_name() in done:
                continue
            done.add(mesh.get_path_name())
            for i, sm in enumerate(mesh.static_materials):
                slot = str(sm.material_slot_name)
                mi = material_for(slot)
                if mi:
                    mesh.set_material(i, mi)
                    assigned.add(slot)
                else:
                    missing.add(slot)
            eal.save_loaded_asset(mesh)
    log("materials assigned", sorted(assigned))
    log("slots left as imported", sorted(missing))


def lawn_bounds(house):
    for a in house:
        for comp in a.get_components_by_class(unreal.StaticMeshComponent):
            if comp.static_mesh and any(str(m.material_slot_name) == "Lawn" for m in comp.static_mesh.static_materials):
                o, e = a.get_actor_bounds(False)
                return (o - e, o + e)
    raise RuntimeError("no lawn in the import")


# Golden hour in Yerevan, as architectural photographers shoot it: the real
# sun for the site and date (Sun Position Calculator), a physical sky with
# clouds, and exposure set like a camera. M1 Max has no path tracer, no
# hardware ray tracing and no virtual shadow maps (Epic's macOS feature
# table), so this is software Lumen with cascaded sun shadows.
SITE = {"Latitude": 40.18, "Longitude": 44.51, "TimeZone": 4.0, "Month": 10, "Day": 30}
SOLAR_TIME = float(os.environ.get("BRICK_SOLAR_TIME", "16.6"))  # local hours
NORTH_OFFSET = float(os.environ.get("BRICK_NORTH", "180"))  # turns the site under the sun

# camera exposure (EV100 = log2(N^2 / t * 100 / ISO))
EXTERIOR = {"aperture": 8.0, "shutter": 60.0, "iso": 100.0, "white_temp": 6300.0}  # ~EV 12
INTERIOR = {"aperture": 2.8, "shutter": 30.0, "iso": 400.0, "white_temp": 6500.0}  # ~EV 6


def photo_settings(s, exposure):
    """Post-process that reads as a photograph: physical exposure, local
    exposure for bright windows, a little lens character."""
    values = {
        "auto_exposure_method": unreal.AutoExposureMethod.AEM_MANUAL,
        "auto_exposure_apply_physical_camera_exposure": True,
        "auto_exposure_bias": 0.0,
        "camera_iso": exposure["iso"],
        "camera_shutter_speed": exposure["shutter"],
        "depth_of_field_fstop": exposure["aperture"],
        "local_exposure_highlight_contrast_scale": 0.8,
        "local_exposure_shadow_contrast_scale": 0.8,
        "local_exposure_detail_strength": 1.0,
        "local_exposure_blurred_luminance_blend": 0.5,
        "white_temp": exposure["white_temp"],
        "bloom_intensity": 0.3,
        "scene_fringe_intensity": 0.2,
        "vignette_intensity": 0.4,
        "film_grain_intensity": 0.08,
        "lens_flare_intensity": 0.0,
        "lumen_final_gather_quality": 4.0,
        "lumen_scene_detail": 4.0,
        "lumen_scene_lighting_quality": 4.0,
        "lumen_reflection_quality": 4.0,
        "lumen_skylight_leaking": 0.0,
    }
    for name, value in values.items():
        try:
            s.set_editor_property(name, value)
        except Exception:
            log("post-process: no", name)
            continue
        for flag in (f"override_{name}", f"b_override_{name}"):
            try:
                s.set_editor_property(flag, True)
                break
            except Exception:
                pass
    return s


def lighting(frame):
    bp = unreal.EditorAssetLibrary.load_blueprint_class("/SunPosition/SunSky.SunSky")
    sky = spawn(bp)
    for name, value in {**SITE, "SolarTime": SOLAR_TIME, "NorthOffset": NORTH_OFFSET}.items():
        set_any(sky, (name, name.lower()), value)
    sky.set_actor_label("SunSky_Yerevan")
    try:
        sky.call_method("UpdateSun")  # the Blueprint recomputes the sun from the values
    except Exception:
        log("SunSky: no UpdateSun, relying on construction script")
    clouds = spawn(unreal.VolumetricCloud)
    clouds.set_actor_label("Clouds")

    fog = spawn(unreal.ExponentialHeightFog)
    fc = fog.component
    set_any(fc, ("fog_density",), 0.002)
    set_any(fc, ("volumetric_fog", "enable_volumetric_fog"), False)

    pp = spawn(unreal.PostProcessVolume)
    pp.set_editor_property("unbound", True)
    pp.set_editor_property("settings", photo_settings(pp.settings, EXTERIOR))


def ground():
    """Land round the plot: a pure-sky HDRI has no ground of its own, and the
    aerial view showed the plot floating. 600 m of lawn just under the plot."""
    mi = instance("MI_Ground")
    tex = "leafy_grass"
    mel.set_material_instance_parent(mi, master_pbr())
    mel.set_material_instance_texture_parameter_value(mi, "BaseColor", texture(tex, "diff"))
    mel.set_material_instance_texture_parameter_value(mi, "Normal", texture(tex, "nor_gl"))
    mel.set_material_instance_texture_parameter_value(mi, "Roughness", texture(tex, "rough"))
    mel.set_material_instance_scalar_parameter_value(mi, "Tiling", 300.0)  # 600 m / 2 m per tile
    mel.set_material_instance_vector_parameter_value(mi, "Tint", unreal.LinearColor(0.7, 0.85, 0.62, 1))
    eal.save_loaded_asset(mi)
    plane = eal.load_asset("/Engine/BasicShapes/Plane")
    a = actors.spawn_actor_from_object(plane, unreal.Vector(0, 0, -4), unreal.Rotator(roll=0, pitch=0, yaw=0))
    a.set_actor_scale3d(unreal.Vector(600, 600, 1))
    a.static_mesh_component.set_material(0, mi)
    a.set_actor_label("Ground")


def interior_lights(frame):
    data = json.load(open(os.path.join(BRICK, "lights.json")))
    for l in data["lights"]:
        a = spawn(unreal.PointLight, tuple(frame.v(l["location"]).to_tuple()))
        c = a.point_light_component
        for names, value in ((("intensity_units",), unreal.LightUnits.LUMENS), (("intensity",), 1500.0),
                             (("use_temperature",), True), (("temperature",), float(l["kelvin"])),
                             (("attenuation_radius",), 900.0), (("source_radius",), 4.0), (("cast_shadows",), True)):
            set_any(c, names, value)


PLANT_MODELS = {
    # kind -> Poly Haven model, its native height (m) to scale to the asked height
    # no cypress: the CC0 fir reads as bare sticks at garden scale
    "cypress": None,
    "shrub": ("wild_rooibos_bush", None),
    "tree": ("jacaranda_tree", None),
}


def foliage_masked(mesh):
    """Poly Haven leaves come as alpha-blended (glTF BLEND): translucent in
    Unreal, which Lumen barely lights. Leaves render masked and two-sided."""
    for sm in mesh.static_materials:
        mi = sm.material_interface
        if not isinstance(mi, unreal.MaterialInstanceConstant):
            continue
        o = mi.get_editor_property("base_property_overrides")
        if o.get_editor_property("blend_mode") != unreal.BlendMode.BLEND_TRANSLUCENT and not any(
                k in mi.get_name().lower() for k in ("twig", "leaves", "leaf", "needle")):
            continue
        for names, value in ((("override_blend_mode", "b_override_blend_mode"), True),
                             (("blend_mode",), unreal.BlendMode.BLEND_MASKED),
                             (("override_two_sided", "b_override_two_sided"), True),
                             (("two_sided",), True)):
            set_any(o, names, value)
        mi.set_editor_property("base_property_overrides", o)
        mel.update_material_instance(mi)
        eal.save_loaded_asset(mi)


def plants(frame):
    data = json.load(open(os.path.join(BRICK, "plants.json")))
    meshes = {}
    for kind, model in PLANT_MODELS.items():
        if not model:
            continue
        name = model[0]
        folder = f"{ROOT}/Plants/{name}"
        if eal.does_directory_exist(folder) and eal.list_assets(folder):
            assets = [eal.load_asset(p) for p in eal.list_assets(folder)]  # imported on an earlier run
        else:
            assets = import_files([os.path.join(PH, name, f"{name}_1k.gltf")], folder)
        meshes[kind] = [a for a in assets if isinstance(a, unreal.StaticMesh)]
        for m in meshes[kind]:
            foliage_masked(m)
    for i, p in enumerate(data["plants"]):
        if p["kind"] not in meshes:
            continue
        parts = meshes[p["kind"]]
        if not parts:
            continue
        loc = frame.v(p["location"])
        top = max(m.get_bounds().box_extent.z * 2 for m in parts) / 100 or 1
        scale = p["height_m"] / top
        for m in parts:
            a = actors.spawn_actor_from_object(m, loc, unreal.Rotator(roll=0, pitch=0, yaw=(i * 47) % 360))
            a.set_actor_scale3d(unreal.Vector(scale, scale, scale))


def cameras(frame):
    data = json.load(open(os.path.join(BRICK, "cameras.json")))
    out = {}
    for c in data["cameras"]:
        loc = frame.v(c["location"])
        tgt = frame.v(c["target"])
        rot = unreal.MathLibrary.find_look_at_rotation(loc, tgt)
        cam = spawn(unreal.CineCameraActor, tuple(loc.to_tuple()), (rot.pitch, rot.yaw, rot.roll))
        cam.set_actor_label(f"Cam_{c['name']}")
        cc = cam.get_cine_camera_component()
        fb = cc.filmback
        fb.sensor_width = c["sensor_width_mm"]
        fb.sensor_height = c["sensor_width_mm"] * 10 / 16
        cc.filmback = fb
        cc.current_focal_length = c["focal_length_mm"]
        fs = cc.focus_settings
        fs.focus_method = unreal.CameraFocusMethod.MANUAL
        fs.manual_focus_distance = (tgt - loc).length()
        cc.focus_settings = fs
        if c["kind"] == "interior":
            # inside: a camera set for interiors (EV ~6), as a photographer would
            cc.post_process_settings = photo_settings(cc.post_process_settings, INTERIOR)
            cc.current_aperture = INTERIOR["aperture"]
        else:
            cc.current_aperture = EXTERIOR["aperture"]
        out[c["name"]] = cam
    return out


def main():
    new_level()
    house = import_house()
    plot = json.load(open(os.path.join(BRICK, "plants.json")))["plot"]
    frame = Frame(plot["min"], plot["max"], lawn_bounds(house))
    retexture(house)
    lighting(frame)
    ground()
    interior_lights(frame)
    plants(frame)
    cameras(frame)
    world = unreal.get_editor_subsystem(unreal.UnrealEditorSubsystem).get_editor_world()
    unreal.EditorLoadingAndSavingUtils.save_map(world, MAP)
    unreal.EditorLoadingAndSavingUtils.save_dirty_packages(True, True)
    umap = os.path.join(unreal.Paths.project_content_dir(), "Maps", "House.umap")
    log("scene saved", MAP, len(actors.get_all_level_actors()), "actors,", os.path.getsize(umap), "bytes")


def run():
    try:
        main()
    except Exception:
        import traceback
        unreal.log_error("[brick] FAILED " + traceback.format_exc())
        unreal.SystemLibrary.quit_editor()
        return
    # BRICK_RENDER=all or shot names: render straight away in this session
    if os.environ.get("BRICK_RENDER"):
        shots = os.environ["BRICK_RENDER"]
        os.environ["BRICK_SHOTS"] = "" if shots == "all" else shots
        render = os.path.join(unreal.Paths.project_dir(), "Scripts", "render.py")
        exec(compile(open(render).read(), render, "exec"), {"__name__": "__main__", "__file__": render})
    elif os.environ.get("BRICK_QUIT"):
        unreal.SystemLibrary.quit_editor()


# Started from the command line, the script runs before the editor world is
# up: wait some frames first.
_t = {"n": 0, "h": None}


def _tick(dt):
    _t["n"] += 1
    if _t["n"] == 60:
        unreal.unregister_slate_post_tick_callback(_t["h"])
        run()


_t["h"] = unreal.register_slate_post_tick_callback(_tick)
