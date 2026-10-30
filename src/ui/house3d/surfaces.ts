// Surfaces of the brick house model, by glTF material name.
//
// The model comes out of Blender with flat colours only; here every visible
// surface gets a Poly Haven CC0 texture set instead (public/models/tex/,
// built by scripts/house-3d-assets.sh). Materials not listed (furniture,
// sanitary ware, fabrics) keep what the glTF gives them.
//
// UVs in the model are in metres, so a texture's repeat is 1 / its real size.

export type TexSet = 'stone' | 'paving' | 'oak' | 'planks' | 'floor' | 'metal' | 'plaster' | 'grass'

// Real size of one texture tile, metres (Poly Haven's own scan dimensions).
export const TEX_SIZE: Record<TexSet, number> = {
  stone: 2.0,
  paving: 1.85,
  oak: 1.83,
  planks: 2.0,
  floor: 1.7,
  metal: 2.0,
  plaster: 2.0,
  grass: 2.0,
}

// metal ships without a colour map: the scan is red corrugated sheet, the
// roof is graphite standing seam, so only its relief and roughness are used.
export const HAS_DIFFUSE: Record<TexSet, boolean> = {
  stone: true,
  paving: true,
  oak: true,
  planks: true,
  floor: true,
  metal: false,
  plaster: true,
  grass: true,
}

export interface Surface {
  set?: TexSet
  // Override of the tile size when the real finish is a larger format than
  // the scan (travertine slabs are ~60 cm, the granite scan tiles are 40 cm).
  size?: number
  color: number
  roughness: number
  metalness?: number
  normal?: number
}

// The colours multiply the texture. Several scans were desaturated when the
// set was built (stone, paving), so they take their hue from here.
export const SURFACES: Record<string, Surface> = {
  // Facade: Ararat travertine, basalt-grey plinth, walnut panelling upstairs
  Facade_Travertine: { set: 'stone', size: 3.0, color: 0xeadfca, roughness: 1, normal: 0.7 },
  Facade_Plinth: { set: 'stone', size: 2.0, color: 0x9f9a90, roughness: 1 },
  Facade_WoodPanel: { set: 'oak', color: 0x75655b, roughness: 0.9 },
  Soffit_Wood: { set: 'oak', color: 0xb48d6c, roughness: 0.9 },
  Door_Entrance: { set: 'oak', color: 0x5e4f46, roughness: 0.8 },
  Pergola_Wood: { set: 'planks', color: 0xd2c2b0, roughness: 1 },

  Roof_MetalSeam: { set: 'metal', color: 0x3b3e43, roughness: 1, metalness: 0.55 },
  Fascia_Metal: { color: 0x2f3135, roughness: 0.45, metalness: 0.5 },
  Window_Frame: { color: 0x25272b, roughness: 0.4, metalness: 0.4 },
  Railing_Steel: { color: 0x2b2d31, roughness: 0.35, metalness: 0.7 },

  // Inside
  Wall_Paint: { set: 'plaster', color: 0xf2ede5, roughness: 1, normal: 0.3 },
  Ceiling_Paint: { set: 'plaster', color: 0xf7f4ef, roughness: 1, normal: 0.2 },
  Floor_Oak: { set: 'floor', color: 0xffffff, roughness: 0.85 },
  Stair_Wood: { set: 'floor', color: 0xf0e6dc, roughness: 0.85 },
  Floor_Stone: { set: 'stone', color: 0xddd6ca, roughness: 0.55 },
  Floor_Tile: { set: 'stone', size: 1.2, color: 0xe4e2de, roughness: 0.5 },

  // Site
  Paving: { set: 'paving', size: 3.0, color: 0xdcd9d2, roughness: 1 },
  Paving_Terrace: { set: 'paving', size: 3.0, color: 0xd4cfc5, roughness: 1 },
  Paving_Drive: { set: 'paving', color: 0xa3a09a, roughness: 1 },
  Lawn: { set: 'grass', size: 2.5, color: 0xbfcca6, roughness: 1 },
  Fence_Render: { set: 'plaster', color: 0xdad4c9, roughness: 1, normal: 0.6 },
  Concrete: { set: 'plaster', color: 0xa09d97, roughness: 1 },
  Pool_Shell: { set: 'stone', size: 1.0, color: 0xc4dde0, roughness: 0.4 },
  Soil: { color: 0x5a4535, roughness: 1 },
}
