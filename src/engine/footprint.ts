// The outline of a house that is not one rectangle: a project's ground floor
// and top floor as unions of rectangles, measured off its drawings.
//
// The estimate needs few numbers from an outline: its area, its perimeter,
// the area inside the outer walls, and how much of the top floor's outline
// stands on the ground floor's (the rest of the ground floor's edge carries a
// roof edge of its own). They are counted on a 25 mm grid, which is exact for
// outlines drawn on that grid.

export interface FRect {
  x: number
  y: number
  w: number
  h: number
}

// Metres in the plan frame of the house it was drawn for (x along the main
// facade, y from the back wall); L and W are that house's plan size, so the
// outline stretches with the house when its size is edited.
export interface Footprint {
  L: number
  W: number
  ground: FRect[]
  top: FRect[]
}

export interface OutlineGeom {
  area: number
  perimeter: number
  components: number
}

export interface FootprintGeom {
  ground: OutlineGeom
  top: OutlineGeom
  // length of the top floor's outline lying on the ground floor's outline
  shared: number
}

const CELL = 0.025

// The outline stretched to a house of plan size L × W.
export function scaleFootprint(fp: Footprint, L: number, W: number): { ground: FRect[]; top: FRect[] } {
  const sx = fp.L > 0 ? L / fp.L : 1
  const sy = fp.W > 0 ? W / fp.W : 1
  const s = (r: FRect) => ({ x: r.x * sx, y: r.y * sy, w: r.w * sx, h: r.h * sy })
  return { ground: fp.ground.map(s), top: fp.top.map(s) }
}

function raster(rects: FRect[], nx: number, ny: number): Uint8Array {
  const g = new Uint8Array(nx * ny)
  for (const r of rects) {
    const i0 = Math.max(0, Math.round(r.x / CELL))
    const i1 = Math.min(nx, Math.round((r.x + r.w) / CELL))
    const j0 = Math.max(0, Math.round(r.y / CELL))
    const j1 = Math.min(ny, Math.round((r.y + r.h) / CELL))
    for (let j = j0; j < j1; j++) g.fill(1, j * nx + i0, j * nx + i1)
  }
  return g
}

function outline(g: Uint8Array, nx: number, ny: number): OutlineGeom {
  let cells = 0
  let edges = 0
  const at = (i: number, j: number) => (i >= 0 && j >= 0 && i < nx && j < ny ? g[j * nx + i] : 0)
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      if (!g[j * nx + i]) continue
      cells++
      edges += 4 - at(i - 1, j) - at(i + 1, j) - at(i, j - 1) - at(i, j + 1)
    }
  }
  // connected parts: each turns its outer wall corners inward once
  const seen = new Uint8Array(nx * ny)
  let components = 0
  for (let k = 0; k < nx * ny; k++) {
    if (!g[k] || seen[k]) continue
    components++
    const stack = [k]
    seen[k] = 1
    while (stack.length) {
      const c = stack.pop()!
      const i = c % nx
      const j = (c - i) / nx
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const a = i + di
        const b = j + dj
        const n = b * nx + a
        if (a >= 0 && b >= 0 && a < nx && b < ny && g[n] && !seen[n]) {
          seen[n] = 1
          stack.push(n)
        }
      }
    }
  }
  return { area: cells * CELL * CELL, perimeter: edges * CELL, components }
}

export function footprintGeom(ground: FRect[], top: FRect[]): FootprintGeom {
  const all = [...ground, ...top]
  const nx = Math.ceil(Math.max(0, ...all.map((r) => r.x + r.w)) / CELL) + 1
  const ny = Math.ceil(Math.max(0, ...all.map((r) => r.y + r.h)) / CELL) + 1
  const g = raster(ground, nx, ny)
  const t = raster(top, nx, ny)
  // an edge of the top outline is shared when the ground outline has the same
  // edge with the outside on the same side
  let shared = 0
  const at = (a: Uint8Array, i: number, j: number) => (i >= 0 && j >= 0 && i < nx && j < ny ? a[j * nx + i] : 0)
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      if (!t[j * nx + i]) continue
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        if (!at(t, i + di, j + dj) && at(g, i, j) && !at(g, i + di, j + dj)) shared++
      }
    }
  }
  return { ground: outline(g, nx, ny), top: outline(t, nx, ny), shared: shared * CELL }
}

// Area inside outer walls of thickness t: each straight run loses t, and every
// part of a rectilinear outline has four more outer corners than inner ones.
export function innerArea(o: OutlineGeom, t: number): number {
  return Math.max(0, o.area - o.perimeter * t + 4 * t * t * o.components)
}

export function innerPerimeter(o: OutlineGeom, t: number): number {
  return Math.max(0, o.perimeter - 8 * t * o.components)
}

// a minus b, as rectangles (the roof of the floor below beside a partial top).
export function subtractRects(a: FRect[], b: FRect[]): FRect[] {
  const out: FRect[] = []
  for (const r of a) {
    const xs = [...new Set([r.x, r.x + r.w, ...b.flatMap((h) => [h.x, h.x + h.w]).filter((v) => v > r.x && v < r.x + r.w)])].sort((p, q) => p - q)
    const ys = [...new Set([r.y, r.y + r.h, ...b.flatMap((h) => [h.y, h.y + h.h]).filter((v) => v > r.y && v < r.y + r.h)])].sort((p, q) => p - q)
    for (let i = 0; i + 1 < xs.length; i++) {
      for (let j = 0; j + 1 < ys.length; j++) {
        const cx = (xs[i] + xs[i + 1]) / 2
        const cy = (ys[j] + ys[j + 1]) / 2
        if (b.some((h) => cx > h.x && cx < h.x + h.w && cy > h.y && cy < h.y + h.h)) continue
        if (out.some((o) => cx > o.x && cx < o.x + o.w && cy > o.y && cy < o.y + o.h)) continue
        out.push({ x: xs[i], y: ys[j], w: xs[i + 1] - xs[i], h: ys[j + 1] - ys[j] })
      }
    }
  }
  return out
}
