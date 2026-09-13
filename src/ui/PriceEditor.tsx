import { useProject } from '../store/useProject'
import { CBA_SITE } from '../data/rates'
import { t } from '../i18n'
import { labelFor } from '../model/catalog'
import { PRICES_UPDATED, priceAgeDays, arePricesStale } from '../data/prices'
import type { Provenance } from '../model/catalog'

// Только адреса, которые реально открываются (проверено 13.09.2026).
// Убраны: mmlider.am — домен не резолвится; minfin.am — страница о ценах
// на стройматериалы без данных. Нерабочая ссылка создаёт видимость проверки.
const SUPPLIER_LINKS: { label: string; url: string }[] = [
  { label: 'Stalmetural (арматура)', url: 'https://stalmetural.am/catalog/armatura/' },
  { label: 'Met-Trans (арматура)', url: 'https://met-trans.am/armatura/armatura-cena-za-tonnu' },
  { label: 'List.am (стройматериалы)', url: 'https://www.list.am/category/110' },
  { label: 'Construction.am (бетон)', url: 'https://www.construction.am/suppliers.php?act=concrete-products' },
  { label: 'RMS Group (блоки)', url: 'https://rmsgroup.am/en/shinanyout' },
]

// Прайс мог быть сохранён в localStorage до появления provenance, поэтому
// подпись берём через функцию с запасным значением, а не прямым индексом.
const prov = (p?: Provenance): Provenance => (p && p in PROV_LABEL ? p : 'unverified')

// hostname из URL — только если адрес разбирается; иначе показываем как есть
function host(u: string): string {
  try {
    return new URL(u).hostname.replace('www.', '')
  } catch {
    return u
  }
}

const PROV_LABEL: Record<Provenance, { ru: string; hy: string; en: string; cls: string }> = {
  quoted: { ru: 'сверено', hy: 'ստուգված', en: 'verified', cls: 'lvl-info' },
  unverified: { ru: 'не сверено', hy: 'չստուգված', en: 'unverified', cls: 'lvl-warning' },
  estimate: { ru: 'оценка', hy: 'գնահատական', en: 'estimate', cls: 'lvl-warning' },
  official: { ru: 'госпошлина', hy: 'պետ. տուրք', en: 'state fee', cls: 'lvl-info' },
}

export function PriceEditor() {
  const { prices, lang, setPriceItem, resetPrices, amdPerUsd, setAmdPerUsd, rateSource, rateDate, rateStale } = useProject()
  const items = Object.values(prices)

  // Сводка по происхождению цен — показывается в шапке таблицы
  const quoted = items.filter((i) => i.provenance === 'quoted').length
  const unverified = items.filter((i) => prov(i.provenance) === 'unverified').length
  const estimateN = items.filter((i) => i.provenance === 'estimate').length
  const official = items.filter((i) => i.provenance === 'official').length
  const age = priceAgeDays()
  const stale = arePricesStale()

  return (
    <section className="panel" id="prices">
      <div className="panel-head">
        <span>{t(lang, 'editPrices')} · ֏</span>
        <button className="btn btn-ghost no-print" style={{ padding: '0.25rem 0.6rem', fontSize: '0.72rem' }} onClick={resetPrices}>
          {t(lang, 'resetPrices')}
        </button>
      </div>

      {/* Честный статус прайса: сколько позиций реально сверено с источником.
          Без этого «проверено 20.07.2026» читается как гарантия, которой нет. */}
      <div
        style={{
          padding: '0.7rem 1rem',
          borderBottom: '1px solid var(--color-border)',
          background: 'var(--color-surface-2)',
          fontSize: '0.78rem',
          lineHeight: 1.5,
          color: quoted === 0 ? 'var(--color-warn)' : 'var(--color-ink)',
        }}
      >
        <strong>
          {lang === 'hy'
            ? `Ստուգված է ${quoted} դիրք ${items.length}-ից`
            : lang === 'en'
              ? `${quoted} of ${items.length} positions verified against a supplier`
              : `Сверено с прайсом поставщика: ${quoted} из ${items.length} позиций`}
        </strong>
        {' — '}
        {lang === 'hy'
          ? `${unverified} ուղենիշ, ${estimateN} գնահատական, ${official} պետ. տուրք։ Գումարը կարգի գնահատական է, ոչ թե նախահաշիվ կապալառուի համար։`
          : lang === 'en'
            ? `${unverified} indicative, ${estimateN} estimates, ${official} state fees. The total is an order-of-magnitude figure, not a contractor-ready bill.`
            : `${unverified} ориентир, ${estimateN} оценка, ${official} госпошлина. Итог — оценка порядка величины, а не смета для подрядчика.`}
        {age !== null && (
          <>
            {' '}
            {lang === 'hy'
              ? `Վերջին ձեռքով ստուգումը՝ ${PRICES_UPDATED} (${age} օր առաջ)։`
              : lang === 'en'
                ? `Last manual check: ${PRICES_UPDATED} (${age} days ago).`
                : `Последняя ручная сверка: ${PRICES_UPDATED} (${age} дн. назад).`}
          </>
        )}
        {stale && (
          <>
            {' '}
            <strong>
              {lang === 'hy' ? 'Ժամկետանց է — թարմացրեք։' : lang === 'en' ? 'Out of date — refresh it.' : 'Устарел — обновите.'}
            </strong>
          </>
        )}
      </div>

      <div style={{ padding: '0.6rem 1rem', borderBottom: '1px solid var(--color-border)', display: 'flex', gap: '0.8rem', alignItems: 'center', flexWrap: 'wrap' }}>
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
                  {/* по каждой строке видно, откуда цена: сверено / ориентир / оценка */}
                  <div style={{ marginTop: '0.2rem', display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    <span className={`badge ${PROV_LABEL[prov(it.provenance)].cls}`}>
                      {lang === 'hy'
                        ? PROV_LABEL[prov(it.provenance)].hy
                        : lang === 'en'
                          ? PROV_LABEL[prov(it.provenance)].en
                          : PROV_LABEL[prov(it.provenance)].ru}
                    </span>
                    {it.verifiedAt && <span className="mono" style={{ fontSize: '0.62rem', color: 'var(--color-ink-soft)' }}>{it.verifiedAt}</span>}
                    {(it.sourceUrls ?? []).map((u) => (
                      <a key={u} href={u} target="_blank" rel="noreferrer" className="mono" style={{ fontSize: '0.62rem', color: 'var(--color-info)' }}>
                        {host(u)}
                      </a>
                    ))}
                  </div>
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
