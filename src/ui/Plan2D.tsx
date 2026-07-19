import { useState } from 'react'
import { useProject, newRoomId } from '../store/useProject'
import type { EditRoom } from '../store/useProject'
import { t } from '../i18n'
import { buildPlan } from '../engine/plan'
import { downloadDxf } from '../engine/dxf'
import { autoProgram } from '../engine/floorplan'
import type { RoomType } from '../engine/floorplan'
import { FloorPlanSvg } from './FloorPlan'

const TYPE_LABEL: Record<RoomType, { ru: string; hy: string }> = {
  living_kitchen: { ru: 'Гостиная-кухня', hy: 'Հյուրասենյակ-խոհանոց' },
  living: { ru: 'Гостиная', hy: 'Հյուրասենյակ' },
  kitchen: { ru: 'Кухня', hy: 'Խոհանոց' },
  bedroom: { ru: 'Комната', hy: 'Սենյակ' },
  bath: { ru: 'Санузел', hy: 'Սանհանգույց' },
}

export function Plan2D() {
  const { house, lang, editRooms, setEditRooms, updateRoom, addRoom, removeRoom } = useProject()
  const [floor, setFloor] = useState(0)
  const activeFloor = Math.min(floor, house.floors - 1)

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
          const ru = lang !== 'hy'
          let label = TYPE_LABEL[s.type][ru ? 'ru' : 'hy']
          if (s.type === 'bath' && ground) label = ru ? 'Гостевой санузел' : 'Հյուրերի սանհանգույց'
          else if (s.type === 'bedroom') {
            bed++
            label = ground && bed === 1 ? (ru ? 'Мастер-спальня' : 'Գլխավոր ննջասենյակ') : `${TYPE_LABEL.bedroom[ru ? 'ru' : 'hy']} ${bed}`
          }
          return { type: s.type, label, weight: s.weight }
        })
      })()

  const startEditing = () =>
    setEditRooms(autoProgram(house, 0).map((s) => ({ id: newRoomId(), label: s.label, type: s.type, weight: s.weight })))

  return (
    <div className="panel">
      <div className="panel-head">
        <span>{t(lang, 'plan2d')} · {house.length}×{house.width} {lang !== 'hy' ? 'м' : 'մ'}</span>
        {house.floors > 1 ? (
          <div className="seg no-print">
            {Array.from({ length: house.floors }, (_, i) => (
              <button key={i} aria-pressed={activeFloor === i} onClick={() => setFloor(i)}>
                {i + 1} {lang !== 'hy' ? 'эт.' : 'հարկ'}
              </button>
            ))}
          </div>
        ) : (
          <span className="sub">1 {lang !== 'hy' ? 'этаж' : 'հարկ'}</span>
        )}
      </div>

      <div style={{ padding: '1rem' }}>
        <FloorPlanSvg
          house={house}
          floorIndex={activeFloor}
          custom={custom}
          voidLabel={lang === 'hy' ? 'Բաց սրահ · երկրորդ լույս' : lang === 'en' ? 'Open to below · double height' : 'Второй свет · открыто вниз'}
        />

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

function RoomRow({ room, lang, onChange, onRemove }: { room: EditRoom; lang: string; onChange: (p: Partial<EditRoom>) => void; onRemove: () => void }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1.2fr 1.3fr auto', gap: '0.4rem', alignItems: 'center', padding: '0.25rem 0' }}>
      <input className="input" style={{ padding: '0.35rem 0.5rem' }} value={room.label} onChange={(e) => onChange({ label: e.target.value })} />
      <select className="input" style={{ padding: '0.35rem 0.5rem' }} value={room.type} onChange={(e) => onChange({ type: e.target.value as RoomType })}>
        {(Object.keys(TYPE_LABEL) as RoomType[]).map((k) => (
          <option key={k} value={k}>{lang !== 'hy' ? TYPE_LABEL[k].ru : TYPE_LABEL[k].hy}</option>
        ))}
      </select>
      <input type="range" min={0.6} max={3} step={0.1} value={room.weight} onChange={(e) => onChange({ weight: Number(e.target.value) })} />
      <button aria-label="remove" onClick={onRemove} style={{ border: '1px solid var(--color-border)', background: '#fff', borderRadius: 8, cursor: 'pointer', padding: '0.2rem 0.5rem', color: 'var(--color-err)' }}>
        ×
      </button>
    </div>
  )
}
