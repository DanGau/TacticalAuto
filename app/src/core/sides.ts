// A side's simultaneous move: sighting aliens, walking, sentries, overwatch, burrowers.
import type { Secondary } from './secondaries'
import { aiming } from './fighters'
import { shoot } from './attack'
import { GRID, type Battle, ACID_DAMAGE, BURN_TURNS, isSoldier, type Unit, type Tile, ENGAGE_REACH, STANDOFF } from './battle'
import { opening } from './entrances'
import { soldierUnit } from './spawn'
import { breach } from './grid'
import { freeTilesNear } from './grid'
import { walkingDistances } from './grid'
import { wreck } from './grid'
import { distance } from './grid'
import type { GameEvent } from './combat-event'
import { engageNearest, fightCap, walkersFighting, immune, onTile, fireproof, foeHas, has, GUARDIAN_REACH, lying, extractReach, carrying, BEACON_REACH, vipOf, nearest, extractionFrom, pursuers, spotted, uplinkReach, shootable, enemiesOf, besideFuel } from './fighters'
import { fleePath, fightPath, walk, paths, costOf, bestPath, COHESION, POCKET } from './pathing'
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
    if (path.length === 0 && unit.civilian === 'vip') events.push(...squeezePast(battle, unit))
    if (path.length === 0 && unit.order) events.push({ type: 'order', id: unit.id, order: unit.order })
    if (path.length === 0) continue
    // A sentry fires as the alien turns to go.
    if (unit.side === 'alien') events.push(...sentries(battle, unit, watched))
    if (unit.hp <= 0) continue
    walk(unit, path, events)
    moved(battle, unit, path, events)
    if (unit.order) events.push({ type: 'order', id: unit.id, order: unit.order })
  }
  // Acid burns each unit of the side still standing in it once the side has moved, so a unit free to move can step out.
  for (const unit of battle.units.filter((u) => u.side === battle.turn)) {
    if (!battle.acid.some((pool) => pool.x === unit.x && pool.y === unit.y) || immune(battle, unit, 'acid')) continue
    events.push({ type: 'hurt', id: unit.id, amount: ACID_DAMAGE, cause: 'acid' })
    wound(battle, unit, ACID_DAMAGE, events)
  }
  for (const unit of battle.units.filter((u) => u.side === battle.turn && onTile(battle.fire, u) && !fireproof(battle, u))) {
    unit.burning = BURN_TURNS
    events.push({ type: 'effect', id: unit.id, effect: foeHas(battle, unit, 'pyre') ? 'pyre' : 'napalm', amount: 0 })
  }
  // Spirit guardians strike each alien that ends its move near their wearer.
  if (battle.turn === 'alien') {
    for (const unit of battle.units.filter((u) => u.side === 'alien' && battle.units.some((g) => g.side === 'human' && g.hp > 0 && has(g, 'guardians') && distance(g, u) <= GUARDIAN_REACH))) {
      events.push({ type: 'effect', id: unit.id, effect: 'guardians', amount: -1 })
      wound(battle, unit, 1, events)
    }
  }
  const sighted = sight(battle)
  // Soldiers on overwatch fire once the aliens have moved and any alien sighted has taken its place.
  if (battle.turn === 'alien') sighted.push(...overwatch(battle, [...events, ...sighted].flatMap((e) => (e.type === 'move' ? [e.id] : []))))
  return [...events, ...sighted]
}

/**
 * An alien waiting its turn engages once a soldier comes within ENGAGE_REACH of it, nearest first, up to the most that
 * fight at once; one unseen, a wave coming in, shows once a soldier sights it.
 */
export function sight(battle: Battle): GameEvent[] {
  const events: GameEvent[] = []
  const soldiers = battle.units.filter(isSoldier)
  const aliens = battle.units.filter((u) => u.side === 'alien' && !burrowing(u))
  const drawn = aliens.filter((u) => !u.engaged && soldiers.some((s) => distance(s, u) <= ENGAGE_REACH))
  if (drawn.length > 0) engageNearest(battle, soldiers, Math.min(drawn.length, Math.max(0, fightCap(soldiers.length) - walkersFighting(battle))))
  const sighted = aliens.filter((u) => !u.revealed && soldiers.some((s) => detects(battle, s, u)))
  for (const alien of sighted) alien.revealed = true
  if (sighted.length > 0) events.push({ type: 'reveal', units: sighted.map(({ id, x, y }) => ({ id, x, y })) })
  // Getting out, a soldier with its hands free beside a squadmate down picks them up.
  for (const body of battle.extract ? lying(battle) : []) {
    const carrier = soldiers.find((s) => distance(s, body) <= 1 && !carrying(battle, s))
    if (!carrier) continue
    body.carrier = carrier.id
    events.push({ type: 'carried', id: carrier.id, soldier: body.soldier })
  }
  // A soldier beside a squadmate the aliens hold gets them up, at half health.
  for (const body of lying(battle)) {
    const captive = battle.captives.find((r) => r.soldier === body.soldier)
    const rescuer = captive && soldiers.find((s) => distance(s, body) <= 1)
    if (!captive || !rescuer) continue
    battle.captives.splice(battle.captives.indexOf(captive), 1)
    battle.downed.splice(battle.downed.indexOf(body), 1)
    const [tile] = freeTilesNear(battle, body, 1)
    const unit = soldierUnit(battle, captive, tile)
    unit.hp = Math.ceil(unit.stats.hp / 2)
    battle.units.push(unit)
    events.push({ type: 'freed', id: rescuer.id, unit: { id: unit.id, x: unit.x, y: unit.y } })
  }
  events.push(...escortVip(battle, soldiers))
  // A soldier at the extraction zone, or in the crowd at it, lifts off, with whoever it carries, once any VIP has.
  for (const soldier of battle.extract && battle.vip !== 'freed' ? soldiers.filter((s) => atExtraction(battle, s)) : []) {
    battle.units.splice(battle.units.indexOf(soldier), 1)
    battle.escaped.push(soldier.soldier!, ...battle.downed.filter((d) => d.carrier === soldier.id).map((d) => d.soldier))
    battle.lifted[soldier.soldier!] = soldier.hp
    battle.downed = battle.downed.filter((d) => d.carrier !== soldier.id)
    events.push({ type: 'escaped', id: soldier.id })
  }
  // A soldier or its mech beside a raid's cache grabs it, so a crowd of mechs cannot bar the way.
  const grabbers = battle.units.filter((u) => u.side === 'human' && !u.civilian)
  for (const cache of battle.caches.filter((c) => grabbers.some((s) => distance(s, c) <= 1))) {
    battle.caches.splice(battle.caches.indexOf(cache), 1)
    battle.grabbed++
    events.push({ type: 'grabbed', id: grabbers.find((s) => distance(s, cache) <= 1)!.id, x: cache.x, y: cache.y })
  }
  // A soldier, or a mech it called down, beside a civilian gets them out.
  const squad = battle.units.filter((u) => u.side === 'human' && !u.civilian)
  for (const civilian of battle.units.filter((u) => u.civilian && u.civilian !== 'vip' && squad.some((s) => distance(s, u) <= (has(s, 'beacon') ? BEACON_REACH : 1)))) {
    battle.units.splice(battle.units.indexOf(civilian), 1)
    battle.saved++
    events.push({ type: 'saved', id: civilian.id })
  }
  return events
}

/** Whether `unit` is in the extraction zone or joined to it, side by side, through the squad: the squad's own bodies cannot wall anyone off from it. */
function atExtraction(battle: Battle, unit: Unit): boolean {
  const squad = battle.units.filter((u) => u.side === 'human' && !u.civilian)
  const crowd = [unit]
  for (const u of crowd) crowd.push(...squad.filter((o) => !crowd.includes(o) && distance(o, u) <= 1))
  return crowd.some((u) => distance(u, battle.extract!) <= extractReach(battle))
}

/**
 * A VIP rescue's steps. The first soldier within BREACH_REACH of the VIP blows in the wall between them, catching the
 * guards: they engage, but do not shoot on their next turn. A soldier beside the VIP, once no alien in the fight stands
 * within FREE_REACH of it, frees them: the extraction zone
 * appears at the edge. A VIP at the extraction zone lifts off.
 */
export function escortVip(battle: Battle, soldiers: Unit[]): GameEvent[] {
  const vip = vipOf(battle)
  if (!vip) return []
  const events: GameEvent[] = []
  const breacher = battle.vip === 'held' && nearest(soldiers.filter((s) => distance(s, vip) <= BREACH_REACH), vip)
  if (breacher) {
    battle.vip = 'breached'
    const at = { x: vip.x + Math.sign(breacher.x - vip.x), y: vip.y + Math.sign(breacher.y - vip.y) }
    wreck(battle, at)
    const guards = battle.units.filter((u) => u.side === 'alien' && distance(u, vip) <= BREACH_REACH + 2)
    for (const guard of guards) Object.assign(guard, { revealed: true, engaged: true, surprised: 1 })
    events.push({ type: 'rocket', id: breacher.id, x: at.x, y: at.y, hits: [] })
  }
  const guarded = pursuers(battle, vip).some((u) => u.engaged && distance(u, vip) <= FREE_REACH)
  if (battle.vip === 'breached' && !guarded && soldiers.some((s) => distance(s, vip) <= BREACH_REACH)) {
    battle.vip = 'freed'
    // A VIP still walled in is broken out.
    if (walkingDistances(battle, vip).filter(Number.isFinite).length < POCKET) breach(battle, vip)
    battle.extract = extractionFrom(battle, vip)
    events.push({ type: 'extract', ...battle.extract })
  }
  if (battle.vip === 'freed' && atExtraction(battle, vip)) {
    battle.vip = 'out'
    battle.units.splice(battle.units.indexOf(vip), 1)
    events.push({ type: 'escaped', id: vip.id })
  }
  return events
}


/** How near the VIP a soldier must come to breach its building, and how near no alien in the fight may stand to free them. */
export const BREACH_REACH = 3

export const FREE_REACH = 10

/** Each soldier with the sentinel protocol beside an alien about to walk shoots it, once a turn each. */
export function sentries(battle: Battle, unit: Unit, watched: Set<number>): GameEvent[] {
  const events: GameEvent[] = []
  for (const sentry of battle.units.filter((u) => isSoldier(u) && has(u, 'sentinel') && !watched.has(u.id) && distance(u, unit) <= 1)) {
    if (unit.hp <= 0) break
    battle.actor = sentry.id
    const shot = shoot(battle, sentry, spotted(battle), 'sentinel', unit)
    battle.actor = null
    if (shot.length > 0) watched.add(sentry.id)
    events.push(...shot)
  }
  return events
}

/** A freed VIP with no way on in a narrow way swaps places with the soldier beside it who stands nearer the way out. */
function squeezePast(battle: Battle, vip: Unit): GameEvent[] {
  if (battle.vip !== 'freed' || !battle.extract) return []
  const toExtract = walkingDistances(battle, battle.extract)
  const score = (t: Tile) => toExtract[t.y * GRID + t.x]
  const soldier = battle.units.find((u) => isSoldier(u) && distance(u, vip) <= 1 && score(u) < score(vip))
  if (!soldier) return []
  const [was, to] = [{ x: vip.x, y: vip.y }, { x: soldier.x, y: soldier.y }]
  Object.assign(vip, to)
  Object.assign(soldier, was)
  return [{ type: 'move', id: vip.id, path: [to] }, { type: 'move', id: soldier.id, path: [was] }]
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
  const unseen = battle.units.filter((u) => u.side !== unit.side && !u.revealed)
  const reach = uplinkReach(battle)
  const barred = (end: Tile) =>
    onTile(battle.acid, end) || besideFuel(battle, end) || (onTile(battle.fire, end) && !fireproof(battle, unit)) || (battle.uplink !== null && distance(end, battle.uplink) > reach) || unseen.some((alien) => sees(battle, end, alien)) ? 1 : 0
  const path = bestPath(paths(battle, unit, left), unit, (end, steps) =>
    toShot ? [barred(end), shotFrom(end) ? 0 : 1, steps] : [barred(end), Math.max(0, STANDOFF - Math.min(...enemies.map((e) => distance(e, end)))), steps],
  )
  const end = path.at(-1)
  if (!end || barred(end) || (toShot && !shotFrom(end))) return []
  battle.strides[unit.id] = left - costOf(battle, unit, path)
  const events: GameEvent[] = []
  walk(unit, path, events)
  moved(battle, unit, path, events)
  return [...events, ...sight(battle)]
}

/** Overwatch: each soldier with it, or prepared, shoots at the first alien that moved this turn and that it can now shoot. */
export function overwatch(battle: Battle, moved: number[]): GameEvent[] {
  const events: GameEvent[] = []
  for (const unit of battle.units.filter((u) => u.side === 'human' && (has(u, 'overwatch') || u.order === 'prepare'))) {
    const seen = spotted(battle)
    for (const id of moved) {
      const alien = battle.units.find((u) => u.id === id && u.revealed)
      battle.actor = unit.id
      const shot = alien && unit.hp > 0 ? shoot(battle, unit, seen, 'overwatch', alien) : []
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

/** Burrowers underground surface once engaged: beside the soldier with the fewest squadmates near, ready to strike this turn. */
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
  for (const m of rising) events.push({ type: 'move', id: m.id, path: [{ x: m.x, y: m.y }] })
  return events
}

/** Whether an alien is a burrower still underground. */
const burrowing = (unit: Unit) => !unit.revealed && unit.kind === 'burrower'
