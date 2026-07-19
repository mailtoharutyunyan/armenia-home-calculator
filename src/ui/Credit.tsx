import { useMemo, useState } from 'react'
import { useProject } from '../store/useProject'
import { t } from '../i18n'
import { computeQuantities } from '../engine/quantities'
import { computeEstimate } from '../engine/pricing'
import { money } from './format'

export function Credit() {
  const { house, prices, lang, priceMode, amdPerUsd } = useProject()
  const [down, setDown] = useState(30)
  const [rate, setRate] = useState(12)
  const [years, setYears] = useState(15)

  const total = useMemo(() => {
    const q = computeQuantities(house)
    return computeEstimate(q, prices, house, priceMode).turnkey.total
  }, [house, prices, priceMode])

  const m = (v: number) => money(v, house.currency, amdPerUsd)

  const downPct = Math.min(100, Math.max(0, down))
  const principal = Math.max(0, total * (1 - downPct / 100))
  const n = Math.max(1, Math.round(Math.max(1, years) * 12))
  const i = Math.max(0, rate) / 100 / 12
  const monthly = i === 0 ? principal / n : (principal * i) / (1 - Math.pow(1 + i, -n))
  const overpay = monthly * n - principal

  return (
    <section className="panel" id="credit">
      <div className="panel-head">
        <span>{t(lang, 'creditTitle')}</span>
        <span className="sub">{t(lang, 'stageTurnkey')}: {m(total)}</span>
      </div>
      <div style={{ padding: '1rem', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.8rem' }}>
        <Field label={t(lang, 'downPayment')} value={down} onChange={setDown} />
        <Field label={t(lang, 'rate')} value={rate} onChange={setRate} step={0.1} />
        <Field label={t(lang, 'term')} value={years} onChange={setYears} />
      </div>
      <div style={{ padding: '0 1rem 1rem', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.8rem' }}>
        <Stat label={t(lang, 'loanAmount')} value={m(principal)} />
        <Stat label={t(lang, 'monthlyPayment')} value={m(monthly)} accent />
        <Stat label={t(lang, 'overpay')} value={m(overpay)} />
      </div>
    </section>
  )
}

function Field({ label, value, onChange, step = 1 }: { label: string; value: number; onChange: (n: number) => void; step?: number }) {
  return (
    <label className="field" style={{ marginBottom: 0 }}>
      <span>{label}</span>
      <input className="input" type="number" value={value} step={step} onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  )
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div
      style={{
        border: '1px solid var(--color-border)',
        borderLeft: `3px solid ${accent ? 'var(--color-copper)' : 'var(--color-navy)'}`,
        borderRadius: 10,
        padding: '0.7rem 0.8rem',
        background: 'var(--color-surface-2)',
      }}
    >
      <div style={{ fontSize: '0.72rem', color: 'var(--color-ink-soft)', fontWeight: 600 }}>{label}</div>
      <div className="num" style={{ fontSize: '1.1rem', fontWeight: 700, marginTop: '0.2rem', color: accent ? 'var(--color-copper)' : 'var(--color-ink)' }}>
        {value}
      </div>
    </div>
  )
}
