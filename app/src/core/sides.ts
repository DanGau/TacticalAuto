// A side's simultaneous move: sighting aliens, walking, sentries, burrowers.
import { alienSrc, fx } from './sources'
import { weaponAttack } from './attack'
import { type Battle, ACID_DAMAGE, BURN_STACKS, isSoldier, type Unit, ENGAGE_REACH } from './battle'
import { opening } from './landing'
import { freeTilesNear } from './grid'
import { distance } from './grid'
import type { GameEvent } from './combat-event'
import { engage, immune, onTile, fireproof, foeHas, has, extractReach, BEACON_REACH, spotted } from './fighters'
import { fightPath, walk, COHESION } from './pathing'
import { detects } from './sight'
import { upkeep } from './upkeep'
import { moved, wound } from './wound'

/**
 * The side on turn has its upkeep; each of its units walks its path, lowest id first, an alien only once it
 * engages; acid burns those still in it; then newly sighted aliens are revealed.
 */
export function moveSide(battle: Battle): GameEvent[] {
  const events = [...(battle.opening ? opening(battle) : []), ...upkeep(battle), ...(battle.turn === 'alien' ? surface(battle) : [])]
  const watched = new Set<number>()
  for (const unit of battle.units) {
    if (unit.side !== battle.turn || unit.hp <= 0) continue
    const path = unit.civilian ? [] : unit.engaged ? fightPath(battle, unit) : []
    if (path.length === 0) continue
    // A sentry fires as the alien turns to go.
    if (unit.side === 'alien') events.push(...sentries(battle, unit, watched))
    if (unit.hp <= 0) continue
    walk(battle, unit, path, events)
    moved(battle, unit, path, events)
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
  return [...events, ...sight(battle)]
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

/** Whether an alien may act this turn: not until it engages, nor while it is surprised. */
export function armed(unit: Unit): boolean {
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
  for (const m of rising) events.push({ type: 'move', src: alienSrc(m), id: m.id, path: [{ x: m.x, y: m.y }] })
  return events
}

/** Whether an alien is a burrower still underground. */
const burrowing = (unit: Unit) => !unit.revealed && unit.kind === 'burrower'
