import { useMemo, useState } from 'react'
import { useProject } from '../store/useProject'
import { computeQuantities } from '../engine/quantities'
import { computeEstimate } from '../engine/pricing'
import type { HouseParams } from '../model/house'
import { money } from './format'

export function Scenarios() {
  const { scenarios, house, prices, priceMode, amdPerUsd, lang, saveScenario, loadScenario, deleteScenario } = useProject()
  const [name, setName] = useState('')
  const m = (v: number) => money(v, house.currency, amdPerUsd)

  const est = (h: HouseParams) => {
    const q = computeQuantities(h)
    const e = computeEstimate(q, prices, h, priceMode)
    return { act: e.act.total, turnkey: e.turnkey.total, perM2: e.perM2, area: q.geometry.netFloorArea }
  }

  const rows = useMemo(() => {
    const cur = { id: '__cur', name: lang === 'hy' ? 'Ընթացիկ' : lang === 'en' ? 'Current' : 'Текущий', house, current: true }
    return [cur, ...scenarios.map((s) => ({ ...s, current: false }))].map((r) => ({ ...r, ...est(r.house) }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scenarios, house, prices, priceMode, amdPerUsd, lang])

  const cheapest = Math.min(...rows.map((r) => r.turnkey))

  const T = {
    title: lang === 'hy' ? 'Սցենարներ' : lang === 'en' ? 'Scenarios' : 'Сценарии',
    ph: lang === 'hy' ? 'Անուն (էկոնոմ / ստանդարտ …)' : lang === 'en' ? 'Name (economy / standard …)' : 'Название (эконом / стандарт …)',
    save: lang === 'hy' ? 'Պահել ընթացիկը' : lang === 'en' ? 'Save current' : 'Сохранить текущий',
    variant: lang === 'hy' ? 'Վարիանտ' : lang === 'en' ? 'Variant' : 'Вариант',
    area: lang === 'hy' ? 'Մակերես' : lang === 'en' ? 'Area' : 'Площадь',
    load: lang === 'hy' ? 'Բեռնել' : lang === 'en' ? 'Load' : 'Загрузить',
    hint:
      lang === 'hy'
        ? 'Կարգավորեք տունը, պահեք որպես վարիանտ, համեմատեք կողք կողքի։'
        : lang === 'en'
        ? 'Tune the house, save it as a variant, compare side by side.'
        : 'Настройте дом, сохраните как вариант и сравните варианты рядом.',
  }

  return (
    <section className="panel" id="scenarios">
      <div className="panel-head">
        <span>{T.title}</span>
      </div>
      <div style={{ padding: '1rem' }}>
        <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', marginBottom: '0.9rem' }} className="no-print">
          <input
            className="input"
            style={{ flex: '1 1 200px', borderBottom: '1px solid var(--color-border)' }}
            value={name}
            placeholder={T.ph}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                saveScenario(name)
                setName('')
              }
            }}
          />
          <button className="btn btn-accent" onClick={() => { saveScenario(name); setName('') }}>
            + {T.save}
          </button>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
            <thead>
              <tr style={{ textAlign: 'left', background: 'var(--color-surface-2)' }}>
                <th style={cell}>{T.variant}</th>
                <th style={cellR}>{T.area}</th>
                <th style={cellR}>{lang === 'hy' ? 'Ակտ' : lang === 'en' ? 'Shell' : 'Коробка'}</th>
                <th style={cellR}>{lang === 'hy' ? 'Բանալի' : lang === 'en' ? 'Turnkey' : 'Под ключ'}</th>
                <th style={cellR}>֏/м²</th>
                <th style={cell} className="no-print"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} style={{ background: r.turnkey === cheapest ? 'rgba(201,162,75,0.12)' : undefined }}>
                  <td style={cell}>
                    {r.name}
                    {r.current && <span className="badge lvl-info" style={{ marginLeft: '0.5rem', padding: '0.1rem 0.4rem' }}>•</span>}
                  </td>
                  <td style={cellR} className="mono">{r.area.toFixed(0)} м²</td>
                  <td style={cellR} className="mono">{m(r.act)}</td>
                  <td style={cellR} className="mono">{m(r.turnkey)}</td>
                  <td style={cellR} className="mono">{m(r.perM2)}</td>
                  <td style={cellR} className="no-print">
                    {!r.current && (
                      <span style={{ display: 'inline-flex', gap: '0.5rem' }}>
                        <button className="btn btn-ghost" style={{ padding: '0.2rem 0.4rem', fontSize: '0.74rem' }} onClick={() => loadScenario(r.id)}>
                          {T.load}
                        </button>
                        <button aria-label="delete" onClick={() => deleteScenario(r.id)} style={{ border: '1px solid var(--color-border)', background: 'transparent', borderRadius: 6, cursor: 'pointer', color: 'var(--color-err)', padding: '0.2rem 0.45rem' }}>
                          ×
                        </button>
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p style={{ margin: '0.8rem 0 0', fontSize: '0.72rem', color: 'var(--color-ink-soft)', lineHeight: 1.5 }}>{T.hint}</p>
      </div>
    </section>
  )
}

const cell: React.CSSProperties = { padding: '0.5rem 0.8rem', borderBottom: '1px solid var(--color-border)' }
const cellR: React.CSSProperties = { ...cell, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }
