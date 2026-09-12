import { useMemo } from 'react'
import { useProject } from '../store/useProject'
import { t } from '../i18n'
import { computeQuantities } from '../engine/quantities'
import { computeEstimate } from '../engine/pricing'
import { checkNorms } from '../engine/norms'
import { money, num } from './format'

// Постоянно видимый итог.
//
// Человек открывает калькулятор ради одной цифры — сколько стоит дом. Раньше
// она лежала под сгибом, ниже формы и плана, и чтобы увидеть эффект от правки
// поля, надо было прокручивать. Эта полоса держит ответ на экране, пока
// пользователь крутит параметры: меняешь этаж — сумма пересчитывается на месте.
export function ResultBar() {
  const { house, prices, lang, priceMode, amdPerUsd } = useProject()

  const { est, geo, errors } = useMemo(() => {
    const q = computeQuantities(house)
    return {
      est: computeEstimate(q, prices, house, priceMode),
      geo: q.geometry,
      errors: checkNorms(house, q).filter((w) => w.level === 'error').length,
    }
  }, [house, prices, priceMode])

  const m = (v: number) => money(v, house.currency, amdPerUsd)

  return (
    <div className="resultbar">
      <div className="resultbar-inner">
        <div className="rb-lead">
          <div className="rb-label">{t(lang, 'rb_turnkey')}</div>
          <div className="rb-figure">{m(est.turnkey.total)}</div>
          <div className="rb-range">
            {m(est.rangeLow)} — {m(est.rangeHigh)}
          </div>
        </div>

        <div className="rb-stats">
          <Stat label={t(lang, 'rb_perM2')} value={m(est.perM2)} />
          <Stat label={t(lang, 'rb_act')} value={m(est.act.total)} />
          <Stat label={t(lang, 'rb_area')} value={`${num(geo.netFloorArea, 0)} м²`} />
        </div>

        <a
          href="#warnings"
          className={errors > 0 ? 'rb-flag rb-flag-bad' : 'rb-flag rb-flag-ok'}
        >
          {errors > 0 ? t(lang, 'rb_violations').replace('{n}', String(errors)) : t(lang, 'rb_clean')}
        </a>
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rb-stat">
      <div className="rb-label">{label}</div>
      <div className="rb-value num">{value}</div>
    </div>
  )
}
