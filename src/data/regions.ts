import type { RegionKey } from '../model/house'

export interface RegionInfo {
  key: RegionKey
  nameRu: string
  nameHy: string
  seismic: 8 | 9 // МСК-64 intensity (ՀՀՇՆ II-6.02 zone)
  frostDepth: number // m, нормативная глубина промерзания
  deliverySurcharge: number // extra logistics multiplier on materials
}

export const REGIONS: Record<RegionKey, RegionInfo> = {
  yerevan: {
    key: 'yerevan',
    nameRu: 'Ереван',
    nameHy: 'Երևան',
    seismic: 8,
    frostDepth: 0.8,
    deliverySurcharge: 0.05,
  },
  ararat_valley: {
    key: 'ararat_valley',
    nameRu: 'Араратская долина',
    nameHy: 'Արարատյան դաշտ',
    seismic: 8,
    frostDepth: 0.8,
    deliverySurcharge: 0.06,
  },
  kotayk: {
    key: 'kotayk',
    nameRu: 'Котайк',
    nameHy: 'Կոտայք',
    seismic: 8,
    frostDepth: 1.4,
    deliverySurcharge: 0.06,
  },
  gyumri: {
    key: 'gyumri',
    nameRu: 'Гюмри',
    nameHy: 'Գյումրի',
    seismic: 9,
    frostDepth: 1.5,
    deliverySurcharge: 0.08,
  },
  vanadzor: {
    key: 'vanadzor',
    nameRu: 'Ванадзор',
    nameHy: 'Վանաձոր',
    seismic: 9,
    frostDepth: 1.2,
    deliverySurcharge: 0.08,
  },
  sevan: {
    key: 'sevan',
    nameRu: 'Севан',
    nameHy: 'Սևան',
    seismic: 9,
    frostDepth: 1.8,
    deliverySurcharge: 0.1,
  },
  aparan: {
    key: 'aparan',
    nameRu: 'Апаран',
    nameHy: 'Ապարան',
    seismic: 9,
    frostDepth: 1.8,
    deliverySurcharge: 0.1,
  },
  syunik: {
    key: 'syunik',
    nameRu: 'Сюник',
    nameHy: 'Սյունիք',
    seismic: 8,
    frostDepth: 1.4,
    deliverySurcharge: 0.12,
  },
  other: {
    key: 'other',
    nameRu: 'Другой регион',
    nameHy: 'Այլ մարզ',
    seismic: 9,
    frostDepth: 1.2,
    deliverySurcharge: 0.08,
  },
}
