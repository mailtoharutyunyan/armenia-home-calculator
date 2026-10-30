import { useEffect, useMemo, useRef, useState } from 'react'
import { useProject } from '../../store/useProject'
import { t, type Lang } from '../../i18n'
import { computeQuantities } from '../../engine/quantities'
import { computeEstimate } from '../../engine/pricing'
import { buildFloorPlan, roomClear } from '../../engine/floorplan'
import { DEFAULT_HOUSE, type HouseParams } from '../../model/house'
import { FloorPlanSvg, PLAN_PAD } from '../FloorPlan'
import { num } from '../format'
import { HouseViewer, type FloorMode, type LightMode } from './viewer'
import {
  FEATURES,
  FLOORS_VIEW,
  HERO,
  OVERVIEW,
  PLAN_DEPTH,
  ROOM_VIEWS,
  type FeatureId,
  type RoomView,
  type Shot,
} from './shots'

// The 3D tab: the house fills the window, a few dark glass panels float over
// it. Loaded with React.lazy from App, so three.js stays out of the main bundle.

type Status = 'loading' | 'ready' | 'error' | 'nowebgl'
type Section = 'home' | 'floors' | 'features'

const SECTIONS: { id: Section; key: 'v3d_nav_home' | 'v3d_nav_floors' | 'v3d_nav_features' }[] = [
  { id: 'home', key: 'v3d_nav_home' },
  { id: 'floors', key: 'v3d_nav_floors' },
  { id: 'features', key: 'v3d_nav_features' },
]

const FADE_MS = 220

export default function House3D() {
  const { lang, house, prices, priceMode, amdPerUsd, setTab } = useProject()
  const stageRef = useRef<HTMLDivElement>(null)
  const hostRef = useRef<HTMLDivElement>(null)
  const viewerRef = useRef<HouseViewer | null>(null)

  const [status, setStatus] = useState<Status>('loading')
  const [progress, setProgress] = useState(0)
  const [section, setSection] = useState<Section>('home')
  const [storey, setStorey] = useState<1 | 2>(1)
  const [feature, setFeature] = useState<FeatureId | null>(null)
  const [room, setRoom] = useState<RoomView | null>(null)
  const [inside, setInside] = useState(false)
  const [light, setLight] = useState<LightMode>('golden')
  const [cut, setCut] = useState<FloorMode>('all')
  const [roof, setRoof] = useState(true)
  const [fading, setFading] = useState(false)
  const [touched, setTouched] = useState(false)
  const [fullscreen, setFullscreen] = useState(false)
  const narrow = useMedia('(max-width: 760px)')
  const reducedMotion = useMedia('(prefers-reduced-motion: reduce)')
  const coarse = useMedia('(pointer: coarse)')
  const canFullscreen = typeof document !== 'undefined' && document.fullscreenEnabled

  // The same figures as the result bar, for whatever project is open.
  const { area, turnkey } = useMemo(() => {
    const q = computeQuantities(house)
    return { area: q.geometry.netFloorArea, turnkey: computeEstimate(q, prices, house, priceMode).turnkey.total }
  }, [house, prices, priceMode])

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    let viewer: HouseViewer
    try {
      viewer = new HouseViewer(host, window.matchMedia('(prefers-reduced-motion: reduce)').matches, () => setTouched(true))
    } catch {
      setStatus('nowebgl')
      return
    }
    viewerRef.current = viewer
    viewer
      .load({ onProgress: setProgress })
      .then(() => {
        viewer.setAutoRotate(true)
        setStatus('ready')
      })
      .catch((err) => {
        console.error(err)
        setStatus('error')
      })
    return () => {
      viewerRef.current = null
      viewer.dispose()
    }
  }, [])

  // Fill the window below the header, whatever height the header wraps to
  // (on a phone it takes two or three rows).
  useEffect(() => {
    const stage = stageRef.current
    if (!stage) return
    const fit = () => {
      if (document.fullscreenElement) return
      stage.style.height = `${Math.max(460, window.innerHeight - stage.getBoundingClientRect().top - window.scrollY)}px`
    }
    fit()
    window.addEventListener('resize', fit)
    return () => window.removeEventListener('resize', fit)
  }, [])

  useEffect(() => {
    const onChange = () => setFullscreen(document.fullscreenElement === stageRef.current)
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])

  // Keep the house clear of the panels: to the right of the side panel on a
  // wide screen, above the bottom sheet on a phone. Inside a room the panel
  // is part of the picture, as in an estate agent's tour.
  useEffect(() => {
    const v = viewerRef.current
    if (!v || status !== 'ready') return
    if (inside) v.setFrameShift(0, 0)
    else if (narrow) v.setFrameShift(0, 0.2)
    else v.setFrameShift(section === 'floors' ? 0.24 : 0.17, 0)
  }, [status, section, narrow, inside])

  // Esc steps back out of a room.
  useEffect(() => {
    if (!inside) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') stepOutside()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const v = viewerRef.current
  const ready = status === 'ready'

  // Through a wall the camera does not fly, it cuts, behind a short fade.
  const show = (shot: Shot) => {
    if (!v) return
    const through = !!shot.inside || inside
    setInside(!!shot.inside)
    if (shot.inside) {
      // A room is seen whole: no section cut, ceiling in place.
      v.setFloors('all')
      v.setRoof(true)
      setCut('all')
      setRoof(true)
    }
    if (through && !reducedMotion) {
      setFading(true)
      window.setTimeout(() => {
        v.flyTo(shot)
        setFading(false)
      }, FADE_MS)
    } else v.flyTo(shot)
  }

  const goSection = (s: Section) => {
    if (!v) return
    setSection(s)
    setRoom(null)
    if (s !== 'features') setFeature(null)
    v.highlightStorey(s === 'floors' ? storey : 0)
    show(s === 'home' ? HERO : s === 'floors' ? FLOORS_VIEW : OVERVIEW)
    v.setAutoRotate(s === 'home')
  }

  const pickStorey = (n: 1 | 2) => {
    setStorey(n)
    setRoom(null)
    if (inside) show(FLOORS_VIEW)
    v?.highlightStorey(n)
  }

  const pickRoom = (r: { id: RoomView; shot: Shot }) => {
    setRoom(r.id)
    show(r.shot)
  }

  const pickFeature = (id: FeatureId) => {
    setFeature(id)
    show(FEATURES.find((f) => f.id === id)!.shot)
  }

  function stepOutside() {
    setRoom(null)
    if (section === 'features') {
      setFeature(null)
      show(OVERVIEW)
    } else {
      show(FLOORS_VIEW)
      viewerRef.current?.highlightStorey(storey)
    }
  }

  const pickLight = (m: LightMode) => {
    v?.setLight(m)
    setLight(m)
  }
  const pickCut = (f: FloorMode) => {
    v?.setFloors(f)
    setCut(f)
  }
  const toggleRoof = () => {
    v?.setRoof(!roof)
    setRoof(!roof)
  }
  const reset = () => {
    v?.reset()
    v?.highlightStorey(0)
    v?.setAutoRotate(true)
    setSection('home')
    setInside(false)
    setRoom(null)
    setFeature(null)
    setCut('all')
    setRoof(true)
  }
  const toggleFullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen()
    else stageRef.current?.requestFullscreen().catch(() => {})
  }
  const toCalculator = () => {
    setTab('calc')
    window.scrollTo(0, 0)
  }

  const floorsWord = t(lang, house.floors === 1 ? 'v3d_statFloors1' : pluralRu(house.floors))
  const unit = lang === 'hy' ? 'մ²' : lang === 'en' ? 'm²' : 'м²'

  return (
    <div className="v3d" ref={stageRef} data-section={section} data-inside={inside || undefined}>
      <div className="v3d-canvas" ref={hostRef} />
      <div className="v3d-scrim" aria-hidden />
      <div className="v3d-fade" data-on={fading || undefined} aria-hidden />

      <nav className="v3d-nav" aria-label={t(lang, 'nav_3d')}>
        {SECTIONS.map((s) => (
          <button key={s.id} disabled={!ready} aria-current={section === s.id ? 'page' : undefined} onClick={() => goSection(s.id)}>
            {t(lang, s.key)}
          </button>
        ))}
      </nav>

      {status === 'loading' && (
        <div className="v3d-overlay" role="status" aria-live="polite">
          <span className="v3d-overlay-label">{t(lang, 'v3d_loading')}</span>
          <span className="v3d-pct">{Math.round(progress * 100)}%</span>
          <span className="v3d-track" aria-hidden>
            <span style={{ transform: `scaleX(${progress})` }} />
          </span>
        </div>
      )}
      {(status === 'error' || status === 'nowebgl') && (
        <div className="v3d-overlay" role="alert">
          <p className="v3d-msg">{t(lang, status === 'error' ? 'v3d_error' : 'v3d_noWebgl')}</p>
        </div>
      )}

      {ready && (
        <aside className="v3d-panel" aria-label={t(lang, SECTIONS.find((s) => s.id === section)!.key)}>
          {inside && (
            <button className="v3d-back" onClick={stepOutside}>
              <svg viewBox="0 0 24 24" aria-hidden>
                <path d="M15 5l-7 7 7 7" />
              </svg>
              {t(lang, 'v3d_back')}
            </button>
          )}

          {section === 'home' && (
            <div className="v3d-hero">
              <h1 className="v3d-title">
                {t(lang, 'v3d_heroTitle')}
                {/* The unit keeps its lower case: «М²» is not how area is written. */}
                <span className="v3d-title-num">193.5 {unit}</span>
              </h1>
              <p className="v3d-lede">{t(lang, 'v3d_heroLede')}</p>
              <div className="v3d-stats">
                <Stat value={num(area, 1)} label={t(lang, 'v3d_statArea')} />
                <Stat value={String(house.floors)} label={floorsWord} />
                <Stat value={compactMoney(turnkey, house.currency, amdPerUsd, lang)} label={t(lang, 'v3d_statTurnkey')} />
              </div>
              {house.planLayout !== 'brick193' && <p className="v3d-note">{t(lang, 'v3d_otherProject')}</p>}
              <button className="v3d-cta" onClick={toCalculator}>
                {t(lang, 'v3d_cta')}
              </button>
            </div>
          )}

          {section === 'floors' && (
            <div className="v3d-floors">
              <div className="v3d-col">
                <h2 className="v3d-h2">{t(lang, 'v3d_nav_floors')}</h2>
                <p className="v3d-lede">{t(lang, 'v3d_floorsLede')}</p>
                <ul className="v3d-list">
                  {([1, 2] as const).map((n) => {
                    const f = floorFacts(n, lang)
                    return (
                      <li key={n}>
                        <button className="v3d-item v3d-storey" aria-pressed={storey === n} onClick={() => pickStorey(n)}>
                          <span className="v3d-storey-num">{n}</span>
                          <span>
                            <span className="v3d-item-label">{t(lang, 'v3d_floor')} {n}</span>
                            <span className="v3d-item-sub">
                              {num(f.area, 1)} {unit} · {t(lang, 'v3d_ceiling')} {num(f.ceiling, 1)} {lang === 'hy' ? 'մ' : lang === 'en' ? 'm' : 'м'}
                            </span>
                          </span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </div>
              <PlanCard storey={storey} lang={lang} room={room} onPick={pickRoom} />
            </div>
          )}

          {section === 'features' && (
            <div className="v3d-col">
              <h2 className="v3d-h2">{t(lang, 'v3d_nav_features')}</h2>
              <p className="v3d-lede">{t(lang, 'v3d_featuresLede')}</p>
              <ul className="v3d-list">
                {FEATURES.map((f, i) => (
                  <li key={f.id}>
                    <button className="v3d-item" aria-pressed={feature === f.id} onClick={() => pickFeature(f.id)}>
                      <span className="v3d-item-idx">{String(i + 1).padStart(2, '0')}</span>
                      <span>
                        <span className="v3d-item-label">{t(lang, `v3d_f_${f.id}`)}</span>
                        {feature === f.id && <span className="v3d-item-sub">{t(lang, `v3d_fd_${f.id}`)}</span>}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </aside>
      )}

      {ready && (
        <div className="v3d-tools">
          <div className="v3d-seg" role="group" aria-label={t(lang, 'v3d_light')}>
            <button aria-pressed={light === 'day'} onClick={() => pickLight('day')}>{t(lang, 'v3d_day')}</button>
            <button aria-pressed={light === 'golden'} onClick={() => pickLight('golden')}>{t(lang, 'v3d_golden')}</button>
          </div>
          <div className="v3d-seg" role="group" aria-label={t(lang, 'v3d_cut')}>
            <button disabled={inside} aria-pressed={cut === '1'} onClick={() => pickCut('1')}>1</button>
            <button disabled={inside} aria-pressed={cut === '2'} onClick={() => pickCut('2')}>2</button>
            <button disabled={inside} aria-pressed={cut === 'all'} onClick={() => pickCut('all')}>{t(lang, 'v3d_all')}</button>
            <button disabled={inside} aria-pressed={!roof} onClick={toggleRoof}>{t(lang, 'v3d_noRoof')}</button>
          </div>
          <button className="v3d-icon" onClick={reset} title={t(lang, 'v3d_reset')} aria-label={t(lang, 'v3d_reset')}>
            <svg viewBox="0 0 24 24" aria-hidden>
              <path d="M4 12a8 8 0 1 0 2.4-5.7" />
              <path d="M4 4v4.5h4.5" />
            </svg>
          </button>
          {canFullscreen && (
            <button
              className="v3d-icon"
              onClick={toggleFullscreen}
              title={t(lang, fullscreen ? 'v3d_exitFullscreen' : 'v3d_fullscreen')}
              aria-label={t(lang, fullscreen ? 'v3d_exitFullscreen' : 'v3d_fullscreen')}
            >
              <svg viewBox="0 0 24 24" aria-hidden>
                {fullscreen ? (
                  <path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" />
                ) : (
                  <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
                )}
              </svg>
            </button>
          )}
        </div>
      )}

      {ready && (
        <p className="v3d-hint" data-hidden={(touched && !inside) || undefined}>
          {t(lang, inside ? 'v3d_hintInside' : coarse ? 'v3d_hintTouch' : 'v3d_hintMouse')}
        </p>
      )}
    </div>
  )
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="v3d-stat">
      <span className="v3d-stat-value">{value}</span>
      <span className="v3d-stat-label">{label}</span>
    </div>
  )
}

// The plan of the chosen storey with the points that take the camera inside.
// It is always the default brick house: the points belong to that model.
function PlanCard({
  storey,
  lang,
  room,
  onPick,
}: {
  storey: 1 | 2
  lang: Lang
  room: RoomView | null
  onPick: (r: { id: RoomView; shot: Shot }) => void
}) {
  const plan = buildFloorPlan(DEFAULT_HOUSE, storey - 1, undefined, { lang })
  const vbW = plan.L + 2 * PLAN_PAD
  const vbH = plan.W + 2 * PLAN_PAD
  const views = ROOM_VIEWS[storey]
  return (
    <section className="v3d-plancard">
      <div className="v3d-plancard-head">
        <span>
          {t(lang, 'v3d_floor')} {storey}
        </span>
        <span className="v3d-item-sub">{t(lang, 'v3d_planHint')}</span>
      </div>
      <div className="v3d-plan" style={{ aspectRatio: `${vbW} / ${vbH}` }}>
        <FloorPlanSvg house={DEFAULT_HOUSE} floorIndex={storey - 1} labels={{ lang }} />
        {views.map((r, i) => {
          const [x, , z] = r.shot.pos
          const [tx, , tz] = r.shot.target
          // Plan y runs from the back wall to the facade; model z the other way.
          const left = ((x + PLAN_PAD) / vbW) * 100
          const top = ((z + PLAN_DEPTH + PLAN_PAD) / vbH) * 100
          const angle = (Math.atan2(tz - z, tx - x) * 180) / Math.PI
          return (
            <button
              key={r.id}
              className="v3d-pin"
              style={{ left: `${left}%`, top: `${top}%` }}
              aria-pressed={room === r.id}
              aria-label={t(lang, `v3d_vp_${r.id}`)}
              title={t(lang, `v3d_vp_${r.id}`)}
              onClick={() => onPick(r)}
            >
              {/* The wedge shows where the camera will look. */}
              <svg viewBox="-20 -20 40 40" aria-hidden style={{ transform: `rotate(${angle}deg)` }}>
                <path d="M0 0 L18 -9 A20 20 0 0 1 18 9 Z" />
              </svg>
              <span>{i + 1}</span>
            </button>
          )
        })}
      </div>
      <ol className="v3d-rooms">
        {views.map((r, i) => (
          <li key={r.id}>
            <button aria-pressed={room === r.id} onClick={() => onPick(r)}>
              <span className="v3d-rooms-idx">{i + 1}</span>
              {t(lang, `v3d_vp_${r.id}`)}
            </button>
          </li>
        ))}
      </ol>
    </section>
  )
}

// Usable area (rooms measured clear of the walls, as on the plan) and ceiling
// height of a storey of the model.
function floorFacts(n: 1 | 2, lang: Lang) {
  const plan = buildFloorPlan(DEFAULT_HOUSE, n - 1, undefined, { lang })
  const area = plan.rooms.filter((r) => !r.open).reduce((a, r) => a + roomClear(r, plan).area, 0)
  return { area, ceiling: plan.ceilingH ?? DEFAULT_HOUSE.floorHeight }
}

function pluralRu(n: number): 'v3d_statFloors1' | 'v3d_statFloors2' | 'v3d_statFloors5' {
  const d = n % 10
  const h = n % 100
  if (d === 1 && h !== 11) return 'v3d_statFloors1'
  if (d >= 2 && d <= 4 && (h < 12 || h > 14)) return 'v3d_statFloors2'
  return 'v3d_statFloors5'
}

// "65.4 млн ֏" rather than the full figure: the hero shows the order of the
// price, the exact sum is one click away in the calculator. Written out by
// hand because Intl's compact notation has no Armenian words (it gives "65.4M").
const SCALE: Record<Lang, { m: string; k: string }> = {
  ru: { m: 'млн', k: 'тыс.' },
  hy: { m: 'մլն', k: 'հզր' },
  en: { m: 'M', k: 'K' },
}

function compactMoney(amd: number, currency: HouseParams['currency'], amdPerUsd: number, lang: Lang) {
  const value = currency === 'USD' ? amd / amdPerUsd : amd
  const sign = currency === 'USD' ? '$' : '֏'
  const [n, word] = value >= 1e6 ? [value / 1e6, SCALE[lang].m] : [value / 1e3, SCALE[lang].k]
  const digits = new Intl.NumberFormat(lang === 'en' ? 'en-US' : 'ru-RU', { maximumFractionDigits: 1 }).format(n)
  return lang === 'en' ? `${digits}${word} ${sign}` : `${digits} ${word} ${sign}`
}

function useMedia(query: string) {
  const [match, setMatch] = useState(() => typeof window !== 'undefined' && window.matchMedia(query).matches)
  useEffect(() => {
    const m = window.matchMedia(query)
    const on = () => setMatch(m.matches)
    m.addEventListener('change', on)
    return () => m.removeEventListener('change', on)
  }, [query])
  return match
}
