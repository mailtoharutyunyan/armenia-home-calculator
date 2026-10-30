// Dumps the calculator's default house (the brick house drawn off its plans,
// 193.5 m²) to brick/plan.json for build_brick.py: both floors with their
// outline, roofs, terraces, windows, doors and rooms.
import { writeFileSync } from 'node:fs'
import { DEFAULT_HOUSE } from '../../../src/model/house'
import { buildFloorPlan } from '../../../src/engine/floorplan'
const p = DEFAULT_HOUSE
const floors = [0, 1].map((i) => buildFloorPlan(p, i, undefined, { lang: 'en' }))
const params = {
  floorHeight: p.floorHeight, wall: p.wallThickness, L: floors[0].L, W: floors[0].W, footprint: p.footprint,
}
writeFileSync(`${process.env.HOME3D ?? `${process.env.HOME}/Desktop/home-3d`}/brick/plan.json`, JSON.stringify({ params, floors }, null, 1))
console.log(floors.map((f) => `${f.L}x${f.W} rooms=${f.rooms.map((r) => r.label).join(',')} win=${f.windows.length} doors=${f.doors.length} outline=${f.outline?.length} roofs=${f.roofs?.rects.length ?? 0} terraces=${JSON.stringify((f as { terraces?: unknown }).terraces ?? null)}`).join('\n'))
