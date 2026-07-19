import type { HouseParams } from '../model/house'
import { COEFF as C } from '../data/coefficients'
import { REGIONS } from '../data/regions'
import type { Quantities } from './quantities'

export type NormLevel = 'error' | 'warning' | 'info'

export interface Warning {
  level: NormLevel
  code: string // ՀՀՇՆ reference or 'input'
  ru: string
  hy: string
}

// class from catalog key: concrete_b25 -> 25, concrete_b225 -> 22.5
export function gradeFromKey(key: string): number {
  const m = key.match(/b(\d+)/i)
  if (!m) return 0
  const raw = m[1]
  return raw.length === 3 ? Number(raw) / 10 : Number(raw)
}

export function checkNorms(p: HouseParams, q: Quantities): Warning[] {
  const w: Warning[] = []
  const region = REGIONS[p.region]
  const n = C.norms
  const isMasonry = p.system !== 'frame'

  // ---- input validation ----
  if (p.floors < 1) {
    w.push({ level: 'error', code: 'input', ru: 'Число этажей должно быть ≥ 1.', hy: 'Հարկերի թիվը պետք է լինի ≥ 1։' })
  }
  if (p.length <= 0 || p.width <= 0) {
    w.push({ level: 'error', code: 'input', ru: 'Габариты дома должны быть положительными.', hy: 'Տան չափերը պետք է լինեն դրական։' })
  }

  // ---- seismic (ՀՀՇՆ II-6.02) — все РА 8–9 баллов ----
  if (p.system === 'aerated') {
    w.push({
      level: 'error',
      code: 'ՀՀՇՆ II-6.02',
      ru: 'Несущий газоблок в сейсмозоне РА не допускается. Используйте каркас с заполнением или туф с сейсмопоясами.',
      hy: 'Կրող գազաբլոկը ՀՀ սեյսմիկ գոտում թույլատրելի չէ։ Օգտագործեք կմախք լցվածքով կամ տուֆ սեյսմագոտիներով։',
    })
  }
  const maxMasonry = region.seismic === 9 ? n.maxMasonryFloorsSeismic9 : n.maxMasonryFloorsSeismic8
  if (isMasonry && p.floors > maxMasonry) {
    w.push({
      level: 'error',
      code: 'ՀՀՇՆ II-6.02',
      ru: `Несущая кладка выше ${maxMasonry} эт. в зоне ${region.seismic} баллов требует каркаса/расчёта.`,
      hy: `${maxMasonry} հարկից բարձր կրող շարվածքը ${region.seismic} բալ գոտում պահանջում է կմախք/հաշվարկ։`,
    })
  }
  const grade = gradeFromKey(p.concreteGrade)
  if (grade > 0 && grade < n.minStructuralConcreteGrade) {
    w.push({
      level: 'error',
      code: 'ՀՀՇՆ II-6.02',
      ru: `Марка бетона несущих конструкций ниже B${n.minStructuralConcreteGrade} недопустима в сейсмозоне.`,
      hy: `Կրող կոնստրուկցիաների բետոնի դասը B${n.minStructuralConcreteGrade}-ից ցածր չի թույլատրվում սեյսմիկ գոտում։`,
    })
  }
  const aspect = Math.max(p.length, p.width) / Math.min(p.length, p.width)
  if (aspect > n.maxAspectRatio) {
    w.push({
      level: 'warning',
      code: 'ՀՀՇՆ II-6.02',
      ru: `Соотношение сторон ${aspect.toFixed(1)} > ${n.maxAspectRatio} неблагоприятно для сейсмики.`,
      hy: `Կողմերի հարաբերությունը ${aspect.toFixed(1)} > ${n.maxAspectRatio} անբարենպաստ է սեյսմիկայի համար։`,
    })
  }
  if (isMasonry && p.seismicReinforcementDisabled) {
    w.push({
      level: 'error',
      code: 'ՀՀՇՆ II-6.02',
      ru: 'Отключены сейсмосердечники/армопояс — нарушение сейсмических требований.',
      hy: 'Անջատված են սեյսմ. միջուկները/գոտին — սեյսմիկ պահանջների խախտում։',
    })
  }

  // ---- residential building (ՀՀՇՆ 31-01-2014) ----
  if (p.floorHeight < n.minRoomHeight) {
    w.push({
      level: 'warning',
      code: 'ՀՀՇՆ 31-01-2014',
      ru: `Высота этажа ${p.floorHeight} м ниже нормы жилой комнаты ${n.minRoomHeight} м.`,
      hy: `Հարկի բարձրությունը ${p.floorHeight} մ ցածր է բնակելի սենյակի նորմայից ${n.minRoomHeight} մ։`,
    })
  } else if (p.floorHeight > n.maxRoomHeight) {
    w.push({
      level: 'info',
      code: 'ՀՀՇՆ 31-01-2014',
      ru: `Высота этажа ${p.floorHeight} м выше типовой — проверьте отопление/затраты.`,
      hy: `Հարկի բարձրությունը ${p.floorHeight} մ բարձր է սովորականից։`,
    })
  }
  if (p.floors > n.simplifiedMaxFloors || q.geometry.footprint > n.simplifiedMaxArea) {
    w.push({
      level: 'info',
      code: 'ՀՀՇՆ 31-01-2014',
      ru: `Дом выходит за упрощённую процедуру (≤ ${n.simplifiedMaxFloors} эт. и ≤ ${n.simplifiedMaxArea} м²): нужна полная процедура/экспертиза.`,
      hy: `Տունը դուրս է պարզեցված ընթացակարգից (≤ ${n.simplifiedMaxFloors} հարկ և ≤ ${n.simplifiedMaxArea} մ²)։`,
    })
  }
  const lightRatio = q.geometry.totalFloorArea > 0 ? p.windowAreaTotal / q.geometry.totalFloorArea : 0
  if (lightRatio < n.minLightRatio) {
    w.push({
      level: 'warning',
      code: 'ՀՀՇՆ 31-01-2014',
      ru: `Площадь окон меньше нормы освещения (≥ 1/8 площади пола).`,
      hy: `Պատուհանների մակերեսը փոքր է լուսավորության նորմայից (≥ 1/8 հատակի)։`,
    })
  }

  // ---- wall thickness ----
  const wallMat = p.system === 'frame' ? p.infillMaterial : p.system
  if (wallMat === 'tuff' && p.wallThickness < n.tuffMinThickness && p.floors >= 2) {
    w.push({
      level: 'warning',
      code: 'ՀՀՇՆ II-6.02',
      ru: `Толщина несущей стены из туфа ${p.wallThickness} м < ${n.tuffMinThickness} м при ${p.floors} эт.`,
      hy: `Տուֆե կրող պատի հաստությունը ${p.wallThickness} մ < ${n.tuffMinThickness} մ։`,
    })
  }
  if (wallMat === 'brick' && p.wallThickness < n.brickMinThickness) {
    w.push({
      level: 'warning',
      code: 'ՀՀՇՆ II-6.02',
      ru: `Толщина кирпичной несущей стены ${p.wallThickness} м < ${n.brickMinThickness} м.`,
      hy: `Աղյուսե կրող պատի հաստությունը ${p.wallThickness} մ < ${n.brickMinThickness} մ։`,
    })
  }

  // ---- foundation depth vs frost ----
  if (!p.basement && p.foundation !== 'slab' && region.frostDepth > C.stripHeight) {
    w.push({
      level: 'warning',
      code: 'ՀՀՇՆ 31-01-2014',
      ru: `Глубина промерзания в регионе ${region.frostDepth} м — заглубление фундамента может быть недостаточным (${C.stripHeight} м).`,
      hy: `Սառչման խորությունը ${region.frostDepth} մ — հիմքի խորությունը կարող է անբավարար լինել։`,
    })
  }

  // ---- glazing ----
  const glazingPct = q.geometry.wallGross > 0 ? (p.windowAreaTotal / q.geometry.wallGross) * 100 : 0
  if (glazingPct > n.maxGlazingPct) {
    w.push({
      level: 'warning',
      code: 'ՀՀՇՆ II-6.02',
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
  const minNeeded = p.kitchenLivingCombined
    ? n.combinedKitchenLivingMin + Math.max(0, spaces - 1) * n.minRoomArea
    : spaces * n.minRoomArea
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

  // ---- Марка арматуры ----
  if (p.rebarGrade === 'rebar_a400') {
    w.push({
      level: 'info',
      code: 'ՀՀՇՆ II-6.02',
      ru: 'Арматура A400 допустима, но в сейсмозоне РА предпочтительна A500С.',
      hy: 'A400 արմատուրը թույլատրելի է, բայց ՀՀ սեյսմիկ գոտում նախընտրելի է A500С։',
    })
  }

  // ---- Инженерные параметры (ручной ввод) — проверка по нормам ----
  const eng = p.eng
  const push = (level: NormLevel, ru: string, hy: string) => w.push({ level, code: 'ՀՀՇՆ II-6.02', ru, hy })

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
    const minW = wallMat === 'tuff' ? 40 : wallMat === 'brick' ? 38 : 20
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

  // ---- urban planning reminder (ՀՀՇՆ 30-01-2014) ----
  w.push({
    level: 'info',
    code: 'ՀՀՇՆ 30-01-2014',
    ru: `Проверьте вручную: отступ от границы ≥ ${n.minSetback} м и застройка участка ≤ ${n.maxCoveragePct}%.`,
    hy: `Ստուգեք ձեռքով՝ սահմանից հեռավորությունը ≥ ${n.minSetback} մ և կառուցապատումը ≤ ${n.maxCoveragePct}%։`,
  })

  return w
}
