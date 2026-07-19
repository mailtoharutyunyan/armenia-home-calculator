import { useProject } from '../store/useProject'
import { t } from '../i18n'

// Auto-pick every image dropped into src/assets/gallery/ — no config needed.
const modules = import.meta.glob('../assets/gallery/*.{jpg,jpeg,png,webp,JPG,JPEG,PNG,WEBP}', {
  eager: true,
  query: '?url',
  import: 'default',
})

const images = Object.entries(modules).map(([path, url]) => ({
  url: url as string,
  name: (path.split('/').pop() ?? '').replace(/\.[^.]+$/, ''),
}))

// Illustrative placeholders shown until the user adds their own photos.
const PLACEHOLDERS = [
  { ru: 'Фасад из туфа', hy: 'Տուֆե ֆասադ', hue: 18 },
  { ru: 'Каркас и перекрытия', hy: 'Կմախք և ծածկեր', hue: 210 },
  { ru: 'Интерьер / отделка', hy: 'Ինտերիեր / հարդարում', hue: 30 },
]

export function Gallery() {
  const { lang } = useProject()
  const hasImages = images.length > 0

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
            ? images.map((img) => (
                <figure key={img.url} style={{ margin: 0 }}>
                  <img
                    src={img.url}
                    alt={img.name}
                    loading="lazy"
                    style={{ width: '100%', aspectRatio: '4 / 3', objectFit: 'cover', borderRadius: 12, border: '1px solid var(--color-border)', display: 'block' }}
                  />
                  <figcaption style={{ marginTop: '0.4rem', fontSize: '0.8rem', color: 'var(--color-ink-soft)' }}>{img.name}</figcaption>
                </figure>
              ))
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
                    {lang === 'ru' ? p.ru : p.hy}
                  </figcaption>
                </figure>
              ))}
        </div>
      </div>
    </section>
  )
}
