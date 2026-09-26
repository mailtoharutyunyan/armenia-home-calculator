// Планировка тоже под тестами — раньше их не было вовсе, и дефекты
// (вход в гостиную, туалет через спальню, пеналы, несовпадение лестниц)
// находились только глазами по скриншотам.

import { describe, it, expect } from 'vitest'
import { DEFAULT_HOUSE } from '../model/house'
import type { HouseParams } from '../model/house'
import { auditPlan } from './planAudit'
import { buildFloorPlan, roomClear } from './floorplan'

const h = (patch: Partial<HouseParams> = {}): HouseParams => ({ ...DEFAULT_HOUSE, ...patch })
const errors = (p: HouseParams) => auditPlan(p).filter((i) => i.level === 'error')

describe('планировка дома по умолчанию', () => {
  it('не содержит планировочных ошибок', () => {
    expect(errors(h()).map((e) => `эт.${e.floor + 1}: ${e.ru}`)).toEqual([])
  })

  it('вход ведёт в прихожую, а не в жилую комнату', () => {
    const rooms = buildFloorPlan(h(), 0).rooms
    expect(rooms.some((r) => r.type === 'hall')).toBe(true)
    expect(errors(h()).some((e) => e.rule === 'entrance-into-room')).toBe(false)
  })

  it('в гостевой санузел не надо идти через спальню или зал', () => {
    expect(errors(h()).some((e) => e.rule === 'walk-through')).toBe(false)
  })

  it('лестницы этажей стоят строго друг над другом', () => {
    const a = buildFloorPlan(h(), 0).rooms.find((r) => r.type === 'stair')!
    const b = buildFloorPlan(h(), 1).rooms.find((r) => r.type === 'stair')!
    expect(Math.abs(a.x - b.x)).toBeLessThan(0.25)
    expect(Math.abs(a.y - b.y)).toBeLessThan(0.25)
  })

  it('проём второго этажа совпадает с двусветным залом первого', () => {
    const hall = buildFloorPlan(h(), 0).rooms.find((r) => r.doubleHeight)!
    const hole = buildFloorPlan(h(), 1).rooms.find((r) => r.open)!
    expect(hall.w).toBeCloseTo(hole.w, 2)
    expect(hall.h).toBeCloseTo(hole.h, 2)
    expect(hall.x).toBeCloseTo(hole.x, 2)
    expect(hall.y).toBeCloseTo(hole.y, 2)
    // the hall area is the clear room area, the same 80 m² the estimate takes out of the slab
    expect(roomClear(hall, buildFloorPlan(h(), 0)).area).toBeCloseTo(DEFAULT_HOUSE.hallArea, 6)
  })

  it('на втором этаже есть коридор — комнаты не проходные', () => {
    expect(buildFloorPlan(h(), 1).rooms.some((r) => r.type === 'corridor')).toBe(true)
  })

  it('каждая жилая комната имеет окно', () => {
    expect(errors(h()).some((e) => e.rule === 'no-window')).toBe(false)
  })
})

describe('аудит ловит дефекты, а не молчит', () => {
  it('замечает проходные комнаты и заниженные площади при перегрузке этажа', () => {
    // 6 комнат на этаж в этом габарите физически не помещаются
    const bad = errors(h({ roomsPerFloor: 6 }))
    expect(bad.length).toBeGreaterThan(0)
    expect(bad.some((e) => e.rule === 'min-area' || e.rule === 'walk-through')).toBe(true)
  })

  it('замечает несовпадение лестниц на трёх этажах', () => {
    expect(errors(h({ floors: 3 })).some((e) => e.rule === 'stair-misaligned')).toBe(true)
  })
})

describe('числовые нормативы помещений', () => {
  it('ловит санузел уже нормативной ширины', () => {
    // узкий дом зажимает служебную колонку
    const bad = auditPlan(h({ length: 7, width: 8, hallArea: 20 }))
    expect(bad.some((i) => i.rule === 'bath-too-small' || i.rule === 'bath-narrow')).toBe(true)
  })

  it('ловит лестницу, в которую не помещается марш', () => {
    // при высоте этажа 4.5 м нужно 24 ступени — прямой марш почти 6 м
    const issues = auditPlan(h({ floorHeight: 4.5 }))
    expect(issues.some((i) => i.rule === 'stair-no-fit' || i.rule === 'stair-two-flight')).toBe(true)
  })

  it('при обычной высоте этажа лестница проходит проверку габарита', () => {
    expect(auditPlan(h()).some((i) => i.rule === 'stair-no-fit')).toBe(false)
  })

})

describe('расстановка мебели', () => {
  it('в мастер-спальне помещается двуспальная кровать с проходами', () => {
    expect(auditPlan(h()).some((i) => i.rule === 'no-bed-fit')).toBe(false)
  })

  it('ловит спальню, куда кровать не встаёт', () => {
    // узкая комната: площадь формально есть, кровать не ставится
    const issues = auditPlan(h({ length: 9, width: 20, roomsPerFloor: 5, hallArea: 30 }))
    expect(issues.some((i) => i.rule === 'no-bed-fit' || i.rule === 'proportion')).toBe(true)
  })
})

describe('высота потолка и глубина кухни — разные вещи', () => {
  it('высота зала вдвое больше высоты этажа', () => {
    const pl = buildFloorPlan(h(), 0)
    expect(pl.ceilingH).toBe(DEFAULT_HOUSE.floorHeight)
    expect(pl.hallCeilingH).toBe(DEFAULT_HOUSE.floorHeight * 2)
  })

  it('глубина кухни не берётся из высоты этажа', () => {
    // раньше кухня жёстко получала глубину 3.0 из условия «потолок 3 м»
    const a = buildFloorPlan(h({ floorHeight: 3 }), 0).rooms.find((r) => r.type === 'dining')!
    const b = buildFloorPlan(h({ floorHeight: 4 }), 0).rooms.find((r) => r.type === 'dining')!
    expect(a.h).toBeCloseTo(b.h, 3)
  })

  it('двусветный зал близок к квадрату при заданной площади', () => {
    const plan = buildFloorPlan(h(), 0)
    const hall = plan.rooms.find((r) => r.doubleHeight)!
    expect(roomClear(hall, plan).area).toBeCloseTo(DEFAULT_HOUSE.hallArea, 6)
    expect(Math.max(hall.w, hall.h) / Math.min(hall.w, hall.h)).toBeLessThan(1.5)
  })

  it('80 m² hall of the default house is a clear 10 × 8 m room', () => {
    // 8 × 10 would need 10 m + a 3.6 m kitchen of depth; 12.4 m is inside the
    // walls, so the hall turns: 10 m along the 14 m facade, 8 m deep
    const plan = buildFloorPlan(h(), 0)
    const c = roomClear(plan.rooms.find((r) => r.doubleHeight)!, plan)
    expect(c.w).toBeCloseTo(10, 6)
    expect(c.h).toBeCloseTo(8, 6)
  })
})

describe('газифицированная кухня', () => {
  it('раздвижная перегородка делает открытую схему допустимой', () => {
    const issues = auditPlan(h({ connectGas: true }))
    expect(issues.some((i) => i.rule === 'gas-open-plan')).toBe(false)
    expect(issues.some((i) => i.rule === 'gas-partition-ok')).toBe(true)
  })

  it('низкий потолок для газифицированной кухни — ошибка', () => {
    expect(auditPlan(h({ floorHeight: 2.1 })).some((i) => i.rule === 'gas-height')).toBe(true)
  })

  it('объём кухни по построению перекрывает норматив 15 м³', () => {
    // Минимальная глубина кухни 3.6 м даёт не меньше 13 м² даже в доме 6×6,
    // то есть больше 34 м³ при потолке 2.5 м. Нарушить норматив планировка
    // не может — фиксируем это, чтобы правило не потерялось при правках.
    for (const dims of [
      { length: 6, width: 6, hallArea: 12, floorHeight: 2.5 },
      { length: 8, width: 9, hallArea: 25, floorHeight: 2.6 },
      { length: 13, width: 14, hallArea: 80, floorHeight: 3 },
    ]) {
      expect(auditPlan(h(dims)).some((i) => i.rule === 'gas-volume'), JSON.stringify(dims)).toBe(false)
    }
  })

  it('без газа кухонные газовые проверки не применяются', () => {
    const issues = auditPlan(h({ connectGas: false, floorHeight: 2.1 }))
    expect(issues.some((i) => i.rule.startsWith('gas-'))).toBe(false)
  })

  it('проём двусветного зала не проверяется как кухня', () => {
    expect(auditPlan(h({ floorHeight: 2.1 })).filter((i) => i.rule === 'gas-height')).toHaveLength(1)
  })
})

describe('the plan sits inside the real external wall', () => {
  const roomsArea = (p: HouseParams, floor: number) =>
    buildFloorPlan(p, floor).rooms.filter((r) => !r.open).reduce((a, r) => a + r.w * r.h, 0)

  it('ground-floor rooms fill exactly the area inside 0.3 m walls', () => {
    // (14 − 2 × 0.3) × (13 − 2 × 0.3) = 13.4 × 12.4
    expect(roomsArea(h(), 0)).toBeCloseTo(13.4 * 12.4, 6)
  })

  it('follows the engineer override of the external wall', () => {
    // 50 cm walls: (14 − 1) × (13 − 1)
    expect(roomsArea(h({ eng: { extWall: 50 } }), 0)).toBeCloseTo(13 * 12, 6)
  })

  it('upper-floor bedrooms of the default house meet the 8 m² minimum', () => {
    const beds = buildFloorPlan(h(), 1).rooms.filter((r) => r.type === 'bedroom')
    expect(beds.length).toBe(2)
    for (const b of beds) expect(b.w * b.h, b.label).toBeGreaterThanOrEqual(8)
  })
})

describe('doors hang the way an architect draws them', () => {
  const plans = [0, 1].map((f) => buildFloorPlan(h(), f))
  const roomsOf = (plan: ReturnType<typeof buildFloorPlan>, d: (typeof plan.doors)[number]) => {
    const mid = d.start + d.w / 2
    const onWall = (r: (typeof plan.rooms)[number]) =>
      d.orient === 'v'
        ? (Math.abs(r.x - d.pos) < 0.02 || Math.abs(r.x + r.w - d.pos) < 0.02) && mid > r.y && mid < r.y + r.h
        : (Math.abs(r.y - d.pos) < 0.02 || Math.abs(r.y + r.h - d.pos) < 0.02) && mid > r.x && mid < r.x + r.w
    return plan.rooms.filter((r) => !r.open && onWall(r))
  }
  const circulation = new Set(['hall', 'corridor', 'stair'])

  it('no bathroom opens into the kitchen or the living room', () => {
    expect(auditPlan(h()).filter((i) => i.rule === 'bath-door-living')).toEqual([])
    for (const plan of plans) {
      for (const d of plan.doors.filter((x) => x.kind !== 'entrance')) {
        const types = roomsOf(plan, d).map((r) => r.type)
        if (types.includes('bath')) expect(types.some((t) => ['kitchen', 'dining', 'living', 'living_kitchen'].includes(t))).toBe(false)
      }
    }
  })

  it('hall, corridor and stair are joined by open doorways, not leaves', () => {
    for (const plan of plans) {
      for (const d of plan.doors.filter((x) => x.kind !== 'entrance')) {
        const rs = roomsOf(plan, d)
        const bothCirculation = rs.length === 2 && rs.every((r) => circulation.has(r.type))
        expect(d.kind === 'opening', rs.map((r) => r.label).join('/')).toBe(bothCirculation)
      }
    }
  })

  it('leaves open into bedrooms and out of bathrooms', () => {
    for (const plan of plans) {
      for (const d of plan.doors.filter((x) => x.kind === 'interior')) {
        const rs = roomsOf(plan, d)
        const plus = rs.find((r) => (d.orient === 'v' ? Math.abs(r.x - d.pos) < 0.02 : Math.abs(r.y - d.pos) < 0.02))!
        const into = d.swing > 0 ? plus : rs.find((r) => r !== plus)!
        if (rs.some((r) => r.type === 'bath')) expect(into.type, into.label).not.toBe('bath')
        else if (rs.some((r) => r.type === 'bedroom')) expect(into.type, into.label).toBe('bedroom')
      }
    }
  })
})

describe('kitchen-dining and utility room', () => {
  it('a long kitchen strip gives its end to a utility room that opens from the kitchen', () => {
    const plan = buildFloorPlan(h(), 0)
    const kitchen = plan.rooms.find((r) => r.type === 'dining')!
    const utility = plan.rooms.find((r) => r.type === 'utility')!
    // 43 m² would be mostly passage: 32 m² kitchen-dining + 10 m² boiler/laundry room
    expect(roomClear(kitchen, plan).area).toBeCloseTo(7.5 * 4.3, 6)
    expect(roomClear(utility, plan).area).toBeCloseTo(2.4 * 4.3, 6)
    const doors = plan.doors.filter((d) => d.orient === 'v' && Math.abs(d.pos - utility.x) < 0.02)
    expect(doors).toHaveLength(1) // from the kitchen, its only neighbour on that side
    expect(auditPlan(h()).filter((i) => i.level === 'error')).toEqual([])
  })

  it('a compact kitchen keeps its whole strip', () => {
    const plan = buildFloorPlan(h({ length: 11, width: 12, hallArea: 50 }), 0)
    expect(plan.rooms.some((r) => r.type === 'utility')).toBe(false)
  })
})
