// Планировка тоже под тестами — раньше их не было вовсе, и дефекты
// (вход в гостиную, туалет через спальню, пеналы, несовпадение лестниц)
// находились только глазами по скриншотам.

import { describe, it, expect } from 'vitest'
import { DEFAULT_HOUSE } from '../model/house'
import type { HouseParams } from '../model/house'
import { auditPlan } from './planAudit'
import { buildFloorPlan } from './floorplan'

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
    expect(hall.w * hall.h).toBeCloseTo(DEFAULT_HOUSE.hallArea, 0)
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
    const hall = buildFloorPlan(h(), 0).rooms.find((r) => r.doubleHeight)!
    expect(hall.w * hall.h).toBeCloseTo(DEFAULT_HOUSE.hallArea, 0)
    expect(Math.max(hall.w, hall.h) / Math.min(hall.w, hall.h)).toBeLessThan(1.5)
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
