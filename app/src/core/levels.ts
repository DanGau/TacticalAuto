// Smoothing heights so a ledge stands only where one is meant to.
import type { Edge, Ground } from './terrain'

const PASSES = 24

/** The ground a smoothing reads: heights, what each tile is, and its walls, on a `size` square. */
export interface Levels {
  height: number[]
  ground: Ground[]
  north: Edge[]
  west: Edge[]
}

/**
 * Brings each tile not `kept` within a level of every neighbour it shares an open side with, moving it toward that
 * neighbour, until no ledge stands but between kept tiles. Void and water stay as they are. A tile held between
 * kept tiles too far apart for both is left after PASSES.
 */
export function soften({ height, ground, north, west }: Levels, size: number, kept: (t: number) => boolean = () => false): void {
  const still = (t: number) => ground[t] === 'void' || ground[t] === 'water'
  for (let pass = 0, changed = true; changed && pass < PASSES; pass++) {
    changed = false
    for (let t = 0; t < size * size; t++) {
      if (still(t)) continue
      for (const n of [t % size > 0 && west[t] === 'none' ? t - 1 : -1, t >= size && north[t] === 'none' ? t - size : -1]) {
        if (n < 0 || still(n) || Math.abs(height[t] - height[n]) < 2) continue
        const [hi, lo] = height[t] > height[n] ? [t, n] : [n, t]
        if (!kept(lo)) height[lo] = height[hi] - 1
        else if (!kept(hi)) height[hi] = height[lo] + 1
        else continue
        changed = true
      }
    }
  }
}
