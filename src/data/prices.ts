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
  roof: ['https://rmsgroup.am/en/price-list', 'https://www.list.am/category/389'],
  // checked 26.10.2026
  labour: ['https://newhome.am/gnacucak'],
  truck: ['https://www.list.am/en/item/24239515'],
  scaffold: ['https://www.accurate.am/main/rent/'],
  heatPump: ['https://electro.am/ru/category/391-teplovie-nasosi'],
  cylinder: ['https://www.shinshin.am/heating'],
  fanCoil: ['https://mideaarmenia.am/fan-coil'],
  battery: ['https://solaron.am/shop/battery-se-g5-1-pro-b'],
  evCharger: ['https://evolt.am/product-category/ac-chargers/', 'https://solaron.am/en/shop/mira-7-kw-charging-station/', 'https://ener-go.am/en/chargers'],
  design: ['https://sip.am/price-list'],
  sanitary: ['https://domus.am/category/toilets', 'https://domus.am/category/sankeramika'],
}
// Prices read on 26.10.2026; quoted() stamps the 26.09.2026 check.
const OCT = '26.10.2026'

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
  // Laying is paid per m² of wall whatever the block width: 4 000 ֏/m² for a
  // single wythe (NewHome), i.e. 40 000 ֏/m³ for a 10 cm partition. The wall
  // rate of 12 000 ֏/m³ paid a partition a third of that.
  { ...quoted('aerated_partition', 'Газоблок перегородок (10 см)', 'Միջնապատի գազաբլոկ (10 սմ)', 'м³', { min: 32000, typical: 35000, max: 40000 }, 40000, [...Q.aerated, ...Q.labour],
    'газоблок D600 — 35 000 ֏/м³ (list.am, 14.09.2026); кладка в один ряд — 4 000 ֏/м² (NewHome), т.е. 40 000 ֏/м³ при толщине 10 см'), verifiedAt: OCT },
  item('brick', 'Кирпич (кладка)', 'Աղյուս (շարվածք)', 'м³', 45000, 18000, S.market),
  // 1:4 cement-sand mortar: ~6 bags of cement (2 550 at the plant, 2 700–3 500
  // at resellers in September 2026) + 1.1 m³ of sand at ~7 000 ֏.
  derived('mortar', 'Раствор кладочный', 'Շաղախ', 'м³', { min: 23000, typical: 24000, max: 28700 }, 0, Q.cement,
    'ОЦЕНКА из сверенных цен: 6 мешков цемента (2 550–3 500 ֏) + 1.1 м³ песка (7 000 ֏/м³)'),
  item('glue_aerated', 'Клей для газоблока', 'Գազաբլոկի սոսինձ', 'м³', 120000, 0, S.market),
  // Accurate Group rent list: scaffolding 650 ֏/m² a month (23 ֏ a day)
  { ...quoted('scaffolding', 'Аренда строительных лесов', 'Շինարարական փայտամածի վարձույթ', 'м²·мес', { min: 650, typical: 650, max: 650 }, 0, Q.scaffold,
    'Accurate Group: аренда лесов — 650 ֏/м² в месяц (23 ֏/м² в сутки); монтаж — силами бригады'), verifiedAt: OCT },
  estimate('crane', 'Манипулятор / кран (разгрузка, подача)', 'Մանիպուլյատոր / կռունկ', 'смена', 60000, 0,
    'ОЦЕНКА — 45 000–70 000 ֏ за смену (объявления по Еревану и Арарату); нужен для блока, арматуры и опалубки'),

  // --- Floors ---
  item('precast_slab', 'Плита перекрытия ПК', 'Ծածկի սալ ПК', 'шт', 40000, 8000, S.market),

  // --- Aggregates / bedding ---
  // a ZIL truck of 7 m³: 45 000–55 000 ֏
  quoted('sand_gravel', 'Песок/щебень подсыпка', 'Ավազ/խիճ', 'м³', { min: 6400, typical: 7000, max: 7900 }, 3000, Q.sand,
    'list.am: машина ЗИЛ 7 м³ — 45 000–55 000 ֏'),

  // --- Earthworks ---
  item('excavation', 'Выемка грунта', 'Հողի փորում', 'м³', 0, 4000, S.market),
  item('backfill', 'Обратная засыпка', 'Հետլիցք', 'м³', 0, 3000, S.market),
  // KamAZ dump truck, 15–20 t (~10 m³ loose): 30 000 ֏ a trip in Yerevan
  derived('soil_removal', 'Вывоз лишнего грунта', 'Ավելորդ հողի դուրսբերում', 'м³', { min: 2500, typical: 3000, max: 4000 }, 0, Q.truck,
    'ОЦЕНКА из сверенной цены: КамАЗ 15–20 т (~10 м³ рыхлого грунта) — 30 000 ֏ за рейс по Еревану'),
  derived('waste_removal', 'Вывоз строительного мусора', 'Շինաղբի դուրսբերում', 'м³', { min: 2500, typical: 3000, max: 4000 }, 0, Q.truck,
    'ОЦЕНКА: ~0.1 м³ мусора на м² дома (обрезки, упаковка, бой); КамАЗ — 30 000 ֏ за рейс'),
  estimate('setting_out', 'Геодезическая разбивка осей', 'Առանցքների գեոդեզիական նշում', 'компл', 120000, 0,
    'ОЦЕНКА — вынос осей и отметок геодезистом перед котлованом и на перекрытиях; уточните у геодезиста'),
  item('apron', 'Отмостка', 'Հատակաշի', 'м²', 6000, 4000, S.market),

  // --- Waterproofing / insulation / screed ---
  // Technonikol Bikrost: 10 500 ֏ per 10 m² roll, two layers
  quoted('waterproofing', 'Гидроизоляция', 'Հիդրոմեկուսացում', 'м²', { min: 1050, typical: 2100, max: 3000 }, 1500, Q.waterproofing,
    'list.am: Технониколь Бикрост — 10 500 ֏ за рулон 10 м², в два слоя'),
  // per m² at 100 mm: EPS grade I 1 556 (facade), stone wool 2 640, XPS 4 342.
  // The facade takes EPS (or wool), the flat roof and the floor on ground take
  // XPS: one averaged price under-paid the roof and over-paid the facade.
  quoted('insulation', 'Утеплитель фасада', 'Ֆասադի ջերմամեկուսիչ', 'м²', { min: 1556, typical: 1556, max: 2640 }, 2000, Q.insulation,
    'за м² при 100 мм: пенопласт I сорта 1 556 ֏; каменная вата 2 640 ֏'),
  quoted('insulation_xps', 'Утеплитель XPS (кровля, пол по грунту)', 'Ջերմամեկուսիչ XPS (տանիք, հատակ)', 'м²', { min: 4342, typical: 4342, max: 4342 }, 2000, Q.insulation,
    'за м² при 100 мм: экструдированный пенополистирол (XPS) — 4 342 ֏'),
  // 6 cm 1:3 screed: 0.54 bag of cement + 0.07 m³ of sand + fibre
  derived('screed', 'Стяжка пола', 'Հատակի շաղախ', 'м²', { min: 1800, typical: 2100, max: 2600 }, 2500, Q.cement,
    'ОЦЕНКА из сверенных цен: стяжка 6 см 1:3 — 0.54 мешка цемента + 0.07 м³ песка + фибра'),

  // --- Openings ---
  // FarmPlast (Flagma, 27.07.2026): windows from 25 000–35 000 ֏/m²
  quoted('window_regular', 'Окно обычное', 'Պատուհան սովորական', 'м²', { min: 25000, typical: 35000, max: 50000 }, 8000, Q.windows,
    'FarmPlast: металлопластиковые окна от 25 000–35 000 ֏/м² (27.07.2026)'),
  item('window_vitrage', 'Окно витражное', 'Վիտրաժ պատուհան', 'м²', 90000, 12000, S.market),
  // Domus: steel entrance doors JW 49 900–73 400 ֏
  quoted('door_exterior', 'Дверь входная', 'Մուտքի դուռ', 'шт', { min: 49900, typical: 73400, max: 150000 }, 18000, [...Q.doorExterior, ...Q.labour],
    'Domus: металлические входные двери JW — 49 900–73 400 ֏; утеплённая с терморазрывом — до 150 000 ֏; установка 18 000 ֏ (NewHome)'),
  // Nor Tun: Velldoris leaf 40 800–42 320 ֏ + frame, trims and hardware
  quoted('door_interior', 'Дверь межкомнатная', 'Ներսի դուռ', 'шт', { min: 41000, typical: 55000, max: 70000 }, 18000, [...Q.doorInterior, ...Q.labour],
    'Nor Tun: полотно Velldoris Alto 40 800–42 320 ֏ + коробка, наличники и фурнитура ≈ 14 000 ֏; установка 18 000 ֏ (NewHome)'),

  // PVC sill from 20 000 ֏/m² (≈ 6 000 ֏/m at 30 cm) + steel drip sill
  // 605–1 205 ֏/m outside; fitted with the window
  estimate('window_sills', 'Подоконники и отливы', 'Պատուհանագոգեր և արտաքին ջրահոսքեր', 'пог.м', 7000, 1500,
    'ОЦЕНКА — ПВХ подоконник 30 см (от 20 000 ֏/м²) + стальной отлив (605–1 205 ֏/м); монтаж ~1 500 ֏/м'),

  // --- Finishing ---
  // gypsum plaster ~2 cm (30 kg bag 1 900–2 350 ֏), putty, primer, two coats of SHEN W (8 700 ֏ / 10 l)
  // labour: plastering from 3 000 + levelling and painting from 3 500 ֏/m² (NewHome, 26.10.2026)
  derived('plaster', 'Штукатурка/шпаклёвка/покраска', 'Սվաղ/ներկ', 'м²', { min: 1600, typical: 2000, max: 2500 }, 6500, [...Q.plaster, ...Q.labour],
    'ОЦЕНКА из сверенных цен: гипсовая штукатурка ~2 см (мешок 30 кг — 1 900–2 350 ֏), шпаклёвка, грунт, 2 слоя краски SHEN W (8 700 ֏ за 10 л); работа: штукатурка от 3 000 + шпаклёвка и покраска от 3 500 ֏/м² (NewHome)'),
  // Bathroom walls are tiled to 2.4 m. Tile 10 040–20 000 ֏/m², laying from
  // 10 000 ֏/m² (NewHome); glue and grout ~1 500 ֏/m².
  derived('wall_tile', 'Плитка на стенах санузлов', 'Սանհանգույցի պատերի սալիկ', 'м²', { min: 11500, typical: 13500, max: 21500 }, 10000, Q.labour,
    'ОЦЕНКА: плитка 10 040–20 000 ֏/м² + клей и затирка ~1 500 ֏/м²; укладка от 10 000 ֏/м² (NewHome)'),
  // A monolithic stair has its own tread finish: porcelain tile on treads and
  // risers, ~10 m² per two-flight stair with its landing.
  derived('stair_finish', 'Облицовка лестницы (керамогранит)', 'Աստիճանի երեսպատում (կերամոգրանիտ)', 'м²', { min: 11500, typical: 13500, max: 21500 }, 15000, Q.labour,
    'ОЦЕНКА: керамогранит со ступенью и подступенком; укладка на ступенях сложнее, чем на полу (от 10 000 ֏/м² по стене, NewHome)'),
  // laminate 8 mm 6 500 ֏/m² + underlay and skirting; porcelain tile in wet rooms
  quoted('floor_finish', 'Напольное покрытие', 'Հատակածածկ', 'м²', { min: 6700, typical: 7800, max: 9800 }, 6000, Q.laminate,
    'laminat.am: ламинат 8 мм Swiss Krono — 6 500 ֏/м² + подложка и плинтус; керамогранит в санузлах и кухне'),
  item('facade', 'Фасадная отделка', 'Ֆասադի հարդարում', 'м²', 9000, 6000, S.market),

  // --- Roof ---
  item('roof_slope', 'Разуклонка кровли (керамзитобетон)', 'Տանիքի թեքաշերտ', 'м³', 22000, 9000, S.market),
  // The flat roof is priced by layers: the slope screed, insulation and the
  // two-layer membrane are their own lines. This line is the rest of the roof
  // build-up; it used to be priced (9 000 + 5 000) as the whole roof, so the
  // membrane and insulation were paid twice.
  derived('roof_flat', 'Кровля плоская', 'Հարթ տանիք', 'м²', { min: 2300, typical: 2800, max: 3500 }, 2500, Q.roof,
    'ОЦЕНКА из сверенных цен: пароизоляция (~90 ֏/м²), защитная стяжка 4 см по утеплителю (~1 700 ֏/м²), воронки и примыкания (~800 ֏/м²); гидроизоляция, утеплитель и разуклонка — отдельными строками'),
  item('roof_pitched', 'Кровля скатная', 'Թեք տանիք', 'м²', 14000, 8000, S.market),
  estimate('parapet_coping', 'Парапетная крышка (оцинк. сталь)', 'Պարապետի ծածկ', 'пог.м', 3500, 1500,
    'ОЦЕНКА — окрашенная оцинкованная сталь шириной ~45 см с капельником, с монтажом'),
  estimate('roof_drainage', 'Водосток: трубы, отвод от дома', 'Ջրահեռացում՝ խողովակներ', 'компл', 180000, 60000,
    'ОЦЕНКА — водосточные трубы от воронок до земли и отвод воды от отмостки; воронки входят в кровлю'),

  // --- Engineering networks (per m2 of total floor area) ---
  item('electrical', 'Электрика', 'Էլեկտրագծեր', 'м²', 9000, 7000, S.market),
  item('plumbing', 'Водопровод/канализация', 'Ջրամատակարարում', 'м²', 8000, 7000, S.market),
  item('heating', 'Отопление: котёл + радиаторы', 'Ջեռուցում՝ կաթսա + ռադիատորներ', 'м²', 12000, 8000, S.market),
  // Domus, 26.10.2026: WC 45 900–167 900, vanity with basin 89 900–290 000,
  // acrylic bath 50 100–145 900, Grohe mixers 39 000–69 000, shower set
  // 13 900–40 900 ֏. The water points themselves are in the plumbing line.
  derived('sanitary_set', 'Сантехника санузла (унитаз, раковина, душ/ванна, смесители)', 'Սանտեխնիկա (զուգարանակոնք, լվացարան, ցնցուղ/լոգարան)', 'компл', { min: 239000, typical: 380000, max: 714000 }, 45000, Q.sanitary,
    'ОЦЕНКА из цен Domus: унитаз 45 900–167 900, тумба с раковиной 89 900–290 000, ванна 50 100–145 900, смесители 39 000–69 000, душевой набор 13 900–40 900 ֏; установка приборов ~15 000 ֏ за прибор (оценка), разводка труб — в строке водопровода'),
  estimate('gas_internal', 'Внутренний газопровод (от счётчика)', 'Ներքին գազատար', 'компл', 150000, 60000,
    'ОЦЕНКА — труба от счётчика до котла и плиты, краны, проект; врезка и счётчик — в подключении газа'),

  // --- Optional premium systems (opt-in extras) ---
  // Warm floor is an extra on top of the base heating line (boiler, pipes,
  // radiators), not a second boiler.
  // Laying from 8 000 ֏/m² (NewHome); pipe, manifold and reflective layer ~4 000.
  derived('opt_boiler_heating', 'Тёплый пол (доплата к отоплению)', 'Տաք հատակ (հավելում ջեռուցմանը)', 'м²', { min: 3000, typical: 4000, max: 6000 }, 8000, Q.labour,
    'ОЦЕНКА: монтаж от 8 000 ֏/м² (NewHome); труба PEX ~6 м/м², коллектор, отражающий слой ~4 000 ֏/м²'),
  // electro.am: air-water units 12–18 kW 1 750 000–1 900 000 ֏ (Riello Family
  // Sprint, TICA 18 kW), equipment only
  derived('opt_heat_pump', 'Тепловой насос (воздух-вода)', 'Ջերմային պոմպ (օդ-ջուր)', 'компл', { min: 1750000, typical: 1900000, max: 2400000 }, 600000, Q.heatPump,
    'ОЦЕНКА: оборудование 12–18 кВт 1 750 000–1 900 000 ֏ (electro.am); монтаж с буферной ёмкостью и обвязкой ~600 000 ֏ (не сверено)'),
  // A heat pump makes hot water through an indirect cylinder; a gas combi
  // boiler of the base heating line makes it itself.
  { ...quoted('dhw_cylinder', 'Бойлер косвенного нагрева 200 л', 'Անուղղակի տաքացման բաք 200 լ', 'шт', { min: 288500, typical: 288500, max: 373000 }, 40000, Q.cylinder,
    'ShinShin: Apamet 200 л — 288 500 ֏, 300 л — 373 000 ֏; монтаж ~40 000 ֏ (оценка)'), verifiedAt: OCT },
  { ...quoted('opt_fancoil', 'Фанкойл', 'Ֆանկոյլ', 'шт', { min: 92000, typical: 129000, max: 192000 }, 25000, Q.fanCoil,
    'Midea MKH2: 92 000–192 000 ֏ (2.25–7.35 кВт по холоду); монтаж с подключением и дренажом ~25 000 ֏ (оценка)'), verifiedAt: OCT },
  // Deye SE-G5.1 Pro-B: 518 000 ֏ per 5.12 kWh LiFePO4 module
  { ...quoted('opt_battery', 'Аккумулятор LiFePO4', 'LiFePO4 կուտակիչ', 'кВт·ч', { min: 101000, typical: 101000, max: 101000 }, 5000, Q.battery,
    'Solaron: Deye SE-G5.1 Pro-B 5,12 кВт·ч — 518 000 ֏; монтаж и пусконаладка ~5 000 ֏/кВт·ч (оценка); гибридный инвертор — отдельно, если станция сетевая'), verifiedAt: OCT },
  { ...quoted('opt_ev_charger', 'Зарядка электромобиля (wallbox)', 'Էլեկտրամեքենայի լիցքավորիչ', 'шт', { min: 180000, typical: 226000, max: 295000 }, 35000, Q.evCharger,
    'evolt.am: 7 кВт Type 2 — от 180 000 ֏; Solaron Mira 7 кВт — 226 000 ֏; EnerGo StarCharge Artemis — от 295 000 ֏; монтаж ~35 000 ֏ (оценка, точно — после осмотра)'), verifiedAt: OCT },
  estimate('opt_kitchen', 'Кухонная мебель (без техники)', 'Խոհանոցային կահույք (առանց տեխնիկայի)', 'пог.м', 100000, 10000,
    'ОЦЕНКА — нижние и верхние шкафы, столешница; готовый модуль 2 м по акции от 129 000 ֏, на заказ дороже; сборка и установка ~10 000 ֏/м'),
  // Turnkey on-grid stations, October 2026: 10.4 kW (Longi 650 W + Solax) for
  // 1 700 000 ֏ on list.am; Smart Solar 10.32 kW for 1 485 000 ֏ cash and a
  // 220 000 ֏/kW instalment offer. A battery is not in this line.
  {
    ...quoted('opt_solar', 'Солнечные панели (фотовольтаика)', 'Արևային վահանակներ (ֆոտովոլտ.)', 'кВт', { min: 144000, typical: 163000, max: 213000 }, 0, [
      'https://www.list.am/en/item/22616313',
      'https://www.engineering10.com/AM/Gyumri/381447735537287/Smart--Solar',
    ], 'list.am: сетевая станция 10,4 кВт под ключ — 1 700 000 ֏; Smart Solar: 10,32 кВт — 1 485 000 ֏. Медиана рынка по котировкам установщиков (SolarPortal, август 2026) — 185 000–191 000 ֏/кВт, у 8–10 кВт — 213 000. Аккумулятор не входит'),
    verifiedAt: '26.10.2026',
  },
  // Whole-house supply/extract unit with heat recovery: an extra on top of the
  // base ventilation line. list.am lists HVAC QRXF units from 210 000 ֏; the
  // ducts, grilles and commissioning are a design-dependent guess.
  estimate('opt_mvhr', 'Вентиляция с рекуперацией (доплата)', 'Օդափոխություն ռեկուպերացիայով (հավելում)', 'м²', 6000, 3000,
    'ОЦЕНКА — установка 400–500 м³/ч (на list.am от 210 000 ֏), воздуховоды притока и вытяжки, решётки, наладка; уточните по проекту вентиляции'),
  item('opt_finish_premium', 'Финишная отделка «под ключ»', 'Ֆինիշ հարդարում «բանալի հանձնում»', 'м²', 20000, 0, S.market),
  // laying a suspended ceiling: from 4 000 ֏/m² (NewHome, plasterboard)
  item('opt_panel_ceiling', 'Панельный (реечный) потолок', 'Վահանակային առաստաղ', 'м²', 6000, 4000, S.market),

  // --- Stair ---
  // A stair is concrete, ~110 kg/m³ of rebar and its own formwork (~6 m²/m³);
  // 40 000 ֏/m³ was less than its concrete and rebar alone.
  derived('stair', 'Лестница монолитная', 'Աստիճան մոնոլիտ', 'м³', { min: 85000, typical: 95000, max: 110000 }, 45000, [...Q.concrete, ...Q.rebar],
    'ОЦЕНКА из сверенных цен: бетон B25 34 000 + арматура ~110 кг (33 900) + опалубка ~6 м² (27 000) ֏ на м³; работа 30 000 + опалубка 15 000 ֏/м³'),

  estimate('glass_partition', 'Раздвижная стеклянная перегородка', 'Շարժական ապակե միջնապատ', 'м²', 85000, 15000,
    'ОЦЕНКА — зависит от системы, стекла и фурнитуры'),
  // Railings along the void and the stair, 0.9-1.1 m high (see norms). Local
  // smiths sell painted steel railings; list.am (26.09.2026) has used ones at
  // ~13 000 ֏/m (three 5.5 m sections for 220 000 ֏), made to measure costs more.
  estimate('railing', 'Ограждение галереи и лестницы', 'Աստիճանի և միջհարկի բազրիք', 'пог.м', 25000, 6000,
    'ОЦЕНКА — стальное ограждение с поручнем под заказ, с монтажом; стекло или нержавейка дороже в 2–3 раза'),

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
  // sip.am: sketch, architecture and structure — 5 000 ֏/m²
  { ...quoted('permit_design', 'Проект (за м²)', 'Նախագիծ (մ²)', 'м²', { min: 5000, typical: 5000, max: 5000 }, 0, Q.design,
    'sip.am: эскиз, архитектура и конструкции — 5 000 ֏/м²; инженерные разделы (ОВ, ВК, ЭО) — отдельно'), verifiedAt: OCT },
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
  insulation: 'Facade insulation',
  insulation_xps: 'XPS insulation (roof, floor on ground)',
  aerated_partition: 'Partition aerated block (10 cm)',
  soil_removal: 'Surplus soil removal',
  waste_removal: 'Construction waste removal',
  setting_out: 'Survey setting-out',
  scaffolding: 'Scaffolding rental',
  crane: 'Crane / loader-crane truck',
  parapet_coping: 'Parapet coping (galvanised steel)',
  roof_drainage: 'Roof drainage: downpipes, run-off',
  window_sills: 'Window sills and drip sills',
  wall_tile: 'Bathroom wall tiles',
  stair_finish: 'Stair finish (porcelain tile)',
  sanitary_set: 'Bathroom fixtures (WC, basin, shower/bath, mixers)',
  gas_internal: 'Internal gas piping (from the meter)',
  dhw_cylinder: 'Indirect hot-water cylinder 200 L',
  opt_fancoil: 'Fan-coil unit',
  opt_battery: 'LiFePO4 battery',
  opt_ev_charger: 'EV charger (wallbox)',
  opt_kitchen: 'Kitchen furniture (no appliances)',
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
  heating: 'Heating: boiler + radiators',
  opt_boiler_heating: 'Underfloor heating (extra over heating)',
  opt_mvhr: 'Ventilation with heat recovery (extra)',
  opt_heat_pump: 'Heat pump (air-water)',
  opt_solar: 'Solar panels (photovoltaic)',
  opt_finish_premium: 'Turnkey finishing',
  opt_panel_ceiling: 'Panel ceiling',
  stair: 'Monolithic staircase',
  glass_partition: 'Sliding glass partition',
  railing: 'Gallery and stair railings',
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
