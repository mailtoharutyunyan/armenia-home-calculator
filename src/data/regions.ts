import type { RegionKey } from '../model/house'

export interface RegionInfo {
  key: RegionKey
  nameRu: string
  nameHy: string
  // Балльность МСК-64 по картам ՀՀՇՆ II-2.02-94 / II-6.02-2006. ВНИМАНИЕ:
  // действующие ՀՀՇՆ 20-04-2020 зонируют по ускорению грунта (A = 0.3g / 0.4g),
  // а не по баллам. Значения ниже — приближение, требует сверки с картой 20-04-2020.
  seismic: 8 | 9
  frostDepth: number // m, нормативная глубина промерзания
  deliverySurcharge: number // extra logistics multiplier on materials
  // Возврат подоходного налога по ипотеке (строительство ИЖС — квалифицирующая
  // цель при наличии разрешения на строительство). Программа сворачивается
  // географически: Ереван — с 01.01.2025; Арагацотн/Арарат/Армавир/Котайк —
  // с 01.01.2027; остальные марзы — с 01.01.2029 (кроме приграничных общин).
  // null = уже не действует. Дата = момент прекращения для этого региона.
  taxRefundUntil: string | null
}

// Предельная сумма возврата за квартал для договоров с 01.01.2025 (было 1.5 млн).
export const TAX_REFUND_QUARTER_CAP = 750000 // ֏

export const REGIONS: Record<RegionKey, RegionInfo> = {
  yerevan: {
    key: 'yerevan',
    nameRu: 'Ереван',
    nameHy: 'Երևան',
    seismic: 8,
    frostDepth: 0.8,
    deliverySurcharge: 0,
    taxRefundUntil: null,
  },
  ararat_valley: {
    key: 'ararat_valley',
    nameRu: 'Араратская долина',
    nameHy: 'Արարատյան դաշտ',
    seismic: 8,
    frostDepth: 0.8,
    deliverySurcharge: 0,
    taxRefundUntil: '2027-01-01',
  },
  kotayk: {
    key: 'kotayk',
    nameRu: 'Котайк',
    nameHy: 'Կոտայք',
    seismic: 8,
    frostDepth: 1.4,
    deliverySurcharge: 0,
    taxRefundUntil: '2027-01-01',
  },
  gyumri: {
    key: 'gyumri',
    nameRu: 'Гюмри',
    nameHy: 'Գյումրի',
    seismic: 9,
    frostDepth: 1.5,
    deliverySurcharge: 0,
    taxRefundUntil: '2029-01-01',
  },
  vanadzor: {
    key: 'vanadzor',
    nameRu: 'Ванадзор',
    nameHy: 'Վանաձոր',
    seismic: 9,
    frostDepth: 1.2,
    deliverySurcharge: 0,
    taxRefundUntil: '2029-01-01',
  },
  sevan: {
    key: 'sevan',
    nameRu: 'Севан',
    nameHy: 'Սևան',
    seismic: 9,
    frostDepth: 1.8,
    deliverySurcharge: 0,
    taxRefundUntil: '2029-01-01',
  },
  aparan: {
    key: 'aparan',
    nameRu: 'Апаран',
    nameHy: 'Ապարան',
    seismic: 9,
    frostDepth: 1.8,
    deliverySurcharge: 0,
    taxRefundUntil: '2027-01-01',
  },
  syunik: {
    key: 'syunik',
    nameRu: 'Сюник',
    nameHy: 'Սյունիք',
    seismic: 8,
    frostDepth: 1.4,
    deliverySurcharge: 0,
    taxRefundUntil: '2029-01-01',
  },
  other: {
    key: 'other',
    nameRu: 'Другой регион',
    nameHy: 'Այլ մարզ',
    seismic: 9,
    frostDepth: 1.2,
    deliverySurcharge: 0,
    taxRefundUntil: '2029-01-01',
  },
}
