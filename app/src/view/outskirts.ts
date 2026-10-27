import { Graphics } from 'pixi.js'
import { GRID, type Battle } from '../core/battle'
import type { TerrainKind } from '../core/terrain'

/** Tiles of scenery drawn beyond the battlefield's far edges. */
const REACH = 9
/** How far, in screen pixels, a cliff falls before it fades into the depths. */
const FALL = 230

/** What frames a kind of place: the colours of its far scenery and of the ground its edges fall away from. */
const LOOK: Record<TerrainKind, { blocks: number[]; rock: number; glow: number; style: 'towns' | 'towers' | 'works' | 'shells' | 'woods' | 'rampart' | 'spires' }> = {
  town: { blocks: [0x4a3f3a, 0x3d4450, 0x50463b, 0x3a3d48], rock: 0x3a332d, glow: 0xffc96b, style: 'towns' },
  city: { blocks: [0x26324a, 0x2c3a4f, 0x1f2a3d, 0x34405a], rock: 0x34363c, glow: 0x8fd3ff, style: 'towers' },
  industrial: { blocks: [0x4b4a45, 0x3e3f3c, 0x55504a], rock: 0x3b3833, glow: 0xff9a3d, style: 'works' },
  ruins: { blocks: [0x3f3a36, 0x4a443e, 0x35322f], rock: 0x332e2a, glow: 0xff6a1f, style: 'shells' },
  countryside: { blocks: [0x1f3a26, 0x24442c, 0x1a3020], rock: 0x3d3428, glow: 0xffe08a, style: 'woods' },
  compound: { blocks: [0x5a5f66, 0x4d525a], rock: 0x3a3d42, glow: 0xfff2c0, style: 'rampart' },
  hive: { blocks: [0x3a1f4f, 0x4b2766, 0x2c1640], rock: 0x2a1838, glow: 0xd36bff, style: 'spires' },
}

/** Draws the world past the battlefield: on its far edges the place carries on, tall and lit; its near edges and any void fall away in cliffs. */
export function drawOutskirts(g: Graphics, battle: Battle, tileW: number, tileH: number, rise: number): void {
  g.clear()
  const look = LOOK[battle.place]
  // Scenery is drawn from the ground's own layout, so it stays put when the battle redraws.
  let seed = battle.ground.reduce((h, ground, i) => (h * 31 + ground.length * (i + 7)) | 0, 17)
  const rand = () => ((seed = (seed * 1103515245 + 12345) | 0) >>> 8) / 16777216
  const at = (x: number, y: number) => ({ x: ((x - y) * tileW) / 2, y: ((x + y + 1 - GRID) * tileH) / 2 })
  const gone = (x: number, y: number) => x < 0 || y < 0 || x >= GRID || y >= GRID || battle.ground[y * GRID + x] === 'void'

  // A haze far beneath the map, and the lights of the land far below.
  for (let i = 0; i < 60; i++) {
    const p = at(rand() * GRID * 1.6 - GRID * 0.3, rand() * GRID * 1.6 - GRID * 0.3)
    g.circle(p.x, p.y + FALL * (0.8 + rand()), 1 + rand() * 1.5).fill({ color: look.glow, alpha: 0.15 + rand() * 0.25 })
  }

  /** A block on tiles x0..x1, y0..y1 (tile edges), standing `up` pixels, its two near faces shaded. */
  /** `sunk` pixels lowers it onto the land below a cliff. */
  const block = (x0: number, y0: number, x1: number, y1: number, up: number, color: number, sunk = 0) => {
    const p = (x: number, y: number, lift: number) => {
      const c = at(x, y)
      return [c.x, c.y - lift + sunk]
    }
    g.poly([...p(x0, y1, 0), ...p(x1, y1, 0), ...p(x1, y1, up), ...p(x0, y1, up)]).fill(shade(color, 0.7))
    g.poly([...p(x1, y0, 0), ...p(x1, y1, 0), ...p(x1, y1, up), ...p(x1, y0, up)]).fill(shade(color, 0.5))
    g.poly([...p(x0, y0, up), ...p(x1, y0, up), ...p(x1, y1, up), ...p(x0, y1, up)]).fill(color)
    return { left: (u: number, v: number) => p(x0 + (x1 - x0) * u, y1, up * v), right: (u: number, v: number) => p(x1, y0 + (y1 - y0) * u, up * v) }
  }
  /** Lit windows scattered over a block's near faces. */
  const windows = (face: ReturnType<typeof block>, share: number) => {
    for (let i = 0; i < 14; i++) {
      if (rand() > share) continue
      const [wx, wy] = (rand() < 0.5 ? face.left : face.right)(0.1 + rand() * 0.8, 0.1 + rand() * 0.8)
      g.rect(wx - 1.5, wy - 2, 3, 4).fill({ color: look.glow, alpha: 0.5 + rand() * 0.5 })
    }
  }
  /** A fire on a rooftop, and its smoke rising. */
  const blaze = (x: number, y: number, lift: number) => {
    const c = at(x, y)
    g.circle(c.x, c.y - lift, 10).fill({ color: 0xff6a1f, alpha: 0.35 }).circle(c.x, c.y - lift, 5).fill({ color: 0xffd84d, alpha: 0.7 })
    for (let k = 1; k < 8; k++) g.circle(c.x + k * 4 + rand() * 6, c.y - lift - k * 16, 6 + k * 3).fill({ color: 0x3a3d44, alpha: 0.32 - k * 0.035 })
  }
  const tree = (x: number, y: number, size: number, sunk = 0) => {
    const c = at(x, y)
    c.y += sunk
    g.rect(c.x - 2, c.y - 10 * size, 4, 10 * size).fill(0x3d2f22)
    g.circle(c.x, c.y - 18 * size, 12 * size).fill(look.blocks[0]).circle(c.x - 4 * size, c.y - 22 * size, 7 * size).fill(look.blocks[1])
  }

  // The far edges, farthest first so the nearer covers it: the place goes on beyond where the fight is.
  // The ground carries on a little past the edge before the scenery starts.
  for (let y = -2; y < GRID; y++)
    for (let x = -2; x < GRID; x++) {
      if (x >= 0 && y >= 0) continue
      const c = at(x, y)
      g.poly([c.x, c.y - tileH / 2, c.x + tileW / 2, c.y, c.x, c.y + tileH / 2, c.x - tileW / 2, c.y]).fill(shade(look.rock, 0.85 - 0.15 * -Math.min(x, y)))
    }
  const lots: { x: number; y: number }[] = []
  for (let y = -REACH; y < GRID; y += 2) for (let x = -REACH; x < GRID; x += 2) if (x <= -3 || y <= -3) lots.push({ x: x + Math.floor(rand() * 2) * (x <= -3 ? 1 : 0), y })
  for (const lot of lots.sort((a, b) => a.x + a.y - (b.x + b.y))) {
    const depth = -Math.min(lot.x, lot.y) - 2
    // Farther scenery sinks into the night haze.
    const color = mix(look.blocks[Math.floor(rand() * look.blocks.length)], HAZE, Math.min(0.75, depth * 0.09))
    const [x0, y0] = [lot.x - 0.5, lot.y - 0.5]
    const near = depth <= 1
    switch (look.style) {
      case 'woods':
        for (let k = 0; k < 3; k++) tree(lot.x + rand() * 2, lot.y + rand() * 2, 0.8 + depth * 0.12 + rand() * 0.5)
        break
      case 'rampart':
        if (near) {
          const wall = block(x0, y0, x0 + 2.2, y0 + 2.2, 90, color)
          if (rand() < 0.25) g.rect(wall.left(0.5, 1)[0] - 2, wall.left(0.5, 1)[1] - 30, 4, 30).fill(0x2a2d33).circle(wall.left(0.5, 1)[0], wall.left(0.5, 1)[1] - 32, 5).fill({ color: look.glow, alpha: 0.9 })
        } else windows(block(x0, y0, x0 + 1.6, y0 + 1.6, 40 + rand() * 60, shade(color, 0.7)), 0.2)
        break
      case 'spires': {
        const c = at(lot.x, lot.y)
        const tall = (near ? 50 : 90) + rand() * 150
        g.poly([c.x - 14, c.y, c.x + 14, c.y, c.x + rand() * 10 - 5, c.y - tall]).fill(color)
        g.poly([c.x - 2, c.y, c.x + 2, c.y, c.x, c.y - tall * 0.8]).fill({ color: look.glow, alpha: 0.35 })
        break
      }
      default: {
        const tall = { towns: 30 + rand() * 40, towers: 60 + rand() * 180, works: 30 + rand() * 50, shells: 20 + rand() * 70 }[look.style] * (near ? 0.6 : 1 + depth * 0.06)
        const size = 1.4 + rand() * 0.8
        const face = block(x0, y0, x0 + size, y0 + size, tall, color)
        windows(face, look.style === 'shells' ? 0.08 : look.style === 'towers' ? 0.8 : 0.35)
        if (look.style === 'works' && rand() < 0.15) {
          const top = face.right(0.5, 1)
          g.rect(top[0] - 4, top[1] - 60, 8, 60).fill(shade(color, 0.8))
          blaze(lot.x + 1, lot.y + 1, tall + 60)
        }
        if (look.style === 'shells' && rand() < 0.2) blaze(lot.x + 1, lot.y + 1, tall)
      }
    }
  }

  // Wherever the ground ends toward the viewer, it falls away in a cliff: banded rock fading into the depths.
  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) {
      if (gone(x, y)) continue
      const lift = rise * battle.height[y * GRID + x]
      // The rim on the far sides, where the drop is out of sight.
      if (gone(x - 1, y)) g.moveTo(at(x - 0.5, y - 0.5).x, at(x - 0.5, y - 0.5).y - lift).lineTo(at(x - 0.5, y + 0.5).x, at(x - 0.5, y + 0.5).y - lift).stroke({ color: shade(look.rock, 1.4), width: 2 })
      if (gone(x, y - 1)) g.moveTo(at(x - 0.5, y - 0.5).x, at(x - 0.5, y - 0.5).y - lift).lineTo(at(x + 0.5, y - 0.5).x, at(x + 0.5, y - 0.5).y - lift).stroke({ color: shade(look.rock, 1.4), width: 2 })
      for (const [ax, ay, bx, by, light] of [
        [x - 0.5, y + 0.5, x + 0.5, y + 0.5, 0.75],
        [x + 0.5, y - 0.5, x + 0.5, y + 0.5, 0.55],
      ] as const) {
        if (!(light === 0.75 ? gone(x, y + 1) : gone(x + 1, y))) continue
        const a = at(ax, ay)
        const b = at(bx, by)
        const bands = 6
        for (let k = 0; k < bands; k++) {
          const top = (FALL * k) / bands - lift
          const bottom = (FALL * (k + 1)) / bands - lift
          const jag = (rand() - 0.5) * 6
          g.poly([a.x, a.y + top, b.x, b.y + top, b.x, b.y + bottom + jag, a.x, a.y + bottom]).fill({ color: shade(look.rock, light * (1 - k * 0.09)), alpha: 1 - k / bands })
        }
        // The lip where ground meets the drop.
        g.moveTo(a.x, a.y - lift).lineTo(b.x, b.y - lift).stroke({ color: shade(look.rock, 1.25), width: 2 })
      }
    }
  }

  // Where narrow ground cuts the battlefield away, the land goes on far below the cliffs, the place's own scenery on it.
  const below = FALL * 0.75
  for (let t = 0; t < GRID * GRID; t++) {
    const x = t % GRID
    const y = Math.floor(t / GRID)
    if (!gone(x, y)) continue
    const c = at(x, y)
    g.poly([c.x, c.y - tileH / 2 + below, c.x + tileW / 2, c.y + below, c.x, c.y + tileH / 2 + below, c.x - tileW / 2, c.y + below]).fill(mix(look.rock, HAZE, 0.45))
  }
  for (let t = 0; t < GRID * GRID; t += 1) {
    const x = t % GRID
    const y = Math.floor(t / GRID)
    if (!gone(x, y) || (x + y * 3) % 4 !== 0 || rand() < 0.3) continue
    const color = mix(look.blocks[Math.floor(rand() * look.blocks.length)], HAZE, 0.35)
    if (look.style === 'woods') tree(x, y, 0.9 + rand() * 0.4, below)
    else if (look.style === 'spires') {
      const c = at(x, y)
      g.poly([c.x - 9, c.y + below, c.x + 9, c.y + below, c.x, c.y + below - 40 - rand() * 50]).fill(color)
    } else windows(block(x - 0.45, y - 0.45, x + 0.45, y + 0.45, 14 + rand() * 40, color, below), 0.25)
  }
}

/** The night sky the scenery fades into. */
const HAZE = 0x10141c

/** Colour `a` moved `t` of the way to `b`. */
function mix(a: number, b: number, t: number): number {
  const ch = (shift: number) => Math.round(((a >> shift) & 255) * (1 - t) + ((b >> shift) & 255) * t) << shift
  return ch(16) | ch(8) | ch(0)
}

/** A colour scaled toward black, or toward white above 1. */
function shade(color: number, by: number): number {
  const ch = (c: number) => Math.max(0, Math.min(255, Math.round(by <= 1 ? c * by : c + (255 - c) * (by - 1))))
  return (ch(color >> 16) << 16) | (ch((color >> 8) & 255) << 8) | ch(color & 255)
}
