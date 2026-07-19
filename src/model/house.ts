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
  plotArea: number // м², площадь земельного участка (для упрощённого порядка N 4.1)
  floors: number // above-ground floors
  floorHeight: number // m
  wallThickness: number // m
  foundation: FoundationType
  basement: boolean
  basementDepth: number // m
  roof: RoofType
  roofPitchDeg: number
  windowAreaTotal: number // m2
  windowAuto: boolean // площадь окон считается автоматически по норме освещения
  vitrageShare: number // 0..1
  exteriorDoors: number
  interiorDoors: number | null // null => auto estimate
  finishLevel: FinishLevel
  currency: Currency
  region: RegionKey
  vatIncluded: boolean
  // advanced
  concreteGrade: string // catalog key of the structural concrete grade
  rebarGrade: string // catalog key of the rebar grade
  excludedSections: string[] // разделы, исключённые из сметы (чекбоксы)
  floorSlab: 'monolith' | 'precast'
  seismicReinforcementDisabled: boolean // "без сейсмоусиления" toggle -> norm error
  doubleHeightHall: boolean // зал двойной высоты (проём в перекрытии 2-го этажа)
  hallArea: number // м², площадь зала двойной высоты
  includePermitCost: boolean // включать стоимость документов/разрешения в смету
  roomsPerFloor: number // комнат на этаже (для проверки «помещается ли»)
  kitchenLivingCombined: boolean // зал и кухня вместе (студия) или раздельно
  laborPerM2: number // работа бригады на стадии «коробка», ֏/м² (default 11000)
  beamsOverHall: boolean // балки над залом заложены
  // optional premium systems (opt-in extras)
  optHeating: boolean // отопление: котёл + тёплый пол (֏/м²)
  optHeatPump: boolean // тепловой насос воздух-вода (компл.)
  optSolarKw: number // солнечные панели, кВт (0 = нет)
  optFinishPremium: boolean // финишная отделка «под ключ» (֏/м²)
  optPanelCeiling: boolean // панельный (реечный) потолок (֏/м²)
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
  system: 'frame', // ж/б каркас + газоблок-заполнение (безопасно для сейсмики)
  infillMaterial: 'aerated',
  length: 13,
  width: 14,
  plotArea: 500,
  floors: 2,
  floorHeight: 3, // двусветный зал = 2 × 3 = 6 м
  wallThickness: 0.3,
  foundation: 'strip',
  basement: false,
  basementDepth: 2.4,
  roof: 'flat', // плоская крыша
  roofPitchDeg: 30,
  windowAreaTotal: 40, // панорамные окна студии
  windowAuto: false, // по умолчанию вручную; включается тумблером «Авто по норме»
  vitrageShare: 0.25,
  exteriorDoors: 2,
  interiorDoors: null,
  finishLevel: 'standard',
  currency: 'AMD',
  region: 'yerevan',
  vatIncluded: false,
  concreteGrade: 'concrete_b25',
  rebarGrade: 'rebar_a500',
  excludedSections: [],
  floorSlab: 'monolith',
  seismicReinforcementDisabled: false,
  doubleHeightHall: true, // двусветный зал 6 м
  hallArea: 80, // проём двусветного зала: 364 − 80 = 284 м² (≤ 300, порядок N 4.1)
  includePermitCost: true,
  roomsPerFloor: 3, // студия (зал+кухня) + гостевой санузел + мастер-комната
  kitchenLivingCombined: true,
  laborPerM2: 11000,
  beamsOverHall: true,
  optHeating: false,
  optHeatPump: false,
  optSolarKw: 0,
  optFinishPremium: false,
  optPanelCeiling: false,
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
