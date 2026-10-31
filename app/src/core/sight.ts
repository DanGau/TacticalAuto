// Line of sight, what stands between a shot and its damage, and noticing.
import { FORTIFIED_SOAK } from './doctrines'
import { HUNKER_SOAK, GRID, SIGHT, type Battle, type Stats, type Tile, type Unit } from './battle'
import { bulkAt } from './grid'
import { HIGH_DAMAGE } from './grid'
import { HIGH_SIGHT } from './grid'
import { heightAt } from './grid'
import { distance } from './grid'
import { FOG_SIGHT, NIGHT_DETECT } from './twists'

/** What the ground does to a shot from `shooter` at `target`: damage gained, negative if lost, from height, a hunkered target and the fortified rule. */
export function odds(battle: Battle, shooter: Tile, target: Tile): number {
  const unit = battle.units.find((u) => u.x === target.x && u.y === target.y)
  return HIGH_DAMAGE * (heightAt(battle, shooter) - heightAt(battle, target)) - (unit?.order === 'hunker' ? HUNKER_SOAK : 0) - (battle.rules.includes('fortified') ? FORTIFIED_SOAK : 0)
}

/** Every attack by a unit that deals damage lands for at least this. */
export const MIN_DAMAGE = 1

/** How much of its damage a shot lands, 1 from open level ground; every attack lands something. What a tile's shot is worth to pathing and targeting. */
export function bite(battle: Battle, shooter: Tile, target: Tile, stats: Stats): number {
  return stats.damage > 0 ? Math.max(MIN_DAMAGE, stats.damage + odds(battle, shooter, target)) / stats.damage : 0
}

/**
 * Whether a straight line between the centres of two tiles is clear: it cuts through no tall object between
 * them and crosses no wall. A line that only touches a tile's corner is clear of that tile, but one that touches a
 * wall's end is blocked. Low objects and windows never block; units shoot over and through them.
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
      if (bulkAt(battle, x, y) !== 2 || (x === a.x && y === a.y) || (x === b.x && y === b.y)) continue
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

/** Whether a soldier on `from` sees the tile `to`: within its sight, less in fog, farther from higher ground, with line of sight. */
export function sees(battle: Battle, from: Tile, to: Tile): boolean {
  return distance(from, to) <= SIGHT - (battle.twist === 'fog' ? FOG_SIGHT : 0) + HIGH_SIGHT * (heightAt(battle, from) - heightAt(battle, to)) && lineOfSight(battle, from, to)
}

/** Tiles within which a soldier notices an alien not yet seen, before stillness hides it. */
const DETECT = 20
/** Tiles of DETECT an enemy that held still since its last turn subtracts. */
const HIDE_STILL = 1

/**
 * Whether `from` notices `to`, an enemy not yet seen: within DETECT, less at night, farther from higher ground, nearer
 * when the enemy holds still, with line of sight.
 */
export function detects(battle: Battle, from: Unit, to: Unit): boolean {
  const range = DETECT - (battle.twist === 'night' ? NIGHT_DETECT : 0) + HIGH_SIGHT * (heightAt(battle, from) - heightAt(battle, to)) - (to.moved ? 0 : HIDE_STILL)
  return distance(from, to) <= range && lineOfSight(battle, from, to)
}

/** For each tile, row by row, whether any soldier sees it. */
export function visibleTiles(battle: Battle): boolean[] {
  const soldiers = battle.units.filter((u) => u.side === 'human')
  return Array.from({ length: GRID * GRID }, (_, i) => {
    const tile = { x: i % GRID, y: Math.floor(i / GRID) }
    return soldiers.some((soldier) => sees(battle, soldier, tile))
  })
}
