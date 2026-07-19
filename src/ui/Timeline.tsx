import { useMemo } from 'react'
import { useProject } from '../store/useProject'
import { t } from '../i18n'
import { computeQuantities } from '../engine/quantities'
import { computeEstimate } from '../engine/pricing'
import { STAGES, stageWeeks } from '../data/stages'
import { money } from './format'

export function Timeline() {
  const { house, prices, lang, priceMode, amdPerUsd } = useProject()

  const { totalArea, est } = useMemo(() => {
    const q = computeQuantities(house)
    return { totalArea: q.geometry.totalFloorArea, est: computeEstimate(q, prices, house, priceMode) }
  }, [house, prices, priceMode])

  const m = (v: number) => money(v, house.currency, amdPerUsd)

  const rows = STAGES.map((s) => {
    const cost = s.sections.reduce((a, sec) => a + (est.sectionTotals[sec] ?? 0), 0)
    return { s, w: stageWeeks(s, totalArea), cost }
  })
  const totalMin = rows.reduce((a, r) => a + r.w.min, 0)
  const totalMax = rows.reduce((a, r) => a + r.w.max, 0)
  const maxCost = Math.max(1, ...rows.map((r) => r.cost))

  return (
    <section className="panel" id="timeline">
      <div className="panel-head">
        <span>{t(lang, 'timeline')}</span>
        <span className="sub">
          {t(lang, 'totalTerm')}: {totalMin}–{totalMax} {t(lang, 'weeks')}
        </span>
      </div>
      <div style={{ padding: '0.3rem 0 0.6rem' }}>
        {rows.map(({ s, w, cost }, i) => (
          <div
            key={i}
            style={{
              display: 'grid',
              gridTemplateColumns: '1.7fr 2fr auto',
              gap: '0.9rem',
              alignItems: 'center',
              padding: '0.6rem 1.1rem',
              borderBottom: i < rows.length - 1 ? '1px solid var(--color-border)' : 'none',
            }}
          >
            <span style={{ fontSize: '0.88rem', fontWeight: 500 }}>
              <span
                style={{
                  display: 'inline-flex',
                  width: 22,
                  height: 22,
                  borderRadius: 6,
                  background: s.phase === 'act' ? 'var(--color-navy)' : 'var(--color-copper)',
                  color: '#fff',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  marginRight: '0.5rem',
                }}
              >
                {i + 1}
              </span>
              {lang !== 'hy' ? s.ru : s.hy}
            </span>
            <div>
              <div style={{ background: 'var(--color-surface-2)', height: 8, borderRadius: 4, overflow: 'hidden' }}>
                <div
                  style={{
                    height: '100%',
                    width: `${(cost / maxCost) * 100}%`,
                    background: s.phase === 'act' ? 'var(--color-navy)' : 'var(--color-copper)',
                    borderRadius: 4,
                  }}
                />
              </div>
              <span style={{ fontSize: '0.72rem', color: 'var(--color-ink-soft)' }}>
                {w.min}–{w.max} {t(lang, 'weeks')}
              </span>
            </div>
            <span className="num" style={{ fontWeight: 700, fontSize: '0.9rem' }}>
              {m(cost)}
            </span>
          </div>
        ))}
      </div>
    </section>
  )
}
