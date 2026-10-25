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
  radiators: [
    'https://stalmetural.am/catalog/bimetallicheskie-radiatory/',
    'https://shinshin.am/heating/radiators/bimetal-radiators/',
    'https://www.chipdip.am/catalog-show/radiatory-bimetallicheskie-3879',
    'https://domus.am/category/heating-radiator-valves',
    'https://varpet.online/%D5%A3%D5%B6%D5%A1%D6%81%D5%B8%D6%82%D6%81%D5%A1%D5%AF',
  ],
  // ready-mix with delivery up to 15 km, VAT included (Waelcon, 29.08.2026)
  concreteVat: ['https://www.waelcon.am/wp-content/uploads/2026/08/%D5%8E%D4%B1%D4%B5%D4%BC%D4%BF%D5%88%D5%86-%D5%8D%D5%8A%D4%B8-%D4%B2%D5%A5%D5%BF%D5%B8%D5%B6%D5%AB-%D4%B3%D5%B6%D5%A1%D6%81%D5%B8%D6%82%D6%81%D5%A1%D5%AF29%E2%80%A408.2026.pdf'],
  points: ['https://fastmodernhouse.com/%D5%A3%D5%B6%D5%A1%D6%81%D5%B8%D6%82%D6%81%D5%A1%D5%AF', 'https://varpet.online/%D5%A3%D5%B6%D5%A1%D6%81%D5%B8%D6%82%D6%81%D5%A1%D5%AF'],
  cable: ['https://vida.am/catalog/elektrakanutyun/maluxner-larer/', 'https://electro.am/hy/', 'https://onlineshinanyut.am/product/view/lari-gofre-20mm-hrakayun-promrukav'],
  panel: ['https://shinshin.am/electricity/panel-equipment/', 'https://domus.am/category/automatic-circuit-breaker'],
  ppr: ['https://shinshin.am/engineering-systems/pipes/polypropylene-pipes/', 'https://erkatproff.am/jramatakararoum-ev-jraheracoum'],
  boiler: ['https://onlineshinanyut.am/product/view/gazi-katsa+tskhatar-baxi-eco4s-24kvt', 'https://shinshin.am/heating/gas-water-heaters/', 'https://santex-house.am/weter-baqer'],
  vent: ['https://domus.am/category/vents', 'https://onlineshinanyut.am/product/view/odapokhich-vents-100d', 'https://lanka.am/9001/06401'],
  facadeSystem: ['https://shinshin.am/construction-materials/dry-construction-mixes/frontal-mixtures/', 'https://shinshin.am/construction-materials/', 'https://domus.am/product/shen-facade-paint-f-10l-152kg'],
  psrc: ['https://psrc.am/content/electricity/connections1'],
  // second market pass, 26.10.2026
  concreteOct: ['https://www.waelcon.am/', 'https://hska.am/hy', 'https://mmleader.am/betoni-artadrowtyown'],
  rebarOct: ['https://rmsgroup.am/product/poghpatya-amran-a-3-500c-12-mm', 'https://mikmetal.am/am/steel-bars-wire-rod', 'https://erkatproff.am/'],
  roofRolls: ['https://erkatproff.am/taniqi-jramekousacoum', 'https://shinshin.am/construction-materials/roofing-and-drainage/'],
  xps: ['https://shinshin.am/construction-materials/', 'https://erkatproff.am/'],
  windowsOct: ['https://flagma.am/en/evro-drner-farmplast-o1759155.html', 'https://www.list.am/en/item/21450362'],
  doorsOct: ['https://domus.am/category/exterior-doors', 'https://nortun.am/catalog/doors/Interior_doors/', 'https://domus.am/category/door-frames-and-casings', 'https://turn.am/en/service/mijsenyakayin-drneri-teghadrvoum-6126/detail'],
  floorsOct: ['https://domus.am/category/laminate-flooring', 'https://laminat.am/category/46', 'https://domus.am/category/porcelain-stonewares', 'https://domus.am/category/erespatman-salikner'],
  finishOct: ['https://shinshin.am/', 'https://totalarmenia.am/shinanyut/chor-shaghaghner-termogips', 'https://turn.am/ru/article/bnakaranneri-veranorogum-yerevanum-2026-gner'],
  sanitaryOct: ['https://nortun.am/catalog/sanceramics/Toilets/__31/', 'https://domus.am/category/bathroom-furniture', 'https://domus.am/category/shower-cabins-and-vanities', 'https://nortun.am/catalog/sanceramics/Showers_Faucets/__26/'],
  elecOct: ['https://shinshin.am/electricity/cable-and-wires/hardwire/', 'https://domus.am/product/RE-00091501', 'https://shinmarket.am/catalog/98/168/', 'https://shinshin.am/electricity/panel-equipment/'],
  heatOct: ['https://shinshin.am/heating/gas-water-heaters/', 'https://santex-house.am/nasosy-grundfos', 'https://santex-house.am/weter-baqer/wrv24', 'https://stalmetural.am/catalog/bimetallicheskie-radiatory/', 'https://domus.am/category/heating-radiator-valves'],
  ufhOct: ['https://vida.am/catalog/', 'https://shinshin.am/engineering-systems/'],
  fansOct: ['https://shinshin.am/', 'https://lanka.am/9001/06401'],
  inverter: ['https://www.list.am/en/item/23845828', 'https://www.list.am/en/item/24085281'],
  cylOct: ['https://www.list.am/en/item/995207760', 'https://www.shinshin.am/heating'],
  fancoilOct: ['https://www.list.am/en/item/995217388', 'https://mideaarmenia.am/fan-coil'],
  earthRates: ['https://armenia-am.gazprom.com/notice/', 'https://www.veolia.am/hy/about-us/iravakan-akter'],
  screedOct: ['https://turn.am/ru/article/bnakaranneri-veranorogum-yerevanum-2026-gner', 'https://newhome.am/gnacucak'],
  formworkRent: ['https://www.accurate.am/main/rent/', 'https://uyut.am/hy/bmaterial_more/203'],
  floorHeating: [
    'https://kelvin.am/ru/products/index?c_id=86',
    'https://santex-house.am/rasprodazha/truby-pex-a-16-kh-2-2c2mm-sanline-2c-universalnye-s-kislorodnoe-zashchitoj-barierom',
    'https://newhome.am/gnacucak',
    'https://varpet.online/%D5%A3%D5%B6%D5%A1%D6%81%D5%B8%D6%82%D6%81%D5%A1%D5%AF',
  ],
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
  // Typical is Waelcon's list of 29.08.2026: VAT included, delivered within
  // 15 km. MM Leader's lower list (10.07.2026) may be without VAT, so it is
  // the minimum. Max is Waelcon's winter price (−10…−15 °C).
  { ...quoted('concrete_b15', 'Бетон B15 / М200', 'Բետոն B15 / М200', 'м³', { min: 33500, typical: 39000, max: 44000 }, 18000, Q.concreteOct,
    'Waelcon с 01.10.2026: М200 — 39 000 ֏/м³ с НДС и доставкой до 15 км (зимой до +5 000); HSKA — 33 500 ֏/м³ (НДС и доставка не указаны — уточните звонком); MM Leader — дешевле, но без НДС'), verifiedAt: OCT },
  { ...quoted('concrete_b20', 'Бетон B20 / М250', 'Բետոն B20 / М250', 'м³', { min: 36500, typical: 41000, max: 46000 }, 18000, Q.concreteOct,
    'Waelcon с 01.10.2026: М250 — 41 000 ֏/м³ с НДС и доставкой до 15 км (зимой до +5 000); HSKA — 36 500 ֏/м³ (НДС и доставка не указаны — уточните звонком); MM Leader — дешевле, но без НДС'), verifiedAt: OCT },
  { ...quoted('concrete_b225', 'Бетон B22.5 / М300', 'Բետոն B22.5 / М300', 'м³', { min: 38000, typical: 42500, max: 47500 }, 18000, Q.concreteOct,
    'Waelcon с 01.10.2026: М300 — 42 500 ֏/м³ с НДС и доставкой до 15 км (зимой до +5 000); HSKA — 38 000 ֏/м³ (НДС и доставка не указаны — уточните звонком); MM Leader — дешевле, но без НДС'), verifiedAt: OCT },
  { ...quoted('concrete_b25', 'Бетон B25 / М350', 'Բետոն B25 / М350', 'м³', { min: 39500, typical: 45000, max: 50000 }, 18000, Q.concreteOct,
    'Waelcon с 01.10.2026: М350 — 45 000 ֏/м³ с НДС и доставкой до 15 км (зимой до +5 000); HSKA — 39 500 ֏/м³ (НДС и доставка не указаны — уточните звонком); MM Leader — дешевле, но без НДС'), verifiedAt: OCT },
  { ...quoted('concrete_b30', 'Бетон B30 / М400', 'Բետոն B30 / М400', 'м³', { min: 42500, typical: 47500, max: 52500 }, 18000, Q.concreteOct,
    'Waelcon с 01.10.2026: М400 — 47 500 ֏/м³ с НДС и доставкой до 15 км (зимой до +5 000); HSKA — 42 500 ֏/м³ (НДС и доставка не указаны — уточните звонком); MM Leader — дешевле, но без НДС'), verifiedAt: OCT },
  { ...quoted('concrete_blinding', 'Подбетонка М100', 'Ենթաբետոն М100', 'м³', { min: 29000, typical: 34000, max: 39000 }, 8000, Q.concreteOct,
    'Waelcon с 01.10.2026: М100 — 34 000 ֏/м³ с НДС и доставкой; HSKA — 29 000 ֏/м³ (условия не указаны)'), verifiedAt: OCT },

  // --- Rebar (AMD/т) ---
  // RMS Group price list: A500C 12–32 mm 305 000, 8–10 mm 315 000 ֏/t; a house
  // is ~70% main bars and ~30% ties. Stalmetgroup 12 mm: 300.72 ֏/m ≈ 339 000.
  { ...quoted('rebar_a500', 'Арматура А500С', 'Արմատուր А500С', 'т', { min: 305000, typical: 305000, max: 335000 }, 60000, Q.rebarOct,
    'RMS Group: Ø12 — 305 000 ֏/т; Mikmetal и Karakert Steel 320 000–330 000 ֏/т с НДС; Erkat Proff 335 000 ֏/т'), verifiedAt: OCT },
  { ...quoted('rebar_a400', 'Арматура А400 (A-III)', 'Արմատուր А400', 'т', { min: 300000, typical: 300000, max: 300000 }, 60000, Q.rebarOct,
    'Mikmetal: A400C в бухтах Ø8/10 — 300 000 ֏/т'), verifiedAt: OCT },

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
  // Utility unit-price lists for excavator work (Gazprom Armenia, Veolia Jur,
  // June 2026): trench in category III soil 651 ֏/m³, 723 with profit, + VAT.
  { ...quoted('excavation', 'Выемка грунта экскаватором', 'Հողի փորում էքսկավատորով', 'м³', { min: 0, typical: 0, max: 0 }, 868, Q.earthRates,
    'расценки Газпром Армения: траншея экскаватором, грунт III кат. — 723 ֏/м³ с прибылью, без НДС (II кат. 579, V кат. 1 266); с НДС 868 ֏/м³; Veolia Jur, июнь 2026: 730 ֏/м³'), verifiedAt: OCT },
  { ...quoted('backfill', 'Обратная засыпка экскаватором', 'Հետլիցք էքսկավատորով', 'м³', { min: 0, typical: 0, max: 0 }, 868, Q.earthRates,
    'расценки Газпром Армения: обратная засыпка траншеи экскаватором, грунт III кат. — 723 ֏/м³ с прибылью, без НДС; с НДС 868 ֏/м³'), verifiedAt: OCT },
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
  // two layers of a bitumen roll: Bikrost ХКП 970 ֏/m² (Erkat Proff); economy
  // Stekloizol 650; ShinShin ХКП 10 200 + ТКП 12 500 per 10 m²
  { ...quoted('waterproofing', 'Гидроизоляция (2 слоя)', 'Հիդրոմեկուսացում (2 շերտ)', 'м²', { min: 1300, typical: 1940, max: 2270 }, 1500, Q.roofRolls,
    'Erkat Proff: Бикрост ХКП 970 ֏/м², в два слоя 1 940; Стеклоизол 650 ֏/м²; ShinShin: ХКП 10 200 и ТКП 12 500 ֏ за 10 м²'), verifiedAt: OCT },
  // per m² at 100 mm: EPS grade I 1 556 (facade), stone wool 2 640, XPS 4 342.
  // The facade takes EPS (or wool), the flat roof and the floor on ground take
  // XPS: one averaged price under-paid the roof and over-paid the facade.
  { ...quoted('insulation', 'Утеплитель фасада', 'Ֆասադի ջերմամեկուսիչ', 'м²', { min: 1556, typical: 1556, max: 2640 }, 4000, [...Q.insulation, 'https://turn.am/service/jermamekusacum-ev-dzaynamekusacman-carayutyun/detail'],
    'за м² при 100 мм: пенопласт I сорта 1 556 ֏; каменная вата 2 640 ֏; монтаж утеплителя — от 4 000 ֏/м² (Turn.am)'), verifiedAt: OCT },
  { ...quoted('insulation_xps', 'Утеплитель XPS (кровля, пол по грунту)', 'Ջերմամեկուսիչ XPS (տանիք, հատակ)', 'м²', { min: 4342, typical: 4342, max: 5990 }, 2000, [...Q.insulation, ...Q.xps],
    'за м² при 100 мм: 4 342 ֏ (сверка 26.09.2026); ShinShin TechnoNICOL Carbon Eco 4 100 ֏ за плиту 0,68 м² ≈ 5 990 ֏/м²'), verifiedAt: OCT },
  // 6 cm 1:3 screed: 0.54 bag of cement + 0.07 m³ of sand + fibre
  derived('screed', 'Стяжка пола', 'Հատակի շաղախ', 'м²', { min: 1800, typical: 2100, max: 2600 }, 3000, [...Q.cement, ...Q.screedOct],
    'ОЦЕНКА из сверенных цен: стяжка 6 см 1:3 — 0.54 мешка цемента + 0.07 м³ песка + фибра; работа 3 000–5 000 ֏/м² (Turn.am 2026), выравнивание 4 000 (NewHome)'),

  // --- Openings ---
  // FarmPlast (Flagma, 27.07.2026): windows from 25 000–35 000 ֏/m²
  { ...quoted('window_regular', 'Окно обычное (поворотно-откидное)', 'Պատուհան սովորական', 'м²', { min: 24000, typical: 32000, max: 40000 }, 8000, [...Q.windowsOct, ...Q.windows],
    'list.am: глухое 24 000, поворотно-откидное 32 000, распашное 40 000 ֏/м²; FarmPlast от 24 000 ֏/м² (18.10.2026); монтаж 8 000 ֏/м² не сверен'), verifiedAt: OCT },
  item('window_vitrage', 'Окно витражное', 'Վիտրաժ պատուհան', 'м²', 90000, 12000, S.market),
  // Domus: steel entrance doors JW 49 900–73 400 ֏
  { ...quoted('door_exterior', 'Дверь входная', 'Մուտքի դուռ', 'шт', { min: 49900, typical: 49900, max: 73400 }, 10000, Q.doorsOct,
    'Domus: Jaway JW-101 2050×960 — 49 900 ֏, JW-102 57 900, JW-502 73 400 ֏; установка от 9 000–10 000 ֏ (Turn.am)'), verifiedAt: OCT },
  // Nor Tun: Velldoris leaf 40 800–42 320 ֏ + frame, trims and hardware
  { ...quoted('door_interior', 'Дверь межкомнатная', 'Ներսի դուռ', 'шт', { min: 36000, typical: 36000, max: 70000 }, 10000, [...Q.doorsOct, ...Q.doorInterior],
    'Nor Tun: полотно Unidoors FM07-ECO 22 000 ֏ (Velldoris 22 960) + коробка, наличники и фурнитура ≈ 14 000 ֏ (Nor Tun, 26.09.2026); установка от 9 000–10 000 ֏ (Turn.am)'), verifiedAt: OCT },

  // PVC sill from 20 000 ֏/m² (≈ 6 000 ֏/m at 30 cm) + steel drip sill
  // 605–1 205 ֏/m outside; fitted with the window
  estimate('window_sills', 'Подоконники и отливы', 'Պատուհանագոգեր և արտաքին ջրահոսքեր', 'пог.м', 7000, 1500,
    'ОЦЕНКА — ПВХ подоконник 30 см (от 20 000 ֏/м²) + стальной отлив (605–1 205 ֏/м); монтаж ~1 500 ֏/м'),

  // --- Finishing ---
  // gypsum plaster ~2 cm (30 kg bag 1 900–2 350 ֏), putty, primer, two coats of SHEN W (8 700 ֏ / 10 l)
  // labour: plastering from 3 000 + levelling and painting from 3 500 ֏/m² (NewHome, 26.10.2026)
  // gypsum plaster ~18 kg/m² at 2 cm (Shen Ecogyps 1 750 ֏ per 30 kg), putty
  // (Tsiatsan 3 300 per 25 kg), primer, two coats of SHEN W (9 000 per 10 l)
  derived('plaster', 'Штукатурка/шпаклёвка/покраска', 'Սվաղ/ներկ', 'м²', { min: 1500, typical: 1500, max: 2500 }, 6500, [...Q.finishOct, ...Q.labour],
    'из прайсов: гипсовая штукатурка 2 см (Shen Ecogyps 1 750 ֏ за 30 кг, ~18 кг/м²), шпаклёвка Tsiatsan 3 300 ֏ за 25 кг, грунт, 2 слоя SHEN W (9 000 ֏ за 10 л); работа: штукатурка от 3 000 + шпаклёвка и покраска от 3 500 ֏/м²'),
  // Bathroom walls are tiled to 2.4 m. Tile 10 040–20 000 ֏/m², laying from
  // 10 000 ֏/m² (NewHome); glue and grout ~1 500 ֏/m².
  derived('wall_tile', 'Плитка на стенах санузлов', 'Սանհանգույցի պատերի սալիկ', 'м²', { min: 4100, typical: 4100, max: 21500 }, 10000, [...Q.floorsOct, ...Q.labour],
    'Domus: настенная плитка Negar Makan 30×60 — 2 590 ֏/м² + клей и затирка ~1 500; укладка 8 000–15 000 ֏/м² (Turn.am 2026), от 10 000 (NewHome)'),
  // A monolithic stair has its own tread finish: porcelain tile on treads and
  // risers, ~10 m² per two-flight stair with its landing.
  derived('stair_finish', 'Облицовка лестницы (керамогранит)', 'Աստիճանի երեսպատում (կերամոգրանիտ)', 'м²', { min: 5600, typical: 5600, max: 21500 }, 15000, [...Q.floorsOct, ...Q.labour],
    'Domus: керамогранит 60×60 Negin — 4 100 ֏/м² + клей ~1 500; укладка на ступенях — ОЦЕНКА 15 000 ֏/м² (на полу 8 000–15 000)'),
  // laminate 8 mm 6 500 ֏/m² + underlay and skirting; porcelain tile in wet rooms
  // laminate 8 mm Kastamonu 4 290 ֏/m² (Egger 4 690) + underlay and skirting
  // ~1 300; porcelain 60×60 4 100 in wet rooms and kitchen. Laying: laminate
  // 3 500, tile 10 000 ֏/m² — ~20% of the floor is tiled.
  { ...quoted('floor_finish', 'Напольное покрытие', 'Հատակածածկ', 'м²', { min: 5100, typical: 5600, max: 9800 }, 4800, [...Q.floorsOct, ...Q.points],
    'Domus: ламинат 8 мм Kastamonu 4 290, Egger 4 690 ֏/м² + подложка и плинтус ~1 300; керамогранит 60×60 4 100 ֏/м²; укладка ламината 3 500, плитки 10 000 ֏/м² (FastModernHouse), плитка ~20% пола'), verifiedAt: OCT },
  // Thin-coat facade over the insulation, from ShinShin and Domus prices and
  // Ceresit consumption: adhesive and base coat CT85 ~9 kg/m² (9 900 ֏ per
  // 25 kg), mesh ×1.1 (Knauf 21 800 ֏ per 50 m²), CT35 "bark" 2.0 kg/m² at
  // 2.5 mm (9 700 ֏ per 25 kg), primer ~0.15 l/m², two coats of facade paint
  // ~0.3 l/m² (Shen F 17 900 ֏ per 10 l). Labour: no facade rate was found;
  // interior decorative plaster is 5 000 ֏/m² (FastModernHouse).
  // Thermo Universal adhesive/base coat ~9 kg/m² (7 000 per 25 kg), Knauf mesh
  // (14 500 per 50 m²) ×1.1, Volma bark render 2 kg/m² (7 080 per 25 kg),
  // primer, Fiore facade paint (9 200 per 12.5 kg)
  derived('facade', 'Фасадная отделка (тонкослойная штукатурка)', 'Ֆասադի հարդարում (բարակ սվաղ)', 'м²', { min: 3900, typical: 3900, max: 7700 }, 6000, [...Q.facadeSystem, ...Q.finishOct],
    'из прайсов ShinShin и Nor Tun: клей/базовый слой Ceresit Thermo Universal ~9 кг/м² (7 000 ֏ за 25 кг), сетка Knauf (14 500 ֏ за 50 м²), «короед» Volma 2 кг/м² (7 080 ֏ за 25 кг), грунт, краска Fiore (9 200 ֏ за 12,5 кг); работа «от 6 000 ֏/м²» (Turn.am) — слабое подтверждение'),

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
  // Per point drawn on the plans. Material: a device (Legrand Valena socket
  // 1 500–1 900, Makel switch 630 ֏; none at a light point) + 10 m of VVG
  // (3×1.5 370, 3×2.5 530 ֏/m, Vida) + 10 m of conduit (120–150 ֏/m).
  // Labour as itemised by FastModernHouse: pulling the wire 5 000 + the device
  // 3 500 + the box 1 000 ֏; cheaper all-in quotes start at 4 000 (Varpet).
  // Per point: Vesta socket 580 or switch 530 ֏ (none at a light), 10 m of
  // SEDARA VVG (3×2.5 470, 3×1.5 280 ֏/m), 10 m of conduit (100 ֏/m).
  derived('electrical', 'Электроточка (розетка, выключатель, свет)', 'Էլեկտրական կետ', 'точка', { min: 5300, typical: 5300, max: 9600 }, 4000, [...Q.elecOct, ...Q.points],
    'из прайсов: розетка Vesta 580 ֏ (Domus) или выключатель 530 ֏, кабель ВВГ SEDARA 3×2,5 470 и 3×1,5 280 ֏/м, гофра 100 ֏/м (по 10 м на точку — допущение); монтаж от 4 000 ֏ за точку (NewHome), 2 500–5 000 (Turn.am 2026), по позициям до 9 500 (FastModernHouse)'),
  // IEK 36-module board 24 000, 18 breakers 660–1 200, 3 RCDs Legrand 8 300 ֏;
  // fitting: the board 15 000 + 5 000 ֏ a breaker (FastModernHouse).
  derived('electrical_panel', 'Электрощит с автоматами и УЗО', 'Էլեկտրական վահանակ', 'компл', { min: 49900, typical: 49900, max: 84400 }, 105000, [...Q.elecOct, ...Q.points],
    'из прайсов ShinShin: щит GENERICA 36 модулей 11 940 ֏, 18 автоматов IEK по 1 010, 3 УЗО GENERICA по 6 600 ֏ (число автоматов — допущение); монтаж щита 15 000 + 5 000 ֏ за автомат (FastModernHouse)'),
  // Per fixture: hot and cold PPR 20 mm, 8 m each (390 ֏/m, ShinShin); the
  // point is laid for 10 000 ֏ (FastModernHouse, Varpet).
  derived('plumbing', 'Водопроводная точка (ГВС + ХВС)', 'Ջրի կետ', 'точка', { min: 6240, typical: 6240, max: 10400 }, 10000, [...Q.ppr, ...Q.points],
    'из прайсов: труба PPR 20 мм 390 ֏/м (ShinShin), 2 × 8 м на точку (длина — допущение, уточнить по проекту ВК); монтаж 10 000 ֏ за точку (FastModernHouse, Varpet)'),
  derived('sewer_points', 'Канализационная точка', 'Կոյուղու կետ', 'точка', { min: 1140, typical: 1140, max: 3500 }, 10000, [...Q.ppr, ...Q.points],
    'из прайсов: труба ПВХ 50 мм 759 ֏ за 2 м (Erkatproff), ~3 м на точку + стояки 110 мм 4 071 ֏ за 4 м (длина — допущение); монтаж 10 000 ֏ за точку (FastModernHouse)'),
  // The boiler room: BAXI ECO4S 24 kW with flue 350 000 (Ferossi 240 000,
  // Ariston 389 000), a 24 L expansion tank 13 500, a Grundfos UPS 25-60
  // pump 59 000 ֏; fitting the boiler 15 000 ֏ (katsa.am). The pipes run
  // with each radiator or floor loop.
  derived('heating', 'Котельная: газовый котёл, бак, насос', 'Կաթսայատուն՝ գազի կաթսա, բաք, պոմպ', 'компл', { min: 228800, typical: 228800, max: 422500 }, 15000, [...Q.heatOct, ...Q.boiler],
    'из прайсов: котёл Ferossi EXN24 (двухконтурный) 164 500 ֏ + дымоход 7 900 (ShinShin); бак 24 л 13 500 ֏, насос Grundfos UPS 25-60 130 мм 42 858 ֏ (Santex House); BAXI ECO4S с дымоходом — 350 000 ֏; монтаж котла 15 000 ֏'),
  // One radiator under each ordinary window. Bimetal 500 mm, 10 sections:
  // 21 930–36 176 ֏ (Stalmetgroup, ShinShin), up to 55 100 (Corvette, Chip and
  // Dip); thermostatic valve 2 540 + return valve 1 920–4 900 ֏ (Domus, Valfex).
  // Fitting is paid per point: 10 000–12 000 ֏ (Varpet, NewHome).
  derived('radiators', 'Радиатор с краном, термоголовкой и подводкой', 'Ռադիատոր՝ փականով, թերմոգլխիկով և խողովակով', 'шт', { min: 35300, typical: 35300, max: 88000 }, 10000, [...Q.heatOct, ...Q.radiators],
    'из прайсов: биметалл Therma 500 мм 10 секций 21 930 ֏ (Стальметгрупп), посекционно Royal/Eclipse 5 100–6 600 ֏ за секцию; термоклапан 2 540 (Domus) + термоголовка 2 043 (ShinShin) + нижний кран 1 920 (Valfex); подводка 20 м металлопластика 344 ֏/м (длина — допущение); подключение 10 000 ֏ за точку'),
  // Domus, 26.10.2026: WC 45 900–167 900, vanity with basin 89 900–290 000,
  // acrylic bath 50 100–145 900, Grohe mixers 39 000–69 000, shower set
  // 13 900–40 900 ֏. The water points themselves are in the plumbing line.
  derived('sanitary_set', 'Сантехника санузла (унитаз, раковина, душевой поддон, смесители)', 'Սանտեխնիկա (զուգարանակոնք, լվացարան, ցնցուղ)', 'компл', { min: 144600, typical: 144600, max: 714000 }, 30000, [...Q.sanitaryOct, ...Q.sanitary, ...Q.points],
    'Nor Tun: унитаз Santek Pallada 33 900 ֏; Domus: тумба с раковиной 49 900, поддон Triton 80×80 38 900 ֏; смесители Kaldo 10 000 + 11 900 ֏; душевое ограждение не входит; установка: унитаз 10 000, раковина 10 000, смесители по 5 000 ֏'),
  estimate('gas_internal', 'Внутренний газопровод (от счётчика)', 'Ներքին գազատար', 'компл', 150000, 60000,
    'ОЦЕНКА — труба от счётчика до котла и плиты, краны, проект; врезка и счётчик — в подключении газа'),

  // --- Optional premium systems (opt-in extras) ---
  // Warm floor is an extra on top of the base heating line (boiler, pipes,
  // radiators), not a second boiler.
  // Pipe at 15 cm spacing is 1 / 0.15 = 6.7 m per m²: 500–600 ֏/m (Kelvin,
  // Santex House) → 3 330–4 000 ֏/m². A loop serves ~15 m² (≤100 m of pipe),
  // a manifold outlet costs 11 000 ֏ (Kelvin, 4 outlets 44 000) → 730 ֏/m²;
  // one mixing unit (105 000 ֏, Kelvin) per floor → ~830 ֏/m² here. Laying
  // from 5 000 (Varpet) to 8 000 (NewHome) ֏/m².
  derived('opt_boiler_heating', 'Тёплый пол (вместо радиаторов)', 'Տաք հատակ (ռադիատորների փոխարեն)', 'м²', { min: 2700, typical: 2700, max: 5300 }, 6500, [...Q.ufhOct, ...Q.floorHeating],
    'из прайсов: труба PE-RT 16 мм 330 ֏/м (Vida) × 6,7 м/м² (шаг 15 см), коллектор STI на 4 выхода 11 300 ֏ (~15 м² на петлю), смесительный узел Эльф 42 040 ֏ на этаж (ShinShin); монтаж 5 000–8 000 ֏/м² (один подрядчик, два прайса)'),
  // electro.am: air-water units 12–18 kW 1 750 000–1 900 000 ֏ (Riello Family
  // Sprint, TICA 18 kW), equipment only
  derived('opt_heat_pump', 'Тепловой насос (воздух-вода)', 'Ջերմային պոմպ (օդ-ջուր)', 'компл', { min: 1375000, typical: 1750000, max: 1900000 }, 600000, Q.heatPump,
    'Riello Family Sprint 12 кВт — 1 750 000 ֏ (electro.am); HIEN 10 кВт — 1 375 000 ֏ (официальный представитель, list.am 17.10.2026); монтаж с буфером и обвязкой ~600 000 ֏ — ОЦЕНКА'),
  // A heat pump makes hot water through an indirect cylinder; a gas combi
  // boiler of the base heating line makes it itself.
  { ...quoted('dhw_cylinder', 'Бойлер косвенного нагрева 200 л', 'Անուղղակի տաքացման բաք 200 լ', 'шт', { min: 286000, typical: 286000, max: 373000 }, 40000, [...Q.cylOct, ...Q.cylinder],
    'list.am: ECOLIQ 200 л с двумя змеевиками — 286 000 ֏ (17.10.2026); Apamet 200 л 288 500, 300 л 373 000 ֏ (ShinShin); монтаж ~40 000 ֏ — ОЦЕНКА'), verifiedAt: OCT },
  { ...quoted('opt_fancoil', 'Фанкойл', 'Ֆանկոյլ', 'шт', { min: 65000, typical: 92000, max: 192000 }, 25000, [...Q.fancoilOct, ...Q.fanCoil],
    'Midea MKH2: 92 000–192 000 ֏; Air-Con Berg FR-09 (малый) 65 000 ֏ (list.am 19.10.2026); монтаж ~25 000 ֏ — ОЦЕНКА'), verifiedAt: OCT },
  // Deye SE-G5.1 Pro-B: 518 000 ֏ per 5.12 kWh LiFePO4 module
  { ...quoted('opt_battery', 'Аккумулятор LiFePO4', 'LiFePO4 կուտակիչ', 'кВт·ч', { min: 101000, typical: 101000, max: 101000 }, 5000, Q.battery,
    'Solaron: Deye SE-G5.1 Pro-B 5,12 кВт·ч — 518 000 ֏; монтаж и пусконаладка ~5 000 ֏/кВт·ч (оценка); гибридный инвертор — отдельно, если станция сетевая'), verifiedAt: OCT },
  // A battery needs a hybrid inverter: Deye 10 kW 890 000 (one phase),
  // 930 000–950 000 ֏ (three phase), list.am 2026
  { ...quoted('opt_hybrid_inverter', 'Гибридный инвертор (для аккумулятора)', 'Հիբրիդ ինվերտոր', 'шт', { min: 890000, typical: 890000, max: 950000 }, 0, Q.inverter,
    'list.am: Deye 10 кВт однофазный — 890 000 ֏ (06.06.2026), трёхфазный 930 000–950 000 ֏; монтаж — вместе с солнечной станцией'), verifiedAt: OCT },
  { ...quoted('opt_ev_charger', 'Зарядка электромобиля (wallbox)', 'Էլեկտրամեքենայի լիցքավորիչ', 'шт', { min: 180000, typical: 180000, max: 300000 }, 35000, Q.evCharger,
    'evolt.am Wattsaving 7 кВт — 180 000 ֏; Bull Electric 200 000; Solaron Mira 226 000; Star Charge 300 000 ֏; монтаж ~35 000 ֏ — ОЦЕНКА'), verifiedAt: OCT },
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
  // Rent per month, one month per use: slab formwork 4 150, wall and foundation
  // 5 400 ֏/m² (Accurate Group); metal panels 195 ֏/m² a day (HouseMaster).
  // The carpenters are in the brigade rate.
  derived('formwork', 'Опалубка (аренда)', 'Կաղապար (վարձույթ)', 'м²', { min: 4150, typical: 4500, max: 5400 }, 2500, Q.formworkRent,
    'аренда в месяц: перекрытия 4 150, стены и фундамент 5 400 ֏/м² (Accurate Group), щиты 195 ֏/м² в сутки (HouseMaster, 13.10.2026); один оборот = месяц аренды (допущение); монтаж — в ставке бригады'),
  // Waelcon: a 22 m pump 80 000 ֏ a call + 3 000 ֏/m³; MM Leader: 37 m,
  // 70 000 ֏ up to 20 m³ + 3 000 ֏/m³ (without VAT).
  { ...quoted('concrete_pump', 'Подача бетона насосом (за м³)', 'Բետոնի մատակարարում պոմպով (խ.մ)', 'м³', { min: 3000, typical: 3000, max: 3600 }, 0, Q.concreteVat,
    'Waelcon: 3 000 ֏ за каждый м³ сверх 20 м³ выезда (с НДС); MM Leader: 70 000 ֏ за 1–20 м³, далее 3 000 ֏/м³ без НДС'), verifiedAt: OCT },
  { ...quoted('pump_call', 'Выезд бетононасоса', 'Բետոնապոմպի կանչ', 'выезд', { min: 70000, typical: 80000, max: 96000 }, 0, Q.concreteVat,
    'Waelcon: насос 22 м — 80 000 ֏ за выезд, до 20 м³ (с НДС); MM Leader: 37 м — 70 000 ֏ до 20 м³ (без НДС); qarshak.am — от 50 000 ֏'), verifiedAt: OCT },

  // --- Вентиляция и электробезопасность (обязательны, ранее отсутствовали) ---
  // An extract fan in each bathroom and the kitchen: Vents 100D 6 650 (ERA
  // 4 500) ֏ + 3 m of 125 mm duct (5 200 ֏ per 2 m, Lanka); wired like an
  // electrical point (5 000 ֏, FastModernHouse).
  derived('ventilation', 'Вытяжка: вентилятор с воздуховодом', 'Օդահանում՝ օդափոխիչ և օդատար', 'шт', { min: 11750, typical: 11750, max: 16250 }, 5000, [...Q.fansOct, ...Q.vent, ...Q.points],
    'из прайсов: вентилятор Granit 100 мм 3 950 ֏ (ShinShin) + 3 м воздуховода 125 мм (5 200 ֏ за 2 м, Lanka; длина — допущение); подключение 5 000 ֏ (FastModernHouse)'),
  estimate('lightning', 'Молниезащита и заземление', 'Կայծակապաշտպանություն և հողանցում', 'компл', 180000, 60000,
    'ОЦЕНКА — зависит от контура заземления и грунта'),

  // --- Подключение к инженерным сетям (техусловия + врезка) ---
  // Это отдельные платежи сетевым организациям, они НЕ входят в стоимость
  // внутренних сетей дома (electrical / plumbing / heating).
  // PSRC standard connection fees for a private house in Yerevan (after
  // 27.04.2026): single phase 14 kVA 199 000 ֏; 0.4 kV 229 000 + 16 000 ֏ per
  // kVA. Outside Yerevan: 140 000, and 229 000 + 9 000 per kVA.
  { ...quoted('conn_electricity', 'Подключение электричества, 1 фаза 14 кВА', 'Էլեկտրաէներգիայի միացում, միաֆազ 14 կՎԱ', 'компл', { min: 140000, typical: 199000, max: 199000 }, 0, Q.psrc,
    'КРОУ (psrc.am): стандартная плата для дома, 14 кВА — 199 000 ֏ в Ереване, 140 000 ֏ в других местах; плюс местные пошлины за разрешение'), provenance: 'official' as const, verifiedAt: OCT },
  { ...quoted('conn_electricity_3ph', 'Подключение электричества, 0,4 кВ (3 фазы)', 'Էլեկտրաէներգիայի միացում, 0,4 կՎ', 'кВА', { min: 9000, typical: 16000, max: 16000 }, 0, Q.psrc,
    'КРОУ (psrc.am): 229 000 ֏ + 16 000 ֏ за кВА в Ереване (9 000 ֏ в других местах); постоянная часть — отдельной строкой'), provenance: 'official' as const, verifiedAt: OCT },
  { ...quoted('conn_electricity_3ph_base', 'Подключение 0,4 кВ: постоянная часть', 'Միացում 0,4 կՎ՝ հաստատուն մաս', 'компл', { min: 229000, typical: 229000, max: 229000 }, 0, Q.psrc,
    'КРОУ (psrc.am): постоянная часть платы за подключение 0,4 кВ — 229 000 ֏'), provenance: 'official' as const, verifiedAt: OCT },
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
  excavation: 'Excavation by excavator',
  backfill: 'Backfill by excavator',
  apron: 'Blind area',
  waterproofing: 'Waterproofing (2 layers)',
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
  opt_hybrid_inverter: 'Hybrid inverter (for the battery)',
  electrical_panel: 'Distribution board with breakers and RCDs',
  sewer_points: 'Sewer point',
  pump_call: 'Concrete pump call-out',
  conn_electricity_3ph: 'Electricity connection 0.4 kV (per kVA)',
  conn_electricity_3ph_base: 'Electricity connection 0.4 kV: fixed part',
  screed: 'Floor screed',
  window_regular: 'Window (tilt-and-turn)',
  window_vitrage: 'Window (curtain wall)',
  door_exterior: 'Entrance door',
  door_interior: 'Interior door',
  plaster: 'Plaster / putty / paint',
  floor_finish: 'Floor covering',
  facade: 'Facade finish (thin-coat render)',
  roof_slope: 'Roof slope screed (lightweight concrete)',
  roof_flat: 'Flat roof',
  roof_pitched: 'Pitched roof',
  electrical: 'Electrical point (socket, switch, light)',
  plumbing: 'Water point (hot + cold)',
  heating: 'Boiler room: gas boiler, tank, pump',
  radiators: 'Radiator with valves and pipe run',
  opt_boiler_heating: 'Underfloor heating (instead of radiators)',
  opt_mvhr: 'Ventilation with heat recovery (extra)',
  opt_heat_pump: 'Heat pump (air-water)',
  opt_solar: 'Solar panels (photovoltaic)',
  opt_finish_premium: 'Turnkey finishing',
  opt_panel_ceiling: 'Panel ceiling',
  stair: 'Monolithic staircase',
  glass_partition: 'Sliding glass partition',
  railing: 'Gallery and stair railings',
  formwork: 'Formwork (rental)',
  concrete_pump: 'Concrete pumping (per m³)',
  ventilation: 'Extract fan with duct',
  lightning: 'Lightning protection & earthing',
  conn_electricity: 'Electricity connection, 1 phase 14 kVA',
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
