import { useProject } from '../store/useProject'
import { t } from '../i18n'
import { NORMS_REFERENCE } from '../data/normsReference'

export function NormsRef() {
  const { lang } = useProject()
  return (
    <section className="panel" id="norms">
      <div className="panel-head">
        <span>{t(lang, 'nav_norms')}</span>
        <span className="sub">
          {lang === 'ru'
            ? 'ՀՀՇՆ — строительные нормы Республики Армения'
            : 'ՀՀՇՆ — Հայաստանի Հանրապետության շինարարական նորմեր'}
        </span>
      </div>
      <div style={{ padding: '0.5rem 1rem 1rem' }}>
        <p style={{ margin: '0 0 0.6rem', fontSize: '0.8rem', color: 'var(--color-ink-soft)' }}>
          {lang === 'ru'
            ? 'ՀՀՇՆ — официальное обозначение стандарта (как ГОСТ или СНиП); цифры после — номер документа.'
            : 'ՀՀՇՆ-ը ստանդարտի պաշտոնական նշանակումն է (ինչպես ГОСТ կամ СНиП); թվերը՝ փաստաթղթի համարն են։'}
        </p>
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
