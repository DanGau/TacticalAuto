// A battle's beat: whose turn it is, the next unit's action, and the consumables the player uses.
import { AIRSTRIKE, HEAL, PLATING, RAGE, SMOKE_TURNS, STIMS, type ConsumableId } from './consumables'
import { RESCUE_QUORUM } from './goals'
import {
  type Stats,
  BIG_BLAST_RADIUS,
  BLAST_RADIUS,
  CHILL_TURNS,
  BURN_TURNS,
  GRENADE_DAMAGE,
  GRID,
  isSoldier,
  MAX_BEATS,
  ROCKET_DAMAGE,
  type Battle,
  type Unit,
} from './battle'
import { DECOY } from './spawn'
import { TURRET } from './spawn'
import { dropUnit } from './spawn'
import { wreck } from './grid'
import { distance } from './grid'
import type { GameEvent } from './combat-event'
import { centreOf, fireproof, has, nearest, spotted, vipOf } from './fighters'
import { wound } from './wound'
import { attacksOf, blast, leap, napalm, shoot } from './attack'
import { alienAction, cloak, deploy, drone, feed, flashbang, forceField, heal, medkit, polymorph, pulse, secondWind, skirmish, slam, strew } from './abilities'
import { armed, moveSide, stride } from './sides'
/**
 * The next attack of the side on turn: a soldier makes SOLDIER_ATTACKS a turn, an alien one. A panicked soldier loses its turn; a phantom may cloak in place of its attacks.
 * An alien does what its kind does in place of a shot, if anything. Otherwise, first come what does not cost the
 * shot: a medkit, a medic's heal, a grenade. Then a rocket, when its moment has come, or else a shot.
 * Empty when no unit is left.
 */
function actNext(battle: Battle): GameEvent[] {
  const seen = spotted(battle)
  for (const unit of battle.units) {
    if (unit.side !== battle.turn || unit.id < battle.shooter || unit.civilian || !armed(battle, unit)) continue
    if (unit.id === battle.shooter) {
      if (battle.attacks >= attacksOf(unit)) continue
      // A further attack: a walk to a shot if it has none, the shot, then what follows the last, ending with a step back.
      battle.attacks++
      battle.actor = unit.id
      const events = [...stride(battle, unit, seen, true)]
      events.push(...shoot(battle, unit, seen))
      if (battle.attacks >= attacksOf(unit) && unit.hp > 0) events.push(...drone(battle, unit), ...skirmish(battle, unit), ...stride(battle, unit, seen, false))
      battle.actor = null
      if (events.length === 0) continue
      return events
    }
    if (unit.panicked) {
      unit.panicked = false
      battle.shooter = unit.id
      battle.attacks = attacksOf(unit)
      return [{ type: 'frozen', id: unit.id }]
    }
    const cloaked = cloak(battle, unit, seen)
    if (cloaked.length > 0) {
      battle.shooter = unit.id
      battle.attacks = attacksOf(unit)
      return cloaked
    }
    const special = alienAction(battle, unit)
    if (special) {
      if (special.length === 0) continue
      battle.shooter = unit.id
      battle.attacks = 1
      return special
    }
    const before = battle.attacks
    battle.attacks = 1
    battle.actor = unit.id
    const healed = unit.charges > 0 && unit.ability === 'medic' ? heal(battle, unit) : []
    const thrown = has(unit, 'grenade') && !unit.spent.includes('grenade') ? blast(battle, unit, seen, GRENADE_DAMAGE) : []
    if (thrown.length > 0) unit.spent.push('grenade')
    const fired =
      unit.charges <= 0 ? [] : unit.ability === 'rocket' ? blast(battle, unit, seen, ROCKET_DAMAGE, has(unit, 'bigBlast') ? BIG_BLAST_RADIUS : BLAST_RADIUS) : unit.ability === 'napalm' ? napalm(battle, unit, seen) : []
    if (healed.length + fired.length > 0) unit.charges--
    const powers = [...pulse(battle, unit, 'warcry'), ...pulse(battle, unit, 'emp'), ...flashbang(battle, unit, seen), ...forceField(battle, unit), ...leap(battle, unit, seen)]
    const slammed = fired.length > 0 ? [] : slam(battle, unit)
    const struck = fired.length > 0 ? fired : slammed.length > 0 ? slammed : shoot(battle, unit, seen)
    const acted = [...medkit(unit), ...secondWind(unit), ...polymorph(battle, unit, seen), ...strew(battle, unit, 'caltrops'), ...strew(battle, unit, 'firewall'), ...deploy(battle, unit, seen), ...powers, ...healed, ...thrown, ...struck]
    // What follows an action: a drone's shot, then a skirmisher's step back.
    const events = acted.length > 0 && unit.hp > 0 && attacksOf(unit) === 1 ? [...acted, ...drone(battle, unit), ...skirmish(battle, unit)] : acted
    battle.actor = null
    if (unit.side === 'human') events.push(...feed(battle, unit, events))
    if (events.length === 0) {
      battle.attacks = before
      continue
    }
    battle.shooter = unit.id
    // A pod unseen gives itself away when it opens fire.
    const pod = unit.pod === null ? null : battle.pods[unit.pod]
    if (pod && !pod.revealed) {
      pod.revealed = true
      events.unshift({ type: 'reveal', units: battle.units.filter((u) => u.pod === unit.pod).map(({ id, x, y }) => ({ id, x, y })) })
    }
    return events
  }
  return []
}

/** The next move stage or action, passing the turn when a side has nothing left to do. */
function act(battle: Battle): GameEvent[] {
  // After each side has passed once, nobody can act this beat.
  for (let passes = 0; passes < 2; passes++) {
    if (battle.stage === 'move') {
      const moves = moveSide(battle)
      battle.stage = 'shoot'
      battle.shooter = 0
      if (moves.length > 0) return moves
    }
    const action = actNext(battle)
    if (action.length > 0) return action
    // Surprise lasts until the aliens' turn ends.
    if (battle.turn === 'alien') for (const pod of battle.pods) pod.surprised = false
    battle.turn = battle.turn === 'human' ? 'alien' : 'human'
    battle.stage = 'move'
  }
  return []
}

/** Aliens in the fight the squad sees: revealed, and alert to it. */
export const foesInSight = (battle: Battle) => battle.units.filter((u) => u.side === 'alien' && u.pod !== null && battle.pods[u.pod].revealed && battle.pods[u.pod].alert)

/** What a consumable does as it is used. */
function useConsumable(battle: Battle, id: ConsumableId): GameEvent[] {
  const squad = battle.units.filter(isSoldier)
  const foes = foesInSight(battle)
  const events: GameEvent[] = []
  const used = (on: Unit[]) => events.unshift({ type: 'used', consumable: id, on: on.map((u) => u.id) })
  const boost = (stats: Partial<Stats>) => {
    for (const u of squad) u.stats = { ...u.stats, ...Object.fromEntries(Object.entries(stats).map(([k, v]) => [k, u.stats[k as keyof Stats] + v])) }
  }
  if (id === 'airstrike') {
    const centre = nearest(foes, centreOf(squad))
    if (!centre) return []
    const caught = battle.units.filter((u) => u.side === 'alien' && distance(u, centre) <= AIRSTRIKE.radius)
    used([centre])
    events.push({ type: 'rocket', id: centre.id, x: centre.x, y: centre.y, hits: caught.map((u) => ({ target: u.id, damage: AIRSTRIKE.damage })) })
    wreck(battle, centre, AIRSTRIKE.radius)
    for (const u of caught) wound(battle, u, AIRSTRIKE.damage, events)
  } else if (id === 'medkit') {
    used(squad)
    for (const u of squad) u.hp = Math.min(u.stats.hp, u.hp + HEAL)
  } else if (id === 'stims') {
    used(squad)
    boost(STIMS.stats)
    for (const u of squad) u.hp = Math.max(1, u.hp - STIMS.cost)
  } else if (id === 'rage') {
    used(squad)
    boost(RAGE)
  } else if (id === 'plating') {
    used(squad)
    for (const u of squad) u.armor += PLATING
  } else if (id === 'sentry' || id === 'decoy') {
    const owner = squad[0]
    if (!owner) return []
    const toward = nearest(battle.units.filter((u) => u.side === 'alien'), owner)
    // The decoy stands a few tiles toward the aliens; the turret beside the squad.
    const spot = id === 'decoy' && toward ? { x: owner.x + Math.sign(toward.x - owner.x) * 3, y: owner.y + Math.sign(toward.y - owner.y) * 3 } : owner
    const unit = dropUnit(battle, owner, id === 'sentry' ? TURRET : DECOY, { x: Math.max(0, Math.min(GRID - 1, spot.x)), y: Math.max(0, Math.min(GRID - 1, spot.y)) }, id === 'decoy' ? ['taunt'] : [])
    if (!unit) return []
    used([unit])
    events.push({ type: 'spawn', id: owner.id, unit: { id: unit.id, x: unit.x, y: unit.y } })
  } else {
    const struck = foes.filter((u) =>
      id === 'flashbang' ? !u.boss : id === 'cryo' ? !u.resists.includes('frost') : id === 'firebomb' ? !fireproof(battle, u) : id === 'painter' ? !u.resists.includes('mark') : true,
    )
    used(struck)
    for (const u of struck) {
      if (id === 'flashbang') u.panicked = true
      else if (id === 'smoke') u.suppressed = SMOKE_TURNS
      else if (id === 'cryo') u.chilled = CHILL_TURNS
      else if (id === 'firebomb') u.burning = BURN_TURNS
      else u.marked = true
    }
  }
  return events
}

/** What the player's consumables do, used since the last beat. */
function unleash(battle: Battle): GameEvent[] {
  return battle.primed.splice(0).flatMap((id) => useConsumable(battle, id))
}

/** Advances a battle one beat: a side's simultaneous move, or one unit's action. Does nothing outside the battle phase. */
export function stepBattle(battle: Battle): GameEvent[] {
  if (battle.phase !== 'battle') return []
  battle.beat++
  const events = battle.primed.length > 0 ? unleash(battle) : act(battle)
  const humans = battle.units.some(isSoldier)
  // Aliens left to beat: none once the commander falls, for the rest flee.
  const fled = battle.goal === 'assassinate' && !battle.units.some((u) => u.target)
  // A VIP rescue is not done until the VIP is out.
  const aliens = !fled && (battle.units.some((u) => u.side === 'alien') || battle.waves.length > 0 || (battle.vip !== null && battle.vip !== 'out'))
  // A rescue is over once no civilian is left to save: won if any were. A raid is won once it has the caches it came for.
  const emptied = battle.goal === 'rescue' && !battle.units.some((u) => u.civilian)
  const loaded = battle.goal === 'raid' && battle.grabbed >= battle.greed
  // A VIP rescue is lost with the VIP.
  const lost = battle.vip !== null && battle.vip !== 'out' && !vipOf(battle)
  if (!humans || !aliens || emptied || loaded || lost || battle.beat >= MAX_BEATS) {
    battle.phase = 'over'
    // With every alien beaten the squad has won, even if its last soldier fell to the same blast.
    battle.winner = lost ? 'alien' : !aliens || loaded || emptied || (!humans && battle.escaped.length > 0) ? 'human' : humans ? null : 'alien'
    // A rescue is won only by saving more than RESCUE_QUORUM: those got out, and those alive once no alien is left.
    if (battle.goal === 'rescue' && battle.winner === 'human' && battle.saved + battle.units.filter((u) => u.civilian).length <= RESCUE_QUORUM) battle.winner = 'alien'
    events.push({ type: 'end', winner: battle.winner })
  }
  return events
}
