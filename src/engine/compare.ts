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
  caution: boolean // несущий газоблок: допустим по расчёту, но в сейсмозоне рискованнее
}

const SYSTEMS: ConstructionSystem[] = ['tuff', 'aerated', 'frame', 'brick']

export function compareSystems(
  base: HouseParams,
  catalog: Catalog,
  priceMode: PriceMode = 'typical',
): CompareRow[] {
  return SYSTEMS.map((system) => {
    // bearing aerated block is allowed (GOST 31360-2024) but needs seismic
    // verification — compute it honestly and flag it with a caution.
    const caution = system === 'aerated'
    const infillMaterial = system === 'frame' ? base.infillMaterial : (system as HouseParams['infillMaterial'])
    const variant: HouseParams = {
      ...base,
      system,
      infillMaterial: base.infillMaterial,
      wallThickness: defaultWallThickness({ system, infillMaterial }),
    }
    const q = computeQuantities(variant)
    const est = computeEstimate(q, catalog, variant, priceMode)
    return {
      system,
      actTotal: est.act.total,
      turnkeyTotal: est.turnkey.total,
      perM2: est.perM2,
      caution,
    }
  })
}
