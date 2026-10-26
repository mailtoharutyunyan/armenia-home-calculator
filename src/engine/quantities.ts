import type { HouseParams, InfillMaterial } from '../model/house'
import { COEFF as C } from '../data/coefficients'
import { REGIONS } from '../data/regions'
import { buildFloorPlan, planTakeoff, DOOR_W } from './floorplan'
import { simplified41Reasons } from './norms'

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

// Doors, partitions, the kitchen's glass partition and railings are measured
// on the floor plans the calculator draws, so the estimate pays for what the
// plans show. The rule of thumb used before (two walls of √A per floor, one
// door per room) gave 162 m² of partitions and 6 doors for plans with ~190 m²
// and 10 doors, and left out the glass partition and the railings.
export function planTake(p: HouseParams) {
  const take = {
    partitions: 0, glass: 0, railing: 0, leafDoors: 0, baths: 0, bathPerimeter: 0, voidArea: 0, radiators: 0,
    sockets: 0, lights: 0, waterPoints: 0, sewerPoints: 0, exhaustFans: 0,
  }
  for (let f = 0; f < Math.max(0, p.floors); f++) {
    const t = planTakeoff(buildFloorPlan(p, f))
    take.partitions += t.partitions
    take.glass += t.glass
    take.railing += t.railing
    take.leafDoors += t.leafDoors
    take.baths += t.baths
    take.bathPerimeter += t.bathPerimeter
    take.voidArea += t.voidArea
    take.radiators += t.radiators
    take.sockets += t.sockets
    take.lights += t.lights
    take.waterPoints += t.waterPoints
    take.sewerPoints += t.sewerPoints
    take.exhaustFans += t.exhaustFans
  }
  return take
}

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
  // A monolithic slab is poured over the beams, columns and walls it rests on;
  // that shared depth belongs to the slab (ГЭСН 81-02-06, 2.2-2.4).
  const slabOverBeams = p.floorSlab === 'monolith' ? floorSlabT : 0
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
  // The void is the one the plans draw: a hall asked larger than the house can
  // hold (or in a house too small for it) is drawn smaller, and only the drawn
  // void is missing from the slab.
  const take = planTake(p)
  const hallVoid = p.doubleHeightHall && p.floors >= 2 ? Math.max(0, Math.min(p.hallArea, A, take.voidArea)) : 0
  // Площадь реального пола: над двусветным залом перекрытия нет, поэтому всё,
  // что считается «на м² пола» (стяжка, полы, электрика, водопровод, проект),
  // берётся без проёма.
  const finishedArea = Math.max(0, totalFloorArea - hallVoid)

  // нормативная общая площадь по внутренним поверхностям наружных стен (Прил.2 п.4)
  const netArea = Math.max(
    0,
    Math.max(0, p.length - 2 * wallT) * Math.max(0, p.width - 2 * wallT) * p.floors - hallVoid,
  )

  // In a frame the infill fills the outer contour only; load-bearing masonry
  // and a full monolith keep their internal bearing walls.
  const structLen = p.system === 'frame' ? P : Lb
  const intBearingLen = Math.max(0, structLen - P)
  // Работы «за м² дома» (сети, проект, технадзор, опции) считаются по общей
  // площади — по внутренним поверхностям наружных стен, без проёма зала. Это
  // площадь из документов и из шапки калькулятора, по ней же дают цену
  // подрядчики. Наружный обмер (с толщиной стен) завышал её на ~13%.
  const houseArea = netArea
  // Слои пола (стяжка, покрытие) и потолки — без следа перегородок и
  // внутренних несущих стен: под стеной пола нет.
  const floorLayerArea = Math.max(
    0,
    houseArea - Math.max(0, take.partitions - intBearingLen * floors0) * partitionT - intBearingLen * wallT * floors0,
  )

  // structural concrete + rebar accumulators, per estimate section
  const concreteBySection: Partial<Record<SectionId, number>> = {}
  const rebarBySection: Partial<Record<SectionId, number>> = {}
  const formedBySection: Partial<Record<SectionId, number>> = {}
  // `vol` is the concrete actually poured. The rebar (kg/m³) and formwork
  // (m²/m³) ratios were set on an element's full section, so an element whose
  // node is poured with its neighbour passes that full volume as `gross`.
  // Slabs carry their own floor whatever the storey count, so only the
  // load-bearing elements (foundation, columns, beams, walls) get the
  // per-storey rebar increase; slabs pass `grows = false`.
  const rebarFixedBySection: Partial<Record<SectionId, number>> = {}
  // Elements whose formwork is measured directly (monolithic walls, two faces)
  // pass `formed = false` and add their contact area to formDirect instead.
  const formDirect: Partial<Record<SectionId, number>> = {}
  const addStruct = (section: SectionId, vol: number, rebarPerM3: number, gross = vol, grows = true, formed = true) => {
    if (gross <= 0) return
    concreteBySection[section] = (concreteBySection[section] ?? 0) + Math.max(0, vol)
    if (formed) formedBySection[section] = (formedBySection[section] ?? 0) + gross
    const acc = grows ? rebarBySection : rebarFixedBySection
    acc[section] = (acc[section] ?? 0) + gross * rebarPerM3
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
  // Column pads stand one per axis step; a pad is a whole pad.
  const padCount = Math.ceil(stripLen / axisStep)
  const soleArea = p.foundation === 'slab' ? A : p.foundation === 'column' ? padCount * colSize * colSize : stripLen * stripW
  const excDepth = p.basement
    ? p.basementDepth + 0.3
    : p.foundation === 'column'
      ? Math.max(colFndH, region.frostDepth)
      : Math.max(stripH, region.frostDepth)

  // ---- Earthworks (act) ----
  // Trenches and pits are wider than what is cast in them (working space for
  // formwork and coating) and deeper by the sand bed and blinding under it.
  const isStrip = p.foundation === 'strip' && !p.basement
  const workW = C.trenchWorkingWidth
  const trenchW = stripW + 2 * workW
  const trenchDepth = excDepth + sandBedT + blindingT
  const excavationVol = p.basement
    ? (L0 + 2 * basementWorkW) * (W0 + 2 * basementWorkW) * (p.basementDepth + 0.3)
    : p.foundation === 'strip' || p.foundation === 'pile'
      ? stripLen * trenchW * trenchDepth
      : p.foundation === 'column'
        ? padCount * (colSize + 2 * workW) ** 2 * trenchDepth
        : soleArea * excDepth
  add('excavation', 'earthworks', 'act', excavationVol)
  // Обратная засыпка — всё, что вырыто, минус то, что в выемке отлито или
  // уложено: подвал, лента или ростверк, подушки, плита с подушкой.
  // Доля из панели инженера — приоритетнее.
  const castInPit = p.basement
    ? A * (p.basementDepth + 0.3)
    : p.foundation === 'strip'
      ? stripLen * stripW * trenchDepth
      : p.foundation === 'pile'
        ? stripLen * stripW * (0.4 + sandBedT + blindingT)
        : p.foundation === 'column'
          ? soleArea * trenchDepth
          : A * Math.min(excDepth, fndSlabT + sandBedT + blindingT)
  const backfillTrench = pct(e.backfillPct) != null ? excavationVol * backfillK : Math.max(0, excavationVol - castInPit)
  // The slab on ground is poured between the strips (grillage, column pads),
  // so the area they already take is neither concreted nor bedded twice.
  const underGroundSlab =
    p.foundation === 'strip' || p.foundation === 'pile'
      ? stripLen * stripW
      : p.foundation === 'column'
        ? padCount * colSize * colSize
        : 0
  const groundSlabArea = floorOnGround > 0 ? Math.max(0, A - underGroundSlab) : 0
  // Пол первого этажа поднят на цоколь: под плитой — местный грунт из траншеи,
  // затем песчаная подушка и сама плита.
  const plinthFill = isStrip ? groundSlabArea * Math.max(0, C.plinthHeight - floorOnGround - sandBedT) : 0
  const backfillVol = backfillTrench + plinthFill
  // Засыпка идёт местным грунтом из траншеи; если его не хватает (цоколь
  // поднимает пол), недостающее завозится и укладывается как подсыпка.
  const importedFill = Math.max(0, backfillVol - excavationVol)
  add('backfill', 'earthworks', 'act', backfillVol - importedFill)
  // Лишний грунт вывозится; в кузове он занимает больше, чем в массиве.
  add('soil_removal', 'earthworks', 'act', Math.max(0, excavationVol - backfillVol) * C.soilBulking)
  add('setting_out', 'earthworks', 'act', A > 0 ? 1 : 0)
  // Подсыпка: под подошву фундамента + под пол по грунту, если он задан.
  // the basement floor lies on its own bed
  const basementBed = p.basement && p.foundation !== 'slab' ? A * sandBedT : 0
  add('sand_gravel', 'earthworks', 'act', soleArea * sandBedT + groundSlabArea * sandBedT + basementBed + importedFill)
  add('concrete_blinding', 'foundation', 'act', soleArea * blindingT)
  // Пол по грунту — бетонная плита с сеткой, а не песчано-гравийная подсыпка.
  // It is poured between the strips / grillage, which act as its side form.
  if (groundSlabArea > 0) {
    addStruct('foundation', groundSlabArea * floorOnGround, reb.slab, groundSlabArea * floorOnGround, false)
    castOnGround(groundSlabArea * floorOnGround, 0)
  }
  // The ground floor lying on the ground is insulated under the screed (XPS),
  // or the floor heats the soil. Priced per m² at 100 mm like the roof.
  const floorOnSoil = groundSlabArea > 0 ? groundSlabArea : p.foundation === 'slab' && !p.basement ? A : 0
  add('insulation_xps', 'floors', 'act', floorOnSoil * (C.groundSlabInsulation / C.insulationBaseThickness))

  // ---- Foundation ----
  if (p.foundation === 'strip') {
    // from the sole up to the plinth top: below ground to the frost depth (or
    // the design height if deeper), then the plinth above ground
    const stripTotalH = (p.basement ? stripH : excDepth + C.plinthHeight)
    addStruct('foundation', stripLen * stripW * stripTotalH, reb.strip)
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
    addStruct('foundation', padCount * colSize * colSize * colFndH, reb.pile)
  }

  // ---- Basement walls + floor slab ----
  if (p.basement) {
    addStruct('foundation', P * basementWallT * p.basementDepth, reb.basementWall)
    // a slab foundation already is the basement floor
    if (p.foundation !== 'slab') {
      addStruct('foundation', A * fndSlabT, reb.slab, A * fndSlabT, false) // пол подвала
      castOnGround(A * fndSlabT, P * fndSlabT)
    }
    add('waterproofing', 'foundation', 'act', A) // гидроизоляция пола подвала
  }

  // ---- Foundation waterproofing + apron ----
  // A strip is coated on its outer face from the sole to the plinth top and
  // gets a cut-off layer on top, under the walls, against rising damp.
  const plinthHeight = p.basement ? p.basementDepth : isStrip ? excDepth + C.plinthHeight : C.plinthHeight
  add('waterproofing', 'foundation', 'act', P * plinthHeight + (isStrip ? stripLen * stripW : 0))
  add('apron', 'foundation', 'act', P * apronW)

  // ---- Walls / frame ----
  // В каркасе вертикаль несут колонны: кладка заполняет только наружный контур,
  // внутренние деления — это перегородки (учтены отдельно, 0.1 м). В несущей
  // кладке и полном монолите внутренние несущие стены реальны → полные оси.
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
    // masonry volume minus embedded RC and the slab bearing on the walls (avoid double count)
    let masonryVol = wallNet * wallT - ringBeamVol - coreVol - Lb * wallT * slabOverBeams * p.floors
    masonryVol = Math.max(0, masonryVol) * waste
    add(masonryKey(wallMat), 'walls', 'act', masonryVol)
    // mortar / glue
    if (wallMat === 'aerated') add('glue_aerated', 'walls', 'act', masonryVol * glueShare)
    else add('mortar', 'walls', 'act', masonryVol * mortarShare)
  } else if (isMonolith) {
    // полный монолит: несущие ж/б стены (бетон + арматура), без кладки и заполнения
    // the slab over each storey is counted with the slab, not the wall below it
    const wallVol = Math.max(0, (wallNet - Lb * slabOverBeams * p.floors) * wallT) * waste
    addStruct('walls', wallVol, reb.monolithWall, Math.max(0, wallNet * wallT) * waste, true, false)
    // a wall is formed on both faces, between the slab bands
    formDirect.walls = (formDirect.walls ?? 0) + 2 * Math.max(0, wallNet - Lb * slabOverBeams * p.floors)
  } else {
    // frame: columns + beams + infill
    const nx = Math.floor(p.length / gridStep) + 1
    const ny = Math.floor(p.width / gridStep) + 1
    const nCol = ov(e.columns) ?? nx * ny
    const beamsLen = ov(e.beamsLen) ?? Lb * p.floors
    const beamDepth = colSize > 0 ? beamSectionArea / colSize : 0
    // Poured concrete as ГЭСН 81-02-06 (2.2-2.3) counts it, so no node is paid
    // twice: columns up to the underside of each slab, beams between column
    // faces and, under a monolithic slab, only the part below it.
    const colConcrete = nCol * colSize * colSize * Math.max(0, H - p.floors * slabOverBeams)
    addStruct('frame', colConcrete, reb.column, nCol * colSize * colSize * H)
    const beamClearLen = Math.max(0, beamsLen - nCol * colSize * p.floors)
    const beamConcrete = beamClearLen * colSize * Math.max(0, beamDepth - slabOverBeams)
    addStruct('frame', beamConcrete, reb.ringBeam, beamsLen * beamSectionArea)
    // Columns and beams on the outer contour sit in the wall plane, so the
    // infill only fills the panels between them (the masonry branch subtracts
    // its ring beams and cores the same way). An overridden column count keeps
    // the grid's share of edge columns.
    const gridCols = nx * ny
    const edgeCols = nx === 1 || ny === 1 ? gridCols : 2 * (nx + ny) - 4
    const colsInWall = gridCols > 0 ? nCol * (edgeCols / gridCols) : 0
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
  // scaffolding on the facade from the masonry to the facade finish
  const parapetH = p.roof === 'flat' ? C.parapetHeight : 0
  add('scaffolding', 'walls', 'act', P * (H + parapetH) * C.scaffoldMonths)
  add('crane', 'frame', 'act', A > 0 ? C.craneShifts : 0)

  // ---- Floors / ceilings ----
  // One slab over every storey. A basement adds the slab over it, i.e. the
  // ground floor itself (the basement floor is counted with the foundation).
  const slabLevels = p.floors + (p.basement ? 1 : 0)
  const slabArea = Math.max(0, A * slabLevels - hallVoid)
  if (p.floorSlab === 'monolith') {
    addStruct('floors', slabArea * floorSlabT, reb.floor, slabArea * floorSlabT, false)
  } else {
    const count = Math.ceil(slabArea / precastArea)
    add('precast_slab', 'floors', 'act', count)
  }

  // ---- Beams over the double-height hall ----
  if (hallVoid > 0 && p.beamsOverHall) {
    const beamLen = Math.sqrt(hallVoid) * 2 // пара балок через проём
    addStruct('floors', beamLen * 0.3 * Math.max(0, 0.4 - slabOverBeams), reb.floor, beamLen * 0.3 * 0.4, false)
  }

  // ---- Stair ----
  // a flight between storeys, plus one down to the basement
  const flights = Math.max(0, p.floors - 1) + (p.basement ? 1 : 0)
  add('stair', 'stair', 'act', flights * stairVol)

  // ---- Rough screed (act) ----
  add('screed', 'floors', 'act', floorLayerArea)

  // ---- Roof (flat / pitched / hip / mansard) ----
  let gableFacade = 0
  if (p.roof === 'flat') {
    // Уклонообразующий слой: без него вода не уходит к воронкам.
    add('roof_slope', 'roof', 'act', A * C.roofSlopeLayer)
    add('roof_flat', 'roof', 'act', A)
    add('waterproofing', 'roof', 'act', A)
    add('insulation_xps', 'roof', 'act', A * (insulT / C.insulationBaseThickness))
    // Parapet along the roof edge: the membrane turns up onto it and it guards
    // the edge. Laid of the wall block, capped with a steel coping.
    const parapetVol = P * C.parapetHeight * wallT * waste
    add(masonryKey(wallMat), 'roof', 'act', parapetVol)
    if (wallMat === 'aerated') add('glue_aerated', 'roof', 'act', parapetVol * glueShare)
    else add('mortar', 'roof', 'act', parapetVol * mortarShare)
    add('parapet_coping', 'roof', 'act', P)
  } else {
    // real slope: footprint / cos(angle) + eaves overhang, ×shape factor
    const rad = (Math.min(Math.max(p.roofPitchDeg, 5), 75) * Math.PI) / 180
    const shape = p.roof === 'mansard' ? 1.15 : p.roof === 'hip' ? 1.05 : 1
    const roofArea = (A / Math.cos(rad) + P * 0.5) * shape
    add('roof_pitched', 'roof', 'act', roofArea)
    add('insulation_xps', 'roof', 'act', roofArea * (insulT / C.insulationBaseThickness))
    // gable walls: full for a gable/pitched roof, half for mansard, none for hip
    const gableMult = p.roof === 'pitched' ? 1 : p.roof === 'mansard' ? 0.5 : 0
    if (gableMult > 0) {
      // two triangles of base W and height W/2·tan, the full wall thick, laid
      // like the walls and finished like the facade
      const gableFace = ((W0 ** 2 * Math.tan(rad)) / 4) * 2 * gableMult
      const gableVol = gableFace * wallT * waste
      add(masonryKey(wallMat), 'roof', 'act', gableVol)
      if (wallMat === 'aerated') add('glue_aerated', 'roof', 'act', gableVol * glueShare)
      else add('mortar', 'roof', 'act', gableVol * mortarShare)
      gableFacade = gableFace
    }
  }

  // ================= TURNKEY =================
  // Windows
  add('window_regular', 'openings', 'turnkey', p.windowAreaTotal * (1 - p.vitrageShare))
  add('window_vitrage', 'openings', 'turnkey', p.windowAreaTotal * p.vitrageShare)
  // curtain walls stand on the floor; ordinary windows get a sill and a drip
  add('window_sills', 'openings', 'turnkey', (p.windowAreaTotal * (1 - p.vitrageShare)) / C.windowHeight)
  // Doors
  add('door_exterior', 'openings', 'turnkey', p.exteriorDoors)
  const interiorDoors = p.interiorDoors ?? take.leafDoors
  add('door_interior', 'openings', 'turnkey', interiorDoors)

  // Partitions (aerated block) + plaster: from the floor to the slab above
  // (storey height minus the slab), less the door openings in them
  const clearH = Math.max(0, p.floorHeight - floorSlabT)
  // load-bearing masonry and monolith build some room walls as bearing walls
  // (counted with the walls); the plan draws them all as partitions
  const partitionLen = Math.max(0, take.partitions - intBearingLen * floors0)
  const partitionArea = Math.max(0, partitionLen * clearH - take.leafDoors * DOOR_W * C.doorHeight)
  add('aerated_partition', 'partitions', 'turnkey', partitionArea * partitionT)
  // aerated blocks are laid on thin-joint glue, as in the walls
  add('glue_aerated', 'partitions', 'turnkey', partitionArea * partitionT * glueShare)
  add('glass_partition', 'partitions', 'turnkey', take.glass * clearH)
  // railings: along the void (gallery, landing) and along each flight
  add('railing', 'finishing', 'turnkey', take.railing + flights * C.stairRailingPerFlight)

  // Штукатурка: внутренняя грань наружных стен (одна сторона) + внутренние
  // несущие стены (две стороны) + перегородки (две стороны) + потолки.
  // Стены — по внутреннему периметру и в чистоте, без толщины перекрытий.
  const innerPerimeter = 2 * (Math.max(0, L0 - 2 * wallT) + Math.max(0, W0 - 2 * wallT))
  const clearWallH = Math.max(0, H - floors0 * floorSlabT)
  const plasterWalls = Math.max(0, innerPerimeter * clearWallH - openingsArea) + intBearingLen * clearWallH * 2
  const plasterArea = plasterWalls + partitionArea * 2 + floorLayerArea
  add('plaster', 'finishing', 'turnkey', plasterArea)
  add('floor_finish', 'finishing', 'turnkey', floorLayerArea)
  // bathroom walls tiled to 2.4 m, less the door of each bathroom
  add('wall_tile', 'finishing', 'turnkey', Math.max(0, take.bathPerimeter * C.bathTileHeight - take.baths * DOOR_W * C.doorHeight))
  add('stair_finish', 'finishing', 'turnkey', flights * C.stairFinishPerFlight)

  // Facade (outer walls and the parapet) + facade insulation
  const parapetFace = p.roof === 'flat' ? P * C.parapetHeight : 0
  const facadeArea = Math.max(0, P * H + parapetFace + gableFacade - p.windowAreaTotal)
  // the share clad in stone replaces the render there
  const stoneArea = facadeArea * Math.min(100, Math.max(0, p.stoneFacadePct ?? 0)) / 100
  add('facade', 'facade', 'turnkey', facadeArea - stoneArea)
  add(`facade_${p.stoneType ?? 'travertine'}`, 'facade', 'turnkey', stoneArea)
  add('insulation', 'facade', 'turnkey', Math.max(0, P * H + gableFacade - p.windowAreaTotal) * (insulT / C.insulationBaseThickness))

  // Engineering networks, counted the way installers charge for them: per
  // point drawn on the plans (planTakeoff), the boiler room and the panel as
  // sets. A high hall needs power, not points — floor heating by the glazing
  // and an extract at the top (norms.ts).
  add('electrical', 'engineering', 'turnkey', take.sockets + take.lights)
  add('electrical_panel', 'engineering', 'turnkey', A > 0 ? 1 : 0)
  add('plumbing', 'engineering', 'turnkey', take.waterPoints)
  add('sewer_points', 'engineering', 'turnkey', take.sewerPoints)
  add('heating', 'engineering', 'turnkey', A > 0 ? 1 : 0)
  // Radiators per heated room of the plans (see planTakeoff); underfloor
  // heating takes their place, it does not add to them.
  if (!p.optHeating) add('radiators', 'engineering', 'turnkey', take.radiators)
  add('ventilation', 'engineering', 'turnkey', take.exhaustFans)
  add('lightning', 'engineering', 'turnkey', 1)
  add('sanitary_set', 'engineering', 'turnkey', take.baths)
  if (p.connectGas) add('gas_internal', 'engineering', 'turnkey', 1)
  add('roof_drainage', 'roof', 'turnkey', A > 0 ? 1 : 0)

  // ---- Подключение к внешним сетям (ТУ + врезка) ----
  // Платежи сетевым организациям; от площади дома не зависят.
  if (p.connectElectricity) {
    // A heat pump or an EV charger needs a three-phase 0.4 kV connection;
    // the PSRC fee is a fixed part plus a rate per kVA asked for.
    if (p.optHeatPump || p.optEvCharger) {
      add('conn_electricity_3ph_base', 'utilities', 'turnkey', 1)
      add('conn_electricity_3ph', 'utilities', 'turnkey', C.threePhaseKva)
    } else add('conn_electricity', 'utilities', 'turnkey', 1)
  }
  if (p.connectGas) add('conn_gas', 'utilities', 'turnkey', 1)
  if (p.connectWater) add('conn_water', 'utilities', 'turnkey', 1)
  if (p.connectSewer) add('conn_sewer', 'utilities', 'turnkey', 1)
  // Септик нужен только там, где нет центральной канализации.
  if (p.septic && !p.connectSewer) add('septic', 'utilities', 'turnkey', 1)

  // ---- Благоустройство участка и балконы ----
  add('fence', 'site', 'turnkey', Math.max(0, p.fenceLength))
  add('site_paving', 'site', 'turnkey', Math.max(0, p.sitePavingArea))
  add('balcony', 'site', 'turnkey', Math.max(0, p.balconyArea))
  add('waste_removal', 'site', 'turnkey', houseArea * C.debrisPerM2)

  // ---- Optional premium systems (opt-in extras) ----
  // per-m² options use the house area, as the networks above do
  // тёплый пол — вместо радиаторов; рекуперация — доплата к вентиляции
  if (p.optHeating) add('opt_boiler_heating', 'options', 'turnkey', houseArea)
  if (p.optMvhr) add('opt_mvhr', 'options', 'turnkey', houseArea)
  if (p.optHeatPump) {
    add('opt_heat_pump', 'options', 'turnkey', 1)
    add('dhw_cylinder', 'options', 'turnkey', 1)
  }
  add('opt_fancoil', 'options', 'turnkey', Math.max(0, Math.round(p.optFanCoils)))
  add('opt_battery', 'options', 'turnkey', Math.max(0, p.optBatteryKwh))
  // a battery works through a hybrid inverter
  if (p.optBatteryKwh > 0) add('opt_hybrid_inverter', 'options', 'turnkey', 1)
  if (p.optEvCharger) add('opt_ev_charger', 'options', 'turnkey', 1)
  add('opt_kitchen', 'options', 'turnkey', Math.max(0, p.optKitchenM))
  if (p.optSolarKw > 0) add('opt_solar', 'options', 'turnkey', p.optSolarKw)
  if (p.optFinishPremium) add('opt_finish_premium', 'options', 'turnkey', floorLayerArea)
  if (p.optPanelCeiling) add('opt_panel_ceiling', 'options', 'turnkey', floorLayerArea)

  // ---- Documents / permit (act) ----
  if (p.includePermitCost) {
    add('permit_apz', 'permit', 'act', 1)
    // проект и технадзор оплачиваются за м² дома, а проём зала — не площадь
    add('permit_design', 'permit', 'act', houseArea)
    add('permit_geology', 'permit', 'act', 1)
    // the simplified procedure N 4.1 issues the permit without the expertise
    if (simplified41Reasons(p, netArea).length > 0) add('permit_expertise', 'permit', 'act', 1)
    add('permit_fee', 'permit', 'act', 1)
    add('permit_address', 'permit', 'act', 1)
    add('permit_supervision', 'permit', 'act', houseArea)
  }

  // ---- Опалубка и подача бетона ----
  // Считаются от фактического объёма конструктивного бетона, поэтому стоят
  // после того, как все addStruct() отработали.
  // Опалубка ложится в тот же раздел, где залит бетон, иначе разбивка сметы по
  // разделам врёт: вся опалубка оказалась бы «фундаментом».
  let structConcrete = 0
  for (const key of Object.keys(formedBySection) as SectionId[]) {
    structConcrete += concreteBySection[key] ?? 0
    const vol = formedBySection[key] ?? 0
    if (vol <= 0) continue
    const formed = key === 'foundation' ? Math.max(0, vol - groundCastVol) * formworkK + groundCastEdgeForm : vol * formworkK
    add('formwork', key, 'act', formed + (formDirect[key] ?? 0))
  }
  // a section formed only by direct measure (monolithic walls without lintels)
  for (const key of Object.keys(formDirect) as SectionId[]) {
    if ((formedBySection[key] ?? 0) <= 0) {
      add('formwork', key, 'act', formDirect[key] ?? 0)
      structConcrete += concreteBySection[key] ?? 0
    }
  }
  // Насос тарифицируется на весь объём разом, поэтому одной строкой.
  if (p.concretePump && structConcrete > 0) {
    // the pump is paid per call: the foundation, the slab on ground, and per
    // storey its columns and walls, then its slab (plus a basement storey).
    // A call covers the first 20 m³; only the rest is paid per m³.
    const pours = 1 + (groundSlabArea > 0 ? 1 : 0) + 2 * (floors0 + (p.basement ? 1 : 0))
    add('pump_call', 'foundation', 'act', pours)
    add('concrete_pump', 'foundation', 'act', Math.max(0, structConcrete - C.pumpCallM3 * pours))
  }

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
  const rebarSections = new Set([...Object.keys(rebarBySection), ...Object.keys(rebarFixedBySection)] as SectionId[])
  for (const key of rebarSections) {
    const kg = (rebarBySection[key] ?? 0) * rebarFloorK + (rebarFixedBySection[key] ?? 0)
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
