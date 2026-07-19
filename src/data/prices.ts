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
  item('concrete_blinding', 'Подбетонка М100', 'Ենթաբետոն М100', 'м³', 30000, 8000, S.concrete),

  // --- Rebar (AMD/т) ---
  item('rebar_a500', 'Арматура А500С', 'Արմատուր А500С', 'т', 350000, 60000, S.rebar),
  item('rebar_a400', 'Арматура А400 (A-III)', 'Արմատուր А400', 'т', 330000, 60000, S.rebar),

  // --- Masonry ---
  item('tuff_block', 'Туф (кладка)', 'Տուֆ (շարվածք)', 'м³', 38000, 15000, S.market),
  item('aerated_block', 'Газоблок', 'Գազաբլոկ', 'м³', 42000, 12000, S.block, 'list.am — проверить вручную'),
  item('brick', 'Кирпич (кладка)', 'Աղյուս (շարվածք)', 'м³', 55000, 18000, S.market),
  item('mortar', 'Раствор кладочный', 'Շաղախ', 'м³', 20000, 0, S.market),
  item('glue_aerated', 'Клей для газоблока', 'Գազաբլոկի սոսինձ', 'м³', 150000, 0, S.market),

  // --- Floors ---
  item('precast_slab', 'Плита перекрытия ПК', 'Ծածկի սալ ПК', 'шт', 45000, 8000, S.market),

  // --- Aggregates / bedding ---
  item('sand_gravel', 'Песок/щебень подсыпка', 'Ավազ/խիճ', 'м³', 8000, 3000, S.market),

  // --- Earthworks ---
  item('excavation', 'Выемка грунта', 'Հողի փորում', 'м³', 0, 4000, S.market),
  item('backfill', 'Обратная засыпка', 'Հետլիցք', 'м³', 0, 3000, S.market),
  item('apron', 'Отмостка', 'Հատակաշի', 'м²', 6000, 4000, S.market),

  // --- Waterproofing / insulation / screed ---
  item('waterproofing', 'Гидроизоляция', 'Հիդրոմեկուսացում', 'м²', 2500, 1500, S.market),
  item('insulation', 'Утеплитель', 'Ջերմամեկուսիչ', 'м²', 4000, 2000, S.market),
  item('screed', 'Стяжка пола', 'Հատակի շաղախ', 'м²', 3500, 2500, S.market),

  // --- Openings ---
  item('window_regular', 'Окно обычное', 'Պատուհան սովորական', 'м²', 55000, 8000, S.market),
  item('window_vitrage', 'Окно витражное', 'Վիտրաժ պատուհան', 'м²', 90000, 12000, S.market),
  item('door_exterior', 'Дверь входная', 'Մուտքի դուռ', 'шт', 180000, 15000, S.market),
  item('door_interior', 'Дверь межкомнатная', 'Ներսի դուռ', 'шт', 60000, 10000, S.market),

  // --- Finishing ---
  item('plaster', 'Штукатурка/шпаклёвка/покраска', 'Սվաղ/ներկ', 'м²', 2500, 3000, S.market),
  item('floor_finish', 'Напольное покрытие', 'Հատակածածկ', 'м²', 12000, 6000, S.market),
  item('facade', 'Фасадная отделка', 'Ֆասադի հարդարում', 'м²', 9000, 6000, S.market),

  // --- Roof ---
  item('roof_flat', 'Кровля плоская', 'Հարթ տանիք', 'м²', 9000, 5000, S.market),
  item('roof_pitched', 'Кровля скатная', 'Թեք տանիք', 'м²', 14000, 8000, S.market),

  // --- Engineering networks (per m2 of total floor area) ---
  item('electrical', 'Электрика', 'Էլեկտրագծեր', 'м²', 9000, 7000, S.market),
  item('plumbing', 'Водопровод/канализация', 'Ջրամատակարարում', 'м²', 8000, 7000, S.market),
  item('heating', 'Отопление', 'Ջեռուցում', 'м²', 12000, 8000, S.market),

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

export const SEED_PRICES: Catalog = Object.fromEntries(items.map((it) => [it.key, it]))

export const AMD_PER_USD_DEFAULT = 385
