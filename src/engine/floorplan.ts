import type { HouseParams } from '../model/house'

export type RoomType = 'living' | 'living_kitchen' | 'kitchen' | 'bedroom' | 'bath' | 'stair' | 'wardrobe'

export interface Room {
  x: number
  y: number
  w: number
  h: number
  type: RoomType
  label: string
  open?: boolean // open to below (двусветный зал) — no floor on this level
  gallery?: boolean // balcony walkway overlooking the hall (open railing on the void side)
}

export interface Door {
  orient: 'v' | 'h' // v: wall is vertical (x=pos); h: wall is horizontal (y=pos)
  pos: number // wall coordinate
  start: number // opening start along the wall
  w: number // opening width
  swing: 1 | -1 // direction the leaf opens
  kind: 'entrance' | 'interior'
}

export interface FloorPlan {
  L: number
  W: number
  wall: number
  rooms: Room[]
  windows: { x: number; y: number; len: number; side: 'top' | 'bottom' | 'left' | 'right' }[]
  doors: Door[]
}

export interface Spec {
  type: RoomType
  weight: number
  label: string
}

// The default room program derived from house params (also seeds the editor).
export function autoProgram(p: HouseParams, floorIndex = 0): Spec[] {
  const specs: Spec[] = []
  const isGround = floorIndex === 0
  const bedrooms = Math.max(1, p.roomsPerFloor - 1)
  if (isGround) {
    if (p.kitchenLivingCombined) {
      specs.push({ type: 'living_kitchen', weight: 2.2, label: 'Гостиная-кухня' })
    } else {
      specs.push({ type: 'living', weight: 1.7, label: 'Гостиная' })
      specs.push({ type: 'kitchen', weight: 1.1, label: 'Кухня' })
    }
    if (p.floors >= 2) specs.push({ type: 'stair', weight: 0.5, label: 'Лестница' })
    specs.push({ type: 'bath', weight: 0.7, label: 'Санузел' })
    for (let i = 0; i < Math.max(1, bedrooms - 1); i++) specs.push({ type: 'bedroom', weight: 1.2, label: `Комната ${i + 1}` })
  } else {
    for (let i = 0; i < p.roomsPerFloor; i++) specs.push({ type: 'bedroom', weight: 1.2, label: `Спальня ${i + 1}` })
    specs.push({ type: 'stair', weight: 0.5, label: 'Лестница' })
    specs.push({ type: 'bath', weight: 0.7, label: 'Санузел' })
  }
  return specs
}

// Build a furnished layout. If `custom` specs are provided (editor), use them.
export interface PlanLabels {
  voidLabel?: string
  corridorLabel?: string
  wardrobeLabel?: string
  ensuiteLabel?: string
}

export function buildFloorPlan(p: HouseParams, floorIndex = 0, custom?: Spec[], labels: PlanLabels = {}): FloorPlan {
  const voidLabel = labels.voidLabel ?? 'Второй свет'
  const corridorLabel = labels.corridorLabel ?? 'Коридор'
  const suite = { wardrobe: labels.wardrobeLabel ?? 'Гардеробная', ensuite: labels.ensuiteLabel ?? 'Мастер-санузел' }
  const L = Math.max(1, p.length)
  const W = Math.max(1, p.width)
  const wall = 0.2
  const inset = wall
  const inner = { x: inset, y: inset, w: L - 2 * inset, h: W - 2 * inset }

  const specs: Spec[] = custom && custom.length > 0 ? custom : autoProgram(p, floorIndex)

  // The double-height hall opens between the ground floor and the floor directly
  // above it (index 1) only — carve that one void; higher floors are normal.
  // This matches the engine, which subtracts the hall void from the slab exactly once.
  let sliceRect = inner
  let openVoid: Room | null = null
  let corridor: Room | null = null
  if (floorIndex === 1 && p.doubleHeightHall && p.hallArea > 0) {
    const frac = Math.min(0.6, Math.max(0.12, p.hallArea / (inner.w * inner.h)))
    if (inner.w >= inner.h) {
      const vw = inner.w * frac
      openVoid = { x: inner.x, y: inner.y, w: vw, h: inner.h, type: 'living_kitchen', label: voidLabel, open: true }
      sliceRect = { x: inner.x + vw, y: inner.y, w: inner.w - vw, h: inner.h }
      // corridor along the void edge — walkway from the stair into the rooms
      const cw = Math.min(1.4, sliceRect.w * 0.25)
      corridor = { x: sliceRect.x, y: sliceRect.y, w: cw, h: sliceRect.h, type: 'living', label: corridorLabel, gallery: true }
      sliceRect = { x: sliceRect.x + cw, y: sliceRect.y, w: sliceRect.w - cw, h: sliceRect.h }
    } else {
      const vh = inner.h * frac
      openVoid = { x: inner.x, y: inner.y + inner.h - vh, w: inner.w, h: vh, type: 'living_kitchen', label: voidLabel, open: true }
      sliceRect = { x: inner.x, y: inner.y, w: inner.w, h: inner.h - vh }
      const ch = Math.min(1.4, sliceRect.h * 0.25)
      corridor = { x: sliceRect.x, y: sliceRect.y + sliceRect.h - ch, w: sliceRect.w, h: ch, type: 'living', label: corridorLabel, gallery: true }
      sliceRect = { x: sliceRect.x, y: sliceRect.y, w: sliceRect.w, h: sliceRect.h - ch }
    }
  }

  const rooms: Room[] = []
  layoutFloor(sliceRect, specs, rooms, suite)
  if (corridor) rooms.push(corridor)

  // windows on exterior walls, roughly centered per exterior-facing room edge
  const windows: FloorPlan['windows'] = []
  for (const r of openVoid ? [...rooms, openVoid] : rooms) {
    if (Math.abs(r.y - inset) < 1e-6) windows.push({ x: r.x + r.w / 2 - 0.6, y: 0, len: 1.2, side: 'top' })
    if (Math.abs(r.y + r.h - (W - inset)) < 1e-6) windows.push({ x: r.x + r.w / 2 - 0.6, y: W, len: 1.2, side: 'bottom' })
    if (Math.abs(r.x - inset) < 1e-6) windows.push({ x: 0, y: r.y + r.h / 2 - 0.6, len: 1.2, side: 'left' })
    if (Math.abs(r.x + r.w - (L - inset)) < 1e-6) windows.push({ x: L, y: r.y + r.h / 2 - 0.6, len: 1.2, side: 'right' })
  }

  // doors connect the real rooms only; the void has no door (it is open) and the
  // exterior entrance belongs to the ground floor.
  const doors = buildDoors(rooms, inset, L, W, floorIndex === 0)

  if (openVoid) rooms.push(openVoid)

  return { L, W, wall, rooms, windows, doors }
}

const DOOR_W = 0.9

// Connect rooms with a spanning tree of interior doors + one entrance door.
function buildDoors(rooms: Room[], inset: number, L: number, W: number, withEntrance = true): Door[] {
  const doors: Door[] = []
  if (rooms.length === 0) return doors
  const eps = 0.02
  const connected = new Set<number>([0])

  const sharedWall = (a: Room, b: Room): Door | null => {
    // vertical shared wall
    if (Math.abs(a.x + a.w - b.x) < eps || Math.abs(b.x + b.w - a.x) < eps) {
      const pos = Math.abs(a.x + a.w - b.x) < eps ? a.x + a.w : a.x
      const y0 = Math.max(a.y, b.y)
      const y1 = Math.min(a.y + a.h, b.y + b.h)
      if (y1 - y0 >= DOOR_W + 0.3) {
        return { orient: 'v', pos, start: (y0 + y1) / 2 - DOOR_W / 2, w: DOOR_W, swing: 1, kind: 'interior' }
      }
    }
    // horizontal shared wall
    if (Math.abs(a.y + a.h - b.y) < eps || Math.abs(b.y + b.h - a.y) < eps) {
      const pos = Math.abs(a.y + a.h - b.y) < eps ? a.y + a.h : a.y
      const x0 = Math.max(a.x, b.x)
      const x1 = Math.min(a.x + a.w, b.x + b.w)
      if (x1 - x0 >= DOOR_W + 0.3) {
        return { orient: 'h', pos, start: (x0 + x1) / 2 - DOOR_W / 2, w: DOOR_W, swing: 1, kind: 'interior' }
      }
    }
    return null
  }

  // grow spanning tree
  let guard = 0
  while (connected.size < rooms.length && guard++ < rooms.length * rooms.length) {
    let added = false
    for (let i = 0; i < rooms.length; i++) {
      if (!connected.has(i)) continue
      for (let j = 0; j < rooms.length; j++) {
        if (connected.has(j)) continue
        const d = sharedWall(rooms[i], rooms[j])
        if (d) {
          doors.push(d)
          connected.add(j)
          added = true
        }
      }
    }
    if (!added) break
  }

  // entrance door on the exterior wall of the first room (living) — ground floor only
  if (!withEntrance) return doors
  const r0 = rooms[0]
  if (Math.abs(r0.y + r0.h - (W - inset)) < eps || r0.y + r0.h >= W - inset - 0.5) {
    doors.push({ orient: 'h', pos: W, start: r0.x + r0.w / 2 - 0.5, w: 1.0, swing: -1, kind: 'entrance' })
  } else if (r0.x <= inset + 0.5) {
    doors.push({ orient: 'v', pos: 0, start: r0.y + r0.h / 2 - 0.5, w: 1.0, swing: 1, kind: 'entrance' })
  } else {
    doors.push({ orient: 'h', pos: W, start: L / 2 - 0.5, w: 1.0, swing: -1, kind: 'entrance' })
  }

  return doors
}

type Rect = { x: number; y: number; w: number; h: number }

// Realistic layout: bath/stair go into a compact service band (real size ~5–7 m²),
// the living/kitchen keeps the large area, bedrooms are proper rooms.
// Falls back to the weighted slicer when the program has no service rooms.
function layoutFloor(rect: Rect, specs: Spec[], out: Room[], suite: { wardrobe: string; ensuite: string } = { wardrobe: 'Гардеробная', ensuite: 'Мастер-санузел' }) {
  const isSmall = (t: RoomType) => t === 'bath' || t === 'stair'
  const smalls = specs.filter((s) => isSmall(s.type))
  const bigs = specs.filter((s) => !isSmall(s.type))
  if (smalls.length === 0 || bigs.length === 0) {
    slice(rect, specs, out)
    return
  }

  const living = bigs.find((s) => s.type === 'living' || s.type === 'living_kitchen' || s.type === 'kitchen') ?? null
  const beds = bigs.filter((s) => s !== living)

  // right service column width; service rooms sit side-by-side in a top band.
  // capped at 42% of the rect so the living column stays positive even on a
  // narrow layout (tiny house, or upper floor after a large hall void is carved).
  const Wc = Math.min(rect.w * 0.42, Math.max(2.6, rect.w * 0.34))
  const leftW = rect.w - Wc
  const rx = rect.x + leftW
  const hBand = Math.min(2.9, rect.h * 0.3)
  const sw = Wc / smalls.length
  smalls.forEach((s, i) => out.push({ x: rx + i * sw, y: rect.y, w: sw, h: hBand, type: s.type, label: s.label }))
  const belowY = rect.y + hBand
  const restH = rect.h - hBand

  if (living) {
    // living/kitchen fills the whole left column (the big open studio)
    out.push({ x: rect.x, y: rect.y, w: leftW, h: rect.h, type: living.type, label: living.label })
    if (beds.length === 0) {
      // no bedrooms — extend the studio into the right column (no second label)
      if (restH > 0.6) out.push({ x: rx, y: belowY, w: Wc, h: restH, type: living.type, label: '' })
    } else if (beds.length === 1) {
      // master suite: wardrobe + ensuite carved at the top (entered from the bedroom),
      // bedroom below fills the rest of the column
      const ht = Math.min(2.7, restH * 0.32)
      const half = Wc / 2
      out.push({ x: rx, y: belowY, w: half, h: ht, type: 'wardrobe', label: suite.wardrobe })
      out.push({ x: rx + half, y: belowY, w: half, h: ht, type: 'bath', label: suite.ensuite })
      out.push({ x: rx, y: belowY + ht, w: Wc, h: restH - ht, type: beds[0].type, label: beds[0].label })
    } else {
      // bedrooms stack below the service band and fill the right column (no gaps → no duplicate room)
      const bh = restH / beds.length
      beds.forEach((b, i) => out.push({ x: rx, y: belowY + i * bh, w: Wc, h: bh, type: b.type, label: b.label }))
    }
  } else {
    // no living (upper floor): one bedroom under the service band, the rest on the left
    const rightBed = beds[0]
    out.push({ x: rx, y: belowY, w: Wc, h: restH, type: rightBed.type, label: rightBed.label })
    const leftBeds = beds.slice(1)
    const leftRect: Rect = { x: rect.x, y: rect.y, w: leftW, h: rect.h }
    if (leftBeds.length) slice(leftRect, leftBeds, out)
    else out.push({ ...leftRect, type: rightBed.type, label: rightBed.label })
  }
}

// Recursive binary split of a rectangle by room weights (split along longer side).
function slice(rect: { x: number; y: number; w: number; h: number }, specs: Spec[], out: Room[]) {
  if (specs.length === 1) {
    const s = specs[0]
    out.push({ ...rect, type: s.type, label: s.label })
    return
  }
  const total = specs.reduce((a, s) => a + s.weight, 0)
  // split specs into two groups near half the weight
  let acc = 0
  let idx = 0
  for (let i = 0; i < specs.length; i++) {
    acc += specs[i].weight
    if (acc >= total / 2) {
      idx = i + 1
      break
    }
  }
  idx = Math.min(Math.max(1, idx), specs.length - 1)
  const a = specs.slice(0, idx)
  const b = specs.slice(idx)
  const aw = a.reduce((x, s) => x + s.weight, 0) / total

  if (rect.w >= rect.h) {
    const w1 = rect.w * aw
    slice({ ...rect, w: w1 }, a, out)
    slice({ x: rect.x + w1, y: rect.y, w: rect.w - w1, h: rect.h }, b, out)
  } else {
    const h1 = rect.h * aw
    slice({ ...rect, h: h1 }, a, out)
    slice({ x: rect.x, y: rect.y + h1, w: rect.w, h: rect.h - h1 }, b, out)
  }
}
