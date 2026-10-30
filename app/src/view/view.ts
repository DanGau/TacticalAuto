import { CanvasTexture, CircleGeometry, ColorManagement, LinearSRGBColorSpace, Group, Mesh, MeshBasicMaterial, Object3D, OrthographicCamera, Raycaster, Scene, Sprite as Billboard, SpriteMaterial, Vector2, Vector3, WebGLRenderer } from 'three'
import { BLAST_RADIUS, distance, GRID, nearestAlien, revealed, PLANS, ZONE_NAMES, ZONE_RADIUS, type Battle, type Tile, type Unit } from '../core/battle'
import { ALIENS, type AlienKind } from '../core/aliens'
import { CLASSES } from '../core/classes'
import { effectName } from '../core/effects'
import type { GameEvent } from '../core/combat'
import { level, type Run } from '../core/run'
import { visibleTiles } from '../core/sight'
import type { Edge, Ground, Prop } from '../core/terrain'
import { buildOutskirts } from './outskirts'
import { blob, css, shade, Shapes, Sketch, type Point3 } from './shapes'
import { ACROSS, LEVEL, PITCH, TILE_H, TILE_W, tall, YAW } from './space'
import { weaponOf, type Weapon } from './weapons'

export const WIDTH = 1280
export const HEIGHT = 720

/** Height above the ground that shots leave and land. */
const CHEST = 18
/** Zoom that shows the whole map. */
const FIT = Math.min(WIDTH / (GRID * TILE_W), HEIGHT / (GRID * TILE_H + 80))
/** Screen pixels kept clear around what the camera frames. */
const MARGIN = 220

const CAMERA_MS = 350
/** How long the camera takes to glide to a landing zone, and to fly in over a new battle. */
const FOCUS_MS = 700
const FLY_MS = 1600
/** Screen pixels the landing panel takes from the bottom of the canvas. */
const PANEL = 110
/** A drop pod's fall, the burst of dust as it lands, the gap between pods, and the height it falls from in world pixels. */
const POD_FALL_MS = 800
/** How long a stealth insertion's parachutes take to drift down, how high they start, and how long a canopy takes to fold. */
const CHUTE_FALL_MS = 1500
const CHUTE_HEIGHT = 260
const CHUTE_FOLD_MS = 350
const POD_DUST_MS = 450
const POD_STAGGER_MS = 160
const POD_HEIGHT = 400
const MS_PER_TILE = 110
/** How much slower soldiers walk while the squad is unseen. */
const CREEP_PACE = 1.8
const REVEAL_MS = 450
const IMPACT_MS = 140
const DEATH_MS = 260
const CALLOUT_MS = 900
/** A health pip's size on screen, the step from one pip to the next, and the width of a row of ten. */
const PIP = 5
const PIP_STEP = 6
const PIP_ROW = 10 * PIP_STEP - 1
const PSI_MS = 320
const ROCKET_MS = 320
const BLAST_MS = 380
/** World units a unit's picture stands toward the camera from its feet, so the ground it stands on never cuts it. */
const STANDOFF = 0.6
/** A unit's picture, in screen pixels about its feet, and the pixels per one drawn, for a crisp edge. */
const BODY = { left: 36, up: 100, down: 4 }
const BODY_RES = 2
/** How far a decal floats over the ground it marks, so the ground never shows through it. */
const DECAL_LIFT = 0.02

const COLOR = {
  civilian: 0xe8e2c8,
  mech: 0x9aa9bf,
  human: 0x4da3ff,
  alien: 0x7ddc5a,
  boss: 0xc77dff,
  zone: 0x2f6fb0,
  zoneHover: 0x4d9be6,
  fog: 0x05070b,
  /** Glow under an alien the squad hasn't found, so the player sees trouble coming. */
  lurk: 0xff3030,
  /** Tint of a cover block or unit standing in fog. */
  dim: 0x5a5f6b,
  line: 0x10141c,
  hit: 0xffd84d,
  crit: 0xff7a3d,
  miss: 0x77808f,
  heal: 0x7ddc5a,
  acid: 0xa6e22e,
  fire: 0xff6a1f,
  spike: 0xc9d1dc,
  /** Ring under a rooted unit, and under one charged by a booming hit. */
  rooted: 0x8fd14f,
  booming: 0xff9a3d,
  psi: 0xff6bd6,
  contact: 0xff6b5e,
  /** Health left and lost, on an ally and on an enemy. */
  allyHp: 0x4fe08a,
  allyLost: 0x1f3a2a,
  enemyHp: 0xff5555,
  enemyLost: 0x3a2226,
  uplink: 0xffd84d,
}

const GROUND_COLOR: Record<Ground, number> = { pavement: 0x2b3240, road: 0x1c2029, grass: 0x25402c, floor: 0x4b4136, scorched: 0x15161a, hive: 0x2a1838, water: 0x1d5f5c, void: 0x000000 }

/** A box standing on a tile: how much of the tile it covers, how tall it is on screen, and its top colour. */
interface Box {
  /** Share of the tile's width it spans along x and along y, 0 to 1. */
  wide: number
  deep: number
  /** Screen pixels from the ground to its underside, and its height above that. */
  base: number
  up: number
  color: number
  /** How solid it looks, 0 to 1; solid when absent. */
  alpha?: number
}

const CAR_COLORS = [0xb8413a, 0x3f6fb5, 0xc9c9c2, 0x3d8f6b, 0xd0a13a]

/** The boxes each prop is drawn from, bottom first. A tree is drawn separately. */
const PROP_BOXES: Record<Exclude<Prop, 'none' | 'tree' | 'car'>, Box[]> = {
  truck: [{ wide: 1, deep: 0.8, base: 3, up: 26, color: 0x7d8794 }],
  crate: [{ wide: 0.7, deep: 0.7, base: 0, up: 13, color: 0x9a7742 }],
  stack: [
    { wide: 0.85, deep: 0.85, base: 0, up: 16, color: 0x9a7742 },
    { wide: 0.6, deep: 0.6, base: 16, up: 13, color: 0xb08a4f },
  ],
  fence: [{ wide: 1, deep: 0.25, base: 0, up: 12, color: 0x6f7682 }],
  rubble: [
    { wide: 0.9, deep: 0.8, base: 0, up: 8, color: 0x6b6f76 },
    { wide: 0.45, deep: 0.5, base: 8, up: 6, color: 0x7c8087 },
  ],
  spire: [
    { wide: 0.7, deep: 0.7, base: 0, up: 20, color: 0x7a3fa0 },
    { wide: 0.4, deep: 0.4, base: 20, up: 18, color: 0x9a55c4 },
  ],
  growth: [{ wide: 0.8, deep: 0.8, base: 0, up: 9, color: 0x8f4fb5 }],
  water: [{ wide: 1, deep: 1, base: 0, up: 2, color: 0x2f9e96, alpha: 0.85 }],
  void: [],
  fuel: [
    { wide: 0.6, deep: 0.6, base: 0, up: 16, color: 0xc0392b },
    { wide: 0.35, deep: 0.35, base: 16, up: 3, color: 0xf1c40f },
  ],
}

/** How thick a wall is, as a share of a tile. */
const WALL_THICK = 0.14

/** The boxes a wall or window on a tile's north edge is drawn from; one on a west edge is the same, turned. */
const EDGE_BOXES: Record<Exclude<Edge, 'none'>, Box[]> = {
  wall: [{ wide: 1, deep: WALL_THICK, base: 0, up: 28, color: 0xa39a8b }],
  // A sill, glass, and a lintel.
  window: [
    { wide: 1, deep: WALL_THICK, base: 0, up: 10, color: 0xa39a8b },
    { wide: 1, deep: WALL_THICK / 2, base: 10, up: 13, color: 0x7fc4e8, alpha: 0.45 },
    { wide: 1, deep: WALL_THICK, base: 23, up: 5, color: 0xa39a8b },
  ],
}

/** A car's body and cabin, in the colour `paint` picks. */
const carBoxes = (paint: number): Box[] => [
  { wide: 1, deep: 0.7, base: 3, up: 9, color: CAR_COLORS[paint % CAR_COLORS.length] },
  { wide: 0.7, deep: 0.6, base: 12, up: 6, color: 0x2a3340 },
]

/** How each kind of alien is drawn: its colour, and its size against a soldier's. */
const ALIEN_LOOK: Record<AlienKind, { color: number; scale: number }> = {
  trooper: { color: 0x7ddc5a, scale: 1 },
  swarmling: { color: 0x3f8f4a, scale: 0.6 },
  spitter: { color: 0xa6e22e, scale: 0.9 },
  burster: { color: 0xff9a3d, scale: 0.8 },
  brute: { color: 0xb5533c, scale: 1.4 },
  psion: { color: 0xff6bd6, scale: 1 },
  juggernaut: { color: 0x8a8f99, scale: 1.5 },
  incubator: { color: 0xd8c27a, scale: 1.1 },
  wraith: { color: 0xb8c8ff, scale: 1 },
  burrower: { color: 0x9c6b3f, scale: 1.1 },
  feeder: { color: 0xc23b6e, scale: 1.1 },
  regenerator: { color: 0x2fc7a0, scale: 1.1 },
  sprinter: { color: 0xf2e04b, scale: 0.8 },
  hiveNode: { color: 0x6b3fa0, scale: 1.3 },
  mirror: { color: 0xe6f0ff, scale: 1 },
}

const onGridTile = (x: number, y: number) => x >= 0 && y >= 0 && x < GRID && y < GRID

/** A colour lightened toward white, a step for each level of height, so high ground reads at a glance. */
const highland = (color: number, level: number) => {
  const lift = (c: number) => Math.round(c + (255 - c) * 0.12 * level)
  return (lift(color >> 16) << 16) | (lift((color >> 8) & 255) << 8) | lift(color & 255)
}

/** The letter over a unit that is no soldier: its kind's initial, C for a commander, nothing for a boss or civilian. */
const letter = (unit: Unit) => (unit.target ? 'C' : unit.summoner !== null ? 'M' : unit.boss || !unit.kind ? '' : ALIENS[unit.kind].name[0])

/** The height of each tile of the battle shown, row by row. */
let heights: number[] = []

/** The point on the ground at the centre of a tile, its height that of the tile it rounds to. Fractional tiles are allowed. */
const spot = (x: number, y: number): Point3 => ({ x, y: LEVEL * (heights[Math.round(y) * GRID + Math.round(x)] ?? 0), z: y })

/** The world point the camera's plane is measured from: the middle of the map, on the ground. */
const ORIGIN = { x: (GRID - 1) / 2, y: 0, z: (GRID - 1) / 2 }

/** The camera's axes for a turn of `yaw`: toward it, and to the right and up across its picture. */
function axes(yaw: number): { back: Vector3; right: Vector3; up: Vector3 } {
  const back = new Vector3(Math.cos(PITCH) * Math.sin(yaw), Math.sin(PITCH), Math.cos(PITCH) * Math.cos(yaw))
  const right = new Vector3(Math.cos(yaw), 0, -Math.sin(yaw))
  return { back, right, up: new Vector3().crossVectors(back, right) }
}

/**
 * Where a world point falls in the camera's picture, in screen pixels at zoom 1 measured from the map's middle, y
 * down. Seen from the still camera, it is where the flat isometric map would draw it.
 */
function picture(p: Point3, yaw: number): Tile {
  const { right, up } = axes(yaw)
  const d = new Vector3(p.x - ORIGIN.x, p.y - ORIGIN.y, p.z - ORIGIN.z)
  return { x: d.dot(right) * ACROSS, y: -d.dot(up) * ACROSS }
}

const lerp = (a: Tile, b: Tile, t: number): Tile => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t })

/** How far a walk through `points` goes over the ground, in tiles: a diagonal step is the longer. */
const ground = (points: Tile[]) => points.slice(1).reduce((sum, p, i) => sum + Math.hypot(p.x - points[i].x, p.y - points[i].y), 0)

/** Where a walk through `points` is once it has gone a share `t` of the way, at a steady pace. */
function along(points: Tile[], t: number): Tile {
  let left = t * ground(points)
  for (let i = 1; i < points.length; i++) {
    const step = Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y)
    if (left <= step && step > 0) return lerp(points[i - 1], points[i], left / step)
    left -= step
  }
  return points.at(-1)!
}

interface Sprite {
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
}

/** What the camera shows: the world point at the screen's centre, a zoom, and its turn about the vertical. */
interface Camera {
  x: number
  y: number
  z: number
  zoom: number
  yaw: number
}

/** The camera that shows the picture point `at` at the screen's centre, aimed at the ground `height` units up. */
function aim(at: Tile, zoom: number, yaw = YAW, height = 0): Camera {
  const { back, right, up } = axes(yaw)
  const p = new Vector3(ORIGIN.x, ORIGIN.y, ORIGIN.z).addScaledVector(right, at.x / ACROSS).addScaledVector(up, -at.y / ACROSS)
  // Slid along the line of sight, which leaves the picture as it is, onto the ground.
  p.addScaledVector(back, (height - p.y) / back.y)
  return { x: p.x, y: p.y, z: p.z, zoom, yaw }
}

const WHOLE_MAP = aim({ x: 0, y: 0 }, FIT)
/** The whole map before the landing, shrunk and raised to clear the landing panel below it. */
const OVERVIEW = aim({ x: 0, y: 70 }, FIT * 0.82)
/** Where a new battle's fly-in starts: high above, turned away from where it settles. */
const SKY = aim({ x: 0, y: -HEIGHT }, FIT / 4, YAW - 0.6)

/** Words over the map, drawn in the camera's picture: a landing zone's name, or a callout over a unit. */
interface Label {
  text: string
  color: number
  size: number
  /** Where it stands, in the camera's picture. */
  at: () => Tile
  /** Share of its height that stands above `at`. */
  rise: number
  outline: number
  alpha: number
}

export interface View {
  canvas: HTMLCanvasElement
  /**
   * Shows the run's battle, which `events` produced. Animated, it follows the action with the camera, plays the
   * events, and resolves when they finish. Still, it draws the whole map at once and marks each shot with a line.
   * Aliens in unrevealed pods are never drawn; before the landing, each pod shows as a contact marker.
   * Once landed, fog darkens every tile no soldier sees.
   */
  show(run: Run, events: GameEvent[], animate: boolean): Promise<void>
  /** The landing zone under a point on the canvas as displayed, as an index into battle.zones; null when there is none to choose. */
  zoneAt(sx: number, sy: number): number | null
  /** Before the landing, glides the camera to a landing zone and marks its way in; null pulls back to the whole map. */
  focus(zone: number | null): void
  /** Hides the landing zones while the briefing flies over the mission, and shows them once it is done. */
  hideZones(hidden: boolean): void
  /** On a rescue, shows where each of `teams` teams would land. */
  showTeams(teams: number): void
  /** Glides the camera to frame the given tiles, above the landing panel, turned `turn` radians from still; null pulls back to the whole map. */
  frame(tiles: Tile[] | null, ms?: number, turn?: number): Promise<void>
}

export async function createView(): Promise<View> {
  // Colours are drawn as given, as flat art is: no conversion between colour spaces.
  ColorManagement.enabled = false
  const renderer = new WebGLRenderer({ antialias: true })
  renderer.outputColorSpace = LinearSRGBColorSpace
  renderer.setPixelRatio(devicePixelRatio)
  renderer.setClearColor(0x10141c)
  const canvas = renderer.domElement
  /** Shots, sparks, pods and words, drawn over the scene in the camera's picture. */
  const overlay = document.createElement('canvas')
  for (const c of [canvas, overlay]) Object.assign(c.style, { position: 'fixed', left: '0', top: '0' })
  overlay.style.pointerEvents = 'none'
  document.body.prepend(overlay)
  const ctx = overlay.getContext('2d')!

  const scene = new Scene()
  const eye = new OrthographicCamera()
  /** The world past the battlefield: scenery beyond its far edges, cliffs falling from its near ones. */
  const outskirts = new Group()
  /** The ground, and the props, walls and windows standing on it. */
  const terrain = new Group()
  /** Marks on the ground, in the order they lie: the landing zones' tint, acid and fire, fog, and glows in the fog. */
  const zones = new Group()
  const acid = new Group()
  const fog = new Group()
  const lurk = new Group()
  const units = new Group()
  scene.add(outskirts, terrain, zones, acid, fog, lurk, units)
  zones.renderOrder = 1
  // Nothing shows until a battle exists.
  scene.visible = false

  /** Shot effects over the scene, and each landing pod or canopy under way. */
  const fx = new Sketch()
  const drops = new Set<Sketch>()
  /** Before the landing, the landing zones' names and the contact markers; and the callouts over units. */
  let marks: Label[] = []
  const labels = new Set<Label>()

  const sprites = new Map<number, Sprite>()
  /** The squad of the run shown, for each soldier's class. */
  let soldiers: Run['soldiers'] = []
  /** A red glow under each alien the squad hasn't found, by unit id. */
  const glows = new Map<number, { node: Object3D; tile: Tile }>()
  /** Each prop, wall and window on the board, with the tiles that light it: it is lit when a soldier sees any of them. */
  const scenery: { node: Object3D; tiles: number[] }[] = []
  /** The battle on screen. */
  let shown: Battle | null = null
  let camera = WHOLE_MAP
  /** Screen pixels the picture is jolted by, as a blow lands. */
  const jolt = { x: 0, y: 0 }
  /** Whether the battle last shown was waiting for the landing, so the next one shown plays it. */
  let deploying = false
  /** The landing zone under the pointer. */
  let hovered: number | null = null
  /** The landing zone the camera is on before the landing. */
  let selected: number | null = null
  /** Whether the briefing is under way, so the landing zones are hidden. */
  let briefing = false
  /** On a rescue, the teams whose landing zones show. */
  let teams = 1

  /** Where a tile falls in the camera's picture. */
  const toWorld = (x: number, y: number): Tile => picture(spot(x, y), camera.yaw)
  /** Screen pixels per picture pixel. */
  const scale = () => camera.zoom * Math.min(innerWidth / WIDTH, innerHeight / HEIGHT)

  function resize(): void {
    renderer.setSize(innerWidth, innerHeight)
    overlay.width = innerWidth * devicePixelRatio
    overlay.height = innerHeight * devicePixelRatio
    Object.assign(overlay.style, { width: `${innerWidth}px`, height: `${innerHeight}px` })
    look(camera)
  }
  addEventListener('resize', () => requestAnimationFrame(resize))

  function look(to: Camera): void {
    camera = to
    // Cameras are framed for a WIDTH by HEIGHT screen; the window scales them to fill it.
    const units = scale() * ACROSS
    const { back, right, up } = axes(to.yaw)
    const p = new Vector3(to.x, to.y, to.z).addScaledVector(right, -jolt.x / units).addScaledVector(up, jolt.y / units)
    eye.position.copy(p).addScaledVector(back, 100)
    eye.up.copy(up)
    eye.lookAt(p)
    eye.left = -innerWidth / 2 / units
    eye.right = innerWidth / 2 / units
    eye.top = innerHeight / 2 / units
    eye.bottom = -innerHeight / 2 / units
    eye.near = 1
    eye.far = 400
    eye.updateProjectionMatrix()
  }

  /** The camera that frames the given tiles, zoomed in no closer than life size. */
  function framing(points: Tile[], yaw = YAW): Camera {
    const at = points.map((p) => picture(spot(p.x, p.y), yaw))
    const xs = at.map((p) => p.x)
    const ys = at.map((p) => p.y)
    const width = Math.max(...xs) - Math.min(...xs) + MARGIN
    const height = Math.max(...ys) - Math.min(...ys) + MARGIN
    const middle = { x: (Math.max(...xs) + Math.min(...xs)) / 2, y: (Math.max(...ys) + Math.min(...ys)) / 2 }
    const ground = points.reduce((sum, p) => sum + spot(p.x, p.y).y, 0) / points.length
    return aim(middle, Math.max(FIT, Math.min(1, WIDTH / width, HEIGHT / height)), yaw, ground)
  }

  /** Each rendered frame's work for a tween under way, given the milliseconds since the last frame. */
  const ticks = new Set<(ms: number) => void>()
  let last = performance.now()
  renderer.setAnimationLoop((now) => {
    const ms = now - last
    last = now
    for (const tick of [...ticks]) tick(ms)
    render()
  })

  function render(): void {
    const { back } = axes(camera.yaw)
    for (const sprite of sprites.values()) sprite.body.position.copy(back).multiplyScalar(STANDOFF)
    renderer.render(scene, eye)
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, overlay.width, overlay.height)
    if (!scene.visible) return
    const k = scale()
    const middle = picture(camera, camera.yaw)
    const dpr = devicePixelRatio
    ctx.setTransform(k * dpr, 0, 0, k * dpr, (innerWidth / 2 - middle.x * k + jolt.x) * dpr, (innerHeight / 2 - middle.y * k + jolt.y) * dpr)
    for (const drop of drops) drop.draw(ctx)
    fx.draw(ctx)
    for (const label of [...marks, ...labels]) write(label)
  }

  function write(label: Label): void {
    const at = label.at()
    ctx.font = `bold ${label.size}px sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    ctx.lineJoin = 'round'
    ctx.globalAlpha = label.alpha
    const y = at.y - label.rise * label.size * 1.2
    ctx.strokeStyle = css(COLOR.line)
    ctx.lineWidth = label.outline
    ctx.strokeText(label.text, at.x, y)
    ctx.fillStyle = css(label.color)
    ctx.fillText(label.text, at.x, y)
    ctx.globalAlpha = 1
  }

  /** Calls `frame` with progress 0..1 each rendered frame for `ms`. */
  const tween = (ms: number, frame: (t: number) => void) =>
    new Promise<void>((done) => {
      let elapsed = 0
      const tick = (step: number) => {
        elapsed += step
        const t = Math.min(elapsed / ms, 1)
        frame(t)
        if (t === 1) {
          ticks.delete(tick)
          done()
        }
      }
      ticks.add(tick)
    })

  const raycaster = new Raycaster()
  function zoneAt(px: number, py: number): number | null {
    if (shown?.phase !== 'deploy' || shown.goal === 'rescue') return null
    raycaster.setFromCamera(new Vector2((px / innerWidth) * 2 - 1, 1 - (py / innerHeight) * 2), eye)
    const hit = raycaster.intersectObject(terrain.children[0])[0]
    if (!hit) return null
    const tile = { x: Math.round(hit.point.x), y: Math.round(hit.point.z) }
    const index = shown.zones.findIndex((zone) => distance(zone, tile) <= ZONE_RADIUS)
    return index < 0 ? null : index
  }

  /** Stands a sprite on a tile. */
  function place(sprite: Sprite, tile: Tile): void {
    sprite.tile = tile
    const p = spot(tile.x, tile.y)
    sprite.node.position.set(p.x, p.y, p.z)
    sprite.at = toWorld(tile.x, tile.y)
  }

  /** Moves a sprite's feet off its tile to `at` in the camera's picture, as a lunge, knockback or fall does. */
  function shift(sprite: Sprite, at: Tile): void {
    const p = spot(sprite.tile.x, sprite.tile.y)
    const home = picture(p, camera.yaw)
    const { right, up } = axes(camera.yaw)
    sprite.node.position.set(p.x, p.y, p.z).addScaledVector(right, (at.x - home.x) / ACROSS).addScaledVector(up, -(at.y - home.y) / ACROSS)
    sprite.at = at
  }

  /** Stretches a sprite's picture by `wide` across and `high` up, as a blow squashes it. */
  function squash(sprite: Sprite, wide: number, high: number): void {
    const size = (sprite.scale * BODY_RES) / ACROSS
    sprite.body.scale.set((2 * BODY.left * size * wide) / BODY_RES, ((BODY.up + BODY.down) * size * high) / BODY_RES, 1)
  }

  function fade(sprite: Sprite, alpha: number): void {
    ;(sprite.body.material as SpriteMaterial).opacity = alpha
    ;(sprite.shadow.material as MeshBasicMaterial).opacity = 0.4 * alpha
  }

  /** A unit's health and armor in the battle; none of either once it is gone. */
  const vitals = (battle: Battle, id: number): [number, number] => {
    const unit = battle.units.find((u) => u.id === id)
    return [unit?.hp ?? 0, unit?.armor ?? 0]
  }

  /**
   * `pips` marks a soldier's level above its health; `letter` is the initial of its class. Its health and armor show as
   * pips, one each, ten to a row, rows stacking upward: health left in green on an ally and red on an enemy, health
   * lost in a dark shade of it, then armor in yellow.
   */
  function create(unit: Unit, pips: number, letter = ''): Sprite {
    const picture = document.createElement('canvas')
    picture.width = 2 * BODY.left * BODY_RES
    picture.height = (BODY.up + BODY.down) * BODY_RES
    const g = picture.getContext('2d')!
    const texture = new CanvasTexture(picture)
    const body = new Billboard(new SpriteMaterial({ map: texture, transparent: true, depthWrite: false }))
    body.center.set(0.5, BODY.down / (BODY.up + BODY.down))
    const shadow = new Mesh(new CircleGeometry(14 / ACROSS, 20).rotateX(-Math.PI / 2), new MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.4, depthWrite: false }))
    shadow.position.y = DECAL_LIFT * 2
    const node = new Group()
    node.add(shadow, body)
    const color = unit.boss || unit.target ? COLOR.boss : unit.civilian ? COLOR.civilian : unit.summoner !== null ? COLOR.mech : unit.kind ? ALIEN_LOOK[unit.kind].color : COLOR.human
    const rows = Math.ceil((unit.stats.hp + unit.stats.armor) / 10)
    const maxHp = unit.stats.hp
    const ally = unit.side === 'human'
    const sprite: Sprite = {
      node,
      body,
      shadow,
      tile: unit,
      at: { x: 0, y: 0 },
      scale: unit.boss ? 1.6 : unit.target ? 1.3 : unit.kind ? ALIEN_LOOK[unit.kind].scale : 1,
      ally,
      drawHp(hp, armor) {
        g.setTransform(BODY_RES, 0, 0, BODY_RES, BODY.left * BODY_RES, BODY.up * BODY_RES)
        g.clearRect(-BODY.left, -BODY.up, 2 * BODY.left, BODY.up + BODY.down)
        g.fillStyle = css(color)
        g.beginPath()
        g.roundRect(-9, -30, 18, 30, 6)
        g.fill()
        g.fillStyle = css(COLOR.human)
        for (let i = 0; i < pips; i++) {
          g.beginPath()
          g.arc(-9 + 6 * i, -40 - rows * PIP_STEP, 2, 0, Math.PI * 2)
          g.fill()
        }
        if (letter) {
          g.fillStyle = css(0x10141c)
          g.font = 'bold 13px sans-serif'
          g.textAlign = 'center'
          g.textBaseline = 'middle'
          g.fillText(letter, 0, -17)
        }
        const lost = maxHp - Math.max(hp, 0)
        const colors = [...Array(Math.max(hp, 0)).fill(ally ? COLOR.allyHp : COLOR.enemyHp), ...Array(Math.max(lost, 0)).fill(ally ? COLOR.allyLost : COLOR.enemyLost), ...Array(armor).fill(COLOR.hit)]
        colors.forEach((c, i) => {
          g.fillStyle = css(c)
          g.fillRect(-PIP_ROW / 2 + (i % 10) * PIP_STEP, -38 - Math.floor(i / 10) * PIP_STEP, PIP, PIP)
        })
        texture.needsUpdate = true
      },
    }
    node.scale.setScalar(1)
    shadow.scale.setScalar(sprite.scale)
    squash(sprite, 1, 1)
    units.add(node)
    sprites.set(unit.id, sprite)
    place(sprite, { x: unit.x, y: unit.y })
    sprite.drawHp(unit.hp, unit.armor)
    return sprite
  }

  function remove(id: number): void {
    const sprite = sprites.get(id)
    if (!sprite) return
    units.remove(sprite.node)
    ;(sprite.body.material as SpriteMaterial).map?.dispose()
    sprites.delete(id)
  }

  /** Adds a box to `shapes`, centred on the tile at x, z standing at height y. */
  function addBox(shapes: Shapes, x: number, y: number, z: number, box: Box): void {
    const w = box.wide / 2
    const d = box.deep / 2
    shapes.box(x - w, z - d, x + w, z + d, y + tall(box.base), y + tall(box.base + box.up), box.color, box.alpha ?? 1)
  }

  /** Builds the shapes into a node of the scenery, which fog can dim. */
  function stand(shapes: Shapes, blobs: Object3D[], lit: number[]): void {
    const node = new Group()
    const { mesh, lines } = shapes.build()
    node.add(mesh, ...blobs)
    if (lines) node.add(lines)
    terrain.add(node)
    scenery.push({ node, tiles: lit })
  }

  /**
   * Builds the prop on a tile. A prop that continues onto the tile above or below, such as a car parked along y,
   * is turned to lie that way; the two halves of a car share a colour.
   */
  function buildProp(battle: Battle, tile: number): void {
    const prop = battle.props[tile] as Exclude<Prop, 'none'>
    const x = tile % GRID
    const y = Math.floor(tile / GRID)
    const at = spot(x, y)
    const shapes = new Shapes()
    if (prop === 'tree') {
      const trunk = 2 / ACROSS
      shapes.box(x - trunk, y - trunk, x + trunk, y + trunk, at.y, at.y + tall(16), 0x5b4630)
      const off = 4 / ACROSS / Math.SQRT2
      return stand(shapes, [blob({ x, y: at.y + tall(24), z: y }, 14 / ACROSS, 0x2f6b3c), blob({ x: x - off, y: at.y + tall(28), z: y + off }, 8 / ACROSS, 0x3d8049)], [tile])
    }
    const same = (other: number) => other >= 0 && other < GRID * GRID && battle.props[other] === prop
    const alongX = (tile % GRID > 0 && same(tile - 1)) || (tile % GRID < GRID - 1 && same(tile + 1))
    const alongY = !alongX && (same(tile - GRID) || same(tile + GRID))
    // The first tile of the run the prop lies in.
    const head = alongY ? (same(tile - GRID) ? tile - GRID : tile) : tile % GRID > 0 && same(tile - 1) ? tile - 1 : tile
    for (const box of prop === 'car' ? carBoxes(head) : PROP_BOXES[prop]) addBox(shapes, x, at.y, y, alongY ? { ...box, wide: box.deep, deep: box.wide } : box)
    stand(shapes, [], [tile])
  }

  /** Builds the battle's ground, props, walls and windows afresh. They change only when a blast wrecks them. */
  function drawTerrain(battle: Battle): void {
    scenery.length = 0
    terrain.clear()
    outskirts.clear()
    outskirts.add(buildOutskirts(battle))
    const ground = new Shapes()
    for (let tile = 0; tile < GRID * GRID; tile++) {
      // Off the battlefield there is nothing to draw.
      if (battle.ground[tile] === 'void') continue
      const x = tile % GRID
      const y = Math.floor(tile / GRID)
      const top = LEVEL * battle.height[tile]
      const color = GROUND_COLOR[battle.ground[tile]]
      // The faces a raised tile shows above its lower neighbours.
      const drop = (nx: number, ny: number) => (onGridTile(nx, ny) ? Math.max(0, battle.height[tile] - battle.height[ny * GRID + nx]) * LEVEL : 0)
      const sides = [
        [x - 0.5, y + 0.5, x + 0.5, y + 0.5, drop(x, y + 1), 0.6],
        [x + 0.5, y - 0.5, x + 0.5, y + 0.5, drop(x + 1, y), 0.45],
        [x - 0.5, y - 0.5, x + 0.5, y - 0.5, drop(x, y - 1), 0.6],
        [x - 0.5, y - 0.5, x - 0.5, y + 0.5, drop(x - 1, y), 0.45],
      ] as const
      for (const [ax, az, bx, bz, fall, light] of sides) if (fall > 0) ground.quad({ x: ax, y: top, z: az }, { x: bx, y: top, z: bz }, { x: bx, y: top - fall, z: bz }, { x: ax, y: top - fall, z: az }, shade(color, light))
      ground.flat(x - 0.5, y - 0.5, x + 0.5, y + 0.5, top, highland(color, battle.height[tile]))
      for (const [ax, az, bx, bz] of [
        [x - 0.5, y - 0.5, x + 0.5, y - 0.5],
        [x - 0.5, y - 0.5, x - 0.5, y + 0.5],
      ])
        ground.line({ x: ax, y: top + 0.002, z: az }, { x: bx, y: top + 0.002, z: bz }, COLOR.line, 0.5)
    }
    const built = ground.build()
    // The ground is the terrain's first child, which a click on the map is tested against.
    terrain.add(built.mesh)
    if (built.lines) terrain.add(built.lines)
    for (let tile = 0; tile < GRID * GRID; tile++) {
      if (battle.ground[tile] === 'void') continue
      const x = tile % GRID
      const y = Math.floor(tile / GRID)
      if (battle.props[tile] !== 'none') buildProp(battle, tile)
      // A wall stands on the edge it divides this tile from its neighbour by.
      const north = battle.north[tile]
      const west = battle.west[tile]
      const at = spot(x, y)
      if (north !== 'none') {
        const shapes = new Shapes()
        for (const box of EDGE_BOXES[north]) addBox(shapes, x, at.y, y - 0.5, box)
        stand(shapes, [], [tile, tile - GRID])
      }
      if (west !== 'none') {
        const shapes = new Shapes()
        for (const box of EDGE_BOXES[west]) addBox(shapes, x - 0.5, at.y, y, { ...box, wide: box.deep, deep: box.wide })
        stand(shapes, [], [tile, tile - 1])
      }
    }
  }

  /** Clears the board for a new battle. */
  function setBattle(battle: Battle): void {
    shown = battle
    heights = battle.height
    selected = null
    for (const id of [...sprites.keys()]) remove(id)
    glows.clear()
    lurk.clear()
    drawTerrain(battle)
  }

  /** Words over a tile, `rise` of their height above it. */
  const label = (text: string, tile: Tile, color: number, size = 44): Label => ({ text, color, size, at: () => toWorld(tile.x, tile.y), rise: size === 44 ? 0.8 : 0, outline: 6, alpha: 1 })

  /** Replaces the marks on the ground in `layer` with `shapes`. */
  function lay(layer: Group, shapes: Shapes): void {
    layer.clear()
    const { mesh } = shapes.build()
    mesh.renderOrder = layer.renderOrder
    layer.add(mesh)
  }

  /** A tile's top, as a mark on the ground. */
  const diamond = (shapes: Shapes, x: number, y: number, color: number, alpha: number, lift = DECAL_LIFT) => {
    const h = spot(x, y).y + lift
    shapes.flat(x - 0.5, y - 0.5, x + 0.5, y + 0.5, h, color, alpha)
  }

  /** A ring around a tile's top, `width` screen pixels wide. */
  const ring = (shapes: Shapes, x: number, y: number, color: number, width: number, alpha: number) => {
    const h = spot(x, y).y + DECAL_LIFT * 2
    const w = width / ACROSS
    const c = [
      { x: x - 0.5, y: h, z: y - 0.5 },
      { x: x + 0.5, y: h, z: y - 0.5 },
      { x: x + 0.5, y: h, z: y + 0.5 },
      { x: x - 0.5, y: h, z: y + 0.5 },
    ]
    for (let i = 0; i < 4; i++) shapes.band(c[i], c[(i + 1) % 4], w, color, alpha)
  }

  /** Before the landing: tints, names and describes each landing zone, and marks where each pod is. */
  function drawMarks(battle: Battle): void {
    const tint = new Shapes()
    marks = []
    if (battle.uplink) marks.push(label('📡 UPLINK', battle.uplink, COLOR.uplink, 28))
    if (battle.escape) marks.push(label('🚁 ESCAPE', battle.escape, COLOR.uplink, 28))
    for (const cache of battle.caches) marks.push(label('📦', cache, COLOR.uplink, 24))
    if (battle.start && battle.phase === 'deploy') marks.push(label('⚠ AMBUSHED HERE', battle.start, COLOR.contact, 24))
    if (battle.phase === 'deploy') {
      // A rescue shows where each of its teams would land.
      const shownZones = battle.goal === 'rescue' ? battle.zones.slice(0, teams) : battle.zones
      if (!briefing)
        shownZones.forEach((zone, i) => {
          for (let y = 0; y < GRID; y++) {
            for (let x = 0; x < GRID; x++) {
              if (distance(zone, { x, y }) <= ZONE_RADIUS) diamond(tint, x, y, i === hovered || i === selected ? COLOR.zoneHover : COLOR.zone, 0.8)
            }
          }
          // The selected zone's way in: a line to the uplink, or to the nearest contact.
          // On an escape, the way out from where the squad is ambushed.
          const toward = i === selected && (battle.start ?? battle.uplink ?? nearestAlien(battle, zone))
          if (toward) {
            const a = spot(zone.x, zone.y)
            const b = spot(toward.x, toward.y)
            const lift = Math.max(a.y, b.y) + DECAL_LIFT * 3
            tint.band({ ...a, y: lift }, { ...b, y: lift }, 4 / ACROSS, battle.uplink ? COLOR.uplink : COLOR.contact, 0.9)
          }
          marks.push(label(battle.goal === 'rescue' ? `Team ${i + 1}` : `${ZONE_NAMES[i]} ${PLANS[battle.plans[i]].icon}`, zone, 0xffffff))
        })
      battle.pods.forEach((_, pod) => {
        const members = battle.units.filter((u) => u.pod === pod)
        if (members.length > 0) marks.push(label('?', members[0], COLOR.contact), label(battle.pods[pod].name, members[0], COLOR.contact, 20))
      })
    }
    lay(zones, tint)
  }

  /** Dims a node of the scenery, or a unit, by `tint`. */
  function dim(node: Object3D, tint: number): void {
    node.traverse((part) => {
      const material = (part as Mesh).material as MeshBasicMaterial | SpriteMaterial | undefined
      if (!material) return
      // A blob's material holds its own colour, so it is dimmed from that; a box's colours are its vertices'.
      if (part instanceof Billboard) part.userData.color ??= material.color.getHex()
      const own = part.userData.color as number | undefined
      material.color.setHex(own === undefined ? tint : mixTint(own, tint))
    })
  }

  /** Darkens every tile no soldier sees, and whatever stands on it. Before the landing nothing is fogged. */
  function drawFog(battle: Battle, snap = false): void {
    const shapes = new Shapes()
    const seen = battle.phase === 'deploy' ? null : visibleTiles(battle)
    const tint = (tile: number) => (!seen || seen[tile] ? 0xffffff : COLOR.dim)
    seen?.forEach((lit, i) => {
      if (!lit) diamond(shapes, i % GRID, Math.floor(i / GRID), COLOR.fog, 0.55, DECAL_LIFT * 3)
    })
    lay(fog, shapes)
    // Mid-beat, a glow stays where its slide left it; the battle already holds where the alien ends up.
    const lurking = seen ? battle.units.filter((u) => u.hp > 0 && !u.civilian && !revealed(battle, u)) : []
    const ids = new Set(lurking.map((u) => u.id))
    for (const [id, glow] of glows) {
      if (ids.has(id)) continue
      lurk.remove(glow.node)
      glows.delete(id)
    }
    for (const unit of lurking) {
      let glow = glows.get(unit.id)
      if (!glow) {
        const shapes = new Shapes()
        for (const [scale, alpha] of [[1, 0.12], [0.65, 0.14], [0.35, 0.16]]) shapes.disc(0, 0, DECAL_LIFT * 4, (TILE_W / 2 / ACROSS) * scale, (TILE_W / 2 / ACROSS) * scale, COLOR.lurk, alpha)
        const node = shapes.build().mesh
        lurk.add(node)
        glow = { node, tile: unit }
        glows.set(unit.id, glow)
      } else if (!snap) continue
      glow.tile = { x: unit.x, y: unit.y }
      const p = spot(unit.x, unit.y)
      glow.node.position.set(p.x, p.y, p.z)
    }
    for (const { node, tiles: lit } of scenery) dim(node, !seen || lit.some((tile) => seen[tile]) ? 0xffffff : COLOR.dim)
    for (const sprite of sprites.values()) (sprite.body.material as SpriteMaterial).color.setHex(tint(Math.round(sprite.tile.y) * GRID + Math.round(sprite.tile.x)))
  }

  /** Tints every tile of acid or fire, marks every tile of caltrops, and rings each unit rooted or charged. */
  function drawAcid(battle: Battle): void {
    const shapes = new Shapes()
    for (const pool of battle.acid) diamond(shapes, pool.x, pool.y, COLOR.acid, 0.45)
    for (const pool of battle.fire) diamond(shapes, pool.x, pool.y, COLOR.fire, 0.5)
    // Caltrops: a scatter of spikes across the tile.
    for (const tile of battle.caltrops) {
      const at = spot(tile.x, tile.y)
      for (const [dx, dz] of [[-0.25, 0.1], [0, -0.2], [0.25, 0.1], [-0.12, 0.25], [0.12, 0.25]]) shapes.spike(at.x + dx, at.z + dz, at.y, 0.05, { x: at.x + dx, y: at.y + tall(5), z: at.z + dz }, COLOR.spike)
    }
    for (const unit of battle.units.filter((u) => u.hp > 0 && revealed(battle, u))) {
      if (unit.rooted > 0) ring(shapes, unit.x, unit.y, COLOR.rooted, 3, 0.9)
      if (unit.booming > 0) ring(shapes, unit.x, unit.y, COLOR.booming, 2, 0.9)
    }
    lay(acid, shapes)
  }

  /** Makes the sprites match the battle exactly. */
  function sync(run: Run, battle: Battle): void {
    drawAcid(battle)
    const visible = battle.units.filter((u) => revealed(battle, u))
    const live = new Set(visible.map((u) => u.id))
    for (const id of [...sprites.keys()]) if (!live.has(id)) remove(id)
    for (const unit of visible) {
      const soldier = run.soldiers.find((s) => s.id === unit.soldier)
      const sprite = sprites.get(unit.id) ?? create(unit, soldier ? level(soldier) : 0, soldier?.cls ? CLASSES[soldier.cls].name[0] : letter(unit))
      place(sprite, { x: unit.x, y: unit.y })
      fade(sprite, 1)
      sprite.drawHp(unit.hp, unit.armor)
    }
  }

  /** The camera's glide under way; a new one takes over from wherever the camera is, so two never fight over it. */
  let glides = 0

  /**
   * Glides the camera to frame the given tiles, or to the given camera, over `ms`, easing in and out. Zoom changes by
   * the same factor each frame, so pulling out reads as steady as pushing in.
   */
  function follow(points: Tile[] | Camera, ms = CAMERA_MS): Promise<void> {
    const from = camera
    const to = Array.isArray(points) ? framing(points, camera.yaw) : points
    const mine = ++glides
    return tween(ms, (t) => {
      if (mine !== glides) return
      const ease = t * t * (3 - 2 * t)
      const at = (a: number, b: number) => a + (b - a) * ease
      look({ x: at(from.x, to.x), y: at(from.y, to.y), z: at(from.z, to.z), zoom: from.zoom * (to.zoom / from.zoom) ** ease, yaw: at(from.yaw, to.yaw) })
    })
  }

  const chest = (sprite: Sprite): Tile => ({ x: sprite.at.x, y: sprite.at.y - CHEST })

  /** Words over a unit saying what just happened to it. */
  function callout(text: string, color: number, over: Sprite, size = 13): Label {
    const at = { x: over.at.x, y: over.at.y - 48 }
    const mark: Label = { text, color, size, at: () => at, rise: 1, outline: 3, alpha: 1 }
    labels.add(mark)
    return mark
  }

  /** A shot's result: a miss, or a hit or crit with its damage. */
  function shotCallout(e: Extract<GameEvent, { type: 'shot' }>, over: Sprite): Label {
    if (!e.hit) return callout('MISS', COLOR.miss, over)
    return e.crit ? callout(`CRIT -${e.damage}`, COLOR.crit, over, 18) : callout(`HIT -${e.damage}`, COLOR.hit, over)
  }

  /** Floats a callout up and away. It does not hold up the next beat. */
  function float(mark: Label): void {
    const from = mark.at()
    void tween(CALLOUT_MS, (t) => {
      const at = { x: from.x, y: from.y - 34 * t }
      mark.at = () => at
      mark.alpha = Math.min(1, 3 * (1 - t))
    }).then(() => labels.delete(mark))
  }

  /** How long `sprite` takes to walk `path` from where it stands: unseen, the squad creeps. */
  const walkMs = (sprite: Sprite, path: Tile[]) => MS_PER_TILE * (shown?.concealed && sprite.ally ? CREEP_PACE : 1) * ground([sprite.tile, ...path])

  function walk(sprite: Sprite, path: Tile[], ms = walkMs(sprite, path)): Promise<void> {
    const points = [sprite.tile, ...path]
    return tween(ms, (t) => place(sprite, along(points, t)))
  }

  /** Slides an unfound alien's glow along its path through the fog. */
  function glide(glow: { node: Object3D; tile: Tile }, path: Tile[], ms = MS_PER_TILE * ground([glow.tile, ...path])): Promise<void> {
    const points = [glow.tile, ...path]
    glow.tile = path.at(-1)!
    return tween(ms, (t) => {
      const at = along(points, t)
      const p = spot(at.x, at.y)
      glow.node.position.set(p.x, p.y, p.z)
    })
  }

  /** Jolts the camera, fading out over `ms`. */
  function shake(power: number, ms = 240): Promise<void> {
    if (power === 0) return Promise.resolve()
    return tween(ms, (t) => {
      jolt.x = (Math.random() * 2 - 1) * power * (1 - t)
      jolt.y = (Math.random() * 2 - 1) * power * (1 - t)
      look(camera)
    }).then(() => {
      jolt.x = jolt.y = 0
      look(camera)
    })
  }

  /** Projectiles fly from the muzzle at `a` to each of `ends`. */
  function fire(a: Tile, ends: Tile[], gun: Weapon): Promise<void> {
    const total = gun.ms + gun.stagger * (ends.length - 1)
    return tween(total, (t) => {
      fx.clear()
      ends.forEach((b, i) => {
        const local = Math.min(1, Math.max(0, (t * total - i * gun.stagger) / gun.ms))
        if (local === 0) return
        // The muzzle flash: a burst at the barrel that dies as the round leaves.
        if (local < 0.3) fx.circle(a.x, a.y, gun.flash * (1 - local / 0.3)).fill({ color: gun.core, alpha: 0.9 })
        if (gun.style === 'bolt') {
          const head = lerp(a, b, local)
          const tail = lerp(a, b, Math.max(0, local - 0.35))
          const glint = lerp(a, b, Math.max(0, local - 0.12))
          fx.moveTo(tail.x, tail.y).lineTo(head.x, head.y).stroke({ color: gun.color, width: gun.width })
          fx.moveTo(glint.x, glint.y).lineTo(head.x, head.y).stroke({ color: gun.core, width: 1 })
        } else if (gun.style === 'orb') {
          for (let k = 4; k >= 0; k--) {
            const at = lerp(a, b, Math.max(0, local - k * 0.05))
            fx.circle(at.x, at.y, gun.width * 2 * (1 - k * 0.15)).fill({ color: gun.color, alpha: 0.07 * (5 - k) })
          }
          const head = lerp(a, b, local)
          fx.circle(head.x, head.y, gun.width).fill(gun.color).circle(head.x, head.y, gun.width / 2).fill(gun.core)
        } else {
          // A beam charges at the muzzle, then fires all at once and thins away.
          const charge = 0.4
          if (local < charge) fx.circle(a.x, a.y, (gun.flash * local) / charge).fill({ color: gun.color, alpha: 0.5 }).circle(a.x, a.y, (gun.flash * local) / charge / 2).fill(gun.core)
          else {
            const fade = 1 - (local - charge) / (1 - charge)
            fx.moveTo(a.x, a.y).lineTo(b.x, b.y).stroke({ color: gun.color, width: gun.width * 2 * fade, alpha: 0.4 })
            fx.moveTo(a.x, a.y).lineTo(b.x, b.y).stroke({ color: gun.core, width: Math.max(1, gun.width * fade) })
          }
        }
      })
    })
  }

  /** The attacker winds back, lunges in, rakes the target with a slash per bolt, and steps back. */
  async function strike(from: Sprite, to: Sprite, gun: Weapon, ends: Tile[], hit: boolean): Promise<void> {
    const home = toWorld(from.tile.x, from.tile.y)
    const dx = to.at.x - home.x
    const dy = to.at.y - home.y
    const len = Math.hypot(dx, dy) || 1
    const reach = Math.min(len * 0.55, 40)
    const nudge = (d: number) => shift(from, { x: home.x + (dx / len) * d, y: home.y + (dy / len) * d })
    await tween(gun.ms, (t) => nudge(-gun.flash * t))
    await tween(gun.ms * 0.6, (t) => nudge(-gun.flash + (reach + gun.flash) * t * t))
    await tween(gun.ms * 1.5, (t) => {
      fx.clear()
      if (!hit) return
      ends.forEach((b, i) => {
        const local = Math.min(1, Math.max(0, t * ends.length - i * 0.6))
        if (local === 0) return
        const lean = (i - (ends.length - 1) / 2) * 7
        const start = { x: b.x - 14 + lean, y: b.y - 14 }
        const head = lerp(start, { x: b.x + 14 + lean, y: b.y + 12 }, Math.min(1, local * 1.6))
        fx.moveTo(start.x, start.y).lineTo(head.x, head.y).stroke({ color: gun.color, width: gun.width * (1 - local * 0.6), alpha: 1 - local * 0.5 })
      })
    })
    void tween(gun.ms * 2, (t) => nudge(reach * (1 - t)))
  }

  /** Sparks fly off the impact point, onward from the shot, and a ring spreads. */
  function burst(at: Tile, dir: Tile, color: number, count: number, size: number): Promise<void> {
    const sparks = Array.from({ length: count }, () => {
      const angle = Math.atan2(dir.y, dir.x) + (Math.random() - 0.5) * 2.2
      const speed = (20 + Math.random() * 30) * size
      return { vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 10 }
    })
    return tween(IMPACT_MS * 1.6, (t) => {
      fx.clear().circle(at.x, at.y, (4 + 14 * size) * t).stroke({ color, width: 3 * (1 - t), alpha: 1 - t })
      for (const s of sparks) fx.circle(at.x + s.vx * t, at.y + s.vy * t + 30 * t * t, 2 * (1 - t) + 0.5).fill({ color, alpha: 1 - t })
    })
  }

  /**
   * A shot plays as its weapon: the projectile or lunge, then on a hit a freeze on the blow with the target squashed and
   * flashing, a camera jolt, a knockback and sparks, all harder on a crit. A miss sails past and ricochets.
   */
  async function shoot(from: Sprite, to: Sprite, e: Extract<GameEvent, { type: 'shot' }>, after: [number, number], gun: Weapon): Promise<void> {
    const { hit, crit } = e
    const a = chest(from)
    // A miss flies past above the target.
    const aim = hit ? chest(to) : { x: to.at.x + 10, y: to.at.y - CHEST - 26 }
    const len = Math.hypot(aim.x - a.x, aim.y - a.y) || 1
    const dir = { x: (aim.x - a.x) / len, y: (aim.y - a.y) / len }
    const ends = Array.from({ length: gun.bolts }, (_, i) => {
      const off = gun.bolts === 1 ? 0 : (i / (gun.bolts - 1) - 0.5) * gun.spread + (Math.random() - 0.5) * gun.spread * 0.3
      return { x: aim.x - dir.y * off, y: aim.y + dir.x * off }
    })
    if (gun.style === 'strike') await strike(from, to, gun, ends, hit)
    else await fire(a, ends, gun)
    fx.clear()
    float(shotCallout(e, to))
    // What of the shooter's shaped the shot, named over the shooter.
    if (e.with.length > 0) float(callout(e.with.map((effect) => effectName(effect).toUpperCase()).join(' · '), 0xffffff, from))
    if (!hit) {
      if (gun.style !== 'strike') await burst(aim, dir, COLOR.miss, 3, 0.5)
      fx.clear()
      return
    }
    to.drawHp(...after)
    const power = crit ? 2 : 1
    const home = toWorld(to.tile.x, to.tile.y)
    squash(to, 1.2, 0.8)
    await tween(gun.hitstop * power, () => {
      fx.clear().circle(aim.x, aim.y, 10 * power).fill({ color: 0xffffff, alpha: 0.9 })
    })
    void shake(gun.shake * power)
    const kick = gun.kick * power
    void tween(IMPACT_MS * 1.6, (t) => {
      const push = kick * Math.sin(Math.PI * Math.min(1, t * 1.4)) * (1 - t)
      shift(to, { x: home.x + dir.x * push, y: home.y + dir.y * push })
      squash(to, 1.2 - 0.2 * t, 0.8 + 0.2 * t)
    })
    await burst(aim, dir, crit ? COLOR.crit : gun.color, gun.sparks * power, power)
    place(to, to.tile)
    squash(to, 1, 1)
    fx.clear()
  }

  /** What a gear effect did to a unit, in a word: the effect's name, and the health it gave or took. */
  function effectCallout(e: Extract<GameEvent, { type: 'effect' }>, over: Sprite): Label {
    const word = effectName(e.effect).toUpperCase()
    return callout(e.amount === 0 ? word : `${word} ${e.amount > 0 ? '+' : ''}${e.amount}`, e.amount > 0 ? COLOR.heal : e.amount < 0 ? COLOR.crit : COLOR.hit, over)
  }

  /** A rocket flies from `from` to its tile and bursts, wounding every unit it caught. With no `from`, something burst where it stood. */
  async function fireRocket(battle: Battle, from: Sprite | undefined, e: Extract<GameEvent, { type: 'rocket' }>): Promise<void> {
    const b = toWorld(e.x, e.y)
    if (from) {
      const a = chest(from)
      await tween(ROCKET_MS, (t) => {
        const at = lerp(a, b, t)
        fx.clear().circle(at.x, at.y, 5).fill(COLOR.crit)
      })
    }
    // The blast has already wrecked the terrain in the battle; show it as the rocket lands.
    drawTerrain(battle)
    drawFog(battle)
    for (const hit of e.hits) {
      const sprite = sprites.get(hit.target)
      if (!sprite) continue
      sprite.drawHp(...vitals(battle, hit.target))
      float(callout(`ROCKET -${hit.damage}`, COLOR.crit, sprite))
    }
    await tween(BLAST_MS, (t) => {
      fx.clear().ellipse(b.x, b.y, (BLAST_RADIUS + 0.7) * TILE_W * t, (BLAST_RADIUS + 0.7) * TILE_H * t).fill({ color: COLOR.crit, alpha: 0.8 * (1 - t) })
    })
    fx.clear()
  }

  /** Runs `play` with a sketch of its own drawn over the scene, removed once it is done. */
  async function drawing(play: (sketch: Sketch) => Promise<void>): Promise<void> {
    const sketch = new Sketch()
    drops.add(sketch)
    await play(sketch)
    drops.delete(sketch)
  }

  /**
   * The landing: the camera frames the zone, and each soldier's drop pod streaks down one after another on a trail of
   * fire, slams in with a burst of dust, and opens on the soldier. A hot drop shakes the ground harder.
   */
  async function dropPods(battle: Battle): Promise<void> {
    const soldiers = battle.units.filter((u) => u.side === 'human' && !u.civilian)
    const hot = battle.breach
    if (soldiers.length === 0) return
    for (const unit of soldiers) fade(sprites.get(unit.id)!, 0)
    await follow(soldiers.map((u) => ({ x: u.x, y: u.y })))
    if (battle.landed === 'stealth') return parachute(soldiers)
    await Promise.all(
      soldiers.map((unit, i) =>
        drawing(async (pod) => {
          const sprite = sprites.get(unit.id)!
          const ground = sprite.at
          await tween(i * POD_STAGGER_MS, () => {})
          await tween(POD_FALL_MS, (t) => {
            const y = ground.y - POD_HEIGHT * (1 - t * t)
            pod.clear()
            pod.moveTo(ground.x, y - 160).lineTo(ground.x, y - 30).stroke({ color: COLOR.crit, width: 12, alpha: 0.6 })
            pod.moveTo(ground.x, y - 90).lineTo(ground.x, y - 30).stroke({ color: 0xffe08a, width: 5 })
            pod.ellipse(ground.x, ground.y, 16 * t, 8 * t).fill({ color: 0x000000, alpha: 0.4 })
            pod.roundRect(ground.x - 14, y - 44, 28, 44, 12).fill(0xc9d3e3).stroke({ color: 0x10141c, width: 3 })
            pod.rect(ground.x - 6, y - 34, 12, 8).fill(0x6fb7ff)
          })
          fade(sprite, 1)
          await tween(POD_DUST_MS, (t) => {
            pod.clear()
            pod.ellipse(ground.x, ground.y, 14 + (hot ? 70 : 40) * t, 7 + (hot ? 35 : 20) * t).fill({ color: hot ? COLOR.crit : 0xb8a888, alpha: 0.7 * (1 - t) })
            pod.roundRect(ground.x - 14, ground.y - 44 + 44 * t, 28, 44 * (1 - t), 12).fill({ color: 0xc9d3e3, alpha: 1 - t })
            if (hot) {
              jolt.x = Math.sin(t * 60) * 3 * (1 - t)
              look(camera)
            }
          })
        }),
      ),
    )
    jolt.x = 0
    look(camera)
  }

  /** A stealth insertion: each soldier drifts down under a canopy, swaying, and lands without a sound. */
  async function parachute(soldiers: Unit[]): Promise<void> {
    await Promise.all(
      soldiers.map((unit, i) =>
        drawing(async (chute) => {
          const sprite = sprites.get(unit.id)!
          const ground = sprite.at
          await tween(i * POD_STAGGER_MS, () => {})
          fade(sprite, 1)
          await tween(CHUTE_FALL_MS, (t) => {
            const sway = Math.sin(t * Math.PI * 3) * 10 * (1 - t)
            const x = ground.x + sway
            const y = ground.y - CHUTE_HEIGHT * (1 - t)
            shift(sprite, { x, y })
            chute.clear()
            chute.ellipse(ground.x, ground.y, 14 * t, 7 * t).fill({ color: 0x000000, alpha: 0.35 })
            // Lines from the soldier's shoulders up to the canopy.
            chute.moveTo(x - 6, y - 34).lineTo(x - 22, y - 74).moveTo(x + 6, y - 34).lineTo(x + 22, y - 74).stroke({ color: 0xd8dde6, width: 1.5, alpha: 0.9 })
            chute.moveTo(x - 26, y - 72).arc(x, y - 72, 26, Math.PI, 0).closePath().fill(0x4a5a3c).stroke({ color: 0x2b3424, width: 2 })
          })
          place(sprite, sprite.tile)
          await tween(CHUTE_FOLD_MS, (t) => {
            chute.clear()
            chute.moveTo(ground.x - 26, ground.y - 72 + 60 * t).arc(ground.x + 20 * t, ground.y - 72 + 60 * t, 26 * (1 - t / 2), Math.PI, 0).closePath().fill({ color: 0x4a5a3c, alpha: 1 - t })
          })
        }),
      ),
    )
  }

  /** Plays a beat in order. Moves in a row play together; moves by unseen aliens are skipped. */
  async function play(battle: Battle, events: GameEvent[]): Promise<void> {
    const calm = events.every((e) => e.type === 'move' || e.type === 'sighted' || e.type === 'reveal')
    for (let i = 0; i < events.length; i++) {
      const e = events[i]
      if (e.type === 'move') {
        const moves = []
        for (; events[i]?.type === 'move'; i++) moves.push(events[i] as Extract<GameEvent, { type: 'move' }>)
        i--
        const seen = moves.filter((m) => sprites.has(m.id))
        const gliding = moves.filter((m) => glows.has(m.id))
        // Before a fight everyone walks the whole beat, the camera with them, so nobody stops to wait; in one, the camera finds the movers first.
        const ms = calm ? Math.max(...seen.map((m) => walkMs(sprites.get(m.id)!, m.path)), ...gliding.map((m) => MS_PER_TILE * ground([glows.get(m.id)!.tile, ...m.path]))) : undefined
        const glides = gliding.map((m) => glide(glows.get(m.id)!, m.path, ms))
        if (seen.length === 0) {
          await Promise.all(glides)
          continue
        }
        const framing = follow(seen.flatMap((m) => [sprites.get(m.id)!.tile, m.path.at(-1)!]))
        for (const m of seen) if (m.with) float(callout(effectName(m.with).toUpperCase(), 0xffffff, sprites.get(m.id)!))
        if (!calm) await framing
        await Promise.all([framing, ...glides, ...seen.map((m) => walk(sprites.get(m.id)!, m.path, ms))])
        // The fog lifts where the squad arrived, before any pod it uncovered appears.
        drawFog(battle)
      } else if (e.type === 'reveal' || e.type === 'wave' || e.type === 'sighted') {
        await follow(e.units)
        // A pod already in sight, its ambush sprung or the squad spotted, stays as it is.
        const appeared = e.units.flatMap((at) => {
          const unit = battle.units.find((u) => u.id === at.id)
          return unit && !sprites.has(unit.id) ? [create({ ...unit, x: at.x, y: at.y }, 0, letter(unit))] : []
        })
        await tween(REVEAL_MS, (t) => appeared.forEach((sprite) => fade(sprite, t)))
        const first = sprites.get(e.units[0]?.id ?? -1)
        if (e.type === 'sighted' && first) float(callout('UNAWARE · HOLD FIRE', COLOR.miss, first, 18))
        if (e.type === 'reveal' && e.ambush && first) float(callout('AMBUSH!', COLOR.hit, first, 18))
        if (e.type === 'reveal' && e.stalked && first) float(callout('STALKED!', COLOR.crit, first, 18))
        if (e.type === 'wave' && appeared.length > 0) float(callout('REINFORCEMENTS', COLOR.crit, appeared[0], 18))
      } else if (e.type === 'shot') {
        const from = sprites.get(e.id)
        const to = sprites.get(e.target)
        if (!from || !to) continue
        await follow([from.tile, to.tile])
        const shooter = battle.units.find((u) => u.id === e.id)!
        await shoot(from, to, e, vitals(battle, e.target), weaponOf(shooter, soldiers.find((s) => s.id === shooter.soldier)?.cls ?? null))
        // Crumbling cover has already broken in the battle; show it as the hit lands.
        if (battle.twist === 'crumbling' && e.damage > 0) drawTerrain(battle)
      } else if (e.type === 'rocket') {
        const from = sprites.get(e.id)
        if (!from && !e.hits.some((hit) => sprites.has(hit.target))) continue
        await follow(from ? [from.tile, e] : [e])
        await fireRocket(battle, from, e)
      } else if (e.type === 'spit' || e.type === 'panic') {
        const from = sprites.get(e.id)
        const to = sprites.get(e.target)
        if (!from || !to) continue
        await follow([from.tile, to.tile])
        const a = chest(from)
        const b = chest(to)
        const color = e.type === 'spit' ? COLOR.acid : COLOR.psi
        await tween(PSI_MS, (t) => {
          const head = lerp(a, b, t)
          // Spit arcs as a blob; panic reaches out as a beam.
          if (e.type === 'spit') fx.clear().circle(head.x, head.y - 30 * Math.sin(Math.PI * t), 5).fill(color)
          else fx.clear().moveTo(a.x, a.y).lineTo(head.x, head.y).stroke({ color, width: 2, alpha: 0.8 })
        })
        fx.clear()
        if (e.type === 'spit') {
          to.drawHp(...vitals(battle, e.target))
          drawAcid(battle)
          float(callout(`ACID -${e.damage}`, COLOR.acid, to))
        } else float(callout('PANICKED', COLOR.psi, to))
      } else if (e.type === 'frozen' || e.type === 'hurt') {
        const on = sprites.get(e.id)
        if (!on) continue
        await follow([on.tile])
        if (e.type === 'hurt') on.drawHp(...vitals(battle, e.id))
        float(e.type === 'frozen' ? callout(battle.units.find((u) => u.id === e.id)?.side === 'alien' ? 'STUNNED' : 'TOO SHAKEN TO ACT', COLOR.psi, on) : callout(`${e.cause.toUpperCase()} -${e.amount}`, e.cause === 'acid' ? COLOR.acid : e.cause === 'impact' ? COLOR.crit : COLOR.psi, on))
      } else if (e.type === 'spawn') {
        const unit = battle.units.find((u) => u.id === e.unit.id)
        if (!unit || !revealed(battle, unit)) continue
        await follow([e.unit])
        const born = create({ ...unit, x: e.unit.x, y: e.unit.y }, 0, letter(unit))
        await tween(REVEAL_MS, (t) => fade(born, t))
      } else if (e.type === 'effect') {
        const on = sprites.get(e.id)
        if (!on) continue
        on.drawHp(...vitals(battle, e.id))
        // A demolishing hit has already wrecked the cover in the battle; show it as the hit lands.
        if (e.effect === 'demolish') drawTerrain(battle)
        float(effectCallout(e, on))
      } else if (e.type === 'saved' || e.type === 'escaped') {
        const sprite = sprites.get(e.id)
        if (!sprite) continue
        float(callout(e.type === 'saved' ? 'SAVED' : 'LIFTED OFF', COLOR.heal, sprite))
        await tween(DEATH_MS, (t) => fade(sprite, 1 - t))
        remove(e.id)
      } else if (e.type === 'found') {
        const on = sprites.get(e.id)
        if (on) float(callout('FOUND', COLOR.civilian, on))
      } else if (e.type === 'feed') {
        const on = sprites.get(e.id)
        if (on) float(callout(`FED +${e.damage}`, COLOR.crit, on))
      } else if (e.type === 'heal') {
        const to = sprites.get(e.target)
        if (!to) continue
        await follow([to.tile])
        to.drawHp(...vitals(battle, e.target))
        float(callout(`HEAL +${e.amount}`, COLOR.heal, to))
      } else if (e.type === 'death') {
        const sprite = sprites.get(e.id)
        if (!sprite) continue
        await tween(DEATH_MS, (t) => fade(sprite, 1 - t))
        remove(e.id)
      }
    }
  }

  canvas.addEventListener('pointermove', (e) => {
    const zone = zoneAt(e.offsetX, e.offsetY)
    canvas.style.cursor = zone === null ? 'default' : 'pointer'
    if (zone === hovered || !shown) return
    hovered = zone
    drawMarks(shown)
  })

  /** What the camera frames for a landing zone: the zone, and the uplink or nearest contact it heads for. */
  function zoneView(battle: Battle, zone: Tile): Tile[] {
    const reach = ZONE_RADIUS + 2
    const toward = battle.uplink ?? nearestAlien(battle, zone)
    return [{ x: zone.x - reach, y: zone.y - reach }, { x: zone.x + reach, y: zone.y + reach }, ...(toward ? [toward] : [])]
  }

  /** The camera framing `tiles`, raised so the landing panel below covers none of it; null frames the whole map. */
  function above(tiles: Tile[] | null, yaw = YAW): Camera {
    if (tiles === null) return { ...OVERVIEW, yaw }
    const framed = framing(tiles, yaw)
    const { up } = axes(yaw)
    const lift = -PANEL / framed.zoom / ACROSS
    return { ...framed, x: framed.x + up.x * lift, y: framed.y + up.y * lift, z: framed.z + up.z * lift }
  }

  resize()
  return {
    canvas,
    zoneAt,
    frame(tiles, ms = FOCUS_MS, turn = 0) {
      return follow(above(tiles, YAW + turn), ms)
    },
    showTeams(n) {
      teams = n
      if (shown) drawMarks(shown)
    },
    hideZones(hidden) {
      briefing = hidden
      if (shown) drawMarks(shown)
    },
    focus(zone) {
      if (shown?.phase !== 'deploy') return
      selected = zone
      drawMarks(shown)
      void follow(zone === null ? OVERVIEW : above(zoneView(shown, shown.zones[zone])), FOCUS_MS)
    },
    async show(run, events, animate) {
      soldiers = run.soldiers
      fx.clear()
      const battle = run.battle
      if (!battle) return
      scene.visible = true
      const fresh = battle !== shown
      if (fresh) setBattle(battle)
      drawMarks(battle)
      // A new battle opens flying in from high above, turning, down to the whole map.
      if (fresh && battle.phase === 'deploy') {
        look(SKY)
        void follow(OVERVIEW, FLY_MS)
      }
      if (animate) await play(battle, events)
      sync(run, battle)
      if (events.some((e) => e.type === 'rocket' || (e.type === 'effect' && e.effect === 'demolish'))) drawTerrain(battle)
      drawFog(battle, true)
      const landed = deploying && battle.phase !== 'deploy'
      deploying = battle.phase === 'deploy'
      if (landed && animate) await dropPods(battle)
      if (!animate) {
        if (battle.phase !== 'deploy') look(WHOLE_MAP)
        labels.clear()
        for (const e of events) {
          if (e.type === 'effect' && sprites.has(e.id)) effectCallout(e, sprites.get(e.id)!)
          if (e.type === 'heal' && sprites.has(e.target)) callout(`HEAL +${e.amount}`, COLOR.heal, sprites.get(e.target)!)
          if (e.type === 'rocket') {
            const c = toWorld(e.x, e.y)
            fx.ellipse(c.x, c.y, (BLAST_RADIUS + 0.7) * TILE_W, (BLAST_RADIUS + 0.7) * TILE_H).fill({ color: COLOR.crit, alpha: 0.4 })
          }
          if (e.type !== 'shot') continue
          const from = sprites.get(e.id)
          const to = sprites.get(e.target)
          // A unit this shot killed has left the battle.
          if (!from || !to) continue
          const a = chest(from)
          const b = chest(to)
          fx.moveTo(a.x, a.y).lineTo(b.x, b.y).stroke({ color: e.crit ? COLOR.crit : e.hit ? COLOR.hit : COLOR.miss, width: 3 })
          shotCallout(e, to)
          if (e.with.length > 0) callout(e.with.map((effect) => effectName(effect).toUpperCase()).join(' · '), 0xffffff, from)
        }
      }
      render()
    },
  }
}

/** Colour `own` darkened by `tint`, channel by channel, as a tint multiplies. */
function mixTint(own: number, tint: number): number {
  const ch = (shift: number) => Math.round((((own >> shift) & 255) * ((tint >> shift) & 255)) / 255) << shift
  return ch(16) | ch(8) | ch(0)
}
