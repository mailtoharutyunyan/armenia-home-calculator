import { useState } from 'react'
import { useProject } from '../store/useProject'
import { t } from '../i18n'
import { buildPlan } from '../engine/plan'
import { downloadDxf } from '../engine/dxf'
import { FloorPlanSvg } from './FloorPlan'

export function Plan2D() {
  const { house, lang } = useProject()
  const [floor, setFloor] = useState(0)
  const activeFloor = Math.min(floor, house.floors - 1)

  if (house.length <= 0 || house.width <= 0) {
    return (
      <div className="panel">
        <div className="panel-head">
          <span>{t(lang, 'plan2d')}</span>
        </div>
        <div style={{ padding: '1rem', color: 'var(--color-err)' }}>— неверные габариты —</div>
      </div>
    )
  }

  return (
    <div className="panel">
      <div className="panel-head">
        <span>{t(lang, 'plan2d')} · {house.length}×{house.width} {lang === 'ru' ? 'м' : 'մ'}</span>
        {house.floors > 1 ? (
          <div className="seg no-print">
            {Array.from({ length: house.floors }, (_, i) => (
              <button key={i} aria-pressed={activeFloor === i} onClick={() => setFloor(i)}>
                {i + 1} {lang === 'ru' ? 'эт.' : 'հարկ'}
              </button>
            ))}
          </div>
        ) : (
          <span className="sub">1 {lang === 'ru' ? 'этаж' : 'հարկ'}</span>
        )}
      </div>
      <div style={{ padding: '1rem' }}>
        <FloorPlanSvg house={house} floorIndex={activeFloor} />

        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.8rem', flexWrap: 'wrap' }} className="no-print">
          <button className="btn btn-accent" onClick={() => downloadDxf(buildPlan(house), 'armenia-house-plan.dxf')}>
            {t(lang, 'exportDxf')}
          </button>
          <button className="btn btn-ghost" onClick={() => window.print()}>
            {t(lang, 'exportPdf')}
          </button>
        </div>
      </div>
    </div>
  )
}
