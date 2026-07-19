import { useMemo } from 'react'
import { useProject } from '../store/useProject'
import { t } from '../i18n'
import { PERMIT_STEPS } from '../data/permits'
import { computeQuantities } from '../engine/quantities'
import { materialPrice } from '../model/catalog'
import { money } from './format'

const PERMIT_ITEMS: { key: string; perArea?: boolean }[] = [
  { key: 'permit_apz' },
  { key: 'permit_design', perArea: true },
  { key: 'permit_geology' },
  { key: 'permit_expertise' },
  { key: 'permit_fee' },
  { key: 'permit_address' },
  { key: 'permit_supervision', perArea: true },
]

export function Permit() {
  const { house, prices, lang, priceMode, amdPerUsd } = useProject()
  const area = useMemo(() => computeQuantities(house).geometry.totalFloorArea, [house])
  const m = (v: number) => money(v, house.currency, amdPerUsd)

  const costs = PERMIT_ITEMS.map(({ key, perArea }) => {
    const it = prices[key]
    if (!it) return null
    return { it, total: materialPrice(it, priceMode) * (perArea ? area : 1) }
  }).filter(Boolean) as { it: (typeof prices)[string]; total: number }[]
  const permitTotal = costs.reduce((a, c) => a + c.total, 0)

  return (
    <section className="panel" id="permit">
      <div className="panel-head">
        <span>{t(lang, 'nav_permit')} · РА</span>
        <span className="sub">{m(permitTotal)}</span>
      </div>

      <div style={{ padding: '0.6rem 1rem 0.2rem' }}>
        {costs.map((c) => (
          <div className="spec-row" key={c.it.key}>
            <span>{lang === 'ru' ? c.it.labelRu : c.it.labelHy}</span>
            <span className="num">{m(c.total)}</span>
          </div>
        ))}
        <div className="spec-row" style={{ fontWeight: 700 }}>
          <span>{t(lang, 'total')}</span>
          <span className="num" style={{ color: 'var(--color-copper)' }}>{m(permitTotal)}</span>
        </div>
      </div>

      <ol style={{ listStyle: 'none', margin: 0, padding: '0.4rem 1rem 0.6rem' }}>
        {PERMIT_STEPS.map((s, i) => (
          <li
            key={i}
            style={{
              display: 'flex',
              gap: '0.8rem',
              padding: '0.5rem 0',
              borderBottom: i < PERMIT_STEPS.length - 1 ? '1px solid var(--color-border)' : 'none',
            }}
          >
            <span
              style={{
                display: 'inline-flex',
                width: 24,
                height: 24,
                borderRadius: 7,
                background: 'var(--color-surface-2)',
                border: '1px solid var(--color-border)',
                color: 'var(--color-copper)',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: '0.76rem',
                flexShrink: 0,
              }}
            >
              {i + 1}
            </span>
            <div>
              <strong style={{ fontFamily: 'var(--font-display)', fontSize: '0.9rem' }}>
                {lang === 'ru' ? s.ru : s.hy}
              </strong>
              <p style={{ margin: '0.2rem 0 0', fontSize: '0.82rem', color: 'var(--color-ink-soft)', lineHeight: 1.45 }}>
                {lang === 'ru' ? s.descRu : s.descHy}
              </p>
            </div>
          </li>
        ))}
      </ol>
      <p style={{ padding: '0 1rem 1rem', margin: 0, fontSize: '0.74rem', color: 'var(--color-ink-soft)' }}>
        {lang === 'ru'
          ? 'Заявки подаются онлайн на urban.e-gov.am. Проект и геология — по договору; суммы ориентировочные.'
          : 'Դիմումները՝ առցանց urban.e-gov.am-ում։ Գումարները մոտավոր են։'}
      </p>
    </section>
  )
}
