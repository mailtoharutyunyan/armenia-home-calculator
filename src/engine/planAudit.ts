// Планировочный аудит.
//
// Зачем он есть: на смету в проекте 97 тестов, а на планировку не было ни
// одного. Поэтому ошибки находил пользователь глазами по скриншотам — вход
// открывался в гостиную, гость шёл в туалет через спальню, комнаты выходили
// пеналами 1:2, лестница второго этажа не совпадала с лестницей первого,
// наверху не было коридора. Каждая из этих ошибок здесь стала проверкой.
//
// Правило: если пользователь заметил дефект планировки — сюда добавляется
// проверка, а не только точечная правка. Иначе дефект вернётся.

import type { HouseParams } from '../model/house'
import { buildFloorPlan } from './floorplan'
import type { Door, FloorPlan, Room } from './floorplan'

export type AuditLevel = 'error' | 'warning' | 'info'

export interface PlanIssue {
  level: AuditLevel
  rule: string
  ru: string
  hy: string
  en: string
  floor: number // 0-based
}

// Сообщение аудита на языке интерфейса. Раньше здесь был только русский —
// при том что язык сайта по умолчанию армянский, и основная аудитория видела
// чужой язык в собственной проверке планировки.
export function issueText(i: PlanIssue, lang: string): string {
  return lang === 'hy' ? i.hy : lang === 'en' ? i.en : i.ru
}

const EPS = 0.06

// Помещения, через которые нельзя вести транзитный проход к другим комнатам.
const PRIVATE: ReadonlySet<Room['type']> = new Set(['bedroom', 'bath', 'office', 'wardrobe'])
// Помещения, которые обязаны иметь естественный свет.
const NEEDS_LIGHT: ReadonlySet<Room['type']> = new Set(['bedroom', 'living', 'living_kitchen', 'kitchen', 'dining', 'office'])
// Циркуляционные помещения — через них ходить нормально.
const CIRCULATION: ReadonlySet<Room['type']> = new Set(['hall', 'corridor', 'stair'])

// Числовые требования к помещениям (метрическая практика, применимая в РА).
// Источники сверены отдельно; здесь они превращены в машинные проверки, а не
// в обещание «посмотреть внимательно».
const DIM = {
  bathMinArea: 1.8, // м², ванная комната
  bathMinWidth: 1.2, // м
  wcMinArea: 1.1, // м², уборная
  wcMinWidth: 0.9, // м
  combinedBathMin: 2.8, // м², совмещённый санузел
  corridorMinWidth: 1.2, // м
  stairMinWidth: 1.0, // м, ширина марша
  stairMaxRiser: 0.19, // м, подъём ступени
  stairMinTread: 0.25, // м, проступь
  roomMinArea: 8, // м², жилая комната
  roomMaxRatio: 2, // соотношение сторон жилой комнаты
  // Кухня-столовая линейна по природе: фронт кухни идёт вдоль стены.
  // Проверка расстановкой для 8.9×3.6: гарнитур 0.6 м + проход 1.2 + стол
  // 0.9 = 2.7 из 3.6 — встаёт свободно. Пеналом она становится примерно
  // с 1:2.6, когда глубина падает ниже 3 м при той же длине.
  kitchenMaxRatio: 2.6,

  // Расстановка мебели в спальне. Площадь сама по себе ничего не говорит:
  // комната 20 м² шириной 2.2 м бесполезна, а 14 м² правильной формы — рабочая.
  // Поэтому проверяем, встаёт ли кровать с нормативными проходами.
  bedDouble: { w: 1.8, l: 2.0 }, // двуспальная
  bedSingle: { w: 0.9, l: 2.0 },
  bedsideTable: 0.5, // м, тумба с каждой стороны
  passMin: 0.7, // м, минимальный проход вдоль кровати
  passComfort: 0.9, // м, комфортный проход

  // Газифицированная кухня. В РА газ в частных домах повсеместен, а нормы для
  // такой кухни отдельные и жёстче обычных. Числа — практика метрических норм;
  // профильный армянский документ ՀՀՇՆ 42-01-2023 «Գազաբաշխիչ համակարգեր»,
  // его текст не сверялся, поэтому значения помечены как требующие проверки.
  gasKitchenMinHeight: 2.2, // м
  gasKitchenVolPerBurner: { 2: 8, 3: 12, 4: 15 } as Record<number, number>, // м³
  gasBurnersAssumed: 4, // считаем по худшему случаю — четырёхконфорочная плита
  gasAirGap: 0.02, // м², приток воздуха снизу двери/перегородки
}

const area = (r: Room) => r.w * r.h
const ratio = (r: Room) => (Math.min(r.w, r.h) > 0 ? Math.max(r.w, r.h) / Math.min(r.w, r.h) : Infinity)

// Дверь лежит на общей стене двух комнат?
function doorJoins(d: Door, a: Room, b: Room): boolean {
  const mid = d.start + d.w / 2
  if (d.orient === 'v') {
    const onA = Math.abs(a.x - d.pos) < EPS || Math.abs(a.x + a.w - d.pos) < EPS
    const onB = Math.abs(b.x - d.pos) < EPS || Math.abs(b.x + b.w - d.pos) < EPS
    const inA = mid > a.y - EPS && mid < a.y + a.h + EPS
    const inB = mid > b.y - EPS && mid < b.y + b.h + EPS
    return onA && onB && inA && inB
  }
  const onA = Math.abs(a.y - d.pos) < EPS || Math.abs(a.y + a.h - d.pos) < EPS
  const onB = Math.abs(b.y - d.pos) < EPS || Math.abs(b.y + b.h - d.pos) < EPS
  const inA = mid > a.x - EPS && mid < a.x + a.w + EPS
  const inB = mid > b.x - EPS && mid < b.x + b.w + EPS
  return onA && onB && inA && inB
}

// Комната, в которую ведёт входная дверь.
function entranceRoom(plan: FloorPlan): Room | null {
  const d = plan.doors.find((x) => x.kind === 'entrance')
  if (!d) return null
  const mid = d.start + d.w / 2
  const hit = plan.rooms.filter((r) => {
    if (r.open) return false
    if (d.orient === 'h') {
      const touches = Math.abs(r.y - d.pos) < 0.4 || Math.abs(r.y + r.h - d.pos) < 0.4
      return touches && mid > r.x - EPS && mid < r.x + r.w + EPS
    }
    const touches = Math.abs(r.x - d.pos) < 0.4 || Math.abs(r.x + r.w - d.pos) < 0.4
    return touches && mid > r.y - EPS && mid < r.y + r.h + EPS
  })
  return hit[0] ?? null
}

// Кратчайшие пути от входа: какие комнаты приходится пересекать.
function reach(plan: FloorPlan, startIdx: number): Map<number, number[]> {
  const n = plan.rooms.length
  const adj: number[][] = Array.from({ length: n }, () => [])
  for (const d of plan.doors) {
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        if (doorJoins(d, plan.rooms[i], plan.rooms[j])) {
          adj[i].push(j)
          adj[j].push(i)
        }
      }
    }
  }
  const paths = new Map<number, number[]>([[startIdx, [startIdx]]])
  const queue = [startIdx]
  while (queue.length) {
    const cur = queue.shift()!
    for (const nx of adj[cur]) {
      if (paths.has(nx)) continue
      paths.set(nx, [...paths.get(cur)!, nx])
      queue.push(nx)
    }
  }
  return paths
}

function auditFloor(p: HouseParams, floor: number, issues: PlanIssue[]) {
  const plan = buildFloorPlan(p, floor)
  const rooms = plan.rooms
  const push = (level: AuditLevel, rule: string, ru: string, hy: string, en: string) =>
    issues.push({ level, rule, ru, hy, en, floor })

  // --- пропорции и площади ---
  for (const r of rooms) {
    if (r.open || !r.label) continue
    // Кухня-столовая в открытом плане линейна по природе: фронт кухни идёт
    // вдоль стены. Для неё порог мягче, чем для спальни, где вытянутая форма
    // мешает расставить мебель.
    const linear = r.type === 'kitchen' || r.type === 'dining' || r.type === 'living_kitchen'
    const limit = linear ? DIM.kitchenMaxRatio : DIM.roomMaxRatio
    if (NEEDS_LIGHT.has(r.type) && ratio(r) > limit) {
      push('warning', 'proportion', `«${r.label}» ${r.w.toFixed(1)}×${r.h.toFixed(1)} м — 1:${ratio(r).toFixed(2)}. Слишком вытянуто: мебель встаёт только вдоль одной стены.`, `«${r.label}» ${r.w.toFixed(1)}×${r.h.toFixed(1)} մ — 1:${ratio(r).toFixed(2)}։ Չափազանց ձգված է՝ կահույքը տեղավորվում է միայն մեկ պատի երկայնքով։`, `“${r.label}” ${r.w.toFixed(1)}×${r.h.toFixed(1)} m — 1:${ratio(r).toFixed(2)}. Too elongated: furniture only fits along one wall.`)
    }
    if (r.type === 'bedroom' && area(r) < DIM.roomMinArea) {
      push('error', 'min-area', `«${r.label}» ${area(r).toFixed(1)} м² — меньше нормативных ${DIM.roomMinArea} м² для жилой комнаты.`, `«${r.label}» ${area(r).toFixed(1)} մ² — պակաս է բնակելի սենյակի ${DIM.roomMinArea} մ² նորմայից։`, `“${r.label}” ${area(r).toFixed(1)} m² — below the ${DIM.roomMinArea} m² minimum for a habitable room.`)
    }
    if (r.type === 'corridor' && Math.min(r.w, r.h) < DIM.corridorMinWidth && Math.min(r.w, r.h) > 0) {
      push('warning', 'corridor-width', `«${r.label}» шириной ${Math.min(r.w, r.h).toFixed(2)} м — уже нормативных ${DIM.corridorMinWidth} м.`, `«${r.label}» ${Math.min(r.w, r.h).toFixed(2)} մ լայնությամբ — նեղ է ${DIM.corridorMinWidth} մ նորմայից։`, `“${r.label}” is ${Math.min(r.w, r.h).toFixed(2)} m wide — narrower than the ${DIM.corridorMinWidth} m minimum.`)
    }
    // Санузел: и площадь, и ширина. Узкий длинный санузел непригоден, даже
    // если площадь формально набирается.
    if (r.type === 'bath') {
      const wmin = Math.min(r.w, r.h)
      if (area(r) < DIM.wcMinArea || wmin < DIM.wcMinWidth) {
        push('error', 'bath-too-small', `«${r.label}» ${r.w.toFixed(1)}×${r.h.toFixed(1)} м (${area(r).toFixed(1)} м²) — меньше минимума для уборной: ${DIM.wcMinArea} м² и ширина ${DIM.wcMinWidth} м.`, `«${r.label}» ${area(r).toFixed(1)} մ² — պակաս է զուգարանի նվազագույնից՝ ${DIM.wcMinArea} մ² և ${DIM.wcMinWidth} մ լայնություն։`, `“${r.label}” ${area(r).toFixed(1)} m² — below the WC minimum of ${DIM.wcMinArea} m² and ${DIM.wcMinWidth} m width.`)
      } else if (area(r) < DIM.bathMinArea || wmin < DIM.bathMinWidth) {
        push('warning', 'bath-narrow', `«${r.label}» ${area(r).toFixed(1)} м², ширина ${wmin.toFixed(2)} м — хватает только на уборную. Ванная требует ${DIM.bathMinArea} м² и ширины ${DIM.bathMinWidth} м.`, `«${r.label}» ${area(r).toFixed(1)} մ² — բավարար է միայն զուգարանի համար։ Լոգարանը պահանջում է ${DIM.bathMinArea} մ²։`, `“${r.label}” ${area(r).toFixed(1)} m² fits a WC only. A bathroom needs ${DIM.bathMinArea} m² and ${DIM.bathMinWidth} m width.`)
      }
    }
  }

  // --- естественный свет ---
  for (const r of rooms) {
    if (r.open || !NEEDS_LIGHT.has(r.type)) continue
    const hasWindow = plan.windows.some((wn) => {
      if (wn.side === 'top' || wn.side === 'bottom') {
        const y = wn.side === 'top' ? 0 : plan.W
        const onEdge = Math.abs(r.y - y) < 0.4 || Math.abs(r.y + r.h - y) < 0.4
        return onEdge && wn.x + wn.len > r.x - EPS && wn.x < r.x + r.w + EPS
      }
      const x = wn.side === 'left' ? 0 : plan.L
      const onEdge = Math.abs(r.x - x) < 0.4 || Math.abs(r.x + r.w - x) < 0.4
      return onEdge && wn.y + wn.len > r.y - EPS && wn.y < r.y + r.h + EPS
    })
    if (!hasWindow) push('error', 'no-window', `«${r.label}» без окна — жилое помещение без естественного света.`, `«${r.label}» առանց պատուհանի — բնակելի տարածք առանց բնական լույսի։`, `“${r.label}” has no window — a habitable room without daylight.`)
  }

  // --- газифицированная кухня ---
  // Кухня на газу не может быть просто открыта в жилую комнату: требуется
  // плотно закрывающаяся дверь либо раздвижная перегородка. У пользователя
  // это решено раздвижным остеклением — проверяем, что оно действительно есть.
  if (p.connectGas) {
    // Проём двусветного зала имеет тип living_kitchen, но это не помещение —
    // исключаем его, иначе он проверяется как кухня.
    const kitchens = rooms.filter(
      (r) => !r.open && (r.type === 'kitchen' || r.type === 'dining' || r.type === 'living_kitchen'),
    )
    for (const k of kitchens) {
      const vol = area(k) * p.floorHeight
      const need = DIM.gasKitchenVolPerBurner[DIM.gasBurnersAssumed] ?? 15
      if (p.floorHeight < DIM.gasKitchenMinHeight) {
        push('error', 'gas-height', `«${k.label}»: высота ${p.floorHeight} м ниже ${DIM.gasKitchenMinHeight} м — для газифицированной кухни недопустимо.`, `«${k.label}»՝ բարձրությունը ${p.floorHeight} մ ցածր է ${DIM.gasKitchenMinHeight} մ-ից — գազիֆիկացված խոհանոցի համար անթույլատրելի է։`, `“${k.label}”: height ${p.floorHeight} m is below ${DIM.gasKitchenMinHeight} m — not allowed for a gas kitchen.`)
      }
      if (vol < need) {
        push('error', 'gas-volume', `«${k.label}»: объём ${vol.toFixed(1)} м³ меньше ${need} м³, требуемых для ${DIM.gasBurnersAssumed}-конфорочной плиты.`, `«${k.label}»՝ ծավալը ${vol.toFixed(1)} մ³ պակաս է ${need} մ³-ից՝ ${DIM.gasBurnersAssumed} այրիչով սալօջախի համար։`, `“${k.label}”: volume ${vol.toFixed(1)} m³ is below the ${need} m³ required for a ${DIM.gasBurnersAssumed}-burner hob.`)
      }
      // открыта ли кухня в жилое помещение и есть ли отсечение
      const opensToLiving = rooms.some(
        (r) =>
          (r.type === 'living' || r.type === 'living_kitchen' || r.type === 'bedroom') &&
          !r.open &&
          (Math.abs(r.y + r.h - k.y) < EPS || Math.abs(k.y + k.h - r.y) < EPS ||
            Math.abs(r.x + r.w - k.x) < EPS || Math.abs(k.x + k.w - r.x) < EPS),
      )
      if (opensToLiving && !k.glassSide) {
        push('error', 'gas-open-plan', `«${k.label}» на газу примыкает к жилой комнате без отсечения. Нужна дверь с плотным притвором или раздвижная перегородка — иначе схему не согласуют.`, `«${k.label}» գազով հարում է բնակելի սենյակին առանց բաժանման։ Պահանջվում է ամուր փակվող դուռ կամ շարժական միջնապատ։`, `“${k.label}” with gas adjoins a habitable room with no separation. A tight-closing door or a sliding partition is required.`)
      } else if (opensToLiving && k.glassSide) {
        push('info', 'gas-partition-ok', `«${k.label}»: раздвижная перегородка отделяет газифицированную кухню от зала — это и делает открытую схему допустимой. Не забудьте приток воздуха снизу не менее ${DIM.gasAirGap} м² и вытяжной вентканал.`, `«${k.label}»՝ շարժական միջնապատը բաժանում է գազիֆիկացված խոհանոցը սրահից — հենց դա է բաց հատակագիծը թույլատրելի դարձնում։ Հիշեք ներքևի օդի ներհոսքը՝ ոչ պակաս ${DIM.gasAirGap} մ², և օդափոխության ալիքը։`, `“${k.label}”: the sliding partition separates the gas kitchen from the living room — that is what makes the open plan permissible. Remember an air inlet of at least ${DIM.gasAirGap} m² and an extract duct.`)
      }
    }
  }

  // --- мебель встаёт? ---
  // Кровать ставится изголовьем к стене. Нужно: по длине — кровать + проход
  // в ногах; по ширине — кровать + тумбы/проходы с двух сторон.
  for (const r of rooms) {
    if (r.type !== 'bedroom' || r.open || !r.label) continue
    // Мастер-спальня проверяется двуспальной кроватью, детская — односпальной.
    const master = /мастер|master|գլխավոր/i.test(r.label)
    const bed = master ? DIM.bedDouble : DIM.bedSingle
    const long = Math.max(r.w, r.h)
    const short = Math.min(r.w, r.h)
    // вариант А: изголовье к короткой стене (кровать вдоль длинной стороны)
    const fitA = short >= bed.w + 2 * DIM.passMin && long >= bed.l + DIM.passMin
    // вариант Б: изголовье к длинной стене
    const fitB = long >= bed.w + 2 * DIM.passMin && short >= bed.l + DIM.passMin
    if (!fitA && !fitB) {
      const kind = master ? 'двуспальная' : 'односпальная'
      push('error', 'no-bed-fit', `В «${r.label}» ${r.w.toFixed(1)}×${r.h.toFixed(1)} м ${kind} кровать ${bed.w}×${bed.l} м не встаёт с проходами ${DIM.passMin} м.`, `«${r.label}» ${r.w.toFixed(1)}×${r.h.toFixed(1)} մ — ${bed.w}×${bed.l} մ մահճակալը չի տեղավորվում ${DIM.passMin} մ անցումներով։`, `In “${r.label}” ${r.w.toFixed(1)}×${r.h.toFixed(1)} m a ${bed.w}×${bed.l} m bed does not fit with ${DIM.passMin} m clearances.`)
    } else {
      const comfortA = short >= bed.w + 2 * DIM.passComfort && long >= bed.l + DIM.passComfort
      const comfortB = long >= bed.w + 2 * DIM.passComfort && short >= bed.l + DIM.passComfort
      if (master && !comfortA && !comfortB) {
        push('info', 'bed-tight', `«${r.label}»: кровать встаёт, но проходы около ${DIM.passMin} м вместо комфортных ${DIM.passComfort} м.`, `«${r.label}»՝ մահճակալը տեղավորվում է, բայց անցումները ${DIM.passMin} մ են՝ հարմարավետ ${DIM.passComfort} մ-ի փոխարեն։`, `“${r.label}”: the bed fits, but clearances are about ${DIM.passMin} m instead of a comfortable ${DIM.passComfort} m.`)
      }
    }
  }

  // --- лестничный марш физически помещается? ---
  // Классическая ошибка планировки: клетку рисуют «на глаз», а марш в неё не
  // влезает. При высоте этажа H нужно ceil(H / подъём) ступеней, длина марша
  // (ступени − 1) × проступь. Если прямой марш не входит — нужна площадка и
  // поворот, а на это требуется ширина минимум в два марша.
  {
    const st = rooms.find((r) => r.type === 'stair')
    if (st && p.floors > 1) {
      const steps = Math.ceil(p.floorHeight / DIM.stairMaxRiser)
      const run = (steps - 1) * DIM.stairMinTread
      const long = Math.max(st.w, st.h)
      const short = Math.min(st.w, st.h)
      if (short < DIM.stairMinWidth) {
        push('error', 'stair-narrow', `Лестница шириной ${short.toFixed(2)} м — уже минимума ${DIM.stairMinWidth} м.`, `Աստիճանը ${short.toFixed(2)} մ լայնությամբ — նեղ է ${DIM.stairMinWidth} մ նվազագույնից։`, `Stair width ${short.toFixed(2)} m is below the ${DIM.stairMinWidth} m minimum.`)
      } else if (run > long) {
        // прямой марш не входит — проверяем двухмаршевую с площадкой
        const halfRun = Math.ceil(steps / 2) * DIM.stairMinTread
        const needShort = 2 * DIM.stairMinWidth
        if (halfRun + DIM.stairMinWidth > long || short < needShort) {
          push('error', 'stair-no-fit', `Лестница ${st.w.toFixed(1)}×${st.h.toFixed(1)} м: при высоте этажа ${p.floorHeight} м нужно ${steps} ступеней, прямой марш ${run.toFixed(1)} м не помещается, а на поворотный не хватает габарита.`, `Աստիճան ${st.w.toFixed(1)}×${st.h.toFixed(1)} մ՝ ${p.floorHeight} մ հարկի բարձրության դեպքում պետք է ${steps} աստիճան, ուղիղ երթևեկը ${run.toFixed(1)} մ չի տեղավորվում։`, `Stair ${st.w.toFixed(1)}×${st.h.toFixed(1)} m: at ${p.floorHeight} m floor height ${steps} steps are needed; a straight flight of ${run.toFixed(1)} m does not fit and there is no room for a turn.`)
        } else {
          push('info', 'stair-two-flight', `Лестница: ${steps} ступеней, прямой марш ${run.toFixed(1)} м не входит в ${long.toFixed(1)} м — нужна двухмаршевая с промежуточной площадкой.`, `Աստիճան՝ ${steps} աստիճան, ուղիղ երթևեկը ${run.toFixed(1)} մ չի տեղավորվում ${long.toFixed(1)} մ-ում — պետք է երկերթևեկ՝ միջանկյալ հարթակով։`, `Stair: ${steps} steps; a straight flight of ${run.toFixed(1)} m does not fit in ${long.toFixed(1)} m — a two-flight stair with a landing is needed.`)
        }
      }
    }
  }

  // --- связность и транзит через приватные комнаты ---
  const start = floor === 0 ? entranceRoom(plan) : rooms.find((r) => r.type === 'stair') ?? null
  if (floor === 0 && !start) {
    push('error', 'no-entrance', 'На плане нет входной двери.', 'Հատակագծում մուտքի դուռ չկա։', 'The plan has no entrance door.')
  }
  if (floor === 0 && start && !CIRCULATION.has(start.type)) {
    push('error', 'entrance-into-room', `Входная дверь ведёт прямо в «${start.label}». С улицы нужно попадать в прихожую.`, `Մուտքի դուռը տանում է ուղիղ «${start.label}»։ Փողոցից պետք է մտնել նախասրահ։`, `The entrance opens straight into “${start.label}”. From the street you should enter a hall.`)
  }
  if (start) {
    const si = rooms.indexOf(start)
    const paths = reach(plan, si)
    for (let i = 0; i < rooms.length; i++) {
      const r = rooms[i]
      if (r.open || !r.label) continue
      const path = paths.get(i)
      if (!path) {
        push('error', 'unreachable', `В «${r.label}» нет двери — помещение изолировано.`, `«${r.label}»-ը դուռ չունի — տարածքը մեկուսացված է։`, `“${r.label}” has no door — the room is isolated.`)
        continue
      }
      // Транзит через приватную комнату — дефект. Исключение: гардероб и
      // личный санузел, которые входят в мастер-блок и по определению
      // открываются из спальни. Это не проходная комната, а спальный блок.
      const suiteMember = r.type === 'wardrobe' || r.type === 'bath'
      const through = path
        .slice(1, -1)
        .map((k) => rooms[k])
        .filter((x) => PRIVATE.has(x.type))
        .filter((x) => !(suiteMember && x.type === 'bedroom'))
      if (through.length > 0) {
        push('error', 'walk-through', `В «${r.label}» можно попасть только через «${through[0].label}». Проходные комнаты недопустимы.`, `«${r.label}» կարելի է մտնել միայն «${through[0].label}»-ի միջով։ Անցումային սենյակներն անթույլատրելի են։`, `“${r.label}” is only reachable through “${through[0].label}”. Walk-through rooms are not acceptable.`)
      }
    }
  }
  return plan
}

export function auditPlan(p: HouseParams): PlanIssue[] {
  const issues: PlanIssue[] = []
  const plans: FloorPlan[] = []
  for (let f = 0; f < Math.max(1, p.floors); f++) plans.push(auditFloor(p, f, issues))

  // --- вертикальные связи между этажами ---
  for (let f = 1; f < plans.length; f++) {
    const a = plans[f - 1].rooms.find((r) => r.type === 'stair')
    const b = plans[f].rooms.find((r) => r.type === 'stair')
    if (!b) {
      issues.push({
        level: 'error',
        rule: 'no-stair',
        ru: `На ${f + 1}-м этаже нет лестницы.`,
        hy: `${f + 1}-րդ հարկում աստիճան չկա։`,
        en: `Floor ${f + 1} has no staircase.`,
        floor: f,
      })
      continue
    }
    if (a && (Math.abs(a.x - b.x) > 0.25 || Math.abs(a.y - b.y) > 0.25)) {
      issues.push({
        level: 'error',
        rule: 'stair-misaligned',
        ru: `Лестница ${f + 1}-го этажа не совпадает с лестницей ${f}-го: смещение ${Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)).toFixed(2)} м. Лестницы должны стоять друг над другом.`,
        hy: `${f + 1}-րդ հարկի աստիճանը չի համընկնում ${f}-րդի հետ՝ շեղում ${Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)).toFixed(2)} մ։ Աստիճանները պետք է լինեն միմյանց վրա։`,
        en: `The floor ${f + 1} stair does not align with floor ${f}: offset ${Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)).toFixed(2)} m. Stairs must stack vertically.`,
        floor: f,
      })
    }
  }

  // --- двусветный зал: проём наверху обязан совпадать с залом внизу ---
  if (p.doubleHeightHall && p.floors >= 2 && plans.length >= 2) {
    const hall = plans[0].rooms.find((r) => r.doubleHeight)
    const hole = plans[1].rooms.find((r) => r.open)
    if (hall && hole) {
      const dx = Math.abs(hall.x - hole.x) + Math.abs(hall.w - hole.w)
      const dy = Math.abs(hall.y - hole.y) + Math.abs(hall.h - hole.h)
      if (dx > 0.25 || dy > 0.25) {
        issues.push({
          level: 'error',
          rule: 'void-misaligned',
          ru: `Проём 2-го этажа (${hole.w.toFixed(1)}×${hole.h.toFixed(1)}) не совпадает с двусветным залом 1-го (${hall.w.toFixed(1)}×${hall.h.toFixed(1)}).`,
          hy: `2-րդ հարկի բացվածքը (${hole.w.toFixed(1)}×${hole.h.toFixed(1)}) չի համընկնում 1-ին հարկի կրկնահարկ սրահի հետ (${hall.w.toFixed(1)}×${hall.h.toFixed(1)})։`,
          en: `The floor 2 void (${hole.w.toFixed(1)}×${hole.h.toFixed(1)}) does not match the double-height hall below (${hall.w.toFixed(1)}×${hall.h.toFixed(1)}).`,
          floor: 1,
        })
      }
    } else if (!hole) {
      issues.push({
        level: 'error',
        rule: 'no-void',
        ru: 'Двусветный зал включён, но проёма во 2-м этаже нет.',
        hy: 'Կրկնահարկ սրահը միացված է, բայց 2-րդ հարկում բացվածք չկա։',
        en: 'The double-height hall is enabled but there is no void on floor 2.',
        floor: 1,
      })
    }
  }

  return issues
}
