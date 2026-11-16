// The hero's arrival: the one point the encounter chooses, the plain landing there, and what relics and the picked utility set off.
import { chillUnit } from './stacks'
import { BARRIER_ARMOR, GRID, isSoldier, type Battle, type Effect, type Tile, type Unit } from './battle'
import { CHALLENGES } from './challenges'
import type { GameEvent } from './combat-event'
import { engageNearest, has, nearest } from './fighters'
import { blocked, distance, edgeDepths, freeTilesNear, NEIGHBORS, onGrid, openNear, walkingDistances, walks } from './grid'
import { dropUnit, soldierUnit, TURRET } from './spawn'
import { PROP_BULK } from './terrain'
import { TUNING } from './tuning'
import { carries, type UtilityId } from './utilities'
import { takeBoon } from './boons'
import { wound } from './wound'

/** How near the landing Breaching Charges reach aliens, the damage they add, and how near the aliens stand that Surprise Drop catches. */
export const CHARGE_REACH = 8
export const CHARGE_BLAST = 3
export const ENCORE_REACH = 5

/** How far within the map's edge a landing lies. */
export const ENTRY_MARGIN = 4

/** Where the hero lands: the open tile nearest the way in from which it can walk to the objective. */
export function planEntry(battle: Battle): void {
  const toObjective = walkingDistances(battle, battle.objective)
  const depth = edgeDepths(battle)
  let best: Tile | null = null
  for (let t = 0; t < GRID * GRID; t++) {
    const tile = { x: t % GRID, y: Math.floor(t / GRID) }
    if (blocked(battle, tile.x, tile.y) || toObjective[t] === Infinity || depth[t] <= ENTRY_MARGIN || battle.ground[t] === 'mire') continue
    if (!best || distance(tile, battle.approach) < distance(best, battle.approach)) best = tile
  }
  battle.entry = best ?? openNear(battle, battle.approach)
}

/** The hero lands, with the utility the player picked and any second from the reservoir, and the battle begins. What it sets off lands as the first beat; see opening. */
export function land(battle: Battle, utility: UtilityId | null = null, tank = 0, second: UtilityId | null = null): void {
  const at = battle.entry!
  deploy(battle, at)
  if (battle.challenge && CHALLENGES[battle.challenge].volley) for (const u of battle.units) if (u.side === 'alien') u.engaged = true
  const team = battle.units.filter(isSoldier)
  const held = (effect: Effect) => team.some((u) => has(u, effect))
  const closest = nearest(battle.units.filter((u) => u.side === 'alien'), at)
  if (held('encore') && closest) for (const alien of battle.units.filter((u) => u.side === 'alien' && distance(u, closest) <= ENCORE_REACH)) alien.surprised = Math.max(alien.surprised, 1)
  for (const alien of battle.units.filter((u) => u.side === 'alien' && distance(u, at) <= CHARGE_REACH)) {
    if (held('entryShred')) alien.armor = 0
    if (held('entryFrost')) chillUnit(battle, alien, 1, [])
  }
  if (held('entryTurret')) dropUnit(battle, team[0], TURRET, at)
  if (held('entryWall')) for (const soldier of team) barricade(battle, soldier)
  battle.utility = utility
  battle.second = second
  takeBoon(battle, utility, tank)
  takeBoon(battle, second, tank)
}

/** Puts the heroes down on the free tiles nearest `at` and begins the battle, the cluster nearest engaging. */
export function deploy(battle: Battle, at: Tile): void {
  const tiles = freeTilesNear(battle, at, battle.reserve.length)
  battle.reserve.forEach((soldier, i) => battle.units.push(soldierUnit(battle, soldier, tiles[i])))
  battle.reserve = []
  battle.phase = 'battle'
  battle.opening = true
  const team = battle.units.filter(isSoldier)
  engageNearest(battle, [at])
  // Each Shield of Faith armors its holder and every ally.
  const shields = team.filter((u) => u.effects.includes('barrier')).length
  for (const mate of team) mate.armor += shields * BARRIER_ARMOR
}

/** Stands a barricade on the free tile beside `soldier` nearest the nearest alien, unless it would cut ground off. */
function barricade(battle: Battle, soldier: Unit): void {
  const toward = nearest(battle.units.filter((u) => u.side === 'alien'), soldier) ?? { x: GRID >> 1, y: GRID >> 1 }
  const tile = NEIGHBORS.map(([dx, dy]) => ({ x: soldier.x + dx, y: soldier.y + dy }))
    .filter((t) => onGrid(t.x, t.y) && !blocked(battle, t.x, t.y))
    .sort((a, b) => distance(a, toward) - distance(b, toward))[0]
  if (!tile) return
  const t = tile.y * GRID + tile.x
  const open = walkingDistances(battle, soldier).filter(Number.isFinite).length
  battle.props[t] = 'stack'
  battle.bulk[t] = PROP_BULK.stack
  walks.delete(battle)
  if (walkingDistances(battle, soldier).filter(Number.isFinite).length >= open - 1) return
  battle.props[t] = 'none'
  battle.bulk[t] = 0
  walks.delete(battle)
}

/** The battle's first beat: the utility taking hold, and what the hero's charges do. */
export function opening(battle: Battle): GameEvent[] {
  battle.opening = false
  const events: GameEvent[] = []
  const soldiers = battle.units.filter(isSoldier)
  for (const utility of [battle.utility, battle.second]) if (utility) events.push({ type: 'used', src: { kind: 'boon', id: utility }, utility, on: utility === 'flashbang' ? battle.units.filter((u) => u.surprised > 0).map((u) => u.id) : soldiers.map((u) => u.id) })
  if ([battle.utility, battle.second].some((u) => u && carries(u, ['coldSnap']))) events.push({ type: 'freeze' })
  const held = (effect: Effect) => soldiers.some((s) => has(s, effect))
  const at = battle.entry
  if (at && (held('entryBlast') || held('entryShred') || held('entryFrost'))) {
    for (const alien of battle.units.filter((u) => u.side === 'alien' && u.hp > 0 && u.kind !== 'burrower' && distance(u, at) <= CHARGE_REACH)) {
      const amount = TUNING.impactDamage + (held('entryBlast') ? CHARGE_BLAST : 0)
      events.push({ type: 'hurt', id: alien.id, amount, cause: 'impact' })
      wound(battle, alien, amount, events)
    }
  }
  return events
}
