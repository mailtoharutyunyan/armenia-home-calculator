// three.js scene of the default brick house.
//
// Kept apart from the React panel: the panel owns the buttons, this class owns
// WebGL. It renders on demand (only while something moves), because the scene
// is static and a viewer left open in a background tab should not burn a
// laptop battery.

import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js'
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js'
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js'
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js'
import { LineMaterial } from 'three/addons/lines/LineMaterial.js'
import { buildFloorPlan } from '../../engine/floorplan'
import { DEFAULT_HOUSE } from '../../model/house'
import { HAS_DIFFUSE, SURFACES, TEX_SIZE, type TexSet } from './surfaces'
import { HERO, PLAN_DEPTH, type Shot } from './shots'

export type LightMode = 'day' | 'golden'
export type FloorMode = '1' | '2' | 'all'

const BASE = `${import.meta.env.BASE_URL}models/`

// Model frame: metres, Y up, origin at the front-left corner of the house.
// The house spans x 0…17.35 and z −10.84…0; the street is towards +z.
const PLOT_CENTER = new THREE.Vector3(8.7, 0, -2.3)

// Sun and sky for the two lighting presets. Directions point at the sun.
const LIGHTS: Record<
  LightMode,
  {
    dir: [number, number, number]
    color: number
    sun: number
    env: number
    exposure: number
    lamps: number
    sky: [string, string, string]
  }
> = {
  // High summer sun from the front right: the facade in light, crisp shadows.
  day: {
    dir: [0.42, 0.78, 0.47],
    color: 0xfff1de,
    sun: 4.2,
    env: 0.55,
    exposure: 1.0,
    lamps: 0.15,
    sky: ['#3f74b4', '#8fb2d6', '#dfe5e6'],
  },
  // Low sun raking the facade from the left; the soffit downlights come on.
  golden: {
    dir: [-0.74, 0.22, 0.63],
    color: 0xffae62,
    sun: 3.4,
    env: 0.45,
    exposure: 0.95,
    lamps: 1,
    sky: ['#3d5283', '#c09a98', '#f6c58e'],
  },
}

// Azimuth of the glow in qwantani_dusk_2 (column 604 of 1024): the sky is
// turned so that its bright patch sits where the sun light comes from.
const HDRI_SUN_AZIMUTH = (604 / 1024 - 0.5) * Math.PI * 2

// Groups of the glTF by storey (names come from build_brick.py). Pylon,
// stair, curtains and ceiling lights run through both storeys and are cut by
// clipping planes instead of being hidden.
const FLOOR1 = /^(Bath|Doors|Ext|Facade|Floors|Furniture|Soft|Walls|Windows)_F1$|^Kitchen$|^Structure$|^Model_F1_/
const FLOOR2 = /_F2$|^Model_F2_/

// Heights of the cuts, metres: the ground-floor ceiling slab runs 3.63…3.83,
// the upper ceiling 6.85…7.05, the low roof over the ground floor tops out at 3.97.
const CUT = { underSlab1: 3.55, overRoof1: 3.98, slab1Bottom: 3.628, underSlab2: 6.8 }
const NO_CUT = 1000

// Height band of each storey for the highlight, floor slab to ceiling slab.
const STOREY_BAND: Record<1 | 2, [number, number]> = { 1: [0.42, 3.86], 2: [3.86, 7.08] }

const DEFAULT_FOV = 45
const FLY_MS = 1400

export interface ViewerCallbacks {
  onProgress: (fraction: number) => void
}

export class HouseViewer {
  private renderer: THREE.WebGLRenderer
  private scene = new THREE.Scene()
  private camera = new THREE.PerspectiveCamera(45, 1, 0.1, 900)
  private controls: OrbitControls
  private sun = new THREE.DirectionalLight()
  private model: THREE.Object3D | null = null
  private groups: THREE.Object3D[] = []
  private pmrem: THREE.PMREMGenerator
  private envTarget: THREE.WebGLRenderTarget | null = null
  private lamps: THREE.MeshStandardMaterial[] = []
  private lampBase = 1
  // Shared by every material: moving the constant moves the cut everywhere.
  private cutAbove = new THREE.Plane(new THREE.Vector3(0, -1, 0), NO_CUT)
  private cutBelow = new THREE.Plane(new THREE.Vector3(0, 1, 0), NO_CUT)
  private floors: FloorMode = 'all'
  private roof = true
  private dirty = true
  private tween: {
    from: THREE.Vector3
    to: THREE.Vector3
    fromT: THREE.Vector3
    toT: THREE.Vector3
    fromFov: number
    toFov: number
    t0: number
  } | null = null
  private inside = false
  private storeyMarks: Record<1 | 2, THREE.Group>
  private shift = { x: 0, y: 0 }
  private baseFov = DEFAULT_FOV
  private lineMats: LineMaterial[] = []
  private resizeObs: ResizeObserver
  private disposed = false

  constructor(
    private host: HTMLElement,
    private reducedMotion: boolean,
    onInteract: () => void,
  ) {
    // Throws when WebGL is unavailable; the panel shows a note in that case.
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.shadowMap.enabled = true
    // PCFSoftShadowMap is gone since r180; PCF with a radius is the soft one now.
    this.renderer.shadowMap.type = THREE.PCFShadowMap
    // The sun does not move between presses, so the shadow map is redrawn
    // only when the light or the cut changes.
    this.renderer.shadowMap.autoUpdate = false
    this.renderer.localClippingEnabled = true
    this.renderer.domElement.style.display = 'block'
    host.appendChild(this.renderer.domElement)

    this.pmrem = new THREE.PMREMGenerator(this.renderer)

    this.controls = new OrbitControls(this.camera, this.renderer.domElement)
    this.controls.enableDamping = true
    this.controls.dampingFactor = 0.08
    this.controls.minDistance = 2
    this.controls.maxDistance = 85
    // Never below the horizon: the model has no underside worth seeing.
    this.controls.maxPolarAngle = Math.PI * 0.49
    // Pan slides along the ground instead of lifting the camera off it.
    this.controls.screenSpacePanning = false
    this.controls.autoRotateSpeed = 0.3
    // The idle spin is a hint that the model can be turned; any touch ends it.
    this.controls.addEventListener('start', () => {
      this.controls.autoRotate = false
      this.tween = null
      onInteract()
    })
    this.controls.addEventListener('change', () => (this.dirty = true))

    this.sun.castShadow = true
    this.sun.shadow.mapSize.setScalar(window.matchMedia('(pointer: coarse)').matches ? 2048 : 4096)
    this.sun.shadow.radius = 3
    this.sun.shadow.bias = -0.0004
    this.sun.shadow.normalBias = 0.03
    const sc = this.sun.shadow.camera
    sc.left = sc.bottom = -19
    sc.right = sc.top = 19
    sc.near = 1
    sc.far = 140
    this.sun.target.position.copy(PLOT_CENTER)
    this.scene.add(this.sun, this.sun.target)

    // The storey outline follows the calculator's plan of the house, so the
    // frame bends round the recessed front and the stair block like the walls do.
    this.storeyMarks = { 1: this.storeyMark(1), 2: this.storeyMark(2) }
    this.scene.add(this.storeyMarks[1], this.storeyMarks[2])

    this.flyTo(HERO, false)

    this.resizeObs = new ResizeObserver(() => this.resize())
    this.resizeObs.observe(host)
    this.resize()
    this.renderer.setAnimationLoop(() => this.frame())
  }

  async load({ onProgress }: ViewerCallbacks) {
    // Progress is weighted by size: the model is ~5.5 MB, the sky and the
    // textures together about the same, loaded in parallel.
    let modelPart = 0
    let restPart = 0
    const report = () => onProgress(0.5 * modelPart + 0.5 * restPart)
    const manager = new THREE.LoadingManager()
    manager.onProgress = (_url, loaded, total) => {
      restPart = loaded / total
      report()
    }

    const gltfLoader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder)
    const modelP = gltfLoader.loadAsync(`${BASE}brick-house.glb`, (e) => {
      if (e.lengthComputable) {
        modelPart = e.loaded / e.total
        report()
      }
    })
    // Float data, so the sky can be adjusted in place before it is prefiltered.
    const skyP = new HDRLoader(manager).setDataType(THREE.FloatType).loadAsync(`${BASE}sky.hdr`)
    const texP = this.loadTextures(manager)

    const [gltf, sky, tex] = await Promise.all([modelP, skyP, texP])
    if (this.disposed) {
      sky.dispose()
      Object.values(tex).forEach((t) => t.dispose())
      disposeTree(gltf.scene)
      return
    }

    sky.mapping = THREE.EquirectangularReflectionMapping
    neutralise(sky)
    this.envTarget = this.pmrem.fromEquirectangular(sky)
    this.scene.environment = this.envTarget.texture
    // The dusk HDRI lights the scene and shows in reflections, but as a
    // backdrop it would make every view an evening one; the visible sky is a
    // plain gradient per lighting preset instead.
    sky.dispose()

    this.model = gltf.scene
    // Storey groups hang off the House_Brick root; loose furniture models sit
    // one level deeper, in Furniture_Models.
    const house = this.model.getObjectByName('House_Brick') ?? this.model
    this.groups = [...house.children, ...(house.getObjectByName('Furniture_Models')?.children ?? [])]
    this.dressModel(this.model, tex)
    this.scene.add(this.model)
    this.addGround(tex)

    this.setLight('golden')
    this.applyCut()
  }

  // ── Public controls ────────────────────────────────────────────────────

  setLight(mode: LightMode) {
    const l = LIGHTS[mode]
    const dir = new THREE.Vector3(...l.dir).normalize()
    this.sun.position.copy(PLOT_CENTER).addScaledVector(dir, 70)
    this.sun.color.setHex(l.color)
    this.sun.intensity = l.sun
    this.renderer.toneMappingExposure = l.exposure
    this.scene.environmentIntensity = l.env
    this.scene.environmentRotation.y = HDRI_SUN_AZIMUTH - Math.atan2(dir.z, dir.x)
    if (this.scene.background instanceof THREE.Texture) this.scene.background.dispose()
    this.scene.background = skyGradient(l.sky)
    for (const m of this.lamps) m.emissiveIntensity = this.lampBase * l.lamps
    this.renderer.shadowMap.needsUpdate = true
    this.dirty = true
  }

  setFloors(mode: FloorMode) {
    this.floors = mode
    this.applyCut()
  }

  setRoof(on: boolean) {
    this.roof = on
    this.applyCut()
  }

  // Moves the camera to a shot: an eased flight outside, a cut when the move
  // goes through a wall (into a room or out of one), and always a cut when the
  // visitor asked for reduced motion.
  flyTo(shot: Shot, animate = !this.reducedMotion) {
    const to = new THREE.Vector3(...shot.pos)
    let toT = new THREE.Vector3(...shot.target)
    const inside = !!shot.inside
    if (inside) {
      // Turning on the spot: the orbit centre is half a metre ahead of the eye.
      toT = to.clone().add(toT.sub(to).setLength(0.5))
    }
    const cut = !animate || inside || this.inside
    this.setInside(inside)
    this.controls.autoRotate = false
    const toFov = shot.fov ?? DEFAULT_FOV
    if (cut) {
      this.tween = null
      this.camera.position.copy(to)
      this.controls.target.copy(toT)
      this.baseFov = toFov
      this.camera.fov = this.fitFov(toFov)
      this.camera.updateProjectionMatrix()
      this.controls.update()
    } else {
      this.tween = {
        from: this.camera.position.clone(),
        to,
        fromT: this.controls.target.clone(),
        toT,
        fromFov: this.baseFov,
        toFov,
        t0: performance.now(),
      }
    }
    this.dirty = true
  }

  // Slow turn around the house on the opening screen.
  setAutoRotate(on: boolean) {
    this.controls.autoRotate = on && !this.reducedMotion && !this.inside
    this.dirty = true
  }

  // Outline and a faint glow on one storey (0 clears it).
  highlightStorey(n: 0 | 1 | 2) {
    this.storeyMarks[1].visible = n === 1
    this.storeyMarks[2].visible = n === 2
    this.dirty = true
  }

  // Shifts the picture off centre, so the house is not hidden behind the side
  // panel on a wide screen or behind the bottom sheet on a phone. Fractions
  // of the canvas size; positive x moves the house right, positive y up.
  setFrameShift(x: number, y: number) {
    this.shift = { x, y }
    this.applyShift()
  }

  reset() {
    this.setFloors('all')
    this.setRoof(true)
    this.flyTo(HERO)
  }

  dispose() {
    this.disposed = true
    this.renderer.setAnimationLoop(null)
    this.resizeObs.disconnect()
    this.controls.dispose()
    disposeTree(this.scene)
    if (this.scene.background instanceof THREE.Texture) this.scene.background.dispose()
    this.envTarget?.dispose()
    this.pmrem.dispose()
    this.renderer.dispose()
    // Browsers cap live WebGL contexts (~16); switching tabs back and forth
    // must not leak one each time.
    this.renderer.forceContextLoss()
    this.renderer.domElement.remove()
  }

  // ── Internals ──────────────────────────────────────────────────────────

  private frame() {
    if (this.tween) {
      const k = Math.min(1, (performance.now() - this.tween.t0) / FLY_MS)
      const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2
      this.camera.position.lerpVectors(this.tween.from, this.tween.to, e)
      this.controls.target.lerpVectors(this.tween.fromT, this.tween.toT, e)
      this.baseFov = THREE.MathUtils.lerp(this.tween.fromFov, this.tween.toFov, e)
      this.camera.fov = this.fitFov(this.baseFov)
      this.camera.updateProjectionMatrix()
      if (k === 1) this.tween = null
      this.dirty = true
    }
    // Keep the orbit centre over the plot and at most roof height, so a long
    // pan cannot lose the house off into the empty field.
    if (!this.inside) {
      const t = this.controls.target
      t.x = THREE.MathUtils.clamp(t.x, -12, 30)
      t.z = THREE.MathUtils.clamp(t.z, -22, 18)
      t.y = THREE.MathUtils.clamp(t.y, 0.3, 8)
    }
    if (this.controls.update()) this.dirty = true
    if (!this.dirty) return
    this.dirty = false
    this.renderer.render(this.scene, this.camera)
  }

  private resize() {
    const w = this.host.clientWidth
    const h = this.host.clientHeight
    if (!w || !h) return
    this.renderer.setSize(w, h, false)
    this.renderer.domElement.style.width = '100%'
    this.renderer.domElement.style.height = '100%'
    this.camera.aspect = w / h
    this.camera.fov = this.fitFov(this.baseFov)
    for (const m of this.lineMats) m.resolution.set(w, h)
    this.applyShift()
  }

  // The shots are framed for a landscape window. On a portrait phone the same
  // vertical angle would crop the house to its middle, so the lens widens to
  // keep the horizontal angle, up to a limit past which it starts to distort.
  private fitFov(base: number) {
    const a = this.camera.aspect
    if (a >= 1) return base
    const half = THREE.MathUtils.degToRad(base / 2)
    return Math.min(80, THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(half) / a)))
  }

  private applyShift() {
    const w = this.host.clientWidth
    const h = this.host.clientHeight
    const { x, y } = this.shift
    if (w && h && (x || y)) this.camera.setViewOffset(w, h, -x * w, y * h, w, h)
    else this.camera.clearViewOffset()
    this.camera.updateProjectionMatrix()
    this.dirty = true
  }

  // Inside a room the drag looks around (inverted, like turning the head),
  // zoom and pan are off: the eye stays where the plan point put it.
  private setInside(on: boolean) {
    this.inside = on
    const c = this.controls
    c.enableZoom = !on
    c.enablePan = !on
    c.rotateSpeed = on ? -0.35 : 1
    c.minDistance = on ? 0.1 : 2
    c.maxPolarAngle = on ? Math.PI * 0.85 : Math.PI * 0.49
    c.minPolarAngle = on ? Math.PI * 0.15 : 0
    if (on) {
      c.autoRotate = false
      this.highlightStorey(0)
    }
  }

  private applyCut() {
    if (!this.model) return
    const f = this.floors
    let above = NO_CUT
    let below = NO_CUT
    if (f === '1') above = this.roof ? CUT.overRoof1 : CUT.underSlab1
    else if (!this.roof) above = CUT.underSlab2
    // The upper floor alone stands on its slab, the ground floor is cut away.
    if (f === '2') below = -CUT.slab1Bottom
    this.cutAbove.constant = above
    this.cutBelow.constant = below

    for (const o of this.groups) {
      const n = o.name
      let show = true
      if (FLOOR1.test(n)) show = f !== '2'
      else if (FLOOR2.test(n)) show = f !== '1'
      else if (n === 'Roof_F1') show = this.roof && f !== '2'
      else if (n === 'Roof_F2') show = this.roof && f !== '1'
      // Sheer curtains run both storeys in one mesh; over a closed ground
      // floor their upper hems would poke through the roof deck.
      else if (n === 'Curtains') show = !(f === '1' && this.roof)
      o.visible = show
    }
    this.renderer.shadowMap.needsUpdate = true
    this.dirty = true
  }

  // A light curtain round the storey's walls with a crisp line along its top,
  // bottom and corners, after the apartment highlight of estate-agent tours.
  private storeyMark(n: 1 | 2) {
    const plan = buildFloorPlan(DEFAULT_HOUSE, n - 1)
    const [y0, y1] = STOREY_BAND[n]
    const edges = outlineEdges(plan.outline ?? [{ x: 0, y: 0, w: plan.L, h: plan.W }], 0.12)

    const quad: number[] = []
    const lines: number[] = []
    const corners = new Map<string, { h: boolean; v: boolean; x: number; z: number }>()
    for (const [ax, az, bx, bz] of edges) {
      quad.push(ax, y0, az, bx, y0, bz, bx, y1, bz, ax, y0, az, bx, y1, bz, ax, y1, az)
      lines.push(ax, y0, az, bx, y0, bz, ax, y1, az, bx, y1, bz)
      for (const [x, z] of [[ax, az], [bx, bz]]) {
        const k = `${x.toFixed(3)}:${z.toFixed(3)}`
        const c = corners.get(k) ?? { h: false, v: false, x, z }
        if (az === bz) c.h = true
        else c.v = true
        corners.set(k, c)
      }
    }
    // Uprights only where the outline turns, not where it was split into cells.
    for (const c of corners.values()) if (c.h && c.v) lines.push(c.x, y0, c.z, c.x, y1, c.z)

    const glowGeo = new THREE.BufferGeometry()
    glowGeo.setAttribute('position', new THREE.Float32BufferAttribute(quad, 3))
    // Additive: the band brightens the facade under it instead of covering it.
    const glow = new THREE.Mesh(
      glowGeo,
      new THREE.MeshBasicMaterial({
        color: 0xfff6e8,
        transparent: true,
        opacity: 0.22,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      }),
    )
    // The storey's edges run under the roof overhangs and behind the house,
    // so the frame is drawn twice: solid where it is in view, faint where the
    // building hides it. It then reads as one whole storey from any side.
    const geo = new LineSegmentsGeometry().setPositions(lines)
    const seen = new LineMaterial({ color: 0xffffff, linewidth: 2.5, transparent: true, opacity: 0.95, toneMapped: false })
    const hidden = new LineMaterial({
      color: 0xffffff,
      linewidth: 1.5,
      transparent: true,
      opacity: 0.4,
      depthTest: false,
      toneMapped: false,
    })
    this.lineMats.push(seen, hidden)
    const behind = new LineSegments2(geo, hidden)
    behind.renderOrder = 1
    const front = new LineSegments2(geo, seen)
    front.renderOrder = 2
    const g = new THREE.Group()
    g.add(glow, behind, front)
    g.visible = false
    return g
  }

  private async loadTextures(manager: THREE.LoadingManager) {
    const loader = new THREE.TextureLoader(manager)
    const out: Record<string, THREE.Texture> = {}
    const jobs: Promise<void>[] = []
    for (const set of Object.keys(TEX_SIZE) as TexSet[]) {
      const kinds = HAS_DIFFUSE[set] ? ['diff', 'nor', 'rough'] : ['nor', 'rough']
      for (const kind of kinds) {
        jobs.push(
          loader.loadAsync(`${BASE}tex/${set}_${kind}.webp`).then((t) => {
            t.wrapS = t.wrapT = THREE.RepeatWrapping
            if (kind === 'diff') t.colorSpace = THREE.SRGBColorSpace
            t.anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy())
            out[`${set}_${kind}`] = t
          }),
        )
      }
    }
    await Promise.all(jobs)
    return out
  }

  private dressModel(root: THREE.Object3D, tex: Record<string, THREE.Texture>) {
    const replaced = new Map<THREE.Material, THREE.Material>()
    const clip = [this.cutAbove, this.cutBelow]

    const make = (old: THREE.Material): THREE.Material => {
      const name = old.name
      const s = SURFACES[name]
      let m: THREE.Material
      if (name === 'Glass' || name === 'Water') {
        // Real transmission would render the scene twice; for window panes a
        // thin tinted sheet that reflects the sky reads the same and stays cheap.
        const water = name === 'Water'
        m = new THREE.MeshPhysicalMaterial({
          name,
          color: water ? 0x1d6f7a : 0x9fb4bd,
          roughness: water ? 0.08 : 0.03,
          metalness: 0,
          transparent: true,
          opacity: water ? 0.82 : 0.32,
          envMapIntensity: water ? 1.2 : 1.8,
          depthWrite: false,
          side: THREE.DoubleSide,
        })
      } else if (s) {
        const std = new THREE.MeshStandardMaterial({
          name,
          color: s.color,
          roughness: s.roughness,
          metalness: s.metalness ?? 0,
          side: THREE.DoubleSide,
        })
        if (s.set) {
          const repeat = 1 / (s.size ?? TEX_SIZE[s.set])
          // A clone shares the image (one GPU upload) but has its own repeat.
          const pick = (kind: string) => {
            const base = tex[`${s.set}_${kind}`]
            if (!base) return null
            const t = base.clone()
            t.repeat.set(repeat, repeat)
            return t
          }
          std.map = pick('diff')
          std.normalMap = pick('nor')
          std.roughnessMap = pick('rough')
          const ns = s.normal ?? 1
          std.normalScale.set(ns, ns)
        }
        m = std
        old.dispose()
      } else {
        m = old
      }
      m.clippingPlanes = clip
      m.clipShadows = true
      if (name === 'Light_Emissive' && m instanceof THREE.MeshStandardMaterial) {
        this.lamps.push(m)
        this.lampBase = m.emissiveIntensity
      }
      return m
    }

    root.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return
      const mats = Array.isArray(o.material) ? o.material : [o.material]
      const next = mats.map((old: THREE.Material) => {
        let m = replaced.get(old)
        if (!m) {
          m = make(old)
          replaced.set(old, m)
        }
        return m
      })
      o.material = Array.isArray(o.material) ? next : next[0]
      const name = next[0].name
      // Light sheets and see-through surfaces should not darken what is behind.
      const clear = name === 'Glass' || name === 'Water' || name === 'Light_Emissive' || name === 'Curtain_Sheer'
      o.castShadow = !clear
      o.receiveShadow = true
    })
  }

  // Field around the plot, so the house does not stand in a void. It fades
  // out into the sky towards the edge instead of ending at a visible rim.
  private addGround(tex: Record<string, THREE.Texture>) {
    const map = tex.grass_diff.clone()
    map.repeat.setScalar(1 / 6)
    const R = 320
    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(R, 96),
      new THREE.MeshStandardMaterial({
        color: 0x9c9a7e,
        map,
        roughness: 1,
        alphaMap: radialFade(),
        transparent: true,
      }),
    )
    // CircleGeometry's UVs run 0…1 across the disc; the grass needs metres,
    // the fade needs the 0…1. The fade reads the second UV set.
    const uv = ground.geometry.attributes.uv
    ground.geometry.setAttribute('uv1', uv.clone())
    for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) - 0.5) * 2 * R, (uv.getY(i) - 0.5) * 2 * R)
    ;(ground.material.alphaMap as THREE.Texture).channel = 1
    ground.rotation.x = -Math.PI / 2
    // Just under the lawn (its top is at 0, bottom at −0.03): no z-fighting.
    ground.position.set(PLOT_CENTER.x, -0.05, PLOT_CENTER.z)
    ground.receiveShadow = true
    // Drawn before glass and water, which are transparent too.
    ground.renderOrder = -1
    this.scene.add(ground)
  }
}

// Vertical gradient laid out as an equirectangular image: zenith at the top,
// horizon in the middle, the lower half (hidden by the ground) the horizon colour.
function skyGradient([zenith, mid, horizon]: [string, string, string]) {
  const c = document.createElement('canvas')
  c.width = 4
  c.height = 256
  const g = c.getContext('2d')!
  const grad = g.createLinearGradient(0, 0, 0, 128)
  grad.addColorStop(0, zenith)
  // The camera rarely looks more than 25° up, so most of the colour change
  // happens in the band just above the horizon.
  grad.addColorStop(0.72, mid)
  grad.addColorStop(1, horizon)
  g.fillStyle = grad
  g.fillRect(0, 0, 4, 128)
  g.fillStyle = horizon
  g.fillRect(0, 128, 4, 128)
  const t = new THREE.CanvasTexture(c)
  t.mapping = THREE.EquirectangularReflectionMapping
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

// qwantani_dusk_2 is a lilac dusk: as it is, it turns travertine pink and
// glass mauve. Most of its colour is taken out, the light and its direction
// stay; a slight blue is kept so shade still reads as sky-lit.
function neutralise(tex: THREE.DataTexture) {
  const d = tex.image.data as Float32Array
  for (let i = 0; i < d.length; i += 4) {
    const lum = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]
    d[i] = (lum + (d[i] - lum) * 0.2) * 0.95
    d[i + 1] = lum + (d[i + 1] - lum) * 0.2
    d[i + 2] = (lum + (d[i + 2] - lum) * 0.2) * 1.08
  }
  tex.needsUpdate = true
}

// Opaque in the middle (the plot and some 60 m around), clear at the rim.
function radialFade() {
  const c = document.createElement('canvas')
  c.width = c.height = 256
  const g = c.getContext('2d')!
  const grad = g.createRadialGradient(128, 128, 0, 128, 128, 128)
  grad.addColorStop(0, '#fff')
  grad.addColorStop(0.25, '#fff')
  grad.addColorStop(0.95, '#000')
  g.fillStyle = grad
  g.fillRect(0, 0, 256, 256)
  return new THREE.CanvasTexture(c)
}

// Outer edges of a union of plan rectangles (grown by a margin), in model x/z.
// The rectangles overlap, so the union is cut into grid cells and a cell side
// is an outer edge when the neighbouring cell is empty.
function outlineEdges(rects: { x: number; y: number; w: number; h: number }[], margin: number) {
  const rs = rects.map((r) => ({
    x0: r.x - margin,
    x1: r.x + r.w + margin,
    z0: r.y - PLAN_DEPTH - margin,
    z1: r.y + r.h - PLAN_DEPTH + margin,
  }))
  const uniq = (v: number[]) => [...new Set(v.map((n) => Math.round(n * 1000) / 1000))].sort((a, b) => a - b)
  const xs = uniq(rs.flatMap((r) => [r.x0, r.x1]))
  const zs = uniq(rs.flatMap((r) => [r.z0, r.z1]))
  const filled = (i: number, j: number) => {
    if (i < 0 || j < 0 || i >= xs.length - 1 || j >= zs.length - 1) return false
    const cx = (xs[i] + xs[i + 1]) / 2
    const cz = (zs[j] + zs[j + 1]) / 2
    return rs.some((r) => cx > r.x0 && cx < r.x1 && cz > r.z0 && cz < r.z1)
  }
  const out: [number, number, number, number][] = []
  for (let i = 0; i < xs.length - 1; i++) {
    for (let j = 0; j < zs.length - 1; j++) {
      if (!filled(i, j)) continue
      if (!filled(i - 1, j)) out.push([xs[i], zs[j], xs[i], zs[j + 1]])
      if (!filled(i + 1, j)) out.push([xs[i + 1], zs[j], xs[i + 1], zs[j + 1]])
      if (!filled(i, j - 1)) out.push([xs[i], zs[j], xs[i + 1], zs[j]])
      if (!filled(i, j + 1)) out.push([xs[i], zs[j + 1], xs[i + 1], zs[j + 1]])
    }
  }
  return out
}

function disposeTree(root: THREE.Object3D) {
  const textures = new Set<THREE.Texture>()
  root.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return
    o.geometry.dispose()
    const mats: THREE.Material[] = Array.isArray(o.material) ? o.material : [o.material]
    for (const m of mats) {
      for (const v of Object.values(m)) if (v instanceof THREE.Texture) textures.add(v)
      m.dispose()
    }
  })
  textures.forEach((t) => t.dispose())
}
