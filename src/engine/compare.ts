import type { Catalog } from '../model/catalog'
import type { ConstructionSystem, HouseParams, PriceMode } from '../model/house'
import { defaultWallThickness } from '../model/house'
import { computeQuantities } from './quantities'
import { computeEstimate } from './pricing'

export interface CompareRow {
  system: ConstructionSystem
  actTotal: number
  turnkeyTotal: number
  perM2: number
  banned: boolean // не допускается как несущий в РА (сейсмика)
}

const SYSTEMS: ConstructionSystem[] = ['tuff', 'aerated', 'frame', 'brick']

export function compareSystems(
  base: HouseParams,
  catalog: Catalog,
  priceMode: PriceMode = 'typical',
): CompareRow[] {
  return SYSTEMS.map((system) => {
    const banned = system === 'aerated' // несущий газоблок запрещён
    // для запрещённого варианта считаем корректную схему: каркас + газоблок-заполнение
    const effectiveSystem: ConstructionSystem = banned ? 'frame' : system
    const infillMaterial = banned ? 'aerated' : base.infillMaterial
    const variant: HouseParams = {
      ...base,
      system: effectiveSystem,
      infillMaterial,
      wallThickness: defaultWallThickness({ system: effectiveSystem, infillMaterial }),
    }
    const q = computeQuantities(variant)
    const est = computeEstimate(q, catalog, variant, priceMode)
    return {
      system,
      actTotal: est.act.total,
      turnkeyTotal: est.turnkey.total,
      perM2: est.perM2,
      banned,
    }
  })
}
