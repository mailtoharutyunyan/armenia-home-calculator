import { create } from 'zustand'
import type { Catalog, PriceItem } from '../model/catalog'
import type { HouseParams, PriceMode } from '../model/house'
import { DEFAULT_HOUSE } from '../model/house'
import { SEED_PRICES, AMD_PER_USD_DEFAULT } from '../data/prices'
import type { Lang } from '../i18n'
import type { Rates } from '../data/rates'
import { isRateStale } from '../data/rates'
import type { RoomType } from '../engine/floorplan'

export interface EditRoom {
  id: string
  label: string
  type: RoomType
  weight: number
}

let roomCounter = 0
export const newRoomId = () => `r${++roomCounter}`

export interface Scenario {
  id: string
  name: string
  house: HouseParams
}

// v2 keeps only the numbers a visitor changed, so later seed updates reach
// them. v1 stored the whole catalog on every edit, which froze the old prices.
const PRICE_KEY = 'ahc_prices_v2'
const LEGACY_PRICE_KEY = 'ahc_prices_v1'
const EDITABLE = ['materialMin', 'materialTypical', 'materialMax', 'labor'] as const
type PriceOverride = Partial<Pick<PriceItem, (typeof EDITABLE)[number]>>
// Seed numbers [min, typical, max, labor] replaced by the 26.09.2026 market
// check. A v1 row still equal to them was never edited and takes the new seed;
// rows not listed here are unchanged, so they compare with the current seed.
const SEED_BEFORE_2026_09_26: Record<string, [number, number, number, number]> = {
  concrete_b15: [26100, 29000, 33350, 18000],
  concrete_b20: [27000, 30000, 34500, 18000],
  concrete_b225: [28800, 32000, 36800, 18000],
  concrete_b25: [30600, 34000, 39100, 18000],
  concrete_blinding: [22500, 25000, 28750, 8000],
  rebar_a500: [261000, 290000, 333500, 60000],
  tuff_block: [18000, 20000, 23000, 15000],
  aerated_block: [30600, 34000, 39100, 12000],
  mortar: [16200, 18000, 20700, 0],
  sand_gravel: [6300, 7000, 8050, 3000],
  waterproofing: [1800, 2000, 2300, 1500],
  insulation: [2250, 2500, 2875, 2000],
  screed: [2700, 3000, 3450, 2500],
  window_regular: [45000, 50000, 57500, 8000],
  door_exterior: [135000, 150000, 172500, 15000],
  door_interior: [40500, 45000, 51750, 10000],
  plaster: [2250, 2500, 2875, 3000],
  floor_finish: [7650, 8500, 9775, 6000],
}

// the visitor's changes against the seed, the only thing worth storing
function priceOverrides(catalog: Catalog): Record<string, PriceOverride> {
  const out: Record<string, PriceOverride> = {}
  for (const [key, item] of Object.entries(catalog)) {
    const seed = SEED_PRICES[key]
    if (!seed) continue
    const diff: PriceOverride = {}
    for (const f of EDITABLE) if (item[f] !== seed[f]) diff[f] = item[f]
    if (Object.keys(diff).length > 0) out[key] = diff
  }
  return out
}
const LANG_KEY = 'ahc_lang_v1'
const HOUSE_KEY = 'ahc_house_v5'
// v4 stored vatIncluded: true from the old default. v5 made VAT opt-in, so v4
// inputs are carried over without their VAT flag.
const LEGACY_HOUSE_KEY = 'ahc_house_v4'
const THEME_KEY = 'ahc_theme_v1'
const SCEN_KEY = 'ahc_scenarios_v2'
// v1 scenarios were saved while VAT defaulted to on; like the v4 house they
// are carried over without their VAT flag.
const LEGACY_SCEN_KEY = 'ahc_scenarios_v1'

// Saves made before a field existed lack it, so every saved house is merged
// onto the defaults (a missing percentage priced a whole scenario as NaN).
function withDefaults(saved: Partial<HouseParams>): HouseParams {
  return { ...DEFAULT_HOUSE, ...saved, eng: { ...(saved.eng ?? {}) } }
}

function loadScenarios(): Scenario[] {
  try {
    let raw = localStorage.getItem(SCEN_KEY)
    const legacy = raw == null
    if (legacy) raw = localStorage.getItem(LEGACY_SCEN_KEY)
    if (!raw) return []
    return (JSON.parse(raw) as Scenario[]).map((s) => {
      const saved: Partial<HouseParams> = { ...s.house }
      if (legacy) delete saved.vatIncluded
      return { ...s, house: withDefaults(saved) }
    })
  } catch {
    return []
  }
}

function persistScenarios(list: Scenario[]) {
  try {
    localStorage.setItem(SCEN_KEY, JSON.stringify(list))
  } catch {
    /* ignore */
  }
}

export type Theme = 'dark' | 'light'

function loadTheme(): Theme {
  try {
    return localStorage.getItem(THEME_KEY) === 'dark' ? 'dark' : 'light'
  } catch {
    return 'light'
  }
}

function loadHouse(): HouseParams {
  try {
    let raw = localStorage.getItem(HOUSE_KEY)
    const legacy = raw == null
    if (legacy) raw = localStorage.getItem(LEGACY_HOUSE_KEY)
    if (!raw) return { ...DEFAULT_HOUSE }
    const saved = JSON.parse(raw) as Partial<HouseParams>
    if (legacy) delete saved.vatIncluded
    // merge onto defaults so new fields always exist
    return withDefaults(saved)
  } catch {
    return { ...DEFAULT_HOUSE }
  }
}

function loadPrices(): Catalog {
  const merged = structuredClone(SEED_PRICES)
  try {
    const raw = localStorage.getItem(PRICE_KEY)
    if (raw) {
      const saved = JSON.parse(raw) as Record<string, PriceOverride>
      for (const [key, o] of Object.entries(saved)) {
        if (!merged[key]) continue
        for (const f of EDITABLE) if (typeof o[f] === 'number') merged[key] = { ...merged[key], [f]: o[f] }
      }
      return merged
    }
    const legacy = localStorage.getItem(LEGACY_PRICE_KEY)
    if (!legacy) return merged
    // v1: keep only the fields the visitor actually changed
    const old = JSON.parse(legacy) as Partial<Catalog>
    for (const key of Object.keys(merged)) {
      const row = old[key]
      if (!row) continue
      const cur = merged[key]
      const before = SEED_BEFORE_2026_09_26[key] ?? [cur.materialMin, cur.materialTypical, cur.materialMax, cur.labor]
      EDITABLE.forEach((f, n) => {
        const v = row[f]
        if (typeof v === 'number' && v !== before[n]) merged[key] = { ...merged[key], [f]: v }
      })
    }
    return merged
  } catch {
    return structuredClone(SEED_PRICES)
  }
}

function loadLang(): Lang {
  try {
    const v = localStorage.getItem(LANG_KEY)
    if (v === 'ru' || v === 'en') return v
    return 'hy' // Armenian is the default
  } catch {
    return 'hy'
  }
}

interface ProjectState {
  house: HouseParams
  prices: Catalog
  lang: Lang
  theme: Theme
  setTheme: (t: Theme) => void
  priceMode: PriceMode
  amdPerUsd: number
  rateSource: 'default' | 'cba' | 'manual' // откуда взят курс — показывается в редакторе цен
  rateDate: string | null // дата, на которую ЦБ установил курс
  rateStale: boolean // курс давно не обновлялся
  cbaUsd: number | null // last central-bank rate, kept so a reset can return to it
  applyCbaRates: (r: Rates) => void
  tab: string
  setTab: (t: string) => void
  editRooms: EditRoom[] | null // null => auto layout from params
  setEditRooms: (rooms: EditRoom[] | null) => void
  updateRoom: (id: string, patch: Partial<EditRoom>) => void
  addRoom: () => void
  removeRoom: (id: string) => void
  setHouse: (patch: Partial<HouseParams>) => void
  setPriceItem: (key: string, patch: Partial<PriceItem>) => void
  resetPrices: () => void
  resetAll: () => void
  scenarios: Scenario[]
  saveScenario: (name: string) => void
  loadScenario: (id: string) => void
  deleteScenario: (id: string) => void
  setLang: (l: Lang) => void
  setPriceMode: (m: PriceMode) => void
  setAmdPerUsd: (n: number) => void
}

export const useProject = create<ProjectState>((set, get) => ({
  house: loadHouse(),
  prices: loadPrices(),
  lang: loadLang(),
  theme: loadTheme(),
  scenarios: loadScenarios(),
  priceMode: 'typical',
  amdPerUsd: AMD_PER_USD_DEFAULT,
  rateSource: 'default',
  rateDate: null,
  rateStale: false,
  cbaUsd: null,
  tab: 'calc',
  setTab: (tab) => set({ tab }),
  editRooms: null,

  setEditRooms: (editRooms) => set({ editRooms }),
  updateRoom: (id, patch) =>
    set({ editRooms: (get().editRooms ?? []).map((r) => (r.id === id ? { ...r, ...patch } : r)) }),
  addRoom: () =>
    set({
      editRooms: [
        ...(get().editRooms ?? []),
        { id: newRoomId(), label: 'Комната', type: 'bedroom', weight: 1.2 },
      ],
    }),
  removeRoom: (id) => set({ editRooms: (get().editRooms ?? []).filter((r) => r.id !== id) }),

  setHouse: (patch) => {
    const house = { ...get().house, ...patch }
    set({ house })
    try {
      localStorage.setItem(HOUSE_KEY, JSON.stringify(house))
    } catch {
      /* storage may be unavailable */
    }
  },

  setPriceItem: (key, patch) => {
    const prices = { ...get().prices, [key]: { ...get().prices[key], ...patch } }
    set({ prices })
    try {
      localStorage.setItem(PRICE_KEY, JSON.stringify(priceOverrides(prices)))
    } catch {
      /* storage may be unavailable */
    }
  },

  resetPrices: () => {
    const prices = structuredClone(SEED_PRICES)
    set({ prices })
    try {
      localStorage.removeItem(PRICE_KEY)
      localStorage.removeItem(LEGACY_PRICE_KEY)
    } catch {
      /* ignore */
    }
  },

  // Заводской сброс: параметры дома, цены и режимы. Язык и тема (настройки вида) не трогаем.
  resetAll: () => {
    const house = { ...DEFAULT_HOUSE, eng: {} }
    // back to the central-bank rate when one was loaded, not to the built-in fallback
    const cba = get().cbaUsd
    set({
      house,
      prices: structuredClone(SEED_PRICES),
      priceMode: 'typical',
      amdPerUsd: cba ?? AMD_PER_USD_DEFAULT,
      rateSource: cba != null ? 'cba' : 'default',
      editRooms: null,
    })
    try {
      localStorage.setItem(HOUSE_KEY, JSON.stringify(house))
      localStorage.removeItem(PRICE_KEY)
      localStorage.removeItem(LEGACY_PRICE_KEY)
    } catch {
      /* ignore */
    }
  },

  saveScenario: (name) => {
    const trimmed = name.trim() || 'Вариант'
    const house = { ...get().house, eng: { ...get().house.eng } }
    const id = 's' + get().scenarios.length + '_' + trimmed
    const list = [...get().scenarios.filter((s) => s.name !== trimmed), { id, name: trimmed, house }]
    set({ scenarios: list })
    persistScenarios(list)
  },
  loadScenario: (id) => {
    const s = get().scenarios.find((x) => x.id === id)
    if (!s) return
    const house = { ...s.house, eng: { ...s.house.eng } }
    set({ house })
    try {
      localStorage.setItem(HOUSE_KEY, JSON.stringify(house))
    } catch {
      /* ignore */
    }
  },
  deleteScenario: (id) => {
    const list = get().scenarios.filter((s) => s.id !== id)
    set({ scenarios: list })
    persistScenarios(list)
  },

  setLang: (lang) => {
    set({ lang })
    try {
      localStorage.setItem(LANG_KEY, lang)
    } catch {
      /* ignore */
    }
  },

  setTheme: (theme) => {
    set({ theme })
    try {
      localStorage.setItem(THEME_KEY, theme)
    } catch {
      /* ignore */
    }
  },

  setPriceMode: (priceMode) => set({ priceMode }),
  // keep the last valid rate: ignore empty / 0 / negative input.
  // Ручная правка помечает курс как пользовательский, чтобы пришедший позже
  // ответ ЦБ не затёр введённое значение.
  setAmdPerUsd: (n) => set((s) => (n > 0 ? { amdPerUsd: n, rateSource: 'manual' } : s)),

  // Курс от ЦБ применяем только если пользователь не задал свой.
  applyCbaRates: (r) =>
    set((s) =>
      s.rateSource === 'manual'
        ? { rateDate: r.currentDate, rateStale: isRateStale(r.currentDate), cbaUsd: r.rates.USD }
        : {
            amdPerUsd: r.rates.USD,
            rateSource: 'cba',
            rateDate: r.currentDate,
            rateStale: isRateStale(r.currentDate),
            cbaUsd: r.rates.USD,
          },
    ),
}))
