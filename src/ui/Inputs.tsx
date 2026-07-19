import { useEffect } from 'react'
import { useProject } from '../store/useProject'
import { t } from '../i18n'
import type { HouseParams } from '../model/house'
import { defaultWallThickness } from '../model/house'
import { REGIONS } from '../data/regions'

function Num({
  label,
  value,
  onChange,
  step = 1,
  min = 0,
  disabled = false,
}: {
  label: string
  value: number
  onChange: (n: number) => void
  step?: number
  min?: number
  disabled?: boolean
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <input
        className="input"
        type="number"
        value={value}
        min={min}
        step={step}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        style={disabled ? { opacity: 0.6 } : undefined}
      />
    </label>
  )
}

export function Inputs() {
  const { house, lang, setHouse } = useProject()
  const set = (patch: Partial<HouseParams>) => setHouse(patch)

  const changeSystem = (system: HouseParams['system']) => {
    set({
      system,
      wallThickness: defaultWallThickness({ system, infillMaterial: house.infillMaterial }),
    })
  }

  // engineer-panel computed defaults (shown until overridden)
  const P = 2 * (house.length + house.width)
  const Lb = P * 1.5
  const colDefault = (Math.floor(house.length / 4) + 1) * (Math.floor(house.width / 4) + 1)
  const wallGross = Lb * house.floors * house.floorHeight
  const openingsDefault =
    wallGross > 0 ? Math.round(((house.windowAreaTotal + house.exteriorDoors * 2) / wallGross) * 100) : 15
  const eng = house.eng
  const setEng = (patch: Partial<HouseParams['eng']>) => set({ eng: { ...house.eng, ...patch } })

  // --- окна по норме освещения (ՀՀՇՆ 31-01-2014): ≥ 1/8 пола, ≤ 40% стен ---
  const wallT = house.wallThickness
  const internalPerFloor = Math.max(0, house.length - 2 * wallT) * Math.max(0, house.width - 2 * wallT)
  const hallV = house.doubleHeightHall && house.floors >= 2 ? Math.min(house.hallArea, house.length * house.width) : 0
  const netA = Math.max(0, internalPerFloor * house.floors - hallV)
  const usableA = netA * 0.8
  const outerWallArea = P * house.floors * house.floorHeight
  const winMin = usableA / 8 // норма освещения (минимум)
  const winMax = outerWallArea * 0.4 // макс остекление
  const winRec = Math.round(Math.min(Math.max(usableA / 6, winMin), outerWallArea * 0.38))
  useEffect(() => {
    if (house.windowAuto && Math.abs(house.windowAreaTotal - winRec) > 0.5) set({ windowAreaTotal: winRec })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [house.windowAuto, winRec, house.windowAreaTotal])

  return (
    <div className="panel">
      <div className="panel-head">
        <span>{t(lang, 'nav_calc')}</span>
        <span className="sub">{house.length}×{house.width} · {house.floors} {t(lang, 'floors').toLowerCase()}</span>
      </div>
      <div style={{ padding: '1rem' }}>
        {/* Step 1 — region + system */}
        <div className="eyebrow">01 · {t(lang, 'step_region')}</div>
        <label className="field">
          <span>{t(lang, 'region')}</span>
          <select
            className="input"
            value={house.region}
            onChange={(e) => set({ region: e.target.value as HouseParams['region'] })}
          >
            {Object.values(REGIONS).map((r) => (
              <option key={r.key} value={r.key}>
                {lang !== 'hy' ? r.nameRu : r.nameHy} · {r.seismic} {t(lang, 'points')}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>{t(lang, 'system')}</span>
          <select
            className="input"
            value={house.system}
            onChange={(e) => changeSystem(e.target.value as HouseParams['system'])}
          >
            <option value="frame">{t(lang, 'sys_frame')}</option>
            <option value="tuff">{t(lang, 'sys_tuff')}</option>
            <option value="aerated">{t(lang, 'sys_aerated')}</option>
            <option value="brick">{t(lang, 'sys_brick')}</option>
          </select>
        </label>
        {house.system === 'frame' && (
          <label className="field">
            <span>{t(lang, 'infill')}</span>
            <select
              className="input"
              value={house.infillMaterial}
              onChange={(e) => set({ infillMaterial: e.target.value as HouseParams['infillMaterial'] })}
            >
              <option value="aerated">{t(lang, 'sys_aerated')}</option>
              <option value="tuff">{t(lang, 'sys_tuff')}</option>
              <option value="brick">{t(lang, 'sys_brick')}</option>
            </select>
          </label>
        )}

        {/* Step 2 — size */}
        <div className="eyebrow" style={{ marginTop: '0.8rem' }}>02 · {t(lang, 'step_size')}</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
          <Num label={t(lang, 'length')} value={house.length} step={0.5} onChange={(n) => set({ length: n })} />
          <Num label={t(lang, 'width')} value={house.width} step={0.5} onChange={(n) => set({ width: n })} />
          <Num label={t(lang, 'floors')} value={house.floors} onChange={(n) => set({ floors: n })} />
          <Num label={t(lang, 'floorHeight')} value={house.floorHeight} step={0.1} onChange={(n) => set({ floorHeight: n })} />
        </div>
        <Num label={t(lang, 'plotArea')} value={house.plotArea} step={50} onChange={(n) => set({ plotArea: n })} />

        {/* Step 3 — foundation */}
        <div className="eyebrow" style={{ marginTop: '0.8rem' }}>03 · {t(lang, 'step_foundation')}</div>
        <label className="field">
          <span>{t(lang, 'foundation')}</span>
          <select
            className="input"
            value={house.foundation}
            onChange={(e) => set({ foundation: e.target.value as HouseParams['foundation'] })}
          >
            <option value="strip">{t(lang, 'fnd_strip')}</option>
            <option value="slab">{t(lang, 'fnd_slab')}</option>
            <option value="pile">{t(lang, 'fnd_pile')}</option>
            <option value="column">{t(lang, 'fnd_column')}</option>
          </select>
        </label>
        <label className="field" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <input
            type="checkbox"
            checked={house.basement}
            onChange={(e) => set({ basement: e.target.checked })}
          />
          <span style={{ marginBottom: 0 }}>{t(lang, 'basement')}</span>
        </label>
        {house.basement && (
          <Num label={t(lang, 'basementDepth')} value={house.basementDepth} step={0.1} onChange={(n) => set({ basementDepth: n })} />
        )}

        {/* Step 4 — roof */}
        <div className="eyebrow" style={{ marginTop: '0.8rem' }}>04 · {t(lang, 'step_roof')}</div>
        <label className="field">
          <span>{t(lang, 'roof')}</span>
          <select className="input" value={house.roof} onChange={(e) => set({ roof: e.target.value as HouseParams['roof'] })}>
            <option value="flat">{t(lang, 'roof_flat')}</option>
            <option value="pitched">{t(lang, 'roof_pitched')}</option>
            <option value="hip">{t(lang, 'roof_hip')}</option>
            <option value="mansard">{t(lang, 'roof_mansard')}</option>
          </select>
        </label>
        {house.roof !== 'flat' && (
          <Num label={t(lang, 'roofPitch')} value={house.roofPitchDeg} onChange={(n) => set({ roofPitchDeg: n })} />
        )}

        {/* Step 5 — openings */}
        <div className="eyebrow" style={{ marginTop: '0.8rem' }}>05 · {t(lang, 'step_openings')}</div>
        <Num label={t(lang, 'windowArea')} value={house.windowAreaTotal} step={1} onChange={(n) => set({ windowAreaTotal: n })} disabled={house.windowAuto} />
        <label className="field" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <input type="checkbox" checked={house.windowAuto} onChange={(e) => set({ windowAuto: e.target.checked })} />
          <span style={{ marginBottom: 0 }}>
            {lang === 'hy' ? 'Ավտո՝ ըստ լուսավորության նորմայի' : lang === 'en' ? 'Auto (by daylight norm)' : 'Авто (по норме освещения)'}
          </span>
        </label>
        <p style={{ margin: '-0.2rem 0 0.4rem', fontSize: '0.72rem', color: 'var(--color-ink-soft)', lineHeight: 1.4 }}>
          {lang === 'hy'
            ? `Նորմա՝ ≥ ${Math.round(winMin)} մ² (1/8 հատակ), ≤ ${Math.round(winMax)} մ² (40% պատեր)`
            : lang === 'en'
            ? `Norm: ≥ ${Math.round(winMin)} m² (1/8 floor), ≤ ${Math.round(winMax)} m² (40% walls)`
            : `Норма: ≥ ${Math.round(winMin)} м² (1/8 пола), ≤ ${Math.round(winMax)} м² (40% стен)`}
        </p>
        <label className="field">
          <span>{t(lang, 'vitrageShare')} · {Math.round(house.vitrageShare * 100)}%</span>
          <input
            className="input"
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={house.vitrageShare}
            onChange={(e) => set({ vitrageShare: Number(e.target.value) })}
          />
        </label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
          <Num label={t(lang, 'extDoors')} value={house.exteriorDoors} onChange={(n) => set({ exteriorDoors: n })} />
          <Num
            label={t(lang, 'intDoors')}
            value={house.interiorDoors ?? house.roomsPerFloor * house.floors}
            onChange={(n) => set({ interiorDoors: n })}
          />
        </div>

        {/* Step 7 — layout */}
        <div className="eyebrow" style={{ marginTop: '0.8rem' }}>07 · {t(lang, 'step_layout')}</div>
        <Num label={t(lang, 'roomsPerFloor')} value={house.roomsPerFloor} onChange={(n) => set({ roomsPerFloor: n })} />
        <label className="field" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <input type="checkbox" checked={house.kitchenLivingCombined} onChange={(e) => set({ kitchenLivingCombined: e.target.checked })} />
          <span style={{ marginBottom: 0 }}>{t(lang, 'kitchenLiving')}</span>
        </label>
        <label className="field" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <input type="checkbox" checked={house.doubleHeightHall} onChange={(e) => set({ doubleHeightHall: e.target.checked })} />
          <span style={{ marginBottom: 0 }}>{t(lang, 'doubleHall')}</span>
        </label>
        {house.doubleHeightHall && (
          <Num label={t(lang, 'hallArea')} value={house.hallArea} step={2} onChange={(n) => set({ hallArea: n })} />
        )}

        {/* Step 6 — finish */}
        <div className="eyebrow" style={{ marginTop: '0.8rem' }}>06 · {t(lang, 'step_finish')}</div>
        <label className="field">
          <span>{t(lang, 'finishLevel')}</span>
          <div className="seg" role="group">
            <button aria-pressed={house.finishLevel === 'economy'} onClick={() => set({ finishLevel: 'economy' })}>
              {t(lang, 'economy')}
            </button>
            <button aria-pressed={house.finishLevel === 'standard'} onClick={() => set({ finishLevel: 'standard' })}>
              {t(lang, 'standard')}
            </button>
            <button aria-pressed={house.finishLevel === 'premium'} onClick={() => set({ finishLevel: 'premium' })}>
              {t(lang, 'premium')}
            </button>
          </div>
        </label>
        <label className="field" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <input type="checkbox" checked={house.vatIncluded} onChange={(e) => set({ vatIncluded: e.target.checked })} />
          <span style={{ marginBottom: 0 }}>{t(lang, 'vat')}</span>
        </label>
        <label className="field" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <input type="checkbox" checked={house.includePermitCost} onChange={(e) => set({ includePermitCost: e.target.checked })} />
          <span style={{ marginBottom: 0 }}>{t(lang, 'includePermit')}</span>
        </label>
        <Num label={t(lang, 'laborPerM2')} value={house.laborPerM2} step={500} onChange={(n) => set({ laborPerM2: n })} />

        {/* Step 08 — optional premium systems */}
        <div className="eyebrow" style={{ marginTop: '0.8rem' }}>
          08 · {lang === 'hy' ? 'Լրացուցիչ համակարգեր' : lang === 'en' ? 'Optional systems' : 'Дополнительные системы'}
        </div>
        <label className="field" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <input type="checkbox" checked={house.optHeating} onChange={(e) => set({ optHeating: e.target.checked })} />
          <span style={{ marginBottom: 0 }}>
            {lang === 'hy' ? 'Ջեռուցում՝ կաթսա + տաք հատակ' : lang === 'en' ? 'Heating: boiler + warm floor' : 'Отопление: котёл + тёплый пол'}
          </span>
        </label>
        <label className="field" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <input type="checkbox" checked={house.optHeatPump} onChange={(e) => set({ optHeatPump: e.target.checked })} />
          <span style={{ marginBottom: 0 }}>
            {lang === 'hy' ? 'Ջերմային պոմպ (օդ-ջուր)' : lang === 'en' ? 'Heat pump (air-water)' : 'Тепловой насос (воздух-вода)'}
          </span>
        </label>
        <label className="field" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <input type="checkbox" checked={house.optFinishPremium} onChange={(e) => set({ optFinishPremium: e.target.checked })} />
          <span style={{ marginBottom: 0 }}>
            {lang === 'hy' ? 'Ֆինիշ հարդարում «բանալի հանձնում»' : lang === 'en' ? 'Turnkey finishing' : 'Финишная отделка «под ключ»'}
          </span>
        </label>
        <Num
          label={lang === 'hy' ? 'Արևային վահանակներ, կՎտ' : lang === 'en' ? 'Solar panels, kW' : 'Солнечные панели, кВт'}
          value={house.optSolarKw}
          step={1}
          onChange={(n) => set({ optSolarKw: n })}
        />

        {/* Advanced */}
        <details style={{ marginTop: '0.6rem' }}>
          <summary className="mono" style={{ cursor: 'pointer', fontSize: '0.76rem', color: 'var(--color-copper)' }}>
            {t(lang, 'advanced')}
          </summary>
          <div style={{ marginTop: '0.6rem' }}>
            <Num label={t(lang, 'wallThickness')} value={house.wallThickness} step={0.05} onChange={(n) => set({ wallThickness: n })} />
            <label className="field">
              <span>{t(lang, 'concreteGrade')}</span>
              <select
                className="input"
                value={house.concreteGrade}
                onChange={(e) => set({ concreteGrade: e.target.value })}
              >
                <option value="concrete_b15">B15 / M200</option>
                <option value="concrete_b20">B20 / M250</option>
                <option value="concrete_b225">B22.5 / M300</option>
                <option value="concrete_b25">B25 / M350</option>
                <option value="concrete_b30">B30 / M400</option>
              </select>
            </label>
            <label className="field">
              <span>{lang !== 'hy' ? 'Марка арматуры' : 'Արմատուրի դաս'}</span>
              <select className="input" value={house.rebarGrade} onChange={(e) => set({ rebarGrade: e.target.value })}>
                <option value="rebar_a500">А500С</option>
                <option value="rebar_a400">А400 (A-III)</option>
              </select>
            </label>
            <label className="field">
              <span>{t(lang, 'floorSlab')}</span>
              <div className="seg" role="group">
                <button aria-pressed={house.floorSlab === 'monolith'} onClick={() => set({ floorSlab: 'monolith' })}>
                  {t(lang, 'monolith')}
                </button>
                <button aria-pressed={house.floorSlab === 'precast'} onClick={() => set({ floorSlab: 'precast' })}>
                  {t(lang, 'precast')}
                </button>
              </div>
            </label>
            <label className="field" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <input
                type="checkbox"
                checked={house.seismicReinforcementDisabled}
                onChange={(e) => set({ seismicReinforcementDisabled: e.target.checked })}
              />
              <span style={{ marginBottom: 0, color: 'var(--color-err)' }}>{t(lang, 'noSeismic')}</span>
            </label>
          </div>
        </details>

        {/* Engineer overrides — prominent, open by default */}
        <details
          open
          style={{ marginTop: '1rem', border: '1px solid var(--color-ink)', borderRadius: 3, padding: '0.8rem 0.9rem' }}
        >
          <summary className="eyebrow" style={{ cursor: 'pointer' }}>
            {t(lang, 'engTitle')}
          </summary>
          <p style={{ fontSize: '0.74rem', color: 'var(--color-ink-soft)', margin: '0.5rem 0 0.2rem' }}>
            {lang === 'ru'
              ? 'Любое значение вне норм РА подсветится в «Предупреждениях».'
              : 'ՀՀ նորմերից դուրս ցանկացած արժեք կնշվի «Նախազգուշացումներում»։'}
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem', marginTop: '0.7rem' }}>
            <Num label={t(lang, 'eng_stripLen')} value={eng.stripLen ?? Math.round(Lb)} onChange={(n) => setEng({ stripLen: n })} />
            <Num label={t(lang, 'eng_stripWidth')} value={eng.stripWidth ?? 40} onChange={(n) => setEng({ stripWidth: n })} />
            <Num label={t(lang, 'eng_stripHeight')} value={eng.stripHeight ?? 80} onChange={(n) => setEng({ stripHeight: n })} />
            <Num label={t(lang, 'eng_floorOnGround')} value={eng.floorOnGround ?? 0} onChange={(n) => setEng({ floorOnGround: n })} />
            <Num label={t(lang, 'eng_blinding')} value={eng.blinding ?? 5} onChange={(n) => setEng({ blinding: n })} />
            <Num label={t(lang, 'eng_slab')} value={eng.slab ?? 17} onChange={(n) => setEng({ slab: n })} />
            <Num label={t(lang, 'eng_extWall')} value={eng.extWall ?? Math.round(house.wallThickness * 100)} onChange={(n) => setEng({ extWall: n })} />
            <Num label={t(lang, 'eng_columns')} value={eng.columns ?? colDefault} onChange={(n) => setEng({ columns: n })} />
            <Num label={t(lang, 'eng_columnSize')} value={eng.columnSize ?? 40} onChange={(n) => setEng({ columnSize: n })} />
            <Num label={t(lang, 'eng_beamsLen')} value={eng.beamsLen ?? Math.round(Lb * house.floors)} onChange={(n) => setEng({ beamsLen: n })} />
            <Num label={t(lang, 'eng_beamSection')} value={eng.beamSection ?? 0.16} step={0.01} onChange={(n) => setEng({ beamSection: n })} />
            <Num label={t(lang, 'eng_openingsPct')} value={eng.openingsPct ?? openingsDefault} onChange={(n) => setEng({ openingsPct: n })} />
            <Num label={t(lang, 'eng_wastePct')} value={eng.wastePct ?? 5} onChange={(n) => setEng({ wastePct: n })} />
            <Num label={t(lang, 'eng_basementWall')} value={eng.basementWall ?? 30} onChange={(n) => setEng({ basementWall: n })} />
          </div>
          <label className="field" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.6rem' }}>
            <input type="checkbox" checked={house.beamsOverHall} onChange={(e) => set({ beamsOverHall: e.target.checked })} />
            <span style={{ marginBottom: 0 }}>{t(lang, 'beamsOverHall')}</span>
          </label>
          <button
            className="btn btn-ghost no-print"
            style={{ marginTop: '0.6rem', padding: '0.3rem 0.7rem', fontSize: '0.76rem' }}
            onClick={() => set({ eng: {} })}
          >
            {t(lang, 'engReset')}
          </button>
        </details>
      </div>
    </div>
  )
}
