import { COVER_DEFENSE, coverAt, distance, edgeBetween, GRID, onGrid, SIGHT, type Battle, type Cover, type Stats, type Tile } from './battle'
import { EDGE_COVER } from './terrain'

const SIDES = [[0, -1], [1, 0], [0, 1], [-1, 0]]

/**
 * The best cover a unit standing on `at` has against a shot from `from`. A side of the unit's tile gives cover from
 * what stands on that edge, or else from the prop on the tile beyond it, and only if the shooter is on that side;
 * otherwise the unit is flanked.
 */
export function coverAgainst(battle: Battle, at: Tile, from: Tile): Cover {
  let best: Cover = 0
  for (const [dx, dy] of SIDES) {
    const x = at.x + dx
    const y = at.y + dy
    if (!onGrid(x, y) || (from.x - at.x) * dx + (from.y - at.y) * dy <= 0) continue
    const cover = Math.max(coverAt(battle, x, y), EDGE_COVER[edgeBetween(battle, at, { x, y })]) as Cover
    if (cover > best) best = cover
  }
  return best
}

/**
 * Chances for a shot by a unit with `stats` standing on `shooter`: to hit, and for a hit to crit.
 * Cover lowers the hit chance and closeness raises it, so a flanked target at point-blank is a near-certain hit.
 * A piercing shot treats the target as having no cover.
 */
export function odds(battle: Battle, shooter: Tile, target: Tile, stats: Stats, piercing = false): { hit: number; crit: number } {
  const cover = piercing ? 0 : coverAgainst(battle, target, shooter)
  const hit = stats.aim - COVER_DEFENSE[cover] + stats.close * Math.max(0, stats.range - distance(shooter, target))
  return { hit: Math.min(Math.max(hit, 0), 1), crit: cover === 0 ? stats.crit : 0 }
}

/**
 * Whether a straight line between the centres of two tiles is clear: it cuts through no tile of high cover between
 * them and crosses no wall. A line that only touches a tile's corner is clear of that tile, but one that touches a
 * wall's end is blocked. Low cover and windows never block; units shoot over and through them.
 */
export function lineOfSight(battle: Battle, a: Tile, b: Tile): boolean {
  // Tile centres and corners in half-tile units, so every coordinate is an integer.
  const ax = 2 * a.x + 1
  const ay = 2 * a.y + 1
  const dx = 2 * (b.x - a.x)
  const dy = 2 * (b.y - a.y)
  /** Which side of the line a tile corner lies on: 1, -1, or 0 on the line. */
  const side = (x: number, y: number) => Math.sign(dx * (2 * y - ay) - dy * (2 * x - ax))
  /** Whether the line crosses the wall from corner (x1, y1) to corner (x2, y2): its ends on different sides of the line, the tiles on different sides of it. */
  const crosses = (x1: number, y1: number, x2: number, y2: number) => {
    const across = x1 === x2 ? (ax - 2 * x1) * (ax + dx - 2 * x1) : (ay - 2 * y1) * (ay + dy - 2 * y1)
    return across < 0 && side(x1, y1) * side(x2, y2) <= 0
  }
  for (let y = Math.min(a.y, b.y); y <= Math.max(a.y, b.y); y++) {
    for (let x = Math.min(a.x, b.x); x <= Math.max(a.x, b.x); x++) {
      if (battle.north[y * GRID + x] === 'wall' && crosses(x, y, x + 1, y)) return false
      if (battle.west[y * GRID + x] === 'wall' && crosses(x, y, x, y + 1)) return false
      if (coverAt(battle, x, y) !== 2 || (x === a.x && y === a.y) || (x === b.x && y === b.y)) continue
      // The line cuts through the tile when it has corners on both sides of the line.
      const sides = [side(x, y), side(x + 1, y), side(x, y + 1), side(x + 1, y + 1)]
      if (sides.includes(1) && sides.includes(-1)) return false
    }
  }
  return true
}

/** Whether a unit on `from` may shoot a unit on `target`: within `range`, with line of sight. */
export function canShoot(battle: Battle, from: Tile, target: Tile, range: number): boolean {
  return distance(from, target) <= range && lineOfSight(battle, from, target)
}

/** Whether a soldier on `from` sees the tile `to`: within SIGHT, with line of sight. */
export function sees(battle: Battle, from: Tile, to: Tile): boolean {
  return distance(from, to) <= SIGHT && lineOfSight(battle, from, to)
}

/** For each tile, row by row, whether any soldier sees it. */
export function visibleTiles(battle: Battle): boolean[] {
  const soldiers = battle.units.filter((u) => u.side === 'human')
  return Array.from({ length: GRID * GRID }, (_, i) => {
    const tile = { x: i % GRID, y: Math.floor(i / GRID) }
    return soldiers.some((soldier) => sees(battle, soldier, tile))
  })
}
