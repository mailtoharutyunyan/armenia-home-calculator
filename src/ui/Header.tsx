import { useProject } from '../store/useProject'
import { t } from '../i18n'

const NAV = [
  { id: 'calc', key: 'nav_calc' as const },
  { id: 'gallery', key: 'nav_gallery' as const },
  { id: 'compare', key: 'nav_compare' as const },
  { id: 'norms', key: 'nav_norms' as const },
  { id: 'permit', key: 'nav_permit' as const },
  { id: 'prices', key: 'nav_prices' as const },
]

export function Header() {
  const { lang, setLang, house, setHouse } = useProject()

  return (
    <header
      className="no-print"
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 20,
        background: 'var(--color-bg)',
        borderBottom: '1px solid var(--color-ink)',
      }}
    >
      <div
        style={{
          maxWidth: 1200,
          margin: '0 auto',
          padding: '0.85rem 2rem',
          display: 'flex',
          alignItems: 'center',
          gap: '1.6rem',
          flexWrap: 'wrap',
        }}
      >
        <a href="#top" style={{ display: 'flex', alignItems: 'baseline', gap: '0.55rem', color: 'var(--color-ink)' }}>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '1.3rem', letterSpacing: '-0.02em' }}>
            Тун
          </span>
          <span style={{ fontSize: '0.66rem', fontWeight: 600, letterSpacing: '0.22em', textTransform: 'uppercase', color: 'var(--color-ink-soft)' }}>
            Studio · РА
          </span>
        </a>

        <nav style={{ display: 'flex', gap: '1.6rem', marginLeft: 'auto', flexWrap: 'wrap' }}>
          {NAV.map((n) => (
            <a
              key={n.id}
              href={`#${n.id}`}
              style={{ color: 'var(--color-ink-soft)', fontSize: '0.72rem', fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase' }}
              onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--color-copper)')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--color-ink-soft)')}
            >
              {t(lang, n.key)}
            </a>
          ))}
        </nav>

        <div className="seg">
          <button aria-pressed={lang === 'ru'} onClick={() => setLang('ru')}>RU</button>
          <button aria-pressed={lang === 'hy'} onClick={() => setLang('hy')}>ՀՅ</button>
        </div>
        <div className="seg">
          <button aria-pressed={house.currency === 'AMD'} onClick={() => setHouse({ currency: 'AMD' })}>֏</button>
          <button aria-pressed={house.currency === 'USD'} onClick={() => setHouse({ currency: 'USD' })}>$</button>
        </div>
      </div>
    </header>
  )
}
