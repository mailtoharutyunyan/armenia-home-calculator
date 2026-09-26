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

// Сметная развёртка подрядчика.
//
// Прямые затраты (материалы + работа) — это ещё не цена стройки. Подрядчик
// считает поверх них накладные, прибыль, временные здания, зимнее удорожание,
// непредвиденные и НДС. Раньше калькулятор показывал только прямые затраты и
// потому систематически занижал бюджет примерно в полтора раза.
export interface Totals {
  material: number // материалы (без документов)
  labor: number // работа (без документов)
  direct: number // прямые затраты = материалы + работа
  overhead: number // накладные расходы, % от ФОТ
  profit: number // сметная прибыль, % от прямых затрат
  temporary: number // временные здания и сооружения
  winter: number // зимнее удорожание
  works: number // СМР = прямые + накладные + прибыль + временные + зимнее
  contingency: number // непредвиденные, % от СМР
  permit: number // документы и пошлины — вне СМР, без наценок и НДС
  vat: number
  total: number // договорная цена
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

// material/labor приходят уже без документов; permitAmt — госпошлины и проект.
// Документы не попадают ни под накладные, ни под прибыль, ни под НДС: это
// фиксированные платежи, подрядчик на них не зарабатывает.
function finalize(material: number, labor: number, permitAmt: number, p: HouseParams): Totals {
  const pc = (v: number) => Math.max(0, v) / 100
  const direct = material + labor

  // Накладные считаются от фонда оплаты труда — так их считает подрядчик.
  const overhead = labor * pc(p.overheadPct)
  const profit = direct * pc(p.profitPct)
  const temporary = direct * pc(p.temporaryPct)
  const winter = direct * pc(p.winterPct)
  const works = direct + overhead + profit + temporary + winter

  const contingency = works * pc(p.contingencyPct)
  const taxable = works + contingency
  const vat = p.vatIncluded ? taxable * C.vatRate : 0

  return {
    material,
    labor,
    direct,
    overhead,
    profit,
    temporary,
    winter,
    works,
    contingency,
    permit: permitAmt,
    vat,
    total: taxable + permitAmt + vat,
  }
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

    // Документы копим отдельно (permitAmt): на них не начисляются накладные,
    // прибыль и НДС, поэтому в прямые затраты они попадать не должны.
    if (isPermit) continue
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
  // The rate is the only labour on shell sections, so a basement (its walls,
  // floor and the slab over it) has to be in the area, or it is built for free.
  const shellArea = q.geometry.totalFloorArea + (p.basement ? q.geometry.footprint : 0)
  const brigade = p.excludedSections.includes('walls')
    ? 0
    : Math.max(0, p.laborPerM2) * shellArea * heightFactor * sysFactor
  if (brigade > 0) {
    lines.push({
      key: 'brigade',
      labelRu: 'Работа строителей (коробка)',
      labelHy: 'Բրիգադի աշխատանք (կմախք)',
      labelEn: 'Builders’ labour (shell)',
      section: 'walls',
      stage: 'act',
      unit: 'м²',
      quantity: shellArea,
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
