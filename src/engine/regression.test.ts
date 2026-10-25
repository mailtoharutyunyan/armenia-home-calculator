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
import { computeQuantities, planTake } from './quantities'
import type { SectionId } from './quantities'
import { buildFloorPlan, planTakeoff } from './floorplan'
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
    // poured between the strips: (182 − 32.4 м² of strip) × 0.10 м = 14.96 м³
    expect(qty(withFloor, 'concrete_b25', 'foundation')).toBeCloseTo(base + 14.96, 6)
    // подсыпка растёт на слой под плитой (0.1 м), а не на толщину плиты, плюс
    // завозной грунт: подъём пола на цоколь 149.6 × (0.5 − 0.1 − 0.1) = 44.88 м³
    // и засыпка пазух 46.17 м³ больше вынутых 76.95 м³ на 14.1 м³
    expect(qty(withFloor, 'sand_gravel')).toBeCloseTo(3.24 + 14.96 + 14.1, 6)
  })

  it('более толстая плита по грунту вытесняет засыпку под ней, а не подушку', () => {
    const t20 = house({ eng: { floorOnGround: 20 } })
    const base = qty(noGroundSlab, 'concrete_b25', 'foundation')
    expect(qty(t20, 'concrete_b25', 'foundation') - base).toBeCloseTo(149.6 * 0.2, 6)
    // under the slab 149.6 × (0.5 − 0.2 − 0.1) = 29.92 m³ of local soil; with
    // the trench 46.17 m³ that is 76.09 m³ < 76.95 dug, so nothing is brought in
    expect(qty(t20, 'backfill')).toBeCloseTo(46.17 + 29.92, 6)
    expect(qty(t20, 'sand_gravel')).toBeCloseTo(3.24 + 14.96, 6)
  })

  it('a strip, pile or column house gets a 10 cm slab on ground by default', () => {
    // poured between what already stands on the ground, never over it: the
    // strip or grillage (81 × 0.4 = 32.4 m²) or 81 / 2 = 40.5 pads of 0.4 × 0.4
    const area = { strip: 182 - 32.4, pile: 182 - 32.4, column: 182 - 40.5 * 0.16 }
    for (const foundation of ['strip', 'pile', 'column'] as const) {
      const d = qty(house({ foundation }), 'concrete_b25', 'foundation') -
        qty(house({ foundation, eng: { floorOnGround: 0 } }), 'concrete_b25', 'foundation')
      expect(d, foundation).toBeCloseTo(area[foundation] * C.floorOnGroundThickness, 6)
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

  it('траншея под ленту с рабочей зоной, засыпаются только пазухи', () => {
    // 81 м × (0.4 + 2 × 0.3) × (0.8 + 0.1 подушка + 0.05 подбетонка) = 76.95 м³
    const bare = house({ eng: { floorOnGround: 0 } })
    expect(qty(bare, 'excavation')).toBeCloseTo(76.95, 6)
    // пазухи = траншея − лента с подушкой: 76.95 − 81 × 0.4 × 0.95 = 46.17 м³
    expect(qty(bare, 'backfill')).toBeCloseTo(46.17, 6)
    // остаток вывозится с разрыхлением: 30.78 × 1.2
    expect(qty(bare, 'soil_removal')).toBeCloseTo(30.78 * C.soilBulking, 6)
    // по умолчанию весь грунт уходит под пол на цоколе — вывозить нечего
    expect(qty(house(), 'backfill')).toBeCloseTo(76.95, 6)
    expect(qty(house(), 'soil_removal')).toBe(0)
    // доля из панели инженера по-прежнему приоритетнее
    expect(qty(house({ eng: { floorOnGround: 0, backfillPct: 50 } }), 'backfill')).toBeCloseTo(76.95 * 0.5, 6)
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
    // measured on the drawn plans, from floor to slab (3 − 0.18 m), less the
    // door openings (0.9 × 2.1 m), 0.1 m thick
    const take = [0, 1].map((f) => planTakeoff(buildFloorPlan(house(), f)))
    const len = take[0].partitions + take[1].partitions
    const doors = take[0].leafDoors + take[1].leafDoors
    const expected = (len * 2.82 - doors * 0.9 * 2.1) * C.partitionThickness
    expect(qty(house(), 'aerated_block', 'partitions')).toBe(0)
    expect(qty(house(), 'aerated_partition', 'partitions')).toBeCloseTo(expected, 6)
    expect(qty(house(), 'glue_aerated', 'partitions')).toBeCloseTo(expected * C.glueShare, 6)
  })

  it('doors, the glass partition and the railings are priced as the plans draw them', () => {
    const take = [0, 1].map((f) => planTakeoff(buildFloorPlan(house(), f)))
    expect(qty(house(), 'door_interior')).toBe(take[0].leafDoors + take[1].leafDoors)
    expect(qty(house({ interiorDoors: 8 }), 'door_interior')).toBe(8) // a typed count still wins
    // the kitchen side of the hall, floor to slab
    expect(qty(house(), 'glass_partition')).toBeCloseTo(take[0].glass * 2.82, 6)
    // along the void, plus one flight of stairs
    expect(qty(house(), 'railing')).toBeCloseTo(take[1].railing + C.stairRailingPerFlight, 6)
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

  it('все инженерные сети — по общей площади дома, без проёма зала', () => {
    // внутри наружных стен 12.4 × 13.4 = 166.16 м² на этаж; × 2 − 80 = 252.32 м²
    for (const key of ['electrical', 'plumbing', 'heating', 'ventilation']) {
      expect(qty(house(), key), key).toBeCloseTo(252.32, 6)
    }
  })

  it('без двусветного зала сети — по всей общей площади этажей', () => {
    const p = house({ doubleHeightHall: false })
    for (const key of ['electrical', 'plumbing', 'heating', 'ventilation']) {
      expect(qty(p, key), key).toBeCloseTo(332.32, 6)
    }
  })

  it('отопление и вентиляция по умолчанию: 252.32 м² × (материал + работа)', () => {
    const p = house()
    const est = computeEstimate(computeQuantities(p), SEED_PRICES, p, 'typical')
    const line = (key: string) => est.lines.find((l) => l.key === key)!.total
    expect(line('heating')).toBeCloseTo(252.32 * (10500 + 7600), 0) // 4 566 992
    // a radiator under each of the 10 ordinary windows (30 m² / 3 m²)
    expect(line('radiators')).toBeCloseTo(10 * (37400 + 10000), 0) // 474 000
    expect(line('ventilation')).toBeCloseTo(252.32 * (4000 + 3000), 0) // 1 766 240
  })

  it('тёплый пол заменяет радиаторы, рекуперация — доплата к вентиляции', () => {
    const base = house()
    const extra = house({ optHeating: true, optMvhr: true })
    expect(qty(extra, 'opt_boiler_heating')).toBeCloseTo(252.32, 6)
    expect(qty(extra, 'opt_mvhr')).toBeCloseTo(252.32, 6)
    expect(qty(base, 'opt_boiler_heating')).toBe(0)
    expect(qty(base, 'opt_mvhr')).toBe(0)
    expect(qty(extra, 'heating')).toBe(qty(base, 'heating'))
    // underfloor heating replaces the radiators instead of adding to them
    expect(qty(base, 'radiators')).toBe(10)
    expect(qty(extra, 'radiators')).toBe(0)
    expect(qty(extra, 'ventilation')).toBe(qty(base, 'ventilation'))
  })

  it('проект и технадзор оплачиваются за м² дома без проёма зала', () => {
    expect(qty(house(), 'permit_design')).toBeCloseTo(252.32, 6)
    expect(qty(house(), 'permit_supervision')).toBeCloseTo(252.32, 6)
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
    // Закреплённый итог базового дома — полная цена стройки, а не прямые
    // затраты (с 26.09.2026 хозспособом: без накладных и прибыли подрядчика).
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
    //   83 774 872  glue for the aerated-block partitions
    //   82 662 735  market prices of 26.09.2026 (concrete, rebar, blocks, windows,
    //               doors, finishes; see src/data/prices.ts)
    //   80 680 455  flat roof priced once: the membrane and insulation were also
    //               inside the 9 000 + 5 000 "flat roof" line
    //   71 386 789  self-build is the default: no contractor overhead (15% of
    //               labour) or profit (8%), temporary works 1.5% -> 1%
    //   70 460 655  concrete poured once at the frame nodes (ГЭСН 81-02-06,
    //               2.2-2.4), slab on ground between the strips, no design
    //               expertise under the simplified procedure N 4.1
    //   74 324 966  doors, partitions, the kitchen's sliding glass partition and
    //               the gallery and stair railings measured on the plans
    //   71 925 206  heating and ventilation priced on the floor (284 m²), not
    //               over the double-height void (364 m²)
    //   83 603 208  full check of 26.10.2026: per-m² works on the house area
    //               (252 m²); trench with working space, 0.5 m plinth, fill
    //               under the floor, XPS under it; partitions floor to slab
    //               less doors, priced per m² of laying; plaster on the inner
    //               face; slabs without the per-storey rebar increase; stair
    //               at its real cost; parapet, scaffolding, crane, setting-out,
    //               soil and waste removal, sills, bathroom tiles and fixtures,
    //               stair finish, internal gas, roof drainage; screed, floor
    //               insulation and blind area keep their own labour; labour
    //               rates of 26.10.2026 (brigade 14 000, plaster 6 500 ֏/m²)
    //   83 932 064  installation priced for doors (18 000), fixtures, sills;
    //               crane shift 60 000
    //   83 926 056  radiators on their own line (one per ordinary window, from
    //               quotes), so underfloor heating replaces them
    expect(Math.round(a)).toBe(83926056)
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

  it('объём опалубки пропорционален полным сечениям элементов', () => {
    // The m²/m³ ratio was set on full sections, so the nodes poured once still
    // count: strip 81 × 0.4 × (0.8 + 0.5 plinth), columns 16 × 0.16 × 6, beams 162 × 0.16,
    // slabs 284 × 0.18, hall beams 2√80 × 0.3 × 0.4, lintels 30 × 0.25 × 0.2.
    // The slab on ground is cast on the ground, unformed.
    const formed = 42.12 + 15.36 + 25.92 + 284 * 0.18 + 2 * Math.sqrt(80) * 0.12 + 30 * C.lintel.w * C.lintel.h
    expect(qty(house(), 'formwork')).toBeCloseTo(formed * C.formworkPerM3, 4)
  })

  it('concrete at the frame nodes is poured once (ГЭСН 81-02-06, 2.2–2.4)', () => {
    // columns up to the underside of each 0.18 m slab: 16 × 0.16 × (6 − 2 × 0.18);
    // beams between column faces, (162 − 16 × 0.4 × 2) m, and below the slab, 0.4 − 0.18 m
    expect(qty(house(), 'concrete_b25', 'frame')).toBeCloseTo(16 * 0.16 * 5.64 + 149.2 * 0.4 * 0.22, 6)
    // slabs over their whole area; the beams over the hall only below the roof slab
    expect(qty(house(), 'concrete_b25', 'floors')).toBeCloseTo(284 * 0.18 + 2 * Math.sqrt(80) * 0.3 * 0.22, 6)
    // precast slabs are laid on the beams, not poured over them: full beam depth
    expect(qty(house({ floorSlab: 'precast' }), 'concrete_b25', 'frame')).toBeCloseTo(16 * 0.16 * 6 + 149.2 * 0.16, 6)
    // the pump moves what is poured; the rebar is still set on full sections
    const poured = qty(house(), 'concrete_b25')
    expect(qty(house(), 'concrete_pump')).toBeCloseTo(poured, 6)
    const rebarK = 1 + C.rebarFloorFactor
    expect(qty(house(), 'rebar_a500', 'frame')).toBeCloseTo(
      ((16 * 0.16 * 6 * C.rebar.column + 162 * 0.16 * C.rebar.ringBeam) * rebarK) / 1000,
      6,
    )
  })

  it('bearing walls stop under the slab that rests on them', () => {
    // tuff: the 0.18 m slab over 81 m of 0.4 m walls on both storeys is slab, not masonry
    const withSlab = qty(house({ system: 'tuff', wallThickness: 0.4 }), 'tuff_block', 'walls')
    const precast = qty(house({ system: 'tuff', wallThickness: 0.4, floorSlab: 'precast' }), 'tuff_block', 'walls')
    expect(precast - withSlab).toBeCloseTo(81 * 0.4 * 0.18 * 2 * 1.05, 6)
  })

  it('the simplified procedure N 4.1 needs no design expertise', () => {
    expect(qty(house(), 'permit_expertise')).toBe(0)
    // three storeys are outside N 4.1: the expertise is paid
    expect(qty(house({ floors: 3 }), 'permit_expertise')).toBe(1)
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

  it('self-build is the default, with the self-build percentages', () => {
    expect(DEFAULT_HOUSE.buildMode).toBe('self')
    const { vatIncluded: _vat, ...markups } = BUILD_PRESETS.self
    expect(DEFAULT_HOUSE).toMatchObject(markups)
    const e = computeEstimate(computeQuantities(house()), SEED_PRICES, house(), 'typical').turnkey
    expect(e.overhead).toBe(0)
    expect(e.profit).toBe(0)
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

describe('norm checks read the inputs the estimate uses', () => {
  const warnings = (p: HouseParams) => checkNorms(p, computeQuantities(p))
  const has = (p: HouseParams, text: string) => warnings(p).some((x) => x.ru.includes(text))

  it('the thermal check follows the external-wall override', () => {
    // aerated 20 cm: R = 0.2 / 0.14 = 1.43 < 2.0
    expect(has(house({ eng: { extWall: 20 } }), 'Сопротивление стены')).toBe(true)
    expect(has(house(), 'Сопротивление стены')).toBe(false)
  })

  it('tuff infill of an RC frame is not held to the bearing-wall minimum', () => {
    expect(has(house({ system: 'frame', infillMaterial: 'tuff', wallThickness: 0.3 }), 'несущей стены из туфа')).toBe(false)
    expect(has(house({ system: 'tuff', wallThickness: 0.3 }), 'несущей стены из туфа')).toBe(true)
  })

  it('room height is checked clear of the slab', () => {
    // 2.8 m storey − 0.18 m slab = 2.62 m < 2.7 m
    expect(has(house({ floorHeight: 2.8 }), 'Высота комнат в чистоте')).toBe(true)
    expect(has(house({ floorHeight: 3 }), 'Высота комнат в чистоте')).toBe(false)
  })

  it('site coverage counts the outbuildings', () => {
    // (182 + 40) / 500 = 44.4% > 40%
    const p = house({ plotArea: 500, auxBuildingArea: 40 })
    expect(warnings(p).some((x) => x.level === 'error' && x.ru.includes('Застройка участка 44.4%'))).toBe(true)
  })

  it('frost depth is compared with the depth of the chosen foundation', () => {
    // Sevan frost 1.8 m: 3 m piles are deep enough, 1.5 m pad columns are not
    expect(has(house({ region: 'sevan', foundation: 'pile' }), 'Глубина промерзания')).toBe(false)
    expect(has(house({ region: 'sevan', foundation: 'column' }), 'недостаточным (1.5 м)')).toBe(true)
    // the message shows the strip height actually entered
    expect(has(house({ region: 'kotayk', eng: { stripHeight: 100 } }), 'недостаточным (1 м)')).toBe(true)
  })
})

describe('double-height hall advice (practice, not a norm)', () => {
  const advice = (p: HouseParams) => checkNorms(p, computeQuantities(p)).filter((x) => x.code === 'practice')

  it('an 80 m² void in a 252 m² house is flagged as over the usual share, as info only', () => {
    const a = advice(house())
    expect(a.some((x) => x.ru.includes('32% площади дома'))).toBe(true)
    expect(a.every((x) => x.level === 'info')).toBe(true)
  })

  it('a void within the usual share and with floor heating gets no advice', () => {
    expect(advice(house({ hallArea: 40, optHeating: true }))).toEqual([])
    expect(advice(house({ doubleHeightHall: false }))).toEqual([])
  })
})

describe('flat roof', () => {
  it('its layers add up to one roof, not two', () => {
    // material per m² of footprint: slope screed 0.1 m³ + remaining build-up +
    // two-layer membrane + 100 mm insulation — a real flat roof is ~8–12 k ֏/m²
    const per = (k: string, qty: number) => SEED_PRICES[k].materialTypical * qty
    const roof = per('roof_slope', C.roofSlopeLayer) + per('roof_flat', 1) + per('waterproofing', 1) + per('insulation_xps', 1)
    expect(roof).toBeGreaterThan(8000)
    expect(roof).toBeLessThan(12000)
    // and each layer appears once in the quantities
    const q = computeQuantities(house({ roof: 'flat' })).lines.filter((l) => l.section === 'roof')
    expect(q.filter((l) => l.key === 'waterproofing')).toHaveLength(1)
    expect(q.filter((l) => l.key === 'insulation_xps')).toHaveLength(1)
  })
})

describe('полная проверка 26.10.2026', () => {
  const est = (p: HouseParams) => computeEstimate(computeQuantities(p), SEED_PRICES, p, 'typical')
  const line = (p: HouseParams, key: string, section?: SectionId) =>
    est(p).lines.filter((l) => l.key === key && (section === undefined || l.section === section))

  it('НДС не начисляется второй раз на материалы, где он уже есть', () => {
    const p = house({ vatIncluded: true })
    const t = est(p).turnkey
    expect(t.vat).toBeCloseTo((t.works + t.contingency - t.material) * C.vatRate, 2)
  })

  it('стяжка, утепление пола и отмостка оплачивают свою работу', () => {
    // стяжка по полу без следа перегородок × 2 500, 74.8 м² XPS × 2 000,
    // 54 м² отмостки × 4 000
    const floor = 252.32 - planTake(house()).partitions * C.partitionThickness
    expect(line(house(), 'screed')[0].labor).toBeCloseTo(floor * 2500, 6)
    expect(line(house(), 'insulation_xps', 'floors')[0].labor).toBeCloseTo(74.8 * 2000, 0)
    expect(line(house(), 'apron')[0].labor).toBeCloseTo(54 * 4000, 0)
    // а бетон и кладка коробки — по-прежнему в ставке бригады
    expect(line(house(), 'aerated_block', 'walls')[0].labor).toBe(0)
  })

  it('перекрытия не получают надбавку арматуры за этажность', () => {
    // 52.3 м³ × 110 кг (перекрытия) + балки над залом, без × 1.07
    const one = qty(house(), 'rebar_a500', 'floors')
    const q = computeQuantities(house({ eng: { rebarFloorPct: 50 } }))
    const floors = q.lines.filter((l) => l.key === 'rebar_a500' && l.section === 'floors').reduce((a, l) => a + l.quantity, 0)
    expect(floors).toBeCloseTo(one, 9)
  })

  it('штукатурка — по внутреннему периметру и в чистоте', () => {
    // 51.6 × (6 − 2 × 0.18) − 42 + 2 × перегородки + потолки
    const take = planTake(house())
    const partitions = take.partitions * 2.82 - take.leafDoors * 0.9 * 2.1
    const ceilings = 252.32 - take.partitions * C.partitionThickness
    expect(qty(house(), 'plaster')).toBeCloseTo(51.6 * 5.64 - 42 + partitions * 2 + ceilings, 6)
  })

  it('плоская кровля получает парапет, крышку и леса до его верха', () => {
    expect(qty(house(), 'aerated_block', 'roof')).toBeCloseTo(54 * 0.6 * 0.3 * 1.05, 6)
    expect(qty(house(), 'parapet_coping')).toBe(54)
    expect(qty(house(), 'scaffolding')).toBeCloseTo(54 * 6.6 * C.scaffoldMonths, 6)
    expect(qty(house({ roof: 'pitched' }), 'parapet_coping')).toBe(0)
  })

  it('санузлы с плана получают сантехнику и плитку, окна — подоконники', () => {
    const take = planTake(house())
    expect(take.baths).toBe(3)
    expect(qty(house(), 'sanitary_set')).toBe(3)
    expect(qty(house(), 'wall_tile')).toBeCloseTo(take.bathPerimeter * 2.4 - 3 * 0.9 * 2.1, 6)
    // 30 м² обычных окон высотой 1.5 м
    expect(qty(house(), 'window_sills')).toBeCloseTo(20, 6)
    expect(qty(house(), 'stair_finish')).toBe(10)
  })

  it('энергосистема собирается из своих строк', () => {
    const p = house({ optHeatPump: true, optFanCoils: 4, optBatteryKwh: 10, optEvCharger: true, optSolarKw: 19 })
    expect(qty(p, 'opt_heat_pump')).toBe(1)
    expect(qty(p, 'dhw_cylinder')).toBe(1) // тепловому насосу нужен бойлер ГВС
    expect(qty(house(), 'dhw_cylinder')).toBe(0) // газовый котёл греет воду сам
    expect(qty(p, 'opt_fancoil')).toBe(4)
    expect(qty(p, 'opt_battery')).toBe(10)
    expect(qty(p, 'opt_ev_charger')).toBe(1)
    expect(qty(p, 'opt_solar')).toBe(19)
    expect(est(p).missing).toEqual([])
  })

  it('мусор и газ: по площади дома и только при подключении газа', () => {
    expect(qty(house(), 'waste_removal')).toBeCloseTo(252.32 * C.debrisPerM2, 6)
    expect(qty(house({ connectGas: false }), 'gas_internal')).toBe(0)
  })
})
