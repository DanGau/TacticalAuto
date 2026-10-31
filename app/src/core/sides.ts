// A side's simultaneous move: sighting pods, walking, sentries, overwatch, ambushes, burrowers.
import { shoot } from './attack'
import { type Battle, PATROL_MOVE, GRID, alert, ACID_DAMAGE, BURN_TURNS, isSoldier, type Unit, type Tile, revealed, SIGHT, IMPACT_REACH, type Effect } from './battle'
import { POD_BLAST } from './setup'
import { POD_REACH } from './setup'
import { soldierUnit } from './spawn'
import { spacedTile } from './grid'
import { freeTilesNear } from './grid'
import { walkingDistances } from './grid'
import { wreck } from './grid'
import { distance } from './grid'
import type { GameEvent } from './combat-event'
import { immune, onTile, fireproof, foeHas, has, GUARDIAN_REACH, lying, hunted, extractReach, carrying, BEACON_REACH, vipOf, nearest, EXTRACT_CLEARANCE, spotted, uplinkReach, shootable, enemiesOf, besideFuel } from './fighters'
import { fleePath, fightPath, patrolPath, walk, paths, exposure, costOf, bestPath, COHESION } from './pathing'
import { randomInt } from './rng'
import { canShoot, detects, sees } from './sight'
import { TUNING } from './tuning'
import { upkeep } from './upkeep'
import { moved, wound } from './wound'

/** The side on turn has its upkeep; each of its units walks its path, lowest id first; acid burns those still in it; then newly sighted pods are revealed. */
export function moveSide(battle: Battle): GameEvent[] {
  const events = [...(battle.breach ? impact(battle) : []), ...upkeep(battle), ...(battle.turn === 'alien' ? surface(battle) : [])]
  if (battle.turn === 'alien') {
    for (const pod of battle.pods) {
      // A pod that has reached its waypoint picks the next.
      const arrived = battle.units.some((u) => battle.pods[u.pod ?? -1] === pod && distance(u, pod.waypoint) <= PATROL_MOVE)
      if (!pod.alert && arrived) pod.waypoint = { x: randomInt(battle, GRID), y: randomInt(battle, GRID) }
    }
  }
  const watched = new Set<number>()
  battle.strides = {}
  for (const unit of battle.units) {
    if (unit.side !== battle.turn || unit.hp <= 0) continue
    const path = unit.civilian ? fleePath(battle, unit) : alert(battle, unit) ? fightPath(battle, unit) : patrolPath(battle, unit)
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
  const sighted = [...sight(battle), ...(battle.turn === 'human' ? spring(battle) : [])]
  // Soldiers on overwatch fire once the aliens have moved and any pod sighted has taken its place.
  if (battle.turn === 'alien') sighted.push(...overwatch(battle, [...events, ...sighted].flatMap((e) => (e.type === 'move' ? [e.id] : []))))
  // A patrolling pod that could not move, hemmed in by others, tries for somewhere else next turn.
  if (battle.turn === 'alien') {
    battle.pods.forEach((pod, index) => {
      const members = battle.units.filter((u) => u.pod === index)
      const moved = events.some((e) => e.type === 'move' && members.some((u) => u.id === e.id))
      if (!pod.alert && members.length > 0 && !moved) pod.waypoint = { x: randomInt(battle, GRID), y: randomInt(battle, GRID) }
    })
  }
  return [...events, ...sighted]
}

/**
 * Soldiers and pods notice each other, both by the same rule. A pod the squad notices first is ambushed: caught where
 * it stands. A pod that notices the squad first turns alert unseen and stalks it. When both notice at once, the pod
 * scrambles to fighting positions. A pod caught on its own turn does not shoot until its next.
 */
export function sight(battle: Battle): GameEvent[] {
  const events: GameEvent[] = []
  const soldiers = battle.units.filter(isSoldier)
  battle.pods.forEach((pod, index) => {
    if ((pod.revealed && pod.alert) || burrowing(battle, index)) return
    const members = battle.units.filter((u) => u.pod === index)
    const noticed = !pod.revealed && members.some((m) => soldiers.some((s) => detects(battle, s, m)))
    const notices = !pod.alert && members.some((m) => soldiers.some((s) => detects(battle, m, s)))
    const wasAlert = pod.alert
    // A pod the squad is setting an ambush on spots it first: the fight is on, with no ambush.
    if (pod.revealed && notices) {
      Object.assign(pod, { alert: true, surprised: battle.turn === 'alien' })
      events.push({ type: 'reveal', ambush: false, stalked: false, units: members.map(({ id, x, y }) => ({ id, x, y })) })
      return
    }
    // A pod the squad sees first, unaware of it, goes on as it was while the squad sets up its ambush.
    if (noticed && !notices && !wasAlert) {
      pod.revealed = true
      events.push({ type: 'sighted', units: members.map(({ id, x, y }) => ({ id, x, y })) })
      return
    }
    if (notices) {
      pod.alert = true
      pod.stalking = !noticed
    }
    if (!noticed) return
    const ambush = !wasAlert && !notices
    Object.assign(pod, { revealed: true, alert: true, ambushed: ambush, surprised: battle.turn === 'alien' && !wasAlert })
    events.push({ type: 'reveal', ambush, stalked: false, units: members.map(({ id, x, y }) => ({ id, x, y })) })
    if (!ambush && !wasAlert) for (const member of members) walk(member, fightPath(battle, member), events)
  })
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
  // A soldier at the extraction zone lifts off, with whoever it carries, once any VIP has.
  for (const soldier of battle.extract && battle.vip !== 'freed' ? soldiers.filter((s) => distance(s, battle.extract!) <= extractReach(battle)) : []) {
    battle.units.splice(battle.units.indexOf(soldier), 1)
    battle.escaped.push(soldier.soldier!, ...battle.downed.filter((d) => d.carrier === soldier.id).map((d) => d.soldier))
    battle.lifted[soldier.soldier!] = soldier.hp
    battle.downed = battle.downed.filter((d) => d.carrier !== soldier.id)
    events.push({ type: 'escaped', id: soldier.id })
  }
  // A soldier beside a raid's cache grabs it.
  for (const cache of battle.caches.filter((c) => soldiers.some((s) => distance(s, c) <= 1))) {
    battle.caches.splice(battle.caches.indexOf(cache), 1)
    battle.grabbed++
    events.push({ type: 'grabbed', id: soldiers.find((s) => distance(s, cache) <= 1)!.id, x: cache.x, y: cache.y })
  }
  // A soldier, or a mech it called down, beside a civilian gets them out.
  const squad = battle.units.filter((u) => u.side === 'human' && !u.civilian)
  for (const civilian of battle.units.filter((u) => u.civilian && u.civilian !== 'vip' && squad.some((s) => distance(s, u) <= (has(s, 'beacon') ? BEACON_REACH : 1)))) {
    battle.units.splice(battle.units.indexOf(civilian), 1)
    battle.saved++
    events.push({ type: 'saved', id: civilian.id })
  }
  battle.concealed = !hunted(battle)
  return events
}

/**
 * A VIP rescue's steps. The first soldier within BREACH_REACH of the VIP blows in the wall between them, catching the
 * guards: they do not shoot on their next turn. A soldier beside the VIP frees them: the extraction zone appears at the
 * edge and every pod comes for the squad. A VIP at the extraction zone lifts off.
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
    for (const pod of new Set(guards.map((u) => u.pod!))) Object.assign(battle.pods[pod], { revealed: true, alert: true, surprised: true })
    events.push({ type: 'rocket', id: breacher.id, x: at.x, y: at.y, hits: [] })
  }
  if (battle.vip === 'breached' && soldiers.some((s) => distance(s, vip) <= 1)) {
    battle.vip = 'freed'
    // Of edge tiles drawn, the one whose walk from the VIP is nearest VIP_WALK.
    const walk = walkingDistances(battle, vip)
    const off = (t: Tile) => Math.abs(walk[t.y * GRID + t.x] - VIP_WALK)
    battle.extract = Array.from({ length: 40 }, () => spacedTile(battle, [vip], EXTRACT_CLEARANCE, 'edge')).reduce((a, b) => (off(b) < off(a) ? b : a))
    for (const pod of battle.pods) Object.assign(pod, { alert: true, guard: false, waypoint: { x: vip.x, y: vip.y } })
    events.push({ type: 'extract', ...battle.extract })
  }
  if (battle.vip === 'freed' && distance(vip, battle.extract!) <= extractReach(battle)) {
    battle.vip = 'out'
    battle.units.splice(battle.units.indexOf(vip), 1)
    events.push({ type: 'escaped', id: vip.id })
  }
  return events
}

/** How near the VIP a soldier must come to breach its building, and about how far a walk the extraction zone is from it. */
export const BREACH_REACH = 3

export const VIP_WALK = 24

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

/**
 * A soldier's walk between or after its attacks, within the move it has left: with `toShot`, to the nearest tile with a
 * shot, if it has none here; else back to where the aliens' best shot at it is worst. Never
 * into harm, off the uplink, or into sight of a pod not yet revealed.
 */
export function stride(battle: Battle, unit: Unit, seen: Set<number>, toShot: boolean): GameEvent[] {
  const left = battle.strides[unit.id] ?? 0
  const enemies = enemiesOf(battle, unit)
  const shotFrom = (end: Tile) => enemies.some((e) => shootable(battle, unit, end, e, seen))
  if (left <= 0 || unit.hp <= 0 || (toShot && shotFrom(unit))) return []
  const unseen = battle.units.filter((u) => u.side !== unit.side && !revealed(battle, u))
  const reach = uplinkReach(battle)
  const barred = (end: Tile) =>
    onTile(battle.acid, end) || besideFuel(battle, end) || (onTile(battle.fire, end) && !fireproof(battle, unit)) || (battle.uplink !== null && distance(end, battle.uplink) > reach) || unseen.some((alien) => sees(battle, end, alien)) ? 1 : 0
  const path = bestPath(paths(battle, unit, left), unit, (end, steps) =>
    toShot ? [barred(end), shotFrom(end) ? 0 : 1, exposure(battle, enemies, end), steps] : [barred(end), exposure(battle, enemies, end), steps],
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
      const alien = battle.units.find((u) => u.id === id && revealed(battle, u))
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

/**
 * After the squad moves, each ambush it is setting is sprung once every soldier who can fight has a shot at the pod,
 * or after SETUP_TURNS: the pod turns alert and is ambushed, and the squad opens fire together.
 */
export function spring(battle: Battle): GameEvent[] {
  const events: GameEvent[] = []
  const soldiers = battle.units.filter((u) => isSoldier(u) && armed(battle, u))
  battle.pods.forEach((pod, index) => {
    if (!pod.revealed || pod.alert) return
    const members = battle.units.filter((u) => u.pod === index)
    pod.stalked++
    const ready = soldiers.every((s) => members.some((m) => canShoot(battle, s, m, s.stats.range)))
    if (!ready && pod.stalked <= SETUP_TURNS) return
    Object.assign(pod, { alert: true, ambushed: true, reeling: true })
    events.push({ type: 'reveal', ambush: true, stalked: false, units: members.map(({ id, x, y }) => ({ id, x, y })) })
  })
  battle.concealed = !hunted(battle)
  return events
}

/** Squad turns the squad sets up an ambush before it springs it, ready or not. */
export const SETUP_TURNS = 5

/** Whether the unit may act this turn: a soldier may not under an order; an alien may not while its pod is unaware, surprised or reeling. */
export function armed(battle: Battle, unit: Unit): boolean {
  if (unit.order) return false
  return unit.pod === null || (battle.pods[unit.pod].alert && !battle.pods[unit.pod].surprised && !battle.pods[unit.pod].reeling)
}

/**
 * Burrowers underground surface once the fight is on or a soldier comes within sight of them: beside the soldier with
 * the fewest squadmates near, ready to strike this turn.
 */
export function surface(battle: Battle): GameEvent[] {
  const events: GameEvent[] = []
  const soldiers = battle.units.filter(isSoldier)
  const company = (s: Unit) => battle.units.filter((u) => u.side === s.side && u !== s && !u.civilian && distance(u, s) <= COHESION).length
  battle.pods.forEach((pod, index) => {
    if (!burrowing(battle, index)) return
    const members = battle.units.filter((u) => u.pod === index)
    if (!hunted(battle) && !members.some((m) => soldiers.some((s) => distance(s, m) <= SIGHT))) return
    const alone = soldiers.reduce<Unit | undefined>((best, s) => (!best || company(s) < company(best) ? s : best), undefined)
    if (!alone) return
    freeTilesNear(battle, alone, members.length).forEach((tile, i) => Object.assign(members[i], tile))
    Object.assign(pod, { revealed: true, alert: true, stalking: false, ambushed: false, surprised: false })
    events.push({ type: 'reveal', ambush: false, stalked: true, units: members.map(({ id, x, y }) => ({ id, x, y })) })
    // Surfacing is a move, so overwatch answers it.
    for (const m of members) events.push({ type: 'move', id: m.id, path: [{ x: m.x, y: m.y }] })
  })
  return events
}

/** Whether a pod is burrowers still underground: unseen, and beyond the squad's sight. */
export function burrowing(battle: Battle, index: number): boolean {
  const members = battle.units.filter((u) => u.pod === index)
  return !battle.pods[index].revealed && members.length > 0 && members.every((u) => u.kind === 'burrower')
}

/** Drop pods' impact after a breach: each alien beside where a soldier landed is hurt, farther and harder with drop pod relics. */
export function impact(battle: Battle): GameEvent[] {
  const events: GameEvent[] = []
  battle.breach = false
  const soldiers = battle.units.filter(isSoldier)
  const held = (effect: Effect) => soldiers.some((s) => has(s, effect))
  const reach = held('podBlast') || held('podShred') || held('podFrost') ? POD_REACH : IMPACT_REACH
  const damage = TUNING.impactDamage + (held('podBlast') ? POD_BLAST : 0)
  for (const alien of battle.units.filter((u) => u.side === 'alien' && soldiers.some((s) => distance(s, u) <= reach))) {
    events.push({ type: 'hurt', id: alien.id, amount: damage, cause: 'impact' })
    wound(battle, alien, damage, events)
  }
  return events
}
