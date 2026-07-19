import type { NormLevel } from '../engine/norms'

// SVG level icons (Lucide-style) — no emoji icons per UI/UX quality checklist.
export function LevelIcon({ level }: { level: NormLevel }) {
  const color =
    level === 'error' ? 'var(--color-err)' : level === 'warning' ? 'var(--color-warn)' : 'var(--color-info)'
  const common = {
    width: 16,
    height: 16,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: color,
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
    style: { flexShrink: 0, marginTop: 2 },
  }
  if (level === 'error') {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="9" />
        <line x1="12" y1="8" x2="12" y2="13" />
        <line x1="12" y1="16" x2="12" y2="16" />
      </svg>
    )
  }
  if (level === 'warning') {
    return (
      <svg {...common}>
        <path d="M12 3 L22 20 H2 Z" />
        <line x1="12" y1="10" x2="12" y2="14" />
        <line x1="12" y1="17" x2="12" y2="17" />
      </svg>
    )
  }
  return (
    <svg {...common}>
      <circle cx="12" cy="12" r="9" />
      <line x1="12" y1="11" x2="12" y2="16" />
      <line x1="12" y1="8" x2="12" y2="8" />
    </svg>
  )
}
