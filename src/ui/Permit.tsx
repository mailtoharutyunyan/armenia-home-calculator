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

// cost of each of the 8 procedural steps (aligned to PERMIT_STEPS order)
type StepCost = { fixed?: number; key?: string; perArea?: boolean; inProject?: boolean }
const STEP_COST: StepCost[] = [
  { fixed: 5000 }, // 1. документы на землю (кадастровая справка)
  { key: 'permit_apz' }, // 2. АПЗ
  { inProject: true }, // 3. эскизный проект — в составе проекта
  { key: 'permit_design', perArea: true }, // 4. рабочий проект
  { key: 'permit_geology' }, // 5. геология
  { key: 'permit_expertise' }, // 6. экспертиза
  { key: 'permit_fee' }, // 7. разрешение
  { key: 'permit_supervision', perArea: true }, // 8. технадзор + акт
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
            <span>{lang !== 'hy' ? c.it.labelRu : c.it.labelHy}</span>
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
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.8rem', alignItems: 'baseline' }}>
                <strong style={{ fontFamily: 'var(--font-display)', fontSize: '0.9rem' }}>
                  {lang !== 'hy' ? s.ru : s.hy}
                </strong>
                <span className="num" style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>
                  {stepCost(STEP_COST[i], prices, priceMode, area, m, lang)}
                </span>
              </div>
              <p style={{ margin: '0.2rem 0 0', fontSize: '0.82rem', color: 'var(--color-ink-soft)', lineHeight: 1.45 }}>
                {lang !== 'hy' ? s.descRu : s.descHy}
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

function stepCost(
  sc: StepCost,
  prices: ReturnType<typeof useProject.getState>['prices'],
  priceMode: ReturnType<typeof useProject.getState>['priceMode'],
  area: number,
  m: (v: number) => string,
  lang: string,
): string {
  if (sc.inProject) return lang !== 'hy' ? 'в составе проекта' : 'նախագծի կազմում'
  if (sc.fixed != null) return m(sc.fixed)
  if (sc.key) {
    const it = prices[sc.key]
    if (it) return m(materialPrice(it, priceMode) * (sc.perArea ? area : 1))
  }
  return '—'
}
