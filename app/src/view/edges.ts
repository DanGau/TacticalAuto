// The hairlines between tiles: each edge of the ground drawn once, at the top of its higher side.
import { GRID, type Battle } from '../core/battle'
import { CLIFF } from '../core/grid'

/** An edge of `tile` from (x1, z1) to (x2, z2) at `level`, the lit lip of a ledge or a plain grid line. */
export interface EdgeLine {
  tile: number
  x1: number
  z1: number
  x2: number
  z2: number
  level: number
  lip: boolean
}

/** The tile sides, as the step to the neighbour and the side's two ends about the tile's centre. */
const SIDES = [
  [0, -1, -0.5, -0.5, 0.5, -0.5],
  [-1, 0, -0.5, -0.5, -0.5, 0.5],
  [0, 1, -0.5, 0.5, 0.5, 0.5],
  [1, 0, 0.5, -0.5, 0.5, 0.5],
] as const

/**
 * Every edge line of the battle's ground. An edge belongs to its higher tile, or on level ground to the tile it is the
 * north or west side of. An edge onto void has none: the chasm draws its lip. The map's edge shows on its north and west.
 */
export function edgeLines(battle: Battle): EdgeLine[] {
  const out: EdgeLine[] = []
  for (let t = 0; t < GRID * GRID; t++) {
    if (battle.ground[t] === 'void') continue
    const x = t % GRID
    const y = Math.floor(t / GRID)
    const h = battle.height[t]
    SIDES.forEach(([dx, dy, ax, az, bx, bz], i) => {
      const nx = x + dx
      const ny = y + dy
      const inside = nx >= 0 && ny >= 0 && nx < GRID && ny < GRID
      const n = ny * GRID + nx
      if (inside && battle.ground[n] === 'void') return
      const low = inside ? battle.height[n] : h
      const north = i < 2
      if (low > h || (low === h && !north)) return
      out.push({ tile: t, x1: x + ax, z1: y + az, x2: x + bx, z2: y + bz, level: h, lip: h - low >= CLIFF })
    })
  }
  return out
}
