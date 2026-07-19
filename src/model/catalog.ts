import type { PriceMode } from './house'

// A single price-list entry. Prices are stored as a min/typical/max band
// aggregated from several suppliers — no single source is treated as truth.
export interface PriceItem {
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
