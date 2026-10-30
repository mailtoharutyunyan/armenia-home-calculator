"""Build the brick house (the calculator's default, drawn off its plans) and
export it for Twinmotion.

Run headless:
  /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup --python build_brick.py

Input:  brick/plan.json  (written by export_brick.ts from the calculator's engine)
Output: brick/home_brick.fbx, home_brick.glb, home_brick.blend, renders/*.png,
        brick/Home_Brick_Substitution.csv (Twinmotion material substitution table)

Plan coordinates: x to the right, y from the back wall (0) to the main facade
(W), metres. Blender: X = x, Y = W - y, so the main facade faces -Y. The house
is not one rectangle: each floor brings its outline (a union of rectangles);
outer walls run along that outline, 250 mm thick, on a 25 mm grid.

Facade after the project's renders: light stone panels downstairs, dark wood
panels upstairs, a light stone pylon on axis 2, thin dark roofs with deep
overhangs and wood soffits, a dark band between the floors.
"""

import json
import math
import os
import sys

import bmesh
import bpy
import numpy as np
from mathutils import Matrix, Vector

# Data (assets, plan.json, outputs) lives in the working folder ~/Desktop/home-3d
# (override with HOME3D); the scripts themselves live in the calculator repo.
HERE = os.environ.get("HOME3D", os.path.expanduser("~/Desktop/home-3d"))
OUT = os.path.join(HERE, "brick")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from interior import Furnisher  # noqa: E402

PLAN = json.load(open(os.path.join(OUT, "plan.json")))
F0, F1 = PLAN["floors"]
L, W = F0["L"], F0["W"]
WALL = F0["wall"]
PART = F0["partition"]

# Levels: the upper floor at +3.400, a 3.0 m ceiling upstairs (the project).
SLAB = 0.20
FINISH = 0.02
PLINTH = 0.45
FFL = [PLINTH, PLINTH + 3.40]
CEIL = [FFL[1] - SLAB - FINISH, FFL[1] + 3.00]
TOP0 = FFL[1] - FINISH  # ground walls end, upper walls start
ROOF0_TOP = TOP0 + 0.14  # ground-floor roofs
BAND0 = TOP0 - 0.42  # underside of the dark band between the floors
ROOF1 = CEIL[1] + SLAB  # underside of the upper roof's overhang
ROOF1_TOP = ROOF1 + 0.50
SKIN = 0.03
CELL = 0.025

DOOR_H, ENTRANCE_H = 2.1, 2.6
RAIL_H = 1.0

# Window sill/head above the floor, by drawing mark (the render's proportions).
def window_z(f, w):
    if f == 0:
        if w["len"] <= 0.7:  # ОК-4, a high strip in the shower
            return 1.55, 2.15
        if w["side"] == "top":  # ОК-5 over the stair
            return 1.2, 2.4
        return 0.02, 2.5  # ОК-1…ОК-3, floor to ceiling
    if w["side"] == "top":
        return 0.9, 2.1
    return 0.4, 2.7  # ОК-6…ОК-8


# --------------------------------------------------------------------------- geometry

class Scene:
    def __init__(self):
        self.parts = {}

    def box(self, group, mat, x0, x1, y0, y1, z0, z1):
        if x1 - x0 < 1e-4 or y1 - y0 < 1e-4 or z1 - z0 < 1e-4:
            return
        self.parts.setdefault((group, mat), []).append((x0, x1, W - y1, W - y0, z0, z1))


S = Scene()


def piece(group, mat, axis, a0, a1, c0, c1, z0, z1):
    if axis == "x":
        S.box(group, mat, a0, a1, c0, c1, z0, z1)
    else:
        S.box(group, mat, c0, c1, a0, a1, z0, z1)


def wall_run(group, mat, axis, a0, a1, c0, c1, z0, z1, openings):
    """A wall from a0 to a1 along `axis`, c0..c1 across, openings cut out."""
    cuts = sorted({a0, a1, *[v for s, e, _, _ in openings for v in (s, e) if a0 < v < a1]})
    for s, e in zip(cuts, cuts[1:]):
        mid = (s + e) / 2
        holes = sorted((zb, zt) for os_, oe, zb, zt in openings if os_ < mid < oe)
        z = z0
        for zb, zt in holes:
            piece(group, mat, axis, s, e, c0, c1, z, max(z, min(zb, z1)))
            z = max(z, zt)
        piece(group, mat, axis, s, e, c0, c1, z, z1)


def window_frame(group, axis, s, e, c, zb, zt, prof=0.05, depth=0.08, bays=None):
    c0, c1 = c - depth / 2, c + depth / 2
    piece(group, "Window_Frame", axis, s, s + prof, c0, c1, zb, zt)
    piece(group, "Window_Frame", axis, e - prof, e, c0, c1, zb, zt)
    piece(group, "Window_Frame", axis, s + prof, e - prof, c0, c1, zb, zb + prof)
    piece(group, "Window_Frame", axis, s + prof, e - prof, c0, c1, zt - prof, zt)
    piece(group, "Glass", axis, s + prof, e - prof, c - 0.008, c + 0.008, zb + prof, zt - prof)
    n = bays or max(1, round((e - s) / 1.6))
    for i in range(1, n):
        m = s + (e - s) * i / n
        piece(group, "Window_Frame", axis, m - prof / 2, m + prof / 2, c0, c1, zb, zt)


# ---- raster helpers: outlines as masks on a 25 mm grid ----------------------

PAD = 80  # cells of margin round the house (2 m) for overhangs
NX = int(round(L / CELL)) + 2 * PAD
NY = int(round(W / CELL)) + 2 * PAD


def mask_of(rects):
    m = np.zeros((NY, NX), dtype=bool)
    for r in rects:
        i0, i1 = int(round(r["x"] / CELL)) + PAD, int(round((r["x"] + r["w"]) / CELL)) + PAD
        j0, j1 = int(round(r["y"] / CELL)) + PAD, int(round((r["y"] + r["h"]) / CELL)) + PAD
        m[j0:j1, i0:i1] = True
    return m


def dilate(m, left, right, back, front):
    """Grow a mask by cells to each side (back = -y, front = +y)."""
    out = m.copy()
    for d in range(1, left + 1):
        out[:, :-d] |= m[:, d:]
    for d in range(1, right + 1):
        out[:, d:] |= m[:, :-d]
    m2 = out.copy()
    for d in range(1, back + 1):
        out[:-d, :] |= m2[d:, :]
    for d in range(1, front + 1):
        out[d:, :] |= m2[:-d, :]
    return out


def wall_band(m, k=int(round(WALL / CELL))):
    """Cells of the mask within k cells (Chebyshev) of the outside."""
    outside = dilate(~m, k, k, k, k)
    return m & outside


def rects_of(m):
    """Greedy decomposition into rectangles (metres, plan frame)."""
    rows = []
    for j in range(NY):
        row = m[j]
        runs = []
        i = 0
        idx = np.flatnonzero(np.diff(np.concatenate(([0], row.astype(np.int8), [0]))))
        for a, b in zip(idx[::2], idx[1::2]):
            runs.append((a, b))
        rows.append(runs)
    out = []
    open_ = {}  # run -> start row
    for j in range(NY + 1):
        runs = set(rows[j]) if j < NY else set()
        for run in list(open_):
            if run not in runs:
                j0 = open_.pop(run)
                out.append(((run[0] - PAD) * CELL, (j0 - PAD) * CELL, (run[1] - run[0]) * CELL, (j - j0) * CELL))
        for run in runs:
            if run not in open_:
                open_[run] = j
    return [{"x": x, "y": y, "w": w, "h": h} for x, y, w, h in out]


def inside(m, x, y):
    i, j = int(math.floor(x / CELL)) + PAD, int(math.floor(y / CELL)) + PAD
    return 0 <= i < NX and 0 <= j < NY and m[j, i]


# --------------------------------------------------------------------------- the house

GROUND = mask_of(F0["outline"])
TOP = mask_of(F1["outline"])


def bbox(rooms):
    return {"x": min(r["x"] for r in rooms), "y": min(r["y"] for r in rooms),
            "w": max(r["x"] + r["w"] for r in rooms) - min(r["x"] for r in rooms),
            "h": max(r["y"] + r["h"] for r in rooms) - min(r["y"] for r in rooms)}


# the stair as drawn: its ground-floor box, and the stairwell upstairs
STAIR0 = bbox([r for r in F0["rooms"] if r["type"] == "stair"])
WELL1 = [r for r in F1["rooms"] if r["type"] == "stair"]


def front_at(x):
    """The main facade line of the ground floor at x."""
    return max((r["y"] + r["h"] for r in F0["outline"] if r["x"] <= x <= r["x"] + r["w"]), default=W)


BAY_FRONT = front_at(6.0)  # the living-kitchen's glazed bay
EAST_FRONT = front_at(14.0)  # the entrance and the bedroom
UPPER_FRONT = max(r["y"] + r["h"] for r in F1["outline"])
CIRC = {"hall", "corridor", "stair"}


def same_space(a, b):
    """Unlabelled rooms are parts of a labelled space: no wall between them."""
    if a["label"] and b["label"]:
        return False
    fam = lambda r: "circ" if r["type"] in CIRC else r["type"]
    return fam(a) == fam(b)


def openings_of(f, plan):
    """Every opening in an outer wall: (wall line, side, start, end, bottom, top)."""
    ops = []
    for w in plan["windows"]:
        zb, zt = window_z(f, w)
        line = w["y"] if w["side"] in ("top", "bottom") else w["x"]
        start = w["x"] if w["side"] in ("top", "bottom") else w["y"]
        ops.append(dict(kind="window", line=line, horiz=w["side"] in ("top", "bottom"), s=start, e=start + w["len"],
                        zb=FFL[f] + zb, zt=FFL[f] + zt))
    for d in plan["doors"]:
        if d["kind"] != "entrance":
            continue
        h = ENTRANCE_H + 0.3 if d["w"] > 1.2 else ENTRANCE_H if d["w"] < 0.85 else DOOR_H + 0.1
        ops.append(dict(kind="door", line=d["pos"], horiz=d["orient"] == "h", s=d["start"], e=d["start"] + d["w"],
                        zb=FFL[f], zt=FFL[f] + h, door=d))
    return ops


def exterior_walls(f, mask, z0, z1, facade, group):
    plan = (F0, F1)[f]
    ops = openings_of(f, plan)
    for r in rects_of(wall_band(mask)):
        x0, x1, y0, y1 = r["x"], r["x"] + r["w"], r["y"], r["y"] + r["h"]
        e = CELL / 2
        out = {
            "top": not inside(mask, (x0 + x1) / 2, y0 - e),
            "bottom": not inside(mask, (x0 + x1) / 2, y1 + e),
            "left": not inside(mask, x0 - e, (y0 + y1) / 2),
            "right": not inside(mask, x1 + e, (y0 + y1) / 2),
        }
        axis = "x" if r["w"] >= r["h"] else "y"
        face = {"top": y0, "bottom": y1, "left": x0, "right": x1}
        mine = []
        for side in ("top", "bottom") if axis == "x" else ("left", "right"):
            if not out[side]:
                continue
            for o in ops:
                if o["horiz"] == (axis == "x") and abs(o["line"] - face[side]) < 0.06:
                    lo, hi = (x0, x1) if axis == "x" else (y0, y1)
                    if o["s"] < hi - 1e-3 and o["e"] > lo + 1e-3:
                        mine.append(o)
        holes = [(o["s"], o["e"], o["zb"], o["zt"]) for o in mine]
        cx0 = x0 + (SKIN if out["left"] else 0)
        cx1 = x1 - (SKIN if out["right"] else 0)
        cy0 = y0 + (SKIN if out["top"] else 0)
        cy1 = y1 - (SKIN if out["bottom"] else 0)
        if axis == "x":
            wall_run(group, "Wall_Paint", "x", cx0, cx1, cy0, cy1, z0, z1, holes)
        else:
            wall_run(group, "Wall_Paint", "y", cy0, cy1, cx0, cx1, z0, z1, holes)
        for side, on in out.items():
            if not on:
                continue
            strip_holes = holes if (side in ("top", "bottom")) == (axis == "x") else []
            if side in ("top", "bottom"):
                c = (y0, y0 + SKIN) if side == "top" else (y1 - SKIN, y1)
                if f == 0:
                    wall_run(group.replace("Ext", "Facade"), "Facade_Plinth", "x", x0, x1, *c, z0, PLINTH, strip_holes)
                wall_run(group.replace("Ext", "Facade"), facade, "x", x0, x1, *c, PLINTH if f == 0 else z0, z1, strip_holes)
            else:
                c = (x0, x0 + SKIN) if side == "left" else (x1 - SKIN, x1)
                if f == 0:
                    wall_run(group.replace("Ext", "Facade"), "Facade_Plinth", "y", y0, y1, *c, z0, PLINTH, strip_holes)
                wall_run(group.replace("Ext", "Facade"), facade, "y", y0, y1, *c, PLINTH if f == 0 else z0, z1, strip_holes)
        # frames, doors and sills in this wall
        for o in mine:
            side = next(s for s in (("top", "bottom") if axis == "x" else ("left", "right")) if out[s] and abs(o["line"] - face[s]) < 0.06)
            mid = (cy0 + cy1) / 2 if axis == "x" else (cx0 + cx1) / 2
            outward = {"top": -1, "bottom": 1, "left": -1, "right": 1}[side]
            g = f"Windows_F{f + 1}"
            if o["kind"] == "window":
                window_frame(g, axis, o["s"], o["e"], mid, o["zb"], o["zt"])
                lip = (face[side], face[side] + outward * 0.05)
                piece(g, "Window_Frame", axis, o["s"] - 0.02, o["e"] + 0.02, min(lip), max(lip), o["zb"] - 0.04, o["zb"])
            else:
                entrance_door(g, axis, o, mid)


def entrance_door(g, axis, o, mid):
    s, e, zb, zt = o["s"], o["e"], o["zb"], o["zt"]
    t = 0.06
    piece(g, "Window_Frame", axis, s, s + 0.06, mid - t, mid + t, zb, zt)
    piece(g, "Window_Frame", axis, e - 0.06, e, mid - t, mid + t, zb, zt)
    piece(g, "Window_Frame", axis, s, e, mid - t, mid + t, zt - 0.06, zt)
    if e - s > 1.2:  # ДН-1: glazed side light, a wood leaf and a transom
        leaf0 = e - 1.06
        piece(g, "Window_Frame", axis, leaf0 - 0.05, leaf0, mid - t, mid + t, zb, zt)
        piece(g, "Glass", axis, s + 0.06, leaf0 - 0.05, mid - 0.01, mid + 0.01, zb, zt - 0.06)
        piece(g, "Door_Entrance", axis, leaf0, e - 0.06, mid - 0.03, mid + 0.03, zb, zb + 2.4)
        piece(g, "Window_Frame", axis, leaf0, e - 0.06, mid - t, mid + t, zb + 2.4, zb + 2.45)
        piece(g, "Glass", axis, leaf0, e - 0.06, mid - 0.01, mid + 0.01, zb + 2.45, zt - 0.06)
        piece(g, "Chrome", axis, leaf0 + 0.12, leaf0 + 0.15, mid - 0.09, mid + 0.09, zb + 0.6, zb + 1.8)
    elif e - s < 0.85:  # ДНО-2: glazed door to the terrace
        piece(g, "Glass", axis, s + 0.06, e - 0.06, mid - 0.01, mid + 0.01, zb, zt - 0.06)
    else:  # ДН-2: solid service door
        piece(g, "Fascia_Metal", axis, s + 0.06, e - 0.06, mid - 0.03, mid + 0.03, zb, zt - 0.06)


def slabs_and_roofs():
    inner0 = GROUND & ~wall_band(GROUND)
    inner1 = TOP & ~wall_band(TOP)
    # ground-floor slab on the ground, under the whole outline
    for r in rects_of(GROUND):
        S.box("Structure", "Concrete", r["x"], r["x"] + r["w"], r["y"], r["y"] + r["h"], 0, PLINTH - FINISH)
    # slab over the ground floor, less the stairwell
    hole = mask_of(WELL1)
    for r in rects_of(inner0 & ~hole):
        S.box("Slab_F1", "Ceiling_Paint", r["x"], r["x"] + r["w"], r["y"], r["y"] + r["h"], CEIL[0], CEIL[0] + SLAB)
    # ground-floor roofs beside the upper floor
    for r in rects_of(GROUND & ~TOP):
        S.box("Roof_F1", "Roof_MetalSeam", r["x"], r["x"] + r["w"], r["y"], r["y"] + r["h"], TOP0, ROOF0_TOP)
    # the dark band and canopy round the ground floor (deeper over the front porch)
    c = lambda m: int(round(m / CELL))
    band = dilate(GROUND, c(0.5), c(0.5), c(0.5), c(1.05)) & ~GROUND
    for r in rects_of(band):
        x0, x1, y0, y1 = r["x"], r["x"] + r["w"], r["y"], r["y"] + r["h"]
        S.box("Roof_F1", "Fascia_Metal", x0, x1, y0, y1, BAND0, ROOF0_TOP)
        S.box("Roof_F1", "Soffit_Wood", x0, x1, y0, y1, BAND0 - 0.02, BAND0)
    # upper floor: ceiling slab, then a thin roof with a deep overhang
    for r in rects_of(inner1):
        S.box("Slab_F2", "Ceiling_Paint", r["x"], r["x"] + r["w"], r["y"], r["y"] + r["h"], CEIL[1], CEIL[1] + SLAB)
    over = dilate(TOP, c(0.7), c(0.7), c(0.7), c(BAY_FRONT + 0.25 - UPPER_FRONT))
    for r in rects_of(over & ~TOP):
        x0, x1, y0, y1 = r["x"], r["x"] + r["w"], r["y"], r["y"] + r["h"]
        S.box("Roof_F2", "Fascia_Metal", x0, x1, y0, y1, ROOF1, ROOF1_TOP)
        S.box("Roof_F2", "Soffit_Wood", x0, x1, y0, y1, ROOF1 - 0.02, ROOF1)
    for r in rects_of(over):
        S.box("Roof_F2", "Roof_MetalSeam", r["x"], r["x"] + r["w"], r["y"], r["y"] + r["h"], ROOF1_TOP, ROOF1_TOP + 0.03)
    # standing seams
    seam_rects = rects_of(over)
    for r in seam_rects:
        x = r["x"] + 0.25
        while x < r["x"] + r["w"] - 0.1:
            S.box("Roof_F2", "Fascia_Metal", x - 0.012, x + 0.012, r["y"], r["y"] + r["h"], ROOF1_TOP + 0.03, ROOF1_TOP + 0.06)
            x += 0.5
    # downlights in the soffits
    lights = []
    front_y = max(r["y"] + r["h"] for r in F1["outline"])
    x = 4.2
    while x < L - 0.4:
        lights.append((x, front_y + 0.7, ROOF1 - 0.02))
        x += 1.9
    for x in (10.6, 12.2, 14.4, 16.4):
        lights.append((x, EAST_FRONT + 0.5, BAND0 - 0.02))
    for lx, ly, lz in lights:
        S.box("Roof_F2" if lz > TOP0 else "Roof_F1", "Light_Emissive", lx - 0.05, lx + 0.05, ly - 0.05, ly + 0.05, lz - 0.006, lz)
    return lights


def pylon():
    """The light stone pylon on axis 2, in front of the living-kitchen's bay."""
    x0, x1, y0, y1 = 8.6, 9.65, BAY_FRONT, BAY_FRONT + 0.55
    S.box("Pylon", "Facade_Travertine", x0, x1, y0, y1, 0, ROOF1_TOP + 1.1)
    S.box("Pylon", "Facade_Travertine", x0, x1, UPPER_FRONT - 0.4, y0, ROOF1_TOP, ROOF1_TOP + 1.1)


def floors_finish():
    mat = {"bath": "Floor_Tile", "utility": "Floor_Tile", "hall": "Floor_Stone", "corridor": "Floor_Stone",
           "stair": "Floor_Stone", "wardrobe": "Floor_Tile", "living_kitchen": "Floor_Stone"}
    for f, plan in enumerate((F0, F1)):
        for r in plan["rooms"]:
            x0, x1, y0, y1 = r["x"], r["x"] + r["w"], r["y"], r["y"] + r["h"]
            if f == 1 and r["type"] == "stair":
                continue  # the stairwell
            m = mat.get(r["type"], "Floor_Oak")
            if f == 1 and r["type"] in ("corridor",):
                m = "Floor_Oak"
            S.box(f"Floors_F{f + 1}", m, x0, x1, y0, y1, FFL[f] - FINISH, FFL[f])


def shared_edges(a, b, e=0.02):
    oy = (max(a["y"], b["y"]), min(a["y"] + a["h"], b["y"] + b["h"]))
    ox = (max(a["x"], b["x"]), min(a["x"] + a["w"], b["x"] + b["w"]))
    if oy[1] - oy[0] > e:
        for xa, xb in ((a["x"] + a["w"], b["x"]), (a["x"], b["x"] + b["w"])):
            if abs(xa - xb) < e:
                return "y", xa, *oy
    if ox[1] - ox[0] > e:
        for ya, yb in ((a["y"] + a["h"], b["y"]), (a["y"], b["y"] + b["h"])):
            if abs(ya - yb) < e:
                return "x", ya, *ox
    return None


def door_frame(group, axis, d, c0, c1, ffl, w=0.05):
    s, e = d["start"], d["start"] + d["w"]
    c0, c1 = c0 - 0.015, c1 + 0.015
    piece(group, "Door_Frame", axis, s - w, s, c0, c1, ffl, ffl + DOOR_H + w)
    piece(group, "Door_Frame", axis, e, e + w, c0, c1, ffl, ffl + DOOR_H + w)
    piece(group, "Door_Frame", axis, s, e, c0, c1, ffl + DOOR_H, ffl + DOOR_H + w)


def door_leaf(group, d, ffl):
    if d["w"] > 1.0:  # a wide opening (the wardrobe niche) has sliding doors, no swinging leaf
        return
    t, w, sgn = 0.04, d["w"], d["swing"]
    a, b = sorted((d["pos"], d["pos"] + sgn * w))
    if d["orient"] == "v":
        S.box(group, "Door_Interior", a, b, d["start"], d["start"] + t, ffl, ffl + DOOR_H)
    else:
        S.box(group, "Door_Interior", d["start"], d["start"] + t, a, b, ffl, ffl + DOOR_H)


def railing(group, axis, s, e, line, ffl):
    piece(group, "Glass", axis, s, e, line - 0.01, line + 0.01, ffl + 0.05, ffl + RAIL_H - 0.05)
    piece(group, "Railing_Steel", axis, s, e, line - 0.025, line + 0.025, ffl + RAIL_H - 0.04, ffl + RAIL_H)


def partitions():
    for f, plan in enumerate((F0, F1)):
        z0, z1 = FFL[f] - FINISH, CEIL[f]
        rooms = plan["rooms"]
        group = f"Walls_F{f + 1}"
        for i in range(len(rooms)):
            for j in range(i + 1, len(rooms)):
                a, b = rooms[i], rooms[j]
                if same_space(a, b):
                    continue
                edge = shared_edges(a, b)
                if not edge:
                    continue
                axis, line, s, e = edge
                c0, c1 = line - PART / 2, line + PART / 2
                orient = "v" if axis == "y" else "h"
                ops = []
                stairwell = f == 1 and "stair" in (a["type"], b["type"])
                for d in plan["doors"]:
                    if d["orient"] == orient and abs(d["pos"] - line) < 0.02 and s - 0.02 <= d["start"] <= e:
                        if stairwell:
                            continue
                        # a drawn opening is open to the ceiling: no lintel over it
                        top = FFL[f] + DOOR_H if d["kind"] == "interior" else z1 + 0.01
                        ops.append((d["start"], d["start"] + d["w"], FFL[f] - FINISH, top))
                        if d["kind"] == "interior":
                            door_frame(group.replace("Walls", "Doors"), axis, d, c0, c1, FFL[f])
                            door_leaf(group.replace("Walls", "Doors"), d, FFL[f])
                if stairwell:  # the stairwell opens to the hall upstairs: a glass guard
                    if not (axis == "x" and abs(line - ARRIVAL[0]) < 0.05):
                        railing("Railings_F2", axis, s, e, line, FFL[f])
                    continue
                wall_run(group, "Wall_Paint", axis, s - PART / 2, e + PART / 2, c0, c1, z0, z1, ops)


# The stair as drawn: a flight up towards the back on the left, three winders
# across the back wall, and a flight towards the front on the right that
# arrives upstairs where the stairwell meets the landing.
RISERS = 18
rise = (FFL[1] - FFL[0]) / RISERS
_stairs0 = [r for r in F0["rooms"] if r["type"] == "stair"]
BACK = next((r for r in _stairs0 if r["label"]), _stairs0[0])  # the winders' strip at the back wall
FLIGHT1 = next((r for r in _stairs0 if not r["label"]), BACK)  # the first flight, on the left
_right1 = [r for r in WELL1 if r["x"] > FLIGHT1["x"] + FLIGHT1["w"] - 0.05]
ARRIVAL = (max((r["y"] + r["h"] for r in _right1), default=FLIGHT1["y"] + FLIGHT1["h"]),)
f1x0, f1x1 = FLIGHT1["x"] + 0.05, FLIGHT1["x"] + FLIGHT1["w"] - 0.06
f2x0 = max([r["x"] for r in _right1] + [f1x1 + 0.06]) + 0.03
f2x1 = BACK["x"] + BACK["w"] - 0.05
wind_y0, wind_y = BACK["y"] + 0.02, BACK["y"] + BACK["h"]
sy1 = FLIGHT1["y"] + FLIGHT1["h"]


def stair():
    g = "Stair"
    n1 = 8  # flight 1, up towards the back wall
    t1 = (sy1 - wind_y) / n1
    for i in range(1, n1 + 1):
        y1 = sy1 - (i - 1) * t1
        S.box(g, "Stair_Wood", f1x0, f1x1, y1 - t1, y1, FFL[0] + (i - 1) * rise, FFL[0] + i * rise)
    xs = np.linspace(f1x0, f2x1, 4)
    for k in range(3):  # three winders across the back
        top = FFL[0] + (n1 + 1 + k) * rise
        S.box(g, "Stair_Wood", xs[k], xs[k + 1], wind_y0, wind_y, top - 0.22, top)
    n2 = RISERS - n1 - 4  # flight 2 towards the front, then the last riser onto the landing
    t2 = (ARRIVAL[0] - wind_y) / max(1, n2)
    for i in range(n2):
        top = FFL[0] + (n1 + 4 + i) * rise
        y0 = wind_y + i * t2
        S.box(g, "Stair_Wood", f2x0, f2x1, y0, y0 + t2, top - 0.22, top)
    # a guard wall along the first flight, open to the hall beside it
    S.box(g, "Wall_Paint", f1x1, f1x1 + 0.06, wind_y, sy1, FFL[0], FFL[0] + n1 * rise + RAIL_H)


# --------------------------------------------------------------------------- interior

def rect(plan, label, nth=0, inset=0.05):
    r = [r for r in plan["rooms"] if r["label"] == label][nth]
    return (r["x"] + inset, r["x"] + r["w"] - inset, r["y"] + inset, r["y"] + r["h"] - inset)


class BrickFurnisher(Furnisher):
    def kitchen_living(self):
        x0, x1, y0, y1 = rect(F0, "Kitchen-living")
        g, soft = "Kitchen", "Soft_F1"
        # kitchen run on the back wall: base units, worktop, hob, sink, tall column
        k0, k1 = x0 + 0.4, x1 - 1.0
        self.box(0, g, "Kitchen_Front", k0, k1, y0, y0 + 0.6, 0.1, 0.87)
        self.box(0, g, "Metal_Dark", k0 + 0.05, k1 - 0.05, y0, y0 + 0.55, 0, 0.1)
        self.box(0, g, "Countertop_Marble", k0, k1, y0, y0 + 0.63, 0.87, 0.90)
        self.box(0, g, "Kitchen_Front", k0, k1, y0, y0 + 0.35, 1.5, 2.25)
        self.box(0, g, "Black_Glass", k0 + 0.8, k0 + 1.4, y0 + 0.1, y0 + 0.55, 0.90, 0.905)
        sx = (k0 + k1) / 2 + 0.6
        self.box(0, g, "Chrome", sx - 0.4, sx + 0.4, y0 + 0.12, y0 + 0.52, 0.90, 0.902)
        self.box(0, g, "Chrome", sx - 0.02, sx + 0.02, y0 + 0.04, y0 + 0.08, 0.90, 1.25)
        self.box(0, g, "Wood_Oak", k1, x1, y0, y0 + 0.65, 0, 2.3)
        # island with three stools facing the living area
        ix0, ix1, iy0, iy1 = x0 + 1.9, x0 + 4.1, y0 + 1.9, y0 + 2.8
        self.box(0, g, "Kitchen_Front", ix0, ix1, iy0, iy1, 0.1, 0.87)
        self.box(0, g, "Countertop_Marble", ix0 - 0.05, ix1 + 0.05, iy0 - 0.05, iy1 + 0.3, 0.87, 0.91)
        for px in (ix0 + 0.45, (ix0 + ix1) / 2, ix1 - 0.45):
            self.box(0, soft, "Fabric_Accent", px - 0.18, px + 0.18, iy1 + 0.35, iy1 + 0.7, 0.62, 0.67)
            self.box(0, g, "Metal_Dark", px - 0.02, px + 0.02, iy1 + 0.5, iy1 + 0.54, 0, 0.62)
            self.box(0, g, "Metal_Dark", px - 0.16, px + 0.16, iy1 + 0.36, iy1 + 0.68, 0, 0.02)
            self.asset("modern_ceiling_lamp_01", px, (iy0 + iy1) / 2, self.ceil[0] - 1.17, (0, 1))
        self.light((ix0 + ix1) / 2, (iy0 + iy1) / 2, self.ceil[0] - 1.0, 10)
        # sofa facing the garden glazing, coffee table, armchairs, rug
        sx0_, sx1_, sy = x0 + 1.0, x0 + 3.7, y0 + 5.0
        self.box(0, "Furniture_F1", "Metal_Dark", sx0_, sx1_, sy, sy + 0.95, 0, 0.08)
        self.box(0, soft, "Fabric_Sofa", sx0_, sx1_, sy, sy + 0.95, 0.08, 0.42)
        self.box(0, soft, "Fabric_Sofa", sx0_, sx1_, sy, sy + 0.25, 0.42, 0.85)
        self.box(0, soft, "Fabric_Sofa", sx0_, sx0_ + 0.22, sy, sy + 0.95, 0.42, 0.62)
        self.box(0, soft, "Fabric_Sofa", sx1_ - 0.22, sx1_, sy, sy + 0.95, 0.42, 0.62)
        for px in (sx0_ + 0.5, sx1_ - 0.9):
            self.box(0, soft, "Fabric_Accent", px, px + 0.45, sy + 0.22, sy + 0.36, 0.5, 0.9)
        self.box(0, soft, "Rug_Wool", sx0_ - 0.2, sx1_ + 0.2, sy + 0.7, sy + 3.0, 0, 0.012)
        self.asset("modern_coffee_table_01", (sx0_ + sx1_) / 2, sy + 1.7, self.ffl[0], (0, 1))
        self.asset("modern_arm_chair_01", x1 - 1.2, sy + 1.1, self.ffl[0], (-1, 0.4))
        # oak slat accent wall with a low cabinet on the terrace side
        for i in range(24):
            yy = sy - 0.6 + i * 0.13
            self.box(0, "Furniture_F1", "Wood_Oak", x0, x0 + 0.04, yy, yy + 0.07, 0, self.ceil[0] - self.ffl[0])
        self.asset("modern_wooden_cabinet", x0 + 0.3, sy + 0.9, self.ffl[0], (1, 0))
        self.asset("potted_plant_04", x0 + 0.3, sy + 0.4, self.ffl[0] + 0.55, (0, 1))
        self.asset("potted_plant_01", x0 + 0.4, y1 - 0.5, self.ffl[0], (0, 1))
        self.asset("potted_plant_02", x1 - 0.5, y0 + 1.1, self.ffl[0], (0, 1))
        self.curtains(0, "bottom", y1, x0, x0 + 4.7)

    def curtains(self, f, side, line, a, b):
        """Sheer curtains stacked at both ends of a glazed wall, a grey track."""
        top = self.ceil[f] - 0.04
        sgn = -1 if side == "bottom" else 1
        for c0, c1 in ((a, a + 0.7), (b - 0.7, b)):
            n = int((c1 - c0) / 0.08)
            for i in range(n):
                off = 0.035 if i % 2 else 0
                y = line + sgn * (0.16 + off)
                self.S.box("Curtains", "Curtain_Sheer", c0 + i * 0.08, c0 + (i + 1) * 0.08 + 0.01,
                           min(y, y + sgn * 0.02), max(y, y + sgn * 0.02), self.ffl[f] + 0.01, top)
        y = line + sgn * 0.12
        self.S.box("Curtains", "Metal_Dark", a, b, min(y, y + sgn * 0.1), max(y, y + sgn * 0.1), top, top + 0.04)

    def ground_rooms(self):
        # storeroom: shelving on both short walls
        x0, x1, y0, y1 = rect(F0, "Storeroom")
        for sx in ((x0 + 0.9, x0 + 1.3), (x1 - 0.4, x1)):
            for z in (0.3, 0.7, 1.1, 1.5, 1.9):
                self.box(0, "Furniture_F1", "Wood_Oak", *sx, y0, y1, z, z + 0.025)
        # hall: the drawn wardrobe niche, a mirror by the door
        x0, x1, y0, y1 = rect(F0, "Wardrobe")
        self.wardrobe(0, "right", x1, (y0 + y1) / 2, y1 - y0, depth=x1 - x0 - 0.05)
        x0, x1, y0, y1 = rect(F0, "Hall")
        self.asset("potted_plant_02", x1 - 0.35, y1 - 0.35, self.ffl[0], (0, 1))
        # boiler room: boiler, washer and dryer, utility sink
        x0, x1, y0, y1 = rect(F0, "Boiler room")
        self.on_wall(0, "Furniture_F1", "Appliance_White", "back", y0, x0 + 0.8, -0.25, 0.25, 0, 0.35, 0.9, 1.7)
        for z0 in (0, 0.86):
            self.box(0, "Furniture_F1", "Appliance_White", x1 - 0.62, x1 - 0.02, y0 + 0.02, y0 + 0.62, z0, z0 + 0.85)
        self.box(0, "Furniture_F1", "Countertop_Marble", x1 - 2.2, x1 - 0.7, y0, y0 + 0.6, 0.85, 0.88)
        self.box(0, "Furniture_F1", "Kitchen_Front", x1 - 2.2, x1 - 0.7, y0, y0 + 0.58, 0.1, 0.85)
        # shower room: walk-in shower, WC, vanity
        x0, x1, y0, y1 = rect(F0, "Shower room")
        self.shower(0, x1 - 1.0, x1, y0, y1, ("y", x1 - 1.0, y0, y0 + 1.4))
        self.wc(0, "back", y0, x0 + 0.6)
        self.vanity(0, "front", y1, x0 + 1.0, 0.9)
        # bedroom: bed on the east wall, wardrobe on the hall side
        x0, x1, y0, y1 = rect(F0, "Bedroom")
        self.bed(0, "right", x1, (y0 + y1) / 2 + 0.1, 1.6, 2.0)
        self.wardrobe(0, "left", x0, (y0 + y1) / 2 + 0.6, 1.8)
        self.curtains(0, "bottom", y1, x0 + 0.45, x0 + 4.05)

    def upper_rooms(self):
        x0, x1, y0, y1 = rect(F1, "Bedroom", 0)  # bedroom 21.1
        self.bed(1, "left", x0, (y0 + y1) / 2 + 0.3, 1.8)
        self.wardrobe(1, "back", y0, x0 + 1.9, 3.0)
        self.desk(1, "right", x1, y1 - 0.9, 1.3)
        self.curtains(1, "bottom", y1, x0, x1)
        x0, x1, y0, y1 = rect(F1, "Bedroom", 1)  # bedroom 15.5
        self.bed(1, "left", x0, (y0 + y1) / 2 + 0.2, 1.6, 2.0)
        self.wardrobe(1, "right", x1, y0 + 0.75, 1.3)
        self.desk(1, "right", x1, y1 - 0.85, 1.2)
        self.curtains(1, "bottom", y1, x0 + 1.6, x0 + 4.2)
        x0, x1, y0, y1 = rect(F1, "Home office")  # office
        self.desk(1, "back", y0, x0 + 2.0, 1.8)
        self.on_wall(1, "Soft_F2", "Fabric_Sofa", "right", x1, (y0 + y1) / 2, -1.0, 1.0, 0, 0.9, 0.08, 0.42)
        self.on_wall(1, "Soft_F2", "Fabric_Sofa", "right", x1, (y0 + y1) / 2, -1.0, 1.0, 0, 0.22, 0.42, 0.85)
        self.curtains(1, "bottom", y1, x0, x1 - 0.1)
        x0, x1, y0, y1 = rect(F1, "Shower room")  # shower room
        self.shower(1, x1 - 1.0, x1, y0, y1, ("y", x1 - 1.0, y0, y1))
        self.wc(1, "back", y0, x0 + 1.25)
        self.vanity(1, "front", y1, x0 + 0.95, 0.9)
        x0, x1, y0, y1 = rect(F1, "Hall")  # hall
        self.asset("potted_plant_01", x0 + 0.35, y0 + 0.35, self.ffl[1], (0, 1))

    def terrace(self):
        """Covered terrace with the barbecue kitchen (t297): stone deck, pergola."""
        t = F0.get("terraces", {"rects": []})["rects"]
        if not t:
            return
        r = t[0]
        x0, x1, y0, y1 = r["x"], r["x"] + r["w"], r["y"], r["y"] + r["h"]
        S.box("Terrace", "Paving_Terrace", x0, x1, y0, y1, 0, PLINTH - 0.02)
        S.box("Terrace", "Paving_Terrace", x0, x1, y1, y1 + 0.35, 0, PLINTH - 0.2)
        top = 3.2
        for px, py in ((x0 + 0.05, y1 - 0.2), (x0 + 0.05, y0 + 0.05), (x0 + 0.05, (y0 + y1) / 2)):
            S.box("Terrace", "Pergola_Wood", px, px + 0.18, py, py + 0.18, PLINTH - 0.02, top)
        S.box("Terrace", "Pergola_Wood", x0 + 0.05, x0 + 0.23, y0, y1, top - 0.25, top)
        S.box("Terrace", "Pergola_Wood", x0, x1, y1 - 0.25, y1 - 0.05, top - 0.25, top)
        y = y0 + 0.1
        while y < y1 - 0.2:
            S.box("Terrace", "Pergola_Wood", x0, x1 + 0.1, y, y + 0.06, top, top + 0.2)
            y += 0.22
        S.box("Terrace", "Pergola_Wood", x0, x0 + 0.04, y0 + 2.0, y1 - 1.0, PLINTH, top - 0.25)  # slatted screen
        # barbecue kitchen along the storeroom wall, an L with a bar
        f = 0
        self.box(f, "Kitchen", "Kitchen_Front", x0 + 0.1, x1 - 0.1, y0, y0 + 0.62, 0.1, 0.87)
        self.box(f, "Kitchen", "Countertop_Marble", x0 + 0.1, x1 - 0.1, y0, y0 + 0.65, 0.87, 0.9)
        self.box(f, "Kitchen", "Kitchen_Front", x0 + 0.1, x0 + 0.72, y0 + 0.62, y0 + 2.9, 0.1, 0.87)
        self.box(f, "Kitchen", "Countertop_Marble", x0 + 0.1, x0 + 0.75, y0 + 0.62, y0 + 2.9, 0.87, 0.9)
        self.box(f, "Kitchen", "Black_Glass", x1 - 1.3, x1 - 0.6, y0 + 0.08, y0 + 0.55, 0.9, 0.905)
        self.box(f, "Kitchen", "Metal_Dark", x1 - 1.35, x1 - 0.55, y0, y0 + 0.5, 1.9, 2.6)  # hood
        self.asset("outdoor_table_chair_set_01", (x0 + x1) / 2 + 0.2, y0 + 5.0, PLINTH - 0.02, (1, 0))
        self.asset("potted_plant_02", x1 - 0.35, y1 - 0.4, PLINTH - 0.02, (0, 1))
        self.light((x0 + x1) / 2, y0 + 5.0, top - 0.4, 15)


def furnish():
    house = {"L": L, "W": W, "wall": WALL, "plinth": PLINTH, "roof_top": ROOF1_TOP, "hall_ceiling": CEIL[1]}
    f = BrickFurnisher(S, (F0, F1), FFL, CEIL, house)
    f.kitchen_living()
    f.ground_rooms()
    f.upper_rooms()
    f.terrace()
    f.ceiling_lights()
    return f.assets, f.lights


# --------------------------------------------------------------------------- site (t297)

# The owner's plot, 25 × 20 m (500 m²): the house's 17.35 m front faces the
# 25 m street side, 3.8 m from each side boundary, 1.5 m from the back one.
PLOT = (-3.825, 21.175, -1.5, 18.5)  # x0, x1, y0, y1; the street at the front (y1)
PLANTS = []  # (kind, x, y, height)
TILTED = []  # (material, centre in plan, size, rotation degrees about plan x, y, z)


def site():
    px0, px1, py0, py1 = PLOT
    g = "Site"
    S.box(g, "Lawn", px0, px1, py0, py1, -0.03, 0)
    t, h = 0.25, 2.2
    for b in ((px0, px1, py0, py0 + t), (px0, px0 + t, py0, py1), (px1 - t, px1, py0, py1)):
        S.box(g, "Fence_Render", *b, 0, h)
    # street front: a low wall with dark slats, a wicket on the path, a drive gate
    gates = [(9.6, 12.0), (17.6, 21.0)]
    cur = px0
    for g0, g1 in gates + [(px1, px1)]:
        if g0 > cur:
            S.box(g, "Fence_Render", cur, g0, py1 - t, py1, 0, 0.9)
            for z in (1.05, 1.3, 1.55, 1.8):
                S.box(g, "Fascia_Metal", cur, g0, py1 - 0.16, py1 - 0.08, z, z + 0.12)
        cur = g1
    for g0, g1 in gates:
        n = int((g1 - g0) / 0.12)
        for i in range(n):
            x = g0 + (g1 - g0) * (i + 0.5) / n
            S.box(g, "Fascia_Metal", x - 0.025, x + 0.025, py1 - 0.14, py1 - 0.08, 0.05, 1.9)
    # paving: a stone forecourt along the house, the porch, the path to the wicket
    fy = BAY_FRONT + 2.4
    S.box(g, "Paving", 0, 17.35, EAST_FRONT, fy, 0, 0.04)
    S.box(g, "Paving", 9.725, 17.35, EAST_FRONT, BAY_FRONT, 0, PLINTH - 0.2)  # porch
    S.box(g, "Paving", 9.9, 11.5, BAY_FRONT, BAY_FRONT + 0.35, 0, PLINTH - 0.32)  # step
    S.box(g, "Paving", 9.7, 11.7, fy, py1 - t, 0, 0.04)
    # planting beds by the facade, as on the render
    for x0, x1 in ((4.0, 8.4), (12.0, 16.8)):
        S.box(g, "Concrete", x0, x1, BAY_FRONT + 0.4, BAY_FRONT + 1.9, 0, 0.18)
        S.box(g, "Soil", x0 + 0.08, x1 - 0.08, BAY_FRONT + 0.48, BAY_FRONT + 1.82, 0.04, 0.16)
        for i, x in enumerate(np.linspace(x0 + 0.4, x1 - 0.4, 5)):
            PLANTS.append(("cypress" if i % 2 == 0 else "shrub", x, BAY_FRONT + 1.15, 1.9 if i % 2 == 0 else 0.45))
    # pool in the front garden, west of the path
    qx0, qx1, qy0, qy1 = 1.8, 7.6, fy + 1.0, fy + 4.2
    S.box(g, "Paving", qx0 - 1.0, qx1 + 1.0, fy, qy1 + 0.9, 0, 0.04)
    for b in ((qx0 - 0.35, qx1 + 0.35, qy0 - 0.35, qy0), (qx0 - 0.35, qx1 + 0.35, qy1, qy1 + 0.35),
              (qx0 - 0.35, qx0, qy0, qy1), (qx1, qx1 + 0.35, qy0, qy1)):
        S.box(g, "Paving_Terrace", *b, 0, 0.12)
    S.box(g, "Pool_Shell", qx0, qx1, qy0, qy1, 0, 0.02)
    S.box(g, "Water", qx0, qx1, qy0, qy1, 0.02, 0.09)
    # front-west corner: lawn with a group of plantings (no playground, owner's choice)
    for x, y, kind, hh in ((-2.6, fy + 0.6, "cypress", 2.6), (-1.2, fy + 1.4, "shrub", 0.6),
                           (-2.8, fy + 2.6, "shrub", 0.55), (-0.6, fy + 3.2, "cypress", 2.2),
                           (-2.4, py1 - 1.0, "shrub", 0.6)):
        PLANTS.append((kind, x, y, hh))
    # carport in the east side yard, beside the house, its drive to the street gate
    cx0, cx1, cy0, cy1 = 17.7, 21.0, 2.0, 9.5
    for x in (cx0, cx1 - 0.15):
        for y in (cy0 + 0.2, (cy0 + cy1) / 2, cy1 - 0.3):
            S.box(g, "Fascia_Metal", x, x + 0.15, y, y + 0.15, 0, 2.7)
    S.box(g, "Fascia_Metal", cx0 - 0.1, cx1 + 0.1, cy0, cy1, 2.7, 2.95)
    S.box(g, "Roof_MetalSeam", cx0 - 0.1, cx1 + 0.1, cy0, cy1, 2.95, 2.97)
    S.box(g, "Paving_Drive", cx0, cx1, cy0, py1 - t, 0, 0.04)
    # greenery
    for y in np.arange(fy + 0.8, py1 - 0.6, 1.6):
        PLANTS.append(("shrub", 9.25, y, 0.5))
    for x in np.arange(-3.0, 17.5, 2.4):
        PLANTS.append(("cypress", x, py0 + 0.75, 3.0))
    for y in np.arange(2.0, fy - 0.6, 2.4):
        PLANTS.append(("cypress", px0 + 0.75, y, 2.8))
    for x in (12.6, 14.4, 16.2):
        PLANTS.append(("shrub", x, py1 - 0.9, 0.6))


# --------------------------------------------------------------------------- blender

MATERIALS = {
    "Facade_Travertine": ((0.72, 0.62, 0.46, 1), 0.85, 0, "db65077e-a12f-4a87-bb93-f213e108209f", (225, 214, 192), ()),
    "Facade_Plinth": ((0.56, 0.50, 0.40, 1), 0.85, 0, "db65077e-a12f-4a87-bb93-f213e108209f", (190, 182, 166), ()),
    "Facade_WoodPanel": ((0.30, 0.19, 0.12, 1), 0.6, 0, "2dfd1be5-5582-403c-86b5-6cede73d9ea9", (110, 75, 50), ()),
    "Soffit_Wood": ((0.45, 0.30, 0.19, 1), 0.6, 0, "2dfd1be5-5582-403c-86b5-6cede73d9ea9", (150, 105, 70), ()),
    "Pergola_Wood": ((0.24, 0.16, 0.10, 1), 0.6, 0, "2dfd1be5-5582-403c-86b5-6cede73d9ea9", (95, 65, 45), ()),
    "Fascia_Metal": ((0.11, 0.11, 0.12, 1), 0.45, 0.4, "6dacb5a0-f0e0-453f-822d-a66ddb7c608e", (40, 40, 42), ()),
    "Roof_MetalSeam": ((0.18, 0.19, 0.20, 1), 0.4, 0.6, "6dacb5a0-f0e0-453f-822d-a66ddb7c608e", (55, 57, 60), ()),
    "Fence_Render": ((0.60, 0.57, 0.52, 1), 0.85, 0, "583c8f2d-ad2f-4812-87fc-3fa3d727b806", (205, 200, 190), ()),
    "Wall_Paint": ((0.88, 0.85, 0.80, 1), 0.9, 0, "8956f5ed-c0aa-4bc3-9b4e-2f70510fb76d", (240, 238, 233), ()),
    "Ceiling_Paint": ((0.92, 0.90, 0.86, 1), 0.9, 0, "8956f5ed-c0aa-4bc3-9b4e-2f70510fb76d", (248, 247, 244), ()),
    "Concrete": ((0.62, 0.62, 0.60, 1), 0.9, 0, "f9b4fd1a-8061-4a0e-abd0-e9902b3a7c2b", None, ()),
    "Soil": ((0.16, 0.12, 0.09, 1), 1.0, 0, None, None, ()),
    "Window_Frame": ((0.06, 0.06, 0.07, 1), 0.35, 0.6, "6dacb5a0-f0e0-453f-822d-a66ddb7c608e", (40, 40, 42), ()),
    "Railing_Steel": ((0.10, 0.10, 0.11, 1), 0.35, 0.6, "6dacb5a0-f0e0-453f-822d-a66ddb7c608e", (45, 46, 48), ()),
    "Metal_Dark": ((0.07, 0.07, 0.08, 1), 0.4, 0.6, "6dacb5a0-f0e0-453f-822d-a66ddb7c608e", (40, 40, 42), ()),
    "Glass": ((0.70, 0.78, 0.82, 0.15), 0.02, 0, "c9a5cc52-ba0b-4444-a20c-0d48ba3a3b31", None, ()),
    "Door_Entrance": ((0.22, 0.14, 0.09, 1), 0.5, 0, "2dfd1be5-5582-403c-86b5-6cede73d9ea9", (90, 62, 42), ()),
    "Door_Interior": ((0.86, 0.84, 0.80, 1), 0.6, 0, "2dfd1be5-5582-403c-86b5-6cede73d9ea9", (235, 225, 210), ()),
    "Door_Frame": ((0.86, 0.84, 0.80, 1), 0.6, 0, "2dfd1be5-5582-403c-86b5-6cede73d9ea9", (235, 225, 210), ()),
    "Wood_Oak": ((0.62, 0.48, 0.33, 1), 0.55, 0, "2dfd1be5-5582-403c-86b5-6cede73d9ea9", None, ()),
    "Floor_Oak": ((0.62, 0.48, 0.33, 1), 0.5, 0, "56e2b7cb-1bca-4577-a41f-4182921841c0", None, ()),
    "Floor_Stone": ((0.74, 0.68, 0.60, 1), 0.3, 0, "57e1f555-82a3-4472-8092-fbfbc31f0603", (220, 215, 205), ()),
    "Floor_Tile": ((0.70, 0.69, 0.66, 1), 0.35, 0, "57e1f555-82a3-4472-8092-fbfbc31f0603", (200, 197, 190), ()),
    "Bath_Wall_Tile": ((0.70, 0.70, 0.69, 1), 0.3, 0, "67fcad3d-3289-4582-954d-a658c0134124", None, ()),
    "Stair_Wood": ((0.50, 0.36, 0.23, 1), 0.5, 0, "34bd7e89-2db0-4a66-8483-51d49375ee61", None, ()),
    "Paving": ((0.50, 0.47, 0.42, 1), 0.8, 0, "6062dce5-56b6-4085-b139-d1698a4f3f01", (205, 202, 195), ()),
    "Paving_Terrace": ((0.58, 0.54, 0.47, 1), 0.8, 0, "6062dce5-56b6-4085-b139-d1698a4f3f01", (220, 215, 205), ()),
    "Paving_Drive": ((0.50, 0.49, 0.47, 1), 0.9, 0, "97666620-021c-4c71-bdff-0cfaadebae7b", None, ()),
    "Lawn": ((0.10, 0.26, 0.05, 1), 0.95, 0, "05a52f06-88f6-4487-a93f-ed0ffee1baba", None, ()),
    "Foliage": ((0.04, 0.15, 0.04, 1), 0.9, 0, None, None, ()),
    "Field": ((0.20, 0.24, 0.12, 1), 1.0, 0, None, None, ()),
    "Pine": ((0.05, 0.12, 0.06, 1), 0.9, 0, None, None, ()),
    "Bark": ((0.22, 0.14, 0.09, 1), 0.9, 0, None, None, ()),
    "Pool_Shell": ((0.22, 0.56, 0.66, 1), 0.3, 0, None, None, ()),
    "Water": ((0.06, 0.38, 0.46, 0.85), 0.02, 0, None, None, ()),
    "Fabric_Sofa": ((0.62, 0.59, 0.54, 1), 0.95, 0, "1f3eb311-3d6a-42fc-906c-6a1c4ecf3454", (175, 168, 155), ()),
    "Fabric_Bedding": ((0.93, 0.92, 0.89, 1), 0.95, 0, "1f3eb311-3d6a-42fc-906c-6a1c4ecf3454", (240, 238, 232), ()),
    "Fabric_Accent": ((0.42, 0.47, 0.42, 1), 0.95, 0, "1f3eb311-3d6a-42fc-906c-6a1c4ecf3454", (110, 125, 110), ()),
    "Lamp_Shade": ((0.95, 0.93, 0.88, 1), 0.9, 0, "1f3eb311-3d6a-42fc-906c-6a1c4ecf3454", (245, 240, 228), ()),
    "Rug_Wool": ((0.78, 0.75, 0.70, 1), 1.0, 0, "239c760d-03ca-4534-8242-40234ff9287d", (200, 195, 185), ()),
    "Curtain_Sheer": ((0.94, 0.93, 0.91, 0.7), 0.9, 0, "89d49384-06a5-42fc-82e0-775aefc7064e", (240, 238, 234), ()),
    "Kitchen_Front": ((0.24, 0.25, 0.26, 1), 0.6, 0, "8956f5ed-c0aa-4bc3-9b4e-2f70510fb76d", (60, 62, 64), ()),
    "Countertop_Marble": ((0.92, 0.91, 0.90, 1), 0.15, 0, "07454bf0-2066-45ee-adc1-2814e496aea5", None, ()),
    "Sanitary_Ceramic": ((0.97, 0.97, 0.97, 1), 0.08, 0, "3ecb0143-568a-4715-81e7-352bb8b83eed", (250, 250, 250), ()),
    "Chrome": ((0.85, 0.85, 0.85, 1), 0.1, 1, "cac63920-4338-47c7-a6bd-6c3c300778c8", None, ()),
    "Mirror": ((0.90, 0.90, 0.90, 1), 0.0, 1, "2ef526f2-288c-482e-97cf-7f49a276a42e", None, ()),
    "Appliance_White": ((0.92, 0.92, 0.92, 1), 0.3, 0.2, "56a75c88-4b0b-4804-a2a6-a748a4bdbda6", None, ()),
    "Black_Glass": ((0.02, 0.02, 0.02, 1), 0.05, 0, None, None, ()),
    "Light_Emissive": ((1.0, 0.92, 0.80, 1), 0.5, 0, "4a4aca1b-7f59-4750-9775-50e49753ecf4", (255, 228, 196), ("[Glow 30]",)),
}


def _nodes(m):
    nt = m.node_tree
    bsdf = nt.nodes.get("Principled BSDF")
    uv = nt.nodes.new("ShaderNodeTexCoord")
    return nt, bsdf, uv


def procedural(name, m):
    """Panel joints and wood grain in metres (every face has metre UVs)."""
    nt, bsdf, tc = _nodes(m)
    col = MATERIALS[name][0]
    if name in ("Facade_Travertine", "Facade_Plinth", "Paving", "Paving_Terrace", "Floor_Stone", "Fence_Render"):
        size = {"Facade_Travertine": (1.2, 0.6), "Facade_Plinth": (1.2, 0.45), "Floor_Stone": (1.2, 0.6),
                "Fence_Render": (3.0, 2.2)}.get(name, (0.8, 0.4))
        br = nt.nodes.new("ShaderNodeTexBrick")
        br.offset = 0.5 if name != "Facade_Travertine" else 0.0
        br.inputs["Scale"].default_value = 1.0
        br.inputs["Brick Width"].default_value = size[0]
        br.inputs["Row Height"].default_value = size[1]
        br.inputs["Mortar Size"].default_value = 0.006
        noise = nt.nodes.new("ShaderNodeTexNoise")
        noise.inputs["Scale"].default_value = 3.0
        mix = nt.nodes.new("ShaderNodeMix")
        mix.data_type = "RGBA"
        mix.inputs["Factor"].default_value = 0.12
        c1 = tuple(v * 0.97 for v in col[:3]) + (1,)
        c2 = tuple(v * 1.03 for v in col[:3]) + (1,)
        br.inputs["Color1"].default_value = c1
        br.inputs["Color2"].default_value = c2
        br.inputs["Mortar"].default_value = tuple(v * 0.72 for v in col[:3]) + (1,)
        nt.links.new(tc.outputs["UV"], br.inputs["Vector"])
        nt.links.new(tc.outputs["UV"], noise.inputs["Vector"])
        nt.links.new(br.outputs["Color"], mix.inputs["A"])
        nt.links.new(noise.outputs["Color"], mix.inputs["B"])
        nt.links.new(mix.outputs["Result"], bsdf.inputs["Base Color"])
    elif name in ("Facade_WoodPanel", "Soffit_Wood", "Pergola_Wood", "Floor_Oak", "Stair_Wood", "Door_Entrance"):
        # grain: noise stretched along the boards; vertical boards on the facade
        vertical = name in ("Facade_WoodPanel", "Door_Entrance")
        mapping = nt.nodes.new("ShaderNodeMapping")
        mapping.inputs["Scale"].default_value = (28.0, 1.2, 1.0) if vertical else (1.2, 28.0, 1.0)
        noise = nt.nodes.new("ShaderNodeTexNoise")
        noise.inputs["Scale"].default_value = 2.5
        noise.inputs["Detail"].default_value = 8.0
        noise.inputs["Distortion"].default_value = 0.4
        ramp = nt.nodes.new("ShaderNodeValToRGB")
        ramp.color_ramp.elements[0].position = 0.35
        ramp.color_ramp.elements[1].position = 0.7
        ramp.color_ramp.elements[0].color = tuple(v * 0.72 for v in col[:3]) + (1,)
        ramp.color_ramp.elements[1].color = tuple(min(1, v * 1.18) for v in col[:3]) + (1,)
        nt.links.new(tc.outputs["UV"], mapping.inputs["Vector"])
        nt.links.new(mapping.outputs["Vector"], noise.inputs["Vector"])
        nt.links.new(noise.outputs["Fac"], ramp.inputs["Fac"])
        out = ramp.outputs["Color"]
        joints = {"Facade_WoodPanel": (0.2, 30.0), "Floor_Oak": (1.2, 0.2), "Soffit_Wood": (2.4, 0.15)}.get(name)
        if joints:
            br = nt.nodes.new("ShaderNodeTexBrick")
            br.offset = 0.5
            br.inputs["Brick Width"].default_value = joints[0]
            br.inputs["Row Height"].default_value = joints[1]
            br.inputs["Mortar Size"].default_value = 0.003
            br.inputs["Color1"].default_value = (1, 1, 1, 1)
            br.inputs["Color2"].default_value = (0.93, 0.93, 0.93, 1)
            br.inputs["Mortar"].default_value = (0.4, 0.4, 0.4, 1)
            mul = nt.nodes.new("ShaderNodeMix")
            mul.data_type = "RGBA"
            mul.blend_type = "MULTIPLY"
            mul.inputs["Factor"].default_value = 1.0
            nt.links.new(tc.outputs["UV"], br.inputs["Vector"])
            nt.links.new(out, mul.inputs["A"])
            nt.links.new(br.outputs["Color"], mul.inputs["B"])
            out = mul.outputs["Result"]
        nt.links.new(out, bsdf.inputs["Base Color"])
    elif name in ("Lawn", "Foliage", "Field", "Pine"):
        noise = nt.nodes.new("ShaderNodeTexNoise")
        noise.inputs["Scale"].default_value = 8.0 if name == "Lawn" else 14.0
        ramp = nt.nodes.new("ShaderNodeValToRGB")
        ramp.color_ramp.elements[0].color = tuple(v * 0.7 for v in col[:3]) + (1,)
        ramp.color_ramp.elements[1].color = tuple(min(1, v * 1.35) for v in col[:3]) + (1,)
        nt.links.new(tc.outputs["Object" if name == "Foliage" else "UV"], noise.inputs["Vector"])
        nt.links.new(noise.outputs["Fac"], ramp.inputs["Fac"])
        nt.links.new(ramp.outputs["Color"], bsdf.inputs["Base Color"])
        bump = nt.nodes.new("ShaderNodeBump")
        bump.inputs["Strength"].default_value = 0.5
        nt.links.new(noise.outputs["Fac"], bump.inputs["Height"])
        nt.links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])


def material(name):
    m = bpy.data.materials.get(name)
    if m:
        return m
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get("Principled BSDF")
    col, rough, metal = MATERIALS[name][:3]
    bsdf.inputs["Base Color"].default_value = col
    bsdf.inputs["Roughness"].default_value = rough
    bsdf.inputs["Metallic"].default_value = metal
    if col[3] < 1:
        bsdf.inputs["Alpha"].default_value = col[3]
        if name in ("Glass", "Water"):
            bsdf.inputs["Transmission Weight"].default_value = 1.0
            bsdf.inputs["Alpha"].default_value = 0.25 if name == "Glass" else 0.85
        m.surface_render_method = "BLENDED"
    if name == "Light_Emissive":
        bsdf.inputs["Emission Color"].default_value = col
        bsdf.inputs["Emission Strength"].default_value = 12.0
    procedural(name, m)
    m.diffuse_color = col
    return m


def write_substitution_table():
    import csv
    path = os.path.join(OUT, "Home_Brick_Substitution.csv")
    width = 32
    with open(path, "w", newline="", encoding="utf-8") as fh:
        w = csv.writer(fh)
        w.writerow(["#version=3"] + [""] * (width - 1))
        w.writerow(["#Brick house 193.5 m2 - substitution table for home_brick.glb / home_brick.fbx"] + [""] * (width - 1))
        w.writerow(["#Row ID", "Row Name", "Substitution Type", "Filter", "Condition", "Value", "TM Library GUID",
                    "Instance Type", "Parameter Overrides >>>"] + [""] * (width - 9))
        for i, (name, (_, _, _, guid, tint, extra)) in enumerate(MATERIALS.items(), 1):
            if not guid:
                continue
            params = ([f"[TintColor {tint[0]} {tint[1]} {tint[2]}]"] if tint else []) + list(extra)
            row = [f"{i:02d}", name, "Material", "Name", "Equals", name, guid.upper(), "Copy"] + params
            w.writerow(row + [""] * (width - len(row)))
    return path


# Twinmotion orbits the scene origin, so its export is centred on the house.
# The Unreal export (--ue) puts the origin at the house's front-left ground
# corner (plan x 0, y W): X along the main facade, Y towards the back, Z up.
UE = "--ue" in sys.argv
CENTER = Vector((0, 0, 0)) if UE else Vector((-L / 2, -W / 2, 0))


def write_mesh(name, boxes, mat, parent):
    bm = bmesh.new()
    uv = bm.loops.layers.uv.new("UVMap")
    for x0, x1, y0, y1, z0, z1 in boxes:
        v = [bm.verts.new(p) for p in (
            (x0, y0, z0), (x1, y0, z0), (x1, y1, z0), (x0, y1, z0),
            (x0, y0, z1), (x1, y0, z1), (x1, y1, z1), (x0, y1, z1))]
        for vert in v:
            vert.co += CENTER
        for idx in ((0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)):
            face = bm.faces.new([v[i] for i in idx])
            face.normal_update()
            n = face.normal
            ax = max(range(3), key=lambda k: abs(n[k]))
            u_ax, v_ax = [k for k in range(3) if k != ax]
            if ax == 2:
                u_ax, v_ax = 0, 1
            for loop in face.loops:
                co = loop.vert.co
                loop[uv].uv = (co[u_ax], co[v_ax])
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    me.materials.append(material(mat))
    ob = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(ob)
    ob.parent = parent
    width, segments = BEVEL.get(name.split("_")[0], (0, 0))
    if width:
        bev = ob.modifiers.new("Bevel", "BEVEL")
        bev.width, bev.segments, bev.limit_method, bev.use_clamp_overlap = width, segments, "NONE", True
    return ob


BEVEL = {"Soft": (0.03, 3), "Furniture": (0.006, 2), "Kitchen": (0.004, 2), "Bath": (0.004, 2), "Doors": (0.003, 1)}


def plan_to_blender(x, y, z):
    return Vector((x, W - y, z)) + CENTER


def place_assets(assets, root):
    parent = bpy.data.objects.new("Furniture_Models", None)
    bpy.context.scene.collection.objects.link(parent)
    parent.parent = root
    meshes = {}
    for name, x, y, z, deg in assets:
        if name not in meshes:
            before = set(bpy.data.objects)
            bpy.ops.import_scene.gltf(filepath=os.path.join(HERE, "assets", "polyhaven", name, f"{name}_1k.gltf"))
            new = [o for o in bpy.data.objects if o not in before]
            names = [o.name for o in new]
            parts = [o for o in new if o.type == "MESH"]
            for o in parts:
                mw = o.matrix_world.copy()
                o.parent = None
                o.data.transform(mw)
                o.matrix_world = Matrix.Identity(4)
            with bpy.context.temp_override(active_object=parts[0], selected_editable_objects=parts):
                bpy.ops.object.join()
            meshes[name] = parts[0].data
            for n in names:
                if n in bpy.data.objects:
                    bpy.data.objects.remove(bpy.data.objects[n])
        floor = 2 if z >= FFL[1] - 0.05 else 1
        ob = bpy.data.objects.new(f"Model_F{floor}_{name}", meshes[name])
        bpy.context.scene.collection.objects.link(ob)
        ob.parent = parent
        ob.location = plan_to_blender(x, y, z)
        ob.rotation_euler = (0, 0, math.radians(deg))


def place_lights(lights, root, name="Light_Sources", watts_scale=1.0):
    parent = bpy.data.objects.new(name, None)
    bpy.context.scene.collection.objects.link(parent)
    parent.parent = root
    for i, (x, y, z, watts) in enumerate(lights):
        data = bpy.data.lights.new(f"{name}_{i:02d}", "POINT")
        data.energy, data.color, data.shadow_soft_size = watts * watts_scale, (1.0, 0.86, 0.72), 0.15
        data.use_shadow = False
        ob = bpy.data.objects.new(f"{name}_{i:02d}", data)
        bpy.context.scene.collection.objects.link(ob)
        ob.parent = parent
        ob.location = plan_to_blender(x, y, z)


def place_tilted(root):
    for i, (mat, c, size, rot) in enumerate(TILTED):
        bpy.ops.mesh.primitive_cube_add(size=1.0)
        ob = bpy.context.active_object
        ob.name = f"Site_Tilted_{i:02d}"
        ob.scale = size
        # plan y runs against Blender Y, so a tilt about plan x flips sign
        ob.rotation_euler = (math.radians(-rot[0]), math.radians(rot[1]), math.radians(rot[2]))
        ob.location = plan_to_blender(*c)
        ob.data.materials.append(material(mat))
        for col in ob.users_collection:
            col.objects.unlink(ob)
        bpy.context.scene.collection.objects.link(ob)
        ob.parent = root


def place_forest(root):
    """Pines round the plot, as on the project's renders (linked copies)."""
    import random
    rnd = random.Random(7)
    parent = bpy.data.objects.new("Forest", None)
    bpy.context.scene.collection.objects.link(parent)
    parent.parent = root
    bpy.ops.mesh.primitive_cone_add(vertices=24, radius1=1.0, depth=1.0)
    crown = bpy.context.active_object.data
    crown.materials.append(material("Pine"))
    bpy.data.objects.remove(bpy.context.active_object)
    bpy.ops.mesh.primitive_cylinder_add(vertices=10, radius=1.0, depth=1.0)
    trunk = bpy.context.active_object.data
    trunk.materials.append(material("Bark"))
    bpy.data.objects.remove(bpy.context.active_object)
    px0, px1, py0, py1 = PLOT
    n = 0
    while n < 70:
        x, y = rnd.uniform(-30, 48), rnd.uniform(-30, 60)
        if px0 - 3 < x < px1 + 3 and py0 - 3 < y < py1 + 10:
            continue
        if -14 < x < 32 and y > py1:  # keep the street side clear for the views
            continue
        h = rnd.uniform(11, 17)
        for mesh, sc, z in ((trunk, (0.22, 0.22, h * 0.6), h * 0.3), (crown, (h * 0.17, h * 0.17, h * 0.6), h * 0.68)):
            ob = bpy.data.objects.new(f"Forest_{n:02d}", mesh)
            bpy.context.scene.collection.objects.link(ob)
            ob.parent = parent
            ob.scale = sc
            ob.location = plan_to_blender(x, y, z)
        n += 1


def place_plants(root):
    parent = bpy.data.objects.new("Site_Plants", None)
    bpy.context.scene.collection.objects.link(parent)
    parent.parent = root
    mat = material("Foliage")
    pot = material("Concrete")
    for i, (kind, x, y, h) in enumerate(PLANTS):
        if kind == "cypress":
            bpy.ops.mesh.primitive_uv_sphere_add(segments=40, ring_count=24, radius=1.0)
            ob = bpy.context.active_object
            r = h * 0.17
            ob.scale = (r, r, h / 2)
            ob.location = plan_to_blender(x, y, h / 2 + 0.05)
        else:
            bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=5, radius=1.0)
            ob = bpy.context.active_object
            ob.scale = (h * 0.75, h * 0.75, h * 0.6)
            ob.location = plan_to_blender(x, y, h * 0.5)
        ob.name = f"Site_Plant_{i:02d}"
        ob.data.materials.append(mat)
        for c in ob.users_collection:
            c.objects.unlink(ob)
        bpy.context.scene.collection.objects.link(ob)
        ob.parent = parent
        disp = ob.modifiers.new("Leaves", "DISPLACE")
        tex = bpy.data.textures.get("LeafNoise") or bpy.data.textures.new("LeafNoise", "CLOUDS")
        tex.noise_scale = 0.18
        disp.texture, disp.strength = tex, 0.07
    del pot


def build_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    exterior_walls(0, GROUND, 0, TOP0, "Facade_Travertine", "Ext_F1")
    exterior_walls(1, TOP, TOP0, ROOF1_TOP, "Facade_WoodPanel", "Ext_F2")
    soffit_lights = slabs_and_roofs()
    pylon()
    floors_finish()
    partitions()
    stair()
    site()
    assets, lights = furnish()

    root = bpy.data.objects.new("House_Brick", None)
    bpy.context.scene.collection.objects.link(root)
    groups = {}
    for (group, mat), boxes in sorted(S.parts.items()):
        if group not in groups:
            e = bpy.data.objects.new(group, None)
            bpy.context.scene.collection.objects.link(e)
            e.parent = root
            groups[group] = e
        write_mesh(f"{group}__{mat}", boxes, mat, groups[group])
    place_assets(assets, root)
    place_lights(lights, root, watts_scale=2.5)
    place_lights([(x, y, z - 0.15, 6) for x, y, z in soffit_lights], root, "Soffit_Lights")
    LIGHTS[:] = [("interior", x, y, z, w * 2.5) for x, y, z, w in lights] + \
        [("soffit", x, y, z - 0.15, 6) for x, y, z in soffit_lights]
    if not UE:  # Unreal brings its own vegetation
        place_plants(root)
        place_tilted(root)
        place_forest(root)
    return root


LIGHTS = []  # (kind, plan x, y, z, watts), for lights.json


def export(root):
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT, "home_brick.blend"))
    bpy.ops.export_scene.fbx(
        filepath=os.path.join(OUT, "home_brick.fbx"), object_types={"EMPTY", "MESH", "LIGHT"},
        apply_unit_scale=True, apply_scale_options="FBX_SCALE_UNITS", mesh_smooth_type="FACE",
        use_mesh_modifiers=True, path_mode="COPY", embed_textures=True,
    )
    bpy.ops.export_scene.gltf(filepath=os.path.join(OUT, "home_brick.glb"), export_format="GLB",
                              export_apply=True, export_lights=True)
    write_substitution_table()


UPPER_GROUPS = ("Ext_F2", "Facade_F2", "Windows_F2", "Walls_F2", "Doors_F2", "Floors_F2", "Railings_F2", "Furniture_F2",
                "Soft_F2", "Bath_F2", "Model_F2", "Roof_F2", "Slab_F2", "Pylon", "Curtains", "Lights", "Soffit_Lights")
# (file, camera in plan metres, target, focal length mm, groups hidden, exposure)
SHOTS = [
    ("front.png", (11.4, 18.1, 1.6), (9.9, 8.8, 4.0), 16, (), 0.0),
    ("aerial.png", (8.7, 36.0, 20.0), (8.7, 8.5, 1.5), 24, (), 0.0),
    ("street.png", (20.4, 18.0, 1.7), (8.0, 8.0, 3.4), 18, (), 0.0),
    ("terrace.png", (1.0, BAY_FRONT + 2.2, 1.7), (1.8, 3.0, 1.5), 18, (), 0.0),
    ("living.png", (9.35, 10.0, FFL[0] + 1.5), (4.6, 2.4, FFL[0] + 1.1), 17, (), 0.5),
    ("hall.png", (10.5, 8.75, FFL[0] + 1.6), (10.6, 1.0, FFL[0] + 1.9), 18, (), 0.5),
    ("bedroom.png", (7.5, 5.3, FFL[1] + 1.55), (4.2, 8.7, FFL[1] + 1.0), 18, (), 0.5),
    ("cut_floor1.png", (8.7, 13.5, 22.0), (8.7, 5.0, 0), 24, UPPER_GROUPS + ("Roof_F1", "Slab_F1", "Site_Plants"), 0.0),
    ("cut_floor2.png", (8.7, 13.5, 25.0), (8.7, 5.0, 3.5), 24, ("Roof_F2", "Slab_F2", "Lights", "Soffit_Lights", "Site_Plants", "Pylon"), 0.0),
]


def render_previews(only=None):
    sc = bpy.context.scene
    sc.render.engine = "BLENDER_EEVEE"
    sc.render.resolution_x, sc.render.resolution_y = 1600, 1000
    sc.eevee.taa_render_samples = 64
    sc.eevee.use_raytracing = True
    sc.eevee.use_shadows = True
    sc.eevee.use_fast_gi = True
    sc.view_settings.view_transform = "AgX"
    sc.view_settings.look = "AgX - Punchy"
    sc.eevee.shadow_pool_size = "1024"
    world = bpy.data.worlds.new("Sky")
    world.use_nodes = True
    nt = world.node_tree
    sky = nt.nodes.new("ShaderNodeTexSky")
    sky.sky_type = "MULTIPLE_SCATTERING"
    sun_el, sun_rot = math.radians(38), math.radians(200)
    sky.sun_elevation, sky.sun_rotation = sun_el, sun_rot
    nt.links.new(sky.outputs["Color"], nt.nodes["Background"].inputs["Color"])
    nt.nodes["Background"].inputs["Strength"].default_value = 0.14
    sc.world = world
    sun = bpy.data.objects.new("Sun", bpy.data.lights.new("Sun", "SUN"))
    sun.data.energy = 4.6
    sun.data.color = (1.0, 0.93, 0.83)
    sun.data.angle = math.radians(1.5)
    sun.rotation_euler = (math.pi / 2 - sun_el, 0, sun_rot + math.pi / 2)
    sc.collection.objects.link(sun)
    # ground beyond the plot
    ground = bpy.data.meshes.new("Ground")
    bm = bmesh.new()
    bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=120)
    bm.to_mesh(ground)
    g = bpy.data.objects.new("Ground", ground)
    g.location = (0, 0, -0.04)
    ground.materials.append(material("Field"))
    sc.collection.objects.link(g)

    cam = bpy.data.objects.new("Cam", bpy.data.cameras.new("Cam"))
    sc.collection.objects.link(cam)
    sc.camera = cam
    rdir = os.path.join(OUT, "renders_ue" if UE else "renders")  # the Unreal geometry check apart
    os.makedirs(rdir, exist_ok=True)

    def shot(name, loc, target, lens, hide, exposure):
        if only and name not in only:
            return
        sc.view_settings.exposure = exposure
        loc, target = plan_to_blender(*loc), plan_to_blender(*target)
        cam.location = loc
        cam.rotation_euler = (target - loc).to_track_quat("-Z", "Y").to_euler()
        cam.data.lens = lens
        cam.data.clip_start = 0.05
        for ob in bpy.data.objects:
            ob.hide_render = any(ob.name.startswith(h) for h in hide)
        sc.render.filepath = os.path.join(rdir, name)
        bpy.ops.render.render(write_still=True)

    for name, loc, target, lens, hide, exposure in SHOTS:
        shot(name, loc, target, lens, hide, exposure)

def export_ue(root):
    """home_brick_ue.glb for Unreal, with cameras.json and lights.json in the
    same frame: metres, Z up, origin at the house's front-left ground corner,
    X along the main facade, Y towards the back. (glTF itself is Y-up; the
    importer turns it back to Z-up.)"""
    bpy.ops.export_scene.gltf(filepath=os.path.join(OUT, "home_brick_ue.glb"), export_format="GLB",
                              export_apply=True, export_lights=False, export_cameras=False)
    v = lambda p: [round(c, 3) for c in plan_to_blender(*p)]
    cams = [{"name": n.removesuffix(".png"), "location": v(loc), "target": v(tgt), "focal_length_mm": lens,
             "sensor_width_mm": 36, "kind": "cutaway" if n.startswith("cut") else "interior" if e > 0 else "exterior"}
            for n, loc, tgt, lens, _, e in SHOTS]
    json.dump({"frame": "metres, Z up, origin = house front-left ground corner, X along the main facade, Y to the back",
               "cameras": cams}, open(os.path.join(OUT, "cameras.json"), "w"), indent=1, ensure_ascii=False)
    marks = {0: ["ОК-1", "ОК-2", "ОК-3", "ОК-4", "ОК-5"], 1: ["ОК-6", "ОК-7", "ОК-8", "ОК-5"]}
    windows = []
    for f, plan in enumerate((F0, F1)):
        for i, w in enumerate(plan["windows"]):
            zb, zt = window_z(f, w)
            horiz = w["side"] in ("top", "bottom")
            a = (w["x"], w["y"]) if horiz else (w["x"], w["y"])
            b = (w["x"] + w["len"], w["y"]) if horiz else (w["x"], w["y"] + w["len"])
            windows.append({"mark": marks[f][i] if i < len(marks[f]) else f"F{f + 1}-{i + 1}", "floor": f + 1,
                            "facing": {"bottom": "front", "top": "back", "left": "west", "right": "east"}[w["side"]],
                            "from": v((*a, FFL[f] + zb)), "to": v((*b, FFL[f] + zt)), "width_m": round(w["len"], 3),
                            "glass_object": f"Windows_F{f + 1}__Glass"})
    lights = [{"kind": k, "location": v((x, y, z)), "watts": round(w, 1), "kelvin": 2900} for k, x, y, z, w in LIGHTS]
    json.dump({"frame": "same as cameras.json", "windows": windows, "lights": lights},
              open(os.path.join(OUT, "lights.json"), "w"), indent=1, ensure_ascii=False)
    # where the planting goes (Unreal places its own vegetation), and the plot
    px0, px1, py0, py1 = PLOT
    corners = [v((px0, py0, 0)), v((px1, py1, 0))]
    json.dump({"frame": "same as cameras.json",
               "plot": {"min": [min(c[0] for c in corners), min(c[1] for c in corners)],
                        "max": [max(c[0] for c in corners), max(c[1] for c in corners)]},
               "plants": [{"kind": k, "location": v((x, y, 0)), "height_m": h} for k, x, y, h in PLANTS]},
              open(os.path.join(OUT, "plants.json"), "w"), indent=1, ensure_ascii=False)


if __name__ == "__main__":
    args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    root = build_scene()
    if UE:
        export_ue(root)
    elif "--no-export" not in args:
        export(root)
    if "--no-render" not in args:
        render_previews([a for a in args if a.endswith(".png")] or None)
    print("BUILD OK", sum(len(b) for b in S.parts.values()), "boxes,", len(S.parts), "meshes")
