import { useProject } from '../store/useProject'
import { t } from '../i18n'
import { NORMS_REFERENCE, NORMS } from '../data/normsReference'
import { NormLink } from './NormLink'

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
        {/* один документ может встречаться дважды (разные темы), поэтому ключ —
            код + позиция, иначе React видит дубликат ключа */}
        {NORMS_REFERENCE.map((n, i) => (
          <div key={`${n.code}-${i}`} style={{ padding: '0.6rem 0', borderBottom: '1px dotted var(--color-border)' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.6rem', flexWrap: 'wrap' }}>
              {/* название документа — само ссылка на его текст */}
              <strong style={{ fontFamily: 'var(--font-display)', fontSize: '0.95rem', lineHeight: 1.3 }}>
                <NormLink code={n.code} lang={lang} />
              </strong>
              {NORMS[n.code]?.status === 'draft' && (
                <span className="badge lvl-warning">{lang === 'hy' ? 'նախագիծ' : 'проект'}</span>
              )}
              {NORMS[n.code]?.status === 'unconfirmed' && (
                <span className="badge lvl-warning">
                  {lang === 'hy' ? 'ինդեքսը հաստատված չէ' : lang === 'en' ? 'index unconfirmed' : 'индекс не подтверждён'}
                </span>
              )}
            </div>
            <p style={{ margin: '0.35rem 0 0', fontSize: '0.85rem', lineHeight: 1.5, color: 'var(--color-ink)' }}>
              {lang !== 'hy' ? n.requirementRu : n.requirementHy}
            </p>
            {NORMS[n.code]?.cautionRu && lang !== 'hy' && (
              <p style={{ margin: '0.35rem 0 0', fontSize: '0.78rem', lineHeight: 1.45, color: 'var(--color-warn)' }}>
                {NORMS[n.code].cautionRu}
              </p>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}
