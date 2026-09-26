import type { HouseParams, InfillMaterial } from '../model/house'
import { COEFF as C } from '../data/coefficients'
import { REGIONS } from '../data/regions'

export type Stage = 'act' | 'turnkey'

export type SectionId =
  | 'earthworks'
  | 'foundation'
  | 'walls'
  | 'frame'
  | 'floors'
  | 'stair'
  | 'roof'
  | 'openings'
  | 'partitions'
  | 'finishing'
  | 'facade'
  | 'engineering'
  | 'utilities'
  | 'site'
  | 'options'
  | 'permit'

export interface QuantityLine {
  key: string // catalog key
  section: SectionId
  stage: Stage
  quantity: number
}

export interface Geometry {
  footprint: number // A
  perimeter: number // P
  bearingLength: number // L_нес
  wallHeight: number // H
  totalFloorArea: number // A_общ по внешнему габариту (для объёмов материалов)
  finishedFloorArea: number // A_общ − проём зала: реальный пол, база для работ «на м² пола»
  netFloorArea: number // нормативная общая площадь: внутр. поверхности − проём зала (ՀՀՇՆ 31-01-2014, Прил.2 п.4)
  internalPerFloor: number // площадь одного этажа по внутренним поверхностям наружных стен
  hallVoid: number // площадь двусветного проёма
  wallGross: number
  openingsArea: number
  wallNet: number
}

export interface Quantities {
  lines: QuantityLine[]
  geometry: Geometry
  rebarKg: number
}

const masonryKey = (m: InfillMaterial) =>
  m === 'tuff' ? 'tuff_block' : m === 'brick' ? 'brick' : 'aerated_block'

export function computeQuantities(p: HouseParams): Quantities {
  const lines: QuantityLine[] = []
  const add = (key: string, section: SectionId, stage: Stage, quantity: number) => {
    if (quantity > 0) lines.push({ key, section, stage, quantity })
  }

  // Габариты приводим к неотрицательным: при отрицательном вводе периметр
  // и площади уходили в минус и тянули за собой весь расчёт.
  const L0 = Math.max(0, p.length)
  const W0 = Math.max(0, p.width)
  const floors0 = Math.max(0, p.floors)
  const fh0 = Math.max(0, p.floorHeight)
  const A = L0 * W0
  const P = 2 * (L0 + W0)
  const H = floors0 * fh0
  const totalFloorArea = A * floors0
  // доля внутренних несущих осей задаётся инженером; по умолчанию 50% периметра
  const internalBearing = p.eng.internalBearingPct != null && p.eng.internalBearingPct >= 0
    ? p.eng.internalBearingPct / 100
    : C.internalBearingFactor
  const Lb = P * (1 + internalBearing)
  const region = REGIONS[p.region]

  // ---- effective engineering values (engineer overrides win) ----
  // empty/0/negative override => treated as "not set" (falls back to default)
  const ov = (v?: number) => (v != null && v > 0 ? v : undefined)
  const cm = (v?: number) => (v != null && v > 0 ? v / 100 : undefined)
  const e = p.eng
  const stripLen = ov(e.stripLen) ?? Lb
  const stripW = cm(e.stripWidth) ?? C.stripWidth
  const stripH = cm(e.stripHeight) ?? C.stripHeight
  const blindingT = cm(e.blinding) ?? C.blindingThickness
  const floorSlabT = cm(e.slab) ?? C.floorSlabThickness
  const wallT = cm(e.extWall) ?? p.wallThickness
  const basementWallT = cm(e.basementWall) ?? C.basementWallThickness
  const colSize = cm(e.columnSize) ?? C.columnSection.w
  const beamSectionArea = e.beamSection ?? colSize * colSize
  const waste = 1 + (e.wastePct != null ? e.wastePct / 100 : C.wasteFactor - 1)
  // pct(): доля задаётся в процентах, 0 — осмысленное значение (например, «без
  // раствора»), поэтому проверяем только на отрицательные и пустые.
  const pct = (v?: number) => (v != null && v >= 0 ? v / 100 : undefined)
  // Floor on ground, cm. A slab foundation or a basement floor already is the
  // ground-floor slab; strip, pile and column foundations get one by default.
  // 0 is a real choice here (e.g. a suspended timber floor), so only empty or
  // negative input falls back to the default.
  const groundSlabDefault = p.basement || p.foundation === 'slab' ? 0 : C.floorOnGroundThickness
  const floorOnGround =
    e.floorOnGround != null && e.floorOnGround >= 0 ? e.floorOnGround / 100 : groundSlabDefault
  // Фундамент
  const fndSlabT = cm(e.slabThickness) ?? C.slabThickness
  const pileD = cm(e.pileDiameter) ?? C.pile.d
  const pileLen = ov(e.pileLength) ?? C.pile.length
  const axisStep = ov(e.foundationAxisStep) ?? C.foundationAxisStep
  const colFndH = ov(e.columnFoundationHeight) ?? C.columnFoundationHeight
  const basementWorkW = cm(e.basementWorkingWidth) ?? C.basementWorkingWidth
  const sandBedT = cm(e.sandBed) ?? C.sandBedThickness
  const apronW = ov(e.apronWidth) ?? C.apronWidth
  const backfillK = pct(e.backfillPct) ?? C.backfillFactor
  // Каркас и стены
  const gridStep = ov(e.columnGridStep) ?? C.columnGridStep
  const ringBeamW = cm(e.ringBeamW) ?? C.ringBeam.w
  const ringBeamH = cm(e.ringBeamH) ?? C.ringBeam.h
  const coreSize = cm(e.seismicCoreSize) ?? C.seismicCore.w
  const coreStep = ov(e.seismicCoreStep) ?? C.seismicCoreStep
  const lintelW = cm(e.lintelW) ?? C.lintel.w
  const lintelH = cm(e.lintelH) ?? C.lintel.h
  const partitionT = cm(e.partitionThickness) ?? C.partitionThickness
  const mortarShare = pct(e.mortarSharePct) ?? C.mortarShare
  const glueShare = pct(e.glueSharePct) ?? C.glueShare
  // Перекрытия
  const precastArea = ov(e.precastSlabArea) ?? C.precastSlabArea
  const formworkK = ov(e.formworkPerM3) ?? C.formworkPerM3
  const insulT = cm(e.insulationThickness) ?? C.insulationBaseThickness
  const stairVol = ov(e.stairVolume) ?? C.stairVolumePerFlight
  // Армирование, кг/м³
  const reb = {
    strip: ov(e.rebarStrip) ?? C.rebar.strip,
    slab: ov(e.rebarSlab) ?? C.rebar.slab,
    pile: ov(e.rebarPile) ?? C.rebar.pile,
    column: ov(e.rebarColumn) ?? C.rebar.column,
    floor: ov(e.rebarFloor) ?? C.rebar.floor,
    ringBeam: ov(e.rebarRingBeam) ?? C.rebar.ringBeam,
    seismicCore: ov(e.rebarSeismicCore) ?? C.rebar.seismicCore,
    lintel: ov(e.rebarLintel) ?? C.rebar.lintel,
    basementWall: ov(e.rebarBasementWall) ?? C.rebar.basementWall,
    monolithWall: ov(e.rebarMonolithWall) ?? C.rebar.monolithWall,
  }
  // Класс бетона по элементам; пусто => общий класс из основной формы
  const grade = {
    foundation: e.concreteFoundation || p.concreteGrade,
    frame: e.concreteFrame || p.concreteGrade,
    floors: e.concreteFloors || p.concreteGrade,
  }

  // double-height hall: void in the 2nd-floor slab (perimeter walls already
  // span the full height H, so no extra wall volume is added here).
  const hallVoid = p.doubleHeightHall && p.floors >= 2 ? Math.max(0, Math.min(p.hallArea, A)) : 0
  // Площадь реального пола: над двусветным залом перекрытия нет, поэтому всё,
  // что считается «на м² пола» (стяжка, полы, электрика, водопровод, проект),
  // берётся без проёма.
  const finishedArea = Math.max(0, totalFloorArea - hallVoid)

  // нормативная общая площадь по внутренним поверхностям наружных стен (Прил.2 п.4)
  const netArea = Math.max(
    0,
    Math.max(0, p.length - 2 * wallT) * Math.max(0, p.width - 2 * wallT) * p.floors - hallVoid,
  )

  // structural concrete + rebar accumulators, per estimate section
  const concreteBySection: Partial<Record<SectionId, number>> = {}
  const rebarBySection: Partial<Record<SectionId, number>> = {}
  const addStruct = (section: SectionId, vol: number, rebarPerM3: number) => {
    if (vol <= 0) return
    concreteBySection[section] = (concreteBySection[section] ?? 0) + vol
    rebarBySection[section] = (rebarBySection[section] ?? 0) + vol * rebarPerM3
  }
  // Foundation concrete cast onto or into the ground (slabs on ground, bored
  // piles) is formed only at slab edges, not by the per-m³ ratio below.
  let groundCastVol = 0
  let groundCastEdgeForm = 0
  const castOnGround = (vol: number, edgeFormArea: number) => {
    if (vol <= 0) return
    groundCastVol += vol
    groundCastEdgeForm += edgeFormArea
  }

  const isMasonry = p.system === 'tuff' || p.system === 'aerated' || p.system === 'brick'
  const isMonolith = p.system === 'monolith'
  const wallMat: InfillMaterial =
    p.system === 'frame' || p.system === 'monolith' ? p.infillMaterial : (p.system as InfillMaterial)

  // ---- Foundation footing area ----
  const soleArea = p.foundation === 'slab' ? A : stripLen * stripW
  const excDepth = p.basement
    ? p.basementDepth + 0.3
    : Math.max(stripH, region.frostDepth)

  // ---- Earthworks (act) ----
  const excavationVol = p.basement ? A * (p.basementDepth + 0.3) : soleArea * excDepth
  add('excavation', 'earthworks', 'act', excavationVol)
  // Обратная засыпка: у подвала засыпается только рабочая зона вокруг стен —
  // сам подвал занимает котлован. У ленты — обычная доля объёма траншеи.
  const backfillVol = p.basement
    ? P * basementWorkW * (p.basementDepth + 0.3)
    : excavationVol * backfillK
  add('backfill', 'earthworks', 'act', backfillVol)
  // Подсыпка: под подошву фундамента + под пол по грунту, если он задан.
  add(
    'sand_gravel',
    'earthworks',
    'act',
    soleArea * sandBedT + (floorOnGround > 0 ? A * sandBedT : 0),
  )
  add('concrete_blinding', 'foundation', 'act', soleArea * blindingT)
  // Пол по грунту — бетонная плита с сеткой, а не песчано-гравийная подсыпка.
  // It is poured between the strips / grillage, which act as its side form.
  if (floorOnGround > 0) {
    addStruct('foundation', A * floorOnGround, reb.slab)
    castOnGround(A * floorOnGround, 0)
  }

  // ---- Foundation ----
  if (p.foundation === 'strip') {
    addStruct('foundation', stripLen * stripW * stripH, reb.strip)
  } else if (p.foundation === 'slab') {
    addStruct('foundation', A * fndSlabT, reb.slab)
    castOnGround(A * fndSlabT, P * fndSlabT)
  } else if (p.foundation === 'pile') {
    const n = stripLen / axisStep
    const pileVol = n * (Math.PI / 4) * pileD ** 2 * pileLen
    const grillage = stripLen * stripW * 0.4
    addStruct('foundation', pileVol + grillage, reb.pile)
    castOnGround(pileVol, 0) // bored piles are cast in the hole; the grillage is formed
  } else {
    // column
    const n = stripLen / axisStep
    addStruct('foundation', n * colSize * colSize * colFndH, reb.pile)
  }

  // ---- Basement walls + floor slab ----
  if (p.basement) {
    addStruct('foundation', P * basementWallT * p.basementDepth, reb.basementWall)
    addStruct('foundation', A * fndSlabT, reb.slab) // пол подвала
    castOnGround(A * fndSlabT, P * fndSlabT)
    add('waterproofing', 'foundation', 'act', A) // гидроизоляция пола подвала
  }

  // ---- Foundation waterproofing (plinth, exterior only) + apron ----
  const plinthHeight = p.basement ? p.basementDepth : 0.5
  add('waterproofing', 'foundation', 'act', P * plinthHeight)
  add('apron', 'foundation', 'act', P * apronW)

  // ---- Walls / frame ----
  // В каркасе вертикаль несут колонны: кладка заполняет только наружный контур,
  // внутренние деления — это перегородки (учтены отдельно, 0.1 м). В несущей
  // кладке и полном монолите внутренние несущие стены реальны → полные оси.
  const structLen = p.system === 'frame' ? P : Lb
  const wallGross = structLen * H
  const doorsArea = p.exteriorDoors * 2.0
  const openingsArea =
    e.openingsPct != null ? wallGross * (e.openingsPct / 100) : p.windowAreaTotal + doorsArea
  const wallNet = Math.max(0, wallGross - openingsArea)

  // ring beam (masonry) — per floor
  const ringBeamVol = isMasonry ? Lb * ringBeamW * ringBeamH * p.floors : 0
  // seismic cores (tuff/brick only) — full height
  const coreCount = Math.ceil(Lb / coreStep)
  const coresActive = isMasonry && (wallMat === 'tuff' || wallMat === 'brick') && !p.seismicReinforcementDisabled
  const coreVol = coresActive ? coreCount * coreSize * coreSize * H : 0

  if (isMasonry) {
    addStruct('walls', ringBeamVol, reb.ringBeam)
    if (coreVol > 0) addStruct('walls', coreVol, reb.seismicCore)
    // masonry volume minus embedded RC (avoid double count)
    let masonryVol = wallNet * wallT - ringBeamVol - coreVol
    masonryVol = Math.max(0, masonryVol) * waste
    add(masonryKey(wallMat), 'walls', 'act', masonryVol)
    // mortar / glue
    if (wallMat === 'aerated') add('glue_aerated', 'walls', 'act', masonryVol * glueShare)
    else add('mortar', 'walls', 'act', masonryVol * mortarShare)
  } else if (isMonolith) {
    // полный монолит: несущие ж/б стены (бетон + арматура), без кладки и заполнения
    const wallVol = Math.max(0, wallNet * wallT) * waste
    addStruct('walls', wallVol, reb.monolithWall)
  } else {
    // frame: columns + beams + infill
    const nx = Math.floor(p.length / gridStep) + 1
    const ny = Math.floor(p.width / gridStep) + 1
    const nCol = ov(e.columns) ?? nx * ny
    addStruct('frame', nCol * colSize * colSize * H, reb.column)
    const beamsLen = ov(e.beamsLen) ?? Lb * p.floors
    addStruct('frame', beamsLen * beamSectionArea, reb.ringBeam)
    // Columns and beams on the outer contour sit in the wall plane, so the
    // infill only fills the panels between them (the masonry branch subtracts
    // its ring beams and cores the same way). An overridden column count keeps
    // the grid's share of edge columns.
    const gridCols = nx * ny
    const edgeCols = nx === 1 || ny === 1 ? gridCols : 2 * (nx + ny) - 4
    const colsInWall = gridCols > 0 ? nCol * (edgeCols / gridCols) : 0
    const beamDepth = colSize > 0 ? beamSectionArea / colSize : 0
    const beamsInWall = Math.min(beamsLen, P * p.floors)
    const frameInWall = Math.max(
      0,
      colsInWall * colSize * H + beamsInWall * beamDepth - colsInWall * colSize * beamDepth * p.floors,
    )
    const infillVol = Math.max(0, (wallNet - frameInWall) * wallT) * waste
    add(masonryKey(wallMat), 'walls', 'act', infillVol)
    if (wallMat === 'aerated') add('glue_aerated', 'walls', 'act', infillVol * glueShare)
    else add('mortar', 'walls', 'act', infillVol * mortarShare)
  }

  // ---- Lintels over openings ----
  const openingCount = Math.ceil(p.windowAreaTotal / 3) + p.exteriorDoors
  const lintelLen = openingCount * (1.5 + 0.5)
  addStruct('walls', lintelLen * lintelW * lintelH, reb.lintel)

  // ---- Floors / ceilings ----
  // One slab over every storey. A basement adds the slab over it, i.e. the
  // ground floor itself (the basement floor is counted with the foundation).
  const slabLevels = p.floors + (p.basement ? 1 : 0)
  const slabArea = Math.max(0, A * slabLevels - hallVoid)
  if (p.floorSlab === 'monolith') {
    addStruct('floors', slabArea * floorSlabT, reb.floor)
  } else {
    const count = Math.ceil(slabArea / precastArea)
    add('precast_slab', 'floors', 'act', count)
  }

  // ---- Beams over the double-height hall ----
  if (hallVoid > 0 && p.beamsOverHall) {
    const beamLen = Math.sqrt(hallVoid) * 2 // пара балок через проём
    addStruct('floors', beamLen * 0.3 * 0.4, reb.floor)
  }

  // ---- Stair ----
  // a flight between storeys, plus one down to the basement
  const flights = Math.max(0, p.floors - 1) + (p.basement ? 1 : 0)
  add('stair', 'stair', 'act', flights * stairVol)

  // ---- Rough screed (act) ----
  add('screed', 'floors', 'act', finishedArea)

  // ---- Roof (flat / pitched / hip / mansard) ----
  if (p.roof === 'flat') {
    // Уклонообразующий слой: без него вода не уходит к воронкам.
    add('roof_slope', 'roof', 'act', A * C.roofSlopeLayer)
    add('roof_flat', 'roof', 'act', A)
    add('waterproofing', 'roof', 'act', A)
    add('insulation', 'roof', 'act', A * (insulT / C.insulationBaseThickness))
  } else {
    // real slope: footprint / cos(angle) + eaves overhang, ×shape factor
    const rad = (Math.min(Math.max(p.roofPitchDeg, 5), 75) * Math.PI) / 180
    const shape = p.roof === 'mansard' ? 1.15 : p.roof === 'hip' ? 1.05 : 1
    const roofArea = (A / Math.cos(rad) + P * 0.5) * shape
    add('roof_pitched', 'roof', 'act', roofArea)
    add('insulation', 'roof', 'act', roofArea * (insulT / C.insulationBaseThickness))
    // gable walls: full for a gable/pitched roof, half for mansard, none for hip
    const gableMult = p.roof === 'pitched' ? 1 : p.roof === 'mansard' ? 0.5 : 0
    if (gableMult > 0) {
      const gableVol = ((p.width ** 2 * Math.tan(rad)) / 4) * 2 * (wallT / 2) * gableMult
      add(masonryKey(wallMat), 'roof', 'act', Math.max(0, gableVol))
    }
  }

  // ================= TURNKEY =================
  // Windows
  add('window_regular', 'openings', 'turnkey', p.windowAreaTotal * (1 - p.vitrageShare))
  add('window_vitrage', 'openings', 'turnkey', p.windowAreaTotal * p.vitrageShare)
  // Doors
  add('door_exterior', 'openings', 'turnkey', p.exteriorDoors)
  // interior doors ≈ one per room (tied to the room count)
  const interiorDoors = p.interiorDoors ?? p.roomsPerFloor * p.floors
  add('door_interior', 'openings', 'turnkey', interiorDoors)

  // Partitions (aerated block) + plaster — length tied to number of rooms and
  // whether kitchen/living are separate; also scales with area, floors, height.
  const partitionWalls = Math.max(0, p.roomsPerFloor - 1) + (p.kitchenLivingCombined ? 0 : 1)
  const partitionArea = partitionWalls * Math.sqrt(A) * p.floorHeight * p.floors
  add('aerated_block', 'partitions', 'turnkey', partitionArea * partitionT)
  // aerated blocks are laid on thin-joint glue, as in the walls
  add('glue_aerated', 'partitions', 'turnkey', partitionArea * partitionT * glueShare)

  // Штукатурка: внутренняя грань наружных стен (одна сторона) + внутренние
  // несущие стены (две стороны) + перегородки (две стороны) + потолки.
  const intBearingLen = Math.max(0, structLen - P)
  const plasterWalls = Math.max(0, P * H - openingsArea) + intBearingLen * H * 2
  const plasterArea = plasterWalls + partitionArea * 2 + finishedArea
  add('plaster', 'finishing', 'turnkey', plasterArea)
  add('floor_finish', 'finishing', 'turnkey', finishedArea)

  // Facade (outer walls only) + facade insulation
  const facadeArea = Math.max(0, P * H - p.windowAreaTotal)
  add('facade', 'facade', 'turnkey', facadeArea)
  add('insulation', 'facade', 'turnkey', facadeArea * (insulT / C.insulationBaseThickness))

  // Engineering networks (per m²).
  // Электрика и водопровод разводятся по полу — над проёмом зала их нет.
  // Отопление и вентиляция зависят от объёма: двусветный зал греется и
  // проветривается как два этажа, поэтому для них остаётся полная площадь.
  add('electrical', 'engineering', 'turnkey', finishedArea)
  add('plumbing', 'engineering', 'turnkey', finishedArea)
  add('heating', 'engineering', 'turnkey', totalFloorArea)
  add('ventilation', 'engineering', 'turnkey', totalFloorArea)
  add('lightning', 'engineering', 'turnkey', 1)

  // ---- Подключение к внешним сетям (ТУ + врезка) ----
  // Платежи сетевым организациям; от площади дома не зависят.
  if (p.connectElectricity) add('conn_electricity', 'utilities', 'turnkey', 1)
  if (p.connectGas) add('conn_gas', 'utilities', 'turnkey', 1)
  if (p.connectWater) add('conn_water', 'utilities', 'turnkey', 1)
  if (p.connectSewer) add('conn_sewer', 'utilities', 'turnkey', 1)
  // Септик нужен только там, где нет центральной канализации.
  if (p.septic && !p.connectSewer) add('septic', 'utilities', 'turnkey', 1)

  // ---- Благоустройство участка и балконы ----
  add('fence', 'site', 'turnkey', Math.max(0, p.fenceLength))
  add('site_paving', 'site', 'turnkey', Math.max(0, p.sitePavingArea))
  add('balcony', 'site', 'turnkey', Math.max(0, p.balconyArea))

  // ---- Optional premium systems (opt-in extras) ----
  // per-m² options use the finished floor area (gross minus the hall void) — same
  // base as screed/plaster/floor_finish above, so numbers stay consistent.
  if (p.optHeating) add('opt_boiler_heating', 'options', 'turnkey', finishedArea)
  if (p.optHeatPump) add('opt_heat_pump', 'options', 'turnkey', 1)
  if (p.optSolarKw > 0) add('opt_solar', 'options', 'turnkey', p.optSolarKw)
  if (p.optFinishPremium) add('opt_finish_premium', 'options', 'turnkey', finishedArea)
  if (p.optPanelCeiling) add('opt_panel_ceiling', 'options', 'turnkey', finishedArea)

  // ---- Documents / permit (act) ----
  if (p.includePermitCost) {
    add('permit_apz', 'permit', 'act', 1)
    // проект и технадзор оплачиваются за м² дома, а проём зала — не площадь
    add('permit_design', 'permit', 'act', finishedArea)
    add('permit_geology', 'permit', 'act', 1)
    add('permit_expertise', 'permit', 'act', 1)
    add('permit_fee', 'permit', 'act', 1)
    add('permit_address', 'permit', 'act', 1)
    add('permit_supervision', 'permit', 'act', finishedArea)
  }

  // ---- Опалубка и подача бетона ----
  // Считаются от фактического объёма конструктивного бетона, поэтому стоят
  // после того, как все addStruct() отработали.
  // Опалубка ложится в тот же раздел, где залит бетон, иначе разбивка сметы по
  // разделам врёт: вся опалубка оказалась бы «фундаментом».
  let structConcrete = 0
  for (const key of Object.keys(concreteBySection) as SectionId[]) {
    const vol = concreteBySection[key] ?? 0
    if (vol <= 0) continue
    structConcrete += vol
    const formed = key === 'foundation' ? Math.max(0, vol - groundCastVol) * formworkK + groundCastEdgeForm : vol * formworkK
    add('formwork', key, 'act', formed)
  }
  // Насос тарифицируется на весь объём разом, поэтому одной строкой.
  if (p.concretePump && structConcrete > 0) add('concrete_pump', 'foundation', 'act', structConcrete)

  // ---- Aggregate structural concrete + rebar, per section ----
  // reinforcement grows with number of floors (seismic/loads)
  const rebarFloorK = 1 + (pct(e.rebarFloorPct) ?? C.rebarFloorFactor) * Math.max(0, p.floors - 1)
  let rebarKg = 0
  for (const key of Object.keys(concreteBySection) as SectionId[]) {
    const vol = concreteBySection[key] ?? 0
    if (vol > 0) {
      // класс бетона может отличаться по элементам: фундамент / каркас / перекрытия
      const g =
        key === 'foundation' || key === 'earthworks'
          ? grade.foundation
          : key === 'frame' || key === 'walls'
            ? grade.frame
            : grade.floors
      lines.push({ key: g, section: key, stage: 'act', quantity: vol })
    }
  }
  for (const key of Object.keys(rebarBySection) as SectionId[]) {
    const kg = (rebarBySection[key] ?? 0) * rebarFloorK
    rebarKg += kg
    if (kg > 0) lines.push({ key: p.rebarGrade, section: key, stage: 'act', quantity: kg / 1000 })
  }

  const geometry: Geometry = {
    footprint: A,
    perimeter: P,
    bearingLength: Lb,
    wallHeight: H,
    totalFloorArea,
    finishedFloorArea: finishedArea,
    // нормативная общая площадь — по внутренним поверхностям наружных стен (Прил.2 п.4)
    netFloorArea: netArea,
    internalPerFloor: Math.max(0, p.length - 2 * wallT) * Math.max(0, p.width - 2 * wallT),
    hallVoid,
    wallGross,
    openingsArea,
    wallNet,
  }

  return { lines, geometry, rebarKg }
}
