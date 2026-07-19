// Architectural isometric line drawing of a house (ink line-art on paper).
// Parametric by floors + roof so it echoes the current project.

const U = 30 // iso unit scale
const COS = 0.866
const SIN = 0.5

function iso(x: number, y: number, z: number, ox: number, oy: number) {
  return { X: ox + (x - y) * COS * U, Y: oy + (x + y) * SIN * U - z * U }
}

export function IsoHouse({ floors = 2, pitched = true }: { floors?: number; pitched?: boolean }) {
  const w = 3.2
  const d = 2.4
  const hw = Math.max(1, Math.min(floors, 3)) * 0.95
  const hr = pitched ? 0.9 : 0
  const ox = 150
  const oy = 120

  const P = (x: number, y: number, z: number) => iso(x, y, z, ox, oy)
  const p = (x: number, y: number, z: number) => {
    const q = P(x, y, z)
    return `${q.X.toFixed(1)},${q.Y.toFixed(1)}`
  }

  const ink = '#191813'
  const soft = '#9c5b43'
  const faceL = '#ecebe3'
  const faceR = '#e3e1d6'
  const roofF = '#ded9c9'

  return (
    <svg viewBox="0 0 300 240" style={{ width: '100%', height: 'auto', display: 'block' }} role="img" aria-label="Дом (изометрия)">
      {/* wall faces */}
      <polygon points={`${p(0, 0, 0)} ${p(w, 0, 0)} ${p(w, 0, hw)} ${p(0, 0, hw)}`} fill={faceL} stroke={ink} strokeWidth="1" strokeLinejoin="round" />
      <polygon points={`${p(w, 0, 0)} ${p(w, d, 0)} ${p(w, d, hw)} ${p(w, 0, hw)}`} fill={faceR} stroke={ink} strokeWidth="1" strokeLinejoin="round" />

      {/* floor division lines */}
      {Array.from({ length: Math.max(0, Math.min(floors, 3) - 1) }, (_, i) => {
        const z = ((i + 1) / Math.min(floors, 3)) * hw
        return (
          <g key={i} stroke={ink} strokeWidth="0.5" opacity="0.5">
            <line x1={P(0, 0, z).X} y1={P(0, 0, z).Y} x2={P(w, 0, z).X} y2={P(w, 0, z).Y} />
            <line x1={P(w, 0, z).X} y1={P(w, 0, z).Y} x2={P(w, d, z).X} y2={P(w, d, z).Y} />
          </g>
        )
      })}

      {/* windows on the two visible faces */}
      <polygon points={`${p(0.7, 0, hw * 0.3)} ${p(1.5, 0, hw * 0.3)} ${p(1.5, 0, hw * 0.62)} ${p(0.7, 0, hw * 0.62)}`} fill="#fff" stroke={ink} strokeWidth="0.6" />
      <polygon points={`${p(w, 0.7, hw * 0.3)} ${p(w, 1.5, hw * 0.3)} ${p(w, 1.5, hw * 0.62)} ${p(w, 0.7, hw * 0.62)}`} fill="#fff" stroke={ink} strokeWidth="0.6" />
      {/* door */}
      <polygon points={`${p(1.9, 0, 0)} ${p(2.5, 0, 0)} ${p(2.5, 0, hw * 0.5)} ${p(1.9, 0, hw * 0.5)}`} fill="#fff" stroke={ink} strokeWidth="0.6" />

      {/* roof */}
      {pitched ? (
        <>
          <polygon points={`${p(0, 0, hw)} ${p(w, 0, hw)} ${p(w, d / 2, hw + hr)} ${p(0, d / 2, hw + hr)}`} fill={roofF} stroke={ink} strokeWidth="1" strokeLinejoin="round" />
          <polygon points={`${p(w, 0, hw)} ${p(w, d, hw)} ${p(w, d / 2, hw + hr)}`} fill={faceR} stroke={ink} strokeWidth="1" strokeLinejoin="round" />
          <line x1={P(0, d / 2, hw + hr).X} y1={P(0, d / 2, hw + hr).Y} x2={P(w, d / 2, hw + hr).X} y2={P(w, d / 2, hw + hr).Y} stroke={ink} strokeWidth="1" />
        </>
      ) : (
        <polygon points={`${p(0, 0, hw)} ${p(w, 0, hw)} ${p(w, d, hw)} ${p(0, d, hw)}`} fill={roofF} stroke={ink} strokeWidth="1" strokeLinejoin="round" />
      )}

      {/* dimension ticks */}
      <line x1={P(0, 0, 0).X} y1={P(0, 0, 0).Y + 10} x2={P(w, 0, 0).X} y2={P(w, 0, 0).Y + 10} stroke={soft} strokeWidth="0.8" />
      <line x1={P(0, 0, 0).X} y1={P(0, 0, 0).Y + 7} x2={P(0, 0, 0).X} y2={P(0, 0, 0).Y + 13} stroke={soft} strokeWidth="0.8" />
      <line x1={P(w, 0, 0).X} y1={P(w, 0, 0).Y + 7} x2={P(w, 0, 0).X} y2={P(w, 0, 0).Y + 13} stroke={soft} strokeWidth="0.8" />
    </svg>
  )
}
