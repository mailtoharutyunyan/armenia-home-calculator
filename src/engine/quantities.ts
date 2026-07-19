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
  totalFloorArea: number // A_общ
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
  const cm = (v?: number) => (v != null ? v / 100 : undefined)
  const e = p.eng
  const stripLen = e.stripLen ?? Lb
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

  // double-height hall: void in the 2nd-floor slab + extra wall height
  const hallVoid = p.doubleHeightHall && p.floors >= 2 ? Math.min(p.hallArea, A) : 0
  const extraHallWall = hallVoid > 0 ? 4 * Math.sqrt(hallVoid) * p.floorHeight : 0

  // structural concrete + rebar accumulators
  let structConcrete = 0 // m3, priced at p.concreteGrade
  let rebarKg = 0
  const addStruct = (vol: number, rebarPerM3: number) => {
    structConcrete += vol
    rebarKg += vol * rebarPerM3
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
    addStruct(stripLen * stripW * stripH, C.rebar.strip)
  } else if (p.foundation === 'slab') {
    addStruct(A * C.slabThickness, C.rebar.slab)
  } else if (p.foundation === 'pile') {
    const n = stripLen / C.foundationAxisStep
    const pileVol = n * (Math.PI / 4) * C.pile.d ** 2 * C.pile.length
    const grillage = stripLen * stripW * 0.4
    addStruct(pileVol + grillage, C.rebar.pile)
  } else {
    // column
    const n = stripLen / C.foundationAxisStep
    addStruct(n * colSize * colSize * C.columnFoundationHeight, C.rebar.pile)
  }

  // ---- Basement walls ----
  if (p.basement) {
    addStruct(P * basementWallT * p.basementDepth, C.rebar.basementWall)
  }

  // ---- Foundation waterproofing + apron ----
  const plinthHeight = p.basement ? p.basementDepth : 0.5
  add('waterproofing', 'foundation', 'act', Lb * plinthHeight)
  add('apron', 'foundation', 'act', P * C.apronWidth)

  // ---- Walls / frame ----
  const wallGross = Lb * H + extraHallWall
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
    addStruct(ringBeamVol, C.rebar.ringBeam)
    if (coreVol > 0) addStruct(coreVol, C.rebar.seismicCore)
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
    const nCol = e.columns ?? nx * ny
    addStruct(nCol * colSize * colSize * H, C.rebar.column)
    const beamsLen = e.beamsLen ?? Lb * p.floors
    addStruct(beamsLen * beamSectionArea, C.rebar.ringBeam)
    const infillVol = Math.max(0, wallNet * wallT) * waste
    add(masonryKey(wallMat), 'walls', 'act', infillVol)
    if (wallMat === 'aerated') add('glue_aerated', 'walls', 'act', infillVol * C.glueShare)
    else add('mortar', 'walls', 'act', infillVol * C.mortarShare)
  }

  // ---- Lintels over openings ----
  const openingCount = Math.ceil(p.windowAreaTotal / 3) + p.exteriorDoors
  const lintelLen = openingCount * (1.5 + 0.5)
  addStruct(lintelLen * C.lintel.w * C.lintel.h, C.rebar.lintel)

  // ---- Floors / ceilings ----
  const slabArea = Math.max(0, A * p.floors - hallVoid)
  if (p.floorSlab === 'monolith') {
    addStruct(slabArea * floorSlabT, C.rebar.floor)
  } else {
    const count = Math.ceil(slabArea / C.precastSlabArea)
    add('precast_slab', 'floors', 'act', count)
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
    const roofArea = A * (C.roofFactor[p.roof] ?? C.pitchedRoofFactor)
    add('roof_pitched', 'roof', 'act', roofArea)
    add('insulation', 'roof', 'act', roofArea)
    // gable walls: full for a gable/pitched roof, half for mansard, none for hip
    const gableMult = p.roof === 'pitched' ? 1 : p.roof === 'mansard' ? 0.5 : 0
    if (gableMult > 0) {
      const gableVol =
        ((p.width ** 2 * Math.tan((p.roofPitchDeg * Math.PI) / 180)) / 4) * 2 * (wallT / 2) * gableMult
      add(masonryKey(wallMat), 'roof', 'act', Math.max(0, gableVol))
    }
  }

  // ================= TURNKEY =================
  // Windows
  add('window_regular', 'openings', 'turnkey', p.windowAreaTotal * (1 - p.vitrageShare))
  add('window_vitrage', 'openings', 'turnkey', p.windowAreaTotal * p.vitrageShare)
  // Doors
  add('door_exterior', 'openings', 'turnkey', p.exteriorDoors)
  const interiorDoors =
    p.interiorDoors ?? Math.round(p.floors * (A / 20))
  add('door_interior', 'openings', 'turnkey', interiorDoors)

  // Partitions (aerated block) + plaster
  const partitionArea = C.partitionFactor * P * H
  add('aerated_block', 'partitions', 'turnkey', partitionArea * C.partitionThickness)

  // Plaster: interior bearing-wall face + partitions both sides + ceilings
  const plasterArea = wallNet + partitionArea * 2 + totalFloorArea
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

  // ---- reinforcement grows with number of floors (seismic/loads) ----
  rebarKg *= 1 + C.rebarFloorFactor * Math.max(0, p.floors - 1)

  // ---- Aggregate structural concrete + rebar ----
  if (structConcrete > 0) {
    lines.push({ key: p.concreteGrade, section: 'foundation', stage: 'act', quantity: structConcrete })
  }
  if (rebarKg > 0) {
    lines.push({ key: 'rebar_a500', section: 'foundation', stage: 'act', quantity: rebarKg / 1000 })
  }

  const geometry: Geometry = {
    footprint: A,
    perimeter: P,
    bearingLength: Lb,
    wallHeight: H,
    totalFloorArea,
    wallGross,
    openingsArea,
    wallNet,
  }

  return { lines, geometry, rebarKg }
}
