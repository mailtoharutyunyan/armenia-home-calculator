export interface NormRef {
  code: string
  topicRu: string
  topicHy: string
  requirementRu: string
  requirementHy: string
  level: 'error' | 'warning' | 'info'
  source: string
}

export const NORMS_REFERENCE: NormRef[] = [
  {
    code: 'ՀՀՇՆ 30-01-2014',
    topicRu: 'Градостроительство',
    topicHy: 'Քաղաքաշինություն',
    requirementRu: 'Отступ от границы участка ≥ 3 м; застройка участка ≤ 40% (по зоне).',
    requirementHy: 'Հեռավորությունը սահմանից ≥ 3 մ; կառուցապատում ≤ 40%։',
    level: 'info',
    source: 'https://www.arlis.am',
  },
  {
    code: 'ՀՀՇՆ 31-01-2014',
    topicRu: 'Жилые здания',
    topicHy: 'Բնակելի շենքեր',
    requirementRu:
      'Упрощённая процедура ≤ 2 надземных + 1 подземный этаж и ≤ 300 м². Высота комнаты ≥ 2.7 м, коридор ≥ 2.1 м, комната ≥ 8 м², освещение ≥ 1/8 площади пола.',
    requirementHy:
      'Պարզեցված ընթացակարգ ≤ 2+1 հարկ և ≤ 300 մ²։ Սենյակի բարձրություն ≥ 2.7 մ, միջանցք ≥ 2.1 մ, սենյակ ≥ 8 մ²։',
    level: 'warning',
    source: 'https://www.arlis.am',
  },
  {
    code: 'ՀՀՇՆ II-6.02',
    topicRu: 'Сейсмостойкое строительство',
    topicHy: 'Սեյսմակայուն շինարարություն',
    requirementRu:
      'Вся РА — зона 8–9 баллов. Марка бетона несущих ≥ B25; вертикальные сердечники + армопояс для кладки; ограничение этажности несущей кладки; соотношение сторон ≤ 2. Несущий газоблок не допускается.',
    requirementHy:
      'Ամբողջ ՀՀ-ն 8–9 բալ գոտի է։ Կրող բետոն ≥ B25; ուղղահայաց միջուկներ + գոտի; հարկայնության սահմանափակում; կրող գազաբլոկը արգելված է։',
    level: 'error',
    source: 'https://www.arlis.am',
  },
  {
    code: 'ՀՀՇՆ 31-02',
    topicRu: 'Индивидуальные жилые дома',
    topicHy: 'Անհատական բնակելի տներ',
    requirementRu: 'Отдельные нормы для ИЖС (ожидается редакция 2026).',
    requirementHy: 'Առանձին նորմեր անհատական տների համար (2026 խմբագրություն)։',
    level: 'info',
    source: 'https://www.arlis.am',
  },
]
