import { Application, Container, Graphics, type Ticker } from 'pixi.js'
import { coverAt, DEPLOY_DEPTH, GRID, type Battle, type Tile, type Unit } from '../core/battle'
import type { GameEvent } from '../core/combat'
import { rank, type Run } from '../core/run'

export const WIDTH = 1280
export const HEIGHT = 720

const TILE_W = 56
const TILE_H = 28
const ORIGIN_X = WIDTH / 2
const ORIGIN_Y = (HEIGHT - GRID * TILE_H) / 2
/** Height above the ground that shots leave and land. */
const CHEST = 18

const MS_PER_TILE = 110
const SHOT_MS = 160
const IMPACT_MS = 140
const DEATH_MS = 260

/** Screen height of a cover block, indexed by Cover. */
const COVER_HEIGHT = [0, 14, 34]

const COLOR = {
  human: 0x4da3ff,
  alien: 0x7ddc5a,
  tile: 0x263042,
  zone: 0x2f4a6b,
  line: 0x10141c,
  hit: 0xffd84d,
  crit: 0xff7a3d,
  miss: 0x77808f,
  coverTop: 0x8a93a6,
  coverLeft: 0x5d6577,
  coverRight: 0x454c5c,
}

/** Screen position of a tile's centre. Fractional tiles are allowed. */
function toScreen(x: number, y: number): Tile {
  return { x: ORIGIN_X + ((x - y) * TILE_W) / 2, y: ORIGIN_Y + ((x + y + 1) * TILE_H) / 2 }
}

/** The tile under a screen point; may lie off the grid. */
export function tileAt(sx: number, sy: number): Tile {
  const a = (sx - ORIGIN_X) / (TILE_W / 2)
  const b = (sy - ORIGIN_Y) / (TILE_H / 2)
  return { x: Math.floor((a + b) / 2), y: Math.floor((b - a) / 2) }
}

const lerp = (a: Tile, b: Tile, t: number): Tile => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t })

interface Sprite {
  node: Container
  hp: Graphics
  /** The tile the sprite stands on, which lags the battle while a beat animates. */
  tile: Tile
  maxHp: number
}

export interface View {
  canvas: HTMLCanvasElement
  /**
   * Shows the run's battle, which `events` produced. Animated, it plays the events and resolves when they finish.
   * Still, it draws the battle at once and marks each shot with a line.
   */
  show(run: Run, events: GameEvent[], animate: boolean): Promise<void>
}

export async function createView(): Promise<View> {
  const app = new Application()
  await app.init({ width: WIDTH, height: HEIGHT, background: 0x10141c, antialias: true })

  const tiles = new Graphics()
  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) {
      const c = toScreen(x, y)
      tiles
        .poly([c.x, c.y - TILE_H / 2, c.x + TILE_W / 2, c.y, c.x, c.y + TILE_H / 2, c.x - TILE_W / 2, c.y])
        .fill(y >= GRID - DEPLOY_DEPTH ? COLOR.zone : COLOR.tile)
        .stroke({ color: COLOR.line, width: 1 })
    }
  }
  const units = new Container()
  units.sortableChildren = true
  const fx = new Graphics()
  app.stage.addChild(tiles, units, fx)

  const sprites = new Map<number, Sprite>()
  /** The battle on screen. */
  let shown: Battle | null = null

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
        block.position.copyFrom(toScreen(x, y))
        block.zIndex = x + y
        units.addChild(block)
      }
    }
  }

  function place(sprite: Sprite, tile: Tile): void {
    sprite.tile = tile
    sprite.node.position.copyFrom(toScreen(tile.x, tile.y))
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
    return sprite
  }

  function remove(id: number): void {
    sprites.get(id)?.node.destroy({ children: true })
    sprites.delete(id)
  }

  /** Makes the sprites match the battle exactly. */
  function sync(run: Run, battle: Battle): void {
    const live = new Set(battle.units.map((u) => u.id))
    for (const id of [...sprites.keys()]) if (!live.has(id)) remove(id)
    for (const unit of battle.units) {
      const soldier = run.soldiers.find((s) => s.id === unit.soldier)
      const sprite = sprites.get(unit.id) ?? create(unit, soldier ? rank(soldier) : 0)
      place(sprite, { x: unit.x, y: unit.y })
      drawHp(sprite, unit.hp)
    }
  }

  /** Calls `frame` with progress 0..1 each rendered frame for `ms`. */
  const tween = (ms: number, frame: (t: number) => void) =>
    new Promise<void>((done) => {
      let elapsed = 0
      const tick = (ticker: Ticker) => {
        elapsed += ticker.deltaMS
        const t = Math.min(elapsed / ms, 1)
        frame(t)
        if (t === 1) {
          app.ticker.remove(tick)
          done()
        }
      }
      app.ticker.add(tick)
    })

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

  /** Plays a beat: its moves all at once, or its shot and then its death. */
  async function play(battle: Battle, events: GameEvent[]): Promise<void> {
    const walks: Promise<void>[] = []
    for (const e of events) {
      const sprite = e.type === 'end' ? undefined : sprites.get(e.id)
      if (!sprite) continue
      if (e.type === 'move') walks.push(walk(sprite, e.path))
      if (e.type === 'shot') {
        const target = sprites.get(e.target)
        if (target) await shoot(sprite, target, e.hit, e.crit, battle.units.find((u) => u.id === e.target)?.hp ?? 0)
      }
      if (e.type === 'death') {
        await tween(DEATH_MS, (t) => (sprite.node.alpha = 1 - t))
        remove(e.id)
      }
    }
    await Promise.all(walks)
  }

  return {
    canvas: app.canvas,
    async show(run, events, animate) {
      fx.clear()
      const battle = run.battle
      if (!battle) return
      if (battle !== shown) setBattle(battle)
      if (animate) await play(battle, events)
      sync(run, battle)
      if (!animate) {
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
