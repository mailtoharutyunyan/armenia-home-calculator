import type { SectionId } from '../engine/quantities'

export interface Stage {
  ru: string
  hy: string
  minWeeks: number
  maxWeeks: number
  phase: 'act' | 'turnkey'
  sections: SectionId[] // разделы сметы, входящие в этап (для расчёта денег)
}

// Duration ranges in weeks (for a mid-size house ~200 m2). Scaled by area.
export const STAGES: Stage[] = [
  { ru: 'Документы и разрешение', hy: 'Փաստաթղթեր և թույլտվություն', minWeeks: 4, maxWeeks: 12, phase: 'act', sections: ['permit'] },
  { ru: 'Земляные работы и фундамент', hy: 'Հողային աշխատանքներ և հիմք', minWeeks: 2, maxWeeks: 4, phase: 'act', sections: ['earthworks', 'foundation'] },
  { ru: 'Каркас / несущие стены', hy: 'Կմախք / կրող պատեր', minWeeks: 3, maxWeeks: 6, phase: 'act', sections: ['walls', 'frame'] },
  { ru: 'Перекрытия и лестницы', hy: 'Ծածկեր և աստիճաններ', minWeeks: 2, maxWeeks: 4, phase: 'act', sections: ['floors', 'stair'] },
  { ru: 'Кровля', hy: 'Տանիք', minWeeks: 1, maxWeeks: 3, phase: 'act', sections: ['roof'] },
  { ru: 'Окна, двери, фасад', hy: 'Պատուհաններ, դռներ, ֆասադ', minWeeks: 2, maxWeeks: 4, phase: 'act', sections: ['openings', 'facade'] },
  { ru: 'Инженерные сети', hy: 'Ինժեներական ցանցեր', minWeeks: 3, maxWeeks: 5, phase: 'turnkey', sections: ['engineering'] },
  { ru: 'Отделка «под ключ»', hy: 'Հարդարում «բանալի հանձնում»', minWeeks: 6, maxWeeks: 12, phase: 'turnkey', sections: ['finishing', 'partitions'] },
]

// Scale factor by total floor area (baseline 200 m2, clamped 0.6..2.0).
export function areaScale(totalArea: number): number {
  const s = totalArea / 200
  return Math.max(0.6, Math.min(2.0, s))
}

export function stageWeeks(stage: Stage, totalArea: number): { min: number; max: number } {
  // permit/document stage doesn't scale with area
  const scale = stage.ru.startsWith('Документы') ? 1 : areaScale(totalArea)
  return {
    min: Math.round(stage.minWeeks * scale),
    max: Math.round(stage.maxWeeks * scale),
  }
}
