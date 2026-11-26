// Questions every combat module asks about units in a fight: whose enemy, nearest, has what, can shoot.
import { type Battle, type Effect, GRID, type Tile, type Unit, isSoldier } from './battle'
import { onGrid } from './grid'
import { NEIGHBORS } from './grid'
import { distance } from './grid'
import { EXTRACT_REACH } from './goals'
import { canShoot, sees } from './sight'

/**
 * The enemies a unit acts against, cloaked ones aside. Aliens know every soldier. Soldiers know the revealed aliens;
 * with none revealed they track every alien, which leads the hero to a contact.
 */
export function enemiesOf(battle: Battle, unit: Unit): Unit[] {
  const others = battle.units.filter((u) => u.side !== unit.side && !u.cloaked)
  const known = others.filter((u) => u.revealed)
  return known.length > 0 ? known : others
}

/** The unit in `units` nearest to `from`; the lowest id wins a tie. */
export function nearest<T extends Tile>(units: T[], from: Tile): T | undefined {
  let best: T | undefined
  for (const unit of units) if (!best || distance(from, unit) < distance(from, best)) best = unit
  return best
}

export const has = (unit: Unit, effect: Effect) => unit.effects.includes(effect)

/** The jump and span a unit's ways are found with. */
export const leap = (unit: Unit): [number, number] => [unit.stats.jump, unit.stats.span]

/** Whether a unit's foes include one with `effect`: a relic, or a soldier's gear, working on the aliens. */
export const foeHas = (battle: Battle, unit: Unit, effect: Effect) => battle.units.some((u) => u.side !== unit.side && u.hp > 0 && has(u, effect))

export const onTile = (pools: Tile[], unit: Tile) => pools.some((pool) => pool.x === unit.x && pool.y === unit.y)

/** Uses a once-per-battle effect. False if the unit lacks it or has used it. */
export function spend(unit: Unit, effect: Effect): boolean {
  if (!has(unit, effect) || unit.spent.includes(effect)) return false
  unit.spent.push(effect)
  return true
}

/** Ids of the revealed aliens some soldier sees now. */
export function spotted(battle: Battle): Set<number> {
  const soldiers = battle.units.filter(isSoldier)
  return new Set(battle.units.filter((u) => u.side === 'alien' && u.revealed && soldiers.some((s) => sees(battle, s, u))).map((u) => u.id))
}


/** Whether `unit`, standing on `from`, may shoot `target`: a cloaked one never. */
export function shootable(battle: Battle, unit: Unit, from: Tile, target: Unit): boolean {
  if (target.cloaked) return false
  return canShoot(battle, from, target, unit.stats.range)
}

/** Those of a side's aliens in the fight that can walk: a turret or a nest never holds the next back. */
export const walkersFighting = (battle: Battle) => battle.units.filter((u) => u.side === 'alien' && u.engaged && u.stats.move > 0).length

/** Brings `alien` and the rest of its cluster into the fight. */
export function engage(battle: Battle, alien: Unit): void {
  for (const u of battle.units) if (u === alien || (alien.cluster > 0 && u.cluster === alien.cluster)) u.engaged = true
  battle.rallied = battle.round
}

/** Brings in the cluster waiting nearest `from`; on a flood, every alien. */
export function engageNearest(battle: Battle, from: Tile[]): void {
  const waiting = battle.units.filter((u) => u.side === 'alien' && !u.engaged)
  const near = (u: Unit) => Math.min(...from.map((t) => distance(t, u)))
  if (battle.flow === 'flood') for (const u of waiting) u.engaged = true
  else if (waiting.length > 0) engage(battle, waiting.reduce((a, b) => (near(b) < near(a) ? b : a)))
}

export const foes = (battle: Battle, unit: Unit) => battle.units.filter((u) => u.side !== unit.side && !u.civilian && u.revealed && u.engaged)

/** Whether a unit cannot burn: by its nature, or in the rain. */
export const fireproof = (battle: Battle, unit: Unit) => unit.resists.includes('burn') || battle.twist === 'rain'

/** Whether a fuel tank stands beside a tile. */
export const besideFuel = (battle: Battle, tile: Tile) => NEIGHBORS.some(([dx, dy]) => onGrid(tile.x + dx, tile.y + dy) && battle.props[(tile.y + dy) * GRID + tile.x + dx] === 'fuel')

/** On a hold, how far from the uplink a soldier may stand and still defend it; Relay Booster widens it. */
export const UPLINK_REACH = 3

export const RELAY_REACH = 2

export const uplinkReach = (battle: Battle) => UPLINK_REACH + (battle.units.some((u) => isSoldier(u) && has(u, 'relay')) ? RELAY_REACH : 0)

/** How near the extraction zone lifts a soldier off; a Signal Flare widens it. */
export const FLARE_REACH = 3

export const extractReach = (battle: Battle) => EXTRACT_REACH + (battle.units.some((u) => isSoldier(u) && has(u, 'flare')) ? FLARE_REACH : 0)

/** The tile at the middle of some units. */
export function centreOf(units: Unit[]): Tile {
  const mean = (pick: (unit: Unit) => number) => Math.round(units.reduce((sum, unit) => sum + pick(unit), 0) / units.length)
  return { x: mean((u) => u.x), y: mean((u) => u.y) }
}

/** Alien turns fire lies on a tile. */
export const FIRE_TURNS = 2



/** What Bounty Rounds add to hits on a boss, and how far an Evac Beacon gets a civilian out from. */
export const BOUNTY_DAMAGE = 3

export const BEACON_REACH = 3

/** Alien turns after which soldiers no longer hang back out of reach. */
export const RESTLESS_ROUND = 25
