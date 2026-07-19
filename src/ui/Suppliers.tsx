import { useProject } from '../store/useProject'

type L = { ru: string; hy: string; en: string }

interface Supplier {
  name: string
  url: string
  best: L // что у них дёшево / хорошо
  price: L // ориентир цены (что видели)
}

// Собрано в 2026 г. из открытых прайсов и маркетплейсов РА. Цены ориентировочные,
// НДС и доставка зависят от поставщика — всегда уточняйте на месте.
const SUPPLIERS: Supplier[] = [
  {
    name: 'MM Leader',
    url: 'https://mmlider.am/betoni-artadrowtyown',
    best: { ru: 'Бетон и подбетонка — цены завода (дешевле всего)', hy: 'Բետոն և ենթաբետոն — գործարանի գին', en: 'Concrete & blinding — factory prices (cheapest)' },
    price: { ru: 'B25 — 34 000 ֏/м³, M100 — 25 000 ֏/м³ (без НДС)', hy: 'B25 — 34 000 ֏/մ³, M100 — 25 000 ֏/մ³ (առանց ԱԱՀ)', en: 'B25 — 34,000 ֏/m³, M100 — 25,000 ֏/m³ (ex-VAT)' },
  },
  {
    name: 'Waelcon',
    url: 'https://waelcon.am',
    best: { ru: 'Арматура, бетон, инженерка — комплексно на объект', hy: 'Արմատուր, բետոն, ինժեներիա — համալիր', en: 'Rebar, concrete, engineering — one supplier' },
    price: { ru: 'Бетон B25 39 500 ֏/м³ (с НДС, с доставкой)', hy: 'Բետոն B25 39 500 ֏/մ³ (ԱԱՀ-ով)', en: 'Concrete B25 39,500 ֏/m³ (incl. VAT, delivered)' },
  },
  {
    name: 'Stalmetural / Met-Trans',
    url: 'https://stalmetural.am/catalog/armatura/',
    best: { ru: 'Арматура — широкий сортамент, розница', hy: 'Արմատուր — լայն տեսականի', en: 'Rebar — full range, retail' },
    price: { ru: 'A500C ≈ 340 000–360 000 ֏/т (с НДС)', hy: 'A500C ≈ 340 000–360 000 ֏/տ', en: 'A500C ≈ 340,000–360,000 ֏/t (incl. VAT)' },
  },
  {
    name: 'RMS Group',
    url: 'https://rmsgroup.am',
    best: { ru: 'Арматура и утеплитель — импортёр/опт, самые низкие цены', hy: 'Արմատուր և ջերմամեկուսիչ — ներմուծող/մեծածախ', en: 'Rebar & insulation — importer/wholesale, lowest' },
    price: { ru: 'Арматура A500C 288 ֏/кг (≈ 290 000 ֏/т), минвата ≈ 1 200 ֏/м²', hy: 'Արմատուր 288 ֏/կգ, բամբակ ≈ 1 200 ֏/մ²', en: 'Rebar 288 ֏/kg (≈ 290,000 ֏/t), mineral wool ≈ 1,200 ֏/m²' },
  },
  {
    name: 'Domus',
    url: 'https://domus.am',
    best: { ru: 'Ламинат, плитка, межкомнатные двери — дёшево при качестве', hy: 'Լամինատ, սալիկ, ներսի դռներ', en: 'Laminate, tile, interior doors — cheap & good' },
    price: { ru: 'Ламинат от 3 800 ֏/м², дверь MDF от 26 000 ֏', hy: 'Լամինատ 3 800 ֏/մ²-ից, դուռ 26 000 ֏-ից', en: 'Laminate from 3,800 ֏/m², door from 26,000 ֏' },
  },
  {
    name: 'Steel Concern',
    url: 'https://steel.am',
    best: { ru: 'Кровля (профнастил, металлочерепица), фасадный металл', hy: 'Տանիք, ֆասադային մետաղ', en: 'Roofing (profnastil, metal tile), facade metal' },
    price: { ru: 'Профнастил КП-25 ≈ 2 850 ֏/м²', hy: 'Պրոֆնաստիլ КП-25 ≈ 2 850 ֏/մ²', en: 'Profnastil KP-25 ≈ 2,850 ֏/m²' },
  },
  {
    name: 'Vega',
    url: 'https://vega.am',
    best: { ru: 'Входные и межкомнатные двери — большой выбор', hy: 'Մուտքի և ներսի դռներ', en: 'Entrance & interior doors — big range' },
    price: { ru: 'Входная дверь от ≈ 110 000 ֏', hy: 'Մուտքի դուռ ≈ 110 000 ֏-ից', en: 'Entrance door from ≈ 110,000 ֏' },
  },
  {
    name: 'Kargin Shinanyut',
    url: 'https://karginshin.am',
    best: { ru: 'Отделка и общестрой — скидки при объёме', hy: 'Հարդարում — զեղչ ծավալից', en: 'Finishing & general — bulk discounts' },
    price: { ru: 'Договорная, выгодно оптом', hy: 'Պայմանագրային, ձեռնտու մեծածախ', en: 'On request, good wholesale' },
  },
  {
    name: 'Batyanya',
    url: 'https://www.list.am',
    best: { ru: 'Гидроизоляция, теплоизоляция, гипсокартон', hy: 'Հիդրո- և ջերմամեկուսացում, գիպսաստվար', en: 'Waterproofing, insulation, drywall' },
    price: { ru: 'Пеноплэкс 5 см ≈ 2 150 ֏/м², гидроизоляция от 700 ֏/м²', hy: 'Փենոպլեքս 5 սմ ≈ 2 150 ֏/մ²', en: 'Penoplex 5cm ≈ 2,150 ֏/m², membrane from 700 ֏/m²' },
  },
  {
    name: 'ShinShin',
    url: 'https://shinshin.am',
    best: { ru: 'Штукатурка, шпаклёвка, краска — материалы для отделки', hy: 'Սվաղ, շպակլյովկա, ներկ', en: 'Plaster, putty, paint — finishing materials' },
    price: { ru: 'Гипс. штукатурка 1 290 ֏/25 кг, краска 1 690 ֏/5 кг', hy: 'Գիպսե սվաղ 1 290 ֏/25 կգ', en: 'Gypsum plaster 1,290 ֏/25kg, paint 1,690 ֏/5kg' },
  },
  {
    name: 'list.am',
    url: 'https://www.list.am/category/110',
    best: { ru: 'Газоблок, туф, кирпич, песок — маркетплейс (цены договорные)', hy: 'Գազաբլոկ, տուֆ, աղյուս, ավազ', en: 'Aerated block, tuff, brick, sand — marketplace' },
    price: { ru: 'Газоблок D600 ≈ 32 000 ֏/м³, туф ≈ 240 ֏/камень (~16 000 ֏/м³)', hy: 'Գազաբլոկ ≈ 32 000 ֏/մ³, տուֆ ≈ 240 ֏/քար', en: 'Aerated block ≈ 32,000 ֏/m³, tuff ≈ 240 ֏/stone' },
  },
  {
    name: 'Etalon-remont',
    url: 'https://yerevan.etalon-remont.com',
    best: { ru: 'Отделка «под ключ» — комплексная бригада', hy: 'Հարդարում «բանալի» — բրիգադ', en: 'Turnkey finishing — full brigade' },
    price: { ru: '12 000 (косметика) / 17 000 (капитальная) / 22 000 ֏/м² (эксклюзив)', hy: '12 000 / 17 000 / 22 000 ֏/մ²', en: '12,000 / 17,000 / 22,000 ֏/m²' },
  },
]

function pick(l: L, lang: string) {
  return lang === 'hy' ? l.hy : lang === 'en' ? l.en : l.ru
}

export function Suppliers() {
  const { lang } = useProject()
  const title = lang === 'hy' ? 'Որտեղ է էժան · մատակարարներ' : lang === 'en' ? 'Where it’s cheaper · suppliers' : 'Где дешевле · поставщики'
  const colSupplier = lang === 'hy' ? 'Մատակարար' : lang === 'en' ? 'Supplier' : 'Поставщик'
  const colBest = lang === 'hy' ? 'Ինչն է լավ / էժան' : lang === 'en' ? 'What’s good / cheap' : 'Что хорошо / дёшево'
  const colPrice = lang === 'hy' ? 'Ցուցիչ գին' : lang === 'en' ? 'Indicative price' : 'Ориентир цены'
  const note =
    lang === 'hy'
      ? 'Գները ցուցիչ են (2026), ԱԱՀ-ն ու առաքումը կախված են մատակարարից — ճշտեք տեղում։'
      : lang === 'en'
      ? 'Prices are indicative (2026); VAT and delivery depend on the supplier — always confirm on site.'
      : 'Цены ориентировочные (2026), НДС и доставка зависят от поставщика — уточняйте на месте.'

  return (
    <section className="panel" id="suppliers" style={{ marginTop: '1.6rem' }}>
      <div className="panel-head">
        <span>{title}</span>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
          <thead>
            <tr style={{ background: 'var(--color-surface-2)', textAlign: 'left' }}>
              <th style={cell}>{colSupplier}</th>
              <th style={cell}>{colBest}</th>
              <th style={cell}>{colPrice}</th>
            </tr>
          </thead>
          <tbody>
            {SUPPLIERS.map((s) => (
              <tr key={s.name}>
                <td style={cell}>
                  <a href={s.url} target="_blank" rel="noreferrer" style={{ color: 'var(--color-info)', fontWeight: 600, fontFamily: 'var(--font-display)' }}>
                    {s.name}
                  </a>
                </td>
                <td style={cell}>{pick(s.best, lang)}</td>
                <td style={{ ...cell, whiteSpace: 'nowrap' }} className="mono">{pick(s.price, lang)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p style={{ padding: '0.8rem 1rem 1rem', margin: 0, fontSize: '0.72rem', color: 'var(--color-ink-soft)', lineHeight: 1.5 }}>{note}</p>
    </section>
  )
}

const cell: React.CSSProperties = { padding: '0.5rem 0.8rem', borderBottom: '1px solid var(--color-border)', verticalAlign: 'top' }
