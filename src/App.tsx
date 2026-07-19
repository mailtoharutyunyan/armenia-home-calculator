import { Header } from './ui/Header'
import { Inputs } from './ui/Inputs'
import { Plan2D } from './ui/Plan2D'
import { Results } from './ui/Results'
import { Warnings } from './ui/Warnings'
import { Compare } from './ui/Compare'
import { Scenarios } from './ui/Scenarios'
import { Credit } from './ui/Credit'
import { Gallery } from './ui/Gallery'
import { Timeline } from './ui/Timeline'
import { NormsRef } from './ui/NormsRef'
import { Permit } from './ui/Permit'
import { PriceEditor } from './ui/PriceEditor'
import { Suppliers } from './ui/Suppliers'
import { useProject } from './store/useProject'
import { t } from './i18n'
import { useEffect } from 'react'

export default function App() {
  const { lang, tab, theme } = useProject()

  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])

  return (
    <div id="top">
      <Header />

      {/* Active tab content */}
      <main style={{ maxWidth: 1200, margin: '0 auto', padding: '2.4rem 2rem' }}>
        {tab === 'calc' && (
          <div className="workspace">
            <div
              className="side-fixed"
              style={{ position: 'sticky', top: 70, alignSelf: 'start', maxHeight: 'calc(100vh - 90px)', overflowY: 'auto', paddingRight: '0.5rem' }}
            >
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
            <Scenarios />
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
        {tab === 'prices' && (
          <>
            <PriceEditor />
            <Suppliers />
          </>
        )}
      </main>

      <footer style={{ background: 'var(--color-footer-bg)', borderTop: '1px solid var(--color-border)', color: 'var(--color-footer-fg)', marginTop: '3rem' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '2.4rem 2rem', fontSize: '0.85rem', lineHeight: 1.7 }}>
          <div className="eyebrow">{lang === 'hy' ? 'Կարևոր' : lang === 'en' ? 'Important' : 'Важно'}</div>
          <p style={{ margin: '1rem 0 0', maxWidth: 820 }}>{t(lang, 'disclaimer')}</p>
        </div>
      </footer>

      <style>{`
        .workspace {
          display: grid;
          grid-template-columns: minmax(320px, 380px) 1fr;
          gap: 1.6rem;
          align-items: start;
        }
        .workspace > div { min-width: 0; }
        .side-fixed::-webkit-scrollbar { width: 8px; }
        .side-fixed::-webkit-scrollbar-thumb { background: var(--color-border); border-radius: 8px; }
        .side-fixed { scrollbar-width: thin; scrollbar-color: var(--color-border) transparent; }
        @media (max-width: 900px) {
          .workspace { grid-template-columns: 1fr; }
          .workspace > div:first-child {
            position: static !important;
            max-height: none !important;
            overflow: visible !important;
          }
        }
      `}</style>
    </div>
  )
}
