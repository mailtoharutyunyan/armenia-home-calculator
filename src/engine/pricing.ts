import type { Catalog } from '../model/catalog'
import { materialPrice } from '../model/catalog'
import type { HouseParams, PriceMode } from '../model/house'
import { COEFF as C } from '../data/coefficients'
import { REGIONS } from '../data/regions'
import type { Quantities, SectionId, Stage } from './quantities'

const FINISH_SECTIONS = new Set<SectionId>(['finishing', 'facade', 'openings', 'partitions'])

export interface EstimateLine {
  key: string
  labelRu: string
  labelHy: string
  section: SectionId
  stage: Stage
  unit: string
  quantity: number
  material: number
  labor: number
  total: number
}

export interface Totals {
  material: number
  labor: number
  base: number
  reserve: number
  vat: number
  total: number
}

export interface Estimate {
  lines: EstimateLine[]
  sectionTotals: Record<string, number>
  act: Totals
  turnkey: Totals
  perM2: number
  rangeLow: number // turnkey total at min supplier prices
  rangeHigh: number // turnkey total at max supplier prices
  missing: string[]
}

interface ModeResult {
  lines: EstimateLine[]
  act: Totals
  turnkey: Totals
  sectionTotals: Record<string, number>
  missing: string[]
}

// permitAmt = fixed state fees (документы): no contingency reserve, no VAT.
function finalize(material: number, labor: number, permitAmt: number, p: HouseParams): Totals {
  const base = material + labor
  const taxable = Math.max(0, base - permitAmt)
  const reserve = taxable * C.contingency
  const withReserve = base + reserve
  const vat = p.vatIncluded ? taxable * (1 + C.contingency) * C.vatRate : 0
  return { material, labor, base, reserve, vat, total: withReserve + vat }
}

function priceAtMode(q: Quantities, catalog: Catalog, p: HouseParams, mode: PriceMode): ModeResult {
  const region = REGIONS[p.region]
  const finishMult = C.finishMultiplier[p.finishLevel]
  const lines: EstimateLine[] = []
  const sectionTotals: Record<string, number> = {}
  const missing: string[] = []

  let actMat = 0
  let actLabor = 0
  let extraMat = 0
  let extraLabor = 0
  let permitAmt = 0

  for (const ql of q.lines) {
    const item = catalog[ql.key]
    if (!item) {
      if (!missing.includes(ql.key)) missing.push(ql.key)
      continue
    }
    const isPermit = ql.section === 'permit'
    const mult = FINISH_SECTIONS.has(ql.section) ? finishMult : 1
    // state fees (permit) are fixed — no delivery surcharge
    const delivery = isPermit ? 0 : region.deliverySurcharge
    const unitMat = materialPrice(item, mode) * (1 + delivery)
    const material = ql.quantity * unitMat * mult
    const labor = ql.quantity * item.labor * mult
    const total = material + labor
    if (isPermit) permitAmt += total

    lines.push({
      key: ql.key,
      labelRu: item.labelRu,
      labelHy: item.labelHy,
      section: ql.section,
      stage: ql.stage,
      unit: item.unit,
      quantity: ql.quantity,
      material,
      labor,
      total,
    })
    sectionTotals[ql.section] = (sectionTotals[ql.section] ?? 0) + total

    if (ql.stage === 'act') {
      actMat += material
      actLabor += labor
    } else {
      extraMat += material
      extraLabor += labor
    }
  }

  return {
    lines,
    act: finalize(actMat, actLabor, permitAmt, p),
    turnkey: finalize(actMat + extraMat, actLabor + extraLabor, permitAmt, p),
    sectionTotals,
    missing,
  }
}

export function computeEstimate(
  q: Quantities,
  catalog: Catalog,
  p: HouseParams,
  priceMode: PriceMode = 'typical',
): Estimate {
  const selected = priceAtMode(q, catalog, p, priceMode)
  const low = priceAtMode(q, catalog, p, 'min')
  const high = priceAtMode(q, catalog, p, 'max')

  const perM2 =
    q.geometry.totalFloorArea > 0 ? selected.turnkey.total / q.geometry.totalFloorArea : 0

  return {
    lines: selected.lines,
    sectionTotals: selected.sectionTotals,
    act: selected.act,
    turnkey: selected.turnkey,
    perM2,
    rangeLow: low.turnkey.total,
    rangeHigh: high.turnkey.total,
    missing: selected.missing,
  }
}
