import { useProject } from '../store/useProject'
import { CBA_SITE } from '../data/rates'
import { t } from '../i18n'
import { labelFor } from '../model/catalog'
import { PRICES_UPDATED } from '../data/prices'

const SUPPLIER_LINKS: { label: string; url: string }[] = [
  { label: 'MM Leader (бетон)', url: 'https://mmlider.am/betoni-artadrowtyown' },
  { label: 'Stalmetural (арматура)', url: 'https://stalmetural.am/catalog/armatura/' },
  { label: 'Met-Trans (арматура)', url: 'https://met-trans.am/armatura/armatura-cena-za-tonnu' },
  { label: 'List.am (газоблок)', url: 'https://www.list.am/en/category/110?q=gazablok' },
  { label: 'Минфин РА', url: 'https://minfin.am/en/page/construction_materials_prices/' },
]

export function PriceEditor() {
  const { prices, lang, setPriceItem, resetPrices, amdPerUsd, setAmdPerUsd, rateSource, rateDate, rateStale } = useProject()
  const items = Object.values(prices)

  return (
    <section className="panel" id="prices">
      <div className="panel-head">
        <span>{t(lang, 'editPrices')} · ֏</span>
        <button className="btn btn-ghost no-print" style={{ padding: '0.25rem 0.6rem', fontSize: '0.72rem' }} onClick={resetPrices}>
          {t(lang, 'resetPrices')}
        </button>
      </div>

      <div style={{ padding: '0.6rem 1rem', borderBottom: '1px solid var(--color-border)', display: 'flex', gap: '0.8rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <span className="badge lvl-info" style={{ padding: '0.14rem 0.5rem' }}>
          {(lang === 'hy' ? 'ստուգված ' : lang === 'en' ? 'verified ' : 'проверено ') + PRICES_UPDATED}
        </span>
        <span className="mono" style={{ fontSize: '0.72rem', color: 'var(--color-ink-soft)' }}>{t(lang, 'sources')}:</span>
        {SUPPLIER_LINKS.map((s) => (
          <a key={s.url} href={s.url} target="_blank" rel="noreferrer" className="mono" style={{ fontSize: '0.72rem', color: 'var(--color-info)' }}>
            {s.label}
          </a>
        ))}
        <label style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.4rem' }} className="mono">
          <span style={{ fontSize: '0.72rem', color: 'var(--color-ink-soft)' }}>֏/$</span>
          <input
            className="input"
            style={{ width: 90 }}
            type="number"
            value={amdPerUsd}
            onChange={(e) => setAmdPerUsd(Number(e.target.value))}
          />
        </label>
      </div>

      {/* Откуда взят курс — иначе непонятно, официальный он или выдуманный */}
      <div style={{ padding: '0 1rem 0.6rem', fontSize: '0.72rem', color: rateStale ? 'var(--color-warn)' : 'var(--color-ink-soft)' }}>
        {rateSource === 'cba' && (
          <>
            {lang === 'hy' ? 'Փոխարժեքը՝ ՀՀ կենտրոնական բանկ' : lang === 'en' ? 'Rate: Central Bank of Armenia' : 'Курс: Центральный банк РА'}
            {rateDate && ` · ${rateDate}`}
            {' · '}
            <a className="normlink" href={CBA_SITE} target="_blank" rel="noreferrer">
              cba.am
              <span aria-hidden="true" className="normlink-mark">↗</span>
            </a>
            {rateStale &&
              (lang === 'hy'
                ? ' · հնացած է, ստուգեք'
                : lang === 'en'
                  ? ' · out of date, check it'
                  : ' · устарел, проверьте')}
          </>
        )}
        {rateSource === 'manual' &&
          (lang === 'hy' ? 'Փոխարժեքը սահմանված է ձեռքով' : lang === 'en' ? 'Rate set manually' : 'Курс задан вручную')}
        {rateSource === 'default' &&
          (lang === 'hy'
            ? 'Փոխարժեքը՝ ներդրված լռելյայն, ՀՀ ԿԲ-ից չի բեռնվել'
            : lang === 'en'
              ? 'Built-in default rate — not loaded from the Central Bank'
              : 'Курс зашитый по умолчанию — с сайта ЦБ не загрузился')}
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
          <thead>
            <tr style={{ background: 'var(--color-surface-2)', textAlign: 'left' }}>
              <th style={c}>{t(lang, 'pe_material')}</th>
              <th style={c}>{t(lang, 'pe_unit')}</th>
              <th style={cr}>min</th>
              <th style={cr}>{t(lang, 'pe_typ')}</th>
              <th style={cr}>max</th>
              <th style={cr}>{t(lang, 'labor')}</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it) => (
              <tr key={it.key}>
                <td style={c}>
                  {labelFor(it, lang)}
                  {it.note && <div className="mono" style={{ fontSize: '0.64rem', color: 'var(--color-warn)' }}>{it.note}</div>}
                </td>
                <td style={c} className="mono">{it.unit}</td>
                <td style={cr}><NumCell value={it.materialMin} onChange={(v) => setPriceItem(it.key, { materialMin: v })} /></td>
                <td style={cr}><NumCell value={it.materialTypical} onChange={(v) => setPriceItem(it.key, { materialTypical: v })} /></td>
                <td style={cr}><NumCell value={it.materialMax} onChange={(v) => setPriceItem(it.key, { materialMax: v })} /></td>
                <td style={cr}><NumCell value={it.labor} onChange={(v) => setPriceItem(it.key, { labor: v })} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function NumCell({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <input
      className="input mono"
      style={{ width: 110, padding: '0.3rem 0.4rem', textAlign: 'right' }}
      type="number"
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
    />
  )
}

const c: React.CSSProperties = { padding: '0.4rem 0.7rem', borderBottom: '1px solid var(--color-border)' }
const cr: React.CSSProperties = { ...c, textAlign: 'right' }
