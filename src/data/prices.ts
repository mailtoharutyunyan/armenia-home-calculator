import type { Catalog, PriceItem } from '../model/catalog'

const S = {
  // Проверено curl'ом 13.09.2026. Мёртвые адреса удалены намеренно:
  // ссылка, которая не открывается, создаёт видимость проверки.
  // Удалён mmlider.am — домен больше не резолвится (NXDOMAIN).
  // Удалён minfin.am — страница о ценах на стройматериалы есть, данных на ней нет.
  rebar: ['https://stalmetural.am/catalog/armatura/', 'https://met-trans.am/armatura/armatura-cena-za-tonnu'],
  block: ['https://www.list.am/category/110'],
  concrete: ['https://www.construction.am/suppliers.php?act=concrete-products'],
  // Для этих позиций открытых прайсов в РА нет: цену дают по запросу.
  market: [] as string[],
}

// ВНИМАНИЕ о происхождении цен.
// `typical` — это ориентир, сверенный вручную (см. PRICES_UPDATED). Вилка
// min/max НЕ является агрегатом котировок разных поставщиков: она строится
// арифметически от `typical`. Поэтому `rangeLow`/`rangeHigh` в смете — это
// оценка чувствительности, а не наблюдённый рыночный разброс. Чтобы вилка
// стала настоящей, materialMin/Max должны приходить из прайсов поставщиков.
//
// Build a price band around a typical value (min -10%, max +15%).
function item(
  key: string,
  labelRu: string,
  labelHy: string,
  unit: string,
  typical: number,
  labor: number,
  sources: string[],
  note?: string,
): PriceItem {
  return {
    key,
    labelRu,
    labelHy,
    unit,
    // Ни одна позиция пока не сверена с прайсом поставщика: это ориентир
    // правдоподобного порядка. Станет 'quoted', когда появится verifiedAt.
    provenance: 'unverified',
    sourceUrls: sources,
    materialTypical: typical,
    materialMin: Math.round(typical * 0.9),
    materialMax: Math.round(typical * 1.15),
    labor,
    sources,
    note,
  }
}

// Market check of 26.09.2026. Prices are what a private buyer pays per the
// supplier's own price list or listing; a VAT-registered seller's VAT is
// already inside them. min/max are the real spread across the sources read,
// not a band around typical. Where no single price exists (mortar = cement +
// sand), `derived` builds it from quoted inputs and stays an 'estimate'.
const VERIFIED_AT = '26.09.2026'
const Q = {
  concrete: [
    'https://www.yell.am/%D0%9F%D0%A0%D0%9E%D0%98%D0%97%D0%92%D0%9E%D0%94%D0%A1%D0%A2%D0%92%D0%9E-%D0%91%D0%95%D0%A2%D0%9E%D0%9D%D0%90-%D0%9C%D0%9C-%D0%9B%D0%98%D0%94%D0%95%D0%A0--81005',
    'https://yerkir.am/hy/article/2026/09/14/318795',
  ],
  rebar: ['https://rmsgroup.am/en/price-list', 'https://stalmetural.am/catalog/armatura/'],
  aerated: ['https://www.list.am/item/22643081', 'https://www.list.am/category/356'],
  tuff: ['https://www.list.am/item/23131982', 'https://www.list.am/item/22147717'],
  sand: ['https://www.list.am/item/24168492', 'https://www.list.am/item/24042170'],
  cement: ['https://armenpress.am/ru/article/1260397', 'https://www.list.am/category/389'],
  insulation: [
    'https://totalarmenia.am/shinanyut/penoplast-prpraplast',
    'https://www.list.am/item/23521471',
    'https://rmsgroup.am/en/price-list',
  ],
  waterproofing: ['https://www.list.am/item/22289135'],
  windows: ['https://flagma.am/ru/evro-patuhanner-drner-farmplast-o1764286.html'],
  doorInterior: ['https://www.nortun.am/catalog/doors/Interior_doors/'],
  doorExterior: ['https://domus.am/category/exterior-doors'],
  laminate: ['https://www.laminat.am/product_detail/1950'],
  plaster: ['https://erkatproff.am/product/gipsonit-shen-30-kg', 'https://domus.am/product/shen-water-dispersion-paint-w-10l-155kg'],
}

type Band = { min: number; typical: number; max: number }

function quoted(key: string, labelRu: string, labelHy: string, unit: string, price: Band, labor: number, urls: string[], note: string): PriceItem {
  return {
    key,
    labelRu,
    labelHy,
    unit,
    provenance: 'quoted',
    verifiedAt: VERIFIED_AT,
    sourceUrls: urls,
    materialMin: price.min,
    materialTypical: price.typical,
    materialMax: price.max,
    labor,
    sources: urls.map((u) => new URL(u).hostname),
    note,
  }
}

function derived(key: string, labelRu: string, labelHy: string, unit: string, price: Band, labor: number, urls: string[], note: string): PriceItem {
  return { ...quoted(key, labelRu, labelHy, unit, price, labor, urls, note), provenance: 'estimate', verifiedAt: undefined }
}

// Documents/permit costs vary widely and are partly contract-based, so use a
// wider band. Sources: Yerevan Municipality / urban.e-gov.am (2024–2025 data).
function permit(key: string, labelRu: string, labelHy: string, unit: string, typical: number): PriceItem {
  return {
    key,
    labelRu,
    labelHy,
    unit,
    materialTypical: typical,
    materialMin: Math.round(typical * 0.6),
    materialMax: Math.round(typical * 2),
    labor: 0,
    provenance: 'official',
    sourceUrls: ['https://urban.e-gov.am'],
    sources: ['urban.e-gov.am', 'minurban.am'],
    note: 'ориентир, уточните на urban.e-gov.am',
  }
}

// Позиции, которых нет в открытых прайсах (подключение к сетям, благоустройство):
// стоимость договорная и сильно зависит от расстояния до сети и условий ТУ.
// Поэтому вилка широкая (0.5x…2x) и в note прямо сказано, что это оценка.
function estimate(
  key: string,
  labelRu: string,
  labelHy: string,
  unit: string,
  typical: number,
  labor: number,
  noteRu = 'ОЦЕНКА — уточните по техусловиям поставщика сети',
): PriceItem {
  return {
    key,
    labelRu,
    labelHy,
    unit,
    materialTypical: typical,
    materialMin: Math.round(typical * 0.5),
    materialMax: Math.round(typical * 2),
    labor,
    provenance: 'estimate',
    sourceUrls: [],
    sources: ['оценка, не сверено с прайсом'],
    note: noteRu,
  }
}

const items: PriceItem[] = [
  // --- Бетон (֏/м³, без НДС) ---
  // Происхождение: цифры перенесены из сметы проекта my-home, а не с сайта
  // поставщика. Дата сверки неизвестна, поэтому provenance = 'unverified'.
  // Товарный бетон в РА в открытых прайсах не публикуется: цена зависит от
  // марки, объёма, расстояния до узла и нужды в насосе — её дают по запросу.
  // MM Leader price list (YELL.am, updated 10.07.2026). Mid-September 2026 a
  // ~4 000 ֏/m³ rise was reported with the cement shortage (Araratcement
  // denied raising its own price), so max carries that rise. Delivery and the
  // pump are separate lines.
  quoted('concrete_b15', 'Бетон B15 / М200', 'Բետոն B15 / М200', 'м³', { min: 29000, typical: 29000, max: 33000 }, 18000, Q.concrete,
    'MM Leader: М200 — 29 000 ֏/м³ (10.07.2026); в сентябре 2026 сообщали о росте на ~4 000 ֏/м³'),
  quoted('concrete_b20', 'Бетон B20 / М250', 'Բետոն B20 / М250', 'м³', { min: 30000, typical: 30000, max: 34000 }, 18000, Q.concrete,
    'MM Leader: М250 — 30 000 ֏/м³ (10.07.2026); в сентябре 2026 сообщали о росте на ~4 000 ֏/м³'),
  quoted('concrete_b225', 'Бетон B22.5 / М300', 'Բետոն B22.5 / М300', 'м³', { min: 32000, typical: 32000, max: 36000 }, 18000, Q.concrete,
    'MM Leader: М300 — 32 000 ֏/м³ (10.07.2026); в сентябре 2026 сообщали о росте на ~4 000 ֏/м³'),
  quoted('concrete_b25', 'Бетон B25 / М350', 'Բետոն B25 / М350', 'м³', { min: 34000, typical: 34000, max: 38000 }, 18000, Q.concrete,
    'MM Leader: М350 — 34 000 ֏/м³ (10.07.2026); в сентябре 2026 сообщали о росте на ~4 000 ֏/м³'),
  item('concrete_b30', 'Бетон B30 / М400', 'Բետոն B30 / М400', 'м³', 36000, 18000, S.concrete),
  quoted('concrete_blinding', 'Подбетонка М100', 'Ենթաբетон М100', 'м³', { min: 25000, typical: 25000, max: 29000 }, 8000, Q.concrete,
    'MM Leader: М100 — 25 000 ֏/м³ (10.07.2026)'),

  // --- Rebar (AMD/т) ---
  // RMS Group price list: A500C 12–32 mm 305 000, 8–10 mm 315 000 ֏/t; a house
  // is ~70% main bars and ~30% ties. Stalmetgroup 12 mm: 300.72 ֏/m ≈ 339 000.
  quoted('rebar_a500', 'Арматура А500С', 'Արմատուր А500С', 'т', { min: 305000, typical: 308000, max: 339000 }, 60000, Q.rebar,
    'RMS Group: 12–32 мм — 305 000 ֏/т, 8–10 мм — 315 000 ֏/т; Стальметгрупп: 12 мм ≈ 339 000 ֏/т'),
  item('rebar_a400', 'Арматура А400 (A-III)', 'Արմատուր А400', 'т', 275000, 60000, S.rebar),

  // --- Masonry ---
  // Tuff is sold per stone: 150–250 ֏ for a 22×17×38 cm stone, ~64 per m³ of masonry.
  quoted('tuff_block', 'Туф (кладка)', 'Տուֆ (շարվածք)', 'м³', { min: 10000, typical: 16000, max: 17500 }, 15000, Q.tuff,
    'list.am: 150–250 ֏ за камень 22×17×38 см (Артик, Талин); ≈ 64 камня на м³ кладки'),
  // Iranian autoclaved D600: good quality 35 000 wholesale (a house takes two
  // 40 m³ trucks), medium quality 32 000; other listings up to 40 000 ֏/m³.
  quoted('aerated_block', 'Газоблок', 'Գազաբլոկ', 'м³', { min: 32000, typical: 35000, max: 40000 }, 12000, Q.aerated,
    'list.am (14.09.2026): D600 высокого качества — 35 000 ֏/м³ оптом, среднего — 32 000 ֏/м³'),
  item('brick', 'Кирпич (кладка)', 'Աղյուս (շարվածք)', 'м³', 45000, 18000, S.market),
  // 1:4 cement-sand mortar: ~6 bags of cement (2 550 at the plant, 2 700–3 500
  // at resellers in September 2026) + 1.1 m³ of sand at ~7 000 ֏.
  derived('mortar', 'Раствор кладочный', 'Շաղախ', 'м³', { min: 23000, typical: 24000, max: 28700 }, 0, Q.cement,
    'ОЦЕНКА из сверенных цен: 6 мешков цемента (2 550–3 500 ֏) + 1.1 м³ песка (7 000 ֏/м³)'),
  item('glue_aerated', 'Клей для газоблока', 'Գազաբլոկի սոսինձ', 'м³', 120000, 0, S.market),

  // --- Floors ---
  item('precast_slab', 'Плита перекрытия ПК', 'Ծածկի սալ ПК', 'шт', 40000, 8000, S.market),

  // --- Aggregates / bedding ---
  // a ZIL truck of 7 m³: 45 000–55 000 ֏
  quoted('sand_gravel', 'Песок/щебень подсыпка', 'Ավազ/խիճ', 'м³', { min: 6400, typical: 7000, max: 7900 }, 3000, Q.sand,
    'list.am: машина ЗИЛ 7 м³ — 45 000–55 000 ֏'),

  // --- Earthworks ---
  item('excavation', 'Выемка грунта', 'Հողի փորում', 'м³', 0, 4000, S.market),
  item('backfill', 'Обратная засыпка', 'Հետլիցք', 'м³', 0, 3000, S.market),
  item('apron', 'Отмостка', 'Հատակաշի', 'м²', 6000, 4000, S.market),

  // --- Waterproofing / insulation / screed ---
  // Technonikol Bikrost: 10 500 ֏ per 10 m² roll, two layers
  quoted('waterproofing', 'Гидроизоляция', 'Հիդրոմեկուսացում', 'м²', { min: 1050, typical: 2100, max: 3000 }, 1500, Q.waterproofing,
    'list.am: Технониколь Бикрост — 10 500 ֏ за рулон 10 м², в два слоя'),
  // per m² at 100 mm: EPS grade I 1 556 (facade), stone wool 2 640, XPS 4 342
  // (flat roof); the default house insulates both, which averages ~2 600.
  quoted('insulation', 'Утеплитель', 'Ջերմամեկուսիչ', 'м²', { min: 1556, typical: 2600, max: 4342 }, 2000, Q.insulation,
    'за м² при 100 мм: пенопласт I сорта 1 556 ֏ (фасад), каменная вата 2 640 ֏, XPS 4 342 ֏ (плоская кровля)'),
  // 6 cm 1:3 screed: 0.54 bag of cement + 0.07 m³ of sand + fibre
  derived('screed', 'Стяжка пола', 'Հատակի շաղախ', 'м²', { min: 1800, typical: 2100, max: 2600 }, 2500, Q.cement,
    'ОЦЕНКА из сверенных цен: стяжка 6 см 1:3 — 0.54 мешка цемента + 0.07 м³ песка + фибра'),

  // --- Openings ---
  // FarmPlast (Flagma, 27.07.2026): windows from 25 000–35 000 ֏/m²
  quoted('window_regular', 'Окно обычное', 'Պատուհան սովորական', 'м²', { min: 25000, typical: 35000, max: 50000 }, 8000, Q.windows,
    'FarmPlast: металлопластиковые окна от 25 000–35 000 ֏/м² (27.07.2026)'),
  item('window_vitrage', 'Окно витражное', 'Վիտրաժ պատուհան', 'м²', 90000, 12000, S.market),
  // Domus: steel entrance doors JW 49 900–73 400 ֏
  quoted('door_exterior', 'Дверь входная', 'Մուտքի դուռ', 'шт', { min: 49900, typical: 73400, max: 150000 }, 15000, Q.doorExterior,
    'Domus: металлические входные двери JW — 49 900–73 400 ֏; утеплённая с терморазрывом — до 150 000 ֏'),
  // Nor Tun: Velldoris leaf 40 800–42 320 ֏ + frame, trims and hardware
  quoted('door_interior', 'Дверь межкомнатная', 'Ներսի դուռ', 'шт', { min: 41000, typical: 55000, max: 70000 }, 10000, Q.doorInterior,
    'Nor Tun: полотно Velldoris Alto 40 800–42 320 ֏ + коробка, наличники и фурнитура ≈ 14 000 ֏'),

  // --- Finishing ---
  // gypsum plaster ~2 cm (30 kg bag 1 900–2 350 ֏), putty, primer, two coats of SHEN W (8 700 ֏ / 10 l)
  derived('plaster', 'Штукатурка/шпаклёвка/покраска', 'Սվաղ/ներկ', 'м²', { min: 1600, typical: 2000, max: 2500 }, 3000, Q.plaster,
    'ОЦЕНКА из сверенных цен: гипсовая штукатурка ~2 см (мешок 30 кг — 1 900–2 350 ֏), шпаклёвка, грунт, 2 слоя краски SHEN W (8 700 ֏ за 10 л)'),
  // laminate 8 mm 6 500 ֏/m² + underlay and skirting; porcelain tile in wet rooms
  quoted('floor_finish', 'Напольное покрытие', 'Հատակածածկ', 'м²', { min: 6700, typical: 7800, max: 9800 }, 6000, Q.laminate,
    'laminat.am: ламинат 8 мм Swiss Krono — 6 500 ֏/м² + подложка и плинтус; керамогранит в санузлах и кухне'),
  item('facade', 'Фасадная отделка', 'Ֆասադի հարդարում', 'м²', 9000, 6000, S.market),

  // --- Roof ---
  item('roof_slope', 'Разуклонка кровли (керамзитобетон)', 'Տանիքի թեքաշերտ', 'м³', 22000, 9000, S.market),
  item('roof_flat', 'Кровля плоская', 'Հարթ տանիք', 'м²', 9000, 5000, S.market),
  item('roof_pitched', 'Кровля скатная', 'Թեք տանիք', 'м²', 14000, 8000, S.market),

  // --- Engineering networks (per m2 of total floor area) ---
  item('electrical', 'Электрика', 'Էլեկտրագծեր', 'м²', 9000, 7000, S.market),
  item('plumbing', 'Водопровод/канализация', 'Ջրամատակարարում', 'м²', 8000, 7000, S.market),
  item('heating', 'Отопление', 'Ջեռուցում', 'м²', 12000, 8000, S.market),

  // --- Optional premium systems (opt-in extras) ---
  item('opt_boiler_heating', 'Отопление: котёл + тёплый пол', 'Ջեռուցում՝ կաթսա + տաք հատակ', 'м²', 7000, 0, S.market),
  item('opt_heat_pump', 'Тепловой насос (воздух-вода)', 'Ջերմային պոմպ (օդ-ջուր)', 'компл', 2500000, 0, S.market),
  item('opt_solar', 'Солнечные панели (фотовольтаика)', 'Արևային վահանակներ (ֆոտովոլտ.)', 'кВт', 350000, 0, S.market),
  item('opt_finish_premium', 'Финишная отделка «под ключ»', 'Ֆինիշ հարդարում «բանալի հանձնում»', 'м²', 20000, 0, S.market),
  item('opt_panel_ceiling', 'Панельный (реечный) потолок', 'Վահանակային առաստաղ', 'м²', 6000, 0, S.market),

  // --- Stair ---
  item('stair', 'Лестница монолитная', 'Աստիճան մոնոլիտ', 'м³', 40000, 30000, S.market),

  estimate('glass_partition', 'Раздвижная стеклянная перегородка', 'Շարժական ապակե միջնապատ', 'м²', 85000, 15000,
    'ОЦЕНКА — зависит от системы, стекла и фурнитуры'),

  // --- Опалубка и подача бетона (ранее отсутствовали как статьи) ---
  // Опалубка считается по площади контакта с бетоном, а не по объёму.
  estimate('formwork', 'Опалубка (аренда + монтаж)', 'Կաղապար (վարձույթ + մոնտաժ)', 'м²', 4500, 2500,
    'ОЦЕНКА — зависит от оборачиваемости щитов и сложности конструкций'),
  estimate('concrete_pump', 'Подача бетона насосом', 'Բետոնի մատակարարում պոմպով', 'м³', 3500, 0,
    'ОЦЕНКА — обычно тарифицируется за смену с минимальным объёмом'),

  // --- Вентиляция и электробезопасность (обязательны, ранее отсутствовали) ---
  item('ventilation', 'Вентиляция', 'Օդափոխություն', 'м²', 4000, 3000, S.market),
  estimate('lightning', 'Молниезащита и заземление', 'Կայծակապաշտպանություն և հողանցում', 'компл', 180000, 60000,
    'ОЦЕНКА — зависит от контура заземления и грунта'),

  // --- Подключение к инженерным сетям (техусловия + врезка) ---
  // Это отдельные платежи сетевым организациям, они НЕ входят в стоимость
  // внутренних сетей дома (electrical / plumbing / heating).
  estimate('conn_electricity', 'Подключение электричества (ТУ + врезка)', 'Էլեկտրաէներգիայի միացում', 'компл', 250000, 0),
  estimate('conn_gas', 'Подключение газа (ТУ + проект + врезка)', 'Գազի միացում', 'компл', 550000, 0),
  estimate('conn_water', 'Подключение водопровода', 'Ջրագծի միացում', 'компл', 220000, 0),
  estimate('conn_sewer', 'Подключение канализации', 'Կոյուղու միացում', 'компл', 200000, 0),
  estimate('septic', 'Локальное очистное (септик)', 'Տեղական մաքրման կայան (սեպտիկ)', 'компл', 800000, 150000,
    'ОЦЕНКА — если нет центральной канализации; зависит от числа жильцов'),

  // --- Благоустройство участка ---
  estimate('fence', 'Забор с фундаментом', 'Ցանկապատ հիմքով', 'пог.м', 32000, 12000,
    'ОЦЕНКА — зависит от материала и рельефа'),
  estimate('site_paving', 'Дорожки и площадки', 'Ճանապարհներ և հարթակներ', 'м²', 12000, 5000,
    'ОЦЕНКА — мощение/бетон, зависит от покрытия'),
  estimate('balcony', 'Балкон / терраса', 'Պատշգամբ / տեռաս', 'м²', 45000, 18000,
    'ОЦЕНКА — плита + ограждение + покрытие'),

  // --- Permit / documents (AMD, Armenia; per m2 where noted) ---
  permit('permit_apz', 'АПЗ (муниципалитет)', 'ՃՀԱ (համայնք)', 'комплект', 40000),
  permit('permit_design', 'Проект (за м²)', 'Նախագիծ (մ²)', 'м²', 4000),
  permit('permit_geology', 'Геологические изыскания', 'Երկրաբանական հետազոտ.', 'комплект', 150000),
  permit('permit_expertise', 'Экспертиза проекта', 'Փորձաքննություն', 'комплект', 25000),
  permit('permit_fee', 'Разрешение на строительство', 'Շին. թույլտվություն', 'комплект', 70000),
  permit('permit_address', 'Присвоение адреса', 'Հասցեի տրամադրում', 'комплект', 15000),
  permit('permit_supervision', 'Технадзор (за м²)', 'Տեխ. հսկողություն (մ²)', 'м²', 1500),
]

// English labels (keyed by item key). Missing keys fall back to the Russian label.
const EN_LABELS: Record<string, string> = {
  concrete_b15: 'Concrete B15 / M200',
  concrete_b20: 'Concrete B20 / M250',
  concrete_b225: 'Concrete B22.5 / M300',
  concrete_b25: 'Concrete B25 / M350',
  concrete_b30: 'Concrete B30 / M400',
  concrete_blinding: 'Blinding concrete M100',
  rebar_a500: 'Rebar A500C',
  rebar_a400: 'Rebar A400 (A-III)',
  tuff_block: 'Tuff (masonry)',
  aerated_block: 'Aerated block',
  brick: 'Brick (masonry)',
  mortar: 'Masonry mortar',
  glue_aerated: 'Aerated-block glue',
  precast_slab: 'Precast floor slab',
  sand_gravel: 'Sand / gravel bedding',
  excavation: 'Excavation',
  backfill: 'Backfill',
  apron: 'Blind area',
  waterproofing: 'Waterproofing',
  insulation: 'Insulation',
  screed: 'Floor screed',
  window_regular: 'Window (standard)',
  window_vitrage: 'Window (curtain wall)',
  door_exterior: 'Entrance door',
  door_interior: 'Interior door',
  plaster: 'Plaster / putty / paint',
  floor_finish: 'Floor covering',
  facade: 'Facade finish',
  roof_slope: 'Roof slope screed (lightweight concrete)',
  roof_flat: 'Flat roof',
  roof_pitched: 'Pitched roof',
  electrical: 'Electrical',
  plumbing: 'Plumbing / sewerage',
  heating: 'Heating',
  opt_boiler_heating: 'Heating: boiler + warm floor',
  opt_heat_pump: 'Heat pump (air-water)',
  opt_solar: 'Solar panels (photovoltaic)',
  opt_finish_premium: 'Turnkey finishing',
  opt_panel_ceiling: 'Panel ceiling',
  stair: 'Monolithic staircase',
  glass_partition: 'Sliding glass partition',
  formwork: 'Formwork (rental + erection)',
  concrete_pump: 'Concrete pumping',
  ventilation: 'Ventilation',
  lightning: 'Lightning protection & earthing',
  conn_electricity: 'Electricity connection (TU + tap-in)',
  conn_gas: 'Gas connection (TU + design + tap-in)',
  conn_water: 'Water connection',
  conn_sewer: 'Sewerage connection',
  septic: 'Septic / local treatment unit',
  fence: 'Fence with footing',
  site_paving: 'Paths & paved areas',
  balcony: 'Balcony / terrace',
  permit_apz: 'APZ (municipality)',
  permit_design: 'Design (per m²)',
  permit_geology: 'Geological survey',
  permit_expertise: 'Design expertise',
  permit_fee: 'Building permit',
  permit_address: 'Address assignment',
  permit_supervision: 'Technical supervision (per m²)',
}

export const SEED_PRICES: Catalog = Object.fromEntries(
  items.map((it) => [it.key, { ...it, labelEn: EN_LABELS[it.key] }]),
)

// Запасной курс на случай, если public/rates.json не загрузился.
// Актуальный курс приложение берёт у ЦБ РА (см. src/data/rates.ts).
export const AMD_PER_USD_DEFAULT = 363.28

// Когда прайс последний раз сверялся с поставщиками (показывается в редакторе цен).
// Дата последней ручной сверки прайса. Это заявление составителя, а не
// доказательство: записи о том, что и с чем сверялось, в проекте нет.
// План сверки — docs/PRICE-VERIFICATION.md.
export const PRICES_UPDATED = '26.09.2026'

// Через сколько дней прайс считается несвежим. Стройматериалы в РА заметно
// двигаются за квартал, поэтому предупреждаем раньше.
export const PRICES_STALE_AFTER_DAYS = 90

// Возраст прайса в днях. PRICES_UPDATED в формате дд.мм.гггг.
export function priceAgeDays(updated: string = PRICES_UPDATED, now = new Date()): number | null {
  const m = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(updated)
  if (!m) return null
  const d = new Date(Date.UTC(+m[3], +m[2] - 1, +m[1]))
  if (Number.isNaN(d.getTime())) return null
  return Math.floor((now.getTime() - d.getTime()) / 86_400_000)
}

// Точность расчёта.
//
// Математика в калькуляторе точная и покрыта тестами. Приблизительными его
// делают только входные цены. Поэтому формулировка не статичная: по мере того
// как позиции получают реальные котировки, «оценка» превращается в «расчёт по
// вашим ценам», и слово «приблизительный» уходит, когда перестаёт быть правдой.
export type Precision = 'estimate' | 'partial' | 'quoted'

export function precisionOf(catalog: Catalog): { level: Precision; quoted: number; total: number } {
  const list = Object.values(catalog)
  const quoted = list.filter((i) => i.provenance === 'quoted').length
  const total = list.length
  const level: Precision = quoted === 0 ? 'estimate' : quoted < total ? 'partial' : 'quoted'
  return { level, quoted, total }
}

export function arePricesStale(updated: string = PRICES_UPDATED, now = new Date()): boolean {
  const age = priceAgeDays(updated, now)
  return age === null || age > PRICES_STALE_AFTER_DAYS
}
