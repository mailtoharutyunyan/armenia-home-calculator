import type { HouseParams } from '../model/house'
import { buildFloorPlan } from './floorplan'

export interface Opening {
  // start of the opening along its wall: x for top/bottom walls, y for left/right
  x: number
  y: number
  w: number // opening length along the wall
  type: 'window' | 'door'
  wall: 'top' | 'bottom' | 'left' | 'right'
}

export interface Plan {
  length: number
  width: number
  wallThickness: number
  openings: Opening[]
}

// Parametric ground-floor plan for the DXF export. It follows the on-screen
// plan: same orientation (main facade at the bottom), same wall, same windows
// and entrance, which the plan audit keeps apart. A separate layout used to put
// 18 windows of 1.5 m on two 13 m walls, overlapping each other and the door.
export function buildPlan(p: HouseParams): Plan {
  const fp = buildFloorPlan(p, 0)
  // the screen plan's y grows downwards, CAD's y grows upwards
  const flip = (y: number) => fp.W - y
  const openings: Opening[] = fp.windows.map((wn) =>
    wn.side === 'top' || wn.side === 'bottom'
      ? { x: wn.x, y: flip(wn.y), w: wn.len, type: 'window', wall: wn.side }
      : { x: wn.x, y: flip(wn.y + wn.len), w: wn.len, type: 'window', wall: wn.side },
  )
  for (const d of fp.doors) {
    if (d.kind !== 'entrance') continue
    if (d.orient === 'h') {
      openings.push({ x: d.start, y: flip(d.pos), w: d.w, type: 'door', wall: d.pos > 0 ? 'bottom' : 'top' })
    } else {
      openings.push({ x: d.pos, y: flip(d.start + d.w), w: d.w, type: 'door', wall: d.pos > 0 ? 'right' : 'left' })
    }
  }
  return { length: fp.L, width: fp.W, wallThickness: fp.wall, openings }
}
