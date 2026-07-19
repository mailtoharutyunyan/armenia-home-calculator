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
  totalFloorArea: number // A_общ (без вычета)
  netFloorArea: number // A_общ − проём двусветного зала (реальная площадь пола)
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

  const A = p.length * p.width
  const P = 2 * (p.length + p.width)
  const H = p.floors * p.floorHeight
  const totalFloorArea = A * p.floors
  const Lb = P * (1 + C.internalBearingFactor) // несущие оси = 1.5 * P
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
  const floorOnGround = cm(e.floorOnGround) ?? 0

  // double-height hall: void in the 2nd-floor slab (perimeter walls already
  // span the full height H, so no extra wall volume is added here).
  const hallVoid = p.doubleHeightHall && p.floors >= 2 ? Math.max(0, Math.min(p.hallArea, A)) : 0

  // structural concrete + rebar accumulators, per estimate section
  const concreteBySection: Partial<Record<SectionId, number>> = {}
  const rebarBySection: Partial<Record<SectionId, number>> = {}
  const addStruct = (section: SectionId, vol: number, rebarPerM3: number) => {
    if (vol <= 0) return
    concreteBySection[section] = (concreteBySection[section] ?? 0) + vol
    rebarBySection[section] = (rebarBySection[section] ?? 0) + vol * rebarPerM3
  }

  const isMasonry = p.system !== 'frame'
  const wallMat: InfillMaterial =
    p.system === 'frame' ? p.infillMaterial : (p.system as InfillMaterial)

  // ---- Foundation footing area ----
  const soleArea = p.foundation === 'slab' ? A : stripLen * stripW
  const excDepth = p.basement
    ? p.basementDepth + 0.3
    : Math.max(stripH, region.frostDepth)

  // ---- Earthworks (act) ----
  const excavationVol = p.basement ? A * (p.basementDepth + 0.3) : soleArea * excDepth
  add('excavation', 'earthworks', 'act', excavationVol)
  add('backfill', 'earthworks', 'act', excavationVol * C.backfillFactor)
  add('sand_gravel', 'earthworks', 'act', soleArea * C.sandBedThickness + A * floorOnGround)
  add('concrete_blinding', 'foundation', 'act', soleArea * blindingT)

  // ---- Foundation ----
  if (p.foundation === 'strip') {
    addStruct('foundation', stripLen * stripW * stripH, C.rebar.strip)
  } else if (p.foundation === 'slab') {
    addStruct('foundation', A * C.slabThickness, C.rebar.slab)
  } else if (p.foundation === 'pile') {
    const n = stripLen / C.foundationAxisStep
    const pileVol = n * (Math.PI / 4) * C.pile.d ** 2 * C.pile.length
    const grillage = stripLen * stripW * 0.4
    addStruct('foundation', pileVol + grillage, C.rebar.pile)
  } else {
    // column
    const n = stripLen / C.foundationAxisStep
    addStruct('foundation', n * colSize * colSize * C.columnFoundationHeight, C.rebar.pile)
  }

  // ---- Basement walls + floor slab ----
  if (p.basement) {
    addStruct('foundation', P * basementWallT * p.basementDepth, C.rebar.basementWall)
    addStruct('foundation', A * C.slabThickness, C.rebar.slab) // пол подвала
    add('waterproofing', 'foundation', 'act', A) // гидроизоляция пола подвала
  }

  // ---- Foundation waterproofing (plinth, exterior only) + apron ----
  const plinthHeight = p.basement ? p.basementDepth : 0.5
  add('waterproofing', 'foundation', 'act', P * plinthHeight)
  add('apron', 'foundation', 'act', P * C.apronWidth)

  // ---- Walls / frame ----
  const wallGross = Lb * H
  const doorsArea = p.exteriorDoors * 2.0
  const openingsArea =
    e.openingsPct != null ? wallGross * (e.openingsPct / 100) : p.windowAreaTotal + doorsArea
  const wallNet = Math.max(0, wallGross - openingsArea)

  // ring beam (masonry) — per floor
  const ringBeamVol = isMasonry ? Lb * C.ringBeam.w * C.ringBeam.h * p.floors : 0
  // seismic cores (tuff/brick only) — full height
  const coreCount = Math.ceil(Lb / C.seismicCoreStep)
  const coresActive = isMasonry && (wallMat === 'tuff' || wallMat === 'brick') && !p.seismicReinforcementDisabled
  const coreVol = coresActive ? coreCount * C.seismicCore.w * C.seismicCore.h * H : 0

  if (isMasonry) {
    addStruct('walls', ringBeamVol, C.rebar.ringBeam)
    if (coreVol > 0) addStruct('walls', coreVol, C.rebar.seismicCore)
    // masonry volume minus embedded RC (avoid double count)
    let masonryVol = wallNet * wallT - ringBeamVol - coreVol
    masonryVol = Math.max(0, masonryVol) * waste
    add(masonryKey(wallMat), 'walls', 'act', masonryVol)
    // mortar / glue
    if (wallMat === 'aerated') add('glue_aerated', 'walls', 'act', masonryVol * C.glueShare)
    else add('mortar', 'walls', 'act', masonryVol * C.mortarShare)
  } else {
    // frame: columns + beams + infill
    const nx = Math.floor(p.length / C.columnGridStep) + 1
    const ny = Math.floor(p.width / C.columnGridStep) + 1
    const nCol = ov(e.columns) ?? nx * ny
    addStruct('frame', nCol * colSize * colSize * H, C.rebar.column)
    const beamsLen = ov(e.beamsLen) ?? Lb * p.floors
    addStruct('frame', beamsLen * beamSectionArea, C.rebar.ringBeam)
    const infillVol = Math.max(0, wallNet * wallT) * waste
    add(masonryKey(wallMat), 'walls', 'act', infillVol)
    if (wallMat === 'aerated') add('glue_aerated', 'walls', 'act', infillVol * C.glueShare)
    else add('mortar', 'walls', 'act', infillVol * C.mortarShare)
  }

  // ---- Lintels over openings ----
  const openingCount = Math.ceil(p.windowAreaTotal / 3) + p.exteriorDoors
  const lintelLen = openingCount * (1.5 + 0.5)
  addStruct('walls', lintelLen * C.lintel.w * C.lintel.h, C.rebar.lintel)

  // ---- Floors / ceilings ----
  const slabArea = Math.max(0, A * p.floors - hallVoid)
  if (p.floorSlab === 'monolith') {
    addStruct('floors', slabArea * floorSlabT, C.rebar.floor)
  } else {
    const count = Math.ceil(slabArea / C.precastSlabArea)
    add('precast_slab', 'floors', 'act', count)
  }

  // ---- Beams over the double-height hall ----
  if (hallVoid > 0 && p.beamsOverHall) {
    const beamLen = Math.sqrt(hallVoid) * 2 // пара балок через проём
    addStruct('floors', beamLen * 0.3 * 0.4, C.rebar.floor)
  }

  // ---- Stair ----
  if (p.floors >= 2) {
    add('stair', 'stair', 'act', (p.floors - 1) * C.stairVolumePerFlight)
  }

  // ---- Rough screed (act) ----
  add('screed', 'floors', 'act', Math.max(0, totalFloorArea - hallVoid))

  // ---- Roof (flat / pitched / hip / mansard) ----
  if (p.roof === 'flat') {
    add('roof_flat', 'roof', 'act', A)
    add('waterproofing', 'roof', 'act', A)
    add('insulation', 'roof', 'act', A)
  } else {
    // real slope: footprint / cos(angle) + eaves overhang, ×shape factor
    const rad = (Math.min(Math.max(p.roofPitchDeg, 5), 75) * Math.PI) / 180
    const shape = p.roof === 'mansard' ? 1.15 : p.roof === 'hip' ? 1.05 : 1
    const roofArea = (A / Math.cos(rad) + P * 0.5) * shape
    add('roof_pitched', 'roof', 'act', roofArea)
    add('insulation', 'roof', 'act', roofArea)
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
  add('aerated_block', 'partitions', 'turnkey', partitionArea * C.partitionThickness)

  // Plaster: interior bearing-wall face + partitions both sides + ceilings (minus hall void)
  const plasterArea = wallNet + partitionArea * 2 + Math.max(0, totalFloorArea - hallVoid)
  add('plaster', 'finishing', 'turnkey', plasterArea)
  add('floor_finish', 'finishing', 'turnkey', Math.max(0, totalFloorArea - hallVoid))

  // Facade (outer walls only) + facade insulation
  const facadeArea = Math.max(0, P * H - p.windowAreaTotal)
  add('facade', 'facade', 'turnkey', facadeArea)
  add('insulation', 'facade', 'turnkey', facadeArea)

  // Engineering networks (per m2 total area)
  add('electrical', 'engineering', 'turnkey', totalFloorArea)
  add('plumbing', 'engineering', 'turnkey', totalFloorArea)
  add('heating', 'engineering', 'turnkey', totalFloorArea)

  // ---- Documents / permit (act) ----
  if (p.includePermitCost) {
    add('permit_apz', 'permit', 'act', 1)
    add('permit_design', 'permit', 'act', totalFloorArea)
    add('permit_geology', 'permit', 'act', 1)
    add('permit_expertise', 'permit', 'act', 1)
    add('permit_fee', 'permit', 'act', 1)
    add('permit_address', 'permit', 'act', 1)
    add('permit_supervision', 'permit', 'act', totalFloorArea)
  }

  // ---- Aggregate structural concrete + rebar, per section ----
  // reinforcement grows with number of floors (seismic/loads)
  const rebarFloorK = 1 + C.rebarFloorFactor * Math.max(0, p.floors - 1)
  let rebarKg = 0
  for (const key of Object.keys(concreteBySection) as SectionId[]) {
    const vol = concreteBySection[key] ?? 0
    if (vol > 0) lines.push({ key: p.concreteGrade, section: key, stage: 'act', quantity: vol })
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
    netFloorArea: Math.max(0, totalFloorArea - hallVoid),
    wallGross,
    openingsArea,
    wallNet,
  }

  return { lines, geometry, rebarKg }
}
