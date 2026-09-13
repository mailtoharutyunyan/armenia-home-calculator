// Честность прайса — это тоже контракт.
//
// Мёртвая ссылка на поставщика и цифра, выданная за котировку, опаснее
// отсутствия данных: пользователь принимает по ним решение о стройке.
// Эти тесты не дают таким вещам вернуться незаметно.

import { describe, it, expect } from 'vitest'
import { SEED_PRICES, PRICES_UPDATED, priceAgeDays, arePricesStale, precisionOf } from './prices'

const items = Object.values(SEED_PRICES)

describe('происхождение цен', () => {
  it('у каждой позиции проставлено происхождение', () => {
    const missing = items.filter((i) => !i.provenance).map((i) => i.key)
    expect(missing).toEqual([])
  })

  it("'quoted' разрешён только с датой сверки и рабочей ссылкой", () => {
    for (const i of items.filter((x) => x.provenance === 'quoted')) {
      expect(i.verifiedAt, `${i.key}: quoted без verifiedAt`).toBeTruthy()
      expect((i.sourceUrls ?? []).length, `${i.key}: quoted без источника`).toBeGreaterThan(0)
    }
  })

  it('оценки составителя помечены заметкой, чтобы их не приняли за прайс', () => {
    for (const i of items.filter((x) => x.provenance === 'estimate')) {
      expect(i.note, `${i.key}: estimate без пояснения`).toBeTruthy()
    }
  })
})

describe('источники', () => {
  it('в sourceUrls только разбираемые http(s)-адреса', () => {
    for (const i of items) {
      for (const u of i.sourceUrls ?? []) {
        expect(() => new URL(u), `${i.key}: неразбираемый адрес ${u}`).not.toThrow()
        expect(u, `${i.key}: не http(s)`).toMatch(/^https?:\/\//)
      }
    }
  })

  it('домены, признанные мёртвыми, не возвращаются в прайс', () => {
    // mmlider.am — NXDOMAIN на 13.09.2026
    // minfin.am — страница о ценах существует, но данных на ней нет
    const banned = ['mmlider.am', 'minfin.am']
    for (const i of items) {
      for (const u of i.sourceUrls ?? []) {
        for (const b of banned) {
          expect(u, `${i.key}: ссылается на ${b}`).not.toContain(b)
        }
      }
    }
  })
})

describe('возраст прайса', () => {
  it('дата разбирается и даёт неотрицательный возраст', () => {
    const age = priceAgeDays(PRICES_UPDATED, new Date('2026-09-13T00:00:00Z'))
    expect(age).not.toBeNull()
    expect(age!).toBeGreaterThanOrEqual(0)
  })

  it('битая дата считается устаревшей, а не свежей', () => {
    expect(priceAgeDays('вчера')).toBeNull()
    expect(arePricesStale('вчера')).toBe(true)
  })

  it('прайс старше 90 дней помечается устаревшим', () => {
    const now = new Date('2026-09-13T00:00:00Z')
    expect(arePricesStale('20.07.2026', now)).toBe(false)
    expect(arePricesStale('01.01.2026', now)).toBe(true)
  })
})

describe('точность расчёта заявляется честно', () => {
  it('без сверенных цен — оценка порядка величины', () => {
    const p = precisionOf(SEED_PRICES)
    expect(p.level).toBe('estimate')
    expect(p.quoted).toBe(0)
    expect(p.total).toBe(Object.keys(SEED_PRICES).length)
  })

  it('частичная сверка даёт промежуточный статус', () => {
    const partial = structuredClone(SEED_PRICES)
    const k = Object.keys(partial)[0]
    partial[k] = { ...partial[k], provenance: 'quoted', verifiedAt: '13.09.2026', sourceUrls: ['https://example.am'] }
    expect(precisionOf(partial).level).toBe('partial')
  })

  it('когда сверены все позиции, расчёт перестаёт быть приблизительным', () => {
    const all = structuredClone(SEED_PRICES)
    for (const k of Object.keys(all)) {
      all[k] = { ...all[k], provenance: 'quoted', verifiedAt: '13.09.2026', sourceUrls: ['https://example.am'] }
    }
    const p = precisionOf(all)
    expect(p.level).toBe('quoted')
    expect(p.quoted).toBe(p.total)
  })
})
