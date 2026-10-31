// The cliffs where narrow ground falls away.
import { Group } from 'three'
import { GRID, type Battle } from '../core/battle'
import type { TerrainKind } from '../core/terrain'
import { shade, Shapes } from './shapes'
import { LEVEL, tall } from './space'

/** How far, in screen pixels seen from the still camera, a cliff falls before it fades into the depths. */
const FALL = 230

/** The rock a kind of place's cliffs are cut in. */
const ROCK: Record<TerrainKind, number> = {
  town: 0x3a332d,
  city: 0x34363c,
  industrial: 0x3b3833,
  ruins: 0x332e2a,
  countryside: 0x3d3428,
  compound: 0x3a3d42,
  hive: 0x2a1838,
}

/** Wherever narrow ground falls away, a cliff: banded rock fading into the depths. */
export function buildChasm(battle: Battle): Group {
  const group = new Group()
  const shapes = new Shapes()
  const rock = ROCK[battle.place]
  const gone = (x: number, y: number) => x >= 0 && y >= 0 && x < GRID && y < GRID && battle.ground[y * GRID + x] === 'void'
  const fall = tall(FALL)
  for (let y = 0; y < GRID; y++)
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
          shapes.quad({ x: ax, y: top, z: az }, { x: bx, y: top, z: bz }, { x: bx, y: bottom, z: bz }, { x: ax, y: bottom, z: az }, shade(rock, light * (1 - k * 0.09)), 1 - k / bands)
        }
        // The lip where ground meets the drop.
        shapes.line({ x: ax, y: lift + 0.005, z: az }, { x: bx, y: lift + 0.005, z: bz }, shade(rock, 1.25))
      }
    }
  const { mesh, lines } = shapes.build()
  group.add(mesh)
  if (lines) group.add(lines)
  return group
}
