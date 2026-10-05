import { Application, Container, Graphics, Text, type Ticker } from 'pixi.js'
import { coverAt, distance, GRID, revealed, ZONE_RADIUS, zoneInfo, type Battle, type Tile, type Unit } from '../core/battle'
import type { GameEvent } from '../core/combat'
import { rank, type Run } from '../core/run'
import { visibleTiles } from '../core/sight'

export const WIDTH = 1280
export const HEIGHT = 720

const TILE_W = 56
const TILE_H = 28
/** Height above the ground that shots leave and land. */
const CHEST = 18
/** Screen height of a cover block, indexed by Cover. */
const COVER_HEIGHT = [0, 14, 34]
/** Zoom that shows the whole map. */
const FIT = Math.min(WIDTH / (GRID * TILE_W), HEIGHT / (GRID * TILE_H + 80))
/** Screen pixels kept clear around what the camera frames. */
const MARGIN = 220

const CAMERA_MS = 350
const MS_PER_TILE = 110
const REVEAL_MS = 450
const SHOT_MS = 160
const IMPACT_MS = 140
const DEATH_MS = 260

const COLOR = {
  human: 0x4da3ff,
  alien: 0x7ddc5a,
  tile: 0x263042,
  zone: 0x2f6fb0,
  zoneHover: 0x4d9be6,
  fog: 0x05070b,
  line: 0x10141c,
  hit: 0xffd84d,
  crit: 0xff7a3d,
  miss: 0x77808f,
  contact: 0xff6b5e,
  coverTop: 0x8a93a6,
  coverLeft: 0x5d6577,
  coverRight: 0x454c5c,
}

/** Names of the landing zones, in battle.zones order. */
const ZONE_NAMES = ['A', 'B', 'C']

/** Position of a tile's centre in the world the camera looks at. Fractional tiles are allowed. */
function toWorld(x: number, y: number): Tile {
  return { x: ((x - y) * TILE_W) / 2, y: ((x + y + 1 - GRID) * TILE_H) / 2 }
}

const lerp = (a: Tile, b: Tile, t: number): Tile => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t })

interface Sprite {
  node: Container
  hp: Graphics
  /** The tile the sprite stands on, which lags the battle while a beat animates. */
  tile: Tile
  maxHp: number
}

/** What the camera shows: a world point at the screen's centre, and a zoom. */
interface Camera {
  x: number
  y: number
  zoom: number
}

const WHOLE_MAP: Camera = { x: 0, y: 0, zoom: FIT }

export interface View {
  canvas: HTMLCanvasElement
  /**
   * Shows the run's battle, which `events` produced. Animated, it follows the action with the camera, plays the
   * events, and resolves when they finish. Still, it draws the whole map at once and marks each shot with a line.
   * Aliens in unrevealed pods are never drawn; before the landing, each pod shows as a contact marker.
   * Once landed, fog darkens every tile no soldier sees.
   */
  show(run: Run, events: GameEvent[], animate: boolean): Promise<void>
  /** The landing zone under a screen point, as an index into battle.zones; null when there is none to choose. */
  zoneAt(sx: number, sy: number): number | null
}

export async function createView(): Promise<View> {
  const app = new Application()
  await app.init({ width: WIDTH, height: HEIGHT, background: 0x10141c, antialias: true })

  const tiles = new Graphics()
  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) {
      const c = toWorld(x, y)
      tiles
        .poly([c.x, c.y - TILE_H / 2, c.x + TILE_W / 2, c.y, c.x, c.y + TILE_H / 2, c.x - TILE_W / 2, c.y])
        .fill(COLOR.tile)
        .stroke({ color: COLOR.line, width: 1 })
    }
  }
  /** Shown before the landing: the landing zones' tint under the units, and their names and the contact markers over them. */
  const zones = new Graphics()
  const labels = new Container()
  const units = new Container()
  units.sortableChildren = true
  const fog = new Graphics()
  const fx = new Graphics()
  const world = new Container()
  world.addChild(tiles, zones, units, fog, fx, labels)
  app.stage.addChild(world)

  const sprites = new Map<number, Sprite>()
  /** The battle on screen. */
  let shown: Battle | null = null
  let camera = WHOLE_MAP
  /** The landing zone under the pointer. */
  let hovered: number | null = null

  const diamond = (g: Graphics, x: number, y: number) => {
    const c = toWorld(x, y)
    return g.poly([c.x, c.y - TILE_H / 2, c.x + TILE_W / 2, c.y, c.x, c.y + TILE_H / 2, c.x - TILE_W / 2, c.y])
  }

  function zoneAt(sx: number, sy: number): number | null {
    if (shown?.phase !== 'deploy') return null
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

  function drawHp(sprite: Sprite, hp: number): void {
    sprite.hp.clear().rect(-12, -38, 24, 4).fill(0x000000)
    if (hp > 0) sprite.hp.rect(-12, -38, (24 * hp) / sprite.maxHp, 4).fill(0xff5555)
  }

  /** `pips` marks a soldier's rank above the health bar. */
  function create(unit: Unit, pips: number): Sprite {
    const body = new Graphics().ellipse(0, 0, 14, 7).fill({ color: 0x000000, alpha: 0.4 }).roundRect(-9, -30, 18, 30, 6).fill(COLOR[unit.side])
    for (let i = 0; i < pips; i++) body.circle(-9 + 6 * i, -44, 2).fill(COLOR.hit)
    const sprite: Sprite = { node: new Container(), hp: new Graphics(), tile: unit, maxHp: unit.stats.hp }
    sprite.node.addChild(body, sprite.hp)
    units.addChild(sprite.node)
    sprites.set(unit.id, sprite)
    place(sprite, { x: unit.x, y: unit.y })
    drawHp(sprite, unit.hp)
    return sprite
  }

  function remove(id: number): void {
    sprites.get(id)?.node.destroy({ children: true })
    sprites.delete(id)
  }

  /** Clears the board and draws the battle's cover blocks, which never change. */
  function setBattle(battle: Battle): void {
    shown = battle
    sprites.clear()
    units.removeChildren().forEach((child) => child.destroy({ children: true }))
    const w = TILE_W / 2
    const h = TILE_H / 2
    for (let y = 0; y < GRID; y++) {
      for (let x = 0; x < GRID; x++) {
        const up = COVER_HEIGHT[coverAt(battle, x, y)]
        if (up === 0) continue
        const block = new Graphics()
          .poly([-w, 0, 0, h, 0, h - up, -w, -up])
          .fill(COLOR.coverLeft)
          .poly([w, 0, 0, h, 0, h - up, w, -up])
          .fill(COLOR.coverRight)
          .poly([0, -h - up, w, -up, 0, h - up, -w, -up])
          .fill(COLOR.coverTop)
        block.position.copyFrom(toWorld(x, y))
        block.zIndex = x + y
        units.addChild(block)
      }
    }
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
    labels.removeChildren().forEach((child) => child.destroy())
    if (battle.phase !== 'deploy') return
    battle.zones.forEach((zone, i) => {
      for (let y = 0; y < GRID; y++) {
        for (let x = 0; x < GRID; x++) {
          if (distance(zone, { x, y }) <= ZONE_RADIUS) diamond(zones, x, y).fill({ color: i === hovered ? COLOR.zoneHover : COLOR.zone, alpha: 0.8 })
        }
      }
      const { cover, contact } = zoneInfo(battle, zone)
      const ground = cover >= 12 ? 'heavy cover' : cover >= 5 ? 'some cover' : 'open ground'
      labels.addChild(label(ZONE_NAMES[i], zone, 0xffffff), label(`${ground}\ncontact ${contact} tiles`, zone, 0xffffff, 20))
    })
    battle.pods.forEach((_, pod) => {
      const members = battle.units.filter((u) => u.pod === pod)
      if (members.length > 0) labels.addChild(label('?', members[0], COLOR.contact))
    })
  }

  /** Darkens every tile no soldier sees. Before the landing nothing is fogged. */
  function drawFog(battle: Battle): void {
    fog.clear()
    if (battle.phase === 'deploy') return
    visibleTiles(battle).forEach((seen, i) => {
      if (!seen) diamond(fog, i % GRID, Math.floor(i / GRID)).fill({ color: COLOR.fog, alpha: 0.55 })
    })
  }

  const pips = (run: Run, unit: Unit) => {
    const soldier = run.soldiers.find((s) => s.id === unit.soldier)
    return soldier ? rank(soldier) : 0
  }

  /** Makes the sprites match the battle exactly. */
  function sync(run: Run, battle: Battle): void {
    const visible = battle.units.filter((u) => revealed(battle, u))
    const live = new Set(visible.map((u) => u.id))
    for (const id of [...sprites.keys()]) if (!live.has(id)) remove(id)
    for (const unit of visible) {
      const sprite = sprites.get(unit.id) ?? create(unit, pips(run, unit))
      place(sprite, { x: unit.x, y: unit.y })
      sprite.node.alpha = 1
      drawHp(sprite, unit.hp)
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

  /** Glides the camera to frame the given tiles. */
  function follow(points: Tile[]): Promise<void> {
    const from = camera
    const to = framing(points)
    return tween(CAMERA_MS, (t) => {
      const ease = t * (2 - t)
      look({ x: from.x + (to.x - from.x) * ease, y: from.y + (to.y - from.y) * ease, zoom: from.zoom + (to.zoom - from.zoom) * ease })
    })
  }

  const chest = (sprite: Sprite): Tile => ({ x: sprite.node.x, y: sprite.node.y - CHEST })

  function walk(sprite: Sprite, path: Tile[]): Promise<void> {
    const points = [sprite.tile, ...path]
    return tween(MS_PER_TILE * path.length, (t) => {
      const along = t * path.length
      const i = Math.min(Math.floor(along), path.length - 1)
      place(sprite, lerp(points[i], points[i + 1], along - i))
    })
  }

  async function shoot(from: Sprite, to: Sprite, hit: boolean, crit: boolean, hpAfter: number): Promise<void> {
    const a = chest(from)
    // A miss flies past above the target.
    const b = hit ? chest(to) : { x: to.node.x + 10, y: to.node.y - CHEST - 26 }
    await tween(SHOT_MS, (t) => {
      const head = lerp(a, b, t)
      const tail = lerp(a, b, Math.max(0, t - 0.35))
      fx.clear().moveTo(tail.x, tail.y).lineTo(head.x, head.y).stroke({ color: hit ? COLOR.hit : COLOR.miss, width: 3 })
    })
    fx.clear()
    if (!hit) return
    drawHp(to, hpAfter)
    await tween(IMPACT_MS, (t) => {
      fx.clear().circle(b.x, b.y, 4 + (crit ? 26 : 12) * t).fill({ color: crit ? COLOR.crit : COLOR.hit, alpha: 1 - t })
    })
    fx.clear()
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
        if (seen.length === 0) continue
        await follow(seen.flatMap((m) => [sprites.get(m.id)!.tile, m.path.at(-1)!]))
        await Promise.all(seen.map((m) => walk(sprites.get(m.id)!, m.path)))
        // The fog lifts where the squad arrived, before any pod it uncovered appears.
        drawFog(battle)
      } else if (e.type === 'reveal') {
        await follow(e.units)
        const appeared = e.units.flatMap((at) => {
          const unit = battle.units.find((u) => u.id === at.id)
          return unit ? [create({ ...unit, x: at.x, y: at.y }, 0)] : []
        })
        await tween(REVEAL_MS, (t) => appeared.forEach((sprite) => (sprite.node.alpha = t)))
      } else if (e.type === 'shot') {
        const from = sprites.get(e.id)
        const to = sprites.get(e.target)
        if (!from || !to) continue
        await follow([from.tile, to.tile])
        await shoot(from, to, e.hit, e.crit, battle.units.find((u) => u.id === e.target)?.hp ?? 0)
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

  return {
    canvas: app.canvas,
    zoneAt,
    async show(run, events, animate) {
      fx.clear()
      const battle = run.battle
      if (!battle) return
      if (battle !== shown) setBattle(battle)
      drawMarks(battle)
      if (animate) await play(battle, events)
      sync(run, battle)
      drawFog(battle)
      if (!animate) {
        look(WHOLE_MAP)
        for (const e of events) {
          if (e.type !== 'shot') continue
          const from = sprites.get(e.id)
          const to = sprites.get(e.target)
          // A unit this shot killed has left the battle.
          if (!from || !to) continue
          const a = chest(from)
          const b = chest(to)
          fx.moveTo(a.x, a.y).lineTo(b.x, b.y).stroke({ color: e.crit ? COLOR.crit : e.hit ? COLOR.hit : COLOR.miss, width: 3 })
        }
      }
      app.render()
    },
  }
}
