import { Header } from './ui/Header'
import { ResultBar } from './ui/ResultBar'
import { Inputs } from './ui/Inputs'
import { Plan2D } from './ui/Plan2D'
import { Results } from './ui/Results'
import { Warnings } from './ui/Warnings'
import { Readiness } from './ui/Readiness'
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
import { loadRates } from './data/rates'
import { t } from './i18n'
import { useEffect } from 'react'

export default function App() {
  const { lang, tab, theme } = useProject()

  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])

  // Курс ЦБ РА подтягиваем один раз при запуске. Файл лежит на том же домене
  // (его обновляет CI), поэтому CORS не мешает. Не получилось — остаёмся на
  // зашитом курсе, смета считается в любом случае.
  useEffect(() => {
    const ac = new AbortController()
    loadRates(ac.signal).then((r) => {
      if (r) useProject.getState().applyCbaRates(r)
    })
    return () => ac.abort()
  }, [])

  return (
    <div id="top">
      <Header />
      {/* Итог всегда на экране, пока крутят параметры */}
      {tab === 'calc' && <ResultBar />}

      {/* Active tab content */}
      {/* Вкладка калькулятора — во всю ширину: сайдбар прижат к левому краю
          экрана, план получает весь остаток. Остальные вкладки — это текст и
          таблицы, им колонка ограниченной ширины читается лучше. */}
      <main
        className={tab === 'calc' ? 'main-calc' : undefined}
        style={
          tab === 'calc'
            ? { maxWidth: 'none', margin: 0, padding: '1.4rem 1.5rem 1.4rem 0' }
            : { maxWidth: 'var(--page-w)', margin: '0 auto', padding: '2.4rem 2rem' }
        }
      >
        {tab === 'calc' && (
          <div className="workspace">
            <div className="side-fixed">
              <Inputs />
            </div>
            {/* Одна колонка на всю ширину.
                Двухколоночная раскладка здесь не работает: план занимает
                ~1250px по высоте, а смета ~4080px. Правая колонка оказывалась
                втрое длиннее, и почти 3000px прокрутки шли с пустым полем
                слева. Содержимое разной длины ставят в поток, а не рядом. */}
            <div className="content-flow">
              <Plan2D />
              <Warnings />
              <Results />
              {/* Что уже закрыто калькулятором, а что требует человека */}
              <Readiness />
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
        <div style={{ maxWidth: 'var(--page-w)', margin: '0 auto', padding: '2.4rem 2rem', fontSize: '0.85rem', lineHeight: 1.7 }}>
          <div className="eyebrow">{lang === 'hy' ? 'Կարևոր' : lang === 'en' ? 'Important' : 'Важно'}</div>
          <p style={{ margin: '1rem 0 0', maxWidth: 820 }}>{t(lang, 'disclaimer')}</p>
        </div>
      </footer>

      <style>{`
        .workspace {
          display: grid;
          grid-template-columns: minmax(340px, 420px) 1fr;
          gap: 1.6rem;
          align-items: start;
        }
        .workspace > div { min-width: 0; }
        .side-fixed::-webkit-scrollbar { width: 8px; }
        .side-fixed::-webkit-scrollbar-thumb { background: var(--color-border); border-radius: 8px; }
        .side-fixed { scrollbar-width: thin; scrollbar-color: var(--color-border) transparent; }
        @media (max-width: 900px) {
          .workspace { grid-template-columns: 1fr; }
        }
      `}</style>
    </div>
  )
}
