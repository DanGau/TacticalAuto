import { Group } from 'three'
import { GRID, type Battle } from '../core/battle'
import type { TerrainKind } from '../core/terrain'
import { LOOKS } from './looks'
import { blob, mix, shade, Shapes } from './shapes'
import { ACROSS, LEVEL, tall } from './space'

/** Tiles of scenery drawn past the map on every side, and of bare ground past that, fading into the night. */
export const SCENERY = 14
const PLAIN = 160
/** How far, in screen pixels seen from the still camera, a cliff falls before it fades into the depths. */
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

/**
 * Builds the world past the map: the place carries on all round, in its region's colours, tall and lit behind it and
 * low before it, so no edge ever shows; only a chasm falls away in cliffs.
 */
export function buildOutskirts(battle: Battle): Group {
  const group = new Group()
  const shapes = new Shapes()
  const look = { ...LOOK[battle.place], blocks: [...LOOK[battle.place].blocks, ...LOOKS[battle.region].walls.map((c) => shade(c, 0.55))] }
  // Scenery is drawn from the ground's own layout, so it stays put when the battle redraws.
  let seed = battle.ground.reduce((h, ground, i) => (h * 31 + ground.length * (i + 7)) | 0, 17)
  const rand = () => ((seed = (seed * 1103515245 + 12345) | 0) >>> 8) / 16777216
  // The town past the battlefield and past the map is ground; only a chasm falls away.
  const gone = (x: number, y: number) => x >= 0 && y >= 0 && x < GRID && y < GRID && battle.ground[y * GRID + x] === 'void' && !battle.outside[y * GRID + x]
  /** How many tiles past the map a tile lies, on its nearest side. */
  const past = (x: number, y: number) => Math.max(-x, -y, x - GRID + 1, y - GRID + 1)
  const across = (px: number) => px / ACROSS
  const fall = tall(FALL)

  // The lights of the land far below.
  for (let i = 0; i < 60; i++) group.add(blob({ x: rand() * GRID * 1.6 - GRID * 0.3, y: -fall * (0.8 + rand()), z: rand() * GRID * 1.6 - GRID * 0.3 }, across(1 + rand() * 1.5), look.glow, 0.15 + rand() * 0.25))

  /** A block on tiles x0..x1, y0..y1 (tile edges), standing `up` pixels, lowered `sunk` pixels onto the land below a cliff. */
  const block = (x0: number, y0: number, x1: number, y1: number, up: number, color: number, sunk = 0) => {
    const base = -tall(sunk)
    const top = base + tall(up)
    shapes.box(x0, y0, x1, y1, base, top, color)
    return {
      left: (u: number, v: number) => ({ x: x0 + (x1 - x0) * u, y: base + (top - base) * v, z: y1 + 0.01 }),
      right: (u: number, v: number) => ({ x: x1 + 0.01, y: base + (top - base) * v, z: y0 + (y1 - y0) * u }),
    }
  }
  /** Lit windows scattered over a block's near faces. */
  const windows = (face: ReturnType<typeof block>, share: number) => {
    for (let i = 0; i < 14; i++) {
      if (rand() > share) continue
      const left = rand() < 0.5
      const at = (left ? face.left : face.right)(0.1 + rand() * 0.8, 0.1 + rand() * 0.8)
      const w = 0.04
      const h = tall(2)
      const alpha = 0.5 + rand() * 0.5
      if (left) shapes.quad({ x: at.x - w, y: at.y - h, z: at.z }, { x: at.x + w, y: at.y - h, z: at.z }, { x: at.x + w, y: at.y + h, z: at.z }, { x: at.x - w, y: at.y + h, z: at.z }, look.glow, alpha)
      else shapes.quad({ x: at.x, y: at.y - h, z: at.z - w }, { x: at.x, y: at.y - h, z: at.z + w }, { x: at.x, y: at.y + h, z: at.z + w }, { x: at.x, y: at.y + h, z: at.z - w }, look.glow, alpha)
    }
  }
  /** A fire on a rooftop, and its smoke rising. */
  const blaze = (x: number, y: number, lift: number) => {
    const at = { x, y: tall(lift), z: y }
    group.add(blob(at, across(10), 0xff6a1f, 0.35), blob(at, across(5), 0xffd84d, 0.7))
    for (let k = 1; k < 8; k++) {
      const drift = across(k * 4 + rand() * 6) / Math.SQRT2
      group.add(blob({ x: x + drift, y: at.y + tall(k * 16), z: y - drift }, across(6 + k * 3), 0x3a3d44, 0.32 - k * 0.035))
    }
  }
  const tree = (x: number, y: number, size: number, sunk = 0) => {
    const base = -tall(sunk)
    const trunk = across(2)
    shapes.box(x - trunk, y - trunk, x + trunk, y + trunk, base, base + tall(10 * size), 0x3d2f22)
    group.add(blob({ x, y: base + tall(18 * size), z: y }, across(12 * size), look.blocks[0]))
    group.add(blob({ x: x - across(4 * size) / Math.SQRT2, y: base + tall(22 * size), z: y + across(4 * size) / Math.SQRT2 }, across(7 * size), look.blocks[1]))
  }

  // Bare ground under it all, low enough that it never fights the ground above it for depth, out to where the haze swallows it, and a street's width round the map before the scenery starts.
  // In the region's own ground colour, so the land round the battlefield reads as more of the place, not a void.
  const land = Object.values(LOOKS[battle.region].ground)[0] ?? look.rock
  shapes.flat(-PLAIN, -PLAIN, GRID + PLAIN, GRID + PLAIN, -0.3, shade(land, 0.8))
  for (let y = -2; y < GRID + 2; y++)
    for (let x = -2; x < GRID + 2; x++) {
      if (past(x, y) <= 0) continue
      shapes.flat(x - 0.5, y - 0.5, x + 0.5, y + 0.5, 0, shade(land, 0.9))
    }
  for (let y = -SCENERY; y < GRID + SCENERY; y += 2)
    for (let x = -SCENERY; x < GRID + SCENERY; x += 2) {
      if (past(x, y) < 3) continue
      const lot = { x: x + Math.floor(rand() * 2), y }
      // Before the map, toward the still camera, the scenery stays low, so it hides nothing.
      const before = lot.x >= GRID || lot.y >= GRID
      const low = before ? 0.4 : 1
      const depth = past(lot.x, lot.y) - 2
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
            const wall = block(x0, y0, x0 + 2.2, y0 + 2.2, 90 * low, color)
            if (rand() < 0.25) {
              const top = wall.left(0.5, 1)
              const pole = across(2)
              shapes.box(top.x - pole, top.z - pole, top.x + pole, top.z + pole, top.y, top.y + tall(30), 0x2a2d33)
              group.add(blob({ x: top.x, y: top.y + tall(32), z: top.z }, across(5), look.glow, 0.9))
            }
          } else windows(block(x0, y0, x0 + 1.6, y0 + 1.6, (40 + rand() * 60) * low, shade(color, 0.7)), 0.2)
          break
        case 'spires': {
          const high = tall(((near ? 50 : 90) + rand() * 150) * low)
          const lean = across(rand() * 10 - 5) / Math.SQRT2
          shapes.spike(lot.x, lot.y, 0, across(14) / Math.SQRT2, { x: lot.x + lean, y: high, z: lot.y - lean }, color)
          shapes.spike(lot.x, lot.y + 0.3, 0, across(2), { x: lot.x, y: high * 0.8, z: lot.y + 0.3 }, look.glow, 0.35)
          break
        }
        default: {
          const up = { towns: 30 + rand() * 40, towers: 60 + rand() * 180, works: 30 + rand() * 50, shells: 20 + rand() * 70 }[look.style] * (near ? 0.6 : 1 + depth * 0.06) * low
          const size = 1.4 + rand() * 0.8
          const face = block(x0, y0, x0 + size, y0 + size, up, color)
          windows(face, look.style === 'shells' ? 0.08 : look.style === 'towers' ? 0.8 : 0.35)
          if (look.style === 'works' && rand() < 0.15) {
            const top = face.right(0.5, 1)
            const stack = across(4)
            shapes.box(top.x - stack * 2, top.z - stack, top.x, top.z + stack, top.y, top.y + tall(60), shade(color, 0.8))
            blaze(lot.x + 1, lot.y + 1, up + 60)
          }
          if (look.style === 'shells' && rand() < 0.2) blaze(lot.x + 1, lot.y + 1, up)
        }
      }
    }

  // Wherever the ground ends, it falls away in a cliff: banded rock fading into the depths.
  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) {
      if (gone(x, y)) continue
      const lift = LEVEL * battle.height[y * GRID + x]
      for (const [ax, az, bx, bz, light, open] of [
        [x - 0.5, y + 0.5, x + 0.5, y + 0.5, 0.75, gone(x, y + 1)],
        [x + 0.5, y - 0.5, x + 0.5, y + 0.5, 0.55, gone(x + 1, y)],
        [x - 0.5, y - 0.5, x + 0.5, y - 0.5, 0.62, gone(x, y - 1)],
        [x - 0.5, y - 0.5, x - 0.5, y + 0.5, 0.48, gone(x - 1, y)],
      ] as const) {
        if (!open) continue
        const bands = 6
        for (let k = 0; k < bands; k++) {
          const top = lift - (fall * k) / bands
          const bottom = lift - (fall * (k + 1)) / bands
          shapes.quad({ x: ax, y: top, z: az }, { x: bx, y: top, z: bz }, { x: bx, y: bottom, z: bz }, { x: ax, y: bottom, z: az }, shade(look.rock, light * (1 - k * 0.09)), 1 - k / bands)
        }
        // The lip where ground meets the drop.
        shapes.line({ x: ax, y: lift + 0.005, z: az }, { x: bx, y: lift + 0.005, z: bz }, shade(look.rock, 1.25))
      }
    }
  }

  // Where narrow ground cuts the battlefield away, the land goes on far below the cliffs, the place's own scenery on it.
  const below = FALL * 0.75
  for (let t = 0; t < GRID * GRID; t++) {
    const x = t % GRID
    const y = Math.floor(t / GRID)
    if (gone(x, y)) shapes.flat(x - 0.5, y - 0.5, x + 0.5, y + 0.5, -tall(below), mix(look.rock, HAZE, 0.45))
  }
  for (let t = 0; t < GRID * GRID; t++) {
    const x = t % GRID
    const y = Math.floor(t / GRID)
    if (!gone(x, y) || (x + y * 3) % 4 !== 0 || rand() < 0.3) continue
    const color = mix(look.blocks[Math.floor(rand() * look.blocks.length)], HAZE, 0.35)
    if (look.style === 'woods') tree(x, y, 0.9 + rand() * 0.4, below)
    else if (look.style === 'spires') shapes.spike(x, y, -tall(below), across(9) / Math.SQRT2, { x, y: -tall(below) + tall(40 + rand() * 50), z: y }, color)
    else windows(block(x - 0.45, y - 0.45, x + 0.45, y + 0.45, 14 + rand() * 40, color, below), 0.25)
  }
  const { mesh, lines } = shapes.build()
  group.add(mesh)
  if (lines) group.add(lines)
  return group
}

/** The night sky the scenery fades into. */
const HAZE = 0x10141c
