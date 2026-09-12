// Курс ЦБ РА.
//
// Файл public/rates.json обновляет GitHub Actions (.github/workflows/rates.yml)
// по будням. Страница читает его со своего же домена: api.cba.am не отдаёт
// Access-Control-Allow-Origin, поэтому дёрнуть ЦБ напрямую из браузера нельзя,
// а сторонний CORS-прокси ради одного числа — лишняя зависимость и лишний
// посредник в трафике.
//
// Если файла нет или он битый, приложение работает на зашитом курсе — смета не
// должна падать из-за недоступного курса.

export interface Rates {
  base: 'AMD'
  currentDate: string | null // дата, на которую ЦБ установил курс
  fetchedAt: string
  source: string
  rates: Record<string, number>
}

export const CBA_SITE = 'https://www.cba.am/hy/SitePages/ExchangeArchive.aspx'

// Считаем курс устаревшим после 10 дней: длинные праздники в РА бывают,
// но не настолько, а молчаливый пересчёт по прошлогоднему курсу — хуже ошибки.
const STALE_AFTER_DAYS = 10

export function isRateStale(currentDate: string | null, now = new Date()): boolean {
  if (!currentDate) return true
  const d = new Date(`${currentDate}T00:00:00Z`)
  if (Number.isNaN(d.getTime())) return true
  return (now.getTime() - d.getTime()) / 86_400_000 > STALE_AFTER_DAYS
}

// Валидация: подставлять в смету непроверенное число нельзя — ошибка курса
// тихо перекосит все суммы в долларах.
export function parseRates(raw: unknown): Rates | null {
  if (typeof raw !== 'object' || raw === null) return null
  const r = raw as Partial<Rates>
  const usd = r.rates?.USD
  if (typeof usd !== 'number' || !Number.isFinite(usd) || usd <= 0) return null
  if (usd < 200 || usd > 900) return null // явно не курс драма к доллару
  return {
    base: 'AMD',
    currentDate: typeof r.currentDate === 'string' ? r.currentDate : null,
    fetchedAt: typeof r.fetchedAt === 'string' ? r.fetchedAt : '',
    source: typeof r.source === 'string' ? r.source : '',
    rates: r.rates as Record<string, number>,
  }
}

export async function loadRates(signal?: AbortSignal): Promise<Rates | null> {
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}rates.json`, { signal, cache: 'no-cache' })
    if (!res.ok) return null
    return parseRates(await res.json())
  } catch {
    return null // офлайн или битый JSON — работаем на зашитом курсе
  }
}
