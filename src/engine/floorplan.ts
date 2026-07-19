import type { HouseParams } from '../model/house'

export type RoomType = 'living' | 'living_kitchen' | 'kitchen' | 'bedroom' | 'bath'

export interface Room {
  x: number
  y: number
  w: number
  h: number
  type: RoomType
  label: string
  open?: boolean // open to below (двусветный зал) — no floor on this level
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
    specs.push({ type: 'bath', weight: 0.7, label: 'Санузел' })
    for (let i = 0; i < Math.max(1, bedrooms - 1); i++) specs.push({ type: 'bedroom', weight: 1.2, label: `Комната ${i + 1}` })
  } else {
    for (let i = 0; i < p.roomsPerFloor; i++) specs.push({ type: 'bedroom', weight: 1.2, label: `Спальня ${i + 1}` })
    specs.push({ type: 'bath', weight: 0.7, label: 'Санузел' })
  }
  return specs
}

// Build a furnished layout. If `custom` specs are provided (editor), use them.
export function buildFloorPlan(p: HouseParams, floorIndex = 0, custom?: Spec[], voidLabel = 'Второй свет'): FloorPlan {
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
  if (floorIndex === 1 && p.doubleHeightHall && p.hallArea > 0) {
    const frac = Math.min(0.6, Math.max(0.12, p.hallArea / (inner.w * inner.h)))
    if (inner.w >= inner.h) {
      const vw = inner.w * frac
      openVoid = { x: inner.x, y: inner.y, w: vw, h: inner.h, type: 'living_kitchen', label: voidLabel, open: true }
      sliceRect = { x: inner.x + vw, y: inner.y, w: inner.w - vw, h: inner.h }
    } else {
      const vh = inner.h * frac
      openVoid = { x: inner.x, y: inner.y + inner.h - vh, w: inner.w, h: vh, type: 'living_kitchen', label: voidLabel, open: true }
      sliceRect = { x: inner.x, y: inner.y, w: inner.w, h: inner.h - vh }
    }
  }

  const rooms: Room[] = []
  slice(sliceRect, specs, rooms)

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
