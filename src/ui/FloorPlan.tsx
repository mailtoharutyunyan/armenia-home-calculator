import type { HouseParams } from '../model/house'
import type { Door, Room, Spec } from '../engine/floorplan'
import { buildFloorPlan } from '../engine/floorplan'

const WALL = '#33383e'
const ROOM = '#eef0f2'
const FURN = '#9aa0a6'
const TXT = '#3f454c'

export function FloorPlanSvg({ house, floorIndex, custom, voidLabel }: { house: HouseParams; floorIndex: number; custom?: Spec[]; voidLabel?: string }) {
  const plan = buildFloorPlan(house, floorIndex, custom, voidLabel)
  const { L, W, wall, rooms, windows, doors } = plan
  const pad = 1.6
  const wc = wall * 1.15 // opening cover width

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
          <path d="M0.5 0 L0 0 0 0.5" fill="none" stroke="#e2e6ea" strokeWidth="0.012" />
        </pattern>
        <pattern id="voidhatch" width="0.7" height="0.7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="0.7" stroke="#c2c9d0" strokeWidth="0.05" />
        </pattern>
      </defs>

      {/* room fills + partitions + furniture + labels */}
      {rooms.map((r, i) =>
        r.open ? (
          <g key={i}>
            <rect x={r.x} y={r.y} width={r.w} height={r.h} fill="#f6f8fa" />
            <rect x={r.x} y={r.y} width={r.w} height={r.h} fill="url(#voidhatch)" />
            <rect x={r.x} y={r.y} width={r.w} height={r.h} fill="none" stroke={WALL} strokeWidth={0.09} strokeDasharray="0.35 0.22" />
            <text x={r.x + r.w / 2} y={r.y + r.h / 2} textAnchor="middle" fontSize={Math.min(0.5, r.w / 9)} fill={TXT} fontFamily="Inter, sans-serif" fontWeight={600}>
              {r.label}
            </text>
          </g>
        ) : (
          <g key={i}>
            <rect x={r.x} y={r.y} width={r.w} height={r.h} fill={ROOM} />
            <rect x={r.x} y={r.y} width={r.w} height={r.h} fill="url(#grid)" />
            <rect x={r.x} y={r.y} width={r.w} height={r.h} fill="none" stroke={WALL} strokeWidth={0.09} />
            <Furniture room={r} />
            <text x={r.x + r.w / 2} y={r.y + r.h / 2 - 0.1} textAnchor="middle" fontSize={Math.min(0.52, r.w / 7)} fill={TXT} fontFamily="Inter, sans-serif" fontWeight={600}>
              {r.label}
            </text>
            <text x={r.x + r.w / 2} y={r.y + r.h / 2 + 0.5} textAnchor="middle" fontSize={0.34} fill={TXT} opacity={0.65} fontFamily="Inter, sans-serif">
              {r.w.toFixed(1)}×{r.h.toFixed(1)} м
            </text>
          </g>
        ),
      )}

      {/* outer wall */}
      <rect x={0} y={0} width={L} height={W} fill="none" stroke={WALL} strokeWidth={wall * 2} />

      {/* windows: cut opening + double frame line */}
      {windows.map((wn, i) => {
        const horiz = wn.side === 'top' || wn.side === 'bottom'
        const cx = horiz ? wn.x : wn.side === 'left' ? 0 : L
        const cy = horiz ? (wn.side === 'top' ? 0 : W) : wn.y
        if (horiz) {
          return (
            <g key={i}>
              <rect x={cx} y={cy - wall} width={wn.len} height={wall * 2} fill="#fff" />
              <line x1={cx} y1={cy - 0.05} x2={cx + wn.len} y2={cy - 0.05} stroke={WALL} strokeWidth={0.04} />
              <line x1={cx} y1={cy + 0.05} x2={cx + wn.len} y2={cy + 0.05} stroke={WALL} strokeWidth={0.04} />
            </g>
          )
        }
        return (
          <g key={i}>
            <rect x={cx - wall} y={cy} width={wall * 2} height={wn.len} fill="#fff" />
            <line x1={cx - 0.05} y1={cy} x2={cx - 0.05} y2={cy + wn.len} stroke={WALL} strokeWidth={0.04} />
            <line x1={cx + 0.05} y1={cy} x2={cx + 0.05} y2={cy + wn.len} stroke={WALL} strokeWidth={0.04} />
          </g>
        )
      })}

      {/* doors: cut opening + leaf + swing arc */}
      {doors.map((d, i) => (
        <DoorSymbol key={i} door={d} wc={wc} />
      ))}

      {/* dimensions */}
      <DimLine L={L} W={W} pad={pad} />
    </svg>
  )
}

function DoorSymbol({ door, wc }: { door: Door; wc: number }) {
  const s = { stroke: WALL, strokeWidth: 0.05, fill: 'none' } as const
  if (door.orient === 'v') {
    const x = door.pos
    const y0 = door.start
    const y1 = door.start + door.w
    const ex = x + door.swing * door.w
    return (
      <g>
        <rect x={x - wc / 2} y={y0} width={wc} height={door.w} fill="#fff" />
        <line x1={x} y1={y0} x2={ex} y2={y0} {...s} />
        <path d={`M ${ex} ${y0} A ${door.w} ${door.w} 0 0 ${door.swing > 0 ? 1 : 0} ${x} ${y1}`} {...s} opacity={0.6} />
      </g>
    )
  }
  const y = door.pos
  const x0 = door.start
  const x1 = door.start + door.w
  const ey = y + door.swing * door.w
  return (
    <g>
      <rect x={x0} y={y - wc / 2} width={door.w} height={wc} fill="#fff" />
      <line x1={x0} y1={y} x2={x0} y2={ey} {...s} />
      <path d={`M ${x0} ${ey} A ${door.w} ${door.w} 0 0 ${door.swing > 0 ? 0 : 1} ${x1} ${y}`} {...s} opacity={0.6} />
    </g>
  )
}

function DimLine({ L, W, pad }: { L: number; W: number; pad: number }) {
  return (
    <g stroke={TXT} strokeWidth={0.02} fill={TXT} fontFamily="Inter, sans-serif">
      <line x1={0} y1={W + pad * 0.55} x2={L} y2={W + pad * 0.55} />
      <text x={L / 2} y={W + pad * 0.9} textAnchor="middle" fontSize={0.45} stroke="none">
        {L.toFixed(1)} м
      </text>
      <line x1={-pad * 0.55} y1={0} x2={-pad * 0.55} y2={W} />
      <text x={-pad * 0.85} y={W / 2} textAnchor="middle" fontSize={0.45} stroke="none" transform={`rotate(-90 ${-pad * 0.85} ${W / 2})`}>
        {W.toFixed(1)} м
      </text>
    </g>
  )
}

function Furniture({ room }: { room: Room }) {
  const { x, y, w, h, type } = room
  if (w < 1.6 || h < 1.6) return null // too small to furnish cleanly
  const m = 0.4
  const s = { stroke: FURN, strokeWidth: 0.05, fill: 'none' } as const
  const fill = { stroke: FURN, strokeWidth: 0.05, fill: '#f6f7f8' } as const

  switch (type) {
    case 'bedroom': {
      const bw = Math.min(w * 0.5, 1.7)
      const bh = Math.min(h * 0.45, 2.0)
      const bx = x + w - bw - m
      const by = y + m
      return (
        <g>
          <rect x={bx} y={by} width={bw} height={bh} rx={0.08} {...fill} />
          <rect x={bx + 0.12} y={by + 0.12} width={bw - 0.24} height={bh * 0.22} rx={0.06} {...s} />
          <line x1={bx} y1={by + bh * 0.3} x2={bx + bw} y2={by + bh * 0.3} {...s} />
          {bx - 0.5 > x + 0.1 && <rect x={bx - 0.5} y={by} width={0.4} height={0.4} {...s} />}
        </g>
      )
    }
    case 'bath': {
      const tw = Math.min(w - 2 * m, 1.6)
      const stack = h > 2.6
      return (
        <g>
          <rect x={x + m} y={y + m} width={tw} height={0.7} rx={0.16} {...fill} />
          <circle cx={x + m + 0.25} cy={y + m + 0.35} r={0.08} {...s} />
          {stack && (
            <>
              <rect x={x + m} y={y + m + 1.0} width={0.5} height={0.42} rx={0.08} {...fill} />
              <ellipse cx={x + m + 1.0} cy={y + m + 1.3} rx={0.24} ry={0.3} {...fill} />
            </>
          )}
        </g>
      )
    }
    case 'kitchen':
      return <Kitchen x={x + m} y={y + m} w={Math.min(w - 2 * m, 2.6)} s={s} fill={fill} />
    case 'living': {
      const sw = Math.min(w - 2 * m, 2.4)
      return (
        <g>
          <Sofa x={x + m} y={y + h - m - 0.9} w={sw} s={s} fill={fill} />
          {h > 3 && <rect x={x + m + 0.4} y={y + h - m - 1.9} width={Math.min(1.2, sw - 0.6)} height={0.55} rx={0.08} {...s} />}
        </g>
      )
    }
    case 'living_kitchen': {
      const kw = Math.min(w * 0.45, 2.4)
      const sw = Math.min(w * 0.5, 2.4)
      return (
        <g>
          <Kitchen x={x + w - kw - m} y={y + m} w={kw} s={s} fill={fill} />
          {w > 4 && h > 4 && (
            <>
              <rect x={x + w / 2 - 0.7} y={y + h / 2 - 0.5} width={1.4} height={1.0} rx={0.06} {...s} />
              {[-0.45, 0.45].map((dx, k) => (
                <g key={k}>
                  <rect x={x + w / 2 + dx - 0.18} y={y + h / 2 - 0.85} width={0.36} height={0.28} {...s} />
                  <rect x={x + w / 2 + dx - 0.18} y={y + h / 2 + 0.57} width={0.36} height={0.28} {...s} />
                </g>
              ))}
            </>
          )}
          <Sofa x={x + m} y={y + h - m - 0.9} w={sw} s={s} fill={fill} />
        </g>
      )
    }
    default:
      return null
  }
}

function Sofa({ x, y, w, s, fill }: { x: number; y: number; w: number; s: object; fill: object }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={0.95} rx={0.14} {...fill} />
      <rect x={x} y={y} width={w} height={0.3} rx={0.1} {...s} />
      <line x1={x + w / 2} y1={y + 0.3} x2={x + w / 2} y2={y + 0.95} {...s} />
    </g>
  )
}

function Kitchen({ x, y, w, s, fill }: { x: number; y: number; w: number; s: object; fill: object }) {
  return (
    <g>
      {/* counter */}
      <rect x={x} y={y} width={w} height={0.6} {...fill} />
      {/* sink */}
      <rect x={x + 0.2} y={y + 0.12} width={0.5} height={0.36} rx={0.06} {...s} />
      {/* stove — 4 burners */}
      {[0, 1].map((r) =>
        [0, 1].map((c) => (
          <circle key={`${r}${c}`} cx={x + w - 0.75 + c * 0.35} cy={y + 0.18 + r * 0.3} r={0.11} {...s} />
        )),
      )}
      {/* fridge */}
      <rect x={x} y={y + 0.75} width={0.6} height={0.6} {...s} />
    </g>
  )
}
