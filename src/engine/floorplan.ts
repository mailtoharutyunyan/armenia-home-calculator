import type { HouseParams } from '../model/house'

export type RoomType = 'living' | 'living_kitchen' | 'kitchen' | 'bedroom' | 'bath'

export interface Room {
  x: number
  y: number
  w: number
  h: number
  type: RoomType
  label: string
}

export interface FloorPlan {
  L: number
  W: number
  wall: number
  rooms: Room[]
  windows: { x: number; y: number; len: number; side: 'top' | 'bottom' | 'left' | 'right' }[]
}

interface Spec {
  type: RoomType
  weight: number
  label: string
}

// Build a deterministic furnished layout from the house params (one floor).
export function buildFloorPlan(p: HouseParams, floorIndex = 0): FloorPlan {
  const L = Math.max(1, p.length)
  const W = Math.max(1, p.width)
  const wall = 0.2
  const inset = wall
  const inner = { x: inset, y: inset, w: L - 2 * inset, h: W - 2 * inset }

  // compose the room program
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

  const rooms: Room[] = []
  slice(inner, specs, rooms)

  // windows on exterior walls, roughly centered per exterior-facing room edge
  const windows: FloorPlan['windows'] = []
  for (const r of rooms) {
    if (Math.abs(r.y - inset) < 1e-6) windows.push({ x: r.x + r.w / 2 - 0.6, y: 0, len: 1.2, side: 'top' })
    if (Math.abs(r.y + r.h - (W - inset)) < 1e-6) windows.push({ x: r.x + r.w / 2 - 0.6, y: W, len: 1.2, side: 'bottom' })
    if (Math.abs(r.x - inset) < 1e-6) windows.push({ x: 0, y: r.y + r.h / 2 - 0.6, len: 1.2, side: 'left' })
    if (Math.abs(r.x + r.w - (L - inset)) < 1e-6) windows.push({ x: L, y: r.y + r.h / 2 - 0.6, len: 1.2, side: 'right' })
  }

  return { L, W, wall, rooms, windows }
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
