import { useMemo } from 'react'
import { useProject } from '../store/useProject'
import { t } from '../i18n'
import { computeQuantities } from '../engine/quantities'
import { computeEstimate } from '../engine/pricing'
import type { SectionId } from '../engine/quantities'
import { money, num } from './format'

const SECTION_LABEL: Record<SectionId, { ru: string; hy: string }> = {
  earthworks: { ru: 'Земляные работы', hy: 'Հողային աշխատանքներ' },
  foundation: { ru: 'Фундамент и бетон', hy: 'Հիմք և բետոն' },
  walls: { ru: 'Стены и кладка', hy: 'Պատեր և շարվածք' },
  frame: { ru: 'Каркас', hy: 'Կմախք' },
  floors: { ru: 'Перекрытия и стяжка', hy: 'Ծածկեր և շաղախ' },
  stair: { ru: 'Лестница', hy: 'Աստիճան' },
  roof: { ru: 'Кровля', hy: 'Տանիք' },
  openings: { ru: 'Окна и двери', hy: 'Պատուհաններ և դռներ' },
  partitions: { ru: 'Перегородки', hy: 'Միջնապատեր' },
  finishing: { ru: 'Отделка', hy: 'Հարդարում' },
  facade: { ru: 'Фасад', hy: 'Ֆասադ' },
  engineering: { ru: 'Инженерные сети', hy: 'Ինժեներական ցանցեր' },
  options: { ru: 'Дополнительные системы', hy: 'Լրացուցիչ համակարգեր' },
  permit: { ru: 'Документы и разрешение', hy: 'Փաստաթղթեր և թույլտվություն' },
}

const TOGGLEABLE: SectionId[] = ['stair', 'roof', 'openings', 'partitions', 'finishing', 'facade', 'engineering', 'permit']

export function Results() {
  const { house, prices, lang, priceMode, setPriceMode, amdPerUsd, setHouse } = useProject()
  const excluded = house.excludedSections
  const toggle = (sec: string) =>
    setHouse({
      excludedSections: excluded.includes(sec) ? excluded.filter((s) => s !== sec) : [...excluded, sec],
    })

  const { est, geo } = useMemo(() => {
    const q = computeQuantities(house)
    return { est: computeEstimate(q, prices, house, priceMode), geo: q.geometry }
  }, [house, prices, priceMode])
  // Упрощённый порядок N 4.1 (пост. N 1969-Ն): участок ≥400 м², дом ≤300 м², ≤2 надземных этажа
  const proc41 = geo.netFloorArea <= 300 && house.floors <= 2 && house.plotArea >= 400

  const m = (v: number) => money(v, house.currency, amdPerUsd)

  // group lines by section
  const sections = new Map<SectionId, typeof est.lines>()
  for (const l of est.lines) {
    if (!sections.has(l.section)) sections.set(l.section, [])
    sections.get(l.section)!.push(l)
  }

  return (
    <div className="panel" id="estimate">
      <div className="panel-head">
        <span>{t(lang, 'resultTitle')}</span>
        <div className="seg no-print">
          <button aria-pressed={priceMode === 'min'} onClick={() => setPriceMode('min')}>{t(lang, 'pm_min')}</button>
          <button aria-pressed={priceMode === 'typical'} onClick={() => setPriceMode('typical')}>{t(lang, 'pm_typical')}</button>
          <button aria-pressed={priceMode === 'max'} onClick={() => setPriceMode('max')}>{t(lang, 'pm_max')}</button>
        </div>
      </div>

      <div style={{ padding: '1rem' }}>
        {/* area + RA procedure threshold (300 m²) */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '0.8rem',
            flexWrap: 'wrap',
            marginBottom: '1rem',
            paddingBottom: '0.9rem',
            borderBottom: '1px solid var(--color-border)',
          }}
        >
          <div>
            <div className="mono" style={{ fontSize: '0.66rem', color: 'var(--color-ink-soft)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              {t(lang, 'areaTotal')} · {t(lang, 'areaHint')}
            </div>
            <div className="mono" style={{ fontSize: '1.4rem', fontWeight: 700 }}>
              {num(geo.netFloorArea, 0)} м²
            </div>
          </div>
          <span className={`badge ${proc41 ? 'lvl-info' : 'lvl-warning'}`} style={{ padding: '0.3rem 0.7rem' }}>
            {t(lang, proc41 ? 'proc41Ok' : 'proc41No')}
          </span>
        </div>
        <p style={{ margin: '-0.4rem 0 0.8rem', fontSize: '0.72rem', color: 'var(--color-ink-soft)', lineHeight: 1.5 }}>
          {t(lang, 'proc41Cond')}
        </p>

        {/* area breakdown */}
        <details style={{ marginBottom: '1rem' }}>
          <summary className="eyebrow" style={{ cursor: 'pointer' }}>{t(lang, 'areaBreakdown')}</summary>
          <div style={{ marginTop: '0.6rem' }}>
            <AreaRow label={t(lang, 'ab_builtup')} v={geo.footprint} />
            <AreaRow label={t(lang, 'ab_floor1')} v={geo.internalPerFloor} />
            {house.floors > 1 && <AreaRow label={t(lang, 'ab_upper')} v={Math.max(0, geo.netFloorArea - geo.internalPerFloor)} />}
            {geo.hallVoid > 0 && <AreaRow label={t(lang, 'ab_hall')} v={geo.hallVoid} minus />}
            <div className="spec-row" style={{ fontWeight: 700, borderBottom: 'none' }}>
              <span>{t(lang, 'ab_total')}</span>
              <span className="num" style={{ color: 'var(--color-copper)' }}>{num(geo.netFloorArea, 0)} м²</span>
            </div>
          </div>
        </details>

        {/* include / exclude sections */}
        <div style={{ marginBottom: '1rem' }}>
          <div className="eyebrow" style={{ marginBottom: '0.6rem' }}>
            {lang !== 'hy' ? 'Включить в смету' : 'Ներառել նախահաշվում'}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem 1rem' }}>
            {TOGGLEABLE.map((sec) => (
              <label key={sec} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem', cursor: 'pointer' }}>
                <input type="checkbox" checked={!excluded.includes(sec)} onChange={() => toggle(sec)} />
                {lang !== 'hy' ? SECTION_LABEL[sec].ru : SECTION_LABEL[sec].hy}
              </label>
            ))}
          </div>
        </div>

        {/* headline totals */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem' }}>
          <Tile label={t(lang, 'stageAct')} value={m(est.act.total)} accent="navy" />
          <Tile label={t(lang, 'stageTurnkey')} value={m(est.turnkey.total)} accent="copper" />
        </div>

        <div
          style={{
            marginTop: '0.8rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            borderTop: '1px solid var(--color-border)',
            borderBottom: '1px solid var(--color-border)',
            padding: '0.6rem 0',
          }}
        >
          <div>
            <div className="mono" style={{ fontSize: '0.68rem', color: 'var(--color-ink-soft)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              {t(lang, 'range')}
            </div>
            <div className="mono" style={{ fontSize: '1.02rem', fontWeight: 700 }}>
              {m(est.rangeLow)} — {m(est.rangeHigh)}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div className="mono" style={{ fontSize: '0.68rem', color: 'var(--color-ink-soft)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              {t(lang, 'perM2')}
            </div>
            <div className="mono" style={{ fontSize: '1.02rem', fontWeight: 700, color: 'var(--color-copper)' }}>
              {m(est.perM2)}
            </div>
          </div>
        </div>

        {est.missing.length > 0 && (
          <div className="mono lvl-warning" style={{ marginTop: '0.6rem', fontSize: '0.74rem' }}>
            ⚠ {t(lang, 'noPrice')}: {est.missing.join(', ')}
          </div>
        )}

        {/* bill of quantities by section */}
        <div style={{ marginTop: '1rem' }}>
          {[...sections.entries()].map(([sec, lines]) => {
            const secTotal = est.sectionTotals[sec] ?? 0
            return (
              <details key={sec} style={{ marginBottom: '0.4rem' }} open>
                <summary
                  style={{
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontFamily: 'var(--font-display)',
                    fontWeight: 600,
                    fontSize: '0.9rem',
                    padding: '0.3rem 0',
                  }}
                >
                  <span>{lang !== 'hy' ? SECTION_LABEL[sec].ru : SECTION_LABEL[sec].hy}</span>
                  <span className="mono">{m(secTotal)}</span>
                </summary>
                <div style={{ paddingLeft: '0.4rem' }}>
                  {lines.map((l, i) => (
                    <div className="spec-row" key={i}>
                      <span>
                        {lang !== 'hy' ? l.labelRu : l.labelHy}
                        <span className="mono" style={{ color: 'var(--color-ink-soft)', marginLeft: '0.4rem', fontSize: '0.72rem' }}>
                          {l.quantity.toFixed(l.unit === 'шт' ? 0 : 1)} {l.unit}
                        </span>
                      </span>
                      <span className="num">{m(l.total)}</span>
                    </div>
                  ))}
                </div>
              </details>
            )
          })}
        </div>

        {/* footer totals */}
        <div style={{ marginTop: '0.8rem', borderTop: '2px solid var(--color-navy)', paddingTop: '0.6rem' }}>
          <Row label={t(lang, 'material')} value={m(est.turnkey.material)} />
          <Row label={t(lang, 'labor')} value={m(est.turnkey.labor)} />
          {est.turnkey.reserve > 0 && <Row label={t(lang, 'reserve')} value={m(est.turnkey.reserve)} />}
          {house.vatIncluded && <Row label={t(lang, 'vatLine')} value={m(est.turnkey.vat)} />}
          <div className="spec-row" style={{ borderBottom: 'none', fontWeight: 700 }}>
            <span style={{ fontFamily: 'var(--font-display)' }}>{t(lang, 'total')} ({t(lang, 'stageTurnkey')})</span>
            <span className="num" style={{ fontSize: '1.05rem', color: 'var(--color-copper)' }}>{m(est.turnkey.total)}</span>
          </div>
        </div>

        <p style={{ marginTop: '0.9rem', fontSize: '0.72rem', color: 'var(--color-ink-soft)', lineHeight: 1.5 }}>
          {t(lang, 'disclaimer')}
        </p>
      </div>
    </div>
  )
}

function Tile({ label, value, accent }: { label: string; value: string; accent: 'navy' | 'copper' }) {
  return (
    <div
      style={{
        border: `1px solid var(--color-border)`,
        borderLeft: `3px solid var(--color-${accent})`,
        padding: '0.7rem 0.8rem',
        background: '#fff',
      }}
    >
      <div className="mono" style={{ fontSize: '0.66rem', color: 'var(--color-ink-soft)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
        {label}
      </div>
      <div className="mono" style={{ fontSize: '1.25rem', fontWeight: 700, marginTop: '0.2rem' }}>
        {value}
      </div>
    </div>
  )
}

function AreaRow({ label, v, minus }: { label: string; v: number; minus?: boolean }) {
  return (
    <div className="spec-row">
      <span style={{ color: 'var(--color-ink-soft)' }}>{label}</span>
      <span className="num">{minus ? '−' : ''}{num(v, 0)} м²</span>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="spec-row">
      <span style={{ color: 'var(--color-ink-soft)' }}>{label}</span>
      <span className="num">{value}</span>
    </div>
  )
}
