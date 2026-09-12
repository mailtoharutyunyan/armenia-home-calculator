// Курс попадает во все суммы в долларах, поэтому битое значение молча
// перекосит всю смету. Проверяем, что мусор отсекается, а не подставляется.

import { describe, it, expect } from 'vitest'
import { parseRates, isRateStale } from './rates'

const ok = {
  base: 'AMD',
  currentDate: '2026-09-11',
  fetchedAt: '2026-09-12T23:30:00Z',
  source: 'https://api.cba.am/exchangerates.asmx',
  rates: { USD: 363.28, EUR: 421.11, RUB: 4.2971, GEL: 139.37 },
}

describe('parseRates', () => {
  it('принимает корректный ответ', () => {
    expect(parseRates(ok)?.rates.USD).toBe(363.28)
  })

  it('отвергает мусор вместо объекта', () => {
    for (const bad of [null, undefined, 'USD=363', 42, []]) {
      expect(parseRates(bad)).toBeNull()
    }
  })

  it('отвергает отсутствующий или нечисловой USD', () => {
    expect(parseRates({ ...ok, rates: {} })).toBeNull()
    expect(parseRates({ ...ok, rates: { USD: '363.28' } })).toBeNull()
    expect(parseRates({ ...ok, rates: { USD: Number.NaN } })).toBeNull()
  })

  it('отвергает курс вне правдоподобного диапазона', () => {
    // защита от случая, когда распарсили не ту валюту: RUB≈4.3, а не курс доллара
    expect(parseRates({ ...ok, rates: { USD: 4.3 } })).toBeNull()
    expect(parseRates({ ...ok, rates: { USD: 0 } })).toBeNull()
    expect(parseRates({ ...ok, rates: { USD: -363 } })).toBeNull()
    expect(parseRates({ ...ok, rates: { USD: 100000 } })).toBeNull()
  })

  it('переживает отсутствие даты, но помечает её как неизвестную', () => {
    expect(parseRates({ ...ok, currentDate: undefined })?.currentDate).toBeNull()
  })
})

describe('isRateStale', () => {
  const now = new Date('2026-09-12T10:00:00Z')

  it('свежий курс не считается устаревшим', () => {
    expect(isRateStale('2026-09-11', now)).toBe(false)
  })

  it('курс старше 10 дней помечается устаревшим', () => {
    expect(isRateStale('2026-08-25', now)).toBe(true)
  })

  it('отсутствующая или битая дата считается устаревшей', () => {
    expect(isRateStale(null, now)).toBe(true)
    expect(isRateStale('позавчера', now)).toBe(true)
  })
})
