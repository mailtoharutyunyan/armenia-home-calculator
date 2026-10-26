import { COEFF as C } from './coefficients'

// What the estimate's quantities rest on. Prices carry their own sources in
// prices.ts; this is everything else the numbers depend on, each marked by
// how much it can be trusted:
//   norm        — a building norm or an official tariff
//   model       — taken from a calculation of this house
//   derived     — computed from published data (a datasheet, a price list)
//   assumption  — a stated working assumption, to be replaced by the project
export type FactKind = 'norm' | 'model' | 'derived' | 'assumption'

export interface Fact {
  id: string
  kind: FactKind
  value: string
  ru: string
  hy: string
  en: string
  source?: { label: string; url?: string }
}

const n = (v: number) => String(v).replace('.', ',')

export const QUANTITY_FACTS: Fact[] = [
  // ---- norms and tariffs ----
  {
    id: 'sockets', kind: 'norm', value: '1 / 4 м',
    ru: 'Розетки: одна на каждые полные и неполные 4 м периметра жилой комнаты, на кухне не меньше четырёх, в коридоре одна на 10 м²',
    hy: 'Վարդակներ՝ մեկը բնակելի սենյակի պարագծի յուրաքանչյուր 4 մ-ին, խոհանոցում առնվազն չորս, միջանցքում մեկը՝ 10 մ²-ին',
    en: 'Sockets: one per full or part 4 m of a living room perimeter, at least four in a kitchen, one per 10 m² of corridor',
    source: { label: 'СП 31-110-2003, п. 14.29' },
  },
  {
    id: 'frost', kind: 'norm', value: '0,8 м',
    ru: 'Нормативная глубина промерзания в Ереване — подошва ленты не выше её',
    hy: 'Սառչման նորմատիվ խորությունը Երևանում՝ ժապավենի հիմքը ավելի բարձր չէ',
    en: 'Design frost depth in Yerevan; the strip sole sits no higher',
    source: { label: 'ՀՀՇՆ, климатология (regions.ts)' },
  },
  {
    id: 'railing', kind: 'norm', value: `${n(C.norms.railingMinHeight)} м`,
    ru: 'Высота ограждения галереи и лестницы',
    hy: 'Պատկերասրահի և աստիճանի բազրիքի բարձրությունը',
    en: 'Height of the gallery and stair railing',
    source: { label: 'ՀՀՇՆ 31-01-2014' },
  },
  {
    id: 'room', kind: 'norm', value: `${C.norms.minRoomArea} м²`,
    ru: 'Наименьшая площадь жилой комнаты',
    hy: 'Բնակելի սենյակի նվազագույն մակերեսը',
    en: 'Smallest living room area',
    source: { label: 'ՀՀՇՆ 31-01-2014' },
  },
  {
    id: 'light', kind: 'norm', value: '1/8',
    ru: 'Площадь окон комнаты — не меньше восьмой части её пола',
    hy: 'Սենյակի պատուհանների մակերեսը՝ հատակի առնվազն ութերորդը',
    en: 'Window area of a room is at least an eighth of its floor',
    source: { label: 'ՀՀՇՆ 31-01-2014' },
  },
  {
    id: 'simplified', kind: 'norm', value: `≤ ${C.norms.simplifiedMaxArea} м²`,
    ru: 'Упрощённый порядок разрешения N 4.1: дом до 300 м², до двух надземных этажей, участок от 400 м²',
    hy: 'Թույլտվության պարզեցված կարգ N 4.1՝ տուն մինչև 300 մ², մինչև երկու վերգետնյա հարկ, հողամաս 400 մ²-ից',
    en: 'Simplified permit N 4.1: a house up to 300 m², two storeys above ground, plot from 400 m²',
    source: { label: 'Пост. Правительства РА N 1969-Ն от 25.12.2025' },
  },
  {
    id: 'psrc', kind: 'norm', value: '199 000 ֏',
    ru: 'Подключение электричества: 1 фаза 14 кВА — 199 000 ֏; 0,4 кВ — 229 000 ֏ + 16 000 ֏ за кВА',
    hy: 'Էլեկտրաէներգիայի միացում՝ միաֆազ 14 կՎԱ — 199 000 ֏; 0,4 կՎ — 229 000 ֏ + 16 000 ֏ յուրաքանչյուր կՎԱ-ի համար',
    en: 'Electricity connection: one phase 14 kVA 199 000 ֏; 0.4 kV 229 000 ֏ + 16 000 ֏ per kVA',
    source: { label: 'КРОУ (psrc.am)', url: 'https://psrc.am/content/electricity/connections1' },
  },
  {
    id: 'excavator', kind: 'norm', value: '723 ֏/м³',
    ru: 'Работа экскаватора, грунт III категории, без НДС — расценки сетевых компаний',
    hy: 'Էքսկավատորի աշխատանք, III կարգի գրունտ, առանց ԱԱՀ՝ ցանցային ընկերությունների գներ',
    en: 'Excavator work, category III soil, before VAT — utility companies’ unit rates',
    source: { label: 'Газпром Армения, Veolia Jur (июнь 2026)', url: 'https://armenia-am.gazprom.com/notice/' },
  },
  // ---- from the house's own model ----
  {
    id: 'heat', kind: 'model', value: `${C.heatLoadPerM2} Вт/м²`,
    ru: 'Тепловая нагрузка: модель этого дома даёт 29,8 МВт·ч в год, ~15 кВт в мороз — по ней подобраны радиаторы',
    hy: 'Ջերմային բեռ՝ այս տան մոդելը տալիս է 29,8 ՄՎտ·ժ տարեկան, ~15 կՎտ սառնամանիքին',
    en: 'Heat load: the model of this house gives 29.8 MWh a year, ~15 kW at the design frost',
    source: { label: 'Энергомодель дома' },
  },
  // ---- derived from published data ----
  {
    id: 'radiator', kind: 'derived', value: `${C.radiatorPower} Вт`,
    ru: 'Мощность биметаллического радиатора 500 мм на 10 секций',
    hy: '500 մմ 10 բաժնանոց երկմետաղ ռադիատորի հզորությունը',
    en: 'Output of a 500 mm, 10-section bimetal radiator',
    source: { label: 'Стальметгрупп: 1 330–1 630 Вт', url: 'https://stalmetural.am/catalog/bimetallicheskie-radiatory/' },
  },
  {
    id: 'pump', kind: 'derived', value: `${C.pumpCallM3} м³`,
    ru: 'Выезд бетононасоса покрывает первые 20 м³, дальше — 3 000 ֏ за м³',
    hy: 'Բետոնապոմպի կանչը ներառում է առաջին 20 մ³-ը, հետո՝ 3 000 ֏/մ³',
    en: 'A concrete pump call covers the first 20 m³, then 3 000 ֏ per m³',
    source: { label: 'Прайсы Waelcon, MM Leader' },
  },
  {
    id: 'kva', kind: 'derived', value: `${C.threePhaseKva} кВА`,
    ru: 'Мощность от сети с тепловым насосом или зарядкой: насос ~4–5 кВт, wallbox 7,4–11 кВт, дом ~8 кВт',
    hy: 'Ցանցից հզորություն ջերմային պոմպով կամ լիցքավորիչով',
    en: 'Grid power with a heat pump or charger: pump ~4–5 kW, wallbox 7.4–11 kW, house ~8 kW',
  },
  // ---- working assumptions ----
  {
    id: 'cable', kind: 'assumption', value: '10 м',
    ru: 'Кабеля и гофры на одну электроточку',
    hy: 'Մալուխ և գոֆրե՝ մեկ էլեկտրական կետի համար',
    en: 'Cable and conduit per electrical point',
  },
  {
    id: 'pipe', kind: 'assumption', value: '2 × 8 м',
    ru: 'Трубы горячей и холодной воды на один прибор; канализации — 3 м',
    hy: 'Տաք և սառը ջրի խողովակ մեկ սարքի համար, կոյուղի՝ 3 մ',
    en: 'Hot and cold pipe per fixture; 3 m of drain',
  },
  {
    id: 'radpipe', kind: 'assumption', value: '20 м',
    ru: 'Подводка к одному радиатору',
    hy: 'Խողովակ մեկ ռադիատորի համար',
    en: 'Pipe run per radiator',
  },
  {
    id: 'breakers', kind: 'assumption', value: '18',
    ru: 'Автоматов в щите',
    hy: 'Ավտոմատներ վահանակում',
    en: 'Breakers in the board',
  },
  {
    id: 'trench', kind: 'assumption', value: `${n(C.trenchWorkingWidth)} м`,
    ru: 'Рабочая зона траншеи с каждой стороны ленты',
    hy: 'Խրամուղու աշխատանքային գոտին ժապավենի յուրաքանչյուր կողմից',
    en: 'Trench working space on each side of the strip',
  },
  {
    id: 'plinth', kind: 'assumption', value: `${n(C.plinthHeight)} м`,
    ru: 'Высота цоколя над землёй',
    hy: 'Ցոկոլի բարձրությունը գետնից',
    en: 'Plinth height above ground',
  },
  {
    id: 'parapet', kind: 'assumption', value: `${n(C.parapetHeight)} м`,
    ru: 'Высота парапета плоской кровли',
    hy: 'Հարթ տանիքի պարապետի բարձրությունը',
    en: 'Flat-roof parapet height',
  },
  {
    id: 'xps', kind: 'assumption', value: `${C.groundSlabInsulation * 100} см`,
    ru: 'Утеплитель XPS под полом первого этажа',
    hy: 'XPS ջերմամեկուսիչ առաջին հարկի հատակի տակ',
    en: 'XPS under the ground floor',
  },
  {
    id: 'formwork', kind: 'assumption', value: '1 месяц',
    ru: 'Аренды опалубки на один оборот',
    hy: 'Կաղապարի վարձույթ մեկ շրջանառության համար',
    en: 'Formwork rent per use',
  },
  {
    id: 'scaffold', kind: 'assumption', value: `${C.scaffoldMonths} мес.`,
    ru: 'Леса стоят на фасаде от кладки до отделки',
    hy: 'Փայտամածը ֆասադին՝ շարվածքից մինչև հարդարում',
    en: 'Scaffolding stays from masonry to facade finish',
  },
  {
    id: 'crane', kind: 'assumption', value: `${C.craneShifts} смен`,
    ru: 'Манипулятор: выгрузка блока, арматуры и опалубки',
    hy: 'Մանիպուլյատոր՝ բլոկի, արմատուրի և կաղապարի բեռնաթափում',
    en: 'Crane truck for blocks, rebar and formwork',
  },
  {
    id: 'debris', kind: 'assumption', value: `${n(C.debrisPerM2)} м³/м²`,
    ru: 'Строительного мусора на м² дома',
    hy: 'Շինաղբ տան յուրաքանչյուր մ²-ին',
    en: 'Construction waste per m² of house',
  },
  {
    id: 'tiles', kind: 'assumption', value: `${n(C.bathTileHeight)} м`,
    ru: 'Высота плитки на стенах санузлов',
    hy: 'Սանհանգույցի պատերի սալիկի բարձրությունը',
    en: 'Bathroom wall tile height',
  },
  {
    id: 'reserve', kind: 'assumption', value: '10%',
    ru: 'Резерв на непредвиденное, временные сооружения — 1%',
    hy: 'Չնախատեսված ծախսերի պահուստ, ժամանակավոր շինություններ՝ 1%',
    en: 'Contingency; temporary works 1%',
  },
]

// What the whole estimate was checked against.
export interface Benchmark {
  ru: string
  hy: string
  en: string
  value: string
  source: string
  url?: string
  date: string
}

export const BENCHMARKS: Benchmark[] = [
  {
    ru: 'Подрядчик DEKA: «чёрный каркас» / «без ремонта» / «с ремонтом», за м² внешней площади',
    hy: 'DEKA կապալառու՝ «սև կարկաս» / «առանց վերանորոգման» / «վերանորոգումով», մ²',
    en: 'DEKA contractor: black frame / unfinished / finished, per m² of external area',
    value: '120 000 / 145 000 / 185 000 ֏',
    source: 'calculator.deka.am',
    url: 'https://calculator.deka.am/',
    date: '26.10.2026',
  },
  {
    ru: 'Солнечные станции: медиана котировок установщиков',
    hy: 'Արևային կայաններ՝ տեղադրողների գնառաջարկների միջինը',
    en: 'Solar stations: median of installers’ quotes',
    value: '185 000–191 000 ֏/кВт',
    source: 'SolarPortal, август 2026',
    date: '15.09.2026',
  },
  {
    ru: 'Готовый частный дом в Ереване, продажа',
    hy: 'Պատրաստի առանձնատուն Երևանում, վաճառք',
    en: 'Existing private house in Yerevan, sale',
    value: '≈ 350 000 ֏/м²',
    source: 'afm.am',
    url: 'https://afm.am/ru/journal/mortgage/how-to-buy-a-house-in-armenia-a-step-by-step-guide-for-residents-and-foreigners',
    date: '2025',
  },
  {
    ru: 'Стройка в Армении: стандарт / средний уровень',
    hy: 'Շինարարություն Հայաստանում՝ ստանդարտ / միջին',
    en: 'Building in Armenia: standard / mid-range',
    value: '$500–800 / $800–1 200 за м²',
    source: 'armenian-lawyer.com',
    url: 'https://armenian-lawyer.com/business-immigration/armenia-real-estate-construction-guide/',
    date: '2024',
  },
]
