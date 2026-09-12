// Регрессионные тесты на КОНКРЕТНЫЕ числа.
//
// Существующий engine.test.ts проверяет только знаки и монотонность («> 0»,
// «премиум дороже эконома»). Из-за этого три реальных бага расчёта жили в коде
// и проходили все 31 тест. Здесь каждое ожидание посчитано вручную от габаритов,
// поэтому подмена формулы ломает тест, а не тихо меняет смету.
//
// Базовый дом: 13 × 14 м, 2 этажа, каркас + газоблок, 1 входная дверь,
// окна 40 м², двусветный зал 80 м².
//   A  = 13 × 14 = 182 м²
//   P  = 2 × (13 + 14) = 54 м
//   H  = 2 × 3 = 6 м
//   Lb = 1.5 × P = 81 м (несущие оси)

import { describe, it, expect } from 'vitest'
import { DEFAULT_HOUSE } from '../model/house'
import type { HouseParams } from '../model/house'
import { computeQuantities } from './quantities'
import type { SectionId } from './quantities'
import { computeEstimate } from './pricing'
import { checkNorms, simplified41Reasons } from './norms'
import { SEED_PRICES } from '../data/prices'
import { STAGE_SECTIONS } from '../data/stages'
import { COEFF as C } from '../data/coefficients'

const house = (patch: Partial<HouseParams> = {}): HouseParams => ({ ...DEFAULT_HOUSE, ...patch })
const qty = (p: HouseParams, key: string, section?: SectionId) =>
  computeQuantities(p)
    .lines.filter((l) => l.key === key && (section === undefined || l.section === section))
    .reduce((a, l) => a + l.quantity, 0)

describe('геометрия по умолчанию', () => {
  it('габариты дают ожидаемые площади', () => {
    const g = computeQuantities(house()).geometry
    expect(g.footprint).toBe(182)
    expect(g.perimeter).toBe(54)
    expect(g.wallHeight).toBe(6)
    expect(g.totalFloorArea).toBe(364)
    expect(g.bearingLength).toBeCloseTo(81, 6)
  })

  it('входная дверь по умолчанию одна', () => {
    expect(DEFAULT_HOUSE.exteriorDoors).toBe(1)
    // проёмы = окна 40 + дверь 1 × 2 м²
    expect(computeQuantities(house()).geometry.openingsArea).toBeCloseTo(42, 6)
  })
})

describe('баг A — пол по грунту это бетон, а не подсыпка', () => {
  it('без пола по грунту подсыпка только под подошву фундамента', () => {
    // soleArea = Lb × ширина ленты = 81 × 0.4 = 32.4 м²; × 0.1 = 3.24 м³
    expect(qty(house(), 'sand_gravel')).toBeCloseTo(3.24, 6)
  })

  it('пол по грунту 10 см добавляет бетон, а не песок с гравием', () => {
    const withFloor = house({ eng: { floorOnGround: 10 } })
    const base = qty(house(), 'concrete_b25', 'foundation')
    // 182 м² × 0.10 м = 18.2 м³ бетона в разделе «фундамент»
    expect(qty(withFloor, 'concrete_b25', 'foundation')).toBeCloseTo(base + 18.2, 6)
    // подсыпка растёт только на слой под плитой (0.1 м), а не на толщину плиты
    expect(qty(withFloor, 'sand_gravel')).toBeCloseTo(3.24 + 18.2, 6)
  })

  it('удвоение толщины пола по грунту удваивает бетон, но не подсыпку', () => {
    const t10 = house({ eng: { floorOnGround: 10 } })
    const t20 = house({ eng: { floorOnGround: 20 } })
    const base = qty(house(), 'concrete_b25', 'foundation')
    expect(qty(t20, 'concrete_b25', 'foundation') - base).toBeCloseTo(36.4, 6)
    expect(qty(t20, 'sand_gravel')).toBeCloseTo(qty(t10, 'sand_gravel'), 6)
  })
})

describe('баг B — подвал не засыпают обратно', () => {
  it('засыпается только рабочая зона вокруг стен', () => {
    const p = house({ basement: true })
    // котлован = A × (2.4 + 0.3) = 491.4 м³ — сам подвал его занимает
    expect(qty(p, 'excavation')).toBeCloseTo(491.4, 6)
    // засыпка = P × 0.6 × 2.7 = 87.48 м³, а не 60% от котлована (294.84)
    expect(qty(p, 'backfill')).toBeCloseTo(54 * C.basementWorkingWidth * 2.7, 6)
    expect(qty(p, 'backfill')).toBeLessThan(qty(p, 'excavation') * 0.25)
  })

  it('без подвала засыпка по-прежнему доля от траншеи', () => {
    const p = house()
    expect(qty(p, 'backfill')).toBeCloseTo(qty(p, 'excavation') * C.backfillFactor, 6)
  })
})

describe('баг C — внутренние стены не считаются дважды', () => {
  it('в каркасе кладка заполняет только наружный контур', () => {
    // (P × H − проёмы) × 0.3 м × 1.05 запаса = (324 − 42) × 0.3 × 1.05
    expect(qty(house(), 'aerated_block', 'walls')).toBeCloseTo(282 * 0.3 * 1.05, 6)
  })

  it('перегородки остаются отдельным разделом и не дублируют кладку', () => {
    // 2 стены × sqrt(182) × 3 м × 2 этажа × 0.1 м
    const expected = 2 * Math.sqrt(182) * 3 * 2 * C.partitionThickness
    expect(qty(house(), 'aerated_block', 'partitions')).toBeCloseTo(expected, 6)
  })

  it('в несущей кладке внутренние несущие стены сохраняются', () => {
    // туф — несущая система: объём считается по полным осям Lb, а не по контуру,
    // поэтому кладки заведомо больше, чем в каркасе того же габарита
    const tuff = qty(house({ system: 'tuff' }), 'tuff_block', 'walls')
    const frame = qty(house(), 'aerated_block', 'walls')
    expect(tuff).toBeGreaterThan(frame)
  })
})

describe('нормы — застройка участка считается, а не напоминается', () => {
  it('182 м² на участке 500 м² это 36.4% — в пределах нормы', () => {
    const w = checkNorms(house(), computeQuantities(house()))
    expect(w.some((x) => x.level === 'error' && x.ru.includes('Застройка участка'))).toBe(false)
    expect(w.some((x) => x.ru.includes('36.4%'))).toBe(true)
  })

  it('тот же дом на участке 300 м² превышает 40% и даёт ошибку', () => {
    const p = house({ plotArea: 300 })
    const w = checkNorms(p, computeQuantities(p))
    expect(w.some((x) => x.level === 'error' && x.ru.includes('Застройка участка'))).toBe(true)
  })

  it('дом с нормативными отступами должен помещаться на участке', () => {
    // 13 × 14 с отступами по 3 м требует (13+6) × (14+6) = 380 м²
    const ok = house({ plotArea: 500 })
    const tight = house({ plotArea: 370 })
    const has = (p: HouseParams) =>
      checkNorms(p, computeQuantities(p)).some((x) => x.ru.includes('требует участка'))
    expect(has(ok)).toBe(false)
    expect(has(tight)).toBe(true)
  })
})

describe('упрощённый порядок N 4.1', () => {
  it('дом по умолчанию проходит', () => {
    const p = house()
    expect(simplified41Reasons(p, computeQuantities(p).geometry.netFloorArea)).toEqual([])
  })

  it('вспомогательные постройки больше 50 м² выбивают из порядка', () => {
    const p = house({ auxBuildingArea: 60 })
    const reasons = simplified41Reasons(p, computeQuantities(p).geometry.netFloorArea)
    expect(reasons.some((r) => r.includes('вспом. постройки'))).toBe(true)
  })

  it('участок меньше 400 м² выбивает из порядка', () => {
    const p = house({ plotArea: 390 })
    expect(simplified41Reasons(p, computeQuantities(p).geometry.netFloorArea).length).toBeGreaterThan(0)
  })
})

describe('новые разделы сметы', () => {
  it('септик считается только без центральной канализации', () => {
    expect(qty(house({ septic: true, connectSewer: false }), 'septic')).toBe(1)
    expect(qty(house({ septic: true, connectSewer: true }), 'septic')).toBe(0)
  })

  it('подключения к сетям не зависят от площади дома', () => {
    const small = qty(house({ length: 8, width: 8 }), 'conn_gas')
    const big = qty(house({ length: 20, width: 20 }), 'conn_gas')
    expect(small).toBe(1)
    expect(big).toBe(1)
  })

  it('вентиляция считается по всей площади этажей', () => {
    expect(qty(house(), 'ventilation')).toBeCloseTo(364, 6)
  })

  it('забор и балконы попадают в смету по заданной величине', () => {
    const p = house({ fenceLength: 80, balconyArea: 12, sitePavingArea: 40 })
    expect(qty(p, 'fence')).toBe(80)
    expect(qty(p, 'balcony')).toBe(12)
    expect(qty(p, 'site_paving')).toBe(40)
  })
})

describe('целостность сметы и графика работ', () => {
  it('каждый раздел сметы попадает ровно в один этап', () => {
    const p = house({ fenceLength: 50, balconyArea: 10, optHeatPump: true, optSolarKw: 5 })
    const sections = new Set(computeQuantities(p).lines.map((l) => l.section))
    for (const s of sections) {
      expect(STAGE_SECTIONS.filter((x) => x === s), `раздел ${s} должен быть ровно в одном этапе`).toHaveLength(1)
    }
  })

  it('сумма этапов сходится с итогом сметы «под ключ»', () => {
    const p = house({ fenceLength: 50, balconyArea: 10, optHeatPump: true })
    const est = computeEstimate(computeQuantities(p), SEED_PRICES, p, 'typical')
    const byStage = STAGE_SECTIONS.reduce((a, s) => a + (est.sectionTotals[s] ?? 0), 0)
    const allSections = Object.values(est.sectionTotals).reduce((a, v) => a + v, 0)
    expect(byStage).toBeCloseTo(allSections, 6)
  })

  it('в каталоге есть цена для каждой позиции расширенной сметы', () => {
    const p = house({ fenceLength: 50, balconyArea: 10, sitePavingArea: 30, optHeatPump: true, optSolarKw: 5, basement: true })
    expect(computeEstimate(computeQuantities(p), SEED_PRICES, p, 'typical').missing).toEqual([])
  })
})
