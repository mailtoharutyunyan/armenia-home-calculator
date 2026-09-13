// Core domain types for the house being estimated.

export type ConstructionSystem = 'frame' | 'monolith' | 'tuff' | 'aerated' | 'brick'
// frame   = монолитный каркас + заполнение
// monolith= полный монолит (несущие ж/б стены + перекрытия) — макс. сейсмостойкость
// tuff    = несущий туф
// aerated = несущий газоблок
// brick   = несущий кирпич

export type InfillMaterial = 'tuff' | 'aerated' | 'brick'
export type FoundationType = 'strip' | 'slab' | 'pile' | 'column'
export type RoofType = 'flat' | 'pitched' | 'hip' | 'mansard'
export type FinishLevel = 'economy' | 'standard' | 'premium'
export type Currency = 'AMD' | 'USD'
export type PriceMode = 'min' | 'typical' | 'max'
// Кто строит: сам хозяин (бригады напрямую) или генподрядчик по договору.
// От этого зависит, платите ли вы накладные, прибыль подрядчика и НДС.
export type BuildMode = 'self' | 'contractor'

// Типовые проценты сметной развёртки. Хозспособ: подрядной прибыли и накладных
// нет, но временные и непредвиденные остаются — они реальны при любом способе.
export const BUILD_PRESETS: Record<BuildMode, {
  overheadPct: number; profitPct: number; temporaryPct: number; contingencyPct: number; vatIncluded: boolean
}> = {
  self: { overheadPct: 0, profitPct: 0, temporaryPct: 1, contingencyPct: 10, vatIncluded: false },
  contractor: { overheadPct: 15, profitPct: 8, temporaryPct: 1.5, contingencyPct: 10, vatIncluded: true },
}

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
  // Какая сторона выходит на улицу. Главный фасад рисуется внизу листа,
  // входная дверь ставится в него.
  frontSide: 'length' | 'width'
  plotArea: number // м², площадь земельного участка (для упрощённого порядка N 4.1)
  auxBuildingArea: number // м², вспомогательные постройки (гараж, хоз. блок) — критерий N 4.1 ≤ 50 м²
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
  // Подключение к сетям — отдельные платежи сетевым организациям (ТУ + врезка),
  // не входят в стоимость внутренних сетей дома.
  connectElectricity: boolean
  connectGas: boolean
  connectWater: boolean
  connectSewer: boolean // центральная канализация
  septic: boolean // локальное очистное, когда центральной канализации нет
  // --- Сметная развёртка ---
  // Прямые затраты — это ещё не цена стройки. Поверх них идут накладные,
  // прибыль подрядчика, временные здания, зима и непредвиденные.
  buildMode: BuildMode
  overheadPct: number // накладные расходы, % от фонда оплаты труда
  profitPct: number // сметная прибыль, % от прямых затрат
  temporaryPct: number // временные здания и сооружения, % от прямых затрат
  winterPct: number // зимнее удорожание, % от прямых затрат
  contingencyPct: number // непредвиденные, % от СМР
  // Бетон подаётся насосом (иначе — вручную/краном; для монолита обычно насос)
  concretePump: boolean
  // Благоустройство участка и балконы
  fenceLength: number // пог.м забора (0 = нет)
  sitePavingArea: number // м² дорожек и площадок
  balconyArea: number // м² балконов/террас
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
  // --- Фундамент ---
  stripLen?: number // лента, пог.м
  stripWidth?: number // лента ширина, см
  stripHeight?: number // лента высота, см
  slabThickness?: number // плита фундамента, см
  pileDiameter?: number // свая, диаметр, см
  pileLength?: number // свая, длина, м
  foundationAxisStep?: number // шаг свай/столбов, м
  columnFoundationHeight?: number // столбчатый фундамент, высота, м
  floorOnGround?: number // пол по грунту, см
  blinding?: number // подбетонка, см
  basementWall?: number // стена подвала, см
  basementWorkingWidth?: number // рабочая зона у стен подвала, см
  sandBed?: number // подсыпка под подошву, см
  apronWidth?: number // отмостка, м
  backfillPct?: number // обратная засыпка, % от объёма выемки

  // --- Каркас и стены ---
  extWall?: number // стена наружная, см
  columns?: number // колонн, шт
  columnSize?: number // колонна, см
  columnGridStep?: number // шаг колонн, м
  beamsLen?: number // ригели, пог.м
  beamSection?: number // ригель сечение, м²
  internalBearingPct?: number // внутренние несущие оси, % от периметра
  ringBeamW?: number // армопояс, ширина, см
  ringBeamH?: number // армопояс, высота, см
  seismicCoreSize?: number // сейсмосердечник, сторона, см
  seismicCoreStep?: number // шаг сейсмосердечников, м
  lintelW?: number // перемычка, ширина, см
  lintelH?: number // перемычка, высота, см
  partitionThickness?: number // перегородка, см
  mortarSharePct?: number // раствор, % от объёма кладки
  glueSharePct?: number // клей для газоблока, % от объёма кладки

  // --- Перекрытия и лестница ---
  slab?: number // перекрытие, см
  precastSlabArea?: number // площадь одной плиты ПК, м²
  stairVolume?: number // лестница, м³ на марш

  // --- Армирование, кг/м³ (результат расчёта, а не константа) ---
  rebarStrip?: number
  rebarSlab?: number
  rebarPile?: number
  rebarColumn?: number
  rebarFloor?: number
  rebarRingBeam?: number
  rebarSeismicCore?: number
  rebarLintel?: number
  rebarBasementWall?: number
  rebarMonolithWall?: number
  rebarFloorPct?: number // прирост армирования на каждый этаж выше первого, %

  // --- Класс бетона по элементам (пусто => общий класс из основной формы) ---
  concreteFoundation?: string
  concreteFrame?: string
  concreteFloors?: string

  // --- Прочее ---
  openingsPct?: number // проёмы, %
  wastePct?: number // запас, %
  formworkPerM3?: number // опалубка, м² контакта на 1 м³ бетона
  insulationThickness?: number // утеплитель, см (базовая цена дана за 100 мм)
}

export const DEFAULT_HOUSE: HouseParams = {
  system: 'frame', // ж/б каркас + газоблок-заполнение: тёплые стены, сейсмостойко (рекомендуется)
  infillMaterial: 'aerated', // стены — газоблок
  length: 13,
  width: 14,
  frontSide: 'width', // фасад 14 м
  plotArea: 500,
  auxBuildingArea: 0,
  floors: 2,
  floorHeight: 3, // двусветный зал = 2 × 3 = 6 м
  wallThickness: 0.3, // газоблок-заполнение
  foundation: 'strip',
  basement: false,
  basementDepth: 2.4,
  roof: 'flat', // плоская крыша
  roofPitchDeg: 30,
  windowAreaTotal: 40, // панорамные окна студии
  windowAuto: false, // по умолчанию вручную; включается тумблером «Авто по норме»
  vitrageShare: 0.25,
  exteriorDoors: 1,
  interiorDoors: null,
  finishLevel: 'standard',
  currency: 'AMD',
  region: 'yerevan',
  vatIncluded: true,
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
  // Подключения по умолчанию соответствуют региону по умолчанию (Ереван), где
  // центральная канализация есть. Для сёл и окраин снимите галочку
  // «Центральная канализация» — септик включится и попадёт в смету.
  connectElectricity: true,
  connectGas: true,
  connectWater: true,
  connectSewer: true,
  septic: false,
  // По умолчанию — генподрядчик: так считает большинство и так цифра честнее.
  buildMode: 'contractor',
  overheadPct: 15,
  profitPct: 8,
  temporaryPct: 1.5,
  winterPct: 0, // включите, если бетонные работы попадают на зиму
  contingencyPct: 10,
  concretePump: true,
  fenceLength: 0,
  sitePavingArea: 0,
  balconyArea: 0,
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
    case 'monolith':
      return 0.2 // несущая монолитная ж/б стена (ՀՀՇՆ II-6.02)
    default:
      return 0.3
  }
}
