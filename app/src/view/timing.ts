// When a walk with jumps in it is where: it walks the ground at its pace, and stops for each jump's crouch, flight and landing in full.
import type { Tile } from '../core/battle'
import { leapMs, PACE } from '../core/pace'

/** Where a walker is at a moment: on stride `i` (from point i-1 to i), a share `f` along it, and in which part of a jump, `k` of the way through it. */
export interface Moment {
  i: number
  f: number
  phase: 'walk' | 'crouch' | 'air' | 'land'
  k: number
}

/** How far along a walk a unit is at time `t`: it gathers speed, carries it, and slows to a stop. */
export const momentum = (t: number) => t * t * t * (t * (6 * t - 15) + 10)

/** The time a share `d` of the way is reached under momentum. */
function reached(d: number): number {
  let [lo, hi] = [0, 1]
  for (let n = 0; n < 24; n++) {
    const mid = (lo + hi) / 2
    if (momentum(mid) < d) lo = mid
    else hi = mid
  }
  return (lo + hi) / 2
}

const PHASES = [['crouch', PACE.crouch], ['air', PACE.air], ['land', PACE.landing]] as const

/** Plans a walk through `points` over `ms`; each stride `jumps` marks takes a jump's whole time, the rest the walk's. Returns where the walker is a share `t` of the way through. */
export function timeline(points: Tile[], jumps: boolean[], ms: number): (t: number) => Moment {
  const lengths = points.slice(1).map((b, i) => Math.hypot(b.x - points[i].x, b.y - points[i].y))
  const ground = lengths.reduce((sum, l, i) => sum + (jumps[i] ? 0 : l), 0)
  const walking = Math.max(0, ms - jumps.filter(Boolean).length * leapMs)
  return (t) => {
    let left = t * ms
    let gone = 0
    for (let s = 0; s < lengths.length; s++) {
      const i = s + 1
      if (jumps[s]) {
        for (const [phase, span] of PHASES) {
          if (left < span) return { i, f: phase === 'crouch' ? 0 : phase === 'air' ? left / span : 1, phase, k: left / span }
          left -= span
        }
        continue
      }
      const [from, to] = [reached(gone / ground), reached((gone + lengths[s]) / ground)]
      const span = (to - from) * walking
      if (left < span) return { i, f: (momentum(from + left / walking) * ground - gone) / lengths[s], phase: 'walk', k: 0 }
      left -= span
      gone += lengths[s]
    }
    return { i: lengths.length, f: 1, phase: jumps.at(-1) ? 'land' : 'walk', k: 1 }
  }
}
