import { describe, expect, it } from 'vitest'
import { apply } from '../core/apply'
import type { ArenaKind } from '../core/arena-kinds'
import { GRID, type Battle } from '../core/battle'
import { createRun } from '../core/run'
import { Group, type Mesh, type MeshBasicMaterial } from 'three'
import { drawTerrain } from './board'
import { edgeLines } from './edges'
import type { Stage } from './stage'

/** The first battle of each seed's run, by arena kind. */
function battles(): Map<ArenaKind, Battle> {
  const out = new Map<ArenaKind, Battle>()
  for (let seed = 0; seed < 60 && out.size < 6; seed++) {
    const run = createRun(seed)
    apply(run, { type: 'recruit', index: 0 })
    for (let i = 0; i < 8 && !run.battle; i++) {
      apply(run, { type: 'go', index: 0 })
      if (!run.battle) apply(run, { type: 'advance' })
    }
    if (run.battle && !out.has(run.battle.arenaKind)) out.set(run.battle.arenaKind, run.battle)
  }
  return out
}

describe('terrain', () => {
  const found = battles()
  it('covers every arena kind', () => expect(found.size).toBe(6))
  for (const [kind, battle] of found)
    it(`draws each edge of ${kind} once, and none onto void`, () => {
      const lines = edgeLines(battle)
      const keys = lines.map((e) => [e.x1 + e.x2, e.z1 + e.z2].join())
      expect(new Set(keys).size).toBe(keys.length)
      const at = (x: number, z: number) => battle.ground[Math.round(z) * GRID + Math.round(x)]
      for (const e of lines) {
        const mx = (e.x1 + e.x2) / 2
        const mz = (e.z1 + e.z2) / 2
        // The tiles either side of the edge's middle.
        const across = e.x1 === e.x2 ? [at(mx - 0.5, mz), at(mx + 0.5, mz)] : [at(mx, mz - 0.5), at(mx, mz + 0.5)]
        expect(across).not.toContain('void')
      }
    })
  for (const [kind, battle] of found)
    it(`keeps the ground of ${kind} opaque, so it hides what stands behind it`, () => {
      const s = { terrain: new Group(), chasm: new Group(), scenery: [], walls: [], roofs: [] } as unknown as Stage
      // Trees draw on a canvas, which tests lack.
      drawTerrain(s, { ...battle, props: battle.props.map(() => 'none') })
      const ground = (s.terrain.children[0] as Mesh).material as MeshBasicMaterial
      expect([ground.transparent, ground.depthWrite]).toEqual([false, true])
    })
})
