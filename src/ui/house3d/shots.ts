// Camera positions of the 3D tab, in model metres (Y up, origin at the
// front-left corner of the house, street towards +z).
//
// Outside views come from the gallery renders (home-3d/brick/cameras.json,
// Blender Z-up turned into Y-up), stepped back for a 45° lens. Inside views
// stand at eye height in the rooms of the calculator's own plan for the brick
// house: plan (x, y) is model (x, y − 10.835), the ground floor is at 0.45 m,
// the upper floor at 3.85 m.

export interface Shot {
  pos: [number, number, number]
  target: [number, number, number]
  fov?: number
  // Inside a room the camera turns on the spot instead of orbiting the house.
  inside?: boolean
}

export const HERO: Shot = { pos: [26.5, 7.2, 22.5], target: [8.6, 2.4, -3.6] }
export const FLOORS_VIEW: Shot = { pos: [25.5, 10.5, 15.5], target: [9.2, 2.6, -4.6] }
// The whole plot from above the street, as in the aerial render.
export const OVERVIEW: Shot = { pos: [8.7, 17.5, 20.5], target: [8.7, 0.5, -2.8] }

export type FeatureId = 'terrace' | 'pool' | 'carport' | 'windows' | 'stair'

export const FEATURES: { id: FeatureId; shot: Shot }[] = [
  { id: 'terrace', shot: { pos: [-1.9, 2.5, 4.2], target: [2.3, 1.3, -5.4] } },
  { id: 'pool', shot: { pos: [11.8, 3.6, 2.2], target: [4.4, 0.3, 5.4] } },
  { id: 'carport', shot: { pos: [19.8, 3.6, 7.3], target: [19.1, 1.4, -5.0] } },
  { id: 'windows', shot: { pos: [12.6, 2.0, 7.3], target: [10.2, 3.5, -1.0], fov: 55 } },
  { id: 'stair', shot: { pos: [10.6, 2.0, -2.3], target: [10.9, 1.9, -9.0], fov: 62, inside: true } },
]

export type RoomView = 'living' | 'hall' | 'bedroom' | 'bedroomUp' | 'stairHall' | 'office'

// Two or three points per floor, placed on the plan card at the camera.
export const ROOM_VIEWS: Record<1 | 2, { id: RoomView; shot: Shot }[]> = {
  1: [
    { id: 'living', shot: { pos: [8.9, 2.0, -1.3], target: [4.6, 1.5, -8.4], fov: 62, inside: true } },
    { id: 'hall', shot: { pos: [10.5, 2.0, -2.3], target: [10.8, 2.0, -9.0], fov: 62, inside: true } },
    { id: 'bedroom', shot: { pos: [16.6, 2.0, -2.2], target: [13.0, 1.4, -4.8], fov: 62, inside: true } },
  ],
  2: [
    { id: 'bedroomUp', shot: { pos: [7.6, 5.4, -5.9], target: [4.4, 4.85, -2.4], fov: 62, inside: true } },
    { id: 'stairHall', shot: { pos: [13.5, 5.4, -5.6], target: [10.5, 3.8, -8.5], fov: 62, inside: true } },
    { id: 'office', shot: { pos: [16.7, 5.4, -2.2], target: [13.2, 4.9, -4.7], fov: 62, inside: true } },
  ],
}

// Depth of the plan along z: plan y = model z + PLAN_DEPTH.
export const PLAN_DEPTH = 10.835
