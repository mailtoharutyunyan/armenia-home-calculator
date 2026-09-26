import { useState } from 'react'
import { useProject, newRoomId } from '../store/useProject'
import type { EditRoom } from '../store/useProject'
import { t } from '../i18n'
import type { HouseParams } from '../model/house'
import { buildPlan } from '../engine/plan'
import { downloadDxf } from '../engine/dxf'
import { autoProgram, buildFloorPlan, roomClear } from '../engine/floorplan'
import type { RoomType } from '../engine/floorplan'
import { FloorPlanSvg } from './FloorPlan'
import { auditPlan, issueText } from '../engine/planAudit'

const TYPE_LABEL: Record<RoomType, { ru: string; hy: string; en: string }> = {
  living_kitchen: { ru: 'Гостиная-кухня', hy: 'Հյուրասենյակ-խոհանոց', en: 'Living-kitchen' },
  living: { ru: 'Гостиная', hy: 'Հյուրասենյակ', en: 'Living room' },
  kitchen: { ru: 'Кухня', hy: 'Խոհանոց', en: 'Kitchen' },
  bedroom: { ru: 'Комната', hy: 'Սենյակ', en: 'Room' },
  bath: { ru: 'Санузел', hy: 'Սանհանգույց', en: 'Bathroom' },
  stair: { ru: 'Лестница', hy: 'Աստիճան', en: 'Staircase' },
  wardrobe: { ru: 'Гардеробная', hy: 'Հանդերձարան', en: 'Walk-in closet' },
  dining: { ru: 'Кухня-столовая', hy: 'Խոհանոց-ճաշասենյակ', en: 'Kitchen-dining' },
  hall: { ru: 'Прихожая', hy: 'Նախասրահ', en: 'Entry hall' },
  corridor: { ru: 'Коридор', hy: 'Միջանցք', en: 'Corridor' },
  office: { ru: 'Кабинет', hy: 'Աշխատասենյակ', en: 'Home office' },
  utility: { ru: 'Техпомещение', hy: 'Տեխնիկական սենյակ', en: 'Utility room' },
}

export function Plan2D() {
  const { house, lang, editRooms, setEditRooms, updateRoom, addRoom, removeRoom } = useProject()
  const [floor, setFloor] = useState(0)
  const activeFloor = Math.max(0, Math.min(floor, house.floors - 1))

  if (house.length <= 0 || house.width <= 0) {
    return (
      <div className="panel">
        <div className="panel-head"><span>{t(lang, 'plan2d')}</span></div>
        <div style={{ padding: '1rem', color: 'var(--color-err)' }}>— неверные габариты —</div>
      </div>
    )
  }

  const editing = activeFloor === 0 && editRooms !== null
  // always feed the plan localized specs (labels follow the UI language)
  const custom = editing
    ? editRooms!.map((r) => ({ type: r.type, label: r.label, weight: r.weight }))
    : (() => {
        let bed = 0
        const ground = activeFloor === 0
        return autoProgram(house, activeFloor).map((s) => {
          const pick = (o: { ru: string; hy: string; en: string }) =>
            lang === 'hy' ? o.hy : lang === 'en' ? o.en : o.ru
          let label = pick(TYPE_LABEL[s.type])
          if (s.type === 'bath' && ground)
            label = lang === 'hy' ? 'Հյուրերի ս/հ' : lang === 'en' ? 'Guest WC' : 'Гостевой с/у'
          else if (s.type === 'office')
            label = lang === 'hy' ? 'Աշխատասենյակ' : lang === 'en' ? 'Home office' : 'Кабинет'
          else if (s.type === 'bedroom') {
            bed++
            const master = lang === 'hy' ? 'Գլխավոր ննջասենյակ' : lang === 'en' ? 'Master bedroom' : 'Мастер-спальня'
            const kid = lang === 'hy' ? 'Մանկական' : lang === 'en' ? 'Kids room' : 'Детская'
            label = ground && bed === 1 ? master : `${kid} ${bed}`
          }
          return { type: s.type, label, weight: s.weight }
        })
      })()

  const startEditing = () =>
    setEditRooms(autoProgram(house, 0).map((s) => ({ id: newRoomId(), label: s.label, type: s.type, weight: s.weight })))

  const planLabels = {
    voidLabel: lang === 'hy' ? 'Բաց սրահ · երկրորդ լույս' : lang === 'en' ? 'Open to below · double height' : 'Второй свет · открыто вниз',
    corridorLabel: lang === 'hy' ? 'Միջանցք' : lang === 'en' ? 'Corridor' : 'Коридор',
    wardrobeLabel: lang === 'hy' ? 'Հանդերձ.' : lang === 'en' ? 'Closet' : 'Гардероб',
    hallLabel: lang === 'hy' ? 'Նախասրահ' : lang === 'en' ? 'Entry hall' : 'Прихожая',
    officeLabel: lang === 'hy' ? 'Աշխատասենյակ' : lang === 'en' ? 'Home office' : 'Кабинет',
    diningLabel: lang === 'hy' ? 'Խոհանոց-ճաշասենյակ' : lang === 'en' ? 'Kitchen-dining' : 'Кухня-столовая',
    livingLabel: lang === 'hy' ? 'Հյուրասենյակ' : lang === 'en' ? 'Living room' : 'Гостиная',
    ensuiteLabel: lang === 'hy' ? 'Անձնական ս/հ' : lang === 'en' ? 'Ensuite' : 'Мастер с/у',
    utilityLabel: lang === 'hy' ? 'Տեխնիկական սենյակ' : lang === 'en' ? 'Utility room' : 'Техпомещение',
  }
  // room-by-room areas for the active floor (same layout the plan renders)
  // areas clear of the partitions; the void is shown in full (it is the slab opening)
  const floorPlan = buildFloorPlan(house, activeFloor, custom, planLabels)
  const planRooms = floorPlan.rooms
  const roomArea = (r: (typeof planRooms)[number]) => (r.open ? r.w * r.h : roomClear(r, floorPlan).area)
  const usableFloorArea = planRooms.filter((r) => !r.open).reduce((a, r) => a + roomArea(r), 0)

  return (
    <div className="panel">
      <div className="panel-head">
        <span>{t(lang, 'plan2d')} · {house.length}×{house.width} {lang !== 'hy' ? 'м' : 'մ'}</span>
        {house.floors > 1 ? (
          <div className="seg no-print">
            {Array.from({ length: house.floors }, (_, i) => (
              <button key={i} aria-pressed={activeFloor === i} onClick={() => setFloor(i)}>
                {i + 1} {lang === 'hy' ? 'հարկ' : lang === 'en' ? 'fl.' : 'эт.'}
              </button>
            ))}
          </div>
        ) : (
          <span className="sub">1 {lang !== 'hy' ? 'этаж' : 'հարկ'}</span>
        )}
      </div>

      <div className="plan-wrap" style={{ padding: '1rem' }}>
        <FloorPlanSvg house={house} floorIndex={activeFloor} custom={custom} labels={planLabels} />

        {/* Планировочный аудит: вход, проходные комнаты, пропорции, окна,
            совпадение лестниц и проёма. Показывается сразу под планом, чтобы
            дефект было видно без разглядывания чертежа. */}
        <PlanAudit house={house} lang={lang} floor={activeFloor} />

        {/* room-by-room areas */}
        <div style={{ marginTop: '0.9rem' }}>
          <div className="eyebrow" style={{ marginBottom: '0.5rem' }}>
            {lang === 'hy' ? 'Սենյակների մակերեսներ' : lang === 'en' ? 'Room areas' : 'Площади комнат'} · {activeFloor + 1} {lang === 'hy' ? 'հարկ' : lang === 'en' ? 'fl.' : 'эт.'}
          </div>
          {planRooms.map((r, i) => (
            <div className="spec-row" key={i}>
              <span style={{ color: r.open ? 'var(--color-ink-soft)' : undefined }}>
                {r.label}
                {r.open && <span style={{ fontSize: '0.72rem', color: 'var(--color-ink-soft)' }}> · {lang === 'hy' ? 'չի հաշվվում' : lang === 'en' ? 'not counted' : 'вне площади'}</span>}
              </span>
              <span className="num" style={{ color: r.open ? 'var(--color-ink-soft)' : undefined }}>{roomArea(r).toFixed(1)} м²</span>
            </div>
          ))}
          <div className="spec-row" style={{ fontWeight: 700, borderBottom: 'none' }}>
            <span>{lang === 'hy' ? 'Հարկի օգտակար մակերես' : lang === 'en' ? 'Usable floor area' : 'Полезная площадь этажа'}</span>
            <span className="num" style={{ color: 'var(--color-copper)' }}>{usableFloorArea.toFixed(1)} м²</span>
          </div>
        </div>

        {/* room editor (ground floor) */}
        {activeFloor === 0 && (
          <div style={{ marginTop: '0.9rem' }} className="no-print">
            {!editing ? (
              <button className="btn btn-ghost" onClick={startEditing}>
                {lang !== 'hy' ? 'Редактировать комнаты' : 'Խմբագրել սենյակները'}
              </button>
            ) : (
              <div style={{ border: '1px solid var(--color-border)', borderRadius: 10, padding: '0.7rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <strong style={{ fontFamily: 'var(--font-display)', fontSize: '0.9rem' }}>
                    {lang !== 'hy' ? 'Комнаты' : 'Սենյակներ'}
                  </strong>
                  <button className="btn btn-ghost" style={{ padding: '0.25rem 0.6rem', fontSize: '0.74rem' }} onClick={() => setEditRooms(null)}>
                    {lang !== 'hy' ? 'Авто' : 'Ավտո'}
                  </button>
                </div>
                {editRooms!.map((r) => (
                  <RoomRow key={r.id} room={r} lang={lang} onChange={(p) => updateRoom(r.id, p)} onRemove={() => removeRoom(r.id)} />
                ))}
                <button className="btn btn-accent" style={{ marginTop: '0.5rem', padding: '0.4rem 0.9rem', fontSize: '0.8rem' }} onClick={addRoom}>
                  + {lang !== 'hy' ? 'Добавить комнату' : 'Ավելացնել սենյակ'}
                </button>
              </div>
            )}
          </div>
        )}

        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.8rem', flexWrap: 'wrap' }} className="no-print">
          <button className="btn btn-accent" onClick={() => downloadDxf(buildPlan(house), 'armenia-house-plan.dxf')}>
            {t(lang, 'exportDxf')}
          </button>
          <button className="btn btn-ghost" onClick={() => window.print()}>
            {t(lang, 'exportPdf')}
          </button>
        </div>
      </div>
    </div>
  )
}

function PlanAudit({ house, lang, floor }: { house: HouseParams; lang: string; floor: number }) {
  const issues = auditPlan(house).filter((i) => i.floor === floor)
  const errs = issues.filter((i) => i.level === 'error')
  const warns = issues.filter((i) => i.level === 'warning')
  const ok = errs.length === 0 && warns.length === 0
  const title =
    lang === 'hy' ? 'Հատակագծի ստուգում' : lang === 'en' ? 'Layout check' : 'Проверка планировки'
  return (
    <div style={{ marginTop: '0.9rem' }}>
      <div className="eyebrow" style={{ marginBottom: '0.5rem' }}>{title}</div>
      {ok && (
        <div style={{ fontSize: '0.82rem', color: 'var(--color-ok)' }}>
          {lang === 'hy' ? 'Հատակագծային սխալներ չկան։' : lang === 'en' ? 'No layout problems found.' : 'Планировочных ошибок не найдено.'}
        </div>
      )}
      {[...errs, ...warns].map((i, k) => (
        <div key={k} className="spec-row" style={{ alignItems: 'flex-start', gap: '0.6rem' }}>
          <span className={`badge lvl-${i.level}`} style={{ flex: 'none' }}>
            {i.level === 'error'
              ? lang === 'hy' ? 'սխալ' : lang === 'en' ? 'error' : 'ошибка'
              : lang === 'hy' ? 'ուշադրություն' : lang === 'en' ? 'check' : 'внимание'}
          </span>
          <span style={{ fontSize: '0.82rem', lineHeight: 1.45 }}>{issueText(i, lang)}</span>
        </div>
      ))}
    </div>
  )
}

function RoomRow({ room, lang, onChange, onRemove }: { room: EditRoom; lang: string; onChange: (p: Partial<EditRoom>) => void; onRemove: () => void }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1.2fr 1.3fr auto', gap: '0.4rem', alignItems: 'center', padding: '0.25rem 0' }}>
      <input className="input" style={{ padding: '0.35rem 0.5rem' }} value={room.label} onChange={(e) => onChange({ label: e.target.value })} />
      <select className="input" style={{ padding: '0.35rem 0.5rem' }} value={room.type} onChange={(e) => onChange({ type: e.target.value as RoomType })}>
        {(Object.keys(TYPE_LABEL) as RoomType[]).map((k) => (
          <option key={k} value={k}>{lang === 'hy' ? TYPE_LABEL[k].hy : lang === 'en' ? TYPE_LABEL[k].en : TYPE_LABEL[k].ru}</option>
        ))}
      </select>
      <input type="range" min={0.6} max={3} step={0.1} value={room.weight} onChange={(e) => onChange({ weight: Number(e.target.value) })} />
      <button aria-label="remove" onClick={onRemove} style={{ border: '1px solid var(--color-border)', background: '#fff', borderRadius: 8, cursor: 'pointer', padding: '0.2rem 0.5rem', color: 'var(--color-err)' }}>
        ×
      </button>
    </div>
  )
}
