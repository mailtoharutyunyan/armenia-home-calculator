import { describe, it, expect } from 'vitest'
import { DEFAULT_HOUSE } from '../model/house'
import type { HouseParams } from '../model/house'
import { computeQuantities } from './quantities'
import { computeEstimate } from './pricing'
import { checkNorms, gradeFromKey } from './norms'
import { compareSystems } from './compare'
import { planToDxf } from './dxf'
import { buildPlan } from './plan'
import { SEED_PRICES } from '../data/prices'
import { stageWeeks, STAGES } from '../data/stages'

const house = (patch: Partial<HouseParams> = {}): HouseParams => ({ ...DEFAULT_HOUSE, ...patch })

describe('quantities', () => {
  it('computes sane geometry for a 10x10 2-floor house', () => {
    const q = computeQuantities(house({ length: 10, width: 10, floors: 2 }))
    expect(q.geometry.footprint).toBe(100)
    expect(q.geometry.totalFloorArea).toBe(200)
    expect(q.geometry.perimeter).toBe(40)
    expect(q.geometry.bearingLength).toBeCloseTo(60) // 1.5 * P
    expect(q.rebarKg).toBeGreaterThan(0)
  })

  it('produces structural concrete and rebar lines', () => {
    const q = computeQuantities(house())
    const concrete = q.lines.find((l) => l.key === DEFAULT_HOUSE.concreteGrade)
    const rebar = q.lines.find((l) => l.key === 'rebar_a500')
    expect(concrete && concrete.quantity).toBeGreaterThan(0)
    expect(rebar && rebar.quantity).toBeGreaterThan(0)
  })

  it('slab foundation footprint matches area', () => {
    const q = computeQuantities(house({ foundation: 'slab', length: 8, width: 12 }))
    expect(q.geometry.footprint).toBe(96)
  })

  it('aerated masonry uses glue not mortar', () => {
    const q = computeQuantities(house({ system: 'aerated' }))
    expect(q.lines.some((l) => l.key === 'glue_aerated')).toBe(true)
    expect(q.lines.some((l) => l.key === 'mortar')).toBe(false)
  })

  it('adds a stair only for multi-storey', () => {
    expect(computeQuantities(house({ floors: 1 })).lines.some((l) => l.section === 'stair')).toBe(false)
    expect(computeQuantities(house({ floors: 3 })).lines.some((l) => l.section === 'stair')).toBe(true)
  })
})

describe('pricing', () => {
  it('turnkey >= act and per m2 > 0', () => {
    const q = computeQuantities(house())
    const est = computeEstimate(q, SEED_PRICES, house(), 'typical')
    expect(est.turnkey.total).toBeGreaterThan(est.act.total)
    expect(est.perM2).toBeGreaterThan(0)
  })

  it('range low <= typical <= high', () => {
    const q = computeQuantities(house())
    const low = computeEstimate(q, SEED_PRICES, house(), 'min').turnkey.total
    const typ = computeEstimate(q, SEED_PRICES, house(), 'typical').turnkey.total
    const high = computeEstimate(q, SEED_PRICES, house(), 'max').turnkey.total
    expect(low).toBeLessThanOrEqual(typ)
    expect(typ).toBeLessThanOrEqual(high)
  })

  it('premium finish costs more than economy', () => {
    const q = computeQuantities(house())
    const eco = computeEstimate(q, SEED_PRICES, house({ finishLevel: 'economy' }), 'typical').turnkey.total
    const prem = computeEstimate(q, SEED_PRICES, house({ finishLevel: 'premium' }), 'typical').turnkey.total
    expect(prem).toBeGreaterThan(eco)
  })

  it('VAT increases the total', () => {
    const q = computeQuantities(house())
    const noVat = computeEstimate(q, SEED_PRICES, house({ vatIncluded: false }), 'typical').turnkey.total
    const vat = computeEstimate(q, SEED_PRICES, house({ vatIncluded: true }), 'typical').turnkey.total
    expect(vat).toBeGreaterThan(noVat)
  })

  it('no missing catalog keys with seed prices', () => {
    const q = computeQuantities(house())
    const est = computeEstimate(q, SEED_PRICES, house(), 'typical')
    expect(est.missing).toEqual([])
  })
})

describe('norms', () => {
  it('grade parser', () => {
    expect(gradeFromKey('concrete_b25')).toBe(25)
    expect(gradeFromKey('concrete_b225')).toBe(22.5)
    expect(gradeFromKey('concrete_b15')).toBe(15)
  })

  it('flags bearing aerated block as error', () => {
    const q = computeQuantities(house({ system: 'aerated' }))
    const w = checkNorms(house({ system: 'aerated' }), q)
    expect(w.some((x) => x.level === 'error' && x.code === 'ՀՀՇՆ II-6.02')).toBe(true)
  })

  it('flags concrete below B25 in seismic zone', () => {
    const p = house({ concreteGrade: 'concrete_b15' })
    const w = checkNorms(p, computeQuantities(p))
    expect(w.some((x) => x.level === 'error' && x.ru.includes('B25'))).toBe(true)
  })

  it('flags masonry above allowed storeys', () => {
    const p = house({ system: 'tuff', floors: 5, region: 'gyumri' })
    const w = checkNorms(p, computeQuantities(p))
    expect(w.some((x) => x.level === 'error')).toBe(true)
  })

  it('input validation errors on zero dimensions', () => {
    const p = house({ length: 0, floors: 0 })
    const w = checkNorms(p, computeQuantities(p))
    expect(w.filter((x) => x.code === 'input').length).toBeGreaterThan(0)
  })

  it('flags "rooms do not fit" when too many rooms on a small floor', () => {
    const p = house({ length: 6, width: 5, roomsPerFloor: 12 })
    const w = checkNorms(p, computeQuantities(p))
    expect(w.some((x) => x.level === 'error' && x.ru.includes('не помещаются'))).toBe(true)
  })
})

describe('permit & hall', () => {
  it('includes permit lines when enabled and excludes when off', () => {
    expect(computeQuantities(house({ includePermitCost: true })).lines.some((l) => l.section === 'permit')).toBe(true)
    expect(computeQuantities(house({ includePermitCost: false })).lines.some((l) => l.section === 'permit')).toBe(false)
  })

  it('double-height hall reduces floor finish area', () => {
    const base = computeQuantities(house({ floors: 2, doubleHeightHall: false }))
    const hall = computeQuantities(house({ floors: 2, doubleHeightHall: true, hallArea: 30 }))
    const ff = (q: typeof base) => q.lines.find((l) => l.key === 'floor_finish')!.quantity
    expect(ff(hall)).toBeLessThan(ff(base))
  })

  it('excluding a section lowers the turnkey total', () => {
    const q = computeQuantities(house())
    const full = computeEstimate(q, SEED_PRICES, house({ excludedSections: [] }), 'typical').turnkey.total
    const noFacade = computeEstimate(q, SEED_PRICES, house({ excludedSections: ['facade'] }), 'typical').turnkey.total
    expect(noFacade).toBeLessThan(full)
  })

  it('rebar grade drives the rebar catalog key', () => {
    const a400 = computeQuantities(house({ rebarGrade: 'rebar_a400' }))
    expect(a400.lines.some((l) => l.key === 'rebar_a400')).toBe(true)
    expect(a400.lines.some((l) => l.key === 'rebar_a500')).toBe(false)
  })

  it('builders labour rate scales the estimate', () => {
    const q = computeQuantities(house())
    const low = computeEstimate(q, SEED_PRICES, house({ laborPerM2: 5000 }), 'typical').act.total
    const high = computeEstimate(q, SEED_PRICES, house({ laborPerM2: 20000 }), 'typical').act.total
    expect(high).toBeGreaterThan(low)
  })

  it('Kotayk region exists with seismic rating', async () => {
    const { REGIONS } = await import('../data/regions')
    expect(REGIONS.kotayk).toBeTruthy()
    expect(REGIONS.kotayk.seismic).toBeGreaterThanOrEqual(8)
  })
})

describe('compare', () => {
  it('returns 4 systems, aerated banned', () => {
    const rows = compareSystems(house(), SEED_PRICES, 'typical')
    expect(rows).toHaveLength(4)
    const aerated = rows.find((r) => r.system === 'aerated')!
    expect(aerated.banned).toBe(true)
    expect(rows.every((r) => r.turnkeyTotal > 0)).toBe(true)
  })
})

describe('dxf', () => {
  it('emits valid DXF with expected layers', () => {
    const dxf = planToDxf(buildPlan(house()))
    expect(dxf.startsWith('0\nSECTION')).toBe(true)
    expect(dxf.trimEnd().endsWith('EOF')).toBe(true)
    for (const layer of ['FOUNDATION', 'WALLS', 'OPENINGS', 'DIMENSIONS']) {
      expect(dxf).toContain(layer)
    }
  })
})

describe('stages', () => {
  it('weeks scale with area and are ordered', () => {
    const small = stageWeeks(STAGES[1], 100)
    const big = stageWeeks(STAGES[1], 400)
    expect(big.max).toBeGreaterThanOrEqual(small.max)
    expect(small.min).toBeLessThanOrEqual(small.max)
  })
})
