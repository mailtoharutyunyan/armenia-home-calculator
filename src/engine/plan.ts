import type { HouseParams } from '../model/house'

export interface Opening {
  x: number
  y: number
  w: number
  type: 'window' | 'door'
  wall: 'top' | 'bottom' | 'left' | 'right'
}

export interface Plan {
  length: number
  width: number
  wallThickness: number
  openings: Opening[]
}

// Build a parametric plan for one floor from the house params.
export function buildPlan(p: HouseParams): Plan {
  const t = p.wallThickness
  const openings: Opening[] = []

  const windowCount = Math.max(1, Math.round(p.windowAreaTotal / 2.25))
  const winW = 1.5
  // windows split between top and bottom walls
  const topN = Math.ceil(windowCount / 2)
  const botN = windowCount - topN
  const place = (n: number, wall: 'top' | 'bottom', spanStart: number, spanLen: number, y: number) => {
    for (let i = 0; i < n; i++) {
      const step = spanLen / (n + 1)
      const cx = spanStart + step * (i + 1)
      openings.push({ x: cx - winW / 2, y, w: winW, type: 'window', wall })
    }
  }
  place(topN, 'top', 0, p.length, p.width - t)
  place(botN, 'bottom', 0, p.length, 0)

  // exterior door(s) on the bottom wall
  const doorW = 1.0
  for (let i = 0; i < p.exteriorDoors; i++) {
    const cx = (p.length / (p.exteriorDoors + 1)) * (i + 1)
    openings.push({ x: cx - doorW / 2, y: 0, w: doorW, type: 'door', wall: 'bottom' })
  }

  return { length: p.length, width: p.width, wallThickness: t, openings }
}
