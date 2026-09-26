// The store reads localStorage once, at import time, so each case stubs the
// storage and imports a fresh copy of the module.

import { describe, it, expect, vi, afterEach } from 'vitest'

function memoryStorage(seed: Record<string, string>) {
  const data = new Map(Object.entries(seed))
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
  }
}

async function storeWith(seed: Record<string, string>) {
  vi.stubGlobal('localStorage', memoryStorage(seed))
  vi.resetModules()
  const { useProject } = await import('./useProject')
  return useProject.getState()
}

describe('saved house and the VAT default', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('a first visit starts without VAT', async () => {
    expect((await storeWith({})).house.vatIncluded).toBe(false)
  })

  it('v4 inputs are kept, the old VAT default is dropped', async () => {
    const s = await storeWith({ ahc_house_v4: JSON.stringify({ length: 10, vatIncluded: true }) })
    expect(s.house.length).toBe(10)
    expect(s.house.vatIncluded).toBe(false)
  })

  it('old scenarios get the fields they lack and lose the old VAT default', async () => {
    const old = [{ id: 's0_a', name: 'a', house: { length: 11, vatIncluded: true, eng: {} } }]
    const s = await storeWith({ ahc_scenarios_v1: JSON.stringify(old) })
    expect(s.scenarios[0].house.length).toBe(11)
    expect(s.scenarios[0].house.overheadPct).toBe(15) // absent in the save → default, not NaN
    expect(s.scenarios[0].house.vatIncluded).toBe(false)
  })

  it('VAT ticked after the switch to v5 stays ticked', async () => {
    const s = await storeWith({
      ahc_house_v4: JSON.stringify({ vatIncluded: false }),
      ahc_house_v5: JSON.stringify({ vatIncluded: true }),
    })
    expect(s.house.vatIncluded).toBe(true)
  })
})

describe('factory reset and the exchange rate', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns to the loaded central-bank rate, not the built-in fallback', async () => {
    vi.stubGlobal('localStorage', memoryStorage({}))
    vi.resetModules()
    const { useProject } = await import('./useProject')
    useProject.getState().applyCbaRates({ currentDate: new Date().toISOString().slice(0, 10), rates: { USD: 400 } } as never)
    useProject.getState().setAmdPerUsd(390)
    useProject.getState().resetAll()
    expect(useProject.getState().amdPerUsd).toBe(400)
    expect(useProject.getState().rateSource).toBe('cba')
  })
})

describe('saved prices after a seed update', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('an untouched v1 row takes the new market price; an edited field is kept', async () => {
    const v1 = {
      // saved with the old seed and never edited
      aerated_block: { materialMin: 30600, materialTypical: 34000, materialMax: 39100, labor: 12000 },
      // the visitor typed their own typical concrete price
      concrete_b25: { materialMin: 30600, materialTypical: 36500, materialMax: 39100, labor: 18000 },
    }
    const s = await storeWith({ ahc_prices_v1: JSON.stringify(v1) })
    expect(s.prices.aerated_block.materialTypical).toBe(35000)
    expect(s.prices.concrete_b25.materialTypical).toBe(36500)
    expect(s.prices.concrete_b25.materialMax).toBe(38000) // not edited → new seed
  })

  it('v2 stores only what the visitor changed', async () => {
    const storage = memoryStorage({})
    vi.stubGlobal('localStorage', storage)
    vi.resetModules()
    const { useProject } = await import('./useProject')
    useProject.getState().setPriceItem('tuff_block', { materialTypical: 15000 })
    expect(JSON.parse(storage.getItem('ahc_prices_v2')!)).toEqual({ tuff_block: { materialTypical: 15000 } })
  })
})
