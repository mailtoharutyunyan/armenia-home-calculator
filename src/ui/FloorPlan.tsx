import type { HouseParams } from '../model/house'
import type { Door, Room, Spec } from '../engine/floorplan'
import { buildFloorPlan } from '../engine/floorplan'
import { useProject } from '../store/useProject'

type Pal = { sheet: string; wall: string; room: string; furn: string; txt: string; grid: string; hatch: string; voidFill: string; furnFill: string }
const LIGHT: Pal = { sheet: '#ffffff', wall: '#33383e', room: '#eef0f2', furn: '#9aa0a6', txt: '#3f454c', grid: '#e2e6ea', hatch: '#c2c9d0', voidFill: '#f6f8fa', furnFill: '#f6f7f8' }
const DARK: Pal = { sheet: '#191b20', wall: '#d8d5cb', room: '#23262e', furn: '#8b8f99', txt: '#cdd0d6', grid: 'rgba(255,255,255,0.06)', hatch: '#3a3f49', voidFill: '#111318', furnFill: 'rgba(255,255,255,0.05)' }
let PAL: Pal = LIGHT


export function FloorPlanSvg({ house, floorIndex, custom, labels }: { house: HouseParams; floorIndex: number; custom?: Spec[]; labels?: import('../engine/floorplan').PlanLabels }) {
  PAL = useProject((st) => st.theme) === 'dark' ? DARK : LIGHT
  const plan = buildFloorPlan(house, floorIndex, custom, labels)
  const { L, W, wall, rooms, windows, doors } = plan
  const pad = 1.6
  const wc = wall * 1.15 // opening cover width

  if (L <= 0 || W <= 0) return null

  return (
    <svg
      viewBox={`${-pad} ${-pad} ${L + 2 * pad} ${W + 2 * pad}`}
      style={{ width: '100%', height: 'auto', display: 'block', background: PAL.sheet, borderRadius: 12 }}
      role="img"
      aria-label="Планировка"
    >
      <defs>
        <pattern id="grid" width="0.5" height="0.5" patternUnits="userSpaceOnUse">
          <path d="M0.5 0 L0 0 0 0.5" fill="none" stroke={PAL.grid} strokeWidth="0.012" />
        </pattern>
        <pattern id="voidhatch" width="0.7" height="0.7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="0.7" stroke={PAL.hatch} strokeWidth="0.05" />
        </pattern>
      </defs>

      {/* room fills + partitions + furniture + labels */}
      {rooms.map((r, i) =>
        r.gallery ? (
          <g key={i}>
            <rect x={r.x} y={r.y} width={r.w} height={r.h} fill={PAL.room} />
            <rect x={r.x} y={r.y} width={r.w} height={r.h} fill="url(#grid)" />
            <rect x={r.x} y={r.y} width={r.w} height={r.h} fill="none" stroke={PAL.wall} strokeWidth={0.09} strokeDasharray="0.4 0.24" />
            <text x={r.x + r.w / 2} y={r.y + r.h / 2 + 0.12} textAnchor="middle" fontSize={Math.min(0.42, r.h / 2.4)} fill={PAL.txt} fontFamily="Inter, sans-serif" fontWeight={600}>
              {r.label}
            </text>
          </g>
        ) : r.open ? (
          <g key={i}>
            <rect x={r.x} y={r.y} width={r.w} height={r.h} fill={PAL.voidFill} />
            <rect x={r.x} y={r.y} width={r.w} height={r.h} fill="url(#voidhatch)" />
            <rect x={r.x} y={r.y} width={r.w} height={r.h} fill="none" stroke={PAL.wall} strokeWidth={0.09} strokeDasharray="0.35 0.22" />
            <text x={r.x + r.w / 2} y={r.y + r.h / 2} textAnchor="middle" fontSize={Math.min(0.5, r.w / 9)} fill={PAL.txt} fontFamily="Inter, sans-serif" fontWeight={600}>
              {r.label}
            </text>
          </g>
        ) : (
          (() => {
            // fit the label to the room width; show dimensions only when there is room
            const fs = Math.max(0.15, Math.min(0.48, (r.w - 0.35) / Math.max(5, r.label.length * 0.62), r.h / 3.2))
            const showDims = r.w > 2.8 && r.h > 2.6
            const cx = r.x + r.w / 2
            const cy = r.y + r.h / 2
            return (
              <g key={i}>
                <rect x={r.x} y={r.y} width={r.w} height={r.h} fill={PAL.room} />
                <rect x={r.x} y={r.y} width={r.w} height={r.h} fill="url(#grid)" />
                <rect x={r.x} y={r.y} width={r.w} height={r.h} fill="none" stroke={PAL.wall} strokeWidth={0.09} />
                <Furniture room={r} />
                <text x={cx} y={cy - (showDims ? 0.12 : -0.06)} textAnchor="middle" fontSize={fs} fill={PAL.txt} fontFamily="Inter, sans-serif" fontWeight={600}>
                  {r.label}
                </text>
                {showDims && (
                  <text x={cx} y={cy + 0.48} textAnchor="middle" fontSize={Math.min(0.32, fs * 0.72)} fill={PAL.txt} opacity={0.62} fontFamily="Inter, sans-serif">
                    {r.w.toFixed(1)}×{r.h.toFixed(1)} = {(r.w * r.h).toFixed(1)} м²
                  </text>
                )}
              </g>
            )
          })()
        ),
      )}

      {/* outer wall */}
      <rect x={0} y={0} width={L} height={W} fill="none" stroke={PAL.wall} strokeWidth={wall * 2} />

      {/* windows: cut opening + double frame line */}
      {windows.map((wn, i) => {
        const horiz = wn.side === 'top' || wn.side === 'bottom'
        const cx = horiz ? wn.x : wn.side === 'left' ? 0 : L
        const cy = horiz ? (wn.side === 'top' ? 0 : W) : wn.y
        if (horiz) {
          return (
            <g key={i}>
              <rect x={cx} y={cy - wall} width={wn.len} height={wall * 2} fill={PAL.sheet} />
              <line x1={cx} y1={cy - 0.05} x2={cx + wn.len} y2={cy - 0.05} stroke={PAL.wall} strokeWidth={0.04} />
              <line x1={cx} y1={cy + 0.05} x2={cx + wn.len} y2={cy + 0.05} stroke={PAL.wall} strokeWidth={0.04} />
            </g>
          )
        }
        return (
          <g key={i}>
            <rect x={cx - wall} y={cy} width={wall * 2} height={wn.len} fill={PAL.sheet} />
            <line x1={cx - 0.05} y1={cy} x2={cx - 0.05} y2={cy + wn.len} stroke={PAL.wall} strokeWidth={0.04} />
            <line x1={cx + 0.05} y1={cy} x2={cx + 0.05} y2={cy + wn.len} stroke={PAL.wall} strokeWidth={0.04} />
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
  const s = { stroke: PAL.wall, strokeWidth: 0.05, fill: 'none' } as const
  if (door.orient === 'v') {
    const x = door.pos
    const y0 = door.start
    const y1 = door.start + door.w
    const ex = x + door.swing * door.w
    return (
      <g>
        <rect x={x - wc / 2} y={y0} width={wc} height={door.w} fill={PAL.sheet} />
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
      <rect x={x0} y={y - wc / 2} width={door.w} height={wc} fill={PAL.sheet} />
      <line x1={x0} y1={y} x2={x0} y2={ey} {...s} />
      <path d={`M ${x0} ${ey} A ${door.w} ${door.w} 0 0 ${door.swing > 0 ? 0 : 1} ${x1} ${y}`} {...s} opacity={0.6} />
    </g>
  )
}

function DimLine({ L, W, pad }: { L: number; W: number; pad: number }) {
  return (
    <g stroke={PAL.txt} strokeWidth={0.02} fill={PAL.txt} fontFamily="Inter, sans-serif">
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
  const s = { stroke: PAL.furn, strokeWidth: 0.05, fill: 'none' } as const
  const fill = { stroke: PAL.furn, strokeWidth: 0.05, fill: PAL.furnFill } as const

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
    case 'stair': {
      const n = 7
      const gap = (h - 2 * m) / n
      return (
        <g>
          <rect x={x + m} y={y + m} width={w - 2 * m} height={h - 2 * m} {...s} />
          {Array.from({ length: n - 1 }, (_, k) => (
            <line key={k} x1={x + m} y1={y + m + (k + 1) * gap} x2={x + w - m} y2={y + m + (k + 1) * gap} {...s} />
          ))}
        </g>
      )
    }
    case 'wardrobe': {
      const ry = y + m + 0.35
      return (
        <g>
          <line x1={x + m} y1={ry} x2={x + w - m} y2={ry} {...s} />
          {Array.from({ length: 4 }, (_, k) => {
            const hx = x + m + 0.35 + (k * (w - 2 * m - 0.7)) / 3
            return <path key={k} d={`M ${hx} ${ry} q -0.16 0.22 0 0.34 q 0.16 -0.12 0 -0.34`} {...s} />
          })}
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
