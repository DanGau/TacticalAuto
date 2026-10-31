// The stage every part of the view draws on: the scene and its layers, the camera and its glides, the frame loop, and what is on screen.
import { ColorManagement, Fog, Group, LinearSRGBColorSpace, type Mesh, PerspectiveCamera, Scene, type Sprite as Billboard, type Object3D, Vector3, WebGLRenderer } from 'three'
import { ENTRY_RADIUS, GRID, type Battle, type Tile } from '../core/battle'
import type { Run } from '../core/run-state'
import { aim, axes, clamped, FIT, framing, HAZE_REACH, HEIGHT, picture, spot, WIDTH, type Camera } from './camera'
import { RISE_MS, type fence } from './fences'
import { COLOR, NIGHT } from './palette'
import { css, Sketch, type Point3 } from './shapes'
import { ACROSS } from './space'
import { shimmer } from './sprites'

export interface Sprite {
  /** The unit's feet, with its shadow; its picture stands on them, facing the camera. */
  node: Group
  body: Billboard
  shadow: Mesh
  /** Redraws the picture with the given health and armor. */
  drawHp(hp: number, armor: number): void
  /** The tile the sprite stands on, which lags the battle while a beat animates. */
  tile: Tile
  /** Where its feet show in the camera's picture, which a lunge, knockback or fall moves off its tile. */
  at: Tile
  /** Its size against a soldier's. */
  scale: number
  /** Whether it fights for the squad, so its health shows in the ally colour. */
  ally: boolean
  /** Whether it is cloaked, so it shimmers, faint, for the player alone. */
  cloaked: boolean
}

/** Words over the map: an entrance's name, or a callout over a unit. */
export interface Label {
  text: string
  color: number
  size: number
  /** Where it stands: a world point, or a point in the still camera's picture. */
  at: () => Point3 | Tile
  /** Share of its height that stands above `at`. */
  rise: number
  outline: number
  alpha: number
}

export const CAMERA_MS = 350
/** World units a unit's picture stands toward the camera from its feet, so the ground it stands on never cuts it. */
const STANDOFF = 0.6
/** How long a roof or wall takes to fade out of the way or back. */
const FADE_MS = 220
/** How solid a wall stays while a unit stands just behind it. */
const SEE_THROUGH = 0.3

export class Stage {
  static {
    // Colours are drawn as given, as flat art is: no conversion between colour spaces.
    ColorManagement.enabled = false
  }

  readonly renderer = new WebGLRenderer({ antialias: true })
  readonly canvas = this.renderer.domElement
  /** Shots, sparks and words, drawn over the scene in the camera's picture. */
  readonly overlay = document.createElement('canvas')
  readonly ctx = this.overlay.getContext('2d')!
  readonly scene = new Scene()
  readonly eye = new PerspectiveCamera()
  readonly haze = new Fog(NIGHT, 1, 2)
  /** The cliffs where narrow ground falls away. */
  readonly chasm = new Group()
  /** The ground, and the props, walls and windows standing on it. */
  readonly terrain = new Group()
  /** Marks on the ground, in the order they lie: the entrances' tint, acid and fire, fog, and glows in the fog. */
  readonly zones = new Group()
  readonly acid = new Group()
  readonly fog = new Group()
  readonly lurk = new Group()
  readonly units = new Group()
  /** The briefing's beam of light over what it shows. */
  readonly beam = new Group()
  /** The holographic fences round the zones in play, by what and where each is, so one already standing stays up. */
  readonly fences = new Group()
  standing = new Map<string, ReturnType<typeof fence>>()

  /** Shot effects over the scene, and each entrance's props under way. */
  readonly fx = new Sketch()
  readonly drops = new Set<Sketch>()
  /** Before the entrance, the entrances' names; and the callouts over units. */
  marks: Label[] = []
  readonly labels = new Set<Label>()

  readonly sprites = new Map<number, Sprite>()
  /** The squad of the run shown, for each soldier's class, and whether it fights with blades. */
  soldiers: Run['soldiers'] = []
  blademasters = false
  /** A red glow under each alien the squad hasn't found, by unit id. */
  readonly glows = new Map<number, { node: Object3D; tile: Tile }>()
  /** Each prop, wall and window on the board, with the tiles that light it: it is lit when a soldier sees any of them. */
  readonly scenery: { node: Object3D; tiles: number[] }[] = []
  /** Each wall on the battlefield, where it stands, and its fade: it thins to let a unit just behind it show through. */
  walls: { at: Tile; fade: { value: number } }[] = []
  /** Each roof on the battlefield, the tiles under it and the rectangle they span, and its fade: see cutAway. */
  roofs: { tiles: Set<number>; box: { x1: number; y1: number; x2: number; y2: number }; fade: { value: number }; mesh: Mesh }[] = []
  /** The tile the briefing is lighting, which no roof hides. */
  lit: Tile | null = null
  /** The tiles the squad sees, by index; null before the entrance. */
  seen: boolean[] | null = null
  /** The battle on screen. */
  shown: Battle | null = null
  camera = aim({ x: 0, y: 0 }, FIT)
  /** Screen pixels the picture is jolted by, as a blow lands. */
  readonly jolt = { x: 0, y: 0 }
  /** The entrance under the pointer. */
  hovered: number | null = null
  /** The entrance the camera is on before the squad goes in. */
  selected: number | null = null
  /** Whether the briefing is under way, so the entrances are hidden. */
  briefing = false
  /** The camera's glide under way; a new one takes over from wherever the camera is, so two never fight over it. */
  glides = 0

  /** Each rendered frame's work for a tween under way, given the milliseconds since the last frame. */
  private readonly ticks = new Set<(ms: number) => void>()

  constructor() {
    this.renderer.outputColorSpace = LinearSRGBColorSpace
    this.renderer.setPixelRatio(devicePixelRatio)
    this.renderer.setClearColor(NIGHT)
    for (const c of [this.canvas, this.overlay]) Object.assign(c.style, { position: 'fixed', left: '0', top: '0' })
    this.overlay.style.pointerEvents = 'none'
    document.body.prepend(this.overlay)
    this.scene.add(this.chasm, this.terrain, this.zones, this.fences, this.acid, this.fog, this.lurk, this.units, this.beam)
    this.scene.fog = this.haze
    this.zones.renderOrder = 1
    // Nothing shows until a battle exists.
    this.scene.visible = false
    addEventListener('resize', () => requestAnimationFrame(() => this.resize()))
    let last = performance.now()
    this.renderer.setAnimationLoop((now) => {
      const ms = now - last
      last = now
      for (const tick of [...this.ticks]) tick(ms)
      for (const sprite of this.sprites.values()) if (sprite.cloaked) shimmer(sprite, now)
      for (const f of this.standing.values()) {
        f.time.value = now / 1000
        f.rise.value = Math.min(1, f.rise.value + ms / RISE_MS)
      }
      this.cutAway(ms)
      this.render()
    })
  }

  /** The skills and weapons the squad has, which name the effects shown at work. */
  kit() {
    return { skills: this.soldiers.flatMap((s) => s.skills), weapons: this.soldiers.flatMap((s) => s.gear.weapon?.weapon ?? []) }
  }

  /** Where a tile falls in the camera's picture. */
  toWorld(x: number, y: number): Tile {
    return picture(spot(x, y), this.camera.yaw)
  }

  /** Screen pixels per picture pixel. */
  scale(): number {
    return this.camera.zoom * Math.min(innerWidth / WIDTH, innerHeight / HEIGHT)
  }

  resize(): void {
    this.renderer.setSize(innerWidth, innerHeight)
    this.overlay.width = innerWidth * devicePixelRatio
    this.overlay.height = innerHeight * devicePixelRatio
    Object.assign(this.overlay.style, { width: `${innerWidth}px`, height: `${innerHeight}px` })
    this.look(this.camera)
  }

  look(to: Camera): void {
    this.camera = to
    const { eye, haze, jolt } = this
    // Cameras are framed for a WIDTH by HEIGHT screen; the window scales them to fill it.
    const units = this.scale() * ACROSS
    const { back, right, up } = axes(to.yaw, to.pitch)
    const p = new Vector3(to.x, to.y, to.z).addScaledVector(right, -jolt.x / units).addScaledVector(up, jolt.y / units)
    // Far enough off that the lens frames, at what the camera looks at, what a flat map would at this zoom.
    const away = innerHeight / 2 / units / Math.tan(((to.fov / 2) * Math.PI) / 180)
    eye.position.copy(p).addScaledVector(back, away)
    eye.up.copy(up)
    eye.lookAt(p)
    eye.fov = to.fov
    eye.aspect = innerWidth / innerHeight
    eye.near = Math.max(0.05, away - 300)
    eye.far = away + 300
    eye.updateProjectionMatrix()
    haze.near = away + 2
    haze.far = away + 2 + HAZE_REACH[0] * (HAZE_REACH[1] / HAZE_REACH[0]) ** to.haze
  }

  /** Where a world point shows on the screen, in pixels. */
  onScreen(p: Point3): Tile {
    const v = new Vector3(p.x, p.y, p.z).project(this.eye)
    return { x: ((v.x + 1) / 2) * innerWidth, y: ((1 - v.y) / 2) * innerHeight }
  }

  /** Calls `frame` with progress 0..1 each rendered frame for `ms`. */
  tween(ms: number, frame: (t: number) => void): Promise<void> {
    return new Promise<void>((done) => {
      let elapsed = 0
      const tick = (step: number) => {
        elapsed += step
        const t = Math.min(elapsed / ms, 1)
        frame(t)
        if (t === 1) {
          this.ticks.delete(tick)
          done()
        }
      }
      this.ticks.add(tick)
    })
  }

  /**
   * Glides the camera to frame the given tiles, or to the given camera, over `ms`, easing in and out. Zoom changes by
   * the same factor each frame, so pulling out reads as steady as pushing in.
   */
  follow(points: Tile[] | Camera, ms = CAMERA_MS): Promise<void> {
    const from = this.camera
    const to = Array.isArray(points) ? clamped(framing(points, this.camera.yaw), points) : clamped(points)
    const mine = ++this.glides
    return this.tween(ms, (t) => {
      if (mine !== this.glides) return
      const ease = t * t * (3 - 2 * t)
      const at = (a: number, b: number) => a + (b - a) * ease
      // Zoom and lens change by the same factor each frame, so pulling out reads as steady as pushing in.
      const by = (a: number, b: number) => a * (b / a) ** ease
      this.look({ x: at(from.x, to.x), y: at(from.y, to.y), z: at(from.z, to.z), zoom: by(from.zoom, to.zoom), yaw: at(from.yaw, to.yaw), pitch: at(from.pitch, to.pitch), fov: by(from.fov, to.fov), haze: at(from.haze, to.haze) })
    })
  }

  /**
   * Fades away each roof within the circle of the arena, where the fight is staged, and each over a tile that
   * matters: a unit's, the briefing's lit one, or an entrance's while one is chosen. Thins each wall standing just
   * before a unit toward the camera, as XCOM cuts its buildings away. The rest fade back.
   */
  private cutAway(ms: number): void {
    const { shown } = this
    const step = ms / FADE_MS
    const toward = (fade: { value: number }, target: number) => (fade.value = fade.value < target ? Math.min(target, fade.value + step) : Math.max(target, fade.value - step))
    const keys = [...this.sprites.values()].map((s) => ({ x: Math.round(s.tile.x), y: Math.round(s.tile.y) }))
    if (this.lit) keys.push({ x: Math.round(this.lit.x), y: Math.round(this.lit.y) })
    // Choosing an entrance, the entrances show whole.
    if (shown?.phase === 'deploy' && !this.briefing)
      for (const { at } of shown.entrances) for (let dy = -ENTRY_RADIUS; dy <= ENTRY_RADIUS; dy++) for (let dx = -ENTRY_RADIUS; dx <= ENTRY_RADIUS; dx++) keys.push({ x: at.x + dx, y: at.y + dy })
    const under = new Set(keys.map((k) => k.y * GRID + k.x))
    const arena = shown?.arena
    for (const roof of this.roofs) {
      const { x1, y1, x2, y2 } = roof.box
      const near = arena && Math.hypot(Math.max(x1 - arena.x, 0, arena.x - x2), Math.max(y1 - arena.y, 0, arena.y - y2)) <= arena.reach
      const open = near || [...roof.tiles].some((t) => under.has(t))
      toward(roof.fade, open ? 0 : 1)
      roof.mesh.visible = roof.fade.value > 0
    }
    for (const wall of this.walls) {
      const before = keys.some((k) => {
        const dx = wall.at.x - k.x
        const dy = wall.at.y - k.y
        return dx > -1 && dy > -1 && dx + dy > 0 && dx + dy <= 2.5
      })
      toward(wall.fade, before ? SEE_THROUGH : 1)
    }
  }

  render(): void {
    const { ctx, overlay, camera, jolt } = this
    const { back } = axes(camera.yaw)
    for (const sprite of this.sprites.values()) sprite.body.position.copy(back).multiplyScalar(STANDOFF)
    this.renderer.render(this.scene, this.eye)
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, overlay.width, overlay.height)
    if (!this.scene.visible) return
    const k = this.scale()
    const middle = picture(camera, camera.yaw)
    const dpr = devicePixelRatio
    ctx.setTransform(k * dpr, 0, 0, k * dpr, (innerWidth / 2 - middle.x * k + jolt.x) * dpr, (innerHeight / 2 - middle.y * k + jolt.y) * dpr)
    for (const drop of this.drops) drop.draw(ctx)
    this.fx.draw(ctx)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    for (const label of [...this.marks, ...this.labels]) this.write(label, k, middle)
  }

  /** Writes a label on the screen, its size scaled by `k`, a point in the picture placed as the picture's `middle` is centred. */
  private write(label: Label, k: number, middle: Tile): void {
    const { ctx, jolt } = this
    const where = label.at()
    const at = 'z' in where ? this.onScreen(where) : { x: innerWidth / 2 + (where.x - middle.x) * k + jolt.x, y: innerHeight / 2 + (where.y - middle.y) * k + jolt.y }
    ctx.font = `bold ${label.size * k}px sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    ctx.lineJoin = 'round'
    ctx.globalAlpha = label.alpha
    const y = at.y - label.rise * label.size * k * 1.2
    ctx.strokeStyle = css(COLOR.line)
    ctx.lineWidth = label.outline * k
    ctx.strokeText(label.text, at.x, y)
    ctx.fillStyle = css(label.color)
    ctx.fillText(label.text, at.x, y)
    ctx.globalAlpha = 1
  }
}
