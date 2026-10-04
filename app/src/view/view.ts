import { Application, Graphics } from 'pixi.js'
import { DEPLOY_DEPTH, GRID, UNIT_HP, type State } from '../core/state'
import type { GameEvent } from '../core/step'

export const WIDTH = 1280
export const HEIGHT = 720

const TILE_W = 56
const TILE_H = 28
const ORIGIN_X = WIDTH / 2
const ORIGIN_Y = (HEIGHT - GRID * TILE_H) / 2

const COLOR = { human: 0x4da3ff, alien: 0x7ddc5a, tile: 0x263042, zone: 0x2f4a6b, line: 0x10141c, hit: 0xffd84d, miss: 0x77808f }

/** Screen position of a tile's centre. Fractional tiles are allowed. */
function toScreen(x: number, y: number): { x: number; y: number } {
  return { x: ORIGIN_X + ((x - y) * TILE_W) / 2, y: ORIGIN_Y + ((x + y + 1) * TILE_H) / 2 }
}

/** The tile under a screen point; may lie off the grid. */
export function tileAt(sx: number, sy: number): { x: number; y: number } {
  const a = (sx - ORIGIN_X) / (TILE_W / 2)
  const b = (sy - ORIGIN_Y) / (TILE_H / 2)
  return { x: Math.floor((a + b) / 2), y: Math.floor((b - a) / 2) }
}

export interface View {
  canvas: HTMLCanvasElement
  /** Draws `state` now. `events` are those of the tick that produced it. */
  render(state: State, events: GameEvent[]): void
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
  const units = new Graphics()
  app.stage.addChild(tiles, units)

  return {
    canvas: app.canvas,
    render(state, events) {
      units.clear()
      // Far tiles first, so near units overlap them.
      for (const u of [...state.units].sort((a, b) => a.x + a.y - (b.x + b.y))) {
        const c = toScreen(u.x, u.y)
        units.ellipse(c.x, c.y, 14, 7).fill({ color: 0x000000, alpha: 0.4 })
        units.roundRect(c.x - 9, c.y - 30, 18, 30, 6).fill(COLOR[u.side])
        units.rect(c.x - 12, c.y - 38, 24, 4).fill(0x000000)
        units.rect(c.x - 12, c.y - 38, (24 * u.hp) / UNIT_HP, 4).fill(0xff5555)
      }
      for (const e of events) {
        if (e.type !== 'attack') continue
        const from = state.units.find((u) => u.id === e.id)
        const to = state.units.find((u) => u.id === e.target)
        // A unit killed this tick has left the state.
        if (!from || !to) continue
        const a = toScreen(from.x, from.y)
        const b = toScreen(to.x, to.y)
        units.moveTo(a.x, a.y - 18).lineTo(b.x, b.y - 18).stroke({ color: e.hit ? COLOR.hit : COLOR.miss, width: 3 })
      }
      app.render()
    },
  }
}
