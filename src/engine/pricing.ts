import type { Catalog } from '../model/catalog'
import { materialPrice } from '../model/catalog'
import type { HouseParams, PriceMode } from '../model/house'
import { COEFF as C } from '../data/coefficients'
import { REGIONS } from '../data/regions'
import type { Quantities, SectionId, Stage } from './quantities'

const FINISH_SECTIONS = new Set<SectionId>(['finishing', 'facade', 'openings', 'partitions'])
// shell sections whose labour is covered by the builders' brigade rate (֏/m²)
const BRIGADE_SECTIONS = new Set<SectionId>(['foundation', 'walls', 'frame', 'floors'])

export interface EstimateLine {
  key: string
  labelRu: string
  labelHy: string
  labelEn?: string
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
  perM2: number // под ключ, ֏/м²
  perM2Act: number // коробка (акт), ֏/м²
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
    if (p.excludedSections.includes(ql.section)) continue // раздел отключён чекбоксом
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
    // shell labour (foundation/walls/frame/floors) is covered by the brigade rate
    // (added below); earthworks/roof/stair and all turnkey work keep per-item labour.
    const labor = BRIGADE_SECTIONS.has(ql.section) ? 0 : ql.quantity * item.labor * mult
    const total = material + labor
    if (isPermit) permitAmt += total

    lines.push({
      key: ql.key,
      labelRu: item.labelRu,
      labelHy: item.labelHy,
      labelEn: item.labelEn,
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

  // builders' brigade labour for the shell (act), by editable ֏/m² rate;
  // scaled by floor height (taller walls/formwork = more work, base 3 m) and by a
  // system factor (full monolith is formwork-intensive → +25%).
  const heightFactor = p.floorHeight > 0 ? p.floorHeight / 3 : 1
  const sysFactor = p.system === 'monolith' ? C.monolithLabourFactor : 1
  const brigade = p.excludedSections.includes('walls')
    ? 0
    : Math.max(0, p.laborPerM2) * q.geometry.totalFloorArea * heightFactor * sysFactor
  if (brigade > 0) {
    lines.push({
      key: 'brigade',
      labelRu: 'Работа строителей (коробка)',
      labelHy: 'Բրիգադի աշխատանք (կմախք)',
      labelEn: 'Builders’ labour (shell)',
      section: 'walls',
      stage: 'act',
      unit: 'м²',
      quantity: q.geometry.totalFloorArea,
      material: 0,
      labor: brigade,
      total: brigade,
    })
    sectionTotals['walls'] = (sectionTotals['walls'] ?? 0) + brigade
    actLabor += brigade
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

  const area = q.geometry.netFloorArea
  const perM2 = area > 0 ? selected.turnkey.total / area : 0
  const perM2Act = area > 0 ? selected.act.total / area : 0

  return {
    lines: selected.lines,
    sectionTotals: selected.sectionTotals,
    act: selected.act,
    turnkey: selected.turnkey,
    perM2,
    perM2Act,
    rangeLow: low.turnkey.total,
    rangeHigh: high.turnkey.total,
    missing: selected.missing,
  }
}
