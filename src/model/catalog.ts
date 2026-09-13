import type { PriceMode } from './house'

// Откуда взята цена. Нужно, чтобы интерфейс не выдавал прикидку за котировку:
//   quoted     — сверено с прайсом поставщика, есть verifiedAt и рабочая ссылка
//   unverified — ориентир правдоподобного порядка, с прайсом НЕ сверялось
//   estimate   — оценка составителя (подключения, благоустройство и т.п.)
//   official   — госпошлина или тариф, величина задана нормативно
export type Provenance = 'quoted' | 'unverified' | 'estimate' | 'official'

// A single price-list entry.
//
// ВАЖНО про вилку min/max: она НЕ является агрегатом котировок разных
// поставщиков. Для provenance !== 'quoted' она выводится арифметически из
// typical и показывает чувствительность результата, а не рыночный разброс.
export interface PriceItem {
  provenance: Provenance
  verifiedAt?: string // дд.мм.гггг — когда человек сверил цену с источником
  sourceUrls?: string[] // только рабочие адреса; битый источник хуже, чем никакого
  key: string
  labelRu: string
  labelHy: string
  labelEn?: string // English label; falls back to Russian when absent
  unit: string // 'м³', 'т', 'шт', 'м²', 'кг', 'компл', 'м'
  materialMin: number // AMD, without VAT
  materialTypical: number
  materialMax: number
  labor: number // AMD per unit, 0 if not applicable
  sources: string[]
  note?: string
}

export type Catalog = Record<string, PriceItem>

export function materialPrice(item: PriceItem, mode: PriceMode): number {
  switch (mode) {
    case 'min':
      return item.materialMin
    case 'max':
      return item.materialMax
    default:
      return item.materialTypical
  }
}

// Pick a label for the active language, falling back RU → HY as needed.
export function labelFor(l: { labelRu: string; labelHy: string; labelEn?: string }, lang: string): string {
  if (lang === 'hy') return l.labelHy
  if (lang === 'en') return l.labelEn ?? l.labelRu
  return l.labelRu
}
