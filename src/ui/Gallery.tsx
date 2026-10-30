import { useEffect, useState } from 'react'
import { useProject } from '../store/useProject'
import { t } from '../i18n'

// Auto-pick every image dropped into src/assets/gallery/ — no config needed.
const modules = import.meta.glob('../assets/gallery/*.{jpg,jpeg,png,webp,JPG,JPEG,PNG,WEBP}', {
  eager: true,
  query: '?url',
  import: 'default',
})

// Caption + display order per file base name (без расширения).
const CAPTIONS: Record<string, { ru: string; hy: string; en: string; order: number }> = {
  // The default house, the brick house drawn off its plans: the calculator's
  // own plan built in 3D (~/Desktop/home-3d/build_brick.py), rendered in
  // Unreal Engine 5 with Lumen at golden hour (~/Desktop/home-3d/ue), on the
  // owner's 25 × 20 m plot, its facade after the project's renders.
  'brick-front': { ru: 'Кирпичный дом · главный фасад', hy: 'Աղյուսե տուն · գլխավոր ֆասադ', en: 'Brick house · main facade', order: 1 },
  'brick-street': { ru: 'Вид со двора · навес для машины', hy: 'Տեսք բակից · ավտոմեքենայի ծածկ', en: 'From the yard · carport', order: 2 },
  'brick-aerial': { ru: 'Участок 25 × 20 м сверху', hy: 'Հողամաս 25 × 20 մ վերևից', en: 'The 25 × 20 m plot from above', order: 3 },
  'brick-terrace': { ru: 'Терраса с барбекю под перголой', hy: 'Բարբեքյուով պատշգամբ պերգոլայի տակ', en: 'Barbecue terrace under the pergola', order: 4 },
  'brick-living': { ru: 'Кухня-гостиная', hy: 'Խոհանոց-հյուրասենյակ', en: 'Kitchen-living', order: 5 },
  'brick-hall': { ru: 'Холл и П-образная лестница', hy: 'Սրահ և П-աձև աստիճան', en: 'Hall and the U-shaped stair', order: 6 },
  'brick-bedroom': { ru: 'Спальня второго этажа', hy: 'Երկրորդ հարկի ննջասենյակ', en: 'Upstairs bedroom', order: 7 },
  // Concept of the Z500 Zx85 project (fitted to 14 × 13 m): facade in
  // render and Ararat travertine, basalt plinth, double-height living-dining.
  'concept-facade': { ru: 'Z500 Zx85 · Главный фасад · травертин и штукатурка', hy: 'Z500 Zx85 · Գլխավոր ֆասադ · տրավերտին և սվաղ', en: 'Z500 Zx85 · Main facade · travertine and render', order: 11 },
  'concept-view-left': { ru: 'Z500 Zx85 · Вид слева', hy: 'Z500 Zx85 · Տեսք ձախից', en: 'Z500 Zx85 · From the left', order: 12 },
  'concept-view-side': { ru: 'Z500 Zx85 · Боковой фасад', hy: 'Z500 Zx85 · Կողային ֆասադ', en: 'Z500 Zx85 · Side facade', order: 13 },
  'concept-view-right': { ru: 'Z500 Zx85 · Вид справа · вход с тамбуром', hy: 'Z500 Zx85 · Տեսք աջից · մուտք նախամուտքով', en: 'Z500 Zx85 · From the right · vestibule entrance', order: 14 },
  'concept-living': { ru: 'Z500 Zx85 · Гостиная-столовая в два света', hy: 'Z500 Zx85 · Երկլույս հյուրասենյակ-ճաշասենյակ', en: 'Z500 Zx85 · Double-height living-dining', order: 15 },
  'concept-stair': { ru: 'Z500 Zx85 · Прямая лестница', hy: 'Z500 Zx85 · Ուղիղ աստիճան', en: 'Z500 Zx85 · Straight stair', order: 16 },
  'concept-gallery': { ru: 'Z500 Zx85 · Галерея второго этажа', hy: 'Z500 Zx85 · Երկրորդ հարկի պատկերասրահ', en: 'Z500 Zx85 · Upper-floor gallery', order: 17 },
  'concept-bedroom': { ru: 'Z500 Zx85 · Спальня', hy: 'Z500 Zx85 · Ննջասենյակ', en: 'Z500 Zx85 · Bedroom', order: 18 },
  exterior: { ru: 'Экстерьер · вид на Арарат · ранний концепт', hy: 'Էքստերիեր · Արարատի տեսարան · վաղ գաղափար', en: 'Exterior · Ararat view · early concept', order: 21 },
  'exterior-dusk': { ru: 'Вечерняя подсветка · ранний концепт', hy: 'Երեկոյան լուսավորում · վաղ գաղափար', en: 'Evening lighting · early concept', order: 22 },
  facade: { ru: 'Фасад · ранний концепт', hy: 'Ֆասադ · վաղ գաղափար', en: 'Facade · early concept', order: 23 },
  'facade-day': { ru: 'Фасад днём · ранний концепт', hy: 'Ֆասադ ցերեկը · վաղ գաղափար', en: 'Facade by day · early concept', order: 24 },
  'living-room': { ru: 'Гостиная · ранний концепт', hy: 'Հյուրասենյակ · վաղ գաղափար', en: 'Living room · early concept', order: 25 },
  'high-ceiling': { ru: 'Двусветный зал · ранний концепт', hy: 'Երկլույս սրահ · վաղ գաղափար', en: 'Double-height hall · early concept', order: 26 },
  studio: { ru: 'Кухня-гостиная (студия) · ранний концепт', hy: 'Խոհանոց-հյուրասենյակ · վաղ գաղափար', en: 'Kitchen-living studio · early concept', order: 27 },
  kitchen: { ru: 'Кухня · ранний концепт', hy: 'Խոհանոց · վաղ գաղափար', en: 'Kitchen · early concept', order: 28 },
  mezzanine: { ru: 'Второй свет и антресоль · ранний концепт', hy: 'Երկրորդ լույս և միջհարկ · վաղ գաղափար', en: 'Mezzanine · early concept', order: 29 },
  staircase: { ru: 'Лестница · ранний концепт', hy: 'Աստիճան · վաղ գաղափար', en: 'Staircase · early concept', order: 30 },
  bedroom: { ru: 'Спальня · ранний концепт', hy: 'Ննջասենյակ · վաղ գաղափար', en: 'Bedroom · early concept', order: 31 },
  construction: { ru: 'Строительство · каркас', hy: 'Շինարարություն · կմախք', en: 'Construction · frame', order: 32 },
}

const images = Object.entries(modules)
  .map(([path, url]) => {
    const base = (path.split('/').pop() ?? '').replace(/\.[^.]+$/, '')
    return { url: url as string, base, cap: CAPTIONS[base] }
  })
  .sort((a, b) => (a.cap?.order ?? 99) - (b.cap?.order ?? 99))

// Illustrative placeholders shown until the user adds their own photos.
const PLACEHOLDERS = [
  { ru: 'Фасад из туфа', hy: 'Տուֆե ֆասադ', hue: 18 },
  { ru: 'Каркас и перекрытия', hy: 'Կմախք և ծածկեր', hue: 210 },
  { ru: 'Интерьер / отделка', hy: 'Ինտերիեր / հարդարում', hue: 30 },
]

function labelOf(img: (typeof images)[number], lang: string) {
  if (!img.cap) return img.base.replace(/[-_]/g, ' ')
  return lang === 'hy' ? img.cap.hy : lang === 'en' ? img.cap.en : img.cap.ru
}

export function Gallery() {
  const { lang } = useProject()
  const hasImages = images.length > 0
  const [active, setActive] = useState<number | null>(null)

  const close = () => setActive(null)
  const step = (d: number) => setActive((a) => (a === null ? a : (a + d + images.length) % images.length))

  useEffect(() => {
    if (active === null) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setActive(null)
      else if (e.key === 'ArrowRight') step(1)
      else if (e.key === 'ArrowLeft') step(-1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active])

  return (
    <section className="panel" id="gallery">
      <div className="panel-head">
        <span>{t(lang, 'galleryTitle')}</span>
        {!hasImages && <span className="sub">src/assets/gallery/</span>}
      </div>
      <div style={{ padding: '1rem' }}>
        {!hasImages && (
          <p style={{ margin: '0 0 1rem', fontSize: '0.84rem', color: 'var(--color-ink-soft)' }}>
            {t(lang, 'galleryEmpty')}
          </p>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1rem' }}>
          {hasImages
            ? images.map((img, i) => {
                const label = labelOf(img, lang)
                return (
                  <figure key={img.url} style={{ margin: 0 }}>
                    <img
                      src={img.url}
                      alt={label}
                      loading="lazy"
                      onClick={() => setActive(i)}
                      style={{ width: '100%', aspectRatio: '4 / 3', objectFit: 'cover', borderRadius: 12, border: '1px solid var(--color-border)', display: 'block', cursor: 'zoom-in' }}
                    />
                    <figcaption style={{ marginTop: '0.4rem', fontSize: '0.8rem', color: 'var(--color-ink-soft)' }}>{label}</figcaption>
                  </figure>
                )
              })
            : PLACEHOLDERS.map((p, i) => (
                <figure key={i} style={{ margin: 0 }}>
                  <div
                    style={{
                      width: '100%',
                      aspectRatio: '4 / 3',
                      borderRadius: 12,
                      border: '1px dashed var(--color-border)',
                      background: `linear-gradient(135deg, hsl(${p.hue} 40% 92%), hsl(${p.hue} 30% 82%))`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke={`hsl(${p.hue} 45% 40%)`} strokeWidth="1.4" aria-hidden>
                      <path d="M3 19 V9 L12 3 L21 9 V19" strokeLinejoin="round" />
                      <rect x="9.5" y="12.5" width="5" height="6.5" />
                    </svg>
                  </div>
                  <figcaption style={{ marginTop: '0.4rem', fontSize: '0.8rem', color: 'var(--color-ink-soft)' }}>
                    {lang !== 'hy' ? p.ru : p.hy}
                  </figcaption>
                </figure>
              ))}
        </div>
      </div>

      {active !== null && images[active] && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={close}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 60,
            background: 'rgba(0,0,0,0.92)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '2rem',
          }}
        >
          <button onClick={close} aria-label="Закрыть" style={{ ...lbBtn, top: '1rem', right: '1.2rem', width: '2.6rem', height: '2.6rem', fontSize: '1.3rem' }}>
            ✕
          </button>
          {images.length > 1 && (
            <button onClick={(e) => { e.stopPropagation(); step(-1) }} aria-label="Назад" style={{ ...lbBtn, left: '1rem', top: '50%', transform: 'translateY(-50%)' }}>
              ‹
            </button>
          )}
          <figure onClick={(e) => e.stopPropagation()} style={{ margin: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.7rem', maxWidth: '92vw' }}>
            <img
              src={images[active].url}
              alt={labelOf(images[active], lang)}
              style={{ maxWidth: '92vw', maxHeight: '80vh', objectFit: 'contain', borderRadius: 8, boxShadow: '0 20px 60px rgba(0,0,0,0.6)' }}
            />
            <figcaption style={{ color: '#eae8e3', fontSize: '0.9rem', fontFamily: 'var(--font-body)' }}>
              {labelOf(images[active], lang)} · {active + 1} / {images.length}
            </figcaption>
          </figure>
          {images.length > 1 && (
            <button onClick={(e) => { e.stopPropagation(); step(1) }} aria-label="Далее" style={{ ...lbBtn, right: '1rem', top: '50%', transform: 'translateY(-50%)' }}>
              ›
            </button>
          )}
        </div>
      )}
    </section>
  )
}

const lbBtn: React.CSSProperties = {
  position: 'absolute',
  width: '3rem',
  height: '3rem',
  borderRadius: '999px',
  border: '1px solid rgba(255,255,255,0.35)',
  background: 'rgba(0,0,0,0.4)',
  color: '#fff',
  fontSize: '1.7rem',
  lineHeight: 1,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
}
