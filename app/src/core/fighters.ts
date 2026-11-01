// Questions every combat module asks about units in a fight: whose enemy, nearest, has what, can shoot.
import { SECONDARIES, type Secondary } from './secondaries'
import { WEAPONS } from './weapons'
import { AURA_REACH, BURN_TURNS, type Battle, CHILL_TURNS, type Effect, ELUSIVE_REACH, GRID, LINGER_TURNS, type Tile, type Unit, isSoldier } from './battle'
import { onGrid, spacedTile, walkingDistances } from './grid'
import { NEIGHBORS } from './grid'
import { distance } from './grid'
import { EXTRACT_REACH } from './goals'
import { lineOfSight, canShoot, sees } from './sight'

/**
 * The enemies a unit acts against, cloaked ones aside. Aliens know every soldier. Soldiers know the revealed aliens;
 * with none revealed they track every alien, which leads the squad to a contact.
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

/** Whether a unit's foes include one with `effect`: a squad relic, or a soldier's gear, working on the aliens. */
export const foeHas = (battle: Battle, unit: Unit, effect: Effect) => battle.units.some((u) => u.side !== unit.side && u.hp > 0 && has(u, effect))

/** Whether an alien stands in a null field, where it cannot spit, panic, spawn or burst. */
export const silenced = (battle: Battle, unit: Unit) => battle.units.some((u) => u.side !== unit.side && has(u, 'null') && distance(u, unit) <= NULL_REACH)

export const NULL_REACH = 3

export const onTile = (pools: Tile[], unit: Tile) => pools.some((pool) => pool.x === unit.x && pool.y === unit.y)

/** Turns a target `unit` sets burning burns, and one it chills stays chilled. */
export const burnFrom = (unit: Unit) => BURN_TURNS + (has(unit, 'smolder') ? LINGER_TURNS : 0)

export const chillFrom = (unit: Unit) => CHILL_TURNS + (has(unit, 'permafrost') ? LINGER_TURNS : 0)

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

/** Whether `unit` is a VIP not yet freed: a hostage, kept alive. */
export const hostage = (battle: Battle, unit: Unit) => unit.civilian === 'vip' && battle.vip !== 'freed'

/** Whether `unit`, standing on `from`, may shoot `target`. An elusive target is safe from far off, and a cloaked one from all. */
/** A secondary's reach under Squadsight: any spotted alien in a clear line. */
const SPOTTED_REACH = Infinity

/** Tiles Longshot adds to a secondary's reach. */
const LONGSHOT_REACH = 2

/** The unit as it aims a secondary: that reach counts, not its weapon's. */
export const aiming = (unit: Unit, secondary?: Secondary): Unit =>
  secondary ? { ...unit, stats: { ...unit.stats, range: unit.ability === 'squadsight' ? SPOTTED_REACH : secondary.range + (has(unit, 'longshot') ? LONGSHOT_REACH : 0) } } : unit

/** The unit as each of its attacks aims: its weapon, thrown or rocketed, and its secondary. */
function reaches(unit: Unit): Unit[] {
  const weapon = unit.weapon && WEAPONS[unit.weapon]
  const ranged = (range: number | undefined) => (range ? [{ ...unit, stats: { ...unit.stats, range } }] : [])
  return [unit, ...ranged(weapon?.thrown?.range), ...ranged(weapon?.rocket?.range), ...(unit.secondary ? [aiming(unit, SECONDARIES[unit.secondary])] : [])]
}

/** Whether any attack of the unit's has something to hit from `end`. */
export const hasAttack = (battle: Battle, unit: Unit, end: Tile, enemies: Unit[], seen: Set<number>) => reaches(unit).some((aim) => enemies.some((e) => shootable(battle, aim, end, e, seen)))

/** Tiles a hero's powers reach, whatever its weapon. */
const POWER_REACH = 5

/** The unit as it aims a power, a rocket or a flashbang: the power's reach counts, not its weapon's. */
export const powering = (unit: Unit): Unit => ({ ...unit, stats: { ...unit.stats, range: POWER_REACH } })

export function shootable(battle: Battle, unit: Unit, from: Tile, target: Unit, seen: Set<number>): boolean {
  if (hostage(battle, target)) return false
  if (target.cloaked) return false
  if (has(target, 'elusive') && distance(from, target) > ELUSIVE_REACH) return false
  // A psionic attack needs no line of sight, only an alien revealed.
  if (has(unit, 'psionic') && target.revealed && distance(from, target) <= unit.stats.range) return true
  if (unit.stats.range === SPOTTED_REACH) return seen.has(target.id) && lineOfSight(battle, from, target)
  return canShoot(battle, from, target, unit.stats.range)
}

/** The aliens a soldier's powers may act on: revealed and in the fight. */
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

/** Whether a unit cannot burn: by its nature, a fire suit, or in the rain. */
export const fireproof = (battle: Battle, unit: Unit) => unit.resists.includes('burn') || has(unit, 'fireSuit') || battle.twist === 'rain'

/** Whether a fuel tank stands beside a tile. */
export const besideFuel = (battle: Battle, tile: Tile) => NEIGHBORS.some(([dx, dy]) => onGrid(tile.x + dx, tile.y + dy) && battle.props[(tile.y + dy) * GRID + tile.x + dx] === 'fuel')

/** Whether a unit is proof against panic, acid, or a blast: by its own steadfastness, or for panic and acid, by a ward on it or near it. */
export function immune(battle: Battle, unit: Unit, to: 'panic' | 'acid' | 'blast'): boolean {
  return has(unit, 'steadfast') || (to !== 'blast' && (has(unit, 'ward') || inAura(battle, unit, 'ward')))
}

/** Whether a squadmate of `unit` with the aura `effect` stands within its reach. */
export function inAura(battle: Battle, unit: Unit, effect: Effect): boolean {
  return battle.units.some((u) => u.side === unit.side && u !== unit && has(u, effect) && distance(u, unit) <= AURA_REACH)
}

/** A VIP rescue's VIP, while on the field. */
export const vipOf = (battle: Battle) => battle.units.find((u) => u.civilian === 'vip')

/** Soldiers down and not carried. */
export const lying = (battle: Battle) => battle.downed.filter((d) => d.carrier === null)

export const carrying = (battle: Battle, unit: Unit) => battle.downed.some((d) => d.carrier === unit.id)

/** On a hold, how far from the uplink a soldier may stand and still defend it; Relay Booster widens it. */
export const UPLINK_REACH = 3

export const RELAY_REACH = 2

export const uplinkReach = (battle: Battle) => UPLINK_REACH + (battle.units.some((u) => isSoldier(u) && has(u, 'relay')) ? RELAY_REACH : 0)

/** How far from the uplink a hold's extraction zone appears. */
export const EXTRACT_CLEARANCE = 12

/** About how far a walk from where the squad stands the extraction zone lies. */
const EXTRACT_WALK = 24

/** An extraction zone at the edge: of tiles drawn clear of `start`, the one whose walk from it is nearest EXTRACT_WALK. */
export function extractionFrom(battle: Battle, start: Tile): Tile {
  const walk = walkingDistances(battle, start)
  const off = (t: Tile) => Math.abs(walk[t.y * GRID + t.x] - EXTRACT_WALK)
  return Array.from({ length: 40 }, () => spacedTile(battle, [start], EXTRACT_CLEARANCE, 'edge')).reduce((a, b) => (off(b) < off(a) ? b : a))
}

/** Aliens in sight that can walk to `vip`, and so make its column keep together. A turret, or an alien walled off, never comes. */
export const pursuers = (battle: Battle, vip: Unit) => {
  const walk = walkingDistances(battle, vip)
  return battle.units.filter((u) => u.side === 'alien' && u.revealed && u.stats.move > 0 && walk[u.y * GRID + u.x] < Infinity)
}

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


/** Mirror images a wearer begins a battle with, and the chance a hit pops one instead. */
export const MIRROR_IMAGES = 2

/** What Bounty Rounds add to hits on a boss, and how far an Evac Beacon gets a civilian out from. */
export const BOUNTY_DAMAGE = 3

export const BEACON_REACH = 3

/** Alien turns after which soldiers no longer hang back out of reach. */
export const RESTLESS_ROUND = 25
