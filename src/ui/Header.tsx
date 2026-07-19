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
        background: 'rgba(255,255,255,0.86)',
        backdropFilter: 'saturate(1.4) blur(10px)',
        borderBottom: '1px solid var(--color-border)',
      }}
    >
      <div
        style={{
          maxWidth: 1180,
          margin: '0 auto',
          padding: '0.8rem 1.4rem',
          display: 'flex',
          alignItems: 'center',
          gap: '1.4rem',
          flexWrap: 'wrap',
        }}
      >
        <a href="#top" style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', color: 'var(--color-ink)' }}>
          <Logo />
          <strong style={{ fontFamily: 'var(--font-display)', fontSize: '1.02rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
            {t(lang, 'appTitle')}
          </strong>
        </a>

        <nav style={{ display: 'flex', gap: '1.3rem', marginLeft: 'auto', flexWrap: 'wrap' }}>
          {NAV.map((n) => (
            <a
              key={n.id}
              href={`#${n.id}`}
              style={{ color: 'var(--color-ink-soft)', fontSize: '0.86rem', fontWeight: 600 }}
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
          <button aria-pressed={house.currency === 'AMD'} onClick={() => setHouse({ currency: 'AMD' })}>֏ AMD</button>
          <button aria-pressed={house.currency === 'USD'} onClick={() => setHouse({ currency: 'USD' })}>$ USD</button>
        </div>
      </div>
    </header>
  )
}

function Logo() {
  return (
    <span
      style={{
        width: 34,
        height: 34,
        borderRadius: 9,
        background: 'var(--color-navy)',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path d="M4 20 V10 L12 4 L20 10 V20" stroke="#fff" strokeWidth="1.8" strokeLinejoin="round" />
        <rect x="9.5" y="13" width="5" height="7" fill="var(--color-copper)" />
      </svg>
    </span>
  )
}
