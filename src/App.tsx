import { Header } from './ui/Header'
import { Inputs } from './ui/Inputs'
import { Plan2D } from './ui/Plan2D'
import { Results } from './ui/Results'
import { Warnings } from './ui/Warnings'
import { Compare } from './ui/Compare'
import { Credit } from './ui/Credit'
import { Gallery } from './ui/Gallery'
import { Timeline } from './ui/Timeline'
import { NormsRef } from './ui/NormsRef'
import { Permit } from './ui/Permit'
import { PriceEditor } from './ui/PriceEditor'
import { IsoHouse } from './ui/IsoHouse'
import { useProject } from './store/useProject'
import { t } from './i18n'

const TABS = [
  { id: 'calc', key: 'nav_calc' as const },
  { id: 'gallery', key: 'nav_gallery' as const },
  { id: 'analysis', key: 'tab_analysis' as const },
  { id: 'docs', key: 'tab_docs' as const },
  { id: 'prices', key: 'nav_prices' as const },
]

export default function App() {
  const { house, lang, tab, setTab } = useProject()

  return (
    <div id="top">
      <Header />

      {/* Hero — compact editorial masthead */}
      <section style={{ borderBottom: '1px solid var(--color-ink)' }}>
        <div className="hero">
          <div>
            <div className="eyebrow">
              Երևան · {lang === 'ru' ? 'Смета · Проект · 2026' : 'Նախահաշիվ · Նախագիծ · 2026'}
            </div>
            <h1 style={{ fontSize: 'clamp(1.7rem, 3.4vw, 2.6rem)', marginTop: '0.7rem', fontWeight: 500, letterSpacing: '-0.02em' }}>
              {t(lang, 'appTitle')}
            </h1>
            <p style={{ color: 'var(--color-ink-soft)', marginTop: '0.6rem', fontSize: '0.95rem', maxWidth: 520, lineHeight: 1.55 }}>
              {t(lang, 'appSubtitle')}.
            </p>
          </div>
          <div className="heroart">
            <IsoHouse floors={house.floors} pitched={house.roof !== 'flat'} />
          </div>
        </div>
      </section>

      {/* Tab bar */}
      <div
        className="no-print"
        style={{ position: 'sticky', top: 0, zIndex: 15, background: 'var(--color-bg)', borderBottom: '1px solid var(--color-border)' }}
      >
        <nav style={{ maxWidth: 1200, margin: '0 auto', padding: '0 2rem', display: 'flex', gap: '2rem', overflowX: 'auto' }}>
          {TABS.map((tb) => (
            <button
              key={tb.id}
              onClick={() => setTab(tb.id)}
              style={{
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                padding: '1rem 0',
                fontSize: '0.78rem',
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
      </div>

      {/* Active tab content */}
      <main style={{ maxWidth: 1200, margin: '0 auto', padding: '2.4rem 2rem' }}>
        {tab === 'calc' && (
          <div className="workspace">
            <div style={{ position: 'sticky', top: 70, alignSelf: 'start' }}>
              <Inputs />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.6rem' }}>
              <Plan2D />
              <Warnings />
              <Results />
            </div>
          </div>
        )}
        {tab === 'gallery' && <Gallery />}
        {tab === 'analysis' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.6rem' }}>
            <Compare />
            <Timeline />
            <Credit />
          </div>
        )}
        {tab === 'docs' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.6rem' }}>
            <NormsRef />
            <Permit />
          </div>
        )}
        {tab === 'prices' && <PriceEditor />}
      </main>

      <footer style={{ background: 'var(--color-ink)', color: 'var(--color-bg)', marginTop: '3rem' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '2.4rem 2rem', fontSize: '0.85rem', lineHeight: 1.7 }}>
          <div className="eyebrow" style={{ color: 'var(--color-bg)' }}>{lang === 'ru' ? 'Важно' : 'Կարևոր'}</div>
          <p style={{ margin: '1rem 0 0', maxWidth: 820, opacity: 0.85 }}>{t(lang, 'disclaimer')}</p>
        </div>
      </footer>

      <style>{`
        .hero {
          max-width: 1200px;
          margin: 0 auto;
          padding: 1.6rem 2rem;
          display: grid;
          grid-template-columns: 1fr 220px;
          gap: 2rem;
          align-items: center;
        }
        .hero .heroart { max-width: 220px; margin-left: auto; }
        .workspace {
          display: grid;
          grid-template-columns: minmax(320px, 380px) 1fr;
          gap: 1.6rem;
          align-items: start;
        }
        @media (max-width: 900px) {
          .hero { grid-template-columns: 1fr; padding-top: 2.6rem; }
          .hero .heroart { display: none; }
          .workspace { grid-template-columns: 1fr; }
          .workspace > div:first-child { position: static !important; }
        }
      `}</style>
    </div>
  )
}
