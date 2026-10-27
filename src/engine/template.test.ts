// The default house takes the plan of a real project (Z500 Zx85, fitted to
// 13 × 14 m without its garage). Checked by hand on the 12.4 × 13.4 m inside.
import { describe, it, expect } from 'vitest'
import { DEFAULT_HOUSE } from '../model/house'
import { buildFloorPlan, planTakeoff, roomClear } from './floorplan'
import { computeQuantities } from './quantities'
import { computeEstimate } from './pricing'
import { auditPlan } from './planAudit'
import { checkNorms } from './norms'
import { SEED_PRICES } from '../data/prices'

const p = DEFAULT_HOUSE
const plans = [buildFloorPlan(p, 0), buildFloorPlan(p, 1)]
const area = (r: { w: number; h: number }) => r.w * r.h

describe('шаблон планировки по реальному проекту', () => {
  it('комнаты каждого этажа заполняют дом внутри стен без щелей', () => {
    for (const pl of plans) expect(pl.rooms.reduce((a, r) => a + area(r), 0)).toBeCloseTo(12.4 * 13.4, 6)
  })

  it('второй свет 7.2 × 7.2 м: над гостиной-столовой и в перекрытии', () => {
    const hall = plans[0].rooms.find((r) => r.doubleHeight)!
    const voidRoom = plans[1].rooms.find((r) => r.open)!
    expect(area(hall)).toBeCloseTo(51.84, 6)
    expect([voidRoom.x, voidRoom.y, voidRoom.w, voidRoom.h]).toEqual([hall.x, hall.y, hall.w, hall.h])
    const g = computeQuantities(p).geometry
    expect(g.hallVoid).toBeCloseTo(51.84, 6)
    // общая площадь 2 × 166.16 − 51.84 = 280.48 м² — в пределах 300 м² порядка N 4.1
    expect(g.netFloorArea).toBeCloseTo(280.48, 6)
    expect(g.netFloorArea).toBeLessThanOrEqual(300)
    // 18.5% площади дома — в практике 12–20%
    expect(g.hallVoid / g.netFloorArea).toBeLessThan(0.2)
  })

  it('обе стороны зала больше его высоты 6 м', () => {
    const hall = plans[0].rooms.find((r) => r.doubleHeight)!
    expect(Math.min(hall.w, hall.h)).toBeGreaterThan(p.floorHeight * 2)
  })

  it('жилые комнаты не меньше 8 м², лестница берёт прямой марш 3.8 м', () => {
    for (const pl of plans) {
      for (const r of pl.rooms) {
        if (r.type === 'bedroom' || r.type === 'office' || r.type === 'living') expect(roomClear(r, pl).area, r.label).toBeGreaterThanOrEqual(8)
      }
      const stair = pl.rooms.find((r) => r.type === 'stair')!
      expect(Math.max(roomClear(stair, pl).w, roomClear(stair, pl).h)).toBeGreaterThanOrEqual(3.8)
    }
  })

  it('аудит и нормы не находят ошибок и предупреждений', () => {
    expect(auditPlan(p).filter((i) => i.level !== 'info')).toEqual([])
    expect(checkNorms(p, computeQuantities(p)).filter((w) => w.level !== 'info')).toEqual([])
  })

  it('двери по проекту: входная в тамбур, 11 полотен внизу и 7 наверху', () => {
    const t = plans.map(planTakeoff)
    expect(plans[0].doors.filter((d) => d.kind === 'entrance')).toHaveLength(1)
    expect(t[0].leafDoors).toBe(11)
    expect(t[1].leafDoors).toBe(7)
    // three bathrooms and an ensuite: guest, ground-floor bedroom, master, shared
    expect(t[0].baths + t[1].baths).toBe(4)
    // the gallery and the landing are railed along the void: 7.2 + 2.6 m on the
    // template, scaled to the house (its 14 m side is the front here)
    const pl = plans[1]
    const sx = (pl.L - 2 * pl.wall) / 12.4
    const sy = (pl.W - 2 * pl.wall) / 13.4
    expect(t[1].railing).toBeCloseTo(2.6 * sx + 7.2 * sy, 6)
  })

  it('итог дома по умолчанию закреплён', () => {
    const e = computeEstimate(computeQuantities(p), SEED_PRICES, p, 'typical')
    // 280.48 m² of house on the template plan, prices of 26.10.2026
    expect(Math.round(e.turnkey.total)).toBe(70958351)
  })
})

describe('шаблон: границы применения и связка со сметой', () => {
  it('смета вычитает нарисованный проём, а не сохранённое поле', () => {
    for (const hallArea of [0, 30, 80]) {
      const g = computeQuantities({ ...p, hallArea }).geometry
      expect(g.hallVoid, String(hallArea)).toBeCloseTo(51.84, 6)
    }
  })

  it('маленький или большой дом получает генератор, а не растянутый шаблон', () => {
    expect(buildFloorPlan({ ...p, length: 8, width: 8 }, 0).rooms.some((r) => r.label === 'Тамбур')).toBe(false)
    expect(buildFloorPlan({ ...p, length: 20, width: 18 }, 0).rooms.some((r) => r.label === 'Тамбур')).toBe(false)
    expect(buildFloorPlan({ ...p, length: 14, width: 15 }, 0).rooms.some((r) => r.label === 'Тамбур')).toBe(true)
  })

  it('кладовая — хранение: без воды, радиатора и розеток; стена тамбура считается', () => {
    const t = planTakeoff(plans[0])
    // 3 fixtures in the guest and the bedroom bathrooms each, the kitchen 2, the boiler room 1
    expect(t.waterPoints).toBe(3 + 3 + 2 + 1)
    const pantry = plans[0].rooms.find((r) => r.label === 'Кладовая')!
    expect(pantry.type).toBe('wardrobe')
    // the vestibule door has a leaf, so the wall it hangs in is built
    const porch = plans[0].rooms.find((r) => r.label === 'Тамбур')!
    const withWall = planTakeoff({ ...plans[0], doors: plans[0].doors.filter((d) => d.kind !== 'interior' || Math.abs(d.pos - (porch.y)) > 1e-6) })
    expect(t.partitions - withWall.partitions).toBeCloseTo(porch.w, 6)
  })

  it('под камнем остаётся армирующий слой и клей', () => {
    const q = computeQuantities({ ...p, stoneFacadePct: 100 })
    const line = (k: string) => q.lines.filter((l) => l.key === k).reduce((a, l) => a + l.quantity, 0)
    expect(line('facade')).toBe(0)
    expect(line('stone_base')).toBeCloseTo(line('facade_travertine'), 6)
  })

  it('наливной пол заменяет ламинат только в сухих комнатах, плитка остаётся', () => {
    const line = (q: ReturnType<typeof computeQuantities>, k: string) =>
      q.lines.filter((l) => l.key === k).reduce((a, l) => a + l.quantity, 0)
    const base = computeQuantities(p)
    const floor = line(base, 'floor_finish')
    for (const [floorType, key] of [['polyurethane', 'floor_pu'], ['metallic', 'floor_metallic']] as const) {
      const q = computeQuantities({ ...p, floorType })
      expect(line(q, 'floor_finish')).toBe(0)
      expect(line(q, 'floor_tile')).toBeCloseTo(floor * 0.2, 6)
      expect(line(q, key)).toBeCloseTo(floor * 0.8, 6)
      // poured by the owner: the estimate carries materials only
      const e = computeEstimate(q, SEED_PRICES, { ...p, floorType })
      expect(e.lines.find((l) => l.key === key)!.labor).toBe(0)
    }
  })
})
