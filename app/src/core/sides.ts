// A side's simultaneous move: sighting aliens, walking, sentries, overwatch, burrowers.
import { alienSrc, fx } from './sources'
import type { Secondary } from './secondaries'
import { aiming } from './fighters'
import { weaponAttack } from './attack'
import { WEAPONS } from './weapons'
import { type Battle, ACID_DAMAGE, BURN_STACKS, isSoldier, type Unit, type Tile, ENGAGE_REACH, STANDOFF } from './battle'
import { opening } from './landing'
import { freeTilesNear } from './grid'
import { distance } from './grid'
import type { GameEvent } from './combat-event'
import { engage, immune, onTile, fireproof, foeHas, has, extractReach, BEACON_REACH, spotted, uplinkReach, shootable, enemiesOf, besideFuel } from './fighters'
import { fleePath, fightPath, walk, paths, costOf, bestPath, COHESION } from './pathing'
import { detects, sees } from './sight'
import { upkeep } from './upkeep'
import { moved, wound } from './wound'

/**
 * The side on turn has its upkeep; each of its units walks its path, lowest id first, an alien only once it
 * engages; acid burns those still in it; then newly sighted aliens are revealed.
 */
export function moveSide(battle: Battle): GameEvent[] {
  const events = [...(battle.opening ? opening(battle) : []), ...upkeep(battle), ...(battle.turn === 'alien' ? surface(battle) : [])]
  const watched = new Set<number>()
  battle.strides = {}
  for (const unit of battle.units) {
    if (unit.side !== battle.turn || unit.hp <= 0) continue
    const path = unit.civilian ? fleePath(battle, unit) : unit.engaged ? fightPath(battle, unit) : []
    if (path.length === 0 && unit.order) events.push({ type: 'order', src: { kind: 'basic', id: 'order' }, id: unit.id, order: unit.order })
    if (path.length === 0) continue
    // A sentry fires as the alien turns to go.
    if (unit.side === 'alien') events.push(...sentries(battle, unit, watched))
    if (unit.hp <= 0) continue
    walk(battle, unit, path, events)
    moved(battle, unit, path, events)
    if (unit.order) events.push({ type: 'order', src: { kind: 'basic', id: 'order' }, id: unit.id, order: unit.order })
  }
  // Acid burns each unit of the side still standing in it once the side has moved, so a unit free to move can step out.
  for (const unit of battle.units.filter((u) => u.side === battle.turn)) {
    if (!battle.acid.some((pool) => pool.x === unit.x && pool.y === unit.y) || immune(battle, unit, 'acid')) continue
    events.push({ type: 'hurt', id: unit.id, amount: ACID_DAMAGE, cause: 'acid' })
    wound(battle, unit, ACID_DAMAGE, events)
  }
  for (const unit of battle.units.filter((u) => u.side === battle.turn && onTile(battle.fire, u) && !fireproof(battle, u))) {
    unit.burn = Math.max(unit.burn, BURN_STACKS)
    events.push(fx(unit.id, foeHas(battle, unit, 'pyre') ? 'pyre' : 'napalm', 0))
  }
  const sighted = sight(battle)
  // Soldiers on overwatch fire once the aliens have moved and any alien sighted has taken its place.
  if (battle.turn === 'alien') sighted.push(...overwatch(battle, [...events, ...sighted].flatMap((e) => (e.type === 'move' ? [e.id] : []))))
  return [...events, ...sighted]
}

/**
 * An alien waiting its turn engages with its cluster once a soldier comes within ENGAGE_REACH of it; one unseen, a wave coming in, shows once a soldier sights it.
 */
export function sight(battle: Battle): GameEvent[] {
  const events: GameEvent[] = []
  const soldiers = battle.units.filter(isSoldier)
  const aliens = battle.units.filter((u) => u.side === 'alien' && !burrowing(u))
  const drawn = aliens.filter((u) => !u.engaged && soldiers.some((s) => distance(s, u) <= ENGAGE_REACH))
  for (const alien of drawn) engage(battle, alien)
  const sighted = aliens.filter((u) => !u.revealed && soldiers.some((s) => detects(battle, s, u)))
  for (const alien of sighted) alien.revealed = true
  if (sighted.length > 0) events.push({ type: 'reveal', units: sighted.map(({ id, x, y }) => ({ id, x, y })) })
  // A soldier at the extraction zone, or in the crowd at it, lifts off.
  for (const soldier of battle.extract ? soldiers.filter((s) => atExtraction(battle, s)) : []) {
    battle.units.splice(battle.units.indexOf(soldier), 1)
    battle.escaped.push(soldier.soldier!)
    battle.lifted[soldier.soldier!] = soldier.hp
    events.push({ type: 'escaped', id: soldier.id })
  }
  // A soldier, or a mech it called down, beside a civilian gets them out.
  const team = battle.units.filter((u) => u.side === 'human' && !u.civilian)
  for (const civilian of battle.units.filter((u) => u.civilian && team.some((s) => distance(s, u) <= (has(s, 'beacon') ? BEACON_REACH : 1)))) {
    battle.units.splice(battle.units.indexOf(civilian), 1)
    battle.saved++
    events.push({ type: 'saved', id: civilian.id })
  }
  return events
}

/** Whether `unit` is in the extraction zone or joined to it, side by side, through the team: the hero's own bodies cannot wall anyone off from it. */
function atExtraction(battle: Battle, unit: Unit): boolean {
  const team = battle.units.filter((u) => u.side === 'human' && !u.civilian)
  const crowd = [unit]
  for (const u of crowd) crowd.push(...team.filter((o) => !crowd.includes(o) && distance(o, u) <= 1))
  return crowd.some((u) => distance(u, battle.extract!) <= extractReach(battle))
}

/** Each soldier with the sentinel protocol beside an alien about to walk shoots it, once a turn each. */
export function sentries(battle: Battle, unit: Unit, watched: Set<number>): GameEvent[] {
  const events: GameEvent[] = []
  for (const sentry of battle.units.filter((u) => isSoldier(u) && has(u, 'sentinel') && !watched.has(u.id) && distance(u, unit) <= 1)) {
    if (unit.hp <= 0) break
    battle.actor = sentry.id
    const shot = weaponAttack(battle, sentry, spotted(battle), 'sentinel', unit)
    battle.actor = null
    if (shot.length > 0) watched.add(sentry.id)
    events.push(...shot)
  }
  return events
}

/**
 * A soldier's walk between or after its attacks, within the move it has left: with `toShot`, to the nearest tile with a
 * shot (of `secondary`, if given), if it has none here; else a Deadeye backs out of arm's reach. Never
 * into harm, off the uplink, or into sight of an alien not yet revealed.
 */
export function stride(battle: Battle, unit: Unit, seen: Set<number>, toShot: boolean, secondary?: Secondary): GameEvent[] {
  const left = battle.strides[unit.id] ?? 0
  const enemies = enemiesOf(battle, unit)
  const shotFrom = (end: Tile) => enemies.some((e) => shootable(battle, aiming(unit, secondary), end, e, seen))
  if (left <= 0 || unit.hp <= 0 || (toShot ? shotFrom(unit) : unit.stance !== 'standoff')) return []
  const barred = barredFor(battle, unit)
  const path = bestPath(paths(battle, unit, left), unit, (end, steps) =>
    toShot ? [barred(end), shotFrom(end) ? 0 : 1, steps] : [barred(end), Math.max(0, STANDOFF - Math.min(...enemies.map((e) => distance(e, end)))), steps],
  )
  const end = path.at(-1)
  if (!end || barred(end) || (toShot && !shotFrom(end))) return []
  battle.strides[unit.id] = left - costOf(battle, unit, path)
  const events: GameEvent[] = []
  walk(battle, unit, path, events)
  moved(battle, unit, path, events)
  return [...events, ...sight(battle)]
}

/** Tiles a soldier will not walk to between attacks: into harm, off the uplink, or into sight of an alien not yet revealed; 1 for those. */
function barredFor(battle: Battle, unit: Unit): (end: Tile) => number {
  const unseen = battle.units.filter((u) => u.side !== unit.side && !u.revealed)
  const reach = uplinkReach(battle)
  return (end) => (onTile(battle.acid, end) || besideFuel(battle, end) || (onTile(battle.fire, end) && !fireproof(battle, unit)) || (battle.uplink !== null && distance(end, battle.uplink) > reach) || unseen.some((alien) => sees(battle, end, alien)) ? 1 : 0)
}

/** A hero whose weapon dashes, with nothing in arm's reach, dashes to the nearest tile that brings an enemy into it, if one is within the dash. It costs no move. */
export function dash(battle: Battle, unit: Unit, seen: Set<number>): GameEvent[] {
  const tiles = unit.weapon && WEAPONS[unit.weapon].dash
  if (!tiles || unit.rooted > 0) return []
  const enemies = enemiesOf(battle, unit)
  const strikes = (end: Tile) => enemies.some((e) => shootable(battle, unit, end, e, seen))
  if (strikes(unit)) return []
  const barred = barredFor(battle, unit)
  const path = bestPath(paths(battle, unit, tiles), unit, (end, steps) => [barred(end), strikes(end) ? 0 : 1, steps])
  const end = path.at(-1)
  if (!end || barred(end) || !strikes(end)) return []
  const events: GameEvent[] = []
  walk(battle, unit, path, events)
  moved(battle, unit, path, events)
  return [...events.map((e) => (e.type === 'move' ? { ...e, with: 'dash' as const, src: { kind: 'basic' as const, id: 'dash' } } : e)), ...sight(battle)]
}

/** Overwatch: each prepared soldier shoots at the first alien that moved this turn and that it can now shoot. */
export function overwatch(battle: Battle, moved: number[]): GameEvent[] {
  const events: GameEvent[] = []
  for (const unit of battle.units.filter((u) => u.side === 'human' && u.order === 'prepare')) {
    const seen = spotted(battle)
    for (const id of moved) {
      const alien = battle.units.find((u) => u.id === id && u.revealed)
      battle.actor = unit.id
      const shot = alien && unit.hp > 0 ? weaponAttack(battle, unit, seen, 'overwatch', alien) : []
      battle.actor = null
      if (shot.length === 0) continue
      events.push(...shot)
      break
    }
  }
  return events
}

/** Whether the unit may act this turn: a soldier may not under an order; an alien may not until it engages, nor while it is surprised. */
export function armed(unit: Unit): boolean {
  if (unit.order) return false
  return unit.engaged && !unit.surprised
}

/** Burrowers underground surface once engaged: beside the soldier with the fewest allies near, ready to strike this turn. */
export function surface(battle: Battle): GameEvent[] {
  const events: GameEvent[] = []
  const soldiers = battle.units.filter(isSoldier)
  const company = (s: Unit) => battle.units.filter((u) => u.side === s.side && u !== s && !u.civilian && distance(u, s) <= COHESION).length
  const rising = battle.units.filter((u) => burrowing(u) && u.engaged)
  const alone = soldiers.reduce<Unit | undefined>((best, s) => (!best || company(s) < company(best) ? s : best), undefined)
  if (rising.length === 0 || !alone) return events
  freeTilesNear(battle, alone, rising.length).forEach((tile, i) => Object.assign(rising[i], tile, { revealed: true, surprised: 0 }))
  events.push({ type: 'reveal', units: rising.map(({ id, x, y }) => ({ id, x, y })) })
  // Surfacing is a move, so overwatch answers it.
  for (const m of rising) events.push({ type: 'move', src: alienSrc(m), id: m.id, path: [{ x: m.x, y: m.y }] })
  return events
}

/** Whether an alien is a burrower still underground. */
const burrowing = (unit: Unit) => !unit.revealed && unit.kind === 'burrower'
