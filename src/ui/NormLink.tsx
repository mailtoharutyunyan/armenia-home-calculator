import { normParts, isDirectSource } from '../data/normsReference'

// Ссылка на текст нормы.
//
// Название документа само по себе ничего не даёт: чтобы проверить требование,
// человеку нужен его текст. Поэтому каждое упоминание нормы в интерфейсе —
// ссылка на конкретный акт в реестре (arlis.am / irtek.am / e-draft.am).
//
// Составной код («ГОСТ … / ՀՀՇՆ …») даёт две отдельные ссылки: это два разных
// документа. Если прямого адреса акта нет, ссылка помечается как поиск по
// реестру, чтобы не обещать переход на текст, которого там не откроется.
export function NormLink({ code, lang, className }: { code: string; lang: string; className?: string }) {
  const parts = normParts(code)

  return (
    <span className={className}>
      {parts.map((part, i) => {
        const sep = i > 0 ? ' · ' : ''
        // неизвестный код или служебная проверка ввода — ссылаться некуда
        if (typeof part === 'string' || !part.source) {
          const text = typeof part === 'string' ? part : lang === 'hy' ? part.fullHy : part.fullRu
          return (
            <span key={i}>
              {sep}
              {text}
            </span>
          )
        }

        const title = lang === 'hy' ? part.fullHy : part.fullRu
        const direct = isDirectSource(part.source)
        return (
          <span key={i}>
            {sep}
            <a
              className="normlink"
              href={part.source}
              target="_blank"
              rel="noreferrer"
              title={
                direct
                  ? lang === 'hy'
                    ? 'Բացել նորմի տեքստը'
                    : lang === 'en'
                      ? 'Open the text of the code'
                      : 'Открыть текст нормы'
                  : lang === 'hy'
                    ? 'Ուղիղ հղումը հաստատված չէ — որոնում ռեգիստրում'
                    : lang === 'en'
                      ? 'No verified direct link — search the registry'
                      : 'Прямая ссылка не подтверждена — поиск по реестру'
              }
            >
              {title}
              <span aria-hidden="true" className="normlink-mark">
                {direct ? '↗' : '⌕'}
              </span>
            </a>
          </span>
        )
      })}
    </span>
  )
}
