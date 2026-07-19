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
  const { lang, setLang, house, setHouse, tab, setTab, theme, setTheme, resetAll } = useProject()

  return (
    <header
      className="no-print"
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 20,
        background: 'var(--color-header-bg)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderBottom: '1px solid var(--color-border)',
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

        <div style={{ marginLeft: 'auto', display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <div className="seg" title={lang === 'hy' ? 'Լեզու' : lang === 'en' ? 'Language' : 'Язык'}>
            <button aria-pressed={lang === 'hy'} onClick={() => setLang('hy')}>ՀՅ</button>
            <button aria-pressed={lang === 'ru'} onClick={() => setLang('ru')}>RU</button>
            <button aria-pressed={lang === 'en'} onClick={() => setLang('en')}>EN</button>
          </div>
          <span style={divider} />
          <div className="seg" title={lang === 'hy' ? 'Արժույթ' : lang === 'en' ? 'Currency' : 'Валюта'}>
            <button aria-pressed={house.currency === 'AMD'} onClick={() => setHouse({ currency: 'AMD' })}>֏</button>
            <button aria-pressed={house.currency === 'USD'} onClick={() => setHouse({ currency: 'USD' })}>$</button>
          </div>
          <span style={divider} />
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            aria-label={theme === 'dark' ? 'Светлая тема' : 'Тёмная тема'}
            title={theme === 'dark' ? 'Светлая тема' : 'Тёмная тема'}
            style={iconBtn}
          >
            {theme === 'dark' ? '☀' : '☾'}
          </button>
          <button
            onClick={() => {
              const msg = lang === 'hy' ? 'Վերականգնե՞լ գործարանային կարգավորումները։' : lang === 'en' ? 'Reset all settings to factory defaults?' : 'Сбросить все настройки к заводским?'
              if (window.confirm(msg)) resetAll()
            }}
            aria-label={lang === 'hy' ? 'Զրոյացնել' : lang === 'en' ? 'Reset' : 'Сброс'}
            title={lang === 'hy' ? 'Զրոյացնել գործարանային' : lang === 'en' ? 'Reset to factory' : 'Сбросить к заводским'}
            style={iconBtn}
          >
            ↺
          </button>
        </div>
      </div>
    </header>
  )
}

const divider: React.CSSProperties = { width: 1, height: '1.3rem', background: 'var(--color-border)' }
const iconBtn: React.CSSProperties = {
  border: '1px solid var(--color-border)',
  background: 'transparent',
  color: 'var(--color-ink)',
  cursor: 'pointer',
  borderRadius: 999,
  width: '2rem',
  height: '2rem',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '0.95rem',
  lineHeight: 1,
}
