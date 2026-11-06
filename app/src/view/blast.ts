// An area hit on screen: the tiles it caught flash outward from where it struck, a shockwave rings out, and each unit caught recoils.
import type { MeshBasicMaterial } from 'three'
import { type Tile } from '../core/battle'
import { onGrid } from '../core/grid'
import { DECAL_LIFT, spot } from './camera'
import { drawing, shockwave } from './effects'
import { Shapes } from './shapes'
import { squash } from './sprites'
import type { Sprite, Stage } from './stage'

const FLASH_MS = 520
/** How much later each ring of tiles out from the centre lights. */
const RIPPLE_MS = 70
const RECOIL_MS = 260
/** How far in from a tile's edge its flash stops, so the footprint reads as tiles. */
const INSET = 0.05

/** The tiles within `reach` of `at` flash `color`, ring by ring, on their own heights; a shockwave rings out; `caught` recoil. */
export function blast(s: Stage, at: Tile, reach: number, color: number, caught: Sprite[]): void {
  for (let r = 0; r <= reach; r++) {
    const shapes = new Shapes()
    for (let dy = -r; dy <= r; dy++)
      for (let dx = -r; dx <= r; dx++) {
        const x = at.x + dx
        const y = at.y + dy
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r || !onGrid(x, y)) continue
        const h = spot(x, y).y + DECAL_LIFT * 3
        shapes.flat(x - 0.5 + INSET, y - 0.5 + INSET, x + 0.5 - INSET, y + 0.5 - INSET, h, color, 0.99)
      }
    const { mesh } = shapes.build(true)
    const material = mesh.material as MeshBasicMaterial
    material.depthWrite = false
    material.opacity = 0
    s.scene.add(mesh)
    const delay = (r * RIPPLE_MS) / FLASH_MS
    void s.tween(FLASH_MS, (t) => {
      const k = Math.max(0, (t - delay) / (1 - delay))
      material.opacity = k === 0 ? 0 : 0.65 * Math.min(1, k * 6) * (1 - k) ** 1.5
    }).then(() => {
      s.scene.remove(mesh)
      mesh.geometry.dispose()
      material.dispose()
    })
  }
  void drawing(s, (fx) => shockwave(s, fx, s.toWorld(at.x, at.y), reach, color))
  for (const sprite of caught)
    void s.tween(RECOIL_MS, (t) => {
      const k = 0.28 * (1 - t) * Math.cos(t * Math.PI * 1.5)
      squash(sprite, 1 + k, 1 - k)
    })
}
