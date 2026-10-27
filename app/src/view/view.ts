import { Application, Container, Graphics, Text, type Ticker } from 'pixi.js'
import { BLAST_RADIUS, distance, GRID, nearestAlien, revealed, ZONE_NAMES, ZONE_RADIUS, type Battle, type Tile, type Unit } from '../core/battle'
import { KEYWORDS } from '../core/keywords'
import { ALIENS, type AlienKind } from '../core/aliens'
import { CLASSES } from '../core/classes'
import { effectName } from '../core/effects'
import type { GameEvent } from '../core/combat'
import { level, type Run } from '../core/run'
import { visibleTiles } from '../core/sight'
import type { Edge, Ground, Prop } from '../core/terrain'
import { weaponOf, type Weapon } from './weapons'

export const WIDTH = 1280
export const HEIGHT = 720

const TILE_W = 56
const TILE_H = 28
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
const POD_DUST_MS = 450
const POD_STAGGER_MS = 160
const POD_HEIGHT = 400
const MS_PER_TILE = 110
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

/** A darker shade of a colour, for a box's sides. */
const shade = (color: number, by: number) => (((color >> 16) * by) << 16) | ((((color >> 8) & 255) * by) << 8) | ((color & 255) * by)

/** The letter over a unit that is no soldier: its kind's initial, C for a commander, nothing for a boss or civilian. */
const letter = (unit: Unit) => (unit.target ? 'C' : unit.summoner !== null ? 'M' : unit.boss || !unit.kind ? '' : ALIENS[unit.kind].name[0])

/** Position of a tile's centre in the world the camera looks at. Fractional tiles are allowed. */
/** Screen pixels a tile rises for each level of height. */
const RISE = 16

/** The height of each tile of the battle shown, row by row. */
let heights: number[] = []
const riseAt = (x: number, y: number) => RISE * (heights[Math.round(y) * GRID + Math.round(x)] ?? 0)

function toWorld(x: number, y: number): Tile {
  return { x: ((x - y) * TILE_W) / 2, y: ((x + y + 1 - GRID) * TILE_H) / 2 - riseAt(x, y) }
}

const lerp = (a: Tile, b: Tile, t: number): Tile => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t })

interface Sprite {
  node: Container
  hp: Graphics
  /** The tile the sprite stands on, which lags the battle while a beat animates. */
  tile: Tile
  maxHp: number
  /** Whether it fights for the squad, so its health shows in the ally colour. */
  ally: boolean
}

/** What the camera shows: a world point at the screen's centre, and a zoom. */
interface Camera {
  x: number
  y: number
  zoom: number
}

const WHOLE_MAP: Camera = { x: 0, y: 0, zoom: FIT }
/** The whole map before the landing, shrunk and raised to clear the landing panel below it. */
const OVERVIEW: Camera = { x: 0, y: 70, zoom: FIT * 0.82 }

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
  /** Glides the camera to frame the given tiles, above the landing panel; null pulls back to the whole map. */
  frame(tiles: Tile[] | null): Promise<void>
}

export async function createView(): Promise<View> {
  const app = new Application()
  await app.init({ width: WIDTH, height: HEIGHT, background: 0x10141c, antialias: true })

  const tiles = new Graphics()
  /** Shown before the landing: the landing zones' tint under the units, and their names and the contact markers over them. */
  const zones = new Graphics()
  const acid = new Graphics()
  const marks = new Container()
  /** Shot callouts. */
  const labels = new Container()
  const units = new Container()
  units.sortableChildren = true
  const fog = new Graphics()
  const lurk = new Container()
  const fx = new Graphics()
  const world = new Container()
  world.addChild(tiles, zones, acid, fog, lurk, units, fx, marks, labels)
  // Nothing shows until a battle exists.
  world.visible = false
  app.stage.addChild(world)

  const sprites = new Map<number, Sprite>()
  /** The squad of the run shown, for each soldier's class. */
  let soldiers: Run['soldiers'] = []
  /** A red glow under each alien the squad hasn't found, by unit id. */
  const glows = new Map<number, { node: Graphics; tile: Tile }>()
  /** Each prop, wall and window on the board, with the tiles that light it: it is lit when a soldier sees any of them. */
  const scenery: { node: Graphics; tiles: number[] }[] = []
  /** The battle on screen. */
  let shown: Battle | null = null
  let camera = WHOLE_MAP
  /** Whether the battle last shown was waiting for the landing, so the next one shown plays it. */
  let deploying = false
  /** The landing zone under the pointer. */
  let hovered: number | null = null
  /** The landing zone the camera is on before the landing. */
  let selected: number | null = null

  const diamond = (g: Graphics, x: number, y: number) => {
    const c = toWorld(x, y)
    return g.poly([c.x, c.y - TILE_H / 2, c.x + TILE_W / 2, c.y, c.x, c.y + TILE_H / 2, c.x - TILE_W / 2, c.y])
  }

  function zoneAt(px: number, py: number): number | null {
    if (shown?.phase !== 'deploy') return null
    // The canvas is scaled to fit the window.
    const sx = (px * WIDTH) / app.canvas.clientWidth
    const sy = (py * HEIGHT) / app.canvas.clientHeight
    const a = (sx - world.x) / world.scale.x / (TILE_W / 2)
    const b = (sy - world.y) / world.scale.y / (TILE_H / 2) + GRID
    const tile = { x: Math.floor((a + b) / 2), y: Math.floor((b - a) / 2) }
    const index = shown.zones.findIndex((zone) => distance(zone, tile) <= ZONE_RADIUS)
    return index < 0 ? null : index
  }

  function look(to: Camera): void {
    camera = to
    world.scale.set(to.zoom)
    world.position.set(WIDTH / 2 - to.x * to.zoom, HEIGHT / 2 - to.y * to.zoom)
  }

  /** The camera that frames the given tiles, zoomed in no closer than life size. */
  function framing(points: Tile[]): Camera {
    const at = points.map((p) => toWorld(p.x, p.y))
    const xs = at.map((p) => p.x)
    const ys = at.map((p) => p.y)
    const width = Math.max(...xs) - Math.min(...xs) + MARGIN
    const height = Math.max(...ys) - Math.min(...ys) + MARGIN
    return {
      x: (Math.max(...xs) + Math.min(...xs)) / 2,
      y: (Math.max(...ys) + Math.min(...ys)) / 2,
      zoom: Math.max(FIT, Math.min(1, WIDTH / width, HEIGHT / height)),
    }
  }

  function place(sprite: Sprite, tile: Tile): void {
    sprite.tile = tile
    sprite.node.position.copyFrom(toWorld(tile.x, tile.y))
    // Far tiles first, so near units overlap them.
    sprite.node.zIndex = tile.x + tile.y
  }

  /**
   * Draws a unit's health and armor as pips, one each, ten to a row, rows stacking upward: health left in green on an
   * ally and red on an enemy, health lost in a dark shade of it, then armor in yellow.
   */
  function drawHp(sprite: Sprite, hp: number, armor: number): void {
    sprite.hp.clear()
    const lost = sprite.maxHp - Math.max(hp, 0)
    const colors = [...Array(Math.max(hp, 0)).fill(sprite.ally ? COLOR.allyHp : COLOR.enemyHp), ...Array(lost).fill(sprite.ally ? COLOR.allyLost : COLOR.enemyLost), ...Array(armor).fill(COLOR.hit)]
    colors.forEach((color, i) => {
      sprite.hp.rect(-PIP_ROW / 2 + (i % 10) * PIP_STEP, -38 - Math.floor(i / 10) * PIP_STEP, PIP, PIP).fill(color)
    })
  }

  /** A unit's health and armor in the battle; none of either once it is gone. */
  const vitals = (battle: Battle, id: number): [number, number] => {
    const unit = battle.units.find((u) => u.id === id)
    return [unit?.hp ?? 0, unit?.armor ?? 0]
  }

  /** `pips` marks a soldier's level above the health pips; `letter` is the initial of its class. */
  function create(unit: Unit, pips: number, letter = ''): Sprite {
    const body = new Graphics().ellipse(0, 0, 14, 7).fill({ color: 0x000000, alpha: 0.4 }).roundRect(-9, -30, 18, 30, 6).fill(unit.boss || unit.target ? COLOR.boss : unit.civilian ? COLOR.civilian : unit.summoner !== null ? COLOR.mech : unit.kind ? ALIEN_LOOK[unit.kind].color : COLOR.human)
    const rows = Math.ceil((unit.stats.hp + unit.stats.armor) / 10)
    for (let i = 0; i < pips; i++) body.circle(-9 + 6 * i, -40 - rows * PIP_STEP, 2).fill(COLOR.human)
    const sprite: Sprite = { node: new Container(), hp: new Graphics(), tile: unit, maxHp: unit.stats.hp, ally: unit.side === 'human' }
    sprite.node.addChild(body, sprite.hp)
    sprite.node.scale.set(unit.boss ? 1.6 : unit.target ? 1.3 : unit.kind ? ALIEN_LOOK[unit.kind].scale : 1)
    if (letter) {
      const mark = new Text({ text: letter, style: { fill: 0x10141c, fontSize: 13, fontWeight: 'bold', fontFamily: 'sans-serif' } })
      mark.anchor.set(0.5)
      mark.position.set(0, -17)
      sprite.node.addChild(mark)
    }
    units.addChild(sprite.node)
    sprites.set(unit.id, sprite)
    place(sprite, { x: unit.x, y: unit.y })
    drawHp(sprite, unit.hp, unit.armor)
    return sprite
  }

  function remove(id: number): void {
    sprites.get(id)?.node.destroy({ children: true })
    sprites.delete(id)
  }

  /** Draws a box, centred on the origin's tile, as its two near sides and its top. */
  function drawBox(g: Graphics, box: Box): void {
    const w = (TILE_W / 4) * box.wide
    const d = (TILE_W / 4) * box.deep
    // The tile's x axis runs down-right on screen and its y axis down-left; each is half as tall as wide.
    const corner = (x: number, y: number, lift: number) => [x * w - y * d, (x * w + y * d) / 2 - lift] as const
    const low = box.base
    const high = box.base + box.up
    const alpha = box.alpha ?? 1
    g.poly([...corner(-1, 1, low), ...corner(1, 1, low), ...corner(1, 1, high), ...corner(-1, 1, high)]).fill({ color: shade(box.color, 0.72), alpha })
    g.poly([...corner(1, -1, low), ...corner(1, 1, low), ...corner(1, 1, high), ...corner(1, -1, high)]).fill({ color: shade(box.color, 0.55), alpha })
    g.poly([...corner(-1, -1, high), ...corner(1, -1, high), ...corner(1, 1, high), ...corner(-1, 1, high)]).fill({ color: box.color, alpha })
  }

  /**
   * Draws the prop on a tile. A prop that continues onto the tile above or below, such as a car parked along y,
   * is turned to lie that way; the two halves of a car share a colour.
   */
  function drawProp(battle: Battle, tile: number): Graphics {
    const prop = battle.props[tile] as Exclude<Prop, 'none'>
    const g = new Graphics()
    if (prop === 'tree') {
      g.rect(-2, -16, 4, 16).fill(0x5b4630).circle(0, -24, 14).fill(0x2f6b3c).circle(-4, -28, 8).fill(0x3d8049)
      return g
    }
    const same = (other: number) => other >= 0 && other < GRID * GRID && battle.props[other] === prop
    const alongX = (tile % GRID > 0 && same(tile - 1)) || (tile % GRID < GRID - 1 && same(tile + 1))
    const alongY = !alongX && (same(tile - GRID) || same(tile + GRID))
    // The first tile of the run the prop lies in.
    const head = alongY ? (same(tile - GRID) ? tile - GRID : tile) : tile % GRID > 0 && same(tile - 1) ? tile - 1 : tile
    for (const box of prop === 'car' ? carBoxes(head) : PROP_BOXES[prop]) drawBox(g, alongY ? { ...box, wide: box.deep, deep: box.wide } : box)
    return g
  }

  /** Draws the battle's ground, props, walls and windows afresh. They change only when a blast wrecks them. */
  function drawTerrain(battle: Battle): void {
    for (const { node } of scenery.splice(0)) node.destroy()
    tiles.clear()
    const stand = (node: Graphics, x: number, y: number, lit: number[]) => {
      node.position.copyFrom(toWorld(x, y))
      node.zIndex = x + y
      units.addChild(node)
      scenery.push({ node, tiles: lit })
    }
    for (let tile = 0; tile < GRID * GRID; tile++) {
      // Off the battlefield there is nothing to draw.
      if (battle.ground[tile] === 'void') continue
      const x = tile % GRID
      const y = Math.floor(tile / GRID)
      // The faces a raised tile shows above its lower neighbours toward the viewer, on +y and +x.
      const c = toWorld(x, y)
      const drop = (nx: number, ny: number) => (onGridTile(nx, ny) ? Math.max(0, battle.height[tile] - battle.height[ny * GRID + nx]) * RISE : 0)
      const left = drop(x, y + 1)
      const right = drop(x + 1, y)
      if (left > 0) tiles.poly([c.x - TILE_W / 2, c.y, c.x, c.y + TILE_H / 2, c.x, c.y + TILE_H / 2 + left, c.x - TILE_W / 2, c.y + left]).fill(shade(GROUND_COLOR[battle.ground[tile]], 0.6))
      if (right > 0) tiles.poly([c.x + TILE_W / 2, c.y, c.x, c.y + TILE_H / 2, c.x, c.y + TILE_H / 2 + right, c.x + TILE_W / 2, c.y + right]).fill(shade(GROUND_COLOR[battle.ground[tile]], 0.45))
      diamond(tiles, x, y).fill(highland(GROUND_COLOR[battle.ground[tile]], battle.height[tile])).stroke({ color: COLOR.line, width: 1, alpha: 0.5 })
      if (battle.props[tile] !== 'none') stand(drawProp(battle, tile), x, y, [tile])
      // A wall stands half a tile toward the neighbour it divides this tile from.
      const north = battle.north[tile]
      const west = battle.west[tile]
      if (north !== 'none') {
        const node = new Graphics()
        for (const box of EDGE_BOXES[north]) drawBox(node, box)
        stand(node, x, y - 0.5, [tile, tile - GRID])
      }
      if (west !== 'none') {
        const node = new Graphics()
        for (const box of EDGE_BOXES[west]) drawBox(node, { ...box, wide: box.deep, deep: box.wide })
        stand(node, x - 0.5, y, [tile, tile - 1])
      }
    }
  }

  /** Clears the board for a new battle. */
  function setBattle(battle: Battle): void {
    shown = battle
    heights = battle.height
    selected = null
    sprites.clear()
    glows.clear()
    lurk.removeChildren().forEach((child) => child.destroy())
    scenery.length = 0
    units.removeChildren().forEach((child) => child.destroy({ children: true }))
    drawTerrain(battle)
  }

  function label(text: string, tile: Tile, color: number, size = 44): Text {
    const mark = new Text({ text, style: { fill: color, fontSize: size, fontWeight: 'bold', fontFamily: 'sans-serif', align: 'center', stroke: { color: 0x10141c, width: 6 } } })
    mark.anchor.set(0.5, size === 44 ? 0.8 : 0)
    mark.position.copyFrom(toWorld(tile.x, tile.y))
    return mark
  }

  /** Before the landing: tints, names and describes each landing zone, and marks where each pod is. */
  function drawMarks(battle: Battle): void {
    zones.clear()
    marks.removeChildren().forEach((child) => child.destroy())
    if (battle.uplink) marks.addChild(label('📡 UPLINK', battle.uplink, COLOR.uplink, 28))
    if (battle.phase !== 'deploy') return
    battle.zones.forEach((zone, i) => {
      for (let y = 0; y < GRID; y++) {
        for (let x = 0; x < GRID; x++) {
          if (distance(zone, { x, y }) <= ZONE_RADIUS) diamond(zones, x, y).fill({ color: i === hovered || i === selected ? COLOR.zoneHover : COLOR.zone, alpha: 0.8 })
        }
      }
      // The selected zone's way in: a line to the uplink, or to the nearest contact.
      const toward = i === selected && (battle.uplink ?? nearestAlien(battle, zone))
      if (toward) {
        const a = toWorld(zone.x, zone.y)
        const b = toWorld(toward.x, toward.y)
        zones.moveTo(a.x, a.y).lineTo(b.x, b.y).stroke({ color: battle.uplink ? COLOR.uplink : COLOR.contact, width: 4, alpha: 0.9 })
      }
      marks.addChild(label(`${ZONE_NAMES[i]} ${i === battle.hot ? '☄️' : KEYWORDS[battle.boons[i]].icon}`, zone, 0xffffff))
    })
    battle.pods.forEach((_, pod) => {
      const members = battle.units.filter((u) => u.pod === pod)
      if (members.length > 0) marks.addChild(label('?', members[0], COLOR.contact), label(battle.pods[pod].name, members[0], COLOR.contact, 20))
    })
  }

  /** Darkens every tile no soldier sees, and whatever stands on it. Before the landing nothing is fogged. */
  function drawFog(battle: Battle, snap = false): void {
    fog.clear()
    const seen = battle.phase === 'deploy' ? null : visibleTiles(battle)
    const tint = (tile: number) => (!seen || seen[tile] ? 0xffffff : COLOR.dim)
    seen?.forEach((lit, i) => {
      if (!lit) diamond(fog, i % GRID, Math.floor(i / GRID)).fill({ color: COLOR.fog, alpha: 0.55 })
    })
    // Mid-beat, a glow stays where its slide left it; the battle already holds where the alien ends up.
    const lurking = seen ? battle.units.filter((u) => u.hp > 0 && !u.civilian && !revealed(battle, u)) : []
    const ids = new Set(lurking.map((u) => u.id))
    for (const [id, glow] of glows) {
      if (ids.has(id)) continue
      glow.node.destroy()
      glows.delete(id)
    }
    for (const unit of lurking) {
      let glow = glows.get(unit.id)
      if (!glow) {
        const node = new Graphics()
        for (const [scale, alpha] of [[1, 0.12], [0.65, 0.14], [0.35, 0.16]]) node.ellipse(0, 0, (TILE_W / 2) * scale, (TILE_H / 2) * scale).fill({ color: COLOR.lurk, alpha })
        lurk.addChild(node)
        glow = { node, tile: unit }
        glows.set(unit.id, glow)
      } else if (!snap) continue
      glow.tile = { x: unit.x, y: unit.y }
      glow.node.position.copyFrom(toWorld(unit.x, unit.y))
    }
    for (const { node, tiles: lit } of scenery) node.tint = !seen || lit.some((tile) => seen[tile]) ? 0xffffff : COLOR.dim
    for (const sprite of sprites.values()) sprite.node.tint = tint(Math.round(sprite.tile.y) * GRID + Math.round(sprite.tile.x))
  }


  /** Tints every tile of acid or fire, marks every tile of caltrops, and rings each unit rooted or charged. */
  function drawAcid(battle: Battle): void {
    acid.clear()
    for (const pool of battle.acid) diamond(acid, pool.x, pool.y).fill({ color: COLOR.acid, alpha: 0.45 })
    for (const pool of battle.fire) diamond(acid, pool.x, pool.y).fill({ color: COLOR.fire, alpha: 0.5 })
    // Caltrops: a scatter of spikes across the tile.
    for (const tile of battle.caltrops) {
      const c = toWorld(tile.x, tile.y)
      for (const [dx, dy] of [[-12, -2], [0, -6], [12, -2], [-6, 4], [6, 4]]) acid.poly([c.x + dx, c.y + dy - 4, c.x + dx + 3, c.y + dy + 1, c.x + dx - 3, c.y + dy + 1]).fill(COLOR.spike)
    }
    for (const unit of battle.units.filter((u) => u.hp > 0 && revealed(battle, u))) {
      if (unit.rooted > 0) diamond(acid, unit.x, unit.y).stroke({ color: COLOR.rooted, width: 3, alpha: 0.9 })
      if (unit.booming > 0) diamond(acid, unit.x, unit.y).stroke({ color: COLOR.booming, width: 2, alpha: 0.9 })
    }
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
      sprite.node.alpha = 1
      drawHp(sprite, unit.hp, unit.armor)
    }
  }

  /** Calls `frame` with progress 0..1 each rendered frame for `ms`. */
  const tween = (ms: number, frame: (t: number) => void) =>
    new Promise<void>((done) => {
      let elapsed = 0
      const tick = (ticker: Ticker) => {
        elapsed += ticker.elapsedMS
        const t = Math.min(elapsed / ms, 1)
        frame(t)
        if (t === 1) {
          app.ticker.remove(tick)
          done()
        }
      }
      app.ticker.add(tick)
    })

  /** Glides the camera to frame the given tiles, or to the given camera, over `ms`. */
  function follow(points: Tile[] | Camera, ms = CAMERA_MS, from = camera): Promise<void> {
    const to = Array.isArray(points) ? framing(points) : points
    return tween(ms, (t) => {
      const ease = t * (2 - t)
      look({ x: from.x + (to.x - from.x) * ease, y: from.y + (to.y - from.y) * ease, zoom: from.zoom + (to.zoom - from.zoom) * ease })
    })
  }

  const chest = (sprite: Sprite): Tile => ({ x: sprite.node.x, y: sprite.node.y - CHEST })

  /** Words over a unit saying what just happened to it. */
  function callout(text: string, color: number, over: Sprite, size = 13): Text {
    const mark = new Text({ text, style: { fill: color, fontSize: size, fontWeight: 'bold', fontFamily: 'sans-serif', stroke: { color: 0x10141c, width: 3 } } })
    mark.anchor.set(0.5, 1)
    mark.position.set(over.node.x, over.node.y - 48)
    labels.addChild(mark)
    return mark
  }

  /** A shot's result: a miss, or a hit or crit with its damage. */
  function shotCallout(e: Extract<GameEvent, { type: 'shot' }>, over: Sprite): Text {
    if (!e.hit) return callout('MISS', COLOR.miss, over)
    return e.crit ? callout(`CRIT -${e.damage}`, COLOR.crit, over, 18) : callout(`HIT -${e.damage}`, COLOR.hit, over)
  }

  /** Floats a callout up and away. It does not hold up the next beat. */
  function float(mark: Text): void {
    const from = mark.y
    void tween(CALLOUT_MS, (t) => {
      mark.y = from - 34 * t
      mark.alpha = Math.min(1, 3 * (1 - t))
    }).then(() => mark.destroy())
  }

  function walk(sprite: Sprite, path: Tile[]): Promise<void> {
    const points = [sprite.tile, ...path]
    return tween(MS_PER_TILE * path.length, (t) => {
      const along = t * path.length
      const i = Math.min(Math.floor(along), path.length - 1)
      place(sprite, lerp(points[i], points[i + 1], along - i))
    })
  }

  /** Slides an unfound alien's glow along its path through the fog. */
  function glide(glow: { node: Graphics; tile: Tile }, path: Tile[]): Promise<void> {
    const points = [glow.tile, ...path]
    glow.tile = path.at(-1)!
    return tween(MS_PER_TILE * path.length, (t) => {
      const along = t * path.length
      const i = Math.min(Math.floor(along), path.length - 1)
      const at = lerp(points[i], points[i + 1], along - i)
      glow.node.position.copyFrom(toWorld(at.x, at.y))
    })
  }

  /** Jolts the camera, fading out over `ms`. */
  function shake(power: number, ms = 240): Promise<void> {
    if (power === 0) return Promise.resolve()
    const at = camera
    return tween(ms, (t) => {
      look(at)
      world.position.x += (Math.random() * 2 - 1) * power * (1 - t)
      world.position.y += (Math.random() * 2 - 1) * power * (1 - t)
    }).then(() => look(at))
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
    const dx = to.node.x - home.x
    const dy = to.node.y - home.y
    const len = Math.hypot(dx, dy) || 1
    const reach = Math.min(len * 0.55, 40)
    const nudge = (d: number) => from.node.position.set(home.x + (dx / len) * d, home.y + (dy / len) * d)
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
    const aim = hit ? chest(to) : { x: to.node.x + 10, y: to.node.y - CHEST - 26 }
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
    drawHp(to, ...after)
    const power = crit ? 2 : 1
    const home = toWorld(to.tile.x, to.tile.y)
    const scale = to.node.scale.x
    to.node.scale.set(scale * 1.2, scale * 0.8)
    await tween(gun.hitstop * power, () => {
      fx.clear().circle(aim.x, aim.y, 10 * power).fill({ color: 0xffffff, alpha: 0.9 })
    })
    void shake(gun.shake * power)
    const kick = gun.kick * power
    void tween(IMPACT_MS * 1.6, (t) => {
      const push = kick * Math.sin(Math.PI * Math.min(1, t * 1.4)) * (1 - t)
      to.node.position.set(home.x + dir.x * push, home.y + dir.y * push)
      to.node.scale.set(scale * (1.2 - 0.2 * t), scale * (0.8 + 0.2 * t))
    })
    await burst(aim, dir, crit ? COLOR.crit : gun.color, gun.sparks * power, power)
    to.node.position.copyFrom(home)
    to.node.scale.set(scale)
    fx.clear()
  }

  /** What a gear effect did to a unit, in a word: the effect's name, and the health it gave or took. */
  function effectCallout(e: Extract<GameEvent, { type: 'effect' }>, over: Sprite): Text {
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
      drawHp(sprite, ...vitals(battle, hit.target))
      float(callout(`ROCKET -${hit.damage}`, COLOR.crit, sprite))
    }
    await tween(BLAST_MS, (t) => {
      fx.clear().ellipse(b.x, b.y, (BLAST_RADIUS + 0.7) * TILE_W * t, (BLAST_RADIUS + 0.7) * TILE_H * t).fill({ color: COLOR.crit, alpha: 0.8 * (1 - t) })
    })
    fx.clear()
  }

  /**
   * The landing: the camera frames the zone, and each soldier's drop pod streaks down one after another on a trail of
   * fire, slams in with a burst of dust, and opens on the soldier. A hot drop shakes the ground harder.
   */
  async function dropPods(battle: Battle): Promise<void> {
    const soldiers = battle.units.filter((u) => u.side === 'human' && !u.civilian)
    const hot = battle.breach
    if (soldiers.length === 0) return
    for (const unit of soldiers) sprites.get(unit.id)!.node.alpha = 0
    await follow(soldiers.map((u) => ({ x: u.x, y: u.y })))
    await Promise.all(
      soldiers.map(async (unit, i) => {
        const sprite = sprites.get(unit.id)!
        const ground = { x: sprite.node.x, y: sprite.node.y }
        const pod = new Graphics()
        world.addChildAt(pod, world.getChildIndex(fx))
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
        sprite.node.alpha = 1
        await tween(POD_DUST_MS, (t) => {
          pod.clear()
          pod.ellipse(ground.x, ground.y, 14 + (hot ? 70 : 40) * t, 7 + (hot ? 35 : 20) * t).fill({ color: hot ? COLOR.crit : 0xb8a888, alpha: 0.7 * (1 - t) })
          pod.roundRect(ground.x - 14, ground.y - 44 + 44 * t, 28, 44 * (1 - t), 12).fill({ color: 0xc9d3e3, alpha: 1 - t })
          if (hot) world.position.x += Math.sin(t * 60) * 3 * (1 - t)
        })
        pod.destroy()
      }),
    )
    look(camera)
  }

  /** Plays a beat in order. Moves in a row play together; moves by unseen aliens are skipped. */
  async function play(battle: Battle, events: GameEvent[]): Promise<void> {
    for (let i = 0; i < events.length; i++) {
      const e = events[i]
      if (e.type === 'move') {
        const moves = []
        for (; events[i]?.type === 'move'; i++) moves.push(events[i] as Extract<GameEvent, { type: 'move' }>)
        i--
        const seen = moves.filter((m) => sprites.has(m.id))
        const glides = moves.filter((m) => glows.has(m.id)).map((m) => glide(glows.get(m.id)!, m.path))
        if (seen.length === 0) {
          await Promise.all(glides)
          continue
        }
        await follow(seen.flatMap((m) => [sprites.get(m.id)!.tile, m.path.at(-1)!]))
        for (const m of seen) if (m.with) float(callout(effectName(m.with).toUpperCase(), 0xffffff, sprites.get(m.id)!))
        await Promise.all([...glides, ...seen.map((m) => walk(sprites.get(m.id)!, m.path))])
        // The fog lifts where the squad arrived, before any pod it uncovered appears.
        drawFog(battle)
      } else if (e.type === 'reveal' || e.type === 'wave') {
        await follow(e.units)
        const appeared = e.units.flatMap((at) => {
          const unit = battle.units.find((u) => u.id === at.id)
          return unit ? [create({ ...unit, x: at.x, y: at.y }, 0, letter(unit))] : []
        })
        await tween(REVEAL_MS, (t) => appeared.forEach((sprite) => (sprite.node.alpha = t)))
        if (e.type === 'reveal' && e.ambush && appeared.length > 0) float(callout('SURPRISED', COLOR.hit, appeared[0], 18))
        if (e.type === 'reveal' && e.stalked && appeared.length > 0) float(callout('AMBUSH!', COLOR.crit, appeared[0], 18))
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
          drawHp(to, ...vitals(battle, e.target))
          drawAcid(battle)
          float(callout(`ACID -${e.damage}`, COLOR.acid, to))
        } else float(callout('PANICKED', COLOR.psi, to))
      } else if (e.type === 'frozen' || e.type === 'hurt') {
        const on = sprites.get(e.id)
        if (!on) continue
        await follow([on.tile])
        if (e.type === 'hurt') drawHp(on, ...vitals(battle, e.id))
        float(e.type === 'frozen' ? callout(battle.units.find((u) => u.id === e.id)?.side === 'alien' ? 'STUNNED' : 'TOO SHAKEN TO ACT', COLOR.psi, on) : callout(`${e.cause.toUpperCase()} -${e.amount}`, e.cause === 'acid' ? COLOR.acid : e.cause === 'impact' ? COLOR.crit : COLOR.psi, on))
      } else if (e.type === 'spawn') {
        const unit = battle.units.find((u) => u.id === e.unit.id)
        if (!unit || !revealed(battle, unit)) continue
        await follow([e.unit])
        const born = create({ ...unit, x: e.unit.x, y: e.unit.y }, 0, letter(unit))
        await tween(REVEAL_MS, (t) => (born.node.alpha = t))
      } else if (e.type === 'effect') {
        const on = sprites.get(e.id)
        if (!on) continue
        drawHp(on, ...vitals(battle, e.id))
        // A demolishing hit has already wrecked the cover in the battle; show it as the hit lands.
        if (e.effect === 'demolish') drawTerrain(battle)
        float(effectCallout(e, on))
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
        drawHp(to, ...vitals(battle, e.target))
        float(callout(`HEAL +${e.amount}`, COLOR.heal, to))
      } else if (e.type === 'death') {
        const sprite = sprites.get(e.id)
        if (!sprite) continue
        await tween(DEATH_MS, (t) => (sprite.node.alpha = 1 - t))
        remove(e.id)
      }
    }
  }

  app.canvas.addEventListener('pointermove', (e) => {
    const zone = zoneAt(e.offsetX, e.offsetY)
    app.canvas.style.cursor = zone === null ? 'default' : 'pointer'
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

  return {
    canvas: app.canvas,
    zoneAt,
    frame(tiles) {
      const framed = tiles === null ? OVERVIEW : framing(tiles)
      return follow({ ...framed, y: framed.y + (tiles === null ? 0 : PANEL / framed.zoom) }, FOCUS_MS)
    },
    focus(zone) {
      if (shown?.phase !== 'deploy') return
      selected = zone
      drawMarks(shown)
      const framed = zone === null ? OVERVIEW : framing(zoneView(shown, shown.zones[zone]))
      // Raised, so the landing panel below covers none of it.
      void follow({ ...framed, y: framed.y + (zone === null ? 0 : PANEL / framed.zoom) }, FOCUS_MS)
    },
    async show(run, events, animate) {
      soldiers = run.soldiers
      fx.clear()
      const battle = run.battle
      if (!battle) return
      world.visible = true
      const fresh = battle !== shown
      if (fresh) setBattle(battle)
      drawMarks(battle)
      // A new battle opens flying in from high above, down to the whole map.
      if (fresh && battle.phase === 'deploy') void follow(OVERVIEW, FLY_MS, { x: 0, y: -HEIGHT, zoom: FIT / 4 })
      if (animate) await play(battle, events)
      sync(run, battle)
      if (events.some((e) => e.type === 'rocket' || (e.type === 'effect' && e.effect === 'demolish'))) drawTerrain(battle)
      drawFog(battle, true)
      const landed = deploying && battle.phase !== 'deploy'
      deploying = battle.phase === 'deploy'
      if (landed && animate) await dropPods(battle)
      if (!animate) {
        if (battle.phase !== 'deploy') look(WHOLE_MAP)
        labels.removeChildren().forEach((child) => child.destroy())
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
      app.render()
    },
  }
}
