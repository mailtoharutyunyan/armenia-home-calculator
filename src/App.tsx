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

export default function App() {
  const { house, lang } = useProject()

  const chips =
    lang === 'ru'
      ? ['Соответствие ՀՀՇՆ', 'Акт + под ключ', 'Сейсмика 8–9 баллов', 'Экспорт DXF / PDF']
      : ['ՀՀՇՆ համապատասխանություն', 'Ակտ + բանալի', 'Սեյսմիկ 8–9 բալ', 'DXF / PDF արտահանում']

  return (
    <div id="top">
      <Header />

      {/* Hero — editorial masthead */}
      <section style={{ borderBottom: '1px solid var(--color-ink)' }}>
        <div className="hero">
          <div>
            <div className="eyebrow">
              Երևան · {lang === 'ru' ? 'Смета · Проект · 2026' : 'Նախահաշիվ · Նախագիծ · 2026'}
            </div>
            <h1 style={{ fontSize: 'clamp(2.6rem, 6.5vw, 5rem)', marginTop: '1.4rem', fontWeight: 500, letterSpacing: '-0.02em' }}>
              {t(lang, 'appTitle')}
            </h1>
            <p style={{ color: 'var(--color-ink-soft)', marginTop: '1.2rem', fontSize: '1.05rem', maxWidth: 480, lineHeight: 1.6 }}>
              {t(lang, 'appSubtitle')}. {lang === 'ru'
                ? 'Материалы, стоимость и сроки — от коробки до отделки под ключ.'
                : 'Նյութեր, արժեք և ժամկետներ՝ կմախքից մինչև հարդարում։'}
            </p>
            <div style={{ marginTop: '2rem', display: 'flex', gap: '1.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <a href="#calc" className="btn btn-accent">{t(lang, 'start')}</a>
              <a href="#gallery" className="btn btn-ghost">{t(lang, 'nav_gallery')}</a>
            </div>
            <div style={{ marginTop: '2rem', borderTop: '1px solid var(--color-border)', paddingTop: '1rem', display: 'flex', gap: '1.4rem', flexWrap: 'wrap' }}>
              {chips.map((c, i) => (
                <span key={c} style={{ fontSize: '0.72rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-ink-soft)' }}>
                  <span style={{ color: 'var(--color-copper)', marginRight: '0.4rem' }}>{String(i + 1).padStart(2, '0')}</span>
                  {c}
                </span>
              ))}
            </div>
          </div>
          <div className="heroart" style={{ borderLeft: '1px solid var(--color-border)', paddingLeft: '2rem' }}>
            <IsoHouse floors={house.floors} pitched={house.roof !== 'flat'} />
          </div>
        </div>
      </section>

      {/* Workspace */}
      <main id="calc" style={{ maxWidth: 1200, margin: '0 auto', padding: '2.6rem 2rem 2.4rem' }}>
        <div className="workspace">
          <div style={{ position: 'sticky', top: 76, alignSelf: 'start' }}>
            <Inputs />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.6rem' }}>
            <Plan2D />
            <Warnings />
            <Results />
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.6rem', marginTop: '1.6rem' }}>
          <Gallery />
          <Compare />
          <Timeline />
          <Credit />
          <NormsRef />
          <Permit />
          <PriceEditor />
        </div>
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
          padding: 4rem 2rem 3rem;
          display: grid;
          grid-template-columns: 1.15fr 0.85fr;
          gap: 2.5rem;
          align-items: center;
        }
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
