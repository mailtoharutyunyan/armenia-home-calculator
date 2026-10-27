import type { SectionId } from '../engine/quantities'

export interface Stage {
  ru: string
  hy: string
  en: string
  minWeeks: number
  maxWeeks: number
  phase: 'act' | 'turnkey'
  sections: SectionId[] // разделы сметы, входящие в этап (для расчёта денег)
}

// Duration ranges in weeks (for a mid-size house ~200 m2). Scaled by area.
export const STAGES: Stage[] = [
  { ru: 'Документы и разрешение', hy: 'Փաստաթղթեր և թույլտվություն', en: 'Documents and permit', minWeeks: 4, maxWeeks: 12, phase: 'act', sections: ['permit'] },
  { ru: 'Земляные работы и фундамент', hy: 'Հողային աշխատանքներ և հիմք', en: 'Earthworks and foundation', minWeeks: 2, maxWeeks: 4, phase: 'act', sections: ['earthworks', 'foundation'] },
  { ru: 'Каркас / несущие стены', hy: 'Կմախք / կրող պատեր', en: 'Frame / load-bearing walls', minWeeks: 3, maxWeeks: 6, phase: 'act', sections: ['walls', 'frame'] },
  { ru: 'Перекрытия и лестницы', hy: 'Ծածկեր և աստիճաններ', en: 'Floor slabs and stairs', minWeeks: 2, maxWeeks: 4, phase: 'act', sections: ['floors', 'stair'] },
  { ru: 'Кровля', hy: 'Տանիք', en: 'Roof', minWeeks: 1, maxWeeks: 3, phase: 'act', sections: ['roof'] },
  // openings and facade are turnkey lines in the estimate, not part of the shell
  { ru: 'Окна, двери, фасад', hy: 'Պատուհաններ, դռներ, ֆասադ', en: 'Windows, doors, facade', minWeeks: 2, maxWeeks: 4, phase: 'turnkey', sections: ['openings', 'facade'] },
  { ru: 'Инженерные сети', hy: 'Ինժեներական ցանցեր', en: 'Building services', minWeeks: 3, maxWeeks: 5, phase: 'turnkey', sections: ['engineering', 'utilities'] },
  { ru: 'Отделка «под ключ»', hy: 'Հարդարում «բանալի հանձնում»', en: 'Turnkey finishing', minWeeks: 6, maxWeeks: 12, phase: 'turnkey', sections: ['finishing', 'partitions'] },
  { ru: 'Доп. системы и благоустройство', hy: 'Լրաց. համակարգեր և բարեկարգում', en: 'Extra systems and landscaping', minWeeks: 2, maxWeeks: 6, phase: 'turnkey', sections: ['options', 'site'] },
]

// Каждый раздел сметы должен попасть ровно в один этап, иначе стоимость
// «теряется» в графике работ и сумма этапов расходится с итогом сметы.
export const STAGE_SECTIONS: SectionId[] = STAGES.flatMap((s) => s.sections)

// Scale factor by total floor area (baseline 200 m2, clamped 0.6..2.0).
export function areaScale(totalArea: number): number {
  const s = totalArea / 200
  return Math.max(0.6, Math.min(2.0, s))
}

export function stageWeeks(stage: Stage, totalArea: number): { min: number; max: number } {
  // Этап документов не зависит от площади. Определяем его по составу разделов,
  // а не по подписи — подпись переводится и меняется, состав нет.
  const scale = stage.sections.includes('permit') ? 1 : areaScale(totalArea)
  return {
    min: Math.round(stage.minWeeks * scale),
    max: Math.round(stage.maxWeeks * scale),
  }
}
