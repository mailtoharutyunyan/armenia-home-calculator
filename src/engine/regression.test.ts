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
import { DEFAULT_HOUSE, BUILD_PRESETS } from '../model/house'
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
    expect(g.finishedFloorArea).toBe(284) // 364 − 80 (проём двусветного зала)
    expect(g.bearingLength).toBeCloseTo(81, 6)
  })

  it('входная дверь по умолчанию одна', () => {
    expect(DEFAULT_HOUSE.exteriorDoors).toBe(1)
    // проёмы = окна 40 + дверь 1 × 2 м²
    expect(computeQuantities(house()).geometry.openingsArea).toBeCloseTo(42, 6)
  })
})

describe('баг A — пол по грунту это бетон, а не подсыпка', () => {
  // explicit 0 = no slab on ground (e.g. a suspended floor)
  const noGroundSlab = house({ eng: { floorOnGround: 0 } })

  it('без пола по грунту подсыпка только под подошву фундамента', () => {
    // soleArea = Lb × ширина ленты = 81 × 0.4 = 32.4 м²; × 0.1 = 3.24 м³
    expect(qty(noGroundSlab, 'sand_gravel')).toBeCloseTo(3.24, 6)
  })

  it('пол по грунту 10 см добавляет бетон, а не песок с гравием', () => {
    const withFloor = house({ eng: { floorOnGround: 10 } })
    const base = qty(noGroundSlab, 'concrete_b25', 'foundation')
    // 182 м² × 0.10 м = 18.2 м³ бетона в разделе «фундамент»
    expect(qty(withFloor, 'concrete_b25', 'foundation')).toBeCloseTo(base + 18.2, 6)
    // подсыпка растёт только на слой под плитой (0.1 м), а не на толщину плиты
    expect(qty(withFloor, 'sand_gravel')).toBeCloseTo(3.24 + 18.2, 6)
  })

  it('удвоение толщины пола по грунту удваивает бетон, но не подсыпку', () => {
    const t10 = house({ eng: { floorOnGround: 10 } })
    const t20 = house({ eng: { floorOnGround: 20 } })
    const base = qty(noGroundSlab, 'concrete_b25', 'foundation')
    expect(qty(t20, 'concrete_b25', 'foundation') - base).toBeCloseTo(36.4, 6)
    expect(qty(t20, 'sand_gravel')).toBeCloseTo(qty(t10, 'sand_gravel'), 6)
  })

  it('a strip, pile or column house gets a 10 cm slab on ground by default', () => {
    for (const foundation of ['strip', 'pile', 'column'] as const) {
      const d = qty(house({ foundation }), 'concrete_b25', 'foundation') -
        qty(house({ foundation, eng: { floorOnGround: 0 } }), 'concrete_b25', 'foundation')
      expect(d, foundation).toBeCloseTo(182 * C.floorOnGroundThickness, 6)
    }
  })

  it('a slab foundation or a basement already has its ground slab', () => {
    const slab = house({ foundation: 'slab' })
    // the only foundation concrete is the slab itself: 182 m² × 0.3 m
    expect(qty(slab, 'concrete_b25', 'foundation')).toBeCloseTo(182 * C.slabThickness, 6)
    const basement = house({ basement: true })
    expect(qty(basement, 'concrete_b25', 'foundation')).toBeCloseTo(
      qty(house({ basement: true, eng: { floorOnGround: 0 } }), 'concrete_b25', 'foundation'),
      6,
    )
  })
})

describe('formwork of concrete cast on or into the ground', () => {
  it('the slab on ground adds concrete but no formwork', () => {
    expect(qty(house(), 'formwork')).toBeCloseTo(qty(house({ eng: { floorOnGround: 0 } }), 'formwork'), 6)
  })

  it('a foundation slab is formed at its edges only', () => {
    // perimeter 54 m × 0.3 m = 16.2 m², not 54.6 m³ × 6.5 = 355 m²
    expect(qty(house({ foundation: 'slab' }), 'formwork', 'foundation')).toBeCloseTo(54 * C.slabThickness, 6)
  })

  it('bored piles need no formwork, their grillage does', () => {
    // grillage = 81 m × 0.4 m × 0.4 m
    expect(qty(house({ foundation: 'pile' }), 'formwork', 'foundation')).toBeCloseTo(81 * 0.4 * 0.4 * C.formworkPerM3, 6)
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

  it('a basement adds the slab over it and a stair flight down', () => {
    const p = house({ basement: true })
    // slab over the basement = footprint 182 m² × 0.18 m
    expect(qty(p, 'concrete_b25', 'floors') - qty(house(), 'concrete_b25', 'floors')).toBeCloseTo(
      182 * C.floorSlabThickness,
      6,
    )
    // one flight between the two storeys + one down to the basement
    expect(qty(p, 'stair')).toBeCloseTo(2 * C.stairVolumePerFlight, 6)
  })

  it('the shell labour rate covers the basement too', () => {
    const brigadeArea = (p: HouseParams) =>
      computeEstimate(computeQuantities(p), SEED_PRICES, p, 'typical').lines.find((l) => l.key === 'brigade')?.quantity ?? 0
    expect(brigadeArea(house())).toBeCloseTo(364, 6)
    expect(brigadeArea(house({ basement: true }))).toBeCloseTo(364 + 182, 6)
  })
})

describe('баг C — внутренние стены не считаются дважды', () => {
  it('в каркасе кладка заполняет только наружный контур', () => {
    // (P × H − openings − frame in the wall plane) × 0.3 m × 1.05 waste.
    // Frame in the wall: 12 edge columns of the 4 × 4 grid × 0.4 m × 6 m = 28.8 m²
    // + edge beams 54 m × 2 levels × 0.4 m = 43.2 m² − 24 column/beam crossings
    // × 0.4 × 0.4 = 3.84 m²  →  68.16 m²;  (324 − 42 − 68.16) × 0.3 × 1.05
    expect(qty(house(), 'aerated_block', 'walls')).toBeCloseTo((282 - 68.16) * 0.3 * 1.05, 6)
  })

  it('an overridden column count keeps the share of columns in the wall', () => {
    // 32 columns instead of 16: twice the edge columns, 24 instead of 12
    const base = qty(house(), 'aerated_block', 'walls')
    const moreCols = qty(house({ eng: { columns: 32 } }), 'aerated_block', 'walls')
    expect(base - moreCols).toBeCloseTo((12 * 0.4 * 6 - 12 * 0.4 * 0.4 * 2) * 0.3 * 1.05, 6)
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

  it('электрика и водопровод — по полу, без проёма двусветного зала', () => {
    // над залом перекрытия нет — разводки там тоже нет: 364 − 80 = 284 м².
    // Отопление зависит от объёма, зал греется как два этажа — остаётся 364.
    expect(qty(house(), 'electrical')).toBeCloseTo(284, 6)
    expect(qty(house(), 'plumbing')).toBeCloseTo(284, 6)
    expect(qty(house(), 'heating')).toBeCloseTo(364, 6)
  })

  it('без двусветного зала электрика и водопровод — по всей площади', () => {
    const p = house({ doubleHeightHall: false })
    expect(qty(p, 'electrical')).toBeCloseTo(364, 6)
    expect(qty(p, 'plumbing')).toBeCloseTo(364, 6)
  })

  it('проект и технадзор оплачиваются за м² дома без проёма зала', () => {
    expect(qty(house(), 'permit_design')).toBeCloseTo(284, 6)
    expect(qty(house(), 'permit_supervision')).toBeCloseTo(284, 6)
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

describe('панель инженера — переопределения реально меняют расчёт', () => {
  const eng = (e: HouseParams['eng'], patch: Partial<HouseParams> = {}) => house({ ...patch, eng: e })

  it('пустая панель не меняет итог по умолчанию', () => {
    // страховка от того, что новое поле случайно получит ненулевой дефолт
    const a = computeEstimate(computeQuantities(house()), SEED_PRICES, house(), 'typical').turnkey.total
    const b = computeEstimate(computeQuantities(eng({})), SEED_PRICES, eng({}), 'typical').turnkey.total
    expect(b).toBe(a)
    // Закреплённый итог базового дома — ЦЕНА ДОГОВОРА, а не прямые затраты.
    // История изменений (менять только осознанно, с объяснением):
    //   65 375 272  исходный расчёт после исправления трёх багов объёмов
    //   68 546 404  + опалубка и подача бетона насосом
    //   67 796 404  регион Ереван => центральная канализация вместо септика
    //  103 405 190  + сметная развёртка: накладные, прибыль, временные,
    //               непредвиденные и НДС; опалубка 5 -> 6.5 м²/м³;
    //               разуклонка плоской кровли
    //   99 158 838  электрика, водопровод, проект и технадзор — по полу без
    //               проёма двусветного зала (284 м² вместо 364)
    //   82 942 699  VAT is opt-in: the default estimate is without VAT
    //   84 673 234  10 cm slab on ground under the ground floor (strip foundation)
    //   83 716 374  frame infill excludes the columns and beams in the wall plane
    expect(Math.round(a)).toBe(83716374)
  })

  it('армирование по элементам масштабирует тоннаж линейно', () => {
    const base = qty(house(), 'rebar_a500', 'floors')
    expect(qty(eng({ rebarFloor: 220 }), 'rebar_a500', 'floors')).toBeCloseTo(base * 2, 5)
  })

  it('толщина плитного фундамента управляет объёмом бетона', () => {
    const p = { foundation: 'slab' as const }
    const b = qty(eng({}, p), 'concrete_b25', 'foundation')
    expect(qty(eng({ slabThickness: 45 }, p), 'concrete_b25', 'foundation')).toBeCloseTo(b * 1.5, 4)
  })

  it('диаметр сваи входит в объём квадратично', () => {
    const p = { foundation: 'pile' as const }
    const q1 = computeQuantities(eng({ pileDiameter: 30 }, p))
    const q2 = computeQuantities(eng({ pileDiameter: 60 }, p))
    const vol = (q: ReturnType<typeof computeQuantities>) =>
      q.lines.filter((l) => l.key === 'concrete_b25' && l.section === 'foundation').reduce((a, l) => a + l.quantity, 0)
    // ростверк не зависит от диаметра, поэтому рост меньше четырёхкратного, но заметный
    expect(vol(q2)).toBeGreaterThan(vol(q1) * 1.5)
  })

  it('класс бетона задаётся отдельно по элементам', () => {
    const q = computeQuantities(eng({ concreteFoundation: 'concrete_b30', concreteFloors: 'concrete_b20' }))
    const at = (s: SectionId) => q.lines.find((l) => l.key.startsWith('concrete_b') && l.section === s && l.key !== 'concrete_blinding')?.key
    expect(at('foundation')).toBe('concrete_b30')
    expect(at('floors')).toBe('concrete_b20')
    expect(at('frame')).toBe('concrete_b25') // не задан — берётся общий класс
  })

  it('доля внутренних несущих осей управляет объёмом кладки', () => {
    const p = { system: 'tuff' as const }
    const less = qty(eng({ internalBearingPct: 0 }, p), 'tuff_block', 'walls')
    const more = qty(eng({ internalBearingPct: 100 }, p), 'tuff_block', 'walls')
    expect(more).toBeGreaterThan(less)
  })

  it('шаг сейсмосердечников: чаще — больше бетона', () => {
    const p = { system: 'tuff' as const }
    const rare = qty(eng({ seismicCoreStep: 6 }, p), 'concrete_b25', 'walls')
    const dense = qty(eng({ seismicCoreStep: 2 }, p), 'concrete_b25', 'walls')
    expect(dense).toBeGreaterThan(rare)
  })

  it('нулевая доля раствора убирает строку раствора', () => {
    expect(qty(eng({ mortarSharePct: 0 }, { system: 'tuff' }), 'mortar')).toBe(0)
    expect(qty(eng({}, { system: 'tuff' }), 'mortar')).toBeGreaterThan(0)
  })

  it('нормы ловят заниженное армирование и опечатку в единицах', () => {
    const low = checkNorms(eng({ rebarColumn: 10 }), computeQuantities(eng({ rebarColumn: 10 })))
    expect(low.some((w) => w.level === 'error' && w.ru.includes('Армирование'))).toBe(true)
    const high = checkNorms(eng({ rebarColumn: 5000 }), computeQuantities(eng({ rebarColumn: 5000 })))
    expect(high.some((w) => w.ru.includes('единицы'))).toBe(true)
  })

  it('нормы ловят класс бетона ниже сейсмического минимума по элементу', () => {
    const p = eng({ concreteFloors: 'concrete_b15' })
    expect(checkNorms(p, computeQuantities(p)).some((w) => w.level === 'error' && w.ru.includes('перекрытий'))).toBe(true)
  })
})

describe('опалубка, подача бетона и толщина утеплителя', () => {
  it('опалубка попадает в тот же раздел, где залит бетон', () => {
    const q = computeQuantities(house())
    const fw = q.lines.filter((l) => l.key === 'formwork')
    // бетон есть в фундаменте, каркасе, стенах и перекрытиях — опалубка тоже
    expect(new Set(fw.map((l) => l.section)).size).toBeGreaterThan(1)
    expect(fw.some((l) => l.section === 'foundation')).toBe(true)
    expect(fw.some((l) => l.section === 'floors')).toBe(true)
  })

  it('объём опалубки пропорционален объёму бетона', () => {
    const q = computeQuantities(house())
    const concrete = q.lines
      .filter((l) => l.key === 'concrete_b25')
      .reduce((a, l) => a + l.quantity, 0)
    const formwork = q.lines.filter((l) => l.key === 'formwork').reduce((a, l) => a + l.quantity, 0)
    // the 10 cm slab on ground (182 m² × 0.1 m) is cast on the ground, unformed
    const groundSlab = 182 * C.floorOnGroundThickness
    expect(formwork).toBeCloseTo((concrete - groundSlab) * C.formworkPerM3, 4)
  })

  it('норма опалубки настраивается инженером', () => {
    // отношение к дефолту, а не жёсткое ×2: коэффициент по умолчанию может
    // уточняться, а пропорциональность должна сохраняться всегда
    const base = qty(house(), 'formwork')
    const raised = qty(house({ eng: { formworkPerM3: 13 } }), 'formwork')
    expect(raised / base).toBeCloseTo(13 / C.formworkPerM3, 6)
  })

  it('подача насосом отключается и убирает строку', () => {
    expect(qty(house({ concretePump: true }), 'concrete_pump')).toBeGreaterThan(0)
    expect(qty(house({ concretePump: false }), 'concrete_pump')).toBe(0)
  })

  it('толщина утеплителя линейно меняет его количество', () => {
    const base = qty(house(), 'insulation')
    expect(qty(house({ eng: { insulationThickness: 20 } }), 'insulation')).toBeCloseTo(base * 2, 4)
    expect(qty(house({ eng: { insulationThickness: 5 } }), 'insulation')).toBeCloseTo(base / 2, 4)
  })
})

describe('согласованность значений по умолчанию', () => {
  it('регион по умолчанию и канализация не противоречат друг другу', () => {
    // Ереван — есть центральная канализация, значит септик по умолчанию не нужен.
    // Иначе смета по умолчанию платит за локальное очистное там, где есть сеть.
    expect(DEFAULT_HOUSE.region).toBe('yerevan')
    expect(DEFAULT_HOUSE.connectSewer).toBe(true)
    expect(DEFAULT_HOUSE.septic).toBe(false)
    expect(qty(house(), 'septic')).toBe(0)
    expect(qty(house(), 'conn_sewer')).toBe(1)
  })

  it('снятие центральной канализации включает септик в смету', () => {
    const p = house({ connectSewer: false, septic: true })
    expect(qty(p, 'septic')).toBe(1)
    expect(qty(p, 'conn_sewer')).toBe(0)
  })

  it('дом по умолчанию не нарушает норм', () => {
    const w = checkNorms(house(), computeQuantities(house()))
    expect(w.filter((x) => x.level === 'error')).toEqual([])
    expect(w.filter((x) => x.level === 'warning')).toEqual([])
  })

  it('VAT is opt-in: off by default and in both build presets', () => {
    expect(DEFAULT_HOUSE.vatIncluded).toBe(false)
    expect(BUILD_PRESETS.self.vatIncluded).toBe(false)
    expect(BUILD_PRESETS.contractor.vatIncluded).toBe(false)
    expect(computeEstimate(computeQuantities(house()), SEED_PRICES, house(), 'typical').turnkey.vat).toBe(0)
  })

  it('класс бетона по умолчанию проходит сейсмический минимум', () => {
    expect(DEFAULT_HOUSE.concreteGrade).toBe('concrete_b25')
  })

  it('стена по умолчанию проходит по теплозащите без утепления', () => {
    // газоблок 300 мм: R = 0.3 / 0.14 = 2.14 ≥ 2.0 м²·К/Вт
    const R = DEFAULT_HOUSE.wallThickness / C.thermalLambda.aerated
    expect(R).toBeGreaterThanOrEqual(C.norms.wallThermalRReq)
  })
})

describe('сметная развёртка — от затрат к цене договора', () => {
  it('прямые затраты не включают документы', () => {
    const e = computeEstimate(computeQuantities(house()), SEED_PRICES, house(), 'typical')
    // документы идут отдельной строкой: на них не начисляются накладные и НДС
    expect(e.turnkey.permit).toBeGreaterThan(0)
    expect(e.turnkey.direct).toBe(e.turnkey.material + e.turnkey.labor)
    expect(e.turnkey.total).toBeCloseTo(
      e.turnkey.works + e.turnkey.contingency + e.turnkey.permit + e.turnkey.vat,
      4,
    )
  })

  it('накладные считаются от работы, прибыль — от прямых затрат', () => {
    const p = house({ overheadPct: 20, profitPct: 10 })
    const e = computeEstimate(computeQuantities(p), SEED_PRICES, p, 'typical')
    expect(e.turnkey.overhead).toBeCloseTo(e.turnkey.labor * 0.2, 4)
    expect(e.turnkey.profit).toBeCloseTo(e.turnkey.direct * 0.1, 4)
  })

  it('хозспособ дешевле подряда: нет прибыли, накладных и НДС', () => {
    const self = house({ ...BUILD_PRESETS.self, buildMode: 'self' as const })
    const contractor = house({ ...BUILD_PRESETS.contractor, buildMode: 'contractor' as const })
    const a = computeEstimate(computeQuantities(self), SEED_PRICES, self, 'typical').turnkey
    const b = computeEstimate(computeQuantities(contractor), SEED_PRICES, contractor, 'typical').turnkey
    expect(a.overhead).toBe(0)
    expect(a.profit).toBe(0)
    expect(a.vat).toBe(0)
    expect(a.total).toBeLessThan(b.total)
  })

  it('непредвиденные считаются от СМР и не равны нулю по умолчанию', () => {
    const e = computeEstimate(computeQuantities(house()), SEED_PRICES, house(), 'typical')
    expect(DEFAULT_HOUSE.contingencyPct).toBeGreaterThan(0)
    expect(e.turnkey.contingency).toBeCloseTo(e.turnkey.works * (DEFAULT_HOUSE.contingencyPct / 100), 4)
  })

  it('нулевые проценты дают ровно прямые затраты плюс документы', () => {
    const p = house({ overheadPct: 0, profitPct: 0, temporaryPct: 0, winterPct: 0, contingencyPct: 0, vatIncluded: false })
    const e = computeEstimate(computeQuantities(p), SEED_PRICES, p, 'typical')
    expect(e.turnkey.total).toBeCloseTo(e.turnkey.direct + e.turnkey.permit, 4)
  })

  it('опалубка соответствует ручной проверке объёмов', () => {
    // перекрытия + колонны + ригели + лента ≈ 780 м²; расчёт должен быть рядом
    const fw = qty(house(), 'formwork')
    expect(fw).toBeGreaterThan(700)
    expect(fw).toBeLessThan(900)
  })

  it('плоская кровля получает уклонообразующий слой', () => {
    expect(qty(house({ roof: 'flat' }), 'roof_slope')).toBeCloseTo(182 * C.roofSlopeLayer, 4)
    expect(qty(house({ roof: 'pitched' }), 'roof_slope')).toBe(0)
  })
})
