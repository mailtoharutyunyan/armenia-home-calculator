import { useEffect } from 'react'
import { useProject } from '../store/useProject'
import { t } from '../i18n'
import type { HouseParams } from '../model/house'
import { defaultWallThickness, BUILD_PRESETS } from '../model/house'
import { REGIONS } from '../data/regions'
import { COEFF as C } from '../data/coefficients'

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

// Класс бетона по элементу; пустое значение => берётся общий класс из формы.
const GRADES = ['concrete_b15', 'concrete_b20', 'concrete_b225', 'concrete_b25', 'concrete_b30']
const GRADE_LABEL: Record<string, string> = {
  concrete_b15: 'B15 / М200',
  concrete_b20: 'B20 / М250',
  concrete_b225: 'B22.5 / М300',
  concrete_b25: 'B25 / М350',
  concrete_b30: 'B30 / М400',
}

function GradeSel({ label, lang, value, onChange }: { label: string; lang: string; value?: string; onChange: (v: string | undefined) => void }) {
  return (
    <label className="field">
      <span>{label}</span>
      <select className="input" value={value ?? ''} onChange={(e) => onChange(e.target.value || undefined)}>
        <option value="">{t(lang as never, 'engf_sameAsMain')}</option>
        {GRADES.map((g) => (
          <option key={g} value={g}>
            {GRADE_LABEL[g]}
          </option>
        ))}
      </select>
    </label>
  )
}

export function Inputs() {
  const { house, lang, setHouse } = useProject()
  const set = (patch: Partial<HouseParams>) => setHouse(patch)

  // Переключатель способа строительства подставляет типовые проценты,
  // но каждый из них остаётся редактируемым вручную.
  const applyBuildMode = (buildMode: HouseParams['buildMode']) => {
    set({ buildMode, ...BUILD_PRESETS[buildMode] })
  }

  const changeSystem = (system: HouseParams['system']) => {
    set({
      system,
      wallThickness: defaultWallThickness({ system, infillMaterial: house.infillMaterial }),
    })
  }

  const eng = house.eng
  const setEng = (patch: Partial<HouseParams['eng']>) => set({ eng: { ...house.eng, ...patch } })

  // Engineer-panel defaults, shown until overridden. They follow the same
  // fallbacks as computeQuantities, so typing a shown value back in must not
  // change the estimate.
  const P = 2 * (house.length + house.width)
  const bearingShare =
    eng.internalBearingPct != null && eng.internalBearingPct >= 0 ? eng.internalBearingPct / 100 : C.internalBearingFactor
  const Lb = P * (1 + bearingShare)
  const gridStep = eng.columnGridStep != null && eng.columnGridStep > 0 ? eng.columnGridStep : C.columnGridStep
  const colDefault = (Math.floor(house.length / gridStep) + 1) * (Math.floor(house.width / gridStep) + 1)
  const colSizeM = eng.columnSize != null && eng.columnSize > 0 ? eng.columnSize / 100 : C.columnSection.w
  // a frame is infilled on the outer contour only; bearing walls run along all axes
  const wallGross = (house.system === 'frame' ? P : Lb) * house.floors * house.floorHeight
  const openingsDefault =
    wallGross > 0 ? Math.round(((house.windowAreaTotal + house.exteriorDoors * 2) / wallGross) * 100) : 15

  // --- окна по норме освещения (ՀՀՇՆ 31-01-2014): ≥ 1/8 пола, ≤ 40% стен ---
  const wallT = eng.extWall != null && eng.extWall > 0 ? eng.extWall / 100 : house.wallThickness
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
      <div className="side-body">
        {/* Step 1 — region + system */}
        <details className="group" name="calc-step" open>
          <summary><span className="eyebrow">01 · {t(lang, 'step_region')}</span></summary>
          <div className="group-body">
        <label className="field">
          <span>{t(lang, 'region')}</span>
          <select
            className="input"
            value={house.region}
            onChange={(e) => set({ region: e.target.value as HouseParams['region'] })}
          >
            {Object.values(REGIONS).map((r) => (
              <option key={r.key} value={r.key}>
                {lang === 'hy' ? r.nameHy : lang === 'en' ? r.nameEn : r.nameRu} · {r.seismic} {t(lang, 'points')}
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
            <option value="monolith">{t(lang, 'sys_monolith')}</option>
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

        {/* Step 2 — size */}
          </div>
        </details>
        <details className="group" name="calc-step">
          <summary><span className="eyebrow">02 · {t(lang, 'step_size')}</span></summary>
          <div className="group-body">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
          <Num label={t(lang, 'length')} value={house.length} step={0.5} onChange={(n) => set({ length: n })} />
          <Num label={t(lang, 'width')} value={house.width} step={0.5} onChange={(n) => set({ width: n })} />
          <Num label={t(lang, 'floors')} value={house.floors} min={1} onChange={(n) => set({ floors: n })} />
          <Num label={t(lang, 'floorHeight')} value={house.floorHeight} step={0.1} onChange={(n) => set({ floorHeight: n })} />
        </div>
        <label className="field">
          <span>{t(lang, 'frontSide')}</span>
          <div className="seg" role="group">
            <button aria-pressed={house.frontSide === 'length'} onClick={() => set({ frontSide: 'length' })}>
              {house.length} {t(lang, 'meters')}
            </button>
            <button aria-pressed={house.frontSide === 'width'} onClick={() => set({ frontSide: 'width' })}>
              {house.width} {t(lang, 'meters')}
            </button>
          </div>
        </label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
          <Num label={t(lang, 'plotArea')} value={house.plotArea} step={50} onChange={(n) => set({ plotArea: n })} />
          <Num label={t(lang, 'auxBuildingArea')} value={house.auxBuildingArea} step={5} onChange={(n) => set({ auxBuildingArea: n })} />
        </div>

        {/* Step 3 — foundation */}
          </div>
        </details>
        <details className="group" name="calc-step">
          <summary><span className="eyebrow">03 · {t(lang, 'step_foundation')}</span></summary>
          <div className="group-body">
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
          </div>
        </details>
        <details className="group" name="calc-step">
          <summary><span className="eyebrow">04 · {t(lang, 'step_roof')}</span></summary>
          <div className="group-body">
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
          </div>
        </details>
        <details className="group" name="calc-step">
          <summary><span className="eyebrow">05 · {t(lang, 'step_openings')}</span></summary>
          <div className="group-body">
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
          </div>
        </details>
        <details className="group" name="calc-step">
          <summary><span className="eyebrow">06 · {t(lang, 'step_layout')}</span></summary>
          <div className="group-body">
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
          </div>
        </details>
        <details className="group" name="calc-step">
          <summary><span className="eyebrow">07 · {t(lang, 'step_finish')}</span></summary>
          <div className="group-body">
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

        {/* Who builds — sets overhead and profit; VAT has its own checkbox above */}
        <details className="group" name="calc-step">
          <summary><span className="eyebrow">{t(lang, 'buildMode')}</span></summary>
          <div className="group-body">
            <div className="seg" role="group" style={{ marginBottom: '0.6rem' }}>
              <button aria-pressed={house.buildMode === 'self'} onClick={() => applyBuildMode('self')}>
                {t(lang, 'bm_self')}
              </button>
              <button aria-pressed={house.buildMode === 'contractor'} onClick={() => applyBuildMode('contractor')}>
                {t(lang, 'bm_contractor')}
              </button>
            </div>
            <p style={{ fontSize: '0.74rem', color: 'var(--color-ink-soft)', margin: '0 0 0.7rem', lineHeight: 1.5 }}>
              {t(lang, 'buildModeHint')}
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
              <Num label={t(lang, 'overhead') + ', %'} value={house.overheadPct} step={1} onChange={(n) => set({ overheadPct: n })} />
              <Num label={t(lang, 'profit') + ', %'} value={house.profitPct} step={1} onChange={(n) => set({ profitPct: n })} />
              <Num label={t(lang, 'temporary') + ', %'} value={house.temporaryPct} step={0.5} onChange={(n) => set({ temporaryPct: n })} />
              <Num label={t(lang, 'winter') + ', %'} value={house.winterPct} step={0.5} onChange={(n) => set({ winterPct: n })} />
              <Num label={t(lang, 'contingency') + ', %'} value={house.contingencyPct} step={1} onChange={(n) => set({ contingencyPct: n })} />
            </div>
          </div>
        </details>

        {/* Step 08 — сети и участок */}
          </div>
        </details>
        <details className="group" name="calc-step">
          <summary><span className="eyebrow">08 · {t(lang, 'step_utilities')}</span></summary>
          <div className="group-body">
        <label className="field" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <input type="checkbox" checked={house.connectElectricity} onChange={(e) => set({ connectElectricity: e.target.checked })} />
          <span style={{ marginBottom: 0 }}>{t(lang, 'connectElectricity')}</span>
        </label>
        <label className="field" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <input type="checkbox" checked={house.connectGas} onChange={(e) => set({ connectGas: e.target.checked })} />
          <span style={{ marginBottom: 0 }}>{t(lang, 'connectGas')}</span>
        </label>
        <label className="field" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <input type="checkbox" checked={house.connectWater} onChange={(e) => set({ connectWater: e.target.checked })} />
          <span style={{ marginBottom: 0 }}>{t(lang, 'connectWater')}</span>
        </label>
        <label className="field" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <input type="checkbox" checked={house.connectSewer} onChange={(e) => set({ connectSewer: e.target.checked })} />
          <span style={{ marginBottom: 0 }}>{t(lang, 'connectSewer')}</span>
        </label>
        <label className="field" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {/* септик нужен только там, где нет центральной канализации */}
          <input type="checkbox" checked={house.septic} disabled={house.connectSewer} onChange={(e) => set({ septic: e.target.checked })} />
          <span style={{ marginBottom: 0, opacity: house.connectSewer ? 0.5 : 1 }}>{t(lang, 'septic')}</span>
        </label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
          <Num label={t(lang, 'fenceLength')} value={house.fenceLength} step={5} onChange={(n) => set({ fenceLength: n })} />
          <Num label={t(lang, 'sitePavingArea')} value={house.sitePavingArea} step={5} onChange={(n) => set({ sitePavingArea: n })} />
        </div>
        <Num label={t(lang, 'balconyArea')} value={house.balconyArea} step={2} onChange={(n) => set({ balconyArea: n })} />
        <label className="field" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <input type="checkbox" checked={house.concretePump} onChange={(e) => set({ concretePump: e.target.checked })} />
          <span style={{ marginBottom: 0 }}>{t(lang, 'concretePump')}</span>
        </label>
        <p style={{ fontSize: '0.72rem', color: 'var(--color-ink-soft)', margin: '0 0 0.6rem' }}>{t(lang, 'utilitiesHint')}</p>

          </div>
        </details>
        {/* Step 09 — optional premium systems */}
        <details className="group" name="calc-step">
          <summary><span className="eyebrow">09 · {lang === 'hy' ? 'Լրացուցիչ համակարգեր' : lang === 'en' ? 'Optional systems' : 'Дополнительные системы'}</span></summary>
          <div className="group-body">
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
        <label className="field" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <input type="checkbox" checked={house.optPanelCeiling} onChange={(e) => set({ optPanelCeiling: e.target.checked })} />
          <span style={{ marginBottom: 0 }}>
            {lang === 'hy' ? 'Վահանակային առաստաղ' : lang === 'en' ? 'Panel ceiling' : 'Панельный (реечный) потолок'}
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
          </div>
        </details>

        {/* Параметры инженера — такой же шаг аккордеона, как остальные.
            Раньше это была отдельная рамка рядом со списком: два разных
            паттерна в одной панели читались как сбой вёрстки. */}
        <details className="group" name="calc-step">
          <summary>
            <span className="eyebrow">10 · {t(lang, 'engTitle')}</span>
          </summary>
          <p style={{ fontSize: '0.74rem', color: 'var(--color-ink-soft)', margin: '0.5rem 0 0.2rem' }}>
            {lang === 'ru'
              ? 'Любое значение вне норм РА подсветится в «Предупреждениях».'
              : 'ՀՀ նորմերից դուրս ցանկացած արժեք կնշվի «Նախազգուշացումներում»։'}
          </p>
          <details className="group" open>
            <summary><span className="eyebrow">{t(lang, 'engg_fnd')}</span></summary>
            <div className="group-body" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
              <Num label={t(lang, 'engf_stripLen')} value={eng.stripLen ?? Math.round(Lb)} step={1} onChange={(n) => setEng({ stripLen: n })} />
              <Num label={t(lang, 'engf_stripWidth')} value={eng.stripWidth ?? 40} step={1} onChange={(n) => setEng({ stripWidth: n })} />
              <Num label={t(lang, 'engf_stripHeight')} value={eng.stripHeight ?? 80} step={1} onChange={(n) => setEng({ stripHeight: n })} />
              <Num label={t(lang, 'engf_slabThickness')} value={eng.slabThickness ?? 30} step={1} onChange={(n) => setEng({ slabThickness: n })} />
              <Num label={t(lang, 'engf_pileDiameter')} value={eng.pileDiameter ?? 30} step={1} onChange={(n) => setEng({ pileDiameter: n })} />
              <Num label={t(lang, 'engf_pileLength')} value={eng.pileLength ?? 3} step={0.5} onChange={(n) => setEng({ pileLength: n })} />
              <Num label={t(lang, 'engf_foundationAxisStep')} value={eng.foundationAxisStep ?? 2} step={0.5} onChange={(n) => setEng({ foundationAxisStep: n })} />
              <Num label={t(lang, 'engf_columnFoundationHeight')} value={eng.columnFoundationHeight ?? 1.5} step={0.1} onChange={(n) => setEng({ columnFoundationHeight: n })} />
              <Num label={t(lang, 'engf_floorOnGround')} value={eng.floorOnGround ?? 0} step={1} onChange={(n) => setEng({ floorOnGround: n })} />
              <Num label={t(lang, 'engf_blinding')} value={eng.blinding ?? 5} step={1} onChange={(n) => setEng({ blinding: n })} />
              <Num label={t(lang, 'engf_sandBed')} value={eng.sandBed ?? 10} step={1} onChange={(n) => setEng({ sandBed: n })} />
              <Num label={t(lang, 'engf_apronWidth')} value={eng.apronWidth ?? 1} step={0.1} onChange={(n) => setEng({ apronWidth: n })} />
              <Num label={t(lang, 'engf_backfillPct')} value={eng.backfillPct ?? 60} step={5} onChange={(n) => setEng({ backfillPct: n })} />
              <Num label={t(lang, 'engf_basementWall')} value={eng.basementWall ?? 30} step={1} onChange={(n) => setEng({ basementWall: n })} />
              <Num label={t(lang, 'engf_basementWorkingWidth')} value={eng.basementWorkingWidth ?? 60} step={5} onChange={(n) => setEng({ basementWorkingWidth: n })} />
            </div>
          </details>
          <details className="group" >
            <summary><span className="eyebrow">{t(lang, 'engg_frame')}</span></summary>
            <div className="group-body" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
              <Num label={t(lang, 'engf_extWall')} value={eng.extWall ?? Math.round(house.wallThickness * 100)} step={1} onChange={(n) => setEng({ extWall: n })} />
              <Num label={t(lang, 'engf_columns')} value={eng.columns ?? colDefault} step={1} onChange={(n) => setEng({ columns: n })} />
              <Num label={t(lang, 'engf_columnSize')} value={eng.columnSize ?? Math.round(colSizeM * 100)} step={1} onChange={(n) => setEng({ columnSize: n })} />
              <Num label={t(lang, 'engf_columnGridStep')} value={eng.columnGridStep ?? C.columnGridStep} step={0.5} onChange={(n) => setEng({ columnGridStep: n })} />
              <Num label={t(lang, 'engf_beamsLen')} value={eng.beamsLen ?? Math.round(Lb * house.floors)} step={1} onChange={(n) => setEng({ beamsLen: n })} />
              <Num label={t(lang, 'engf_beamSection')} value={eng.beamSection ?? Math.round(colSizeM * colSizeM * 1000) / 1000} step={0.01} onChange={(n) => setEng({ beamSection: n })} />
              <Num label={t(lang, 'engf_internalBearingPct')} value={eng.internalBearingPct ?? 50} step={5} onChange={(n) => setEng({ internalBearingPct: n })} />
              <Num label={t(lang, 'engf_ringBeamW')} value={eng.ringBeamW ?? 30} step={1} onChange={(n) => setEng({ ringBeamW: n })} />
              <Num label={t(lang, 'engf_ringBeamH')} value={eng.ringBeamH ?? 20} step={1} onChange={(n) => setEng({ ringBeamH: n })} />
              <Num label={t(lang, 'engf_seismicCoreSize')} value={eng.seismicCoreSize ?? 25} step={1} onChange={(n) => setEng({ seismicCoreSize: n })} />
              <Num label={t(lang, 'engf_seismicCoreStep')} value={eng.seismicCoreStep ?? 3} step={0.5} onChange={(n) => setEng({ seismicCoreStep: n })} />
              <Num label={t(lang, 'engf_lintelW')} value={eng.lintelW ?? 25} step={1} onChange={(n) => setEng({ lintelW: n })} />
              <Num label={t(lang, 'engf_lintelH')} value={eng.lintelH ?? 20} step={1} onChange={(n) => setEng({ lintelH: n })} />
              <Num label={t(lang, 'engf_partitionThickness')} value={eng.partitionThickness ?? 10} step={1} onChange={(n) => setEng({ partitionThickness: n })} />
              <Num label={t(lang, 'engf_mortarSharePct')} value={eng.mortarSharePct ?? 20} step={1} onChange={(n) => setEng({ mortarSharePct: n })} />
              <Num label={t(lang, 'engf_glueSharePct')} value={eng.glueSharePct ?? 2.5} step={0.5} onChange={(n) => setEng({ glueSharePct: n })} />
            </div>
          </details>
          <details className="group" >
            <summary><span className="eyebrow">{t(lang, 'engg_slabs')}</span></summary>
            <div className="group-body" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
              <Num label={t(lang, 'engf_slab')} value={eng.slab ?? 18} step={1} onChange={(n) => setEng({ slab: n })} />
              <Num label={t(lang, 'engf_precastSlabArea')} value={eng.precastSlabArea ?? 5.4} step={0.1} onChange={(n) => setEng({ precastSlabArea: n })} />
              <Num label={t(lang, 'engf_stairVolume')} value={eng.stairVolume ?? 2.5} step={0.1} onChange={(n) => setEng({ stairVolume: n })} />
            </div>
          </details>
          <details className="group" >
            <summary><span className="eyebrow">{t(lang, 'engg_rebar')}</span></summary>
            <div className="group-body" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
              <Num label={t(lang, 'engf_rebarStrip')} value={eng.rebarStrip ?? 80} step={5} onChange={(n) => setEng({ rebarStrip: n })} />
              <Num label={t(lang, 'engf_rebarSlab')} value={eng.rebarSlab ?? 100} step={5} onChange={(n) => setEng({ rebarSlab: n })} />
              <Num label={t(lang, 'engf_rebarPile')} value={eng.rebarPile ?? 90} step={5} onChange={(n) => setEng({ rebarPile: n })} />
              <Num label={t(lang, 'engf_rebarColumn')} value={eng.rebarColumn ?? 170} step={5} onChange={(n) => setEng({ rebarColumn: n })} />
              <Num label={t(lang, 'engf_rebarFloor')} value={eng.rebarFloor ?? 110} step={5} onChange={(n) => setEng({ rebarFloor: n })} />
              <Num label={t(lang, 'engf_rebarRingBeam')} value={eng.rebarRingBeam ?? 100} step={5} onChange={(n) => setEng({ rebarRingBeam: n })} />
              <Num label={t(lang, 'engf_rebarSeismicCore')} value={eng.rebarSeismicCore ?? 150} step={5} onChange={(n) => setEng({ rebarSeismicCore: n })} />
              <Num label={t(lang, 'engf_rebarLintel')} value={eng.rebarLintel ?? 120} step={5} onChange={(n) => setEng({ rebarLintel: n })} />
              <Num label={t(lang, 'engf_rebarBasementWall')} value={eng.rebarBasementWall ?? 90} step={5} onChange={(n) => setEng({ rebarBasementWall: n })} />
              <Num label={t(lang, 'engf_rebarMonolithWall')} value={eng.rebarMonolithWall ?? 130} step={5} onChange={(n) => setEng({ rebarMonolithWall: n })} />
              <Num label={t(lang, 'engf_rebarFloorPct')} value={eng.rebarFloorPct ?? 7} step={1} onChange={(n) => setEng({ rebarFloorPct: n })} />
            </div>
          </details>
          <details className="group" >
            <summary><span className="eyebrow">{t(lang, 'engg_misc')}</span></summary>
            <div className="group-body" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
              <Num label={t(lang, 'engf_openingsPct')} value={eng.openingsPct ?? openingsDefault} step={1} onChange={(n) => setEng({ openingsPct: n })} />
              <Num label={t(lang, 'engf_wastePct')} value={eng.wastePct ?? 5} step={1} onChange={(n) => setEng({ wastePct: n })} />
              <Num label={t(lang, 'engf_formworkPerM3')} value={eng.formworkPerM3 ?? C.formworkPerM3} step={0.5} onChange={(n) => setEng({ formworkPerM3: n })} />
              <Num label={t(lang, 'engf_insulationThickness')} value={eng.insulationThickness ?? 10} step={1} onChange={(n) => setEng({ insulationThickness: n })} />
            </div>
          </details>
          <details className="group">
            <summary><span className="eyebrow">{t(lang, 'engg_concrete')}</span></summary>
            <div className="group-body" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
              <GradeSel label={t(lang, 'engf_concreteFoundation')} lang={lang} value={eng.concreteFoundation} onChange={(v) => setEng({ concreteFoundation: v })} />
              <GradeSel label={t(lang, 'engf_concreteFrame')} lang={lang} value={eng.concreteFrame} onChange={(v) => setEng({ concreteFrame: v })} />
              <GradeSel label={t(lang, 'engf_concreteFloors')} lang={lang} value={eng.concreteFloors} onChange={(v) => setEng({ concreteFloors: v })} />
            </div>
          </details>
          <label className="field" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.6rem' }}>
            <input type="checkbox" checked={house.beamsOverHall} onChange={(e) => set({ beamsOverHall: e.target.checked })} />
            <span style={{ marginBottom: 0 }}>{t(lang, 'beamsOverHall')}</span>
          </label>
        </details>
      </div>

      {/* Закреплённый низ сайдбара: список шагов прокручивается, действие
          всегда на виду. Кнопка сброса инженерных параметров раньше была
          спрятана внизу десятого шага — до неё надо было долистать. */}
      <div className="side-foot">
        <span className="side-foot-note">
          {lang === 'hy'
            ? 'Փոփոխությունները կիրառվում են անմիջապես'
            : lang === 'en'
              ? 'Changes apply instantly'
              : 'Изменения применяются сразу'}
        </span>
        <button
          className="btn btn-ghost no-print"
          style={{ padding: '0.25rem 0', fontSize: '0.76rem', whiteSpace: 'nowrap' }}
          onClick={() => set({ eng: {} })}
        >
          {t(lang, 'engReset')}
        </button>
      </div>
    </div>
  )
}
