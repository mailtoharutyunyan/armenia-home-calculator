import type { HouseParams } from '../model/house'
import type { Room } from '../engine/floorplan'
import { buildFloorPlan } from '../engine/floorplan'

const WALL = '#33383e'
const ROOM = '#eef0f2'
const FURN = '#8b9096'
const TXT = '#4b5158'

export function FloorPlanSvg({ house, floorIndex }: { house: HouseParams; floorIndex: number }) {
  const plan = buildFloorPlan(house, floorIndex)
  const { L, W, wall, rooms, windows } = plan
  const pad = 1.4

  if (L <= 0 || W <= 0) return null

  return (
    <svg
      viewBox={`${-pad} ${-pad} ${L + 2 * pad} ${W + 2 * pad}`}
      style={{ width: '100%', height: 'auto', display: 'block', background: '#fff', borderRadius: 12 }}
      role="img"
      aria-label="Планировка"
    >
      <defs>
        <pattern id="grid" width="0.5" height="0.5" patternUnits="userSpaceOnUse">
          <path d="M0.5 0 L0 0 0 0.5" fill="none" stroke="#dfe3e7" strokeWidth="0.015" />
        </pattern>
      </defs>

      {/* rooms */}
      {rooms.map((r, i) => (
        <g key={i}>
          <rect x={r.x} y={r.y} width={r.w} height={r.h} fill={ROOM} />
          <rect x={r.x} y={r.y} width={r.w} height={r.h} fill="url(#grid)" />
          <rect x={r.x} y={r.y} width={r.w} height={r.h} fill="none" stroke={WALL} strokeWidth={0.08} />
          <Furniture room={r} />
          <text x={r.x + r.w / 2} y={r.y + r.h / 2} textAnchor="middle" fontSize={Math.min(0.5, r.w / 8)} fill={TXT} fontFamily="Inter, sans-serif" fontWeight={600}>
            {r.label}
          </text>
          <text x={r.x + r.w / 2} y={r.y + r.h / 2 + 0.55} textAnchor="middle" fontSize={0.32} fill={TXT} opacity={0.7} fontFamily="Inter, sans-serif">
            {r.w.toFixed(1)}×{r.h.toFixed(1)} м
          </text>
        </g>
      ))}

      {/* outer wall */}
      <rect x={0} y={0} width={L} height={W} fill="none" stroke={WALL} strokeWidth={wall * 2} />

      {/* windows */}
      {windows.map((wn, i) => {
        if (wn.side === 'top' || wn.side === 'bottom') {
          const y = wn.side === 'top' ? 0 : W
          return <line key={i} x1={wn.x} y1={y} x2={wn.x + wn.len} y2={y} stroke="#fff" strokeWidth={wall * 2.2} />
        }
        const x = wn.side === 'left' ? 0 : L
        return <line key={i} x1={x} y1={wn.y} x2={x} y2={wn.y + wn.len} stroke="#fff" strokeWidth={wall * 2.2} />
      })}
      {windows.map((wn, i) => {
        if (wn.side === 'top' || wn.side === 'bottom') {
          const y = wn.side === 'top' ? 0 : W
          return <line key={`w${i}`} x1={wn.x} y1={y} x2={wn.x + wn.len} y2={y} stroke={WALL} strokeWidth={0.05} />
        }
        const x = wn.side === 'left' ? 0 : L
        return <line key={`w${i}`} x1={x} y1={wn.y} x2={x} y2={wn.y + wn.len} stroke={WALL} strokeWidth={0.05} />
      })}

      {/* dimensions */}
      <text x={L / 2} y={W + pad * 0.7} textAnchor="middle" fontSize={0.45} fill={TXT} fontFamily="Inter, sans-serif">
        {L.toFixed(1)} м
      </text>
      <text x={-pad * 0.6} y={W / 2} textAnchor="middle" fontSize={0.45} fill={TXT} fontFamily="Inter, sans-serif" transform={`rotate(-90 ${-pad * 0.6} ${W / 2})`}>
        {W.toFixed(1)} м
      </text>
    </svg>
  )
}

function Furniture({ room }: { room: Room }) {
  const { x, y, w, h, type } = room
  const m = 0.4 // margin inside room
  const rx = x + m
  const ry = y + m
  const rw = Math.max(0.5, w - 2 * m)
  const rh = Math.max(0.5, h - 2 * m)
  const s = { stroke: FURN, strokeWidth: 0.05, fill: 'none' } as const

  switch (type) {
    case 'bedroom': {
      const bw = Math.min(rw * 0.7, 2.0)
      const bh = Math.min(rh * 0.7, 2.2)
      const bx = rx + (rw - bw) / 2
      const by = ry
      return (
        <g>
          <rect x={bx} y={by} width={bw} height={bh} rx={0.1} {...s} />
          <rect x={bx + 0.1} y={by + 0.1} width={bw - 0.2} height={bh * 0.28} rx={0.08} {...s} />
        </g>
      )
    }
    case 'bath':
      return (
        <g>
          <rect x={rx} y={ry} width={Math.min(rw, 1.8)} height={Math.min(rh * 0.5, 0.8)} rx={0.15} {...s} />
          <circle cx={rx + Math.min(rw, 1.8) - 0.3} cy={ry + Math.min(rh * 0.5, 0.8) + 0.6} r={0.28} {...s} />
        </g>
      )
    case 'kitchen':
      return (
        <g>
          <rect x={rx} y={ry} width={rw} height={0.6} {...s} />
          <circle cx={rx + 0.5} cy={ry + 0.3} r={0.18} {...s} />
          <circle cx={rx + 1.0} cy={ry + 0.3} r={0.18} {...s} />
        </g>
      )
    case 'living':
      return sofa(rx, ry + rh - 1.0, Math.min(rw, 2.6), s)
    case 'living_kitchen':
      return (
        <g>
          {sofa(rx, ry + rh - 1.0, Math.min(rw * 0.6, 2.6), s)}
          <rect x={rx + rw - 1.6} y={ry} width={1.4} height={0.55} {...s} />
          <circle cx={rx + rw - 1.2} cy={ry + 0.28} r={0.16} {...s} />
          <rect x={rx + rw / 2 - 0.7} y={ry + rh / 2 - 0.5} width={1.4} height={1.0} rx={0.08} {...s} />
        </g>
      )
    default:
      return null
  }
}

function sofa(x: number, y: number, w: number, s: { stroke: string; strokeWidth: number; fill: string }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={0.9} rx={0.12} {...s} />
      <line x1={x} y1={y + 0.25} x2={x + w} y2={y + 0.25} {...s} />
    </g>
  )
}
