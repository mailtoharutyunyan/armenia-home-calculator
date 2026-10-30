"""Furniture, fittings, lights and the plot around the house.

Everything is placed in plan coordinates (x to the right, y from the back wall
to the main facade, metres) against the rooms of the calculator's template
plan, found by their labels. Built-in pieces are boxes in the shared scene;
Poly Haven models (CC0, assets/polyhaven) and lights come back as placements
for build_home.py to add in Blender.

"Against a wall" pieces are drawn in a local frame: u runs along the wall from
the piece's centre, v runs from the wall into the room.
"""

import math

INSET = 0.05  # half a partition: the clear face of a room's wall


class Furnisher:
    def __init__(self, scene, plans, ffl, ceil, house):
        self.S = scene
        self.plans = plans
        self.ffl = ffl
        self.ceil = ceil
        self.h = house  # L, W, wall, plinth, roof_top, hall_ceiling
        self.assets = []  # (asset id, x, y, z, facing degrees)
        self.lights = []  # (x, y, z, watts)

    # ------------------------------------------------------------------ helpers

    def room(self, f, label):
        """Clear rectangle of a room: (x0, x1, y0, y1)."""
        r = next(r for r in self.plans[f]["rooms"] if r["label"] == label)
        return (r["x"] + INSET, r["x"] + r["w"] - INSET, r["y"] + INSET, r["y"] + r["h"] - INSET)

    def box(self, f, group, mat, x0, x1, y0, y1, z0, z1):
        """A box standing on floor f (z relative to its finished floor)."""
        self.S.box(group, mat, x0, x1, y0, y1, self.ffl[f] + z0, self.ffl[f] + z1)

    def on_wall(self, f, group, mat, side, wall, center, u0, u1, v0, v1, z0, z1):
        """A box against a wall. side: which wall of the room it stands on."""
        if side == "back":  # wall at y = wall, the room in +y
            self.box(f, group, mat, center + u0, center + u1, wall + v0, wall + v1, z0, z1)
        elif side == "front":  # wall at y = wall, the room in -y
            self.box(f, group, mat, center - u1, center - u0, wall - v1, wall - v0, z0, z1)
        elif side == "left":  # wall at x = wall, the room in +x
            self.box(f, group, mat, wall + v0, wall + v1, center - u1, center - u0, z0, z1)
        else:  # right: wall at x = wall, the room in -x
            self.box(f, group, mat, wall - v1, wall - v0, center + u0, center + u1, z0, z1)

    def asset(self, name, x, y, z, face):
        """A Poly Haven model at (x, y, z) facing plan direction `face` (dx, dy)."""
        self.assets.append((name, x, y, z, math.degrees(math.atan2(face[0], face[1]))))

    def light(self, x, y, z, watts):
        self.lights.append((x, y, z, watts))

    # ------------------------------------------------------------------ pieces

    def bed(self, f, side, wall, center, width, length=2.1):
        g, soft = f"Furniture_F{f + 1}", f"Soft_F{f + 1}"
        w = width / 2
        self.on_wall(f, soft, "Fabric_Sofa", side, wall, center, -w - 0.1, w + 0.1, 0, 0.08, 0, 1.15)  # headboard
        self.on_wall(f, g, "Wood_Oak", side, wall, center, -w, w, 0.08, length, 0.06, 0.30)  # frame
        self.on_wall(f, soft, "Fabric_Bedding", side, wall, center, -w + 0.03, w - 0.03, 0.10, length - 0.02, 0.30, 0.52)
        self.on_wall(f, soft, "Fabric_Bedding", side, wall, center, -w - 0.03, w + 0.03, 0.62, length + 0.03, 0.50, 0.57)
        self.on_wall(f, soft, "Fabric_Accent", side, wall, center, -w - 0.04, w + 0.04, length - 0.55, length + 0.04, 0.57, 0.60)
        for a, b in ((-w + 0.08, -0.04), (0.04, w - 0.08)):  # two pillows
            self.on_wall(f, soft, "Fabric_Bedding", side, wall, center, a, b, 0.14, 0.52, 0.52, 0.66)
        for u in (-w - 0.5, w + 0.5):  # nightstands with a lamp
            self.on_wall(f, g, "Wood_Oak", side, wall, center, u - 0.22, u + 0.22, 0.02, 0.42, 0, 0.48)
            self.on_wall(f, g, "Metal_Dark", side, wall, center, u - 0.03, u + 0.03, 0.18, 0.24, 0.48, 0.80)
            self.on_wall(f, soft, "Lamp_Shade", side, wall, center, u - 0.14, u + 0.14, 0.07, 0.35, 0.72, 0.94)

    def wardrobe(self, f, side, wall, center, length, depth=0.6, height=2.4):
        g = f"Furniture_F{f + 1}"
        self.on_wall(f, g, "Wood_Oak", side, wall, center, -length / 2, length / 2, 0, depth, 0, height)
        doors = max(1, round(length / 0.6))
        for i in range(1, doors):  # door joints and handles
            u = -length / 2 + length * i / doors
            self.on_wall(f, g, "Metal_Dark", side, wall, center, u - 0.004, u + 0.004, depth, depth + 0.004, 0.02, height - 0.02)
            self.on_wall(f, g, "Metal_Dark", side, wall, center, u - 0.03, u + 0.03, depth, depth + 0.02, 0.9, 1.3)

    def desk(self, f, side, wall, center, length=1.6):
        g = f"Furniture_F{f + 1}"
        self.on_wall(f, g, "Wood_Oak", side, wall, center, -length / 2, length / 2, 0, 0.7, 0.72, 0.75)
        for u in (-length / 2 + 0.03, length / 2 - 0.06):
            self.on_wall(f, g, "Metal_Dark", side, wall, center, u, u + 0.03, 0.05, 0.65, 0, 0.72)
        self.office_chair(f, side, wall, center)

    def office_chair(self, f, side, wall, center):
        g, soft = f"Furniture_F{f + 1}", f"Soft_F{f + 1}"
        self.on_wall(f, soft, "Fabric_Accent", side, wall, center, -0.24, 0.24, 0.62, 1.10, 0.44, 0.52)  # seat
        self.on_wall(f, soft, "Fabric_Accent", side, wall, center, -0.22, 0.22, 1.06, 1.12, 0.56, 1.02)  # back
        self.on_wall(f, g, "Metal_Dark", side, wall, center, -0.03, 0.03, 0.83, 0.89, 0.06, 0.44)
        self.on_wall(f, g, "Metal_Dark", side, wall, center, -0.30, 0.30, 0.83, 0.89, 0.02, 0.06)
        self.on_wall(f, g, "Metal_Dark", side, wall, center, -0.03, 0.03, 0.56, 1.16, 0.02, 0.06)

    def wc(self, f, side, wall, center):
        g = f"Bath_F{f + 1}"
        self.on_wall(f, g, "Bath_Wall_Tile", side, wall, center, -0.30, 0.30, 0, 0.16, 0, 1.12)  # frame boxing
        self.on_wall(f, g, "Chrome", side, wall, center, -0.12, 0.12, 0.16, 0.17, 0.95, 1.10)  # flush plate
        self.on_wall(f, g, "Sanitary_Ceramic", side, wall, center, -0.18, 0.18, 0.16, 0.70, 0.30, 0.40)
        self.on_wall(f, g, "Sanitary_Ceramic", side, wall, center, -0.19, 0.19, 0.16, 0.72, 0.40, 0.43)  # seat

    def vanity(self, f, side, wall, center, length=0.9, mirror=True):
        g = f"Bath_F{f + 1}"
        self.on_wall(f, g, "Wood_Oak", side, wall, center, -length / 2, length / 2, 0, 0.48, 0.30, 0.82)
        self.on_wall(f, g, "Sanitary_Ceramic", side, wall, center, -length / 2, length / 2, 0, 0.50, 0.82, 0.85)
        basins = max(1, round(length / 0.9))
        for i in range(basins):
            u = -length / 2 + length * (i + 0.5) / basins
            self.on_wall(f, g, "Sanitary_Ceramic", side, wall, center, u - 0.22, u + 0.22, 0.08, 0.44, 0.85, 0.98)
            self.on_wall(f, g, "Chrome", side, wall, center, u - 0.02, u + 0.02, 0.02, 0.06, 0.85, 1.12)
            self.on_wall(f, g, "Chrome", side, wall, center, u - 0.02, u + 0.02, 0.02, 0.18, 1.08, 1.12)
        if mirror:
            self.on_wall(f, g, "Mirror", side, wall, center, -length / 2, length / 2, 0, 0.02, 1.15, 1.95)
            self.on_wall(f, g, "Light_Emissive", side, wall, center, -length / 2, length / 2, 0, 0.03, 1.97, 2.00)

    def shower(self, f, x0, x1, y0, y1, glass):
        """Walk-in shower: low tray, one glass screen ('x'/'y' and its line), rain head."""
        g = f"Bath_F{f + 1}"
        self.box(f, g, "Sanitary_Ceramic", x0, x1, y0, y1, 0, 0.035)
        (axis, at, a, b) = glass
        if axis == "x":
            self.box(f, g, "Glass", a, b, at - 0.005, at + 0.005, 0.035, 2.0)
            self.box(f, g, "Chrome", a, b, at - 0.012, at + 0.012, 1.98, 2.0)
        else:
            self.box(f, g, "Glass", at - 0.005, at + 0.005, a, b, 0.035, 2.0)
            self.box(f, g, "Chrome", at - 0.012, at + 0.012, a, b, 1.98, 2.0)
        cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
        self.box(f, g, "Chrome", cx - 0.15, cx + 0.15, cy - 0.15, cy + 0.15, 2.15, 2.16)
        self.box(f, g, "Chrome", cx - 0.01, cx + 0.01, cy - 0.01, cy + 0.01, 2.16, self.ceil[f] - self.ffl[f])

    def bathtub(self, f, x0, x1, y0, y1):
        g, t = f"Bath_F{f + 1}", 0.08
        self.box(f, g, "Sanitary_Ceramic", x0, x1, y0, y1, 0, 0.12)
        for b in ((x0, x1, y0, y0 + t), (x0, x1, y1 - t, y1), (x0, x0 + t, y0, y1), (x1 - t, x1, y0, y1)):
            self.box(f, g, "Sanitary_Ceramic", *b, 0.12, 0.56)
        self.box(f, g, "Chrome", (x0 + x1) / 2 - 0.02, (x0 + x1) / 2 + 0.02, y0 + 0.02, y0 + 0.16, 0.56, 0.62)

    # ------------------------------------------------------------------ rooms

    def living(self):
        x0, x1, y0, y1 = self.room(0, "Living-dining")  # the double-height part
        g, soft = "Furniture_F1", "Soft_F1"
        # L-shaped sofa facing the TV wall (the corridor wall), chaise by the glass
        sx, sy0, sy1 = x0 + 3.35, y0 + 3.1, y1 - 0.65
        self.box(0, g, "Metal_Dark", sx, sx + 1.0, sy0, sy1, 0, 0.08)
        self.box(0, soft, "Fabric_Sofa", sx, sx + 1.0, sy0, sy1, 0.08, 0.42)
        self.box(0, soft, "Fabric_Sofa", sx + 0.25, sx + 1.0, sy0 + 0.22, sy1 - 0.22, 0.42, 0.55)
        self.box(0, soft, "Fabric_Sofa", sx, sx + 0.25, sy0, sy1, 0.42, 0.86)
        self.box(0, soft, "Fabric_Sofa", sx, sx + 1.0, sy0, sy0 + 0.22, 0.42, 0.64)
        self.box(0, soft, "Fabric_Sofa", sx + 1.0, sx + 1.75, sy1 - 0.95, sy1, 0.08, 0.55)  # chaise
        self.box(0, soft, "Fabric_Sofa", sx, sx + 1.75, sy1 - 0.22, sy1, 0.42, 0.64)
        for y in (sy0 + 0.35, sy0 + 1.0, sy1 - 1.3):
            self.box(0, soft, "Fabric_Accent", sx + 0.22, sx + 0.36, y, y + 0.45, 0.55, 0.95)
        self.box(0, soft, "Rug_Wool", sx + 0.8, x1 - 0.85, sy0 - 0.2, sy1 + 0.2, 0, 0.012)
        # TV wall: low cabinet (Poly Haven) and a 65" screen
        ty = (sy0 + sy1) / 2
        self.asset("modern_wooden_cabinet", x1 - 0.27, ty, self.ffl[0], (-1, 0))
        self.box(0, g, "Black_Glass", x1 - 0.05, x1, ty - 0.72, ty + 0.72, 1.05, 1.87)
        self.asset("modern_coffee_table_01", sx + 1.75 + 0.6, ty, self.ffl[0], (0, 1))
        self.asset("mid_century_lounge_chair", x1 - 1.45, sy0 - 0.35, self.ffl[0], (-1.6, 1.2))
        self.asset("modern_arm_chair_01", x1 - 1.45, sy1 - 0.1, self.ffl[0], (-1.6, -1.0))
        self.asset("potted_plant_01", x0 + 0.4, y1 - 0.4, self.ffl[0], (0, 1))
        self.asset("potted_plant_02", x1 - 0.4, y1 - 0.35, self.ffl[0], (0, 1))

        # dining by the kitchen glass: oak table for six, linear pendant
        dx0, dx1, dy0, dy1 = x0 + 1.1, x0 + 3.3, y0 + 1.25, y0 + 2.25
        self.box(0, g, "Wood_Oak", dx0, dx1, dy0, dy1, 0.72, 0.76)
        for lx in (dx0 + 0.15, dx1 - 0.21):
            self.box(0, g, "Metal_Dark", lx, lx + 0.06, dy0 + 0.1, dy1 - 0.1, 0, 0.72)
        for cx in (dx0 + 0.4, (dx0 + dx1) / 2, dx1 - 0.4):
            self.dining_chair(cx, dy0 - 0.15, -1)
            self.dining_chair(cx, dy1 + 0.15, 1)
        self.asset("potted_plant_04", (dx0 + dx1) / 2, (dy0 + dy1) / 2, self.ffl[0] + 0.76, (0, 1))
        cy, top = (dy0 + dy1) / 2, self.h["hall_ceiling"] - self.ffl[0]
        self.box(0, g, "Metal_Dark", dx0 + 0.2, dx1 - 0.2, cy - 0.03, cy + 0.03, 1.55, 1.60)
        self.box(0, g, "Light_Emissive", dx0 + 0.22, dx1 - 0.22, cy - 0.02, cy + 0.02, 1.548, 1.55)
        for lx in (dx0 + 0.3, dx1 - 0.3):
            self.box(0, g, "Metal_Dark", lx - 0.004, lx + 0.004, cy - 0.004, cy + 0.004, 1.60, top)
            self.light(lx, cy, self.ffl[0] + 1.45, 8)

        # sheer curtains stacked at both ends of the glazed front
        for cx0, cx1 in ((x0, x0 + 1.0), (x1 - 1.0, x1)):
            n = int((cx1 - cx0) / 0.08)
            for i in range(n):
                off = 0.04 if i % 2 else 0
                self.S.box("Curtains", "Curtain_Sheer", cx0 + i * 0.08, cx0 + (i + 1) * 0.08 + 0.01,
                           y1 - 0.18 + off, y1 - 0.16 + off, self.ffl[0] + 0.01, self.h["hall_ceiling"] - 0.05)
        self.S.box("Curtains", "Metal_Dark", x0, x1, y1 - 0.2, y1 - 0.1, self.h["hall_ceiling"] - 0.05, self.h["hall_ceiling"])

    def dining_chair(self, cx, y, sgn):
        """Chair at the table edge y; sgn = side of the table it stands on (-1 back, +1 front)."""
        g, soft = "Furniture_F1", "Soft_F1"
        a, b = sorted((y, y + sgn * 0.48))
        self.box(0, soft, "Fabric_Sofa", cx - 0.22, cx + 0.22, a, b, 0.44, 0.50)
        bk = (b - 0.05, b) if sgn > 0 else (a, a + 0.05)
        self.box(0, soft, "Fabric_Sofa", cx - 0.22, cx + 0.22, *bk, 0.50, 0.88)
        for lx in (cx - 0.2, cx + 0.17):
            for ly in (a + 0.02, b - 0.05):
                self.box(0, "Furniture_F1", "Metal_Dark", lx, lx + 0.03, ly, ly + 0.03, 0, 0.44)

    def kitchen(self):
        x0, x1, y0, y1 = self.room(0, "Kitchen")
        g = "Kitchen"
        # run along the outside wall: sink under the window, hob towards the back
        self.on_wall(0, g, "Metal_Dark", "left", x0, (y0 + y1) / 2, -(y1 - y0) / 2, (y1 - y0) / 2, 0.05, 0.55, 0, 0.1)
        self.on_wall(0, g, "Kitchen_Front", "left", x0, (y0 + y1) / 2, -(y1 - y0) / 2, (y1 - y0) / 2, 0, 0.58, 0.1, 0.87)
        self.on_wall(0, g, "Countertop_Marble", "left", x0, (y0 + y1) / 2, -(y1 - y0) / 2, (y1 - y0) / 2, 0, 0.62, 0.87, 0.90)
        for i in range(1, int((y1 - y0) / 0.6)):
            y = y0 + i * 0.6
            self.box(0, g, "Metal_Dark", x0 + 0.58, x0 + 0.585, y - 0.003, y + 0.003, 0.12, 0.85)
        self.box(0, g, "Metal_Dark", x0 + 0.58, x0 + 0.585, y0, y1, 0.47, 0.475)
        sink = (y0 + 1.15, y0 + 1.95)
        self.box(0, g, "Chrome", x0 + 0.1, x0 + 0.5, *sink, 0.90, 0.902)
        self.box(0, g, "Chrome", x0 + 0.04, x0 + 0.08, sum(sink) / 2 - 0.02, sum(sink) / 2 + 0.02, 0.90, 1.22)
        self.box(0, g, "Chrome", x0 + 0.04, x0 + 0.26, sum(sink) / 2 - 0.02, sum(sink) / 2 + 0.02, 1.18, 1.22)
        self.box(0, g, "Black_Glass", x0 + 0.06, x0 + 0.58, y0 + 0.2, y0 + 0.8, 0.90, 0.905)
        # tall oak column with the fridge, between the boiler-room and pantry doors
        self.box(0, g, "Wood_Oak", x0 + 1.95, x0 + 3.3, y0, y0 + 0.62, 0, 2.3)
        self.box(0, g, "Metal_Dark", x0 + 2.625, x0 + 2.63, y0 + 0.62, y0 + 0.625, 0.05, 2.25)
        # island with a marble top and three stools on the hall side
        ix0, ix1, iy0, iy1 = x0 + 1.75, x0 + 3.95, y0 + 1.6, y0 + 2.4
        self.box(0, g, "Kitchen_Front", ix0, ix1, iy0, iy1, 0.1, 0.87)
        self.box(0, g, "Metal_Dark", ix0 + 0.05, ix1 - 0.05, iy0 + 0.05, iy1 - 0.05, 0, 0.1)
        self.box(0, g, "Countertop_Marble", ix0 - 0.05, ix1 + 0.05, iy0 - 0.05, iy1 + 0.25, 0.87, 0.91)
        for sx in (ix0 + 0.45, (ix0 + ix1) / 2, ix1 - 0.45):
            self.box(0, "Soft_F1", "Fabric_Accent", sx - 0.18, sx + 0.18, iy1 + 0.28, iy1 + 0.64, 0.62, 0.67)
            self.box(0, g, "Metal_Dark", sx - 0.02, sx + 0.02, iy1 + 0.44, iy1 + 0.48, 0, 0.62)
            self.box(0, g, "Metal_Dark", sx - 0.16, sx + 0.16, iy1 + 0.30, iy1 + 0.62, 0, 0.02)
        self.asset("potted_plant_04", ix1 - 0.3, (iy0 + iy1) / 2, self.ffl[0] + 0.91, (0, 1))
        for px in (ix0 + 0.6, ix1 - 0.6):
            self.asset("modern_ceiling_lamp_01", px, (iy0 + iy1) / 2, self.ceil[0] - 1.17, (0, 1))
            self.light(px, (iy0 + iy1) / 2, self.ceil[0] - 1.05, 6)

    def service_rooms(self):
        x0, x1, y0, y1 = self.room(0, "Boiler room")
        self.on_wall(0, "Furniture_F1", "Appliance_White", "left", x0, y0 + 0.85, -0.25, 0.25, 0, 0.35, 0.85, 1.6)
        for z0 in (0, 0.86):  # washer with the dryer on top
            self.box(0, "Furniture_F1", "Appliance_White", x1 - 0.62, x1 - 0.02, y0 + 0.02, y0 + 0.62, z0, z0 + 0.85)
            self.box(0, "Furniture_F1", "Black_Glass", x1 - 0.48, x1 - 0.16, y0 + 0.62, y0 + 0.63, z0 + 0.25, z0 + 0.57)
        x0, x1, y0, y1 = self.room(0, "Pantry")
        for sx in ((x0, x0 + 0.4), (x1 - 0.4, x1)):
            for z in (0.35, 0.75, 1.15, 1.55, 1.95):
                self.box(0, "Furniture_F1", "Wood_Oak", *sx, y0, y1 - 0.1, z, z + 0.025)
        x0, x1, y0, y1 = self.room(1, "Laundry")
        for i in range(2):  # washer and dryer under the high window
            ya = y0 + 0.1 + i * 0.64
            self.box(1, "Furniture_F2", "Appliance_White", x1 - 0.62, x1 - 0.02, ya, ya + 0.6, 0, 0.85)
            self.box(1, "Furniture_F2", "Black_Glass", x1 - 0.63, x1 - 0.62, ya + 0.14, ya + 0.46, 0.25, 0.57)
        self.box(1, "Furniture_F2", "Countertop_Marble", x1 - 0.65, x1, y0, y1, 0.86, 0.89)

    def bedrooms(self):
        # ground-floor bedroom: bed against the corridor wall, clear of its door
        x0, x1, y0, y1 = self.room(0, "Bedroom")
        self.bed(0, "left", x0, y0 + 3.99, 1.6)  # nightstand clear of the door
        self.asset("potted_plant_02", x1 - 0.4, y1 - 0.4, self.ffl[0], (0, 1))
        x0, x1, y0, y1 = self.room(0, "Closet")
        self.wardrobe(0, "back", y0, (x0 + x1) / 2, x1 - x0)
        x0, x1, y0, y1 = self.room(0, "Home office")
        self.desk(0, "back", y0, x0 + 1.85, 1.7)
        self.wardrobe(0, "left", x0, y0 + 1.2, 2.2, depth=0.35, height=2.2)
        self.light(x0 + 1.85, y0 + 0.5, self.ffl[0] + 1.3, 4)

        x0, x1, y0, y1 = self.room(1, "Master bedroom")
        self.bed(1, "front", y1, x0 + 2.45, 1.8)
        self.asset("modern_arm_chair_01", x0 + 0.55, y0 + 0.75, self.ffl[1], (1, 0.4))
        x0, x1, y0, y1 = self.room(1, "Wardrobe")
        self.wardrobe(1, "left", x0, y0 + 0.65, 1.3)
        self.wardrobe(1, "right", x1, (y0 + y1) / 2, y1 - y0)
        x0, x1, y0, y1 = self.room(1, "Bedroom 2")
        self.bed(1, "front", y1, x0 + 3.4, 1.6, 2.0)
        self.desk(1, "back", y0, x0 + 1.35, 1.5)
        x0, x1, y0, y1 = self.room(1, "Bedroom 3")
        self.bed(1, "back", y0, x0 + 2.3, 1.4, 2.0)
        self.desk(1, "front", y1, x0 + 0.85, 1.3)
        x0, x1, y0, y1 = self.room(1, "Gallery")
        self.asset("potted_plant_01", (x0 + x1) / 2, y1 - 0.4, self.ffl[1], (0, 1))

    def bathrooms(self):
        x0, x1, y0, y1 = self.room(0, "Guest bathroom")
        self.wc(0, "back", y0, x0 + 0.95)
        self.vanity(0, "right", x1, y0 + 1.2, 0.6)
        x0, x1, y0, y1 = self.room(0, "Ensuite")
        self.shower(0, x0, x1, y0, y0 + 0.95, ("x", y0 + 0.95, x0, x0 + 1.0))
        self.wc(0, "right", x1, y1 - 0.6)  # clear of the door leaf
        self.vanity(0, "left", x0, y1 - 0.45, 0.7)
        x0, x1, y0, y1 = self.room(1, "Master bathroom")
        self.bathtub(1, x0, x0 + 1.7, y0, y0 + 0.75)
        self.wc(1, "left", x0, y1 - 0.5)
        self.vanity(1, "right", x1, y0 + 1.05, 1.4)
        x0, x1, y0, y1 = self.room(1, "Bathroom")
        self.shower(1, x1 - 1.05, x1, y0, y1, ("y", x1 - 1.05, y0 + 1.0, y1))
        self.vanity(1, "back", y0, x0 + 1.4, 1.2)
        self.wc(1, "front", y1, x0 + 0.6)

    def entrance(self):
        x0, x1, y0, y1 = self.room(0, "Vestibule")
        self.box(0, "Furniture_F1", "Wood_Oak", x0, x0 + 0.4, y0 + 0.2, y1 - 0.15, 0.40, 0.45)
        self.box(0, "Furniture_F1", "Metal_Dark", x0, x0 + 0.4, y0 + 0.2, y1 - 0.15, 0, 0.03)
        self.on_wall(0, "Furniture_F1", "Mirror", "right", x1, y0 + 0.75, -0.3, 0.3, 0, 0.02, 0.5, 2.1)

    # ------------------------------------------------------------------ light

    def ceiling_lights(self):
        """Recessed downlights on a grid, about one per 6 m², and one light source per room."""
        for f, plan in enumerate(self.plans):
            for r in plan["rooms"]:
                if r.get("open") or r["type"] == "stair" and f == 1:
                    continue
                ceiling = self.h["hall_ceiling"] if r.get("doubleHeight") else self.ceil[f]
                x0, x1, y0, y1 = r["x"], r["x"] + r["w"], r["y"], r["y"] + r["h"]
                area = r["w"] * r["h"]
                n = max(1, round(area / 6))
                nx = max(1, round(math.sqrt(n * r["w"] / r["h"])))
                ny = max(1, math.ceil(n / nx))
                for i in range(nx):
                    for j in range(ny):
                        cx, cy = x0 + r["w"] * (i + 0.5) / nx, y0 + r["h"] * (j + 0.5) / ny
                        self.S.box("Lights", "Light_Emissive", cx - 0.05, cx + 0.05, cy - 0.05, cy + 0.05, ceiling - 0.012, ceiling - 0.002)
                self.light((x0 + x1) / 2, (y0 + y1) / 2, ceiling - 0.3, min(60, max(10, area * 1.5)))

    # ------------------------------------------------------------------ plot

    def site(self):
        L, W, plinth = self.h["L"], self.h["W"], self.h["plinth"]
        S = self.S
        # a 512 m² plot (the calculator's plotArea): 22 x 23.3 m, 5 m front garden
        px0, px1, py0, py1 = -4.0, 18.0, -5.3, 18.0
        S.box("Site", "Grass", px0, px1, py0, py1, -0.02, 0)
        t, hgt = 0.2, 1.8
        S.box("Site", "Fence_Plaster", px0, px1, py0, py0 + t, 0, hgt)
        S.box("Site", "Fence_Plaster", px0, px0 + t, py0, py1, 0, hgt)
        S.box("Site", "Fence_Plaster", px1 - t, px1, py0, py1, 0, hgt)
        for b in ((px0, px1, py0 - 0.02, py0 + t + 0.02), (px0 - 0.02, px0 + t + 0.02, py0, py1), (px1 - t - 0.02, px1 + 0.02, py0, py1)):
            S.box("Site", "Metal_Dark", *b, hgt, hgt + 0.03)
        # street front: low wall with horizontal slats over it, a wicket and a drive gate
        gates = [(8.35, 9.75), (11.0, 14.5)]
        cur = px0
        for g0, g1 in gates + [(px1, px1)]:
            if g0 > cur:
                S.box("Site", "Fence_Plaster", cur, g0, py1 - t, py1, 0, 0.9)
                S.box("Site", "Metal_Dark", cur, g0, py1 - t - 0.02, py1 + 0.02, 0.9, 0.93)
                for z in (1.05, 1.25, 1.45, 1.65):
                    S.box("Site", "Wood_Oak", cur, g0, py1 - 0.14, py1 - 0.06, z, z + 0.12)
            cur = g1
        for g0, g1 in gates:
            for x in (g0, g1 - 0.12):  # gate posts
                S.box("Site", "Fence_Plaster", x, x + 0.12, py1 - t, py1, 0, hgt + 0.05)
            n = int((g1 - g0 - 0.24) / 0.1)
            for i in range(n):  # vertical aluminium slats
                x = g0 + 0.12 + (g1 - g0 - 0.24) * (i + 0.5) / n
                S.box("Site", "Metal_Dark", x - 0.02, x + 0.02, py1 - 0.12, py1 - 0.08, 0.05, hgt)
        # stepping-stone path to the steps, drive, terrace in front of the glazing
        y = W + 1.8
        while y + 0.5 < py1 - t:
            S.box("Site", "Paving_Stone", 8.45, 9.65, y, y + 0.5, 0, 0.03)
            y += 0.62
        S.box("Site", "Driveway_Pavers", 11.0, 14.5, W + 0.6, py1 - t, 0, 0.03)
        S.box("Site", "Terrace_Stone", -0.2, 7.85, W, W + 2.6, 0, 0.15)
        self.asset("outdoor_table_chair_set_01", 3.4, W + 1.5, 0.15, (1, 0))
        self.asset("potted_plant_02", 0.3, W + 2.2, 0.15, (0, 1))
        # gravel strip along the walls where there is no paving
        for b in ((-0.6, L + 0.6, -0.6, 0), (-0.6, 0, 0, W), (L, L + 0.6, 0, W + 0.6), (10.45, 11.0, W, W + 0.6)):
            S.box("Site", "Gravel", *b, 0, 0.03)
        # entrance: planters, wall lights either side of the door, canopy downlights
        self.asset("potted_plant_01", 8.05, W + 0.35, plinth - 0.15, (0, 1))
        for x in (8.2, 9.9):
            S.box("Facade", "Metal_Dark", x - 0.05, x + 0.05, W + 0.04, W + 0.16, plinth + 1.85, plinth + 2.2)
            S.box("Facade", "Light_Emissive", x - 0.04, x + 0.04, W + 0.05, W + 0.15, plinth + 1.84, plinth + 1.85)
            self.light(x, W + 0.3, plinth + 1.8, 5)
        for x in (1.5, 4.0, 6.5):
            S.box("Facade", "Light_Emissive", x - 0.05, x + 0.05, W + 0.4, W + 0.5, self.ceil[0] - 0.06, self.ceil[0] - 0.05)
            self.light(x, W + 0.45, self.ceil[0] - 0.2, 6)
        # rainwater downpipes at the back corners
        for x in (0.1, L - 0.2):
            S.box("Facade", "Metal_Dark", x, x + 0.1, -0.12, -0.02, 0, self.h["roof_top"] + 0.05)


def furnish(scene, plans, ffl, ceil, house):
    """Furnish the house and lay out the plot. Returns (assets, lights)."""
    f = Furnisher(scene, plans, ffl, ceil, house)
    f.living()
    f.kitchen()
    f.service_rooms()
    f.bedrooms()
    f.bathrooms()
    f.entrance()
    f.ceiling_lights()
    f.site()
    return f.assets, f.lights
