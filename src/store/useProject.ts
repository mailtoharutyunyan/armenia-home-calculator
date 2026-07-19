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

function loadPrices(): Catalog {
  try {
    const raw = localStorage.getItem(PRICE_KEY)
    if (!raw) return structuredClone(SEED_PRICES)
    const parsed = JSON.parse(raw) as Catalog
    // merge onto seed so new seed keys always exist
    return { ...structuredClone(SEED_PRICES), ...parsed }
  } catch {
    return structuredClone(SEED_PRICES)
  }
}

function loadLang(): Lang {
  try {
    const v = localStorage.getItem(LANG_KEY)
    return v === 'hy' ? 'hy' : 'ru'
  } catch {
    return 'ru'
  }
}

interface ProjectState {
  house: HouseParams
  prices: Catalog
  lang: Lang
  priceMode: PriceMode
  amdPerUsd: number
  editRooms: EditRoom[] | null // null => auto layout from params
  setEditRooms: (rooms: EditRoom[] | null) => void
  updateRoom: (id: string, patch: Partial<EditRoom>) => void
  addRoom: () => void
  removeRoom: (id: string) => void
  setHouse: (patch: Partial<HouseParams>) => void
  setPriceItem: (key: string, patch: Partial<PriceItem>) => void
  resetPrices: () => void
  setLang: (l: Lang) => void
  setPriceMode: (m: PriceMode) => void
  setAmdPerUsd: (n: number) => void
}

export const useProject = create<ProjectState>((set, get) => ({
  house: DEFAULT_HOUSE,
  prices: loadPrices(),
  lang: loadLang(),
  priceMode: 'typical',
  amdPerUsd: AMD_PER_USD_DEFAULT,
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

  setHouse: (patch) => set({ house: { ...get().house, ...patch } }),

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

  setLang: (lang) => {
    set({ lang })
    try {
      localStorage.setItem(LANG_KEY, lang)
    } catch {
      /* ignore */
    }
  },

  setPriceMode: (priceMode) => set({ priceMode }),
  setAmdPerUsd: (amdPerUsd) => set({ amdPerUsd: amdPerUsd || 1 }),
}))
