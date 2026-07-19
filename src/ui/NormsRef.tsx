import { useProject } from '../store/useProject'
import { t } from '../i18n'
import { NORMS_REFERENCE } from '../data/normsReference'

export function NormsRef() {
  const { lang } = useProject()
  return (
    <section className="panel" id="norms">
      <div className="panel-head">
        <span>{t(lang, 'nav_norms')} · ՀՀՇՆ</span>
      </div>
      <div style={{ padding: '0.5rem 1rem 1rem' }}>
        {NORMS_REFERENCE.map((n) => (
          <div key={n.code} style={{ padding: '0.6rem 0', borderBottom: '1px dotted var(--color-border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
              <span className={`badge lvl-${n.level}`}>{n.code}</span>
              <strong style={{ fontFamily: 'var(--font-display)', fontSize: '0.92rem' }}>
                {lang === 'ru' ? n.topicRu : n.topicHy}
              </strong>
              <a href={n.source} target="_blank" rel="noreferrer" className="mono" style={{ marginLeft: 'auto', fontSize: '0.72rem', color: 'var(--color-info)' }}>
                {n.source.replace('https://', '')}
              </a>
            </div>
            <p style={{ margin: '0.35rem 0 0', fontSize: '0.85rem', lineHeight: 1.5, color: 'var(--color-ink)' }}>
              {lang === 'ru' ? n.requirementRu : n.requirementHy}
            </p>
          </div>
        ))}
      </div>
    </section>
  )
}
