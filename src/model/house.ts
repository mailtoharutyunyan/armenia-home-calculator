import type { FRect, Footprint } from '../engine/footprint'

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
export type StoneType = 'tuff' | 'travertine' | 'basalt'
// Floor of the dry rooms; wet rooms and the kitchen stay tiled.
export type FloorType = 'laminate' | 'polyurethane' | 'metallic'
// Work the owner does himself: its labour leaves the estimate, materials stay.
export type DiyWork = 'electric' | 'plumbing' | 'plaster' | 'paint' | 'tile' | 'laminate' | 'kitchen'
export type Currency = 'AMD' | 'USD'
export type PriceMode = 'min' | 'typical' | 'max'
// Кто строит: сам хозяин (бригады напрямую) или генподрядчик по договору.
// It decides whether you pay overhead and contractor profit; VAT is a separate opt-in.
export type BuildMode = 'self' | 'contractor'

// Типовые проценты сметной развёртки. Хозспособ: подрядной прибыли и накладных
// нет, но временные и непредвиденные остаются — они реальны при любом способе.
// VAT is opt-in: neither preset switches it on, the "Prices incl. VAT 20%"
// checkbox does.
export const BUILD_PRESETS: Record<BuildMode, {
  overheadPct: number; profitPct: number; temporaryPct: number; contingencyPct: number; vatIncluded: boolean
}> = {
  self: { overheadPct: 0, profitPct: 0, temporaryPct: 1, contingencyPct: 10, vatIncluded: false },
  contractor: { overheadPct: 15, profitPct: 8, temporaryPct: 1.5, contingencyPct: 10, vatIncluded: false },
}

export type PlanLayout = 'template' | 'auto' | 'brick193' | 'brickFull'

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
  stoneFacadePct: number // доля фасада, облицованная камнем, % (0 = только штукатурка)
  stoneType: StoneType // какой камень
  floorType: FloorType // пол сухих комнат: ламинат или наливной полимерный
  diyWorks: DiyWork[] // работы своими руками — без оплаты работы
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
  // планировка: реальный проект Z500 Zx85, кирпичный дом 193.5 / 260 м² или генератор
  planLayout?: PlanLayout
  // Доля пятна, которую занимает верхний этаж (по длине дома, вдоль оси
  // length). 1 — полный этаж; меньше — «полуторный» дом: над остальной
  // частью первого этажа плоская кровля.
  topFloorShare?: number
  // A house that is not one rectangle: its ground and top floor outlines,
  // set by a project (see BRICK_FOOTPRINT); it stretches with length/width.
  footprint?: Footprint
  includePermitCost: boolean // включать стоимость документов/разрешения в смету
  roomsPerFloor: number // комнат на этаже (для проверки «помещается ли»)
  kitchenLivingCombined: boolean // зал и кухня вместе (студия) или раздельно
  laborPerM2: number // работа бригады на стадии «коробка», ֏/м² (default 14000)
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
  optHeating: boolean // тёплый пол вместо радиаторов (котёл и разводка остаются), ֏/м²
  optMvhr: boolean // вентиляция с рекуперацией тепла — доплата к базовой вентиляции, ֏/м²
  optHeatPump: boolean // тепловой насос воздух-вода (компл.) + бойлер косвенного нагрева
  optFanCoils: number // фанкойлы, шт (0 = нет)
  optBatteryKwh: number // аккумулятор LiFePO4, кВт·ч (0 = нет)
  optEvCharger: boolean // зарядка электромобиля (wallbox)
  optKitchenM: number // кухонная мебель, пог.м (0 = не входит)
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

// The Z500 Zx85 house the calculator opened with before the brick house
// became the default; the hand-counted regression tests are built on it.
export const ZX85_HOUSE: HouseParams = {
  system: 'frame', // ж/б каркас + газоблок-заполнение: тёплые стены, сейсмостойко (рекомендуется)
  infillMaterial: 'aerated', // стены — газоблок
  length: 13,
  width: 14,
  frontSide: 'width', // фасад 14 м
  plotArea: 512, // участок владельца
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
  stoneFacadePct: 0,
  stoneType: 'travertine',
  floorType: 'laminate',
  diyWorks: [],
  currency: 'AMD',
  region: 'yerevan',
  vatIncluded: false, // opt-in: prices are shown without VAT unless the checkbox is ticked
  concreteGrade: 'concrete_b25',
  rebarGrade: 'rebar_a500',
  excludedSections: [],
  floorSlab: 'monolith',
  seismicReinforcementDisabled: false,
  doubleHeightHall: true, // двусветный зал 6 м
  // Второй свет по реальному проекту Z500 Zx85: 7.2 × 7.2 м внутри стен.
  hallArea: 52,
  planLayout: 'template',
  topFloorShare: 1,
  includePermitCost: true,
  roomsPerFloor: 3, // студия (зал+кухня) + гостевой санузел + мастер-комната
  kitchenLivingCombined: true,
  // Monolithic frame brigades quote 10 000–14 000 ֏/m² of floor (list.am,
  // 12.10.2026) and block laying 4 000 ֏/m² of wall (NewHome): ~14 000 ֏/m²
  // for the whole shell.
  laborPerM2: 14000,
  beamsOverHall: true,
  // Подключения по умолчанию соответствуют региону по умолчанию (Ереван), где
  // центральная канализация есть. Для сёл и окраин снимите галочку
  // «Центральная канализация» — септик включится и попадёт в смету.
  connectElectricity: true,
  connectGas: true,
  connectWater: true,
  connectSewer: true,
  septic: false,
  // Self-build by default (BUILD_PRESETS.self): crews are hired directly, so
  // there is no contractor overhead or profit. "Main contractor" adds them.
  buildMode: 'self',
  overheadPct: 0,
  profitPct: 0,
  temporaryPct: 1,
  winterPct: 0, // включите, если бетонные работы попадают на зиму
  contingencyPct: 10,
  concretePump: true,
  fenceLength: 0,
  sitePavingArea: 0,
  balconyArea: 0,
  optHeating: false,
  optMvhr: false,
  optHeatPump: false,
  optFanCoils: 0,
  optBatteryKwh: 0,
  optEvCharger: false,
  optKitchenM: 0,
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

// Real projects the layout step offers. Picking one loads its house; every
// field stays editable afterwards.
//
// brick193: the modern brick house of https://www.youtube.com/watch?v=6kJcesg7oxo
// (Bishkek, 193.5 m² by its room schedule), taken off the drawings shown in it:
// axes 6.0 + 3.0 + 4.5 = 13.5 m by 5.0 + 3.0 = 8.0 m, the stair tower and the
// boiler room 1.0 m behind axis В, the living-kitchen's glazed bay 1.5 m in
// front of axis А, a 3.6 m wing on the left with a storeroom (4.7 m²) and an
// open terrace (8.8 m²); upstairs one band between axes А and Б plus the stair
// tower. An RC frame infilled with 240 mm brick, 250 mm walls, the upper floor
// at +3.400, 3.0 m ceilings upstairs, low hipped metal roofs (6.5–22°), the
// ground floor clad in light stone and the upper one in wood-look panels.
// brickFull: the same ground floor with the upper floor over all of it.
// Plan metres from the wing's outer wall (x) and the back wall (y), measured
// on the drawings against their axes (13 500 between axes 1 and 4): the wing
// is 3 600 between its axes plus half a 250 mm wall, the stair tower and the
// boiler room stand 1.085 m behind axis В, the bay 1.75 m in front of axis А.
// 17.35 × 10.835 m in all.
const BRICK_GROUND: FRect[] = [
  { x: 0, y: 0, w: 3.85, h: 1.775 }, // storeroom
  { x: 3.6, y: 0.96, w: 6.125, h: 9.875 }, // living-kitchen with its bay
  { x: 9.57, y: 0, w: 7.78, h: 9.21 }, // stair, hall, boiler room, shower, bedroom
]
export const BRICK_FOOTPRINT: Footprint = {
  L: 17.35,
  W: 10.835,
  ground: BRICK_GROUND,
  top: [
    { x: 3.6, y: 3.96, w: 13.75, h: 5.25 }, // rooms between axes А and Б
    { x: 9.57, y: 0, w: 3.4, h: 3.96 }, // stair tower, 250 + 2 900 + 250
  ],
}
export const BRICK_FULL_FOOTPRINT: Footprint = {
  ...BRICK_FOOTPRINT,
  // over the main body; the storeroom and the living-kitchen's bay keep a roof
  top: [
    { x: 3.6, y: 0.96, w: 6.125, h: 8.25 },
    { x: 9.57, y: 0, w: 7.78, h: 9.21 },
  ],
}

const BRICK_HOUSE: Partial<HouseParams> = {
  system: 'frame',
  infillMaterial: 'brick',
  length: BRICK_FOOTPRINT.L,
  width: BRICK_FOOTPRINT.W,
  frontSide: 'length',
  floors: 2,
  // storeys of 3.4 m (upper floor at +3.400) and 3.2 m (3.0 m ceiling + slab)
  floorHeight: 3.3,
  wallThickness: 0.25,
  topFloorShare: 1,
  roof: 'hip',
  roofPitchDeg: 10,
  doubleHeightHall: false,
  windowAuto: false,
  // ОК-1…ОК-8 at their drawn widths; heights off the facade render (glazing
  // 2.5 m downstairs, 2.3 m upstairs, the stair window 1.2 m on both floors)
  windowAreaTotal: 52.5,
  vitrageShare: 0.46, // ОК-1, ОК-2, ОК-3 run floor to ceiling
  exteriorDoors: 4, // ДН-1, two ДН-2, ДНО-2 to the terrace
  // the clad ground floor's share of the facade, in light stone as on the render
  stoneFacadePct: 58,
  stoneType: 'travertine',
  balconyArea: 8.8, // the open terrace of the room schedule
  kitchenLivingCombined: true,
}

export const PROJECT_PRESETS: Record<Exclude<PlanLayout, 'auto'>, Partial<HouseParams>> = {
  template: {
    system: ZX85_HOUSE.system,
    infillMaterial: ZX85_HOUSE.infillMaterial,
    length: ZX85_HOUSE.length,
    width: ZX85_HOUSE.width,
    frontSide: ZX85_HOUSE.frontSide,
    floors: ZX85_HOUSE.floors,
    floorHeight: ZX85_HOUSE.floorHeight,
    wallThickness: ZX85_HOUSE.wallThickness,
    topFloorShare: 1,
    footprint: undefined,
    roof: ZX85_HOUSE.roof,
    roofPitchDeg: ZX85_HOUSE.roofPitchDeg,
    doubleHeightHall: true,
    hallArea: ZX85_HOUSE.hallArea,
    windowAuto: false,
    windowAreaTotal: ZX85_HOUSE.windowAreaTotal,
    vitrageShare: ZX85_HOUSE.vitrageShare,
    exteriorDoors: ZX85_HOUSE.exteriorDoors,
    stoneFacadePct: ZX85_HOUSE.stoneFacadePct,
    stoneType: ZX85_HOUSE.stoneType,
    balconyArea: ZX85_HOUSE.balconyArea,
    kitchenLivingCombined: true,
  },
  brick193: { ...BRICK_HOUSE, footprint: BRICK_FOOTPRINT },
  // two more storey heights of windows over the living-kitchen and the boiler room
  brickFull: { ...BRICK_HOUSE, footprint: BRICK_FULL_FOOTPRINT, windowAreaTotal: 62.5 },
}

// Facade insulation each project specifies, cm (undefined: the catalogue's
// 100 mm). The brick house takes 150 mm of basalt wool (100–160 mm in the video).
const PROJECT_INSULATION: Record<Exclude<PlanLayout, 'auto'>, number | undefined> = {
  template: undefined,
  brick193: 15,
  brickFull: 15,
}

// Load a project into the house: its geometry and its insulation; the other
// engineer overrides, the region and the prices stay as the visitor set them.
export function applyProject(house: HouseParams, layout: PlanLayout): HouseParams {
  if (layout === 'auto') return { ...house, planLayout: 'auto' }
  const eng = { ...house.eng }
  delete eng.insulationThickness
  const insulation = PROJECT_INSULATION[layout]
  if (insulation != null) eng.insulationThickness = insulation
  return { ...house, ...PROJECT_PRESETS[layout], planLayout: layout, eng }
}

// The house the calculator opens with: the 193.5 m² brick house from the video,
// on the owner's 25 × 20 m plot.
export const DEFAULT_HOUSE: HouseParams = applyProject({ ...ZX85_HOUSE, plotArea: 500, eng: {} }, 'brick193')

// Share of the footprint the top storey covers, kept within what a plan can
// hold. One storey has no "top" to cut.
export function topShare(p: Pick<HouseParams, 'floors' | 'topFloorShare'>): number {
  if (p.floors < 2) return 1
  const s = p.topFloorShare ?? 1
  return Number.isFinite(s) ? Math.min(1, Math.max(0.3, s)) : 1
}
