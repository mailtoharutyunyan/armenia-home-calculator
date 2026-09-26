import type { HouseParams } from '../model/house'
import { COEFF as C } from '../data/coefficients'
import { REGIONS } from '../data/regions'
import type { Quantities } from './quantities'
import type { Room } from './floorplan'
import { buildFloorPlan } from './floorplan'

export type NormLevel = 'error' | 'warning' | 'info'

export interface Warning {
  level: NormLevel
  code: string // ՀՀՇՆ reference or 'input'
  ru: string
  hy: string
  en?: string // при отсутствии интерфейс показывает русский
}

// Текст предупреждения на языке интерфейса. Английский может отсутствовать —
// тогда откатываемся на русский, но это видно в проверке полноты переводов.
export function warningText(w: Warning, lang: string): string {
  return lang === 'hy' ? w.hy : lang === 'en' ? w.en ?? w.ru : w.ru
}

// class from catalog key: concrete_b25 -> 25, concrete_b225 -> 22.5
export function gradeFromKey(key: string): number {
  const m = key.match(/b(\d+)/i)
  if (!m) return 0
  const raw = m[1]
  return raw.length === 3 ? Number(raw) / 10 : Number(raw)
}

// Критерии упрощённого порядка N 4.1 — реш. Правительства РА N 1969-Ն от
// 25.12.2025 (в силе с 01.06.2026), вносит подпункт 4.1 в реш. N 596-Ն от
// 19.03.2015. Возвращает причины несоответствия; пустой массив = порядок применим.
// Единственный источник правды: и движок норм, и UI зовут эту функцию.
export function simplified41Reasons(p: HouseParams, netFloorArea: number): string[] {
  const n = C.norms
  const r: string[] = []
  if (netFloorArea > n.simplifiedMaxArea)
    r.push(`площадь ${Math.round(netFloorArea)} > ${n.simplifiedMaxArea} м²`)
  if (p.floors > n.simplifiedMaxFloors) r.push(`надземных этажей > ${n.simplifiedMaxFloors}`)
  if (p.plotArea < n.simplifiedMinPlot) r.push(`участок ${p.plotArea} < ${n.simplifiedMinPlot} м²`)
  if (p.auxBuildingArea > n.simplifiedMaxAuxArea)
    r.push(`вспом. постройки ${p.auxBuildingArea} > ${n.simplifiedMaxAuxArea} м²`)
  return r
}

export function checkNorms(p: HouseParams, q: Quantities): Warning[] {
  const w: Warning[] = []
  const region = REGIONS[p.region]
  const n = C.norms
  const isMasonry = p.system === 'tuff' || p.system === 'aerated' || p.system === 'brick'
  // the wall the estimate uses: the engineer's external wall wins over the form
  const wallT = p.eng.extWall != null && p.eng.extWall > 0 ? p.eng.extWall / 100 : p.wallThickness

  // ---- input validation ----
  if (p.floors < 1) {
    w.push({ level: 'error', code: 'input', ru: 'Число этажей должно быть ≥ 1.', hy: 'Հարկերի թիվը պետք է լինի ≥ 1։', en: 'Number of floors must be ≥ 1.' })
  }
  if (p.length <= 0 || p.width <= 0) {
    w.push({ level: 'error', code: 'input', ru: 'Габариты дома должны быть положительными.', hy: 'Տան չափերը պետք է լինեն դրական։', en: 'House dimensions must be positive.' })
  }

  // ---- seismic (ՀՀՇՆ 20.04-2020) — все РА 8–9 баллов ----
  if (p.system === 'aerated') {
    w.push({
      level: 'warning',
      code: 'ГОСТ 31360-2024 / ՀՀՇՆ 20.04-2020',
      ru: 'Несущий газоблок допустим (ГОСТ 31360-2024), но в сейсмозоне РА требует поверочного расчёта. Для частного дома обычно безопаснее ж/б каркас с газоблочным заполнением + армопояса/перемычки.',
      hy: 'Կրող գազաբլոկը թույլատրելի է (ГОСТ 31360-2024), սակայն ՀՀ սեյսմիկ գոտում պահանջում է հաշվարկ։ Մասնավոր տան համար սովորաբար ավելի ապահով է ե/բ կմախք գազաբլոկե լցվածքով + գոտիներ/հեծաններ։',
      en: 'Load-bearing aerated block is permitted (GOST 31360-2024) but requires a seismic check in Armenia. For a private house an RC frame with aerated infill plus ring beams and lintels is usually safer.',
    })
  }
  if (p.system === 'monolith') {
    w.push({
      level: 'info',
      code: 'ՀՀՇՆ 20.04-2020',
      ru: 'Полный монолит (несущие ж/б стены + перекрытия) — максимальная сейсмостойкость для зоны РА; ограничения по этажности кладки не действуют.',
      hy: 'Ամբողջական մոնոլիտ (կրող ե/բ պատեր + ծածկեր) — առավելագույն սեյսմակայունություն ՀՀ գոտու համար։',
      en: 'Full monolith (RC bearing walls + slabs) gives the highest seismic resistance for Armenia; masonry storey limits do not apply.',
    })
  }
  if (p.floorSlab === 'precast') {
    w.push({
      level: 'info',
      code: 'ՀՀՇՆ 20.04-2020',
      ru: 'Сборные перекрытия (ПК) в сейсмозоне допустимы, но требуют монолитных обвязок/анкеровки. Монолитное перекрытие образует жёсткий диск и предпочтительнее.',
      hy: 'Հավաքովի ծածկերը (ПК) սեյսմիկ գոտում թույլատրելի են, բայց պահանջում են մոնոլիտ գոտիներ/խարսխում։ Մոնոլիտ ծածկը նախընտրելի է (կոշտ սկավառակ)։',
      en: 'Precast slabs are allowed in a seismic zone but need monolithic ties and anchoring. A monolithic slab forms a rigid diaphragm and is preferable.',
    })
  }
  const maxMasonry = region.seismic === 9 ? n.maxMasonryFloorsSeismic9 : n.maxMasonryFloorsSeismic8
  if (isMasonry && p.floors > maxMasonry) {
    w.push({
      level: 'error',
      code: 'ՀՀՇՆ 20.04-2020',
      ru: `Несущая кладка выше ${maxMasonry} эт. в зоне ${region.seismic} баллов требует каркаса/расчёта.`,
      hy: `${maxMasonry} հարկից բարձր կրող շարվածքը ${region.seismic} բալ գոտում պահանջում է կմախք/հաշվարկ։`,
      en: `Load-bearing masonry above ${maxMasonry} storeys in a zone ${region.seismic} area requires a frame or a structural check.`,
    })
  }
  const grade = gradeFromKey(p.concreteGrade)
  if (grade > 0 && grade < n.minStructuralConcreteGrade) {
    w.push({
      level: 'error',
      code: 'ՀՀՇՆ 20.04-2020',
      ru: `Марка бетона несущих конструкций ниже B${n.minStructuralConcreteGrade} недопустима в сейсмозоне.`,
      hy: `Կրող կոնստրուկցիաների բետոնի դասը B${n.minStructuralConcreteGrade}-ից ցածր չի թույլատրվում սեյսմիկ գոտում։`,
      en: `Concrete class below B${n.minStructuralConcreteGrade} is not allowed for load-bearing structures in a seismic zone.`,
    })
  }
  const aspect = Math.max(p.length, p.width) / Math.min(p.length, p.width)
  if (aspect > n.maxAspectRatio) {
    w.push({
      level: 'warning',
      code: 'ՀՀՇՆ 20.04-2020',
      ru: `Соотношение сторон ${aspect.toFixed(1)} > ${n.maxAspectRatio} неблагоприятно для сейсмики.`,
      hy: `Կողմերի հարաբերությունը ${aspect.toFixed(1)} > ${n.maxAspectRatio} անբարենպաստ է սեյսմիկայի համար։`,
      en: `Plan aspect ratio ${aspect.toFixed(1)} > ${n.maxAspectRatio} is unfavourable for seismic behaviour.`,
    })
  }
  const maxMasonryH = region.seismic === 9 ? n.masonryMaxFloorHeight9 : n.masonryMaxFloorHeight8
  if (isMasonry && p.floorHeight > maxMasonryH) {
    w.push({
      level: 'error',
      code: 'ՀՀՇՆ 20.04-2020',
      ru: `Высота этажа несущей кладки ${p.floorHeight} м > ${maxMasonryH} м (зона ${region.seismic} баллов) — уменьшите или перейдите на каркас.`,
      hy: `Կրող շարվածքի հարկի բարձրությունը ${p.floorHeight} մ > ${maxMasonryH} մ (${region.seismic} բալ) — նվազեցրեք կամ անցեք կմախքի։`,
      en: `Masonry storey height ${p.floorHeight} m > ${maxMasonryH} m (zone ${region.seismic}) — reduce it or switch to a frame.`,
    })
  }
  if (isMasonry && p.seismicReinforcementDisabled) {
    w.push({
      level: 'error',
      code: 'ՀՀՇՆ 20.04-2020',
      ru: 'Отключены сейсмосердечники/армопояс — нарушение сейсмических требований.',
      hy: 'Անջատված են սեյսմ. միջուկները/գոտին — սեյսմիկ պահանջների խախտում։',
      en: 'Seismic cores and ring beams are switched off — this violates seismic requirements.',
    })
  }

  // ---- residential building (ՀՀՇՆ 31-01-2014) ----
  // The 2.7 m minimum is the clear room height; floorHeight is floor-to-floor,
  // so the slab above comes off first (floor build-up is not modelled).
  const slabT = p.eng.slab != null && p.eng.slab > 0 ? p.eng.slab / 100 : C.floorSlabThickness
  const clearHeight = Math.round((p.floorHeight - slabT) * 100) / 100
  if (clearHeight < n.minRoomHeight) {
    w.push({
      level: 'warning',
      code: 'ՀՀՇՆ 31-01-2014',
      ru: `Высота комнат в чистоте ≈${clearHeight} м (этаж ${p.floorHeight} м минус перекрытие ${slabT} м) ниже нормы жилой комнаты ${n.minRoomHeight} м.`,
      hy: `Սենյակների մաքուր բարձրությունը ≈${clearHeight} մ (հարկ ${p.floorHeight} մ − ծածկ ${slabT} մ) ցածր է բնակելի սենյակի նորմայից ${n.minRoomHeight} մ։`,
      en: `Clear room height ≈${clearHeight} m (storey ${p.floorHeight} m minus the ${slabT} m slab) is below the ${n.minRoomHeight} m minimum for a habitable room.`,
    })
  } else if (p.floorHeight > n.maxRoomHeight) {
    w.push({
      level: 'info',
      code: 'ՀՀՇՆ 31-01-2014',
      ru: `Высота этажа ${p.floorHeight} м выше типовой — проверьте отопление/затраты.`,
      hy: `Հարկի բարձրությունը ${p.floorHeight} մ բարձր է սովորականից։`,
      en: `Storey height ${p.floorHeight} m is above typical — check heating and cost.`,
    })
  }
  // Упрощённый порядок N 4.1 — реш. Правительства РА N 1969-Ն от 25.12.2025
  // (в силе с 01.06.2026), подпункт 4.1 к реш. N 596-Ն от 19.03.2015.
  // Подземный этаж: модель допускает максимум один (флаг basement), что norm
  // соблюдает по построению, поэтому отдельной проверки на него нет.
  const reasons41 = simplified41Reasons(p, q.geometry.netFloorArea)
  if (reasons41.length > 0) {
    w.push({
      level: 'info',
      code: 'Пост. N 1969-Ն (N 4.1)',
      ru: `Не подходит под упрощённый порядок N 4.1 (${reasons41.join(', ')}) — обычная процедура для категории объекта.`,
      hy: `Չի համապատասխանում պարզեցված N 4.1 ընթացակարգին — սովորական ընթացակարգ։`,
      en: `Does not qualify for simplified procedure N 4.1 (${reasons41.join(', ')}) — the standard procedure applies.`,
    })
  } else {
    w.push({
      level: 'info',
      code: 'Пост. N 1969-Ն (N 4.1)',
      ru: `Подходит под упрощённый порядок N 4.1: участок ${p.plotArea} ≥ ${n.simplifiedMinPlot} м², площадь ${Math.round(q.geometry.netFloorArea)} ≤ ${n.simplifiedMaxArea} м², ${p.floors} надземных + ${p.basement ? 1 : 0} подземный. Без обычной экспертизы, разрешение до 7 раб. дней.`,
      hy: `Համապատասխանում է պարզեցված N 4.1 ընթացակարգին՝ առանց սովորական փորձաքննության, թույլտվությունը մինչև 7 աշխ. օր։`,
      en: `Eligible for simplified procedure N 4.1: plot ${p.plotArea} ≥ ${n.simplifiedMinPlot} m², area ${Math.round(q.geometry.netFloorArea)} ≤ ${n.simplifiedMaxArea} m², ${p.floors} above-ground + ${p.basement ? 1 : 0} basement. No standard expertise, permit within 7 working days.`,
    })
  }

  // ---- застройка участка и отступы (ՀՀՇՆ 30-01-2014) ----
  if (p.plotArea > 0 && q.geometry.footprint > 0) {
    // coverage counts every building on the plot: the house and the auxiliary ones
    const builtUp = q.geometry.footprint + Math.max(0, p.auxBuildingArea)
    const coverage = (builtUp / p.plotArea) * 100
    if (coverage > n.maxCoveragePct) {
      w.push({
        level: 'error',
        code: 'ՀՀՇՆ 30-01-2023',
        ru: `Застройка участка ${coverage.toFixed(1)}% > ${n.maxCoveragePct}%: застроено ${Math.round(builtUp)} м² (дом и постройки) на участке ${p.plotArea} м². Уменьшите габариты или возьмите больший участок.`,
        hy: `Կառուցապատումը ${coverage.toFixed(1)}% > ${n.maxCoveragePct}%՝ ${Math.round(builtUp)} մ² (տուն և շինություններ) ${p.plotArea} մ² հողամասում։`,
        en: `Site coverage ${coverage.toFixed(1)}% > ${n.maxCoveragePct}%: ${Math.round(builtUp)} m² built up (house and outbuildings) on a ${p.plotArea} m² plot. Reduce the footprint or take a larger plot.`,
      })
    } else {
      w.push({
        level: 'info',
        code: 'ՀՀՇՆ 30-01-2023',
        ru: `Застройка участка ${coverage.toFixed(1)}% (норма ≤ ${n.maxCoveragePct}%). Точный процент задаётся зоной — сверьте с АПЗ.`,
        hy: `Կառուցապատումը ${coverage.toFixed(1)}% (նորմա ≤ ${n.maxCoveragePct}%)։ Ճշգրիտ տոկոսը սահմանվում է գոտիով։`,
        en: `Site coverage ${coverage.toFixed(1)}% (limit ≤ ${n.maxCoveragePct}%). The exact figure is set by the zone — check the APZ.`,
      })
    }
    // помещается ли дом с нормативными отступами от границ
    const needPlot = (p.length + 2 * n.minSetback) * (p.width + 2 * n.minSetback)
    if (needPlot > p.plotArea) {
      w.push({
        level: 'warning',
        code: 'ՀՀՇՆ 30-01-2023',
        ru: `Дом ${p.length}×${p.width} м с отступами ${n.minSetback} м требует участка ≈ ${Math.round(needPlot)} м² (${p.length + 2 * n.minSetback}×${p.width + 2 * n.minSetback}), у вас ${p.plotArea} м² — проверьте форму участка и отступы по АПЗ.`,
        hy: `${p.length}×${p.width} մ տունը ${n.minSetback} մ հեռավորություններով պահանջում է ≈ ${Math.round(needPlot)} մ² հողամաս, առկա է ${p.plotArea} մ²։`,
        en: `A ${p.length}×${p.width} m house with ${n.minSetback} m setbacks needs about ${Math.round(needPlot)} m² of land; you have ${p.plotArea} m². Check the plot shape and the APZ setbacks.`,
      })
    }
  }
  if (q.geometry.netFloorArea > 1000) {
    w.push({
      level: 'info',
      code: 'Мин. экологии РА',
      ru: 'Площадь > 1000 м² — требуется экологическая экспертиза (Минэкологии РА).',
      hy: 'Մակերեսը > 1000 մ² — պահանջվում է էկոլոգիական փորձաքննություն։',
      en: 'Area over 1000 m² — an environmental assessment is required (Ministry of Environment of Armenia).',
    })
  }
  const usableArea = q.geometry.netFloorArea * n.usableRatio
  const lightRatio = usableArea > 0 ? p.windowAreaTotal / usableArea : 0
  if (lightRatio < n.minLightRatio) {
    w.push({
      level: 'warning',
      code: 'ՀՀՇՆ 31-01-2014',
      ru: `Площадь окон меньше нормы освещения (≥ 1/8 площади пола).`,
      hy: `Պատուհանների մակերեսը փոքր է լուսավորության նորմայից (≥ 1/8 հատակի)։`,
      en: `Window area is below the daylight minimum (≥ 1/8 of the floor area).`,
    })
  }

  // ---- wall thickness ----
  // Minimum thicknesses are for load-bearing walls. In an RC frame the frame
  // carries the load and the tuff or brick is only infill, so they do not apply.
  if (p.system === 'tuff' && wallT < n.tuffMinThickness && p.floors >= 2) {
    w.push({
      level: 'warning',
      code: 'ՀՀՇՆ 20.04-2020',
      ru: `Толщина несущей стены из туфа ${wallT} м < ${n.tuffMinThickness} м при ${p.floors} эт.`,
      hy: `Տուֆե կրող պատի հաստությունը ${wallT} մ < ${n.tuffMinThickness} մ։`,
    })
  }
  if (p.system === 'brick' && wallT < n.brickMinThickness) {
    w.push({
      level: 'warning',
      code: 'ՀՀՇՆ 20.04-2020',
      ru: `Толщина кирпичной несущей стены ${wallT} м < ${n.brickMinThickness} м.`,
      hy: `Աղյուսե կրող պատի հաստությունը ${wallT} մ < ${n.brickMinThickness} մ։`,
    })
  }
  if (p.system === 'monolith' && wallT < 0.16) {
    w.push({
      level: 'warning',
      code: 'ՀՀՇՆ 20.04-2020',
      ru: `Толщина несущей монолитной ж/б стены ${wallT} м < 0.16 м — увеличьте.`,
      hy: `Կրող մոնոլիտ ե/բ պատի հաստությունը ${wallT} մ < 0.16 մ — ավելացրեք։`,
    })
  }

  // ---- теплотехника стены (энергонорма РА) ----
  {
    const thermMat = p.system === 'monolith' ? 'concrete' : p.system === 'frame' ? p.infillMaterial : p.system
    const wallR = wallT / (C.thermalLambda[thermMat] ?? 0.5)
    if (wallR < n.wallThermalRReq) {
      w.push({
        level: 'info',
        code: 'ՀՀՇՆ 24-01-2016',
        ru: `Сопротивление стены R≈${wallR.toFixed(1)} < ${n.wallThermalRReq} м²·К/Вт — нужна наружная теплоизоляция.`,
        hy: `Պատի ջերմադիմադրությունը R≈${wallR.toFixed(1)} < ${n.wallThermalRReq} — անհրաժեշտ է արտաքին ջերմամեկուսացում։`,
      })
    }
  }

  // ---- уклон скатной кровли ----
  if (p.roof !== 'flat' && p.roofPitchDeg < n.minRoofPitchDeg) {
    w.push({
      level: 'warning',
      code: 'ՀՀՇՆ IV-14.02',
      ru: `Уклон скатной кровли ${p.roofPitchDeg}° < ${n.minRoofPitchDeg}° — риск протечек, увеличьте.`,
      hy: `Թեք տանիքի թեքությունը ${p.roofPitchDeg}° < ${n.minRoofPitchDeg}° — արտահոսքի ռիսկ, ավելացրեք։`,
    })
  }

  // ---- ограждения лестниц/галереи ----
  if (p.floors >= 2 || p.doubleHeightHall) {
    w.push({
      level: 'info',
      code: 'ՀՀՇՆ 31-01-2014',
      ru: `Ограждения лестниц и антресоли/галереи — высота ≥ ${n.railingMinHeight} м (для многоэтажных норма выше, ≥ 1.1 м — уточните редакцию ՀՀՇՆ 31-01-2014).`,
      hy: `Աստիճանների և միջհարկի բազրիքների բարձրությունը ≥ ${n.railingMinHeight} մ։`,
      en: `Stair, mezzanine and gallery railings — height ≥ ${n.railingMinHeight} m (higher for multi-storey buildings, ≥ 1.1 m — check the current edition).`,
    })
  }

  // ---- foundation depth vs frost ----
  // how deep each foundation type actually goes: the strip by its height,
  // piles by their length, pad columns by their height
  const pos = (v: number | undefined, fallback: number) => (v != null && v > 0 ? v : fallback)
  const foundationDepth =
    p.foundation === 'pile'
      ? pos(p.eng.pileLength, C.pile.length)
      : p.foundation === 'column'
        ? pos(p.eng.columnFoundationHeight, C.columnFoundationHeight)
        : pos(p.eng.stripHeight, C.stripHeight * 100) / 100
  if (!p.basement && p.foundation !== 'slab' && region.frostDepth > foundationDepth) {
    w.push({
      level: 'warning',
      code: 'ՀՀՇՆ 31-01-2014',
      ru: `Глубина промерзания в регионе ${region.frostDepth} м — заглубление фундамента может быть недостаточным (${foundationDepth} м).`,
      hy: `Սառչման խորությունը ${region.frostDepth} մ — հիմքի խորությունը կարող է անբավարար լինել (${foundationDepth} մ)։`,
    })
  }

  // ---- glazing ----
  const outerWallArea = q.geometry.perimeter * q.geometry.wallHeight
  if (p.windowAreaTotal + p.exteriorDoors * 2 > outerWallArea && outerWallArea > 0) {
    w.push({
      level: 'error',
      code: 'input',
      ru: `Площадь окон и дверей больше площади наружных стен (${Math.round(outerWallArea)} м²) — уменьшите.`,
      hy: `Պատուհանների և դռների մակերեսը մեծ է արտաքին պատերի մակերեսից (${Math.round(outerWallArea)} մ²) — նվազեցրեք։`,
    })
  }
  const glazingPct = outerWallArea > 0 ? (p.windowAreaTotal / outerWallArea) * 100 : 0
  if (glazingPct > n.maxGlazingPct) {
    w.push({
      level: 'warning',
      code: 'ՀՀՇՆ 20.04-2020',
      ru: `Остекление ${glazingPct.toFixed(0)}% стен > ${n.maxGlazingPct}% — теплопотери и снижение жёсткости.`,
      hy: `Ապակեպատումը ${glazingPct.toFixed(0)}% > ${n.maxGlazingPct}% — ջերմակորուստ և կոշտության նվազում։`,
    })
  }

  // ---- basement ----
  if (p.basement && p.basementDepth > 2.5) {
    w.push({
      level: 'info',
      code: 'ՀՀՇՆ 31-01-2014',
      ru: `Подвал глубже 2.5 м — нужна спец. гидроизоляция и расчёт.`,
      hy: `2.5 մ-ից խորը նկուղ — պահանջվում է հատուկ հիդրոմեկուսացում։`,
    })
  }

  // ---- room layout fit (ՀՀՇՆ 31-01-2014) ----
  const usable = q.geometry.footprint * n.usableRatio
  // combined kitchen-living counts as one large space; separate = one extra room
  const spaces = p.roomsPerFloor
  // раздельно: одна из зон — кухня (мин. 6 м²), остальные — жилые комнаты (мин. 8 м²)
  const minNeeded = p.kitchenLivingCombined
    ? n.combinedKitchenLivingMin + Math.max(0, spaces - 1) * n.minRoomArea
    : Math.max(0, spaces - 1) * n.minRoomArea + n.minKitchenArea
  if (spaces > 0 && minNeeded > usable) {
    w.push({
      level: 'error',
      code: 'ՀՀՇՆ 31-01-2014',
      ru: `${spaces} комнат не помещаются на этаже: нужно ≥ ${Math.round(minNeeded)} м² полезной, доступно ~${Math.round(usable)} м². Уменьшите число комнат или увеличьте габариты.`,
      hy: `${spaces} սենյակ չեն տեղավորվում հարկում՝ պետք է ≥ ${Math.round(minNeeded)} մ², առկա է ~${Math.round(usable)} մ²։`,
    })
  } else if (spaces > 0) {
    const perRoom = usable / spaces
    if (perRoom < n.minRoomArea) {
      w.push({
        level: 'warning',
        code: 'ՀՀՇՆ 31-01-2014',
        ru: `Средняя площадь комнаты ~${perRoom.toFixed(1)} м² близка к минимуму ${n.minRoomArea} м².`,
        hy: `Սենյակի միջին մակերեսը ~${perRoom.toFixed(1)} մ² մոտ է նվազագույնին։`,
      })
    }
  }

  // ---- Пропорции жилых комнат ----
  // Комната с отношением сторон хуже 1:2 — пенал: мебель встаёт вдоль одной
  // стены, дальний угол не используется, окно освещает только часть глубины.
  {
    const planRooms = buildFloorPlan(p, 0).rooms.concat(p.floors > 1 ? buildFloorPlan(p, 1).rooms : [])
    const bad = planRooms.filter(
      (r: Room) => (r.type === 'bedroom' || r.type === 'office' || r.type === 'living') && !r.open &&
        Math.min(r.w, r.h) > 0 &&
        Math.max(r.w, r.h) / Math.min(r.w, r.h) > 2,
    )
    for (const r of bad) {
      const ratio = Math.max(r.w, r.h) / Math.min(r.w, r.h)
      w.push({
        level: 'warning',
        code: 'ՀՀՇՆ 31-01-2014',
        ru: `«${r.label}» ${r.w.toFixed(1)}×${r.h.toFixed(1)} м — соотношение 1:${ratio.toFixed(2)}. Комната-пенал: мебель встаёт только вдоль одной стены. Уменьшите двусветный зал или число комнат на этаже.`,
        hy: `«${r.label}» ${r.w.toFixed(1)}×${r.h.toFixed(1)} մ — հարաբերությունը 1:${ratio.toFixed(2)}։ Սենյակը նեղ է։`,
      })
    }
  }

  // ---- Марка арматуры ----
  if (p.rebarGrade === 'rebar_a400') {
    w.push({
      level: 'info',
      code: 'ՀՀՇՆ 20.04-2020',
      ru: 'Арматура A400 допустима, но в сейсмозоне РА предпочтительна A500С.',
      hy: 'A400 արմատուրը թույլատրելի է, բայց ՀՀ սեյսմիկ գոտում նախընտրելի է A500С։',
    })
  }

  // ---- Инженерные параметры (ручной ввод) — проверка по нормам ----
  const eng = p.eng
  const push = (level: NormLevel, ru: string, hy: string) => w.push({ level, code: 'ՀՀՇՆ 20.04-2020', ru, hy })

  if (eng.stripWidth != null && eng.stripWidth < 30)
    push('error', `Ширина ленты ${eng.stripWidth} см < 30 см — увеличьте.`, `Ժապավենի լայնությունը ${eng.stripWidth} սմ < 30 սմ — ավելացրեք։`)
  if (eng.stripHeight != null && eng.stripHeight < 40)
    push('error', `Высота ленты ${eng.stripHeight} см < 40 см — увеличьте.`, `Ժապավենի բարձրությունը ${eng.stripHeight} սմ < 40 սմ — ավելացրեք։`)
  if (eng.slab != null && eng.slab < 12)
    push('error', `Перекрытие ${eng.slab} см < 12 см — недостаточно, увеличьте.`, `Ծածկը ${eng.slab} սմ < 12 սմ — անբավարար, ավելացրեք։`)
  if (eng.slab != null && eng.slab > 30)
    push('info', `Перекрытие ${eng.slab} см — избыточно, можно уменьшить.`, `Ծածկը ${eng.slab} սմ — ավելորդ է, կարելի է նվազեցնել։`)
  if (eng.columnSize != null && eng.columnSize < 25)
    push('error', `Сечение колонны ${eng.columnSize} см < 25 см — не соответствует сейсмонормам РА, увеличьте.`, `Սյան կտրվածքը ${eng.columnSize} սմ < 25 սմ — չի համապատասխանում ՀՀ սեյսմ. նորմերին, ավելացրեք։`)
  if (eng.columns != null) {
    const need = Math.max(4, Math.ceil(q.geometry.footprint / 20))
    if (eng.columns < need)
      push('warning', `Колонн ${eng.columns} шт — мало для площади (нужно ≈ ${need}), добавьте.`, `Սյուներ ${eng.columns} հատ — քիչ է (պետք է ≈ ${need}), ավելացրեք։`)
  }
  if (eng.beamSection != null && eng.beamSection < 0.08)
    push('warning', `Сечение ригеля ${eng.beamSection} м² мало (< 0.08 м²), увеличьте.`, `Հեծանի կտրվածքը ${eng.beamSection} մ² փոքր է (< 0.08 մ²), ավելացրեք։`)
  if (eng.extWall != null) {
    // bearing tuff / brick minimums; frame infill and other walls: 20 cm
    const minW = p.system === 'tuff' ? 40 : p.system === 'brick' ? 38 : 20
    if (eng.extWall < minW)
      push('warning', `Наружная стена ${eng.extWall} см < ${minW} см для выбранного материала — увеличьте.`, `Արտաքին պատը ${eng.extWall} սմ < ${minW} սմ — ավելացրեք։`)
  }
  if (eng.basementWall != null && eng.basementWall < 20)
    push('warning', `Стена подвала ${eng.basementWall} см < 20 см — увеличьте.`, `Նկուղի պատը ${eng.basementWall} սմ < 20 սմ — ավելացրեք։`)
  if (eng.blinding != null && eng.blinding < 3)
    push('info', `Подбетонка ${eng.blinding} см тонкая (< 3 см).`, `Ենթաբետոնը ${eng.blinding} սմ բարակ է (< 3 սմ)։`)
  if (eng.openingsPct != null && eng.openingsPct > n.maxGlazingPct)
    push('warning', `Проёмы ${eng.openingsPct}% > ${n.maxGlazingPct}% — теплопотери/жёсткость, уменьшите.`, `Բացվածքներ ${eng.openingsPct}% > ${n.maxGlazingPct}% — նվազեցրեք։`)
  if (eng.wastePct != null && eng.wastePct < 3)
    push('info', `Запас ${eng.wastePct}% мал — рекомендуется 5–10%.`, `Պահուստ ${eng.wastePct}% քիչ է — խորհուրդ է 5–10%։`)

  // ---- новые инженерные параметры: границы здравого смысла ----
  // Диапазоны взяты из практики малоэтажного строительства РА. Цель не заменить
  // расчёт, а поймать опечатку: 3 см вместо 30, 500 кг/м³ вместо 50.
  const range = (
    v: number | undefined,
    lo: number,
    hi: number,
    ru: string,
    hy: string,
    unit: string,
    level: NormLevel = 'warning',
  ) => {
    if (v == null || v <= 0) return
    if (v < lo) push(level, `${ru} ${v} ${unit} < ${lo} ${unit} — проверьте.`, `${hy} ${v} ${unit} < ${lo} ${unit}։`)
    else if (v > hi) push('info', `${ru} ${v} ${unit} > ${hi} ${unit} — избыточно, проверьте.`, `${hy} ${v} ${unit} > ${hi} ${unit}։`)
  }

  range(eng.slabThickness, 20, 60, 'Плита фундамента', 'Հիմքի սալ', 'см', 'error')
  range(eng.pileDiameter, 20, 120, 'Диаметр сваи', 'Ցցի տրամագիծ', 'см', 'error')
  range(eng.pileLength, 2, 20, 'Длина сваи', 'Ցցի երկարություն', 'м')
  range(eng.foundationAxisStep, 1, 6, 'Шаг свай/столбов', 'Ցցերի քայլ', 'м')
  range(eng.columnFoundationHeight, 0.8, 4, 'Высота столбчатого фундамента', 'Սյունակային հիմքի բարձրություն', 'м')
  range(eng.basementWorkingWidth, 30, 200, 'Рабочая зона у стен подвала', 'Աշխատանքային գոտի', 'см')
  range(eng.sandBed, 5, 50, 'Подсыпка', 'Ենթալիցք', 'см')
  range(eng.apronWidth, 0.5, 3, 'Отмостка', 'Հատակաշի', 'м')
  range(eng.columnGridStep, 2, 9, 'Шаг колонн', 'Սյուների քայլ', 'м')
  range(eng.ringBeamW, 15, 60, 'Армопояс, ширина', 'Գոտի, լայնություն', 'см')
  range(eng.ringBeamH, 15, 50, 'Армопояс, высота', 'Գոտի, բարձրություն', 'см')
  range(eng.seismicCoreSize, 20, 60, 'Сейсмосердечник', 'Սեյսմ. միջուկ', 'см', 'error')
  range(eng.seismicCoreStep, 1.5, 6, 'Шаг сейсмосердечников', 'Միջուկների քայլ', 'м')
  range(eng.lintelW, 12, 50, 'Перемычка, ширина', 'Հեծան, լայնություն', 'см')
  range(eng.lintelH, 12, 50, 'Перемычка, высота', 'Հեծան, բարձրություն', 'см')
  range(eng.partitionThickness, 6, 30, 'Перегородка', 'Միջնապատ', 'см')
  range(eng.precastSlabArea, 2, 20, 'Площадь плиты ПК', 'ПК սալի մակերես', 'м²')
  range(eng.stairVolume, 0.8, 10, 'Лестница', 'Աստիճան', 'м³')

  // Армирование: ниже 40 кг/м³ несущий элемент в сейсмозоне не армируют,
  // выше 300 — почти наверняка опечатка либо ошибка единиц.
  const rebarChecks: [number | undefined, string, string][] = [
    [eng.rebarStrip, 'ленты', 'ժապավենի'],
    [eng.rebarSlab, 'плиты', 'սալի'],
    [eng.rebarPile, 'свай', 'ցցերի'],
    [eng.rebarColumn, 'колонн', 'սյուների'],
    [eng.rebarFloor, 'перекрытий', 'ծածկերի'],
    [eng.rebarRingBeam, 'армопояса', 'գոտու'],
    [eng.rebarSeismicCore, 'сердечников', 'միջուկների'],
    [eng.rebarLintel, 'перемычек', 'հեծանների'],
    [eng.rebarBasementWall, 'стен подвала', 'նկուղի պատերի'],
    [eng.rebarMonolithWall, 'монолитных стен', 'մոնոլիտ պատերի'],
  ]
  for (const [v, ru, hy] of rebarChecks) {
    if (v == null || v <= 0) continue
    if (v < 40) push('error', `Армирование ${ru} ${v} кг/м³ < 40 кг/м³ — недостаточно для сейсмозоны.`, `${hy} արմատուրը ${v} կգ/մ³ < 40։`)
    else if (v > 300) push('warning', `Армирование ${ru} ${v} кг/м³ > 300 кг/м³ — проверьте единицы измерения.`, `${hy} արմատուրը ${v} կգ/մ³ > 300 — ստուգեք միավորները։`)
  }
  if (eng.rebarFloorPct != null && eng.rebarFloorPct > 30)
    push('info', `Прирост армирования ${eng.rebarFloorPct}% на этаж завышен (> 30%).`, `Արմատուրի աճը ${eng.rebarFloorPct}% բարձր է (> 30%)։`)

  // Класс бетона по элементам не должен быть ниже сейсмического минимума
  for (const [g, ru, hy] of [
    [eng.concreteFoundation, 'фундамента', 'հիմքի'],
    [eng.concreteFrame, 'каркаса/стен', 'կմախքի/պատերի'],
    [eng.concreteFloors, 'перекрытий', 'ծածկերի'],
  ] as [string | undefined, string, string][]) {
    if (!g) continue
    const cls = gradeFromKey(g)
    if (cls > 0 && cls < n.minStructuralConcreteGrade)
      push('error', `Класс бетона ${ru} ниже B${n.minStructuralConcreteGrade} — недопустимо в сейсмозоне.`, `${hy} բետոնի դասը B${n.minStructuralConcreteGrade}-ից ցածր է։`)
  }

  // Доля внутренних несущих осей: 0% означает, что дом держится только контуром
  if (eng.internalBearingPct != null) {
    if (eng.internalBearingPct < 20 && p.system !== 'frame')
      push('warning', `Внутренние несущие оси ${eng.internalBearingPct}% периметра — мало для несущей системы, проверьте.`, `Ներքին կրող առանցքները ${eng.internalBearingPct}% — քիչ է։`)
    else if (eng.internalBearingPct > 150)
      push('info', `Внутренние несущие оси ${eng.internalBearingPct}% периметра — необычно много.`, `Ներքին կրող առանցքները ${eng.internalBearingPct}% — անսովոր շատ է։`)
  }

  // верхние границы инженерных параметров (нереалистично большие значения)
  if (eng.stripWidth != null && eng.stripWidth > 120)
    push('warning', `Ширина ленты ${eng.stripWidth} см необычно велика (> 120 см) — проверьте/уменьшите.`, `Ժապավենի լայնությունը ${eng.stripWidth} սմ անսովոր մեծ է (> 120 սմ) — ստուգեք/նվազեցրեք։`)
  if (eng.stripHeight != null && eng.stripHeight > 150)
    push('warning', `Высота ленты ${eng.stripHeight} см необычно велика (> 150 см) — проверьте.`, `Ժապավենի բարձրությունը ${eng.stripHeight} սմ անսովոր մեծ է (> 150 սմ) — ստուգեք։`)
  if (eng.columnSize != null && eng.columnSize > 80)
    push('info', `Сечение колонны ${eng.columnSize} см избыточно (> 80 см) — можно уменьшить.`, `Սյան կտրվածքը ${eng.columnSize} սմ ավելորդ է (> 80 սմ)։`)
  if (eng.extWall != null && eng.extWall > 60)
    push('info', `Наружная стена ${eng.extWall} см избыточно толстая (> 60 см).`, `Արտաքին պատը ${eng.extWall} սմ ավելորդ հաստ է (> 60 սմ)։`)
  if (eng.basementWall != null && eng.basementWall > 60)
    push('info', `Стена подвала ${eng.basementWall} см избыточно толстая (> 60 см).`, `Նկուղի պատը ${eng.basementWall} սմ ավելորդ հաստ է (> 60 սմ)։`)
  if (eng.beamSection != null && eng.beamSection > 0.6)
    push('info', `Сечение ригеля ${eng.beamSection} м² избыточно (> 0.6 м²).`, `Հեծանի կտրվածքը ${eng.beamSection} մ² ավելորդ է (> 0.6 մ²)։`)
  if (eng.stripLen != null) {
    const per = 2 * (p.length + p.width)
    if (eng.stripLen < per)
      push('warning', `Лента ${eng.stripLen} пог.м короче периметра дома (${Math.round(per)} м) — проверьте.`, `Ժապավենը ${eng.stripLen} գ.մ կարճ է տան պարագծից (${Math.round(per)} մ) — ստուգեք։`)
    else if (eng.stripLen > per * 4)
      push('info', `Лента ${eng.stripLen} пог.м избыточно длинная (> ${Math.round(per * 4)} м).`, `Ժապավենը ${eng.stripLen} գ.մ ավելորդ երկար է (> ${Math.round(per * 4)} մ)։`)
  }
  if (eng.beamsLen != null) {
    const lb = 2 * (p.length + p.width) * 1.5
    if (eng.beamsLen < lb * 0.5)
      push('warning', `Ригели ${eng.beamsLen} пог.м — мало (ожидается ≈ ${Math.round(lb * p.floors)} м), проверьте.`, `Հեծանները ${eng.beamsLen} գ.մ քիչ է (սպասվում է ≈ ${Math.round(lb * p.floors)} մ) — ստուգեք։`)
    else if (eng.beamsLen > lb * p.floors * 3)
      push('info', `Ригели ${eng.beamsLen} пог.м — избыточно.`, `Հեծանները ${eng.beamsLen} գ.մ ավելորդ է։`)
  }
  if (eng.columns != null) {
    const need2 = Math.max(4, Math.ceil(q.geometry.footprint / 20))
    if (eng.columns > need2 * 4)
      push('info', `Колонн ${eng.columns} шт — избыточно много (нужно ≈ ${need2}).`, `Սյուներ ${eng.columns} հատ — ավելորդ շատ է (պետք է ≈ ${need2})։`)
  }
  if (eng.floorOnGround != null && eng.floorOnGround > 40)
    push('info', `Пол по грунту ${eng.floorOnGround} см — избыточно толстый (> 40 см).`, `Գետնի հատակը ${eng.floorOnGround} սմ — ավելորդ հաստ է (> 40 սմ)։`)
  if (eng.blinding != null && eng.blinding > 15)
    push('info', `Подбетонка ${eng.blinding} см — избыточно (> 15 см).`, `Ենթաբетонը ${eng.blinding} սմ — ավելորդ է (> 15 սմ)։`)
  if (eng.wastePct != null && eng.wastePct > 25)
    push('info', `Запас ${eng.wastePct}% завышен (> 25%).`, `Պահուստ ${eng.wastePct}% բարձր է (> 25%)։`)

  // ---- что калькулятор проверить не может (ՀՀՇՆ 30-01-2014) ----
  // Застройка и отступы посчитаны выше; здесь остаётся то, что зависит от
  // конкретного участка и АПЗ и не выводится из габаритов.
  w.push({
    level: 'info',
    code: 'ՀՀՇՆ 30-01-2023',
    ru: `Проверьте по АПЗ: расстояние до соседних строений, инсоляция соседних участков, красные линии и охранные зоны сетей — из габаритов дома они не выводятся.`,
    hy: `Ստուգեք ՃՀԱ-ով՝ հարևան շինություններից հեռավորությունը, հարևան հողամասերի ինսոլյացիան, կարմիր գծերը և ցանցերի պահպանման գոտիները։`,
  })

  return w
}
