// Core domain types for the house being estimated.

export type ConstructionSystem = 'frame' | 'tuff' | 'aerated' | 'brick'
// frame  = монолитный каркас + заполнение
// tuff   = несущий туф
// aerated= несущий газоблок
// brick  = несущий кирпич

export type InfillMaterial = 'tuff' | 'aerated' | 'brick'
export type FoundationType = 'strip' | 'slab' | 'pile' | 'column'
export type RoofType = 'flat' | 'pitched' | 'hip' | 'mansard'
export type FinishLevel = 'economy' | 'standard' | 'premium'
export type Currency = 'AMD' | 'USD'
export type PriceMode = 'min' | 'typical' | 'max'

export type RegionKey =
  | 'yerevan'
  | 'ararat_valley'
  | 'kotayk'
  | 'gyumri'
  | 'vanadzor'
  | 'sevan'
  | 'aparan'
  | 'syunik'
  | 'other'

export interface HouseParams {
  system: ConstructionSystem
  infillMaterial: InfillMaterial // used when system === 'frame'
  length: number // m, outer axis
  width: number // m, outer axis
  floors: number // above-ground floors
  floorHeight: number // m
  wallThickness: number // m
  foundation: FoundationType
  basement: boolean
  basementDepth: number // m
  roof: RoofType
  roofPitchDeg: number
  windowAreaTotal: number // m2
  vitrageShare: number // 0..1
  exteriorDoors: number
  interiorDoors: number | null // null => auto estimate
  finishLevel: FinishLevel
  currency: Currency
  region: RegionKey
  vatIncluded: boolean
  // advanced
  concreteGrade: string // catalog key of the structural concrete grade
  floorSlab: 'monolith' | 'precast'
  seismicReinforcementDisabled: boolean // "без сейсмоусиления" toggle -> norm error
  doubleHeightHall: boolean // зал двойной высоты (проём в перекрытии 2-го этажа)
  hallArea: number // м², площадь зала двойной высоты
  includePermitCost: boolean // включать стоимость документов/разрешения в смету
  roomsPerFloor: number // комнат на этаже (для проверки «помещается ли»)
  kitchenLivingCombined: boolean // зал и кухня вместе (студия) или раздельно
  eng: EngOverrides // "Расширенные параметры (для инженера)"
}

// Engineer overrides. When a field is undefined the engine uses its derived /
// default value. Linear dimensions are entered in the units shown to the user
// (cm / пог.м / %) and converted inside the engine.
export interface EngOverrides {
  stripLen?: number // лента, пог.м
  stripWidth?: number // лента ширина, см
  stripHeight?: number // лента высота, см
  floorOnGround?: number // пол по грунту, см
  blinding?: number // подбетонка, см
  slab?: number // перекрытие, см
  extWall?: number // стена наружная, см
  columns?: number // колонн, шт
  columnSize?: number // колонна, см
  beamsLen?: number // ригели, пог.м
  beamSection?: number // ригель сечение, м²
  openingsPct?: number // проёмы, %
  wastePct?: number // запас, %
  basementWall?: number // стена подвала, см
}

export const DEFAULT_HOUSE: HouseParams = {
  system: 'frame',
  infillMaterial: 'aerated',
  length: 12,
  width: 10,
  floors: 2,
  floorHeight: 3,
  wallThickness: 0.3,
  foundation: 'strip',
  basement: false,
  basementDepth: 2.4,
  roof: 'pitched',
  roofPitchDeg: 30,
  windowAreaTotal: 24,
  vitrageShare: 0.1,
  exteriorDoors: 2,
  interiorDoors: null,
  finishLevel: 'standard',
  currency: 'AMD',
  region: 'yerevan',
  vatIncluded: false,
  concreteGrade: 'concrete_b25',
  floorSlab: 'monolith',
  seismicReinforcementDisabled: false,
  doubleHeightHall: false,
  hallArea: 24,
  includePermitCost: true,
  roomsPerFloor: 4,
  kitchenLivingCombined: true,
  eng: {},
}

// Default wall thickness per system/material (m).
export function defaultWallThickness(p: {
  system: ConstructionSystem
  infillMaterial: InfillMaterial
}): number {
  const mat = p.system === 'frame' ? p.infillMaterial : p.system
  switch (mat) {
    case 'tuff':
      return 0.4
    case 'brick':
      return 0.38
    case 'aerated':
      return 0.3
    default:
      return 0.3
  }
}
