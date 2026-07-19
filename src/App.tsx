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
import { useProject } from './store/useProject'
import { t } from './i18n'

export default function App() {
  const { lang } = useProject()

  const chips =
    lang === 'ru'
      ? ['Соответствие ՀՀՇՆ', 'Акт + под ключ', 'Сейсмика 8–9 баллов', 'Экспорт DXF / PDF']
      : ['ՀՀՇՆ համապատասխանություն', 'Ակտ + բանալի', 'Սեյսմիկ 8–9 բալ', 'DXF / PDF արտահանում']

  return (
    <div id="top">
      <Header />

      {/* Hero */}
      <section style={{ background: 'linear-gradient(180deg, #ffffff 0%, var(--color-bg) 100%)', borderBottom: '1px solid var(--color-border)' }}>
        <div className="hero">
          <div>
            <div className="eyebrow">Հայաստան · {lang === 'ru' ? 'Профессиональный расчёт' : 'Մասնագիտական հաշվարկ'}</div>
            <h1 style={{ fontSize: 'clamp(2.1rem, 5.2vw, 3.6rem)', lineHeight: 1.04, marginTop: '0.9rem', fontWeight: 800 }}>
              {t(lang, 'appTitle')}
            </h1>
            <p style={{ color: 'var(--color-ink-soft)', marginTop: '0.9rem', fontSize: '1.06rem', maxWidth: 540 }}>
              {t(lang, 'appSubtitle')}. {lang === 'ru'
                ? 'Материалы, стоимость и сроки — от коробки до отделки под ключ.'
                : 'Նյութեր, արժեք և ժամկետներ՝ կմախքից մինչև հարդարում։'}
            </p>
            <div style={{ display: 'flex', gap: '0.6rem', marginTop: '1.5rem', flexWrap: 'wrap' }}>
              {chips.map((c) => (
                <span
                  key={c}
                  style={{
                    background: 'var(--color-surface)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 999,
                    padding: '0.45rem 0.95rem',
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    color: 'var(--color-navy)',
                    boxShadow: 'var(--shadow-soft)',
                  }}
                >
                  {c}
                </span>
              ))}
            </div>
            <div style={{ marginTop: '1.8rem', display: 'flex', gap: '0.7rem', flexWrap: 'wrap' }}>
              <a href="#calc" className="btn btn-accent">{t(lang, 'start')}</a>
              <a href="#gallery" className="btn btn-ghost">{t(lang, 'nav_gallery')}</a>
            </div>
          </div>
          <HeroArt />
        </div>
      </section>

      {/* Workspace */}
      <main id="calc" style={{ maxWidth: 1180, margin: '0 auto', padding: '2rem 1.4rem 2.4rem' }}>
        <div className="workspace">
          <div style={{ position: 'sticky', top: 84, alignSelf: 'start' }}>
            <Inputs />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.4rem' }}>
            <Plan2D />
            <Warnings />
            <Results />
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.4rem', marginTop: '1.4rem' }}>
          <Gallery />
          <Compare />
          <Timeline />
          <Credit />
          <NormsRef />
          <Permit />
          <PriceEditor />
        </div>
      </main>

      <footer style={{ background: 'var(--color-navy)', color: '#dfe5ee', marginTop: '2.4rem' }}>
        <div style={{ maxWidth: 1180, margin: '0 auto', padding: '2rem 1.4rem', fontSize: '0.84rem', lineHeight: 1.65 }}>
          <div style={{ color: 'var(--color-copper)', fontSize: '0.74rem', letterSpacing: '0.12em', fontWeight: 700, marginBottom: '0.6rem', textTransform: 'uppercase' }}>
            {lang === 'ru' ? 'Важно' : 'Կարևոր'}
          </div>
          <p style={{ margin: 0, maxWidth: 820 }}>{t(lang, 'disclaimer')}</p>
        </div>
      </footer>

      <style>{`
        .hero {
          max-width: 1180px;
          margin: 0 auto;
          padding: 3.4rem 1.4rem 2.6rem;
          display: grid;
          grid-template-columns: 1.1fr 0.9fr;
          gap: 2rem;
          align-items: center;
        }
        .workspace {
          display: grid;
          grid-template-columns: minmax(320px, 400px) 1fr;
          gap: 1.4rem;
          align-items: start;
        }
        @media (max-width: 900px) {
          .hero { grid-template-columns: 1fr; padding-top: 2.4rem; }
          .hero .heroart { display: none; }
          .workspace { grid-template-columns: 1fr; }
          .workspace > div:first-child { position: static !important; }
        }
      `}</style>
    </div>
  )
}

function HeroArt() {
  return (
    <div className="heroart" style={{ position: 'relative' }}>
      <svg viewBox="0 0 400 300" style={{ width: '100%', height: 'auto', display: 'block' }} role="img" aria-label="Дом">
        <defs>
          <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#eef2f7" />
            <stop offset="1" stopColor="#f7f4f0" />
          </linearGradient>
          <linearGradient id="tuff" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#c98a63" />
            <stop offset="1" stopColor="#b06a3b" />
          </linearGradient>
        </defs>
        <rect x="0" y="0" width="400" height="300" rx="16" fill="url(#sky)" />
        {/* Ararat silhouette */}
        <path d="M0 210 L90 120 L140 175 L210 95 L280 175 L330 140 L400 210 Z" fill="#dfe6ee" />
        <path d="M190 112 L210 95 L232 118 L221 118 L210 108 L200 118 Z" fill="#fff" opacity="0.9" />
        {/* ground */}
        <rect x="0" y="210" width="400" height="90" fill="#e7e2d8" />
        {/* house body */}
        <rect x="120" y="150" width="170" height="90" fill="url(#tuff)" />
        {/* roof */}
        <path d="M110 152 L205 96 L300 152 Z" fill="#16233a" />
        {/* windows */}
        <rect x="140" y="168" width="30" height="30" fill="#2e6f96" stroke="#16233a" strokeWidth="2" />
        <rect x="240" y="168" width="30" height="30" fill="#2e6f96" stroke="#16233a" strokeWidth="2" />
        {/* door */}
        <rect x="192" y="196" width="26" height="44" fill="#16233a" />
        <circle cx="213" cy="219" r="1.6" fill="#e39a2c" />
        {/* dimension line */}
        <g stroke="#8f5230" strokeWidth="1.5">
          <line x1="120" y1="255" x2="290" y2="255" />
          <line x1="120" y1="250" x2="120" y2="260" />
          <line x1="290" y1="250" x2="290" y2="260" />
        </g>
        <text x="205" y="272" textAnchor="middle" fontFamily="Inter" fontSize="12" fill="#8f5230">
          план · смета · нормы
        </text>
      </svg>
    </div>
  )
}
