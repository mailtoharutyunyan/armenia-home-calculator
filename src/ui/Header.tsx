import { useProject } from '../store/useProject'
import { t } from '../i18n'

const TABS = [
  { id: 'calc', key: 'nav_calc' as const },
  { id: 'gallery', key: 'nav_gallery' as const },
  { id: 'analysis', key: 'tab_analysis' as const },
  { id: 'docs', key: 'tab_docs' as const },
  { id: 'prices', key: 'nav_prices' as const },
]

export function Header() {
  const { lang, setLang, house, setHouse, tab, setTab } = useProject()

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
          padding: '0.7rem 2rem',
          display: 'flex',
          alignItems: 'center',
          gap: '1.6rem',
          flexWrap: 'wrap',
        }}
      >
        <span style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '1.25rem', letterSpacing: '-0.02em' }}>Тун</span>
          <span style={{ fontSize: '0.62rem', fontWeight: 600, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--color-ink-soft)' }}>РА</span>
        </span>

        <nav style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
          {TABS.map((tb) => (
            <button
              key={tb.id}
              onClick={() => setTab(tb.id)}
              style={{
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                padding: '0.2rem 0',
                fontSize: '0.72rem',
                fontWeight: 600,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                whiteSpace: 'nowrap',
                color: tab === tb.id ? 'var(--color-ink)' : 'var(--color-ink-soft)',
                borderBottom: `2px solid ${tab === tb.id ? 'var(--color-copper)' : 'transparent'}`,
              }}
            >
              {t(lang, tb.key)}
            </button>
          ))}
        </nav>

        <div style={{ marginLeft: 'auto', display: 'flex', gap: '1.2rem', alignItems: 'center' }}>
          <div className="seg">
            <button aria-pressed={lang === 'hy'} onClick={() => setLang('hy')}>ՀՅ</button>
            <button aria-pressed={lang === 'ru'} onClick={() => setLang('ru')}>RU</button>
            <button aria-pressed={lang === 'en'} onClick={() => setLang('en')}>EN</button>
          </div>
          <div className="seg">
            <button aria-pressed={house.currency === 'AMD'} onClick={() => setHouse({ currency: 'AMD' })}>֏</button>
            <button aria-pressed={house.currency === 'USD'} onClick={() => setHouse({ currency: 'USD' })}>$</button>
          </div>
        </div>
      </div>
    </header>
  )
}
