// The squad's arrival: the one point the encounter chooses, the plain landing there, and what relics and the picked utility set off.
import { chillUnit } from './stacks'
import { BARRIER_ARMOR, GRID, isSoldier, type Battle, type Effect, type Tile, type Unit } from './battle'
import { CHALLENGES, type ChallengeId } from './challenges'
import type { GameEvent } from './combat-event'
import { engageNearest, has, nearest } from './fighters'
import { blocked, distance, edgeDepths, freeTilesNear, NEIGHBORS, onGrid, openNear, reachableFrom, walkingDistances, walks } from './grid'
import { dropUnit, soldierUnit, TURRET } from './spawn'
import { PROP_BULK } from './terrain'
import { TUNING } from './tuning'
import type { UtilityId } from './utilities'
import { takeBoon } from './boons'
import { wound } from './wound'

/** How near the landing Breaching Charges reach aliens, the damage they add, and how near the aliens stand that Encore catches. */
export const CHARGE_REACH = 8
export const CHARGE_BLAST = 3
export const ENCORE_REACH = 5

/** The nearest a landing comes to an assassination's commander. */
export const COMMANDER_GAP = 12

/** How far within the map's edge a landing lies, the longest walk from it to the arena's centre, and how far from the nearest alien it wants to be. */
export const ENTRY_MARGIN = 4
const ENTRY_WALK = 40
const CONTACT = [5, 9]

/** Challenges whose test is the ground between the way in and the aliens. */
const FROM_AFAR: ChallengeId[] = ['slog', 'firingLine', 'scattered']

/** The aliens a landing is placed by: those the squad can see coming, not burrowers underground. */
const inView = (battle: Battle) => battle.units.filter((u) => u.side === 'alien' && u.kind !== 'burrower')

/**
 * Chooses where the squad lands: a push's head on down the axis, never near an assassination's commander, a VIP
 * rescue's by the VIP; a flood's by the uplink or among the civilians.
 */
export function planEntry(battle: Battle, heart: Tile | null): void {
  const centre = openNear(battle, battle.arena)
  const toCentre = walkingDistances(battle, centre)
  const fromCentre = reachableFrom(battle, centre)
  const aliens = inView(battle)
  const commander = battle.units.find((u) => u.target)
  const vip = battle.units.find((u) => u.civilian === 'vip')
  const depth = edgeDepths(battle)
  const walkable: Tile[] = []
  const open: Tile[] = []
  for (let t = 0; t < GRID * GRID; t++) {
    const tile = { x: t % GRID, y: Math.floor(t / GRID) }
    if (blocked(battle, tile.x, tile.y) || depth[t] <= ENTRY_MARGIN || toCentre[t] === Infinity || !fromCentre[t] || distance(tile, centre) > battle.arena.reach + 8) continue
    walkable.push(tile)
    // Across a river, a tile near as the crow flies can be a long way round.
    if (toCentre[t] > ENTRY_WALK) continue
    if (commander && distance(tile, commander) < COMMANDER_GAP) continue
    if (heart && distance(tile, heart) > 10) continue
    if (battle.uplink && distance(tile, battle.uplink) > 9) continue
    if (vip && distance(tile, vip) > 11) continue
    open.push(tile)
  }
  // Should the goal's ground leave no room, any the squad can walk in by will do.
  const supported = open.length > 0 ? open : walkable
  const contact = (t: Tile) => (aliens.length > 0 ? Math.min(...aliens.map((a) => distance(a, t))) : CONTACT[0])
  let options: Tile[] = battle.challenge && FROM_AFAR.includes(battle.challenge) ? supported : []
  for (let widen = 0; options.length === 0 && widen < 8; widen++) options = supported.filter((t) => contact(t) >= Math.max(3, CONTACT[0] - widen) && contact(t) <= CONTACT[1] + 2 * widen)
  if (options.length === 0) options = supported
  const approach = battle.flow === 'push' ? battle.approach : (battle.uplink ?? heart ?? centre)
  battle.entry = options.reduce((a, b) => (distance(b, approach) < distance(a, approach) ? b : a))
}

/** The squad lands, with the utility the player picked and any second from the reservoir, and the battle begins. What it sets off lands as the first beat; see opening. */
export function land(battle: Battle, utility: UtilityId | null = null, tank = 0, second: UtilityId | null = null): void {
  const at = battle.entry!
  deploy(battle, at)
  if (battle.challenge && CHALLENGES[battle.challenge].volley) for (const u of battle.units) if (u.side === 'alien') u.engaged = true
  const squad = battle.units.filter(isSoldier)
  const held = (effect: Effect) => squad.some((u) => has(u, effect))
  const closest = nearest(battle.units.filter((u) => u.side === 'alien'), at)
  if (held('encore') && closest) for (const alien of battle.units.filter((u) => u.side === 'alien' && distance(u, closest) <= ENCORE_REACH)) alien.surprised = Math.max(alien.surprised, 1)
  for (const alien of battle.units.filter((u) => u.side === 'alien' && distance(u, at) <= CHARGE_REACH)) {
    if (held('entryShred')) alien.armor = 0
    if (held('entryFrost')) chillUnit(battle, alien, 1, [])
  }
  if (held('entryTurret')) dropUnit(battle, squad[0], TURRET, at)
  if (held('entryWall')) for (const soldier of squad) barricade(battle, soldier)
  battle.utility = utility
  battle.second = second
  takeBoon(battle, utility, tank)
  takeBoon(battle, second, tank)
}

/** Puts the whole squad down on the free tiles nearest `at` and begins the battle, the cluster nearest engaging. */
export function deploy(battle: Battle, at: Tile): void {
  const tiles = freeTilesNear(battle, at, battle.reserve.length)
  battle.reserve.forEach((soldier, i) => battle.units.push(soldierUnit(battle, soldier, tiles[i])))
  battle.reserve = []
  battle.phase = 'battle'
  battle.opening = true
  const squad = battle.units.filter(isSoldier)
  engageNearest(battle, [at])
  // A barrier projector armors every squadmate of its carrier.
  for (const carrier of squad.filter((u) => u.effects.includes('barrier'))) {
    for (const mate of squad) if (mate !== carrier) mate.armor += BARRIER_ARMOR
  }
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

/** The battle's first beat: the utility taking hold, and what the squad's charges do. */
export function opening(battle: Battle): GameEvent[] {
  battle.opening = false
  const events: GameEvent[] = []
  const soldiers = battle.units.filter(isSoldier)
  for (const utility of [battle.utility, battle.second]) if (utility) events.push({ type: 'used', src: { kind: 'boon', id: utility }, utility, on: utility === 'flashbang' ? battle.units.filter((u) => u.surprised > 0).map((u) => u.id) : soldiers.map((u) => u.id) })
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
