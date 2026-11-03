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

/** A skyscraper's face: storeys of dark glass between lit floors, fading far down to the street. */
const TOWER = { fall: 3 * FALL, glass: 0x1f2d40, floor: 0x7fa6c8, storeys: 9 }

/** Wherever the ground falls away, a cliff: banded rock fading into the depths, or a skyscraper's face. */
export function buildChasm(battle: Battle): Group {
  const group = new Group()
  const shapes = new Shapes()
  const tower = battle.arenaKind === 'skyscraper'
  const rock = tower ? TOWER.glass : ROCK[battle.place]
  const gone = (x: number, y: number) => x >= 0 && y >= 0 && x < GRID && y < GRID && battle.ground[y * GRID + x] === 'void'
  const fall = tall(tower ? TOWER.fall : FALL)
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
        const bands = tower ? 2 * TOWER.storeys : 6
        for (let k = 0; k < bands; k++) {
          const top = lift - (fall * k) / bands
          const bottom = lift - (fall * (k + 1)) / bands
          // A tower's lit floors are thin bands between its storeys of glass.
          const band = tower && k % 2 === 1 ? { top, bottom: top - (top - bottom) * 0.25, color: TOWER.floor } : { top, bottom, color: rock }
          shapes.quad({ x: ax, y: band.top, z: az }, { x: bx, y: band.top, z: bz }, { x: bx, y: band.bottom, z: bz }, { x: ax, y: band.bottom, z: az }, shade(band.color, light * (1 - (k / bands) * 0.5)), 1 - k / bands)
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
