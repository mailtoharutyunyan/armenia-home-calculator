import { useMemo, useState } from 'react'
import { useProject } from '../store/useProject'
import { computeQuantities } from '../engine/quantities'
import { computeEstimate } from '../engine/pricing'
import { labelFor } from '../model/catalog'
import type { PriceItem } from '../model/catalog'
import { QUANTITY_FACTS, BENCHMARKS } from '../data/facts'
import type { FactKind } from '../data/facts'
import { money } from './format'

// How much a price can be trusted, in the order the bar shows it.
type Evidence = 'fact' | 'derived' | 'indicative' | 'quote'

const evidenceOf = (it?: PriceItem): Evidence => {
  if (!it) return 'derived' // the brigade rate: one listing and one price list
  if (it.provenance === 'quoted' || it.provenance === 'official') return 'fact'
  if (it.provenance === 'estimate') return (it.sourceUrls ?? []).length > 0 ? 'derived' : 'quote'
  return 'indicative'
}

const EVIDENCE: Record<Evidence, { ru: string; hy: string; en: string; hint: { ru: string; hy: string; en: string }; color: string }> = {
  fact: {
    ru: 'Прайс или тариф', hy: 'Գնացուցակ կամ սակագին', en: 'Price list or tariff',
    hint: { ru: 'цена со ссылкой и датой', hy: 'գին՝ հղումով և ամսաթվով', en: 'a price with a link and a date' },
    color: 'var(--color-ok)',
  },
  derived: {
    ru: 'Из прайсов и допущения', hy: 'Գնացուցակներից և ենթադրությունից', en: 'From prices and an assumption',
    hint: { ru: 'цены из прайсов, количество — допущение', hy: 'գները՝ գնացուցակներից, քանակը՝ ենթադրություն', en: 'prices from lists, the quantity assumed' },
    color: 'var(--color-copper)',
  },
  indicative: {
    ru: 'Ориентир', hy: 'Ուղենիշ', en: 'Indicative',
    hint: { ru: 'ни с чем не сверено', hy: 'ոչնչի հետ չստուգված', en: 'not checked against anything' },
    color: 'var(--color-warn)',
  },
  quote: {
    ru: 'Нужна котировка', hy: 'Անհրաժեշտ է գնառաջարկ', en: 'Quote needed',
    hint: { ru: 'цены нигде не нашлось', hy: 'գին ոչ մի տեղ չգտնվեց', en: 'no published price found' },
    color: 'var(--color-err)',
  },
}

const KIND: Record<FactKind, { ru: string; hy: string; en: string; color: string }> = {
  norm: { ru: 'норма или тариф', hy: 'նորմ կամ սակագին', en: 'norm or tariff', color: 'var(--color-ok)' },
  model: { ru: 'модель дома', hy: 'տան մոդել', en: 'house model', color: 'var(--color-ok)' },
  derived: { ru: 'из данных', hy: 'տվյալներից', en: 'from data', color: 'var(--color-copper)' },
  assumption: { ru: 'допущение', hy: 'ենթադրություն', en: 'assumption', color: 'var(--color-warn)' },
}

const ORDER: Evidence[] = ['fact', 'derived', 'indicative', 'quote']

function host(u: string): string {
  try {
    return new URL(u).hostname.replace('www.', '')
  } catch {
    return u
  }
}

export function Facts() {
  const { lang, house, prices, priceMode, amdPerUsd } = useProject()
  const L = (o: { ru: string; hy: string; en: string }) => (lang === 'hy' ? o.hy : lang === 'en' ? o.en : o.ru)
  const m = (v: number) => money(v, house.currency, amdPerUsd)
  const [filter, setFilter] = useState<Evidence | 'all'>('all')
  const [query, setQuery] = useState('')

  // What each catalogue line costs in this house, and the evidence behind it
  const { byKey, share, direct } = useMemo(() => {
    const est = computeEstimate(computeQuantities(house), prices, house, priceMode)
    const byKey: Record<string, number> = {}
    const share: Record<Evidence, number> = { fact: 0, derived: 0, indicative: 0, quote: 0 }
    let direct = 0
    for (const l of est.lines) {
      byKey[l.key] = (byKey[l.key] ?? 0) + l.total
      share[evidenceOf(prices[l.key])] += l.total
      direct += l.total
    }
    return { byKey, share, direct }
  }, [house, prices, priceMode])

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    return Object.values(prices)
      .map((it) => ({ it, ev: evidenceOf(it), amount: byKey[it.key] ?? 0 }))
      .filter((r) => filter === 'all' || r.ev === filter)
      .filter((r) => !q || labelFor(r.it, lang).toLowerCase().includes(q) || (r.it.note ?? '').toLowerCase().includes(q))
      .sort((a, b) => b.amount - a.amount || labelFor(a.it, lang).localeCompare(labelFor(b.it, lang)))
  }, [prices, byKey, filter, query, lang])

  // whole percents that add up to 100 (largest remainder), so the legend
  // never shows 101%
  const pctOf = useMemo(() => {
    const raw = ORDER.map((e) => (direct > 0 ? (share[e] / direct) * 100 : 0))
    const out = raw.map(Math.floor)
    let left = direct > 0 ? 100 - out.reduce((a, v) => a + v, 0) : 0
    const order = raw.map((v, i) => [v - Math.floor(v), i] as const).sort((a, b) => b[0] - a[0])
    for (const [, i] of order) if (left-- > 0) out[i]++
    return Object.fromEntries(ORDER.map((e, i) => [e, out[i]])) as Record<Evidence, number>
  }, [share, direct])
  const pct = (v: number) => {
    const e = ORDER.find((k) => share[k] === v)
    return e ? pctOf[e] : 0
  }

  return (
    <div className="facts">
      <section className="panel">
        <div className="facts-hero">
          <h2>{lang === 'hy' ? 'Ինչի վրա է հենված հաշվարկը' : lang === 'en' ? 'What the estimate rests on' : 'На чём стоит смета'}</h2>
          <p className="facts-lede">
            {lang === 'hy'
              ? `Ձեր տան նախահաշվի տողերը՝ ${m(direct)}՝ առանց պահուստի։ Գոտին ցույց է տալիս, թե դրանցից որքանն է հենված հրապարակված գնի վրա։`
              : lang === 'en'
                ? `Your house's estimate lines come to ${m(direct)}, before the reserve. The bar shows how much of that rests on a published price.`
                : `Строки сметы вашего дома — ${m(direct)} без резерва. Полоса показывает, какая их часть стоит на опубликованной цене.`}
          </p>
          <div className="facts-bar" role="img" aria-label={ORDER.map((e) => `${L(EVIDENCE[e])} ${pct(share[e])}%`).join(', ')}>
            {ORDER.map((e) =>
              share[e] > 0 ? (
                <span key={e} style={{ flexGrow: share[e], background: EVIDENCE[e].color }} title={`${L(EVIDENCE[e])}: ${m(share[e])}`} />
              ) : null,
            )}
          </div>
          <div className="facts-legend">
            {ORDER.map((e) => (
              <button
                key={e}
                type="button"
                aria-pressed={filter === e}
                onClick={() => setFilter(filter === e ? 'all' : e)}
                className="facts-legend-item"
              >
                <span className="facts-dot" style={{ background: EVIDENCE[e].color }} />
                <span className="facts-legend-pct">{pct(share[e])}%</span>
                <span>
                  <strong>{L(EVIDENCE[e])}</strong>
                  <span className="facts-muted"> — {L(EVIDENCE[e].hint)}, {m(share[e])}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panel-head">
          <span>{lang === 'hy' ? 'Գներ և աղբյուրներ' : lang === 'en' ? 'Prices and sources' : 'Цены и источники'}</span>
          <span className="sub">
            {lang === 'hy'
              ? 'դասավորված ըստ ձեր նախահաշվում գումարի'
              : lang === 'en'
                ? 'ordered by what they cost in your estimate'
                : 'по убыванию суммы в вашей смете'}
          </span>
        </div>
        <div className="facts-tools">
          <input
            className="input"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={lang === 'hy' ? 'Որոնել՝ բետոն, կաթսա…' : lang === 'en' ? 'Search: concrete, boiler…' : 'Найти: бетон, котёл…'}
            aria-label={lang === 'hy' ? 'Որոնել' : lang === 'en' ? 'Search' : 'Поиск'}
          />
          {filter !== 'all' && (
            <button type="button" className="facts-clear" onClick={() => setFilter('all')}>
              {lang === 'hy' ? 'Ցույց տալ բոլորը' : lang === 'en' ? 'Show all' : 'Показать все'}
            </button>
          )}
        </div>
        <ul className="facts-list">
          {rows.map(({ it, ev, amount }) => (
            <li key={it.key} className="facts-row">
              <span className="facts-mark" style={{ background: EVIDENCE[ev].color }} title={L(EVIDENCE[ev])} />
              <div className="facts-main">
                <div className="facts-title">
                  <strong>{labelFor(it, lang)}</strong>
                  <span className="facts-price">
                    {m(it.materialTypical)}
                    {it.labor > 0 && ` + ${m(it.labor)}`} / {it.unit}
                  </span>
                </div>
                {it.note && <p className="facts-note">{it.note}</p>}
                <div className="facts-meta">
                  <span style={{ color: EVIDENCE[ev].color }}>{L(EVIDENCE[ev])}</span>
                  {it.materialMin !== it.materialMax && (
                    <span>
                      {lang === 'hy' ? 'միջակայք' : lang === 'en' ? 'range' : 'вилка'} {m(it.materialMin)}–{m(it.materialMax)}
                    </span>
                  )}
                  {it.verifiedAt && <span>{it.verifiedAt}</span>}
                  {amount > 0 && (
                    <span>
                      {lang === 'hy' ? 'ձեր նախահաշվում' : lang === 'en' ? 'in your estimate' : 'в вашей смете'} {m(amount)}
                    </span>
                  )}
                  {(it.sourceUrls ?? []).map((u) => (
                    <a key={u} href={u} target="_blank" rel="noreferrer">
                      {host(u)}
                    </a>
                  ))}
                </div>
              </div>
            </li>
          ))}
          {rows.length === 0 && (
            <li className="facts-empty">
              {lang === 'hy' ? 'Ոչինչ չգտնվեց։ Փոխեք որոնումը կամ ֆիլտրը։' : lang === 'en' ? 'Nothing matches. Change the search or the filter.' : 'Ничего не нашлось. Измените поиск или фильтр.'}
            </li>
          )}
        </ul>
      </section>

      <section className="panel">
        <div className="panel-head">
          <span>{lang === 'hy' ? 'Ինչպես են հաշվվում քանակները' : lang === 'en' ? 'How quantities are counted' : 'Как считаются количества'}</span>
          <span className="sub">
            {lang === 'hy'
              ? 'ենթադրությունները կփոխարինի նախագիծը'
              : lang === 'en'
                ? 'the project will replace the assumptions'
                : 'допущения заменит рабочий проект'}
          </span>
        </div>
        <ul className="facts-list">
          {QUANTITY_FACTS.map((f) => (
            <li key={f.id} className="facts-row">
              <span className="facts-mark" style={{ background: KIND[f.kind].color }} title={L(KIND[f.kind])} />
              <div className="facts-main">
                <div className="facts-title">
                  <span>{L(f)}</span>
                  <span className="facts-price">{f.value}</span>
                </div>
                <div className="facts-meta">
                  <span style={{ color: KIND[f.kind].color }}>{L(KIND[f.kind])}</span>
                  {f.source &&
                    (f.source.url ? (
                      <a href={f.source.url} target="_blank" rel="noreferrer">
                        {f.source.label}
                      </a>
                    ) : (
                      <span>{f.source.label}</span>
                    ))}
                </div>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="panel">
        <div className="panel-head">
          <span>{lang === 'hy' ? 'Համեմատություն շուկայի հետ' : lang === 'en' ? 'Checked against the market' : 'Сверка с рынком'}</span>
        </div>
        <ul className="facts-list">
          {BENCHMARKS.map((b) => (
            <li key={b.source} className="facts-row">
              <span className="facts-mark" style={{ background: 'var(--color-ink-soft)' }} />
              <div className="facts-main">
                <div className="facts-title">
                  <span>{L(b)}</span>
                  <span className="facts-price">{b.value}</span>
                </div>
                <div className="facts-meta">
                  {b.url ? (
                    <a href={b.url} target="_blank" rel="noreferrer">
                      {b.source}
                    </a>
                  ) : (
                    <span>{b.source}</span>
                  )}
                  <span>{b.date}</span>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
