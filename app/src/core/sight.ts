import { COVER_DEFENSE, coverAt, GRID, type Battle, type Cover, type Stats, type Tile } from './battle'

/** Tiles between two points, counting a diagonal as one. */
export const distance = (a: Tile, b: Tile) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y))

const SIDES = [[0, -1], [1, 0], [0, 1], [-1, 0]]

/**
 * The best cover a unit standing on `at` has against a shot from `from`.
 * Cover on an adjacent tile counts only if the shooter is on that side of the unit; otherwise the unit is flanked.
 */
export function coverAgainst(battle: Battle, at: Tile, from: Tile): Cover {
  let best: Cover = 0
  for (const [dx, dy] of SIDES) {
    const x = at.x + dx
    const y = at.y + dy
    if (x < 0 || y < 0 || x >= GRID || y >= GRID) continue
    if ((from.x - at.x) * dx + (from.y - at.y) * dy > 0 && coverAt(battle, x, y) > best) best = coverAt(battle, x, y)
  }
  return best
}

/** Chances for a shot by a unit with `stats` standing on `shooter`: to hit, and for a hit to crit. */
export function odds(battle: Battle, shooter: Tile, target: Tile, stats: Stats): { hit: number; crit: number } {
  const cover = coverAgainst(battle, target, shooter)
  return { hit: stats.aim - COVER_DEFENSE[cover], crit: cover === 0 ? stats.crit : 0 }
}

/**
 * Whether a straight line between the centres of two tiles is clear of high cover.
 * A line that only touches a block's corner is clear. Low cover never blocks; units shoot over it.
 */
export function lineOfSight(battle: Battle, a: Tile, b: Tile): boolean {
  // Tile centres and corners in half-tile units, so every coordinate is an integer.
  const ax = 2 * a.x + 1
  const ay = 2 * a.y + 1
  const dx = 2 * (b.x - a.x)
  const dy = 2 * (b.y - a.y)
  for (let y = Math.min(a.y, b.y); y <= Math.max(a.y, b.y); y++) {
    for (let x = Math.min(a.x, b.x); x <= Math.max(a.x, b.x); x++) {
      if (coverAt(battle, x, y) !== 2) continue
      // The line cuts through the tile when it has corners on both sides of the line.
      const sides = [0, 1].flatMap((i) => [0, 1].map((j) => Math.sign(dx * (2 * (y + j) - ay) - dy * (2 * (x + i) - ax))))
      if (sides.includes(1) && sides.includes(-1)) return false
    }
  }
  return true
}

/** Whether a unit on `from` may shoot a unit on `target`: within `range`, with line of sight. */
export function canShoot(battle: Battle, from: Tile, target: Tile, range: number): boolean {
  return distance(from, target) <= range && lineOfSight(battle, from, target)
}
