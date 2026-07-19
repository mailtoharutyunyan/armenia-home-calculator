import type { Currency } from '../model/house'

export function money(amd: number, currency: Currency, amdPerUsd: number): string {
  const value = currency === 'USD' ? amd / amdPerUsd : amd
  const fractionDigits = currency === 'USD' ? 0 : 0
  const formatted = new Intl.NumberFormat('ru-RU', {
    maximumFractionDigits: fractionDigits,
  }).format(Math.round(value))
  return `${formatted} ${currency === 'USD' ? '$' : '֏'}`
}

export function num(n: number, digits = 1): string {
  return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: digits }).format(n)
}
