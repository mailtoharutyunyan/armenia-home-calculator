import type { HouseParams } from '../model/house'
import { topShare } from '../model/house'
import { scaleFootprint, subtractRects } from './footprint'
import type { FRect } from './footprint'
import { COEFF as C } from '../data/coefficients'

export type RoomType =
  | 'living'
  | 'living_kitchen'
  | 'kitchen'
  | 'dining'
  | 'bedroom'
  | 'bath'
  | 'stair'
  | 'wardrobe'
  | 'office' // кабинет / рабочая комната
  | 'hall' // прихожая / тамбур у входа
  | 'corridor' // коридор, связывает прихожую с комнатами
  | 'utility' // техпомещение: газовый котёл, стиральная машина, кладовая

export interface Room {
  x: number
  y: number
  w: number
  h: number
  type: RoomType
  label: string
  open?: boolean // open to below (двусветный зал) — no floor on this level
  doubleHeight?: boolean // помещение в два света: пол есть, но потолок на два этажа
  // Сторона, отделённая раздвижной стеклянной перегородкой (не глухая стена).
  glassSide?: 'top' | 'bottom' | 'left' | 'right'
  gallery?: boolean // balcony walkway overlooking the hall (open railing on the void side)
}

export interface Door {
  orient: 'v' | 'h' // v: wall is vertical (x=pos); h: wall is horizontal (y=pos)
  pos: number // wall coordinate
  start: number // opening start along the wall
  w: number // opening width
  swing: 1 | -1 // direction the leaf opens
  // 'opening': a doorway with no leaf, between two circulation spaces
  kind: 'entrance' | 'interior' | 'opening'
}

export interface FloorPlan {
  ceilingH?: number // высота этажа, м
  hallCeilingH?: number // высота двусветного зала, м
  glassPartitionLen?: number // пог.м раздвижных стеклянных перегородок
  L: number
  W: number
  wall: number
  partition: number // interior partition thickness, m
  rooms: Room[]
  // x/y: the wall line the window sits in (0, L or W for the outer walls)
  windows: { x: number; y: number; len: number; side: 'top' | 'bottom' | 'left' | 'right' }[]
  doors: Door[]
  // The floor's outer outline when the house is not one rectangle (outer
  // faces of the walls); without it the outline is the L × W sheet.
  outline?: FRect[]
  // A top storey over part of the house: the roof of the floor below beside
  // the built part.
  roofs?: { rects: FRect[]; label: string }
  // open terraces beside the house, as the drawings show them
  terraces?: { rects: FRect[]; label: string }
}

export interface Spec {
  type: RoomType
  weight: number
  label: string
}

// The default room program derived from house params (also seeds the editor).
export function autoProgram(p: HouseParams, floorIndex = 0): Spec[] {
  const specs: Spec[] = []
  const isGround = floorIndex === 0
  const bedrooms = Math.max(1, p.roomsPerFloor - 1)
  if (isGround) {
    if (p.kitchenLivingCombined) {
      specs.push({ type: 'living_kitchen', weight: 2.2, label: 'Гостиная-кухня' })
    } else {
      specs.push({ type: 'living', weight: 1.7, label: 'Гостиная' })
      specs.push({ type: 'kitchen', weight: 1.1, label: 'Кухня' })
    }
    if (p.floors >= 2) specs.push({ type: 'stair', weight: 0.5, label: 'Лестница' })
    specs.push({ type: 'bath', weight: 0.7, label: 'Санузел' })
    // Мастер-спальня остаётся на первом этаже — со своим санузлом и
    // гардеробом. Остальные спальни уходят наверх: низ общественный,
    // верх приватный.
    specs.push({ type: 'bedroom', weight: 1.2, label: 'Мастер-спальня' })
    if (p.floors === 1) {
      for (let i = 1; i < Math.max(1, bedrooms); i++) specs.push({ type: 'bedroom', weight: 1.2, label: `Комната ${i + 1}` })
    }
  } else {
    // Второй этаж приватный: детские + один кабинет для работы + санузел.
    // Мастер-спальня уже внизу, поэтому наверх она не дублируется.
    const kids = Math.max(1, p.roomsPerFloor - 1)
    for (let i = 0; i < kids; i++) specs.push({ type: 'bedroom', weight: 1.2, label: `Детская ${i + 1}` })
    specs.push({ type: 'office', weight: 1.0, label: 'Кабинет' })
    specs.push({ type: 'stair', weight: 0.5, label: 'Лестница' })
    specs.push({ type: 'bath', weight: 0.7, label: 'Санузел' })
  }
  return specs
}

// Build a furnished layout. If `custom` specs are provided (editor), use them.
export interface PlanLabels {
  voidLabel?: string
  corridorLabel?: string
  wardrobeLabel?: string
  ensuiteLabel?: string
  hallLabel?: string
  officeLabel?: string
  diningLabel?: string
  livingLabel?: string
  utilityLabel?: string
  lang?: 'ru' | 'hy' | 'en' // the template plan names its rooms in this language
}

// Планировочные правила. Это не вкусовщина: каждое взято из практики
// проектирования жилья и объяснено.
const PLAN = {
  // Входить с улицы прямо в гостиную нельзя: холод, грязь, нет места раздеться.
  // 1.7 м — это коридор, по которому расходятся двери, а не ещё одна комната.
  // При 2.3 м полоса начинала читаться как помещение и съедала площадь.
  hallDepth: 1.7, // м, глубина прихожей и коридорной полосы
  hallWidth: 2.8, // м, ширина прихожей
  // Комната глубже ~7.5 м без света с двух сторон плохо освещается и не
  // читается как комната. Крупную студию делим на кухню-столовую и гостиную.
  maxRoomDepth: 7.5, // м
  maxStudioArea: 60, // м²
  // Одно окно на каждые ~3.5 м наружной стены комнаты, минимум одно.
  windowPerMeters: 3.5,
  windowWidth: 1.4, // м
  minCorridor: 1.2, // м, минимальная ширина коридора
  // Отношение ширина/глубина двусветного зала. 0.8 даёт для 80 м² схему 8 × 10.
  hallAspect: 0.8,
  // Глубина кухни-столовой в плане. НЕ путать с высотой потолка: потолок
  // кухни равен высоте этажа (у зала он двойной). Раньше сюда по ошибке было
  // записано «3 м» из условия «кухня 3 метра высотой», и кухня вырождалась
  // в полосу 8×3 с соотношением 1:2.8.
  kitchenMinDepth: 3.6, // м
  kitchenMaxRatio: 2.4, // кухня-столовая линейная по природе, но не бесконечная
  // Service column beside the hall: entry, WC, a two-flight stair (2 × 1.0 m +
  // gap) and a master bedroom at least 3 m wide still fit into 3.3 m.
  minServiceColumn: 3.3, // м
  galleryWidth: 1.4, // м, gallery along the void: ≥ 1.2 m clear of the partition
  minRoomSide: 2.7, // м, shortest side of a bedroom or study
  // A kitchen-dining past ~36 m² is a long strip that is mostly passage. The
  // end by the service column becomes the utility room a gas-heated house
  // needs anyway: boiler (with its window and vent), washer, storage.
  maxKitchenDining: 36, // м², by axes
  utilityWidth: 2.5, // м
}

// Прямоугольник двусветного объёма. Считается ОДИН раз и используется обоими
// этажами: на первом это зал, на втором — проём в перекрытии. Раньше этаж 1 и
// этаж 2 строились независимо, и проём наверху не совпадал с залом внизу —
// по чертежу невозможно было понять, правильно ли это.
function voidRect(inner: Rect, hallArea: number, partition = 0): Rect {
  // Зал строится прямоугольником нормальных пропорций и ставится в передний
  // угол — окнами на улицу. Раньше это была полоса во всю глубину дома
  // (6.3 × 12.6), из-за чего комната была длинной и неосвещаемой в глубине.
  // Отношение ширины к глубине 0.8: для 80 м² даёт ровно 8 × 10 м.
  // Дом может быть слишком мал для двусветного зала с кухней вдоль задней
  // стены. Раньше вычитание глубины кухни уходило в минус, и зал получал
  // отрицательные размеры, которые расползались по всему плану.
  const usableH = inner.h - PLAN.kitchenMinDepth
  if (inner.w <= 0 || usableH <= 0.8) return { x: inner.x, y: inner.y, w: 0, h: 0 }
  const area = Math.min(hallArea, inner.w * inner.h * 0.62)
  if (area <= 0) return { x: inner.x, y: inner.y, w: 0, h: 0 }
  // Exact proportions first, in either orientation: 80 m² is a clear 8 × 10 or
  // 10 × 8 room, the rectangle running along the partition axes (half a
  // partition wider on its two inner sides). It must leave the kitchen its
  // depth behind it and a service column that still holds the stair.
  const half = partition / 2
  const longSide = Math.sqrt(area / PLAN.hallAspect)
  const shortSide = area / longSide
  for (const [cw, ch] of [[shortSide, longSide], [longSide, shortSide]]) {
    const aw = cw + half
    const ah = ch + half
    if (aw <= inner.w - PLAN.minServiceColumn && ah <= usableH) {
      return { x: inner.x, y: inner.y + inner.h - ah, w: aw, h: ah }
    }
  }
  let w = Math.sqrt(area * PLAN.hallAspect)
  let h = area / w
  // не вылезаем за габарит, оставляя место под служебную полосу
  w = Math.min(w, inner.w * 0.68)
  h = Math.min(area / w, inner.h)
  w = Math.min(area / h, inner.w * 0.68)
  // Кухня идёт полосой вдоль задней стены, поэтому зал не может быть глубже,
  // чем внутренний габарит минус глубина кухни. Заданные 10 + 3 = 13 м — это
  // размер по осям; внутри стен остаётся 12.6, и глубина ужимается.
  // Оставляем под кухню-столовую хотя бы её минимальную глубину.
  h = Math.max(0.8, Math.min(h, usableH))
  w = Math.max(0.8, Math.min(inner.w * 0.68, area / h))
  // передний угол: низ листа — главный фасад
  return { x: inner.x, y: inner.y + inner.h - h, w, h }
}

// Clear size of a room, as norms and plans state it. Rooms tile the space
// inside the external walls along partition centre lines, so each side shared
// with another room gives up half a partition; external walls are already
// outside the tiling.
export function roomClear(r: Room, plan: Pick<FloorPlan, 'L' | 'W' | 'wall' | 'partition'>): { w: number; h: number; area: number } {
  const e = 1e-6
  const half = plan.partition / 2
  const sidesX = (r.x > plan.wall + e ? 1 : 0) + (r.x + r.w < plan.L - plan.wall - e ? 1 : 0)
  const sidesY = (r.y > plan.wall + e ? 1 : 0) + (r.y + r.h < plan.W - plan.wall - e ? 1 : 0)
  const w = Math.max(0, r.w - half * sidesX)
  const h = Math.max(0, r.h - half * sidesY)
  return { w, h, area: w * h }
}

// What the estimate takes from a drawn floor, in running metres: partitions
// (walls between rooms, and between a room and the void), the sliding glass
// partition, railings along the void, and doors with a leaf. Hall, corridor and
// stair run into each other through open doorways, so no wall is counted between
// them; a gallery or landing is railed along the void; any other room is walled.
// Parts of one room: a hall or a stair drawn as several rectangles, its
// extra parts carrying no label. No wall stands between them.
export function sameSpace(a: Room, b: Room): boolean {
  return a.type === b.type && (!a.label || !b.label)
}

export function planTakeoff(plan: FloorPlan): {
  partitions: number
  glass: number
  railing: number
  leafDoors: number
  baths: number
  bathPerimeter: number
  voidArea: number
  radiators: number
  sockets: number
  lights: number
  waterPoints: number
  sewerPoints: number
  exhaustFans: number
} {
  const e = 0.02
  const circulation = (t: RoomType) => t === 'hall' || t === 'corridor' || t === 'stair'
  // the side of `a` that `b` touches, and the length they share
  const shared = (a: Room, b: Room): { side: Room['glassSide']; len: number } | null => {
    const oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y)
    const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)
    if (oy > e && Math.abs(a.x + a.w - b.x) < e) return { side: 'right', len: oy }
    if (oy > e && Math.abs(b.x + b.w - a.x) < e) return { side: 'left', len: oy }
    if (ox > e && Math.abs(a.y + a.h - b.y) < e) return { side: 'bottom', len: ox }
    if (ox > e && Math.abs(b.y + b.h - a.y) < e) return { side: 'top', len: ox }
    return null
  }
  const opposite = { top: 'bottom', bottom: 'top', left: 'right', right: 'left' } as const
  const leafOnWall = (a: Room, b: Room) =>
    plan.doors.some((d) => {
      if (d.kind !== 'interior') return false
      const onV = d.orient === 'v' && (Math.abs(d.pos - (a.x + a.w)) < e && Math.abs(d.pos - b.x) < e || Math.abs(d.pos - a.x) < e && Math.abs(d.pos - (b.x + b.w)) < e)
      const onH = d.orient === 'h' && (Math.abs(d.pos - (a.y + a.h)) < e && Math.abs(d.pos - b.y) < e || Math.abs(d.pos - a.y) < e && Math.abs(d.pos - (b.y + b.h)) < e)
      if (!onV && !onH) return false
      const [from, to] = onV ? [Math.max(a.y, b.y), Math.min(a.y + a.h, b.y + b.h)] : [Math.max(a.x, b.x), Math.min(a.x + a.w, b.x + b.w)]
      return d.start >= from - e && d.start + d.w <= to + e
    })
  // length of the doorways without a leaf on the wall between a and b
  const openingOnWall = (a: Room, b: Room) =>
    plan.doors
      .filter((d) => d.kind === 'opening')
      .filter((d) => {
        const onV = d.orient === 'v' && (Math.abs(d.pos - (a.x + a.w)) < e && Math.abs(d.pos - b.x) < e || Math.abs(d.pos - a.x) < e && Math.abs(d.pos - (b.x + b.w)) < e)
        const onH = d.orient === 'h' && (Math.abs(d.pos - (a.y + a.h)) < e && Math.abs(d.pos - b.y) < e || Math.abs(d.pos - a.y) < e && Math.abs(d.pos - (b.y + b.h)) < e)
        if (!onV && !onH) return false
        const [from, to] = onV ? [Math.max(a.y, b.y), Math.min(a.y + a.h, b.y + b.h)] : [Math.max(a.x, b.x), Math.min(a.x + a.w, b.x + b.w)]
        return d.start >= from - e && d.start + d.w <= to + e
      })
      .reduce((sum, d) => sum + d.w, 0)
  let partitions = 0
  let glass = 0
  let railing = 0
  const rooms = plan.rooms
  for (let i = 0; i < rooms.length; i++) {
    for (let j = i + 1; j < rooms.length; j++) {
      const a = rooms[i]
      const b = rooms[j]
      const s = shared(a, b)
      if (!s || (a.open && b.open) || sameSpace(a, b)) continue
      if (a.open || b.open) {
        const room = a.open ? b : a
        if (room.type === 'hall' || room.type === 'corridor') railing += s.len
        else partitions += s.len
      } else if (a.glassSide === s.side || (s.side && b.glassSide === opposite[s.side])) {
        glass += s.len
      } else if (!(circulation(a.type) && circulation(b.type)) || leafOnWall(a, b)) {
        // circulation spaces are open to each other, unless a door with a
        // leaf (a vestibule) shows there is a wall between them; a room open
        // to its neighbour across a wide doorway has no wall there
        partitions += Math.max(0, s.len - openingOnWall(a, b))
      }
    }
  }
  // the sliding glass partition is itself the door between kitchen and hall
  const inGlass = (d: Door) =>
    rooms.some((r) => {
      if (!r.glassSide) return false
      const horizontal = r.glassSide === 'top' || r.glassSide === 'bottom'
      if ((d.orient === 'h') !== horizontal) return false
      const pos = r.glassSide === 'top' ? r.y : r.glassSide === 'bottom' ? r.y + r.h : r.glassSide === 'left' ? r.x : r.x + r.w
      const [from, len] = horizontal ? [r.x, r.w] : [r.y, r.h]
      return Math.abs(d.pos - pos) < e && d.start >= from - e && d.start + d.w <= from + len + e
    })
  const leafDoors = plan.doors.filter((d) => d.kind === 'interior' && !inGlass(d)).length
  // wet rooms: each gets sanitary ware, and its walls are tiled
  const wet = rooms.filter((r) => r.type === 'bath')
  const bathPerimeter = wet.reduce((a, r) => a + 2 * (r.w + r.h), 0)
  // the double-height void as drawn in the upper slab
  const voidArea = rooms.filter((r) => r.open).reduce((a, r) => a + r.w * r.h, 0)
  // Radiators per heated room, sized to its heat need (C.heatLoadPerM2,
  // twice for a double-height room) with a 10-section bimetal radiator of
  // C.radiatorPower; at least one per room. Stairs, corridors and
  // wardrobes are heated through their doors.
  const unheated = (t: RoomType) => t === 'stair' || t === 'corridor' || t === 'wardrobe'
  const radiators = rooms
    .filter((r) => !r.open && !unheated(r.type))
    .reduce((a, r) => {
      const need = r.w * r.h * (r.doubleHeight ? 2 : 1) * C.heatLoadPerM2
      return a + Math.max(1, Math.ceil(need / C.radiatorPower))
    }, 0)
  // Electrical points per room. Sockets as the norm sets them (СП 31-110-2003,
  // 14.29): one per full or part 4 m of a living room's perimeter, at least
  // four in a kitchen, one per 10 m² of hall or corridor; plus one in a
  // bathroom and two in the utility room for the washer and the boiler. Every
  // room has a light point and a switch.
  const closed = rooms.filter((r) => !r.open)
  // the kitchen is a kitchen, a living-kitchen or, when the plan has neither,
  // the kitchen-dining room
  const cooking = closed.filter((r) => r.type === 'kitchen' || r.type === 'living_kitchen')
  const kitchens = cooking.length > 0 ? cooking : closed.filter((r) => r.type === 'dining')
  const kitchen = (r: Room) => kitchens.includes(r)
  const sockets = closed.reduce((a, r) => {
    const perimeter = 2 * (r.w + r.h)
    if (kitchen(r)) return a + Math.max(4, Math.ceil(perimeter / 4))
    if (r.type === 'hall' || r.type === 'corridor') return a + Math.ceil((r.w * r.h) / 10)
    if (r.type === 'bath') return a + 1
    if (r.type === 'utility') return a + 2
    if (r.type === 'stair' || r.type === 'wardrobe') return a
    return a + Math.ceil(perimeter / 4)
  }, 0)
  const lights = closed.length * 2 // a light point and its switch
  // Water and sewer points: WC, basin and shower in each bathroom, the sink
  // and dishwasher in the kitchen, the washer in the utility room.
  const fixtures = wet.length * 3 + kitchens.length * 2 + closed.filter((r) => r.type === 'utility').length
  // an extract fan in each bathroom and the kitchen
  const exhaustFans = wet.length + kitchens.length
  return {
    partitions, glass, railing, leafDoors, baths: wet.length, bathPerimeter, voidArea, radiators,
    sockets, lights, waterPoints: fixtures, sewerPoints: fixtures, exhaustFans,
  }
}

// The inside of the house the plans are drawn in: the main facade at the
// bottom, inside the same external wall as the estimate.
function planFrame(p: HouseParams) {
  const swap = p.frontSide === 'width'
  const L = Math.max(1, swap ? p.width : p.length)
  const W = Math.max(1, swap ? p.length : p.width)
  const extWall = p.eng?.extWall != null && p.eng.extWall > 0 ? p.eng.extWall / 100 : p.wallThickness
  const wall = Math.max(0.1, Math.min(extWall, (Math.min(L, W) - 2) / 2))
  return { L, W, wall, inner: { x: wall, y: wall, w: L - 2 * wall, h: W - 2 * wall } }
}

// Whether the house takes the real-project template: two storeys, a
// double-height hall, and a size the template stretches to without breaking
// its rooms — within 90–130% of its 12.4 × 13.4 m inside each way. Smaller or
// larger houses, or a visitor who asks for it, get the generated plan.
export function usesTemplate(p: HouseParams): boolean {
  return templateKind(p) !== null
}

// Which real-project plan the house takes, if any. The brick house is drawn
// for the layouts that name it, with a full or partial top floor; the Zx85
// for the default layout, a full top floor and a double-height hall.
export function templateKind(p: HouseParams): 'zx85' | 'brick' | null {
  if (p.planLayout === 'auto' || p.floors !== 2) return null
  const { inner } = planFrame(p)
  const fits = (a: number, b: number) => a / b >= 0.9 && a / b <= 1.3
  // a template is stretched, never turned: front to front, depth to depth
  if (p.planLayout === 'brick193' || p.planLayout === 'brickFull') {
    // drawn on its own outline, which it needs, front to the bottom
    const fp = p.footprint
    if (!fp || p.doubleHeightHall || p.frontSide === 'width') return null
    return fits(p.length, fp.L) && fits(p.width, fp.W) ? 'brick' : null
  }
  if (!p.doubleHeightHall || topShare(p) < 1) return null
  return fits(inner.w, TEMPLATE_W) && fits(inner.h, TEMPLATE_H) ? 'zx85' : null
}

// The built part of a top storey that covers only part of the house. The
// storey keeps the back of the house along its length (the left of the sheet,
// or its top when the plan is turned) and its own outer wall at the step;
// the rest of the floor below is a flat roof.
function topBlock(p: HouseParams, floorIndex: number, L: number, W: number, wall: number) {
  const s = topShare(p)
  if (s >= 1 || floorIndex !== p.floors - 1) return null
  if (p.frontSide !== 'width') {
    const step = s * L // outer face of the step wall
    return {
      built: { x: wall, y: wall, w: Math.max(1, step - 2 * wall), h: W - 2 * wall },
      roof: { x: step, y: wall, w: Math.max(0, L - wall - step), h: W - 2 * wall },
      side: 'right' as const,
      step,
    }
  }
  const step = s * W
  return {
    built: { x: wall, y: wall, w: L - 2 * wall, h: Math.max(1, step - 2 * wall) },
    roof: { x: wall, y: step, w: L - 2 * wall, h: Math.max(0, W - wall - step) },
    side: 'bottom' as const,
    step,
  }
}

export function buildFloorPlan(p: HouseParams, floorIndex = 0, custom?: Spec[], labels: PlanLabels = {}): FloorPlan {
  const voidLabel = labels.voidLabel ?? 'Второй свет'
  const corridorLabel = labels.corridorLabel ?? 'Коридор'
  const suite = { wardrobe: labels.wardrobeLabel ?? 'Гардеробная', ensuite: labels.ensuiteLabel ?? 'Мастер-санузел' }
  // Главный фасад всегда внизу листа. Если фасадная сторона — «ширина»,
  // разворачиваем план: так 14 м окажутся по фронту, а не сбоку.
  const swap = p.frontSide === 'width'
  const L = Math.max(1, swap ? p.width : p.length)
  const W = Math.max(1, swap ? p.length : p.width)
  // The plan sits inside the same external wall as the estimate (engineer
  // override first). A fixed 0.2 m wall made every floor ~5 m² larger than the
  // house and hid rooms below the 8 m² minimum.
  const extWall = p.eng?.extWall != null && p.eng.extWall > 0 ? p.eng.extWall / 100 : p.wallThickness
  const wall = Math.max(0.1, Math.min(extWall, (Math.min(L, W) - 2) / 2))
  const partition =
    p.eng?.partitionThickness != null && p.eng.partitionThickness > 0 ? p.eng.partitionThickness / 100 : C.partitionThickness
  const inset = wall
  const full = { x: inset, y: inset, w: L - 2 * inset, h: W - 2 * inset }
  // a partial top storey lays its rooms out in its built part only
  const top = topBlock(p, floorIndex, L, W, wall)
  const inner = top ? top.built : full

  // A house that fits a real project takes its plan (see templatePlan and
  // brickPlan) unless the visitor asks for the generated one.
  const kind = custom && custom.length > 0 ? null : templateKind(p)
  const template: TemplatePlan | null =
    kind === 'zx85' && floorIndex <= 1
      ? templatePlan(full, floorIndex, labels)
      : kind === 'brick' && floorIndex <= 1
        ? brickPlan(p, floorIndex, labels, L, W)
        : null

  const specs: Spec[] = custom && custom.length > 0 ? custom : autoProgram(p, floorIndex)

  // The double-height hall opens between the ground floor and the floor directly
  // above it (index 1) only — carve that one void; higher floors are normal.
  // This matches the engine, which subtracts the hall void from the slab exactly once.
  let sliceRect = inner
  let openVoid: Room | null = null
  let corridor: Room | null = null
  let upperVoid: Rect | null = null
  if (!template && floorIndex === 1 && p.doubleHeightHall && p.hallArea > 0) {
    // Проём — ТОТ ЖЕ прямоугольник, что зал на первом этаже. Над кухней и над
    // служебной полосой перекрытие есть, поэтому проём не на всю глубину.
    const vr = voidRect(inner, p.hallArea, partition)
    if (vr.w >= 0.8 && vr.h >= 0.8) {
    openVoid = { x: vr.x, y: vr.y, w: vr.w, h: vr.h, type: 'living_kitchen', label: voidLabel, open: true }

    // Галерея-антресоль вдоль проёма: по ней попадают из лестницы в комнаты,
    // с видом вниз в зал. Ставим её над кухней — там перекрытие есть.
    const above = { x: inner.x, y: inner.y, w: vr.w, h: vr.y - inner.y }
    if (above.h >= PLAN.minCorridor) {
      corridor = { ...above, type: 'corridor', label: corridorLabel, gallery: true }
    }
    upperVoid = vr
    corridor = null // галерея строится внутри layoutUpperWithVoid
    }
  }

  const rooms: Room[] = []
  // Первый этаж с двусветным залом: зал занимает ровно тот же прямоугольник,
  // что и проём наверху, — этажи совпадают по вертикали.
  let doubleHall: Room | null = null
  if (!template && floorIndex === 0 && p.doubleHeightHall && p.floors >= 2 && p.hallArea > 0) {
    const vr = voidRect(inner, p.hallArea, partition)
    // Вырожденный прямоугольник — дом слишком мал: зал не строим,
    // этаж планируется обычной схемой.
    if (vr.w < 0.8 || vr.h < 0.8) {
      doubleHall = null
    } else if (inner.w >= inner.h) {
      doubleHall = { x: vr.x, y: vr.y, w: vr.w, h: vr.h, type: 'living', label: labels.livingLabel ?? 'Гостиная', doubleHeight: true }
      sliceRect = { x: inner.x + vr.w, y: inner.y, w: inner.w - vr.w, h: inner.h }
    } else {
      doubleHall = { x: vr.x, y: vr.y, w: vr.w, h: vr.h, type: 'living', label: labels.livingLabel ?? 'Гостиная', doubleHeight: true }
      sliceRect = { x: inner.x, y: inner.y, w: inner.w, h: inner.h - vr.h }
    }
  }

  // Гостиную уже поставили как двусветный зал — из программы её убираем,
  // иначе на этаже окажется две гостиные.
  const restSpecs = doubleHall
    ? specs.filter((sp) => sp.type !== 'living' && sp.type !== 'living_kitchen')
    : specs
  if (template) {
    rooms.push(...template.rooms)
    openVoid = template.openVoid
  } else if (upperVoid) {
    // Второй этаж над проёмом — тоже явной схемой: лестница строго над
    // лестницей первого этажа, комнаты с нормальными пропорциями.
    layoutUpperWithVoid(inner, upperVoid, restSpecs, rooms, {
      corridor: corridorLabel,
      office: labels.officeLabel ?? 'Кабинет',
    })
  } else if (doubleHall) {
    // Первый этаж с двусветным залом собирается явной схемой, а не слайсером
    layoutGroundWithHall(inner, doubleHall, restSpecs, rooms, {
      hall: labels.hallLabel ?? 'Прихожая',
      corridor: corridorLabel,
      dining: labels.diningLabel ?? 'Кухня-столовая',
      wardrobe: labels.wardrobeLabel ?? 'Гардероб',
      ensuite: labels.ensuiteLabel ?? 'Мастер с/у',
      utility: labels.utilityLabel ?? 'Техпомещение',
      openKitchen: p.kitchenLivingCombined,
    })
  } else {
    layoutFloor(sliceRect, restSpecs, rooms, suite, {
      ground: floorIndex === 0,
      hall: labels.hallLabel ?? 'Прихожая',
      corridor: corridorLabel,
      dining: labels.diningLabel ?? 'Кухня-столовая',
      living: labels.livingLabel ?? 'Гостиная',
    })
  }
  if (corridor) rooms.push(corridor)
  if (doubleHall) rooms.unshift(doubleHall)

  // windows on exterior walls, roughly centered per exterior-facing room edge
  // Окна: количество пропорционально длине наружной стены комнаты. Раньше
  // комната любой длины получала ровно одно окно — 13-метровая стена гостиной
  // освещалась так же, как двухметровая стена санузла.
  // a plan drawn off real drawings brings its own windows at their sizes
  const windows: FloorPlan['windows'] = template?.windows ? [...template.windows] : []
  const ww = PLAN.windowWidth
  const place = (from: number, span: number, make: (c: number) => FloorPlan['windows'][number]) => {
    const n = Math.max(1, Math.round(span / PLAN.windowPerMeters))
    if (span < ww + 0.6) return // стена короче окна с простенками — окна нет
    for (let i = 0; i < n; i++) windows.push(make(from + (span * (i + 0.5)) / n))
  }
  for (const r of template?.windows ? [] : openVoid ? [...rooms, openVoid] : rooms) {
    // у служебных помещений и коридоров окна не навязываем
    if (r.type === 'stair' || r.type === 'wardrobe' || r.type === 'corridor') continue
    if (Math.abs(r.y - inset) < 1e-6) place(r.x, r.w, (c) => ({ x: c - ww / 2, y: 0, len: ww, side: 'top' }))
    if (Math.abs(r.y + r.h - (W - inset)) < 1e-6) place(r.x, r.w, (c) => ({ x: c - ww / 2, y: W, len: ww, side: 'bottom' }))
    if (Math.abs(r.x - inset) < 1e-6) place(r.y, r.h, (c) => ({ x: 0, y: c - ww / 2, len: ww, side: 'left' }))
    if (Math.abs(r.x + r.w - (L - inset)) < 1e-6) place(r.y, r.h, (c) => ({ x: L, y: c - ww / 2, len: ww, side: 'right' }))
    // the step wall of a partial top storey is an outer wall too
    if (top?.side === 'right' && Math.abs(r.x + r.w - (top.step - inset)) < 1e-6)
      place(r.y, r.h, (c) => ({ x: top.step, y: c - ww / 2, len: ww, side: 'right' }))
    if (top?.side === 'bottom' && Math.abs(r.y + r.h - (top.step - inset)) < 1e-6)
      place(r.x, r.w, (c) => ({ x: c - ww / 2, y: top.step, len: ww, side: 'bottom' }))
  }

  // doors connect the real rooms only; the void has no door (it is open) and the
  // exterior entrance belongs to the ground floor.
  const doors = template ? template.doors(W) : buildDoors(rooms, inset, L, W, floorIndex === 0)
  // The entrance door and a window cannot share the same piece of facade: the
  // hall used to get a window centred exactly where its front door is.
  const overlaps = (a: number, al: number, b: number, bl: number) => a < b + bl && b < a + al
  const facadeWindows = windows.filter(
    (wn) =>
      !doors.some(
        (d) =>
          d.kind === 'entrance' &&
          // same wall line (a window carries its own), overlapping stretch
          (d.orient === 'h'
            ? (wn.side === 'top' || wn.side === 'bottom') && Math.abs(wn.y - d.pos) < 0.05 && overlaps(wn.x, wn.len, d.start, d.w)
            : (wn.side === 'left' || wn.side === 'right') && Math.abs(wn.x - d.pos) < 0.05 && overlaps(wn.y, wn.len, d.start, d.w)),
      ),
  )

  if (openVoid) rooms.push(openVoid)

  const glassPartitionLen = rooms.reduce(
    (a, r) => a + (r.glassSide === 'top' || r.glassSide === 'bottom' ? r.w : r.glassSide ? r.h : 0),
    0,
  )
  return {
    L,
    W,
    wall,
    partition,
    rooms,
    windows: facadeWindows,
    doors,
    glassPartitionLen,
    ceilingH: p.floorHeight,
    hallCeilingH: p.doubleHeightHall && p.floors >= 2 ? p.floorHeight * 2 : p.floorHeight,
    outline: template?.outline,
    terraces: template?.terraces,
    roofs:
      template?.roofs
        ? template.roofs
        : top && top.roof.w > 0 && top.roof.h > 0
          ? { rects: [top.roof], label: BRICK_LABEL.roof[labels.lang ?? 'ru'] }
          : undefined,
  }
}

export const DOOR_W = 0.9

// Connect rooms with a spanning tree of interior doors + one entrance door.
function buildDoors(rooms: Room[], inset: number, L: number, W: number, withEntrance = true): Door[] {
  const doors: Door[] = []
  if (rooms.length === 0) return doors
  const eps = 0.02
  const connected = new Set<number>([0])

  const sharedWall = (a: Room, b: Room): Door | null => {
    // vertical shared wall
    if (Math.abs(a.x + a.w - b.x) < eps || Math.abs(b.x + b.w - a.x) < eps) {
      const pos = Math.abs(a.x + a.w - b.x) < eps ? a.x + a.w : a.x
      const y0 = Math.max(a.y, b.y)
      const y1 = Math.min(a.y + a.h, b.y + b.h)
      if (y1 - y0 >= DOOR_W + 0.3) {
        return { orient: 'v', pos, start: (y0 + y1) / 2 - DOOR_W / 2, w: DOOR_W, swing: 1, kind: 'interior' }
      }
    }
    // horizontal shared wall
    if (Math.abs(a.y + a.h - b.y) < eps || Math.abs(b.y + b.h - a.y) < eps) {
      const pos = Math.abs(a.y + a.h - b.y) < eps ? a.y + a.h : a.y
      const x0 = Math.max(a.x, b.x)
      const x1 = Math.min(a.x + a.w, b.x + b.w)
      if (x1 - x0 >= DOOR_W + 0.3) {
        return { orient: 'h', pos, start: (x0 + x1) / 2 - DOOR_W / 2, w: DOOR_W, swing: 1, kind: 'interior' }
      }
    }
    return null
  }

  // Дерево связей растим по приоритету: сначала от прихожей, коридора и
  // лестницы, потом от общих комнат, и только в последнюю очередь от спальни.
  // Через санузел и гардероб транзит не ведём вообще — иначе получается
  // «в гардероб только через санузел», что и выявил планировочный аудит.
  const rank = (t: Room['type']) =>
    t === 'hall' || t === 'corridor' || t === 'stair' ? 0
    : t === 'living' || t === 'living_kitchen' || t === 'dining' || t === 'kitchen' ? 1
    : t === 'bedroom' || t === 'office' ? 2
    : 3 // bath, wardrobe — тупики, транзита через них нет
  // A bathroom or wardrobe never opens into a kitchen or a living room: entry
  // to a WC from a kitchen or habitable room is not allowed, a bedroom's own
  // ensuite being the exception. Such a door is only a last resort.
  const LIVING = new Set<Room['type']>(['kitchen', 'dining', 'living', 'living_kitchen'])
  const service = (t: Room['type']) => t === 'bath' || t === 'wardrobe'
  // the utility room (boiler, washer) opens from the kitchen or a corridor only
  const utilityOk = (t: Room['type']) => t === 'kitchen' || t === 'dining' || t === 'hall' || t === 'corridor' || t === 'stair'
  const badDoor = (a: Room, b: Room) =>
    (service(a.type) && LIVING.has(b.type)) ||
    (service(b.type) && LIVING.has(a.type)) ||
    (a.type === 'utility' && !utilityOk(b.type)) ||
    (b.type === 'utility' && !utilityOk(a.type))
  // Which way the leaf opens, as on an architect's plan: into the habitable
  // room, out of a bath or wardrobe (a WC door opens outwards), and no leaf at
  // all between hall, corridor and stair, which are joined by open doorways.
  const circulation = (t: Room['type']) => t === 'hall' || t === 'corridor' || t === 'stair'
  const hang = (d: Door, a: Room, b: Room): Door => {
    if (circulation(a.type) && circulation(b.type)) return { ...d, kind: 'opening' }
    const plus = d.orient === 'v' ? (Math.abs(a.x - d.pos) < eps ? a : b) : Math.abs(a.y - d.pos) < eps ? a : b
    const minus = plus === a ? b : a
    // baths, wardrobes and the utility room open outwards
    const outward = (t: Room['type']) => service(t) || t === 'utility'
    const into = outward(plus.type)
      ? minus
      : outward(minus.type)
        ? plus
        : circulation(plus.type)
          ? minus
          : plus
    return { ...d, swing: into === plus ? 1 : -1 }
  }
  const connected0 = rooms.findIndex((r) => rank(r.type) === 0)
  connected.clear()
  connected.add(connected0 >= 0 ? connected0 : 0)

  let guard = 0
  while (connected.size < rooms.length && guard++ < rooms.length * rooms.length) {
    let best: { d: Door; i: number; j: number; score: number } | null = null
    for (let i = 0; i < rooms.length; i++) {
      if (!connected.has(i)) continue
      if (rank(rooms[i].type) === 3) continue // тупик — от него не ветвимся
      for (let j = 0; j < rooms.length; j++) {
        if (connected.has(j)) continue
        const d = sharedWall(rooms[i], rooms[j])
        if (!d) continue
        const score = rank(rooms[i].type) * 10 + rank(rooms[j].type) + (badDoor(rooms[i], rooms[j]) ? 100 : 0)
        if (!best || score < best.score) best = { d, i, j, score }
      }
    }
    if (!best) break
    doors.push(hang(best.d, rooms[best.i], rooms[best.j]))
    connected.add(best.j)
  }

  // Входная дверь ведёт в прихожую, если она есть. Раньше дверь ставилась в
  // первую комнату списка — то есть прямо в гостиную.
  if (!withEntrance) return doors
  const r0 = rooms.find((r) => r.type === 'hall') ?? rooms[0]
  if (Math.abs(r0.y + r0.h - (W - inset)) < eps || r0.y + r0.h >= W - inset - 0.5) {
    doors.push({ orient: 'h', pos: W, start: r0.x + r0.w / 2 - 0.5, w: 1.0, swing: -1, kind: 'entrance' })
  } else if (r0.x <= inset + 0.5) {
    doors.push({ orient: 'v', pos: 0, start: r0.y + r0.h / 2 - 0.5, w: 1.0, swing: 1, kind: 'entrance' })
  } else {
    doors.push({ orient: 'h', pos: W, start: L / 2 - 0.5, w: 1.0, swing: -1, kind: 'entrance' })
  }

  return doors
}

type Rect = { x: number; y: number; w: number; h: number }

// A plan of a real project. One drawn off real drawings also brings its
// windows, its outline and the roofs beside a partial top floor.
interface TemplatePlan {
  rooms: Room[]
  openVoid: Room | null
  doors: (W: number) => Door[]
  windows?: FloorPlan['windows']
  outline?: FRect[]
  roofs?: { rects: FRect[]; label: string }
  // open terraces beside the house, as the drawings show them
  terraces?: { rects: FRect[]; label: string }
}

// The plan of a real project: Z500 Zx85 (z500.pl, 14.46 m front, 238 m²) —
// a two-storey cube with a double-height living-dining room, a gallery on the
// upper floor and the bedrooms upstairs — fitted to a 13 × 14 m house without
// its garage, whose place takes a ground-floor bedroom with an ensuite and a
// wardrobe. Drawn on a 12.4 × 13.4 m inside with the main facade at the
// bottom and stretched to the house (the default 14 m front makes the hall
// 7.8 × 6.7 m). Its rooms follow the catalogues' proportions: a living room
// of ~52 m² (both sides above its 6 m height), a stair box of 2.6 × 4.3 m that takes a straight
// flight of 16 risers (3.8 m) as well as a two-flight stair, a 1.6 m gallery
// along the void.
const TEMPLATE_W = 12.4
const TEMPLATE_H = 13.4
const TEMPLATE_LABEL: Record<string, { ru: string; hy: string; en: string }> = {
  living: { ru: 'Гостиная-столовая', hy: 'Հյուրասենյակ-ճաշասենյակ', en: 'Living-dining' },
  kitchen: { ru: 'Кухня', hy: 'Խոհանոց', en: 'Kitchen' },
  boiler: { ru: 'Котельная', hy: 'Կաթսայատուն', en: 'Boiler room' },
  pantry: { ru: 'Кладовая', hy: 'Մառան', en: 'Pantry' },
  stair: { ru: 'Лестница', hy: 'Աստիճան', en: 'Stair' },
  hall: { ru: 'Холл', hy: 'Սրահ', en: 'Hall' },
  porch: { ru: 'Тамбур', hy: 'Նախամուտք', en: 'Vestibule' },
  corridor: { ru: 'Коридор', hy: 'Միջանցք', en: 'Corridor' },
  wc: { ru: 'Гостевой санузел', hy: 'Հյուրերի ս/հ', en: 'Guest bathroom' },
  office: { ru: 'Кабинет', hy: 'Աշխատասենյակ', en: 'Home office' },
  closet: { ru: 'Гардероб', hy: 'Հանդերձարան', en: 'Closet' },
  ensuite: { ru: 'Санузел спальни', hy: 'Ննջասենյակի ս/հ', en: 'Ensuite' },
  bedroom: { ru: 'Спальня', hy: 'Ննջասենյակ', en: 'Bedroom' },
  master: { ru: 'Мастер-спальня', hy: 'Գլխավոր ննջասենյակ', en: 'Master bedroom' },
  masterBath: { ru: 'Мастер-санузел', hy: 'Գլխավոր ս/հ', en: 'Master bathroom' },
  wardrobe: { ru: 'Гардеробная', hy: 'Հանդերձարան', en: 'Wardrobe' },
  landing: { ru: 'Холл', hy: 'Սրահ', en: 'Landing' },
  gallery: { ru: 'Галерея', hy: 'Պատշգամբ-միջանցք', en: 'Gallery' },
  bedroom2: { ru: 'Спальня 2', hy: 'Ննջասենյակ 2', en: 'Bedroom 2' },
  bedroom3: { ru: 'Спальня 3', hy: 'Ննջասենյակ 3', en: 'Bedroom 3' },
  laundry: { ru: 'Постирочная', hy: 'Լվացքատուն', en: 'Laundry' },
  bath: { ru: 'Санузел', hy: 'Սանհանգույց', en: 'Bathroom' },
  void: { ru: 'Второй свет', hy: 'Երկրորդ լույս', en: 'Double height' },
}

function templatePlan(
  inner: Rect,
  floorIndex: number,
  labels: PlanLabels,
): { rooms: Room[]; openVoid: Room | null; doors: (W: number) => Door[] } {
  const sx = inner.w / TEMPLATE_W
  const sy = inner.h / TEMPLATE_H
  const X = (x: number) => inner.x + x * sx
  const Y = (y: number) => inner.y + y * sy
  const room = (x: number, y: number, w: number, h: number, type: RoomType, label: string, extra: Partial<Room> = {}): Room => ({
    x: X(x), y: Y(y), w: w * sx, h: h * sy, type, label, ...extra,
  })
  // a door in the middle of the shared stretch of a wall
  const door = (orient: Door['orient'], at: number, from: number, to: number, kind: Door['kind'] = 'interior', swing: 1 | -1 = 1): Door => {
    const pos = orient === 'v' ? X(at) : Y(at)
    const a = orient === 'v' ? Y(from) : X(from)
    const b = orient === 'v' ? Y(to) : X(to)
    const w = kind === 'opening' ? Math.min(b - a - 0.2, 1.2) : DOOR_W
    return { orient, pos, start: (a + b) / 2 - w / 2, w, swing, kind }
  }
  const hall: Rect = { x: 0, y: 6.2, w: 7.2, h: 7.2 } // the double-height hall and its void
  const lang = labels.lang ?? 'ru'
  const T = (k: keyof typeof TEMPLATE_LABEL) => TEMPLATE_LABEL[k][lang]

  if (floorIndex === 0) {
    const rooms: Room[] = [
      room(hall.x, hall.y, hall.w, hall.h, 'living', T('living'), { doubleHeight: true }),
      room(0, 2.6, 4.6, 3.6, 'kitchen', T('kitchen'), { glassSide: 'bottom' }),
      room(0, 0, 2.6, 2.6, 'utility', T('boiler')),
      room(2.6, 0, 2.0, 2.6, 'wardrobe', T('pantry')), // storage: no water, no radiator
      room(4.6, 0, 2.6, 4.3, 'stair', T('stair')),
      room(4.6, 4.3, 2.6, 1.9, 'hall', T('hall')),
      room(7.2, 11.6, 1.8, 1.8, 'hall', T('porch')),
      room(7.2, 2.6, 1.8, 9.0, 'corridor', T('corridor')),
      room(7.2, 0, 1.8, 2.6, 'bath', T('wc')),
      room(9.0, 0, 3.4, 4.6, 'office', T('office')),
      room(9.0, 4.6, 1.6, 2.6, 'wardrobe', T('closet')),
      room(10.6, 4.6, 1.8, 2.6, 'bath', T('ensuite')),
      room(9.0, 7.2, 3.4, 6.2, 'bedroom', T('bedroom')),
    ]
    const doors = (W: number): Door[] => [
      door('h', 11.6, 7.2, 9.0),
      door('v', 7.2, 6.2, 11.6),
      door('v', 7.2, 4.3, 6.2, 'opening'),
      door('h', 4.3, 4.6, 7.2, 'opening'),
      door('v', 4.6, 4.3, 6.2),
      door('h', 6.2, 4.6, 7.2),
      door('h', 2.6, 0, 2.6, 'interior', -1),
      door('h', 2.6, 2.6, 4.6, 'interior', -1),
      door('h', 2.6, 7.2, 9.0, 'interior', -1),
      door('v', 9.0, 2.6, 4.6),
      door('v', 9.0, 7.2, 11.6),
      door('h', 7.2, 9.0, 10.6, 'interior', -1),
      door('h', 7.2, 10.6, 12.4, 'interior', -1),
      { orient: 'h', pos: W, start: X(8.1) - 0.5, w: 1.0, swing: -1, kind: 'entrance' },
    ]
    return { rooms, openVoid: null, doors }
  }

  const rooms: Room[] = [
    room(0, 2.6, 4.6, 3.6, 'bedroom', T('master')),
    room(0, 0, 2.6, 2.6, 'bath', T('masterBath')),
    room(2.6, 0, 2.0, 2.6, 'wardrobe', T('wardrobe')),
    room(4.6, 0, 2.6, 4.3, 'stair', T('stair')),
    room(4.6, 4.3, 2.6, 1.9, 'corridor', T('landing'), { gallery: true }),
    room(7.2, 4.0, 1.6, 9.4, 'corridor', T('gallery'), { gallery: true }),
    room(7.2, 0, 5.2, 4.0, 'bedroom', T('bedroom2')),
    room(8.8, 4.0, 3.6, 2.4, 'utility', T('laundry')),
    room(8.8, 6.4, 3.6, 2.4, 'bath', T('bath')),
    room(8.8, 8.8, 3.6, 4.6, 'bedroom', T('bedroom3')),
  ]
  const openVoid = room(hall.x, hall.y, hall.w, hall.h, 'living_kitchen', labels.voidLabel ?? T('void'), { open: true })
  const doors = (): Door[] => [
    door('h', 4.3, 4.6, 7.2, 'opening'),
    door('v', 7.2, 4.3, 6.2, 'opening'),
    door('v', 4.6, 4.3, 6.2),
    door('h', 2.6, 0, 2.6, 'interior', -1),
    door('h', 2.6, 2.6, 4.6, 'interior', -1),
    door('h', 4.0, 7.2, 8.8),
    door('v', 8.8, 4.0, 6.4, 'interior', -1),
    door('v', 8.8, 6.4, 8.8, 'interior', -1),
    door('v', 8.8, 8.8, 13.4),
  ]
  return { rooms, openVoid, doors }
}

// The brick house from https://www.youtube.com/watch?v=6kJcesg7oxo, taken off
// the drawings shown in it (plans at 0.000 and +3.400 with their room
// schedules), measured against their axes: axes 1–4 at x 3.725 / 9.725 /
// 12.725 / 17.225, А / Б / В at y 9.085 / 4.085 / 1.085; walls 250 mm.
//   0.000: 1 hall 25.4 with the U-stair (open to the kitchen-living, with a
//          wardrobe 650 deep), 2 kitchen-living 54, 3 bedroom 15.5, 4 boiler
//          and laundry room 13.4 (L-shaped), 5 shower 7.1, 6 storeroom 4.7,
//          7 terrace (open, under the storeroom, with its barbecue kitchen).
//   +3.400: 1 hall 9.9, 2 bedroom 21.1, 3 bedroom 15.5, 4 office 12.9,
//          5 shower 5.2.
// Rooms drawn inside the walls come within 1 m² of the schedules. Doors and
// windows (ДН, ДНО, ДГ, ОК-1…ОК-8) stand where the drawings put them. Parts
// of one room drawn as several rectangles carry no label of their own.
// brickFull adds two bedrooms over the kitchen-living and the boiler room.
const BRICK_LABEL: Record<string, { ru: string; hy: string; en: string }> = {
  livingKitchen: { ru: 'Кухня-гостиная', hy: 'Խոհանոց-հյուրասենյակ', en: 'Kitchen-living' },
  bedroom: { ru: 'Спальня', hy: 'Ննջասենյակ', en: 'Bedroom' },
  stair: { ru: 'Лестница', hy: 'Աստիճան', en: 'Stair' },
  hall: { ru: 'Холл', hy: 'Սրահ', en: 'Hall' },
  wardrobe: { ru: 'Шкаф', hy: 'Պահարան', en: 'Wardrobe' },
  shower: { ru: 'Душевая', hy: 'Ցնցուղարան', en: 'Shower room' },
  boiler: { ru: 'Техпомещение', hy: 'Տեխնիկական սենյակ', en: 'Boiler room' },
  store: { ru: 'Склад', hy: 'Պահեստ', en: 'Storeroom' },
  office: { ru: 'Кабинет', hy: 'Աշխատասենյակ', en: 'Home office' },
  bedroom3: { ru: 'Спальня 3', hy: 'Ննջասենյակ 3', en: 'Bedroom 3' },
  bedroom4: { ru: 'Спальня 4', hy: 'Ննջասենյակ 4', en: 'Bedroom 4' },
  roof: { ru: 'Кровля', hy: 'Տանիք', en: 'Roof' },
  terrace: { ru: 'Терраса · барбекю', hy: 'Պատշգամբ · խորոված', en: 'Terrace · barbecue' },
}

function brickPlan(
  p: HouseParams,
  floorIndex: number,
  labels: PlanLabels,
  L: number,
  W: number,
): TemplatePlan {
  const fp = p.footprint!
  const sx = L / fp.L
  const sy = W / fp.W
  const X = (x: number) => x * sx
  const Y = (y: number) => y * sy
  const lang = labels.lang ?? 'ru'
  const T = (k: keyof typeof BRICK_LABEL) => BRICK_LABEL[k][lang]
  // a room by its corners
  const room = (x0: number, y0: number, x1: number, y1: number, type: RoomType, label: string): Room => ({
    x: X(x0), y: Y(y0), w: (x1 - x0) * sx, h: (y1 - y0) * sy, type, label,
  })
  // a doorway across a whole shared stretch (open plan, the stair)
  const open = (orient: Door['orient'], at: number, from: number, to: number): Door => {
    const k = orient === 'v' ? sy : sx
    return { orient, pos: orient === 'v' ? X(at) : Y(at), start: from * k + 0.1, w: (to - from) * k - 0.2, swing: 1, kind: 'opening' }
  }
  // a door leaf where the drawing puts it
  const leaf = (orient: Door['orient'], at: number, start: number, width: number, kind: Door['kind'] = 'interior', swing: 1 | -1 = 1): Door => ({
    orient, pos: orient === 'v' ? X(at) : Y(at), start: orient === 'v' ? Y(start) : X(start),
    w: width * (orient === 'v' ? sy : sx), swing, kind,
  })
  const win = (side: FloorPlan['windows'][number]['side'], at: number, start: number, len: number) =>
    side === 'top' || side === 'bottom'
      ? { side, x: X(start), y: Y(at), len: len * sx }
      : { side, x: X(at), y: Y(start), len: len * sy }
  const scaled = scaleFootprint(fp, L, W)
  const full = p.planLayout === 'brickFull'

  if (floorIndex === 0) {
    const rooms: Room[] = [
      room(0.25, 0.25, 3.6, 1.525, 'wardrobe', T('store')), // 6
      room(3.85, 1.21, 9.725, 10.585, 'living_kitchen', T('livingKitchen')), // 2
      room(9.82, 0.25, 12.575, 1.725, 'stair', T('stair')), // the turn at the back
      room(9.725, 1.725, 11.225, 3.985, 'stair', ''), // its flight up from the hall
      room(9.725, 3.985, 14.275, 5.515, 'hall', T('hall')), // 1
      room(11.225, 1.725, 12.575, 3.985, 'hall', ''), // 1, beside the flight
      room(9.725, 5.515, 12.575, 6.545, 'hall', ''), // 1
      room(9.725, 6.545, 11.855, 8.96, 'hall', ''), // 1, to the entrance
      room(11.855, 6.545, 12.575, 8.96, 'wardrobe', T('wardrobe')), // 650 deep
      room(12.575, 0.25, 17.1, 2.825, 'utility', T('boiler')), // 4
      room(12.575, 2.825, 14.275, 3.985, 'utility', ''), // 4, the washer bay
      room(14.275, 2.825, 17.1, 5.515, 'bath', T('shower')), // 5
      room(12.575, 5.515, 17.1, 8.96, 'bedroom', T('bedroom')), // 3
    ]
    const doors = (): Door[] => [
      open('v', 9.725, 1.21, 3.985), // the stair open to the kitchen-living
      open('v', 9.725, 3.985, 6.545), // hall to the kitchen-living
      open('h', 1.725, 9.82, 12.575),
      open('h', 3.985, 9.725, 12.575),
      open('h', 5.515, 9.725, 12.575),
      open('h', 6.545, 9.725, 11.855),
      open('h', 2.825, 12.575, 14.275),
      leaf('v', 11.855, 7.0, 1.5, 'interior', -1), // wardrobe
      leaf('v', 12.575, 2.185, 0.8, 'interior', -1), // ДГ-2, 1 100 behind axis Б
      leaf('v', 14.275, 4.3, 0.8), // ДГ-2
      leaf('h', 5.515, 13.285, 0.8), // ДГ-1
      leaf('h', 9.21, 9.925, 1.5, 'entrance', -1), // ДН-1, 200 past axis 2
      leaf('v', 3.6, 4.485, 0.8, 'entrance'), // ДНО-2, 400 past axis Б
      leaf('v', 0, 0.55, 0.9, 'entrance'), // ДН-2, storeroom, 550 from its corner
      leaf('v', 17.35, 1.36, 0.9, 'entrance', -1), // ДН-2, boiler room
    ]
    const windows = [
      win('bottom', 10.835, 3.725, 4.7), // ОК-1, from axis 1
      win('left', 3.6, 9.325, 1.2), // ОК-2
      win('bottom', 9.21, 13.225, 3.6), // ОК-3, 3 500 past axis 2
      win('right', 17.35, 4.6, 0.6), // ОК-4
      win('top', 0, 10.67, 1.2), // ОК-5, 1 100 into the stair tower
    ]
    // 7: between the wing's axes, from the storeroom to axis А
    const terrace = [{ x: X(0.125), y: Y(1.775), w: 3.475 * sx, h: 7.31 * sy }]
    return { rooms, openVoid: null, doors, windows, outline: scaled.ground, terraces: { rects: terrace, label: T('terrace') } }
  }

  const rooms: Room[] = [
    room(3.85, 4.21, 8.155, 8.96, 'bedroom', T('bedroom')), // 2
    room(9.82, 0.25, 11.625, 4.21, 'stair', T('stair')),
    room(11.625, 0.25, 12.72, 3.145, 'stair', ''), // the turn
    room(11.625, 3.145, 12.72, 4.21, 'corridor', ''), // 1, the landing
    room(8.155, 4.21, 14.075, 5.635, 'corridor', T('hall')), // 1
    room(12.905, 5.635, 14.075, 5.895, 'corridor', ''), // 1, at the office door
    room(14.075, 4.21, 17.1, 5.895, 'bath', T('shower')), // 5
    room(8.155, 5.635, 12.905, 8.96, 'bedroom', T('bedroom')), // 3
    room(12.905, 5.895, 17.1, 8.96, 'office', T('office')), // 4
  ]
  if (full) {
    rooms.push(
      room(3.85, 1.21, 9.57, 4.21, 'bedroom', T('bedroom3')),
      room(12.72, 0.25, 17.1, 4.21, 'bedroom', T('bedroom4')),
    )
  }
  const doors = (): Door[] => [
    open('h', 4.21, 9.82, 12.72),
    open('v', 11.625, 3.145, 4.21),
    open('h', 3.145, 11.625, 12.72),
    open('h', 5.635, 12.905, 14.075),
    leaf('v', 8.155, 4.5, 0.9), // ДГ-1
    leaf('h', 5.635, 11.0, 0.8, 'interior', -1), // ДГ-1
    leaf('h', 5.895, 13.015, 0.8, 'interior', -1), // ДГ-1
    leaf('v', 14.075, 4.95, 0.8, 'interior', -1), // ДГ-2
    ...(full ? [leaf('h', 4.21, 8.4, 0.9, 'interior', -1), leaf('h', 4.21, 12.9, 0.9, 'interior', -1)] : []),
  ]
  const windows = [
    win('bottom', 9.21, 3.935, 4.15), // ОК-6
    win('bottom', 9.21, 9.725, 2.6), // ОК-7, ends 400 short of axis 3
    win('bottom', 9.21, 12.725, 4.25), // ОК-8, ends 250 short of axis 4
    win('top', 0, 10.67, 1.2), // ОК-5 over the stair
    ...(full ? [win('top', 0.96, 5.0, 2.6), win('top', 0, 14.2, 2.0)] : []),
  ]
  const roofs = subtractRects(scaled.ground, scaled.top)
  return {
    rooms, openVoid: null, doors, windows, outline: scaled.top,
    roofs: roofs.length ? { rects: roofs, label: T('roof') } : undefined,
  }
}

// Realistic layout: bath/stair go into a compact service band (real size ~5–7 m²),
// the living/kitchen keeps the large area, bedrooms are proper rooms.
// Falls back to the weighted slicer when the program has no service rooms.
function layoutFloor(
  rect: Rect,
  specs: Spec[],
  out: Room[],
  suite: { wardrobe: string; ensuite: string } = { wardrobe: 'Гардеробная', ensuite: 'Мастер-санузел' },
  opts: { ground: boolean; hall: string; corridor: string; dining: string; living: string } = {
    ground: false, hall: 'Прихожая', corridor: 'Коридор', dining: 'Кухня-столовая', living: 'Гостиная',
  },
) {
  const isSmall = (t: RoomType) => t === 'bath' || t === 'stair'
  const smalls = specs.filter((s) => isSmall(s.type))
  const bigs = specs.filter((s) => !isSmall(s.type))
  if (smalls.length === 0 || bigs.length === 0) {
    slice(rect, specs, out)
    return
  }

  const living = bigs.find((s) => s.type === 'living' || s.type === 'living_kitchen' || s.type === 'kitchen') ?? null
  const beds = bigs.filter((s) => s !== living)

  // Первый этаж: снизу выделяем входную полосу — прихожая + коридор.
  // Без неё вход ведёт прямо в гостиную, а спальня доступна только через неё.
  let body: Rect = rect
  const wantsEntry = opts.ground && living != null && rect.h > PLAN.hallDepth * 2.2
  if (wantsEntry) {
    const hd = Math.min(PLAN.hallDepth, rect.h * 0.2)
    const hy = rect.y + rect.h - hd
    const hw = Math.min(PLAN.hallWidth, rect.w * 0.32)
    out.push({ x: rect.x, y: hy, w: hw, h: hd, type: 'hall', label: opts.hall })
    const corrW = rect.w - hw
    if (corrW >= PLAN.minCorridor) {
      out.push({ x: rect.x + hw, y: hy, w: corrW, h: hd, type: 'corridor', label: opts.corridor })
    }
    body = { x: rect.x, y: rect.y, w: rect.w, h: rect.h - hd }
  }

  // Служебная зона.
  // Лестница — в верхней полосе правой колонки. Санузел — ВНИЗУ правой колонки,
  // вплотную к коридору: гость должен попадать в туалет из прихожей, а не через
  // гостиную, кухню и лестничный холл. Это была реальная ошибка планировки.
  const Wc = Math.min(body.w * 0.42, Math.max(2.6, body.w * 0.34))
  const leftW = body.w - Wc
  const rx = body.x + leftW
  const hBand = Math.min(2.9, body.h * 0.3)

  const stairs = smalls.filter((s) => s.type === 'stair')
  const baths = smalls.filter((s) => s.type === 'bath')
  // санузел у коридора имеет смысл только если входная полоса вообще есть
  const guestBath = wantsEntry ? baths[0] ?? null : null
  const topSmalls = [...stairs, ...baths.filter((b) => b !== guestBath)]

  if (topSmalls.length > 0) {
    const sw = Wc / topSmalls.length
    topSmalls.forEach((s, i) => out.push({ x: rx + i * sw, y: body.y, w: sw, h: hBand, type: s.type, label: s.label }))
  }
  const belowY = body.y + (topSmalls.length > 0 ? hBand : 0)
  let restH = body.h - (topSmalls.length > 0 ? hBand : 0)

  // Гостевой санузел прижат к низу правой колонки — общая стена с коридором.
  let guestH = 0
  if (guestBath) {
    guestH = Math.min(2.4, restH * 0.28)
    out.push({ x: rx, y: body.y + body.h - guestH, w: Wc, h: guestH, type: 'bath', label: guestBath.label })
    restH -= guestH
  }

  if (living) {
    pushLivingColumn({ x: body.x, y: body.y, w: leftW, h: body.h }, living, out, opts)
    if (beds.length === 0) {
      if (restH > 0.6) out.push({ x: rx, y: belowY, w: Wc, h: restH, type: living.type, label: '' })
    } else if (beds.length === 1) {
      const ht = Math.min(2.7, restH * 0.32)
      const half = Wc / 2
      out.push({ x: rx, y: belowY, w: half, h: ht, type: 'wardrobe', label: suite.wardrobe })
      out.push({ x: rx + half, y: belowY, w: half, h: ht, type: 'bath', label: suite.ensuite })
      out.push({ x: rx, y: belowY + ht, w: Wc, h: Math.max(0, restH - ht), type: beds[0].type, label: beds[0].label })
    } else {
      const bh = restH / beds.length
      beds.forEach((b, i) => out.push({ x: rx, y: belowY + i * bh, w: Wc, h: bh, type: b.type, label: b.label }))
    }
  } else {
    const rightBed = beds[0]
    out.push({ x: rx, y: belowY, w: Wc, h: restH, type: rightBed.type, label: rightBed.label })
    const leftBeds = beds.slice(1)
    const leftRect: Rect = { x: body.x, y: body.y, w: leftW, h: body.h }
    if (leftBeds.length) slice(leftRect, leftBeds, out)
    else out.push({ ...leftRect, type: rightBed.type, label: rightBed.label })
  }
}

// Первый этаж дома с двусветным залом.
//
// Общий слайсер по весам для жилого дома не годится: он не знает, что вход
// не должен вести в гостиную, что санузел нужен у прихожей, а не за кухней,
// и что комната глубиной 12 м неосвещаема. Поэтому первый этаж собирается
// явной схемой:
//
//   ┌──────────────────┬──────────────────┐
//   │                  │  Кухня-столовая  │
//   │   Двусветный     ├─────────┬────────┤
//   │   зал            │ Гост.с/у│ Лестн. │
//   │                  ├─────────┴────────┤
//   │                  │ Прихож. │ Коридор│  ← вход
//   └──────────────────┴──────────────────┘
//
// Санузел и лестница стоят одним кустом: стояки короче, а санузел второго
// этажа встаёт над гостевым.
// Геометрия правой служебной колонки. Считается одной функцией для обоих
// этажей, иначе лестница первого этажа не совпадает с лестницей второго —
// а лестницы обязаны стоять строго друг над другом.
function serviceColumn(inner: Rect, hall: Rect) {
  const rx = hall.x + hall.w
  const rw = inner.x + inner.w - rx
  const bottom = inner.y + inner.h
  // A 2 m deep entry and a 1.6 m guest WC are enough; the depth they give up
  // goes to the master bedroom at the back of the column.
  const entryH = Math.min(2.0, inner.h * 0.18)
  const wcH = Math.min(1.6, (inner.h - entryH) * 0.22)
  const stairH = Math.min(3.2, (inner.h - entryH - wcH) * 0.42)
  const stairY = bottom - entryH - wcH - stairH
  return { rx, rw, entryH, wcH, stairH, stairY, topH: stairY - inner.y }
}

function layoutGroundWithHall(
  inner: Rect,
  hall: Rect,
  specs: Spec[],
  out: Room[],
  opts: { hall: string; corridor: string; dining: string; wardrobe: string; ensuite: string; utility: string; openKitchen: boolean },
) {
  const stair = specs.find((s) => s.type === 'stair')
  const bath = specs.find((s) => s.type === 'bath')
  const kitchen = specs.find((s) => s.type === 'living_kitchen' || s.type === 'kitchen' || s.type === 'dining')

  // Кухня-столовая — полосой вдоль задней стены над залом, открыта в зал.
  const backH = hall.y - inner.y
  if (backH > 1.2) {
    // Кухня отделена от зала раздвижной стеклянной перегородкой: визуально
    // единое пространство, но запахи и шум отсекаются при необходимости.
    // A kitchen asked to be separate gets a wall with a door instead.
    const utilityW = hall.w * backH > PLAN.maxKitchenDining && hall.w - PLAN.utilityWidth >= 6 ? PLAN.utilityWidth : 0
    out.push({
      x: hall.x,
      y: inner.y,
      w: hall.w - utilityW,
      h: backH,
      type: 'dining',
      label: kitchen?.label ?? opts.dining,
      ...(opts.openKitchen ? { glassSide: 'bottom' as const } : {}),
    })
    if (utilityW > 0) {
      out.push({ x: hall.x + hall.w - utilityW, y: inner.y, w: utilityW, h: backH, type: 'utility', label: opts.utility })
    }
  }

  // Правая полоса снизу вверх: прихожая → гостевой санузел → лестница →
  // мастер-блок. Координаты берём из общей функции, чтобы второй этаж совпал.
  const col = serviceColumn(inner, hall)
  const { rx, rw } = col
  if (rw < 1.4) return
  const bottom = inner.y + inner.h

  out.push({ x: rx, y: bottom - col.entryH, w: rw, h: col.entryH, type: 'hall', label: opts.hall })
  if (bath) {
    // A corridor beside the guest WC links the entry straight to the stair, so
    // the stair and the bedroom are not reached through the living room. The
    // WC keeps the external wall and its window.
    const wcY = bottom - col.entryH - col.wcH
    const corrW = PLAN.minCorridor + 0.1 // 1.2 m clear between two partitions
    if (rw - corrW >= 1.4) {
      out.push({ x: rx, y: wcY, w: corrW, h: col.wcH, type: 'corridor', label: opts.corridor })
      out.push({ x: rx + corrW, y: wcY, w: rw - corrW, h: col.wcH, type: 'bath', label: bath.label })
    } else {
      out.push({ x: rx, y: wcY, w: rw, h: col.wcH, type: 'bath', label: bath.label })
    }
  }
  if (stair) {
    out.push({ x: rx, y: col.stairY, w: rw, h: col.stairH, type: 'stair', label: stair.label })
  }

  // Мастер-блок вверху колонки: санузел и гардероб у задней стены, спальня ниже.
  const bed = specs.find((s) => s.type === 'bedroom')
  if (bed && col.topH > 4.0) {
    const serviceH = Math.min(2.4, col.topH * 0.38)
    const half = rw / 2
    out.push({ x: rx, y: inner.y, w: half, h: serviceH, type: 'bath', label: opts.ensuite })
    out.push({ x: rx + half, y: inner.y, w: rw - half, h: serviceH, type: 'wardrobe', label: opts.wardrobe })
    out.push({ x: rx, y: inner.y + serviceH, w: rw, h: col.topH - serviceH, type: 'bedroom', label: bed.label })
  } else if (bed && col.topH > 1.2) {
    out.push({ x: rx, y: inner.y, w: rw, h: col.topH, type: 'bedroom', label: bed.label })
  }
}

// Второй этаж над двусветным залом.
//
//   ┌───────────────────┬────────┐
//   │ Галерея │ Кабинет │ Детская│   ← комнаты вдоль коридора,
//   ├─────────┴─────────┤        │     пропорции близки к квадрату
//   │                   ├────────┤
//   │  Проём в зал      │ Детская│
//   │  (второй свет)    ├────────┤
//   │                   │ Санузел│
//   │                   ├────────┤
//   │                   │Лестница│   ← строго над лестницей 1 этажа
//   └───────────────────┴────────┘
// Upper floor when the service column is too narrow for rooms beside a
// corridor (a 10 m wide hall leaves ~3.4 m): the rooms stand over the kitchen
// behind a gallery along the void, the usual scheme for a double-height hall.
//
//   ┌──────────┬──────────┬────────┐
//   │ Детская 1│ Кабинет  │ Санузел│  ← back facade, over the kitchen
//   ├──────────┴──────────┼────────┤
//   │ Галерея, вид в зал  │  Холл  │
//   ├─────────────────────┼────────┤
//   │                     │Лестница│  ← over the ground-floor stair
//   │   Второй свет       ├────────┤
//   │                     │Детская2│  ← front facade
//   └─────────────────────┴────────┘
function layoutUpperGallery(
  inner: Rect,
  voidR: Rect,
  specs: Spec[],
  out: Room[],
  opts: { corridor: string },
): boolean {
  const col = serviceColumn(inner, voidR)
  const { rx, rw } = col
  // a room still fits beside a corridor in the column: keep the classic scheme
  if (rw - PLAN.minCorridor >= PLAN.minRoomSide) return false
  const stair = specs.find((s) => s.type === 'stair')
  const bath = specs.find((s) => s.type === 'bath')
  const office = specs.find((s) => s.type === 'office')
  const beds = specs.filter((s) => s.type === 'bedroom')
  const galleryY = voidR.y - PLAN.galleryWidth
  const backH = galleryY - inner.y // depth of the rooms behind the gallery
  const hallH = col.stairY - galleryY // column hall between the gallery and the stair
  const frontY = col.stairY + col.stairH
  const frontH = inner.y + inner.h - frontY
  const frontBed =
    beds.length > 0 && Math.min(rw, frontH) >= PLAN.minRoomSide && rw * frontH >= C.norms.minRoomArea * 1.05
      ? beds[beds.length - 1]
      : null
  const backRooms = [...(frontBed ? beds.slice(0, -1) : beds), ...(office ? [office] : [])]
  if (!stair || !bath || !frontBed || backRooms.length === 0) return false
  if (backH < PLAN.minRoomSide || hallH < PLAN.minCorridor) return false
  const bw = voidR.w / backRooms.length
  if (bw < PLAN.minRoomSide || Math.max(bw, backH) / Math.min(bw, backH) > 2) return false

  out.push({ x: rx, y: col.stairY, w: rw, h: col.stairH, type: 'stair', label: stair.label })
  out.push({ x: inner.x, y: galleryY, w: voidR.w, h: PLAN.galleryWidth, type: 'corridor', label: opts.corridor, gallery: true })
  out.push({ x: rx, y: galleryY, w: rw, h: hallH, type: 'corridor', label: opts.corridor })
  backRooms.forEach((s, i) => out.push({ x: inner.x + i * bw, y: inner.y, w: bw, h: backH, type: s.type, label: s.label }))
  // the bathroom sits over the ground-floor ensuite: wet rooms stacked, short risers
  out.push({ x: rx, y: inner.y, w: rw, h: backH, type: 'bath', label: bath.label })
  out.push({ x: rx, y: frontY, w: rw, h: frontH, type: 'bedroom', label: frontBed.label })
  return true
}

function layoutUpperWithVoid(
  inner: Rect,
  voidR: Rect,
  specs: Spec[],
  out: Room[],
  opts: { corridor: string; office: string },
) {
  if (layoutUpperGallery(inner, voidR, specs, out, opts)) return
  const col = serviceColumn(inner, voidR)
  const { rx, rw } = col
  const stair = specs.find((s) => s.type === 'stair')
  const bath = specs.find((s) => s.type === 'bath')
  const office = specs.find((s) => s.type === 'office')
  const beds = specs.filter((s) => s.type === 'bedroom')

  // Лестница занимает колонку целиком и стоит ровно над лестницей первого
  // этажа — лестницы обязаны совпадать по вертикали. Поэтому коридор идёт не
  // насквозь, а двумя отрезками выше и ниже лестничной площадки.
  const corrW = Math.min(1.6, rw * 0.3)
  const roomsX = rx + corrW
  const roomsW = rw - corrW
  if (stair) out.push({ x: rx, y: col.stairY, w: rw, h: col.stairH, type: 'stair', label: stair.label })

  const topH = col.topH
  // Коридор-галерея: поднявшись, выходишь сюда и уже отсюда попадаешь в любую
  // комнату. Раньше комнаты соединялись напрямую, то есть были проходными.
  // Он же галерея — с него вид вниз в двусветный зал.
  if (topH > PLAN.minCorridor) {
    out.push({ x: rx, y: inner.y, w: corrW, h: topH, type: 'corridor', label: opts.corridor, gallery: true })
  }
  const belowY = col.stairY + col.stairH
  const belowH = inner.y + inner.h - belowY
  // If the bedrooms above the stair would drop under the minimum room area,
  // the last one moves below the stair, onto the facade, and the bath keeps the
  // strip by the stair. Otherwise a 13 m² bath sits next to 7.5 m² bedrooms.
  const minBed = C.norms.minRoomArea * 1.05
  const bedBelowH = Math.max(minBed / Math.max(roomsW, 0.1), belowH * 0.6)
  const bedBelow =
    beds.length >= 2 && roomsW >= 1.6 && topH * roomsW < minBed * beds.length && belowH - bedBelowH >= 1.2
      ? beds[beds.length - 1]
      : null
  const topBeds = bedBelow ? beds.slice(0, -1) : beds
  if (belowH > PLAN.minCorridor) {
    out.push({ x: rx, y: belowY, w: corrW, h: belowH, type: 'corridor', label: '', gallery: true })
    const bathH = !bedBelow ? belowH : bath ? belowH - bedBelowH : 0
    if (bath && bathH > 0) out.push({ x: roomsX, y: belowY, w: roomsW, h: bathH, type: 'bath', label: bath.label })
    if (bedBelow) {
      out.push({ x: roomsX, y: belowY + bathH, w: roomsW, h: belowH - bathH, type: 'bedroom', label: bedBelow.label })
    }
  }

  if (roomsW < 1.6) return
  if (topBeds.length > 0 && topH > 1.2) {
    const n = Math.max(1, topBeds.length)
    const ratio = (w: number, h: number) => Math.max(w, h) / Math.min(w, h)
    if (ratio(roomsW, topH / n) <= ratio(roomsW / n, topH)) {
      const bh = topH / n
      for (let i = 0; i < n; i++) {
        out.push({ x: roomsX, y: inner.y + i * bh, w: roomsW, h: bh, type: 'bedroom', label: topBeds[i]?.label ?? topBeds[0].label })
      }
    } else {
      const bw = roomsW / n
      for (let i = 0; i < n; i++) {
        out.push({ x: roomsX + i * bw, y: inner.y, w: bw, h: topH, type: 'bedroom', label: topBeds[i]?.label ?? topBeds[0].label })
      }
    }
  }

  // Полоса над кухней — кабинет; вход в него с той же галереи.
  const gh = voidR.y - inner.y
  if (gh >= PLAN.minCorridor) {
    // Кабинет занимает часть полосы с пропорцией не хуже 1:1.6, остальное —
    // галерея у проёма, иначе кабинет вытягивается в пенал 8×3.
    const officeW = office ? Math.min(voidR.w * 0.6, gh * 1.6) : 0
    if (office && officeW >= 2.4) {
      // Кабинет — в дальнем углу, галерея примыкает к коридору правой колонки.
      // Иначе в галерею можно попасть только через кабинет.
      out.push({ x: inner.x, y: inner.y, w: officeW, h: gh, type: 'office', label: office.label })
      out.push({ x: inner.x + officeW, y: inner.y, w: voidR.w - officeW, h: gh, type: 'corridor', label: opts.corridor, gallery: true })
    } else {
      out.push({ x: inner.x, y: inner.y, w: voidR.w, h: gh, type: 'corridor', label: opts.corridor, gallery: true })
    }
  }
}

// Левая колонка под общую зону.// Левая колонка под общую зону. Одна комната на 90+ м² и глубиной 11 м — это
// зал, а не жильё: далёкий от окон угол остаётся тёмным и непригодным.
// Поэтому крупную студию делим по горизонтали: кухня-столовая ближе к
// служебной зоне, гостиная — у входа.
function pushLivingColumn(rect: Rect, living: Spec, out: Room[], opts: { dining: string; living: string }) {
  const area = rect.w * rect.h
  const tooDeep = rect.h > PLAN.maxRoomDepth
  const tooBig = area > PLAN.maxStudioArea
  const splittable = living.type === 'living_kitchen' || living.type === 'living'
  if (!splittable || (!tooDeep && !tooBig)) {
    out.push({ ...rect, type: living.type, label: living.label })
    return
  }
  // кухня-столовая сверху (рядом с санузлом и лестницей — короче коммуникации)
  const diningH = Math.max(3.2, Math.min(rect.h * 0.42, PLAN.maxRoomDepth))
  out.push({ x: rect.x, y: rect.y, w: rect.w, h: diningH, type: 'dining', label: opts.dining })
  out.push({ x: rect.x, y: rect.y + diningH, w: rect.w, h: rect.h - diningH, type: 'living', label: opts.living })
}

// Recursive binary split of a rectangle by room weights (split along longer side).
function slice(rect: { x: number; y: number; w: number; h: number }, specs: Spec[], out: Room[]) {
  if (specs.length === 1) {
    const s = specs[0]
    out.push({ ...rect, type: s.type, label: s.label })
    return
  }
  const total = specs.reduce((a, s) => a + s.weight, 0)
  // split specs into two groups near half the weight
  let acc = 0
  let idx = 0
  for (let i = 0; i < specs.length; i++) {
    acc += specs[i].weight
    if (acc >= total / 2) {
      idx = i + 1
      break
    }
  }
  idx = Math.min(Math.max(1, idx), specs.length - 1)
  const a = specs.slice(0, idx)
  const b = specs.slice(idx)
  const aw = a.reduce((x, s) => x + s.weight, 0) / total

  if (rect.w >= rect.h) {
    const w1 = rect.w * aw
    slice({ ...rect, w: w1 }, a, out)
    slice({ x: rect.x + w1, y: rect.y, w: rect.w - w1, h: rect.h }, b, out)
  } else {
    const h1 = rect.h * aw
    slice({ ...rect, h: h1 }, a, out)
    slice({ x: rect.x, y: rect.y + h1, w: rect.w, h: rect.h - h1 }, b, out)
  }
}
