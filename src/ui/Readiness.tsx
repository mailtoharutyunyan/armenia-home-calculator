import { useMemo } from 'react'
import { useProject } from '../store/useProject'
import { computeQuantities } from '../engine/quantities'
import { checkNorms } from '../engine/norms'
import { auditPlan } from '../engine/planAudit'
import { simplified41Reasons } from '../engine/norms'
import { priceAgeDays, arePricesStale, PRICES_UPDATED } from '../data/prices'
import { NORMS } from '../data/normsReference'

// Панель готовности.
//
// Раньше внизу висел дисклеймер: «расчёт ориентировочный, не заменяет проект
// лицензированного инженера, цены стартовые, разрешения выдают органы РА».
// Он был правдой, но бесполезной: человек не понимал, что из этого уже
// закрыто, а что нет, и что делать дальше.
//
// Здесь то же самое разложено на состояния. Часть пунктов сайт закрывает сам
// (курс, нормы, планировка), часть — только с участием человека (цены), а
// проект лицензированного инженера и разрешение сайт закрыть не может в
// принципе: это требование закона, а не осторожность.

type State = 'done' | 'partial' | 'todo' | 'external'

interface Item {
  state: State
  title: string
  detail: string
  action?: { label: string; href?: string; tab?: string }
}

const ICON: Record<State, string> = { done: '✓', partial: '!', todo: '·', external: '→' }
const COLOR: Record<State, string> = {
  done: 'var(--color-ok)',
  partial: 'var(--color-warn)',
  todo: 'var(--color-ink-soft)',
  external: 'var(--color-info)',
}

export function Readiness() {
  const { house, prices, lang, rateSource, rateDate, setTab } = useProject()

  const items = useMemo<Item[]>(() => {
    const q = computeQuantities(house)
    const norms = checkNorms(house, q)
    const normErrors = norms.filter((w) => w.level === 'error').length
    const plan = auditPlan(house)
    const planErrors = plan.filter((i) => i.level === 'error').length
    const list = Object.values(prices)
    const quoted = list.filter((i) => i.provenance === 'quoted').length
    const age = priceAgeDays()
    const stale = arePricesStale()
    const eligible41 = simplified41Reasons(house, q.geometry.netFloorArea).length === 0
    const ru = lang !== 'hy' && lang !== 'en'
    const hy = lang === 'hy'

    const T = (r: string, h: string, e: string) => (hy ? h : ru ? r : e)

    return [
      {
        state: rateSource === 'cba' ? 'done' : 'partial',
        title: T('Курс валют', 'Փոխարժեք', 'Exchange rate'),
        detail:
          rateSource === 'cba'
            ? T(
                `Актуальный курс ЦБ РА${rateDate ? ` на ${rateDate}` : ''}. Обновляется автоматически.`,
                `ՀՀ ԿԲ ընթացիկ փոխարժեք${rateDate ? `՝ ${rateDate}` : ''}։ Թարմացվում է ինքնաշխատ։`,
                `Live Central Bank of Armenia rate${rateDate ? ` for ${rateDate}` : ''}, updated automatically.`,
              )
            : T(
                'Используется зашитый курс — курс ЦБ не загрузился.',
                'Օգտագործվում է ներդրված փոխարժեքը՝ ՀՀ ԿԲ-ից չի բեռնվել։',
                'Falling back to the built-in rate — the CBA rate did not load.',
              ),
      },
      {
        state: quoted === list.length ? 'done' : quoted > 0 ? 'partial' : 'todo',
        title: T('Цены материалов и работ', 'Նյութերի և աշխատանքի գներ', 'Material and labour prices'),
        detail: T(
          `Сверено с прайсом поставщика: ${quoted} из ${list.length}. Прайс обновлён ${PRICES_UPDATED}${age !== null ? ` (${age} дн. назад)` : ''}.${stale ? ' Устарел — обновите.' : ''} Открытых источников цен в РА нет, сверка только вручную.`,
          `Ստուգված է մատակարարի գնացուցակով՝ ${quoted} ${list.length}-ից։ Գնացուցակը՝ ${PRICES_UPDATED}${age !== null ? ` (${age} օր առաջ)` : ''}։`,
          `Verified against a supplier price list: ${quoted} of ${list.length}. List updated ${PRICES_UPDATED}${age !== null ? ` (${age} days ago)` : ''}.${stale ? ' Out of date — refresh it.' : ''} There is no open price feed in Armenia; verification is manual.`,
        ),
        action: { label: T('Открыть прайс', 'Բացել գնացուցակը', 'Open the price list'), tab: 'prices' },
      },
      {
        state: normErrors === 0 ? 'done' : 'todo',
        title: T('Соответствие нормам', 'Նորմերին համապատասխանություն', 'Code compliance'),
        detail:
          normErrors === 0
            ? T(
                `Нарушений не найдено. Проверяется ${norms.length} правил: сейсмика, площади, освещение, застройка участка, газ.`,
                `Խախտումներ չեն հայտնաբերվել։ Ստուգվում է ${norms.length} կանոն։`,
                `No violations found. ${norms.length} rules checked: seismic, areas, daylight, site coverage, gas.`,
              )
            : T(
                `Нарушений: ${normErrors}. Смотрите раздел предупреждений.`,
                `Խախտումներ՝ ${normErrors}։`,
                `${normErrors} violations — see the warnings section.`,
              ),
      },
      {
        state: planErrors === 0 ? 'done' : 'todo',
        title: T('Планировка', 'Հատակագիծ', 'Layout'),
        detail:
          planErrors === 0
            ? T(
                'Проверено: вход через прихожую, нет проходных комнат, пропорции, окна, совпадение лестниц и проёма, расстановка мебели.',
                'Ստուգված է՝ մուտք նախասրահով, անցումային սենյակներ չկան, համամասնություններ, պատուհաններ, աստիճանների համընկնում։',
                'Checked: entry through a hall, no walk-through rooms, proportions, windows, stair and void alignment, furniture fit.',
              )
            : T(`Ошибок планировки: ${planErrors}.`, `Հատակագծի սխալներ՝ ${planErrors}։`, `${planErrors} layout problems.`),
      },
      {
        state: 'external',
        title: T('Проект лицензированного инженера', 'Լիցենզավորված ինժեների նախագիծ', 'Licensed engineer’s design'),
        detail: T(
          'Обязателен по закону: рабочий архитектурно-строительный проект разрабатывает лицензированная организация. Этот расчёт даёт объёмы и бюджет для разговора с проектировщиком, но не заменяет проект — без него разрешение не выдадут.',
          'Պարտադիր է օրենքով՝ աշխատանքային նախագիծը մշակում է լիցենզավորված կազմակերպությունը։ Այս հաշվարկը տալիս է ծավալներ և բյուջե, բայց նախագիծը չի փոխարինում։',
          'Required by law: the working design is produced by a licensed organisation. This calculation gives quantities and a budget to discuss with a designer, but does not replace the design — without it no permit is issued.',
        ),
      },
      {
        state: 'external',
        title: T('Разрешение на строительство', 'Շինարարության թույլտվություն', 'Building permit'),
        detail: eligible41
          ? T(
              'Дом подходит под упрощённый порядок N 4.1: без обычной экспертизы, разрешение до 7 рабочих дней. Выдаёт муниципалитет.',
              'Տունը համապատասխանում է N 4.1 պարզեցված ընթացակարգին՝ մինչև 7 աշխատանքային օր։',
              'The house qualifies for simplified procedure N 4.1: no standard expertise, permit within 7 working days, issued by the municipality.',
            )
          : T(
              'Обычная процедура — требуется экспертиза проекта. Выдаёт муниципалитет или Комитет градостроительства.',
              'Սովորական ընթացակարգ՝ պահանջվում է նախագծի փորձաքննություն։',
              'Standard procedure — design expertise is required. Issued by the municipality or the Urban Development Committee.',
            ),
        action: {
          label: T('Текст решения N 1969-Ն', 'N 1969-Ն որոշման տեքստը', 'Text of decision N 1969-Ն'),
          href: NORMS['Пост. N 1969-Ն (N 4.1)'].source,
        },
      },
    ]
  }, [house, prices, lang, rateSource, rateDate])

  const done = items.filter((i) => i.state === 'done').length
  const selfServed = items.filter((i) => i.state !== 'external').length

  return (
    <section className="panel" id="readiness">
      <div className="panel-head">
        <span>
          {lang === 'hy' ? 'Պատրաստվածություն' : lang === 'en' ? 'Readiness' : 'Готовность'}
        </span>
        <span className="sub">
          {done}/{selfServed}{' '}
          {lang === 'hy' ? 'փակված է հաշվիչով' : lang === 'en' ? 'closed by the calculator' : 'закрыто калькулятором'}
        </span>
      </div>
      <div style={{ padding: '0.4rem 1rem 1rem' }}>
        {items.map((it, i) => (
          <div
            key={i}
            style={{
              display: 'grid',
              gridTemplateColumns: 'auto 1fr',
              gap: '0.7rem',
              padding: '0.7rem 0',
              borderBottom: i < items.length - 1 ? '1px dotted var(--color-border)' : 'none',
            }}
          >
            <span
              aria-hidden="true"
              style={{
                color: COLOR[it.state],
                fontWeight: 700,
                width: '1.2rem',
                textAlign: 'center',
                lineHeight: 1.5,
              }}
            >
              {ICON[it.state]}
            </span>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{it.title}</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--color-ink-soft)', lineHeight: 1.5, marginTop: '0.15rem' }}>
                {it.detail}
              </div>
              {it.action &&
                (it.action.href ? (
                  <a
                    className="normlink"
                    href={it.action.href}
                    target="_blank"
                    rel="noreferrer"
                    style={{ fontSize: '0.78rem', display: 'inline-block', marginTop: '0.3rem', color: 'var(--color-info)' }}
                  >
                    {it.action.label}
                    <span aria-hidden="true" className="normlink-mark">↗</span>
                  </a>
                ) : (
                  <button
                    className="btn btn-ghost no-print"
                    style={{ padding: '0.2rem 0', fontSize: '0.78rem', marginTop: '0.3rem' }}
                    onClick={() => it.action?.tab && setTab(it.action.tab)}
                  >
                    {it.action.label}
                  </button>
                ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
