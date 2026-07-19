import type { Catalog, PriceItem } from '../model/catalog'

const S = {
  concrete: ['mmlider.am'],
  rebar: ['stalmetural.am', 'met-trans.am'],
  block: ['list.am'],
  market: ['Рыночные данные РА', 'minfin.am'],
}

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
    materialTypical: typical,
    materialMin: Math.round(typical * 0.9),
    materialMax: Math.round(typical * 1.15),
    labor,
    sources,
    note,
  }
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
    sources: ['urban.e-gov.am', 'minurban.am'],
    note: 'ориентир, уточните на urban.e-gov.am',
  }
}

const items: PriceItem[] = [
  // --- Concrete (AMD/m3, without VAT; real prices from my-home project) ---
  item('concrete_b15', 'Бетон B15 / М200', 'Բետոն B15 / М200', 'м³', 29000, 18000, S.concrete),
  item('concrete_b20', 'Бетон B20 / М250', 'Բետոն B20 / М250', 'м³', 30000, 18000, S.concrete),
  item('concrete_b225', 'Бетон B22.5 / М300', 'Բետոն B22.5 / М300', 'м³', 32000, 18000, S.concrete),
  item('concrete_b25', 'Бетон B25 / М350', 'Բետոն B25 / М350', 'м³', 34000, 18000, S.concrete),
  item('concrete_b30', 'Бетон B30 / М400', 'Բետոն B30 / М400', 'м³', 36000, 18000, S.concrete),
  item('concrete_blinding', 'Подбетонка М100', 'Ենթաբетон М100', 'м³', 25000, 8000, S.concrete),

  // --- Rebar (AMD/т) ---
  item('rebar_a500', 'Арматура А500С', 'Արմատուր А500С', 'т', 350000, 60000, S.rebar),
  item('rebar_a400', 'Арматура А400 (A-III)', 'Արմատուր А400', 'т', 330000, 60000, S.rebar),

  // --- Masonry ---
  item('tuff_block', 'Туф (кладка)', 'Տուֆ (շարվածք)', 'м³', 38000, 15000, S.market),
  item('aerated_block', 'Газоблок', 'Գազաբլոկ', 'м³', 42000, 12000, S.block, 'list.am — проверить вручную'),
  item('brick', 'Кирпич (кладка)', 'Աղյուս (շարվածք)', 'м³', 55000, 18000, S.market),
  item('mortar', 'Раствор кладочный', 'Շաղախ', 'м³', 18000, 0, S.market),
  item('glue_aerated', 'Клей для газоблока', 'Գազաբլոկի սոսինձ', 'м³', 150000, 0, S.market),

  // --- Floors ---
  item('precast_slab', 'Плита перекрытия ПК', 'Ծածկի սալ ПК', 'шт', 40000, 8000, S.market),

  // --- Aggregates / bedding ---
  item('sand_gravel', 'Песок/щебень подсыпка', 'Ավազ/խիճ', 'м³', 7000, 3000, S.market),

  // --- Earthworks ---
  item('excavation', 'Выемка грунта', 'Հողի փորում', 'м³', 0, 4000, S.market),
  item('backfill', 'Обратная засыпка', 'Հետլիցք', 'м³', 0, 3000, S.market),
  item('apron', 'Отмостка', 'Հատակաշի', 'м²', 6000, 4000, S.market),

  // --- Waterproofing / insulation / screed ---
  item('waterproofing', 'Гидроизоляция', 'Հիդրոմեկուսացում', 'м²', 2500, 1500, S.market),
  item('insulation', 'Утеплитель', 'Ջերմամեկուսիչ', 'м²', 4000, 2000, S.market),
  item('screed', 'Стяжка пола', 'Հատակի շաղախ', 'м²', 3000, 2500, S.market),

  // --- Openings ---
  item('window_regular', 'Окно обычное', 'Պատուհան սովորական', 'м²', 50000, 8000, S.market),
  item('window_vitrage', 'Окно витражное', 'Վիտրաժ պատուհան', 'м²', 90000, 12000, S.market),
  item('door_exterior', 'Дверь входная', 'Մուտքի դուռ', 'шт', 150000, 15000, S.market),
  item('door_interior', 'Дверь межкомнатная', 'Ներսի դուռ', 'шт', 45000, 10000, S.market),

  // --- Finishing ---
  item('plaster', 'Штукатурка/шпаклёвка/покраска', 'Սվաղ/ներկ', 'м²', 2500, 3000, S.market),
  item('floor_finish', 'Напольное покрытие', 'Հատակածածկ', 'м²', 8500, 6000, S.market),
  item('facade', 'Фасадная отделка', 'Ֆասադի հարդարում', 'м²', 9000, 6000, S.market),

  // --- Roof ---
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

  // --- Stair ---
  item('stair', 'Лестница монолитная', 'Աստիճան մոնոլիտ', 'м³', 40000, 30000, S.market),

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
  roof_flat: 'Flat roof',
  roof_pitched: 'Pitched roof',
  electrical: 'Electrical',
  plumbing: 'Plumbing / sewerage',
  heating: 'Heating',
  opt_boiler_heating: 'Heating: boiler + warm floor',
  opt_heat_pump: 'Heat pump (air-water)',
  opt_solar: 'Solar panels (photovoltaic)',
  opt_finish_premium: 'Turnkey finishing',
  stair: 'Monolithic staircase',
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

export const AMD_PER_USD_DEFAULT = 385
