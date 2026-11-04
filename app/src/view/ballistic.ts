// The way a thing flies under gravity: up from where it leaves, through where its arc comes down, and on down past it.
import type { Point3 } from './shapes'

/**
 * A flight from `from` that comes down through `over` after `ms`, `arc` above the straight line at its height, and keeps
 * on the same parabola until `sink` below `over`. Gives where it is each moment and how long it takes in all.
 */
export function ballistic(from: Point3, over: Point3, arc: number, sink: number, ms: number): { ms: number; at: (time: number) => Point3 } {
  const d = over.y - from.y
  const k = 4 * Math.max(arc, 1e-3)
  // The later root of k u² - (d + k) u + (d - sink) = 0: where the arc is `sink` below `over`.
  const end = (d + k + Math.sqrt((d + k) ** 2 - 4 * k * (d - sink))) / (2 * k)
  return {
    ms: ms * end,
    at: (time) => {
      const u = Math.min(time / ms, end)
      return { x: from.x + (over.x - from.x) * u, y: from.y + d * u + k * u * (1 - u), z: from.z + (over.z - from.z) * u }
    },
  }
}
