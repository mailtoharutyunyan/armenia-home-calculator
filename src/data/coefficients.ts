// Engineering coefficients — editable defaults, documented in the design spec.
// These are rules of thumb, NOT a substitute for a licensed structural design.

export const COEFF = {
  // thicknesses / sections (m)
  stripWidth: 0.4,
  stripHeight: 0.8,
  slabThickness: 0.3,
  basementWallThickness: 0.3,
  floorSlabThickness: 0.18, // ≥180 мм (норма для монолитных перекрытий каркаса)
  screedThickness: 0.05,
  ringBeam: { w: 0.3, h: 0.2 },
  seismicCore: { w: 0.25, h: 0.25 },
  lintel: { w: 0.25, h: 0.2 },
  columnSection: { w: 0.4, h: 0.4 },
  columnFoundationHeight: 1.5,
  partitionThickness: 0.1,
  pile: { d: 0.3, length: 3 },

  // grid / geometry
  columnGridStep: 4, // m
  foundationAxisStep: 2, // m (piles/columns spacing)
  seismicCoreStep: 3, // m
  internalBearingFactor: 0.5, // internal bearing wall length = factor * perimeter
  partitionFactor: 0.8, // partition length = factor * perimeter
  pitchedRoofFactor: 1.3,
  roofFactor: { flat: 1.0, pitched: 1.3, hip: 1.4, mansard: 1.55 } as Record<string, number>,
  // рост армирования несущих конструкций с этажностью (сейсмика/нагрузки)
  rebarFloorFactor: 0.07, // +7% арматуры на каждый этаж свыше первого
  wasteFactor: 1.05, // +5% cut/waste on piece/linear materials

  // rebar (kg/m3) per element
  rebar: {
    strip: 80,
    slab: 100,
    pile: 90,
    column: 170, // seismic
    floor: 110,
    ringBeam: 100,
    seismicCore: 150,
    lintel: 120,
    basementWall: 90,
    stair: 110,
    monolithWall: 130, // несущая монолитная ж/б стена — плотное сейсмоармирование (ՀՀՇՆ II-6.02)
  },

  // masonry mortar / glue (share of masonry volume)
  mortarShare: 0.2, // tuff / brick
  glueShare: 0.025, // aerated block

  // earthworks
  backfillFactor: 0.6, // backfill = factor * excavation
  sandBedThickness: 0.1,
  blindingThickness: 0.05, // подбетонка
  apronWidth: 1.0, // отмостка

  // finish level multipliers (applied to finishing sections)
  finishMultiplier: { economy: 0.8, standard: 1.0, premium: 1.6 },

  // block volumes (m3) for count estimation
  blockVolume: { tuff: 0.02, aerated: 0.036, brick: 0.0019 },
  precastSlabArea: 5.4, // m2 per ПК slab (typ 1.2 x 4.5)

  // economics
  contingency: 0, // резерв отключён (было 0.12)
  vatRate: 0.2,
  // полный монолит трудозатратнее (опалубка, вязка, бетонирование стен) — надбавка к работе бригады
  monolithLabourFactor: 1.25,

  // engineering-network cost is priced per m2 of total floor area (see prices)
  stairVolumePerFlight: 2.5, // m3

  // norm thresholds
  norms: {
    maxCoveragePct: 40,
    minSetback: 3,
    minRoomHeight: 2.7,
    maxRoomHeight: 3.5,
    maxGlazingPct: 40,
    minLightRatio: 1 / 8,
    simplifiedMaxFloors: 2,
    simplifiedMaxArea: 300,
    maxMasonryFloorsSeismic8: 3,
    maxMasonryFloorsSeismic9: 2,
    masonryMaxFloorHeight8: 5, // м, макс. высота этажа несущей кладки при 8 баллах
    masonryMaxFloorHeight9: 4, // м, при 9 баллах
    minStructuralConcreteGrade: 25, // B25
    maxAspectRatio: 2,
    tuffMinThickness: 0.4,
    brickMinThickness: 0.38,
    minRoomArea: 8, // ՀՀՇՆ 31-01-2014, м²
    usableRatio: 0.8, // доля полезной площади этажа (за вычетом стен/коридоров)
    combinedKitchenLivingMin: 18, // м², студия зал+кухня
  },
}

export type Coefficients = typeof COEFF
