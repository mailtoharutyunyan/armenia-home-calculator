import { create } from 'zustand'
import type { Catalog, PriceItem } from '../model/catalog'
import type { HouseParams, PriceMode } from '../model/house'
import { DEFAULT_HOUSE } from '../model/house'
import { SEED_PRICES, AMD_PER_USD_DEFAULT } from '../data/prices'
import type { Lang } from '../i18n'
import type { RoomType } from '../engine/floorplan'

export interface EditRoom {
  id: string
  label: string
  type: RoomType
  weight: number
}

let roomCounter = 0
export const newRoomId = () => `r${++roomCounter}`

const PRICE_KEY = 'ahc_prices_v1'
const LANG_KEY = 'ahc_lang_v1'
const HOUSE_KEY = 'ahc_house_v4'
const THEME_KEY = 'ahc_theme_v1'

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
    const raw = localStorage.getItem(HOUSE_KEY)
    if (!raw) return { ...DEFAULT_HOUSE }
    const saved = JSON.parse(raw) as Partial<HouseParams>
    // merge onto defaults so new fields always exist
    return { ...DEFAULT_HOUSE, ...saved, eng: { ...(saved.eng ?? {}) } }
  } catch {
    return { ...DEFAULT_HOUSE }
  }
}

function loadPrices(): Catalog {
  try {
    const raw = localStorage.getItem(PRICE_KEY)
    if (!raw) return structuredClone(SEED_PRICES)
    const parsed = JSON.parse(raw) as Partial<Catalog>
    // per-field merge onto seed so new seed fields/keys always exist (no NaN from old schema)
    const merged = structuredClone(SEED_PRICES)
    for (const key of Object.keys(merged)) {
      const saved = parsed[key]
      if (saved) merged[key] = { ...merged[key], ...saved }
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
  setLang: (l: Lang) => void
  setPriceMode: (m: PriceMode) => void
  setAmdPerUsd: (n: number) => void
}

export const useProject = create<ProjectState>((set, get) => ({
  house: loadHouse(),
  prices: loadPrices(),
  lang: loadLang(),
  theme: loadTheme(),
  priceMode: 'typical',
  amdPerUsd: AMD_PER_USD_DEFAULT,
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
      localStorage.setItem(PRICE_KEY, JSON.stringify(prices))
    } catch {
      /* storage may be unavailable */
    }
  },

  resetPrices: () => {
    const prices = structuredClone(SEED_PRICES)
    set({ prices })
    try {
      localStorage.removeItem(PRICE_KEY)
    } catch {
      /* ignore */
    }
  },

  // Заводской сброс: параметры дома, цены и режимы. Язык и тема (настройки вида) не трогаем.
  resetAll: () => {
    const house = { ...DEFAULT_HOUSE, eng: {} }
    set({ house, prices: structuredClone(SEED_PRICES), priceMode: 'typical', amdPerUsd: AMD_PER_USD_DEFAULT, editRooms: null })
    try {
      localStorage.setItem(HOUSE_KEY, JSON.stringify(house))
      localStorage.removeItem(PRICE_KEY)
    } catch {
      /* ignore */
    }
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
  // keep the last valid rate: ignore empty / 0 / negative input
  setAmdPerUsd: (n) => set((s) => ({ amdPerUsd: n > 0 ? n : s.amdPerUsd })),
}))
