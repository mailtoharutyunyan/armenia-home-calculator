import { useMemo } from 'react'
import { useProject } from '../store/useProject'
import { t } from '../i18n'
import { compareSystems } from '../engine/compare'
import { money } from './format'

const SYS_KEY = {
  tuff: 'sys_tuff',
  aerated: 'sys_aerated',
  frame: 'sys_frame',
  brick: 'sys_brick',
} as const

const PROS_CONS: Record<string, { pros: { ru: string; hy: string }[]; cons: { ru: string; hy: string }[] }> = {
  tuff: {
    pros: [
      { ru: 'Местный камень, традиция', hy: 'Տեղական քար, ավանդույթ' },
      { ru: 'Дышащие стены, тепло', hy: 'Շնչող պատեր, ջերմ' },
      { ru: 'Хорош для сейсмики с поясами', hy: 'Լավ սեյսմիկայի համար գոտիներով' },
    ],
    cons: [
      { ru: 'Тяжелее, дороже работа', hy: 'Ծանր, թանկ աշխատանք' },
      { ru: 'Нужны сейсмосердечники', hy: 'Պահանջվում են սեյսմ. միջուկներ' },
    ],
  },
  aerated: {
    pros: [
      { ru: 'Быстрый монтаж, ровно', hy: 'Արագ մոնտաժ, հարթ' },
      { ru: 'Лёгкий, тёплый', hy: 'Թեթև, ջերմ' },
    ],
    cons: [
      { ru: 'Несущий — только по сейсморасчёту', hy: 'Կրող՝ միայն սեյսմիկ հաշվարկով' },
      { ru: 'Хрупкий при горизонтальных нагрузках', hy: 'Փխրուն հորիզոնական բեռների դեպքում' },
      { ru: 'Боится влаги без отделки', hy: 'Վախենում է խոնավությունից' },
    ],
  },
  frame: {
    pros: [
      { ru: 'Лучшая сейсмостойкость', hy: 'Լավագույն սեյսմակայունություն' },
      { ru: 'Гибкие планировки, этажность', hy: 'Ճկուն հատակագիծ, հարկայնություն' },
    ],
    cons: [
      { ru: 'Больше бетона и арматуры', hy: 'Ավելի շատ բետոն և արմատուր' },
      { ru: 'Нужна опалубка и расчёт', hy: 'Պահանջվում է կաղապար և հաշվարկ' },
    ],
  },
  brick: {
    pros: [
      { ru: 'Прочный, долговечный', hy: 'Ամուր, երկարակյաց' },
      { ru: 'Хорошая звукоизоляция', hy: 'Լավ ձայնամեկուսացում' },
    ],
    cons: [
      { ru: 'Дорогая кладка, дольше', hy: 'Թանկ շարվածք, երկար' },
      { ru: 'Толстые несущие стены', hy: 'Հաստ կրող պատեր' },
    ],
  },
}

export function Compare() {
  const { house, prices, lang, priceMode, amdPerUsd } = useProject()
  const rows = useMemo(() => compareSystems(house, prices, priceMode), [house, prices, priceMode])
  const m = (v: number) => money(v, house.currency, amdPerUsd)
  const allowed = rows.filter((r) => !r.caution)
  const cheapest = allowed.length ? Math.min(...allowed.map((r) => r.turnkeyTotal)) : Infinity

  return (
    <section className="panel" id="compare">
      <div className="panel-head">
        <span>{t(lang, 'compareTitle')}</span>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.86rem' }}>
          <thead>
            <tr style={{ textAlign: 'left', background: 'var(--color-surface-2)' }}>
              <th style={cell}>{t(lang, 'system')}</th>
              <th style={cellR}>{t(lang, 'stageAct')}</th>
              <th style={cellR}>{t(lang, 'stageTurnkey')}</th>
              <th style={cellR}>{t(lang, 'perM2')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.system} style={{ background: !r.caution && r.turnkeyTotal === cheapest ? 'rgba(47,125,87,0.08)' : undefined }}>
                <td style={cell}>
                  {t(lang, SYS_KEY[r.system])}
                  {r.caution && (
                    <span className="badge lvl-warning" style={{ marginLeft: '0.5rem' }}>
                      {t(lang, 'banned')}
                    </span>
                  )}
                </td>
                <td style={cellR} className="mono">{m(r.actTotal)}</td>
                <td style={cellR} className="mono">{m(r.turnkeyTotal)}</td>
                <td style={cellR} className="mono">{m(r.perM2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ padding: '1rem', borderTop: '1px solid var(--color-border)' }}>
        <div className="eyebrow" style={{ marginBottom: '0.8rem' }}>{t(lang, 'prosCons')}</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.8rem' }}>
          {rows.map((r) => {
            const pc = PROS_CONS[r.system]
            return (
              <div key={r.system} style={{ border: '1px solid var(--color-border)', borderRadius: 10, padding: '0.8rem', background: 'var(--color-surface-2)' }}>
                <strong style={{ fontFamily: 'var(--font-display)', fontSize: '0.86rem' }}>{t(lang, SYS_KEY[r.system])}</strong>
                <ul style={{ listStyle: 'none', margin: '0.5rem 0 0', padding: 0, fontSize: '0.8rem' }}>
                  {pc.pros.map((x, i) => (
                    <li key={`p${i}`} style={{ color: 'var(--color-ok)', padding: '0.12rem 0' }}>+ {lang !== 'hy' ? x.ru : x.hy}</li>
                  ))}
                  {pc.cons.map((x, i) => (
                    <li key={`c${i}`} style={{ color: 'var(--color-err)', padding: '0.12rem 0' }}>− {lang !== 'hy' ? x.ru : x.hy}</li>
                  ))}
                </ul>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

const cell: React.CSSProperties = { padding: '0.55rem 0.9rem', borderBottom: '1px solid var(--color-border)' }
const cellR: React.CSSProperties = { ...cell, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }
