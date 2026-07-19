import type { Plan } from './plan'

// Minimal AutoCAD R12 DXF generator (LINE + TEXT entities on named layers).
// Opens directly in AutoCAD / LibreCAD / nanoCAD. Units = meters.

class DxfBuilder {
  private e: string[] = []

  line(layer: string, x1: number, y1: number, x2: number, y2: number) {
    this.e.push(
      '0', 'LINE', '8', layer,
      '10', f(x1), '20', f(y1), '30', '0',
      '11', f(x2), '21', f(y2), '31', '0',
    )
  }

  rect(layer: string, x: number, y: number, w: number, h: number) {
    this.line(layer, x, y, x + w, y)
    this.line(layer, x + w, y, x + w, y + h)
    this.line(layer, x + w, y + h, x, y + h)
    this.line(layer, x, y + h, x, y)
  }

  text(layer: string, x: number, y: number, height: number, value: string) {
    this.e.push('0', 'TEXT', '8', layer, '10', f(x), '20', f(y), '30', '0', '40', f(height), '1', value)
  }

  build(): string {
    return ['0', 'SECTION', '2', 'ENTITIES', ...this.e, '0', 'ENDSEC', '0', 'EOF'].join('\n')
  }
}

function f(n: number): string {
  return n.toFixed(3)
}

export function planToDxf(plan: Plan): string {
  const b = new DxfBuilder()
  const { length: L, width: W, wallThickness: t } = plan

  // FOUNDATION outline (offset outward 0.2 m)
  b.rect('FOUNDATION', -0.2, -0.2, L + 0.4, W + 0.4)

  // WALLS: outer + inner rectangle
  b.rect('WALLS', 0, 0, L, W)
  b.rect('WALLS', t, t, L - 2 * t, W - 2 * t)

  // OPENINGS
  for (const o of plan.openings) {
    if (o.wall === 'top' || o.wall === 'bottom') {
      const y = o.wall === 'top' ? W : 0
      b.line('OPENINGS', o.x, y, o.x, o.wall === 'top' ? W - t : t)
      b.line('OPENINGS', o.x + o.w, y, o.x + o.w, o.wall === 'top' ? W - t : t)
      b.line('OPENINGS', o.x, o.wall === 'top' ? W - t / 2 : t / 2, o.x + o.w, o.wall === 'top' ? W - t / 2 : t / 2)
    }
  }

  // DIMENSIONS (text)
  b.text('DIMENSIONS', L / 2 - 0.5, -0.8, 0.4, `${L.toFixed(1)} m`)
  b.text('DIMENSIONS', -1.2, W / 2, 0.4, `${W.toFixed(1)} m`)

  return b.build()
}

export function downloadDxf(plan: Plan, filename = 'plan.dxf') {
  const blob = new Blob([planToDxf(plan)], { type: 'application/dxf' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
