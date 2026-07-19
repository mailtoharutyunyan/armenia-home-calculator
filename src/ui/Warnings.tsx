import { useMemo } from 'react'
import { useProject } from '../store/useProject'
import { t } from '../i18n'
import { computeQuantities } from '../engine/quantities'
import { checkNorms } from '../engine/norms'
import type { NormLevel } from '../engine/norms'
import { LevelIcon } from './icons'

const ORDER: Record<NormLevel, number> = { error: 0, warning: 1, info: 2 }

export function Warnings() {
  const { house, lang } = useProject()
  const warnings = useMemo(() => {
    const q = computeQuantities(house)
    return checkNorms(house, q).sort((a, b) => ORDER[a.level] - ORDER[b.level])
  }, [house])

  const hasErrors = warnings.some((w) => w.level === 'error')

  return (
    <div className="panel" id="warnings" style={{ borderLeft: hasErrors ? '4px solid var(--color-err)' : undefined }}>
      <div className="panel-head">
        <span>{t(lang, 'warningsTitle')}</span>
        <span
          className="badge"
          style={{ color: hasErrors ? 'var(--color-err)' : 'var(--color-ink-soft)' }}
        >
          {warnings.filter((w) => w.level !== 'info').length}
        </span>
      </div>
      <div style={{ padding: '0.8rem 1rem' }}>
        {hasErrors && (
          <div className="mono lvl-error" style={{ fontWeight: 700, marginBottom: '0.6rem', fontSize: '0.82rem' }}>
            {t(lang, 'hasErrors')}
          </div>
        )}
        {warnings.length === 0 && <div style={{ color: 'var(--color-ok)' }}>{t(lang, 'noWarnings')}</div>}
        {warnings.map((w, i) => (
          <div
            key={i}
            style={{ display: 'flex', gap: '0.6rem', padding: '0.4rem 0', borderBottom: '1px dotted var(--color-border)' }}
          >
            <LevelIcon level={w.level} />
            <div>
              <span className={`badge lvl-${w.level}`} style={{ marginRight: '0.5rem' }}>
                {w.code}
              </span>
              <span style={{ fontSize: '0.86rem' }}>{lang !== 'hy' ? w.ru : w.hy}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
