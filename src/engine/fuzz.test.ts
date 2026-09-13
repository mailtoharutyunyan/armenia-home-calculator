import { it, expect } from 'vitest'
import { DEFAULT_HOUSE } from '../model/house'
import type { HouseParams } from '../model/house'
import { computeQuantities } from './quantities'
import { computeEstimate } from './pricing'
import { buildFloorPlan } from './floorplan'
import { checkNorms } from './norms'
import { auditPlan } from './planAudit'
import { SEED_PRICES } from '../data/prices'

const cases: [string, Partial<HouseParams>][] = [
  ['нулевые габариты', { length: 0, width: 0 }],
  ['отрицательные', { length: -5, width: -5 }],
  ['1 этаж', { floors: 1, doubleHeightHall: false }],
  ['0 этажей', { floors: 0 }],
  ['10 этажей', { floors: 10 }],
  ['крошечный 3x3', { length: 3, width: 3, hallArea: 4 }],
  ['огромный 60x60', { length: 60, width: 60, hallArea: 500 }],
  ['зал больше дома', { hallArea: 9999 }],
  ['зал = 0', { hallArea: 0 }],
  ['высота 0', { floorHeight: 0 }],
  ['высота 10', { floorHeight: 10 }],
  ['окна 0', { windowAreaTotal: 0 }],
  ['окна огромные', { windowAreaTotal: 99999 }],
  ['комнат 0', { roomsPerFloor: 0 }],
  ['комнат 50', { roomsPerFloor: 50 }],
  ['всё исключено', { excludedSections: ['earthworks','foundation','walls','frame','floors','stair','roof','openings','partitions','finishing','facade','engineering','utilities','site','options','permit'] }],
  ['доллары', { currency: 'USD' as const }],
  ['подвал 10м', { basement: true, basementDepth: 10 }],
  ['все опции', { optHeating: true, optHeatPump: true, optSolarKw: 20, optFinishPremium: true, optPanelCeiling: true }],
  ['проценты огромные', { overheadPct: 500, profitPct: 500, contingencyPct: 500 }],
  ['проценты отрицательные', { overheadPct: -50, profitPct: -50, contingencyPct: -50 }],
  ['eng мусор', { eng: { slabThickness: -5, pileDiameter: 0, rebarFloor: -100, columnGridStep: 0 } }],
]

const bad = (n: number) => !Number.isFinite(n) || n < 0

// Фаззинг граничных значений.
//
// Нашёл реальные баги: при доме меньше, чем нужно двусветному залу с кухней,
// вычитание глубины кухни уходило в минус, и зал получал отрицательные
// размеры, которые расползались по всему плану. Отрицательные габариты дома
// давали отрицательный периметр. Здесь это зафиксировано навсегда.
it('ни одна конфигурация не даёт NaN, Infinity или отрицательных величин', () => {
  const issues: string[] = []
  for (const [name, patch] of cases) {
    const p: HouseParams = { ...DEFAULT_HOUSE, ...patch }
    try {
      const q = computeQuantities(p)
      for (const l of q.lines) {
        if (bad(l.quantity)) issues.push(`${name}: количество ${l.key}=${l.quantity}`)
      }
      if (bad(q.rebarKg)) issues.push(`${name}: арматура=${q.rebarKg}`)
      for (const [k, v] of Object.entries(q.geometry)) if (bad(v as number)) issues.push(`${name}: geometry.${k}=${v}`)

      const e = computeEstimate(q, SEED_PRICES, p, 'typical')
      for (const [k, v] of Object.entries(e.turnkey)) if (bad(v as number)) issues.push(`${name}: turnkey.${k}=${v}`)
      if (bad(e.perM2)) issues.push(`${name}: perM2=${e.perM2}`)
      if (e.missing.length) issues.push(`${name}: нет цены для ${e.missing.join(',')}`)

      for (let f = 0; f < Math.max(1, Math.min(p.floors, 3)); f++) {
        const pl = buildFloorPlan(p, f)
        for (const r of pl.rooms) {
          if (bad(r.w) || bad(r.h) || bad(r.x) || bad(r.y)) issues.push(`${name}: комната ${r.label} ${r.x},${r.y} ${r.w}x${r.h}`)
        }
      }
      checkNorms(p, q)
      auditPlan(p)
    } catch (err) {
      issues.push(`${name}: ИСКЛЮЧЕНИЕ ${(err as Error).message}`)
    }
  }
  expect(issues, `конфигураций: ${cases.length}`).toEqual([])
})
